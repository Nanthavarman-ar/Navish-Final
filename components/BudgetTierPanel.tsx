import React, { useMemo, useState } from 'react';
import { X, LayoutGrid, TrendingUp, Pencil } from 'lucide-react';
import type { CostEstimator } from './CostEstimator';
import type { SustainabilityManager } from './SustainabilityManager';
import { USD_TO_INR } from './utils/currency';

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

interface TierRow {
  label: string;
  color: string;
  materials: number; // INR
  total: number; // INR
  greenScore: number | null;
}

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

  // Computed rows, in INR - the underlying CostEstimator database is USD-denominated,
  // converted here once for display/editing since this panel is INR throughout.
  const computedRows: TierRow[] = useMemo(() => {
    if (!baseCost) return [];
    return TIERS.map((tier) => {
      const materials = baseCost.materials * tier.multiplier * USD_TO_INR;
      const total = (baseCost.materials * tier.multiplier + baseCost.labor + baseCost.overhead + baseCost.disposal) * USD_TO_INR;
      const greenScore = baseGreenScore !== null
        ? Math.max(0, Math.min(100, baseGreenScore + tier.sustainabilityDelta))
        : null;
      return { label: tier.label, color: tier.color, materials, total, greenScore };
    });
  }, [baseCost, baseGreenScore]);

  // A user-saved edit for a tier wins over the computed figures - kept separate from
  // computedRows so a model/sustainability recalculation doesn't silently wipe out
  // what was manually entered, the same pattern as the Cost Estimator panel's overrides.
  const [savedOverrides, setSavedOverrides] = useState<Record<string, { materials: number; total: number }>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, { materials: number; total: number }> | null>(null);

  const rows: TierRow[] = computedRows.map((row) => {
    const override = savedOverrides[row.label];
    return override ? { ...row, materials: override.materials, total: override.total } : row;
  });

  const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const startEditing = () => {
    const initial: Record<string, { materials: number; total: number }> = {};
    rows.forEach((row) => { initial[row.label] = { materials: row.materials, total: row.total }; });
    setDraft(initial);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setDraft(null);
  };

  const saveEditing = () => {
    if (!draft) return;
    setSavedOverrides(draft);
    setIsEditing(false);
    setDraft(null);
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[28rem] max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Budget Tier Comparison</h3>
        </div>
        <div className="flex items-center gap-3">
          {baseCost && !isEditing && (
            <button onClick={startEditing} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs" aria-label="Edit tier values">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {!baseCost ? (
          <p className="text-sm text-gray-400 text-center py-6">Load a model first to compare budget tiers.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {rows.map((row) => (
              <div key={row.label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/80 flex flex-col items-center text-center">
                <span className={`text-xs font-technical uppercase font-semibold ${row.color}`}>{row.label}</span>

                {isEditing && draft ? (
                  <input
                    type="number"
                    min={0}
                    value={draft[row.label].total}
                    onChange={(e) => setDraft(prev => prev && { ...prev, [row.label]: { ...prev[row.label], total: Number(e.target.value) } })}
                    className="w-full mt-2 bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-sm text-center text-gray-100 focus:outline-none focus:border-cyan-500"
                    title={`${row.label} total`}
                  />
                ) : (
                  <span className="text-lg font-technical text-gray-100 mt-2">{formatCurrency(row.total)}</span>
                )}
                <span className="text-[10px] text-gray-500 mt-0.5">total est.</span>

                <div className="w-full border-t border-slate-700 my-2" />

                <span className="text-[10px] text-gray-400">Materials</span>
                {isEditing && draft ? (
                  <input
                    type="number"
                    min={0}
                    value={draft[row.label].materials}
                    onChange={(e) => setDraft(prev => prev && { ...prev, [row.label]: { ...prev[row.label], materials: Number(e.target.value) } })}
                    className="w-full mt-1 bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-xs text-center text-gray-100 focus:outline-none focus:border-cyan-500"
                    title={`${row.label} materials`}
                  />
                ) : (
                  <span className="text-xs font-technical text-gray-300">{formatCurrency(row.materials)}</span>
                )}

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
        {isEditing && (
          <div className="flex items-center justify-end gap-2 mt-3">
            <button onClick={cancelEditing} className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors">Cancel</button>
            <button onClick={saveEditing} className="text-xs px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 transition-colors">Save</button>
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
