import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { X, Volume2, VolumeX, Play, Pause, Music, Upload, MapPin, Trash2, Car, Bird, Tv, Waves } from 'lucide-react';
import { Button } from './ui/button';
import type { AudioManager } from './AudioManager';
import { usePanelStack } from '../hooks/usePanelStack';
import { loadSceneEdits, savePartialFeatureState, SavedAmbientZone } from './utils/sceneEditsPersistence';
import { showToast } from './utils/toast';

interface SpatialAudioPanelProps {
  audioManager: AudioManager | null;
  onClose: () => void;
  // Needed for ambience zones - scene to place/render markers in, modelId to persist
  // placed zones to (same per-model backend record floor plans/swatches/etc use), so
  // they follow the model to any device instead of only existing in this one browser tab.
  scene?: BABYLON.Scene;
  modelId?: string;
}

type ZonePreset = SavedAmbientZone['preset'];

const ZONE_PRESETS: { id: ZonePreset; label: string; icon: typeof Car; color: BABYLON.Color3; maxDistance: number }[] = [
  { id: 'traffic', label: 'Traffic', icon: Car, color: new BABYLON.Color3(0.95, 0.55, 0.15), maxDistance: 12 },
  { id: 'birds', label: 'Birds', icon: Bird, color: new BABYLON.Color3(0.3, 0.8, 0.4), maxDistance: 8 },
  { id: 'tv', label: 'TV', icon: Tv, color: new BABYLON.Color3(0.65, 0.4, 0.9), maxDistance: 6 },
  { id: 'fountain', label: 'Fountain', icon: Waves, color: new BABYLON.Color3(0.25, 0.65, 0.95), maxDistance: 7 },
];

// Lets whoever is viewing the workspace (admin or client) upload their own music/audio
// track and play it back with real volume/mute control (uses AudioManager.createAmbientSound,
// which was already fully built but never wired to any UI), and place real directional
// ambience zones (balcony traffic/birds, living room TV/fountain, etc) - each a genuine
// positioned 3D sound (AudioManager.addAmbientZone) that gets audibly louder/closer as the
// viewer approaches its marker, distinct per zone, rather than one flat background loop.
const SpatialAudioPanel: React.FC<SpatialAudioPanelProps> = ({ audioManager, onClose, scene, modelId }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-left');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const soundRef = useRef<BABYLON.Sound | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const volumeBeforeMuteRef = useRef(0.7);

  const cleanup = () => {
    soundRef.current?.stop();
    soundRef.current?.dispose();
    soundRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => cleanup, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioManager) return;

    cleanup();
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    const sound = audioManager.createAmbientSound(`user-track-${Date.now()}`, url, {
      volume,
      loop: true,
      autoplay: true,
    });
    soundRef.current = sound;
    setFileName(file.name);
    setIsPlaying(!!sound);
    setIsMuted(false);
    e.target.value = '';
  };

  const togglePlay = () => {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) {
      sound.pause();
    } else {
      sound.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    volumeBeforeMuteRef.current = v;
    if (isMuted) setIsMuted(false);
    soundRef.current?.setVolume(v);
  };

  const toggleMute = () => {
    const sound = soundRef.current;
    if (!sound) return;
    if (isMuted) {
      sound.setVolume(volumeBeforeMuteRef.current);
      setIsMuted(false);
    } else {
      volumeBeforeMuteRef.current = volume;
      sound.setVolume(0);
      setIsMuted(true);
    }
  };

  // --- Ambience zones ---
  const [zones, setZones] = useState<SavedAmbientZone[]>([]);
  const [placingPreset, setPlacingPreset] = useState<ZonePreset | null>(null);
  const markerMeshesRef = useRef<Map<string, BABYLON.Mesh>>(new Map());
  const appliedAudioIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    loadSceneEdits(modelId).then((data) => {
      if (cancelled) return;
      setZones(data?.features?.ambientZones || []);
    });
    return () => { cancelled = true; };
  }, [modelId]);

  const persistZones = useCallback((next: SavedAmbientZone[]) => {
    if (!modelId) return;
    savePartialFeatureState(modelId, { ambientZones: next }).then((saved) => {
      if (!saved) showToast.error('Could not save ambience zone', 'It will disappear on reload - try again');
    });
  }, [modelId]);

  // Keep the real audio graph in sync with the zone list - adds audio for any zone not
  // already playing, removes it for any zone no longer in the list (deleted). Doesn't
  // touch zones that are already applied, so an unrelated re-render can't restart (and
  // audibly glitch) a zone's noise loop that's already correctly playing.
  useEffect(() => {
    if (!audioManager) return;
    const currentIds = new Set(zones.map((z) => z.id));
    appliedAudioIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        audioManager.removeAmbientZone(id);
        appliedAudioIdsRef.current.delete(id);
      }
    });
    zones.forEach((zone) => {
      if (appliedAudioIdsRef.current.has(zone.id)) return;
      audioManager.addAmbientZone(
        zone.id,
        zone.preset,
        new BABYLON.Vector3(zone.position.x, zone.position.y, zone.position.z),
        { volume: zone.volume, maxDistance: zone.maxDistance }
      );
      appliedAudioIdsRef.current.add(zone.id);
    });
  }, [zones, audioManager]);

  // Render/sync marker meshes in the 3D scene, one small colored sphere per placed zone.
  useEffect(() => {
    if (!scene) return;
    const currentIds = new Set(zones.map((z) => z.id));
    markerMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        mesh.dispose(false, true);
        markerMeshesRef.current.delete(id);
      }
    });
    zones.forEach((zone) => {
      if (markerMeshesRef.current.has(zone.id)) return;
      const preset = ZONE_PRESETS.find((p) => p.id === zone.preset) ?? ZONE_PRESETS[0];
      const marker = BABYLON.MeshBuilder.CreateSphere(`ambient_zone_${zone.id}`, { diameter: 0.22 }, scene);
      marker.position = new BABYLON.Vector3(zone.position.x, zone.position.y + 0.1, zone.position.z);
      const mat = new BABYLON.StandardMaterial(`ambient_zone_mat_${zone.id}`, scene);
      mat.diffuseColor = preset.color;
      mat.emissiveColor = preset.color.scale(0.6);
      marker.material = mat;
      marker.renderingGroupId = 1;
      markerMeshesRef.current.set(zone.id, marker);
    });
  }, [zones, scene]);

  useEffect(() => {
    return () => {
      markerMeshesRef.current.forEach((mesh) => mesh.dispose(false, true));
      markerMeshesRef.current.clear();
    };
  }, []);

  // Click-to-place: arming "Place: Traffic" (etc) then clicking a spot on the model drops
  // a zone there immediately - no separate label/settings step, since the preset itself is
  // the description and every zone starts from that preset's own sensible defaults.
  useEffect(() => {
    if (!placingPreset || !scene) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => !m.name.startsWith('ambient_zone_'));
      if (!pickResult?.hit || !pickResult.pickedPoint) {
        showToast.info('Click directly on the model to place the zone');
        return;
      }
      const preset = ZONE_PRESETS.find((p) => p.id === placingPreset)!;
      const zone: SavedAmbientZone = {
        id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        preset: preset.id,
        label: preset.label,
        position: { x: pickResult.pickedPoint.x, y: pickResult.pickedPoint.y, z: pickResult.pickedPoint.z },
        volume: 0.4,
        maxDistance: preset.maxDistance,
      };
      setZones((prev) => {
        const next = [...prev, zone];
        persistZones(next);
        return next;
      });
      showToast.success(`${preset.label} zone placed`);
      setPlacingPreset(null);
    });
    return () => { scene.onPointerObservable.remove(observer); };
  }, [placingPreset, scene, persistZones]);

  const deleteZone = (id: string) => {
    setZones((prev) => {
      const next = prev.filter((z) => z.id !== id);
      persistZones(next);
      return next;
    });
  };

  const updateZoneVolume = (id: string, newVolume: number) => {
    setZones((prev) => {
      const next = prev.map((z) => (z.id === id ? { ...z, volume: newVolume } : z));
      persistZones(next);
      return next;
    });
    // Live-updates the volume of whatever's already playing, rather than waiting for the
    // add/remove diff effect (which only reacts to zones appearing/disappearing, not to
    // an existing one's own fields changing).
    audioManager?.removeAmbientZone(id);
    appliedAudioIdsRef.current.delete(id);
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-50 w-80 bg-slate-800 border border-slate-600 rounded-lg text-white shadow-xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm">Spatial Audio</h3>
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose} aria-label="Close Spatial Audio">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 space-y-3">
        {!audioManager && (
          <p className="text-xs text-amber-400">Audio system isn't ready yet - try again in a moment.</p>
        )}

        <label className="flex items-center justify-center gap-2 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded cursor-pointer text-sm transition-colors">
          <Upload className="w-3.5 h-3.5" />
          {fileName ? 'Change track' : 'Upload music/audio'}
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={!audioManager} />
        </label>

        {fileName && (
          <>
            <p className="text-xs text-slate-400 truncate" title={fileName}>Now playing: {fileName}</p>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={togglePlay} className="h-8 w-8 p-0">
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
              <Button size="sm" variant="outline" onClick={toggleMute} className="h-8 w-8 p-0">
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1 accent-cyan-500"
                aria-label="Volume"
              />
              <span className="text-xs text-slate-400 w-8 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-700 space-y-2">
        <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Ambience Zones
        </p>
        <p className="text-[11px] text-slate-500">
          Place a sound at a spot on the model - it gets louder as you walk toward it, e.g. traffic/birds near the balcony, TV/fountain in the living room.
        </p>

        {placingPreset ? (
          <div className="text-xs text-cyan-300 text-center py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded">
            Click a spot on the model to place the {ZONE_PRESETS.find((p) => p.id === placingPreset)?.label} zone...
            <button onClick={() => setPlacingPreset(null)} className="block mx-auto mt-1 text-slate-400 hover:text-white underline">Cancel</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {ZONE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                size="sm"
                variant="outline"
                className="text-xs justify-start"
                disabled={!audioManager || !scene || !modelId}
                onClick={() => setPlacingPreset(preset.id)}
              >
                <preset.icon className="w-3.5 h-3.5 mr-1.5" style={{ color: `rgb(${preset.color.r * 255}, ${preset.color.g * 255}, ${preset.color.b * 255})` }} />
                {preset.label}
              </Button>
            ))}
          </div>
        )}

        {zones.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {zones.map((zone) => {
              const preset = ZONE_PRESETS.find((p) => p.id === zone.preset) ?? ZONE_PRESETS[0];
              return (
                <div key={zone.id} className="flex items-center gap-2 p-1.5 bg-slate-700/50 border border-slate-600/60 rounded text-xs">
                  <preset.icon className="w-3.5 h-3.5 shrink-0" style={{ color: `rgb(${preset.color.r * 255}, ${preset.color.g * 255}, ${preset.color.b * 255})` }} />
                  <span className="flex-1 truncate">{zone.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    defaultValue={zone.volume}
                    onChange={(e) => updateZoneVolume(zone.id, parseFloat(e.target.value))}
                    className="w-16 accent-cyan-500"
                    aria-label={`${zone.label} volume`}
                  />
                  <button onClick={() => deleteZone(zone.id)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0" aria-label="Delete zone">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpatialAudioPanel;
