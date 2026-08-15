import { Scene, AbstractMesh, StandardMaterial, Color3, Light } from '@babylonjs/core';
import { BIMManager } from '../BIMManager';

export interface BeforeAfterState {
  id: string;
  name: string;
  description: string;
  bimModel: any;
  materials: Map<string, any>;
  lighting: any;
  timestamp: Date;
}

/**
 * Manages before/after state comparisons with material and lighting blending
 */
export class BeforeAfterManager {
  private scene: Scene;
  private bimManager: BIMManager;

  private beforeState: BeforeAfterState | null = null;
  private afterState: BeforeAfterState | null = null;
  private comparisonMode: boolean = false;
  private comparisonSlider: number = 0.5; // 0 = before, 1 = after

  // Cached materials for performance
  private cachedMaterials: Map<string, any> = new Map();

  constructor(scene: Scene, bimManager: BIMManager) {
    this.scene = scene;
    this.bimManager = bimManager;
  }

  /**
   * Saves the current state as "before" for comparison
   * @param name - Name of the before state
   * @param description - Description of the before state
   */
  saveBeforeState(name: string, description: string): void {
    try {
      const currentModel = this.bimManager.getAllModels()[0];
      if (!currentModel) {
        throw new Error('No BIM model available to save before state');
      }

      this.beforeState = {
        id: `before_${Date.now()}`,
        name,
        description,
        bimModel: { ...currentModel }, // Shallow clone
        materials: new Map(),
        lighting: this.captureCurrentLighting(),
        timestamp: new Date()
      };

      // Capture current materials
      this.scene.meshes.forEach(mesh => {
        if (mesh.material) {
          this.beforeState!.materials.set(mesh.name, (mesh.material as any).clone(`${mesh.material.name}_before`));
        }
      });

      const sanitizedName = name.replace(/[\r\n\t]/g, '_');
      console.log(`Saved before state: ${sanitizedName}`);
    } catch (error) {
      console.error('Failed to save before state:', error);
      throw error;
    }
  }

  /**
   * Saves the current state as "after" for comparison
   * @param name - Name of the after state
   * @param description - Description of the after state
   */
  saveAfterState(name: string, description: string): void {
    try {
      const currentModel = this.bimManager.getAllModels()[0];
      if (!currentModel) {
        throw new Error('No BIM model available to save after state');
      }

      this.afterState = {
        id: `after_${Date.now()}`,
        name,
        description,
        bimModel: { ...currentModel }, // Shallow clone
        materials: new Map(),
        lighting: this.captureCurrentLighting(),
        timestamp: new Date()
      };

      // Capture current materials
      this.scene.meshes.forEach(mesh => {
        if (mesh.material) {
          this.afterState!.materials.set(mesh.name, (mesh.material as any).clone(`${mesh.material.name}_after`));
        }
      });

      const sanitizedName = name.replace(/[\r\n\t]/g, '_');
      console.log(`Saved after state: ${sanitizedName}`);
    } catch (error) {
      console.error('Failed to save after state:', error);
      throw error;
    }
  }

  /**
   * Enables comparison mode between before and after states
   */
  enableComparisonMode(): void {
    if (!this.beforeState || !this.afterState) {
      throw new Error('Both before and after states must be saved before enabling comparison mode');
    }

    this.comparisonMode = true;
    this.comparisonSlider = 0.5; // Start at middle
    this.applyComparisonBlend();

    console.log('Comparison mode enabled');
  }

  /**
   * Disables comparison mode and restores full after state
   */
  disableComparisonMode(): void {
    this.comparisonMode = false;

    // Restore full after state
    if (this.afterState) {
      this.applyState(this.afterState);
    }

    console.log('Comparison mode disabled');
  }

  /**
   * Sets the comparison slider value (0 = before, 1 = after)
   * @param value - Slider value between 0 and 1
   */
  setComparisonSlider(value: number): void {
    if (!this.comparisonMode) return;

    this.comparisonSlider = Math.max(0, Math.min(1, value));
    this.applyComparisonBlend();
  }

  /**
   * Applies blended state based on current slider position
   */
  private applyComparisonBlend(): void {
    if (!this.beforeState || !this.afterState) return;

    // Blend materials with caching for performance
    this.scene.meshes.forEach(mesh => {
      const beforeMaterial = this.beforeState!.materials.get(mesh.name);
      const afterMaterial = this.afterState!.materials.get(mesh.name);

      if (beforeMaterial && afterMaterial) {
        this.blendMaterials(mesh, beforeMaterial, afterMaterial, this.comparisonSlider);
      }
    });

    // Blend lighting
    this.blendLighting(this.beforeState.lighting, this.afterState.lighting, this.comparisonSlider);
  }

  /**
   * Blends two materials based on a factor
   * @param mesh - The mesh to apply blended material to
   * @param material1 - First material
   * @param material2 - Second material
   * @param blendFactor - Blend factor (0 = material1, 1 = material2)
   */
  private blendMaterials(mesh: AbstractMesh, material1: any, material2: any, blendFactor: number): void {
    try {
      if (material1 instanceof StandardMaterial && material2 instanceof StandardMaterial) {
        const cacheKey = `${mesh.name}_${blendFactor.toFixed(2)}`;
        let blendedMaterial = this.cachedMaterials.get(cacheKey);

        if (!blendedMaterial) {
          blendedMaterial = material1.clone(`${material1.name}_blended_${blendFactor.toFixed(2)}`);

          // Blend diffuse colors
          blendedMaterial.diffuseColor = Color3.Lerp(material1.diffuseColor, material2.diffuseColor, blendFactor);

          // Blend other properties
          blendedMaterial.specularColor = Color3.Lerp(material1.specularColor, material2.specularColor, blendFactor);
          blendedMaterial.emissiveColor = Color3.Lerp(material1.emissiveColor, material2.emissiveColor, blendFactor);
          blendedMaterial.ambientColor = Color3.Lerp(material1.ambientColor, material2.ambientColor, blendFactor);

          // Cache the blended material
          this.cachedMaterials.set(cacheKey, blendedMaterial);
        }

        mesh.material = blendedMaterial;
      }
    } catch (error) {
      console.error('Failed to blend materials:', error);
    }
  }

  /**
   * Blends lighting states based on a factor
   * @param lighting1 - First lighting state
   * @param lighting2 - Second lighting state
   * @param blendFactor - Blend factor (0 = lighting1, 1 = lighting2)
   */
  private blendLighting(lighting1: any, lighting2: any, blendFactor: number): void {
    try {
      // Blend ambient color
      this.scene.ambientColor = Color3.Lerp(lighting1.ambient, lighting2.ambient, blendFactor);

      // Blend light intensities
      this.scene.lights.forEach((light, index) => {
        if (lighting1.lights[index] && lighting2.lights[index]) {
          light.intensity = lighting1.lights[index].intensity * (1 - blendFactor) +
                            lighting2.lights[index].intensity * blendFactor;
        }
      });
    } catch (error) {
      console.error('Failed to blend lighting:', error);
    }
  }

  /**
   * Applies a specific state to the scene
   * @param state - The state to apply
   */
  private applyState(state: BeforeAfterState): void {
    try {
      // Apply materials
      state.materials.forEach((material, meshName) => {
        const mesh = this.scene.getMeshByName(meshName);
        if (mesh) {
          mesh.material = material;
        }
      });

      // Apply lighting
      this.applyLightingState(state.lighting);
    } catch (error) {
      console.error('Failed to apply state:', error);
    }
  }

  /**
   * Captures the current lighting state
   * @returns Current lighting configuration
   */
  private captureCurrentLighting(): any {
    return {
      ambient: (this.scene.ambientColor as any).clone(),
      lights: this.scene.lights.map(light => ({
        intensity: light.intensity,
        diffuse: light.diffuse ? (light.diffuse as any).clone() : null,
        specular: light.specular ? (light.specular as any).clone() : null
      }))
    };
  }

  /**
   * Applies a lighting state to the scene
   * @param lighting - Lighting configuration to apply
   */
  private applyLightingState(lighting: any): void {
    try {
      this.scene.ambientColor = lighting.ambient;

      this.scene.lights.forEach((light, index) => {
        if (lighting.lights[index]) {
          light.intensity = lighting.lights[index].intensity;
          if (lighting.lights[index].diffuse) {
            light.diffuse = lighting.lights[index].diffuse;
          }
          if (lighting.lights[index].specular) {
            light.specular = lighting.lights[index].specular;
          }
        }
      });
    } catch (error) {
      console.error('Failed to apply lighting state:', error);
    }
  }

  /**
   * Gets the current comparison slider value
   * @returns Slider value between 0 and 1
   */
  getComparisonSlider(): number {
    return this.comparisonSlider;
  }

  /**
   * Checks if comparison mode is currently enabled
   * @returns True if comparison mode is active
   */
  isComparisonModeEnabled(): boolean {
    return this.comparisonMode;
  }

  /**
   * Gets the before state
   * @returns Before state or null if not set
   */
  getBeforeState(): BeforeAfterState | null {
    return this.beforeState;
  }

  /**
   * Gets the after state
   * @returns After state or null if not set
   */
  getAfterState(): BeforeAfterState | null {
    return this.afterState;
  }

  /**
   * Clears cached materials to free memory
   */
  clearCache(): void {
    this.cachedMaterials.clear();
  }

  /**
   * Disposes of the manager and clears all states
   */
  dispose(): void {
    this.beforeState = null;
    this.afterState = null;
    this.comparisonMode = false;
    this.clearCache();
  }
}
