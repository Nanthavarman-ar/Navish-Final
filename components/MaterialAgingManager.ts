import { Engine, Scene, Mesh, Material, PBRMaterial, StandardMaterial, Texture, DynamicTexture, Color3, Vector3 } from '@babylonjs/core';
import { FeatureManager } from './FeatureManager';

export interface MaterialAgingEffect {
  id: string;
  materialType: 'paint' | 'wood' | 'tile' | 'metal' | 'concrete' | 'glass' | 'fabric';
  age: number; // Age in years
  severity: number; // 0-1 scale
  visualEffects: AgingVisualEffect[];
  degradationFactors: DegradationFactor[];
}

export interface AgingVisualEffect {
  type: 'fade' | 'crack' | 'scratch' | 'stain' | 'rust' | 'warp' | 'discolor' | 'wear';
  intensity: number;
  pattern?: Texture;
  color?: Color3;
}

export interface DegradationFactor {
  type: 'uv_exposure' | 'moisture' | 'temperature' | 'chemical' | 'physical_wear' | 'biological';
  rate: number; // Degradation rate per year
  currentLevel: number;
}

export interface MaterialAgingConfig {
  enableRealTimeAging: boolean;
  agingSpeed: number; // Multiplier for aging simulation speed
  showAgingPreview: boolean;
  agingTimeline: number; // Current timeline position in years
}

export class MaterialAgingManager {
  private engine: Engine;
  private scene: Scene;
  private featureManager: FeatureManager;
  private agingEffects: Map<string, MaterialAgingEffect> = new Map();
  private originalMaterials: Map<string, Material> = new Map();
  private config: MaterialAgingConfig;
  private agingShaders: Map<string, any> = new Map();

  constructor(engine: Engine, scene: Scene, featureManager: FeatureManager) {
    this.engine = engine;
    this.scene = scene;
    this.featureManager = featureManager;

    this.config = {
      enableRealTimeAging: false,
      agingSpeed: 1.0,
      showAgingPreview: true,
      agingTimeline: 0
    };

    this.initializeAgingShaders();
  }

  // Initialize custom shaders for aging effects
  private initializeAgingShaders(): void {
    // Create shader for paint fading
    const paintFadeShader = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float fadeAmount;
      uniform float crackIntensity;

      void main(void) {
        vec4 color = texture2D(textureSampler, vUV);
        // Apply fading effect
        color.rgb *= (1.0 - fadeAmount * 0.5);
        // Add subtle crack pattern
        float crack = sin(vUV.x * 100.0) * sin(vUV.y * 100.0) * crackIntensity;
        color.rgb *= (1.0 - crack * 0.1);
        gl_FragColor = color;
      }
    `;

    // Create shader for wood aging
    const woodAgingShader = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float scratchIntensity;
      uniform float stainAmount;

      void main(void) {
        vec4 color = texture2D(textureSampler, vUV);
        // Add wood grain variation
        float grain = sin(vUV.y * 50.0) * 0.1;
        color.rgb += grain;

        // Add scratches
        float scratch = sin(vUV.x * 200.0 + vUV.y * 50.0) * scratchIntensity;
        if (scratch > 0.8) {
          color.rgb *= 0.7; // Darken scratched areas
        }

        // Add stains
        float stain = sin(vUV.x * 30.0) * sin(vUV.y * 30.0) * stainAmount;
        color.rgb *= (1.0 - stain * 0.2);

        gl_FragColor = color;
      }
    `;

    this.agingShaders.set('paint_fade', paintFadeShader);
    this.agingShaders.set('wood_aging', woodAgingShader);
  }

  // Apply aging effect to a material
  async applyAgingEffect(mesh: Mesh, materialType: MaterialAgingEffect['materialType'], age: number = 5): Promise<string> {
    if (!this.featureManager.isFeatureEnabled('material_aging')) {
      throw new Error('Material aging feature is not enabled');
    }

    const effectId = `aging_${mesh.name}_${Date.now()}`;

    // Store original material
    if (mesh.material) {
      this.originalMaterials.set(effectId, mesh.material.clone(`${mesh.name}_original`)!);
    }

    // Create aging effect
    const agingEffect = this.createAgingEffect(effectId, materialType, age);
    this.agingEffects.set(effectId, agingEffect);

    // Apply aging to mesh material
    await this.applyAgingToMaterial(mesh, agingEffect);

    return effectId;
  }

  // Create aging effect based on material type
  private createAgingEffect(id: string, materialType: MaterialAgingEffect['materialType'], age: number): MaterialAgingEffect {
    const baseSeverity = Math.min(age / 50, 1); // Max severity at 50 years

    const effects: AgingVisualEffect[] = [];
    const degradationFactors: DegradationFactor[] = [];

    switch (materialType) {
      case 'paint':
        effects.push(
          {
            type: 'fade',
            intensity: baseSeverity * 0.6,
            color: new Color3(0.9, 0.9, 0.9)
          },
          {
            type: 'crack',
            intensity: baseSeverity * 0.4,
            pattern: this.createCrackTexture()
          }
        );
        degradationFactors.push(
          { type: 'uv_exposure', rate: 0.02, currentLevel: baseSeverity },
          { type: 'moisture', rate: 0.015, currentLevel: baseSeverity * 0.8 }
        );
        break;

      case 'wood':
        effects.push(
          {
            type: 'scratch',
            intensity: baseSeverity * 0.5,
            pattern: this.createScratchTexture()
          },
          {
            type: 'stain',
            intensity: baseSeverity * 0.3,
            color: new Color3(0.4, 0.2, 0.1)
          },
          {
            type: 'warp',
            intensity: baseSeverity * 0.2
          }
        );
        degradationFactors.push(
          { type: 'moisture', rate: 0.025, currentLevel: baseSeverity },
          { type: 'temperature', rate: 0.01, currentLevel: baseSeverity * 0.6 },
          { type: 'physical_wear', rate: 0.02, currentLevel: baseSeverity * 0.8 }
        );
        break;

      case 'tile':
        effects.push(
          {
            type: 'wear',
            intensity: baseSeverity * 0.4,
            pattern: this.createWearTexture()
          },
          {
            type: 'stain',
            intensity: baseSeverity * 0.6,
            color: new Color3(0.3, 0.3, 0.3)
          }
        );
        degradationFactors.push(
          { type: 'physical_wear', rate: 0.03, currentLevel: baseSeverity },
          { type: 'chemical', rate: 0.015, currentLevel: baseSeverity * 0.7 }
        );
        break;

      case 'metal':
        effects.push(
          {
            type: 'rust',
            intensity: baseSeverity * 0.7,
            color: new Color3(0.4, 0.2, 0.1)
          },
          {
            type: 'discolor',
            intensity: baseSeverity * 0.3,
            color: new Color3(0.6, 0.6, 0.6)
          }
        );
        degradationFactors.push(
          { type: 'moisture', rate: 0.04, currentLevel: baseSeverity },
          { type: 'chemical', rate: 0.02, currentLevel: baseSeverity * 0.8 }
        );
        break;

      case 'concrete':
        effects.push(
          {
            type: 'crack',
            intensity: baseSeverity * 0.5,
            pattern: this.createCrackTexture()
          },
          {
            type: 'stain',
            intensity: baseSeverity * 0.4,
            color: new Color3(0.2, 0.2, 0.2)
          }
        );
        degradationFactors.push(
          { type: 'moisture', rate: 0.02, currentLevel: baseSeverity },
          { type: 'physical_wear', rate: 0.015, currentLevel: baseSeverity * 0.6 }
        );
        break;

      case 'glass':
        effects.push(
          {
            type: 'discolor',
            intensity: baseSeverity * 0.2,
            color: new Color3(0.8, 0.8, 0.9)
          }
        );
        degradationFactors.push(
          { type: 'chemical', rate: 0.01, currentLevel: baseSeverity * 0.3 }
        );
        break;

      case 'fabric':
        effects.push(
          {
            type: 'fade',
            intensity: baseSeverity * 0.8,
            color: new Color3(0.7, 0.7, 0.7)
          },
          {
            type: 'stain',
            intensity: baseSeverity * 0.5,
            color: new Color3(0.5, 0.5, 0.5)
          }
        );
        degradationFactors.push(
          { type: 'uv_exposure', rate: 0.03, currentLevel: baseSeverity },
          { type: 'moisture', rate: 0.02, currentLevel: baseSeverity * 0.7 }
        );
        break;
    }

    return {
      id,
      materialType,
      age,
      severity: baseSeverity,
      visualEffects: effects,
      degradationFactors
    };
  }

  // Apply aging effects to material
  private async applyAgingToMaterial(mesh: Mesh, agingEffect: MaterialAgingEffect): Promise<void> {
    if (!mesh.material) return;

    const material = mesh.material.clone(`${mesh.name}_aged`)!;

    // Apply visual effects based on material type
    for (const effect of agingEffect.visualEffects) {
      await this.applyVisualEffect(material, effect, agingEffect.materialType);
    }

    mesh.material = material;
  }

  // Apply individual visual effect
  private async applyVisualEffect(material: Material, effect: AgingVisualEffect, materialType: string): Promise<void> {
    if (material instanceof PBRMaterial || material instanceof StandardMaterial) {
      switch (effect.type) {
        case 'fade':
          // Reduce albedo/diffuse color intensity
          if (material instanceof PBRMaterial) {
            material.albedoColor = material.albedoColor.scale(1 - effect.intensity * 0.3);
          } else if (material instanceof StandardMaterial) {
            material.diffuseColor = material.diffuseColor.scale(1 - effect.intensity * 0.3);
          }
          break;

        case 'crack':
          if (effect.pattern) {
            // Apply crack texture as opacity mask or overlay
            if (material instanceof StandardMaterial) {
              material.opacityTexture = effect.pattern;
              if ('uScale' in material.opacityTexture) {
                (material.opacityTexture as any).uScale = 2;
              }
              if ('vScale' in material.opacityTexture) {
                (material.opacityTexture as any).vScale = 2;
              }
            }
          }
          break;

        case 'scratch':
          if (effect.pattern) {
            // Apply scratch texture as normal map or diffuse overlay
            if (material instanceof PBRMaterial) {
              material.bumpTexture = effect.pattern;
              material.bumpTexture.level = effect.intensity;
            }
          }
          break;

        case 'stain':
          if (effect.color) {
            // Mix in stain color
            const stainTexture = this.createStainTexture(effect.color, effect.intensity);
            if (material instanceof StandardMaterial) {
              material.diffuseTexture = stainTexture;
            }
          }
          break;

        case 'rust':
          if (effect.color) {
            // Apply rust color overlay
            const rustTexture = this.createRustTexture(effect.color, effect.intensity);
            if (material instanceof StandardMaterial) {
              material.diffuseTexture = rustTexture;
            }
          }
          break;

        case 'wear':
          if (effect.pattern) {
            // Apply wear pattern
            if (material instanceof PBRMaterial) {
              material.bumpTexture = effect.pattern;
              material.bumpTexture.level = effect.intensity * 0.5;
            }
          }
          break;
      }
    }
  }

  // Create procedural textures for aging effects
  private createCrackTexture(): Texture {
    const texture = new DynamicTexture('crack_texture', { width: 512, height: 512 }, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, 512, 512);

    // Draw crack pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const startX = Math.random() * 512;
      const startY = Math.random() * 512;
      ctx.moveTo(startX, startY);

      let currentX = startX;
      let currentY = startY;

      for (let j = 0; j < 10; j++) {
        currentX += (Math.random() - 0.5) * 50;
        currentY += (Math.random() - 0.5) * 50;
        ctx.lineTo(currentX, currentY);
      }

      ctx.stroke();
    }

    texture.update();
    return texture;
  }

  private createScratchTexture(): Texture {
    const texture = new DynamicTexture('scratch_texture', { width: 256, height: 256 }, this.scene, false);
    const ctx = texture.getContext();

    ctx.fillStyle = 'rgba(255, 255, 255, 0)';
    ctx.fillRect(0, 0, 256, 256);

    // Draw scratch pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      const startX = Math.random() * 256;
      const startY = Math.random() * 256;
      const length = Math.random() * 50 + 10;

      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + length, startY + Math.random() * 20 - 10);
      ctx.stroke();
    }

    texture.update();
    return texture;
  }

  private createWearTexture(): Texture {
    const texture = new DynamicTexture('wear_texture', { width: 256, height: 256 }, this.scene, false);
    const ctx = texture.getContext();

    // Create wear pattern with noise
    const imageData = ctx.getImageData(0, 0, 256, 256);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % 256;
      const y = Math.floor((i / 4) / 256);

      // Create wear pattern using Perlin-like noise
      const wear = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5;
      const intensity = wear * 255;

      data[i] = intensity;     // R
      data[i + 1] = intensity; // G
      data[i + 2] = intensity; // B
      data[i + 3] = 255;       // A
    }

    ctx.putImageData(imageData, 0, 0);
    texture.update();
    return texture;
  }

  private createStainTexture(color: Color3, intensity: number): Texture {
    const texture = new DynamicTexture('stain_texture', { width: 128, height: 128 }, this.scene, false);
    const ctx = texture.getContext();

    // Create stain pattern
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${intensity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    texture.update();
    return texture;
  }

  private createRustTexture(color: Color3, intensity: number): Texture {
    const texture = new DynamicTexture('rust_texture', { width: 128, height: 128 }, this.scene, false);
    const ctx = texture.getContext();

    // Create rust pattern with irregular shapes
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const size = Math.random() * 20 + 5;

      ctx.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${intensity * Math.random()})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    texture.update();
    return texture;
  }

  // Update aging timeline
  updateAgingTimeline(timeline: number): void {
    this.config.agingTimeline = timeline;

    // Update all aging effects based on new timeline
    this.agingEffects.forEach((effect, id) => {
      const mesh = this.scene.getMeshById(id.replace('aging_', '').split('_')[0]);
      if (mesh && mesh instanceof Mesh) {
        const newAge = timeline;
        const newSeverity = Math.min(newAge / 50, 1);

        effect.age = newAge;
        effect.severity = newSeverity;

        // Update visual effects intensity
        effect.visualEffects.forEach(visualEffect => {
          visualEffect.intensity = newSeverity * this.getBaseIntensityForEffect(visualEffect.type, effect.materialType);
        });

        // Reapply aging effect
        this.applyAgingToMaterial(mesh, effect);
      }
    });
  }

  private getBaseIntensityForEffect(type: AgingVisualEffect['type'], materialType: string): number {
    const intensityMap: { [key: string]: { [key: string]: number } } = {
      fade: { paint: 0.6, wood: 0.3, tile: 0.2, metal: 0.1, concrete: 0.2, glass: 0.1, fabric: 0.8 },
      crack: { paint: 0.4, wood: 0.2, tile: 0.3, metal: 0.1, concrete: 0.5, glass: 0.1, fabric: 0.1 },
      scratch: { paint: 0.1, wood: 0.5, tile: 0.4, metal: 0.3, concrete: 0.2, glass: 0.0, fabric: 0.2 },
      stain: { paint: 0.3, wood: 0.3, tile: 0.6, metal: 0.2, concrete: 0.4, glass: 0.1, fabric: 0.5 },
      rust: { paint: 0.0, wood: 0.0, tile: 0.0, metal: 0.7, concrete: 0.0, glass: 0.0, fabric: 0.0 },
      warp: { paint: 0.0, wood: 0.2, tile: 0.0, metal: 0.1, concrete: 0.0, glass: 0.0, fabric: 0.1 },
      discolor: { paint: 0.2, wood: 0.1, tile: 0.1, metal: 0.3, concrete: 0.1, glass: 0.2, fabric: 0.1 },
      wear: { paint: 0.1, wood: 0.2, tile: 0.4, metal: 0.2, concrete: 0.3, glass: 0.0, fabric: 0.3 }
    };

    return intensityMap[type]?.[materialType] || 0.1;
  }

  // Remove aging effect
  removeAgingEffect(effectId: string): void {
    const effect = this.agingEffects.get(effectId);
    if (!effect) return;

    const meshName = effectId.replace('aging_', '').split('_')[0];
    const mesh = this.scene.getMeshById(meshName);
    const originalMaterial = this.originalMaterials.get(effectId);

    if (mesh && originalMaterial) {
      mesh.material = originalMaterial;
    }

    this.agingEffects.delete(effectId);
    this.originalMaterials.delete(effectId);
  }

  // Get aging effect info
  getAgingEffect(effectId: string): MaterialAgingEffect | null {
    return this.agingEffects.get(effectId) || null;
  }

  // Get all aging effects
  getAllAgingEffects(): MaterialAgingEffect[] {
    return Array.from(this.agingEffects.values());
  }

  // Update configuration
  updateConfig(newConfig: Partial<MaterialAgingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): MaterialAgingConfig {
    return { ...this.config };
  }

  // Dispose resources
  dispose(): void {
    this.agingEffects.clear();
    this.originalMaterials.clear();
    this.agingShaders.clear();
  }
}
