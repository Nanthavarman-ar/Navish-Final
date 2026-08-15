import * as BABYLON from "@babylonjs/core";

export class MaterialLifecycleManager {
  private scene: BABYLON.Scene;
  private materials: Map<string, BABYLON.PBRMaterial> = new Map();
  private agingEffects: Map<string, any> = new Map();
  private time: number = 0;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.initializeAgingMaterials();
  }

  private initializeAgingMaterials() {
    // Wood material with aging
    const woodMaterial = new BABYLON.PBRMaterial("wood_aging", this.scene);
    woodMaterial.albedoColor = new BABYLON.Color3(0.8, 0.6, 0.4);
    woodMaterial.metallic = 0.0;
    woodMaterial.roughness = 0.7;
    this.materials.set("wood", woodMaterial);

    // Paint material with fading
    const paintMaterial = new BABYLON.PBRMaterial("paint_aging", this.scene);
    paintMaterial.albedoColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    paintMaterial.metallic = 0.1;
    paintMaterial.roughness = 0.3;
    this.materials.set("paint", paintMaterial);

    // Metal material with rust
    const metalMaterial = new BABYLON.PBRMaterial("metal_aging", this.scene);
    metalMaterial.albedoColor = new BABYLON.Color3(0.7, 0.7, 0.8);
    metalMaterial.metallic = 0.9;
    metalMaterial.roughness = 0.2;
    this.materials.set("metal", metalMaterial);
  }

  applyAgingEffect(materialName: string, ageYears: number, mesh: BABYLON.AbstractMesh) {
    const material = this.materials.get(materialName);
    if (!material) return;

    const agingFactor = Math.min(ageYears / 50, 1); // Max 50 years aging

    switch (materialName) {
      case "wood":
        this.applyWoodAging(material, agingFactor);
        break;
      case "paint":
        this.applyPaintAging(material, agingFactor);
        break;
      case "metal":
        this.applyMetalAging(material, agingFactor);
        break;
    }

    mesh.material = material;
  }

  private applyWoodAging(material: BABYLON.PBRMaterial, factor: number) {
    // Wood gets darker and develops cracks
    const baseColor = new BABYLON.Color3(0.8, 0.6, 0.4);
    const agedColor = BABYLON.Color3.Lerp(baseColor, new BABYLON.Color3(0.4, 0.3, 0.2), factor);
    material.albedoColor = agedColor;

    // Roughness increases with age
    material.roughness = 0.7 + (factor * 0.3);

    // Add subtle bump mapping for wood grain
    if (!material.bumpTexture) {
      const bumpTexture = new BABYLON.DynamicTexture("woodBump", { width: 512, height: 512 }, this.scene);
      const ctx = bumpTexture.getContext();
      this.generateWoodTexture(ctx, 512, 512, factor);
      bumpTexture.update();
      material.bumpTexture = bumpTexture;
      material.bumpTexture.level = factor * 0.5;
    }
  }

  private applyPaintAging(material: BABYLON.PBRMaterial, factor: number) {
    // Paint fades and develops cracks
    const baseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    const fadedColor = BABYLON.Color3.Lerp(baseColor, new BABYLON.Color3(0.7, 0.7, 0.7), factor);
    material.albedoColor = fadedColor;

    // Roughness increases with cracking
    material.roughness = 0.3 + (factor * 0.4);

    // Add crack texture
    if (!material.bumpTexture) {
      const crackTexture = new BABYLON.DynamicTexture("paintCracks", { width: 512, height: 512 }, this.scene);
      const ctx = crackTexture.getContext();
      this.generateCrackTexture(ctx, 512, 512, factor);
      crackTexture.update();
      material.bumpTexture = crackTexture;
      material.bumpTexture.level = factor * 0.3;
    }
  }

  private applyMetalAging(material: BABYLON.PBRMaterial, factor: number) {
    // Metal develops rust
    const baseColor = new BABYLON.Color3(0.7, 0.7, 0.8);
    const rustedColor = BABYLON.Color3.Lerp(baseColor, new BABYLON.Color3(0.4, 0.2, 0.1), factor);
    material.albedoColor = rustedColor;

    // Roughness increases with rust
    material.roughness = 0.2 + (factor * 0.5);

    // Add rust texture
    if (!material.albedoTexture) {
      const rustTexture = new BABYLON.DynamicTexture("rustTexture", { width: 512, height: 512 }, this.scene);
      const ctx = rustTexture.getContext();
      this.generateRustTexture(ctx, 512, 512, factor);
      rustTexture.update();
      material.albedoTexture = rustTexture;
    }
  }

  private generateWoodTexture(ctx: any, width: number, height: number, age: number) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, width, height);

    // Add wood grain lines
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 1 + age * 2;

    for (let i = 0; i < height; i += 10 + Math.random() * 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i + Math.sin(i * 0.1) * 5);
      ctx.stroke();
    }
  }

  private generateCrackTexture(ctx: any, width: number, height: number, age: number) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Add crack lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5 + age * 3;

    const crackCount = Math.floor(age * 20) + 1;
    for (let i = 0; i < crackCount; i++) {
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      ctx.beginPath();
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
  }

  private generateRustTexture(ctx: any, width: number, height: number, age: number) {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const rust = Math.random() < age * 0.3;
      if (rust) {
        // Rust color
        data[i] = 139 + Math.random() * 50;     // R
        data[i + 1] = 69 + Math.random() * 30;  // G
        data[i + 2] = 19 + Math.random() * 20;  // B
        data[i + 3] = 255;                      // A
      } else {
        // Base metal color
        data[i] = 112 + Math.random() * 30;     // R
        data[i + 1] = 128 + Math.random() * 30; // G
        data[i + 2] = 144 + Math.random() * 30; // B
        data[i + 3] = 255;                      // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  getAvailableMaterials(): string[] {
    return Array.from(this.materials.keys());
  }

  previewAging(materialName: string, ageYears: number): BABYLON.PBRMaterial | null {
    const material = this.materials.get(materialName);
    if (!material) return null;

    const previewMaterial = material.clone(`${materialName}_preview_${ageYears}`);
    const agingFactor = Math.min(ageYears / 50, 1);

    switch (materialName) {
      case "wood":
        this.applyWoodAging(previewMaterial, agingFactor);
        break;
      case "paint":
        this.applyPaintAging(previewMaterial, agingFactor);
        break;
      case "metal":
        this.applyMetalAging(previewMaterial, agingFactor);
        break;
    }

    return previewMaterial;
  }

  dispose() {
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
    this.agingEffects.clear();
  }
}
