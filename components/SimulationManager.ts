import { Engine, Scene, Mesh, Vector3, Color3, StandardMaterial, PBRMaterial, TransformNode } from '@babylonjs/core';
import { FeatureManager } from './FeatureManager';
import { CostEstimator } from './CostEstimator';

export interface SimulationConfig {
  environmentalSimulationEnabled: boolean;
  energySimulationEnabled: boolean;
  predictiveMaintenanceEnabled: boolean;
  materialLifecycleEnabled: boolean;
  updateInterval: number;
  // Design validation simulations
  structuralStressEnabled: boolean;
  windFlowEnabled: boolean;
  daylightAutonomyEnabled: boolean;
  thermalComfortEnabled: boolean;
  // Geo-context simulations
  shadowAnalysisEnabled?: boolean;
  windTunnelEnabled?: boolean;
  floodSimulationEnabled?: boolean;
  geoClimateEnabled?: boolean;
  // Traffic & Parking simulations
  trafficParkingEnabled?: boolean;
  // Interior & Human Experience simulations
  ergonomicTestingEnabled?: boolean;
  furnitureClearanceEnabled?: boolean;
  lightingMoodBoardsEnabled?: boolean;
  soundPrivacyEnabled?: boolean;
}

export interface MaintenanceIssue {
  id: string;
  type: 'leak' | 'wear' | 'corrosion' | 'crack' | 'electrical' | 'hvac' | 'plumbing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: Vector3;
  description: string;
  estimatedCost: number;
  timeToFailure: number; // days
  affectedSystems: string[];
  mesh?: Mesh;
  visible: boolean;
}

export interface MaterialData {
  id: string;
  name: string;
  type: 'concrete' | 'steel' | 'wood' | 'glass' | 'insulation' | 'finish';
  carbonFootprint: number; // kg CO2 per unit
  durability: number; // years
  maintenanceCost: number; // per year
  environmentalImpact: number; // environmental score 0-100
  recycled: boolean;
  renewable: boolean;
  location: Vector3;
  volume: number; // cubic meters
  mesh?: Mesh;
}

export interface LifecycleAnalysis {
  materialId: string;
  totalCarbonFootprint: number;
  lifecycleCost: number;
  environmentalScore: number;
  durabilityScore: number;
  recommendations: string[];
}

// Design Validation Simulation Interfaces
export interface StructuralStressData {
  elementId: string;
  stressLevel: number; // 0-1 (normalized)
  loadType: 'dead' | 'live' | 'wind' | 'seismic' | 'thermal';
  criticalPoints: Vector3[];
  maxStress: number;
  safetyFactor: number;
  mesh?: Mesh;
  visible: boolean;
}

export interface WindFlowData {
  position: Vector3;
  velocity: Vector3;
  pressure: number;
  direction: Vector3;
  turbulence: number;
  particleSystem?: any; // Babylon.js particle system
  visible: boolean;
}

export interface DaylightData {
  roomId: string;
  position: Vector3;
  illuminance: number; // lux
  daylightAutonomy: number; // percentage
  usefulDaylightIlluminance: number; // percentage
  glareIndex: number;
  skyComponent: number;
  externallyReflectedComponent: number;
  internallyReflectedComponent: number;
  mesh?: Mesh;
  visible: boolean;
}

export interface ThermalComfortData {
  zoneId: string;
  position: Vector3;
  temperature: number; // Celsius
  humidity: number; // percentage
  airVelocity: number; // m/s
  meanRadiantTemperature: number; // Celsius
  predictedMeanVote: number; // PMV scale (-3 to +3)
  predictedPercentageDissatisfied: number; // PPD percentage
  comfortCategory: 'cold' | 'cool' | 'slightly cool' | 'neutral' | 'slightly warm' | 'warm' | 'hot';
  mesh?: Mesh;
  visible: boolean;
}

// Interior & Human Experience Simulation Interfaces
export interface ErgonomicAvatarData {
  avatarId: string;
  type: 'child' | 'adult' | 'wheelchair' | 'elderly';
  height: number; // cm
  reach: number; // cm
  position: Vector3;
  orientation: Vector3;
  reachZones: Vector3[]; // Points within reach
  comfortScore: number; // 0-100
  mesh?: Mesh;
  visible: boolean;
}

export interface FurnitureClearanceData {
  furnitureId: string;
  position: Vector3;
  dimensions: Vector3;
  clearanceRadius: number; // meters
  blockedPaths: Vector3[]; // Points where circulation is blocked
  clearanceScore: number; // 0-100
  mesh?: Mesh;
  visible: boolean;
}

export interface LightingScenarioData {
  scenarioId: string;
  name: string;
  type: 'warm' | 'neutral' | 'daylight';
  intensity: number; // lux
  colorTemperature: number; // Kelvin
  position: Vector3;
  affectedArea: Vector3[]; // Area covered by this lighting
  moodScore: number; // 0-100
  mesh?: Mesh;
  visible: boolean;
}

export interface SoundPrivacyData {
  roomId: string;
  position: Vector3;
  soundLevel: number; // dB
  noiseLeakage: number; // percentage
  adjacentRooms: string[];
  privacyScore: number; // 0-100
  mesh?: Mesh;
  visible: boolean;
}

// Traffic & Parking Simulation Interfaces
export interface TrafficFlowData {
  roadId: string;
  position: Vector3;
  direction: Vector3;
  speed: number; // km/h
  density: number; // vehicles per km
  congestionLevel: number; // 0-1
  flowRate: number; // vehicles per hour
  mesh?: Mesh;
  visible: boolean;
}

export interface ParkingSpaceData {
  spaceId: string;
  position: Vector3;
  type: 'surface' | 'underground' | 'covered' | 'street';
  occupied: boolean;
  occupancyRate: number; // 0-1
  utilizationScore: number; // 0-100
  accessibilityScore: number; // 0-100
  mesh?: Mesh;
  visible: boolean;
}

export interface CongestionData {
  zoneId: string;
  position: Vector3;
  congestionLevel: number; // 0-1
  affectedRoads: string[];
  peakHours: string[];
  averageDelay: number; // minutes
  mesh?: Mesh;
  visible: boolean;
}

export class SimulationManager {
  private engine: Engine;
  private scene: Scene;
  private featureManager: FeatureManager;
  private config: SimulationConfig;
  private updateIntervalId: number | null = null;
  private maintenanceIssues: MaintenanceIssue[] = [];
  private materials: MaterialData[] = [];
  private maintenanceGroup: TransformNode | null = null;
  private materialGroup: TransformNode | null = null;
  private simulationTime: number = 0;
  private costEstimator: CostEstimator | null = null;

  // Design validation simulation data
  private structuralStressData: StructuralStressData[] = [];
  private windFlowData: WindFlowData[] = [];
  private daylightData: DaylightData[] = [];
  private thermalComfortData: ThermalComfortData[] = [];
  private structuralGroup: TransformNode | null = null;
  private windGroup: TransformNode | null = null;
  private daylightGroup: TransformNode | null = null;
  private thermalGroup: TransformNode | null = null;

  // New Geo-Context Simulation Data
  private shadowAnalysisData: any[] = [];
  private floodSimulationData: any[] = [];
  private geoClimateData: any[] = [];

  private shadowGroup: TransformNode | null = null;
  private floodGroup: TransformNode | null = null;
  private geoClimateGroup: TransformNode | null = null;

  // Traffic & Parking Simulation Data
  private trafficFlowData: TrafficFlowData[] = [];
  private parkingSpaceData: ParkingSpaceData[] = [];
  private congestionData: CongestionData[] = [];
  private trafficParkingGroup: TransformNode | null = null;

  constructor(engine: Engine, scene: Scene, featureManager: FeatureManager) {
    this.engine = engine;
    this.scene = scene;
    this.featureManager = featureManager;
    this.config = {
      environmentalSimulationEnabled: false,
      energySimulationEnabled: false,
      predictiveMaintenanceEnabled: false,
      materialLifecycleEnabled: false,
      updateInterval: 5000,
      structuralStressEnabled: false,
      windFlowEnabled: false,
      daylightAutonomyEnabled: false,
      thermalComfortEnabled: false,
      shadowAnalysisEnabled: false,
      windTunnelEnabled: false,
      floodSimulationEnabled: false,
      geoClimateEnabled: false,
      trafficParkingEnabled: false,
      ergonomicTestingEnabled: false,
      furnitureClearanceEnabled: false,
      lightingMoodBoardsEnabled: false,
      soundPrivacyEnabled: false,
    };

    this.initializeSimulationGroups();
    this.initializeDefaultMaterials();
  }

  // Initialize simulation groups for organization
  private initializeSimulationGroups(): void {
    this.maintenanceGroup = new TransformNode('maintenance_issues', this.scene);
    this.maintenanceGroup.setEnabled(false);

    this.materialGroup = new TransformNode('material_analysis', this.scene);
    this.materialGroup.setEnabled(false);

    // Design validation simulation groups
    this.structuralGroup = new TransformNode('structural_stress', this.scene);
    this.structuralGroup.setEnabled(false);

    this.windGroup = new TransformNode('wind_flow', this.scene);
    this.windGroup.setEnabled(false);

    this.daylightGroup = new TransformNode('daylight_analysis', this.scene);
    this.daylightGroup.setEnabled(false);

    this.thermalGroup = new TransformNode('thermal_comfort', this.scene);
    this.thermalGroup.setEnabled(false);

    // Traffic & Parking simulation group
    this.trafficParkingGroup = new TransformNode('traffic_parking', this.scene);
    this.trafficParkingGroup.setEnabled(false);

    // Geo-context simulation groups
    this.shadowGroup = new TransformNode('shadow_analysis', this.scene);
    this.shadowGroup.setEnabled(false);

    this.floodGroup = new TransformNode('flood_simulation', this.scene);
    this.floodGroup.setEnabled(false);

    this.geoClimateGroup = new TransformNode('geo_climate', this.scene);
    this.geoClimateGroup.setEnabled(false);
  }

  // Initialize default materials database
  private initializeDefaultMaterials(): void {
    this.materials = [
      {
        id: 'concrete_standard',
        name: 'Standard Concrete',
        type: 'concrete',
        carbonFootprint: 0.25, // kg CO2 per kg
        durability: 50,
        maintenanceCost: 10,
        environmentalImpact: 60,
        recycled: false,
        renewable: false,
        location: Vector3.Zero(),
        volume: 100
      },
      {
        id: 'concrete_recycled',
        name: 'Recycled Concrete',
        type: 'concrete',
        carbonFootprint: 0.15,
        durability: 45,
        maintenanceCost: 12,
        environmentalImpact: 75,
        recycled: true,
        renewable: false,
        location: Vector3.Zero(),
        volume: 100
      },
      {
        id: 'steel_standard',
        name: 'Standard Steel',
        type: 'steel',
        carbonFootprint: 2.5,
        durability: 80,
        maintenanceCost: 5,
        environmentalImpact: 40,
        recycled: false,
        renewable: false,
        location: Vector3.Zero(),
        volume: 50
      },
      {
        id: 'steel_recycled',
        name: 'Recycled Steel',
        type: 'steel',
        carbonFootprint: 1.2,
        durability: 75,
        maintenanceCost: 6,
        environmentalImpact: 80,
        recycled: true,
        renewable: false,
        location: Vector3.Zero(),
        volume: 50
      },
      {
        id: 'wood_sustainable',
        name: 'Sustainable Wood',
        type: 'wood',
        carbonFootprint: -0.5, // Negative due to carbon sequestration
        durability: 30,
        maintenanceCost: 15,
        environmentalImpact: 90,
        recycled: false,
        renewable: true,
        location: Vector3.Zero(),
        volume: 20
      },
      {
        id: 'glass_standard',
        name: 'Standard Glass',
        type: 'glass',
        carbonFootprint: 1.8,
        durability: 25,
        maintenanceCost: 8,
        environmentalImpact: 55,
        recycled: false,
        renewable: false,
        location: Vector3.Zero(),
        volume: 10
      },
      {
        id: 'insulation_fiberglass',
        name: 'Fiberglass Insulation',
        type: 'insulation',
        carbonFootprint: 3.2,
        durability: 20,
        maintenanceCost: 3,
        environmentalImpact: 45,
        recycled: false,
        renewable: false,
        location: Vector3.Zero(),
        volume: 5
      }
    ];
  }

  startSimulation() {
    if (this.updateIntervalId !== null) {
      return; // Already running
    }
    this.updateIntervalId = window.setInterval(() => {
      this.runSimulationStep();
    }, this.config.updateInterval);
  }

  stopSimulation() {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  private runSimulationStep() {
    this.simulationTime += this.config.updateInterval / 1000; // Convert to seconds

    if (this.config.environmentalSimulationEnabled) {
      this.simulateEnvironment();
    }
    if (this.config.energySimulationEnabled) {
      this.simulateEnergy();
    }
    if (this.config.predictiveMaintenanceEnabled) {
      this.simulatePredictiveMaintenance();
    }
    if (this.config.materialLifecycleEnabled) {
      this.simulateMaterialLifecycle();
    }

    // Design validation simulations
    if (this.config.structuralStressEnabled) {
      this.simulateStructuralStress();
    }
    if (this.config.windFlowEnabled) {
      this.simulateWindFlow();
    }
    if (this.config.daylightAutonomyEnabled) {
      this.simulateDaylightAutonomy();
    }
    if (this.config.thermalComfortEnabled) {
      this.simulateThermalComfort();
    }

    // Traffic & Parking simulations
    if (this.config.trafficParkingEnabled) {
      this.simulateTrafficParking();
    }

    // Geo-context simulations (shadow, wind tunnel, flood, geo-climate)
    if (this.config.shadowAnalysisEnabled) {
      this.simulateShadowAnalysis();
    }
    if (this.config.windTunnelEnabled) {
      this.simulateWindTunnel();
    }
    if (this.config.floodSimulationEnabled) {
      this.simulateFlood();
    }
    if (this.config.geoClimateEnabled) {
      this.simulateGeoClimate();
    }
  }

  private simulateShadowAnalysis(): void {
    if (this.shadowGroup) {
      this.shadowGroup.setEnabled(true);
    }
  }

  private simulateWindTunnel(): void {
    this.simulateWindFlow();
    if (this.windGroup) {
      this.windGroup.setEnabled(true);
    }
  }

  private simulateFlood(): void {
    if (this.floodGroup) {
      this.floodGroup.setEnabled(true);
    }
  }

  private simulateGeoClimate(): void {
    if (this.geoClimateGroup) {
      this.geoClimateGroup.setEnabled(true);
    }
  }

  private simulateEnvironment() {
    // Enhanced environmental simulation
    console.log('Running environmental simulation step...');

    // Simulate weather effects on materials
    this.materials.forEach(material => {
      this.simulateWeatherEffects(material);
    });
  }

  private simulateEnergy() {
    // Enhanced energy simulation
    console.log('Running energy simulation step...');

    // Simulate energy consumption patterns
    const energyConsumption = this.calculateEnergyConsumption();
    console.log(`Current energy consumption: ${energyConsumption} kWh`);
  }

  private simulatePredictiveMaintenance() {
    // Enhanced predictive maintenance simulation
    console.log('Running predictive maintenance simulation step...');

    // Generate new maintenance issues
    this.generateMaintenanceIssues();

    // Update existing issues
    this.updateMaintenanceIssues();

    // Remove resolved issues
    this.cleanupResolvedIssues();
  }

  private simulateMaterialLifecycle() {
    // Material lifecycle simulation
    console.log('Running material lifecycle simulation step...');

    // Update material degradation
    this.updateMaterialDegradation();

    // Calculate lifecycle costs
    this.updateLifecycleCosts();
  }

  // Design validation simulation methods
  private simulateStructuralStress(): void {
    console.log('Running structural stress simulation step...');

    // Generate structural stress data for building elements
    this.generateStructuralStressData();

    // Update visual representations
    this.updateStructuralStressVisualization();
  }

  private simulateWindFlow(): void {
    console.log('Running wind flow simulation step...');

    // Generate wind flow data
    this.generateWindFlowData();

    // Update particle systems and visualizations
    this.updateWindFlowVisualization();
  }

  private simulateDaylightAutonomy(): void {
    console.log('Running daylight autonomy simulation step...');

    // Generate daylight data for rooms
    this.generateDaylightData();

    // Update visual representations
    this.updateDaylightVisualization();
  }

  private simulateThermalComfort(): void {
    console.log('Running thermal comfort simulation step...');

    // Generate thermal comfort data for zones
    this.generateThermalComfortData();

    // Update visual representations
    this.updateThermalComfortVisualization();
  }

  // Traffic & Parking simulation methods
  private simulateTrafficParking(): void {
    console.log('Running traffic & parking simulation step...');

    // Generate traffic flow data
    this.generateTrafficFlowData();

    // Generate parking space data
    this.generateParkingSpaceData();

    // Generate congestion data
    this.generateCongestionData();

    // Update visual representations
    this.updateTrafficParkingVisualization();
  }

  private generateTrafficFlowData(): void {
    this.trafficFlowData = [];
    for (let i = 0; i < 20; i++) {
      const position = new Vector3(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
      );
      const direction = new Vector3(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
      ).normalize();
      const speed = 10 + Math.random() * 40; // km/h
      const density = Math.random() * 100; // vehicles per km
      const congestionLevel = Math.min(1, density / 100);
      const flowRate = speed * density;

      const trafficFlow: TrafficFlowData = {
        roadId: `road_${i}`,
        position,
        direction,
        speed,
        density,
        congestionLevel,
        flowRate,
        visible: false
      };

      this.trafficFlowData.push(trafficFlow);
      this.createTrafficFlowMesh(trafficFlow);
    }
  }

  private generateParkingSpaceData(): void {
    this.parkingSpaceData = [];
    const types: ParkingSpaceData['type'][] = ['surface', 'underground', 'covered', 'street'];
    for (let i = 0; i < 30; i++) {
      const position = new Vector3(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
      );
      const type = types[Math.floor(Math.random() * types.length)];
      const occupied = Math.random() < 0.7;
      const occupancyRate = occupied ? 1 : 0;
      const utilizationScore = occupancyRate * 100;
      const accessibilityScore = 50 + Math.random() * 50;

      const parkingSpace: ParkingSpaceData = {
        spaceId: `space_${i}`,
        position,
        type,
        occupied,
        occupancyRate,
        utilizationScore,
        accessibilityScore,
        visible: false
      };

      this.parkingSpaceData.push(parkingSpace);
      this.createParkingSpaceMesh(parkingSpace);
    }
  }

  private generateCongestionData(): void {
    this.congestionData = [];
    for (let i = 0; i < 10; i++) {
      const position = new Vector3(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
      );
      const congestionLevel = Math.random();
      const affectedRoads = [`road_${Math.floor(Math.random() * 20)}`, `road_${Math.floor(Math.random() * 20)}`];
      const peakHours = ['8-9am', '5-6pm'];
      const averageDelay = congestionLevel * 30; // minutes

      const congestion: CongestionData = {
        zoneId: `zone_${i}`,
        position,
        congestionLevel,
        affectedRoads,
        peakHours,
        averageDelay,
        visible: false
      };

      this.congestionData.push(congestion);
      this.createCongestionMesh(congestion);
    }
  }

  private updateTrafficParkingVisualization(): void {
    this.trafficFlowData.forEach(data => {
      if (data.mesh) {
        this.updateTrafficFlowMesh(data);
      }
    });
    this.parkingSpaceData.forEach(data => {
      if (data.mesh) {
        this.updateParkingSpaceMesh(data);
      }
    });
    this.congestionData.forEach(data => {
      if (data.mesh) {
        this.updateCongestionMesh(data);
      }
    });
  }

  private createTrafficFlowMesh(data: TrafficFlowData): void {
    const mesh = Mesh.CreateBox(`${data.roadId}_trafficFlow`, 0.2, this.scene);
    mesh.position = data.position;

    const material = new StandardMaterial(`${data.roadId}_trafficFlow_material`, this.scene);
    material.diffuseColor = this.getTrafficFlowColor(data.congestionLevel);
    material.emissiveColor = this.getTrafficFlowEmissiveColor(data.congestionLevel);
    mesh.material = material;

    if (this.trafficParkingGroup) {
      mesh.parent = this.trafficParkingGroup;
    }

    data.mesh = mesh;
    data.visible = false;
  }

  private updateTrafficFlowMesh(data: TrafficFlowData): void {
    if (!data.mesh) return;

    const material = data.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = this.getTrafficFlowColor(data.congestionLevel);
    material.emissiveColor = this.getTrafficFlowEmissiveColor(data.congestionLevel);

    const scale = 0.5 + data.congestionLevel * 1.5;
    data.mesh.scaling = new Vector3(scale, 0.1, scale);
  }

  private createParkingSpaceMesh(data: ParkingSpaceData): void {
    const mesh = Mesh.CreateBox(`${data.spaceId}_parkingSpace`, 0.3, this.scene);
    mesh.position = data.position;

    const material = new StandardMaterial(`${data.spaceId}_parkingSpace_material`, this.scene);
    material.diffuseColor = data.occupied ? new Color3(1, 0, 0) : new Color3(0, 1, 0);
    material.emissiveColor = data.occupied ? new Color3(0.5, 0, 0) : new Color3(0, 0.5, 0);
    mesh.material = material;

    if (this.trafficParkingGroup) {
      mesh.parent = this.trafficParkingGroup;
    }

    data.mesh = mesh;
    data.visible = false;
  }

  private updateParkingSpaceMesh(data: ParkingSpaceData): void {
    if (!data.mesh) return;

    const material = data.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = data.occupied ? new Color3(1, 0, 0) : new Color3(0, 1, 0);
    material.emissiveColor = data.occupied ? new Color3(0.5, 0, 0) : new Color3(0, 0.5, 0);
  }

  private createCongestionMesh(data: CongestionData): void {
    const mesh = Mesh.CreateSphere(`${data.zoneId}_congestion`, 0.4, 8, this.scene);
    mesh.position = data.position;

    const material = new StandardMaterial(`${data.zoneId}_congestion_material`, this.scene);
    material.diffuseColor = this.getCongestionColor(data.congestionLevel);
    material.emissiveColor = this.getCongestionEmissiveColor(data.congestionLevel);
    mesh.material = material;

    if (this.trafficParkingGroup) {
      mesh.parent = this.trafficParkingGroup;
    }

    data.mesh = mesh;
    data.visible = false;
  }

  private updateCongestionMesh(data: CongestionData): void {
    if (!data.mesh) return;

    const material = data.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = this.getCongestionColor(data.congestionLevel);
    material.emissiveColor = this.getCongestionEmissiveColor(data.congestionLevel);

    const scale = 0.5 + data.congestionLevel * 1.5;
    data.mesh.scaling = new Vector3(scale, scale, scale);
  }

  private getTrafficFlowColor(congestionLevel: number): Color3 {
    if (congestionLevel < 0.3) return new Color3(0, 1, 0); // Green - low congestion
    if (congestionLevel < 0.7) return new Color3(1, 1, 0); // Yellow - medium congestion
    return new Color3(1, 0, 0); // Red - high congestion
  }

  private getTrafficFlowEmissiveColor(congestionLevel: number): Color3 {
    return this.getTrafficFlowColor(congestionLevel).scale(0.3);
  }

  private getCongestionColor(congestionLevel: number): Color3 {
    if (congestionLevel < 0.3) return new Color3(0, 1, 0);
    if (congestionLevel < 0.7) return new Color3(1, 0.5, 0);
    return new Color3(1, 0, 0);
  }

  private getCongestionEmissiveColor(congestionLevel: number): Color3 {
    return this.getCongestionColor(congestionLevel).scale(0.4);
  }

  // Generate maintenance issues based on simulation
  private generateMaintenanceIssues(): void {
    // Probability-based issue generation
    const issueTypes: MaintenanceIssue['type'][] = ['leak', 'wear', 'corrosion', 'crack', 'electrical', 'hvac', 'plumbing'];
    const severities: MaintenanceIssue['severity'][] = ['low', 'medium', 'high', 'critical'];

    // 5% chance to generate a new issue each simulation step
    if (Math.random() < 0.05) {
      const type = issueTypes[Math.floor(Math.random() * issueTypes.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];

      const issue: MaintenanceIssue = {
        id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity,
        location: new Vector3(
          (Math.random() - 0.5) * 20,
          Math.random() * 3,
          (Math.random() - 0.5) * 20
        ),
        description: this.generateIssueDescription(type, severity),
        estimatedCost: this.calculateIssueCost(type, severity),
        timeToFailure: Math.random() * 365, // 0-365 days
        affectedSystems: this.getAffectedSystems(type),
        visible: false
      };

      this.maintenanceIssues.push(issue);
      this.createMaintenanceMesh(issue);

      console.log(`New maintenance issue generated: ${issue.description}`);
    }
  }

  // Update existing maintenance issues
  private updateMaintenanceIssues(): void {
    this.maintenanceIssues.forEach(issue => {
      // Reduce time to failure
      issue.timeToFailure -= this.config.updateInterval / (1000 * 60 * 60 * 24); // Convert to days

      // Update visual representation based on urgency
      if (issue.mesh) {
        this.updateMaintenanceVisual(issue);
      }

      // Critical issues become more visible
      if (issue.timeToFailure < 7 && issue.severity !== 'critical') {
        issue.severity = 'critical';
        console.warn(`Issue ${issue.id} escalated to critical!`);
      }
    });
  }

  // Create visual mesh for maintenance issue
  private createMaintenanceMesh(issue: MaintenanceIssue): void {
    let mesh: Mesh;

    switch (issue.type) {
      case 'leak':
        mesh = Mesh.CreateCylinder(issue.id, 0.1, 0.05, 0.05, 8, 1, this.scene);
        break;
      case 'crack':
        mesh = Mesh.CreateBox(issue.id, 0.1, this.scene);
        mesh.scaling = new Vector3(0.5, 0.02, 0.1);
        break;
      case 'wear':
        mesh = Mesh.CreateSphere(issue.id, 8, 0.08, this.scene);
        break;
      default:
        mesh = Mesh.CreateSphere(issue.id, 8, 0.1, this.scene);
    }

    mesh.position = issue.location;

    const material = new StandardMaterial(`${issue.id}_material`, this.scene);
    material.diffuseColor = this.getIssueColor(issue.severity);
    material.emissiveColor = this.getIssueEmissiveColor(issue.severity);
    mesh.material = material;

    if (this.maintenanceGroup) {
      mesh.parent = this.maintenanceGroup;
    }

    issue.mesh = mesh;
    issue.visible = false;
  }

  // Update maintenance issue visual
  private updateMaintenanceVisual(issue: MaintenanceIssue): void {
    if (!issue.mesh) return;

    const material = issue.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = this.getIssueColor(issue.severity);
    material.emissiveColor = this.getIssueEmissiveColor(issue.severity);

    // Pulse effect for critical issues
    if (issue.severity === 'critical') {
      const pulseIntensity = (Math.sin(this.simulationTime * 5) + 1) / 2; // 0-1
      material.emissiveColor = material.emissiveColor.scale(pulseIntensity);
    }
  }

  // Get color based on issue severity
  private getIssueColor(severity: MaintenanceIssue['severity']): Color3 {
    const colorMap = {
      low: new Color3(1, 1, 0),      // Yellow
      medium: new Color3(1, 0.5, 0), // Orange
      high: new Color3(1, 0, 0),     // Red
      critical: new Color3(0.5, 0, 0) // Dark red
    };
    return colorMap[severity];
  }

  // Get emissive color for issue
  private getIssueEmissiveColor(severity: MaintenanceIssue['severity']): Color3 {
    const emissiveMap = {
      low: new Color3(0.2, 0.2, 0),
      medium: new Color3(0.3, 0.1, 0),
      high: new Color3(0.3, 0, 0),
      critical: new Color3(0.2, 0, 0)
    };
    return emissiveMap[severity];
  }

  // Generate issue description
  private generateIssueDescription(type: MaintenanceIssue['type'], severity: MaintenanceIssue['severity']): string {
    const descriptions = {
      leak: `${severity} water leak detected`,
      wear: `${severity} material wear detected`,
      corrosion: `${severity} corrosion detected`,
      crack: `${severity} structural crack detected`,
      electrical: `${severity} electrical issue detected`,
      hvac: `${severity} HVAC system issue detected`,
      plumbing: `${severity} plumbing issue detected`
    };
    return descriptions[type];
  }

  // Calculate issue cost
  private calculateIssueCost(type: MaintenanceIssue['type'], severity: MaintenanceIssue['severity']): number {
    const baseCosts = {
      leak: 500,
      wear: 200,
      corrosion: 800,
      crack: 1500,
      electrical: 300,
      hvac: 600,
      plumbing: 400
    };

    const severityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 2.0,
      critical: 3.0
    };

    return Math.round(baseCosts[type] * severityMultiplier[severity]);
  }

  // Get affected systems
  private getAffectedSystems(type: MaintenanceIssue['type']): string[] {
    const systemMap = {
      leak: ['plumbing', 'structure'],
      wear: ['finishes', 'structure'],
      corrosion: ['structure', 'mechanical'],
      crack: ['structure', 'safety'],
      electrical: ['electrical', 'lighting'],
      hvac: ['mechanical', 'comfort'],
      plumbing: ['plumbing', 'water']
    };
    return systemMap[type];
  }

  // Simulate weather effects on materials
  private simulateWeatherEffects(material: MaterialData): void {
    // Weather effects reduce durability over time
    const weatherFactor = 0.001; // Small degradation per simulation step
    material.durability -= weatherFactor;

    // Update environmental impact based on degradation
    if (material.durability < material.durability * 0.8) {
      material.environmentalImpact -= 5;
    }
  }

  // Update material degradation
  private updateMaterialDegradation(): void {
    this.materials.forEach(material => {
      // Age-based degradation
      const ageFactor = 0.0001;
      material.durability -= ageFactor;

      // Usage-based degradation (simplified)
      const usageFactor = 0.00005;
      material.durability -= usageFactor;

      // Update visual representation
      if (material.mesh) {
        this.updateMaterialVisual(material);
      }
    });
  }

  // Update material visual representation
  private updateMaterialVisual(material: MaterialData): void {
    if (!material.mesh) return;

    const materialObj = material.mesh.material as StandardMaterial;
    if (!materialObj) return;

    // Change color based on degradation
    const degradationRatio = material.durability / 50; // Assuming 50 years initial durability
    if (degradationRatio < 0.8) {
      materialObj.diffuseColor = new Color3(0.6, 0.6, 0.6); // Gray out degraded materials
    }
  }

  // Update lifecycle costs
  private updateLifecycleCosts(): void {
    this.materials.forEach(material => {
      // Calculate current lifecycle cost
      const yearsPassed = (50 - material.durability); // Assuming started at 50 years
      material.maintenanceCost = material.maintenanceCost * (1 + yearsPassed * 0.02); // 2% annual increase
    });
  }

  // Calculate energy consumption
  private calculateEnergyConsumption(): number {
    // Simplified energy calculation based on materials and systems
    let consumption = 0;

    this.materials.forEach(material => {
      // Different materials have different energy implications
      switch (material.type) {
        case 'concrete':
          consumption += material.volume * 0.1;
          break;
        case 'steel':
          consumption += material.volume * 0.2;
          break;
        case 'wood':
          consumption += material.volume * 0.05;
          break;
        case 'glass':
          consumption += material.volume * 0.15;
          break;
        case 'insulation':
          consumption -= material.volume * 0.1; // Insulation reduces consumption
          break;
      }
    });

    return Math.max(0, consumption);
  }

  // Clean up resolved issues
  private cleanupResolvedIssues(): void {
    this.maintenanceIssues = this.maintenanceIssues.filter(issue => {
      if (issue.timeToFailure <= 0) {
        // Remove resolved issue
        if (issue.mesh) {
          issue.mesh.dispose();
        }
        return false;
      }
      return true;
    });
  }

  // Public methods for maintenance simulation
  toggleMaintenanceVisualization(): void {
    if (this.maintenanceGroup) {
      const isVisible = this.maintenanceGroup.isEnabled();
      this.maintenanceGroup.setEnabled(!isVisible);

      this.maintenanceIssues.forEach(issue => {
        issue.visible = !isVisible;
      });

      console.log(`Maintenance visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  getMaintenanceIssues(): MaintenanceIssue[] {
    return [...this.maintenanceIssues];
  }

  resolveMaintenanceIssue(issueId: string): boolean {
    const issue = this.maintenanceIssues.find(i => i.id === issueId);
    if (issue) {
      if (issue.mesh) {
        issue.mesh.dispose();
      }
      this.maintenanceIssues = this.maintenanceIssues.filter(i => i.id !== issueId);
      return true;
    }
    return false;
  }

  // Public methods for material lifecycle
  toggleMaterialVisualization(): void {
    if (this.materialGroup) {
      const isVisible = this.materialGroup.isEnabled();
      this.materialGroup.setEnabled(!isVisible);
      console.log(`Material visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  getMaterials(): MaterialData[] {
    return [...this.materials];
  }

  analyzeMaterialLifecycle(materialId: string): LifecycleAnalysis | null {
    const material = this.materials.find(m => m.id === materialId);
    if (!material) return null;

    const totalCarbonFootprint = material.carbonFootprint * material.volume * 1000; // Convert to kg
    const lifecycleCost = material.maintenanceCost * (50 - material.durability); // Cost over remaining life

    const recommendations = this.generateMaterialRecommendations(material);

    return {
      materialId,
      totalCarbonFootprint,
      lifecycleCost,
      environmentalScore: material.environmentalImpact,
      durabilityScore: (material.durability / 50) * 100, // Percentage of original durability
      recommendations
    };
  }

  // Generate material recommendations
  private generateMaterialRecommendations(material: MaterialData): string[] {
    const recommendations: string[] = [];

    if (material.carbonFootprint > 2.0) {
      recommendations.push('Consider low-carbon alternatives');
    }

    if (material.durability < 30) {
      recommendations.push('Material nearing end of life - plan replacement');
    }

    if (!material.recycled && material.environmentalImpact < 60) {
      recommendations.push('Consider recycled material options');
    }

    if (material.maintenanceCost > 20) {
      recommendations.push('High maintenance cost - evaluate alternatives');
    }

    return recommendations;
  }

  // Add custom material
  addMaterial(material: MaterialData): void {
    this.materials.push(material);
    this.createMaterialMesh(material);
  }

  // Create visual mesh for material
  private createMaterialMesh(material: MaterialData): void {
    // Create a small indicator mesh for the material
    const mesh = Mesh.CreateBox(`${material.id}_indicator`, 0.1, this.scene);
    mesh.position = material.location;

    const materialObj = new StandardMaterial(`${material.id}_material`, this.scene);
    materialObj.diffuseColor = this.getMaterialColor(material.type);
    mesh.material = materialObj;

    if (this.materialGroup) {
      mesh.parent = this.materialGroup;
    }

    material.mesh = mesh;
  }

  // Get color for material type
  private getMaterialColor(type: MaterialData['type']): Color3 {
    const colorMap = {
      concrete: new Color3(0.7, 0.7, 0.7),
      steel: new Color3(0.5, 0.5, 0.6),
      wood: new Color3(0.6, 0.4, 0.2),
      glass: new Color3(0.8, 0.9, 1.0),
      insulation: new Color3(1.0, 0.8, 0.8),
      finish: new Color3(0.9, 0.9, 0.9)
    };
    return colorMap[type] || new Color3(0.5, 0.5, 0.5);
  }

  // CostEstimator integration methods
  setCostEstimator(costEstimator: CostEstimator): void {
    this.costEstimator = costEstimator;
    console.log('CostEstimator integrated with SimulationManager');
  }

  getCostEstimator(): CostEstimator | null {
    return this.costEstimator;
  }

  // Estimate costs for maintenance issues
  estimateMaintenanceCosts(): any {
    if (!this.costEstimator) {
      console.warn('CostEstimator not available for maintenance cost estimation');
      return null;
    }

    const costEstimator = this.costEstimator;

    const costBreakdown = {
      totalEstimatedCost: 0,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      byType: {
        leak: 0,
        wear: 0,
        corrosion: 0,
        crack: 0,
        electrical: 0,
        hvac: 0,
        plumbing: 0
      },
      urgentIssues: [] as MaintenanceIssue[]
    };

    this.maintenanceIssues.forEach(issue => {
      // Use CostEstimator for more accurate cost estimation
      const estimatedCost = costEstimator.estimateIssueCost(issue);
      costBreakdown.totalEstimatedCost += estimatedCost;

      costBreakdown.bySeverity[issue.severity] += estimatedCost;
      costBreakdown.byType[issue.type] += estimatedCost;

      // Track urgent issues (critical or time to failure < 30 days)
      if (issue.severity === 'critical' || issue.timeToFailure < 30) {
        costBreakdown.urgentIssues.push(issue);
      }
    });

    return costBreakdown;
  }

  // Estimate material lifecycle costs
  estimateMaterialCosts(): any {
    if (!this.costEstimator) {
      console.warn('CostEstimator not available for material cost estimation');
      return null;
    }

    const costEstimator = this.costEstimator;

    const costAnalysis = {
      totalLifecycleCost: 0,
      byMaterialType: {} as Record<string, number>,
      replacementSchedule: [] as any[],
      costSavings: {
        recycled: 0,
        renewable: 0,
        efficient: 0
      }
    };

    this.materials.forEach(material => {
      const lifecycleCost = costEstimator.estimateMaterialLifecycleCost(material);
      costAnalysis.totalLifecycleCost += lifecycleCost;

      if (!costAnalysis.byMaterialType[material.type]) {
        costAnalysis.byMaterialType[material.type] = 0;
      }
      costAnalysis.byMaterialType[material.type] += lifecycleCost;

      // Track replacement schedule
      if (material.durability < 25) {
        costAnalysis.replacementSchedule.push({
          materialId: material.id,
          type: material.type,
          estimatedCost: lifecycleCost,
          priority: material.durability < 10 ? 'high' : 'medium'
        });
      }

      // Calculate cost savings
      if (material.recycled) {
        costAnalysis.costSavings.recycled += lifecycleCost * 0.2; // Assume 20% savings
      }
      if (material.renewable) {
        costAnalysis.costSavings.renewable += lifecycleCost * 0.15; // Assume 15% savings
      }
      if (material.environmentalImpact > 80) {
        costAnalysis.costSavings.efficient += lifecycleCost * 0.1; // Assume 10% savings
      }
    });

    return costAnalysis;
  }

  // Get comprehensive cost analysis
  getCostAnalysis(): any {
    if (!this.costEstimator) {
      console.warn('CostEstimator not available for comprehensive cost analysis');
      return null;
    }

    const maintenanceCosts = this.estimateMaintenanceCosts();
    const materialCosts = this.estimateMaterialCosts();

    if (!maintenanceCosts || !materialCosts) {
      return null;
    }

    const totalCost = maintenanceCosts.totalEstimatedCost + materialCosts.totalLifecycleCost;

    return {
      totalEstimatedCost: totalCost,
      maintenanceCosts,
      materialCosts,
      costEfficiency: {
        score: this.calculateCostEfficiency(totalCost),
        recommendations: this.generateCostRecommendations(maintenanceCosts, materialCosts)
      },
      simulationTime: this.simulationTime
    };
  }

  // Calculate cost efficiency score
  private calculateCostEfficiency(totalCost: number): number {
    // Simplified cost efficiency calculation
    const baseEfficiency = 100;
    const costPenalty = Math.min(totalCost / 10000, 50); // Max 50 point penalty
    return Math.max(0, baseEfficiency - costPenalty);
  }

  // Generate cost optimization recommendations
  private generateCostRecommendations(maintenanceCosts: any, materialCosts: any): string[] {
    const recommendations: string[] = [];

    // Maintenance recommendations
    if (maintenanceCosts.urgentIssues.length > 3) {
      recommendations.push('High number of urgent maintenance issues - prioritize preventive maintenance');
    }

    if (maintenanceCosts.bySeverity.critical > maintenanceCosts.totalEstimatedCost * 0.5) {
      recommendations.push('Critical issues represent majority of costs - immediate attention required');
    }

    // Material recommendations
    if (materialCosts.replacementSchedule.length > 2) {
      recommendations.push('Multiple materials nearing end of life - plan replacement schedule');
    }

    const totalSavings = materialCosts.costSavings.recycled +
                        materialCosts.costSavings.renewable +
                        materialCosts.costSavings.efficient;

    if (totalSavings > materialCosts.totalLifecycleCost * 0.1) {
      recommendations.push('Significant cost savings available through sustainable material choices');
    }

    return recommendations;
  }

  // Get overall building analysis
  getBuildingAnalysis(): any {
    const totalMaterials = this.materials.length;
    const totalIssues = this.maintenanceIssues.length;
    const criticalIssues = this.maintenanceIssues.filter(i => i.severity === 'critical').length;

    const totalCarbonFootprint = this.materials.reduce((sum, material) =>
      sum + (material.carbonFootprint * material.volume * 1000), 0
    );

    const averageEnvironmentalScore = this.materials.reduce((sum, material) =>
      sum + material.environmentalImpact, 0
    ) / totalMaterials;

    const costAnalysis = this.getCostAnalysis();

    return {
      totalMaterials,
      totalIssues,
      criticalIssues,
      totalCarbonFootprint,
      averageEnvironmentalScore,
      maintenanceCost: this.maintenanceIssues.reduce((sum, issue) => sum + issue.estimatedCost, 0),
      costAnalysis: costAnalysis ? {
        totalEstimatedCost: costAnalysis.totalEstimatedCost,
        costEfficiency: costAnalysis.costEfficiency.score
      } : null,
      simulationTime: this.simulationTime
    };
  }

  updateConfig(newConfig: Partial<SimulationConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.updateIntervalId !== null) {
      this.stopSimulation();
      this.startSimulation();
    }
  }

  enablePeopleSimulation() {
    if (!this.config.trafficParkingEnabled) {
      this.config.trafficParkingEnabled = true;
      console.log('People simulation enabled');
      if (this.updateIntervalId !== null) {
        this.stopSimulation();
        this.startSimulation();
      }
    }
  }

  disablePeopleSimulation() {
    if (this.config.trafficParkingEnabled) {
      this.config.trafficParkingEnabled = false;
      console.log('People simulation disabled');
      if (this.updateIntervalId !== null) {
        this.stopSimulation();
        this.startSimulation();
      }
    }
  }

  getConfig(): SimulationConfig {
    return this.config;
  }

  // Design validation simulation data generation methods
  private generateStructuralStressData(): void {
    // Clear existing data
    this.structuralStressData = [];

    // Generate structural stress data for building elements
    const loadTypes: StructuralStressData['loadType'][] = ['dead', 'live', 'wind', 'seismic', 'thermal'];

    // Simulate structural elements (beams, columns, etc.)
    for (let i = 0; i < 10; i++) {
      const loadType = loadTypes[Math.floor(Math.random() * loadTypes.length)];
      const stressLevel = Math.random(); // 0-1 normalized stress level
      const maxStress = 200 + Math.random() * 100; // MPa
      const safetyFactor = 1.5 + Math.random() * 0.5; // Safety factor

      const stressData: StructuralStressData = {
        elementId: `element_${i}`,
        stressLevel,
        loadType,
        criticalPoints: [
          new Vector3(
            (Math.random() - 0.5) * 20,
            Math.random() * 5,
            (Math.random() - 0.5) * 20
          )
        ],
        maxStress,
        safetyFactor,
        visible: false
      };

      this.structuralStressData.push(stressData);
      this.createStructuralStressMesh(stressData);
    }
  }

  private generateWindFlowData(): void {
    // Clear existing data
    this.windFlowData = [];

    // Generate wind flow data points
    for (let i = 0; i < 20; i++) {
      const position = new Vector3(
        (Math.random() - 0.5) * 30,
        Math.random() * 10,
        (Math.random() - 0.5) * 30
      );

      const windSpeed = 5 + Math.random() * 15; // m/s
      const direction = new Vector3(
        Math.random() - 0.5,
        Math.random() * 0.2,
        Math.random() - 0.5
      ).normalize();

      const windData: WindFlowData = {
        position,
        velocity: direction.scale(windSpeed),
        pressure: 0.5 + Math.random() * 2, // kPa
        direction,
        turbulence: Math.random() * 0.5,
        visible: false
      };

      this.windFlowData.push(windData);
    }
  }

  private generateDaylightData(): void {
    // Clear existing data
    this.daylightData = [];

    // Generate daylight data for rooms
    const roomIds = ['room_1', 'room_2', 'room_3', 'room_4', 'room_5'];

    roomIds.forEach(roomId => {
      const position = new Vector3(
        (Math.random() - 0.5) * 15,
        1.5, // Typical working height
        (Math.random() - 0.5) * 15
      );

      const illuminance = 100 + Math.random() * 900; // lux
      const daylightAutonomy = Math.random() * 100; // percentage
      const usefulDaylightIlluminance = Math.random() * 100; // percentage
      const glareIndex = Math.random() * 30; // DGI

      const daylightData: DaylightData = {
        roomId,
        position,
        illuminance,
        daylightAutonomy,
        usefulDaylightIlluminance,
        glareIndex,
        skyComponent: illuminance * 0.6,
        externallyReflectedComponent: illuminance * 0.3,
        internallyReflectedComponent: illuminance * 0.1,
        visible: false
      };

      this.daylightData.push(daylightData);
      this.createDaylightMesh(daylightData);
    });
  }

  private generateThermalComfortData(): void {
    // Clear existing data
    this.thermalComfortData = [];

    // Generate thermal comfort data for zones
    const zoneIds = ['zone_1', 'zone_2', 'zone_3', 'zone_4'];

    zoneIds.forEach(zoneId => {
      const position = new Vector3(
        (Math.random() - 0.5) * 20,
        1.5,
        (Math.random() - 0.5) * 20
      );

      const temperature = 18 + Math.random() * 12; // 18-30°C
      const humidity = 30 + Math.random() * 40; // 30-70%
      const airVelocity = 0.1 + Math.random() * 0.4; // m/s
      const meanRadiantTemperature = temperature + (Math.random() - 0.5) * 4;

      // Calculate PMV using simplified formula
      const pmv = (temperature - 24) * 0.1 + (humidity - 50) * 0.01;
      const ppd = Math.min(100, Math.abs(pmv) * 20);

      let comfortCategory: ThermalComfortData['comfortCategory'];
      if (Math.abs(pmv) < 0.5) comfortCategory = 'neutral';
      else if (pmv < -0.5) comfortCategory = pmv < -1.5 ? 'cold' : 'cool';
      else comfortCategory = pmv > 1.5 ? 'hot' : 'warm';

      const thermalData: ThermalComfortData = {
        zoneId,
        position,
        temperature,
        humidity,
        airVelocity,
        meanRadiantTemperature,
        predictedMeanVote: pmv,
        predictedPercentageDissatisfied: ppd,
        comfortCategory,
        visible: false
      };

      this.thermalComfortData.push(thermalData);
      this.createThermalComfortMesh(thermalData);
    });
  }

  // Visualization update methods
  private updateStructuralStressVisualization(): void {
    this.structuralStressData.forEach(data => {
      if (data.mesh) {
        this.updateStructuralStressMesh(data);
      }
    });
  }

  private updateWindFlowVisualization(): void {
    // Update wind flow particle systems
    this.windFlowData.forEach(data => {
      if (data.particleSystem) {
        // Update particle system properties based on wind data
        // This would typically update particle velocity, direction, etc.
      }
    });
  }

  private updateDaylightVisualization(): void {
    this.daylightData.forEach(data => {
      if (data.mesh) {
        this.updateDaylightMesh(data);
      }
    });
  }

  private updateThermalComfortVisualization(): void {
    this.thermalComfortData.forEach(data => {
      if (data.mesh) {
        this.updateThermalComfortMesh(data);
      }
    });
  }

  // Mesh creation methods
  private createStructuralStressMesh(data: StructuralStressData): void {
    const mesh = Mesh.CreateBox(`${data.elementId}_stress`, 0.2, this.scene);
    mesh.position = data.criticalPoints[0];

    const material = new StandardMaterial(`${data.elementId}_stress_material`, this.scene);
    material.diffuseColor = this.getStressColor(data.stressLevel);
    material.emissiveColor = this.getStressEmissiveColor(data.stressLevel);
    mesh.material = material;

    if (this.structuralGroup) {
      mesh.parent = this.structuralGroup;
    }

    data.mesh = mesh;
    data.visible = false;
  }

  private createDaylightMesh(data: DaylightData): void {
    const mesh = Mesh.CreateSphere(`${data.roomId}_daylight`, 0.1, 8, this.scene);
    mesh.position = data.position;

    const material = new StandardMaterial(`${data.roomId}_daylight_material`, this.scene);
    material.diffuseColor = this.getDaylightColor(data.daylightAutonomy);
    material.emissiveColor = this.getDaylightEmissiveColor(data.daylightAutonomy);
    mesh.material = material;

    if (this.daylightGroup) {
      mesh.parent = this.daylightGroup;
    }

    data.mesh = mesh;
    data.visible = false;
  }

  private createThermalComfortMesh(data: ThermalComfortData): void {
    const mesh = Mesh.CreateCylinder(`${data.zoneId}_thermal`, 0.1, 0.05, 0.05, 8, 1, this.scene);
    mesh.position = data.position;

    const material = new StandardMaterial(`${data.zoneId}_thermal_material`, this.scene);
    material.diffuseColor = this.getThermalComfortColor(data.comfortCategory);
    material.emissiveColor = this.getThermalComfortEmissiveColor(data.comfortCategory);
    mesh.material = material;

    if (this.thermalGroup) {
      mesh.parent = this.thermalGroup;
    }

    data.mesh = mesh;
    data.visible = false;
  }

  // Mesh update methods
  private updateStructuralStressMesh(data: StructuralStressData): void {
    if (!data.mesh) return;

    const material = data.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = this.getStressColor(data.stressLevel);
    material.emissiveColor = this.getStressEmissiveColor(data.stressLevel);

    // Scale based on stress level
    const scale = 0.5 + data.stressLevel * 0.5;
    data.mesh.scaling = new Vector3(scale, scale, scale);
  }

  private updateDaylightMesh(data: DaylightData): void {
    if (!data.mesh) return;

    const material = data.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = this.getDaylightColor(data.daylightAutonomy);
    material.emissiveColor = this.getDaylightEmissiveColor(data.daylightAutonomy);

    // Scale based on illuminance
    const scale = 0.5 + (data.illuminance / 1000) * 2;
    data.mesh.scaling = new Vector3(scale, scale, scale);
  }

  private updateThermalComfortMesh(data: ThermalComfortData): void {
    if (!data.mesh) return;

    const material = data.mesh.material as StandardMaterial;
    if (!material) return;

    material.diffuseColor = this.getThermalComfortColor(data.comfortCategory);
    material.emissiveColor = this.getThermalComfortEmissiveColor(data.comfortCategory);

    // Pulse effect for uncomfortable conditions
    if (data.comfortCategory !== 'neutral') {
      const pulseIntensity = (Math.sin(this.simulationTime * 3) + 1) / 2;
      material.emissiveColor = material.emissiveColor.scale(pulseIntensity);
    }
  }

  // Color helper methods
  private getStressColor(stressLevel: number): Color3 {
    if (stressLevel < 0.3) return new Color3(0, 1, 0); // Green - low stress
    if (stressLevel < 0.7) return new Color3(1, 1, 0); // Yellow - medium stress
    return new Color3(1, 0, 0); // Red - high stress
  }

  private getStressEmissiveColor(stressLevel: number): Color3 {
    return this.getStressColor(stressLevel).scale(0.3);
  }

  private getDaylightColor(daylightAutonomy: number): Color3 {
    if (daylightAutonomy > 75) return new Color3(0, 1, 0); // Green - good daylight
    if (daylightAutonomy > 50) return new Color3(1, 1, 0); // Yellow - moderate daylight
    return new Color3(1, 0.5, 0); // Orange - poor daylight
  }

  private getDaylightEmissiveColor(daylightAutonomy: number): Color3 {
    return this.getDaylightColor(daylightAutonomy).scale(0.4);
  }

  private getThermalComfortColor(category: ThermalComfortData['comfortCategory']): Color3 {
    const colorMap = {
      'cold': new Color3(0, 0, 1), // Blue
      'cool': new Color3(0.5, 0.5, 1), // Light blue
      'slightly cool': new Color3(0.7, 0.7, 1), // Very light blue
      'neutral': new Color3(0, 1, 0), // Green
      'slightly warm': new Color3(1, 0.7, 0.7), // Light red
      'warm': new Color3(1, 0.5, 0.5), // Red
      'hot': new Color3(1, 0, 0) // Dark red
    };
    return colorMap[category];
  }

  private getThermalComfortEmissiveColor(category: ThermalComfortData['comfortCategory']): Color3 {
    return this.getThermalComfortColor(category).scale(0.3);
  }

  // Public methods for design validation simulations
  toggleStructuralStressVisualization(): void {
    if (this.structuralGroup) {
      const isVisible = this.structuralGroup.isEnabled();
      this.structuralGroup.setEnabled(!isVisible);

      this.structuralStressData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Structural stress visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  toggleWindFlowVisualization(): void {
    if (this.windGroup) {
      const isVisible = this.windGroup.isEnabled();
      this.windGroup.setEnabled(!isVisible);

      this.windFlowData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Wind flow visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  toggleDaylightVisualization(): void {
    if (this.daylightGroup) {
      const isVisible = this.daylightGroup.isEnabled();
      this.daylightGroup.setEnabled(!isVisible);

      this.daylightData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Daylight visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  toggleThermalComfortVisualization(): void {
    if (this.thermalGroup) {
      const isVisible = this.thermalGroup.isEnabled();
      this.thermalGroup.setEnabled(!isVisible);

      this.thermalComfortData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Thermal comfort visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  // Getters for design validation data
  getStructuralStressData(): StructuralStressData[] {
    return [...this.structuralStressData];
  }

  getWindFlowData(): WindFlowData[] {
    return [...this.windFlowData];
  }

  getDaylightData(): DaylightData[] {
    return [...this.daylightData];
  }

  getThermalComfortData(): ThermalComfortData[] {
    return [...this.thermalComfortData];
  }

  // Sustainability-related methods
  calculateEnergyEfficiency(modelId: string | null): number {
    if (!modelId) return 0.7; // Default efficiency

    // Calculate energy efficiency based on materials, insulation, and systems
    let efficiency = 0.5; // Base efficiency

    // Factor in insulation materials
    const insulationMaterials = this.materials.filter(m => m.type === 'insulation');
    if (insulationMaterials.length > 0) {
      efficiency += 0.2; // Insulation improves efficiency
    }

    // Factor in energy-efficient materials
    const efficientMaterials = this.materials.filter(m => m.environmentalImpact > 80);
    efficiency += (efficientMaterials.length / this.materials.length) * 0.3;

    return Math.min(efficiency, 1.0);
  }

  calculateWaterEfficiency(modelId: string): number {
    // Calculate water efficiency based on fixtures and systems
    // This is a placeholder - would need actual water fixture data
    return 0.8; // Assume 80% efficiency for now
  }

  getRenewableEnergyUsage(modelId: string): number {
    // Calculate renewable energy usage percentage
    // This would integrate with solar panel calculations, etc.
    return 0.25; // Assume 25% renewable energy usage
  }

  calculateEnergyUsage(modelId: string): number {
    // Calculate total energy usage in kWh/year
    let totalUsage = 0;

    // Base energy usage from building size and systems
    const buildingVolume = 10000; // cubic meters - would come from BIM model
    const energyIntensity = 150; // kWh/m³/year - typical office building
    totalUsage += buildingVolume * energyIntensity;

    // Add energy usage from materials
    this.materials.forEach(material => {
      switch (material.type) {
        case 'concrete':
          totalUsage += material.volume * 50; // kWh/m³ for concrete production
          break;
        case 'steel':
          totalUsage += material.volume * 100; // kWh/m³ for steel production
          break;
        case 'glass':
          totalUsage += material.volume * 80; // kWh/m³ for glass production
          break;
        case 'insulation':
          totalUsage -= material.volume * 20; // Insulation reduces energy usage
          break;
      }
    });

    return Math.max(0, totalUsage);
  }

  calculateEnergyCarbonFootprint(modelId: string): number {
    // Calculate carbon footprint from energy usage in kg CO2
    const energyUsage = this.calculateEnergyUsage(modelId);
    const carbonIntensity = 0.4; // kg CO2/kWh - average grid carbon intensity

    return energyUsage * carbonIntensity;
  }

  calculateWaterUsage(modelId: string): number {
    // Calculate total water usage in liters/year
    let totalUsage = 0;

    // Base water usage for typical building
    const occupantCount = 100; // Would come from BIM model
    const waterPerOccupant = 150; // liters/day per person
    totalUsage += occupantCount * waterPerOccupant * 365;

    // Add water usage from materials (embedded water)
    this.materials.forEach(material => {
      switch (material.type) {
        case 'concrete':
          totalUsage += material.volume * 200; // liters/m³ embedded water in concrete
          break;
        case 'steel':
          totalUsage += material.volume * 50; // liters/m³ embedded water in steel
          break;
        case 'wood':
          totalUsage += material.volume * 10; // liters/m³ embedded water in wood
          break;
      }
    });

    return totalUsage;
  }

  // Traffic & Parking simulation public methods
  simulateTrafficFlow(duration: number, density: 'low' | 'medium' | 'high'): void {
    // Update traffic flow data based on parameters
    this.trafficFlowData.forEach(flow => {
      const densityMultiplier = density === 'low' ? 0.5 : density === 'high' ? 2 : 1;
      flow.density = Math.random() * 100 * densityMultiplier;
      flow.congestionLevel = Math.min(1, flow.density / 100);
      flow.speed = 10 + Math.random() * 40 * (1 - flow.congestionLevel);
      flow.flowRate = flow.speed * flow.density;
    });
  }

  simulateParkingSpaces(): void {
    // Update parking space occupancy
    this.parkingSpaceData.forEach(space => {
      space.occupied = Math.random() < 0.7; // 70% occupancy
      space.occupancyRate = space.occupied ? 1 : 0;
      space.utilizationScore = space.occupancyRate * 100;
    });
  }

  simulateCongestion(): void {
    // Update congestion data
    this.congestionData.forEach(congestion => {
      congestion.congestionLevel = Math.random();
      congestion.averageDelay = congestion.congestionLevel * 30;
    });
  }

  toggleTrafficVisualization(): void {
    if (this.trafficParkingGroup) {
      const isVisible = this.trafficParkingGroup.isEnabled();
      this.trafficParkingGroup.setEnabled(!isVisible);

      this.trafficFlowData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Traffic visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  toggleParkingVisualization(): void {
    if (this.trafficParkingGroup) {
      const isVisible = this.trafficParkingGroup.isEnabled();
      this.trafficParkingGroup.setEnabled(!isVisible);

      this.parkingSpaceData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Parking visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  toggleCongestionVisualization(): void {
    if (this.trafficParkingGroup) {
      const isVisible = this.trafficParkingGroup.isEnabled();
      this.trafficParkingGroup.setEnabled(!isVisible);

      this.congestionData.forEach(data => {
        data.visible = !isVisible;
      });

      console.log(`Congestion visualization ${!isVisible ? 'enabled' : 'disabled'}`);
    }
  }

  getTrafficFlowData(): TrafficFlowData[] {
    return [...this.trafficFlowData];
  }

  getParkingSpaceData(): ParkingSpaceData[] {
    return [...this.parkingSpaceData];
  }

  getCongestionData(): CongestionData[] {
    return [...this.congestionData];
  }

  dispose() {
    this.stopSimulation();

    // Dispose maintenance meshes
    this.maintenanceIssues.forEach(issue => {
      issue.mesh?.dispose();
    });

    // Dispose material meshes
    this.materials.forEach(material => {
      material.mesh?.dispose();
    });

    // Dispose design validation meshes
    this.structuralStressData.forEach(data => {
      if (data.mesh) {
        data.mesh.dispose();
      }
    });

    this.daylightData.forEach(data => {
      if (data.mesh) {
        data.mesh.dispose();
      }
    });

    this.thermalComfortData.forEach(data => {
      if (data.mesh) {
        data.mesh.dispose();
      }
    });

    // Dispose traffic & parking meshes
    this.trafficFlowData.forEach(data => {
      if (data.mesh) {
        data.mesh.dispose();
      }
    });

    this.parkingSpaceData.forEach(data => {
      if (data.mesh) {
        data.mesh.dispose();
      }
    });

    this.congestionData.forEach(data => {
      if (data.mesh) {
        data.mesh.dispose();
      }
    });

    if (this.maintenanceGroup) {
      this.maintenanceGroup.dispose();
    }

    if (this.materialGroup) {
      this.materialGroup.dispose();
    }

    if (this.structuralGroup) {
      this.structuralGroup.dispose();
    }

    if (this.windGroup) {
      this.windGroup.dispose();
    }

    if (this.daylightGroup) {
      this.daylightGroup.dispose();
    }

    if (this.thermalGroup) {
      this.thermalGroup.dispose();
    }

    if (this.trafficParkingGroup) {
      this.trafficParkingGroup.dispose();
    }

    if (this.shadowGroup) {
      this.shadowGroup.dispose();
    }
    if (this.floodGroup) {
      this.floodGroup.dispose();
    }
    if (this.geoClimateGroup) {
      this.geoClimateGroup.dispose();
    }

    this.maintenanceIssues = [];
    this.materials = [];
    this.structuralStressData = [];
    this.windFlowData = [];
    this.daylightData = [];
    this.thermalComfortData = [];
    this.trafficFlowData = [];
    this.parkingSpaceData = [];
    this.congestionData = [];
  }
}
