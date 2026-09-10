import { AbstractMesh, Color3, Material, PBRMaterial } from '@babylonjs/core';

// Closes the "walls look flat/plastic, not like Enscape" gap reported this session -
// confirmed by code search that nothing in this app actually tunes an imported model's
// OWN materials at load time (every other `.metallic`/`.roughness`/`.alpha` assignment
// found elsewhere - MeshMaterialSwatches, MaterialEditor, BIMManager's own generated demo
// meshes, all the simulation overlay tools - only ever touches materials THIS APP creates
// itself, never the uploaded model's real materials). Enscape (and every other real-time
// architectural viewer) auto-classifies "dumb" imported materials like this by name/type
// and gives them a believable PBR response instead of showing them exactly as authored,
// which for a SketchUp/Revit export is very often just a flat diffuse color with whatever
// metallic/roughness the exporter defaulted to (frequently the glTF spec default of
// metallic=1/roughness=1 - fully metallic AND fully rough at once, which reads as dead
// grey plastic under PBR lighting) rather than anything actually tuned per element.
//
// Deliberately conservative about what it touches, per this session's explicit ask to
// implement this "without breaking anything":
// - PBRMaterial only. This app's real imported models (glTF/GLB, the entire upload path -
//   see modelOptimizer.ts/UploadPage.tsx) load through @babylonjs/loaders' glTF importer,
//   which always creates PBRMaterial. StandardMaterial in this codebase only ever shows up
//   on meshes this app generates itself (BIMManager's demo geometry, tool overlays) -
//   those already look intentional and are out of scope here.
// - Skips any material that already has a metallicTexture, roughness-driving texture, or
//   alpha < 1 - all three are strong signals of real authored PBR/transparency data (a
//   proper texture-driven workflow, or a glass material someone already tuned by hand),
//   which this must never fight or override.
// - Reuses the exact same numeric presets MaterialEditor.tsx's own type switcher already
//   uses for "default"/"glassSimple"/"cloth" materials, rather than inventing new numbers,
//   so a material this pass touches looks the same as if a person had picked that same
//   preset by hand in the Material Editor. Floor clearcoat and lamp emissive glow (see
//   FLOOR_CLEARCOAT_*/LIGHT_FIXTURE_* below) follow the same "reuse an existing precedent,
//   keep it subtle" rule - clearCoat is the same feature/API MaterialEditor's carPaint/
//   carbon presets already use, and the lamp glow is a material-only emissive tint (no
//   real dynamic light, no shadow cost) specifically because a furnished interior can
//   easily have a dozen-plus lamp-looking meshes, and a dozen-plus extra real-time lights
//   is exactly the kind of frame-rate cost this session has spent effort cutting elsewhere.
// - Every material is visited at most once (materials are commonly shared across many
//   meshes) via the `processed` set, and the whole thing is wrapped per-material so one
//   unexpected material shape can't take down the rest of the pass.
// "glass" is bounded to a whole word - unbounded, it matched "Fiberglass" (insulation/
// panelling, not see-through) as a plain substring. "window" is handled separately below:
// alone it's ambiguous - a window opening's mesh is very often the pane itself
// (SketchUp/Revit commonly name it exactly "Window"), but just as often it's the frame,
// sill, trim, casing, or the curtain/blind hung on it - none of which are glass. See
// WINDOW_PATTERN/GLASS_FRAME_EXCLUSION_PATTERN in classify() below.
const GLASS_PATTERN = /\bglass\b|glazing|\bpane\b/i;
const WINDOW_PATTERN = /\bwindow\b/i;
const GLASS_FRAME_EXCLUSION_PATTERN = /frame|sill|trim|casing|jamb|mullion|header|surround|board|ledge|shutter|blind|curtain|drape/i;

/**
 * Same glass/window detection classify() below uses for material enhancement, exported so
 * other passes that need "is this actually the glass pane, not its frame/sill/trim" (the
 * ambient fill-light placement in ambientFillLights.ts, which places lights at detected
 * windows) share one definition instead of a second copy that could silently drift out of
 * sync with this one's own frame/sill/trim exclusion fix.
 */
export function isGlassLabel(label: string): boolean {
  return GLASS_PATTERN.test(label) || (WINDOW_PATTERN.test(label) && !GLASS_FRAME_EXCLUSION_PATTERN.test(label));
}
const METAL_PATTERN = /steel|metal|aluminu?m|chrome|iron\b|railing|balustrade|hinge|handle|grille|mesh_wire/i;
const FLOOR_PATTERN = /floor|tile|marble|granite|terrazzo|slab/i;
const WOOD_PATTERN = /wood|timber|plywood|veneer|\bdoor\b/i;
const FABRIC_PATTERN = /fabric|carpet|\brug\b|sofa|cushion|curtain|upholstery/i;
// Lamps/fixtures get a modest always-on warm glow rather than a real dynamic light - see
// the note on LIGHT_FIXTURE_LOOK below for why a real light per mesh isn't worth the cost.
const LIGHT_FIXTURE_PATTERN = /\blamp\b|chandelier|sconce|\bbulb\b|pendant.?light|ceiling.?light/i;
// Left alone entirely - InteractiveFixtures' "Running Water" fixture and
// EnhancedFloodSimulation already own what "water" should look like in this app; a
// generically-named water surface in an uploaded model is rare enough not to be worth the
// risk of this pass fighting either of those for the same material.
const WATER_PATTERN = /water|pool|pond|fountain/i;

// The exact literal name Babylon's own glTF loader (@babylonjs/loaders) gives the
// fallback material it creates when a primitive in the source file has NO material
// assigned at all (confirmed against glTFLoader.pure.js's own `_createDefaultMaterial`
// call site) - not a name this app chose, and not something classify() below can ever
// turn into a real wood/glass/stone look, since there is no real material data behind it
// to draw on. Exported so BabylonWorkspace.tsx can tell "generic name classify() couldn't
// identify" (still gets a believable look below) apart from "the source file genuinely has
// zero material here" (same generic look applied, but worth surfacing to the user - see
// enhanceImportedMaterials' missingMaterialMeshes return value).
export const MISSING_MATERIAL_NAME = '__GLTFLoader._default';

interface MaterialLook {
  metallic: number;
  roughness: number;
  /** Only glass gets this - see MaterialEditor.tsx's 'glassSimple' preset. */
  glassAlpha?: number;
  /** Only floors get this - a subtle polished-surface highlight, not a mirror finish. */
  clearcoat?: boolean;
  /** Lamps and glass/windows each get their own color/intensity - see LIGHT_FIXTURE_*/
  /** WINDOW_GLOW_* below. */
  emissive?: { color: Color3; intensity: number };
}

// A believable "polished floor" look needs a second, sharper specular response on top of
// the base one (why real floor finishes read as glossy even though the base material
// itself is quite rough) - this is exactly what MaterialEditor.tsx's own 'carPaint'/
// 'carbon' presets already use clearCoat for, reused here at a much subtler intensity
// (floors aren't car paint - this should read as "polished", not "wet").
const FLOOR_CLEARCOAT_INTENSITY = 0.3;
const FLOOR_CLEARCOAT_ROUGHNESS = 0.15;

// A real dynamic PointLight per lamp mesh (the way InteractiveFixtures does for a
// deliberately hand-placed 'light' fixture, one at a time) doesn't scale to "every lamp-
// looking mesh already in a furnished interior import" - a single apartment model can
// easily have a dozen-plus ceiling lights/sconces/lamps, and a dozen-plus extra real-time
// shadow-casting lights is a genuine, direct frame-rate cost this session has spent a lot
// of effort cutting elsewhere. A material-only emissive glow (no light, no shadow, just
// the mesh itself looking lit) gets the same "this room has warm practical lighting"
// visual read Enscape shows for the same reason real-time renderers default to it - for
// basically free, since it's a property set on a material that's already being drawn.
const LIGHT_FIXTURE_EMISSIVE_COLOR = new Color3(1, 0.85, 0.55);
const LIGHT_FIXTURE_EMISSIVE_INTENSITY = 0.6;

// Reported this session: the ambient fill lights (ambientFillLights.ts) placed near
// windows brighten the room a little, but the window itself still reads as a flat, unlit
// gray pane - "no daylight visible through it". Real-time archviz tools commonly fake
// "bright sky/daylight visible through the glass" with exactly this same trick used above
// for lamps: a material-only emissive glow, not an actual light source - free (a property
// on a material that's already being drawn), and avoids ever needing real exterior
// geometry/sky visible through the glass for it to read as "daylight outside". Cooler/
// paler than the lamp glow (daylight, not a warm bulb) and noticeably dimmer per-pixel
// than a lamp's small bulb surface - a whole window pane is a much larger emissive area,
// so a lamp-level intensity here would read as a glowing screen, not soft daylight.
const WINDOW_GLOW_COLOR = new Color3(0.85, 0.92, 1);
const WINDOW_GLOW_INTENSITY = 0.4;

// Reported regression, root-caused after this shipped: metal/lamp materials were coming
// out solid black on some models, "works on some models, not others" on the rest -
// BabylonWorkspace.tsx's own scene-init comment (search "render glass/metal/mirror
// surfaces flat or black with nothing to reflect") already documents exactly why - a
// physically-based metallic surface has almost no diffuse response at all (real metals
// don't scatter light the way a painted wall does), so it needs environment/IBL
// reflections to look lit, not just the scene's directional+hemispheric analytical
// lights. That file's own fix (scene.createDefaultEnvironment(), dimmed to
// environmentIntensity = 0.25 - deliberately low, to avoid a DIFFERENT problem: washed-out
// highlights and a mismatched blue rim at grazing angles) was tuned around whatever
// metallic values already existed in a model's own source materials, not around this
// pass additionally pushing MORE materials to a high metallic value on top of that. And
// that default environment is itself best-effort - see its own try/catch - a CDN/offline
// failure leaves PBR reflections with nothing at all, which is the likely explanation for
// "works on some models, not others": whichever session loaded first cached (or didn't)
// that environment texture. metallic values here are kept low enough that every material
// this pass touches still reads reasonably under plain analytical lights alone, with or
// without a working environment texture - real "metal" architectural elements (railings,
// window frames, grilles) are rarely pure/mirror-metallic in practice anyway, even before
// paint/dirt/oxidation is considered.
function classify(label: string): MaterialLook | null {
  if (WATER_PATTERN.test(label)) return null;
  // Reported this session as "light bleeding through walls"/floating-furniture look near
  // windows on today's fresh (post-KTX2-revert, plain WebP) uploads - root cause was here,
  // not the texture pipeline: GLASS_PATTERN used to match "window" unconditionally, so a
  // frame/sill/trim/curtain mesh named e.g. "Window_Frame_01" or "Door_and_Window_Trim"
  // got forced to 20%-alpha transparency right alongside the actual glass pane.
  if (isGlassLabel(label)) {
    return {
      metallic: 0,
      roughness: 0.05,
      glassAlpha: 0.2,
      emissive: { color: WINDOW_GLOW_COLOR, intensity: WINDOW_GLOW_INTENSITY },
    };
  }
  if (LIGHT_FIXTURE_PATTERN.test(label)) {
    return {
      metallic: 0.2,
      roughness: 0.4,
      emissive: { color: LIGHT_FIXTURE_EMISSIVE_COLOR, intensity: LIGHT_FIXTURE_EMISSIVE_INTENSITY },
    };
  }
  if (METAL_PATTERN.test(label)) return { metallic: 0.3, roughness: 0.4 };
  if (FLOOR_PATTERN.test(label)) return { metallic: 0, roughness: 0.3, clearcoat: true };
  if (WOOD_PATTERN.test(label)) return { metallic: 0, roughness: 0.55 };
  if (FABRIC_PATTERN.test(label)) return { metallic: 0, roughness: 0.85 };
  // Generic fallback (wall/plaster/paint/concrete/anything unnamed) - MaterialEditor.tsx's
  // own 'default' preset values, not a from-scratch guess.
  return { metallic: 0.1, roughness: 0.7 };
}

// Tried and reverted: a small deterministic per-MATERIAL roughness jitter (hashed from the
// material's own label), meant to break up the "every plain wall/ceiling looks like an
// exact clone" look. Seemed safe in isolation - a scalar-only change, no shaders/textures -
// but broke visibly on a real model: ribbed/corrugated siding modeled as many individual
// panel meshes, each with its OWN separate-but-visually-identical material from the
// exporter, got a different jitter PER PANEL, turning a previously uniform surface into
// obvious banding/stripes under lighting (reported this session, confirmed by reverting -
// the stripes were absent before this jitter shipped and gone again once it was pulled).
// The false assumption was "one classify() bucket == one visually continuous surface" -
// true for a single named wall material, false for any surface actually built from many
// repeated small materials, which ribbed panels/plank flooring/brick coursing all commonly
// are. Left as a known dead end rather than something to silently retry later.
/** Return value of {@link enhanceImportedMaterials} - see its own doc comment. */
export interface MaterialEnhancementResult {
  enhancedCount: number;
  /**
   * Every mesh whose material was Babylon's own MISSING_MATERIAL_NAME fallback - i.e. the
   * source file assigned it no material at all, not just an undescriptive one. classify()
   * still gives these a reasonable generic look (see the "no pattern matched" fallback
   * below) so the scene doesn't render broken, but no name-based heuristic can invent real
   * wood-grain/stone/glass data that was never in the file - worth surfacing to the user
   * rather than leaving them to wonder why one object looks flatter than the rest.
   */
  missingMaterialMeshes: AbstractMesh[];
}

/**
 * Walks a just-loaded model's meshes and gives any "untouched" PBRMaterial a believable,
 * per-element-type PBR response instead of leaving it at whatever flat default the source
 * file's exporter left it with. Returns how many distinct materials it actually changed,
 * for an optional toast/log - not required for correctness.
 */
export function enhanceImportedMaterials(meshes: AbstractMesh[]): MaterialEnhancementResult {
  const processed = new Set<Material>();
  let enhancedCount = 0;
  const missingMaterialMeshes: AbstractMesh[] = [];

  for (const mesh of meshes) {
    const material = mesh.material;
    if (!material) continue;
    // Checked before the processed-material dedup below (which is about not re-styling the
    // same shared material object twice) - Babylon's glTF loader reuses ONE fallback
    // material instance across every materialless primitive in the file, so multiple real
    // meshes commonly share it; each still needs to be reported individually, not just the
    // first one encountered.
    if (material.name === MISSING_MATERIAL_NAME) missingMaterialMeshes.push(mesh);
    if (processed.has(material)) continue;
    processed.add(material);

    if (!(material instanceof PBRMaterial)) continue;
    // Real authored PBR texture data, or a material someone already made transparent on
    // purpose (a hand-tuned glass, or an intentionally see-through overlay) - leave both
    // completely alone.
    if (material.metallicTexture || material.microSurfaceTexture || material.alpha < 1) continue;

    try {
      // Underscore-separated names (this app's own convention, per the "mood_light_"/
      // "swatch_marker_" style prefixes elsewhere, and extremely common in exported CAD/
      // BIM mesh names too - "Ceiling_Lamp_02") - \b treats "_" as a word character, so a
      // \b-bounded pattern like \blamp\b would silently NOT match "Ceiling_Lamp_02"
      // ("_Lamp_" has no real word boundary around it as far as regex \b is concerned).
      // Normalizing underscores to spaces first is what makes \b actually mean "start/end
      // of a real word" for names like this.
      const label = `${mesh.name || ''} ${material.name || ''}`.replace(/_/g, ' ');
      const look = classify(label);
      if (!look) continue;

      material.metallic = look.metallic;
      material.roughness = look.roughness;
      if (look.glassAlpha !== undefined) {
        material.alpha = look.glassAlpha;
        material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      }
      if (look.clearcoat) {
        material.clearCoat.isEnabled = true;
        material.clearCoat.intensity = FLOOR_CLEARCOAT_INTENSITY;
        material.clearCoat.roughness = FLOOR_CLEARCOAT_ROUGHNESS;
      }
      if (look.emissive) {
        material.emissiveColor = look.emissive.color;
        material.emissiveIntensity = look.emissive.intensity;
      }
      enhancedCount++;
    } catch (error) {
      console.warn('[materialEnhancement] Skipped a material that could not be enhanced:', error);
    }
  }

  return { enhancedCount, missingMaterialMeshes };
}
