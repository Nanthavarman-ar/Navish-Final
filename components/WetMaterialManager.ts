import * as BABYLON from "@babylonjs/core";

export interface WetMaterialOptions {
  dryMaterial: BABYLON.Material;
  wetMaterial: BABYLON.Material;
  transitionDistance: number;
  waterLevel: number;
  transitionSpeed: number;
  wetnessMultiplier: number;
}

export interface WetMaterialState {
  meshId: string;
  wetnessLevel: number;
  isTransitioning: boolean;
  lastUpdateTime: number;
}

export interface WaterLevelSimulation {
  enabled: boolean;
  amplitude: number;
  frequency: number;
  baseLevel: number;
  waveType: 'sine' | 'triangle' | 'square';
  speed: number;
}

export class WetMaterialManager {
  private scene: BABYLON.Scene;
  private waterLevel: number = 0;
  private transitionDistance: number = 2.0;
  private transitionSpeed: number = 1.0;
  private wetnessMultiplier: number = 1.0;
  private wetMaterials: Map<string, WetMaterialOptions> = new Map();
  private materialStates: Map<string, WetMaterialState> = new Map();
  private updateInterval: number = 100; // ms
  private lastUpdateTime: number = 0;

  private waterLevelSimulation: WaterLevelSimulation = {
    enabled: false,
    amplitude: 0.5,
    frequency: 1.0,
    baseLevel: 0,
    waveType: 'sine',
    speed: 1.0
  };

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.setupUpdateLoop();
  }

  /**
   * Register a material pair for wet/dry transitions
   */
  registerWetMaterial(mesh: BABYLON.AbstractMesh, options: WetMaterialOptions): void {
    const meshId = mesh.id;

    // Store the original material if not already stored
    if (!this.wetMaterials.has(meshId)) {
      this.wetMaterials.set(meshId, options);

      // Initialize material state
      this.materialStates.set(meshId, {
        meshId,
        wetnessLevel: 0,
        isTransitioning: false,
        lastUpdateTime: Date.now()
      });

      // Set initial material
      mesh.material = options.dryMaterial;
    }
  }

  /**
   * Update water level for all registered materials
   */
  setWaterLevel(level: number): void {
    this.waterLevel = level;
  }

  /**
   * Enable or disable real-time water level simulation
   */
  enableWaterLevelSimulation(enabled: boolean): void {
    this.waterLevelSimulation.enabled = enabled;
    if (!enabled) {
      this.waterLevel = this.waterLevelSimulation.baseLevel;
    }
  }

  /**
   * Set parameters for water level simulation
   */
  setWaterLevelSimulationParams(params: Partial<WaterLevelSimulation>): void {
    this.waterLevelSimulation = { ...this.waterLevelSimulation, ...params };
  }

  /**
   * Update water level based on simulation
   */
  private updateWaterLevelSimulation(deltaTime: number): void {
    if (!this.waterLevelSimulation.enabled) return;

    const sim = this.waterLevelSimulation;
    const time = (Date.now() / 1000) * sim.speed;

    let waveValue = 0;
    switch (sim.waveType) {
      case 'sine':
        waveValue = Math.sin(2 * Math.PI * sim.frequency * time);
        break;
      case 'triangle':
        waveValue = 2 * Math.abs(2 * (time * sim.frequency - Math.floor(time * sim.frequency + 0.5))) - 1;
        break;
      case 'square':
        waveValue = Math.sign(Math.sin(2 * Math.PI * sim.frequency * time));
        break;
    }

    this.waterLevel = sim.baseLevel + sim.amplitude * waveValue;
  }

  /**
   * Update transition parameters
   */
  setTransitionParameters(distance: number, speed: number, multiplier: number = 1.0): void {
    this.transitionDistance = distance;
    this.transitionSpeed = speed;
    this.wetnessMultiplier = multiplier;
  }

  /**
   * Calculate wetness level based on mesh position relative to water
   */
  private calculateWetnessLevel(mesh: BABYLON.AbstractMesh): number {
    const meshPosition = mesh.getAbsolutePosition();
    const distanceToWater = Math.abs(meshPosition.y - this.waterLevel);

    if (distanceToWater <= 0) {
      // Mesh is underwater
      return 1.0 * this.wetnessMultiplier;
    } else if (distanceToWater <= this.transitionDistance) {
      // Mesh is in transition zone
      const normalizedDistance = distanceToWater / this.transitionDistance;
      return (1.0 - normalizedDistance) * this.wetnessMultiplier;
    } else {
      // Mesh is dry
      return 0.0;
    }
  }

  /**
   * Interpolate between dry and wet materials
   */
  private interpolateMaterials(dryMat: BABYLON.Material, wetMat: BABYLON.Material, wetness: number): BABYLON.Material {
    // For PBR materials, interpolate properties
    if (dryMat instanceof BABYLON.PBRMaterial && wetMat instanceof BABYLON.PBRMaterial) {
      const interpolatedMat = dryMat.clone(`wet_${dryMat.name}_${wetness.toFixed(2)}`);

      // Interpolate albedo color
      const dryColor = dryMat.albedoColor || new BABYLON.Color3(1, 1, 1);
      const wetColor = wetMat.albedoColor || new BABYLON.Color3(1, 1, 1);
      interpolatedMat.albedoColor = BABYLON.Color3.Lerp(dryColor, wetColor, wetness);

      // Interpolate metallic and roughness
      interpolatedMat.metallic = BABYLON.Scalar.Lerp(dryMat.metallic || 0, wetMat.metallic || 0, wetness);
      interpolatedMat.roughness = BABYLON.Scalar.Lerp(dryMat.roughness || 1, wetMat.roughness || 1, wetness);

      // Adjust reflectivity based on wetness
      // PBRMaterial does not have reflectivity property, use reflectivityColor or reflectivityTexture if needed
      // For now, skip reflectivity interpolation or use reflectivityColor if available
      if (dryMat.reflectivityColor && wetMat.reflectivityColor) {
        interpolatedMat.reflectivityColor = BABYLON.Color3.Lerp(dryMat.reflectivityColor, wetMat.reflectivityColor, wetness);
      }

      return interpolatedMat;
    }

    // For standard materials
    if (dryMat instanceof BABYLON.StandardMaterial && wetMat instanceof BABYLON.StandardMaterial) {
      const interpolatedMat = dryMat.clone(`wet_${dryMat.name}_${wetness.toFixed(2)}`);

      // Interpolate diffuse color
      const dryColor = dryMat.diffuseColor;
      const wetColor = wetMat.diffuseColor;
      interpolatedMat.diffuseColor = BABYLON.Color3.Lerp(dryColor, wetColor, wetness);

      // Interpolate specular properties
      interpolatedMat.specularColor = BABYLON.Color3.Lerp(
        dryMat.specularColor,
        wetMat.specularColor,
        wetness
      );

      return interpolatedMat;
    }

    // Fallback: return wet material if wetness > 0.5, otherwise dry
    return wetness > 0.5 ? wetMat : dryMat;
  }

  /**
   * Update material for a specific mesh
   */
  private updateMeshMaterial(mesh: BABYLON.AbstractMesh): void {
    const meshId = mesh.id;
    const options = this.wetMaterials.get(meshId);
    const state = this.materialStates.get(meshId);

    if (!options || !state) return;

    const currentWetness = this.calculateWetnessLevel(mesh);
    const targetWetness = Math.max(0, Math.min(1, currentWetness));

    // Check if transition is needed
    if (Math.abs(state.wetnessLevel - targetWetness) > 0.01) {
      state.isTransitioning = true;

      // Smooth transition
      const deltaTime = (Date.now() - state.lastUpdateTime) / 1000;
      const transitionAmount = this.transitionSpeed * deltaTime;

      if (state.wetnessLevel < targetWetness) {
        state.wetnessLevel = Math.min(targetWetness, state.wetnessLevel + transitionAmount);
      } else {
        state.wetnessLevel = Math.max(targetWetness, state.wetnessLevel - transitionAmount);
      }

      // Update material
      const interpolatedMaterial = this.interpolateMaterials(
        options.dryMaterial,
        options.wetMaterial,
        state.wetnessLevel
      );

      mesh.material = interpolatedMaterial;
      state.lastUpdateTime = Date.now();
    } else {
      state.isTransitioning = false;
    }
  }

  /**
   * Setup update loop for material transitions
   */
  private setupUpdateLoop(): void {
    this.scene.onBeforeRenderObservable.add(() => {
      const currentTime = Date.now();
      if (currentTime - this.lastUpdateTime >= this.updateInterval) {
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.updateWaterLevelSimulation(deltaTime);
        this.updateAllMaterials();
        this.lastUpdateTime = currentTime;
      }
    });
  }

  /**
   * Update all registered materials
   */
  private updateAllMaterials(): void {
    this.scene.meshes.forEach(mesh => {
      if (this.wetMaterials.has(mesh.id)) {
        this.updateMeshMaterial(mesh);
      }
    });
  }

  /**
   * Get current wetness level for a mesh
   */
  getWetnessLevel(meshId: string): number {
    const state = this.materialStates.get(meshId);
    return state ? state.wetnessLevel : 0;
  }

  /**
   * Force update all materials immediately
   */
  forceUpdate(): void {
    this.updateAllMaterials();
  }

  /**
   * Remove a mesh from wet material management
   */
  removeWetMaterial(meshId: string): void {
    this.wetMaterials.delete(meshId);
    this.materialStates.delete(meshId);
  }

  /**
   * Get all registered wet materials
   */
  getRegisteredMaterials(): string[] {
    return Array.from(this.wetMaterials.keys());
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.wetMaterials.clear();
    this.materialStates.clear();
  }
}
