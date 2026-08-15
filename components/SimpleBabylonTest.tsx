import React, { useRef, useEffect, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, MeshBuilder } from '@babylonjs/core';

const SimpleBabylonTest: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initBabylon = async () => {
      try {
        if (!canvasRef.current) {
          throw new Error('Canvas not found');
        }

        setStatus('Creating engine...');
        const engine = new Engine(canvasRef.current, true, {
          antialias: false,
          adaptToDeviceRatio: false
        });
        
        setStatus('Waiting for engine...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        setStatus('Creating scene...');
        const scene = new Scene(engine);
        
        setStatus('Creating camera...');
        const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);
        
        setStatus('Creating light...');
        const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
        
        setStatus('Creating mesh...');
        const box = MeshBuilder.CreateBox('box', { size: 2 }, scene);
        
        setStatus('Starting render loop...');
        const renderLoop = () => {
          try {
            scene.render();
          } catch (e) {
            console.warn('Render error:', e);
          }
        };
        engine.runRenderLoop(renderLoop);
        
        setStatus('Ready!');
        
        return () => {
          engine.dispose();
        };
      } catch (err) {
        console.error('Babylon test error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('Failed');
      }
    };

    initBabylon();
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded">
        <h3 className="font-bold text-red-800">Babylon.js Test Failed</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 relative">
      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm z-10">
        Status: {status}
      </div>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default SimpleBabylonTest;