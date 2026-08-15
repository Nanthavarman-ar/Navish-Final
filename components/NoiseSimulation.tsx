import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import styles from './NoiseSimulation.module.css';

interface NoiseSimulationProps {
  scene: BABYLON.Scene;
  onNoiseChange?: (noiseData: NoiseData) => void;
}

interface NoiseData {
  sources: NoiseSource[];
  totalNoise: number;
  affectedAreas: BABYLON.Vector3[];
}

interface NoiseSource {
  id: string;
  position: BABYLON.Vector3;
  type: 'traffic' | 'construction' | 'industrial' | 'residential' | 'custom';
  intensity: number; // dB
  radius: number; // meters
  frequency: number; // Hz
  direction?: BABYLON.Vector3; // For directional noise sources
  attenuation: number; // How quickly noise decreases with distance
  materialAbsorption: number; // Material absorption factor (0-1)
  isActive: boolean;
  name: string;
  coneAngle?: number; // Cone angle in degrees for directional sources
  coneAttenuation?: number; // Attenuation outside cone
  preset?: string; // Preset name for custom sources
}

const NoiseSimulation: React.FC<NoiseSimulationProps> = ({ scene, onNoiseChange }) => {
  const [noiseSources, setNoiseSources] = useState<NoiseSource[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<NoiseSource['type']>('traffic');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [showNoiseMap, setShowNoiseMap] = useState<boolean>(true);
  const [noiseThreshold, setNoiseThreshold] = useState<number>(50); // dB

  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0.5);
  const noiseMeshesRef = useRef<BABYLON.Mesh[]>([]);
  const noiseMapRef = useRef<BABYLON.Mesh | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Map<string, { oscillator: OscillatorNode; panner: PannerNode; gain: GainNode } | null>>(new Map());
  const listenerRef = useRef<AudioListener | null>(null);

  // Noise source presets
  const noisePresets = {
    traffic: { intensity: 70, radius: 100, frequency: 1000, attenuation: 0.001, materialAbsorption: 0.1 },
    construction: { intensity: 85, radius: 50, frequency: 2000, attenuation: 0.002, materialAbsorption: 0.2 },
    industrial: { intensity: 90, radius: 200, frequency: 500, attenuation: 0.0015, materialAbsorption: 0.15 },
    residential: { intensity: 45, radius: 30, frequency: 300, attenuation: 0.0008, materialAbsorption: 0.05 },
    custom: { intensity: 60, radius: 75, frequency: 800, attenuation: 0.0012, materialAbsorption: 0.12 }
  };


  // Enhanced attenuation calculation with material absorption and directional effects
  const calculateNoiseLevel = (source: NoiseSource, targetPosition: BABYLON.Vector3): number => {
    const distance = BABYLON.Vector3.Distance(targetPosition, source.position);

    if (distance > source.radius || !source.isActive) {
      return 0;
    }

    // Base attenuation (inverse square law)
    let noiseLevel = source.intensity / (1 + distance * distance * source.attenuation);

    // Material absorption effect
    const absorptionFactor = 1 - source.materialAbsorption;
    noiseLevel *= absorptionFactor;

    // Directional attenuation for cone sources
    if (source.direction && source.coneAngle && source.coneAttenuation) {
      const directionToTarget = targetPosition.subtract(source.position).normalize();
      const angle = Math.acos(BABYLON.Vector3.Dot(source.direction.normalize(), directionToTarget));
      const angleDegrees = angle * (180 / Math.PI);

      if (angleDegrees > source.coneAngle / 2) {
        // Outside cone - apply additional attenuation
        noiseLevel *= source.coneAttenuation;
      }
    }

    return Math.max(0, noiseLevel);
  };

  // Create noise source visualization - returns all meshes for proper cleanup
  const createNoiseSourceMeshes = (source: NoiseSource, meshList: BABYLON.Mesh[]): void => {
    if (!scene.isReady()) return;
    // Create sphere for noise source
    const sphere = BABYLON.MeshBuilder.CreateSphere(`noiseSource_${source.id}`, {
      diameter: 2
    }, scene);
    sphere.position.copyFrom(source.position);

    const material = new BABYLON.StandardMaterial(`noiseMat_${source.id}`, scene);
    switch (source.type) {
      case 'traffic':
        material.diffuseColor = new BABYLON.Color3(1.0, 0.5, 0.0);
        break;
      case 'construction':
        material.diffuseColor = new BABYLON.Color3(1.0, 0.0, 0.0);
        break;
      case 'industrial':
        material.diffuseColor = new BABYLON.Color3(0.5, 0.0, 0.5);
        break;
      case 'residential':
        material.diffuseColor = new BABYLON.Color3(0.0, 0.5, 0.0);
        break;
      default:
        material.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    }
    material.alpha = source.isActive ? 1.0 : 0.3;
    material.emissiveColor = material.diffuseColor.scale(0.3);
    sphere.material = material;
    meshList.push(sphere);

    // Create noise radius visualization
    const radiusMesh = BABYLON.MeshBuilder.CreateTorus(`noiseRadius_${source.id}`, {
      diameter: source.radius * 2,
      thickness: 0.5,
      tessellation: 32
    }, scene);
    radiusMesh.position.copyFrom(source.position);
    radiusMesh.rotation.x = Math.PI / 2;
    const radiusMaterial = new BABYLON.StandardMaterial(`radiusMat_${source.id}`, scene);
    radiusMaterial.diffuseColor = material.diffuseColor.clone();
    radiusMaterial.alpha = 0.3;
    radiusMaterial.wireframe = true;
    radiusMesh.material = radiusMaterial;
    meshList.push(radiusMesh);

    if (source.direction && source.coneAngle) {
      const coneMesh = BABYLON.MeshBuilder.CreateCylinder(`cone_${source.id}`, {
        diameterTop: 0,
        diameterBottom: source.radius * 2,
        height: source.radius,
        tessellation: 32,
        subdivisions: 1,
        updatable: false
      }, scene);
      coneMesh.position.copyFrom(source.position);
      const targetPosition = source.position.add(source.direction.normalize().scale(source.radius));
      coneMesh.lookAt(targetPosition);
      const coneMaterial = new BABYLON.StandardMaterial(`coneMat_${source.id}`, scene);
      coneMaterial.diffuseColor = material.diffuseColor.clone();
      coneMaterial.alpha = 0.2;
      coneMaterial.backFaceCulling = false;
      coneMesh.material = coneMaterial;
      meshList.push(coneMesh);
    }
  };

  // Create noise map visualization
  const createNoiseMap = () => {
    if (!scene.isReady()) return;
    if (noiseMapRef.current) {
      noiseMapRef.current.dispose();
      noiseMapRef.current = null;
    }

    const mapSize = 200;
    const resolution = 50;

    // Create ground plane for noise map
    const noiseMap = BABYLON.MeshBuilder.CreateGround('noiseMap', {
      width: mapSize,
      height: mapSize,
      subdivisions: resolution
    }, scene);

    noiseMap.position.y = 0.1; // Slightly above ground

    // Calculate noise levels for each point
    const positions = noiseMap.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const colors: number[] = [];

    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];

        // Calculate noise level at this point
        let totalNoise = 0;
        const targetPosition = new BABYLON.Vector3(x, 0, z);
        noiseSources.forEach(source => {
          const noiseLevel = calculateNoiseLevel(source, targetPosition);
          totalNoise += noiseLevel;
        });

        // Color based on noise level
        let r = 0, g = 0, b = 0;
        if (totalNoise > noiseThreshold) {
          // High noise - red
          r = Math.min(1, totalNoise / 100);
          g = 0;
          b = 0;
        } else if (totalNoise > noiseThreshold * 0.7) {
          // Medium noise - yellow
          r = 1;
          g = 1;
          b = 0;
        } else if (totalNoise > noiseThreshold * 0.4) {
          // Low noise - green
          r = 0;
          g = 1;
          b = 0;
        } else {
          // Very low noise - blue
          r = 0;
          g = 0;
          b = 1;
        }

        colors.push(r, g, b, 0.6); // RGBA
      }

      noiseMap.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    }

    const mapMaterial = new BABYLON.StandardMaterial('noiseMapMaterial', scene);
    mapMaterial.alpha = 0.6;
    mapMaterial.disableLighting = true;
    noiseMap.material = mapMaterial;

    noiseMapRef.current = noiseMap;
    return noiseMap;
  };

  // Add noise source at clicked position
  const addNoiseSource = (position: BABYLON.Vector3) => {
    const newSource: NoiseSource = {
      id: `noise_${Date.now()}`,
      position: position,
      type: selectedSourceType,
      isActive: true,
      name: `${selectedSourceType} Source`,
      ...noisePresets[selectedSourceType]
    };

    setNoiseSources(prev => [...prev, newSource]);
  };

  // Start editing a noise source
  const startEditingSource = (sourceId: string) => {
    setEditingSourceId(sourceId);
  };

  // Stop editing noise source
  const stopEditingSource = () => {
    setEditingSourceId(null);
  };

  // Update noise source property
  const updateNoiseSource = (sourceId: string, updatedProps: Partial<NoiseSource>) => {
    setNoiseSources(prev =>
      prev.map(source => (source.id === sourceId ? { ...source, ...updatedProps } : source))
    );
  };

  // Remove noise source
  const removeNoiseSource = (sourceId: string) => {
    setNoiseSources(prev => prev.filter(source => source.id !== sourceId));
  };

  // Calculate total noise data
  const calculateNoiseData = (): NoiseData => {
    const affectedAreas: BABYLON.Vector3[] = [];
    let totalNoise = 0;

    // Sample points across the area
    const samplePoints = 20;
    const areaSize = 100;

    for (let x = 0; x < samplePoints; x++) {
      for (let z = 0; z < samplePoints; z++) {
        const posX = (x / samplePoints - 0.5) * areaSize * 2;
        const posZ = (z / samplePoints - 0.5) * areaSize * 2;

        let noiseLevel = 0;
        const targetPosition = new BABYLON.Vector3(posX, 0, posZ);
        noiseSources.forEach(source => {
          noiseLevel += calculateNoiseLevel(source, targetPosition);
        });

        if (noiseLevel > noiseThreshold) {
          affectedAreas.push(new BABYLON.Vector3(posX, 0, posZ));
        }
        totalNoise = Math.max(totalNoise, noiseLevel);
      }
    }

    return {
      sources: noiseSources,
      totalNoise,
      affectedAreas
    };
  };

  // Update noise visualization
  const updateNoiseVisualization = () => {
    if (!scene.isReady()) return;
    noiseMeshesRef.current.forEach(mesh => {
      mesh.material?.dispose();
      mesh.dispose();
    });
    noiseMeshesRef.current = [];

    noiseSources.forEach(source => {
      createNoiseSourceMeshes(source, noiseMeshesRef.current);
    });

    if (showNoiseMap) {
      createNoiseMap();
    } else if (noiseMapRef.current) {
      noiseMapRef.current.dispose();
      noiseMapRef.current = null;
    }

    const noiseData = calculateNoiseData();
    onNoiseChange?.(noiseData);
  };

  // Handle pointer events for adding noise sources (only when clicking 3D scene, not UI)
  useEffect(() => {
    if (!isActive) return;

    const handlePointerDown = (event: BABYLON.PointerInfo) => {
      if (event.type !== BABYLON.PointerEventTypes.POINTERDOWN || !event.pickInfo?.hit) return;
      const pickedPoint = event.pickInfo.pickedPoint;
      if (pickedPoint) {
        addNoiseSource(pickedPoint.clone());
      }
    };

    scene.onPointerObservable.add(handlePointerDown);

    return () => {
      scene.onPointerObservable.removeCallback(handlePointerDown);
    };
  }, [isActive, selectedSourceType]);

  // Update visualization when sources change, clear when inactive
  useEffect(() => {
    if (isActive) {
      updateNoiseVisualization();
      updateAudioSources();
    } else {
      noiseMeshesRef.current.forEach(mesh => {
        mesh.material?.dispose();
        mesh.dispose();
      });
      noiseMeshesRef.current = [];
      if (noiseMapRef.current) {
        noiseMapRef.current.dispose();
        noiseMapRef.current = null;
      }
    }
  }, [noiseSources, showNoiseMap, noiseThreshold, isActive, isAudioEnabled, audioVolume]);

  // Real-time listener position update (sync audio with camera)
  useEffect(() => {
    if (!isAudioEnabled || !audioContextRef.current) return;
    const obs = scene.onBeforeRenderObservable.add(() => {
      updateListenerPosition();
    });
    return () => {
      scene.onBeforeRenderObservable.remove(obs);
    };
  }, [isAudioEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      noiseMeshesRef.current.forEach(mesh => {
        mesh.material?.dispose();
        mesh.dispose();
      });
      noiseMeshesRef.current = [];
      if (noiseMapRef.current) {
        noiseMapRef.current.dispose();
        noiseMapRef.current = null;
      }
    };
  }, []);

  // Toggle noise simulation
  const toggleNoiseSimulation = () => {
    setIsActive(prev => {
      if (prev) {
        return false;
      }
      return true;
    });
  };

  // Clear all noise sources
  const clearNoiseSources = () => {
    setNoiseSources([]);
  };

  // Initialize Web Audio API
  const initializeAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        listenerRef.current = audioContextRef.current.listener;
      }

      // Resume context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setIsAudioEnabled(true);
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
      setIsAudioEnabled(false);
    }
  };

  // Create audio source for a noise source
  const createAudioSource = (source: NoiseSource): { oscillator: OscillatorNode; panner: PannerNode; gain: GainNode } | null => {
    if (!audioContextRef.current) return null;

    const oscillator = audioContextRef.current.createOscillator();
    const panner = audioContextRef.current.createPanner();
    const gainNode = audioContextRef.current.createGain();

    // Configure oscillator based on noise type
    oscillator.frequency.setValueAtTime(source.frequency, audioContextRef.current.currentTime);

    // Set oscillator type based on noise characteristics
    switch (source.type) {
      case 'traffic':
        oscillator.type = 'sawtooth'; // Harsh, mechanical sound
        break;
      case 'construction':
        oscillator.type = 'square'; // Pulsing, rhythmic sound
        break;
      case 'industrial':
        oscillator.type = 'triangle'; // Steady, humming sound
        break;
      case 'residential':
        oscillator.type = 'sine'; // Softer, natural sound
        break;
      default:
        oscillator.type = 'sine';
    }

    // Configure panner for spatial audio
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = source.radius;
    panner.rolloffFactor = source.attenuation * 1000;

    // Set position
    panner.positionX.setValueAtTime(source.position.x, audioContextRef.current.currentTime);
    panner.positionY.setValueAtTime(source.position.y, audioContextRef.current.currentTime);
    panner.positionZ.setValueAtTime(source.position.z, audioContextRef.current.currentTime);

    // Configure gain based on intensity
    const volume = (source.intensity / 150) * audioVolume * (source.isActive ? 1 : 0);
    gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(audioContextRef.current.destination);

    // Start oscillator
    oscillator.start();

    return { oscillator, panner, gain: gainNode };
  };

  // Update audio sources
  const updateAudioSources = () => {
    if (!audioContextRef.current || !isAudioEnabled) return;

    // Remove audio sources for deleted noise sources
    const currentIds = new Set(noiseSources.map(s => s.id));
    audioSourcesRef.current.forEach((audioSource, id) => {
      if (!currentIds.has(id) && audioSource) {
        audioSource!.oscillator.stop();
        audioSourcesRef.current.delete(id);
      }
    });

    // Update or create audio sources for each noise source
    noiseSources.forEach(source => {
      let audioSource = audioSourcesRef.current.get(source.id);

      if (!audioSource) {
        // Create new audio source
        audioSource = createAudioSource(source);
        if (audioSource) {
          audioSourcesRef.current.set(source.id, audioSource);
        }
      } else if (audioSource) {
        // Update existing audio source
        const { oscillator, panner, gain } = audioSource!;

        // Update frequency
        oscillator.frequency.setValueAtTime(source.frequency, audioContextRef.current!.currentTime);

        // Update position
        panner.positionX.setValueAtTime(source.position.x, audioContextRef.current!.currentTime);
        panner.positionY.setValueAtTime(source.position.y, audioContextRef.current!.currentTime);
        panner.positionZ.setValueAtTime(source.position.z, audioContextRef.current!.currentTime);

        // Update max distance and rolloff
        panner.maxDistance = source.radius;
        panner.rolloffFactor = source.attenuation * 1000;

        // Update volume
        const volume = (source.intensity / 150) * audioVolume * (source.isActive ? 1 : 0);
        gain.gain.setValueAtTime(volume, audioContextRef.current!.currentTime);
      }
    });
  };

  // Update listener position based on camera
  const updateListenerPosition = () => {
    if (!listenerRef.current || !scene.activeCamera) return;

    const camera = scene.activeCamera;
    listenerRef.current.positionX.setValueAtTime(camera.position.x, audioContextRef.current!.currentTime);
    listenerRef.current.positionY.setValueAtTime(camera.position.y, audioContextRef.current!.currentTime);
    listenerRef.current.positionZ.setValueAtTime(camera.position.z, audioContextRef.current!.currentTime);

    // Set listener orientation (forward and up vectors)
    const forward = camera.getDirection(BABYLON.Vector3.Forward());
    const up = camera.upVector;

    listenerRef.current.forwardX.setValueAtTime(forward.x, audioContextRef.current!.currentTime);
    listenerRef.current.forwardY.setValueAtTime(forward.y, audioContextRef.current!.currentTime);
    listenerRef.current.forwardZ.setValueAtTime(forward.z, audioContextRef.current!.currentTime);

    listenerRef.current.upX.setValueAtTime(up.x, audioContextRef.current!.currentTime);
    listenerRef.current.upY.setValueAtTime(up.y, audioContextRef.current!.currentTime);
    listenerRef.current.upZ.setValueAtTime(up.z, audioContextRef.current!.currentTime);
  };

  // Toggle audio
  const toggleAudio = async () => {
    if (!isAudioEnabled) {
      await initializeAudio();
    } else {
      // Stop all audio sources
      audioSourcesRef.current.forEach(audioSource => {
        if (audioSource) {
          audioSource.oscillator.stop();
        }
      });
      audioSourcesRef.current.clear();
      setIsAudioEnabled(false);
    }
  };

  // Cleanup audio
  const cleanupAudio = () => {
    audioSourcesRef.current.forEach(audioSource => {
      if (audioSource) {
        audioSource.oscillator.stop();
      }
    });
    audioSourcesRef.current.clear();

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const noiseData = calculateNoiseData();

  // Render UI for editing noise source properties
  const renderSourceEditor = () => {
    if (!editingSourceId) return null;

    const source = noiseSources.find(s => s.id === editingSourceId);
    if (!source) return null;

    return (
      <div className={styles.sourceEditor}>
        <h4>Edit Noise Source</h4>

        <label>
          Name:
          <input
            type="text"
            value={source.name}
            onChange={e => updateNoiseSource(source.id, { name: e.target.value })}
          />
        </label>

        <label>
          Intensity (dB):
          <input
            type="number"
            value={source.intensity}
            min={0}
            max={150}
            onChange={e => updateNoiseSource(source.id, { intensity: parseFloat(e.target.value) })}
          />
        </label>

        <label>
          Radius (m):
          <input
            type="number"
            value={source.radius}
            min={1}
            max={500}
            onChange={e => updateNoiseSource(source.id, { radius: parseFloat(e.target.value) })}
          />
        </label>

        <label>
          Frequency (Hz):
          <input
            type="number"
            value={source.frequency}
            min={20}
            max={20000}
            onChange={e => updateNoiseSource(source.id, { frequency: parseFloat(e.target.value) })}
          />
        </label>

        <label>
          Attenuation:
          <input
            type="number"
            value={source.attenuation}
            min={0}
            max={0.01}
            step={0.0001}
            onChange={e => updateNoiseSource(source.id, { attenuation: parseFloat(e.target.value) })}
          />
        </label>

        <label>
          Material Absorption:
          <input
            type="number"
            value={source.materialAbsorption}
            min={0}
            max={1}
            step={0.01}
            onChange={e => updateNoiseSource(source.id, { materialAbsorption: parseFloat(e.target.value) })}
          />
        </label>

        <label>
          Active:
          <input
            type="checkbox"
            checked={source.isActive}
            onChange={e => updateNoiseSource(source.id, { isActive: e.target.checked })}
          />
        </label>

        {/* Directional Controls */}
        <div className={styles.directionalSettings}>
          <h5>Directional Settings</h5>

          <label>
            Direction X:
            <input
              type="number"
              value={source.direction?.x || 0}
              min={-1}
              max={1}
              step={0.1}
              onChange={e => updateNoiseSource(source.id, {
                direction: new BABYLON.Vector3(
                  parseFloat(e.target.value),
                  source.direction?.y || 0,
                  source.direction?.z || 0
                )
              })}
            />
          </label>

          <label>
            Direction Y:
            <input
              type="number"
              value={source.direction?.y || 1}
              min={-1}
              max={1}
              step={0.1}
              onChange={e => updateNoiseSource(source.id, {
                direction: new BABYLON.Vector3(
                  source.direction?.x || 0,
                  parseFloat(e.target.value),
                  source.direction?.z || 0
                )
              })}
            />
          </label>

          <label>
            Direction Z:
            <input
              type="number"
              value={source.direction?.z || 0}
              min={-1}
              max={1}
              step={0.1}
              onChange={e => updateNoiseSource(source.id, {
                direction: new BABYLON.Vector3(
                  source.direction?.x || 0,
                  source.direction?.y || 1,
                  parseFloat(e.target.value)
                )
              })}
            />
          </label>

          <label>
            Cone Angle (°):
            <input
              type="number"
              value={source.coneAngle || 60}
              min={10}
              max={180}
              onChange={e => updateNoiseSource(source.id, { coneAngle: parseFloat(e.target.value) })}
            />
          </label>

          <label>
            Cone Attenuation:
            <input
              type="number"
              value={source.coneAttenuation || 0.3}
              min={0}
              max={1}
              step={0.1}
              onChange={e => updateNoiseSource(source.id, { coneAttenuation: parseFloat(e.target.value) })}
            />
          </label>
        </div>

        <div className={styles.editorButtons}>
          <button
            type="button"
            onClick={() => removeNoiseSource(source.id)}
            className={styles.removeButton}
          >
            Remove
          </button>
          <button
            type="button"
            onClick={stopEditingSource}
            className={styles.closeButton}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderSourceEditor()}
      <div className={styles.container} style={{ pointerEvents: 'auto' }}>
        <h3>Noise Simulation</h3>

        {/* Simulation Toggle */}
        <div className={styles.simulationToggle}>
          <button
            type="button"
            onClick={toggleNoiseSimulation}
            className={`${styles.simulationToggleButton} ${isActive ? styles.activeButton : styles.inactiveButton}`}
          >
            {isActive ? 'Stop Simulation' : 'Start Simulation'}
          </button>
        </div>

        {/* Noise Source Type Selection */}
        <div className={styles.sourceTypeSelection}>
          <h4>Noise Source Type</h4>
          <div className={styles.typeButtons}>
            {Object.keys(noisePresets).map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setSelectedSourceType(type as NoiseSource['type'])}
                className={`${styles.typeButton} ${selectedSourceType === type ? styles.selectedType : styles.defaultType}`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Noise Controls */}
        <div className={styles.noiseControls}>
          <h4>Noise Parameters</h4>

          {/* Noise Threshold */}
          <div className={styles.thresholdControl}>
            <label htmlFor="noise-threshold">
              Threshold: {noiseThreshold} dB
            </label>
            <input
              id="noise-threshold"
              type="range"
              min="30"
              max="100"
              step="5"
              value={noiseThreshold}
              onChange={(e) => setNoiseThreshold(parseInt(e.target.value))}
            />
          </div>

          {/* Show Noise Map */}
          <div className={styles.noiseMapControl}>
            <label htmlFor="show-noise-map">
              <input
                id="show-noise-map"
                type="checkbox"
                checked={showNoiseMap}
                onChange={(e) => setShowNoiseMap(e.target.checked)}
              />
              Show Noise Map
            </label>
          </div>

          {/* Spatial Audio Toggle */}
          <div className={styles.noiseMapControl}>
            <button
              type="button"
              onClick={toggleAudio}
              className={`${styles.simulationToggleButton} ${isAudioEnabled ? styles.activeButton : styles.inactiveButton}`}
              style={{ width: '100%', marginTop: 4 }}
            >
              {isAudioEnabled ? '🔊 Sound On - Click to Mute' : '🔇 Click to Hear Noise Sources'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className={styles.instructions}>
          <h4>Instructions</h4>
          <div>
            {isActive ? 'Click on the ground to add noise sources.' : 'Start simulation to add noise sources.'}
          </div>
          <div>
            Color Legend: Red (High), Yellow (Medium), Green (Low), Blue (Very Low)
          </div>
        </div>

        {/* Noise Statistics */}
        <div className={styles.statistics}>
          <h4>Statistics</h4>
          <div>
            <div>Sources: {noiseSources.length}</div>
            <div>Max Noise: {noiseData.totalNoise.toFixed(1)} dB</div>
            <div>Affected Areas: {noiseData.affectedAreas.length}</div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className={styles.controlButtons}>
          <div>
            <button
              type="button"
              onClick={clearNoiseSources}
              disabled={!isActive}
              className={`${styles.clearButton} ${!isActive ? styles.disabled : ''}`}
            >
              Clear Sources
            </button>
          </div>

          <div className={styles.footerText}>
            Spatial audio simulation with noise mapping and environmental impact analysis
          </div>
        </div>
      </div>
    </>
  );
};

export default NoiseSimulation;
