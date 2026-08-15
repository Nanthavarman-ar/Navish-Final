import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { MoodSceneManager, MoodScene } from './managers/MoodSceneManager';
import { showToast } from './utils/toast';

interface MoodScenePanel2Props {
  moodSceneManager: MoodSceneManager | null;
  onClose: () => void;
}

const AMBIANCE_COLORS: Record<string, string> = {
  warm: 'text-amber-400', cool: 'text-cyan-400', neutral: 'text-gray-300', dramatic: 'text-purple-400',
};

const MoodScenePanel2: React.FC<MoodScenePanel2Props> = ({ moodSceneManager, onClose }) => {
  const [scenes, setScenes] = useState<MoodScene[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(1);

  useEffect(() => {
    if (!moodSceneManager) return;
    setScenes(moodSceneManager.getAllMoodScenes());
    setCurrentId(moodSceneManager.getCurrentScene()?.id || null);
  }, [moodSceneManager]);

  const applyScene = (id: string) => {
    if (!moodSceneManager) return;
    try {
      moodSceneManager.applyMoodScene(id);
      setCurrentId(id);
    } catch (error) {
      console.error('Failed to apply mood scene:', error);
      showToast.error('Failed to apply mood scene');
    }
  };

  const handleIntensity = (value: number) => {
    setIntensity(value);
    moodSceneManager?.setSceneIntensity(value);
  };

  return (
    <div className="fixed top-4 left-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="font-display font-semibold">Mood Scene</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {scenes.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-4">No mood scenes available.</div>
        )}
        {scenes.map((s) => (
          <button
            key={s.id}
            onClick={() => applyScene(s.id)}
            className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
              currentId === s.id ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/50 border-slate-700/80 hover:border-cyan-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-100">{s.name}</span>
              <span className={`text-[10px] font-technical uppercase ${AMBIANCE_COLORS[s.ambiance] || 'text-gray-400'}`}>{s.ambiance}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
          </button>
        ))}
      </div>

      {currentId && (
        <div className="p-3 border-t border-gray-700">
          <label className="text-xs text-gray-400 block mb-1">
            Intensity: <span className="font-technical text-cyan-300">{(intensity * 100).toFixed(0)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={intensity}
            onChange={(e) => handleIntensity(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default MoodScenePanel2;
