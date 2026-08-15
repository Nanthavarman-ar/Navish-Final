import React, { useState, useEffect } from 'react';
import { Scene, Engine } from '@babylonjs/core';

interface HealthStatus {
  engine: boolean;
  scene: boolean;
  rendering: boolean;
  fps: number;
  meshes: number;
  materials: number;
  lights: number;
}

interface BabylonHealthCheckerProps {
  scene: Scene | null;
  engine: Engine | null;
}

const BabylonHealthChecker: React.FC<BabylonHealthCheckerProps> = ({ scene, engine }) => {
  const [health, setHealth] = useState<HealthStatus>({
    engine: false,
    scene: false,
    rendering: false,
    fps: 0,
    meshes: 0,
    materials: 0,
    lights: 0
  });

  useEffect(() => {
    const checkHealth = () => {
      setHealth({
        engine: !!engine,
        scene: !!scene,
        rendering: engine ? !engine.isDisposed : false,
        fps: engine ? Math.round(engine.getFps()) : 0,
        meshes: scene?.meshes?.length || 0,
        materials: scene?.materials?.length || 0,
        lights: scene?.lights?.length || 0
      });
    };

    const interval = setInterval(checkHealth, 1000);
    checkHealth();
    return () => clearInterval(interval);
  }, [scene, engine]);

  const getStatus = (value: boolean) => value ? '✅' : '❌';

  return (
    <div className="fixed top-4 left-4 bg-slate-800 border border-slate-600 rounded-lg p-3 z-50 text-xs text-white">
      <div className="font-bold mb-2">Babylon.js Status</div>
      <div>Engine: {getStatus(health.engine)}</div>
      <div>Scene: {getStatus(health.scene)}</div>
      <div>Rendering: {getStatus(health.rendering)}</div>
      <div>FPS: {health.fps}</div>
      <div>Meshes: {health.meshes}</div>
      <div>Materials: {health.materials}</div>
      <div>Lights: {health.lights}</div>
    </div>
  );
};

export default BabylonHealthChecker;