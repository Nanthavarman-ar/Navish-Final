import React from 'react';
import { Scene } from '@babylonjs/core';

interface PresenterModeProps {
  scene: Scene;
  isActive: boolean;
}

const PresenterMode: React.FC<PresenterModeProps> = ({ scene, isActive }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute top-4 left-4 bg-white p-2 rounded shadow">
      Presenter Mode Active
    </div>
  );
};

export default PresenterMode;