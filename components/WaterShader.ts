import * as BABYLON from "@babylonjs/core";

export interface WaterShaderOptions {
  waterColor: BABYLON.Color3;
  waterColor2: BABYLON.Color3;
  bumpHeight: number;
  waveLength: number;
  waveHeight: number;
  windForce: number;
  windDirection: BABYLON.Vector2;
  waterTransparency: number;
  animationSpeed: number;
  foamIntensity: number;
  reflectionTexture?: BABYLON.RenderTargetTexture;
  refractionTexture?: BABYLON.RenderTargetTexture;
}

export class WaterShader {
  private scene: BABYLON.Scene;
  private material!: BABYLON.ShaderMaterial;
  private time: number = 0;
  private options: WaterShaderOptions;

  // Enhanced vertex shader with optimized wave calculations
  private vertexShader = `
    precision highp float;

    // Attributes
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 uv;

    // Uniforms
    uniform mat4 worldViewProjection;
    uniform mat4 world;
    uniform mat4 view;
    uniform vec3 cameraPosition;
    uniform float time;
    uniform float waveLength;
    uniform float waveHeight;
    uniform vec2 windDirection;
    uniform float windForce;
    uniform float animationSpeed;

    // Varyings
    varying vec3 vPositionW;
    varying vec3 vNormalW;
    varying vec2 vUV;
    varying vec4 vClipSpace;
    varying vec3 vToCamera;
    varying vec3 vWaveNormal;
    varying float vWaveHeight;

    // Optimized wave function
    vec3 calculateWave(vec3 pos, float time, vec2 windDir, float force) {
        vec2 waveUV = pos.xz / waveLength + time * windDir * force * 0.1;

        // Multiple wave octaves for realism
        float wave1 = sin(waveUV.x * 2.0 + waveUV.y * 1.5) * 0.5;
        float wave2 = sin(waveUV.x * 4.0 - waveUV.y * 2.0) * 0.3;
        float wave3 = sin(waveUV.x * 8.0 + waveUV.y * 3.0) * 0.2;

        float height = (wave1 + wave2 + wave3) * waveHeight;

        // Calculate normal from wave derivatives
        float dx = cos(waveUV.x * 2.0 + waveUV.y * 1.5) * 2.0 * waveHeight / waveLength +
                   cos(waveUV.x * 4.0 - waveUV.y * 2.0) * 4.0 * waveHeight / waveLength +
                   cos(waveUV.x * 8.0 + waveUV.y * 3.0) * 8.0 * waveHeight / waveLength;

        float dz = cos(waveUV.x * 2.0 + waveUV.y * 1.5) * 1.5 * waveHeight / waveLength -
                   cos(waveUV.x * 4.0 - waveUV.y * 2.0) * 2.0 * waveHeight / waveLength +
                   cos(waveUV.x * 8.0 + waveUV.y * 3.0) * 3.0 * waveHeight / waveLength;

        vec3 waveNormal = normalize(vec3(-dx, 1.0, -dz));

        return vec3(pos.x, pos.y + height, pos.z);
    }

    void main(void) {
        vec3 positionUpdated = calculateWave(position, time * animationSpeed, windDirection, windForce);

        vec4 worldPosition = world * vec4(positionUpdated, 1.0);
        vPositionW = worldPosition.xyz;

        // Enhanced normal calculation
        vec3 waveNormal = calculateWave(position + vec3(0.01, 0.0, 0.0), time * animationSpeed, windDirection, windForce);
        waveNormal = waveNormal - positionUpdated;
        vec3 waveNormalZ = calculateWave(position + vec3(0.0, 0.0, 0.01), time * animationSpeed, windDirection, windForce);
        waveNormalZ = waveNormalZ - positionUpdated;

        vec3 tangent = normalize(waveNormal);
        vec3 bitangent = normalize(waveNormalZ);
        vec3 waveNormalFinal = normalize(cross(tangent, bitangent));

        vNormalW = normalize((world * vec4(waveNormalFinal, 0.0)).xyz);
        vWaveNormal = waveNormalFinal;
        vWaveHeight = positionUpdated.y - position.y;

        vUV = uv;

        // For reflection/refraction
        vec4 clipSpace = worldViewProjection * vec4(positionUpdated, 1.0);
        vClipSpace = clipSpace;

        vToCamera = cameraPosition - vPositionW;

        gl_Position = clipSpace;
    }
  `;

  private fragmentShader = `
    precision highp float;

    // Uniforms
    uniform vec3 waterColor;
    uniform vec3 waterColor2;
    uniform float bumpHeight;
    uniform float time;
    uniform float waterTransparency;
    uniform vec3 cameraPosition;
    uniform sampler2D reflectionTexture;
    uniform sampler2D refractionTexture;
    uniform sampler2D normalMap;
    uniform vec2 windDirection;
    uniform float windForce;
    uniform float foamIntensity;
    uniform float waveHeight;
    uniform vec2 resolution;

    // Varyings
    varying vec3 vPositionW;
    varying vec3 vNormalW;
    varying vec2 vUV;
    varying vec4 vClipSpace;
    varying vec3 vToCamera;

    // Enhanced wave function
    float wave(vec2 uv, float time, float speed) {
        float wave1 = sin(uv.x * 8.0 + time * speed) * cos(uv.y * 6.0 + time * speed * 0.7);
        float wave2 = sin(uv.x * 12.0 - time * speed * 0.5) * cos(uv.y * 9.0 - time * speed * 0.3);
        float wave3 = sin(uv.x * 16.0 + time * speed * 0.2) * cos(uv.y * 14.0 + time * speed * 0.8);
        return (wave1 + wave2 + wave3) * 0.33;
    }

    // Foam calculation
    float calculateFoam(vec2 uv, float time) {
        float foam = 0.0;
        foam += wave(uv, time, 1.0) * wave(uv * 2.0, time * 0.5, 1.2);
        foam += wave(uv * 4.0, time * 0.25, 0.8);
        return clamp(foam * foamIntensity, 0.0, 1.0);
    }

    void main(void) {
        vec2 ndc = (vClipSpace.xy / vClipSpace.w) / 2.0 + 0.5;
        vec2 reflectCoords = vec2(ndc.x, -ndc.y);
        vec2 refractCoords = vec2(ndc.x, ndc.y);

        // Enhanced normal mapping with multiple scales
        vec2 bumpUV1 = vUV * 8.0 + time * windDirection * windForce * 0.05;
        vec2 bumpUV2 = vUV * 16.0 + time * windDirection * windForce * 0.1;
        vec2 bumpUV3 = vUV * 32.0 + time * windDirection * windForce * 0.2;

        vec3 normal1 = texture2D(normalMap, bumpUV1).rgb * 2.0 - 1.0;
        vec3 normal2 = texture2D(normalMap, bumpUV2).rgb * 2.0 - 1.0;
        vec3 normal3 = texture2D(normalMap, bumpUV3).rgb * 2.0 - 1.0;

        vec3 normal = normalize(normal1 * 0.5 + normal2 * 0.3 + normal3 * 0.2);

        // Enhanced Fresnel effect
        vec3 viewDirection = normalize(vToCamera);
        float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);

        // Distortion based on depth
        float depth = length(vPositionW - cameraPosition);
        float distortion = bumpHeight * (1.0 - exp(-depth * 0.01));

        // Reflection and refraction with enhanced distortion
        vec3 reflectionColor = texture2D(reflectionTexture, reflectCoords + normal.xz * distortion).rgb;
        vec3 refractionColor = texture2D(refractionTexture, refractCoords + normal.xz * distortion).rgb;

        // Water color mixing with depth-based variation
        vec3 waterColorMix = mix(waterColor, waterColor2, fresnel);
        waterColorMix = mix(waterColorMix, vec3(0.8, 0.9, 1.0), exp(-depth * 0.005));

        // Add foam effect
        float foam = calculateFoam(vUV, time);
        vec3 foamColor = vec3(1.0, 1.0, 0.9);
        waterColorMix = mix(waterColorMix, foamColor, foam * 0.3);

        // Final color composition
        vec3 finalColor = mix(refractionColor, reflectionColor, fresnel);
        finalColor = mix(finalColor, waterColorMix, waterTransparency);

        // Add subtle caustics
        float caustics = wave(vUV * 20.0, time, 0.5);
        finalColor += vec3(caustics * 0.1);

        gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  constructor(scene: BABYLON.Scene, options: Partial<WaterShaderOptions> = {}) {
    this.scene = scene;
    this.options = {
      waterColor: new BABYLON.Color3(0.1, 0.4, 0.6),
      waterColor2: new BABYLON.Color3(0.0, 0.2, 0.4),
      bumpHeight: 0.05,
      waveLength: 10.0,
      waveHeight: 0.5,
      windForce: 1.0,
      windDirection: new BABYLON.Vector2(1.0, 1.0),
      waterTransparency: 0.8,
      animationSpeed: 1.0,
      foamIntensity: 0.5,
      ...options
    };

    this.createMaterial();
    this.setupAnimation();
  }

  private createMaterial(): void {
    // Register shaders in ShaderStore
    BABYLON.Effect.ShadersStore["waterVertexShader"] = this.vertexShader;
    BABYLON.Effect.ShadersStore["waterFragmentShader"] = this.fragmentShader;

    // Create shader material with registered shaders
    this.material = new BABYLON.ShaderMaterial(
      "waterShader",
      this.scene,
      {
        vertex: "water",
        fragment: "water"
      },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: [
          "worldViewProjection",
          "world",
          "view",
          "cameraPosition",
          "time",
          "waveLength",
          "waveHeight",
          "windDirection",
          "windForce",
          "waterColor",
          "waterColor2",
          "bumpHeight",
          "waterTransparency",
          "foamIntensity",
          "reflectionTexture",
          "refractionTexture",
          "normalMap"
        ],
        samplers: ["reflectionTexture", "refractionTexture", "normalMap"]
      }
    );

    // Set initial uniforms
    this.updateUniforms();

    // Create normal map texture (water normal map)
    const normalTexture = new BABYLON.Texture(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      this.scene
    );
    this.material.setTexture("normalMap", normalTexture);
  }

  private updateUniforms(): void {
    this.material.setVector3("waterColor", { x: this.options.waterColor.r, y: this.options.waterColor.g, z: this.options.waterColor.b });
    this.material.setVector3("waterColor2", { x: this.options.waterColor2.r, y: this.options.waterColor2.g, z: this.options.waterColor2.b });
    this.material.setFloat("bumpHeight", this.options.bumpHeight);
    this.material.setFloat("waveLength", this.options.waveLength);
    this.material.setFloat("waveHeight", this.options.waveHeight);
    this.material.setVector2("windDirection", this.options.windDirection);
    this.material.setFloat("windForce", this.options.windForce);
    this.material.setFloat("waterTransparency", this.options.waterTransparency);

    if (this.options.reflectionTexture) {
      this.material.setTexture("reflectionTexture", this.options.reflectionTexture);
    }
    if (this.options.refractionTexture) {
      this.material.setTexture("refractionTexture", this.options.refractionTexture);
    }
  }

  private setupAnimation(): void {
    this.scene.onBeforeRenderObservable.add(() => {
      this.time += this.scene.getEngine().getDeltaTime() * 0.001 * this.options.animationSpeed;
      this.material.setFloat("time", this.time);
    });
  }

  public getMaterial(): BABYLON.ShaderMaterial {
    return this.material;
  }

  public setReflectionTexture(texture: BABYLON.RenderTargetTexture): void {
    this.options.reflectionTexture = texture;
    this.material.setTexture("reflectionTexture", texture);
  }

  public setRefractionTexture(texture: BABYLON.RenderTargetTexture): void {
    this.options.refractionTexture = texture;
    this.material.setTexture("refractionTexture", texture);
  }

  public updateOptions(options: Partial<WaterShaderOptions>): void {
    Object.assign(this.options, options);
    this.updateUniforms();
  }

  public dispose(): void {
    this.material.dispose();
  }
}

export default WaterShader;
