import { Engine, Scene, Camera, Texture } from '@babylonjs/core';
import { PerceptualHashManager, PHashResult, SimilarityResult } from './PerceptualHashManager';
import { AIManager } from './AIManager';
import { FeatureManager } from './FeatureManager';

export class PHashIntegration {
  private pHashManager: PerceptualHashManager;
  private aiManager: AIManager;
  private featureManager: FeatureManager;
  private baselineHashes: Map<string, PHashResult> = new Map();

  constructor(engine: Engine, scene: Scene, aiManager: AIManager, featureManager: FeatureManager) {
    this.pHashManager = new PerceptualHashManager(engine, scene, featureManager);
    this.aiManager = aiManager;
    this.featureManager = featureManager;
  }

  /**
   * Initialize pHash for scene understanding
   */
  async initializeSceneUnderstanding(): Promise<void> {
    // Generate baseline hash for current scene
    try {
      const baselineHash = await this.pHashManager.generateSceneHash();
      this.baselineHashes.set('current_scene', baselineHash);
      console.log('Scene baseline hash generated:', baselineHash.hash);
    } catch (error) {
      console.error('Failed to generate baseline scene hash:', error);
    }
  }

  /**
   * Analyze scene changes using pHash
   */
  async analyzeSceneChanges(): Promise<{
    hasSignificantChanges: boolean;
    changeDetails: SimilarityResult | null;
    recommendations: string[];
  }> {
    const baselineHash = this.baselineHashes.get('current_scene');
    if (!baselineHash) {
      return {
        hasSignificantChanges: false,
        changeDetails: null,
        recommendations: ['Initialize scene understanding first']
      };
    }

    try {
      const changeResult = await this.pHashManager.detectSceneChanges(baselineHash, 0.8);

      const recommendations: string[] = [];
      if (changeResult.hasChanged) {
        recommendations.push('Scene has changed significantly');
        recommendations.push('Consider updating AI scene labels');
        recommendations.push('Check for new objects or modifications');

        // Update baseline if change is significant
        if (changeResult.changeMagnitude > 0.3) {
          this.baselineHashes.set('current_scene', changeResult.currentHash);
        }
      } else {
        recommendations.push('Scene appears stable');
      }

      return {
        hasSignificantChanges: changeResult.hasChanged,
        changeDetails: this.pHashManager.compareHashes(baselineHash.hash, changeResult.currentHash.hash),
        recommendations
      };
    } catch (error) {
      console.error('Scene change analysis failed:', error);
      return {
        hasSignificantChanges: false,
        changeDetails: null,
        recommendations: ['Scene analysis failed - check console for details']
      };
    }
  }

  /**
   * Find similar materials/textures using pHash
   */
  async findSimilarMaterials(textures: Texture[]): Promise<{
    duplicates: Map<Texture, Texture[]>;
    similarGroups: Array<{ texture: Texture; similar: Texture[]; similarity: number }>;
  }> {
    const duplicates = await this.pHashManager.findDuplicateTextures(textures, 0.95);

    // Find similar (but not duplicate) textures
    const similarGroups: Array<{ texture: Texture; similar: Texture[]; similarity: number }> = [];

    for (const texture of textures) {
      try {
        const hash = await this.pHashManager.generateTextureHash(texture);
        const similar = this.pHashManager.findSimilarHashes(hash, 0.7);

        if (similar.length > 0) {
          similarGroups.push({
            texture,
            similar: [], // Would need to map back to textures
            similarity: similar[0].similarity
          });
        }
      } catch (error) {
        console.warn('Failed to analyze texture similarity:', error);
      }
    }

    return { duplicates, similarGroups };
  }

  /**
   * Enhanced scene analysis with pHash integration
   */
  async enhancedSceneAnalysis(camera?: Camera): Promise<{
    sceneHash: PHashResult;
    aiLabels: any[];
    changeDetection: SimilarityResult | null;
    insights: string[];
  }> {
    // Generate current scene hash
    const sceneHash = await this.pHashManager.generateSceneHash(camera);

    // Get AI scene analysis (placeholder - analyzeScene method not available)
    const aiLabels: any[] = [];

    // Check for changes
    const baselineHash = this.baselineHashes.get('current_scene');
    let changeDetection: SimilarityResult | null = null;

    if (baselineHash) {
      changeDetection = this.pHashManager.compareHashes(baselineHash.hash, sceneHash.hash);
    }

    // Generate insights
    const insights: string[] = [];

    if (changeDetection) {
      if (changeDetection.similarity > 0.9) {
        insights.push('Scene is very similar to baseline');
      } else if (changeDetection.similarity > 0.7) {
        insights.push('Scene has minor changes from baseline');
      } else {
        insights.push('Scene has significant changes from baseline');
      }
    }

    if (aiLabels.length > 0) {
      insights.push(`AI detected ${aiLabels.length} scene elements`);
    }

    return {
      sceneHash,
      aiLabels,
      changeDetection,
      insights
    };
  }

  /**
   * Cache management for pHash results
   */
  getCacheStats() {
    return this.pHashManager.getCacheStats();
  }

  clearCache() {
    this.pHashManager.clearCache();
    this.baselineHashes.clear();
  }

  /**
   * Set similarity threshold for analysis
   */
  setSimilarityThreshold(threshold: number) {
    this.pHashManager.setSimilarityThreshold(threshold);
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.pHashManager.dispose();
    this.baselineHashes.clear();
  }
}
