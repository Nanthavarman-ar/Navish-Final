import * as BABYLON from "@babylonjs/core";
import { SyncManager } from "./SyncManager";
import {
  MaterialPreset,
  MaterialState,
  MaterialEvent,
  MaterialManagerOptions,
  TextureLoadOptions,
  MaterialPerformanceMetrics,
  MaterialVariation,
  ProceduralMaterialConfig
} from "./interfaces/MaterialInterfaces";

export class MaterialManager {
  private scene: BABYLON.Scene;
  private syncManager: SyncManager | null;
  private materials: Map<string, BABYLON.Material> = new Map();
  private materialStates: Map<string, MaterialState> = new Map();
  private materialPresets: Map<string, MaterialPreset> = new Map();
  private eventCallbacks: ((event: MaterialEvent) => void)[] = [];
  private textureCache: Map<string, BABYLON.Texture> = new Map();
  private materialPool: BABYLON.Material[] = [];
  private maxPoolSize: number = 50;

  // Error tracking
  private errors: Array<{ timestamp: number; error: Error; context: string }> = [];
  private maxErrors: number = 100;

  constructor(scene: BABYLON.Scene, syncManager?: SyncManager) {
    // Validate inputs
    if (!scene) {
      throw new Error('MaterialManager: Scene is required');
    }

    this.scene = scene;
    this.syncManager = syncManager || null;

    try {
      this.initializeDefaultPresets();
    } catch (error) {
      this.logError(error as Error, 'constructor');
      throw error;
    }
  }

  /**
   * Validate material preset
   */
  private validateMaterialPreset(preset: MaterialPreset): boolean {
    if (!preset.id || typeof preset.id !== 'string') {
      this.logError(new Error('Invalid material preset ID'), 'validateMaterialPreset');
      return false;
    }

    if (!preset.name || typeof preset.name !== 'string') {
      this.logError(new Error('Invalid material preset name'), 'validateMaterialPreset');
      return false;
    }

    if (!preset.category || typeof preset.category !== 'string') {
      this.logError(new Error('Invalid material preset category'), 'validateMaterialPreset');
      return false;
    }

    if (!preset.properties || typeof preset.properties !== 'object') {
      this.logError(new Error('Invalid material preset properties'), 'validateMaterialPreset');
      return false;
    }

    if (!preset.preview || typeof preset.preview !== 'string') {
      this.logError(new Error('Invalid material preset preview'), 'validateMaterialPreset');
      return false;
    }

    return true;
  }

  /**
   * Validate material state
   */
  private validateMaterialState(state: MaterialState): boolean {
    if (!state.id || typeof state.id !== 'string') {
      this.logError(new Error('Invalid material state ID'), 'validateMaterialState');
      return false;
    }

    if (!state.name || typeof state.name !== 'string') {
      this.logError(new Error('Invalid material state name'), 'validateMaterialState');
      return false;
    }

    if (!['standard', 'pbr', 'procedural'].includes(state.type)) {
      this.logError(new Error('Invalid material state type'), 'validateMaterialState');
      return false;
    }

    if (typeof state.isActive !== 'boolean') {
      this.logError(new Error('Invalid material state isActive flag'), 'validateMaterialState');
      return false;
    }

    if (typeof state.lastModified !== 'number' || state.lastModified <= 0) {
      this.logError(new Error('Invalid material state lastModified timestamp'), 'validateMaterialState');
      return false;
    }

    return true;
  }

  /**
   * Validate mesh target
   */
  private validateMesh(mesh: BABYLON.AbstractMesh): boolean {
    if (!mesh) {
      this.logError(new Error('Mesh is null or undefined'), 'validateMesh');
      return false;
    }

    if (!mesh.name || typeof mesh.name !== 'string') {
      this.logError(new Error('Mesh must have a valid name'), 'validateMesh');
      return false;
    }

    return true;
  }

  /**
   * Log error with context
   */
  private logError(error: Error, context: string): void {
    const errorEntry = {
      timestamp: Date.now(),
      error,
      context
    };

    this.errors.push(errorEntry);

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    console.error(`MaterialManager Error [${context}]:`, error.message);

    // Emit error event
    this.emitEvent({
      type: 'error',
      materialId: 'error',
      timestamp: Date.now(),
      data: { error: error.message, context }
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): Array<{ timestamp: number; error: Error; context: string }> {
    return this.errors.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Initialize default material presets
   */
  private initializeDefaultPresets(): void {
    const defaultPresets: MaterialPreset[] = [
      // Metals
      {
        id: 'gold',
        name: 'Gold',
        description: 'A luxurious gold material with high metallic shine',
        materialType: 'pbr',
        category: 'metal',
        properties: {
          diffuseColor: new BABYLON.Color3(1, 0.8, 0),
          specularColor: new BABYLON.Color3(1, 1, 0.8),
          emissiveColor: new BABYLON.Color3(0.1, 0.05, 0),
          alpha: 1.0,
          specularPower: 64,
          metallic: 1.0,
          roughness: 0.1
        },
        preview: '#FFD700',
        tags: ['precious', 'shiny', 'expensive']
      },
      {
        id: 'silver',
        name: 'Silver',
        description: 'A reflective silver material suitable for industrial and decorative use',
        materialType: 'pbr',
        category: 'metal',
        properties: {
          diffuseColor: new BABYLON.Color3(0.8, 0.8, 0.9),
          specularColor: new BABYLON.Color3(1, 1, 1),
          emissiveColor: new BABYLON.Color3(0.05, 0.05, 0.05),
          alpha: 1.0,
          specularPower: 128,
          metallic: 1.0,
          roughness: 0.05
        },
        preview: '#C0C0C0',
        tags: ['precious', 'shiny', 'industrial']
      },
      {
        id: 'copper',
        name: 'Copper',
        description: 'Warm copper material with natural patina potential',
        materialType: 'pbr',
        category: 'metal',
        properties: {
          diffuseColor: new BABYLON.Color3(0.8, 0.5, 0.2),
          specularColor: new BABYLON.Color3(1, 0.7, 0.4),
          emissiveColor: new BABYLON.Color3(0.1, 0.02, 0),
          alpha: 1.0,
          specularPower: 32,
          metallic: 1.0,
          roughness: 0.2
        },
        preview: '#B87333',
        tags: ['industrial', 'warm', 'conductive']
      },

      // Plastics
      {
        id: 'red_plastic',
        name: 'Red Plastic',
        description: 'Vibrant red plastic material for modern designs',
        materialType: 'pbr',
        category: 'plastic',
        properties: {
          diffuseColor: new BABYLON.Color3(0.8, 0.1, 0.1),
          specularColor: new BABYLON.Color3(0.3, 0.3, 0.3),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 32,
          metallic: 0.0,
          roughness: 0.3
        },
        preview: '#CC0000',
        tags: ['synthetic', 'durable', 'lightweight']
      },
      {
        id: 'blue_plastic',
        name: 'Blue Plastic',
        description: 'Cool blue plastic for versatile applications',
        materialType: 'pbr',
        category: 'plastic',
        properties: {
          diffuseColor: new BABYLON.Color3(0.1, 0.3, 0.8),
          specularColor: new BABYLON.Color3(0.4, 0.4, 0.4),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 32,
          metallic: 0.0,
          roughness: 0.3
        },
        preview: '#0066CC',
        tags: ['synthetic', 'versatile', 'recyclable']
      },

      // Woods
      {
        id: 'oak',
        name: 'Oak Wood',
        description: 'Classic oak wood with natural grain texture',
        materialType: 'pbr',
        category: 'wood',
        properties: {
          diffuseColor: new BABYLON.Color3(0.6, 0.4, 0.2),
          specularColor: new BABYLON.Color3(0.2, 0.2, 0.2),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 16,
          metallic: 0.0,
          roughness: 0.8
        },
        preview: '#8B4513',
        tags: ['natural', 'hardwood', 'durable']
      },
      {
        id: 'pine',
        name: 'Pine Wood',
        description: 'Light pine wood for affordable furniture',
        materialType: 'pbr',
        category: 'wood',
        properties: {
          diffuseColor: new BABYLON.Color3(0.7, 0.6, 0.4),
          specularColor: new BABYLON.Color3(0.3, 0.3, 0.3),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 16,
          metallic: 0.0,
          roughness: 0.7
        },
        preview: '#DEB887',
        tags: ['natural', 'softwood', 'affordable']
      },

      // Fabrics
      {
        id: 'cotton_white',
        name: 'White Cotton',
        description: 'Soft white cotton fabric for textiles',
        materialType: 'pbr',
        category: 'fabric',
        properties: {
          diffuseColor: new BABYLON.Color3(0.95, 0.95, 0.95),
          specularColor: new BABYLON.Color3(0.1, 0.1, 0.1),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 8,
          metallic: 0.0,
          roughness: 0.9
        },
        preview: '#F5F5F5',
        tags: ['natural', 'breathable', 'soft']
      },
      {
        id: 'wool_gray',
        name: 'Gray Wool',
        description: 'Warm gray wool for winter clothing',
        materialType: 'pbr',
        category: 'fabric',
        properties: {
          diffuseColor: new BABYLON.Color3(0.5, 0.5, 0.5),
          specularColor: new BABYLON.Color3(0.2, 0.2, 0.2),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 8,
          metallic: 0.0,
          roughness: 0.95
        },
        preview: '#808080',
        tags: ['natural', 'warm', 'textured']
      },

      // Glass
      {
        id: 'clear_glass',
        name: 'Clear Glass',
        description: 'Transparent clear glass for windows and displays',
        materialType: 'pbr',
        category: 'glass',
        properties: {
          diffuseColor: new BABYLON.Color3(0.9, 0.9, 1.0),
          specularColor: new BABYLON.Color3(1, 1, 1),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 0.2,
          specularPower: 256,
          metallic: 0.0,
          roughness: 0.0,
          indexOfRefraction: 1.5
        },
        preview: '#E0F7FF',
        tags: ['transparent', 'fragile', 'reflective']
      },
      {
        id: 'tinted_glass',
        name: 'Tinted Glass',
        description: 'Semi-transparent tinted glass for privacy',
        materialType: 'pbr',
        category: 'glass',
        properties: {
          diffuseColor: new BABYLON.Color3(0.3, 0.5, 0.7),
          specularColor: new BABYLON.Color3(0.8, 0.9, 1.0),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 0.4,
          specularPower: 256,
          metallic: 0.0,
          roughness: 0.0,
          indexOfRefraction: 1.5
        },
        preview: '#4A90E2',
        tags: ['semi-transparent', 'privacy', 'modern']
      },

      // Stone
      {
        id: 'marble_white',
        name: 'White Marble',
        description: 'Elegant white marble for luxury surfaces',
        materialType: 'pbr',
        category: 'stone',
        properties: {
          diffuseColor: new BABYLON.Color3(0.95, 0.95, 0.95),
          specularColor: new BABYLON.Color3(0.8, 0.8, 0.8),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 128,
          metallic: 0.0,
          roughness: 0.1
        },
        preview: '#F5F5F5',
        tags: ['luxury', 'polished', 'heavy']
      },
      {
        id: 'granite_gray',
        name: 'Gray Granite',
        description: 'Durable gray granite for construction',
        materialType: 'pbr',
        category: 'stone',
        properties: {
          diffuseColor: new BABYLON.Color3(0.6, 0.6, 0.6),
          specularColor: new BABYLON.Color3(0.4, 0.4, 0.4),
          emissiveColor: new BABYLON.Color3(0, 0, 0),
          alpha: 1.0,
          specularPower: 64,
          metallic: 0.0,
          roughness: 0.3
        },
        preview: '#696969',
        tags: ['durable', 'textured', 'versatile']
      }
    ];

    defaultPresets.forEach(preset => {
      this.materialPresets.set(preset.id, preset);
    });
  }

  /**
   * Create a new material from preset
   */
  createMaterialFromPreset(presetId: string, name?: string): BABYLON.Material | null {
    const preset = this.materialPresets.get(presetId);
    if (!preset) {
      const sanitizedPresetId = presetId.replace(/[\r\n\t]/g, '_');
      console.warn(`Material preset '${sanitizedPresetId}' not found`);
      return null;
    }

    const materialName = name || `${preset.name}_${Date.now()}`;
    let material: BABYLON.Material;

    // Create appropriate material type
    if (preset.properties.metallic !== undefined && preset.properties.roughness !== undefined) {
      // PBR Material
      material = new BABYLON.PBRMaterial(materialName, this.scene);
      const pbrMaterial = material as BABYLON.PBRMaterial;

      if (preset.properties.diffuseColor) {
        pbrMaterial.albedoColor = preset.properties.diffuseColor;
      }
      if (preset.properties.metallic !== undefined) {
        pbrMaterial.metallic = preset.properties.metallic;
      }
      if (preset.properties.roughness !== undefined) {
        pbrMaterial.roughness = preset.properties.roughness;
      }
      if (preset.properties.emissiveColor) {
        pbrMaterial.emissiveColor = preset.properties.emissiveColor;
      }
      if (preset.properties.alpha !== undefined) {
        pbrMaterial.alpha = preset.properties.alpha;
      }
      if (preset.properties.indexOfRefraction !== undefined) {
        pbrMaterial.indexOfRefraction = preset.properties.indexOfRefraction;
      }
    } else {
      // Standard Material
      material = new BABYLON.StandardMaterial(materialName, this.scene);
      const standardMaterial = material as BABYLON.StandardMaterial;

      if (preset.properties.diffuseColor) {
        standardMaterial.diffuseColor = preset.properties.diffuseColor;
      }
      if (preset.properties.specularColor) {
        standardMaterial.specularColor = preset.properties.specularColor;
      }
      if (preset.properties.emissiveColor) {
        standardMaterial.emissiveColor = preset.properties.emissiveColor;
      }
      if (preset.properties.ambientColor) {
        standardMaterial.ambientColor = preset.properties.ambientColor;
      }
      if (preset.properties.alpha !== undefined) {
        standardMaterial.alpha = preset.properties.alpha;
      }
      if (preset.properties.specularPower !== undefined) {
        standardMaterial.specularPower = preset.properties.specularPower;
      }
    }

    // Register material
    this.materials.set(materialName, material);

    // Create material state
    const state: MaterialState = {
      id: materialName,
      name: materialName,
      type: preset.properties.metallic !== undefined ? 'pbr' : 'standard',
      properties: preset.properties,
      isActive: true,
      lastModified: Date.now()
    };
    this.materialStates.set(materialName, state);

    // Emit event
    this.emitEvent({
      type: 'created',
      materialId: materialName,
      timestamp: Date.now(),
      data: { presetId, state }
    });

    return material;
  }

  /**
   * Apply material to mesh
   */
  applyMaterialToMesh(materialId: string, mesh: BABYLON.AbstractMesh): boolean {
    const material = this.materials.get(materialId);
    if (!material) {
      console.warn(`Material '${materialId}' not found`);
      return false;
    }

    try {
      // Bind material to mesh and ensure shader program is current
      mesh.material = material;

      // Force material to bind to the mesh to update shader uniforms
      if (material.getEffect) {
        const effect = material.getEffect();
        if (effect && typeof (effect as any).bind === 'function') {
          (effect as any).bind();
        }
      }
    } catch (error) {
      console.error(`Error applying material '${materialId}' to mesh '${mesh.name}':`, error);
      return false;
    }

    // Emit event
    this.emitEvent({
      type: 'applied',
      materialId,
      timestamp: Date.now(),
      data: { meshId: mesh.id }
    });

    return true;
  }

  /**
   * Update material properties
   */
  updateMaterialProperties(materialId: string, properties: Partial<MaterialPreset['properties']>): boolean {
    const material = this.materials.get(materialId);
    const state = this.materialStates.get(materialId);

    if (!material || !state) {
      console.warn(`Material '${materialId}' not found`);
      return false;
    }

    // Update properties based on material type
    if (material instanceof BABYLON.PBRMaterial) {
      const pbrMaterial = material as BABYLON.PBRMaterial;

      if (properties.diffuseColor) {
        pbrMaterial.albedoColor = properties.diffuseColor;
      }
      if (properties.metallic !== undefined && properties.metallic !== null) {
        (pbrMaterial as any).metallic = properties.metallic;
      }
      if (properties.roughness !== undefined && properties.roughness !== null) {
        (pbrMaterial as any).roughness = properties.roughness;
      }
      if (properties.emissiveColor) {
        pbrMaterial.emissiveColor = properties.emissiveColor;
      }
      if (properties.alpha !== undefined) {
        pbrMaterial.alpha = properties.alpha;
      }
      if (properties.indexOfRefraction !== undefined) {
        pbrMaterial.indexOfRefraction = properties.indexOfRefraction;
      }
    } else {
      const standardMaterial = material as BABYLON.StandardMaterial;

      if (properties.diffuseColor) {
        standardMaterial.diffuseColor = properties.diffuseColor;
      }
      if (properties.specularColor) {
        standardMaterial.specularColor = properties.specularColor;
      }
      if (properties.emissiveColor) {
        standardMaterial.emissiveColor = properties.emissiveColor;
      }
      if (properties.ambientColor) {
        standardMaterial.ambientColor = properties.ambientColor;
      }
      if (properties.alpha !== undefined) {
        standardMaterial.alpha = properties.alpha;
      }
      if (properties.specularPower !== undefined) {
        standardMaterial.specularPower = properties.specularPower;
      }
    }

    // Update state
    state.properties = { ...state.properties, ...properties };
    state.lastModified = Date.now();

    // Emit event
    this.emitEvent({
      type: 'updated',
      materialId,
      timestamp: Date.now(),
      data: { properties }
    });

    return true;
  }

  /**
   * Clone material
   */
  cloneMaterial(materialId: string, newName?: string): BABYLON.Material | null {
    const originalMaterial = this.materials.get(materialId);
    const originalState = this.materialStates.get(materialId);

    if (!originalMaterial || !originalState) {
      console.warn(`Material '${materialId}' not found`);
      return null;
    }

    const cloneName = newName || `${materialId}_clone_${Date.now()}`;
    const clonedMaterial = originalMaterial.clone(cloneName);

    if (clonedMaterial) {
      this.materials.set(cloneName, clonedMaterial);

      // Clone state
      const clonedState: MaterialState = {
        ...originalState,
        id: cloneName,
        name: cloneName,
        lastModified: Date.now()
      };
      this.materialStates.set(cloneName, clonedState);

      // Emit event
      this.emitEvent({
        type: 'created',
        materialId: cloneName,
        timestamp: Date.now(),
        data: { clonedFrom: materialId }
      });
    }

    return clonedMaterial;
  }

  /**
   * Remove material
   */
  removeMaterial(materialId: string): boolean {
    const material = this.materials.get(materialId);

    if (!material) {
      console.warn(`Material '${materialId}' not found`);
      return false;
    }

    // Dispose material
    material.dispose();

    // Remove from collections
    this.materials.delete(materialId);
    this.materialStates.delete(materialId);

    // Emit event
    this.emitEvent({
      type: 'removed',
      materialId,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Get material by ID
   */
  getMaterial(materialId: string): BABYLON.Material | null {
    return this.materials.get(materialId) || null;
  }

  /**
   * Get material state
   */
  getMaterialState(materialId: string): MaterialState | null {
    return this.materialStates.get(materialId) || null;
  }

  /**
   * Get all materials
   */
  getAllMaterials(): BABYLON.Material[] {
    return Array.from(this.materials.values());
  }

  /**
   * Get all material states
   */
  getAllMaterialStates(): MaterialState[] {
    return Array.from(this.materialStates.values());
  }

  /**
   * Get materials by category
   */
  getMaterialsByCategory(category: string): MaterialPreset[] {
    return Array.from(this.materialPresets.values()).filter(
      preset => preset.category === category
    );
  }

  /**
   * Get material presets
   */
  getMaterialPresets(): MaterialPreset[] {
    return Array.from(this.materialPresets.values());
  }

  /**
   * Add custom preset
   */
  addCustomPreset(preset: MaterialPreset): boolean {
    if (this.materialPresets.has(preset.id)) {
      console.warn(`Preset '${preset.id}' already exists`);
      return false;
    }

    this.materialPresets.set(preset.id, preset);
    return true;
  }

  /**
   * Load texture with caching
   */
  async loadTexture(url: string, options?: TextureLoadOptions): Promise<BABYLON.Texture | null> {
    try {
      // Check cache first
      if (this.textureCache.has(url)) {
        const cachedTexture = this.textureCache.get(url)!;
        if (options?.onLoad) options.onLoad(cachedTexture);
        return cachedTexture;
      }

      const texture = new BABYLON.Texture(
        url,
        this.scene,
        options?.invertY !== undefined ? options.invertY : true,
        false,
        options?.samplingMode || BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
        () => {
          // Success callback - texture is loaded
          if (options?.onLoad) options.onLoad(texture);
        },
        (message?: string, exception?: any) => {
          const error = new Error(`Failed to load texture ${url}: ${message}`);
          console.error(error.message, exception);

          if (options?.onError) options.onError(error.message, error);

          // Emit error event
          this.emitEvent({
            type: 'error',
            materialId: 'texture',
            timestamp: Date.now(),
            data: { url, message, exception }
          });
        }
      );

      // Note: generateMipMaps is set during texture creation and cannot be changed afterwards

      if (options?.anisotropicFilteringLevel !== undefined) {
        texture.anisotropicFilteringLevel = options.anisotropicFilteringLevel;
      }

      // Cache texture
      this.textureCache.set(url, texture);

      return texture;
    } catch (error) {
      console.error(`Error loading texture ${url}:`, error);

      if (options?.onError) options.onError((error as Error).message, error);

      // Emit error event
      this.emitEvent({
        type: 'error',
        materialId: 'texture',
        timestamp: Date.now(),
        data: { url, error }
      });

      return null;
    }
  }

  /**
   * Register event callback
   */
  onMaterialEvent(callback: (event: MaterialEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove event callback
   */
  removeMaterialEventCallback(callback: (event: MaterialEvent) => void): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit material event
   */
  private emitEvent(event: MaterialEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Material event callback error:', error);
      }
    });
  }

  /**
   * Get pool statistics
   */
  getPoolStatistics(): {
    activeMaterials: number;
    cachedTextures: number;
    poolSize: number;
    maxPoolSize: number;
  } {
    return {
      activeMaterials: this.materials.size,
      cachedTextures: this.textureCache.size,
      poolSize: this.materialPool.length,
      maxPoolSize: this.maxPoolSize
    };
  }

  /**
   * Clean up unused materials
   */
  cleanupUnusedMaterials(): number {
    let cleanedCount = 0;

    // Find materials not attached to any meshes
    const usedMaterials = new Set<string>();

    this.scene.meshes.forEach(mesh => {
      if (mesh.material) {
        usedMaterials.add(mesh.material.name);
      }
    });

    // Remove unused materials
    for (const [materialId, material] of this.materials) {
      if (!usedMaterials.has(materialId)) {
        material.dispose();
        this.materials.delete(materialId);
        this.materialStates.delete(materialId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Enhanced UV Controls - Set UV mapping mode
   */
  setUVMappingMode(materialId: string, mappingMode: number): boolean {
    const material = this.materials.get(materialId);
    if (!material) {
      console.warn(`Material '${materialId}' not found`);
      return false;
    }

    // Apply UV mapping to all textures in the material
      if (material instanceof BABYLON.PBRMaterial) {
        const pbrMaterial = material as BABYLON.PBRMaterial;
        if (pbrMaterial.albedoTexture) {
          (pbrMaterial.albedoTexture as any).wrapU = mappingMode;
          (pbrMaterial.albedoTexture as any).wrapV = mappingMode;
        }
        if (pbrMaterial.bumpTexture) {
          (pbrMaterial.bumpTexture as any).wrapU = mappingMode;
          (pbrMaterial.bumpTexture as any).wrapV = mappingMode;
        }
        if (pbrMaterial.metallicTexture) {
          (pbrMaterial.metallicTexture as any).wrapU = mappingMode;
          (pbrMaterial.metallicTexture as any).wrapV = mappingMode;
        }
        // Removed metallicRoughnessTexture as it does not exist in Babylon.js PBRMaterial
        if (pbrMaterial.emissiveTexture) {
          (pbrMaterial.emissiveTexture as any).wrapU = mappingMode;
          (pbrMaterial.emissiveTexture as any).wrapV = mappingMode;
        }
      } else if (material instanceof BABYLON.StandardMaterial) {
        const standardMaterial = material as BABYLON.StandardMaterial;
        if (standardMaterial.diffuseTexture) {
          (standardMaterial.diffuseTexture as any).wrapU = mappingMode;
          (standardMaterial.diffuseTexture as any).wrapV = mappingMode;
        }
        if (standardMaterial.bumpTexture) {
          (standardMaterial.bumpTexture as any).wrapU = mappingMode;
          (standardMaterial.bumpTexture as any).wrapV = mappingMode;
        }
        if (standardMaterial.specularTexture) {
          (standardMaterial.specularTexture as any).wrapU = mappingMode;
          (standardMaterial.specularTexture as any).wrapV = mappingMode;
        }
        if (standardMaterial.emissiveTexture) {
          (standardMaterial.emissiveTexture as any).wrapU = mappingMode;
          (standardMaterial.emissiveTexture as any).wrapV = mappingMode;
        }
      }

    // Emit event
    this.emitEvent({
      type: 'updated',
      materialId,
      timestamp: Date.now(),
      data: { uvMappingMode: mappingMode }
    });

    return true;
  }

  /**
   * Enhanced UV Controls - Set UV offset and scale
   */
  setUVTransform(materialId: string, offsetU: number, offsetV: number, scaleU: number = 1, scaleV: number = 1): boolean {
    const material = this.materials.get(materialId);
    if (!material) {
      console.warn(`Material '${materialId}' not found`);
      return false;
    }

    // Apply UV transform to all textures in the material
      if (material instanceof BABYLON.PBRMaterial) {
        const pbrMaterial = material as BABYLON.PBRMaterial;
        if (pbrMaterial.albedoTexture) {
          (pbrMaterial.albedoTexture as any).uOffset = offsetU;
          (pbrMaterial.albedoTexture as any).vOffset = offsetV;
          (pbrMaterial.albedoTexture as any).uScale = scaleU;
          (pbrMaterial.albedoTexture as any).vScale = scaleV;
        }
        if (pbrMaterial.bumpTexture) {
          (pbrMaterial.bumpTexture as any).uOffset = offsetU;
          (pbrMaterial.bumpTexture as any).vOffset = offsetV;
          (pbrMaterial.bumpTexture as any).uScale = scaleU;
          (pbrMaterial.bumpTexture as any).vScale = scaleV;
        }
        if (pbrMaterial.metallicTexture) {
          (pbrMaterial.metallicTexture as any).uOffset = offsetU;
          (pbrMaterial.metallicTexture as any).vOffset = offsetV;
          (pbrMaterial.metallicTexture as any).uScale = scaleU;
          (pbrMaterial.metallicTexture as any).vScale = scaleV;
        }
        if (pbrMaterial.bumpTexture) {
          (pbrMaterial.bumpTexture as any).uOffset = offsetU;
          (pbrMaterial.bumpTexture as any).vOffset = offsetV;
          (pbrMaterial.bumpTexture as any).uScale = scaleU;
          (pbrMaterial.bumpTexture as any).vScale = scaleV;
        }
      } else if (material instanceof BABYLON.StandardMaterial) {
        const standardMaterial = material as BABYLON.StandardMaterial;
        if (standardMaterial.diffuseTexture) {
          (standardMaterial.diffuseTexture as any).uOffset = offsetU;
          (standardMaterial.diffuseTexture as any).vOffset = offsetV;
          (standardMaterial.diffuseTexture as any).uScale = scaleU;
          (standardMaterial.diffuseTexture as any).vScale = scaleV;
        }
        if (standardMaterial.bumpTexture) {
          (standardMaterial.bumpTexture as any).uOffset = offsetU;
          (standardMaterial.bumpTexture as any).vOffset = offsetV;
          (standardMaterial.bumpTexture as any).uScale = scaleU;
          (standardMaterial.bumpTexture as any).vScale = scaleV;
        }
      }

    // Emit event
    this.emitEvent({
      type: 'updated',
      materialId,
      timestamp: Date.now(),
      data: { uvTransform: { offsetU, offsetV, scaleU, scaleV } }
    });

    return true;
  }

  /**
   * Enhanced UV Controls - Set UV rotation
   */
  setUVRotation(materialId: string, rotation: number): boolean {
    const material = this.materials.get(materialId);
    if (!material) {
      console.warn(`Material '${materialId}' not found`);
      return false;
    }

    // Apply UV rotation to all textures in the material
      if (material instanceof BABYLON.PBRMaterial) {
        const pbrMaterial = material as BABYLON.PBRMaterial;
        if (pbrMaterial.albedoTexture) (pbrMaterial.albedoTexture as any).uAng = rotation;
        if (pbrMaterial.bumpTexture) (pbrMaterial.bumpTexture as any).uAng = rotation;
        if (pbrMaterial.metallicTexture) (pbrMaterial.metallicTexture as any).uAng = rotation;
      } else if (material instanceof BABYLON.StandardMaterial) {
        const standardMaterial = material as BABYLON.StandardMaterial;
        if (standardMaterial.diffuseTexture) (standardMaterial.diffuseTexture as any).uAng = rotation;
        if (standardMaterial.bumpTexture) (standardMaterial.bumpTexture as any).uAng = rotation;
        if (standardMaterial.specularTexture) (standardMaterial.specularTexture as any).uAng = rotation;
      }

    // Emit event
    this.emitEvent({
      type: 'updated',
      materialId,
      timestamp: Date.now(),
      data: { uvRotation: rotation }
    });

    return true;
  }

  /**
   * Enhanced Texture Loading - Load texture with advanced options
   */
  async loadTextureAdvanced(url: string, options: TextureLoadOptions = {}): Promise<BABYLON.Texture | null> {
    try {
      // Validate URL
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid texture URL');
      }

      // Check cache first
      if (this.textureCache.has(url)) {
        const cachedTexture = this.textureCache.get(url)!;
        if (options.onLoad) options.onLoad(cachedTexture);
        return cachedTexture;
      }

      // Validate file extension for supported formats
      const supportedFormats = ['.jpg', '.jpeg', '.png', '.bmp', '.tga', '.dds', '.env', '.ktx'];
      const hasValidExtension = supportedFormats.some(ext => url.toLowerCase().endsWith(ext));

      if (!hasValidExtension && !url.startsWith('data:')) {
        throw new Error(`Unsupported texture format. Supported formats: ${supportedFormats.join(', ')}`);
      }

      // Create texture with enhanced options
      const texture = new BABYLON.Texture(
        url,
        this.scene,
        options.invertY !== undefined ? options.invertY : true,
        false,
        options.samplingMode || BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
        () => {
          const sanitizedUrl = url.replace(/[\r\n\t]/g, '_');
          console.log(`Texture loaded successfully: ${sanitizedUrl}`);

          // Apply additional options
          if (options.anisotropicFilteringLevel !== undefined) {
            texture.anisotropicFilteringLevel = options.anisotropicFilteringLevel;
          }

          if (options.onLoad) options.onLoad(texture);
        },
        (message, exception) => {
          const error = new Error(`Failed to load texture ${url}: ${message}`);
          console.error(error.message, exception);

          if (options.onError) options.onError(error.message, error);

          // Emit error event
          this.emitEvent({
            type: 'error',
            materialId: 'texture',
            timestamp: Date.now(),
            data: { url, message, exception }
          });
        }
      );

      // Note: generateMipMaps is set during texture creation and cannot be changed afterwards

      // Cache texture
      this.textureCache.set(url, texture);

      return texture;
    } catch (error) {
      console.error(`Error loading texture ${url}:`, error);

      if (options.onError) options.onError((error as Error).message, error);

      // Emit error event
      this.emitEvent({
        type: 'error',
        materialId: 'texture',
        timestamp: Date.now(),
        data: { url, error }
      });

      return null;
    }
  }

  /**
   * Material Cloning and Variation System - Create material variation
   */
  createMaterialVariation(baseMaterialId: string, variationConfig: MaterialVariation): BABYLON.Material | null {
    const baseMaterial = this.materials.get(baseMaterialId);
    const baseState = this.materialStates.get(baseMaterialId);

    if (!baseMaterial || !baseState) {
      const sanitizedBaseMaterialId = baseMaterialId.replace(/[\r\n\t]/g, '_');
      console.warn(`Base material '${sanitizedBaseMaterialId}' not found`);
      return null;
    }

    const variationName = variationConfig.name || `${baseMaterialId}_variation_${Date.now()}`;

    // Clone the base material
    const variationMaterial = baseMaterial.clone(variationName);

    if (!variationMaterial) {
      console.error(`Failed to clone material '${baseMaterialId}'`);
      return null;
    }

    // Apply variation modifications
    if (variationMaterial instanceof BABYLON.PBRMaterial) {
      const pbrMaterial = variationMaterial as BABYLON.PBRMaterial;

      // Color variations
      if (variationConfig.colorOffset) {
        const baseColor = pbrMaterial.albedoColor || new BABYLON.Color3(1, 1, 1);
        pbrMaterial.albedoColor = new BABYLON.Color3(
          Math.max(0, Math.min(1, baseColor.r + variationConfig.colorOffset.r)),
          Math.max(0, Math.min(1, baseColor.g + variationConfig.colorOffset.g)),
          Math.max(0, Math.min(1, baseColor.b + variationConfig.colorOffset.b))
        );
      }

      // Metallic/Roughness variations
      if (variationConfig.metallicOffset !== undefined) {
        pbrMaterial.metallic = Math.max(0, Math.min(1, (pbrMaterial.metallic ?? 0) + variationConfig.metallicOffset));
      }

      if (variationConfig.roughnessOffset !== undefined) {
        pbrMaterial.roughness = Math.max(0, Math.min(1, (pbrMaterial.roughness ?? 0) + variationConfig.roughnessOffset));
      }

      // Scale variations
      if (variationConfig.scaleMultiplier !== undefined) {
        pbrMaterial.albedoColor = pbrMaterial.albedoColor.scale(variationConfig.scaleMultiplier);
      }
    } else if (variationMaterial instanceof BABYLON.StandardMaterial) {
      const standardMaterial = variationMaterial as BABYLON.StandardMaterial;

      // Color variations
      if (variationConfig.colorOffset) {
        const baseColor = standardMaterial.diffuseColor || new BABYLON.Color3(1, 1, 1);
        standardMaterial.diffuseColor = new BABYLON.Color3(
          Math.max(0, Math.min(1, baseColor.r + variationConfig.colorOffset.r)),
          Math.max(0, Math.min(1, baseColor.g + variationConfig.colorOffset.g)),
          Math.max(0, Math.min(1, baseColor.b + variationConfig.colorOffset.b))
        );
      }

      // Specular variations
      if (variationConfig.specularOffset !== undefined) {
        const baseSpecular = standardMaterial.specularColor || new BABYLON.Color3(1, 1, 1);
        standardMaterial.specularColor = baseSpecular.scale(1 + variationConfig.specularOffset);
      }

      // Scale variations
      if (variationConfig.scaleMultiplier !== undefined) {
        standardMaterial.diffuseColor = standardMaterial.diffuseColor.scale(variationConfig.scaleMultiplier);
      }
    }

    // Register the variation
    this.materials.set(variationName, variationMaterial);

    // Create variation state
    const variationState: MaterialState = {
      ...baseState,
      id: variationName,
      name: variationName,
      lastModified: Date.now()
    };
    this.materialStates.set(variationName, variationState);

    // Emit event
    this.emitEvent({
      type: 'created',
      materialId: variationName,
      timestamp: Date.now(),
      data: { variationOf: baseMaterialId, config: variationConfig }
    });

    return variationMaterial;
  }

  /**
   * Material Cloning and Variation System - Generate random variations
   */
  generateRandomVariations(baseMaterialId: string, count: number, intensity: number = 0.2): BABYLON.Material[] {
    const variations: BABYLON.Material[] = [];

    for (let i = 0; i < count; i++) {
      const variationConfig: MaterialVariation = {
        name: `${baseMaterialId}_random_${i + 1}`,
        colorOffset: new BABYLON.Color3(
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity
        ),
        metallicOffset: (Math.random() - 0.5) * intensity,
        roughnessOffset: (Math.random() - 0.5) * intensity,
        scaleMultiplier: 1 + (Math.random() - 0.5) * intensity * 0.5
      };

      const variation = this.createMaterialVariation(baseMaterialId, variationConfig);
      if (variation) {
        variations.push(variation);
      }
    }

    return variations;
  }

  /**
   * Advanced PBR Property Controls - Set advanced PBR properties
   */
  setAdvancedPBRProperties(materialId: string, properties: {
    metallic?: number;
    roughness?: number;
    emissiveIntensity?: number;
    ambientOcclusion?: number;
    normalScale?: number;
    clearCoat?: number;
    clearCoatRoughness?: number;
    anisotropy?: number;
    sheen?: number;
    sheenRoughness?: number;
    iridescence?: number;
    iridescenceIOR?: number;
    iridescenceThickness?: number;
  }): boolean {
    const material = this.materials.get(materialId);
    if (!material || !(material instanceof BABYLON.PBRMaterial)) {
      console.warn(`PBR material '${materialId}' not found`);
      return false;
    }

    const pbrMaterial = material as BABYLON.PBRMaterial;

    // Apply advanced PBR properties
    if (properties.metallic !== undefined) {
      pbrMaterial.metallic = Math.max(0, Math.min(1, properties.metallic));
    }

    if (properties.roughness !== undefined) {
      pbrMaterial.roughness = Math.max(0, Math.min(1, properties.roughness));
    }

    if (properties.emissiveIntensity !== undefined) {
      pbrMaterial.emissiveIntensity = Math.max(0, properties.emissiveIntensity);
    }

    if (properties.ambientOcclusion !== undefined) {
      pbrMaterial.ambientTextureStrength = Math.max(0, Math.min(1, properties.ambientOcclusion));
    }

    if (properties.normalScale !== undefined) {
      if (pbrMaterial.bumpTexture) {
        pbrMaterial.bumpTexture.level = Math.max(0, properties.normalScale);
      }
    }

    if (properties.clearCoat !== undefined) {
      pbrMaterial.clearCoat.isEnabled = properties.clearCoat > 0;
      pbrMaterial.clearCoat.intensity = Math.max(0, Math.min(1, properties.clearCoat));
    }

    if (properties.clearCoatRoughness !== undefined) {
      pbrMaterial.clearCoat.roughness = Math.max(0, Math.min(1, properties.clearCoatRoughness));
    }

    if (properties.anisotropy !== undefined) {
      pbrMaterial.anisotropy.isEnabled = Math.abs(properties.anisotropy) > 0.01;
      pbrMaterial.anisotropy.intensity = properties.anisotropy;
    }

    if (properties.sheen !== undefined) {
      pbrMaterial.sheen.isEnabled = properties.sheen > 0;
      pbrMaterial.sheen.intensity = Math.max(0, Math.min(1, properties.sheen));
    }

    if (properties.sheenRoughness !== undefined) {
      pbrMaterial.sheen.roughness = Math.max(0, Math.min(1, properties.sheenRoughness));
    }

    if (properties.iridescence !== undefined) {
      pbrMaterial.iridescence.isEnabled = properties.iridescence > 0;
      pbrMaterial.iridescence.intensity = Math.max(0, Math.min(1, properties.iridescence));
    }

    if (properties.iridescenceIOR !== undefined) {
      pbrMaterial.iridescence.indexOfRefraction = Math.max(1, properties.iridescenceIOR);
    }

    if (properties.iridescenceThickness !== undefined) {
      pbrMaterial.iridescence.minimumThickness = Math.max(0, properties.iridescenceThickness * 100);
      pbrMaterial.iridescence.maximumThickness = Math.max(0, properties.iridescenceThickness * 400);
    }

    // Update material state
    const state = this.materialStates.get(materialId);
    if (state) {
      state.properties = { ...state.properties, ...properties };
      state.lastModified = Date.now();
    }

    // Emit event
    this.emitEvent({
      type: 'updated',
      materialId,
      timestamp: Date.now(),
      data: { advancedPBRProperties: properties }
    });

    return true;
  }

  /**
   * GUI Panel Enhancement - Get material property sliders configuration
   */
  getMaterialPropertySliders(materialId: string): {
    property: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
  }[] {
    const material = this.materials.get(materialId);
    const state = this.materialStates.get(materialId);

    if (!material || !state) {
      return [];
    }

    const sliders: {
      property: string;
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      onChange: (value: number) => void;
    }[] = [];

    if (material instanceof BABYLON.PBRMaterial) {
      const pbrMaterial = material as BABYLON.PBRMaterial;
      const anyPbrMaterial = pbrMaterial as any;

      // Metallic slider
      sliders.push({
        property: 'metallic',
        label: 'Metallic',
        min: 0,
        max: 1,
        step: 0.01,
        value: anyPbrMaterial.metallic ?? 0,
        onChange: (value) => this.updateMaterialProperties(materialId, { metallic: value })
      });

      // Roughness slider
      sliders.push({
        property: 'roughness',
        label: 'Roughness',
        min: 0,
        max: 1,
        step: 0.01,
        value: anyPbrMaterial.roughness ?? 0,
        onChange: (value) => this.updateMaterialProperties(materialId, { roughness: value })
      });

      // Emissive intensity slider
      sliders.push({
        property: 'emissiveIntensity',
        label: 'Emissive Intensity',
        min: 0,
        max: 10,
        step: 0.1,
        value: pbrMaterial.emissiveIntensity || 0,
        onChange: (value) => this.setAdvancedPBRProperties(materialId, { emissiveIntensity: value })
      });

      // Clear coat slider
      sliders.push({
        property: 'clearCoat',
        label: 'Clear Coat',
        min: 0,
        max: 1,
        step: 0.01,
        value: pbrMaterial.clearCoat?.intensity || 0,
        onChange: (value) => this.setAdvancedPBRProperties(materialId, { clearCoat: value })
      });

      // Clear coat roughness slider
      sliders.push({
        property: 'clearCoatRoughness',
        label: 'Clear Coat Roughness',
        min: 0,
        max: 1,
        step: 0.01,
        value: pbrMaterial.clearCoat?.roughness || 0,
        onChange: (value) => this.setAdvancedPBRProperties(materialId, { clearCoatRoughness: value })
      });

    } else if (material instanceof BABYLON.StandardMaterial) {
      const standardMaterial = material as BABYLON.StandardMaterial;

      // Specular power slider
      sliders.push({
        property: 'specularPower',
        label: 'Specular Power',
        min: 0,
        max: 256,
        step: 1,
        value: standardMaterial.specularPower || 64,
        onChange: (value) => this.updateMaterialProperties(materialId, { specularPower: value })
      });

      // Alpha slider
      sliders.push({
        property: 'alpha',
        label: 'Opacity',
        min: 0,
        max: 1,
        step: 0.01,
        value: standardMaterial.alpha || 1,
        onChange: (value) => this.updateMaterialProperties(materialId, { alpha: value })
      });
    }

    return sliders;
  }

  /**
   * GUI Panel Enhancement - Get UV control sliders
   */
  getUVControlSliders(materialId: string): {
    property: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
  }[] {
    const material = this.materials.get(materialId);
    if (!material) {
      return [];
    }

    const sliders: {
      property: string;
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      onChange: (value: number) => void;
    }[] = [];

    // UV Offset U slider
    sliders.push({
      property: 'uvOffsetU',
      label: 'UV Offset U',
      min: -1,
      max: 1,
      step: 0.01,
      value: 0, // Would need to get current value from texture
      onChange: (value) => {
        // Get current V offset and scale values
        const currentV = 0; // Would need to get from texture
        const currentScaleU = 1; // Would need to get from texture
        const currentScaleV = 1; // Would need to get from texture
        this.setUVTransform(materialId, value, currentV, currentScaleU, currentScaleV);
      }
    });

    // UV Offset V slider
    sliders.push({
      property: 'uvOffsetV',
      label: 'UV Offset V',
      min: -1,
      max: 1,
      step: 0.01,
      value: 0,
      onChange: (value) => {
        const currentU = 0; // Would need to get from texture
        const currentScaleU = 1;
        const currentScaleV = 1;
        this.setUVTransform(materialId, currentU, value, currentScaleU, currentScaleV);
      }
    });

    // UV Scale U slider
    sliders.push({
      property: 'uvScaleU',
      label: 'UV Scale U',
      min: 0.1,
      max: 5,
      step: 0.1,
      value: 1,
      onChange: (value) => {
        const currentU = 0;
        const currentV = 0;
        const currentScaleV = 1;
        this.setUVTransform(materialId, currentU, currentV, value, currentScaleV);
      }
    });

    // UV Scale V slider
    sliders.push({
      property: 'uvScaleV',
      label: 'UV Scale V',
      min: 0.1,
      max: 5,
      step: 0.1,
      value: 1,
      onChange: (value) => {
        const currentU = 0;
        const currentV = 0;
        const currentScaleU = 1;
        this.setUVTransform(materialId, currentU, currentV, currentScaleU, value);
      }
    });

    // UV Rotation slider
    sliders.push({
      property: 'uvRotation',
      label: 'UV Rotation',
      min: 0,
      max: Math.PI * 2,
      step: 0.01,
      value: 0,
      onChange: (value) => this.setUVRotation(materialId, value)
    });

    return sliders;
  }

  /**
   * GUI Panel Enhancement - Get real-time preview controls
   */
  getRealTimePreviewControls(materialId: string): {
    control: string;
    label: string;
    type: 'toggle' | 'select' | 'color';
    value: any;
    options?: string[];
    onChange: (value: any) => void;
  }[] {
    const material = this.materials.get(materialId);
    if (!material) {
      return [];
    }

    const controls: {
      control: string;
      label: string;
      type: 'toggle' | 'select' | 'color';
      value: any;
      options?: string[];
      onChange: (value: any) => void;
    }[] = [];

    // Wireframe toggle
    controls.push({
      control: 'wireframe',
      label: 'Wireframe',
      type: 'toggle',
      value: material.wireframe || false,
      onChange: (value: boolean) => {
        material.wireframe = value;
        this.emitEvent({
          type: 'updated',
          materialId,
          timestamp: Date.now(),
          data: { wireframe: value }
        });
      }
    });

    // Back face culling toggle
    controls.push({
      control: 'backFaceCulling',
      label: 'Back Face Culling',
      type: 'toggle',
      value: material.backFaceCulling !== false,
      onChange: (value: boolean) => {
        material.backFaceCulling = value;
        this.emitEvent({
          type: 'updated',
          materialId,
          timestamp: Date.now(),
          data: { backFaceCulling: value }
        });
      }
    });

    // UV mapping mode selector
    controls.push({
      control: 'uvMappingMode',
      label: 'UV Mapping Mode',
      type: 'select',
      value: 'CLAMP_ADDRESSMODE', // Default value
      options: [
        'CLAMP_ADDRESSMODE',
        'WRAP_ADDRESSMODE',
        'MIRROR_ADDRESSMODE'
      ],
      onChange: (value: string) => {
        const modeMap: { [key: string]: number } = {
          'CLAMP_ADDRESSMODE': BABYLON.Texture.CLAMP_ADDRESSMODE,
          'WRAP_ADDRESSMODE': BABYLON.Texture.WRAP_ADDRESSMODE,
          'MIRROR_ADDRESSMODE': BABYLON.Texture.MIRROR_ADDRESSMODE
        };
        this.setUVMappingMode(materialId, modeMap[value]);
      }
    });

    // Diffuse color picker (for StandardMaterial)
    if (material instanceof BABYLON.StandardMaterial) {
      const standardMaterial = material as BABYLON.StandardMaterial;
      controls.push({
        control: 'diffuseColor',
        label: 'Diffuse Color',
        type: 'color',
        value: standardMaterial.diffuseColor || new BABYLON.Color3(1, 1, 1),
        onChange: (value: BABYLON.Color3) => {
          this.updateMaterialProperties(materialId, { diffuseColor: value });
        }
      });
    }

    // Albedo color picker (for PBRMaterial)
    if (material instanceof BABYLON.PBRMaterial) {
      const pbrMaterial = material as BABYLON.PBRMaterial;
      controls.push({
        control: 'albedoColor',
        label: 'Albedo Color',
        type: 'color',
        value: pbrMaterial.albedoColor || new BABYLON.Color3(1, 1, 1),
        onChange: (value: BABYLON.Color3) => {
          this.updateMaterialProperties(materialId, { diffuseColor: value });
        }
      });
    }

    return controls;
  }

  /**
   * Create procedural material from configuration
   */
  createProceduralMaterial(config: ProceduralMaterialConfig): BABYLON.Material | null {
    try {
      // Validate configuration
      if (!this.validateProceduralMaterialConfig(config)) {
        this.logError(new Error('Invalid procedural material configuration'), 'createProceduralMaterial');
        return null;
      }

      let material: BABYLON.Material;

      // Create material based on type
      switch (config.type) {
        case 'noise':
          material = this.createNoiseMaterial(config);
          break;
        case 'gradient':
          material = this.createGradientMaterial(config);
          break;
        case 'pattern':
          material = this.createPatternMaterial(config);
          break;
        case 'custom':
          material = this.createCustomProceduralMaterial(config);
          break;
        default:
          this.logError(new Error(`Unsupported procedural material type: ${config.type}`), 'createProceduralMaterial');
          return null;
      }

      if (!material) {
        this.logError(new Error('Failed to create procedural material'), 'createProceduralMaterial');
        return null;
      }

      // Register material
      this.materials.set(config.id, material);

      // Create material state
      const state: MaterialState = {
        id: config.id,
        name: config.name,
        type: 'procedural',
        properties: config,
        isActive: true,
        lastModified: Date.now()
      };
      this.materialStates.set(config.id, state);

      // Emit event
      this.emitEvent({
        type: 'created',
        materialId: config.id,
        timestamp: Date.now(),
        data: { config, proceduralType: config.type }
      });

      return material;
    } catch (error) {
      this.logError(error as Error, 'createProceduralMaterial');
      return null;
    }
  }

  /**
   * Validate procedural material configuration
   */
  private validateProceduralMaterialConfig(config: ProceduralMaterialConfig): boolean {
    if (!config.id || typeof config.id !== 'string') {
      return false;
    }

    if (!config.name || typeof config.name !== 'string') {
      return false;
    }

    if (!['noise', 'gradient', 'pattern', 'custom'].includes(config.type)) {
      return false;
    }

    if (!config.parameters || typeof config.parameters !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Create noise-based procedural material
   */
  private createNoiseMaterial(config: ProceduralMaterialConfig): BABYLON.Material {
    // Create PBR material as base
    const material = new BABYLON.PBRMaterial(`${config.name}_noise`, this.scene);

    // Set default properties
    material.metallic = config.parameters.metallic || 0.0;
    material.roughness = config.parameters.roughness || 0.5;

    // Create noise texture using custom shader
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      void main(void) {
        vec4 p = vec4(position, 1.);
        gl_Position = worldViewProjection * p;
        vPosition = p.xyz;
        vNormal = normal;
        vUV = uv;
      }
    `;

    const noiseShader = `
      precision highp float;
      varying vec2 vUV;
      uniform float time;
      uniform float scale;
      uniform float intensity;
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main(void) {
        vec2 st = vUV * scale;
        float n = noise(st + time * 0.1);
        gl_FragColor = vec4(vec3(n * intensity), 1.0);
      }
    `;

    // Store shaders in Effect.ShadersStore
    const shaderId = `noise_${Date.now()}`;
    BABYLON.Effect.ShadersStore[`${shaderId}VertexShader`] = vertexShader;
    BABYLON.Effect.ShadersStore[`${shaderId}FragmentShader`] = noiseShader;

    // Create shader material for noise
    const shaderMaterial = new BABYLON.ShaderMaterial(
      `${config.name}_noise_shader`,
      this.scene,
      shaderId,
      {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "time", "scale", "intensity"]
      }
    );

    // Set shader uniforms
    shaderMaterial.setFloat("time", 0);
    shaderMaterial.setFloat("scale", config.parameters.scale || 10.0);
    shaderMaterial.setFloat("intensity", config.parameters.intensity || 1.0);

    return shaderMaterial;
  }

  /**
   * Create gradient-based procedural material
   */
  private createGradientMaterial(config: ProceduralMaterialConfig): BABYLON.Material {
    const material = new BABYLON.PBRMaterial(`${config.name}_gradient`, this.scene);

    // Set gradient colors
    const colors = config.parameters.colors || [
      new BABYLON.Color3(1, 0, 0), // Red
      new BABYLON.Color3(0, 1, 0), // Green
      new BABYLON.Color3(0, 0, 1)  // Blue
    ];

    material.metallic = config.parameters.metallic || 0.0;
    material.roughness = config.parameters.roughness || 0.5;

    // Create gradient shader
    const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUV;
      void main(void) {
        vec4 p = vec4(position, 1.);
        gl_Position = worldViewProjection * p;
        vPosition = p.xyz;
        vNormal = normal;
        vUV = uv;
      }
    `;

    const gradientShader = `
      precision highp float;
      varying vec2 vUV;
      uniform vec3 color1;
      uniform vec3 color2;
      uniform vec3 color3;
      uniform float direction;
      void main(void) {
        float t = vUV.x;
        if (direction > 0.5) {
          t = vUV.y;
        }
        vec3 color;
        if (t < 0.5) {
          color = mix(color1, color2, t * 2.0);
        } else {
          color = mix(color2, color3, (t - 0.5) * 2.0);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Store shaders in Effect.ShadersStore
    const shaderId = `gradient_${Date.now()}`;
    BABYLON.Effect.ShadersStore[`${shaderId}VertexShader`] = vertexShader;
    BABYLON.Effect.ShadersStore[`${shaderId}FragmentShader`] = gradientShader;

    const shaderMaterial = new BABYLON.ShaderMaterial(
      `${config.name}_gradient_shader`,
      this.scene,
      shaderId,
      {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "color1", "color2", "color3", "direction"]
      }
    );

    // Set gradient colors
    if (colors.length >= 1) shaderMaterial.setColor3("color1", colors[0]);
    if (colors.length >= 2) shaderMaterial.setColor3("color2", colors[1]);
    if (colors.length >= 3) shaderMaterial.setColor3("color3", colors[2]);

    shaderMaterial.setFloat("direction", config.parameters.direction || 0); // 0 = horizontal, 1 = vertical

    return shaderMaterial;
  }

  /**
   * Create pattern-based procedural material
   */
  private createPatternMaterial(config: ProceduralMaterialConfig): BABYLON.Material {
    const material = new BABYLON.PBRMaterial(`${config.name}_pattern`, this.scene);

    material.metallic = config.parameters.metallic || 0.0;
    material.roughness = config.parameters.roughness || 0.5;

    // Create pattern shader (checkerboard example)
    const patternShader = `
      precision highp float;
      varying vec2 vUV;
      uniform float scale;
      uniform vec3 color1;
      uniform vec3 color2;

      void main(void) {
        vec2 st = vUV * scale;
        vec2 pattern = floor(st);
        float checker = mod(pattern.x + pattern.y, 2.0);

        vec3 color = mix(color1, color2, checker);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const shaderMaterial = new BABYLON.ShaderMaterial(
      `${config.name}_pattern_shader`,
      this.scene,
      {
        vertex: "vertexShader",
        fragment: patternShader
      },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection"]
      }
    );

    shaderMaterial.setFloat("scale", config.parameters.scale || 8.0);
    shaderMaterial.setColor3("color1", config.parameters.color1 || new BABYLON.Color3(1, 1, 1));
    shaderMaterial.setColor3("color2", config.parameters.color2 || new BABYLON.Color3(0, 0, 0));

    return shaderMaterial;
  }

  /**
   * Create custom procedural material from shader code
   */
  private createCustomProceduralMaterial(config: ProceduralMaterialConfig): BABYLON.Material {
    if (!config.shaderCode) {
      throw new Error('Custom procedural material requires shader code');
    }

    const shaderMaterial = new BABYLON.ShaderMaterial(
      `${config.name}_custom`,
      this.scene,
      {
        vertex: "vertexShader",
        fragment: config.shaderCode
      },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection"]
      }
    );

    // Set custom parameters
    Object.entries(config.parameters).forEach(([key, value]) => {
      if (typeof value === 'number') {
        shaderMaterial.setFloat(key, value);
      } else if (value instanceof BABYLON.Color3) {
        shaderMaterial.setColor3(key, value);
      } else if (value instanceof BABYLON.Vector2) {
        shaderMaterial.setVector2(key, value);
      } else if (value instanceof BABYLON.Vector3) {
        shaderMaterial.setVector3(key, value);
      }
    });

    return shaderMaterial;
  }

  /**
   * Get performance metrics for the material manager
   */
  getPerformanceMetrics(): MaterialPerformanceMetrics {
    // Estimate memory usage (rough calculation)
    // Each material ~1KB, each texture ~100KB average
    const materialMemory = this.materials.size * 1024; // 1KB per material
    const textureMemory = this.textureCache.size * 102400; // 100KB per texture
    const poolMemory = this.materialPool.length * 1024; // 1KB per pooled material
    const estimatedMemoryUsage = materialMemory + textureMemory + poolMemory;

    return {
      totalMaterials: this.materialPresets.size,
      activeMaterials: this.materials.size,
      cachedTextures: this.textureCache.size,
      memoryUsage: estimatedMemoryUsage,
      lastUpdateTime: Date.now()
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Dispose all materials
    this.materials.forEach(material => {
      material.dispose();
    });

    // Dispose cached textures
    this.textureCache.forEach(texture => {
      texture.dispose();
    });

    // Clear collections
    this.materials.clear();
    this.materialStates.clear();
    this.materialPresets.clear();
    this.textureCache.clear();
    this.materialPool.length = 0;
    this.eventCallbacks = [];
  }
}
