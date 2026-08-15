import React, { useMemo } from 'react';
import { X, LayoutGrid, TrendingUp } from 'lucide-react';
import type { CostEstimator } from './CostEstimator';
import type { SustainabilityManager } from './SustainabilityManager';

interface BudgetTierPanelProps {
  costEstimator: CostEstimator | null;
  sustainabilityManager: SustainabilityManager | null;
  modelId: string;
  onClose: () => void;
}

interface Tier {
  label: string;
  multiplier: number;
  color: string;
  sustainabilityDelta: number; // relative shift from the model's actual computed green score
}

// Multipliers applied to the REAL computed material cost for this model (not a fully
// separate fake number) - materials are the line item that most directly scales with
// quality tier; labor/overhead/disposal stay roughly constant across tiers.
const TIERS: Tier[] = [
  { label: 'Budget', multiplier: 0.65, color: 'text-green-400', sustainabilityDelta: -15 },
  { label: 'Standard', multiplier: 1.0, color: 'text-cyan-400', sustainabilityDelta: 0 },
  { label: 'Premium', multiplier: 1.55, color: 'text-purple-400', sustainabilityDelta: 12 },
];

const BudgetTierPanel: React.FC<BudgetTierPanelProps> = ({ costEstimator, sustainabilityManager, modelId, onClose }) => {
  const baseCost = useMemo(() => {
    if (!costEstimator) return null;
    try {
      return costEstimator.calculateProjectCost(modelId);
    } catch {
      return null;
    }
  }, [costEstimator, modelId]);

  const baseGreenScore = useMemo(() => {
    if (!sustainabilityManager) return null;
    try {
      return sustainabilityManager.generateReport(modelId)?.greenScore ?? null;
    } catch {
      return null;
    }
  }, [sustainabilityManager, modelId]);

  const rows = useMemo(() => {
    if (!baseCost) return [];
    return TIERS.map((tier) => {
      const materials = baseCost.materials * tier.multiplier;
      const total = materials + baseCost.labor + baseCost.overhead + baseCost.disposal;
      const greenScore = baseGreenScore !== null
        ? Math.max(0, Math.min(100, baseGreenScore + tier.sustainabilityDelta))
        : null;
      return { ...tier, materials, total, greenScore };
    });
  }, [baseCost, baseGreenScore]);

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[28rem] max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Budget Tier Comparison</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {!baseCost ? (
          <p className="text-sm text-gray-400 text-center py-6">Load a model first to compare budget tiers.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {rows.map((row) => (
              <div key={row.label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/80 flex flex-col items-center text-center">
                <span className={`text-xs font-technical uppercase font-semibold ${row.color}`}>{row.label}</span>
                <span className="text-lg font-technical text-gray-100 mt-2">{formatCurrency(row.total)}</span>
                <span className="text-[10px] text-gray-500 mt-0.5">total est.</span>

                <div className="w-full border-t border-slate-700 my-2" />

                <span className="text-[10px] text-gray-400">Materials</span>
                <span className="text-xs font-technical text-gray-300">{formatCurrency(row.materials)}</span>

                {row.greenScore !== null && (
                  <>
                    <div className="w-full border-t border-slate-700 my-2" />
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <TrendingUp className="w-2.5 h-2.5" /> Green Score
                    </span>
                    <span className={`text-xs font-technical ${row.greenScore >= 60 ? 'text-green-400' : row.greenScore >= 35 ? 'text-amber-400' : 'text-red-400'}`}>
                      {row.greenScore.toFixed(0)}/100
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-500 mt-3 text-center">
          Based on this project's actual computed material, labor, and overhead costs.
        </p>
      </div>
    </div>
  );
};

export default BudgetTierPanel;
