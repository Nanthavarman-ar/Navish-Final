# ================================================================
# 02_BAKE_FINAL_BABYLON_STATIC_FAST_v5.py
# ================================================================
# Blender -> Babylon FINAL BAKE — FAST MODE (v5)
#
# RUN THIS ONLY AFTER:
#   01_AUTO_LIGHT_FULL_IES_FINAL.py
#
# PURPOSE
#   Bake the CURRENT Blender look (materials + original textures +
#   Sun/Sky + Auto Lights + IES emitters + shadows/reflections that
#   Blender's COMBINED bake can capture) into textures.
#
# IMPORTANT TEXTURE-SAFETY DESIGN
#   - Original source materials are NOT replaced.
#   - Original UV0 is preserved on the SOURCE objects.
#   - The Lightmap UV is used as the bake UV.
#   - The bake result is NOT connected to Base Color on the source model.
#   - A separate EXPORT COPY is made.
#   - On the export copy, the baked image is wired straight into the
#     Material Output (Image Color -> Surface). Blender's glTF exporter
#     turns exactly that setup into KHR_materials_unlit, so Babylon (and
#     every other viewer) shows the image as-is and does NOT light it a
#     second time.
#   - Original material textures such as wood / road / tile / wall are
#     therefore already contained in the baked image and remain visible.
#
# RESULT
#   <blend-folder>/BABYLON_BAKED/<blend-name>_BABYLON_FINAL.glb
#
#   The source .blend remains editable. Change lights/materials and run
#   this script again to make a new final GLB.
#
# REQUIREMENTS
#   - Save the .blend before running.
#   - Run in Object Mode.
#   - Cycles must be available.
#   - Run 01 prep script first so "Lightmap" UV and IES emitters exist.
#
# NOTE ABOUT IES
#   IES emitters created by the prep script are emission meshes. During
#   baking, the low-power IES helper lights are disabled to avoid
#   double-lighting. The IES emission mesh remains active.
#
# ================================================================
# FIXES IN THIS VERSION (v3) - five independent bugs found and verified
# live this session, each of which on its own made the exported model
# look wrong (solid black, or a magenta color cast) in Babylon:
#
#   1. Combined-type Cycles bake needs its own "influence" pass toggles
#      (scene.render.bake.use_pass_*) explicitly turned on, or it
#      silently bakes a solid BLACK image with no error at all. This is
#      Blender's normal behavior whenever these settings were last left
#      off by an earlier AO/Normal-only bake in the same .blend - see
#      configure_cycles() below.
#
#   2. Cycles' "Light Tree" many-light sampling (the default in recent
#      Cycles versions) makes Combined-type BAKE return exactly zero
#      light contribution on a real many-light scene (dozens of
#      auto-placed spot lights + sun) - even at 256 samples, even
#      sun-only, even after recalculating normals - while a normal
#      camera render of the exact same scene, and a brand-new trivial
#      one-light test scene, both baked/rendered correctly. Camera
#      rendering doesn't go through this same light-sampling code path,
#      which is why only the bake was affected. Disabled below.
#      [v4 correction: this diagnosis was wrong - see fix #11. The zero
#      light came from stale export copies polluting the scene; the light
#      tree is back ON by default in v4 (BAKE_USE_LIGHT_TREE).]
#
#   3. The GPU was never actually being used even when a device was
#      listed and cycles.device='GPU' was set: CyclesPreferences.
#      compute_device_type (CUDA/OPTIX/HIP/ONEAPI/METAL/NONE) is a
#      SEPARATE setting that picks which backend Cycles dispatches to.
#      Left at 'NONE', GPU mode has nothing to run on and Cycles
#      silently falls back to CPU - no error, no warning. Fixed by
#      explicitly selecting a backend (OPTIX preferred) below.
#
#   4. Images were being packed in ONE BATCH LOOP after all objects had
#      finished baking. Confirmed live, reproducibly: baking 10 objects
#      and packing them all afterward (matching the old code) zeroed out
#      every one of the 10 images - despite each image reading back
#      perfectly correct data immediately after its own bake. Packing
#      each image right after ITS OWN bake, before Cycles goes on to
#      bake anything else, kept all of them correct. Fixed: pack() now
#      happens inside bake_one_object(), immediately.
#
#   5. Bake image names used a FIXED prefix ("BABYLON_BAKE_<object>").
#      Any .blend that has been baked with this script before
#      accumulates leftover images on that exact name. Reusing those
#      names - even after correctly removing and recreating the image
#      object - reproducibly corrupted the bake's color channels (R and
#      B channels ending up 2-9x the G channel, i.e. a magenta cast).
#      Fixed by giving every run's bake images a per-run timestamp in
#      the prefix, so a name can never collide with any previous run's
#      leftovers.
#
# FIXES IN v4 - found by inspecting the v3 GLB that looked fully black on
# the website (347 materials, 0 with KHR_materials_unlit):
#
#   6. WRONG UV IN THE GLB. The export material had no UV Map node, so the
#      glTF exporter wrote no texCoord for the baked image => TEXCOORD_0
#      = the ORIGINAL tiled UV0 (values up to -33..62), while the image was
#      baked on the Lightmap UV (exported as an unused TEXCOORD_1). Every
#      object sampled its baked image with the wrong UVs. Fixed twice
#      over: the export material now has an explicit UV Map node
#      ("Lightmap"), AND every other UV layer is removed from the export
#      COPY, so the GLB carries exactly one UV set (TEXCOORD_0 = Lightmap)
#      and no viewer can pick the wrong one. Source objects are untouched.
#
#   7. NOT UNLIT. The export material went Image -> Emission SHADER ->
#      Output, which the glTF exporter treats as an ordinary PBR material
#      (baseColor black, emissive texture). Only a COLOR socket wired
#      directly into Surface is exported as KHR_materials_unlit (see
#      io_scene_gltf2/blender/exp/material/unlit.py: detect_shadeless_
#      material). Fixed: Image Color -> Material Output Surface, no shader
#      node. The website's Baked Lighting Mode now auto-detects these.
#
#   8. NO VIEW TRANSFORM. COMBINED bake output is scene-linear; v3 saved it
#      as a plain sRGB PNG, so Blender's view transform (AgX/Filmic) was
#      never applied and the result could not match the Rendered viewport.
#      Fixed: bake into a FLOAT image, then write the 8-bit PNG with
#      Image.save_render(scene=...), which runs the scene's own colour
#      management. Verified in Blender 5.2: identical pixels to a camera
#      render of the same surface, where a plain image save differs.
#
#   9. FIXED 1024x1024 FOR EVERY OBJECT. An 85 m wall and a 0.1 m bolt got
#      the same image (~1.9 GB of GPU texture memory for 347 objects).
#      Image size now follows each object's world-space surface area
#      (BAKE_TEXELS_PER_M), clamped, and the whole set is scaled down if
#      it would exceed MAX_TEXTURE_VRAM_MB.
#
#  10. GLASS BAKED OPAQUE + ALL FACES ON SLOT 0. Two related problems in
#      make_export_copy(): (a) window panes were baked into an opaque unlit
#      image, so they blocked the view instead of being see-through;
#      (b) materials.clear() + append() resets every face's material_index
#      to 0, so all faces of a multi-material object ended up on the first
#      slot's material (invisible in v3 only because every slot shared the
#      same image). Now materials are assigned slot by slot, and glass slots
#      (Transmission >= 0.5 or Alpha <= 0.5, see GLASS_*) are exported as an
#      alpha-blended material instead of a baked one; objects made only of
#      glass are not baked at all.
#
#  11. STALE EXPORT COPIES POLLUTED THE BAKE. The "<name>__BABYLON_FINAL"
#      copies left in the .blend by an earlier run were only deleted AFTER
#      baking, so they sat in the scene during the bake as coplanar duplicate
#      geometry with an emissive OLD bake on it: they blocked sun/sky for the
#      surface being baked and re-lit it with the previous bake's pixels.
#      Any .blend baked before came out dark, blue-tinted and noisy (a sunlit
#      road baked as a dark bluish strip; a camera render with the copies
#      hidden showed it correctly lit). They are now removed first.
#
#  12. NOISY BAKES. Cycles' bake operator does not denoise, so at 32 samples any
#      surface lit mainly by sky/bounce light came out with heavy per-pixel
#      grain (visible on the website). Every finished bake is now denoised
#      with Blender's OpenImageDenoise through a private temporary scene's
#      compositor (Image -> Denoise -> output) and written with the user's own
#      view transform; the user's scene/compositor is untouched. If denoising
#      fails for any reason the bake falls back to the non-denoised image.
#      BABYLON_BAKE_DENOISE=0 turns it off.
#
#  Also new: per-object brightness diagnostics, a <glb>.bake_report.json
#  next to the GLB, and a post-export GLB self-check that fails loudly if a
#  material is not unlit or a baked image is not sampled with a valid
#  Lightmap UV.
#
# ================================================================
# v5 - "works for any building from any software" (SketchUp, FBX, OBJ,
# 3ds Max, Blender). Found on a real SketchUp house whose v4 bake came out
# almost white with black walls and black/white triangle strips:
#
#  13. OVEREXPOSURE. Sun + Nishita sky put sunlit walls at scene-linear
#      4-15; AgX maps that to flat white, so every texture vanished. A quick
#      probe bake of the 16 largest surfaces now sets the scene exposure so
#      the bright surfaces land at ~1.2 (written to the scene, so Blender's
#      Rendered view matches the GLB). A manual exposure is always kept;
#      BABYLON_BAKE_EXPOSURE=OFF or =<number> overrides.
#  14. FLIPPED FACES (SketchUp back faces, mirrored FBX parts) bake black.
#      Objects whose bake is too dark are baked again flipped and merged
#      texel by texel (lit side wins). Source normals are restored.
#      Baked materials are also exported double-sided, so flipped faces
#      no longer disappear in Babylon. BABYLON_BAKE_FIX_NORMALS=0 disables.
#  15. BROKEN LIGHTMAP UVs. A fixed 0.03 island margin on meshes with
#      thousands of separate faces left 0-3% of the UV square used: faces
#      smaller than a texel -> black/white triangle pattern or a solid
#      black block. Low-coverage Lightmap UVs are re-unwrapped with a
#      margin of a few texels (Lightmap Pack as fallback).
#  16. ONE-MESH MODELS (OBJ/FBX exports that merge the whole building) got
#      one blurry 2048px map. Oversized objects are split by material.
#      BABYLON_BAKE_SPLIT=0 disables.
#  17. METALS baked black (reflection-only colour); baked as a bright
#      non-metal of the same hue. FBX "self-glow" (diffuse copied into
#      emission) switched off for the bake. Both restored afterwards.
#  18. MISSING TEXTURES rendered magenta. Relinked by file name (blend
#      folder, its parent, BABYLON_BAKE_TEXTURE_DIRS); still-missing ones
#      are disconnected for the bake so the plain colour is baked.
#  19. Objects / slots with no material were skipped (missing from the
#      GLB); they now get a plain grey material, like Cycles renders them.
#  20. Genuinely black materials (tyres, black paint) no longer count as a
#      failed bake.
#  22. MIRRORED OBJECTS WITH CUSTOM NORMALS (negative scale + imported
#      custom normals, e.g. a mirrored SketchUp component) render and bake
#      pure black even in Blender. Their custom normals are removed for the
#      bake and put back afterwards.
#  23. NATIVE BLENDER SCENES: collection instances of linked asset files
#      (desks, chairs, lamps...), curves, text and Geometry Nodes were not
#      plain meshes, so they were never baked - missing from the GLB with
#      only their shadows on the floor. Everything that renders is now
#      realized into temporary meshes for the bake/export and removed again.
#      Exposure for the "Standard" view transform (no highlight roll-off)
#      targets 0.8 instead of 1.2.
#  24. NON-PRINCIPLED MATERIALS BAKED GREY: preparing the bake node used to
#      replace any material without a Principled BSDF by a default grey one
#      (wood, fabric etc. built from Diffuse/Glossy nodes). The material's
#      own shader is now left untouched.
#  21. DUPLICATE OBJECTS in the same place (SketchUp copy-in-place) shadow
#      each other -> one bakes black and z-fights in the GLB. Only the first
#      copy is baked and exported.
#
# NOTE: Blender cannot import ASCII FBX (SketchUp's default FBX export).
# Export FBX as binary, or use .glb / .obj from SketchUp instead.
#
# HEADLESS USE
#   blender -b Scene.blend --python-exit-code 1 --python 02_BAKE_..._v5.py
#   (--python-exit-code 1 makes a failed self-check / all-black bake return a
#   non-zero exit code; the "unregister_class ... _RNAMeta" line printed at
#   Blender shutdown is a harmless Blender 5.x quirk.)
# ================================================================

import bpy
import os
import re
import json
import math
import struct
import time
from pathlib import Path
from mathutils import Vector

# ================================================================
# USER SETTINGS
# ================================================================

# ---------------- Bake engine ----------------
BAKE_ENGINE = "CYCLES"

# Combined is intentionally used because the user wants the actual
# Blender-looking result while keeping original texture information.
BAKE_TYPE = "COMBINED"

# ---------------- Quality mode ----------------
# "DRAFT": fast iteration while you're still placing/tuning AutoLights -
#   noisier and smaller images, meant for quickly checking fixture
#   coverage/placement in Babylon, NOT for the model you actually publish.
# "FINAL": the settings confirmed live this session to actually avoid the
#   black/dim bake problem on a real many-light scene (with use_light_tree
#   forced off below) - use this for the GLB you upload for real.
# Switch this one line, nothing else, to go between the two.
#
# Optional environment overrides (mainly for headless test runs):
#   BABYLON_BAKE_QUALITY  DRAFT | FINAL
#   BABYLON_BAKE_ONLY     comma-separated object-name substrings to bake
#   BABYLON_BAKE_LIMIT    bake only the first N objects
#   BABYLON_BAKE_TAG      extra text in the GLB file name
#   BABYLON_BAKE_NO_SAVE  1 = do not save the .blend afterwards
BAKE_QUALITY_MODE = os.environ.get("BABYLON_BAKE_QUALITY", "FINAL").upper()  # "DRAFT" or "FINAL"

#   samples          Cycles samples per bake.
#   texels_per_m     Target lightmap density: image side ~= sqrt(world
#                    surface area in m^2) * texels_per_m, rounded to a power
#                    of two and clamped to [min_size, max_size].
#   max_vram_mb      Budget for ALL baked images once decoded on the GPU
#                    (RGBA8 + mip chain). If the plan exceeds it, every
#                    image is scaled down together until it fits.
_QUALITY_PRESETS = {
    "DRAFT": {"samples": 12, "texels_per_m": 12, "min_size": 32, "max_size": 512, "max_vram_mb": 256},
    "FINAL": {"samples": 32, "texels_per_m": 96, "min_size": 64, "max_size": 2048, "max_vram_mb": 1024},
}

BAKE_SAMPLES = _QUALITY_PRESETS[BAKE_QUALITY_MODE]["samples"]
BAKE_TEXELS_PER_M = _QUALITY_PRESETS[BAKE_QUALITY_MODE]["texels_per_m"]
BAKE_MIN_SIZE = _QUALITY_PRESETS[BAKE_QUALITY_MODE]["min_size"]
BAKE_MAX_SIZE = _QUALITY_PRESETS[BAKE_QUALITY_MODE]["max_size"]
MAX_TEXTURE_VRAM_MB = _QUALITY_PRESETS[BAKE_QUALITY_MODE]["max_vram_mb"]

# Cycles "Light Tree" many-light sampling. v3 forced it OFF (fix #2) after a
# many-light scene baked black with it on. That diagnosis was wrong: the black
# came from the stale export copies left in the .blend (fix #11). Measured in
# v4 on the same scene with the copies removed, light tree OFF picks ONE of
# the N lights uniformly per sample (36 spots + sun + sky => the sun is chosen
# ~1/38 of the time), giving a salt-and-pepper of sunlit/sky-only pixels at
# 32 samples, while light tree ON bakes a clean road whose mean colour matches
# a Blender camera render of it (179,177,172 vs 180,178,172). Default: ON.
# Set BABYLON_BAKE_LIGHT_TREE=0 to force it off again.
BAKE_USE_LIGHT_TREE = os.environ.get("BABYLON_BAKE_LIGHT_TREE", "1") == "1"

# Denoise every finished bake with Blender's OpenImageDenoise (compositor
# Denoise node) before it is written out. Cycles' own bake does not denoise,
# and at 32 samples surfaces lit mostly by sky/bounce light show heavy
# per-pixel grain (measured: synthetic MC noise error 0.39 -> 0.01 after this
# step). Set BABYLON_BAKE_DENOISE=0 to skip it.
DENOISE_BAKE = os.environ.get("BABYLON_BAKE_DENOISE", "1") == "1"

# Image format used internally and packed into GLB.
BAKE_IMAGE_FORMAT = "PNG"

# v4: bake into a FLOAT (scene-linear) image, then write the final 8-bit
# PNG through Image.save_render() so Blender's view transform (AgX etc.)
# is applied - see fix #8 in the header. Leave True.
BAKE_FLOAT = True

# Margin around UV islands in pixels (scaled down for small images, see
# bake_margin_for()).
BAKE_MARGIN_PX = 8

# A baked image whose brightest sampled pixel (scene-linear, before the
# view transform) is below this is reported as BLACK. ~0.003 linear is
# ~6/255 after sRGB encoding.
BLACK_LINEAR_MAX = 0.003

# If MORE than this fraction of the baked images are black the run is
# treated as systematically broken and ends with an error (a scene with a
# few genuinely unlit objects is fine; 50%+ black is not).
MAX_BLACK_FRACTION = 0.5

# ---------------- Glass / transparent materials ----------------
# A COMBINED bake of a glass pane is just "whatever is behind it, dimmed",
# and an unlit opaque texture can never be see-through. With
# "TRANSPARENT", material slots that are clearly glass are NOT baked: the
# export copy gets a plain alpha-blended PBR material for that slot
# instead (window panes stay see-through on the website, like in Blender's
# Rendered view). Objects made ONLY of glass are skipped by the bake
# entirely. "BAKE" restores the v3 behaviour (opaque baked glass).
# v5: exposure. "AUTO" (default) measures the lit scene with a few quick
# probe bakes and sets the scene exposure so sunlit surfaces don't blow out
# to white (which hid every texture). A number (e.g. -3.5) forces that
# exposure; "OFF" keeps the scene's own value. An exposure you set yourself
# in Blender is always kept.
EXPOSURE_MODE = os.environ.get("BABYLON_BAKE_EXPOSURE", "AUTO").strip().upper()
AUTO_EXPOSURE_TARGET = 1.2       # scene-linear value for the bright (p90) surfaces
# "Standard" / "Raw" have no highlight roll-off - anything above 1.0 clips
# to flat white - so the bright surfaces are put a bit below 1.0 there.
AUTO_EXPOSURE_TARGET_NO_ROLLOFF = 0.8
AUTO_EXPOSURE_DEADBAND = 0.6     # stops; smaller corrections are not applied
AUTO_EXPOSURE_RANGE = (-8.0, 4.0)
AUTO_EXPOSURE_PROBES = 16

# v5: flipped faces (SketchUp back faces, FBX/3ds Max mirrored parts) bake
# black. Objects whose bake looks too dark are baked a second time flipped
# and merged texel by texel (see bake_flipped_and_merge).
FIX_FLIPPED_FACES = os.environ.get("BABYLON_BAKE_FIX_NORMALS", "1") == "1"
FLIP_DARK_RATIO = 0.03           # "dark" = below 3% of the scene's median surface
FLIP_DARK_TEXEL_FRACTION = 0.10  # re-bake when more than 10% of texels are dark

# v5: metals bake black in a COMBINED bake; bake them as a bright non-metal.
METAL_BAKE_FIX = True
METAL_BAKE_LUMINANCE = 0.5

# v5: plain base colours darker than this are "genuinely black" materials
# (tyres, black paint, SketchUp *8) - a black bake there is correct and is
# not counted as a failure.
DARK_ALBEDO_MAX = 0.03

# v5: baked materials are exported double-sided. The lightmap is the same on
# both sides, and single-sided faces with flipped normals were invisible
# from the front in Babylon (missing walls).
DOUBLE_SIDED_EXPORT = os.environ.get("BABYLON_BAKE_DOUBLE_SIDED", "1") == "1"

DEFAULT_MATERIAL_NAME = "BABYLON_DEFAULT_GREY"
LIGHT_LIKE_WORDS = ("light", "lamp", "bulb", "led", "emiss", "glow", "neon", "screen", "tv", "candle", "fire")

GLASS_HANDLING = "TRANSPARENT"  # "TRANSPARENT" or "BAKE"

# A slot counts as glass when its Principled Transmission Weight is at least
# this, or its (unlinked) Alpha is at most GLASS_ALPHA_MAX.
GLASS_TRANSMISSION_MIN = 0.5
GLASS_ALPHA_MAX = 0.5

# Opacity of the exported glass material, used when the source material has
# no usable alpha of its own (transmission-only glass).
GLASS_EXPORT_ALPHA = 0.25
GLASS_DEFAULT_TINT = (0.72, 0.85, 0.95, 1.0)

# ---------------- UV ----------------
LIGHTMAP_UV_NAME = "Lightmap"

# If the prep script did not create a Lightmap UV, this script can create
# one automatically. It will NEVER overwrite UV0.
AUTO_CREATE_LIGHTMAP_UV = True

# Reuse the Lightmap UV generated by the 01 prep script. Do NOT run
# Smart Project again when the UV already exists; this saves a lot of time.
REUSE_EXISTING_LIGHTMAP_UV = True
LIGHTMAP_UV_MARGIN = 0.03
# v5: a Lightmap UV covering less than this share of the UV square is
# re-unwrapped (see repair_lightmap_uv).
LIGHTMAP_MIN_COVERAGE = 0.20
# v5: a single object that would need more than this many times the max
# bake size (OBJ/FBX exports often merge a whole building into one mesh) is
# split by material so every part gets its own lightmap.
SPLIT_OVERSIZE_FACTOR = 2.0
SPLIT_LARGE_OBJECTS = os.environ.get("BABYLON_BAKE_SPLIT", "1") == "1"

# ---------------- Output ----------------
OUTPUT_FOLDER_NAME = "BABYLON_BAKED"

EXPORT_GLTF = True
EXPORT_GLTF_FORMAT = "GLB"

# If True, generated baked images are packed into the .blend before export.
PACK_BAKE_IMAGES = True

# Save the blend after successful bake/export.
SAVE_BLEND_AFTER_BAKE = os.environ.get("BABYLON_BAKE_NO_SAVE", "") != "1"

# ---------------- Export material ----------------
# v4: the export material is Image(Lightmap UV).Color -> Material Output
# Surface, which the glTF exporter writes as KHR_materials_unlit. See fix
# #7 in the header. There is intentionally no Emission/Principled option.

# Scene-linear colour space of the temporary float bake images.
BAKE_FLOAT_COLORSPACE = "Linear Rec.709"

# Temp folder (inside BABYLON_BAKED) for the AgX-applied PNGs; deleted
# after the GLB is written.
TEMP_PNG_FOLDER_NAME = "_bake_tmp"

# ---------------- Safety ----------------
DELETE_OLD_EXPORT_COLLECTION = True
EXPORT_COLLECTION_NAME = "BABYLON_FINAL_EXPORT"

# Objects created by the prep script.
IES_EMITTER_PREFIX = "IES_Emitter_"
IES_HELPER_PREFIX = "IES_Helper_"
AUTO_LIGHT_PREFIX = "AutoLight_"

# Generated prep collection.
GENERATED_COLLECTION_NAME = "BABYLON_AUTO_LIGHTS"

# Bake image prefix.
# FIX #5: must be unique per run - see file header.
_RUN_TOKEN = str(int(time.time()))
BAKE_IMAGE_PREFIX = f"BAKE_{_RUN_TOKEN}_"

# Temporary bake node.
BAKE_NODE_NAME = "BABYLON_BAKE_TARGET"

# ---------------- Color management ----------------
BAKE_COLORSPACE = "sRGB"

# ---------------- Performance ----------------
BAKE_OBJECTS_ONE_BY_ONE = True
SKIP_EMPTY_MESHES = True
SKIP_IES_EMITTERS = True
SKIP_HIDDEN_SOURCE_OBJECTS = False

# ================================================================
# LOGGING
# ================================================================

START_TIME = time.time()
LAST_TIME = START_TIME


def log(msg):
    global LAST_TIME
    now = time.time()
    print(
        f"[BABYLON FINAL BAKE] "
        f"[+{now-LAST_TIME:6.1f}s | total {now-START_TIME:7.1f}s] {msg}",
        flush=True,
    )
    LAST_TIME = now


# ================================================================
# BASIC HELPERS
# ================================================================

def ensure_object_mode():
    try:
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass


def view_layer_objects():
    # Filter None: right after objects are deleted (remove_stale_export_copies)
    # the view layer can briefly still hold empty entries in background mode.
    return [o for o in bpy.context.view_layer.objects if o is not None]


def is_ies_emitter(obj):
    return obj.name.startswith(IES_EMITTER_PREFIX)


def is_generated_helper(obj):
    return (
        obj.name.startswith(IES_HELPER_PREFIX)
        or obj.name.startswith(AUTO_LIGHT_PREFIX)
    )


def is_model_mesh(obj):
    if obj.type != "MESH":
        return False

    if not obj.data:
        return False

    if SKIP_EMPTY_MESHES and len(obj.data.polygons) == 0:
        return False

    if SKIP_IES_EMITTERS and is_ies_emitter(obj):
        return False

    if obj.name.startswith(IES_EMITTER_PREFIX):
        return False

    # FIX: exclude this script's OWN export copies from a previous run.
    if obj.get("BABYLON_FINAL_BAKED"):
        return False

    if obj.name.endswith("__BABYLON_FINAL"):
        return False

    return True


def safe_filename(name):
    return re.sub(r"[^A-Za-z0-9_\-]+", "_", name)


def get_blend_dir():
    if not bpy.data.filepath:
        raise RuntimeError(
            "SAVE the .blend first (Ctrl+S), then run the bake script."
        )
    return Path(bpy.path.abspath("//")).resolve()


def get_output_dir():
    folder = get_blend_dir() / OUTPUT_FOLDER_NAME
    folder.mkdir(parents=True, exist_ok=True)
    return folder


# ================================================================
# COLLECTION HELPERS
# ================================================================

def get_or_create_collection(name):
    col = bpy.data.collections.get(name)

    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)

    return col


def delete_collection_objects(collection):
    for obj in list(collection.objects):
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception as e:
            print(f"  [EXPORT CLEANUP WARNING] {obj.name}: {e}")


# ================================================================
# MATERIAL HELPERS
# ================================================================

def find_principled(mat):
    if not mat or not mat.use_nodes:
        return None

    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node

    return None


def find_output(mat):
    if not mat or not mat.use_nodes:
        return None

    for node in mat.node_tree.nodes:
        if node.type == "OUTPUT_MATERIAL":
            return node

    return None


def ensure_material_nodes(mat):
    if mat is None:
        return None

    mat.use_nodes = True

    if find_principled(mat) is None:
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links

        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.name = "Principled BSDF"

        out = find_output(mat)
        if out is None:
            out = nodes.new("ShaderNodeOutputMaterial")

        links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    return find_principled(mat)


def set_image_colorspace(image, name):
    if not image:
        return

    try:
        image.colorspace_settings.name = name
    except Exception:
        pass


def final_image_name(obj):
    return f"{BAKE_IMAGE_PREFIX}{safe_filename(obj.name)}"


def get_or_create_bake_image(obj, size):
    """
    Temporary FLOAT (scene-linear) bake target, `size` x `size`. The final
    8-bit image that goes into the GLB is produced from it by
    finalize_bake_image() after the bake.
    """
    image_name = f"BAKEF_{_RUN_TOKEN}_{safe_filename(obj.name)}"

    old = bpy.data.images.get(image_name)

    if old:
        try:
            bpy.data.images.remove(old)
        except Exception:
            pass

    image = bpy.data.images.new(
        name=image_name,
        width=size,
        height=size,
        alpha=False,
        float_buffer=BAKE_FLOAT,
    )

    # Float bake data is scene-linear; the view transform is applied later by
    # save_render(). Byte images keep the old sRGB behaviour.
    set_image_colorspace(
        image, BAKE_FLOAT_COLORSPACE if BAKE_FLOAT else BAKE_COLORSPACE
    )

    image["BABYLON_BAKED"] = True
    image["SOURCE_OBJECT"] = obj.name
    image["BAKE_TYPE"] = BAKE_TYPE
    image["BAKE_UV"] = LIGHTMAP_UV_NAME
    image["BAKE_SIZE"] = size

    return image


# ================================================================
# BAKE SIZE PLANNING (fix #9)
# ================================================================

def object_surface_area(obj):
    """World-space surface area in m^2 (uniform-scale approximation)."""
    mesh = obj.data
    area = sum(p.area for p in mesh.polygons)
    sx, sy, sz = (abs(v) for v in obj.matrix_world.to_scale())
    uniform = (sx * sy * sz) ** (1.0 / 3.0) if sx * sy * sz > 0 else 1.0
    return area * uniform * uniform


def _pow2_near(value):
    return 2 ** int(round(math.log2(max(value, 1.0))))


def _size_for(area, scale):
    raw = math.sqrt(max(area, 1e-9)) * BAKE_TEXELS_PER_M * scale
    return int(min(BAKE_MAX_SIZE, max(BAKE_MIN_SIZE, _pow2_near(raw))))


def estimated_vram_mb(sizes):
    # RGBA8 + full mip chain (x4/3) once decoded on the GPU.
    return sum(s * s * 4 * (4.0 / 3.0) for s in sizes) / (1024.0 * 1024.0)


def strip_mirrored_custom_normals(meshes):
    """
    v5: a mirrored object (negative scale - SketchUp mirrored components,
    FBX mirrored instances) with imported CUSTOM normals renders and bakes
    pure BLACK in Cycles: the custom normals end up pointing into the
    surface. Seen on a whole mirrored building in a SketchUp house (Blender's
    own render was black too). Remove them for the bake; restored after.
    Returns an undo list.
    """
    undo = []
    done = set()

    for obj in meshes:
        mesh = obj.data
        if mesh.name in done or obj.matrix_world.determinant() >= 0:
            continue
        if not getattr(mesh, "has_custom_normals", False):
            continue
        attr = mesh.attributes.get("custom_normal")
        if attr is None:
            continue
        done.add(mesh.name)
        try:
            field = "vector" if hasattr(attr.data[0], "vector") else "value" if len(attr.data) else "value"
            sample = getattr(attr.data[0], field) if len(attr.data) else 0
            comps = len(sample) if hasattr(sample, "__len__") else 1
            values = [0] * (len(attr.data) * comps)
            attr.data.foreach_get(field, values)
            undo.append((mesh, attr.data_type, attr.domain, field, values))
            mesh.attributes.remove(attr)
        except Exception as e:
            print(f"  [NORMALS WARNING] {obj.name}: {e}")

    if undo:
        log(f"{len(undo)} mirrored mesh(es): custom normals removed for the bake (they made the object black).")
    return undo


def restore_custom_normals(undo):
    for mesh, data_type, domain, field, values in undo:
        try:
            attr = mesh.attributes.new("custom_normal", data_type, domain)
            attr.data.foreach_set(field, values)
        except Exception as e:
            print(f"  [NORMALS WARNING] could not restore custom normals on {mesh.name}: {e}")


DUPLICATES_HIDDEN = []


def restore_duplicates():
    for obj, hidden in DUPLICATES_HIDDEN:
        try:
            obj.hide_render = hidden
        except Exception:
            pass
    DUPLICATES_HIDDEN.clear()


def drop_duplicate_objects(meshes):
    """
    v5: SketchUp / FBX models often contain the same object twice in the
    same place (copy-paste in place, doubled components). Each copy shadows
    the other completely, so one bakes BLACK, and in the GLB the two
    z-fight and the black one shows through. Keep the first copy only (the
    source .blend is not changed; duplicates are just left out of the bake
    and the GLB). BABYLON_BAKE_KEEP_DUPLICATES=1 disables.
    """
    if os.environ.get("BABYLON_BAKE_KEEP_DUPLICATES", "") == "1":
        return meshes

    seen = {}
    kept, dropped = [], []

    for obj in meshes:
        mw = obj.matrix_world
        corners = sorted(
            tuple(round(c, 2) for c in (mw @ Vector(v)))
            for v in obj.bound_box
        )
        key = (
            len(obj.data.vertices),
            len(obj.data.polygons),
            tuple(corners),
            tuple(s.material.name if s.material else "" for s in obj.material_slots),
        )
        if key in seen:
            dropped.append((obj.name, seen[key]))
            # Hidden from render for the bake (restored afterwards) - left
            # visible it would still shadow the copy that IS baked.
            DUPLICATES_HIDDEN.append((obj, obj.hide_render))
            obj.hide_render = True
            continue
        seen[key] = obj.name
        kept.append(obj)

    for name, original in dropped[:20]:
        log(f"  duplicate left out: {name} (same as {original})")
    if dropped:
        log(f"{len(dropped)} duplicate object(s) left out of the bake and GLB.")
    return kept


SPLIT_THIS_RUN = set()


def split_oversized_objects(meshes):
    """
    v5: one object holding a whole building (typical of OBJ / FBX / 3ds Max
    exports) got ONE 2048px lightmap for hundreds of m2 - a blurry bake.
    Such objects are separated by material (in the source .blend - logged);
    the parts get fresh Lightmap UVs. Returns the new list of meshes.
    """
    if not SPLIT_LARGE_OBJECTS:
        return meshes

    result = []
    for obj in meshes:
        raw = math.sqrt(max(object_surface_area(obj), 1e-9)) * BAKE_TEXELS_PER_M
        filled = [s for s in obj.material_slots if s.material]
        if raw <= BAKE_MAX_SIZE * SPLIT_OVERSIZE_FACTOR or len(filled) < 2:
            result.append(obj)
            continue

        before = set(bpy.data.objects)
        try:
            ensure_object_mode()
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            if obj.data.users > 1:
                obj.data = obj.data.copy()
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.separate(type="MATERIAL")
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception as e:
            print(f"  [SPLIT WARNING] {obj.name}: {e}")
            try:
                bpy.ops.object.mode_set(mode="OBJECT")
            except Exception:
                pass
            result.append(obj)
            continue

        parts = [obj] + [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        for part in parts:
            # Drop the slots this part no longer uses so it isn't treated as
            # e.g. glass+wall, then give it its own Lightmap UV.
            used = {p.material_index for p in part.data.polygons}
            for i in reversed(range(len(part.material_slots))):
                if i not in used and len(part.material_slots) > 1:
                    part.active_material_index = i
                    try:
                        bpy.ops.object.select_all(action="DESELECT")
                        part.select_set(True)
                        bpy.context.view_layer.objects.active = part
                        bpy.ops.object.material_slot_remove()
                    except Exception:
                        pass
            part["BABYLON_SPLIT_FROM"] = obj.name
            SPLIT_THIS_RUN.add(part.name)
            result.append(part)
        log(f"Split {obj.name} by material into {len(parts)} objects (one lightmap each).")

    return sorted(set(result), key=lambda o: o.name.lower())


def plan_bake_sizes(meshes):
    """
    Returns {object name: image side in px}. Scales every image down
    together (halving the density) until the whole set fits the VRAM budget.
    """
    areas = {o.name: object_surface_area(o) for o in meshes}

    scale = 1.0
    sizes = {n: _size_for(a, scale) for n, a in areas.items()}
    total = estimated_vram_mb(sizes.values())

    while total > MAX_TEXTURE_VRAM_MB and scale > 1.0 / 64.0:
        scale *= 0.5
        sizes = {n: _size_for(a, scale) for n, a in areas.items()}
        total = estimated_vram_mb(sizes.values())

    hist = {}
    for s in sizes.values():
        hist[s] = hist.get(s, 0) + 1

    log(
        f"Bake size plan: {len(sizes)} object(s), density scale x{scale:g}, "
        f"~{total:.0f} MB GPU texture memory (budget {MAX_TEXTURE_VRAM_MB} MB). "
        f"Size histogram: {dict(sorted(hist.items()))}"
    )

    if total > MAX_TEXTURE_VRAM_MB:
        print(
            f"  [SIZE WARNING] Even at the minimum density the set needs "
            f"~{total:.0f} MB (> {MAX_TEXTURE_VRAM_MB} MB). Raise "
            f"MAX_TEXTURE_VRAM_MB or reduce the object count."
        )

    return sizes


def bake_margin_for(size):
    return max(2, min(BAKE_MARGIN_PX, size // 128))


# ================================================================
# BAKE DIAGNOSTICS (A3)
# ================================================================

def image_stats(image, pixel_stride=7):
    """
    (mean, max, nonzero_fraction) of scene-linear RGB over a strided sample
    of pixels. Reads only R,G,B of each whole pixel - Blender stores 4
    floats per pixel even for alpha=False images, with alpha a constant
    1.0, which fooled the v3 black check into reporting "bright" for images
    that were 100% black in RGB.
    """
    try:
        import numpy as np

        buf = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(buf)
        rgb = buf.reshape(-1, 4)[:, :3][:: max(1, pixel_stride)]
        peak = rgb.max(axis=1)
        return float(rgb.mean()), float(peak.max()), float((peak > 1e-6).mean())
    except Exception:
        pass

    try:
        pixels = image.pixels[:]
        n = len(pixels) // 4
        vals = []
        for p in range(0, n, max(1, pixel_stride * 13)):
            i = p * 4
            vals.append(max(pixels[i], pixels[i + 1], pixels[i + 2]))
        if not vals:
            return 0.0, 0.0, 0.0
        return (
            sum(vals) / len(vals),
            max(vals),
            sum(1 for v in vals if v > 1e-6) / len(vals),
        )
    except Exception:
        return 0.0, 0.0, 0.0


def is_glass_material(mat):
    """True for a clearly see-through Principled material (see GLASS_*)."""
    if GLASS_HANDLING != "TRANSPARENT" or not mat:
        return False

    bsdf = find_principled(mat)

    if bsdf is None:
        return False

    for key in ("Transmission Weight", "Transmission"):
        trans = bsdf.inputs.get(key)
        if (
            trans is not None
            and not trans.is_linked
            and trans.default_value >= GLASS_TRANSMISSION_MIN
        ):
            return True

    alpha = bsdf.inputs.get("Alpha")
    if (
        alpha is not None
        and not alpha.is_linked
        and alpha.default_value <= GLASS_ALPHA_MAX
    ):
        return True

    return False


def is_glass_only_object(obj):
    """Every filled material slot is glass -> nothing to bake."""
    mats = [s.material for s in obj.material_slots if s.material]
    return bool(mats) and all(is_glass_material(m) for m in mats)


def material_flags(obj):
    """Cheap description of anything that could make a bake black/odd."""
    flags = set()

    for slot in obj.material_slots:
        mat = slot.material

        if not mat:
            flags.add("no-material")
            continue

        bsdf = find_principled(mat)

        if bsdf is None:
            flags.add("no-principled")
            continue

        alpha = bsdf.inputs.get("Alpha")
        if alpha is not None and (alpha.is_linked or alpha.default_value < 0.99):
            flags.add("alpha")

        for key in ("Transmission Weight", "Transmission"):
            trans = bsdf.inputs.get(key)
            if trans is not None and (trans.is_linked or trans.default_value > 0.01):
                flags.add("transmission")
                break

    return sorted(flags)


def ensure_bake_node(mat, image):
    # v5: only make sure there is a node tree. v4 called
    # ensure_material_nodes() here, which - for any material WITHOUT a
    # Principled BSDF (Diffuse/Glossy mixes, toon, custom groups: most
    # hand-built Blender materials) - added a default grey Principled and
    # wired it into the Material Output, replacing the real shader. Every
    # such material baked plain grey (e.g. the classroom's wooden desks).
    if not mat.use_nodes:
        mat.use_nodes = True

    nodes = mat.node_tree.nodes

    node = nodes.get(BAKE_NODE_NAME)

    if node is None or node.type != "TEX_IMAGE":
        if node is not None:
            nodes.remove(node)

        node = nodes.new("ShaderNodeTexImage")

    node.name = BAKE_NODE_NAME
    node.label = "BABYLON BAKE TARGET"
    node.image = image

    return node


def remove_bake_nodes(mat):
    if not mat or not mat.use_nodes:
        return

    nodes = mat.node_tree.nodes

    for node in list(nodes):
        if node.name == BAKE_NODE_NAME:
            nodes.remove(node)


def prepare_bake_nodes(obj, image):
    prepared = []

    for slot in obj.material_slots:
        mat = slot.material

        if not mat:
            continue

        node = ensure_bake_node(mat, image)

        for n in mat.node_tree.nodes:
            try:
                n.select = False
            except Exception:
                pass

        try:
            node.select = True
            mat.node_tree.nodes.active = node
        except Exception:
            pass

        prepared.append(mat)

    return prepared


# ================================================================
# UV HELPERS
# ================================================================

def ensure_uv0(obj):
    mesh = obj.data

    if mesh.uv_layers:
        return True

    log(f"UV0 missing on {obj.name}; creating a safe first UV.")

    ensure_object_mode()

    try:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")

        bpy.ops.uv.smart_project(
            angle_limit=math.radians(66.0),
            island_margin=0.02,
        )

        bpy.ops.object.mode_set(mode="OBJECT")

        return bool(mesh.uv_layers)

    except Exception as e:
        print(f"  [UV0 ERROR] {obj.name}: {e}")

        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

        return bool(mesh.uv_layers)


def ensure_lightmap_uv(obj):
    mesh = obj.data

    if not ensure_uv0(obj):
        return False

    lm = mesh.uv_layers.get(LIGHTMAP_UV_NAME)

    if lm is not None and REUSE_EXISTING_LIGHTMAP_UV:
        return True

    if lm is None:
        lm = mesh.uv_layers.new(name=LIGHTMAP_UV_NAME)

    ensure_object_mode()

    try:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        idx = list(mesh.uv_layers).index(lm)
        mesh.uv_layers.active_index = idx

        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")

        bpy.ops.uv.smart_project(
            angle_limit=math.radians(66.0),
            island_margin=LIGHTMAP_UV_MARGIN,
        )

        bpy.ops.object.mode_set(mode="OBJECT")

        mesh.uv_layers.active_index = idx

        return True

    except Exception as e:
        print(f"  [LIGHTMAP UV ERROR] {obj.name}: {e}")

        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

        return False


def lightmap_uv_coverage(obj):
    """Share of the 0-1 UV square covered by the Lightmap UV's faces."""
    import numpy as np

    mesh = obj.data
    lm = mesh.uv_layers.get(LIGHTMAP_UV_NAME)
    n_polys = len(mesh.polygons)

    if lm is None or n_polys == 0:
        return 0.0

    n_loops = len(mesh.loops)
    uv = np.empty(n_loops * 2, dtype=np.float64)
    lm.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)

    starts = np.empty(n_polys, dtype=np.int64)
    totals = np.empty(n_polys, dtype=np.int64)
    mesh.polygons.foreach_get("loop_start", starts)
    mesh.polygons.foreach_get("loop_total", totals)

    # Shoelace per polygon: next loop wraps to the polygon's first loop.
    nxt = np.arange(1, n_loops + 1)
    nxt[starts + totals - 1] = starts
    cross = uv[:, 0] * uv[nxt, 1] - uv[nxt, 0] * uv[:, 1]
    order = np.argsort(starts)
    areas = np.abs(np.add.reduceat(cross, starts[order])) * 0.5

    return float(areas.sum())


def repair_lightmap_uv(obj, size, force=False):
    """
    v5: the prep script's Smart UV Project uses a fixed island margin (0.03
    of the whole UV square). On a mesh made of thousands of separate faces
    (SketchUp grass / terrain / exploded groups, FBX triangle soup) those
    margins eat the whole square: Lightmap UV coverage 0-3%, faces smaller
    than a texel, and the bake shows as a black-and-white triangle pattern
    or a solid black block. Re-unwrap with a margin of a few TEXELS of the
    planned bake size; if that's still poor, fall back to Lightmap Pack
    (one box per face - made for exactly this case).
    Returns (coverage_before, coverage_after, method) or None if untouched.
    """
    before = lightmap_uv_coverage(obj)

    if before >= LIGHTMAP_MIN_COVERAGE and not force:
        return None

    mesh = obj.data
    if mesh.uv_layers.get(LIGHTMAP_UV_NAME) is None:
        return None

    # Edit Mode rebuilds the mesh's layers, so a UV layer reference held
    # across an unwrap goes stale - always look it up again by name.
    def lm():
        return mesh.uv_layers[LIGHTMAP_UV_NAME]

    margin = min(LIGHTMAP_UV_MARGIN, 3.0 / max(size, 64))
    best = (-1.0 if force else before, "unchanged")

    def unwrap(op):
        ensure_object_mode()
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        mesh.uv_layers.active_index = list(mesh.uv_layers).index(lm())
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            op()
        finally:
            bpy.ops.object.mode_set(mode="OBJECT")

    attempts = (
        ("smart", lambda: bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=margin)),
        ("lightmap-pack", lambda: bpy.ops.uv.lightmap_pack(
            PREF_CONTEXT="ALL_FACES",
            PREF_PACK_IN_ONE=True,
            PREF_NEW_UVLAYER=False,
            PREF_BOX_DIV=12,
            PREF_MARGIN_DIV=max(0.05, min(1.0, 300.0 / max(size, 64))),
        )),
    )

    saved = None
    for method, op in attempts:
        try:
            import numpy as np
            if saved is None:
                saved = np.empty(len(mesh.loops) * 2, dtype=np.float32)
                lm().data.foreach_get("uv", saved)
            unwrap(op)
        except Exception as e:
            print(f"  [LIGHTMAP UV WARNING] {obj.name}: {method} failed: {e}")
            continue

        cov = lightmap_uv_coverage(obj)
        if cov > best[0] * 1.2:
            best = (cov, method)
            saved = None  # keep this unwrap
        else:
            lm().data.foreach_set("uv", saved)
        if best[0] >= LIGHTMAP_MIN_COVERAGE:
            break

    restore_uv0_active(obj)
    return before, best[0], best[1]


def set_active_uv_for_bake(obj):
    mesh = obj.data

    lm = mesh.uv_layers.get(LIGHTMAP_UV_NAME)

    if lm is None:
        return False

    try:
        mesh.uv_layers.active_index = list(mesh.uv_layers).index(lm)
        return True
    except Exception:
        return False


def restore_uv0_active(obj):
    mesh = obj.data

    if not mesh.uv_layers:
        return

    try:
        mesh.uv_layers.active_index = 0
    except Exception:
        pass


# ================================================================
# TEMPORARY LIGHT CONTROL
# ================================================================

def set_helper_lights_for_bake():
    states = []

    for obj in view_layer_objects():
        if obj.type != "LIGHT":
            continue

        if obj.name.startswith(IES_HELPER_PREFIX):
            states.append((obj, obj.hide_render, obj.hide_viewport))
            obj.hide_render = True
            obj.hide_viewport = True

    log(f"Disabled {len(states)} IES helper light(s) for bake.")

    return states


def restore_helper_lights(states):
    for obj, hide_render, hide_viewport in states:
        try:
            obj.hide_render = hide_render
            obj.hide_viewport = hide_viewport
        except Exception:
            pass


# ================================================================
# RENDER / BAKE SETTINGS
# ================================================================

def configure_cycles():
    scene = bpy.context.scene

    try:
        scene.render.engine = BAKE_ENGINE
    except Exception as e:
        raise RuntimeError(
            f"Could not set render engine to {BAKE_ENGINE}: {e}"
        )

    cycles = getattr(scene, "cycles", None)

    if cycles:
        try:
            cycles.samples = BAKE_SAMPLES
        except Exception:
            pass

        try:
            cycles.use_denoising = False
        except Exception:
            pass

        try:
            cycles.max_bounces = 4
            cycles.diffuse_bounces = 2
            cycles.glossy_bounces = 2
            cycles.transmission_bounces = 2
        except Exception:
            pass

        try:
            cycles.adaptive_threshold = 0.10
        except Exception:
            pass

        # v3 fix #2 forced the light tree OFF. See BAKE_USE_LIGHT_TREE above.
        try:
            cycles.use_light_tree = BAKE_USE_LIGHT_TREE
        except Exception:
            pass

        # FIX #3: compute_device_type must be explicitly set.
        try:
            prefs = bpy.context.preferences.addons.get("cycles")
            if prefs:
                cp = prefs.preferences
                cp.get_devices()
                available_types = {
                    d.type for d in getattr(cp, "devices", [])
                    if getattr(d, "type", "") != "CPU"
                }

                chosen_backend = None
                for backend in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
                    if backend in available_types:
                        chosen_backend = backend
                        break

                if chosen_backend:
                    cp.compute_device_type = chosen_backend

                cp.get_devices()
                devices = getattr(cp, "devices", [])
                gpu_devices = [
                    d for d in devices
                    if getattr(d, "type", "") != "CPU" and d.type == chosen_backend
                ]

                if gpu_devices and chosen_backend:
                    if not any(d.use for d in gpu_devices):
                        for d in gpu_devices:
                            d.use = True
                    cycles.device = 'GPU'
                    enabled = [d.name for d in gpu_devices if d.use]
                    print(f"[FAST BAKE] compute_device_type={cp.compute_device_type}, cycles.device=GPU. Enabled GPU device(s): {enabled or '(none enabled - will actually run on CPU)'}")
                else:
                    print(f"[FAST BAKE] No usable GPU backend found (compute_device_type={getattr(cp, 'compute_device_type', 'unknown')}); using CPU.")
        except Exception as e:
            print(f"[FAST BAKE] GPU auto-select skipped: {e}")

    render = scene.render

    try:
        render.bake.use_clear = True
    except Exception:
        pass

    try:
        render.bake.margin = BAKE_MARGIN_PX
    except Exception:
        pass

    # FIX #1: influence pass toggles.
    for pass_name in (
        "use_pass_direct",
        "use_pass_indirect",
        "use_pass_color",
        "use_pass_diffuse",
        "use_pass_glossy",
        "use_pass_transmission",
        "use_pass_emit",
    ):
        try:
            setattr(render.bake, pass_name, True)
        except Exception as e:
            print(f"  [BAKE INFLUENCE WARNING] Could not enable {pass_name}: {e}")

    vs = scene.view_settings
    log(
        f"Cycles configured: samples={BAKE_SAMPLES}, bake={BAKE_TYPE}, "
        f"images {BAKE_MIN_SIZE}-{BAKE_MAX_SIZE}px @ {BAKE_TEXELS_PER_M} texels/m. "
        f"View transform that will be baked in: {vs.view_transform} "
        f"(look={vs.look}, exposure={vs.exposure}, gamma={vs.gamma})"
    )


def force_png_output_settings():
    """
    Image.save_render() encodes with the SCENE's output settings, so they
    must be 8-bit RGB PNG for the final bake images. The user's own values
    are returned so main() can put them back.
    """
    image_settings = bpy.context.scene.render.image_settings

    saved = {
        "file_format": image_settings.file_format,
        "color_mode": image_settings.color_mode,
        "color_depth": image_settings.color_depth,
        "compression": image_settings.compression,
    }

    image_settings.file_format = "PNG"
    image_settings.color_mode = "RGB"
    image_settings.color_depth = "8"
    image_settings.compression = 15

    return saved


def restore_output_settings(saved):
    image_settings = bpy.context.scene.render.image_settings

    for key in ("file_format", "color_mode", "color_depth", "compression"):
        try:
            setattr(image_settings, key, saved[key])
        except Exception:
            pass


# ================================================================
# OBJECT ACTIVATION
# ================================================================

def activate_single_object(obj):
    ensure_object_mode()

    bpy.ops.object.select_all(action="DESELECT")

    try:
        obj.select_set(True)
    except Exception as e:
        raise RuntimeError(
            f"Cannot select {obj.name}: {e}"
        )

    bpy.context.view_layer.objects.active = obj


# ================================================================
# v5: ANY-SOURCE ROBUSTNESS (SketchUp / FBX / 3ds Max / Blender)
# ================================================================
#
# Everything here works on the SOURCE scene only for the duration of the
# bake and is put back afterwards, except two fixes that are always wanted
# and are logged: an empty material slot gets a plain grey material, and a
# texture whose file moved is relinked to the file found on disk.

def _luminance(rgb):
    return rgb[:, 0] * 0.2126 + rgb[:, 1] * 0.7152 + rgb[:, 2] * 0.0722


def _image_rgb(image):
    import numpy as np

    buf = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(buf)
    return buf.reshape(-1, 4)


def _is_light_like(*names):
    text = " ".join(n.lower() for n in names if n)
    return any(w in text for w in LIGHT_LIKE_WORDS)


def run_bake_op(obj, margin):
    try:
        bpy.ops.object.bake(
            type=BAKE_TYPE,
            use_clear=True,
            margin=margin,
        )

    except TypeError:
        try:
            bpy.ops.object.bake(type=BAKE_TYPE)
        except Exception as e:
            raise RuntimeError(
                f"Bake failed for {obj.name}: {e}"
            )

    except Exception as e:
        raise RuntimeError(
            f"Bake failed for {obj.name}: {e}"
        )


# ---------------- default material for empty slots ----------------

def ensure_default_materials(meshes):
    """
    Objects with no material (common in FBX / 3ds Max / OBJ exports) were
    silently skipped by v4 and vanished from the GLB. Cycles renders them
    plain grey, so give them exactly that.
    """
    mat = bpy.data.materials.get(DEFAULT_MATERIAL_NAME)

    if mat is None:
        mat = bpy.data.materials.new(DEFAULT_MATERIAL_NAME)
        bsdf = ensure_material_nodes(mat)
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.6

    fixed = 0

    for obj in meshes:
        if not obj.material_slots:
            obj.data.materials.append(mat)
            fixed += 1
            continue

        for slot in obj.material_slots:
            if slot.material is None:
                slot.material = mat
                fixed += 1

    if fixed:
        log(f"{fixed} empty material slot(s) given the default grey material '{DEFAULT_MATERIAL_NAME}'.")


# ---------------- missing textures ----------------

def _texture_search_dirs():
    dirs = []

    for raw in os.environ.get("BABYLON_BAKE_TEXTURE_DIRS", "").split(os.pathsep):
        if raw.strip():
            dirs.append(Path(raw.strip()))

    blend_dir = get_blend_dir()
    dirs.append(blend_dir)
    dirs.append(blend_dir.parent)

    for image in bpy.data.images:
        if image.source == "FILE" and image.filepath:
            try:
                dirs.append(Path(bpy.path.abspath(image.filepath)).parent)
            except Exception:
                pass

    seen = []
    for d in dirs:
        try:
            d = d.resolve()
        except Exception:
            continue
        if d.is_dir() and d not in seen:
            seen.append(d)
    return seen


def _build_file_index(dirs, max_files=60000):
    index = {}
    count = 0

    for root in dirs:
        for dirpath, _dirnames, filenames in os.walk(root):
            for f in filenames:
                index.setdefault(f.lower(), os.path.join(dirpath, f))
                count += 1
                if count >= max_files:
                    return index
    return index


def _image_is_missing(image):
    if image.source != "FILE" or image.packed_file is not None:
        return False

    if not image.filepath:
        return True

    try:
        return not os.path.isfile(bpy.path.abspath(image.filepath))
    except Exception:
        return True


def fix_missing_textures(meshes):
    """
    A texture whose file isn't on disk renders MAGENTA in Cycles and that
    pink is baked straight into the GLB. FBX / 3ds Max / SketchUp exports
    very often reference textures by an absolute path from the author's
    machine. Relink by file name (blend folder, its parent, the folders of
    the textures that ARE found, and BABYLON_BAKE_TEXTURE_DIRS); anything
    still missing is disconnected for the bake only, so the material's own
    colour is baked instead of pink. Returns an undo list.
    """
    used = set()
    for obj in meshes:
        for slot in obj.material_slots:
            mat = slot.material
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == "TEX_IMAGE" and node.image and node.name != BAKE_NODE_NAME:
                        used.add(node.image)

    missing = [im for im in used if _image_is_missing(im)]

    if not missing:
        return []

    index = _build_file_index(_texture_search_dirs())
    relinked, still_missing = [], []

    for image in missing:
        base = os.path.basename(bpy.path.abspath(image.filepath).replace("\\", "/")) if image.filepath else image.name
        found = index.get(base.lower())

        if found:
            image.filepath = found
            try:
                image.reload()
            except Exception:
                pass
            relinked.append(f"{image.name} -> {found}")
        else:
            still_missing.append(image)

    for line in relinked:
        log(f"  texture relinked: {line}")

    undo = []
    missing_set = set(still_missing)

    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for link in list(mat.node_tree.links):
            node = link.from_node
            if node.type == "TEX_IMAGE" and node.image in missing_set:
                undo.append((mat.node_tree, node.name, link.from_socket.identifier, link.to_node.name, link.to_socket.identifier))
                mat.node_tree.links.remove(link)

    for image in still_missing:
        print(
            f"  [TEXTURE WARNING] '{image.name}' not found ({image.filepath}). "
            f"Baked with the material's plain colour instead of pink. Put the "
            f"file next to the .blend (or set BABYLON_BAKE_TEXTURE_DIRS) and re-run."
        )

    log(f"Textures: {len(relinked)} relinked, {len(still_missing)} still missing.")
    return undo


def restore_missing_texture_links(undo):
    for tree, from_name, from_id, to_name, to_id in undo:
        try:
            src = tree.nodes[from_name]
            dst = tree.nodes[to_name]
            out = next(s for s in src.outputs if s.identifier == from_id)
            inp = next(s for s in dst.inputs if s.identifier == to_id)
            tree.links.new(out, inp)
        except Exception:
            pass


# ---------------- bake-time material adjustments ----------------

def apply_bake_material_fixes(meshes):
    """
    Two material setups that bake wrong in a COMBINED bake, fixed for the
    bake only (restored afterwards, the source look in Blender is unchanged):

    * METALS: a metal's colour lives entirely in its reflections. COMBINED
      bakes that view-independent reflection as near-BLACK (e.g. SketchUp
      "stainless-steel" base 0.04 + metallic 1 from the prep script), and
      the GLB is unlit, so steel / chrome / aluminium showed up black.
      Baked as a bright non-metal of the same hue instead.
    * FBX "self-glow": FBX / 3ds Max exports often carry the diffuse colour
      (or texture) as emission too; Blender imports it with strength > 0
      and the object bakes flat white. Emission identical to the base
      colour on a non-light object is switched off for the bake.
    """
    undo = []
    seen = set()
    metals = glows = 0

    for obj in meshes:
        for slot in obj.material_slots:
            mat = slot.material
            if not mat or mat.name in seen:
                continue
            seen.add(mat.name)

            bsdf = find_principled(mat)
            if bsdf is None:
                continue

            base = bsdf.inputs.get("Base Color")
            metallic = bsdf.inputs.get("Metallic")

            if (
                METAL_BAKE_FIX
                and metallic is not None
                and not metallic.is_linked
                and metallic.default_value >= 0.5
            ):
                undo.append((metallic, metallic.default_value))
                metallic.default_value = 0.0

                if base is not None and not base.is_linked:
                    col = tuple(base.default_value)
                    lum = col[0] * 0.2126 + col[1] * 0.7152 + col[2] * 0.0722
                    if lum < METAL_BAKE_LUMINANCE:
                        undo.append((base, col))
                        if lum < 0.01:
                            new = (METAL_BAKE_LUMINANCE,) * 3
                        else:
                            k = METAL_BAKE_LUMINANCE / lum
                            new = tuple(min(1.0, c * k) for c in col[:3])
                        base.default_value = (*new, col[3])
                metals += 1

            strength = bsdf.inputs.get("Emission Strength")
            emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")

            if (
                strength is not None
                and emission is not None
                and base is not None
                and not strength.is_linked
                and strength.default_value > 0.0
                and not _is_light_like(mat.name, obj.name)
            ):
                same = False
                if emission.is_linked and base.is_linked:
                    same = emission.links[0].from_node == base.links[0].from_node
                elif not emission.is_linked and not base.is_linked:
                    e = emission.default_value
                    b = base.default_value
                    same = max(e[:3]) > 0.0 and all(abs(e[i] - b[i]) < 1e-3 for i in range(3))

                if same:
                    undo.append((strength, strength.default_value))
                    strength.default_value = 0.0
                    glows += 1

    if metals or glows:
        log(f"Bake-time material fixes: {metals} metal material(s), {glows} FBX self-glow material(s).")
    return undo


def restore_bake_material_fixes(undo):
    for socket, value in reversed(undo):
        try:
            socket.default_value = value
        except Exception:
            pass


def material_is_dark(obj):
    """Every filled slot has a plain (untextured) near-black base colour."""
    mats = [s.material for s in obj.material_slots if s.material]
    if not mats:
        return False

    for mat in mats:
        bsdf = find_principled(mat)
        if bsdf is None:
            return False
        base = bsdf.inputs.get("Base Color")
        if base is None or base.is_linked:
            return False
        c = base.default_value
        if c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 >= DARK_ALBEDO_MAX:
            return False
    return True


# ---------------- flipped faces ----------------

def needs_flip_check(image):
    """
    A face whose normal points the wrong way (very common in SketchUp and
    FBX exports - the "blue back face" in SketchUp) bakes from INSIDE the
    wall: black. Cheap test on the finished bake: mostly black texels, or a
    big share of texels far darker than the scene's typical surface.
    """
    rgb = _image_rgb(image)[:, :3]
    lum = _luminance(rgb)
    lit = lum[lum > 1e-6]

    if lit.size < 0.30 * lum.size:
        return True

    ref = max(SCENE_REFERENCE["p50"], 1e-4)
    return float((lit < ref * FLIP_DARK_RATIO).mean()) > FLIP_DARK_TEXEL_FRACTION


def bake_flipped_and_merge(obj, image, margin):
    """
    Bake the object again with every face flipped, then keep, texel by
    texel, whichever side received more light. A correctly-oriented closed
    object keeps its original bake (its inside is dark); a flipped face, or
    a SketchUp group with a mix of flipped and correct faces, gets its lit
    side. The source mesh is flipped back immediately afterwards.
    Returns the share of texels taken from the flipped bake.
    """
    import numpy as np

    flip_image = bpy.data.images.new(
        name=image.name + "_FLIP",
        width=image.size[0],
        height=image.size[1],
        alpha=False,
        float_buffer=True,
    )
    set_image_colorspace(flip_image, BAKE_FLOAT_COLORSPACE)

    prepare_bake_nodes(obj, flip_image)
    obj.data.flip_normals()
    try:
        run_bake_op(obj, margin)
    finally:
        obj.data.flip_normals()
        prepare_bake_nodes(obj, image)

    a = _image_rgb(image)
    b = _image_rgb(flip_image)
    take = _luminance(b[:, :3]) > _luminance(a[:, :3])

    if take.any():
        a[take] = b[take]
        image.pixels.foreach_set(a.ravel())
        image.update()

    try:
        bpy.data.images.remove(flip_image)
    except Exception:
        pass

    return float(take.mean())


# ---------------- exposure ----------------

# Typical (median) and bright (p90) scene-linear surface brightness, measured
# by probe_scene_brightness(); used for the flipped-face test and exposure.
SCENE_REFERENCE = {"p50": 0.05, "p90": 1.0}


def probe_scene_brightness(candidates):
    """
    Quick low-res, low-sample bakes of the largest surfaces (each with the
    flipped-face merge), pooled into median / p90 luminance.
    """
    import numpy as np

    scene = bpy.context.scene
    probes = sorted(candidates, key=object_surface_area, reverse=True)[:AUTO_EXPOSURE_PROBES]

    if not probes:
        return

    old_samples = scene.cycles.samples
    scene.cycles.samples = 8
    pooled = []

    try:
        for obj in probes:
            if not set_active_uv_for_bake(obj):
                continue
            activate_single_object(obj)

            image = bpy.data.images.new(
                f"BAKEPROBE_{_RUN_TOKEN}", 64, 64, alpha=False, float_buffer=True
            )
            set_image_colorspace(image, BAKE_FLOAT_COLORSPACE)

            try:
                if not prepare_bake_nodes(obj, image):
                    continue
                run_bake_op(obj, 2)
                if FIX_FLIPPED_FACES:
                    bake_flipped_and_merge(obj, image, 2)
                lum = _luminance(_image_rgb(image)[:, :3])
                lit = lum[lum > 1e-6]
                if lit.size:
                    pooled.append(lit)
            finally:
                for slot in obj.material_slots:
                    remove_bake_nodes(slot.material)
                restore_uv0_active(obj)
                try:
                    bpy.data.images.remove(image)
                except Exception:
                    pass
    finally:
        scene.cycles.samples = old_samples

    if not pooled:
        return

    allv = np.concatenate(pooled)
    SCENE_REFERENCE["p50"] = float(np.percentile(allv, 50))
    SCENE_REFERENCE["p90"] = float(np.percentile(allv, 90))
    log(
        f"Scene brightness probe ({len(pooled)} largest surfaces): "
        f"median={SCENE_REFERENCE['p50']:.3f} p90={SCENE_REFERENCE['p90']:.3f} (scene-linear)"
    )


def apply_exposure():
    """
    v4 baked the scene with whatever exposure it had. Sun + Nishita sky (the
    01 prep script, and most imported SketchUp/FBX scenes) puts sunlit walls
    at scene-linear 4-15, which AgX maps to flat white: every texture on the
    building disappeared and the GLB looked blank. AUTO picks the exposure
    that puts the bright (p90) surfaces at AUTO_EXPOSURE_TARGET. It is written
    to the scene (and saved), so Blender's Rendered view matches the GLB; a
    manual exposure the user set themselves is always kept.
    """
    scene = bpy.context.scene
    vs = scene.view_settings
    mode = EXPOSURE_MODE
    previous_auto = scene.get("BABYLON_AUTO_EXPOSURE")

    if mode == "OFF":
        log(f"Exposure: OFF - keeping scene exposure {vs.exposure:+.2f}")
        return

    try:
        forced = float(mode)
    except ValueError:
        forced = None

    if forced is not None:
        vs.exposure = forced
        log(f"Exposure: forced to {forced:+.2f} (BABYLON_BAKE_EXPOSURE)")
        return

    user_set = abs(vs.exposure) > 1e-6 and (
        previous_auto is None or abs(vs.exposure - float(previous_auto)) > 1e-3
    )
    if user_set:
        log(f"Exposure: keeping the exposure you set ({vs.exposure:+.2f})")
        return

    p90 = SCENE_REFERENCE["p90"]
    if p90 <= 1e-5:
        log("Exposure: scene probe found no light - left unchanged")
        return

    target = (
        AUTO_EXPOSURE_TARGET_NO_ROLLOFF
        if vs.view_transform in ("Standard", "Raw", "Display Native")
        else AUTO_EXPOSURE_TARGET
    )
    stops = math.log2(target / p90)
    if abs(stops) < AUTO_EXPOSURE_DEADBAND:
        stops = 0.0
    stops = round(max(AUTO_EXPOSURE_RANGE[0], min(AUTO_EXPOSURE_RANGE[1], stops)), 2)

    vs.exposure = stops
    scene["BABYLON_AUTO_EXPOSURE"] = stops
    log(
        f"Exposure: AUTO {stops:+.2f} stops (bright surfaces p90 {p90:.2f} -> "
        f"{p90 * 2 ** stops:.2f}, view transform {vs.view_transform}). "
        f"Set BABYLON_BAKE_EXPOSURE=OFF or a number to override."
    )


# ================================================================
# BAKE ONE OBJECT
# ================================================================

# One dict per baked object (see final_report / summarize_bake_stats).
BAKE_STATS = []

# Folder for the view-transformed PNGs; set in main().
TEMP_PNG_DIR = None


# ================================================================
# DENOISING (fix #12)
# ================================================================

_DENOISE_SCENE = None
_DENOISE_FAILED = False


def _get_denoise_scene():
    """
    A private, empty scene whose compositor is
        Image -> Denoise (OIDN) -> Group Output
    Rendering it writes the denoised result through THIS scene's colour
    management, which is copied from the user's scene - so the PNG gets the
    same AgX/Filmic view transform save_render() would have applied. The
    user's own scene and compositor are never touched.
    """
    global _DENOISE_SCENE

    if _DENOISE_SCENE is not None:
        return _DENOISE_SCENE

    main = bpy.context.scene
    tmp = bpy.data.scenes.new("BABYLON_DENOISE_TMP")

    node_group = bpy.data.node_groups.new("BABYLON_DENOISE_TMP", "CompositorNodeTree")
    tmp.compositing_node_group = node_group
    node_group.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")

    image_node = node_group.nodes.new("CompositorNodeImage")
    image_node.name = "DN_IMAGE"

    denoise = node_group.nodes.new("CompositorNodeDenoise")
    denoise.name = "DN_DENOISE"
    if "HDR" in denoise.inputs:
        denoise.inputs["HDR"].default_value = True

    for socket_name, value in (("Prefilter", "Accurate"), ("Quality", "High")):
        try:
            denoise.inputs[socket_name].default_value = value
        except Exception:
            pass

    group_out = node_group.nodes.new("NodeGroupOutput")

    node_group.links.new(image_node.outputs["Image"], denoise.inputs["Image"])
    node_group.links.new(denoise.outputs["Image"], group_out.inputs["Image"])

    tmp.render.use_compositing = True
    tmp.render.use_sequencer = False
    tmp.render.resolution_percentage = 100
    tmp.render.dither_intensity = 0.0
    tmp.render.image_settings.file_format = "PNG"
    tmp.render.image_settings.color_mode = "RGB"
    tmp.render.image_settings.color_depth = "8"
    tmp.render.image_settings.compression = 15

    # Same colour management as the user's scene.
    tmp.display_settings.display_device = main.display_settings.display_device
    tmp.view_settings.view_transform = main.view_settings.view_transform
    tmp.view_settings.look = main.view_settings.look
    tmp.view_settings.exposure = main.view_settings.exposure
    tmp.view_settings.gamma = main.view_settings.gamma

    _DENOISE_SCENE = tmp
    return tmp


def render_denoised_png(float_image, png_path):
    """
    Denoise the scene-linear float bake with Blender's OIDN and write it as
    an 8-bit PNG with the view transform applied. Returns True on success;
    on any failure returns False so the caller falls back to save_render()
    (noisy but correct) - a denoiser hiccup must never lose a bake.
    """
    global _DENOISE_FAILED

    if _DENOISE_FAILED:
        return False

    try:
        tmp = _get_denoise_scene()
        node_group = tmp.compositing_node_group

        node_group.nodes["DN_IMAGE"].image = float_image

        tmp.render.resolution_x = float_image.size[0]
        tmp.render.resolution_y = float_image.size[1]
        tmp.render.filepath = str(png_path)

        if png_path.exists():
            png_path.unlink()

        bpy.ops.render.render(scene=tmp.name, write_still=True)

        if not png_path.exists():
            raise RuntimeError("denoised render wrote no file")

        return True

    except Exception as e:
        _DENOISE_FAILED = True
        print(
            f"  [DENOISE WARNING] Denoising failed ({e}); falling back to the "
            f"noisy, non-denoised bake for the rest of this run."
        )
        return False


def cleanup_denoise_scene():
    global _DENOISE_SCENE

    if _DENOISE_SCENE is None:
        return

    try:
        node_group = _DENOISE_SCENE.compositing_node_group
        bpy.data.scenes.remove(_DENOISE_SCENE)
        if node_group:
            bpy.data.node_groups.remove(node_group)
    except Exception:
        pass

    _DENOISE_SCENE = None


def finalize_bake_image(obj, float_image):
    """
    Scene-linear float bake -> 8-bit PNG WITH the scene's view transform
    (Image.save_render, fix #8) -> new sRGB image, packed immediately
    (fix #4). The temporary float image is removed straight away so 347
    float buffers never pile up in RAM.
    """
    if not BAKE_FLOAT:
        # Legacy path: the bake target already is the final 8-bit image.
        if PACK_BAKE_IMAGES:
            try:
                float_image.pack()
            except Exception as e:
                print(f"  [PACK WARNING] {float_image.name}: {e}")
        return float_image

    final_name = final_image_name(obj)
    png_path = TEMP_PNG_DIR / f"{final_name}.png"

    if not (DENOISE_BAKE and render_denoised_png(float_image, png_path)):
        float_image.save_render(str(png_path), scene=bpy.context.scene)

    old = bpy.data.images.get(final_name)
    if old:
        try:
            bpy.data.images.remove(old)
        except Exception:
            pass

    final = bpy.data.images.load(str(png_path), check_existing=False)
    final.name = final_name
    set_image_colorspace(final, BAKE_COLORSPACE)

    final["BABYLON_BAKED"] = True
    final["SOURCE_OBJECT"] = obj.name
    final["BAKE_TYPE"] = BAKE_TYPE
    final["BAKE_UV"] = LIGHTMAP_UV_NAME
    final["BAKE_SIZE"] = float_image.size[0]

    if PACK_BAKE_IMAGES:
        try:
            final.pack()
        except Exception as e:
            print(f"  [PACK WARNING] {final.name}: {e}")

    try:
        bpy.data.images.remove(float_image)
    except Exception:
        pass

    return final


def bake_one_object(obj, size):
    log(f"Preparing bake: {obj.name}")

    if not is_model_mesh(obj):
        return None

    if SKIP_HIDDEN_SOURCE_OBJECTS and obj.hide_render:
        log(f"Skipping hidden object: {obj.name}")
        return None

    if is_glass_only_object(obj):
        log(f"Glass-only object, not baked (exported see-through): {obj.name}")
        return None

    if not ensure_lightmap_uv(obj):
        print(f"  [SKIP] No usable Lightmap UV: {obj.name}")
        return None

    if not set_active_uv_for_bake(obj):
        print(f"  [SKIP] Could not activate Lightmap UV: {obj.name}")
        return None

    activate_single_object(obj)

    bake_image = get_or_create_bake_image(obj, size)

    mats = prepare_bake_nodes(obj, bake_image)

    if not mats:
        print(f"  [SKIP] No material slots: {obj.name}")
        restore_uv0_active(obj)
        try:
            bpy.data.images.remove(bake_image)
        except Exception:
            pass
        return None

    for mat in mats:
        node = mat.node_tree.nodes.get(BAKE_NODE_NAME)
        if node:
            for n in mat.node_tree.nodes:
                try:
                    n.select = False
                except Exception:
                    pass

            try:
                node.select = True
                mat.node_tree.nodes.active = node
            except Exception:
                pass

    margin = bake_margin_for(size)

    log(f"Baking {obj.name} -> {bake_image.name} ({size}px, margin {margin})")

    run_bake_op(obj, margin)

    try:
        bake_image.update()
    except Exception:
        pass

    flipped_share = None
    if FIX_FLIPPED_FACES and not material_is_dark(obj) and needs_flip_check(bake_image):
        flipped_share = bake_flipped_and_merge(obj, bake_image, margin)
        log(f"  flipped-face check {obj.name}: {flipped_share:.0%} of texels taken from the flipped side")

    # Diagnostics on the scene-linear data, before the view transform.
    mean, peak, covered = image_stats(bake_image)
    flags = material_flags(obj)
    if material_is_dark(obj):
        flags.append("dark-albedo")
    if flipped_share:
        flags.append("flip-merged")
    is_black = peak < BLACK_LINEAR_MAX

    BAKE_STATS.append({
        "name": obj.name,
        "size": size,
        "mean": mean,
        "max": peak,
        "covered": covered,
        "flags": flags,
        "black": is_black,
        "flipped_share": flipped_share,
    })

    if is_black and "dark-albedo" in flags:
        log(f"  {obj.name}: black bake from a black material (expected)")
    elif is_black:
        print(
            f"  [BAKE WARNING] {obj.name}: baked image looks BLACK "
            f"(scene-linear max {peak:.5f} < {BLACK_LINEAR_MAX}; "
            f"material flags: {flags or 'none'}). Check: (1) "
            f"scene.render.bake use_pass_* influence toggles, (2) that "
            f"Sun/Sky + AutoLight_/IES_Emitter_ objects are enabled for "
            f"RENDER (hide_render=False), (3) this object isn't fully in "
            f"shadow with no other light reaching it."
        )
    else:
        log(
            f"  stats {obj.name}: linear mean={mean:.4f} max={peak:.3f} "
            f"covered={covered:.0%} flags={flags or 'none'}"
        )

    final = finalize_bake_image(obj, bake_image)

    restore_uv0_active(obj)

    log(f"Finished bake: {obj.name}")

    return final


# ================================================================
# EXPORT COPY MATERIAL
# ================================================================

def make_static_export_material(source_mat, baked_image):
    """
    Fresh material for the export copy (the source material is never
    touched):

        UV Map ("Lightmap") -> Image Texture -> Color -> Material Output
                                                          Surface

    A COLOR socket wired straight into Surface is what Blender's glTF
    exporter recognises as "shadeless" and writes as KHR_materials_unlit
    with the image as baseColorTexture and the Lightmap UV as its texCoord
    (fix #6 and #7 in the header).
    """
    name = (
        f"{source_mat.name}__BABYLON_BAKED"
        if source_mat
        else "BABYLON_BAKED_MATERIAL"
    )

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True

    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links

    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    out.is_active_output = True
    out.location = (300, 0)

    uv_node = nodes.new("ShaderNodeUVMap")
    uv_node.name = "BABYLON_STATIC_BAKE_UV"
    uv_node.label = f"UV: {LIGHTMAP_UV_NAME}"
    uv_node.uv_map = LIGHTMAP_UV_NAME
    uv_node.location = (-700, 0)

    image_node = nodes.new("ShaderNodeTexImage")
    image_node.name = "BABYLON_STATIC_BAKE_IMAGE"
    image_node.label = "FINAL BAKED BLENDER LOOK"
    image_node.image = baked_image
    image_node.interpolation = "Linear"
    # EXTEND -> glTF CLAMP_TO_EDGE, so mip filtering can't pull in texels
    # from the opposite side of the lightmap.
    image_node.extension = "EXTEND"
    image_node.location = (-400, 0)

    set_image_colorspace(baked_image, BAKE_COLORSPACE)

    links.new(uv_node.outputs["UV"], image_node.inputs["Vector"])
    links.new(image_node.outputs["Color"], out.inputs["Surface"])

    # Double-sided by default (DOUBLE_SIDED_EXPORT); otherwise keep the
    # source's single/double-sided intent (glTF doubleSided).
    if DOUBLE_SIDED_EXPORT:
        mat.use_backface_culling = False
    elif source_mat is not None:
        try:
            mat.use_backface_culling = source_mat.use_backface_culling
        except Exception:
            pass

    mat["BABYLON_BAKED"] = True
    mat["BAKED_IMAGE"] = baked_image.name
    mat["BAKED_UV"] = LIGHTMAP_UV_NAME
    mat["STATIC_LIGHTING"] = True

    return mat


def make_glass_export_material(source_mat):
    """
    See-through replacement for a glass slot: a plain alpha-blended
    Principled material (exported as glTF alphaMode BLEND), no baked image.
    """
    mat = bpy.data.materials.new(f"{source_mat.name}__BABYLON_GLASS")
    mat.use_nodes = True

    bsdf = find_principled(mat)

    tint = GLASS_DEFAULT_TINT
    alpha = GLASS_EXPORT_ALPHA

    src = find_principled(source_mat)

    if src is not None:
        base = src.inputs.get("Base Color")
        if base is not None and not base.is_linked:
            tint = tuple(base.default_value)

        src_alpha = src.inputs.get("Alpha")
        if src_alpha is not None and not src_alpha.is_linked and src_alpha.default_value < 0.99:
            alpha = max(0.05, float(src_alpha.default_value))

    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = tint
        bsdf.inputs["Alpha"].default_value = alpha
        bsdf.inputs["Roughness"].default_value = 0.05
        bsdf.inputs["Metallic"].default_value = 0.0

        for key in ("Transmission Weight", "Transmission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = 0.0

    # Blender 4.2+: surface_render_method; older: blend_method.
    try:
        mat.surface_render_method = "BLENDED"
    except Exception:
        try:
            mat.blend_method = "BLEND"
        except Exception:
            pass

    mat.use_backface_culling = False

    mat["BABYLON_GLASS"] = True

    return mat


# ================================================================
# EXPORT COPY OBJECT
# ================================================================

def make_export_copy(source_obj, baked_image, export_collection):
    """
    baked_image is None for glass-only objects (nothing was baked).
    Glass slots (see is_glass_material) always get the see-through material;
    every other slot gets the unlit baked-image material.
    """
    export_obj = source_obj.copy()

    if source_obj.data:
        export_obj.data = source_obj.data.copy()

    export_obj.name = f"{source_obj.name}__BABYLON_FINAL"

    export_collection.objects.link(export_obj)

    new_materials = []

    for slot in source_obj.material_slots:
        source_mat = slot.material

        if source_mat is None:
            new_materials.append(None)
            continue

        if baked_image is None or is_glass_material(source_mat):
            new_materials.append(make_glass_export_material(source_mat))
            continue

        baked_mat = make_static_export_material(
            source_mat,
            baked_image,
        )

        new_materials.append(baked_mat)

    # Assign slot by slot. (v3 used materials.clear() + append(): clearing
    # the slots resets EVERY face's material_index to 0, so all faces ended
    # up on the first slot's material - harmless while every slot shared the
    # one baked image, but it would move glass faces onto an opaque slot.)
    for index, mat in enumerate(new_materials):
        try:
            export_obj.material_slots[index].material = mat
        except Exception as e:
            print(f"  [SLOT WARNING] {export_obj.name} slot {index}: {e}")

    # Fix #6: the export copy keeps ONLY the Lightmap UV, so the GLB has a
    # single UV set (TEXCOORD_0 = Lightmap) and no viewer can sample the
    # baked image with the original tiled UV0. This is the COPY's mesh data
    # (source_obj.data.copy() above) - the source object keeps every UV.
    mesh = export_obj.data
    for layer in list(mesh.uv_layers):
        if layer.name != LIGHTMAP_UV_NAME:
            try:
                mesh.uv_layers.remove(layer)
            except Exception as e:
                print(f"  [UV CLEANUP WARNING] {export_obj.name}/{layer.name}: {e}")

    lm = mesh.uv_layers.get(LIGHTMAP_UV_NAME)
    if lm:
        try:
            mesh.uv_layers.active = lm
        except Exception:
            pass

    export_obj["BABYLON_FINAL_BAKED"] = True
    export_obj["SOURCE_OBJECT"] = source_obj.name
    if baked_image is not None:
        export_obj["BAKED_IMAGE"] = baked_image.name
    export_obj["BAKED_UV"] = LIGHTMAP_UV_NAME

    return export_obj


# ================================================================
# v5: REALIZE EVERYTHING THAT RENDERS (native Blender scenes)
# ================================================================

PROXY_COLLECTION_NAME = "BABYLON_BAKE_PROXIES"
PROXY_RENDERABLE_TYPES = {"MESH", "CURVE", "SURFACE", "FONT", "META", "CURVES"}

# Filled by build_bake_proxies(), undone by remove_bake_proxies().
PROXY_STATE = {"objects": [], "meshes": [], "materials": [], "hidden": [], "originals": set()}


def _needs_proxy(obj):
    """A plain local mesh is baked directly; anything else gets a proxy."""
    if obj.type != "MESH":
        return True
    if obj.library or (obj.data and obj.data.library):
        return True
    if any(s.material and s.material.library for s in obj.material_slots):
        return True
    for mod in obj.modifiers:
        if mod.show_render and mod.type == "NODES":
            return True
    return False


def _local_material(mat, cache):
    if mat is None or not mat.library:
        return mat
    if mat.name_full not in cache:
        local = mat.copy()
        local.name = f"{mat.name}__LOCAL"
        cache[mat.name_full] = local
        PROXY_STATE["materials"].append(local)
    return cache[mat.name_full]


def build_bake_proxies():
    """
    v5: real Blender scenes (e.g. the Blender "classroom" demo) build most of
    the furniture from COLLECTION INSTANCES of linked asset .blend files,
    plus curves (cables, pipes, text) and Geometry Nodes. v4 baked only plain
    local mesh objects, so every desk, chair and lamp was missing from the
    GLB - only their shadows were baked onto the floor.

    Every renderable thing in the evaluated scene that is NOT a plain local
    mesh (instances, linked objects/meshes/materials, curves, text, metaballs,
    Geometry Nodes results) becomes a temporary real mesh object in the
    BABYLON_BAKE_PROXIES collection, with exactly the geometry Cycles
    renders. The originals (and instancers) are hidden from render for the
    bake so nothing is doubled. Lights that come from instances (lamp
    assets) are copied too, so the lighting is unchanged. Everything is put
    back by remove_bake_proxies().
    """
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()

    old = bpy.data.collections.get(PROXY_COLLECTION_NAME)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)

    coll = bpy.data.collections.new(PROXY_COLLECTION_NAME)
    scene.collection.children.link(coll)

    mat_cache = {}
    to_hide = set()
    counts = {"instances": 0, "objects": 0, "lights": 0}

    for inst in depsgraph.object_instances:
        ob_eval = inst.object
        orig = ob_eval.original

        if inst.is_instance:
            instancer = inst.parent.original if inst.parent else None
            if instancer is None or instancer.hide_render or orig.hide_render:
                continue
            if instancer.get("BABYLON_FINAL_BAKED") or instancer.name.startswith(PROXY_COLLECTION_NAME):
                continue
        else:
            instancer = None
            if orig.hide_render or orig.users_collection and coll in orig.users_collection:
                continue
            if orig.type not in PROXY_RENDERABLE_TYPES or not _needs_proxy(orig):
                continue
            if orig.get("BABYLON_FINAL_BAKED") or orig.name.endswith("__BABYLON_FINAL"):
                continue
            if is_ies_emitter(orig) or orig.name.startswith(IES_EMITTER_PREFIX):
                continue

        base_name = f"{instancer.name}_{orig.name}" if instancer else orig.name

        if ob_eval.type == "LIGHT":
            if not instancer:
                continue
            light = bpy.data.objects.new(f"{base_name}__BAKEPROXY", orig.data)
            light.matrix_world = inst.matrix_world.copy()
            coll.objects.link(light)
            PROXY_STATE["objects"].append(light)
            to_hide.add(instancer)
            counts["lights"] += 1
            continue

        if ob_eval.type not in PROXY_RENDERABLE_TYPES:
            continue

        try:
            mesh = bpy.data.meshes.new_from_object(
                ob_eval, preserve_all_data_layers=True, depsgraph=depsgraph
            )
        except Exception as e:
            print(f"  [PROXY WARNING] {base_name}: {e}")
            continue

        if mesh is None or len(mesh.polygons) == 0:
            if mesh is not None:
                bpy.data.meshes.remove(mesh)
            continue

        mesh.name = f"{base_name}__BAKEPROXY"

        # Object-linked material slots are not carried by new_from_object;
        # take every slot from the evaluated object. Linked (library)
        # materials get a local copy so the bake node can be added.
        # (Assigned slot by slot - materials.clear() would reset every
        # face's material index to 0.)
        slots = [s.material for s in ob_eval.material_slots]
        for i, m in enumerate(slots):
            local = _local_material(m.original if m else None, mat_cache)
            if i < len(mesh.materials):
                mesh.materials[i] = local
            else:
                mesh.materials.append(local)

        proxy = bpy.data.objects.new(mesh.name, mesh)
        proxy.matrix_world = inst.matrix_world.copy()
        proxy["BABYLON_BAKE_PROXY_OF"] = orig.name
        coll.objects.link(proxy)

        PROXY_STATE["objects"].append(proxy)
        PROXY_STATE["meshes"].append(mesh)
        to_hide.add(instancer if instancer else orig)
        counts["instances" if instancer else "objects"] += 1

    for obj in to_hide:
        PROXY_STATE["hidden"].append((obj, obj.hide_render))
        PROXY_STATE["originals"].add(obj.name)
        obj.hide_render = True

    bpy.context.view_layer.update()

    if PROXY_STATE["objects"]:
        log(
            f"Realized for the bake: {counts['instances']} instanced part(s), "
            f"{counts['objects']} curve / linked / Geometry-Nodes object(s), "
            f"{counts['lights']} instanced light(s) (temporary, removed after export)."
        )
    else:
        bpy.data.collections.remove(coll)


def is_proxied_original(obj):
    return obj.name in PROXY_STATE["originals"]


def remove_bake_proxies():
    for obj, hidden in PROXY_STATE["hidden"]:
        try:
            obj.hide_render = hidden
        except Exception:
            pass

    for obj in PROXY_STATE["objects"]:
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception:
            pass

    for mesh in PROXY_STATE["meshes"]:
        try:
            if mesh.users == 0:
                bpy.data.meshes.remove(mesh)
        except Exception:
            pass

    for mat in PROXY_STATE["materials"]:
        try:
            if mat.users == 0:
                bpy.data.materials.remove(mat)
        except Exception:
            pass

    coll = bpy.data.collections.get(PROXY_COLLECTION_NAME)
    if coll:
        try:
            bpy.data.collections.remove(coll)
        except Exception:
            pass

    for key in ("objects", "meshes", "materials", "hidden"):
        PROXY_STATE[key] = []
    PROXY_STATE["originals"] = set()


# ================================================================
# EXPORT COLLECTION
# ================================================================

def remove_stale_export_copies():
    """
    Deletes the export copies (and their collection) left in the .blend by a
    PREVIOUS run, BEFORE anything is baked.

    Fix #11: v3 only cleared them after baking. Until then every leftover
    "<name>__BABYLON_FINAL" copy sat in the scene at exactly the same place as
    its source object, carrying an emissive material with the OLD bake. To
    Cycles they are real geometry: coplanar duplicates that block the sun and
    the sky for the surface being baked and light it with the previous bake's
    pixels. A .blend that had been baked before therefore baked dark, bluish
    and noisy (a sunlit road came out lit only by its own old, dark bake),
    while a camera render with those copies hidden looked correct.
    """
    stale = [
        o for o in bpy.data.objects
        if o.get("BABYLON_FINAL_BAKED") or o.name.endswith("__BABYLON_FINAL")
    ]

    for obj in stale:
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception as e:
            print(f"  [STALE COPY WARNING] {obj.name}: {e}")

    old = bpy.data.collections.get(EXPORT_COLLECTION_NAME)

    if old:
        try:
            bpy.data.collections.remove(old)
        except Exception:
            pass

    try:
        bpy.context.view_layer.update()
    except Exception:
        pass

    if stale:
        log(f"Removed {len(stale)} stale export copy object(s) from a previous run before baking.")


def prepare_export_collection():
    old = bpy.data.collections.get(EXPORT_COLLECTION_NAME)

    if old and DELETE_OLD_EXPORT_COLLECTION:
        delete_collection_objects(old)

        try:
            bpy.data.collections.remove(old)
        except Exception:
            pass

    return get_or_create_collection(EXPORT_COLLECTION_NAME)


# ================================================================
# GLB EXPORT
# ================================================================

def select_export_objects(export_objects):
    ensure_object_mode()

    bpy.ops.object.select_all(action="DESELECT")

    for obj in export_objects:
        try:
            obj.select_set(True)
        except Exception:
            pass

    if export_objects:
        try:
            bpy.context.view_layer.objects.active = export_objects[0]
        except Exception:
            pass


def export_glb(export_objects, output_path):
    if not EXPORT_GLTF:
        log("GLB export disabled.")
        return False

    if not export_objects:
        raise RuntimeError(
            "No export objects were created."
        )

    select_export_objects(export_objects)

    output_path = str(output_path)

    log(f"Exporting GLB: {output_path}")

    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format=EXPORT_GLTF_FORMAT,
            use_selection=True,
            export_apply=True,
        )

        return True

    except TypeError:
        pass

    except Exception as e:
        print(f"  [GLTF EXPORT WARNING] First method: {e}")

    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format=EXPORT_GLTF_FORMAT,
            use_selection=True,
        )

        return True

    except Exception as e:
        raise RuntimeError(
            f"GLB export failed: {e}"
        )


# ================================================================
# SOURCE SCENE SAFETY CHECK
# ================================================================

def collect_source_meshes():
    meshes = [
        obj for obj in view_layer_objects()
        if is_model_mesh(obj) and not is_proxied_original(obj)
    ]

    meshes.sort(key=lambda o: o.name.lower())

    return meshes


def verify_lightmap_uvs(meshes):
    missing = []

    for obj in meshes:
        if obj.data.uv_layers.get(LIGHTMAP_UV_NAME) is None:
            missing.append(obj.name)

    if missing:
        print(
            f"[UV CHECK] {len(missing)} object(s) still missing "
            f"Lightmap UV."
        )

    return missing


# ================================================================
# GLB SELF-CHECK (A5)
# ================================================================

def verify_glb(glb_path):
    """
    Reads the GLB Blender just wrote and checks the things that made the v3
    export look black on the website. Returns (ok, summary dict).
    """
    problems = []
    summary = {
        "materials": 0,
        "baked_materials": 0,
        "not_unlit": 0,
        "no_base_color_texture": 0,
        "missing_uv_attribute": 0,
        "uv_out_of_range": 0,
        "extra_uv_sets": 0,
        "glass_materials": 0,
    }

    try:
        data = Path(glb_path).read_bytes()
        if data[:4] != b"glTF":
            raise ValueError("not a GLB file")

        chunk_len, chunk_type = struct.unpack_from("<II", data, 12)
        gltf = json.loads(data[20:20 + chunk_len].decode("utf-8"))
    except Exception as e:
        return False, {"error": f"could not read exported GLB: {e}"}

    materials = gltf.get("materials", [])
    accessors = gltf.get("accessors", [])
    summary["materials"] = len(materials)

    prims_by_material = {}
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            prims_by_material.setdefault(prim.get("material"), []).append(prim)
            if "TEXCOORD_1" in prim.get("attributes", {}):
                summary["extra_uv_sets"] += 1

    for index, mat in enumerate(materials):
        if "__BABYLON_GLASS" in mat.get("name", ""):
            summary["glass_materials"] += 1
            continue

        if "__BABYLON_BAKED" not in mat.get("name", ""):
            continue

        summary["baked_materials"] += 1

        if "KHR_materials_unlit" not in (mat.get("extensions") or {}):
            summary["not_unlit"] += 1

        texture_info = (mat.get("pbrMetallicRoughness") or {}).get("baseColorTexture")

        if not texture_info:
            summary["no_base_color_texture"] += 1
            continue

        tex_coord = texture_info.get("texCoord", 0)

        for prim in prims_by_material.get(index, []):
            accessor_index = prim.get("attributes", {}).get(f"TEXCOORD_{tex_coord}")

            if accessor_index is None:
                summary["missing_uv_attribute"] += 1
                continue

            accessor = accessors[accessor_index]
            lo, hi = accessor.get("min"), accessor.get("max")

            if lo and hi and (min(lo) < -0.01 or max(hi) > 1.01):
                summary["uv_out_of_range"] += 1

    if summary["baked_materials"] == 0:
        problems.append("no baked materials found in the GLB")
    if summary["not_unlit"]:
        problems.append(f"{summary['not_unlit']} baked material(s) are NOT KHR_materials_unlit")
    if summary["no_base_color_texture"]:
        problems.append(f"{summary['no_base_color_texture']} baked material(s) have no baseColorTexture")
    if summary["missing_uv_attribute"]:
        problems.append(f"{summary['missing_uv_attribute']} primitive(s) lack the UV set their baked texture uses")
    if summary["uv_out_of_range"]:
        problems.append(f"{summary['uv_out_of_range']} primitive(s) sample their baked texture with UVs outside 0..1 (wrong UV set?)")

    summary["problems"] = problems

    return not problems, summary


# ================================================================
# REPORT
# ================================================================

def summarize_bake_stats():
    black = [s for s in BAKE_STATS if s["black"] and "dark-albedo" not in s["flags"]]
    total = len(BAKE_STATS)

    by_flags = {}
    for s in black:
        key = ",".join(s["flags"]) or "opaque-no-flags"
        by_flags[key] = by_flags.get(key, 0) + 1

    return total, black, by_flags


def write_bake_report_json(glb_path, glb_summary):
    import json as _json

    total, black, by_flags = summarize_bake_stats()

    report_path = Path(str(glb_path) + ".bake_report.json")

    try:
        report_path.write_text(
            _json.dumps(
                {
                    "glb": str(glb_path),
                    "quality": BAKE_QUALITY_MODE,
                    "samples": BAKE_SAMPLES,
                    "objects": BAKE_STATS,
                    "black_count": len(black),
                    "black_by_material_flags": by_flags,
                    "glb_self_check": glb_summary,
                },
                indent=1,
            ),
            encoding="utf-8",
        )
        return report_path
    except Exception as e:
        print(f"[REPORT WARNING] could not write {report_path}: {e}")
        return None


def final_report(meshes, baked_images, export_objects, glb_path, glb_ok, glb_summary):
    total, black, by_flags = summarize_bake_stats()
    vs = bpy.context.scene.view_settings

    print("\n")
    print("=" * 78)
    print("BABYLON FINAL BAKE REPORT (v5)")
    print("=" * 78)

    print(f"Source mesh objects      : {len(meshes)}")
    print(f"Successfully baked      : {len(baked_images)}")
    print(f"Export mesh objects     : {len(export_objects)}")
    print(f"Bake type               : {BAKE_TYPE} ({BAKE_QUALITY_MODE})")
    print(f"Bake samples            : {BAKE_SAMPLES}")
    if baked_images:
        sizes = [im.size[0] for im in baked_images]
        print(
            f"Bake image size         : {min(sizes)} - {max(sizes)} px "
            f"(~{estimated_vram_mb(sizes):.0f} MB GPU texture memory)"
        )
    print(f"Bake UV                 : {LIGHTMAP_UV_NAME} (only UV set in the GLB)")
    print("Export material         : Image Color -> Surface (KHR_materials_unlit)")
    print(f"View transform baked in : {vs.view_transform} (look={vs.look}, exposure={vs.exposure:+.2f})")
    flip_fixed = sum(1 for st in BAKE_STATS if st.get("flipped_share"))
    dark_ok = sum(1 for st in BAKE_STATS if st["black"] and "dark-albedo" in st["flags"])
    print(f"Flipped-face fixes      : {flip_fixed} object(s)")
    print(f"Black materials (ok)    : {dark_ok} object(s) with a black base colour")
    print(f"GLB                     : {glb_path}")

    print(f"\nBlack images (scene-linear max < {BLACK_LINEAR_MAX}): {len(black)} / {total}")
    for key, count in sorted(by_flags.items(), key=lambda kv: -kv[1]):
        print(f"  {count:4d} x material flags: {key}")
    for s in black[:15]:
        print(f"    - {s['name']} ({s['size']}px)")
    if len(black) > 15:
        print(f"    ... {len(black) - 15} more (see the .bake_report.json next to the GLB)")

    print("\nGLB self-check:")
    if "error" in glb_summary:
        print(f"  ERROR: {glb_summary['error']}")
    else:
        print(
            f"  materials={glb_summary['materials']} baked={glb_summary['baked_materials']} "
            f"not_unlit={glb_summary['not_unlit']} no_texture={glb_summary['no_base_color_texture']} "
            f"missing_uv={glb_summary['missing_uv_attribute']} uv_out_of_range={glb_summary['uv_out_of_range']} "
            f"extra_uv_sets={glb_summary['extra_uv_sets']} "
            f"glass_materials={glb_summary['glass_materials']}"
        )
        for problem in glb_summary.get("problems", []):
            print(f"  PROBLEM: {problem}")
    print(f"  RESULT: {'PASS' if glb_ok else 'FAIL'}")

    print("=" * 78)
    print()


# ================================================================
# MAIN
# ================================================================

def _alive(obj):
    try:
        obj.name
        return True
    except ReferenceError:
        return False


def select_objects_for_run(meshes):
    """Optional test/draft filters (environment variables, all optional)."""
    only = [t for t in os.environ.get("BABYLON_BAKE_ONLY", "").split(",") if t.strip()]
    limit = int(os.environ.get("BABYLON_BAKE_LIMIT", "0") or 0)

    if only:
        meshes = [m for m in meshes if any(t.strip() in m.name for t in only)]
        log(f"BABYLON_BAKE_ONLY filter -> {len(meshes)} object(s).")

    if limit > 0:
        meshes = meshes[:limit]
        log(f"BABYLON_BAKE_LIMIT={limit} -> baking {len(meshes)} object(s).")

    return meshes


def cleanup_temp_pngs():
    if TEMP_PNG_DIR is None or not TEMP_PNG_DIR.exists():
        return

    for png in TEMP_PNG_DIR.glob("*.png"):
        try:
            png.unlink()
        except Exception:
            pass

    try:
        TEMP_PNG_DIR.rmdir()
    except Exception:
        pass


def main():
    global TEMP_PNG_DIR

    ensure_object_mode()

    if not bpy.data.filepath:
        raise RuntimeError(
            "SAVE the .blend first (Ctrl+S), then run this script."
        )

    log("FINAL BAKE START (v5)")

    remove_stale_export_copies()

    configure_cycles()

    build_bake_proxies()

    all_source_meshes = collect_source_meshes()

    if not all_source_meshes:
        raise RuntimeError(
            "No source mesh objects were found."
        )

    source_meshes = select_objects_for_run(all_source_meshes)

    if not source_meshes:
        raise RuntimeError(
            "The BABYLON_BAKE_ONLY / BABYLON_BAKE_LIMIT filter matched no objects."
        )

    log(
        f"Found {len(source_meshes)} source mesh object(s)."
    )

    for index, obj in enumerate(source_meshes, start=1):
        log(
            f"UV preparation {index}/{len(source_meshes)}: "
            f"{obj.name}"
        )
        ensure_lightmap_uv(obj)

    missing = verify_lightmap_uvs(source_meshes)

    if missing:
        raise RuntimeError(
            "Some objects have no Lightmap UV. "
            "Check the console list above."
        )

    ensure_default_materials(source_meshes)

    source_meshes = drop_duplicate_objects(source_meshes)
    source_meshes = split_oversized_objects(source_meshes)

    glass_only_objects = [o for o in source_meshes if is_glass_only_object(o)]
    size_plan = plan_bake_sizes(
        [o for o in source_meshes if o not in glass_only_objects]
    )
    if glass_only_objects:
        log(f"{len(glass_only_objects)} glass-only object(s) will be exported see-through, not baked.")

    uv_fixed = 0
    for obj in source_meshes:
        if obj in glass_only_objects:
            continue
        res = repair_lightmap_uv(obj, size_plan[obj.name], force=obj.name in SPLIT_THIS_RUN)
        if res:
            uv_fixed += 1
            log(f"  Lightmap UV {obj.name}: coverage {max(res[0], 0):.0%} -> {res[1]:.0%} ({res[2]})")
    if uv_fixed:
        log(f"{uv_fixed} Lightmap UV(s) re-unwrapped (low coverage).")

    output_dir = get_output_dir()
    TEMP_PNG_DIR = output_dir / TEMP_PNG_FOLDER_NAME
    TEMP_PNG_DIR.mkdir(parents=True, exist_ok=True)

    saved_output_settings = force_png_output_settings()
    helper_states = set_helper_lights_for_bake()
    texture_undo = fix_missing_textures(source_meshes)
    material_undo = apply_bake_material_fixes(source_meshes)
    normals_undo = strip_mirrored_custom_normals(source_meshes)

    baked_images = []
    baked_pairs = []

    try:
        probe_scene_brightness([o for o in source_meshes if o not in glass_only_objects])
        apply_exposure()

        for index, obj in enumerate(
            source_meshes,
            start=1,
        ):
            log(
                f"BAKE {index}/{len(source_meshes)}: "
                f"{obj.name}"
            )

            if obj in glass_only_objects:
                continue

            image = bake_one_object(obj, size_plan[obj.name])

            if image is not None:
                baked_images.append(image)
                baked_pairs.append((obj, image))

        if not baked_pairs:
            raise RuntimeError(
                "No objects were successfully baked."
            )

    finally:
        restore_custom_normals(normals_undo)
        restore_duplicates()
        restore_bake_material_fixes(material_undo)
        restore_missing_texture_links(texture_undo)
        restore_helper_lights(helper_states)
        restore_output_settings(saved_output_settings)
        cleanup_denoise_scene()

    export_collection = prepare_export_collection()

    export_objects = []

    for source_obj, baked_image in baked_pairs:
        export_obj = make_export_copy(
            source_obj,
            baked_image,
            export_collection,
        )

        export_objects.append(export_obj)

    for glass_obj in glass_only_objects:
        export_objects.append(
            make_export_copy(glass_obj, None, export_collection)
        )

    blend_stem = safe_filename(
        Path(bpy.data.filepath).stem
    )

    tag = safe_filename(os.environ.get("BABYLON_BAKE_TAG", ""))

    glb_path = (
        output_dir
        / f"{blend_stem}{('_' + tag) if tag else ''}_BABYLON_FINAL.glb"
    )

    glb_ok, glb_summary = True, {}

    if EXPORT_GLTF:
        export_glb(
            export_objects,
            glb_path,
        )

        if not glb_path.exists():
            raise RuntimeError(
                f"Blender reported export success, but file was not found:\n"
                f"{glb_path}"
            )

        log(
            f"GLB created successfully: "
            f"{glb_path} "
            f"({glb_path.stat().st_size / (1024*1024):.2f} MB)"
        )

        glb_ok, glb_summary = verify_glb(glb_path)
        write_bake_report_json(glb_path, glb_summary)

    # The export copies duplicate the source geometry exactly. Hide them once
    # the GLB is written so they don't double up in the user's viewport or a
    # later render (the next run of this script deletes them anyway - fix #11).
    for export_obj in export_objects:
        try:
            export_obj.hide_render = True
            export_obj.hide_viewport = True
        except Exception:
            pass

    cleanup_temp_pngs()

    # Temporary realized meshes out, originals/instancers back to render
    # BEFORE saving, so the saved .blend is the user's scene as it was.
    remove_bake_proxies()
    source_meshes = [o for o in source_meshes if _alive(o)]

    if SAVE_BLEND_AFTER_BAKE:
        try:
            bpy.ops.wm.save_as_mainfile(
                filepath=bpy.data.filepath
            )
            log("Source .blend saved.")
        except Exception as e:
            print(
                f"[BLEND SAVE WARNING] {e}"
            )

    for obj in source_meshes:
        restore_uv0_active(obj)

    final_report(
        source_meshes,
        baked_images,
        export_objects,
        glb_path if EXPORT_GLTF else "(disabled)",
        glb_ok,
        glb_summary,
    )

    total, black, _ = summarize_bake_stats()

    if total and len(black) / total > MAX_BLACK_FRACTION:
        raise RuntimeError(
            f"{len(black)} of {total} baked images are black - the bake is "
            f"systematically broken (see the BAKE WARNING lines above)."
        )

    if not glb_ok:
        raise RuntimeError(
            "GLB self-check FAILED - do not upload this file: "
            + "; ".join(glb_summary.get("problems") or [glb_summary.get("error", "unknown")])
        )

    log("FINAL BAKE DONE")


# ================================================================
# RUN
# ================================================================

try:
    main()
finally:
    # A failed run must not leave proxies in the scene / originals hidden.
    remove_bake_proxies()
