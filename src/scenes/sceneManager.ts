import {
  FreeCamera,
  RenderTargetTexture,
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
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';

export interface SceneConfig {
  enablePhysics?: boolean;
  enablePostProcessing?: boolean;
  enableSSAO?: boolean;
  enableShadows?: boolean;
  shadowMapSize?: number;
  enableOptimization?: boolean;
  targetFPS?: number;
}

export interface NavigationMode {
  type: 'walk' | 'orbit' | 'tabletop' | 'fly';
  camera: ArcRotateCamera | UniversalCamera;
}

export interface LightingPreset {
  name: string;
  ambientColor: Color3;
  directionalLight: {
    direction: Vector3;
    intensity: number;
    color: Color3;
  };
}

export interface MaterialSpec {
  type: 'standard' | 'pbr';
  properties: Record<string, any>;
}

export class SceneManager {
  /**
   * Record a video of the scene from the canvas and export as a webm/mp4 file.
   * duration: seconds to record
   * mimeType: video format (e.g., 'video/webm')
   */
  public async exportVideo(duration: number = 10, mimeType: string = 'video/webm'): Promise<Blob> {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) throw new Error('No rendering canvas found');

    // Set up MediaRecorder
    const stream = (canvas as HTMLCanvasElement).captureStream();
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.start();

    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    recorder.stop();

    // Wait for recorder to finish
    await new Promise(resolve => {
      recorder.onstop = resolve;
    });

    // Combine chunks into a single Blob
    return new Blob(chunks, { type: mimeType });
  }
  /**
   * Export a panorama image from the current camera view.
   * Returns a base64 PNG string of the rendered view.
   */
  public async exportPanorama360(resolution: number = 2048): Promise<string[]> {
    // Create a temporary camera at the current camera position
    const position = this.camera.position.clone();
    const panoramaCamera = new FreeCamera('panoramaCamera', position, this.scene);
    panoramaCamera.fov = Math.PI / 2;
    panoramaCamera.minZ = 0.1;
    panoramaCamera.maxZ = 1000;

    // Create a render target texture
    const renderTarget = new RenderTargetTexture('panorama', resolution, this.scene, false);
    renderTarget.renderList = this.scene.meshes;
    renderTarget.activeCamera = panoramaCamera;

    // Render the scene to the texture
    this.scene.customRenderTargets.push(renderTarget);
    renderTarget.render();

    // Read pixels from the render target
    const data = await renderTarget.readPixels();
    const width = renderTarget.getSize().width;
    const height = renderTarget.getSize().height;

    // Create a canvas and put the pixel data
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    let base64Image = '';
    if (ctx && data) {
      const imageData = ctx.createImageData(width, height);
      // Convert ArrayBufferView to Uint8ClampedArray for canvas
      let pixelArray: Uint8ClampedArray;
      if (data instanceof Uint8ClampedArray) {
        pixelArray = data;
      } else if ('buffer' in data) {
        pixelArray = new Uint8ClampedArray(data.buffer);
      } else {
        pixelArray = new Uint8ClampedArray(data);
      }
      imageData.data.set(pixelArray);
      ctx.putImageData(imageData, 0, 0);
      base64Image = canvas.toDataURL('image/png');
    }

    // Remove the temporary render target
    this.scene.customRenderTargets.pop();
    panoramaCamera.dispose();
    return [base64Image];
  }
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

  constructor(canvas: HTMLCanvasElement, config?: Partial<SceneConfig>) {
    this.canvas = canvas;
    this.config = { ...this.config, ...config };

    this.initializeEngine();
    this.initializeScene();
    this.initializeCamera();
  // Removed call to undefined initializeLighting()
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

    // Enable clipping planes support
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
      20,
      new Vector3(0, 0, 0),
      this.scene
    );
    this.camera.attachControl(this.canvas, true);

    if (this.config.enableShadows) {
      const directionalLight = this.scene.lights.find(
        light => light instanceof DirectionalLight
      ) as DirectionalLight;
      if (directionalLight) {
        this.shadowGenerator = new ShadowGenerator(
          this.config.shadowMapSize || 1024,
          directionalLight
        );
        this.shadowGenerator.useExponentialShadowMap = true;
        this.shadowGenerator.useKernelBlur = true;
        this.shadowGenerator.blurKernel = 64;
      }
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
      this.scene.render();
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
      // Note: ISceneLoaderAsyncResult doesn't directly expose materials/textures
      // They are managed by the scene automatically

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

    // Remove section planes related to this model
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

  /**
   * Export a 360° panorama image from the current camera view.
   * Returns an array of base64 PNG strings for the 6 cubemap faces.
   */
  // ...existing code...

  // Section Cut Methods

  public addSectionPlane(normal: Vector3, point: Vector3): void {
    const plane = Plane.FromPositionAndNormal(point, normal);
    this.sectionPlanes.push(plane);

    // Apply clipping planes to all meshes
    this.updateClippingPlanes();

    // Optional: visualize the plane in the scene
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
    // Reset all clip planes on the scene
    this.scene.clipPlane = null;
    this.scene.clipPlane2 = null;
    this.scene.clipPlane3 = null;
    this.scene.clipPlane4 = null;
    this.scene.clipPlane5 = null;
    this.scene.clipPlane6 = null;

    if (this.sectionPlanes.length === 0) {
      return;
    }

    // Babylon.js supports up to 6 clip planes on the scene
    const planesToApply = this.sectionPlanes.slice(0, 6);

    planesToApply.forEach((plane, index) => {
      const clipPlaneProperty = index === 0 ? 'clipPlane' : `clipPlane${index + 1}`;
      (this.scene as any)[clipPlaneProperty] = plane;
    });
  }
}
