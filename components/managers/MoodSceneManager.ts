import { Scene, Vector3, Color3, StandardMaterial, HemisphericLight, DirectionalLight, PointLight, SpotLight, AbstractMesh } from '@babylonjs/core';
import { BIMManager } from '../BIMManager';

export interface MoodScene {
  id: string;
  name: string;
  description: string;
  lighting: LightingPreset;
  timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
  weather: 'clear' | 'cloudy' | 'rainy' | 'snowy';
  ambiance: 'warm' | 'cool' | 'neutral' | 'dramatic';
}

export interface LightingPreset {
  ambientColor: Color3;
  lights: LightConfig[];
  shadows: boolean;
  intensity: number;
}

export interface LightConfig {
  type: 'hemispheric' | 'directional' | 'point' | 'spot';
  position: Vector3;
  direction?: Vector3;
  diffuse: Color3;
  specular: Color3;
  intensity: number;
  range?: number;
  angle?: number;
}

/**
 * Manages interactive lighting scenes and mood settings
 */
export class MoodSceneManager {
  private scene: Scene;
  private bimManager: BIMManager;

  private moodScenes: Map<string, MoodScene> = new Map();
  private currentScene: MoodScene | null = null;
  private originalLighting: LightingPreset | null = null;
  private activeLights: Map<string, any> = new Map();
  private isActive: boolean = false;
  // Remembers each pre-existing (non-mood) scene light's real intensity, so it can be
  // dimmed while a mood scene is active - previously the mood scene's new lights were
  // simply added on top of the existing bright default lights, which stayed at full
  // intensity and visually drowned out any mood lighting change.
  private dimmedLightIntensities: Map<any, number> = new Map();

  constructor(scene: Scene, bimManager: BIMManager) {
    this.scene = scene;
    this.bimManager = bimManager;
    this.initializeDefaultScenes();
  }

  /**
   * Initializes default mood scenes
   */
  private initializeDefaultScenes(): void {
    // Warm morning scene
    this.createMoodScene('morning_warm', 'Warm Morning', 'Bright and welcoming morning lighting', {
      ambientColor: new Color3(0.8, 0.7, 0.6),
      lights: [
        {
          type: 'directional',
          position: new Vector3(10, 10, 5),
          direction: new Vector3(-1, -1, -1),
          diffuse: new Color3(1, 0.9, 0.7),
          specular: new Color3(1, 1, 0.9),
          intensity: 1.2
        }
      ],
      shadows: true,
      intensity: 1.0
    }, 'morning', 'clear', 'warm');

    // Cool evening scene
    this.createMoodScene('evening_cool', 'Cool Evening', 'Soft blue evening lighting', {
      ambientColor: new Color3(0.4, 0.5, 0.7),
      lights: [
        {
          type: 'directional',
          position: new Vector3(-5, 8, 10),
          direction: new Vector3(1, -0.5, -1),
          diffuse: new Color3(0.6, 0.7, 1),
          specular: new Color3(0.8, 0.9, 1),
          intensity: 0.8
        }
      ],
      shadows: true,
      intensity: 0.7
    }, 'evening', 'clear', 'cool');

    // Dramatic night scene
    this.createMoodScene('night_dramatic', 'Dramatic Night', 'High contrast dramatic lighting', {
      ambientColor: new Color3(0.1, 0.1, 0.2),
      lights: [
        {
          type: 'spot',
          position: new Vector3(5, 8, 5),
          direction: new Vector3(-0.5, -1, -0.5),
          diffuse: new Color3(1, 0.8, 0.6),
          specular: new Color3(1, 1, 1),
          intensity: 2.0,
          range: 20,
          angle: Math.PI / 6
        }
      ],
      shadows: true,
      intensity: 0.3
    }, 'night', 'clear', 'dramatic');
  }

  /**
   * Creates a new mood scene
   * @param id - Unique identifier
   * @param name - Display name
   * @param description - Scene description
   * @param lighting - Lighting configuration
   * @param timeOfDay - Time of day
   * @param weather - Weather condition
   * @param ambiance - Lighting ambiance
   */
  createMoodScene(
    id: string,
    name: string,
    description: string,
    lighting: LightingPreset,
    timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night',
    weather: 'clear' | 'cloudy' | 'rainy' | 'snowy',
    ambiance: 'warm' | 'cool' | 'neutral' | 'dramatic'
  ): void {
    try {
      if (this.moodScenes.has(id)) {
        throw new Error(`Mood scene with id '${id}' already exists`);
      }

      const scene: MoodScene = {
        id,
        name,
        description,
        lighting,
        timeOfDay,
        weather,
        ambiance
      };

      this.moodScenes.set(id, scene);
      console.log(`Created mood scene: ${name}`);
    } catch (error) {
      console.error('Failed to create mood scene:', error);
      throw error;
    }
  }

  /**
   * Applies a mood scene
   * @param sceneId - ID of the scene to apply
   */
  applyMoodScene(sceneId: string): void {
    try {
      const scene = this.moodScenes.get(sceneId);
      if (!scene) {
        throw new Error(`Mood scene '${sceneId}' not found`);
      }

      // Save original lighting if not already saved
      if (!this.originalLighting) {
        this.saveOriginalLighting();
      }

      // Stop current scene
      this.stopCurrentScene();

      this.currentScene = scene;
      this.isActive = true;

      // Apply lighting
      this.applyLightingPreset(scene.lighting);

      console.log(`Applied mood scene: ${scene.name}`);
    } catch (error) {
      console.error('Failed to apply mood scene:', error);
      throw error;
    }
  }

  /**
   * Stops the current mood scene and restores original lighting
   */
  stopCurrentScene(): void {
    try {
      if (!this.isActive) return;

      // Restore each pre-existing light to its real original intensity - not via
      // applyLightingPreset(), which would just dim them again since it always dims
      // scene.lights whenever it runs.
      this.dimmedLightIntensities.forEach((originalIntensity, light) => {
        if (light.intensity !== undefined) {
          light.intensity = originalIntensity;
        }
      });
      this.dimmedLightIntensities.clear();

      if (this.originalLighting) {
        this.scene.ambientColor = this.originalLighting.ambientColor.clone();
      }

      // Clear active lights
      this.clearActiveLights();

      this.currentScene = null;
      this.isActive = false;

      console.log('Stopped current mood scene');
    } catch (error) {
      console.error('Failed to stop mood scene:', error);
      throw error;
    }
  }

  /**
   * Updates the intensity of the current mood scene
   * @param intensity - New intensity value (0-2)
   */
  setSceneIntensity(intensity: number): void {
    if (!this.isActive || !this.currentScene) return;

    try {
      const clampedIntensity = Math.max(0, Math.min(2, intensity));
      this.currentScene.lighting.intensity = clampedIntensity;

      // Reapply lighting with new intensity
      this.applyLightingPreset(this.currentScene.lighting);

      console.log(`Set scene intensity to ${clampedIntensity}`);
    } catch (error) {
      console.error('Failed to set scene intensity:', error);
      throw error;
    }
  }

  /**
   * Saves the current lighting configuration
   */
  private saveOriginalLighting(): void {
    try {
      this.originalLighting = {
        ambientColor: this.scene.ambientColor.clone(),
        lights: [],
        shadows: false,
        intensity: 1.0
      };

      // Save existing lights
      this.scene.lights.forEach((light, index) => {
        const lightConfig: LightConfig = {
          type: this.getLightType(light),
          position: (light as any).position?.clone() || Vector3.Zero(),
          diffuse: light.diffuse?.clone() || new Color3(1, 1, 1),
          specular: light.specular?.clone() || new Color3(1, 1, 1),
          intensity: light.intensity || 1.0
        };

        if (light instanceof DirectionalLight && light.direction) {
          lightConfig.direction = light.direction.clone();
        }

        if (light instanceof PointLight || light instanceof SpotLight) {
          lightConfig.range = (light as any).range || 10;
        }

        if (light instanceof SpotLight) {
          lightConfig.angle = light.angle || Math.PI / 3;
          lightConfig.direction = light.direction?.clone();
        }

        this.originalLighting!.lights.push(lightConfig);
      });
    } catch (error) {
      console.error('Failed to save original lighting:', error);
    }
  }

  /**
   * Applies a lighting preset to the scene
   * @param preset - Lighting preset to apply
   */
  private applyLightingPreset(preset: LightingPreset): void {
    try {
      // Clear existing mood-created lights
      this.clearActiveLights();

      // Dim the scene's other (pre-existing, non-mood) lights so the mood preset is
      // actually visible - otherwise the original default lights stay at full
      // intensity and visually overpower the new lighting.
      this.scene.lights.forEach((light) => {
        if (!this.dimmedLightIntensities.has(light) && light.intensity !== undefined) {
          this.dimmedLightIntensities.set(light, light.intensity);
        }
        if (light.intensity !== undefined) {
          light.intensity = (this.dimmedLightIntensities.get(light) ?? light.intensity) * 0.08;
        }
      });

      // Set ambient color
      this.scene.ambientColor = preset.ambientColor.clone();

      // Create new lights
      preset.lights.forEach((lightConfig, index) => {
        const light = this.createLightFromConfig(lightConfig, index);
        if (light) {
          this.activeLights.set(`mood_light_${index}`, light);
        }
      });

      // Apply intensity multiplier
      this.activeLights.forEach(light => {
        if (light.intensity !== undefined) {
          light.intensity *= preset.intensity;
        }
      });
    } catch (error) {
      console.error('Failed to apply lighting preset:', error);
    }
  }

  /**
   * Creates a light from configuration
   * @param config - Light configuration
   * @param index - Light index
   * @returns Created light
   */
  private createLightFromConfig(config: LightConfig, index: number): any {
    try {
      const lightName = `mood_light_${index}`;

      switch (config.type) {
        case 'hemispheric': {
          const hemiLight = new HemisphericLight(lightName, Vector3.Up(), this.scene);
          hemiLight.diffuse = config.diffuse;
          hemiLight.specular = config.specular;
          hemiLight.intensity = config.intensity;
          return hemiLight;
        }

        case 'directional': {
          const dirLight = new DirectionalLight(lightName, config.direction || Vector3.Down(), this.scene);
          if (config.position) {
            dirLight.position = config.position;
          }
          dirLight.diffuse = config.diffuse;
          dirLight.specular = config.specular;
          dirLight.intensity = config.intensity;
          return dirLight;
        }

        case 'point': {
          const pointLight = new PointLight(lightName, config.position, this.scene);
          pointLight.diffuse = config.diffuse;
          pointLight.specular = config.specular;
          pointLight.intensity = config.intensity;
          if (config.range) pointLight.range = config.range;
          return pointLight;
        }

        case 'spot': {
          const spotLight = new SpotLight(
            lightName,
            config.position,
            config.direction || Vector3.Down(),
            config.angle || Math.PI / 3,
            config.range || 10,
            this.scene
          );
          spotLight.diffuse = config.diffuse;
          spotLight.specular = config.specular;
          spotLight.intensity = config.intensity;
          return spotLight;
        }

        default:
          console.warn(`Unknown light type: ${config.type}`);
          return null;
      }
    } catch (error) {
      console.error('Failed to create light:', error);
      return null;
    }
  }

  /**
   * Gets the type of a light
   * @param light - Light to check
   * @returns Light type string
   */
  private getLightType(light: any): 'hemispheric' | 'directional' | 'point' | 'spot' {
    if (light instanceof HemisphericLight) return 'hemispheric';
    if (light instanceof DirectionalLight) return 'directional';
    if (light instanceof PointLight) return 'point';
    if (light instanceof SpotLight) return 'spot';
    return 'directional'; // Default
  }

  /**
   * Clears all active lights created by this manager
   */
  private clearActiveLights(): void {
    try {
      this.activeLights.forEach(light => {
        light.dispose();
      });
      this.activeLights.clear();
    } catch (error) {
      console.error('Failed to clear active lights:', error);
    }
  }

  /**
   * Gets all available mood scenes
   * @returns Array of scene IDs
   */
  getAvailableScenes(): string[] {
    return Array.from(this.moodScenes.keys());
  }

  /**
   * Gets full details for all available mood scenes (name, description, etc), not just
   * their IDs - needed to render a real scene picker UI.
   */
  getAllMoodScenes(): MoodScene[] {
    return Array.from(this.moodScenes.values());
  }

  /**
   * Gets the current mood scene
   * @returns Current scene or null
   */
  getCurrentScene(): MoodScene | null {
    return this.currentScene;
  }

  /**
   * Checks if a mood scene is currently active
   * @returns True if scene is active
   */
  isSceneActive(): boolean {
    return this.isActive;
  }

  /**
   * Gets the current scene intensity
   * @returns Scene intensity (0-2)
   */
  getCurrentIntensity(): number {
    return this.currentScene?.lighting.intensity ?? 1.0;
  }

  /**
   * Disposes of the mood scene manager
   */
  dispose(): void {
    this.stopCurrentScene();
    this.moodScenes.clear();
    this.originalLighting = null;
  }
}
