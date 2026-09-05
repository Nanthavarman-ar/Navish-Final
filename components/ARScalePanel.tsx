import React, { useCallback, useEffect, useState } from 'react';
import { Scene, AbstractMesh, Vector3 } from '@babylonjs/core';
import { X, Maximize2, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from './ui/button';
import type { XRManager } from './XRManager';
import { usePanelStack } from '../hooks/usePanelStack';

interface ARScalePanelProps {
  scene: Scene;
  onClose: () => void;
  // Optional: when a real AR session has a model actively placed, this panel drives
  // that live placement's scale instead of the desktop scene.meshes fallback below -
  // see the note on hasActivePlacement() in XRManager.ts for why that fallback used to
  // silently do nothing once in an AR session.
  xrManagerRef?: React.RefObject<XRManager | null>;
}

// Meshes that shouldn't be scaled along with the model (helper/tool geometry)
const EXCLUDED_NAME_PATTERN = /^(ground|floor|measure_|preview_|measurement_|annotation_|cursor_|__root__)/i;

const ARScalePanel: React.FC<ARScalePanelProps> = ({ scene, onClose, xrManagerRef }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-left');
  const [scale, setScale] = useState(1);
  const [liveARActive, setLiveARActive] = useState(false);
  const [autoRotating, setAutoRotating] = useState(false);

  // Poll rather than subscribe - XRManager's placement lifecycle (tap to place, exit
  // session) isn't observable-based, and this is cheap/low-frequency enough not to matter.
  useEffect(() => {
    const check = () => {
      const active = !!xrManagerRef?.current?.hasActivePlacement();
      setLiveARActive(active);
      if (active) {
        setScale(xrManagerRef!.current!.getPlacementScale());
        setAutoRotating(xrManagerRef!.current!.isAutoRotating());
      } else {
        setAutoRotating(false);
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [xrManagerRef]);

  const toggleAutoRotate = () => {
    if (!xrManagerRef?.current) return;
    setAutoRotating(xrManagerRef.current.toggleAutoRotate());
  };

  const getScalableMeshes = useCallback((): AbstractMesh[] => {
    return scene.meshes.filter((m) => m.name && !EXCLUDED_NAME_PATTERN.test(m.name) && !m.parent);
  }, [scene]);

  const applyScale = useCallback((newScale: number) => {
    setScale(newScale);
    if (liveARActive) {
      xrManagerRef!.current!.setPlacedModelScale(newScale);
      return;
    }
    getScalableMeshes().forEach((mesh) => {
      mesh.scaling.setAll(newScale);
    });
  }, [getScalableMeshes, liveARActive, xrManagerRef]);

  const handleReset = () => applyScale(1);

  // A real house model is typically several metres across - a flat 10% (the old
  // "Tabletop" behavior) only actually fits on a table for something already small
  // (a single room); anything bigger just ends up smaller-but-still-room-sized. This
  // measures the model's real footprint and computes whatever scale actually gets it
  // down to TABLETOP_TARGET_METERS, the same "Dollhouse Mode" idea for any model size.
  const TABLETOP_TARGET_METERS = 0.5;

  const applyTabletopFit = useCallback(() => {
    if (liveARActive && xrManagerRef?.current) {
      const restSize = xrManagerRef.current.getPlacedModelRestSize();
      const footprint = restSize ? Math.max(restSize.x, restSize.z) : 0;
      applyScale(footprint > 0 ? Math.max(0.01, Math.min(1, TABLETOP_TARGET_METERS / footprint)) : 0.1);
      return;
    }
    const meshes = getScalableMeshes().filter((m) => m.getTotalVertices() > 0);
    if (meshes.length === 0) {
      applyScale(0.1);
      return;
    }
    let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
    meshes.forEach((m) => {
      const bb = m.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bb.minimumWorld);
      max = Vector3.Maximize(max, bb.maximumWorld);
    });
    const worldSize = max.subtract(min);
    const restFootprint = Math.max(worldSize.x, worldSize.z) / (scale || 1);
    applyScale(restFootprint > 0 ? Math.max(0.01, Math.min(1, TABLETOP_TARGET_METERS / restFootprint)) : 0.1);
  }, [liveARActive, xrManagerRef, getScalableMeshes, scale, applyScale]);

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">AR Scale</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {liveARActive ? (
          <p className="text-xs text-cyan-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Live - controlling the model placed in your active AR session.
          </p>
        ) : (
          <p className="text-xs text-gray-400">
            Desktop preview only - this resizes the model here, not a live AR session.
            Enter AR and tap to place the model to control its real-world size instead.
          </p>
        )}

        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Scale: <span className="font-technical text-cyan-300">{(scale * 100).toFixed(0)}%</span>
          </label>
          <input
            type="range"
            min={0.01}
            max={2}
            step={0.01}
            value={scale}
            onChange={(e) => applyScale(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" onClick={applyTabletopFit} title="Shrinks the whole model to fit on a real table, whatever its actual size">Tabletop</Button>
          <Button size="sm" variant="outline" onClick={() => applyScale(0.5)}>Half</Button>
          <Button size="sm" variant="outline" onClick={() => applyScale(1)}>Life-size</Button>
        </div>

        <Button size="sm" variant="ghost" className="w-full" onClick={handleReset}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to 100%
        </Button>

        {liveARActive && (
          <Button
            size="sm"
            variant={autoRotating ? 'default' : 'outline'}
            className="w-full"
            onClick={toggleAutoRotate}
            title="Turns the placed model slowly so you can see every side without walking around it"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1" /> {autoRotating ? 'Stop turning' : 'Turn 360°'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ARScalePanel;
