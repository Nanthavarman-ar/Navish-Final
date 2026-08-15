import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import './TopographyGenerator.css';

interface TopographyGeneratorProps {
  scene: BABYLON.Scene;
  onTerrainGenerated?: (terrainMesh: BABYLON.Mesh) => void;
}

interface TerrainPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  heightScale: number;
  roughness: number;
  octaves: number;
}

const TopographyGenerator: React.FC<TopographyGeneratorProps> = ({ scene, onTerrainGenerated }) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('hills');
  const [heightScale, setHeightScale] = useState<number>(5);
  const [roughness, setRoughness] = useState<number>(0.5);
  const [octaves, setOctaves] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  const terrainMeshRef = useRef<BABYLON.Mesh | null>(null);
  const heightMapRef = useRef<number[][]>([]);

  const terrainPresets: TerrainPreset[] = [
    {
      id: 'flat',
      name: 'Flat',
      icon: '🏞️',
      description: 'Level terrain for urban planning',
      heightScale: 1,
      roughness: 0.1,
      octaves: 2
    },
    {
      id: 'hills',
      name: 'Hills',
      icon: '🏔️',
      description: 'Rolling hills landscape',
      heightScale: 5,
      roughness: 0.5,
      octaves: 4
    },
    {
      id: 'mountains',
      name: 'Mountains',
      icon: '⛰️',
      description: 'Rugged mountain terrain',
      heightScale: 15,
      roughness: 0.8,
      octaves: 6
    },
    {
      id: 'valley',
      name: 'Valley',
      icon: '🌾',
      description: 'Low-lying valley terrain',
      heightScale: 3,
      roughness: 0.3,
      octaves: 3
    },
    {
      id: 'plateau',
      name: 'Plateau',
      icon: '🏜️',
      description: 'Elevated flat terrain',
      heightScale: 8,
      roughness: 0.2,
      octaves: 2
    }
  ];

  // Perlin noise function for terrain generation
  const noise = (x: number, y: number, octaves: number, roughness: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 0.01;

    for (let i = 0; i < octaves; i++) {
      value += Math.sin(x * frequency) * Math.cos(y * frequency) * amplitude;
      amplitude *= roughness;
      frequency *= 2;
    }

    return value;
  };

  // Generate height map
  const generateHeightMap = (width: number, height: number): number[][] => {
    const heightMap: number[][] = [];

    for (let y = 0; y < height; y++) {
      heightMap[y] = [];
      for (let x = 0; x < width; x++) {
        const nx = x / width - 0.5;
        const ny = y / height - 0.5;
        heightMap[y][x] = noise(nx * 100, ny * 100, octaves, roughness) * heightScale;
      }
    }

    return heightMap;
  };

  // Create terrain mesh from height map
  const createTerrainMesh = (heightMap: number[][]): BABYLON.Mesh => {
    const width = heightMap[0].length;
    const height = heightMap.length;

    // Create ground mesh
    const terrain = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
      'terrain',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      {
        width: 200,
        height: 200,
        subdivisions: 128,
        minHeight: -heightScale,
        maxHeight: heightScale,
        onReady: (mesh) => {
          // Apply custom height data
          const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
          if (positions) {
            for (let i = 0; i < positions.length; i += 3) {
              const x = Math.floor((positions[i] + 100) / 200 * (width - 1));
              const z = Math.floor((positions[i + 2] + 100) / 200 * (height - 1));

              if (x >= 0 && x < width && z >= 0 && z < height) {
                positions[i + 1] = heightMap[z][x];
              }
            }
            mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
            mesh.createNormals(true);
          }
        }
      },
      scene
    );

    // Create material
    const terrainMaterial = new BABYLON.StandardMaterial('terrainMaterial', scene);

    // Create texture based on height
    const textureSize = 512;
    const textureData = new Uint8Array(textureSize * textureSize * 4);

    for (let y = 0; y < textureSize; y++) {
      for (let x = 0; x < textureSize; x++) {
        const heightValue = heightMap[Math.floor(y / textureSize * height)][Math.floor(x / textureSize * width)];
        const normalizedHeight = (heightValue + heightScale) / (heightScale * 2);

        const index = (y * textureSize + x) * 4;

        if (normalizedHeight < 0.3) {
          // Water/low areas - blue
          textureData[index] = 100;     // R
          textureData[index + 1] = 149; // G
          textureData[index + 2] = 237; // B
        } else if (normalizedHeight < 0.6) {
          // Grass/medium areas - green
          textureData[index] = 34;      // R
          textureData[index + 1] = 139; // G
          textureData[index + 2] = 34;  // B
        } else {
          // Rock/high areas - brown/gray
          textureData[index] = 139;     // R
          textureData[index + 1] = 69;  // G
          textureData[index + 2] = 19;  // B
        }
        textureData[index + 3] = 255; // A
      }
    }

    const texture = new BABYLON.RawTexture(
      textureData,
      textureSize,
      textureSize,
      BABYLON.Engine.TEXTUREFORMAT_RGBA,
      scene,
      false,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE
    );

    terrainMaterial.diffuseTexture = texture;
    terrain.material = terrainMaterial;

    return terrain;
  };

  // Generate terrain with progress tracking
  const generateTerrain = async (preset: TerrainPreset) => {
    setIsGenerating(true);
    setGenerationProgress(0);

    // Clear existing terrain
    if (terrainMeshRef.current) {
      terrainMeshRef.current.dispose();
      terrainMeshRef.current = null;
    }

    setGenerationProgress(25);

    // Generate height map
    const heightMap = generateHeightMap(128, 128);
    heightMapRef.current = heightMap;

    setGenerationProgress(50);

    // Create terrain mesh
    const terrainMesh = createTerrainMesh(heightMap);
    terrainMeshRef.current = terrainMesh;

    setGenerationProgress(75);

    // Add some random vegetation
    addVegetation(terrainMesh, heightMap);

    setGenerationProgress(100);
    setIsGenerating(false);

    onTerrainGenerated?.(terrainMesh);
  };

  // Debounced real-time terrain generation
  const debouncedGenerateTerrain = useCallback(debounce((preset: TerrainPreset) => {
    generateTerrain(preset);
  }, 300), [heightScale, roughness, octaves]);

  // Update handlers for real-time parameter changes
  useEffect(() => {
    if (selectedPreset === 'custom') {
      const customPreset: TerrainPreset = {
        id: 'custom',
        name: 'Custom',
        icon: '🎨',
        description: 'Custom terrain parameters',
        heightScale,
        roughness,
        octaves
      };
      debouncedGenerateTerrain(customPreset);
    }
  }, [heightScale, roughness, octaves, selectedPreset, debouncedGenerateTerrain]);

  // Debounce utility function
  function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Add vegetation to terrain
  const addVegetation = (terrain: BABYLON.Mesh, heightMap: number[][]) => {
    const vegetationCount = 50;

    for (let i = 0; i < vegetationCount; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;

      // Get height at this position
      const heightX = Math.floor((x + 100) / 200 * 127);
      const heightZ = Math.floor((z + 100) / 200 * 127);
      const y = heightMap[heightZ]?.[heightX] || 0;

      if (y > 0) { // Only place vegetation above water level
        const tree = BABYLON.MeshBuilder.CreateCylinder(`tree_${i}`, {
          height: 3 + Math.random() * 2,
          diameterTop: 0.5,
          diameterBottom: 0.8
        }, scene);

        tree.position = new BABYLON.Vector3(x, y, z);

        const treeMaterial = new BABYLON.StandardMaterial(`treeMat_${i}`, scene);
        treeMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1);
        tree.material = treeMaterial;

        // Add foliage
        const foliage = BABYLON.MeshBuilder.CreateSphere(`foliage_${i}`, {
          diameter: 2 + Math.random()
        }, scene);

        foliage.position = new BABYLON.Vector3(x, y + tree.scaling.y / 2 + foliage.scaling.y / 2, z);

        const foliageMaterial = new BABYLON.StandardMaterial(`foliageMat_${i}`, scene);
        foliageMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.2);
        foliage.material = foliageMaterial;
      }
    }
  };

  // Apply preset
  const applyPreset = (preset: TerrainPreset) => {
    setSelectedPreset(preset.id);
    setHeightScale(preset.heightScale);
    setRoughness(preset.roughness);
    setOctaves(preset.octaves);
    generateTerrain(preset);
  };

  // Custom terrain generation
  const generateCustomTerrain = () => {
    const customPreset: TerrainPreset = {
      id: 'custom',
      name: 'Custom',
      icon: '🎨',
      description: 'Custom terrain parameters',
      heightScale,
      roughness,
      octaves
    };
    generateTerrain(customPreset);
  };

  // Clear terrain
  const clearTerrain = () => {
    if (terrainMeshRef.current) {
      terrainMeshRef.current.dispose();
      terrainMeshRef.current = null;
    }
    heightMapRef.current = [];
    setGenerationProgress(0);
  };

  // File upload for heightmap
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // This would process the uploaded heightmap image
        console.log('Heightmap file loaded:', file.name);
        // For now, just generate a random terrain
        generateCustomTerrain();
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="topography-generator">
      <h3>Topography Generator</h3>

      {/* Preset Selection */}
      <div className="preset-section">
        <h4>Terrain Presets</h4>
        <div className="preset-grid">
          {terrainPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              disabled={isGenerating}
              className={`preset-button ${selectedPreset === preset.id ? 'selected' : ''}`}
              title={preset.description}
              aria-label={`Select terrain preset: ${preset.name}`}
            >
              <div className="preset-button-icon">{preset.icon}</div>
              <div>{preset.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Parameters */}
      <div className="custom-params">
        <h4>Custom Parameters</h4>

        {/* Height Scale */}
        <div className="param-group">
          <label htmlFor="heightScale" className="param-label">
            Height Scale: {heightScale.toFixed(1)}m
          </label>
          <input
            id="heightScale"
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={heightScale}
            onChange={(e) => setHeightScale(parseFloat(e.target.value))}
            className="param-input"
            aria-label="Height Scale"
          />
        </div>

        {/* Roughness */}
        <div className="param-group">
          <label htmlFor="roughness" className="param-label">
            Roughness: {(roughness * 100).toFixed(0)}%
          </label>
          <input
            id="roughness"
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={roughness}
            onChange={(e) => setRoughness(parseFloat(e.target.value))}
            className="param-input"
            aria-label="Roughness"
          />
        </div>

        {/* Octaves */}
        <div className="param-group">
          <label htmlFor="octaves" className="param-label">
            Detail Level: {octaves}
          </label>
          <input
            id="octaves"
            type="range"
            min="1"
            max="8"
            step="1"
            value={octaves}
            onChange={(e) => setOctaves(parseInt(e.target.value))}
            className="param-input"
            aria-label="Detail Level"
          />
        </div>
      </div>

      {/* File Upload */}
      <div className="file-upload-section">
        <h4>Import Heightmap</h4>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="file-input"
          aria-label="Import Heightmap file"
        />
      </div>

      {/* Generation Progress */}
      {isGenerating && (
        <div className="progress-section">
          <div className="progress-text">
            Generating terrain... {generationProgress.toFixed(0)}%
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="control-buttons">
        <div className="buttons-container">
          <button
            onClick={generateCustomTerrain}
            disabled={isGenerating}
            className="generate-button"
          >
            Generate Terrain
          </button>
          <button
            onClick={clearTerrain}
            disabled={isGenerating}
            className="clear-button"
          >
            Clear Terrain
          </button>
        </div>

        <div className="footer-text">
          AI-powered terrain generation creates realistic landscapes for site analysis and visualization
        </div>
      </div>
    </div>
  );
};

export default TopographyGenerator;
