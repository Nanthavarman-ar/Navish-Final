import React from 'react';
import { Scene } from '@babylonjs/core';

interface MultiUserProps {
  scene: Scene;
  isActive: boolean;
}

const MultiUser: React.FC<MultiUserProps> = ({ scene, isActive }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute top-4 left-4 bg-white p-2 rounded shadow">
      Multi-User Active
    </div>
  );
};

export default MultiUser;