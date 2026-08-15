import React from 'react';
import { Button } from './ui/button';

interface ScenarioPanelProps {
  sceneManager: any;
  onClose: () => void;
}

export const ScenarioPanel: React.FC<ScenarioPanelProps> = ({
  sceneManager,
  onClose
}) => {
  return (
    <div className="fixed top-4 left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
      <h3 className="text-white mb-2">Scenario Panel</h3>
      <p className="text-slate-300 text-sm">Scenario controls</p>
      <Button
        size="sm"
        variant="outline"
        onClick={onClose}
        className="mt-2"
      >
        Close
      </Button>
    </div>
  );
};

export default ScenarioPanel;
