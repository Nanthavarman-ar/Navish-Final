import React, { useState, useMemo } from 'react';
import { X, Ruler, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { BIMManager, BIMElement } from './BIMManager';

interface ErgonomicPanelProps {
  bimManager: BIMManager | null;
  modelId: string;
  onClose: () => void;
}

interface Finding {
  elementId: string;
  elementName: string;
  elementType: string;
  issue: string;
  measured: string;
  guideline: string;
  severity: 'warning' | 'error';
}

// Standard architectural ergonomic guidelines (meters), based on common building codes
// (ADA / IBC-style clearances) - not tied to any single jurisdiction, but representative
// of widely-used accessibility and usability minimums.
const GUIDELINES = {
  doorWidthMin: 0.813,      // 32 in - accessible clearance
  doorHeightMin: 2.032,     // 80 in - standard head clearance
  counterHeightMin: 0.71,   // 28 in
  counterHeightMax: 0.915,  // 36 in
  reachZoneMax: 1.22,       // 48 in - highest comfortable reach (ADA forward reach)
  ceilingHeightMin: 2.13,   // 7 ft - minimum habitable ceiling height
};

function analyzeElement(el: BIMElement): Finding[] {
  const findings: Finding[] = [];
  const p = el.properties || {};

  if (el.type === 'door') {
    if (p.width !== undefined && p.width < GUIDELINES.doorWidthMin) {
      findings.push({
        elementId: el.id, elementName: el.name, elementType: el.type,
        issue: 'Door width below accessible clearance',
        measured: `${(p.width * 100).toFixed(0)}cm`,
        guideline: `min ${(GUIDELINES.doorWidthMin * 100).toFixed(0)}cm`,
        severity: 'error',
      });
    }
    if (p.height !== undefined && p.height < GUIDELINES.doorHeightMin) {
      findings.push({
        elementId: el.id, elementName: el.name, elementType: el.type,
        issue: 'Door height below standard head clearance',
        measured: `${(p.height * 100).toFixed(0)}cm`,
        guideline: `min ${(GUIDELINES.doorHeightMin * 100).toFixed(0)}cm`,
        severity: 'warning',
      });
    }
  }

  if (el.type === 'fixture' && p.height !== undefined) {
    if (p.height < GUIDELINES.counterHeightMin || p.height > GUIDELINES.counterHeightMax) {
      findings.push({
        elementId: el.id, elementName: el.name, elementType: el.type,
        issue: 'Fixture height outside comfortable counter range',
        measured: `${(p.height * 100).toFixed(0)}cm`,
        guideline: `${(GUIDELINES.counterHeightMin * 100).toFixed(0)}-${(GUIDELINES.counterHeightMax * 100).toFixed(0)}cm`,
        severity: 'warning',
      });
    }
    if (p.height > GUIDELINES.reachZoneMax) {
      findings.push({
        elementId: el.id, elementName: el.name, elementType: el.type,
        issue: 'Fixture placed above comfortable reach zone',
        measured: `${(p.height * 100).toFixed(0)}cm`,
        guideline: `max ${(GUIDELINES.reachZoneMax * 100).toFixed(0)}cm reach`,
        severity: 'warning',
      });
    }
  }

  if (el.type === 'ceiling' && p.height !== undefined && p.height < GUIDELINES.ceilingHeightMin) {
    findings.push({
      elementId: el.id, elementName: el.name, elementType: el.type,
      issue: 'Ceiling height below minimum habitable clearance',
      measured: `${(p.height * 100).toFixed(0)}cm`,
      guideline: `min ${(GUIDELINES.ceilingHeightMin * 100).toFixed(0)}cm`,
      severity: 'error',
    });
  }

  return findings;
}

const ErgonomicPanel: React.FC<ErgonomicPanelProps> = ({ bimManager, modelId, onClose }) => {
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const model = useMemo(() => bimManager?.getModelById(modelId) || null, [bimManager, modelId]);

  const findings = useMemo(() => {
    if (!model) return [];
    return model.elements.flatMap(analyzeElement);
  }, [model]);

  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const analyzedCount = model?.elements.length ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Ergonomic Analysis</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto">
        {!model ? (
          <p className="text-sm text-gray-400">Load a model first to run an ergonomic analysis.</p>
        ) : (
          <>
            <button
              onClick={() => setHasAnalyzed(true)}
              className="w-full text-sm bg-cyan-600 hover:bg-cyan-500 rounded px-3 py-2 transition-colors"
            >
              Analyze {analyzedCount} element{analyzedCount !== 1 ? 's' : ''}
            </button>

            {hasAnalyzed && (
              <>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                  <span className="text-gray-400">Result</span>
                  {findings.length === 0 ? (
                    <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> No issues found</span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {errorCount} error{errorCount !== 1 ? 's' : ''}, {warningCount} warning{warningCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {findings.length > 0 && (
                  <div className="space-y-2">
                    {findings.map((f, i) => (
                      <div key={i} className={`p-2.5 rounded-lg border text-xs ${
                        f.severity === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'
                      }`}>
                        <div className="font-medium text-gray-100">{f.elementName} <span className="text-gray-500 font-technical">({f.elementType})</span></div>
                        <div className="text-gray-300 mt-0.5">{f.issue}</div>
                        <div className="font-technical text-gray-400 mt-1">
                          Measured: {f.measured} · Guideline: {f.guideline}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ErgonomicPanel;
