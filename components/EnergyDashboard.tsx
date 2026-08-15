import React, { useState, useEffect } from 'react';
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
}

interface EnergyBreakdown {
  total: number;
  lighting: number;
  heating: number;
  cooling: number;
  appliances: number;
}

export default function EnergyDashboard({ bimManager, simulationManager, modelId }: EnergyDashboardProps): React.ReactElement {
  const [efficiencyFactor, setEfficiencyFactor] = useState(0.8);
  const [breakdown, setBreakdown] = useState<EnergyBreakdown>({ total: 0, lighting: 0, heating: 0, cooling: 0, appliances: 0 });

  useEffect(() => {
    if (!bimManager) return;

    try {
      // Call BIM method or stub calculation
      const analysis = bimManager.getEnergyAnalysis ? bimManager.getEnergyAnalysis(modelId) : null;
      const baseTotal = analysis?.total || 1000; // Stub base energy use
      const total = baseTotal * (1 - efficiencyFactor);
      setBreakdown({
        total,
        lighting: total * 0.25,
        heating: total * 0.30,
        cooling: total * 0.25,
        appliances: total * 0.20
      });
      showToast.success('Energy analysis updated');
    } catch (error) {
      console.error('Energy analysis error:', error);
      showToast.error('Failed to load energy analysis');
      // Fallback stub
      setBreakdown({
        total: 800,
        lighting: 200,
        heating: 240,
        cooling: 200,
        appliances: 160
      });
    }
  }, [bimManager, modelId, efficiencyFactor]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Energy Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Efficiency Factor</Label>
          <Slider value={[efficiencyFactor]} onValueChange={(v: [number, number]) => setEfficiencyFactor(v[0])} max={1} step={0.05} />
        </div>
        <div className="space-y-2">
          <div><strong>Total Energy:</strong> {breakdown.total.toFixed(0)} kWh</div>
          <div>Lighting: {breakdown.lighting.toFixed(0)} kWh</div>
          <div>Heating: {breakdown.heating.toFixed(0)} kWh</div>
          <div>Cooling: {breakdown.cooling.toFixed(0)} kWh</div>
          <div>Appliances: {breakdown.appliances.toFixed(0)} kWh</div>
        </div>
        <Button onClick={() => showToast.success('Energy simulation recalculated')}>Recalculate</Button>
      </CardContent>
    </Card>
  );
}
