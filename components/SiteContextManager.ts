import * as BABYLON from '@babylonjs/core';
import { Vector3, MeshBuilder, StandardMaterial, Color3, DynamicTexture } from '@babylonjs/core';
import { FeatureManager } from './FeatureManager';
import { GeoSyncManager, GeoLocation } from './GeoSyncManager';
import { ExternalAPIManager, MapLocation, WeatherData, TrafficData } from './ExternalAPIManager';
import { AIManager } from './AIManager';
import { SimulationManager } from './SimulationManager';
import { BIMManager } from './BIMManager';

export interface TerrainData {
  elevation: number;
  slope: number;
  aspect: number;
  roughness: number;
  vegetation: 'none' | 'sparse' | 'moderate' | 'dense';
  soilType: 'clay' | 'sandy' | 'loamy' | 'rocky';
}

export interface NoiseData {
  level: number; // dB
  source: 'traffic' | 'industrial' | 'construction' | 'ambient';
  frequency: number; // Hz
  position: Vector3;
  radius: number;
  timestamp: number;
}

export interface PollutionData {
  type: 'air' | 'water' | 'soil';
  level: number; // concentration or index
  source: string;
  position: Vector3;
  radius: number;
  healthImpact: number; // 0-100
  timestamp: number;
}

export interface SurroundingBuilding {
  id: string;
  name: string;
  type: 'residential' | 'commercial' | 'industrial' | 'public';
  height: number;
  footprint: Vector3; // width, depth, height
  position: Vector3;
  rotation: number; // degrees
  style: string;
  age: number; // years
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  mesh?: BABYLON.Mesh;
}

export interface ConstructionPhoto {
  id: string;
  filename: string;
  timestamp: Date;
  location: GeoLocation;
  cameraPosition: Vector3;
  cameraRotation: Vector3;
  fov: number;
  imageData?: string; // base64
  overlayMesh?: BABYLON.Mesh;
  alignmentPoints: Vector3[]; // points for alignment with 3D model
}

export interface SiteContextConfig {
  terrainEnabled: boolean;
  noiseSimulationEnabled: boolean;
  pollutionSimulationEnabled: boolean;
  surroundingBuildingsEnabled: boolean;
  constructionOverlayEnabled: boolean;
  realTimeUpdates: boolean;
  updateInterval: number; // seconds
  terrainResolution: number; // meters per pixel
  noiseRadius: number; // meters
  pollutionRadius: number; // meters
  buildingDensity: 'low' | 'medium' | 'high';
  maxSurroundingBuildings: number;
}

export class SiteContextManager {
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene;
  private featureManager: FeatureManager;
  private geoSyncManager: GeoSyncManager;
  private externalAPIManager: ExternalAPIManager;
  private aiManager: AIManager;
  private simulationManager: SimulationManager;
  private bimManager: BIMManager;

  private config: SiteContextConfig;
  private terrainMesh: BABYLON.Mesh | null = null;
  private terrainGroup: BABYLON.TransformNode | null = null;
  private noiseGroup: BABYLON.TransformNode | null = null;
  private pollutionGroup: BABYLON.TransformNode | null = null;
  private buildingsGroup: BABYLON.TransformNode | null = null;
  private overlayGroup: BABYLON.TransformNode | null = null;

  private terrainData: Map<string, TerrainData> = new Map();
  private noiseData: NoiseData[] = [];
  private pollutionData: PollutionData[] = [];
  private surroundingBuildings: SurroundingBuilding[] = [];
  private constructionPhotos: ConstructionPhoto[] = [];

  private updateInterval: number | null = null;
  private isInitialized: boolean = false;

  constructor(
    engine: BABYLON.Engine,
    scene: BABYLON.Scene,
    featureManager: FeatureManager,
    geoSyncManager: GeoSyncManager,
    externalAPIManager: ExternalAPIManager,
    aiManager: AIManager,
    simulationManager: SimulationManager,
    bimManager: BIMManager
  ) {
    this.engine = engine;
    this.scene = scene;
    this.featureManager = featureManager;
    this.geoSyncManager = geoSyncManager;
    this.externalAPIManager = externalAPIManager;
    this.aiManager = aiManager;
    this.simulationManager = simulationManager;
    this.bimManager = bimManager;

    this.config = {
      terrainEnabled: true,
      noiseSimulationEnabled: true,
      pollutionSimulationEnabled: true,
      surroundingBuildingsEnabled: true,
      constructionOverlayEnabled: false,
      realTimeUpdates: true,
      updateInterval: 30, // 30 seconds
      terrainResolution: 1, // 1 meter per pixel
      noiseRadius: 500, // 500 meters
      pollutionRadius: 1000, // 1km
      buildingDensity: 'medium',
      maxSurroundingBuildings: 50
    };

    this.initializeSiteContext();
  }

  // Initialize site context system
  private async initializeSiteContext(): Promise<void> {
    try {
      // Create transform groups for organization
      this.terrainGroup = new BABYLON.TransformNode('site_terrain', this.scene);
      this.noiseGroup = new BABYLON.TransformNode('site_noise', this.scene);
      this.pollutionGroup = new BABYLON.TransformNode('site_pollution', this.scene);
      this.buildingsGroup = new BABYLON.TransformNode('site_buildings', this.scene);
      this.overlayGroup = new BABYLON.TransformNode('site_overlays', this.scene);

      // Initially hide groups
      if (this.noiseGroup) this.noiseGroup.setEnabled(false);
      if (this.pollutionGroup) this.pollutionGroup.setEnabled(false);
      if (this.buildingsGroup) this.buildingsGroup.setEnabled(false);
      if (this.overlayGroup) this.overlayGroup.setEnabled(false);

      // Start real-time updates if enabled
      if (this.config.realTimeUpdates) {
        this.startRealTimeUpdates();
      }

      this.isInitialized = true;
      console.log('Site context system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize site context system:', error);
    }
  }

  // Generate terrain based on geo-location
  async generateTerrain(centerLocation: GeoLocation, radius: number = 1000): Promise<void> {
    if (!this.config.terrainEnabled) return;

    try {
      console.log('Generating terrain for location:', centerLocation);

      // Get elevation data from external APIs
      const elevationData = await this.getElevationData(centerLocation, radius);

      // Create terrain mesh
      const terrainSize = radius * 2;
      const subdivisions = Math.floor(terrainSize / this.config.terrainResolution);

      this.terrainMesh = MeshBuilder.CreateGround('terrain', { width: terrainSize, height: terrainSize, subdivisions: subdivisions, updatable: false }, this.scene);
      if (this.terrainMesh && this.terrainGroup) {
        this.terrainMesh.parent = this.terrainGroup;

        // Apply elevation data to terrain vertices
        this.applyElevationToTerrain(this.terrainMesh, elevationData, centerLocation);

        // Apply terrain material
        const terrainMaterial = new StandardMaterial('terrain_material', this.scene);
        terrainMaterial.diffuseColor = new Color3(0.4, 0.6, 0.2); // Green-brown
        terrainMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        this.terrainMesh.material = terrainMaterial;
      }

      console.log('Terrain generated successfully');
    } catch (error) {
      console.error('Failed to generate terrain:', error);
    }
  }

  // Get elevation data from external APIs
  private async getElevationData(center: GeoLocation, radius: number): Promise<number[][]> {
    // This would integrate with elevation APIs like Google Elevation API or Open-Elevation
    // For now, return simulated elevation data
    const gridSize = Math.floor(radius * 2 / this.config.terrainResolution);
    const elevationGrid: number[][] = [];

    for (let x = 0; x < gridSize; x++) {
      elevationGrid[x] = [];
      for (let z = 0; z < gridSize; z++) {
        // Simulate realistic terrain with some hills and valleys
        const distanceFromCenter = Math.sqrt(
          Math.pow(x - gridSize/2, 2) + Math.pow(z - gridSize/2, 2)
        );
        const baseElevation = center.altitude || 0;
        const hillEffect = Math.sin(distanceFromCenter * 0.1) * 20;
        const noise = (Math.random() - 0.5) * 5;

        elevationGrid[x][z] = baseElevation + hillEffect + noise;
      }
    }

    return elevationGrid;
  }

  // Apply elevation data to terrain mesh
  private applyElevationToTerrain(mesh: BABYLON.Mesh, elevationData: number[][], centerLocation: GeoLocation): void {
    const positions = mesh.getVerticesData('position');
    if (!positions) return;

    const gridSize = elevationData.length;
    const terrainSize = mesh.getBoundingInfo().boundingBox.extendSize.x * 2;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];

      // Convert world coordinates to grid coordinates
      const gridX = Math.floor((x + terrainSize/2) / this.config.terrainResolution);
      const gridZ = Math.floor((z + terrainSize/2) / this.config.terrainResolution);

      if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
        const elevation = elevationData[gridX][gridZ];
        positions[i + 1] = elevation; // Set Y coordinate to elevation
      }
    }

    mesh.updateVerticesData('position', positions, false);
    mesh.createNormals(false);
  }

  // Start noise simulation
  async startNoiseSimulation(): Promise<void> {
    if (!this.config.noiseSimulationEnabled) return;

    try {
      console.log('Starting noise simulation');

      // Get traffic data for noise sources
      const currentLocation = this.externalAPIManager.getCurrentLocationData();
      if (currentLocation) {
        const mapLocation: MapLocation = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          name: 'Current Location'
        };
        const trafficData = await this.externalAPIManager.getTrafficData(mapLocation, this.config.noiseRadius);

        // Generate noise data based on traffic
        this.generateNoiseData(trafficData);
      }

      // Visualize noise levels
      this.visualizeNoiseData();

      console.log('Noise simulation started');
    } catch (error) {
      console.error('Failed to start noise simulation:', error);
    }
  }

  // Generate noise data based on traffic and other sources
  private generateNoiseData(trafficData: TrafficData[]): void {
    this.noiseData = [];

    // Generate traffic noise
    trafficData.forEach(traffic => {
      const noiseLevel = this.calculateTrafficNoise(traffic);
      const noise: NoiseData = {
        level: noiseLevel,
        source: 'traffic',
        frequency: 1000, // Hz
        position: traffic.location,
        radius: this.config.noiseRadius,
        timestamp: traffic.timestamp
      };
      this.noiseData.push(noise);
    });

    // Add ambient noise
    const ambientNoise: NoiseData = {
      level: 35, // dB - typical urban ambient
      source: 'ambient',
      frequency: 100,
      position: Vector3.Zero(),
      radius: this.config.noiseRadius * 2,
      timestamp: Date.now()
    };
    this.noiseData.push(ambientNoise);
  }

  // Calculate traffic noise level based on traffic data
  private calculateTrafficNoise(traffic: TrafficData): number {
    // Simplified noise calculation based on traffic level
    const baseNoise = 60; // dB
    let noiseModifier = 0;

    switch (traffic.congestionLevel) {
      case 'low': noiseModifier = -10; break;
      case 'medium': noiseModifier = 0; break;
      case 'high': noiseModifier = 10; break;
      case 'severe': noiseModifier = 20; break;
    }

    return Math.max(30, Math.min(90, baseNoise + noiseModifier));
  }

  // Visualize noise data
  private visualizeNoiseData(): void {
    if (!this.noiseGroup) return;

    // Clear existing noise visualizations
    this.noiseGroup.getChildMeshes().forEach(mesh => mesh.dispose());

    this.noiseData.forEach(noise => {
      // Create noise visualization sphere
      const noiseSphere = MeshBuilder.CreateSphere(`noise_${noise.source}_${Date.now()}`, { diameter: noise.radius * 0.1, segments: 16, updatable: false }, this.scene);
      noiseSphere.position = noise.position;
      noiseSphere.parent = this.noiseGroup;

      // Color based on noise level
      const material = new StandardMaterial(`noise_material_${noise.source}`, this.scene);
      const intensity = Math.min(1, noise.level / 80); // Normalize to 0-1
      material.diffuseColor = new Color3(intensity, 0, 1 - intensity); // Blue to red gradient
      material.alpha = 0.3;
      noiseSphere.material = material;
    });
  }

  // Start pollution simulation
  async startPollutionSimulation(): Promise<void> {
    if (!this.config.pollutionSimulationEnabled) return;

    try {
      console.log('Starting pollution simulation');

      // Get environmental data for pollution sources
      const envData = this.externalAPIManager.getCurrentLocationData();
      if (envData) {
        this.generatePollutionData(envData);
        this.visualizePollutionData();
      }

      console.log('Pollution simulation started');
    } catch (error) {
      console.error('Failed to start pollution simulation:', error);
    }
  }

  // Generate pollution data
  private generatePollutionData(location: GeoLocation): void {
    this.pollutionData = [];

    // Air pollution based on location and time
    const airPollution: PollutionData = {
      type: 'air',
      level: Math.random() * 100, // AQI-like index
      source: 'urban',
      position: new Vector3(location.longitude * 1000, 10, location.latitude * 1000),
      radius: this.config.pollutionRadius,
      healthImpact: Math.random() * 50,
      timestamp: Date.now()
    };
    this.pollutionData.push(airPollution);
  }

  // Visualize pollution data
  private visualizePollutionData(): void {
    if (!this.pollutionGroup) return;

    // Clear existing pollution visualizations
    this.pollutionGroup.getChildMeshes().forEach(mesh => mesh.dispose());

    this.pollutionData.forEach(pollution => {
      // Create pollution visualization
      const pollutionMesh = MeshBuilder.CreateSphere(`pollution_${pollution.type}_${Date.now()}`, { diameter: pollution.radius * 0.05, segments: 16, updatable: false }, this.scene);
      pollutionMesh.position = pollution.position;
      pollutionMesh.parent = this.pollutionGroup;

      // Color based on pollution level
      const material = new StandardMaterial(`pollution_material_${pollution.type}`, this.scene);
      const intensity = Math.min(1, pollution.level / 100);
      material.diffuseColor = new Color3(intensity, 1 - intensity, 0); // Green to red gradient
      material.alpha = 0.4;
      pollutionMesh.material = material;
    });
  }

  // Generate surrounding buildings
  async generateSurroundingBuildings(centerLocation: GeoLocation, radius: number = 500): Promise<void> {
    if (!this.config.surroundingBuildingsEnabled) return;

    try {
      console.log('Generating surrounding buildings');

      // Use AI to generate building layouts
      // The method generateCityLayout does not exist on AIManager, so we will replace it with generateFutureCity
      const buildingLayout = await this.aiManager.generateFutureCity(this.config.buildingDensity, 'urban');

      if (buildingLayout && buildingLayout.buildings) {
        this.surroundingBuildings = buildingLayout.buildings.map((building: any) => ({
          id: building.id,
          name: `Building ${building.id}`,
          type: building.type as 'residential' | 'commercial' | 'industrial' | 'public',
          height: building.height,
          footprint: new Vector3(building.position.x, building.position.z, building.height),
          position: new Vector3(building.position.x, building.height / 2, building.position.z),
          rotation: building.rotation || 0,
          style: 'modern',
          age: Math.floor(Math.random() * 50) + 10,
          condition: 'good' as const
        }));

        // Create meshes for buildings
        this.createBuildingMeshes();

        console.log(`Generated ${this.surroundingBuildings.length} surrounding buildings`);
      }
    } catch (error) {
      console.error('Failed to generate surrounding buildings:', error);
    }
  }

  // Create meshes for surrounding buildings
  private createBuildingMeshes(): void {
    if (!this.buildingsGroup) return;

    // Clear existing building meshes
    this.buildingsGroup.getChildMeshes().forEach(mesh => mesh.dispose());

    this.surroundingBuildings.forEach(building => {
      // Create building mesh
      const buildingMesh = MeshBuilder.CreateBox(
        `building_${building.id}`,
        { size: 1, updatable: false },
        this.scene
      );

      buildingMesh.scaling = building.footprint;
      buildingMesh.position = building.position;
      buildingMesh.rotation.y = (building.rotation * Math.PI) / 180;
      buildingMesh.parent = this.buildingsGroup;

      // Apply building material
      const material = new StandardMaterial(`building_material_${building.id}`, this.scene);
      material.diffuseColor = this.getBuildingColor(building.type);
      buildingMesh.material = material;

      building.mesh = buildingMesh;
    });
  }

  // Get color for building type
  private getBuildingColor(type: string): Color3 {
    switch (type) {
      case 'residential': return new Color3(0.8, 0.8, 0.9); // Light blue
      case 'commercial': return new Color3(0.9, 0.8, 0.6); // Light orange
      case 'industrial': return new Color3(0.6, 0.6, 0.6); // Gray
      case 'public': return new Color3(0.8, 0.9, 0.8); // Light green
      default: return new Color3(0.7, 0.7, 0.7); // Default gray
    }
  }

  // Add construction photo overlay
  async addConstructionPhoto(photo: ConstructionPhoto): Promise<void> {
    if (!this.config.constructionOverlayEnabled || !this.overlayGroup) return;

    try {
      // Create photo overlay mesh
      const overlayMesh = MeshBuilder.CreatePlane(`photo_overlay_${photo.id}`, { size: 10, updatable: false }, this.scene);
      overlayMesh.position = photo.cameraPosition;
      overlayMesh.rotation = photo.cameraRotation;
      overlayMesh.parent = this.overlayGroup;

      // Apply photo texture
      if (photo.imageData) {
        const material = new StandardMaterial(`photo_material_${photo.id}`, this.scene);
        const texture = new DynamicTexture(`photo_texture_${photo.id}`, { width: 1024, height: 1024 }, this.scene);
        const img = new Image();
        img.onload = () => {
          texture.getContext().drawImage(img, 0, 0);
          texture.update();
        };
        img.src = photo.imageData;
        material.diffuseTexture = texture;
        material.alpha = 0.7;
        overlayMesh.material = material;
      }

      photo.overlayMesh = overlayMesh;
      this.constructionPhotos.push(photo);

      console.log('Construction photo overlay added');
    } catch (error) {
      console.error('Failed to add construction photo overlay:', error);
    }
  }

  // Start real-time updates
  private startRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = window.setInterval(() => {
      this.updateSiteContext();
    }, this.config.updateInterval * 1000);
  }

  // Update site context data
  private async updateSiteContext(): Promise<void> {
    try {
      // Update noise data
      if (this.config.noiseSimulationEnabled) {
        const currentLocation = this.externalAPIManager.getCurrentLocationData();
        if (currentLocation) {
          const mapLocation: MapLocation = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            name: 'Current Location'
          };
          const trafficData = await this.externalAPIManager.getTrafficData(mapLocation, this.config.noiseRadius);
          this.generateNoiseData(trafficData);
          this.visualizeNoiseData();
        }
      }

      // Update pollution data
      if (this.config.pollutionSimulationEnabled) {
        const envData = this.externalAPIManager.getCurrentLocationData();
        if (envData) {
          this.generatePollutionData(envData);
          this.visualizePollutionData();
        }
      }
    } catch (error) {
      console.error('Failed to update site context:', error);
    }
  }

  // Toggle visibility of site context elements
  toggleTerrainVisibility(): void {
    if (this.terrainGroup) {
      this.terrainGroup.setEnabled(!this.terrainGroup.isEnabled());
    }
  }

  toggleNoiseVisualization(): void {
    if (this.noiseGroup) {
      this.noiseGroup.setEnabled(!this.noiseGroup.isEnabled());
    }
  }

  togglePollutionVisualization(): void {
    if (this.pollutionGroup) {
      this.pollutionGroup.setEnabled(!this.pollutionGroup.isEnabled());
    }
  }

  toggleBuildingsVisibility(): void {
    if (this.buildingsGroup) {
      this.buildingsGroup.setEnabled(!this.buildingsGroup.isEnabled());
    }
  }

  togglePhotoOverlays(): void {
    if (this.overlayGroup) {
      this.overlayGroup.setEnabled(!this.overlayGroup.isEnabled());
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<SiteContextConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart real-time updates if interval changed
    if (newConfig.updateInterval && this.updateInterval) {
      this.startRealTimeUpdates();
    }
  }

  // Get current configuration
  getConfig(): SiteContextConfig {
    return { ...this.config };
  }

  // Get terrain data at specific location
  getTerrainDataAt(position: Vector3): TerrainData | null {
    const key = `${Math.round(position.x)}_${Math.round(position.z)}`;
    return this.terrainData.get(key) || null;
  }

  // Get noise level at specific location
  getNoiseLevelAt(position: Vector3): number {
    let totalNoise = 0;
    let noiseCount = 0;

    this.noiseData.forEach(noise => {
      const distance = Vector3.Distance(position, noise.position);
      if (distance <= noise.radius) {
        // Attenuate noise based on distance
        const attenuation = 1 - (distance / noise.radius);
        totalNoise += noise.level * attenuation;
        noiseCount++;
      }
    });

    return noiseCount > 0 ? totalNoise / noiseCount : 0;
  }

  // Get pollution level at specific location
  getPollutionLevelAt(position: Vector3): number {
    let totalPollution = 0;
    let pollutionCount = 0;

    this.pollutionData.forEach(pollution => {
      const distance = Vector3.Distance(position, pollution.position);
      if (distance <= pollution.radius) {
        const attenuation = 1 - (distance / pollution.radius);
        totalPollution += pollution.level * attenuation;
        pollutionCount++;
      }
    });

    return pollutionCount > 0 ? totalPollution / pollutionCount : 0;
  }

  // Get all surrounding buildings
  getSurroundingBuildings(): SurroundingBuilding[] {
    return [...this.surroundingBuildings];
  }

  // Get construction photos
  getConstructionPhotos(): ConstructionPhoto[] {
    return [...this.constructionPhotos];
  }

  // Dispose resources
  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Dispose terrain
    if (this.terrainMesh) {
      this.terrainMesh.dispose();
    }

    // Dispose groups and their children
    [this.terrainGroup, this.noiseGroup, this.pollutionGroup, this.buildingsGroup, this.overlayGroup]
      .forEach(group => {
        if (group) {
          group.dispose();
        }
      });

    // Clear data
    this.terrainData.clear();
    this.noiseData = [];
    this.pollutionData = [];
    this.surroundingBuildings = [];
    this.constructionPhotos = [];

    console.log('Site context manager disposed');
  }
}
