import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';

interface FloodSimulationProps {
  scene: any;
  isActive?: boolean;
  onClose?: () => void;
  onFloodToggle?: (on: boolean) => void;
  floodOn?: boolean;
  onWaterLevelChange?: (level: number) => void;
  onWaveSpeedChange?: (speed: number) => void;
}

export default function FloodSimulation({
  scene,
  isActive = true,
  onClose,
  onFloodToggle,
  floodOn = false,
  onWaterLevelChange,
  onWaveSpeedChange,
}: FloodSimulationProps): React.ReactElement | null {
  const [waterLevel, setWaterLevel] = useState(0.5);
  const [waveSpeed, setWaveSpeed] = useState(1.0);

  const handleWaterLevelChange = (v: [number, number]) => {
    setWaterLevel(v[0]);
    onWaterLevelChange?.(v[0]);
  };

  const handleWaveSpeedChange = (v: [number, number]) => {
    setWaveSpeed(v[0]);
    onWaveSpeedChange?.(v[0]);
  };

  if (!isActive) return null;

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-80 bg-slate-800 border-slate-600 text-white pointer-events-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Flood Simulation</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-300 text-sm">Flood</span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={floodOn ? 'default' : 'outline'}
              onClick={() => onFloodToggle?.(true)}
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={floodOn ? 'outline' : 'default'}
              onClick={() => onFloodToggle?.(false)}
            >
              Off
            </Button>
          </div>
        </div>
        <div>
          <Label>Water Level</Label>
          <Slider value={[waterLevel]} onValueChange={handleWaterLevelChange} max={1} step={0.05} min={0} />
        </div>
        <div>
          <Label>Wave Intensity</Label>
          <Slider value={[waveSpeed]} onValueChange={handleWaveSpeedChange} max={2} step={0.1} min={0.2} />
        </div>
      </CardContent>
    </Card>
  );
}
