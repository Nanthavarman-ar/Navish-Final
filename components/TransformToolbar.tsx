import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';

interface TransformToolbarProps {
  selectedMesh: BABYLON.Mesh | null;
  scene: BABYLON.Scene;
}

const TransformToolbar: React.FC<TransformToolbarProps> = ({ selectedMesh, scene }) => {
  const [activeMode, setActiveMode] = useState('select');

  const handleMove = (axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedMesh) return;
    selectedMesh.position[axis] += delta;
  };

  const handleRotate = (axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedMesh) return;
    selectedMesh.rotation[axis] += delta;
  };

  const handleScale = (axis: 'x' | 'y' | 'z' | 'uniform', delta: number) => {
    if (!selectedMesh) return;
    if (axis === 'uniform') {
      selectedMesh.scaling.scaleInPlace(1 + delta);
    } else {
      selectedMesh.scaling[axis] += delta;
    }
  };

  const resetTransform = () => {
    if (!selectedMesh) return;
    selectedMesh.position.setAll(0);
    selectedMesh.rotation.setAll(0);
    selectedMesh.scaling.setAll(1);
  };

  return (
    <div className="absolute top-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-3 z-50 text-xs text-white">
      <div className="font-bold mb-2">Transform Tools</div>
      
      {/* Mode Selection */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        <button onClick={() => setActiveMode('select')} className={`p-1 rounded ${activeMode === 'select' ? 'bg-blue-600' : 'bg-slate-700'}`} title="Select">📍</button>
        <button onClick={() => setActiveMode('move')} className={`p-1 rounded ${activeMode === 'move' ? 'bg-blue-600' : 'bg-slate-700'}`} title="Move">↔️</button>
        <button onClick={() => setActiveMode('rotate')} className={`p-1 rounded ${activeMode === 'rotate' ? 'bg-blue-600' : 'bg-slate-700'}`} title="Rotate">🔄</button>
        <button onClick={() => setActiveMode('scale')} className={`p-1 rounded ${activeMode === 'scale' ? 'bg-blue-600' : 'bg-slate-700'}`} title="Scale">📏</button>
      </div>

      {selectedMesh && (
        <>
          {/* Move Controls */}
          {activeMode === 'move' && (
            <div className="mb-3">
              <div className="text-gray-400 mb-1">Move</div>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => handleMove('x', -0.1)} className="p-1 bg-red-600 rounded">X-</button>
                <button onClick={() => handleMove('y', -0.1)} className="p-1 bg-green-600 rounded">Y-</button>
                <button onClick={() => handleMove('z', -0.1)} className="p-1 bg-blue-600 rounded">Z-</button>
                <button onClick={() => handleMove('x', 0.1)} className="p-1 bg-red-400 rounded">X+</button>
                <button onClick={() => handleMove('y', 0.1)} className="p-1 bg-green-400 rounded">Y+</button>
                <button onClick={() => handleMove('z', 0.1)} className="p-1 bg-blue-400 rounded">Z+</button>
              </div>
            </div>
          )}

          {/* Rotate Controls */}
          {activeMode === 'rotate' && (
            <div className="mb-3">
              <div className="text-gray-400 mb-1">Rotate</div>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => handleRotate('x', -0.1)} className="p-1 bg-red-600 rounded">X-</button>
                <button onClick={() => handleRotate('y', -0.1)} className="p-1 bg-green-600 rounded">Y-</button>
                <button onClick={() => handleRotate('z', -0.1)} className="p-1 bg-blue-600 rounded">Z-</button>
                <button onClick={() => handleRotate('x', 0.1)} className="p-1 bg-red-400 rounded">X+</button>
                <button onClick={() => handleRotate('y', 0.1)} className="p-1 bg-green-400 rounded">Y+</button>
                <button onClick={() => handleRotate('z', 0.1)} className="p-1 bg-blue-400 rounded">Z+</button>
              </div>
            </div>
          )}

          {/* Scale Controls */}
          {activeMode === 'scale' && (
            <div className="mb-3">
              <div className="text-gray-400 mb-1">Scale</div>
              <div className="grid grid-cols-2 gap-1 mb-1">
                <button onClick={() => handleScale('uniform', -0.1)} className="p-1 bg-purple-600 rounded">-</button>
                <button onClick={() => handleScale('uniform', 0.1)} className="p-1 bg-purple-400 rounded">+</button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => handleScale('x', -0.1)} className="p-1 bg-red-600 rounded">X-</button>
                <button onClick={() => handleScale('y', -0.1)} className="p-1 bg-green-600 rounded">Y-</button>
                <button onClick={() => handleScale('z', -0.1)} className="p-1 bg-blue-600 rounded">Z-</button>
                <button onClick={() => handleScale('x', 0.1)} className="p-1 bg-red-400 rounded">X+</button>
                <button onClick={() => handleScale('y', 0.1)} className="p-1 bg-green-400 rounded">Y+</button>
                <button onClick={() => handleScale('z', 0.1)} className="p-1 bg-blue-400 rounded">Z+</button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-1">
            <button onClick={resetTransform} className="p-1 bg-gray-600 rounded text-xs">Reset</button>
            <button onClick={() => selectedMesh.dispose()} className="p-1 bg-red-600 rounded text-xs">Delete</button>
          </div>
        </>
      )}

      {!selectedMesh && (
        <div className="text-gray-400 text-center">Select an object</div>
      )}
    </div>
  );
};

export default TransformToolbar;