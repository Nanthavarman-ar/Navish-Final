import { Engine, Scene } from '@babylonjs/core';
import { featureCategoriesArray, FEATURE_CATEGORIES, Feature, FeatureCategory } from '../../../config/featureCategories';

interface DeviceCapabilities {
  hasWebGL2?: boolean;
  maxTextureSize?: number;
  hasWebXR?: boolean;
  hasWebAudio?: boolean;
  hasGamepad?: boolean;
  hasPointerLock?: boolean;
  hasWebVR?: boolean;
  hasWebAR?: boolean;
  hasSpatialAudio?: boolean;
  hasHapticFeedback?: boolean;
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
  maxAnisotropy?: number;
  maxRenderBufferSize?: number;
  maxViewportDims?: [number, number];
  maxVertexAttribs?: number;
  maxVertexUniformVectors?: number;
  maxFragmentUniformVectors?: number;
  maxVaryingVectors?: number;
  maxCombinedTextureImageUnits?: number;
  maxTextureImageUnits?: number;
  maxVertexTextureImageUnits?: number;
  maxCubeMapTextureSize?: number;
  maxRenderbufferSize?: number;
  max3DTextureSize?: number;
  maxArrayTextureLayers?: number;
  maxColorAttachments?: number;
  maxDrawBuffers?: number;
  maxTransformFeedbackInterleavedComponents?: number;
  maxTransformFeedbackSeparateAttribs?: number;
  maxTransformFeedbackSeparateComponents?: number;
  maxUniformBufferBindings?: number;
  maxUniformBlockSize?: number;
  maxCombinedUniformBlocks?: number;
  maxCombinedVertexUniformComponents?: number;
  maxCombinedFragmentUniformComponents?: number;
  maxVaryingComponents?: number;
  maxVertexUniformBlocks?: number;
  maxFragmentUniformBlocks?: number;
  maxUniformLocations?: number;
  maxSamples?: number;
  maxColorTextureSamples?: number;
  maxDepthTextureSamples?: number;
  maxIntegerSamples?: number;
  maxServerWaitTimeout?: number;
  maxElementIndex?: number;
  maxElementsVertices?: number;
  maxElementsIndices?: number;
  maxTextureLodBias?: number;
  maxCubeMapLodBias?: number;
  maxFragmentUniformComponents?: number;
  maxVertexUniformComponents?: number;
  maxTransformFeedbackBufferSize?: number;
  maxTransformFeedbackBufferBindings?: number;
  maxTransformFeedbackAttributes?: number;
  maxTransformFeedbackVaryings?: number;
}

export class FeatureManager {
  private capabilities: DeviceCapabilities;
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private features: Map<string, Feature> = new Map();

  constructor(capabilities: DeviceCapabilities) {
    this.capabilities = capabilities;
    this.initializeFeatures();
  }

  private initializeFeatures(): void {
    featureCategoriesArray.forEach(feature => {
      this.features.set(feature.id, feature);
    });
  }

  public setEngine(engine: Engine): void {
    this.engine = engine;
  }

  public setScene(scene: Scene): void {
    this.scene = scene;
  }

  public getCapabilities(): DeviceCapabilities {
    return this.capabilities;
  }

  public isFeatureEnabled(featureId: string): boolean {
    const feature = this.features.get(featureId);
    if (!feature) return false;

    return (feature.enabled ?? feature.enabledByDefault ?? false);
  }

  public getAvailableFeatures(): Feature[] {
    return Array.from(this.features.values()).filter(feature =>
      (feature.enabled ?? feature.enabledByDefault ?? false)
    );
  }

  public getFeaturesByCategory(category: string): Feature[] {
    return featureCategoriesArray.filter(feature =>
      feature.category === category && (feature.enabled ?? feature.enabledByDefault ?? false)
    );
  }

  public getFeatureById(featureId: string): Feature | undefined {
    return this.features.get(featureId);
  }

  public updateCapabilities(newCapabilities: Partial<DeviceCapabilities>): void {
    this.capabilities = { ...this.capabilities, ...newCapabilities };
  }

  public getEngine(): Engine | null {
    return this.engine;
  }

  public getScene(): Scene | null {
    return this.scene;
  }
}
