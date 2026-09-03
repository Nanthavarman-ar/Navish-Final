import { Engine, Scene, Light, DirectionalLight, HemisphericLight, SpotLight, PointLight, Animation, AnimationGroup, CubeTexture, Mesh, StandardMaterial, Color3, Vector3, ArcRotateCamera, Observer } from '@babylonjs/core';
import { logger } from '../utils/Logger';

export interface PresentationScenario {
  id: string;
  name: string;
  description: string;
  timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight';
  weather: 'clear' | 'cloudy' | 'rainy' | 'snowy';
  season: 'spring' | 'summer' | 'fall' | 'winter';
  lightingPreset: 'natural' | 'warm' | 'cool' | 'dramatic' | 'studio';
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  ambientIntensity: number;
  directionalIntensity: number;
  skyboxTexture?: string;
  particleEffects?: boolean;
  soundEffects?: string[];
}

export interface LightingState {
  ambient: Color3;
  lights: Array<{
    type: string;
    position?: Vector3;
    direction?: Vector3;
    intensity: number;
    diffuse?: Color3;
    specular?: Color3;
  }>;
}

/**
 * Manages presentation scenarios including lighting, camera transitions, and environmental effects
 */
export class ScenarioManager {
  private engine: Engine;
  private scene: Scene;
  private scenarios: Map<string, PresentationScenario> = new Map();
  private currentScenario: PresentationScenario | null = null;
  private scenarioTransitioning: boolean = false;
  private originalLighting: LightingState | null = null;
  private scenarioLights: Light[] = [];
  private transitionAnimations: AnimationGroup[] = [];
  private autoRotateObserver: Observer<Scene> | null = null;
  // The "zero"/Home point set via the workspace's Set button (BabylonWorkspace.tsx's
  // setHomeView) - when present, this is the point every scenario orbits/frames around
  // instead of the auto-computed mesh-bounds center below, so Presentation Mode's
  // auto-rotate circles the exact spot the user identified as the model's reference point
  // rather than a freshly recomputed bounding-box center.
  private homeCenter: Vector3 | null = null;

  constructor(engine: Engine, scene: Scene) {
    this.engine = engine;
    this.scene = scene;
    this.initializeDefaultScenarios();
    logger.info('ScenarioManager initialized');
  }

  /**
   * Initialize default presentation scenarios
   */
  private initializeDefaultScenarios(): void {
    const defaultScenarios: PresentationScenario[] = [
      {
        id: 'work_hours',
        name: 'Work Hours',
        description: 'Bright, productive office environment during work hours',
        timeOfDay: 'morning',
        weather: 'clear',
        season: 'summer',
        lightingPreset: 'natural',
        // The 4 scenarios previously clustered at similar ~35-45deg diagonal
        // angles (only one was a true side view), so touring through them
        // looked like it barely moved around the building. Spread across
        // front/right/back/left (0/90/180/270deg) for a real all-around view.
        cameraPosition: new Vector3(0, 3, 7),
        cameraTarget: new Vector3(0, 1, 0),
        ambientIntensity: 0.6,
        directionalIntensity: 1.2,
        particleEffects: false
      },
      {
        id: 'family_dinner',
        name: 'Family Dinner',
        description: 'Warm, cozy evening setting for family gatherings',
        timeOfDay: 'evening',
        weather: 'clear',
        season: 'fall',
        lightingPreset: 'warm',
        cameraPosition: new Vector3(7, 2.5, 0),
        cameraTarget: new Vector3(0, 1, 0),
        ambientIntensity: 0.4,
        directionalIntensity: 0.8,
        particleEffects: false
      },
      {
        id: 'night_mode',
        name: 'Night Mode',
        description: 'Dim, atmospheric night time illumination',
        timeOfDay: 'night',
        weather: 'clear',
        season: 'summer',
        lightingPreset: 'dramatic',
        cameraPosition: new Vector3(0, 2, -7),
        cameraTarget: new Vector3(0, 1, 0),
        ambientIntensity: 0.2,
        directionalIntensity: 0.3,
        particleEffects: true
      },
      {
        id: 'presentation_mode',
        name: 'Presentation Mode',
        description: 'Professional presentation lighting and camera setup',
        timeOfDay: 'noon',
        weather: 'clear',
        season: 'spring',
        lightingPreset: 'studio',
        cameraPosition: new Vector3(-7, 4, 0),
        cameraTarget: new Vector3(0, 1, 0),
        ambientIntensity: 0.8,
        directionalIntensity: 1.0,
        particleEffects: false
      }
    ];

    defaultScenarios.forEach(scenario => {
      this.scenarios.set(scenario.id, scenario);
    });

    logger.info(`Initialized ${defaultScenarios.length} default scenarios`);
  }

  /**
   * Apply a presentation scenario
   * @param scenarioId The ID of the scenario to apply
   * @returns Promise that resolves when the scenario is applied
   */
  async applyScenario(scenarioId: string): Promise<void> {
    if (this.scenarioTransitioning) {
      logger.warn('Scenario transition already in progress, ignoring request');
      return;
    }

    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      const error = new Error(`Scenario ${scenarioId} not found`);
      logger.error('Failed to apply scenario', error);
      throw error;
    }

    this.scenarioTransitioning = true;
    this.currentScenario = scenario;

    try {
      // Save original lighting state
      if (!this.originalLighting) {
        this.saveOriginalLighting();
      }

      // Clear existing scenario lights
      this.clearScenarioLights();

      // Apply lighting
      await this.applyScenarioLighting(scenario);

      // Apply camera position
      await this.transitionCamera(scenario);

      // Apply environment
      await this.applyEnvironment(scenario);

      // Apply time-based effects
      this.applyTimeEffects(scenario);

      logger.info(`Applied presentation scenario: ${scenario.name}`);

    } catch (error) {
      logger.error('Failed to apply scenario', error);
      throw error;
    } finally {
      this.scenarioTransitioning = false;
    }
  }

  /**
   * Save original lighting state
   */
  private saveOriginalLighting(): void {
    this.originalLighting = {
      ambient: this.scene.ambientColor.clone(),
      lights: this.scene.lights.map(light => ({
        type: light.constructor.name,
        position: (light as any).position?.clone(),
        direction: (light as any).direction?.clone(),
        intensity: light.intensity,
        diffuse: light.diffuse?.clone(),
        specular: light.specular?.clone()
      }))
    };

    logger.debug('Saved original lighting state');
  }

  /**
   * Clear scenario lights
   */
  private clearScenarioLights(): void {
    this.scenarioLights.forEach(light => {
      light.dispose();
    });
    this.scenarioLights = [];
    logger.debug('Cleared scenario lights');
  }

  /**
   * Apply scenario lighting
   * @param scenario The scenario to apply lighting for
   */
  private async applyScenarioLighting(scenario: PresentationScenario): Promise<void> {
    // Set ambient lighting
    this.scene.ambientColor = this.getAmbientColorForScenario(scenario);

    // Dim the scene's original (pre-scenario) lights while a scenario is
    // active - without this, the workspace's default lights stayed at full
    // brightness the whole time and drowned out every scenario's lighting,
    // making it look like nothing changed between Work Hours/Family Dinner/
    // Night Mode even though new scenario lights were being added correctly.
    this.scene.lights.forEach(light => {
      if (this.scenarioLights.includes(light)) return;
      light.intensity = (this.originalLighting?.lights.find(l => l.type === light.constructor.name)?.intensity ?? light.intensity) * 0.05;
    });

    // Create directional light based on time of day
    const directionalLight = new DirectionalLight(
      `scenario_directional_${scenario.id}`,
      this.getLightDirectionForTime(scenario.timeOfDay),
      this.scene
    );

    directionalLight.intensity = scenario.directionalIntensity;
    directionalLight.diffuse = this.getLightColorForTime(scenario.timeOfDay);
    this.scenarioLights.push(directionalLight);

    // Add additional lights based on preset
    switch (scenario.lightingPreset) {
      case 'warm':
        this.addWarmLighting(scenario);
        break;
      case 'cool':
        this.addCoolLighting(scenario);
        break;
      case 'dramatic':
        this.addDramaticLighting(scenario);
        break;
      case 'studio':
        this.addStudioLighting(scenario);
        break;
    }

    logger.debug(`Applied lighting for scenario: ${scenario.name}`);
  }

  /**
   * Get ambient color for scenario
   * @param scenario The scenario
   * @returns The ambient color
   */
  private getAmbientColorForScenario(scenario: PresentationScenario): Color3 {
    const ambientColors = {
      dawn: new Color3(0.8, 0.6, 0.4),
      morning: new Color3(0.9, 0.8, 0.7),
      noon: new Color3(1.0, 1.0, 1.0),
      afternoon: new Color3(0.95, 0.9, 0.8),
      evening: new Color3(0.7, 0.5, 0.3),
      night: new Color3(0.2, 0.2, 0.3),
      midnight: new Color3(0.1, 0.1, 0.15)
    };

    return ambientColors[scenario.timeOfDay] || new Color3(0.5, 0.5, 0.5);
  }

  /**
   * Get light direction for time of day
   * @param timeOfDay The time of day
   * @returns The light direction vector
   */
  private getLightDirectionForTime(timeOfDay: string): Vector3 {
    const directions = {
      dawn: new Vector3(-0.5, -0.8, 0.3),
      morning: new Vector3(-0.3, -0.9, 0.2),
      noon: new Vector3(0, -1, 0),
      afternoon: new Vector3(0.3, -0.9, -0.2),
      evening: new Vector3(0.5, -0.8, -0.3),
      night: new Vector3(0, -0.5, 0),
      midnight: new Vector3(0, -0.3, 0)
    };

    return directions[timeOfDay as keyof typeof directions] || new Vector3(0, -1, 0);
  }

  /**
   * Get light color for time of day
   * @param timeOfDay The time of day
   * @returns The light color
   */
  private getLightColorForTime(timeOfDay: string): Color3 {
    const colors = {
      dawn: new Color3(1.0, 0.8, 0.6),
      morning: new Color3(1.0, 0.95, 0.9),
      noon: new Color3(1.0, 1.0, 1.0),
      afternoon: new Color3(1.0, 0.95, 0.8),
      evening: new Color3(1.0, 0.6, 0.3),
      night: new Color3(0.5, 0.5, 0.7),
      midnight: new Color3(0.3, 0.3, 0.5)
    };

    return colors[timeOfDay as keyof typeof colors] || new Color3(1, 1, 1);
  }

  /**
   * Add warm lighting
   * @param scenario The scenario
   */
  private addWarmLighting(scenario: PresentationScenario): void {
    const spotLight = new SpotLight(
      `scenario_spot_warm_${scenario.id}`,
      new Vector3(2, 3, 2),
      new Vector3(-0.5, -1, -0.5),
      Math.PI / 3,
      2,
      this.scene
    );

    spotLight.intensity = 0.8;
    spotLight.diffuse = new Color3(1.0, 0.8, 0.6);
    this.scenarioLights.push(spotLight);
  }

  /**
   * Add cool lighting
   * @param scenario The scenario
   */
  private addCoolLighting(scenario: PresentationScenario): void {
    const pointLight = new PointLight(
      `scenario_point_cool_${scenario.id}`,
      new Vector3(-2, 2, -2),
      this.scene
    );

    pointLight.intensity = 0.6;
    pointLight.diffuse = new Color3(0.6, 0.8, 1.0);
    this.scenarioLights.push(pointLight);
  }

  /**
   * Add dramatic lighting
   * @param scenario The scenario
   */
  private addDramaticLighting(scenario: PresentationScenario): void {
    // Rim lighting effect
    const rimLight = new DirectionalLight(
      `scenario_rim_${scenario.id}`,
      new Vector3(0.8, -0.2, 0.6),
      this.scene
    );

    rimLight.intensity = 0.4;
    rimLight.diffuse = new Color3(0.8, 0.6, 1.0);
    this.scenarioLights.push(rimLight);
  }

  /**
   * Add studio lighting
   * @param scenario The scenario
   */
  private addStudioLighting(scenario: PresentationScenario): void {
    // Three-point lighting setup
    const keyLight = new SpotLight(
      `scenario_key_${scenario.id}`,
      new Vector3(3, 3, 3),
      new Vector3(-0.6, -0.6, -0.6),
      Math.PI / 6,
      2,
      this.scene
    );

    const fillLight = new SpotLight(
      `scenario_fill_${scenario.id}`,
      new Vector3(-3, 2, 3),
      new Vector3(0.6, -0.8, -0.6),
      Math.PI / 4,
      2,
      this.scene
    );

    const backLight = new SpotLight(
      `scenario_back_${scenario.id}`,
      new Vector3(0, 4, -4),
      new Vector3(0, -1, 1),
      Math.PI / 6,
      2,
      this.scene
    );

    keyLight.intensity = 1.2;
    fillLight.intensity = 0.6;
    backLight.intensity = 0.8;

    this.scenarioLights.push(keyLight, fillLight, backLight);
  }

  /**
   * Transition camera to scenario position
   * @param scenario The scenario
   * @returns Promise that resolves when transition is complete
   */
  // The default scenarios' cameraPosition/cameraTarget were authored around
  // a small ~5-unit test box near the origin. Used as-is, every real
  // uploaded model - which could be centimeters or tens of meters, anywhere
  // in the scene - looked identical between scenarios (or empty), since the
  // camera always flew to that same fixed point regardless of what was
  // actually loaded. This rescales each scenario's relative viewing
  // angle/distance to frame whatever is actually in the scene.
  private getModelBoundsCenterAndRadius(): { center: Vector3; radius: number } {
    // Keep this exclusion list in sync with the workspace's own "Fit" logic
    // (runAutoZoom in BabylonWorkspace.tsx), which frames real uploaded models
    // correctly. This used to only skip scenario_/__root__/measure_/preview_
    // prefixed names, so the placeholder ground/defaultBox (and any invisible
    // helper/gizmo mesh) got folded into the bounding box, pulling the computed
    // center away from the actual model - the auto-rotate orbit then visibly
    // circled a point off to the side of the model instead of the model itself.
    const isExcluded = (m: (typeof this.scene.meshes)[number]) =>
      !m.name || !m.isVisible ||
      /^(scenario_|__root__|measure_|measurement_|preview_)/i.test(m.name) ||
      /^ground$/i.test(m.name) || /^defaultBox$/i.test(m.name);
    const meshes = this.scene.meshes.filter(m => m.isEnabled() && m.getTotalVertices() > 0 && !isExcluded(m));
    if (meshes.length === 0) return { center: this.homeCenter ? this.homeCenter.clone() : Vector3.Zero(), radius: 5 };
    let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
    meshes.forEach(m => {
      const bb = m.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bb.minimumWorld);
      max = Vector3.Maximize(max, bb.maximumWorld);
    });
    // Radius still comes from the real mesh bounds (how far back the camera needs to stand
    // to fit the model) - only the orbit/frame CENTER is overridden by the user's saved
    // Home point when one is set, so scenarios still frame the whole model but circle the
    // point the user actually identified as "zero" rather than a geometric bounding-box
    // midpoint that may not match where they consider the model's reference point to be.
    const center = this.homeCenter ? this.homeCenter.clone() : min.add(max).scale(0.5);
    const radius = Math.max(Vector3.Distance(min, max) / 2, 1);
    return { center, radius };
  }

  /**
   * Sets (or clears, with null) the "zero"/Home point every scenario orbits/frames around.
   * Called from BabylonWorkspace.tsx whenever the user sets or clears their saved Home view.
   */
  setHomeCenter(center: Vector3 | null): void {
    this.homeCenter = center ? center.clone() : null;
  }

  private async transitionCamera(scenario: PresentationScenario): Promise<void> {
    const camera = this.scene.activeCamera;
    if (!camera) {
      logger.warn('No active camera found for transition');
      return;
    }

    const { center, radius } = this.getModelBoundsCenterAndRadius();
    const authoredTarget = new Vector3(0, 1, 0);
    const authoredRadius = 5; // roughly matches the distances the presets were authored around
    const viewDir = scenario.cameraPosition.subtract(authoredTarget);
    const viewDirLength = viewDir.length() || 1;
    const scaledCameraPosition = center.add(viewDir.normalize().scale((viewDirLength / authoredRadius) * radius * 1.5));
    const scaledCameraTarget = center.clone();

    // Create smooth camera transition animation
    const positionAnimation = new Animation(
      'cameraPositionTransition',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const targetAnimation = new Animation(
      'cameraTargetTransition',
      'target',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const positionKeys = [
      { frame: 0, value: camera.position.clone() },
      { frame: 60, value: scaledCameraPosition }
    ];

    const targetKeys = [
      { frame: 0, value: (camera as any).target?.clone() || Vector3.Zero() },
      { frame: 60, value: scaledCameraTarget }
    ];

    positionAnimation.setKeys(positionKeys);
    targetAnimation.setKeys(targetKeys);

    const animationGroup = new AnimationGroup('cameraTransition');
    animationGroup.addTargetedAnimation(positionAnimation, camera);
    animationGroup.addTargetedAnimation(targetAnimation, camera);

    this.transitionAnimations.push(animationGroup);

    return new Promise((resolve) => {
      let resolved = false;
      animationGroup.onAnimationGroupEndObservable.add(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
      animationGroup.start();
      // Fallback timeout in case animation doesn't end (e.g., in test environment)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Apply environment settings
   * @param scenario The scenario
   */
  private async applyEnvironment(scenario: PresentationScenario): Promise<void> {
    // Apply skybox if specified
    if (scenario.skyboxTexture) {
      const skyboxTexture = CubeTexture.CreateFromPrefilteredData(scenario.skyboxTexture, this.scene);
      this.scene.environmentTexture = skyboxTexture;
    }

    // Apply seasonal effects
    this.applySeasonalEffects(scenario);
  }

  /**
   * Apply seasonal effects
   * @param scenario The scenario
   */
  private applySeasonalEffects(scenario: PresentationScenario): void {
    // This could include particle effects for weather, color adjustments, etc.
    switch (scenario.season) {
      case 'fall':
        // Warm, golden tint
        this.scene.imageProcessingConfiguration.colorCurvesEnabled = true;
        break;
      case 'winter':
        // Cool, blue tint
        this.scene.imageProcessingConfiguration.colorCurvesEnabled = true;
        break;
      case 'spring':
        // Fresh, green tint
        this.scene.imageProcessingConfiguration.colorCurvesEnabled = true;
        break;
      case 'summer':
        // Bright, vibrant colors
        this.scene.imageProcessingConfiguration.colorCurvesEnabled = true;
        break;
    }

    logger.debug(`Applied seasonal effects for: ${scenario.season}`);
  }

  /**
   * Apply time-based effects
   * @param scenario The scenario
   */
  private applyTimeEffects(scenario: PresentationScenario): void {
    // Adjust material properties based on time of day
    this.scene.meshes.forEach(mesh => {
      if (mesh.material) {
        const material = mesh.material as StandardMaterial;
        if (scenario.timeOfDay === 'night' || scenario.timeOfDay === 'midnight') {
          // Dim materials at night
          material.emissiveColor = material.diffuseColor.scale(0.1);
        } else {
          material.emissiveColor = Color3.Black();
        }
      }
    });

    logger.debug(`Applied time effects for: ${scenario.timeOfDay}`);
  }

  /**
   * Get all available scenarios
   * @returns Array of available scenarios
   */
  getAvailableScenarios(): PresentationScenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Get current scenario
   * @returns The current scenario or null
   */
  getCurrentScenario(): PresentationScenario | null {
    return this.currentScenario;
  }

  /**
   * Continuously orbits the active camera around whatever is actually in the scene -
   * "Presentation Mode" previously only cycled between a handful of fixed lighting/
   * camera-angle scenarios every few seconds (see applyScenario/transitionCamera above),
   * which reads as the camera jumping between static snapshots rather than the
   * continuous auto-rotating showcase view a "presentation mode" is expected to be.
   * Only meaningful for ArcRotateCamera (the default workspace camera) since its
   * position is derived from alpha/beta/radius - other camera types have no orbit
   * angle to advance.
   * @param degreesPerSecond Rotation speed; default is a slow, presentation-friendly pace.
   */
  startAutoRotate(degreesPerSecond: number = 6): void {
    this.stopAutoRotate();
    const camera = this.scene.activeCamera;
    if (!(camera instanceof ArcRotateCamera)) {
      logger.warn('Auto-rotate skipped: active camera is not an ArcRotateCamera, so it has no orbit angle to advance.');
      return;
    }
    const radiansPerSecond = (degreesPerSecond * Math.PI) / 180;
    this.autoRotateObserver = this.scene.onBeforeRenderObservable.add(() => {
      camera.alpha += radiansPerSecond * (this.engine.getDeltaTime() / 1000);
    });
  }

  /**
   * Stops the continuous orbit started by startAutoRotate. Safe to call even if it
   * was never started.
   */
  stopAutoRotate(): void {
    if (this.autoRotateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.autoRotateObserver);
      this.autoRotateObserver = null;
    }
  }

  /**
   * Reset to original state
   */
  resetToOriginal(): void {
    this.stopAutoRotate();
    this.clearScenarioLights();
    if (this.originalLighting) {
      this.applyLightingState(this.originalLighting);
    }

    this.currentScenario = null;
    logger.info('Reset to original state');
  }

  /**
   * Apply lighting state
   * @param lighting The lighting state to apply
   */
  private applyLightingState(lighting: LightingState): void {
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
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopAutoRotate();
    this.clearScenarioLights();
    this.transitionAnimations.forEach(anim => anim.dispose());
    this.scenarios.clear();
    this.transitionAnimations = [];
    logger.info('ScenarioManager disposed');
  }
}
