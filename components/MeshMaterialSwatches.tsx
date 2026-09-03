import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, AbstractMesh, MeshBuilder, StandardMaterial, PBRMaterial, DynamicTexture, Texture, Color3, Vector3, PointerEventTypes } from '@babylonjs/core';
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

const MAX_OPTIONS = 4;
// Longest side an uploaded texture is downscaled to before being embedded as a data URL
// in the shared scene-edits record - keeps a handful of markers' worth of textures from
// bloating a record that also carries every mesh's position/rotation/scale for the whole
// model. Tiling repetition (see applyTextureOption) means detail beyond typical on-screen
// tile size is wasted anyway.
const MAX_TEXTURE_DIMENSION = 512;

function resolveMeshRef(scene: Scene, meshId: string, meshName: string): AbstractMesh | null {
  return scene.getMeshById(meshId) || scene.meshes.find((m) => m.name === meshName) || null;
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
  const guiTextureRef = useRef<AdvancedDynamicTexture | null>(null);
  const popupControlRef = useRef<Rectangle | null>(null);
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
        mesh.dispose();
        markerMeshesRef.current.delete(id);
      }
    });

    markers.forEach((marker) => {
      if (markerMeshesRef.current.has(marker.id)) return;
      const pin = MeshBuilder.CreatePlane(`swatch_marker_${marker.id}`, { size: 0.4 }, scene);
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
      markerMeshesRef.current.forEach((mesh) => mesh.dispose());
      markerMeshesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const texture = AdvancedDynamicTexture.CreateFullscreenUI('swatch_gui', true, scene);
    guiTextureRef.current = texture;
    return () => {
      texture.dispose();
      guiTextureRef.current = null;
    };
  }, [scene]);

  const closeSwatchPopup = useCallback(() => {
    const texture = guiTextureRef.current;
    if (popupControlRef.current && texture) {
      texture.removeControl(popupControlRef.current);
      popupControlRef.current.dispose();
      popupControlRef.current = null;
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

  const applyOption = useCallback((mesh: AbstractMesh, option: SwatchOption) => {
    if (option.kind === 'texture') {
      applyTextureOption(mesh, option);
    } else if (option.presetId) {
      const material = materialManager.createMaterialFromPreset(option.presetId);
      if (material) materialManager.applyMaterialToMesh(material.name, mesh);
    }
    showToast.success(`Applied ${option.label}`);
    closeSwatchPopup();
  }, [applyTextureOption, materialManager, closeSwatchPopup]);

  // Click a marker (outside placing mode) to open its round swatch popup right below it.
  useEffect(() => {
    if (isPlacing) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
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
      const targetMesh = resolveMeshRef(scene, marker.meshId, marker.meshName);
      if (!targetMesh) {
        showToast.error('The mesh this swatch was placed on is no longer in the scene');
        return;
      }

      closeSwatchPopup();
      const texture = guiTextureRef.current;
      if (!texture) return;

      const card = new Rectangle(`swatch_popup_${id}`);
      card.widthInPixels = marker.options.length * 52 + 16;
      card.heightInPixels = 68;
      card.cornerRadius = 34;
      card.color = '#22d3ee';
      card.thickness = 2;
      card.background = '#1c1917';
      card.alpha = 0.96;
      card.isPointerBlocker = true;

      const row = new StackPanel(`swatch_popup_row_${id}`);
      row.isVertical = false;
      row.spacing = 8;
      card.addControl(row);

      marker.options.forEach((option) => {
        const swatch = new Rectangle(`swatch_btn_${option.id}`);
        swatch.widthInPixels = 44;
        swatch.heightInPixels = 44;
        swatch.cornerRadius = 22;
        swatch.thickness = 2;
        swatch.color = '#fff';
        swatch.clipChildren = true;
        swatch.background = option.previewColor || '#334155';
        swatch.isPointerBlocker = true;
        if (option.kind === 'texture' && option.textureDataUrl) {
          const img = new GuiImage(`swatch_img_${option.id}`, option.textureDataUrl);
          img.stretch = GuiImage.STRETCH_UNIFORM;
          swatch.addControl(img);
        }
        swatch.onPointerClickObservable.add(() => applyOption(targetMesh, option));
        row.addControl(swatch);
      });

      card.linkWithMesh(mesh);
      card.linkOffsetYInPixels = -70;
      texture.addControl(card);
      popupControlRef.current = card;
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
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => !m.name.startsWith('swatch_marker_'));
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
    if (draftOptions.length >= MAX_OPTIONS) return;
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
      previewColor: preset.preview,
    }]);
  };

  const addTextureOption = async (file: File) => {
    if (draftOptions.length >= MAX_OPTIONS) return;
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
            <div className="text-xs text-gray-400">Choose up to {MAX_OPTIONS} options ({draftOptions.length}/{MAX_OPTIONS}):</div>

            {draftOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draftOptions.map((o) => (
                  <div key={o.id} className="relative">
                    <div
                      className="w-9 h-9 rounded-full border-2 border-slate-600 bg-cover bg-center flex items-center justify-center text-[9px] overflow-hidden"
                      style={o.kind === 'preset' ? { background: o.previewColor } : { backgroundImage: `url(${o.textureDataUrl})` }}
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

            {draftOptions.length < MAX_OPTIONS && (
              <>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">From existing material slots</div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {presets.map((preset) => {
                    const isTexture = preset.preview.startsWith('data:image');
                    return (
                      <button
                        key={preset.id}
                        onClick={() => addPresetOption(preset)}
                        className="w-7 h-7 rounded-full border border-slate-600 hover:border-cyan-400 transition-colors bg-cover bg-center"
                        style={isTexture ? { backgroundImage: `url(${preset.preview})` } : { background: preset.preview }}
                        title={preset.name}
                      />
                    );
                  })}
                </div>
                <label className="flex items-center justify-center gap-1.5 text-xs text-gray-300 border border-dashed border-slate-600 rounded py-1.5 cursor-pointer hover:border-cyan-500 transition-colors">
                  <Upload className="w-3 h-3" /> Upload a texture (real-world tile size)
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addTextureOption(f); e.target.value = ''; }} />
                </label>
              </>
            )}

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
                  <div key={o.id} className="w-7 h-7 rounded-full border border-slate-600 bg-cover bg-center" style={o.kind === 'preset' ? { background: o.previewColor } : { backgroundImage: `url(${o.textureDataUrl})` }} title={o.label} />
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
