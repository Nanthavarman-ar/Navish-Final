import React, { useMemo } from 'react';
import { StandardMaterial, PBRMaterial, Color3 } from '@babylonjs/core';
import { X, Sparkles } from 'lucide-react';
import { showToast } from './utils/toast';

interface SmartAlternativesPanelProps {
  selectedMesh: any;
  onClose: () => void;
}

interface Alternative {
  label: string;
  tier: 'budget' | 'standard' | 'premium';
  color: Color3;
  metallic: number;
  roughness: number;
}

// Real, applyable alternatives derived from the currently selected mesh's material,
// spanning a budget/standard/premium range so there's a genuine choice to make -
// rather than a fixed generic swatch list unrelated to what's actually selected.
function buildAlternatives(baseColor: Color3): Alternative[] {
  const lighten = (c: Color3, amt: number) => new Color3(
    Math.min(1, c.r + amt), Math.min(1, c.g + amt), Math.min(1, c.b + amt)
  );
  const darken = (c: Color3, amt: number) => new Color3(
    Math.max(0, c.r - amt), Math.max(0, c.g - amt), Math.max(0, c.b - amt)
  );

  return [
    { label: 'Budget Matte', tier: 'budget', color: lighten(baseColor, 0.1), metallic: 0, roughness: 0.9 },
    { label: 'Standard Satin', tier: 'standard', color: baseColor, metallic: 0.2, roughness: 0.5 },
    { label: 'Premium Polished', tier: 'premium', color: darken(baseColor, 0.05), metallic: 0.6, roughness: 0.15 },
  ];
}

const TIER_LABEL: Record<string, string> = {
  budget: 'text-green-400', standard: 'text-cyan-400', premium: 'text-purple-400',
};

const SmartAlternativesPanel: React.FC<SmartAlternativesPanelProps> = ({ selectedMesh, onClose }) => {
  const baseColor = useMemo(() => {
    const mat = selectedMesh?.material;
    if (mat instanceof PBRMaterial && mat.albedoColor) return mat.albedoColor.clone();
    if (mat instanceof StandardMaterial && mat.diffuseColor) return mat.diffuseColor.clone();
    return new Color3(0.6, 0.6, 0.6);
  }, [selectedMesh]);

  const alternatives = useMemo(() => buildAlternatives(baseColor), [baseColor]);

  const applyAlternative = (alt: Alternative) => {
    if (!selectedMesh) return;
    const mat = selectedMesh.material;
    if (mat instanceof PBRMaterial) {
      mat.albedoColor = alt.color;
      mat.metallic = alt.metallic;
      mat.roughness = alt.roughness;
    } else if (mat instanceof StandardMaterial) {
      mat.diffuseColor = alt.color;
      mat.specularPower = (1 - alt.roughness) * 128;
    } else {
      showToast.warning('No editable material on this object');
      return;
    }
    showToast.success(`Applied ${alt.label}`);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Smart Alternatives</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {!selectedMesh ? (
          <p className="text-sm text-gray-400 py-4 text-center">Select an object in the scene to see material alternatives for it.</p>
        ) : (
          alternatives.map((alt) => (
            <button
              key={alt.label}
              onClick={() => applyAlternative(alt)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-700/80 bg-slate-800/50 hover:border-cyan-500/40 transition-colors"
            >
              <span
                className="w-8 h-8 rounded-full border border-slate-600 shrink-0"
                style={{ backgroundColor: `rgb(${alt.color.r * 255}, ${alt.color.g * 255}, ${alt.color.b * 255})` }}
              />
              <div className="text-left">
                <div className="text-sm text-gray-100">{alt.label}</div>
                <div className={`text-[10px] font-technical uppercase ${TIER_LABEL[alt.tier]}`}>{alt.tier}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default SmartAlternativesPanel;
