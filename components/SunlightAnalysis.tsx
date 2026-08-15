import React from 'react';
import { Scene } from '@babylonjs/core';

interface SunlightAnalysisProps {
  scene: Scene;
  isActive: boolean;
}

const SunlightAnalysis: React.FC<SunlightAnalysisProps> = ({ scene, isActive }) => {
  if (!isActive) return null;
  
  return null;
};

export default SunlightAnalysis;