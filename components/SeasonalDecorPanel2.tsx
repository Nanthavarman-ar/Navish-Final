import React, { useState, useEffect } from 'react';
import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { X, Leaf, Power } from 'lucide-react';
import type { SeasonalDecorManager } from './managers/SeasonalDecorManager';
import { showToast } from './utils/toast';
import type { Scene } from '@babylonjs/core';

interface SeasonalDecorPanel2Props {
  seasonalDecorManager: SeasonalDecorManager | null;
  scene?: Scene | null;
  onClose: () => void;
}

const SEASON_ICONS: Record<string, string> = {
  spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️',
};

const SeasonalDecorPanel2: React.FC<SeasonalDecorPanel2Props> = ({ seasonalDecorManager, scene, onClose }) => {
  const [decorations, setDecorations] = useState<Array<{ id: string; name: string; season: string }>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonalDecorManager) return;
    setDecorations(seasonalDecorManager.getAllDecorations());
    setActiveId(seasonalDecorManager.getActiveDecoration());
  }, [seasonalDecorManager]);

  const activate = (id: string) => {
    if (!seasonalDecorManager) return;
    try {
      seasonalDecorManager.activateDecoration(id);
      setActiveId(id);

      // Move the camera to actually look toward where the decoration was placed, so
      // activating it is never invisible just because it landed outside the current view.
      const camera = scene?.activeCamera;
      if (camera instanceof ArcRotateCamera) {
        camera.setTarget(new Vector3(1, 1, 1));
        if (camera.radius < 8) camera.radius = 12;
      }

      const tier = decorations.find((d) => d.id === id);
      showToast.success(`${tier?.name || 'Decoration'} placed`, 'Look around the scene to see it');
    } catch (error) {
      console.error('Failed to activate decoration:', error);
      showToast.error('Failed to apply seasonal decor');
    }
  };

  const clear = () => {
    seasonalDecorManager?.deactivateCurrentDecoration();
    setActiveId(null);
  };

  return (
    <div className="fixed top-4 right-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-400" />
          <h3 className="font-display font-semibold">Seasonal Decor</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {decorations.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-4">No seasonal decorations available.</div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {decorations.map((d) => (
            <button
              key={d.id}
              onClick={() => activate(d.id)}
              className={`p-3 rounded-lg border text-center transition-colors ${
                activeId === d.id ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/50 border-slate-700/80 hover:border-cyan-500/30'
              }`}
            >
              <div className="text-2xl mb-1">{SEASON_ICONS[d.season] || '🎨'}</div>
              <div className="text-xs text-gray-200">{d.name}</div>
            </button>
          ))}
        </div>

        {activeId && (
          <button
            onClick={clear}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors py-2"
          >
            <Power className="w-3.5 h-3.5" /> Clear decoration
          </button>
        )}
      </div>
    </div>
  );
};

export default SeasonalDecorPanel2;
