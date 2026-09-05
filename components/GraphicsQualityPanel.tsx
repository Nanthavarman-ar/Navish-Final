import React from 'react';

export type QualityLevel = 'auto' | 'low' | 'medium' | 'high' | 'ultra';

interface GraphicsQualityPanelProps {
  value: QualityLevel;
  onChange: (value: QualityLevel) => void;
  recommended: 'low' | 'medium' | 'high' | 'ultra';
  gpuName?: string;
  capabilities?: { mobile?: boolean; cpuCores?: number; ram?: number } | null;
  // Real screen-space reflections - independent of the tier list above. ssrEnabled always
  // reflects the LIVE state (whatever the tier default or a previous override resolved to),
  // not just "did the user touch this toggle" - so it stays accurate if the frame-rate
  // watchdog in BabylonWorkspace.tsx turns this off on its own. onSsrToggle sends an
  // explicit choice that wins over the tier default from then on.
  ssrEnabled?: boolean;
  onSsrToggle?: (enabled: boolean) => void;
}

const OPTIONS: { id: QualityLevel; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Matches this device automatically' },
  { id: 'low', label: 'Low', description: 'Fastest - no SSAO/contact shadows, lighter shadows & bloom off' },
  { id: 'medium', label: 'Medium', description: 'Balanced - bloom on, softer shadows, no SSAO' },
  { id: 'high', label: 'High', description: 'Contact shadows (SSAO), sharp textures, crisp shadows' },
  { id: 'ultra', label: 'Ultra', description: 'Turns reflections on by default - needs a capable GPU (see the Reflections toggle below to try it on any tier)' },
];

// Enscape/Lumion/D5-style realism is easy to dial in on a strong desktop GPU but will
// visibly lag on weaker laptops/phones/headsets - this panel is the user-facing control
// for that tradeoff (previously the app only auto-detected a quality tier with no way to
// see or override it; see the reactive effect in BabylonWorkspace.tsx keyed on
// graphicsQuality/recommendedQuality that actually applies these levels).
const GraphicsQualityPanel: React.FC<GraphicsQualityPanelProps> = ({ value, onChange, recommended, gpuName, capabilities, ssrEnabled, onSsrToggle }) => {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-400">
        Controls how close the viewport gets to an Enscape/Lumion/D5-style render. Higher
        settings look better but cost more GPU - drop a level if the scene feels laggy.
      </p>
      <div className="space-y-1.5">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.id;
          const isRecommendedChoice = opt.id === recommended && value !== opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={isActive}
              className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                isActive
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{opt.label}</span>
                {opt.id === 'auto' && (
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    recommends {recommended}
                  </span>
                )}
                {isRecommendedChoice && (
                  <span className="text-[10px] uppercase tracking-wide text-emerald-400 whitespace-nowrap">recommended</span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
            </button>
          );
        })}
      </div>
      {onSsrToggle && (
        <div className="pt-3 border-t border-slate-700">
          <button
            type="button"
            onClick={() => onSsrToggle(!ssrEnabled)}
            aria-pressed={!!ssrEnabled}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md border transition-colors ${
              ssrEnabled ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="font-medium">Reflections (SSR)</span>
            <span className={`text-xs px-2 py-0.5 rounded ${ssrEnabled ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {ssrEnabled ? 'On' : 'Off'}
            </span>
          </button>
          <p className="text-xs text-slate-400 mt-1.5">
            Adds real reflections on glossy/wet surfaces, on any tier - not just Ultra. May
            cost frame rate on this device; it'll turn itself back off automatically if the
            frame rate drops too much.
          </p>
        </div>
      )}
      {(gpuName || capabilities) && (
        <div className="pt-2 border-t border-slate-700 text-[11px] text-slate-500 space-y-0.5">
          {gpuName && <div>GPU: {gpuName}</div>}
          {capabilities && (
            <div>
              {capabilities.mobile ? 'Mobile device' : 'Desktop device'}
              {typeof capabilities.cpuCores === 'number' ? ` · ${capabilities.cpuCores} cores` : ''}
              {typeof capabilities.ram === 'number' ? ` · ${Math.round(capabilities.ram / 1024)}GB RAM` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphicsQualityPanel;
