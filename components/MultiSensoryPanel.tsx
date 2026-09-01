import React, { useState, useEffect } from 'react';
import { X, Sparkles, Volume2, Sun } from 'lucide-react';
import type { MoodSceneManager, MoodScene } from './managers/MoodSceneManager';
import type { AudioManager } from './AudioManager';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';

interface MultiSensoryPanelProps {
  moodSceneManager: MoodSceneManager | null;
  audioManager: AudioManager | null;
  onClose: () => void;
}

// Combines the visual mood scene system with spatial audio into a single "preview
// experience" toggle, rather than requiring the user to open two separate panels.
const MultiSensoryPanel: React.FC<MultiSensoryPanelProps> = ({ moodSceneManager, audioManager, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  const [scenes, setScenes] = useState<MoodScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [audioOn, setAudioOn] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!moodSceneManager) return;
    setScenes(moodSceneManager.getAllMoodScenes());
  }, [moodSceneManager]);

  const startExperience = () => {
    if (selectedSceneId && moodSceneManager) {
      try {
        moodSceneManager.applyMoodScene(selectedSceneId);
      } catch (error) {
        console.error('Failed to apply mood scene:', error);
      }
    }
    if (audioOn && audioManager) {
      audioManager.enableSpatialAudio();
    }
    setIsActive(true);
    showToast.success('Multi-sensory preview started');
  };

  const stopExperience = () => {
    moodSceneManager?.stopCurrentScene();
    audioManager?.disableSpatialAudio();
    setIsActive(false);
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="font-display font-semibold">Multi-Sensory Preview</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
            <Sun className="w-3 h-3" /> Visual mood
          </label>
          <select
            value={selectedSceneId || ''}
            onChange={(e) => setSelectedSceneId(e.target.value || null)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">None</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={audioOn} onChange={(e) => setAudioOn(e.target.checked)} className="accent-cyan-500" />
          <Volume2 className="w-3.5 h-3.5" /> Spatial audio
        </label>

        <button
          onClick={isActive ? stopExperience : startExperience}
          className={`w-full text-sm rounded px-3 py-2 transition-colors ${
            isActive ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'
          }`}
        >
          {isActive ? 'Stop Preview' : 'Start Preview'}
        </button>
      </div>
    </div>
  );
};

export default MultiSensoryPanel;
