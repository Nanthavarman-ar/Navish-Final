import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

interface FloodSimulationProps {
  scene: BABYLON.Scene;
  terrainMesh?: BABYLON.Mesh | null;
  onFloodLevelChange?: (level: number) => void;
}

interface DrainagePoint {
  position: BABYLON.Vector3;
  flowRate: number;
  direction: BABYLON.Vector3;
}

const EnhancedFloodSimulation: React.FC<FloodSimulationProps> = ({ scene, terrainMesh, onFloodLevelChange }) => {
  const [floodLevel, setFloodLevel] = useState<number>(0);
  const [rainfallIntensity, setRainfallIntensity] = useState<number>(5); // mm/hour
  const [drainageEnabled, setDrainageEnabled] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationTime, setSimulationTime] = useState<number>(0);

  // New state for audio playing status
  const [isRainSoundPlaying, setIsRainSoundPlaying] = useState<boolean>(false);
  const [isWaterSoundPlaying, setIsWaterSoundPlaying] = useState<boolean>(false);

  const waterMeshRef = useRef<BABYLON.Mesh | null>(null);
  const rainParticleSystemRef = useRef<BABYLON.ParticleSystem | null>(null);
  const flowParticleSystemRef = useRef<BABYLON.ParticleSystem | null>(null);
  const drainagePointsRef = useRef<DrainagePoint[]>([]);
  const waterLevelRef = useRef<number>(0);
  const audioEngineRef = useRef<BABYLON.AudioEngine | null>(null);
  const rainSoundRef = useRef<BABYLON.Sound | null>(null);
  const waterSoundRef = useRef<BABYLON.Sound | null>(null);
  const waveAnimationRef = useRef<BABYLON.Animatable | null>(null);

  // Create water mesh with enhanced material for realistic waves
  const createWaterMesh = () => {
    const water = BABYLON.MeshBuilder.CreateGround('waterPlane', {
      width: 200,
      height: 200,
      subdivisions: 32
    }, scene);

    const waterMaterial = new BABYLON.StandardMaterial('waterMaterial', scene);
    waterMaterial.diffuseColor = new BABYLON.Color3(0.0, 0.3, 0.6);
    waterMaterial.specularColor = new BABYLON.Color3(0.5, 0.8, 1.0);
    waterMaterial.alpha = 0.8;

    // Create animated bump texture for wave effects
    const bumpTexture = new BABYLON.Texture('https://assets.babylonjs.com/textures/waterbump.png', scene);
    bumpTexture.uScale = 4;
    bumpTexture.vScale = 4;
    waterMaterial.bumpTexture = bumpTexture;

    // Add reflection texture for more realistic water
    const reflectionTexture = new BABYLON.MirrorTexture('reflectionTexture', 512, scene, true);
    reflectionTexture.mirrorPlane = new BABYLON.Plane(0, -1, 0, 0);
    waterMaterial.reflectionTexture = reflectionTexture;

    water.material = waterMaterial;
    water.position.y = floodLevel;

    return water;
  };

  // Remove createWaterTexture and createWaterNormalMap as WaterMaterial handles this internally

  // Create rain particle system
  const createRainSystem = () => {
    const rainSystem = new BABYLON.ParticleSystem('rainParticles', 1000, scene);

    // Create emitter plane above the scene
    const emitter = BABYLON.MeshBuilder.CreateGround('rainEmitter', {
      width: 200,
      height: 200
    }, scene);
    emitter.position.y = 50;
    emitter.isVisible = false;
    rainSystem.emitter = emitter;

    // Rain particle properties
    rainSystem.particleTexture = new BABYLON.Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', scene);
    rainSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 0.8);
    rainSystem.color2 = new BABYLON.Color4(0.9, 0.95, 1.0, 0.6);
    rainSystem.colorDead = new BABYLON.Color4(0.8, 0.9, 1.0, 0.0);

    rainSystem.minSize = 0.01;
    rainSystem.maxSize = 0.05;
    rainSystem.minLifeTime = 1.0;
    rainSystem.maxLifeTime = 3.0;

    rainSystem.emitRate = rainfallIntensity * 100;
    rainSystem.minEmitPower = 10;
    rainSystem.maxEmitPower = 20;

    rainSystem.direction1 = new BABYLON.Vector3(-0.1, -1, -0.1);
    rainSystem.direction2 = new BABYLON.Vector3(0.1, -1, 0.1);

    rainSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

    return rainSystem;
  };

  // Create flow visualization system
  const createFlowSystem = () => {
    const flowSystem = new BABYLON.ParticleSystem('flowParticles', 500, scene);

    const emitter = BABYLON.MeshBuilder.CreateGround('flowEmitter', {
      width: 200,
      height: 200
    }, scene);
    emitter.position.y = 1;
    emitter.isVisible = false;
    flowSystem.emitter = emitter;

    flowSystem.particleTexture = new BABYLON.Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', scene);
    flowSystem.color1 = new BABYLON.Color4(0.2, 0.4, 0.8, 0.8);
    flowSystem.color2 = new BABYLON.Color4(0.1, 0.6, 1.0, 0.6);
    flowSystem.colorDead = new BABYLON.Color4(0.0, 0.3, 0.6, 0.0);

    flowSystem.minSize = 0.02;
    flowSystem.maxSize = 0.08;
    flowSystem.minLifeTime = 2.0;
    flowSystem.maxLifeTime = 5.0;

    flowSystem.emitRate = 50;
    flowSystem.minEmitPower = 2;
    flowSystem.maxEmitPower = 5;

    return flowSystem;
  };

  // Initialize audio engine and sounds
  const initializeAudio = () => {
    audioEngineRef.current = new BABYLON.AudioEngine();

    // Create rain sound using procedural audio
    rainSoundRef.current = new BABYLON.Sound('rainSound', null, scene, null, {
      loop: true,
      autoplay: false,
      volume: 0.3
    });

    // Create water flow sound
    waterSoundRef.current = new BABYLON.Sound('waterSound', null, scene, null, {
      loop: true,
      autoplay: false,
      volume: 0.2
    });

    // Generate procedural rain sound
    generateRainSound();
    generateWaterSound();
  };

  // Generate procedural rain sound
  const generateRainSound = () => {
    if (!rainSoundRef.current) return;

    const audioEngine = BABYLON.Engine.audioEngine;
    if (!audioEngine) return;
    const audioContext = audioEngine.audioContext;
    if (!audioContext) return;

    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Generate white noise with some filtering for rain-like sound
      const noise = (Math.random() * 2 - 1) * 0.1;
      const filter = Math.sin(i * 0.001) * 0.5 + 0.5;
      data[i] = noise * filter;
    }

    rainSoundRef.current.setAudioBuffer(buffer);
  };

  // Generate procedural water flow sound
  const generateWaterSound = () => {
    if (!waterSoundRef.current) return;

    const audioEngine = BABYLON.Engine.audioEngine;
    if (!audioEngine) return;
    const audioContext = audioEngine.audioContext;
    if (!audioContext) return;

    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Generate flowing water sound with modulation
      const baseFreq = 200;
      const modulation = Math.sin(i * 0.01) * 0.3 + 0.7;
      const wave = Math.sin(i * baseFreq * Math.PI * 2 / audioContext.sampleRate) * modulation;
      data[i] = wave * 0.2;
    }

    waterSoundRef.current.setAudioBuffer(buffer);
  };

  // Create wave animation for bump texture
  const createWaveAnimation = () => {
    if (!waterMeshRef.current) return;

    const material = waterMeshRef.current.material as BABYLON.StandardMaterial;
    if (!material.bumpTexture) return;

    // Animate the bump texture offset for wave effect
    waveAnimationRef.current = BABYLON.Animation.CreateAndStartAnimation(
      'waveAnimation',
      material.bumpTexture,
      'uOffset',
      30,
      120,
      new BABYLON.Vector2(0, 0),
      new BABYLON.Vector2(1, 1),
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );
  };

  // Calculate drainage points based on terrain
  const calculateDrainagePoints = () => {
    if (!terrainMesh) return [];

    const drainagePoints: DrainagePoint[] = [];
    const positions = terrainMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    if (!positions) return [];

    // Find low points (potential drainage areas)
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      if (y < floodLevel - 1) { // Points below water level
        drainagePoints.push({
          position: new BABYLON.Vector3(x, y, z),
          flowRate: Math.random() * 2 + 1,
          direction: new BABYLON.Vector3(
            (Math.random() - 0.5) * 2,
            -1,
            (Math.random() - 0.5) * 2
          ).normalize()
        });
      }
    }

    return drainagePoints.slice(0, 20); // Limit to 20 drainage points
  };

  // Update flow visualization
  const updateFlowVisualization = () => {
    if (!flowParticleSystemRef.current || !drainageEnabled) return;

    const drainagePoints = calculateDrainagePoints();
    drainagePointsRef.current = drainagePoints;

    // Update particle directions based on drainage
    if (drainagePoints.length > 0) {
      const avgDirection = drainagePoints.reduce(
        (sum, point) => sum.add(point.direction.scale(point.flowRate)),
        BABYLON.Vector3.Zero()
      ).scale(1 / drainagePoints.length);

      flowParticleSystemRef.current.direction1 = avgDirection.scale(0.5);
      flowParticleSystemRef.current.direction2 = avgDirection.scale(1.5);
      flowParticleSystemRef.current.emitRate = drainagePoints.length * 25;
    }
  };

  // Simulate flood progression over time
  const simulateFloodProgression = () => {
    if (!isSimulating) return;

    const deltaTime = 0.016; // ~60fps
    const rainfallRate = rainfallIntensity / 3600000; // Convert mm/hour to m/second
    const drainageRate = drainageEnabled ? 0.001 : 0;

    // Simple flood model: rainfall - drainage = water level change
    const waterChange = (rainfallRate - drainageRate) * deltaTime;
    const newWaterLevel = Math.max(0, waterLevelRef.current + waterChange);

    waterLevelRef.current = newWaterLevel;
    setFloodLevel(newWaterLevel);
    setSimulationTime(prev => prev + deltaTime);
  };

  // Initialize systems
  useEffect(() => {
    waterMeshRef.current = createWaterMesh();
    rainParticleSystemRef.current = createRainSystem();
    flowParticleSystemRef.current = createFlowSystem();
    initializeAudio();
    createWaveAnimation();

    return () => {
      if (waterMeshRef.current) waterMeshRef.current.dispose();
      if (rainParticleSystemRef.current) rainParticleSystemRef.current.dispose();
      if (flowParticleSystemRef.current) flowParticleSystemRef.current.dispose();
      if (rainSoundRef.current) rainSoundRef.current.dispose();
      if (waterSoundRef.current) waterSoundRef.current.dispose();
      if (waveAnimationRef.current) waveAnimationRef.current.stop();
    };
  }, [scene]);

  // Update water level
  useEffect(() => {
    if (waterMeshRef.current) {
      waterMeshRef.current.position.y = floodLevel;
    }
    onFloodLevelChange?.(floodLevel);
  }, [floodLevel, onFloodLevelChange]);

  // Update rainfall intensity
  useEffect(() => {
    if (rainParticleSystemRef.current) {
      rainParticleSystemRef.current.emitRate = rainfallIntensity * 100;
    }
  }, [rainfallIntensity]);

  // Update drainage visualization
  useEffect(() => {
    updateFlowVisualization();
  }, [drainageEnabled, terrainMesh, floodLevel]);

  // Simulation loop
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(simulateFloodProgression, 16);
    return () => clearInterval(interval);
  }, [isSimulating, rainfallIntensity, drainageEnabled]);

  // Toggle rain
  const toggleRain = () => {
    if (rainParticleSystemRef.current) {
      if (rainParticleSystemRef.current.isStarted()) {
        rainParticleSystemRef.current.stop();
        if (rainSoundRef.current && rainSoundRef.current.isPlaying) {
          rainSoundRef.current.stop();
        }
      } else {
        rainParticleSystemRef.current.start();
        if (rainSoundRef.current && !rainSoundRef.current.isPlaying) {
          rainSoundRef.current.play();
        }
      }
    }
  };

  // Toggle flow visualization
  const toggleFlowVisualization = () => {
    if (flowParticleSystemRef.current) {
      if (flowParticleSystemRef.current.isStarted()) {
        flowParticleSystemRef.current.stop();
      } else {
        flowParticleSystemRef.current.start();
      }
    }
  };

  // Reset simulation
  const resetSimulation = () => {
    setIsSimulating(false);
    setSimulationTime(0);
    waterLevelRef.current = 0;
    setFloodLevel(0);
  };

  return (
    <div className="p-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100">
      <h3 className="m-0 mb-4 text-base">Enhanced Flood Simulation</h3>

      {/* Simulation Controls */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-3 py-1.5 border-0 rounded text-white text-xs cursor-pointer ${
              isSimulating ? 'bg-red-600' : 'bg-emerald-500'
            }`}
          >
            {isSimulating ? 'Stop' : 'Start'} Simulation
          </button>
          <button
            onClick={resetSimulation}
            className="px-3 py-1.5 bg-gray-500 border-0 rounded text-white text-xs cursor-pointer"
          >
            Reset
          </button>
        </div>

        {isSimulating && (
          <div className="text-xs text-slate-400">
            Simulation Time: {simulationTime.toFixed(1)}s
          </div>
        )}
      </div>

      {/* Rainfall Controls */}
      <div className="border-t border-slate-600 pt-4 mb-4">
        <h4 className="m-0 mb-2 text-sm">Rainfall</h4>

        <div className="mb-2">
          <label htmlFor="rainfall-intensity" className="block mb-1 text-xs">
            Intensity: {rainfallIntensity} mm/hour
          </label>
          <input
            id="rainfall-intensity"
            type="range"
            min="0"
            max="50"
            step="1"
            value={rainfallIntensity}
            onChange={(e) => setRainfallIntensity(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <button
          onClick={toggleRain}
          className="px-3 py-1.5 bg-blue-500 border-0 rounded text-white text-xs cursor-pointer"
        >
          Toggle Rain
        </button>
      </div>

      {/* Drainage Controls */}
      <div className="border-t border-slate-600 pt-4 mb-4">
        <h4 className="m-0 mb-2 text-sm">Drainage</h4>

        <div className="mb-2">
          <label htmlFor="drainage-enabled" className="block mb-1 text-xs">
            <input
              id="drainage-enabled"
              type="checkbox"
              checked={drainageEnabled}
              onChange={(e) => setDrainageEnabled(e.target.checked)}
              className="mr-2"
            />
            Enable Drainage Flow
          </label>
        </div>

        <button
          onClick={toggleFlowVisualization}
          disabled={!drainageEnabled}
          className={`px-3 py-1.5 border-0 rounded text-white text-xs ${
            drainageEnabled
              ? 'bg-emerald-500 cursor-pointer opacity-100'
              : 'bg-gray-500 cursor-not-allowed opacity-60'
          }`}
        >
          Flow Visualization
        </button>
      </div>

      {/* Audio Controls */}
      <div className="border-t border-slate-600 pt-4 mb-4">
        <h4 className="m-0 mb-2 text-sm">Audio Effects</h4>

        <div className="mb-2">
          <label htmlFor="rain-sound-enabled" className="block mb-1 text-xs cursor-pointer select-none">
            <input
              id="rain-sound-enabled"
              type="checkbox"
              checked={rainSoundRef.current?.isPlaying || false}
              onChange={(e) => {
                if (rainSoundRef.current) {
                  if (e.target.checked) {
                    rainSoundRef.current.play();
                    setIsRainSoundPlaying(true);
                  } else {
                    rainSoundRef.current.stop();
                    setIsRainSoundPlaying(false);
                  }
                }
              }}
              className="mr-2 cursor-pointer"
            />
            Rain Sound
          </label>
        </div>

        <div className="mb-2">
          <label htmlFor="water-sound-enabled" className="block mb-1 text-xs cursor-pointer select-none">
            <input
              id="water-sound-enabled"
              type="checkbox"
              checked={waterSoundRef.current?.isPlaying || false}
              onChange={(e) => {
                if (waterSoundRef.current) {
                  if (e.target.checked) {
                    waterSoundRef.current.play();
                    setIsWaterSoundPlaying(true);
                  } else {
                    waterSoundRef.current.stop();
                    setIsWaterSoundPlaying(false);
                  }
                }
              }}
              className="mr-2 cursor-pointer"
            />
            Water Flow Sound
          </label>
        </div>

        <div className="text-xs text-slate-400">
          Procedural audio effects for immersive simulation
        </div>
      </div>

      {/* Manual Water Level */}
      <div className="border-t border-slate-600 pt-4">
        <h4 className="m-0 mb-2 text-sm">Manual Water Level</h4>

        <label htmlFor="water-level" className="block mb-1 text-xs">
          Water Level: {floodLevel.toFixed(2)} meters
        </label>
        <input
          id="water-level"
          type="range"
          min="0"
          max="20"
          step="0.1"
          value={floodLevel}
          onChange={(e) => {
            const level = parseFloat(e.target.value);
            setFloodLevel(level);
            waterLevelRef.current = level;
          }}
          className="w-full"
        />

        <div className="text-xs text-slate-400 mt-2">
          Advanced flood simulation with rainfall, drainage flow prediction, real-time water physics, and immersive audio-visual effects
        </div>
      </div>
    </div>
  );
};

export default EnhancedFloodSimulation;
