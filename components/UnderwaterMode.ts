import * as BABYLON from "@babylonjs/core";

export interface UnderwaterModeOptions {
  waterLevel: number;
  fogColor: BABYLON.Color3;
  fogDensity: number;
  causticsIntensity: number;
  causticsSpeed: number;
  refractionStrength: number;
  chromaticAberration: number;
  bubbleDensity: number;
  lightAttenuation: number;
}

export class UnderwaterMode {
  private scene: BABYLON.Scene;
  private camera: BABYLON.Camera;
  private options: UnderwaterModeOptions;
  private isActive: boolean = false;
  private originalFogMode!: number;
  private originalFogColor!: BABYLON.Color3;
  private originalFogDensity!: number;
  private originalPostProcess: BABYLON.PostProcess[] = [];
  private causticsPostProcess: BABYLON.PostProcess | null = null;
  private underwaterFog: any = null;
  private bubbleParticles: BABYLON.ParticleSystem | null = null;
  private lightModifiers: Map<BABYLON.Light, any> = new Map();

  constructor(scene: BABYLON.Scene, camera: BABYLON.Camera, options: Partial<UnderwaterModeOptions> = {}) {
    this.scene = scene;
    this.camera = camera;
    this.options = {
      waterLevel: 0,
      fogColor: new BABYLON.Color3(0.1, 0.3, 0.5),
      // 0.02 was barely perceptible at typical architectural viewing
      // distances (10-20 units) - the whole point of this mode is a visibly
      // underwater tint.
      fogDensity: 0.06,
      causticsIntensity: 0.5,
      causticsSpeed: 1.0,
      refractionStrength: 0.1,
      chromaticAberration: 0.01,
      bubbleDensity: 0.1,
      lightAttenuation: 0.8,
      ...options
    };

    this.setupUnderwaterEffects();
  }

  /**
   * Setup underwater post-processing effects
   */
  private setupUnderwaterEffects(): void {
    // Create caustics post-process
    this.createCausticsEffect();

    // Setup bubble particle system
    this.createBubbleSystem();

    // Store original scene settings
    this.originalFogMode = this.scene.fogMode;
    this.originalFogColor = this.scene.fogColor.clone();
    this.originalFogDensity = this.scene.fogDensity;
  }

  /**
   * Create caustics light effect using post-processing with enhanced shader
   */
  private createCausticsEffect(): void {
    // Create an enhanced post-process for caustics with chromatic aberration and refraction
    const causticsShader = `
      precision highp float;

      uniform float time;
      uniform float intensity;
      uniform float speed;
      uniform vec3 waterColor;
      uniform float chromaticAberration;
      uniform float refractionStrength;
      uniform vec2 resolution;
      uniform sampler2D sceneSampler;

      varying vec2 vUV;

      // Optimized caustics function with better performance
      float causticsPattern(vec2 uv, float time, float speed) {
        float caustics = 0.0;

        // Optimized multiple octaves with reduced calculations
        vec2 uv1 = uv * 8.0 + time * speed * vec2(1.0, 0.7);
        vec2 uv2 = uv * 12.0 - time * speed * vec2(0.5, 0.3);
        vec2 uv3 = uv * 16.0 + time * speed * vec2(0.2, 0.8);

        caustics += sin(uv1.x) * cos(uv1.y) * 0.5;
        caustics += sin(uv2.x) * cos(uv2.y) * 0.3;
        caustics += sin(uv3.x) * cos(uv3.y) * 0.2;

        return (caustics + 1.0) * 0.5; // Normalize to 0-1
      }

      // Refraction distortion function
      vec2 refractionDistortion(vec2 uv, float strength) {
        vec2 distortion = vec2(0.0);
        distortion.x = sin(uv.y * 10.0 + time * 2.0) * strength * 0.01;
        distortion.y = cos(uv.x * 8.0 + time * 1.5) * strength * 0.01;
        return distortion;
      }

      void main(void) {
        vec2 uv = vUV;
        vec3 color = texture2D(sceneSampler, uv).rgb;

        // Apply refraction distortion
        vec2 distortedUV = uv + refractionDistortion(uv, refractionStrength);

        // Calculate optimized caustics
        float caustics = causticsPattern(distortedUV, time, speed);
        caustics *= causticsPattern(distortedUV * 2.0, time * 0.5, speed * 1.2);
        caustics = clamp(caustics, 0.0, 1.0);

        // Apply chromatic aberration with refraction
        if (chromaticAberration > 0.0) {
          vec2 aberrationOffset = vec2(chromaticAberration / resolution.x, 0.0);
          vec2 refractionOffset = refractionDistortion(uv, refractionStrength * 0.5);

          vec2 rUV = uv - aberrationOffset + refractionOffset;
          vec2 bUV = uv + aberrationOffset + refractionOffset;

          float r = causticsPattern(rUV, time, speed);
          float g = caustics;
          float b = causticsPattern(bUV, time, speed);

          color += waterColor * vec3(r * intensity, g * intensity, b * intensity);
        } else {
          color += waterColor * vec3(caustics * intensity);
        }

        // Add subtle animated noise for realism
        float noise = sin(uv.x * 50.0 + time * 3.0) * cos(uv.y * 50.0 + time * 2.0) * 0.01;
        color += vec3(noise);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Register the enhanced shader
    BABYLON.Effect.ShadersStore["causticsFragmentShader"] = causticsShader;

    // Create post-process with additional uniforms
    this.causticsPostProcess = new BABYLON.PostProcess(
      "caustics",
      "caustics",
      ["time", "intensity", "speed", "waterColor", "chromaticAberration", "refractionStrength", "resolution"],
      [],
      1.0,
      this.camera
    );

    // Set initial uniforms with enhanced parameters
    this.causticsPostProcess.onApply = (effect) => {
      effect.setFloat("time", this.scene.getEngine().getDeltaTime() * 0.001);
      effect.setFloat("intensity", this.options.causticsIntensity);
      effect.setFloat("speed", this.options.causticsSpeed);
      effect.setFloat("chromaticAberration", this.options.chromaticAberration);
      effect.setFloat("refractionStrength", this.options.refractionStrength);
      effect.setVector3("waterColor", { x: this.options.fogColor.r, y: this.options.fogColor.g, z: this.options.fogColor.b });
      effect.setVector2("resolution", { x: this.scene.getEngine().getRenderWidth(), y: this.scene.getEngine().getRenderHeight() });
    };
  }

  /**
   * Create enhanced bubble particle system for underwater atmosphere
   */
  private createBubbleSystem(): void {
    // Create particle system for bubbles with improved settings
    this.bubbleParticles = new BABYLON.ParticleSystem("bubbles", 1500, this.scene);

    // Create a better bubble texture with gradient
    const bubbleTexture = BABYLON.Texture.CreateFromBase64String(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "bubbleTexture",
      this.scene
    );

    // Configure particle system for realistic bubbles
    this.bubbleParticles.particleTexture = bubbleTexture;
    // Spawn around the camera, not at a fixed depth below the water level -
    // "waterLevel - 3" put bubbles underground (below the opaque ground
    // plane at y=0), so they rendered completely hidden from view no matter
    // where the camera was.
    this.bubbleParticles.emitter = new BABYLON.Vector3(
      this.camera.position.x,
      this.camera.position.y - 1,
      this.camera.position.z
    );
    this.bubbleParticles.minEmitBox = new BABYLON.Vector3(-5, -1, -5);
    this.bubbleParticles.maxEmitBox = new BABYLON.Vector3(5, 1, 5);

    // Bubble movement - upward with slight random drift
    this.bubbleParticles.direction1 = new BABYLON.Vector3(-0.2, 0.8, -0.2);
    this.bubbleParticles.direction2 = new BABYLON.Vector3(0.2, 1.2, 0.2);
    this.bubbleParticles.minLifeTime = 3.0;
    this.bubbleParticles.maxLifeTime = 8.0;
    this.bubbleParticles.emitRate = this.options.bubbleDensity * 100;

    // Bubble size and appearance
    this.bubbleParticles.minSize = 0.02;
    this.bubbleParticles.maxSize = 0.08;
    this.bubbleParticles.color1 = new BABYLON.Color4(0.9, 0.95, 1.0, 0.3);
    this.bubbleParticles.color2 = new BABYLON.Color4(0.8, 0.9, 0.95, 0.1);
    this.bubbleParticles.colorDead = new BABYLON.Color4(0.7, 0.85, 0.9, 0.0);

    // Add some randomness to bubble movement
    this.bubbleParticles.updateSpeed = 0.01;
    this.bubbleParticles.gravity = new BABYLON.Vector3(0, 0.01, 0); // Slight upward bias

    // Start the particle system
    this.bubbleParticles.start();
  }

  /**
   * Activate underwater mode
   */
  activate(): void {
    if (this.isActive) return;

    this.isActive = true;

    // Apply fog
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogColor = this.options.fogColor;
    this.scene.fogDensity = this.options.fogDensity;

    // Add post-processing effects
    if (this.causticsPostProcess) {
      // Simply add the post-process to the camera
      this.camera.attachPostProcess(this.causticsPostProcess);
    }

    // Start bubble system
    if (this.bubbleParticles) {
      this.bubbleParticles.start();
    }

    // Modify lights for underwater effect
    this.modifyLightsForUnderwater();

    console.log("Underwater mode activated");
  }

  /**
   * Deactivate underwater mode
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;

    // Restore original fog settings
    this.scene.fogMode = this.originalFogMode;
    this.scene.fogColor = this.originalFogColor;
    this.scene.fogDensity = this.originalFogDensity;

    // Remove post-processing effects
    if (this.causticsPostProcess) {
      // Detach post-process from camera
      this.camera.detachPostProcess(this.causticsPostProcess);
    }

    // Stop bubble system
    if (this.bubbleParticles) {
      this.bubbleParticles.stop();
    }

    // Restore lights
    this.restoreLights();

    console.log("Underwater mode deactivated");
  }

  /**
   * Modify lights for underwater attenuation
   */
  private modifyLightsForUnderwater(): void {
    this.scene.lights.forEach(light => {
      if (light instanceof BABYLON.PointLight || light instanceof BABYLON.SpotLight) {
        const originalIntensity = light.intensity;
        const originalRange = light.range;

        this.lightModifiers.set(light, {
          originalIntensity,
          originalRange
        });

        // Reduce light intensity and range for underwater effect
        light.intensity = originalIntensity * this.options.lightAttenuation;
        light.range = originalRange * 0.7;
      }
    });
  }

  /**
   * Restore original light settings
   */
  private restoreLights(): void {
    this.lightModifiers.forEach((modifiers, light) => {
      light.intensity = modifiers.originalIntensity;
      light.range = modifiers.originalRange;
    });
    this.lightModifiers.clear();
  }

  /**
   * Update underwater effects
   */
  update(): void {
    if (!this.isActive) return;

    // Update caustics animation
    if (this.causticsPostProcess) {
      const effect = this.causticsPostProcess.getEffect();
      if (effect) {
        effect.setFloat("time", this.scene.getEngine().getDeltaTime() * 0.001);
      }
    }

    // Update bubble system position based on camera
    if (this.bubbleParticles) {
      const cameraPos = this.camera.position;
      this.bubbleParticles.emitter = new BABYLON.Vector3(
        cameraPos.x,
        cameraPos.y - 1,
        cameraPos.z
      );
    }
  }

  /**
   * Check if camera is underwater
   */
  isCameraUnderwater(): boolean {
    return this.camera.position.y < this.options.waterLevel;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<UnderwaterModeOptions>): void {
    Object.assign(this.options, options);

    // Update effects if active
    if (this.isActive) {
      this.scene.fogColor = this.options.fogColor;
      this.scene.fogDensity = this.options.fogDensity;

      if (this.causticsPostProcess) {
        const effect = this.causticsPostProcess.getEffect();
        if (effect) {
          effect.setFloat("intensity", this.options.causticsIntensity);
          effect.setFloat("speed", this.options.causticsSpeed);
          effect.setFloat("chromaticAberration", this.options.chromaticAberration);
          effect.setVector3("waterColor", { x: this.options.fogColor.r, y: this.options.fogColor.g, z: this.options.fogColor.b });
          effect.setVector2("resolution", { x: this.scene.getEngine().getRenderWidth(), y: this.scene.getEngine().getRenderHeight() });
        }
      }

      if (this.bubbleParticles) {
        this.bubbleParticles.emitRate = this.options.bubbleDensity * 100;
      }
    }
  }

  /**
   * Get current underwater status
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.deactivate();

    if (this.causticsPostProcess) {
      this.causticsPostProcess.dispose();
    }

    if (this.bubbleParticles) {
      this.bubbleParticles.dispose();
    }

    this.lightModifiers.clear();
  }
}

export default UnderwaterMode;
