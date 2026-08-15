import * as BABYLON from '@babylonjs/core';
import '@babylonjs/post-processes';

export interface PostProcessingConfig {
  enableBloom: boolean;
  enableSSAO: boolean;
  enableDepthOfField: boolean;
  enableMotionBlur: boolean;
  enableChromaticAberration: boolean;
  enableGrain: boolean;
  enableSharpen: boolean;
  bloomThreshold: number;
  bloomWeight: number;
  bloomKernel: number;
  ssaoRadius: number;
  ssaoArea: number;
  ssaoFallOff: number;
  ssaoStrength: number;
  depthOfFieldFocusDistance: number;
  depthOfFieldFocalLength: number;
  depthOfFieldFStop: number;
  motionBlurIntensity: number;
  chromaticAberrationIntensity: number;
  grainIntensity: number;
  sharpenIntensity: number;
  toneMappingEnabled: boolean;
  toneMappingOperator: BABYLON.TonemappingOperator;
  exposure: number;
}

export class PostProcessingManager {
  private scene: BABYLON.Scene;
  private camera: BABYLON.Camera;
  private pipeline: BABYLON.DefaultRenderingPipeline | null = null;
  private config: PostProcessingConfig;

  constructor(scene: BABYLON.Scene, camera: BABYLON.Camera, config?: Partial<PostProcessingConfig>) {
    this.scene = scene;
    this.camera = camera;
    this.config = {
      enableBloom: true,
      enableSSAO: true,
      enableDepthOfField: false,
      enableMotionBlur: false,
      enableChromaticAberration: false,
      enableGrain: false,
      enableSharpen: false,
      bloomThreshold: 1.0,
      bloomWeight: 0.15,
      bloomKernel: 64,
      ssaoRadius: 0.0006,
      ssaoArea: 0.0075,
      ssaoFallOff: 0.000001,
      ssaoStrength: 1.0,
      depthOfFieldFocusDistance: 2000,
      depthOfFieldFocalLength: 50,
      depthOfFieldFStop: 1.4,
      motionBlurIntensity: 1.0,
      chromaticAberrationIntensity: 30,
      grainIntensity: 30,
      sharpenIntensity: 0.5,
      toneMappingEnabled: true,
      toneMappingOperator: BABYLON.TonemappingOperator.Hable,
      exposure: 1.0,
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    // Create default rendering pipeline
    this.pipeline = new BABYLON.DefaultRenderingPipeline(
      'postProcessingPipeline',
      true,
      this.scene,
      [this.camera]
    );

    this.applyConfig();
  }

  private applyConfig(): void {
    if (!this.pipeline) return;

    // Bloom effect
    this.pipeline.bloomEnabled = this.config.enableBloom;
    if (this.config.enableBloom) {
      this.pipeline.bloomThreshold = this.config.bloomThreshold;
      this.pipeline.bloomWeight = this.config.bloomWeight;
      this.pipeline.bloomKernel = this.config.bloomKernel;
    }

    // SSAO - Note: SSAO is handled by DefaultRenderingPipeline in newer versions
    // For now, we'll rely on the default pipeline's SSAO if available

    // Depth of field - Note: Depth of field is handled by DefaultRenderingPipeline
    this.pipeline.depthOfFieldEnabled = this.config.enableDepthOfField;
    if (this.config.enableDepthOfField && this.pipeline.depthOfField) {
      this.pipeline.depthOfField.focusDistance = this.config.depthOfFieldFocusDistance;
      this.pipeline.depthOfField.focalLength = this.config.depthOfFieldFocalLength;
      this.pipeline.depthOfField.fStop = this.config.depthOfFieldFStop;
    }

    // Motion blur
    // Note: Motion blur requires additional setup with velocity textures

    // Chromatic aberration
    // Note: Chromatic aberration can be implemented with custom post-process

    // Grain
    // Note: Grain can be implemented with custom post-process

    // Sharpen
    // Note: Sharpen can be implemented with custom post-process

    // Tone mapping
    this.pipeline.imageProcessing.toneMappingEnabled = this.config.toneMappingEnabled;
    if (this.config.toneMappingEnabled) {
      this.pipeline.imageProcessing.toneMappingType = this.config.toneMappingOperator;
    }
    this.pipeline.imageProcessing.exposure = this.config.exposure;
  }

  public updateConfig(newConfig: Partial<PostProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfig();
  }

  public setQualityPreset(preset: 'low' | 'medium' | 'high' | 'cinematic'): void {
    switch (preset) {
      case 'low':
        this.updateConfig({
          enableBloom: false,
          enableSSAO: false,
          enableDepthOfField: false,
          enableMotionBlur: false,
          enableChromaticAberration: false,
          enableGrain: false,
          enableSharpen: false,
          bloomKernel: 32,
          ssaoRadius: 0.001,
          ssaoArea: 0.01
        });
        break;
      case 'medium':
        this.updateConfig({
          enableBloom: true,
          enableSSAO: true,
          enableDepthOfField: false,
          enableMotionBlur: false,
          enableChromaticAberration: false,
          enableGrain: false,
          enableSharpen: false,
          bloomKernel: 64,
          ssaoRadius: 0.0006,
          ssaoArea: 0.0075
        });
        break;
      case 'high':
        this.updateConfig({
          enableBloom: true,
          enableSSAO: true,
          enableDepthOfField: true,
          enableMotionBlur: false,
          enableChromaticAberration: false,
          enableGrain: false,
          enableSharpen: true,
          bloomKernel: 128,
          ssaoRadius: 0.0003,
          ssaoArea: 0.005
        });
        break;
      case 'cinematic':
        this.updateConfig({
          enableBloom: true,
          enableSSAO: true,
          enableDepthOfField: true,
          enableMotionBlur: true,
          enableChromaticAberration: true,
          enableGrain: true,
          enableSharpen: true,
          bloomKernel: 256,
          ssaoRadius: 0.0001,
          ssaoArea: 0.0025,
          motionBlurIntensity: 2.0,
          chromaticAberrationIntensity: 50,
          grainIntensity: 50,
          sharpenIntensity: 1.0
        });
        break;
    }
  }

  public dispose(): void {
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }
  }
}
