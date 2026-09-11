import React, { useState, useEffect, useCallback } from 'react';
import type { Scene } from '@babylonjs/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { BIMManager } from './BIMManager';
import { showToast } from '../utils/toast';

interface EnergyDashboardProps {
  bimManager?: BIMManager;
  simulationManager?: any;
  modelId: string;
  // The loaded Babylon scene - used to derive a real, model-size-based estimate when no
  // IFC/BIM element data is available for this model (see computeBaseEnergy below). Optional
  // only so this component doesn't hard-crash if a caller doesn't have a scene ref yet.
  scene?: Scene | null;
}

interface EnergyBreakdown {
  total: number;
  lighting: number;
  heating: number;
  cooling: number;
  appliances: number;
}

// Rough national-average energy use intensity for a mixed-use building, in kWh per square
// meter of floor area per year (commonly cited EUI benchmarks land in the 100-200 range).
// Used only as the multiplier for the scene-derived estimate below - real BIM analysis
// (bimManager.getEnergyAnalysis) is always preferred when it's available.
const ROUGH_EUI_KWH_PER_SQM = 150;

const excludeFromFootprint = (name: string) =>
  name.startsWith('measure_') || name.startsWith('preview_') || name.startsWith('measurement_');

// Derives a real (not hardcoded) base energy figure from whatever data is actually
// available: a true BIM element analysis when the model was IFC-imported, or a rough
// estimate from the loaded model's own physical footprint (width x depth) otherwise.
// Previously this fell back to a flat, model-size-independent constant (1000, or 800 on
// error) regardless of whether the loaded model was a small room or an entire building.
function computeBaseEnergy(bimManager: BIMManager | undefined, modelId: string, scene: Scene | null | undefined):
  { total: number; source: 'bim' | 'estimate' | 'unavailable' } {
  const analysis = bimManager?.getEnergyAnalysis ? bimManager.getEnergyAnalysis(modelId) : null;
  if (analysis && typeof analysis.total === 'number' && analysis.total > 0) {
    return { total: analysis.total, source: 'bim' };
  }

  if (!scene) return { total: 0, source: 'unavailable' };

  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  let found = false;
  for (const mesh of scene.meshes) {
    if (!mesh.isVisible || excludeFromFootprint(mesh.name) || mesh.getTotalVertices() === 0) continue;
    const box = mesh.getBoundingInfo().boundingBox;
    minX = Math.min(minX, box.minimumWorld.x);
    minZ = Math.min(minZ, box.minimumWorld.z);
    maxX = Math.max(maxX, box.maximumWorld.x);
    maxZ = Math.max(maxZ, box.maximumWorld.z);
    found = true;
  }
  if (!found) return { total: 0, source: 'unavailable' };

  const footprintArea = Math.max(0, maxX - minX) * Math.max(0, maxZ - minZ);
  return { total: footprintArea * ROUGH_EUI_KWH_PER_SQM, source: 'estimate' };
}

export default function EnergyDashboard({ bimManager, simulationManager, modelId, scene }: EnergyDashboardProps): React.ReactElement {
  const [efficiencyFactor, setEfficiencyFactor] = useState(0.8);
  const [baseTotal, setBaseTotal] = useState(0);
  const [dataSource, setDataSource] = useState<'bim' | 'estimate' | 'unavailable'>('unavailable');

  // Recomputes the BASE figure only - kept separate from efficiencyFactor so dragging the
  // slider (see the render-time breakdown below) doesn't re-run mesh bounding-box scans or
  // re-fire a toast on every drag tick, which the original single combined effect did.
  const recomputeBase = useCallback(() => {
    try {
      const result = computeBaseEnergy(bimManager, modelId, scene);
      setBaseTotal(result.total);
      setDataSource(result.source);
      if (result.source === 'bim') {
        showToast.success('Energy analysis updated', 'Calculated from imported BIM/IFC element data.');
      } else if (result.source === 'estimate') {
        showToast.warning('Showing an estimated energy figure', 'No BIM/IFC data for this model - estimated from its footprint size. Import IFC data for a precise analysis.');
      } else {
        showToast.error('Energy analysis unavailable', 'No BIM data and no loaded model to estimate from.');
      }
    } catch (error) {
      console.error('Energy analysis error:', error);
      showToast.error('Failed to compute energy analysis');
      setBaseTotal(0);
      setDataSource('unavailable');
    }
  }, [bimManager, modelId, scene]);

  useEffect(() => { recomputeBase(); }, [recomputeBase]);

  const breakdown: EnergyBreakdown = (() => {
    const total = baseTotal * (1 - efficiencyFactor);
    return {
      total,
      lighting: total * 0.25,
      heating: total * 0.30,
      cooling: total * 0.25,
      appliances: total * 0.20
    };
  })();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Energy Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dataSource === 'estimate' && (
          <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
            Estimated from model footprint - no BIM/IFC data found for this model.
          </p>
        )}
        {dataSource === 'unavailable' && (
          <p className="text-xs text-muted-foreground bg-muted/50 border rounded px-2 py-1.5">
            No model loaded yet - nothing to estimate.
          </p>
        )}
        <div>
          <Label>Efficiency Factor</Label>
          <Slider value={[efficiencyFactor]} onValueChange={(v: [number, number]) => setEfficiencyFactor(v[0])} max={1} step={0.05} />
        </div>
        <div className="space-y-2">
          <div><strong>Total Energy:</strong> {breakdown.total.toFixed(0)} kWh/year</div>
          <div>Lighting: {breakdown.lighting.toFixed(0)} kWh/year</div>
          <div>Heating: {breakdown.heating.toFixed(0)} kWh/year</div>
          <div>Cooling: {breakdown.cooling.toFixed(0)} kWh/year</div>
          <div>Appliances: {breakdown.appliances.toFixed(0)} kWh/year</div>
        </div>
        <Button onClick={recomputeBase}>Recalculate</Button>
      </CardContent>
    </Card>
  );
}
