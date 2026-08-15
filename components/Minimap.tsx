import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GeoWorkspaceArea } from './types';

interface MinimapProps {
  scene: BABYLON.Scene;
  camera: BABYLON.Camera;
  workspaces?: GeoWorkspaceArea[];
  selectedWorkspaceId?: string;
  onWorkspaceSelect?: (workspaceId: string) => void;
  onCameraMove?: (position: BABYLON.Vector3) => void;
}

const Minimap: React.FC<MinimapProps> = ({
  scene,
  camera,
  workspaces = [],
  selectedWorkspaceId,
  onWorkspaceSelect,
  onCameraMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [objects, setObjects] = useState<any[]>([]);
  const [sceneBounds, setSceneBounds] = useState({
    min: new BABYLON.Vector3(-50, -50, -50),
    max: new BABYLON.Vector3(50, 50, 50)
  });
  // Teleporter: saved named locations for direct jump
  interface SavedLocation {
    id: string;
    name: string;
    position: BABYLON.Vector3;
  }
  const STORAGE_KEY = 'naviz-saved-locations';
  const loadFromStorage = (): SavedLocation[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as { id: string; name: string; position: { x: number; y: number; z: number } }[];
      return arr.map(({ id, name, position }) => ({
        id,
        name,
        position: new BABYLON.Vector3(position.x, position.y, position.z)
      }));
    } catch {
      return [];
    }
  };
  const saveToStorage = (locs: SavedLocation[]) => {
    try {
      const arr = locs.map(l => ({
        id: l.id,
        name: l.name,
        position: { x: l.position.x, y: l.position.y, z: l.position.z }
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch { /* ignore */ }
  };

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(() => loadFromStorage());
  const [locationName, setLocationName] = useState('');

  useEffect(() => {
    saveToStorage(savedLocations);
  }, [savedLocations]);

  // Save current camera position with a name
  const saveLocation = () => {
    const name = locationName.trim() || `Location ${savedLocations.length + 1}`;
    const id = `loc-${Date.now()}`;
    setSavedLocations(prev => [...prev, {
      id,
      name,
      position: camera.position.clone()
    }]);
    setLocationName('');
  };

  // Teleport directly to a saved location
  const teleportTo = (loc: SavedLocation) => {
    camera.position.copyFrom(loc.position);
    if (onCameraMove) onCameraMove(loc.position);
  };

  // Remove a saved location
  const removeLocation = (id: string) => {
    setSavedLocations(prev => prev.filter(l => l.id !== id));
  };

  // Meshes actually worth showing on the minimap - excludes the ground plane,
  // internal root node, and transient tool helpers (measurement/preview gizmos).
  const getRelevantMeshes = (s: BABYLON.Scene) =>
    s.meshes.filter((m) => m.name && m.name !== '__root__' && m.name !== 'ground' && m.isVisible && !/^(measure_|preview_|measurement_)/i.test(m.name));

  // Real bounds from the actual loaded content, falling back to a small
  // default box when the scene is empty so the map doesn't divide by zero.
  const computeBounds = (meshes: BABYLON.AbstractMesh[]) => {
    if (meshes.length === 0) {
      return { min: new BABYLON.Vector3(-10, -10, -10), max: new BABYLON.Vector3(10, 10, 10) };
    }
    const min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    const max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
    meshes.forEach((m) => {
      const info = m.getBoundingInfo?.();
      if (!info) return;
      min.minimizeInPlace(info.boundingBox.minimumWorld);
      max.maximizeInPlace(info.boundingBox.maximumWorld);
    });
    return { min, max };
  };

  // Keep the "Objects" count and "Bounds" readout in sync with what's
  // actually in the scene - these were previously stuck at their initial
  // values (0 objects, -50..50) forever, since nothing ever updated them.
  useEffect(() => {
    if (!scene) return;
    const sync = () => {
      const meshes = getRelevantMeshes(scene);
      setObjects(meshes.map((m) => ({ id: m.uniqueId, type: 'mesh' })));
      setSceneBounds(computeBounds(meshes));
    };
    sync();
    const interval = setInterval(sync, 1000);
    return () => clearInterval(interval);
  }, [scene]);

  // Draw minimap (camera, meshes, lights)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene || !camera) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const bounds = sceneBounds;
      const w = Math.max(bounds.max.x - bounds.min.x, 1);
      const h = Math.max(bounds.max.z - bounds.min.z, 1);
      const pad = 10;
      const scale = Math.min((canvas.width - pad * 2) / w, (canvas.height - pad * 2) / h) * zoom;
      const ox = pad + (canvas.width - pad * 2 - w * scale) / 2;
      const oy = pad + (canvas.height - pad * 2 - h * scale) / 2;

      const toScreen = (x: number, z: number) => ({
        x: ox + (x - bounds.min.x) * scale,
        y: oy + (z - bounds.min.z) * scale
      });

      // Draw each mesh's footprint (its XZ bounding rectangle) so the minimap
      // reads as an actual top-down floor plan of the loaded model instead of
      // a scatter of unrelated dots.
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      getRelevantMeshes(scene).forEach((m) => {
        const boundingInfo = m.getBoundingInfo?.();
        if (!boundingInfo) return;
        const min = boundingInfo.boundingBox.minimumWorld;
        const max = boundingInfo.boundingBox.maximumWorld;
        const topLeft = toScreen(min.x, min.z);
        const bottomRight = toScreen(max.x, max.z);
        const rectX = Math.min(topLeft.x, bottomRight.x);
        const rectY = Math.min(topLeft.y, bottomRight.y);
        const rectW = Math.abs(bottomRight.x - topLeft.x);
        const rectH = Math.abs(bottomRight.y - topLeft.y);
        if (rectW < 1 && rectH < 1) {
          // Degenerate/point-like mesh - still show it as a small marker.
          ctx.beginPath();
          ctx.arc(rectX, rectY, 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
      });

      // Draw lights
      scene.lights.forEach((l) => {
        if (l instanceof BABYLON.ShadowLight) {
          const p = toScreen(l.position.x, l.position.z);
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw camera
      const camP = toScreen(camera.position.x, camera.position.z);
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(camP.x, camP.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    draw();
    const interval = setInterval(draw, 100);
    return () => clearInterval(interval);
  }, [scene, camera, sceneBounds, zoom]);

  // Canvas click handler
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // The canvas's actual displayed size (rect) can differ from its intrinsic pixel
    // dimensions (canvas.width/height) - e.g. Tailwind's base styles apply
    // `max-width: 100%` to canvas elements, which visually shrinks it to fit a
    // narrower container without changing its drawing-space dimensions. Convert the
    // click position into intrinsic canvas space first, so it lines up with the same
    // coordinate space the map is actually drawn in.
    const scaleToIntrinsicX = canvas.width / rect.width;
    const scaleToIntrinsicY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleToIntrinsicX;
    const y = (event.clientY - rect.top) * scaleToIntrinsicY;
    const boundsWidth = sceneBounds.max.x - sceneBounds.min.x;
    const boundsHeight = sceneBounds.max.z - sceneBounds.min.z;
    const scaleX = (canvas.width - 20) / boundsWidth;
    const scaleZ = (canvas.height - 20) / boundsHeight;
    const scale = Math.min(scaleX, scaleZ) * zoom;
    const offsetX = (canvas.width - boundsWidth * scale) / 2;
    const offsetY = (canvas.height - boundsHeight * scale) / 2;
    const worldX = sceneBounds.min.x + (x - offsetX) / scale;
    const worldZ = sceneBounds.min.z + (y - offsetY) / scale;

    const newPosition = new BABYLON.Vector3(worldX, camera.position.y, worldZ);

    // Check if click is inside any workspace bounds
    for (const workspace of workspaces) {
      const b = workspace.bounds;
      if (b && worldX >= b.minLng && worldX <= b.maxLng && worldZ >= b.minLat && worldZ <= b.maxLat) {
        onWorkspaceSelect?.(workspace.id);
        return;
      }
    }

    // If no workspace selected, move camera
    if (onCameraMove) {
      onCameraMove(newPosition);
    }
  };

  return (
    <div className="minimap-container">
      <div className="minimap-header">
        <h3 className="minimap-title">Minimap</h3>
        <div className="minimap-controls">
          <button className="minimap-button" onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} title="Zoom Out">-</button>
          <span className="minimap-button">{Math.round(zoom * 100)}%</span>
          <button className="minimap-button" onClick={() => setZoom(Math.min(3, zoom + 0.2))} title="Zoom In">+</button>
          <button className={`minimap-button ${isVisible ? 'minimap-button-hide' : 'minimap-button-show'}`} onClick={() => setIsVisible(!isVisible)}>
            {isVisible ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {isVisible && (
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={200}
            height={200}
            onClick={handleCanvasClick}
            style={{
              border: '1px solid #475569',
              borderRadius: '4px',
              cursor: 'crosshair',
              background: '#0f172a'
            }}
            title="Click to move camera"
          />

          {/* Legend */}
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '4px',
            borderRadius: '4px',
            fontSize: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }}></div>
              <span>Camera</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
              <span>Objects</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%' }}></div>
              <span>Lights</span>
            </div>
          </div>
        </div>
      )}

      {/* Status info */}
      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <div>Objects: {objects.filter(obj => obj.type !== 'camera').length}</div>
        <div>Bounds: {sceneBounds.min.x.toFixed(1)} to {sceneBounds.max.x.toFixed(1)}</div>
      </div>

      {/* Teleporter - Save named locations and jump directly */}
      <div style={{
        marginTop: '16px',
        padding: '8px',
        background: '#0f172a',
        borderRadius: '6px',
        color: '#f1f5f9'
      }}>
        <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Teleporter</h4>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={locationName}
            onChange={e => setLocationName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveLocation()}
            style={{ background: '#18181b', color: '#fff', borderRadius: '4px', border: '1px solid #334155', fontSize: '12px', padding: '4px 8px', width: '120px' }}
            placeholder="Kitchen, Dining, Bedroom..."
          />
          <button
            type="button"
            className="minimap-button"
            onClick={saveLocation}
            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            Save Location
          </button>
        </div>
        <div>
          <span style={{ fontSize: '12px' }}>Saved: {savedLocations.length}</span>
          <ul style={{ maxHeight: '120px', overflowY: 'auto', margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
            {savedLocations.map((loc) => (
              <li key={loc.id} style={{
                background: '#1e293b',
                color: '#f1f5f9',
                padding: '6px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ fontWeight: 500, flex: 1 }}>{loc.name}</span>
                <button
                  type="button"
                  style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', borderRadius: '4px', border: 'none', padding: '4px 10px', cursor: 'pointer' }}
                  onClick={() => teleportTo(loc)}
                >
                  Teleport
                </button>
                <button
                  type="button"
                  style={{ fontSize: '11px', background: '#64748b', color: '#fff', borderRadius: '4px', border: 'none', padding: '4px 8px', cursor: 'pointer' }}
                  onClick={() => removeLocation(loc.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Minimap;
