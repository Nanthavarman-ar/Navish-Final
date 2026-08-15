import React from 'react';
import { Button } from './ui/button';

interface MoodScenePanelProps {
  sceneManager: any;
  onClose: () => void;
}

export const MoodScenePanel: React.FC<MoodScenePanelProps> = ({
  sceneManager,
  onClose
}) => {
  return (
    <div className="fixed top-4 left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
      <h3 className="text-white mb-2">Mood Scene Panel</h3>
      <p className="text-slate-300 text-sm">Mood scene controls</p>
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

export default MoodScenePanel;
