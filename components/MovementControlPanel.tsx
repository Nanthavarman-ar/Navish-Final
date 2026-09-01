import React, { useState, useEffect, useRef } from 'react';
import { Scene, Camera, Ray, Vector3 } from '@babylonjs/core';
import { X, Move3d, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePanelStack } from '../hooks/usePanelStack';

interface MovementControlPanelProps {
  scene: Scene;
  camera: Camera;
  onClose: () => void;
}

interface DirectionCheck {
  label: string;
  distance: number | null; // null = nothing hit within range
}

const CHECK_DIRECTIONS: Array<{ label: string; vector: Vector3 }> = [
  { label: 'Forward', vector: new Vector3(0, 0, 1) },
  { label: 'Back', vector: new Vector3(0, 0, -1) },
  { label: 'Left', vector: new Vector3(-1, 0, 0) },
  { label: 'Right', vector: new Vector3(1, 0, 0) },
];

const SAFE_DISTANCE = 0.4; // meters - comfortable clearance before flagging "too close"
const CHECK_RANGE = 3; // how far to raycast when looking for obstacles

const MovementControlPanel: React.FC<MovementControlPanelProps> = ({ scene, camera, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  const [checks, setChecks] = useState<DirectionCheck[]>([]);
  const [isLive, setIsLive] = useState(true);
  const observerRef = useRef<any>(null);

  useEffect(() => {
    const runCheck = () => {
      const origin = camera.position.clone();
      const results = CHECK_DIRECTIONS.map(({ label, vector }) => {
        const ray = new Ray(origin, vector, CHECK_RANGE);
        const hit = scene.pickWithRay(ray, (mesh) => mesh.isPickable && mesh.name !== 'ground' && !mesh.name.startsWith('cursor_'));
        return { label, distance: hit?.hit ? (hit.distance ?? null) : null };
      });
      setChecks(results);
    };

    runCheck();
    if (isLive) {
      observerRef.current = scene.onBeforeRenderObservable.add(runCheck);
    }
    return () => {
      if (observerRef.current) {
        scene.onBeforeRenderObservable.remove(observerRef.current);
        observerRef.current = null;
      }
    };
  }, [scene, camera, isLive]);

  const anyTooClose = checks.some((c) => c.distance !== null && c.distance < SAFE_DISTANCE);

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-40 w-64 bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Move3d className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold text-sm">Movement Check</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Live tracking</span>
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`px-2 py-0.5 rounded text-[10px] font-technical ${isLive ? 'bg-cyan-600' : 'bg-slate-700'}`}
          >
            {isLive ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="space-y-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5">
              <span className="text-gray-300">{c.label}</span>
              {c.distance === null ? (
                <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Clear</span>
              ) : c.distance < SAFE_DISTANCE ? (
                <span className="text-red-400 flex items-center gap-1 font-technical">
                  <AlertTriangle className="w-3 h-3" /> {c.distance.toFixed(2)}m
                </span>
              ) : (
                <span className="text-amber-300 font-technical">{c.distance.toFixed(2)}m</span>
              )}
            </div>
          ))}
        </div>

        {anyTooClose && (
          <p className="text-[10px] text-red-400 pt-1">Camera is close to an obstacle in at least one direction.</p>
        )}
      </div>
    </div>
  );
};

export default MovementControlPanel;
