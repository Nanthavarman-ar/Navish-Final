import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, AbstractMesh, Material, MultiMaterial, MeshBuilder, StandardMaterial, PBRMaterial, DynamicTexture, Texture, Color3, Vector3, PointerEventTypes } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, StackPanel, Image as GuiImage } from '@babylonjs/gui';
import { X, Palette, Trash2, Plus, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';
import type { MaterialManager } from './MaterialManager';
import type { MaterialPreset } from './interfaces/MaterialInterfaces';
import { loadSceneEdits, savePartialFeatureState, type SavedSwatchMarker, type SavedSwatchOption } from './utils/sceneEditsPersistence';

interface MeshMaterialSwatchesProps {
  scene: Scene;
  materialManager: MaterialManager;
  roomId: string;
  onClose: () => void;
  // Same "stays mounted, visibility toggled via this prop" pattern as AnnotationTool/
  // HotspotNavigation (see their own comments) - the markers must stay clickable for any
  // viewer regardless of whether the admin's own panel is open.
  visible?: boolean;
}

// Reuse the persisted shape directly (see sceneEditsPersistence.ts) - markers are saved
// server-side under the model's own scene-edits record, the same one mesh position/home
// view/floor plans already use, so any client opening this model sees exactly what the
// admin configured, not just whichever browser placed them. localStorage was the first
// cut of this feature; it never left the browser that created it, which defeated the
// point of "admin sets it up, client picks from it" entirely.
type SwatchOption = SavedSwatchOption;
type SwatchMarker = SavedSwatchMarker;

// Longest side an uploaded texture is downscaled to before being embedded as a data URL
// in the shared scene-edits record - keeps a handful of markers' worth of textures from
// bloating a record that also carries every mesh's position/rotation/scale for the whole
// model. Tiling repetition (see applyTextureOption) means detail beyond typical on-screen
// tile size is wasted anyway.
const MAX_TEXTURE_DIMENSION = 512;

// A fence/railing/tiled surface is very often many repeated slat/panel meshes that all
// share the exact same source name (and sometimes the same id) - a plain
// scene.getMeshById/name match then resolves to whichever one happens to appear first in
// scene.meshes, not necessarily the one the marker was actually placed on, so applying a
// swatch changed some OTHER slat instead of the marked one. Disambiguates by picking
// whichever same-named mesh's bounding box is actually closest to where the marker was
// placed, which is stable across a reload (unlike mesh.uniqueId, reassigned fresh every
// load) since it's the model's own real-world geometry, not a runtime-only id.
function resolveMeshRef(scene: Scene, meshId: string, meshName: string, position: { x: number; y: number; z: number }): AbstractMesh | null {
  const candidates = scene.meshes.filter((m) => m.id === meshId || m.name === meshName);
  if (candidates.length <= 1) return candidates[0] ?? null;
  const target = new Vector3(position.x, position.y, position.z);
  let best = candidates[0];
  let bestDistSq = Vector3.DistanceSquared(best.getBoundingInfo().boundingBox.centerWorld, target);
  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    const distSq = Vector3.DistanceSquared(candidate.getBoundingInfo().boundingBox.centerWorld, target);
    if (distSq < bestDistSq) {
      best = candidate;
      bestDistSq = distSq;
    }
  }
  return best;
}

// Same enumeration MaterialEditor.tsx's own "Materials" list uses (scene.materials plus
// MultiMaterial's subMaterials, deduped) - the actual materials already on the loaded
// model (e.g. "groundMaterial", "boxMaterial"), which is what an admin pinning a swatch
// almost always means, rather than a generic named preset that may not match this
// model's real look at all.
function getSceneMaterials(scene: Scene): Material[] {
  const plain = scene.materials;
  const sub = scene.multiMaterials.flatMap((mm: MultiMaterial) => mm.subMaterials.filter((m): m is Material => !!m));
  const seen = new Set<Material>();
  return [...plain, ...sub].filter((mat) => {
    if (seen.has(mat)) return false;
    seen.add(mat);
    return true;
  });
}

// Bakes the material's actual alpha into the swatch preview so a translucent material
// (glass presets like Clear/Tinted Glass, or an actual glass material already in the
// scene) visibly looks faded/see-through in the picker and in the applied-options list -
// previously every preview showed as a fully solid color regardless of alpha, so picking
// one of those for an ordinary opaque surface (a fence, a wall) made it look "invisible"
// with no warning at all beforehand.
function materialPreviewColor(mat: Material): string {
  const anyMat = mat as any;
  const c = anyMat.albedoColor || anyMat.diffuseColor;
  const alpha = typeof anyMat.alpha === 'number' ? anyMat.alpha : 1;
  if (c) return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
  return '#475569';
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

function downscaleImageFile(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Could not read image file'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not create canvas context')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const MeshMaterialSwatches: React.FC<MeshMaterialSwatchesProps> = ({ scene, materialManager, roomId, onClose, visible = true }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-right');
  const [markers, setMarkers] = useState<SwatchMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacing, setIsPlacing] = useState(false);
  const [draftMarker, setDraftMarker] = useState<{ meshId: string; meshName: string; position: Vector3 } | null>(null);
  const [draftOptions, setDraftOptions] = useState<SwatchOption[]>([]);
  const [expandedMarkerId, setExpandedMarkerId] = useState<string | null>(null);
  const [openPopupMarkerId, setOpenPopupMarkerId] = useState<string | null>(null);
  const markerMeshesRef = useRef<Map<string, Mesh>>(new Map());
  // A mutable snapshot, refreshed after each addCustomPreset call below - the "existing
  // material slots" reuse row needs to reflect a texture just uploaded and registered
  // within this same session, not only the ~14 presets MaterialManager ships with.
  const [presets, setPresets] = useState<MaterialPreset[]>(() => materialManager.getMaterialPresets());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadSceneEdits(roomId).then((data) => {
      if (!cancelled) setMarkers(data?.features?.swatches ?? []);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [roomId]);

  // Render/sync the diamond marker meshes whenever the marker list changes.
  useEffect(() => {
    const currentIds = new Set(markers.map((m) => m.id));
    markerMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        // dispose()'s second arg (disposeMaterialAndTextures) defaults to false - each
        // marker has its own DynamicTexture baked just for it, so leaving it out here
        // would leak a texture every time a marker is deleted.
        mesh.dispose(false, true);
        markerMeshesRef.current.delete(id);
      }
    });

    markers.forEach((marker) => {
      if (markerMeshesRef.current.has(marker.id)) return;
      const pin = MeshBuilder.CreatePlane(`swatch_marker_${marker.id}`, { size: 0.55 }, scene);
      pin.position = new Vector3(marker.position.x, marker.position.y + 0.05, marker.position.z);
      pin.billboardMode = Mesh.BILLBOARDMODE_ALL;
      pin.renderingGroupId = 1;

      // A diamond with a paint-drop glyph - distinct from HotspotNavigation's arrow
      // diamonds (jump-here) and AnnotationTool's note cards (read-this), so all three
      // marker families read as different actions at a glance.
      const texture = new DynamicTexture(`swatch_marker_tex_${marker.id}`, { width: 128, height: 128 }, scene, true);
      texture.hasAlpha = true;
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 128, 128);
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 5;
      const half = 38;
      ctx.beginPath();
      ctx.rect(-half, -half, half * 2, half * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(64, 58, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(60, 76, 8, 10);
      texture.update();

      const mat = new StandardMaterial(`swatch_marker_mat_${marker.id}`, scene);
      mat.diffuseTexture = texture;
      mat.useAlphaFromDiffuseTexture = true;
      mat.emissiveColor = new Color3(1, 1, 1);
      mat.backFaceCulling = false;
      pin.material = mat;
      markerMeshesRef.current.set(marker.id, pin);
    });
  }, [markers, scene]);

  useEffect(() => {
    return () => {
      markerMeshesRef.current.forEach((mesh) => mesh.dispose(false, true));
      markerMeshesRef.current.clear();
      popupPlaneRef.current?.dispose(false, true);
      popupPlaneRef.current = null;
    };
  }, []);

  // The popup used to be a Rectangle on a shared AdvancedDynamicTexture.CreateFullscreenUI
  // - a flat 2D layer composited onto the regular canvas. A WebXR immersive session
  // renders straight to the headset's own framebuffers and never draws that canvas
  // overlay at all, so the swatch popup was invisible in VR even though the marker
  // itself (a real 3D mesh) showed up fine - the same reason XRManager's AR controls
  // needed a raw DOM overlay instead of Babylon GUI. CreateForMesh is the fix: it puts
  // the GUI onto an actual plane that's part of the 3D scene, so it renders (and is
  // clickable via the VR controller's own pointer-selection, same as the marker) exactly
  // like any other object - in the headset, not just on a flat desktop overlay. Created
  // fresh per popup (not once up front) since each one needs its own plane positioned at
  // its own marker.
  const popupPlaneRef = useRef<Mesh | null>(null);

  const closeSwatchPopup = useCallback(() => {
    if (popupPlaneRef.current) {
      // dispose()'s disposeMaterialAndTextures arg defaults to false - a popup gets a
      // fresh CreateForMesh material/texture every time it opens, so leaving this out
      // would leak one on every close (and every reopen, since each open also closes
      // whatever was already showing).
      popupPlaneRef.current.dispose(false, true);
      popupPlaneRef.current = null;
    }
    setOpenPopupMarkerId(null);
  }, []);

  // Real-world-accurate texture tiling, the same "set the texture's true physical size
  // once" workflow as SketchUp's Fixed Pins - a tile/plank image repeats at its authored
  // real-world size across the mesh's actual footprint instead of stretching exactly once
  // across however big that mesh happens to be. Uses the two LARGEST of the mesh's three
  // bounding-box extents as its "surface width/height", which works for any flat-ish panel
  // (a floor, wall, tabletop) regardless of which way it's oriented - it assumes the
  // mesh's own UVs already span 0..1 across that footprint (true for simple architectural
  // planes exported by most tools). A mesh with a complex, non-uniform UV atlas (e.g. a
  // multi-part piece of furniture baked into one texture sheet) won't tile accurately this
  // way - the existing MaterialEditor uScale/vScale sliders remain the manual fallback for
  // those cases.
  const applyTextureOption = useCallback((mesh: AbstractMesh, option: SwatchOption) => {
    if (!option.textureDataUrl) return;
    const material = new PBRMaterial(`swatch_tex_${option.id}_${Date.now()}`, scene);
    const texture = new Texture(option.textureDataUrl, scene);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;

    const bb = mesh.getBoundingInfo().boundingBox;
    const extents = [
      bb.maximumWorld.x - bb.minimumWorld.x,
      bb.maximumWorld.y - bb.minimumWorld.y,
      bb.maximumWorld.z - bb.minimumWorld.z,
    ].sort((a, b) => b - a);
    const [surfaceWidthM, surfaceHeightM] = extents;
    const tileWidthM = (option.tileWidthCm ?? 30) / 100;
    const tileHeightM = (option.tileHeightCm ?? 30) / 100;
    texture.uScale = Math.max(surfaceWidthM / tileWidthM, 0.01);
    texture.vScale = Math.max(surfaceHeightM / tileHeightM, 0.01);

    material.albedoTexture = texture;
    material.roughness = 0.85;
    material.metallic = 0;
    mesh.material = material;
  }, [scene]);

  // Pins one of the model's OWN existing materials (e.g. "groundMaterial") onto the
  // target mesh. Always clones it fresh rather than assigning the same live material
  // object - if it just assigned the original reference, switching one marked mesh to
  // "groundMaterial" would make it visually identical to every OTHER mesh already using
  // that material, AND a later edit to the original in the Material Editor (which does
  // mutate in place) would silently change this mesh's look too. Cloning makes this
  // marker's result a fully independent copy: applying it only ever changes the one
  // mesh the marker was placed on, never any other mesh sharing the source material.
  const applySceneMaterialOption = useCallback((mesh: AbstractMesh, option: SwatchOption) => {
    const source = getSceneMaterials(scene).find((m) => m.name === option.sourceMaterialName);
    if (!source) {
      showToast.error(`"${option.sourceMaterialName}" is no longer in this scene`);
      return;
    }
    const clone = source.clone(`swatch_${option.id}_${Date.now()}`);
    if (clone) mesh.material = clone;
  }, [scene]);

  const applyOption = useCallback((mesh: AbstractMesh, option: SwatchOption) => {
    if (option.kind === 'texture') {
      applyTextureOption(mesh, option);
    } else if (option.kind === 'scene-material') {
      applySceneMaterialOption(mesh, option);
    } else if (option.presetId) {
      const material = materialManager.createMaterialFromPreset(option.presetId);
      if (material) materialManager.applyMaterialToMesh(material.name, mesh);
    }
    showToast.success(`Applied ${option.label}`);
    closeSwatchPopup();
  }, [applyTextureOption, applySceneMaterialOption, materialManager, closeSwatchPopup]);

  // Click a marker (outside placing mode) to open its round swatch popup right above it.
  useEffect(() => {
    if (isPlacing) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      // A click on the popup panel itself (e.g. one of its swatch buttons) also produces
      // a real pick against that plane - without this check, clicking a swatch would
      // immediately close the very popup it's part of, right before applyOption's own
      // closeSwatchPopup() call ran.
      if (mesh?.name.startsWith('swatch_popup_panel_')) return;
      if (!mesh?.name.startsWith('swatch_marker_')) {
        closeSwatchPopup();
        return;
      }
      const id = mesh.name.slice('swatch_marker_'.length);
      // Click the SAME marker that's already open again to close it (a plain toggle),
      // rather than always tearing down and immediately reopening the identical popup.
      if (openPopupMarkerId === id) {
        closeSwatchPopup();
        return;
      }
      const marker = markers.find((m) => m.id === id);
      if (!marker || marker.options.length === 0) return;
      const targetMesh = resolveMeshRef(scene, marker.meshId, marker.meshName, marker.position);
      if (!targetMesh) {
        showToast.error('The mesh this swatch was placed on is no longer in the scene');
        return;
      }

      closeSwatchPopup();

      // A world-space plane, not a screen-space overlay - see the comment on
      // popupPlaneRef above for why (VR visibility). Billboarded so it always faces
      // whoever's looking at it, whether that's the desktop orbit camera or the actual
      // position of someone's head in a VR headset. Texture pixel size keeps the same
      // proportions the old screen-space card used (options*52+16 by 68), just at 2x
      // resolution for a crisper look on a world-space surface; the plane's real-world
      // size is derived from that same aspect ratio rather than a hardcoded guess.
      const texWidth = marker.options.length * 104 + 32;
      const texHeight = 136;
      const planeHeight = 0.22;
      const planeWidth = planeHeight * (texWidth / texHeight);
      const plane = MeshBuilder.CreatePlane(`swatch_popup_panel_${id}`, { width: planeWidth, height: planeHeight }, scene);
      plane.position = mesh.position.clone();
      plane.position.y += 0.42;
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      plane.renderingGroupId = 1;

      const texture = AdvancedDynamicTexture.CreateForMesh(plane, texWidth, texHeight, true);

      const card = new Rectangle(`swatch_popup_${id}`);
      card.width = '100%';
      card.height = '100%';
      card.cornerRadius = 34;
      card.color = '#22d3ee';
      card.thickness = 3;
      card.background = '#1c1917';
      card.alpha = 0.96;
      texture.addControl(card);

      const row = new StackPanel(`swatch_popup_row_${id}`);
      row.isVertical = false;
      row.spacing = 16;
      card.addControl(row);

      marker.options.forEach((option) => {
        const swatch = new Rectangle(`swatch_btn_${option.id}`);
        swatch.widthInPixels = 88;
        swatch.heightInPixels = 88;
        swatch.cornerRadius = 44;
        swatch.thickness = 4;
        swatch.color = '#fff';
        swatch.clipChildren = true;
        swatch.background = option.previewColor || '#334155';
        if (option.kind === 'texture' && option.textureDataUrl) {
          const img = new GuiImage(`swatch_img_${option.id}`, option.textureDataUrl);
          img.stretch = GuiImage.STRETCH_UNIFORM;
          swatch.addControl(img);
        }
        swatch.onPointerClickObservable.add(() => applyOption(targetMesh, option));
        row.addControl(swatch);
      });

      popupPlaneRef.current = plane;
      setOpenPopupMarkerId(id);
    });
    return () => { scene.onPointerObservable.remove(observer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlacing, scene, markers, applyOption, closeSwatchPopup, openPopupMarkerId]);

  // Click-to-place: the next click on the model (not an existing marker) picks the target
  // mesh and captures where the marker itself should sit.
  useEffect(() => {
    if (!isPlacing) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => !m.name.startsWith('swatch_marker_') && !m.name.startsWith('swatch_popup_panel_'));
      if (!pickResult?.hit || !pickResult.pickedPoint || !pickResult.pickedMesh) {
        showToast.info('Click directly on a mesh to place a swatch marker');
        return;
      }
      setDraftMarker({ meshId: pickResult.pickedMesh.id, meshName: pickResult.pickedMesh.name, position: pickResult.pickedPoint.clone() });
      setDraftOptions([]);
      setIsPlacing(false);
    });
    return () => { scene.onPointerObservable.remove(observer); };
  }, [isPlacing, scene]);

  // Picking a preset that's itself a previously-uploaded texture (see addTextureOption
  // below) must stay a texture option, not a flat-color one - createMaterialFromPreset/
  // applyMaterialToMesh only ever read diffuseColor/metallic/roughness, so routing a
  // texture preset through the 'preset' kind would silently apply a plain grey material
  // with the image lost.
  const addPresetOption = (preset: MaterialPreset) => {
    const textureDataUrl = preset.properties?.textureDataUrl as string | undefined;
    setDraftOptions((prev) => [...prev, textureDataUrl ? {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: preset.name,
      kind: 'texture',
      textureDataUrl,
      tileWidthCm: preset.properties?.tileWidthCm ?? 30,
      tileHeightCm: preset.properties?.tileHeightCm ?? 30,
    } : {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: preset.name,
      kind: 'preset',
      presetId: preset.id,
      previewColor: hexToRgba(preset.preview, preset.properties?.alpha ?? 1),
    }]);
  };

  const addSceneMaterialOption = (mat: Material) => {
    setDraftOptions((prev) => [...prev, {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: mat.name,
      kind: 'scene-material',
      sourceMaterialName: mat.name,
      previewColor: materialPreviewColor(mat),
    }]);
  };

  const addTextureOption = async (file: File) => {
    let dataUrl: string;
    try {
      dataUrl = await downscaleImageFile(file, MAX_TEXTURE_DIMENSION);
    } catch {
      showToast.error('Could not read that image file');
      return;
    }
    const label = file.name.replace(/\.[^.]+$/, '');
    setDraftOptions((prev) => [...prev, {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      kind: 'texture',
      textureDataUrl: dataUrl,
      tileWidthCm: 30,
      tileHeightCm: 30,
    }]);
    // Registers it as an additional material slot (MaterialManager.getMaterialPresets/
    // addCustomPreset) so a LATER marker can reuse this same texture straight from the
    // "existing material slots" row above instead of re-uploading the file every time -
    // in-memory for this session only, same as MaterialManager's other custom presets.
    const presetId = `custom_texture_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const added = materialManager.addCustomPreset({
      id: presetId,
      name: label,
      description: `Uploaded texture: ${label}`,
      materialType: 'pbr',
      category: 'custom',
      preview: dataUrl,
      properties: { textureDataUrl: dataUrl, tileWidthCm: 30, tileHeightCm: 30 },
    });
    if (added) setPresets(materialManager.getMaterialPresets());
  };

  const updateTileSize = (optionId: string, field: 'tileWidthCm' | 'tileHeightCm', value: number) => {
    setDraftOptions((prev) => prev.map((o) => (o.id === optionId ? { ...o, [field]: value } : o)));
  };

  const removeDraftOption = (optionId: string) => {
    setDraftOptions((prev) => prev.filter((o) => o.id !== optionId));
  };

  const handleSaveMarker = () => {
    if (!draftMarker || draftOptions.length === 0) return;
    const marker: SwatchMarker = {
      id: `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      meshId: draftMarker.meshId,
      meshName: draftMarker.meshName,
      position: { x: draftMarker.position.x, y: draftMarker.position.y, z: draftMarker.position.z },
      options: draftOptions,
    };
    const next = [...markers, marker];
    setMarkers(next);
    savePartialFeatureState(roomId, { swatches: next });
    showToast.success('Material swatch marker added');
    setDraftMarker(null);
    setDraftOptions([]);
  };

  const handleDeleteMarker = (id: string) => {
    const next = markers.filter((m) => m.id !== id);
    setMarkers(next);
    savePartialFeatureState(roomId, { swatches: next });
  };

  return (
    <div ref={panelRef} style={panelStyle} className={`fixed right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex-col max-h-[70vh] ${visible ? 'flex' : 'hidden'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Material Swatches</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close material swatches">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-gray-700 shrink-0">
        {!isPlacing && !draftMarker && (
          <Button size="sm" className="w-full" onClick={() => setIsPlacing(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add swatch marker
          </Button>
        )}
        {isPlacing && (
          <div className="text-xs text-cyan-300 text-center py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded">
            Click the mesh you want to offer material choices for (e.g. a floor)...
          </div>
        )}
        {draftMarker && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">On: <span className="text-gray-200">{draftMarker.meshName}</span></div>
            <div className="text-xs text-gray-400">Add as many material options as you want ({draftOptions.length} so far):</div>

            {draftOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draftOptions.map((o) => (
                  <div key={o.id} className="relative">
                    <div
                      className="w-9 h-9 rounded-full border-2 border-slate-600 bg-cover bg-center flex items-center justify-center text-[9px] overflow-hidden"
                      style={o.kind === 'texture' ? { backgroundImage: `url(${o.textureDataUrl})` } : { background: o.previewColor }}
                      title={o.label}
                    />
                    {o.kind === 'texture' && (
                      <div className="flex gap-1 mt-1">
                        <input type="number" min={1} value={o.tileWidthCm} onChange={(e) => updateTileSize(o.id, 'tileWidthCm', Number(e.target.value))} className="w-9 bg-slate-800 border border-slate-600 rounded text-[10px] px-0.5" title="Tile width (cm)" />
                        <input type="number" min={1} value={o.tileHeightCm} onChange={(e) => updateTileSize(o.id, 'tileHeightCm', Number(e.target.value))} className="w-9 bg-slate-800 border border-slate-600 rounded text-[10px] px-0.5" title="Tile height (cm)" />
                      </div>
                    )}
                    <button onClick={() => removeDraftOption(o.id)} className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]" aria-label="Remove option">×</button>
                  </div>
                ))}
              </div>
            )}

            {getSceneMaterials(scene).length > 0 && (
              <>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">From materials already on this model</div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {getSceneMaterials(scene).map((mat) => (
                    <button
                      key={mat.uniqueId}
                      onClick={() => addSceneMaterialOption(mat)}
                      className="w-7 h-7 rounded-full border border-slate-600 hover:border-cyan-400 transition-colors"
                      style={{ background: materialPreviewColor(mat) }}
                      title={mat.name}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">From existing material slots</div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {presets.map((preset) => {
                const isTexture = preset.preview.startsWith('data:image');
                const alpha = preset.properties?.alpha ?? 1;
                return (
                  <button
                    key={preset.id}
                    onClick={() => addPresetOption(preset)}
                    className="w-7 h-7 rounded-full border border-slate-600 hover:border-cyan-400 transition-colors bg-cover bg-center"
                    style={isTexture ? { backgroundImage: `url(${preset.preview})` } : { background: hexToRgba(preset.preview, alpha) }}
                    title={alpha < 1 ? `${preset.name} (${Math.round(alpha * 100)}% opacity)` : preset.name}
                  />
                );
              })}
            </div>
            <label className="flex items-center justify-center gap-1.5 text-xs text-gray-300 border border-dashed border-slate-600 rounded py-1.5 cursor-pointer hover:border-cyan-500 transition-colors">
              <Upload className="w-3 h-3" /> Upload a texture (real-world tile size)
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addTextureOption(f); e.target.value = ''; }} />
            </label>

            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" disabled={draftOptions.length === 0} onClick={handleSaveMarker}>Save marker</Button>
              <Button size="sm" variant="outline" onClick={() => { setDraftMarker(null); setDraftOptions([]); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full" />
            Loading swatch markers...
          </div>
        )}
        {!isLoading && markers.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">
            No swatch markers yet. Click "Add swatch marker" and pick a mesh.
          </div>
        )}
        {markers.map((m) => (
          <div key={m.id} className="p-2.5 bg-slate-800/50 border border-slate-700/80 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => setExpandedMarkerId((prev) => (prev === m.id ? null : m.id))} className="text-left flex-1 text-sm text-gray-100 hover:text-cyan-300 transition-colors">
                {m.meshName} <span className="text-gray-500 text-xs">({m.options.length} option{m.options.length === 1 ? '' : 's'})</span>
              </button>
              <button onClick={() => handleDeleteMarker(m.id)} className="text-gray-500 hover:text-red-400 transition-colors shrink-0" aria-label="Delete marker">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {expandedMarkerId === m.id && (
              <div className="flex gap-1.5 mt-2">
                {m.options.map((o) => (
                  <div key={o.id} className="w-7 h-7 rounded-full border border-slate-600 bg-cover bg-center" style={o.kind === 'texture' ? { backgroundImage: `url(${o.textureDataUrl})` } : { background: o.previewColor }} title={o.label} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MeshMaterialSwatches;
