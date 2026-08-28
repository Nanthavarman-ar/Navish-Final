import React, { useState } from 'react';
import { X, Sparkles, RotateCcw } from 'lucide-react';
import type { PresentationManager } from './PresentationManager';

interface MoodLightingPanelProps {
  presentationManager: PresentationManager | null;
  onClose: () => void;
}

// Only the 4 built-in lighting presets are exposed here - PresentationManager.ts also has
// a "Comparative Tours" implementation (a crude mesh-visibility hack expecting bespoke
// left/right scene data no caller in this app produces) and a "Seasonal Decor" one (points
// at /textures/particles/*.png and /models/furniture/*.glb assets that don't exist in
// public/) - both would render as visibly broken/no-op if wired up, so they're left alone.
// Mood lighting is the one piece of the "MISSING FEATURES" section that's fully
// self-contained (procedural Babylon lights/colors only, no external assets) and safe to
// expose as-is.
const PRESETS: Array<{ id: string; label: string; description: string }> = [
  { id: 'romantic', label: 'Romantic', description: 'Warm spot + point lights, soft bloom' },
  { id: 'energetic', label: 'Energetic', description: 'Bright directional light, vibrant tone' },
  { id: 'calm', label: 'Calm', description: 'Soft hemispheric fill, cool tone' },
  { id: 'dramatic', label: 'Dramatic', description: 'Low ambient, hard spot + directional' },
];

const MoodLightingPanel: React.FC<MoodLightingPanelProps> = ({ presentationManager, onClose }) => {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (presetId: string) => {
    if (!presentationManager) return;
    // createMoodScene() then activateMoodScene() is the class's only public entry point
    // for applying a preset - re-creating the same id each time just overwrites the
    // previous entry, which is harmless (see PresentationManager.ts:1122-1131).
    presentationManager.createMoodScene(presetId, [presetId], false);
    presentationManager.activateMoodScene(presetId);
    setActivePreset(presetId);
  };

  const reset = () => {
    presentationManager?.resetToOriginal();
    setActivePreset(null);
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Mood Lighting</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {!presentationManager ? (
          <p className="text-sm text-gray-400">Not available for this session.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  title={preset.description}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    activePreset === preset.id
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200'
                      : 'bg-slate-800 border-slate-600 text-gray-200 hover:border-cyan-500/50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={!activePreset}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset lighting
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MoodLightingPanel;
