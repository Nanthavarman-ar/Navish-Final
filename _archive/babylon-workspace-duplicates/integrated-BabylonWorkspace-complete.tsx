import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AIErrorHandler } from './AIErrorHandlerFixed';
import { useRetryUtils } from '../utils/retryUtilsFixed';
import { ErrorHandlingTestSuite } from './ErrorHandlingTestSuiteFixed';
import { NetworkMonitor } from './NetworkMonitor';
import { OfflineFallback } from './OfflineFallback';
import { ErrorBoundary } from './ErrorBoundary';

// Import existing Babylon.js dependencies
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
  Material,
  SceneLoader,
  HighlightLayer,
  Plane,
  ActionManager
} from '@babylonjs/core';

// Import other existing dependencies
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QRCodeTour } from './QRCodeTour';

// Navigation mode interface
interface NavigationMode {
  type: 'walk' | 'orbit' | 'tabletop' | 'fly';
  camera: ArcRotateCamera | UniversalCamera;
}

// Lighting preset interface
interface LightingPreset {
  name: string;
  ambientColor: Color3;
  directionalLight: {
    direction: Vector3;
    intensity: number;
    color: Color3;
  };
}

// Scene configuration interface
interface SceneConfig {
  enablePhysics?: boolean;
  enablePostProcessing?: boolean;
  enableSSAO?: boolean;
  enableShadows?: boolean;
  shadowMapSize?: number;
  enableOptimization?: boolean;
  targetFPS?: number;
  renderingQuality?: 'low' | 'medium' | 'high' | 'ultra';
  performanceMode?: 'performance' | 'balanced' | 'quality';
}

// Annotation type for markups
type Annotation = {
  id: string;
  position: { x: number; y: number; z: number };
  color?: string;
  text?: string
}

interface MaterialSpec {
  type: 'standard' | 'pbr';
  properties: Record<string, any>;
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

interface UICallbacks {
  onNavigationModeChange?: (mode: string) => void;
  onLightingPresetChange?: (preset: string) => void;
  onMaterialChange?: (materialId: string) => void;
  onObjectToggle?: (category: string, visible: boolean) => void;
  onEffectToggle?: (effect: string, enabled: boolean) => void;
  onSectionCutAdd?: (normal: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }) => void;
  onSectionCutRemove?: () => void;
  onUploadModel?: () => void;
  onDeleteModel?: (modelId: string) => void;
}

interface UploadProgress {
  file: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
}

// Integrated Scene Manager Class
class IntegratedSceneManager {
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

  // Section planes for model cutting
  private sectionPlanes: Plane[] = [];
  private sectionPlaneMeshes: Mesh[] = [];

  private loadedModels: Map<string, AssetContainer> = new Map();
  private selectedObjects: Set<AbstractMesh> = new Set();
  private navigationMode: NavigationMode['type'] = 'orbit';
  private currentLightingPreset: string = 'default';

  private config: SceneConfig = {
    enablePhysics: false,
    enablePostProcessing: true,
    enableSSAO: true,
    enableShadows: true,
    shadowMapSize: 1024,
    enableOptimization: true,
    targetFPS: 60
  };

  private frameTimes: number[] = [];
  private lastFpsCheck: number = performance.now();
  private currentFps: number = 60;

  static async create(canvas: HTMLCanvasElement, workspaceId: string, config?: Partial<SceneConfig>): Promise<IntegratedSceneManager> {
    return new IntegratedSceneManager(canvas, config);
  }

  constructor(canvas: HTMLCanvasElement, config?: Partial<SceneConfig>) {
    this.canvas = canvas;
    this.config = { ...this.config, ...config };

    this.initializeEngine();
    this.initializeScene();
    this.initializeCamera();
    this.initializeLighting();
    this.initializePostProcessing();
    this.initializeGizmos();
    this.initializeOptimization();
    this.initializeAssetLoaders();
    this.startRenderLoop();
  }

  private initializeAssetLoaders(): void {
    if ((window as any).BABYLON && (window as any).BABYLON.DracoCompression) {
      (window as any).BABYLON.DracoCompression.Configuration = {
        decoder: {
          wasmUrl: '/draco/draco_wasm_wrapper.js',
          wasmBinaryUrl: '/draco/draco_decoder.wasm',
          fallbackUrl: '/draco/draco_decoder.js'
        }
      };
    }
    if ((window as any).BABYLON && (window as any).BABYLON.BasisTextureLoader) {
      (window as any).BABYLON.BasisTextureLoader.GetTranscoderUrl = () => '/basis/basis_transcoder.js';
    }
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

    window.addEventListener('resize', () => {
      this.engine.resize();
    });
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
    this.camera = new ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 4,
      10,
      Vector3.Zero(),
      this.scene
    );

    this.camera.attachControl(this.canvas, true);
    this.camera.setTarget(Vector3.Zero());

    (this.camera as ArcRotateCamera).lowerRadiusLimit = 1;
    (this.camera as ArcRotateCamera).upperRadiusLimit = 100;
    (this.camera as ArcRotateCamera).lowerBetaLimit = 0.1;
    (this.camera as ArcRotateCamera).upperBetaLimit = Math.PI - 0.1;
  }

  private initializeLighting(): void {
    const hemisphericLight = new HemisphericLight(
      'hemisphericLight',
      new Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.intensity = 0.6;
    hemisphericLight.diffuse = new Color3(1, 1, 1);
    hemisphericLight.specular = new Color3(0.2, 0.2, 0.2);

    const directionalLight = new DirectionalLight(
      'directionalLight',
      new Vector3(-1, -1, -1),
      this.scene
    );
    directionalLight.intensity = 1.0;
    directionalLight.diffuse = new Color3(1, 1, 1);
    directionalLight.specular = new Color3(1, 1, 1);

    if (this.config.enableShadows) {
      this.shadowGenerator = new ShadowGenerator(
        this.config.shadowMapSize || 1024,
        directionalLight
      );
      this.shadowGenerator.useExponentialShadowMap = true;
      this.shadowGenerator.useKernelBlur = true;
      this.shadowGenerator.blurKernel = 64;
    }
  }

  private initializePostProcessing(): void {
    if (!this.config.enablePostProcessing) return;

    this.renderPipeline = new DefaultRenderingPipeline(
      'defaultPipeline',
      true,
      this.scene,
      [this.camera]
    );

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
      this.ssaoPipeline = new SSAORenderingPipeline(
        'ssao',
        this.scene,
        0.75,
        [this.camera]
      );
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
    this.engine.runRenderLoop(() => {
      const start = performance.now();
      this.scene.render();
      const end = performance.now();
      this.frameTimes.push(end - start);

      if (end - this.lastFpsCheck > 1000) {
        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.currentFps = Math.round(1000 / avgFrameTime);
        this.frameTimes = [];
        this.lastFpsCheck = end;

        if (this.currentFps < (this.config.targetFPS || 60)) {
          this.engine.setHardwareScalingLevel(Math.min(this.engine.getHardwareScalingLevel() + 0.1, 2));
          if (this.renderPipeline) {
            this.renderPipeline.bloomEnabled = false;
            this.renderPipeline.fxaaEnabled = false;
          }
          if (this.ssaoPipeline) {
            this.ssaoPipeline.dispose();
            this.ssaoPipeline = null;
          }
        } else {
          this.engine.setHardwareScalingLevel(Math.max(this.engine.getHardwareScalingLevel() - 0.05, 1));
          if (this.renderPipeline) {
            this.renderPipeline.bloomEnabled = true;
            this.renderPipeline.fxaaEnabled = true;
          }
          if (!this.ssaoPipeline && this.config.enableSSAO) {
            this.ssaoPipeline = new SSAORenderingPipeline(
              'ssao',
              this.scene,
              0.75,
              [this.camera]
            );
            this.ssaoPipeline.fallOff = 0.000001;
            this.ssaoPipeline.area = 1;
            this.ssaoPipeline.radius = 0.0001;
            this.ssaoPipeline.totalStrength = 1.0;
            this.ssaoPipeline.base = 0.5;
          }
        }
      }
    });
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

  public async loadModel(file: File | string): Promise<string> {
    const modelId = `model_${Date.now()}`;

    try {
      let url: string;

      if (typeof file === 'string') {
        url = file;
      } else {
        url = URL.createObjectURL(file);
      }

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

      if (typeof file !== 'string') {
        URL.revokeObjectURL(url);
      }

      return modelId;
    } catch (error) {
      console.error('Failed to load model:', error);
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

  public selectObject(id: string): boolean {
    const mesh = this.scene.getMeshById(id);
    if (!mesh) return false;

    this.selectedObjects.clear();
    this.selectedObjects.add(mesh);
    this.addSelectionOutline(mesh);

    if (this.gizmoManager) {
      this.gizmoManager.attachToMesh(mesh);
    }

    return true;
  }

  public setMaterial(target: string, materialSpec: MaterialSpec): boolean {
    const mesh = this.scene.getMeshById(target);
    if (!mesh) return false;

    let material;

    if (materialSpec.type === 'pbr') {
      material = new PBRMaterial(`material_${Date.now()}`, this.scene);
      Object.assign(material, materialSpec.properties);
    } else {
      material = new StandardMaterial(`material_${Date.now()}`, this.scene);
      Object.assign(material, materialSpec.properties);
    }

    mesh.material = material;
    return true;
  }

  public applyLightingPreset(name: string): boolean {
    const presets: Record<string, LightingPreset> = {
      day: {
        name: 'Day',
        ambientColor: new Color3(0.8, 0.8, 0.9),
        directionalLight: {
          direction: new Vector3(-0.3, -0.8, -0.5),
          intensity: 1.2,
          color: new Color3(1, 0.95, 0.8)
        }
      },
      night: {
        name: 'Night',
        ambientColor: new Color3(0.1, 0.1, 0.2),
        directionalLight: {
          direction: new Vector3(0, -0.5, 0),
          intensity: 0.3,
          color: new Color3(0.5, 0.5, 0.7)
        }
      },
      interior: {
        name: 'Interior',
        ambientColor: new Color3(0.4, 0.4, 0.4),
        directionalLight: {
          direction: new Vector3(0, -1, 0),
          intensity: 0.8,
          color: new Color3(1, 1, 1)
        }
      }
    };

    const preset = presets[name];
    if (!preset) return false;

    this.scene.ambientColor = preset.ambientColor;

    const directionalLight = this.scene.lights.find(
      light => light instanceof DirectionalLight
    ) as DirectionalLight;

    if (directionalLight) {
      directionalLight.direction = preset.directionalLight.direction;
      directionalLight.intensity = preset.directionalLight.intensity;
      directionalLight.diffuse = preset.directionalLight.color;
    }

    this.currentLightingPreset = name;
    return true;
  }

  public setNavigationMode(mode: NavigationMode['type']): boolean {
    if (this.navigationMode === mode) return true;

    const currentPosition = this.camera.position.clone();
    const currentTarget = this.camera instanceof ArcRotateCamera
      ? this.camera.target.clone()
      : this.camera.position.add(this.camera.getForwardRay().direction);

    this.camera.dispose();

    switch (mode) {
      case 'orbit':
        this.camera = new ArcRotateCamera(
          'orbitCamera',
          0,
          Math.PI / 4,
          Vector3.Distance(currentPosition, currentTarget),
          currentTarget,
          this.scene
        );
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
        this.camera = new ArcRotateCamera(
          'tabletopCamera',
          0,
          Math.PI / 6,
          20,
          Vector3.Zero(),
          this.scene
        );
        this.camera.attachControl(this.canvas, true);
        (this.camera as ArcRotateCamera).lowerBetaLimit = 0;
        (this.camera as ArcRotateCamera).upperBetaLimit = Math.PI / 2;
        break;
    }

    this.navigationMode = mode;
    return true;
  }

  public toggleCategory(category: string, visible: boolean): boolean {
    const meshes = this.scene.meshes.filter(mesh =>
      mesh.metadata?.category === category
    );

    meshes.forEach(mesh => {
      mesh.setEnabled(visible);
    });

    return meshes.length > 0;
  }

  public optimizeScene(): void {
    const meshesToMerge = this.scene.meshes.filter(mesh =>
      mesh instanceof Mesh && mesh.material && !mesh.skeleton
    ) as Mesh[];

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
      cameraTarget: this.camera instanceof ArcRotateCamera
        ? this.camera.target.asArray()
        : [0, 0, 0],
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
    meshes.forEach(mesh => {
      mesh.position.subtractInPlace(center);
    });

    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);

    if (maxDimension > 10) {
      const scale = 10 / maxDimension;
      meshes.forEach(mesh => {
        mesh.scaling.scaleInPlace(scale);
      });
    }
  }

  public enablePositionGizmo(enabled: boolean): void {
    if (this.gizmoManager) {
      this.gizmoManager.positionGizmoEnabled = enabled;
    }
  }

  public enableRotationGizmo(enabled: boolean): void {
    if (this.gizmoManager) {
      this.gizmoManager.rotationGizmoEnabled = enabled;
    }
  }

  public enableScaleGizmo(enabled: boolean): void {
    if (this.gizmoManager) {
      this.gizmoManager.scaleGizmoEnabled = enabled;
    }
  }

  public getEngine(): Engine {
    return this.engine;
  }

  public getScene(): Scene {
    return this.scene;
  }

  public getCamera(): ArcRotateCamera | UniversalCamera {
    return this.camera;
  }

  public getSelectedObjects(): AbstractMesh[] {
    return Array.from(this.selectedObjects);
  }

  public getLoadedModels(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  public addSectionPlane(normal: Vector3, point: Vector3): void {
    const plane = Plane.FromPositionAndNormal(point, normal);
    this.sectionPlanes.push(plane);

    this.updateClippingPlanes();

    const planeMesh = Mesh.CreatePlane(`sectionPlane_${this.sectionPlanes.length}`, 10, this.scene, false);
    planeMesh.position = point;
    planeMesh.rotation = new Vector3(
      Math.acos(normal.y) - Math.PI / 2,
      Math.atan2(normal.x, normal.z),
      0
    );
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

    this.sectionPlaneMeshes.forEach(mesh => {
      mesh.dispose();
    });
    this.sectionPlaneMeshes = [];
  }

  private updateClippingPlanes(): void {
    this.scene.clipPlane = null;
    this.scene.clipPlane2 = null;
    this.scene.clipPlane3 = null;
    this.scene.clipPlane4 = null;
    this.scene.clipPlane5 = null;
    this.scene.clipPlane6 = null;

    if (this.sectionPlanes.length === 0) {
      return;
    }

    const planesToApply = this.sectionPlanes.slice(0, 6);

    planesToApply.forEach((plane, index) => {
      const clipPlaneProperty = index === 0 ? 'clipPlane' : `clipPlane${index + 1}`;
      (this.scene as any)[clipPlaneProperty] = plane;
    });
  }

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

// Main Integrated Babylon Workspace Component with Error Handling
interface BabylonWorkspaceProps {
  workspaceId: string;
  isAdmin?: boolean;
  layoutMode?: 'standard' | 'compact' | 'immersive' | 'split';
  performanceMode?: 'low' | 'medium' | 'high';
  enablePhysics?: boolean;
  enableXR?: boolean;
  xrOptions?: {
    immersive?: boolean;
    onSessionStart?: () => void;
    onSessionEnd?: () => void;
  };
  enableSpatialAudio?: boolean;
  renderingQuality?: 'low' | 'medium' | 'high' | 'ultra';
  onMeshSelect?: (mesh: any) => void;
  onAnimationCreate?: (animation: any) => void;
  onMaterialChange?: (material: Material) => void;
}

const BabylonWorkspaceWithErrorHandling: React.FC<BabylonWorkspaceProps> = (props) => {
  const { workspaceId, isAdmin = false, layoutMode = 'standard', enableXR = false, xrOptions = {}, enablePhysics, renderingQuality, performanceMode: propPerformanceMode } = props;

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xrHelperRef = useRef<any>(null);

  // State
  const [sceneManager, setSceneManager] = useState<IntegratedSceneManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadedModels, setLoadedModels] = useState<string[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
  const [navigationMode, setNavigationMode] = useState<string>('orbit');
  const [lightingPreset, setLightingPreset] = useState<string>('day');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [performanceMode, setPerformanceMode] = useState<'performance' | 'balanced' | 'quality'>('balanced');
  const [splitPanelSizes, setSplitPanelSizes] = useState([50, 50]);
  const [activeSplitView, setActiveSplitView] = useState<'scene' | 'properties'>('scene');
  const [fps, setFps] = useState(60);
  const [renderTime, setRenderTime] = useState(0);
  const [xrSessionActive, setXRSessionActive] = useState(false);

  // Collaboration WebSocket
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [collabUsers, setCollabUsers] = useState<{id: string; name: string}[]>([]);
  const [collabStatus, setCollabStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

  // Annotation & Markup State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

  // Error handling state
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    error: Error | null;
    errorInfo: any;
  }>({
    hasError: false,
    error: null,
    errorInfo: null
  });

  // Retry utilities
  const { retryWithBackoff, isRetrying } = useRetryUtils({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000
  });

  // Network state
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Enhanced error handler
  const handleError = useCallback((error: Error, errorInfo?: any) => {
    console.error('BabylonWorkspace Error:', error, errorInfo);
    setErrorState({
      hasError: true,
      error,
      errorInfo
    });
  }, []);

  // Retry handler for failed operations
  const handleRetry = useCallback(async (operation: () => Promise<any>) => {
    try {
      await retryWithBackoff(operation);
      setErrorState({ hasError: false, error: null, errorInfo: null });
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      handleError(retryError as Error);
    }
  }, [retryWithBackoff, handleError]);

  // Network monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If offline, show offline fallback
  if (!isOnline) {
    return (
      <OfflineFallback
        onRetry={() => window.location.reload()}
        message="3D workspace is currently offline. Please check your connection."
      />
    );
  }

  // If there's an error, show error handler
  if (errorState.hasError) {
    return (
      <AIErrorHandler
        error={errorState.error!}
        errorInfo={errorState.errorInfo}
        onRetry={() => handleRetry(() => Promise.resolve())}
        context="BabylonWorkspace"
      />
    );
  }

  // Annotation handlers
  const handleAddAnnotation = useCallback((position: { x: number; y: number; z: number }) => {
    const newAnnotation: Annotation = {
      id: `annotation_${Date.now()}`,
      position,
      color: '#FFD700',
      text: ''
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setActiveAnnotation(newAnnotation);
    setShowAnnotationPanel(true);
  }, []);

  const handleSaveAnnotation = useCallback((text: string) => {
    if (activeAnnotation) {
      setAnnotations(prev => prev.map(a =>
        a.id === activeAnnotation.id ? { ...a, text } : a
      ));
      setActiveAnnotation(null);
      setShowAnnotationPanel(false);
    }
  }, [activeAnnotation]);

  // Enhanced Firebase operations with retry logic
  const saveTourWithRetry = useCallback(async (tour: any) => {
    const operation = async () => {
      await addDoc(collection(db, 'tours'), tour);
    };

    try {
      await handleRetry(operation);
    } catch (error) {
      handleError(new Error(`Failed to save tour: ${error}`));
    }
  }, [handleRetry, handleError]);

  const loadToursWithRetry = useCallback(async () => {
    const operation = async () => {
      const querySnapshot = await getDocs(collection(db, 'tours'));
      return querySnapshot.docs.map(doc => doc.data());
    };

    try {
      return await handleRetry(operation);
    } catch (error) {
      handleError(new Error(`Failed to load tours: ${error}`));
      return [];
    }
  }, [handleRetry, handleError]);

  // Enhanced model loading with retry logic
  const loadModelWithRetry = useCallback(async (file: File | string) => {
    const operation = async () => {
      if (!sceneManager) throw new Error('Scene manager not initialized');

      return await sceneManager.loadModel(file);
    };

    try {
      const modelId = await handleRetry(operation);
      setLoadedModels(prev => [...prev, modelId]);
      return modelId;
    } catch (error) {
      handleError(new Error(`Failed to load model: ${error}`));
      return null;
    }
  }, [sceneManager, handleRetry, handleError]);

  // Enhanced collaboration with error handling
  const setupCollaborationWithRetry = useCallback(async () => {
    const operation = async () => {
      const url = `wss://your-collab-server.example/ws/${workspaceId}`;
      const socket = new WebSocket(url);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        socket.onopen = () => {
          clearTimeout(timeout);
          socket.send(JSON.stringify({
            type: 'join',
            workspaceId,
            user: { name: 'User_' + Math.floor(Math.random() * 1000) }
          }));
          resolve(socket);
        };

        socket.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    };

    try {
      const socket = await handleRetry(operation);
      setWs(socket as WebSocket);
      setCollabStatus('connected');
    } catch (error) {
      handleError(new Error(`Failed to connect to collaboration: ${error}`));
      setCollabStatus('disconnected');
    }
  }, [workspaceId, handleRetry, handleError]);

  // Event handlers
  const handleNavigationModeChange = useCallback((mode: string) => {
    if (sceneManager) {
      sceneManager.setNavigationMode(mode as NavigationMode['type']);
      setNavigationMode(mode);
    }
  }, [sceneManager]);

  const handleLightingPresetChange = useCallback((preset: string) => {
    if (sceneManager) {
      sceneManager.applyLightingPreset(preset);
      setLightingPreset(preset);
    }
  }, [sceneManager]);

  const handleMaterialChange = useCallback((materialId: string) => {
    if (sceneManager && selectedObjects.length > 0) {
      selectedObjects.forEach(objectId => {
        sceneManager.setMaterial(objectId, {
          type: 'pbr',
          properties: {}
        });
      });
    }
  }, [sceneManager, selectedObjects]);

  const handleObjectToggle = useCallback((category: string, visible: boolean) => {
    if (sceneManager) {
      sceneManager.toggleCategory(category, visible);
    }
  }, [sceneManager]);

  const handleEffectToggle = useCallback((effect: string, enabled: boolean) => {
    console.log(`${effect} ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const handleSectionCutAdd = useCallback((normal: { x: number; y: number; z: number }, point: { x: number; y: number; z: number }) => {
    if (sceneManager) {
      sceneManager.addSectionPlane(
        new Vector3(normal.x, normal.y, normal.z),
        new Vector3(point.x, point.y, point.z)
      );
    }
  }, [sceneManager]);

  const handleSectionCutRemove = useCallback(() => {
    if (sceneManager) {
      sceneManager.removeSectionPlanes();
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
      const uploadId = `upload_${Date.now()}_${i}`;

      setUploadProgress(prev => [...prev, {
        file: file.name,
        progress: 0,
        status: 'uploading'
      }]);

      try {
        await loadModelWithRetry(file);

        setUploadProgress(prev => prev.map(item =>
          item.file === file.name
            ? { ...item, progress: 100, status: 'complete' }
            : item
        ));

      } catch (error) {
        setUploadProgress(prev => prev.map(item =>
          item.file === file.name
            ? { ...item, status: 'error' }
            : item
        ));
      }
    }

    event.target.value = '';
  }, [sceneManager, loadModelWithRetry]);

  const handleDeleteModel = useCallback((modelId: string) => {
    if (sceneManager) {
      sceneManager.removeModel(modelId);
      setLoadedModels(prev => prev.filter(id => id !== modelId));
    }
  }, [sceneManager]);

  const handleOptimizeScene = useCallback(() => {
    if (sceneManager) {
      sceneManager.optimizeScene();
    }
  }, [sceneManager
