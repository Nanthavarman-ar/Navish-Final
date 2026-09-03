import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Vector3, PointerEventTypes, ArcRotateCamera, Animation } from '@babylonjs/core';
import { X, Navigation, Trash2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';

interface HotspotNavigationProps {
  scene: Scene;
  roomId: string;
  onClose: () => void;
  // Mirrors AnnotationTool's own `visible` prop (see its comment on the same prop): the
  // hotspot marker meshes stay live in the 3D scene and stay clickable regardless of
  // whether this management panel itself is open - closing the panel should only hide
  // the list/add-hotspot UI, not remove the room-to-room navigation viewers rely on.
  visible?: boolean;
}

interface CameraPose {
  alpha: number;
  beta: number;
  radius: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

interface Hotspot {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  pose: CameraPose;
}

function storageKey(roomId: string): string {
  return `naviz:hotspots:${roomId}`;
}

function loadHotspots(roomId: string): Hotspot[] {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHotspots(roomId: string, hotspots: Hotspot[]): void {
  try {
    localStorage.setItem(storageKey(roomId), JSON.stringify(hotspots));
  } catch {
    // Storage full/unavailable (private browsing, quota) - hotspots still work for the
    // rest of this session, they just won't survive a reload. Not worth surfacing as an
    // error for what's a nice-to-have persistence layer.
  }
}

const HotspotNavigation: React.FC<HotspotNavigationProps> = ({ scene, roomId, onClose, visible = true }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [hotspots, setHotspots] = useState<Hotspot[]>(() => loadHotspots(roomId));
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingSpot, setPendingSpot] = useState<{ position: Vector3; pose: CameraPose } | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const markerMeshesRef = useRef<Map<string, Mesh>>(new Map());

  // Reload from storage whenever the loaded model changes (roomId), same as AnnotationTool
  // scoping notes to the model rather than the page.
  useEffect(() => {
    setHotspots(loadHotspots(roomId));
  }, [roomId]);

  // Render/sync diamond marker meshes in the 3D scene whenever the hotspot list changes.
  useEffect(() => {
    const currentIds = new Set(hotspots.map((h) => h.id));

    markerMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        mesh.dispose();
        markerMeshesRef.current.delete(id);
      }
    });

    hotspots.forEach((hotspot) => {
      if (markerMeshesRef.current.has(hotspot.id)) return;
      const marker = MeshBuilder.CreatePlane(`hotspot_marker_${hotspot.id}`, { size: 0.42 }, scene);
      marker.position = new Vector3(hotspot.position.x, hotspot.position.y + 0.05, hotspot.position.z);
      marker.billboardMode = Mesh.BILLBOARDMODE_ALL;
      marker.renderingGroupId = 1;

      // A rounded diamond, matching the room-to-room jump icons in Matterport-style tours -
      // distinct from AnnotationTool's note-card pins so the two marker types read as
      // different things at a glance (jump-here vs read-this).
      const texture = new DynamicTexture(`hotspot_tex_${hotspot.id}`, { width: 128, height: 128 }, scene, true);
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
      // Simple arrow glyph inside the diamond pointing "onward" - readable at small sizes
      // without needing a real icon font baked into a canvas texture.
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(48, 64);
      ctx.lineTo(80, 64);
      ctx.moveTo(68, 50);
      ctx.lineTo(84, 64);
      ctx.lineTo(68, 78);
      ctx.closePath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      texture.update();

      const mat = new StandardMaterial(`hotspot_mat_${hotspot.id}`, scene);
      mat.diffuseTexture = texture;
      mat.useAlphaFromDiffuseTexture = true;
      mat.emissiveColor = new Color3(1, 1, 1);
      mat.backFaceCulling = false;
      marker.material = mat;
      markerMeshesRef.current.set(hotspot.id, marker);
    });
  }, [hotspots, scene]);

  useEffect(() => {
    return () => {
      markerMeshesRef.current.forEach((mesh) => mesh.dispose());
      markerMeshesRef.current.clear();
    };
  }, []);

  // Click-to-place: captures both where the marker should sit (the picked point on the
  // model) and the CURRENT camera framing (alpha/beta/radius/target) as the "arrival
  // view" a viewer lands on when they click this hotspot later - the same mechanism a
  // real Matterport-style tour uses (an editor stands where/how they want the next view
  // to look, then drops the marker), captured in one click rather than a separate pose-
  // editing step.
  useEffect(() => {
    if (!isPlacing) return;

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => !m.name.startsWith('hotspot_marker_'));
      if (!pickResult?.hit || !pickResult.pickedPoint) {
        showToast.info('Click directly on the model to place a hotspot');
        return;
      }
      const camera = scene.activeCamera;
      if (!(camera instanceof ArcRotateCamera)) {
        showToast.error('Switch to Orbit view to place hotspots', 'Hotspots need an orbit camera to save a jump-to view');
        setIsPlacing(false);
        return;
      }
      setPendingSpot({
        position: pickResult.pickedPoint.clone(),
        pose: {
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
          targetX: camera.target.x,
          targetY: camera.target.y,
          targetZ: camera.target.z,
        },
      });
      setIsPlacing(false);
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [isPlacing, scene]);

  // Click a marker (outside placing mode) to jump the camera there.
  useEffect(() => {
    if (isPlacing) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      if (!mesh?.name.startsWith('hotspot_marker_')) return;
      const id = mesh.name.slice('hotspot_marker_'.length);
      const hotspot = hotspots.find((h) => h.id === id);
      if (hotspot) jumpToHotspot(hotspot);
    });
    return () => { scene.onPointerObservable.remove(observer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlacing, scene, hotspots]);

  const jumpToHotspot = useCallback((hotspot: Hotspot) => {
    const camera = scene.activeCamera;
    if (!(camera instanceof ArcRotateCamera)) {
      showToast.error('Switch to Orbit view to use hotspots');
      return;
    }
    const FRAMES = 30, FPS = 30; // ~1s smooth transition into the next viewpoint
    Animation.CreateAndStartAnimation('hotspotAlpha', camera, 'alpha', FPS, FRAMES, camera.alpha, hotspot.pose.alpha, Animation.ANIMATIONLOOPMODE_CONSTANT);
    Animation.CreateAndStartAnimation('hotspotBeta', camera, 'beta', FPS, FRAMES, camera.beta, hotspot.pose.beta, Animation.ANIMATIONLOOPMODE_CONSTANT);
    Animation.CreateAndStartAnimation('hotspotRadius', camera, 'radius', FPS, FRAMES, camera.radius, hotspot.pose.radius, Animation.ANIMATIONLOOPMODE_CONSTANT);
    Animation.CreateAndStartAnimation(
      'hotspotTarget', camera, 'target', FPS, FRAMES,
      camera.target.clone(),
      new Vector3(hotspot.pose.targetX, hotspot.pose.targetY, hotspot.pose.targetZ),
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    showToast.info(hotspot.label);
  }, [scene]);

  const handleSaveHotspot = () => {
    if (!pendingSpot || !draftLabel.trim()) return;
    const hotspot: Hotspot = {
      id: `hs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: draftLabel.trim(),
      position: { x: pendingSpot.position.x, y: pendingSpot.position.y, z: pendingSpot.position.z },
      pose: pendingSpot.pose,
    };
    setHotspots((prev) => {
      const next = [...prev, hotspot];
      saveHotspots(roomId, next);
      return next;
    });
    showToast.success('Hotspot added');
    setPendingSpot(null);
    setDraftLabel('');
  };

  const handleDelete = (id: string) => {
    setHotspots((prev) => {
      const next = prev.filter((h) => h.id !== id);
      saveHotspots(roomId, next);
      return next;
    });
  };

  return (
    <div ref={panelRef} style={panelStyle} className={`fixed right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex-col max-h-[70vh] ${visible ? 'flex' : 'hidden'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Hotspot Navigation</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close hotspot navigation">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-gray-700 shrink-0">
        {!isPlacing && !pendingSpot && (
          <Button size="sm" className="w-full" onClick={() => setIsPlacing(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add hotspot
          </Button>
        )}
        {isPlacing && (
          <div className="text-xs text-cyan-300 text-center py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded">
            Frame the view you want people to land on, then click a spot on the model...
          </div>
        )}
        {pendingSpot && (
          <div className="space-y-2">
            <input
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. Living Room, Kitchen..."
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={!draftLabel.trim()} onClick={handleSaveHotspot}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setPendingSpot(null); setDraftLabel(''); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {hotspots.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">
            No hotspots yet. Click "Add hotspot" and pick a spot on the model.
          </div>
        )}
        {hotspots.map((h) => (
          <div key={h.id} className="p-2.5 bg-slate-800/50 border border-slate-700/80 rounded-lg group">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => jumpToHotspot(h)} className="text-left flex-1 text-sm text-gray-100 hover:text-cyan-300 transition-colors">
                {h.label}
              </button>
              <button
                onClick={() => handleDelete(h.id)}
                className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                aria-label="Delete hotspot"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HotspotNavigation;
