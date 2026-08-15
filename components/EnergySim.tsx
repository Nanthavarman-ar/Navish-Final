import React from 'react';
import * as BABYLON from '@babylonjs/core';

interface EnergySimProps {
  scene: BABYLON.Scene;
  isActive?: boolean;
}

const EnergySim: React.FC<EnergySimProps> = ({ scene, isActive = true }) => {
  if (!isActive) return null;

  return (
    <div className="absolute top-15 right-2.5 w-72 bg-black bg-opacity-90 rounded-lg p-4 text-white text-xs z-[1000]">
      <h3 className="m-0 mb-4 text-yellow-500">⚡ Energy Simulation</h3>
      <p>This feature enables energy efficiency and consumption analysis.</p>
      <p>Feature coming soon.</p>
    </div>
  );
};

export default EnergySim;
