import React, { useState } from 'react';
import { X, ScanEye, Flag, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import type { PHashIntegration } from './PHashIntegration';

interface PerceptualHashPanelProps {
  pHashIntegration: PHashIntegration | null;
  onClose: () => void;
}

interface AnalysisResult {
  hasSignificantChanges: boolean;
  similarity: number | null;
  recommendations: string[];
}

const PerceptualHashPanel: React.FC<PerceptualHashPanelProps> = ({ pHashIntegration, onClose }) => {
  const [hasBaseline, setHasBaseline] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleSetBaseline = async () => {
    if (!pHashIntegration) return;
    setIsBusy(true);
    try {
      await pHashIntegration.initializeSceneUnderstanding();
      setHasBaseline(true);
      setResult(null);
    } catch (error) {
      console.error('Failed to set baseline:', error);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAnalyze = async () => {
    if (!pHashIntegration) return;
    setIsBusy(true);
    try {
      const analysis = await pHashIntegration.analyzeSceneChanges();
      setResult({
        hasSignificantChanges: analysis.hasSignificantChanges,
        similarity: analysis.changeDetails?.similarity ?? null,
        recommendations: analysis.recommendations,
      });
    } catch (error) {
      console.error('Failed to analyze scene changes:', error);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <ScanEye className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Scene Change Detection</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400">
          Snapshot the current view as a baseline, then check later how much the scene has visually changed since then.
        </p>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={isBusy || !pHashIntegration} onClick={handleSetBaseline}>
            <Flag className="w-3.5 h-3.5 mr-1" /> {hasBaseline ? 'Reset Baseline' : 'Set Baseline'}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" disabled={isBusy || !pHashIntegration || !hasBaseline} onClick={handleAnalyze}>
            {isBusy ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ScanEye className="w-3.5 h-3.5 mr-1" />}
            Analyze
          </Button>
        </div>

        {!hasBaseline && (
          <p className="text-xs text-gray-500 text-center pt-1">Set a baseline first, then analyze after making changes.</p>
        )}

        {result && (
          <div className="pt-2 border-t border-slate-700 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Status</span>
              <span className={result.hasSignificantChanges ? 'text-amber-400' : 'text-green-400'}>
                {result.hasSignificantChanges ? 'Changed' : 'Stable'}
              </span>
            </div>
            {result.similarity !== null && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Similarity to baseline</span>
                <span className="font-technical text-gray-200">{(result.similarity * 100).toFixed(1)}%</span>
              </div>
            )}
            {result.recommendations.length > 0 && (
              <ul className="list-disc list-inside text-gray-300 text-xs space-y-1 pt-1">
                {result.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PerceptualHashPanel;
