import React, { useState, useEffect, useCallback } from 'react';
import { Scene, Vector3, DirectionalLight } from '@babylonjs/core';
import { X, Sun } from 'lucide-react';
import { calculateSunAngle, calculateSunIntensity, calculateColorTemperature } from '../utils/lightingUtils';
import { usePanelStack } from '../hooks/usePanelStack';

interface SunStudyPanelProps {
  scene: Scene;
  onClose: () => void;
}

// Approximate color temperature (Kelvin) to an RGB tint, so the light visibly warms up
// at sunrise/sunset and turns neutral-white at midday - purely a visual cue, not a
// physically exact color science model.
function temperatureToTint(kelvin: number): { r: number; g: number; b: number } {
  if (kelvin < 4000) return { r: 1, g: 0.78, b: 0.55 }; // warm (dawn/dusk)
  if (kelvin < 5500) return { r: 1, g: 0.92, b: 0.8 };  // mild warm
  return { r: 1, g: 1, b: 1 }; // neutral daylight
}

const SunStudyPanel: React.FC<SunStudyPanelProps> = ({ scene, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [hour, setHour] = useState(12);
  const [month, setMonth] = useState(new Date().getMonth());

  const applySunPosition = useCallback((h: number, m: number) => {
    const sunLight = scene.getLightByName('sun') as DirectionalLight | null;
    if (!sunLight) return;

    const date = new Date();
    date.setMonth(m);
    date.setHours(Math.floor(h), (h % 1) * 60, 0, 0);

    const elevation = calculateSunAngle(date);
    const intensity = calculateSunIntensity(elevation);
    const kelvin = calculateColorTemperature(elevation);

    // Azimuth: simple day-arc model - sunrise in the east (~6am) through overhead to
    // sunset in the west (~6pm). Not astronomically exact, but gives a realistic-looking
    // moving shadow study across the day, which is the actual practical use case here.
    const azimuthDeg = ((h - 6) / 12) * 180;
    const azimuthRad = (azimuthDeg * Math.PI) / 180;
    const elevationRad = (Math.max(elevation, 2) * Math.PI) / 180; // keep a little above horizon so shadows don't vanish

    const direction = new Vector3(
      -Math.cos(elevationRad) * Math.sin(azimuthRad),
      -Math.sin(elevationRad),
      -Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    sunLight.direction = direction;
    sunLight.intensity = Math.max(0.1, intensity * 1.5);

    const tint = temperatureToTint(kelvin);
    sunLight.diffuse.set(tint.r, tint.g, tint.b);
  }, [scene]);

  useEffect(() => {
    applySunPosition(hour, month);
  }, [hour, month, applySunPosition]);

  const timeLabel = `${Math.floor(hour) % 12 === 0 ? 12 : Math.floor(hour) % 12}:${((hour % 1) * 60).toFixed(0).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div ref={panelRef} style={panelStyle} className="fixed right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" />
          <h3 className="font-display font-semibold">Sun Study</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Time of day: <span className="font-technical text-cyan-300">{timeLabel}</span>
          </label>
          <input
            type="range"
            min={5}
            max={20}
            step={0.25}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
            <span>5 AM</span>
            <span>Noon</span>
            <span>8 PM</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Month: <span className="text-cyan-300">{monthNames[month]}</span>
          </label>
          <input
            type="range"
            min={0}
            max={11}
            step={1}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <p className="text-[10px] text-gray-500">
          Moves the scene's directional light to simulate real shadow patterns at this time and season.
        </p>
      </div>
    </div>
  );
};

export default SunStudyPanel;
