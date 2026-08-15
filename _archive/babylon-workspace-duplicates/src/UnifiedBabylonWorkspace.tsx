import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  AbstractMesh,
  Mesh,
  StandardMaterial,
  PBRMaterial,
  ShadowGenerator,
  DefaultRenderingPipeline,
  SSAORenderingPipeline,
  SceneOptimizer,
  SceneOptimizerOptions,
  HardwareScalingOptimization,
  ShadowsOptimization,
  PostProcessesOptimization,
  LensFlaresOptimization,
  ParticlesOptimization,
  RenderTargetsOptimization,
  MergeMeshesOptimization,
  GizmoManager,
  UtilityLayerRenderer,
  PickingInfo,
  AssetContainer,
  SceneLoader,
  ActionManager,
  HighlightLayer,
  Plane
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  Button,
  TextBlock,
  StackPanel,
  Control,
  Slider,
  Checkbox
} from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import '@babylonjs/loaders/STL';

// Unified Interfaces
interface SceneConfig {
  enablePhysics?: boolean;
  enablePostProcessing?: boolean;
  enableSSAO?: boolean;
  enableShadows?: boolean;
  shadowMapSize?: number;
  enableOptimization?: boolean;
  targetFPS?: number;
}

interface UIConfig {
  showNavigation?: boolean;
  showLighting?: boolean;
  showMaterials?: boolean;
  showObjects?: boolean;
  showEffects?: boolean;
  showAdmin?: boolean;
  showSectionCut?: boolean;
}

interface UploadProgress {
  file: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
}

interface UnifiedBabylonWorkspaceProps {
  workspaceId: string;
  isAdmin?: boolean;
}

// Unified Scene Manager Class
class UnifiedSceneManager {
  private canvas: HTMLCanvasElement;
  private engine!: Engine;
  private scene!: Scene;
  private camera!: ArcRotateCamera | UniversalCamera;
  private shadowGenerator: ShadowGenerator | null = null;
  private renderPipeline: DefaultRenderingPipeline | null = null;
  private ssaoPipeline: SSAORenderingPipeline | null = null;
  private gizmoManager: GizmoManager | null = null;
  private utilityLayer: UtilityLayerRenderer | null = null;
  private highlightLayer: HighlightLayer | null = null;

  private sectionPlanes: Plane[] = [];
  private sectionPlaneMeshes: Mesh[] = [];
  private loadedModels: Map<string, AssetContainer> = new Map();
  private selectedObjects: Set<AbstractMesh> = new Set();
  private navigationMode: 'walk' | 'orbit' | 'tabletop' | 'fly' = 'orbit';
  private currentLightingPreset: string = 'day';

  private config: SceneConfig = {
    enablePhysics: false,
    enablePostProcessing: true,
    enableSSAO: true,
    enableShadows: true,
    shadowMapSize: 1024,
    enableOptimization: true,
    targetFPS: 60
  };

  constructor(canvas: HTMLCanvasElement, config?: Partial<SceneConfig>) {
    this.canvas = canvas;
    this.config = { ...this.config, ...config };
    this.initialize();
  }

  private initialize(): void {
    this.initializeEngine();
    this.initializeScene();
    this.initializeCamera();
    this.initializeLighting();
    this.initializePostProcessing();
    this.initializeGizmos();
    this.initializeOptimization();
    this.startRenderLoop();
  }

  private initializeEngine(): void {
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    });

    window.addEventListener('resize', () => this.engine.resize());
  }

  private initializeScene(): void {
    this.scene = new Scene(this.engine);
    this.scene.actionManager = new ActionManager(this.scene);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1.0);
    this.scene.ambientColor = new Color3(0.3, 0.3, 0.3);
    this.highlightLayer = new HighlightLayer('highlight', this.scene);
    this.scene.clipPlane = null;

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh) {
        this.handleMeshSelection(pointerInfo.pickInfo);
      }
    });
  }

  private initializeCamera(): void {
    this.camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 4, 10, Vector3.Zero(), this.scene);
    this.camera.attachControl(this.canvas, true);
    this.camera.setTarget(Vector3.Zero());
    
    (this.camera as ArcRotateCamera).lowerRadiusLimit = 1;
    (this.camera as ArcRotateCamera).upperRadiusLimit = 100;
    (this.camera as ArcRotateCamera).lowerBetaLimit = 0.1;
    (this.camera as ArcRotateCamera).upperBetaLimit = Math.PI - 0.1;
  }

  private initializeLighting(): void {
    const hemisphericLight = new HemisphericLight('hemisphericLight', new Vector3(0, 1, 0), this.scene);
    hemisphericLight.intensity = 0.6;
    hemisphericLight.diffuse = new Color3(1, 1, 1);
    hemisphericLight.specular = new Color3(0.2, 0.2, 0.2);

    const directionalLight = new DirectionalLight('directionalLight', new Vector3(-1, -1, -1), this.scene);
    directionalLight.intensity = 1.0;
    directionalLight.diffuse = new Color3(1, 1, 1);
    directionalLight.specular = new Color3(1, 1, 1);

    if (this.config.enableShadows) {
      this.shadowGenerator = new ShadowGenerator(this.config.shadowMapSize || 1024, directionalLight);
      this.shadowGenerator.useExponentialShadowMap = true;
      this.shadowGenerator.useKernelBlur = true;
      this.shadowGenerator.blurKernel = 64;
    }
  }

  private initializePostProcessing(): void {
    if (!this.config.enablePostProcessing) return;

    this.renderPipeline = new DefaultRenderingPipeline('defaultPipeline', true, this.scene, [this.camera]);
    this.renderPipeline.fxaaEnabled = true;
    this.renderPipeline.bloomEnabled = true;
    this.renderPipeline.bloomThreshold = 0.8;
    this.renderPipeline.bloomWeight = 0.3;
    this.renderPipeline.bloomKernel = 64;

    this.renderPipeline.imageProcessingEnabled = true;
    if (this.renderPipeline.imageProcessing) {
      this.renderPipeline.imageProcessing.toneMappingEnabled = true;
      this.renderPipeline.imageProcessing.exposure = 1.0;
    }

    if (this.config.enableSSAO) {
      this.ssaoPipeline = new SSAORenderingPipeline('ssao', this.scene, 0.75, [this.camera]);
      this.ssaoPipeline.fallOff = 0.000001;
      this.ssaoPipeline.area = 1;
      this.ssaoPipeline.radius = 0.0001;
      this.ssaoPipeline.totalStrength = 1.0;
      this.ssaoPipeline.base = 0.5;
    }
  }

  private initializeGizmos(): void {
    this.utilityLayer = new UtilityLayerRenderer(this.scene);
    this.gizmoManager = new GizmoManager(this.scene, 1, this.utilityLayer);
    
    this.gizmoManager.positionGizmoEnabled = false;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;
    this.gizmoManager.boundingBoxGizmoEnabled = false;
  }

  private initializeOptimization(): void {
    if (!this.config.enableOptimization) return;

    const options = new SceneOptimizerOptions(this.config.targetFPS || 60, 2000);
    options.addOptimization(new HardwareScalingOptimization(0, 1));
    options.addOptimization(new ShadowsOptimization(1));
    options.addOptimization(new PostProcessesOptimization(2));
    options.addOptimization(new LensFlaresOptimization(3));
    options.addOptimization(new ParticlesOptimization(4));
    options.addOptimization(new RenderTargetsOptimization(5));
    options.addOptimization(new MergeMeshesOptimization(6));

    SceneOptimizer.OptimizeAsync(this.scene, options);
  }

  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => this.scene.render());
  }

  private handleMeshSelection(pickInfo: PickingInfo): void {
    if (!pickInfo.pickedMesh) return;

    const mesh = pickInfo.pickedMesh;
    
    if (this.selectedObjects.has(mesh)) {
      this.selectedObjects.delete(mesh);
      this.removeSelectionOutline(mesh);
    } else {
      this.selectedObjects.add(mesh);
      this.addSelectionOutline(mesh);
    }

    if (this.selectedObjects.size === 1) {
      const selectedMesh = Array.from(this.selectedObjects)[0];
      this.gizmoManager!.attachToMesh(selectedMesh);
    } else {
      this.gizmoManager!.attachToMesh(null);
    }
  }

  private addSelectionOutline(mesh: AbstractMesh): void {
    if (this.highlightLayer) {
      this.highlightLayer.addMesh(mesh as Mesh, Color3.Yellow());
    }
  }

  private removeSelectionOutline(mesh: AbstractMesh): void {
    if (this.highlightLayer) {
      this.highlightLayer.removeMesh(mesh as Mesh);
    }
  }

  public async loadModel(file: File): Promise<string> {
    const modelId = `model_${Date.now()}`;
    const url = URL.createObjectURL(file);
    
    try {
      const result = await SceneLoader.ImportMeshAsync('', '', url, this.scene);
      
      if (result.meshes.length === 0) {
        throw new Error('No meshes found in model');
      }

      const container = new AssetContainer(this.scene);
      result.meshes.forEach(mesh => container.meshes.push(mesh));

      this.autoCenterAndScale(result.meshes);

      if (this.shadowGenerator) {
        result.meshes.forEach(mesh => {
          if (mesh instanceof Mesh) {
            this.shadowGenerator!.addShadowCaster(mesh);
            mesh.receiveShadows = true;
          }
        });
      }

      this.loadedModels.set(modelId, container);
      URL.revokeObjectURL(url);
      return modelId;
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  public removeModel(id: string): boolean {
    const container = this.loadedModels.get(id);
    if (!container) return false;

    this.removeSectionPlanes();
    container.dispose();
    this.loadedModels.delete(id);
    return true;
  }

  public setNavigationMode(mode: 'walk' | 'orbit' | 'tabletop' | 'fly'): boolean {
    if (this.navigationMode === mode) return true;

    const currentPosition = this.camera.position.clone();
    const currentTarget = this.camera instanceof ArcRotateCamera 
      ? this.camera.target.clone() 
      : this.camera.position.add(this.camera.getForwardRay().direction);

    this.camera.dispose();

    switch (mode) {
      case 'orbit':
        this.camera = new ArcRotateCamera('orbitCamera', 0, Math.PI / 4, Vector3.Distance(currentPosition, currentTarget), currentTarget, this.scene);
        this.camera.attachControl(this.canvas, true);
        break;

      case 'walk':
      case 'fly':
        this.camera = new UniversalCamera('walkCamera', currentPosition, this.scene);
        this.camera.setTarget(currentTarget);
        this.camera.attachControl(this.canvas, true);
        
        if (mode === 'walk') {
          this.camera.ellipsoid = new Vector3(0.5, 1, 0.5);
          this.camera.checkCollisions = true;
          this.camera.applyGravity = true;
        }
        break;

      case 'tabletop':
        this.camera = new ArcRotateCamera('tabletopCamera', 0, Math.PI / 6, 20, Vector3.Zero(), this.scene);
        this.camera.attachControl(this.canvas, true);
        (this.camera as ArcRotateCamera).lowerBetaLimit = 0;
        (this.camera as ArcRotateCamera).upperBetaLimit = Math.PI / 2;
        break;
    }

    this.navigationMode = mode;
    return true;
  }

  public applyLightingPreset(name: string): boolean {
    const presets = {
      day: {
        ambientColor: new Color3(0.8, 0.8, 0.9),
        directionalLight: { direction: new Vector3(-0.3, -0.8, -0.5), intensity: 1.2, color: new Color3(1, 0.95, 0.8) }
      },
      night: {
        ambientColor: new Color3(0.1, 0.1, 0.2),
        directionalLight: { direction: new Vector3(0, -0.5, 0), intensity: 0.3, color: new Color3(0.5, 0.5, 0.7) }
      },
      interior: {
        ambientColor: new Color3(0.4, 0.4, 0.4),
        directionalLight: { direction: new Vector3(0, -1, 0), intensity: 0.8, color: new Color3(1, 1, 1) }
      }
    };

    const preset = presets[name as keyof typeof presets];
    if (!preset) return false;

    this.scene.ambientColor = preset.ambientColor;

    const directionalLight = this.scene.lights.find(light => light instanceof DirectionalLight) as DirectionalLight;
    if (directionalLight) {
      directionalLight.direction = preset.directionalLight.direction;
      directionalLight.intensity = preset.directionalLight.intensity;
      directionalLight.diffuse = preset.directionalLight.color;
    }

    this.currentLightingPreset = name;
    return true;
  }

  public setMaterial(target: string, materialType: 'metal' | 'wood' | 'glass' | 'fabric' | 'stone' | 'plastic'): boolean {
    const mesh = this.scene.getMeshById(target);
    if (!mesh) return false;

    const material = new PBRMaterial(`material_${Date.now()}`, this.scene);
    
    switch (materialType) {
      case 'metal':
        material.albedoColor = new Color3(0.7, 0.7, 0.7);
        material.metallic = 1.0;
        material.roughness = 0.1;
        break;
      case 'wood':
        material.albedoColor = new Color3(0.6, 0.4, 0.2);
        material.metallic = 0.0;
        material.roughness = 0.8;
        break;
      case 'glass':
        material.albedoColor = new Color3(0.9, 0.9, 1.0);
        material.metallic = 0.0;
        material.roughness = 0.0;
        material.alpha = 0.3;
        break;
      case 'fabric':
        material.albedoColor = new Color3(0.5, 0.3, 0.7);
        material.metallic = 0.0;
        material.roughness = 0.9;
        break;
      case 'stone':
        material.albedoColor = new Color3(0.4, 0.4, 0.4);
        material.metallic = 0.0;
        material.roughness = 0.7;
        break;
      case 'plastic':
        material.albedoColor = new Color3(0.8, 0.2, 0.2);
        material.metallic = 0.0;
        material.roughness = 0.3;
        break;
    }

    mesh.material = material;
    return true;
  }

  public toggleCategory(category: string, visible: boolean): boolean {
    const meshes = this.scene.meshes.filter(mesh => mesh.metadata?.category === category);
    meshes.forEach(mesh => mesh.setEnabled(visible));
    return meshes.length > 0;
  }

  public addSectionPlane(normal: Vector3, point: Vector3): void {
    const plane = Plane.FromPositionAndNormal(point, normal);
    this.sectionPlanes.push(plane);
    this.updateClippingPlanes();

    const planeMesh = Mesh.CreatePlane(`sectionPlane_${this.sectionPlanes.length}`, 10, this.scene, false);
    planeMesh.position = point;
    planeMesh.rotation = new Vector3(Math.acos(normal.y) - Math.PI / 2, Math.atan2(normal.x, normal.z), 0);
    planeMesh.isPickable = false;
    planeMesh.visibility = 0.3;
    planeMesh.material = new StandardMaterial(`sectionPlaneMat_${this.sectionPlanes.length}`, this.scene);
    (planeMesh.material as StandardMaterial).diffuseColor = new Color3(1, 0, 0);
    (planeMesh.material as StandardMaterial).backFaceCulling = false;

    this.sectionPlaneMeshes.push(planeMesh);
  }

  public removeSectionPlanes(): void {
    this.sectionPlanes = [];
    this.updateClippingPlanes();
    this.sectionPlaneMeshes.forEach(mesh => mesh.dispose());
    this.sectionPlaneMeshes = [];
  }

  private updateClippingPlanes(): void {
    this.scene.clipPlane = null;
    this.scene.clipPlane2 = null;
    this.scene.clipPlane3 = null;
    this.scene.clipPlane4 = null;
    this.scene.clipPlane5 = null;
    this.scene.clipPlane6 = null;

    if (this.sectionPlanes.length === 0) return;

    const planesToApply = this.sectionPlanes.slice(0, 6);
    planesToApply.forEach((plane, index) => {
      const clipPlaneProperty = index === 0 ? 'clipPlane' : `clipPlane${index + 1}`;
      (this.scene as any)[clipPlaneProperty] = plane;
    });
  }

  public optimizeScene(): void {
    const meshesToMerge = this.scene.meshes.filter(mesh => mesh instanceof Mesh && mesh.material && !mesh.skeleton) as Mesh[];

    if (meshesToMerge.length > 1) {
      const merged = Mesh.MergeMeshes(meshesToMerge, true, true, undefined, false, true);
      if (merged) {
        console.log(`Merged ${meshesToMerge.length} meshes into 1`);
      }
    }

    this.scene.textures.forEach(texture => {
      if (texture.getSize().width > 1024) {
        texture.updateSamplingMode(1);
      }
    });

    if (this.config.enableOptimization) {
      const options = new SceneOptimizerOptions(this.config.targetFPS || 60, 1000);
      SceneOptimizer.OptimizeAsync(this.scene, options);
    }
  }

  public exportState(): any {
    return {
      models: Array.from(this.loadedModels.keys()),
      navigationMode: this.navigationMode,
      lightingPreset: this.currentLightingPreset,
      cameraPosition: this.camera.position.asArray(),
      cameraTarget: this.camera instanceof ArcRotateCamera ? this.camera.target.asArray() : [0, 0, 0],
      selectedObjects: Array.from(this.selectedObjects).map(mesh => mesh.id)
    };
  }

  private autoCenterAndScale(meshes: AbstractMesh[]): void {
    if (meshes.length === 0) return;

    let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();

    meshes.forEach(mesh => {
      const boundingBox = mesh.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, boundingBox.minimumWorld);
      max = Vector3.Maximize(max, boundingBox.maximumWorld);
    });

    const center = Vector3.Center(min, max);
    meshes.forEach(mesh => mesh.position.subtractInPlace(center));

    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    if (maxDimension > 10) {
      const scale = 10 / maxDimension;
      meshes.forEach(mesh => mesh.scaling.scaleInPlace(scale));
    }
  }

  public enablePositionGizmo(enabled: boolean): void {
    if (this.gizmoManager) this.gizmoManager.positionGizmoEnabled = enabled;
  }

  public enableRotationGizmo(enabled: boolean): void {
    if (this.gizmoManager) this.gizmoManager.rotationGizmoEnabled = enabled;
  }

  public enableScaleGizmo(enabled: boolean): void {
    if (this.gizmoManager) this.gizmoManager.scaleGizmoEnabled = enabled;
  }

  public getEngine(): Engine { return this.engine; }
  public getScene(): Scene { return this.scene; }
  public getCamera(): ArcRotateCamera | UniversalCamera { return this.camera; }
  public getSelectedObjects(): AbstractMesh[] { return Array.from(this.selectedObjects); }
  public getLoadedModels(): string[] { return Array.from(this.loadedModels.keys()); }

  public dispose(): void {
    this.loadedModels.forEach(container => container.dispose());
    this.loadedModels.clear();
    this.removeSectionPlanes();
    this.gizmoManager?.dispose();
    this.utilityLayer?.dispose();
    this.renderPipeline?.dispose();
    this.ssaoPipeline?.dispose();
    this.shadowGenerator?.dispose();
    this.highlightLayer?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}

// Unified GUI Class
class UnifiedBabylonGUI {
  private scene: Scene;
  private advancedTexture!: AdvancedDynamicTexture;
  private panels: Map<string, Rectangle> = new Map();
  private config: UIConfig;
  private callbacks: any;

  constructor(scene: Scene, config: UIConfig, callbacks: any) {
    this.scene = scene;
    this.config = { showNavigation: true, showLighting: true, showMaterials: true, showObjects: true, showEffects: true, showAdmin: false, showSectionCut: true, ...config };
    this.callbacks = callbacks;
    this.initializeGUI();
    this.createPanels();
  }

  private initializeGUI(): void {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    this.advancedTexture.idealWidth = 1920;
    this.advancedTexture.idealHeight = 1080;
  }

  private createPanels(): void {
    if (this.config.showNavigation) this.createNavigationPanel();
    if (this.config.showLighting) this.createLightingPanel();
    if (this.config.showMaterials) this.createMaterialsPanel();
    if (this.config.showObjects) this.createObjectsPanel();
    if (this.config.showEffects) this.createEffectsPanel();
    if (this.config.showSectionCut) this.createSectionCutPanel();
    if (this.config.showAdmin) this.createAdminPanel();
  }

  private createNavigationPanel(): void {
    const panel = new Rectangle('navigationPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 300;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 20;
    panel.topInPixels = 20;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 10;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Navigation';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const modes = [
      { name: 'Orbit', value: 'orbit' },
      { name: 'Walk', value: 'walk' },
      { name: 'Tabletop', value: 'tabletop' },
      { name: 'Fly', value: 'fly' }
    ];

    modes.forEach(mode => {
      const button = Button.CreateSimpleButton(`nav_${mode.value}`, mode.name);
      button.widthInPixels = 160;
      button.heightInPixels = 40;
      button.color = 'white';
      button.cornerRadius = 5;
      button.background = 'rgba(0, 100, 200, 0.8)';
      button.onPointerUpObservable.add(() => {
        if (this.callbacks.onNavigationModeChange) {
          this.callbacks.onNavigationModeChange(mode.value);
        }
      });
      stackPanel.addControl(button);
    });

    this.advancedTexture.addControl(panel);
    this.panels.set('navigation', panel);
  }

  private createLightingPanel(): void {
    const panel = new Rectangle('lightingPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 250;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 240;
    panel.topInPixels = 20;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 10;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Lighting';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const presets = ['Day', 'Night', 'Interior'];
    presets.forEach(preset => {
      const button = Button.CreateSimpleButton(`light_${preset.toLowerCase()}`, preset);
      button.widthInPixels = 160;
      button.heightInPixels = 35;
      button.color = 'white';
      button.cornerRadius = 5;
      button.background = 'rgba(200, 150, 0, 0.8)';
      button.onPointerUpObservable.add(() => {
        if (this.callbacks.onLightingPresetChange) {
          this.callbacks.onLightingPresetChange(preset.toLowerCase());
        }
      });
      stackPanel.addControl(button);
    });

    this.advancedTexture.addControl(panel);
    this.panels.set('lighting', panel);
  }

  private createMaterialsPanel(): void {
    const panel = new Rectangle('materialsPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 300;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 460;
    panel.topInPixels = 20;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 8;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Materials';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const materials = [
      { name: 'Metal', category: 'metal' },
      { name: 'Wood', category: 'wood' },
      { name: 'Glass', category: 'glass' },
      { name: 'Fabric', category: 'fabric' },
      { name: 'Stone', category: 'stone' },
      { name: 'Plastic', category: 'plastic' }
    ];

    materials.forEach(material => {
      const button = Button.CreateSimpleButton(`mat_${material.category}`, material.name);
      button.widthInPixels = 160;
      button.heightInPixels = 35;
      button.color = 'white';
      button.cornerRadius = 5;
      button.background = 'rgba(100, 200, 100, 0.8)';
      button.onPointerUpObservable.add(() => {
        if (this.callbacks.onMaterialChange) {
          this.callbacks.onMaterialChange(material.category);
        }
      });
      stackPanel.addControl(button);
    });

    this.advancedTexture.addControl(panel);
    this.panels.set('materials', panel);
  }

  private createObjectsPanel(): void {
    const panel = new Rectangle('objectsPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 280;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 680;
    panel.topInPixels = 20;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 8;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Objects';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const categories = ['Furniture', 'Lighting', 'Decoration', 'Structure', 'Landscape'];

    categories.forEach(category => {
      const container = new Rectangle();
      container.widthInPixels = 160;
      container.heightInPixels = 30;
      container.thickness = 0;

      const checkbox = new Checkbox();
      checkbox.widthInPixels = 20;
      checkbox.heightInPixels = 20;
      checkbox.isChecked = true;
      checkbox.color = 'white';
      checkbox.background = 'rgba(100, 100, 100, 0.8)';
      checkbox.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      checkbox.leftInPixels = 10;

      const label = new TextBlock();
      label.text = category;
      label.color = 'white';
      label.fontSize = 14;
      label.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      label.leftInPixels = 40;

      checkbox.onIsCheckedChangedObservable.add((value) => {
        if (this.callbacks.onObjectToggle) {
          this.callbacks.onObjectToggle(category.toLowerCase(), value);
        }
      });

      container.addControl(checkbox);
      container.addControl(label);
      stackPanel.addControl(container);
    });

    this.advancedTexture.addControl(panel);
    this.panels.set('objects', panel);
  }

  private createEffectsPanel(): void {
    const panel = new Rectangle('effectsPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 200;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 700;
    panel.topInPixels = 20;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 8;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Effects';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const effects = [
      { name: 'Fog', key: 'fog' },
      { name: 'Bloom', key: 'bloom' },
      { name: 'SSAO', key: 'ssao' },
      { name: 'Shadows', key: 'shadows' }
    ];

    effects.forEach(effect => {
      const container = new Rectangle();
      container.widthInPixels = 160;
      container.heightInPixels = 30;
      container.thickness = 0;

      const checkbox = new Checkbox();
      checkbox.widthInPixels = 20;
      checkbox.heightInPixels = 20;
      checkbox.isChecked = true;
      checkbox.color = 'white';
      checkbox.background = 'rgba(100, 100, 100, 0.8)';
      checkbox.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      checkbox.leftInPixels = 10;

      const label = new TextBlock();
      label.text = effect.name;
      label.color = 'white';
      label.fontSize = 14;
      label.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      label.leftInPixels = 40;

      checkbox.onIsCheckedChangedObservable.add((value) => {
        if (this.callbacks.onEffectToggle) {
          this.callbacks.onEffectToggle(effect.key, value);
        }
      });

      container.addControl(checkbox);
      container.addControl(label);
      stackPanel.addControl(container);
    });

    this.advancedTexture.addControl(panel);
    this.panels.set('effects', panel);
  }

  private createSectionCutPanel(): void {
    const panel = new Rectangle('sectionCutPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 180;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 920;
    panel.topInPixels = 20;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 10;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Section Cut';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const addButton = Button.CreateSimpleButton('addSectionCut', 'Add Section Cut');
    addButton.widthInPixels = 160;
    addButton.heightInPixels = 40;
    addButton.color = 'white';
    addButton.cornerRadius = 5;
    addButton.background = 'rgba(200, 0, 0, 0.8)';
    addButton.onPointerUpObservable.add(() => {
      if (this.callbacks.onSectionCutAdd) {
        this.callbacks.onSectionCutAdd({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 });
      }
    });
    stackPanel.addControl(addButton);

    const removeButton = Button.CreateSimpleButton('removeSectionCut', 'Remove Section Cuts');
    removeButton.widthInPixels = 160;
    removeButton.heightInPixels = 40;
    removeButton.color = 'white';
    removeButton.cornerRadius = 5;
    removeButton.background = 'rgba(100, 0, 0, 0.8)';
    removeButton.onPointerUpObservable.add(() => {
      if (this.callbacks.onSectionCutRemove) {
        this.callbacks.onSectionCutRemove();
      }
    });
    stackPanel.addControl(removeButton);

    this.advancedTexture.addControl(panel);
    this.panels.set('sectionCut', panel);
  }

  private createAdminPanel(): void {
    const panel = new Rectangle('adminPanel');
    panel.widthInPixels = 200;
    panel.heightInPixels = 150;
    panel.cornerRadius = 10;
    panel.color = 'white';
    panel.thickness = 2;
    panel.background = 'rgba(0, 0, 0, 0.8)';
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.leftInPixels = 1140;
    panel.topInPixels = 220;

    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.spacing = 10;
    panel.addControl(stackPanel);

    const title = new TextBlock();
    title.text = 'Admin';
    title.color = 'white';
    title.fontSize = 18;
    title.fontWeight = 'bold';
    title.heightInPixels = 30;
    stackPanel.addControl(title);

    const uploadButton = Button.CreateSimpleButton('uploadModel', 'Upload Model');
    uploadButton.widthInPixels = 160;
    uploadButton.heightInPixels = 40;
    uploadButton.color = 'white';
    uploadButton.cornerRadius = 5;
    uploadButton.background = 'rgba(200, 0, 100, 0.8)';
    uploadButton.onPointerUpObservable.add(() => {
      if (this.callbacks.onUploadModel) {
        this.callbacks.onUploadModel();
      }
    });
    stackPanel.addControl(uploadButton);

    this.advancedTexture.addControl(panel);
    this.panels.set('admin', panel);
  }

  public dispose(): void {
    this.panels.forEach(panel => this.advancedTexture.removeControl(panel));
    this.panels.clear();
    this.advancedTexture.dispose();
  }
}

// Main Unified Component
const UnifiedBabylonWorkspace: React.FC<UnifiedBabylonWorkspaceProps> = ({ workspaceId, isAdmin = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sceneManager, setSceneManager] = useState<UnifiedSceneManager | null>(null);
  const [babylonGUI, setBabylonGUI] = useState<UnifiedBabylonGUI | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadedModels, setLoadedModels] = useState<string[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [navigationMode, setNavigationMode] = useState<string>('orbit');
  const [lightingPreset, setLightingPreset] = useState<string>('day');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [performanceMode, setPerformanceMode] = useState<'performance' | 'balanced' | 'quality'>('balanced');
  const [fps, setFps] = useState(60);
  const [renderTime, setRenderTime] = useState(0);

  useEffect(() => {
    if (!canvasRef.current || isInitialized) return;

    const initializeScene = async () => {
      try {
        const config = {
          enablePhysics: false,
          enablePostProcessing: performanceMode !== 'performance',
          enableSSAO: performanceMode === 'quality',
          enableShadows: performanceMode !== 'performance',
          shadowMapSize: performanceMode === 'quality' ? 2048 : 1024,
          enableOptimization: true,
          targetFPS: performanceMode === 'performance' ? 60 : performanceMode === 'balanced' ? 45 : 30
        };

        const manager = new UnifiedSceneManager(canvasRef.current!, config);

        const uiConfig: UIConfig = {
          showNavigation: true,
          showLighting: true,
          showMaterials: true,
          showObjects: true,
          showEffects: true,
          showSectionCut: true,
          showAdmin: isAdmin
        };

        const uiCallbacks = {
          onNavigationModeChange: handleNavigationModeChange,
          onLightingPresetChange: handleLightingPresetChange,
          onMaterialChange: handleMaterialChange,
          onObjectToggle: handleObjectToggle,
          onEffectToggle: handleEffectToggle,
          onSectionCutAdd: handleSectionCutAdd,
          onSectionCutRemove: handleSectionCutRemove,
          onUploadModel: handleUploadModel,
          onDeleteModel: handleDeleteModel
        };

        const gui = new UnifiedBabylonGUI(manager.getScene(), uiConfig, uiCallbacks);

        setSceneManager(manager);
        setBabylonGUI(gui);
        setIsInitialized(true);

        setupPerformanceMonitoring(manager);
        console.log('Unified 3D workspace initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Babylon.js scene:', error);
      }
    };

    initializeScene();

    return () => {
      if (sceneManager) sceneManager.dispose();
      if (babylonGUI) babylonGUI.dispose();
    };
  }, [canvasRef.current, isAdmin, performanceMode]);

  const setupPerformanceMonitoring = (manager: UnifiedSceneManager) => {
    const engine = manager.getEngine();
    setInterval(() => {
      setFps(Math.round(engine.getFps()));
      setRenderTime(engine.getDeltaTime());
    }, 1000);
  };

  const handleNavigationModeChange = useCallback((mode: string) => {
    if (sceneManager) {
      sceneManager.setNavigationMode(mode as any);
      setNavigationMode(mode);
      console.log(`Navigation mode: ${mode}`);
    }
  }, [sceneManager]);

  const handleLightingPresetChange = useCallback((preset: string) => {
    if (sceneManager) {
      sceneManager.applyLightingPreset(preset);
      setLightingPreset(preset);
      console.log(`Lighting preset: ${preset}`);
    }
  }, [sceneManager]);

  const handleMaterialChange = useCallback((materialId: string) => {
    if (sceneManager && selectedObjects.length > 0) {
      selectedObjects.forEach(objectId => {
        sceneManager.setMaterial(objectId, materialId as any);
      });
      console.log(`Applied ${materialId} material`);
    } else {
      console.log('Select an object first');
    }
  }, [sceneManager, selectedObjects]);

  const handleObjectToggle = useCallback((category: string, visible: boolean) => {
    if (sceneManager) {
      sceneManager.toggleCategory(category, visible);
      console.log(`${category} ${visible ? 'shown' : 'hidden'}`);
    }
  }, [sceneManager]);

  const handleEffectToggle = useCallback((effect: string, enabled: boolean) => {
    console.log(`${effect} ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const handleSectionCutAdd = useCallback((normal: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }) => {
    if (sceneManager) {
      sceneManager.addSectionPlane(new Vector3(normal.x, normal.y, normal.z), new Vector3(point.x, point.y, point.z));
      console.log('Section cut plane added');
    }
  }, [sceneManager]);

  const handleSectionCutRemove = useCallback(() => {
    if (sceneManager) {
      sceneManager.removeSectionPlanes();
      console.log('Section cut planes removed');
    }
  }, [sceneManager]);

  const handleUploadModel = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !sceneManager) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      setUploadProgress(prev => [...prev, {
        file: file.name,
        progress: 0,
        status: 'uploading'
      }]);

      try {
        const result = await sceneManager.loadModel(file);

        setUploadProgress(prev => prev.map(item =>
          item.file === file.name
            ? { ...item, progress: 100, status: 'complete' }
            : item
        ));

        setLoadedModels(prev => [...prev, result]);
        console.log(`Model ${file.name} loaded successfully`);

      } catch (error) {
        console.error('Failed to load model:', error);
        setUploadProgress(prev => prev.map(item =>
          item.file === file.name
            ? { ...item, status: 'error' }
            : item
        ));
        console.error(`Failed to load ${file.name}`);
      }
    }

    event.target.value = '';
  }, [sceneManager]);

  const handleDeleteModel = useCallback((modelId: string) => {
    if (sceneManager) {
      sceneManager.removeModel(modelId);
      setLoadedModels(prev => prev.filter(id => id !== modelId));
      console.log('Model deleted');
    }
  }, [sceneManager]);

  const handleOptimizeScene = useCallback(() => {
    if (sceneManager) {
      sceneManager.optimizeScene();
      console.log('Scene optimized');
    }
  }, [sceneManager]);

  const handleExportScene = useCallback(() => {
    if (sceneManager) {
      const state = sceneManager.exportState();
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene_${workspaceId}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('Scene exported');
    }
  }, [sceneManager, workspaceId]);

  const handleGizmoToggle = useCallback((gizmoType: 'position' | 'rotation' | 'scale', enabled: boolean) => {
    if (sceneManager) {
      switch (gizmoType) {
        case 'position':
          sceneManager.enablePositionGizmo(enabled);
          break;
        case 'rotation':
          sceneManager.enableRotationGizmo(enabled);
          break;
        case 'scale':
          sceneManager.enableScaleGizmo(enabled);
          break;
      }
    }
  }, [sceneManager]);

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <canvas ref={canvasRef} className="w-full h-full outline-none" />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".glb,.gltf,.obj,.stl,.fbx,.3ds"
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload 3D model files"
      />

      {/* Performance HUD */}
      <div className="absolute top-4 right-4 w-64 bg-black/80 text-white border border-gray-600 rounded-lg p-4">
        <h3 className="text-sm font-bold mb-2">Performance</h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>FPS:</span>
            <span className={fps > 45 ? 'text-green-400' : fps > 30 ? 'text-yellow-400' : 'text-red-400'}>
              {fps}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Render Time:</span>
            <span>{renderTime.toFixed(1)}ms</span>
          </div>
          <div className="flex justify-between">
            <span>Models:</span>
            <span>{loadedModels.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Mode:</span>
            <span className="capitalize">{performanceMode}</span>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="absolute bottom-4 right-4 w-80 bg-black/80 text-white border border-gray-600 rounded-lg p-4">
          <h3 className="text-sm font-bold mb-2">Upload Progress</h3>
          <div className="space-y-2">
            {uploadProgress.map((upload, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="truncate">{upload.file}</span>
                  <span className={`capitalize ${
                    upload.status === 'complete' ? 'text-green-400' :
                    upload.status === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {upload.status}
                  </span>
                </div>
                {upload.status !== 'error' && (
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="absolute bottom-4 left-4 w-96 bg-black/80 text-white border border-gray-600 rounded-lg p-4">
        <h3 className="text-sm font-bold mb-3">Scene Controls</h3>

        <div className="mb-3">
          <label className="text-xs font-medium mb-2 block">Transform Gizmos</label>
          <div className="flex gap-2">
            {(['position', 'rotation', 'scale'] as const).map(gizmo => (
              <button
                key={gizmo}
                onClick={() => handleGizmoToggle(gizmo, true)}
                className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 capitalize"
              >
                {gizmo}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleOptimizeScene}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            Optimize
          </button>
          <button
            onClick={handleExportScene}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Export
          </button>
          {isAdmin && (
            <button
              onClick={handleUploadModel}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Upload
            </button>
          )}
        </div>

        <div className="text-xs space-y-1 pt-2 border-t border-gray-600">
          <div className="flex justify-between">
            <span>Navigation:</span>
            <span className="capitalize">{navigationMode}</span>
          </div>
          <div className="flex justify-between">
            <span>Lighting:</span>
            <span className="capitalize">{lightingPreset}</span>
          </div>
          <div className="flex justify-between">
            <span>Selected:</span>
            <span>{selectedObjects.length}</span>
          </div>
        </div>
      </div>

      {!isInitialized && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-black/80 text-white border border-gray-600 rounded-lg p-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Initializing Unified 3D Workspace...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedBabylonWorkspace;