import React, { useState, useMemo } from 'react';
import { X, BarChart3, TrendingUp } from 'lucide-react';
import type { CostEstimator, CostBreakdown } from './CostEstimator';
import { usePanelStack } from '../hooks/usePanelStack';

interface ROICalculatorPanelProps {
  costEstimator: CostEstimator | null;
  modelId: string;
  onClose: () => void;
}

const ROICalculatorPanel: React.FC<ROICalculatorPanelProps> = ({ costEstimator, modelId, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [annualReturn, setAnnualReturn] = useState(0);
  const [horizonYears, setHorizonYears] = useState(10);

  const costBreakdown: CostBreakdown | null = useMemo(() => {
    if (!costEstimator) return null;
    try {
      return costEstimator.calculateProjectCost(modelId);
    } catch (error) {
      console.error('Failed to calculate project cost:', error);
      return null;
    }
  }, [costEstimator, modelId]);

  const totalCost = costBreakdown?.total ?? 0;

  const { roiPercent, paybackYears, cumulativeAtHorizon } = useMemo(() => {
    if (totalCost <= 0 || annualReturn <= 0) {
      return { roiPercent: null, paybackYears: null, cumulativeAtHorizon: null };
    }
    const totalReturnAtHorizon = annualReturn * horizonYears;
    return {
      roiPercent: ((totalReturnAtHorizon - totalCost) / totalCost) * 100,
      paybackYears: totalCost / annualReturn,
      cumulativeAtHorizon: totalReturnAtHorizon - totalCost,
    };
  }, [totalCost, annualReturn, horizonYears]);

  const formatCurrency = (value: number) =>
    value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div ref={panelRef} style={panelStyle} className="fixed right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">ROI Calculator</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {!costBreakdown ? (
          <p className="text-sm text-gray-400">Load a model first to estimate its project cost.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Project Cost</span>
              <span className="font-technical text-gray-100">{formatCurrency(totalCost)}</span>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Expected annual return / savings</label>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={annualReturn || ''}
                  onChange={(e) => setAnnualReturn(Math.max(0, Number(e.target.value)))}
                  placeholder="e.g. rent increase, energy savings"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Time horizon: <span className="font-technical text-cyan-300">{horizonYears} years</span>
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={horizonYears}
                onChange={(e) => setHorizonYears(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {roiPercent !== null && paybackYears !== null && cumulativeAtHorizon !== null ? (
              <div className="pt-2 border-t border-slate-700 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> ROI over {horizonYears}yr</span>
                  <span className={`font-technical font-semibold ${roiPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Payback period</span>
                  <span className="font-technical text-gray-100">{paybackYears.toFixed(1)} years</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Net gain at {horizonYears}yr</span>
                  <span className={`font-technical ${cumulativeAtHorizon >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(cumulativeAtHorizon)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 pt-1">Enter an expected annual return to see ROI and payback period.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ROICalculatorPanel;
