import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, AbstractMesh, MeshBuilder, StandardMaterial, PBRMaterial, DynamicTexture, Texture, Color3, Vector3, PointerEventTypes } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, StackPanel, Image as GuiImage } from '@babylonjs/gui';
import { X, Palette, Trash2, Plus, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';
import type { MaterialManager } from './MaterialManager';
import type { MaterialPreset } from './interfaces/MaterialInterfaces';

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

interface SwatchOption {
  id: string;
  label: string;
  kind: 'preset' | 'texture';
  presetId?: string; // kind === 'preset' - reuses one of MaterialManager's existing slots
  previewColor?: string; // kind === 'preset', copied from the preset for the swatch button
  textureDataUrl?: string; // kind === 'texture'
  // Real-world size of ONE texture tile, in cm - what makes the applied result tile at
  // its correct physical scale instead of stretching once across however big the target
  // mesh happens to be (see applyTextureOption's comment below).
  tileWidthCm?: number;
  tileHeightCm?: number;
}

interface SwatchMarker {
  id: string;
  // Best-available stable-ish identifier for "the same mesh" across a reload of the same
  // model file (Babylon's own mesh.uniqueId is re-assigned fresh every load, so it can't
  // be used for persistence) - falls back to name-matching if the id doesn't resolve,
  // see resolveMeshRef below. A source model with duplicate node ids/names for different
  // meshes isn't distinguishable this way; that's a real but accepted limitation of using
  // the file's own node identifiers rather than requiring a custom BIM id scheme.
  meshId: string;
  meshName: string;
  position: { x: number; y: number; z: number };
  options: SwatchOption[];
}

const MAX_OPTIONS = 4;

function storageKey(roomId: string): string {
  return `naviz:materialSwatches:${roomId}`;
}

function loadMarkers(roomId: string): SwatchMarker[] {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMarkers(roomId: string, markers: SwatchMarker[]): void {
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(markers));
  } catch {
    // Quota exceeded (data-URL textures can be large) or storage unavailable - swatches
    // still work for the rest of this session, they just won't survive a reload. Not
    // worth blocking the feature over what's a nice-to-have persistence layer.
  }
}

function resolveMeshRef(scene: Scene, meshId: string, meshName: string): AbstractMesh | null {
  return scene.getMeshById(meshId) || scene.meshes.find((m) => m.name === meshName) || null;
}

const MeshMaterialSwatches: React.FC<MeshMaterialSwatchesProps> = ({ scene, materialManager, roomId, onClose, visible = true }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-right');
  const [markers, setMarkers] = useState<SwatchMarker[]>(() => loadMarkers(roomId));
  const [isPlacing, setIsPlacing] = useState(false);
  const [draftMarker, setDraftMarker] = useState<{ meshId: string; meshName: string; position: Vector3 } | null>(null);
  const [draftOptions, setDraftOptions] = useState<SwatchOption[]>([]);
  const [expandedMarkerId, setExpandedMarkerId] = useState<string | null>(null);
  const markerMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const guiTextureRef = useRef<AdvancedDynamicTexture | null>(null);
  const popupControlRef = useRef<Rectangle | null>(null);
  const presets = materialManager.getMaterialPresets();

  useEffect(() => {
    setMarkers(loadMarkers(roomId));
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
    });
    return () => { scene.onPointerObservable.remove(observer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlacing, scene, markers, applyOption, closeSwatchPopup]);

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

  const addPresetOption = (preset: MaterialPreset) => {
    if (draftOptions.length >= MAX_OPTIONS) return;
    setDraftOptions((prev) => [...prev, {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: preset.name,
      kind: 'preset',
      presetId: preset.id,
      previewColor: preset.preview,
    }]);
  };

  const addTextureOption = (file: File) => {
    if (draftOptions.length >= MAX_OPTIONS) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraftOptions((prev) => [...prev, {
        id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: file.name.replace(/\.[^.]+$/, ''),
        kind: 'texture',
        textureDataUrl: reader.result as string,
        tileWidthCm: 30,
        tileHeightCm: 30,
      }]);
    };
    reader.readAsDataURL(file);
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
    setMarkers((prev) => {
      const next = [...prev, marker];
      saveMarkers(roomId, next);
      return next;
    });
    showToast.success('Material swatch marker added');
    setDraftMarker(null);
    setDraftOptions([]);
  };

  const handleDeleteMarker = (id: string) => {
    setMarkers((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveMarkers(roomId, next);
      return next;
    });
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
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => addPresetOption(preset)}
                      className="w-7 h-7 rounded-full border border-slate-600 hover:border-cyan-400 transition-colors"
                      style={{ background: preset.preview }}
                      title={preset.name}
                    />
                  ))}
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
        {markers.length === 0 && (
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
