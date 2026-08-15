import React from 'react';
import { Scene } from '@babylonjs/core';

interface HandTrackingProps {
  scene: Scene;
  isActive: boolean;
}

const HandTracking: React.FC<HandTrackingProps> = ({ scene, isActive }) => {
  if (!isActive) return null;
  
  return null;
};

export default HandTracking;