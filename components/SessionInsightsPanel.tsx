import React, { useEffect, useState } from 'react';
import { X, Activity } from 'lucide-react';
import type { AnalyticsManager } from './AnalyticsManager';

interface SessionInsightsPanelProps {
  analyticsManager: AnalyticsManager | null;
  onClose: () => void;
}

interface WorkspaceReport {
  featureUsage: [string, number][];
  totalWorkspaceEvents: number;
}

// AnalyticsManager was already instantiated live for every workspace session
// (BabylonWorkspace.tsx) but nothing ever called its trackFeatureUsage()/trackEvent()
// methods, so generateWorkspaceReport() always came back empty - a fully-built telemetry
// engine with no data and no UI. handleFeatureToggle now calls trackFeatureUsage() on every
// toggle, and this panel is the first real consumer of the report that produces.
const SessionInsightsPanel: React.FC<SessionInsightsPanelProps> = ({ analyticsManager, onClose }) => {
  const [report, setReport] = useState<WorkspaceReport | null>(null);

  // Polled, not subscribed - AnalyticsManager's event log is a plain mutated array, not
  // React state, same reasoning as MultiUserStatus/PresenceRoster elsewhere in this app.
  useEffect(() => {
    const poll = () => {
      if (!analyticsManager) return;
      setReport(analyticsManager.generateWorkspaceReport());
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [analyticsManager]);

  const topFeatures = report?.featureUsage.slice(0, 8) ?? [];
  const maxCount = topFeatures.length > 0 ? topFeatures[0][1] : 1;

  const formatLabel = (featureId: string) =>
    featureId.replace(/^show/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

  return (
    <div className="fixed top-20 left-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Session Insights</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {!analyticsManager ? (
          <p className="text-sm text-gray-400">Analytics isn't available for this session.</p>
        ) : topFeatures.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing tracked yet - use a few tools and check back.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400">Most-used tools this session</p>
            <ul className="space-y-2">
              {topFeatures.map(([featureId, count]) => (
                <li key={featureId} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-200 truncate">{formatLabel(featureId)}</span>
                    <span className="font-technical text-cyan-300 shrink-0 ml-2">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-500"
                      style={{ width: `${Math.max(6, (count / maxCount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 pt-1">{report?.totalWorkspaceEvents ?? 0} events tracked this session.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionInsightsPanel;
