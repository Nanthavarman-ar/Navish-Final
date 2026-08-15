import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import './SoundPrivacySimulation.css';

interface SoundPrivacySimulationProps {
  scene: BABYLON.Scene;
  onPrivacyUpdate?: (privacyData: PrivacyData) => void;
}

interface PrivacyData {
  soundSources: SoundSource[];
  privacyZones: PrivacyZone[];
  leakagePaths: LeakagePath[];
  overallPrivacy: number;
  recommendations: string[];
}

interface SoundSource {
  id: string;
  position: BABYLON.Vector3;
  type: 'conversation' | 'music' | 'machinery' | 'traffic';
  volume: number; // dB
  frequency: number; // Hz
}

interface PrivacyZone {
  id: string;
  position: BABYLON.Vector3;
  size: BABYLON.Vector3;
  requiredPrivacy: number; // dB reduction needed
  currentPrivacy: number; // dB reduction achieved
}

interface LeakagePath {
  id: string;
  startPosition: BABYLON.Vector3;
  endPosition: BABYLON.Vector3;
  soundLevel: number; // dB
  pathType: 'direct' | 'reflected' | 'transmitted';
}

const SoundPrivacySimulation: React.FC<SoundPrivacySimulationProps> = ({ scene, onPrivacyUpdate }) => {
  const [soundSources, setSoundSources] = useState<SoundSource[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<SoundSource['type']>('conversation');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [showSoundWaves, setShowSoundWaves] = useState<boolean>(true);
  const [showPrivacyZones, setShowPrivacyZones] = useState<boolean>(true);
  const [showLeakagePaths, setShowLeakagePaths] = useState<boolean>(true);
  const [privacyThreshold, setPrivacyThreshold] = useState<number>(30); // dB

  const soundMeshesRef = useRef<BABYLON.Mesh[]>([]);
  const waveMeshesRef = useRef<BABYLON.Mesh[]>([]);
  const zoneMeshesRef = useRef<BABYLON.Mesh[]>([]);
  const pathMeshesRef = useRef<BABYLON.Mesh[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sound source presets
  const soundPresets = {
    conversation: { volume: 60, frequency: 2000, color: new BABYLON.Color3(1.0, 0.5, 0.0) },
    music: { volume: 75, frequency: 1000, color: new BABYLON.Color3(0.0, 1.0, 0.5) },
    machinery: { volume: 85, frequency: 500, color: new BABYLON.Color3(1.0, 0.0, 0.0) },
    traffic: { volume: 80, frequency: 300, color: new BABYLON.Color3(0.5, 0.5, 0.5) }
  };

  // Create sound source visualization
  const createSoundSourceMesh = (source: SoundSource): BABYLON.Mesh => {
    const preset = soundPresets[source.type];

    // Create sphere for sound source
    const sphere = BABYLON.MeshBuilder.CreateSphere(`soundSource_${source.id}`, {
      diameter: 0.5
    }, scene);

    sphere.position = source.position;

    const material = new BABYLON.StandardMaterial(`soundMat_${source.id}`, scene);
    material.diffuseColor = preset.color;
    material.emissiveColor = preset.color.scale(0.3);
    sphere.material = material;

    return sphere;
  };

  // Create sound wave visualization
  const createSoundWaves = (source: SoundSource): BABYLON.Mesh[] => {
    const waves: BABYLON.Mesh[] = [];
    const preset = soundPresets[source.type];
    const maxRadius = Math.min(10, source.volume / 2); // Sound propagation distance

    for (let i = 1; i <= 5; i++) {
      const radius = (maxRadius / 5) * i;
      const wave = BABYLON.MeshBuilder.CreateTorus(`wave_${source.id}_${i}`, {
        diameter: radius * 2,
        thickness: 0.05,
        tessellation: 32
      }, scene);

      wave.position = source.position;
      wave.rotation.x = Math.PI / 2;

      const material = new BABYLON.StandardMaterial(`waveMat_${source.id}_${i}`, scene);
      material.diffuseColor = preset.color;
      material.alpha = 0.3 - (i * 0.05);
      material.wireframe = true;
      wave.material = material;

      waves.push(wave);
    }

    return waves;
  };

  // Create privacy zones
  const createPrivacyZones = (): PrivacyZone[] => {
    const zones: PrivacyZone[] = [];

    // Detect rooms based on mesh arrangement
    const roomMeshes = scene.meshes.filter(mesh =>
      mesh.name.toLowerCase().includes('wall') ||
      mesh.name.toLowerCase().includes('floor') ||
      mesh.name.toLowerCase().includes('ceiling')
    );

    // Simple room detection - group meshes by proximity
    const rooms: BABYLON.Vector3[][] = [];
    roomMeshes.forEach(mesh => {
      let foundRoom = false;
      for (const room of rooms) {
        const center = room.reduce((sum, pos) => sum.add(pos), BABYLON.Vector3.Zero()).scale(1 / room.length);
        if (BABYLON.Vector3.Distance(center, mesh.position) < 5) {
          room.push(mesh.position);
          foundRoom = true;
          break;
        }
      }
      if (!foundRoom) {
        rooms.push([mesh.position]);
      }
    });

    // Create privacy zones for each detected room
    rooms.forEach((roomPositions, index) => {
      const center = roomPositions.reduce((sum, pos) => sum.add(pos), BABYLON.Vector3.Zero()).scale(1 / roomPositions.length);
      const size = new BABYLON.Vector3(4, 2.5, 4); // Typical room dimensions

      zones.push({
        id: `privacy_zone_${index}`,
        position: center,
        size: size,
        requiredPrivacy: privacyThreshold,
        currentPrivacy: 0 // Will be calculated
      });
    });

    return zones;
  };

  // Visualize privacy zones
  const visualizePrivacyZones = (zones: PrivacyZone[]) => {
    // Clear existing zones
    zoneMeshesRef.current.forEach(mesh => mesh.dispose());
    zoneMeshesRef.current = [];

    zones.forEach(zone => {
      const zoneMesh = BABYLON.MeshBuilder.CreateBox(`privacyZone_${zone.id}`, {
        width: zone.size.x,
        height: zone.size.y,
        depth: zone.size.z
      }, scene);

      zoneMesh.position = zone.position;

      const material = new BABYLON.StandardMaterial(`zoneMat_${zone.id}`, scene);
      // Color based on privacy level
      const privacyRatio = Math.min(zone.currentPrivacy / zone.requiredPrivacy, 1);
      if (privacyRatio < 0.5) {
        material.diffuseColor = new BABYLON.Color3(1.0, 0.0, 0.0); // Red - poor privacy
      } else if (privacyRatio < 0.8) {
        material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 0.0); // Yellow - moderate privacy
      } else {
        material.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.0); // Green - good privacy
      }

      material.alpha = 0.2;
      material.wireframe = true;
      zoneMesh.material = material;

      zoneMeshesRef.current.push(zoneMesh);
    });
  };

  // Calculate sound propagation and privacy
  const calculateSoundPropagation = (sources: SoundSource[], zones: PrivacyZone[]): {
    updatedZones: PrivacyZone[];
    leakagePaths: LeakagePath[];
  } => {
    const updatedZones = zones.map(zone => ({ ...zone }));
    const leakagePaths: LeakagePath[] = [];

    sources.forEach(source => {
      updatedZones.forEach(zone => {
        const distance = BABYLON.Vector3.Distance(source.position, zone.position);

        // Calculate sound attenuation (simplified)
        const attenuation = Math.max(0, source.volume - (distance * 2) - 10); // Basic distance attenuation

        // Check for barriers (walls)
        const barriers = scene.meshes.filter(mesh =>
          mesh.name.toLowerCase().includes('wall') &&
          isBetweenPoints(mesh.position, source.position, zone.position)
        );

        const barrierAttenuation = barriers.length * 20; // 20dB per wall
        const finalSoundLevel = Math.max(0, attenuation - barrierAttenuation);

        // Update zone privacy
        zone.currentPrivacy = Math.max(zone.currentPrivacy, zone.requiredPrivacy - finalSoundLevel);

        // Create leakage path if sound level is too high
        if (finalSoundLevel > privacyThreshold / 2) {
          leakagePaths.push({
            id: `leakage_${source.id}_${zone.id}`,
            startPosition: source.position,
            endPosition: zone.position,
            soundLevel: finalSoundLevel,
            pathType: barriers.length > 0 ? 'transmitted' : 'direct'
          });
        }
      });
    });

    return { updatedZones, leakagePaths };
  };

  // Helper function to check if a point is between two other points
  const isBetweenPoints = (point: BABYLON.Vector3, start: BABYLON.Vector3, end: BABYLON.Vector3): boolean => {
    const distance1 = BABYLON.Vector3.Distance(point, start);
    const distance2 = BABYLON.Vector3.Distance(point, end);
    const totalDistance = BABYLON.Vector3.Distance(start, end);

    return Math.abs(distance1 + distance2 - totalDistance) < 0.5;
  };

  // Visualize leakage paths
  const visualizeLeakagePaths = (paths: LeakagePath[]) => {
    // Clear existing paths
    pathMeshesRef.current.forEach(mesh => mesh.dispose());
    pathMeshesRef.current = [];

    paths.forEach(path => {
      // Create line between source and zone
      const points = [path.startPosition, path.endPosition];
      const line = BABYLON.MeshBuilder.CreateLines(`leakagePath_${path.id}`, {
        points: points
      }, scene);

      const material = new BABYLON.StandardMaterial(`pathMat_${path.id}`, scene);
      if (path.soundLevel > privacyThreshold) {
        material.diffuseColor = new BABYLON.Color3(1.0, 0.0, 0.0); // Red for high leakage
        material.emissiveColor = new BABYLON.Color3(0.5, 0.0, 0.0);
      } else {
        material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 0.0); // Yellow for moderate leakage
        material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.0);
      }

      line.material = material;
      pathMeshesRef.current.push(line);
    });
  };

  // Add sound source at clicked position
  const addSoundSource = (position: BABYLON.Vector3) => {
    const newSource: SoundSource = {
      id: `sound_${Date.now()}`,
      position: position,
      type: selectedSourceType,
      ...soundPresets[selectedSourceType]
    };

    setSoundSources(prev => [...prev, newSource]);
  };

  // Remove sound source
  const removeSoundSource = (sourceId: string) => {
    setSoundSources(prev => prev.filter(source => source.id !== sourceId));
  };

  // Update sound visualization
  const updateSoundVisualization = () => {
    if (!isActive) return;

    // Clear existing meshes
    soundMeshesRef.current.forEach(mesh => mesh.dispose());
    waveMeshesRef.current.forEach(mesh => mesh.dispose());
    soundMeshesRef.current = [];
    waveMeshesRef.current = [];

    // Create meshes for each sound source
    soundSources.forEach(source => {
      const sourceMesh = createSoundSourceMesh(source);
      soundMeshesRef.current.push(sourceMesh);

      if (showSoundWaves) {
        const waves = createSoundWaves(source);
        waveMeshesRef.current.push(...waves);
      }
    });

    // Create and analyze privacy zones
    const zones = createPrivacyZones();
    const { updatedZones, leakagePaths } = calculateSoundPropagation(soundSources, zones);

    if (showPrivacyZones) {
      visualizePrivacyZones(updatedZones);
    }

    if (showLeakagePaths) {
      visualizeLeakagePaths(leakagePaths);
    }

    // Calculate overall privacy
    const totalZones = updatedZones.length;
    const goodPrivacyZones = updatedZones.filter(zone => zone.currentPrivacy >= zone.requiredPrivacy).length;
    const overallPrivacy = totalZones > 0 ? (goodPrivacyZones / totalZones) * 100 : 100;

    // Generate recommendations
    const recommendations = generateRecommendations(updatedZones, leakagePaths);

    // Notify parent
    const privacyData: PrivacyData = {
      soundSources,
      privacyZones: updatedZones,
      leakagePaths,
      overallPrivacy,
      recommendations
    };

    onPrivacyUpdate?.(privacyData);
  };

  // Generate recommendations
  const generateRecommendations = (zones: PrivacyZone[], paths: LeakagePath[]): string[] => {
    const recommendations: string[] = [];

    const poorPrivacyZones = zones.filter(zone => zone.currentPrivacy < zone.requiredPrivacy * 0.5);
    if (poorPrivacyZones.length > 0) {
      recommendations.push(`${poorPrivacyZones.length} zones have poor acoustic privacy. Consider adding sound-absorbing materials.`);
    }

    if (paths.length > 0) {
      recommendations.push(`${paths.length} sound leakage paths detected. Review wall construction and add acoustic seals.`);
    }

    const highLeakagePaths = paths.filter(path => path.soundLevel > privacyThreshold);
    if (highLeakagePaths.length > 0) {
      recommendations.push(`${highLeakagePaths.length} critical leakage paths found. Immediate acoustic treatment recommended.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Acoustic privacy analysis complete. No major issues detected.');
    }

    return recommendations;
  };

  // Handle pointer events for adding sound sources
  useEffect(() => {
    if (!isActive) return;

    const handlePointerDown = (event: BABYLON.PointerInfo) => {
      if (event.type === BABYLON.PointerEventTypes.POINTERDOWN && event.pickInfo?.hit) {
        const pickedPoint = event.pickInfo.pickedPoint;
        if (pickedPoint) {
          addSoundSource(pickedPoint);
        }
      }
    };

    scene.onPointerObservable.add(handlePointerDown);

    return () => {
      scene.onPointerObservable.removeCallback(handlePointerDown);
    };
  }, [isActive, selectedSourceType]);

  // Update visualization when sources change
  useEffect(() => {
    updateSoundVisualization();
  }, [soundSources, showSoundWaves, showPrivacyZones, showLeakagePaths, privacyThreshold, isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundMeshesRef.current.forEach(mesh => mesh.dispose());
      waveMeshesRef.current.forEach(mesh => mesh.dispose());
      zoneMeshesRef.current.forEach(mesh => mesh.dispose());
      pathMeshesRef.current.forEach(mesh => mesh.dispose());
    };
  }, []);

  // Toggle sound simulation
  const toggleSoundSimulation = () => {
    setIsActive(!isActive);
    if (!isActive) {
      // Clear when activating
      setSoundSources([]);
    }
  };

  // Clear all sound sources
  const clearSoundSources = () => {
    setSoundSources([]);
  };

  const privacyData: PrivacyData = {
    soundSources,
    privacyZones: [],
    leakagePaths: [],
    overallPrivacy: 0,
    recommendations: []
  };

  return (
    <div className="sound-privacy-panel">
      <h3>Sound Privacy Simulation</h3>

      {/* Simulation Toggle */}
      <div className="simulation-toggle">
        <button
          onClick={toggleSoundSimulation}
          className={`toggle-button ${isActive ? 'active' : 'inactive'}`}
        >
          {isActive ? 'Stop Simulation' : 'Start Simulation'}
        </button>
      </div>

      {/* Sound Source Type Selection */}
      <div style={{ marginBottom: '16px' }}>
        <h4 className="section-title">Sound Source Type</h4>
        <div className="sound-type-grid">
          {Object.keys(soundPresets).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedSourceType(type as SoundSource['type'])}
              className={`sound-type-button ${selectedSourceType === type ? 'selected' : 'unselected'}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Privacy Controls */}
      <div className="privacy-section">
        <h4 className="section-title">Privacy Analysis</h4>

        {/* Privacy Threshold */}
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="privacy-threshold" className="privacy-threshold-label">
            Privacy Threshold: {privacyThreshold} dB
          </label>
          <input
            id="privacy-threshold"
            type="range"
            min="20"
            max="50"
            step="5"
            value={privacyThreshold}
            onChange={(e) => setPrivacyThreshold(parseInt(e.target.value))}
            className="privacy-threshold-input"
          />
        </div>

        {/* Visualization Options */}
        <div style={{ marginBottom: '8px' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showSoundWaves}
              onChange={(e) => setShowSoundWaves(e.target.checked)}
            />
            Show Sound Waves
          </label>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showPrivacyZones}
              onChange={(e) => setShowPrivacyZones(e.target.checked)}
            />
            Show Privacy Zones
          </label>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showLeakagePaths}
              onChange={(e) => setShowLeakagePaths(e.target.checked)}
            />
            Show Leakage Paths
          </label>
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions-section">
        <h4 className="section-title">Instructions</h4>
        <div className="instructions-text">
          {isActive ? 'Click to add sound sources and analyze acoustic privacy.' : 'Start simulation to analyze sound privacy.'}
        </div>
        <div className="color-legend">
          Color Legend: Red (Poor Privacy), Yellow (Moderate), Green (Good Privacy)
        </div>
      </div>

      {/* Statistics */}
      <div className="statistics-section">
        <h4 className="section-title">Statistics</h4>
        <div className="statistics-text">
          <div>Sources: {soundSources.length}</div>
          <div>Privacy Zones: {privacyData.privacyZones.length}</div>
          <div>Leakage Paths: {privacyData.leakagePaths.length}</div>
          <div>Overall Privacy: {privacyData.overallPrivacy.toFixed(1)}%</div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="control-buttons">
        <div className="control-buttons-row">
          <button
            onClick={clearSoundSources}
            disabled={!isActive}
            className={`clear-button ${isActive ? 'enabled' : 'disabled'}`}
          >
            Clear Sources
          </button>
        </div>

        <div className="footer-text">
          Acoustic privacy analysis with sound propagation modeling
        </div>
      </div>
    </div>
  );
};

export default SoundPrivacySimulation;
