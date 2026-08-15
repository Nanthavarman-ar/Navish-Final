import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import './WindTunnelSimulation.css';

interface WindTunnelSimulationProps {
  scene: BABYLON.Scene;
  onWindChange?: (windData: WindData) => void;
}

interface WindData {
  direction: number; // degrees
  speed: number; // m/s
  turbulence: number; // 0-1
  temperature: number; // celsius
}

const WindTunnelSimulation: React.FC<WindTunnelSimulationProps> = ({ scene, onWindChange }) => {
  const [windDirection, setWindDirection] = useState<number>(0); // 0 = North, 90 = East
  const [windSpeed, setWindSpeed] = useState<number>(5); // m/s
  const [turbulence, setTurbulence] = useState<number>(0.3);
  const [temperature, setTemperature] = useState<number>(20);
  const [isActive, setIsActive] = useState<boolean>(false);

  const particleSystemRef = useRef<BABYLON.ParticleSystem | null>(null);
  const windVectorsRef = useRef<BABYLON.Mesh[]>([]);
  const airflowAnalysisRef = useRef<BABYLON.Mesh[]>([]);

  // Wind direction presets
  const windPresets = [
    { name: 'North', direction: 0, speed: 3 },
    { name: 'North-East', direction: 45, speed: 4 },
    { name: 'East', direction: 90, speed: 5 },
    { name: 'South-East', direction: 135, speed: 4 },
    { name: 'South', direction: 180, speed: 3 },
    { name: 'South-West', direction: 225, speed: 4 },
    { name: 'West', direction: 270, speed: 5 },
    { name: 'North-West', direction: 315, speed: 4 }
  ];

  // Create wind particle system
  const createWindParticles = () => {
    const particleSystem = new BABYLON.ParticleSystem('windParticles', 1000, scene);

    // Create emitter plane
    const emitter = BABYLON.MeshBuilder.CreateGround('windEmitter', { width: 100, height: 100 }, scene);
    emitter.position.y = 10;
    emitter.isVisible = false;
    particleSystem.emitter = emitter;

    // Particle texture (simple white dot)
    particleSystem.particleTexture = new BABYLON.Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', scene);

    // Particle properties
    particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 0.6);
    particleSystem.color2 = new BABYLON.Color4(0.9, 0.95, 1.0, 0.3);
    particleSystem.colorDead = new BABYLON.Color4(0.8, 0.9, 1.0, 0.0);

    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.2;
    particleSystem.minLifeTime = 2.0;
    particleSystem.maxLifeTime = 5.0;

    particleSystem.emitRate = windSpeed * 50;
    particleSystem.minEmitPower = windSpeed * 2;
    particleSystem.maxEmitPower = windSpeed * 4;

    // Set direction based on wind direction
    const radDirection = (windDirection * Math.PI) / 180;
    particleSystem.direction1 = new BABYLON.Vector3(
      Math.sin(radDirection) * windSpeed,
      -0.5,
      Math.cos(radDirection) * windSpeed
    );
    particleSystem.direction2 = new BABYLON.Vector3(
      Math.sin(radDirection + 0.2) * windSpeed,
      0.5,
      Math.cos(radDirection + 0.2) * windSpeed
    );

    particleSystem.gravity = new BABYLON.Vector3(0, -1, 0);
    particleSystem.start();

    return particleSystem;
  };

  // Create wind direction vectors
  const createWindVectors = () => {
    // Clear existing vectors
    windVectorsRef.current.forEach(mesh => mesh.dispose());
    windVectorsRef.current = [];

    const vectorLength = 5;
    const vectorSpacing = 10;
    const gridSize = 5;

    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        const startPoint = new BABYLON.Vector3(x * vectorSpacing, 5, z * vectorSpacing);
        const radDirection = (windDirection * Math.PI) / 180;
        const endPoint = new BABYLON.Vector3(
          startPoint.x + Math.sin(radDirection) * vectorLength,
          startPoint.y,
          startPoint.z + Math.cos(radDirection) * vectorLength
        );

        // Create arrow shaft
        const shaft = BABYLON.MeshBuilder.CreateCylinder('windVector', {
          height: vectorLength,
          diameterTop: 0.05,
          diameterBottom: 0.05
        }, scene);

        shaft.position = startPoint.add(endPoint).scale(0.5);
        shaft.lookAt(endPoint);

        const shaftMaterial = new BABYLON.StandardMaterial('shaftMat', scene);
        shaftMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.6, 1.0);
        shaftMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.5);
        shaft.material = shaftMaterial;

        // Create arrow head
        const head = BABYLON.MeshBuilder.CreateCylinder('windVectorHead', {
          height: 0.5,
          diameterTop: 0.2,
          diameterBottom: 0
        }, scene);

        head.position = endPoint;
        head.lookAt(endPoint.add(new BABYLON.Vector3(Math.sin(radDirection), 0, Math.cos(radDirection))));

        const headMaterial = new BABYLON.StandardMaterial('headMat', scene);
        headMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.4, 0.8);
        headMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.4);
        head.material = headMaterial;

        windVectorsRef.current.push(shaft, head);
      }
    }
  };

  // Analyze building openings for airflow
  const analyzeAirflow = () => {
    // Clear existing analysis
    airflowAnalysisRef.current.forEach(mesh => mesh.dispose());
    airflowAnalysisRef.current = [];

    // Find all meshes that could be building openings (windows, doors)
    const allMeshes = scene.meshes;
    const openings: BABYLON.Mesh[] = [];

    allMeshes.forEach(mesh => {
      if (mesh instanceof BABYLON.Mesh &&
          (mesh.name.toLowerCase().includes('window') ||
           mesh.name.toLowerCase().includes('door') ||
           mesh.name.toLowerCase().includes('opening'))) {
        openings.push(mesh);
      }
    });

    // Create airflow visualization for each opening
    openings.forEach(opening => {
      const airflow = BABYLON.MeshBuilder.CreateCylinder('airflow', {
        height: 3,
        diameterTop: 0.5,
        diameterBottom: 0.1
      }, scene);

      // Position airflow based on wind direction
      const radDirection = (windDirection * Math.PI) / 180;
      const offset = new BABYLON.Vector3(
        Math.sin(radDirection) * 1.5,
        0,
        Math.cos(radDirection) * 1.5
      );

      airflow.position = opening.position.add(offset);
      airflow.lookAt(opening.position.add(new BABYLON.Vector3(Math.sin(radDirection), 0, Math.cos(radDirection))));

      const airflowMaterial = new BABYLON.StandardMaterial('airflowMat', scene);
      airflowMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.9, 1.0);
      airflowMaterial.alpha = 0.6;
      airflow.material = airflowMaterial;

      airflowAnalysisRef.current.push(airflow);
    });
  };

  // Update wind simulation
  const updateWindSimulation = () => {
    if (!isActive) return;

    // Update particle system
    if (particleSystemRef.current) {
      particleSystemRef.current.dispose();
    }
    particleSystemRef.current = createWindParticles();

    // Update wind vectors
    createWindVectors();

    // Update airflow analysis
    analyzeAirflow();

    // Notify parent component
    const windData: WindData = {
      direction: windDirection,
      speed: windSpeed,
      turbulence: turbulence,
      temperature: temperature
    };
    onWindChange?.(windData);
  };

  // Toggle wind simulation
  const toggleWindSimulation = () => {
    setIsActive(!isActive);
  };

  // Apply wind preset
  const applyWindPreset = (preset: typeof windPresets[0]) => {
    setWindDirection(preset.direction);
    setWindSpeed(preset.speed);
  };

  useEffect(() => {
    if (isActive) {
      // Start continuous updates in Babylon render loop
      scene.onBeforeRenderObservable.add(renderLoopUpdate);
    } else {
      // Clean up when inactive
      scene.onBeforeRenderObservable.removeCallback(renderLoopUpdate);

      if (particleSystemRef.current) {
        particleSystemRef.current.dispose();
        particleSystemRef.current = null;
      }
      windVectorsRef.current.forEach(mesh => mesh.dispose());
      windVectorsRef.current = [];
      airflowAnalysisRef.current.forEach(mesh => mesh.dispose());
      airflowAnalysisRef.current = [];
    }

    return () => {
      scene.onBeforeRenderObservable.removeCallback(renderLoopUpdate);

      if (particleSystemRef.current) {
        particleSystemRef.current.dispose();
      }
      windVectorsRef.current.forEach(mesh => mesh.dispose());
      airflowAnalysisRef.current.forEach(mesh => mesh.dispose());
    };
  }, [isActive]);

  // Function to update wind simulation continuously in render loop
  const renderLoopUpdate = () => {
    if (!isActive) return;

    // Update particle system
    if (particleSystemRef.current) {
      particleSystemRef.current.dispose();
    }
    particleSystemRef.current = createWindParticles();

    // Update wind vectors
    createWindVectors();

    // Update airflow analysis
    analyzeAirflow();

    // Apply wind force to meshes
    applyWindForceToMeshes();

    // Notify parent component
    const windData: WindData = {
      direction: windDirection,
      speed: windSpeed,
      turbulence: turbulence,
      temperature: temperature
    };
    onWindChange?.(windData);
  };

  // Apply wind force to meshes in the scene
  const applyWindForceToMeshes = () => {
    const radDirection = (windDirection * Math.PI) / 180;
    const forceVector = new BABYLON.Vector3(
      Math.sin(radDirection) * windSpeed,
      0,
      Math.cos(radDirection) * windSpeed
    );

    scene.meshes.forEach(mesh => {
      if (mesh.physicsImpostor) {
        // Apply force with turbulence effect
        const turbulenceFactor = 1 + (Math.random() - 0.5) * turbulence;
        const force = forceVector.scale(turbulenceFactor);
        mesh.physicsImpostor.applyForce(force, mesh.getAbsolutePosition());
      }
    });
  };

  return (
    <div className="wind-tunnel-simulation-container">
      <h3 className="simulation-title">Wind Tunnel Simulation</h3>

      {/* Simulation Toggle */}
      <div className="simulation-toggle-container">
        <button
          onClick={toggleWindSimulation}
          className={`simulation-toggle-button ${isActive ? 'active' : 'inactive'}`}
        >
          {isActive ? 'Stop Simulation' : 'Start Simulation'}
        </button>
      </div>

      {/* Wind Presets */}
      <div className="wind-presets-container">
        <h4 className="section-title">Wind Presets</h4>
        <div className="wind-presets-grid">
          {windPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyWindPreset(preset)}
              className="wind-preset-button"
              title={`${preset.name}: ${preset.speed} m/s`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Wind Controls */}
      <div className="wind-controls-container">
        <h4 className="section-title">Wind Parameters</h4>

        {/* Direction */}
        <div className="controlGroup">
          <label className="controlLabel" htmlFor="windDirectionInput">
            Direction: {windDirection}° ({getDirectionName(windDirection)})
          </label>
          <input
            id="windDirectionInput"
            type="range"
            min="0"
            max="360"
            step="15"
            value={windDirection}
            onChange={(e) => setWindDirection(parseInt(e.target.value))}
            className="rangeInput"
            aria-label="Wind Direction"
          />
        </div>

        {/* Speed */}
        <div className="controlGroup">
          <label className="controlLabel" htmlFor="windSpeedInput">
            Speed: {windSpeed} m/s
          </label>
          <input
            id="windSpeedInput"
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={windSpeed}
            onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
            className="rangeInput"
            aria-label="Wind Speed"
          />
        </div>

        {/* Turbulence */}
        <div className="controlGroup">
          <label className="controlLabel" htmlFor="turbulenceInput">
            Turbulence: {(turbulence * 100).toFixed(0)}%
          </label>
          <input
            id="turbulenceInput"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={turbulence}
            onChange={(e) => setTurbulence(parseFloat(e.target.value))}
            className="rangeInput"
            aria-label="Turbulence"
          />
        </div>

        {/* Temperature */}
        <div className="controlGroup">
          <label className="controlLabel" htmlFor="temperatureInput">
            Temperature: {temperature}°C
          </label>
          <input
            id="temperatureInput"
            type="range"
            min="-10"
            max="40"
            step="1"
            value={temperature}
            onChange={(e) => setTemperature(parseInt(e.target.value))}
            className="rangeInput"
            aria-label="Temperature"
          />
        </div>
      </div>

      <div className="simulation-info-text">
        Wind tunnel simulation shows airflow patterns, wind vectors, and building ventilation analysis
      </div>
    </div>
  );
};

// Helper function to get direction name
const getDirectionName = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

export default WindTunnelSimulation;
