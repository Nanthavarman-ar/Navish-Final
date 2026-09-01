import React, { useState, useEffect, useRef } from 'react';
import { X, Sun, Play, Pause, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import type { ScenarioManager, PresentationScenario } from './managers/ScenarioManager';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';

interface ScenarioTourPanelProps {
  scenarioManager: ScenarioManager | null;
  title?: string;
  autoStart?: boolean;
  onClose: () => void;
}

const TIME_ICONS: Record<string, string> = {
  dawn: '🌅', morning: '🌤️', noon: '☀️', afternoon: '🌇', evening: '🌆', night: '🌙', midnight: '🌑',
};

const ScenarioTourPanel: React.FC<ScenarioTourPanelProps> = ({ scenarioManager, title = 'Scenarios', autoStart = false, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  const [scenarios, setScenarios] = useState<PresentationScenario[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isTouring, setIsTouring] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!scenarioManager) return;
    setScenarios(scenarioManager.getAvailableScenarios());
    setCurrentId(scenarioManager.getCurrentScenario()?.id || null);
  }, [scenarioManager]);

  const applyScenario = async (id: string) => {
    if (!scenarioManager) return;
    setIsApplying(true);
    try {
      await scenarioManager.applyScenario(id);
      setCurrentId(id);
    } catch (error) {
      console.error('Failed to apply scenario:', error);
      showToast.error('Failed to apply scenario');
    } finally {
      setIsApplying(false);
    }
  };

  const stopTour = () => {
    setIsTouring(false);
    if (tourTimerRef.current) {
      clearTimeout(tourTimerRef.current);
      tourTimerRef.current = null;
    }
    // Restore the workspace's normal lighting instead of leaving it stuck on
    // whichever scenario the tour happened to be on when it stopped.
    // resetToOriginal also stops the auto-rotate started below.
    scenarioManager?.resetToOriginal();
    setCurrentId(null);
  };

  const startTour = () => {
    if (scenarios.length === 0) return;
    setIsTouring(true);
    // The tour previously only jumped between a handful of fixed lighting/camera
    // scenarios every 5s - that reads as static snapshots, not the continuously
    // orbiting showcase view "Presentation Mode" is expected to be. Auto-rotate runs
    // independently of the scenario cycle for the whole duration of the tour.
    scenarioManager?.startAutoRotate();
    let index = 0;
    const step = async () => {
      await applyScenario(scenarios[index].id);
      index = (index + 1) % scenarios.length;
      tourTimerRef.current = setTimeout(step, 5000); // 5s per scenario
    };
    step();
  };

  useEffect(() => {
    if (autoStart && scenarios.length > 0 && !isTouring) {
      startTour();
    }
    return () => stopTour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, scenarios.length]);

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" />
          <h3 className="font-display font-semibold">{title}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-gray-700 shrink-0">
        <Button size="sm" className="w-full" disabled={scenarios.length === 0} onClick={isTouring ? stopTour : startTour}>
          {isTouring ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
          {isTouring ? 'Stop Tour' : 'Play Tour'}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {scenarios.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">No scenarios available.</div>
        )}
        {scenarios.map((s) => (
          <button
            key={s.id}
            disabled={isApplying}
            onClick={() => applyScenario(s.id)}
            className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
              currentId === s.id
                ? 'bg-cyan-500/10 border-cyan-500/50'
                : 'bg-slate-800/50 border-slate-700/80 hover:border-cyan-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{TIME_ICONS[s.timeOfDay] || <Sparkles className="w-3.5 h-3.5" />}</span>
              <span className="text-sm font-medium text-gray-100">{s.name}</span>
              {currentId === s.id && <span className="ml-auto text-[10px] text-cyan-400 font-technical">ACTIVE</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScenarioTourPanel;
