import { Scene, Vector3, Color3, Color4, StandardMaterial, AbstractMesh, TransformNode, ParticleSystem } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';

/**
 * Manages seasonal decorations with auto-switching and particle effects
 */
export class SeasonalDecorManager {
  private scene: Scene;
  private decorations: Map<string, SeasonalDecoration> = new Map();
  private activeDecoration: string | null = null;
  private rootNode: TransformNode | null = null;
  private autoSwitchEnabled: boolean = false;
  private autoSwitchInterval: number | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeRootNode();
  }

  /**
   * Initializes the root node for decorations
   */
  private initializeRootNode(): void {
    this.rootNode = new TransformNode('seasonal_decorations', this.scene);
  }

  /**
   * Creates a new seasonal decoration
   * @param id - Unique identifier for the decoration
   * @param name - Display name
   * @param season - Season name (e.g., 'winter', 'halloween', 'spring')
   * @param elements - Array of decoration elements
   */
  createDecoration(id: string, name: string, season: string, elements: DecorationElement[]): void {
    try {
      if (this.decorations.has(id)) {
        throw new Error(`Decoration with id '${id}' already exists`);
      }

      const decoration: SeasonalDecoration = {
        id,
        name,
        season,
        elements
      };

      this.decorations.set(id, decoration);
      console.log(`Created seasonal decoration: ${name}`);
    } catch (error) {
      console.error('Failed to create decoration:', error);
      throw error;
    }
  }

  /**
   * Activates a seasonal decoration
   * @param decorationId - ID of the decoration to activate
   */
  activateDecoration(decorationId: string): void {
    try {
      const decoration = this.decorations.get(decorationId);
      if (!decoration) {
        throw new Error(`Decoration '${decorationId}' not found`);
      }

      // Deactivate current decoration
      this.deactivateCurrentDecoration();

      // Create decoration elements
      decoration.elements.forEach((element, index) => {
        this.createDecorationElement(decorationId, element, index);
      });

      this.activeDecoration = decorationId;
      console.log(`Activated decoration: ${decoration.name}`);
    } catch (error) {
      console.error('Failed to activate decoration:', error);
      throw error;
    }
  }

  /**
   * Deactivates the currently active decoration
   */
  deactivateCurrentDecoration(): void {
    try {
      if (!this.activeDecoration) return;

      this.disposeDecorationElements(this.activeDecoration);
      this.activeDecoration = null;
      console.log('Deactivated current decoration');
    } catch (error) {
      console.error('Failed to deactivate decoration:', error);
      throw error;
    }
  }

  /**
   * Enables auto-switching between decorations
   * @param intervalMinutes - Interval between switches in minutes
   */
  enableAutoSwitch(intervalMinutes: number): void {
    try {
      this.disableAutoSwitch();

      this.autoSwitchEnabled = true;
      this.autoSwitchInterval = window.setInterval(() => {
        this.switchToNextDecoration();
      }, intervalMinutes * 60 * 1000);

      console.log(`Enabled auto-switch with ${intervalMinutes} minute intervals`);
    } catch (error) {
      console.error('Failed to enable auto-switch:', error);
      throw error;
    }
  }

  /**
   * Disables auto-switching
   */
  disableAutoSwitch(): void {
    try {
      if (this.autoSwitchInterval) {
        clearInterval(this.autoSwitchInterval);
        this.autoSwitchInterval = null;
      }
      this.autoSwitchEnabled = false;
      console.log('Disabled auto-switch');
    } catch (error) {
      console.error('Failed to disable auto-switch:', error);
      throw error;
    }
  }

  /**
   * Switches to the next decoration in sequence
   */
  private switchToNextDecoration(): void {
    try {
      const decorationIds = Array.from(this.decorations.keys());
      if (decorationIds.length === 0) return;

      let nextIndex = 0;
      if (this.activeDecoration) {
        const currentIndex = decorationIds.indexOf(this.activeDecoration);
        nextIndex = (currentIndex + 1) % decorationIds.length;
      }

      this.activateDecoration(decorationIds[nextIndex]);
    } catch (error) {
      console.error('Failed to switch decoration:', error);
    }
  }

  /**
   * Creates a decoration element in the scene
   * @param decorationId - Parent decoration ID
   * @param element - Element configuration
   * @param index - Element index
   */
  private createDecorationElement(decorationId: string, element: DecorationElement, index: number): void {
    try {
      const elementName = `${decorationId}_element_${index}`;
      let mesh: AbstractMesh | TransformNode | null = null;

      // Create mesh based on type
      switch (element.type) {
        case 'tree':
          mesh = this.createTreeMesh(elementName);
          break;
        case 'pumpkin':
          mesh = this.createPumpkinMesh(elementName);
          break;
        case 'flowers':
          mesh = this.createFlowersMesh(elementName);
          break;
        case 'umbrella':
          mesh = this.createUmbrellaMesh(elementName);
          break;
        case 'lights':
        case 'fog':
          // These will be handled by particle systems
          break;
      }

      if (mesh) {
        mesh.position = element.position.clone();
        mesh.scaling = element.scale.clone();

        if (mesh instanceof BABYLON.AbstractMesh && element.material) {
          this.applyMaterialToMesh(mesh, element.material);
        }

        if (this.rootNode) {
          mesh.parent = this.rootNode;
        }
      }

      // Handle particle systems
      if (element.particleSystem) {
        this.createParticleSystem(elementName, element, index);
      }
    } catch (error) {
      console.error('Failed to create decoration element:', error);
    }
  }

  /**
   * Creates a simple tree mesh
   * @param name - Mesh name
   * @returns Tree mesh
   */
  private createTreeMesh(name: string): AbstractMesh {
    const trunk = BABYLON.MeshBuilder.CreateCylinder(`${name}_trunk`, { height: 2, diameter: 0.3 }, this.scene);
    const leaves = BABYLON.MeshBuilder.CreateSphere(`${name}_leaves`, { diameter: 2 }, this.scene);
    leaves.position.y = 1.5;
    leaves.parent = trunk;

    trunk.name = name;
    return trunk;
  }

  /**
   * Creates a simple pumpkin mesh
   * @param name - Mesh name
   * @returns Pumpkin mesh
   */
  private createPumpkinMesh(name: string): AbstractMesh {
    return BABYLON.MeshBuilder.CreateSphere(name, { diameter: 1 }, this.scene);
  }

  /**
   * Creates a simple flowers mesh
   * @param name - Mesh name
   * @returns Flowers mesh
   */
  private createFlowersMesh(name: string): TransformNode {
    const flowerGroup: AbstractMesh[] = [];
    for (let i = 0; i < 5; i++) {
      const flower = BABYLON.MeshBuilder.CreateSphere(`${name}_flower_${i}`, { diameter: 0.2 }, this.scene);
      flower.position = new Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 2
      );
      flowerGroup.push(flower);
    }

    // Create a root transform node for flowers
    const flowersRoot = new BABYLON.TransformNode(name, this.scene);
    flowerGroup.forEach(flower => {
      flower.parent = flowersRoot;
    });

    return flowersRoot;
  }

  /**
   * Creates a simple umbrella mesh
   * @param name - Mesh name
   * @returns Umbrella mesh
   */
  private createUmbrellaMesh(name: string): AbstractMesh {
    const pole = BABYLON.MeshBuilder.CreateCylinder(`${name}_pole`, { height: 2, diameter: 0.1 }, this.scene);
    const canopy = BABYLON.MeshBuilder.CreateCylinder(`${name}_canopy`, { height: 0.1, diameter: 2 }, this.scene);
    canopy.position.y = 1.8;

    const umbrella = BABYLON.Mesh.MergeMeshes([pole, canopy], true, true, undefined, false, true);
    if (umbrella) {
      umbrella.name = name;
    }
    return umbrella || pole;
  }

  /**
   * Creates a particle system for decoration effects
   * @param name - Particle system name
   * @param element - Element configuration
   * @param index - Element index
   */
  private createParticleSystem(name: string, element: DecorationElement, index: number): void {
    try {
      if (!element.particleSystem) return;

      const particleSystem = new ParticleSystem(name, element.particleSystem.capacity, this.scene);

      particleSystem.emitter = element.position;
      particleSystem.emitRate = element.particleSystem.emitRate;
      particleSystem.minSize = element.particleSystem.minSize;
      particleSystem.maxSize = element.particleSystem.maxSize;
      particleSystem.color1 = element.particleSystem.color1;
      particleSystem.color2 = element.particleSystem.color2;
      particleSystem.colorDead = element.particleSystem.colorDead;

      particleSystem.createPointEmitter(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
      particleSystem.start();

      if (!this.particleSystems) {
        this.particleSystems = new Map();
      }
      this.particleSystems.set(`${name}_${index}`, particleSystem);
    } catch (error) {
      console.error('Failed to create particle system:', error);
    }
  }

  /**
   * Applies material to a mesh
   * @param mesh - Target mesh
   * @param materialConfig - Material configuration
   */
  private applyMaterialToMesh(mesh: AbstractMesh, materialConfig: MaterialConfig): void {
    try {
      const material = new StandardMaterial(`${mesh.name}_material`, this.scene);

      if (materialConfig.diffuseColor) {
        material.diffuseColor = materialConfig.diffuseColor;
      }
      if (materialConfig.emissiveColor) {
        material.emissiveColor = materialConfig.emissiveColor;
      }

      mesh.material = material;
    } catch (error) {
      console.error('Failed to apply material:', error);
    }
  }

  /**
   * Disposes of decoration elements
   * @param decorationId - ID of the decoration
   */
  private disposeDecorationElements(decorationId: string): void {
    try {
      const meshes = this.scene.meshes.filter(mesh => mesh.name.startsWith(`${decorationId}_element_`));
      meshes.forEach(mesh => mesh.dispose());

      if (this.particleSystems) {
        this.particleSystems.forEach((ps, key) => {
          if (key.startsWith(`${decorationId}_element_`)) {
            ps.dispose();
            this.particleSystems!.delete(key);
          }
        });
      }
    } catch (error) {
      console.error('Failed to dispose decoration elements:', error);
    }
  }

  /**
   * Clears all decorations
   */
  clearAllDecorations(): void {
    try {
      this.deactivateCurrentDecoration();
      this.decorations.clear();
      console.log('Cleared all decorations');
    } catch (error) {
      console.error('Failed to clear decorations:', error);
      throw error;
    }
  }

  /**
   * Gets all available decorations
   * @returns Array of decoration IDs
   */
  getAvailableDecorations(): string[] {
    return Array.from(this.decorations.keys());
  }

  /**
   * Get full details (name/season) for all defined decorations - needed to render a
   * real picker UI rather than just a list of raw ids.
   */
  getAllDecorations(): Array<{ id: string; name: string; season: string }> {
    return Array.from(this.decorations.entries()).map(([id, d]) => ({ id, name: d.name, season: d.season }));
  }

  /**
   * Gets the currently active decoration
   * @returns Active decoration ID or null
   */
  getActiveDecoration(): string | null {
    return this.activeDecoration;
  }

  /**
   * Checks if auto-switch is enabled
   * @returns True if auto-switch is active
   */
  isAutoSwitchEnabled(): boolean {
    return this.autoSwitchEnabled;
  }

  /**
   * Disposes of the seasonal decor manager
   */
  dispose(): void {
    this.disableAutoSwitch();
    this.clearAllDecorations();
    if (this.rootNode) {
      this.rootNode.dispose();
      this.rootNode = null;
    }
  }

  // Private property for particle systems
  private particleSystems?: Map<string, ParticleSystem>;
}

/**
 * Interface for seasonal decoration configuration
 */
export interface SeasonalDecoration {
  id: string;
  name: string;
  season: string;
  elements: DecorationElement[];
}

/**
 * Interface for decoration element configuration
 */
export interface DecorationElement {
  type: DecorationType;
  position: Vector3;
  scale: Vector3;
  material?: MaterialConfig;
  particleSystem?: ParticleSystemConfig;
}

/**
 * Interface for material configuration
 */
export interface MaterialConfig {
  diffuseColor?: Color3;
  emissiveColor?: Color3;
}

/**
 * Interface for particle system configuration
 */
export interface ParticleSystemConfig {
  capacity: number;
  emitRate: number;
  minSize: number;
  maxSize: number;
  color1: Color4;
  color2: Color4;
  colorDead: Color4;
}

/**
 * Type for decoration element types
 */
export type DecorationType = 'tree' | 'pumpkin' | 'flowers' | 'umbrella' | 'lights' | 'fog';
