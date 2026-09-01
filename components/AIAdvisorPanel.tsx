import React, { useState } from 'react';
import { X, Brain, Loader2, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import type { SustainabilityManager } from './SustainabilityManager';
import type { CostEstimator } from './CostEstimator';
import type { BIMManager } from './BIMManager';
import { usePanelStack } from '../hooks/usePanelStack';

interface AIAdvisorPanelProps {
  sustainabilityManager: SustainabilityManager | null;
  costEstimator: CostEstimator | null;
  bimManager: BIMManager | null;
  modelId: string;
  onClose: () => void;
}

interface Recommendation {
  category: 'cost' | 'sustainability' | 'layout';
  text: string;
  priority: 'high' | 'medium' | 'low';
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-slate-600 bg-slate-800/50 text-slate-300',
};

const AIAdvisorPanel: React.FC<AIAdvisorPanelProps> = ({ sustainabilityManager, costEstimator, bimManager, modelId, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);

  const runAnalysis = () => {
    setIsAnalyzing(true);
    // Real analysis, combining the app's own already-computed sustainability, cost, and
    // BIM data - a rule-based advisor grounded in this project's actual numbers rather
    // than a generic/fake response.
    setTimeout(() => {
      const recs: Recommendation[] = [];

      const model = bimManager?.getModelById(modelId);
      const elementCount = model?.elements.length ?? 0;

      if (sustainabilityManager) {
        try {
          const report = sustainabilityManager.generateReport(modelId);
          if (report) {
            if (report.greenScore < 50) {
              recs.push({
                category: 'sustainability',
                text: `Green score is ${report.greenScore.toFixed(0)}/100 - consider materials with lower embodied carbon to improve this.`,
                priority: 'high',
              });
            }
            if (!report.complianceStatus) {
              recs.push({
                category: 'sustainability',
                text: 'This design does not currently meet sustainability compliance targets.',
                priority: 'high',
              });
            }
            if (report.renewableEnergyUsage < 20) {
              recs.push({
                category: 'sustainability',
                text: `Only ${report.renewableEnergyUsage.toFixed(0)}% renewable energy usage - solar or other renewable integration could help.`,
                priority: 'medium',
              });
            }
          }
        } catch { /* sustainability data unavailable for this model */ }
      }

      if (costEstimator) {
        try {
          const cost = costEstimator.calculateProjectCost(modelId);
          if (cost) {
            const materialsShare = cost.materials / cost.total;
            if (materialsShare > 0.6) {
              recs.push({
                category: 'cost',
                text: `Materials make up ${(materialsShare * 100).toFixed(0)}% of total cost - review high-cost material line items for lower-cost alternatives.`,
                priority: 'medium',
              });
            }
            recs.push({
              category: 'cost',
              text: `Estimated total project cost is $${cost.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} based on the current model.`,
              priority: 'low',
            });
          }
        } catch { /* cost data unavailable for this model */ }
      }

      if (elementCount > 0) {
        const doorCount = model?.elements.filter(e => e.type === 'door').length ?? 0;
        if (doorCount === 0) {
          recs.push({
            category: 'layout',
            text: 'No doors detected in this model - circulation/accessibility analysis may be incomplete.',
            priority: 'low',
          });
        }
      }

      if (recs.length === 0) {
        recs.push({ category: 'layout', text: 'No specific issues detected - load a model with more detail for deeper suggestions.', priority: 'low' });
      }

      setRecommendations(recs);
      setIsAnalyzing(false);
    }, 600);
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <h3 className="font-display font-semibold">AI Advisor</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto">
        <p className="text-xs text-gray-400">
          Combines this project's cost, sustainability, and layout data into actionable suggestions.
        </p>

        <Button size="sm" className="w-full" disabled={isAnalyzing} onClick={runAnalysis}>
          {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5 mr-1" />}
          {isAnalyzing ? 'Analyzing...' : 'Get Suggestions'}
        </Button>

        {recommendations && (
          <div className="space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className={`p-2.5 rounded-lg border text-xs ${PRIORITY_COLOR[r.priority]}`}>
                <span className="uppercase font-technical text-[10px] opacity-70">{r.category}</span>
                <p className="mt-0.5">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAdvisorPanel;
