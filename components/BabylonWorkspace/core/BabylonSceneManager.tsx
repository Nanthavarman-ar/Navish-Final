import React, { useEffect, useRef, useCallback } from 'react';
import {
  Engine, Scene, ArcRotateCamera, UniversalCamera, HemisphericLight, DirectionalLight, Vector3, Color3, Color4,
  AbstractMesh, Mesh, Material, StandardMaterial, PBRMaterial, ShadowGenerator, DefaultRenderingPipeline, SSAORenderingPipeline,
  SceneOptimizer, SceneOptimizerOptions, HardwareScalingOptimization, ShadowsOptimization, PostProcessesOptimization,
  LensFlaresOptimization, ParticlesOptimization, RenderTargetsOptimization, MergeMeshesOptimization, GizmoManager,
  UtilityLayerRenderer, PickingInfo, AssetContainer, SceneLoader, ActionManager, HighlightLayer, Plane, PhysicsImpostor,
  CannonJSPlugin, AmmoJSPlugin, OimoJSPlugin
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture, Rectangle, Button as BabylonButton, TextBlock, StackPanel, Control, Slider, Checkbox
} from '@babylonjs/gui';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import { useWorkspace } from './WorkspaceContext';

interface SceneConfig {
  enablePhysics?: boolean;
  enablePostProcessing?: boolean;
  enableSSAO?: boolean;
  enableShadows?: boolean;
  shadowMapSize?: number;
  enableOptimization?: boolean;
  targetFPS?: number;
  physicsEngine?: 'cannon' | 'ammo' | 'oimo';
}

interface BabylonSceneManagerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  config?: SceneConfig;
  onMeshSelect?: (mesh: Mesh) => void;
  onSceneReady?: (scene: Scene, engine: Engine, camera: ArcRotateCamera) => void;
}

export function BabylonSceneManager({
  canvasRef,
  config = {},
  onMeshSelect,
  onSceneReady
}: BabylonSceneManagerProps) {
  const { state, dispatch } = useWorkspace();
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const pipelineRef = useRef<DefaultRenderingPipeline | null>(null);
  const ssaoPipelineRef = useRef<SSAORenderingPipeline | null>(null);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);

  const {
    enablePhysics = false,
    enablePostProcessing = true,
    enableSSAO = false,
    enableShadows = true,
    shadowMapSize = 2048,
    enableOptimization = true,
    targetFPS = 60,
    physicsEngine = 'cannon'
  } = config;

  // Initialize Babylon.js scene
  const initializeScene = useCallback(async () => {
    if (!canvasRef.current) {
      dispatch({ type: 'SET_ERROR', payload: 'Canvas element not found' });
      return;
    }

    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Create engine
      const engine = new Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        disableWebGL2Support: false
      });

      engineRef.current = engine;
      dispatch({ type: 'SET_ENGINE', payload: engine });

      // Create scene
      const scene = new Scene(engine);
      sceneRef.current = scene;
      dispatch({ type: 'SET_SCENE', payload: scene });

      // Create camera
      const camera = new ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        10,
        Vector3.Zero(),
        scene
      );

      camera.attachControl(canvasRef.current, true);
      camera.wheelPrecision = 3.0;
      camera.minZ = 0.1;
      camera.maxZ = 1000;

      cameraRef.current = camera;
      dispatch({ type: 'SET_CAMERA', payload: camera });

      // Create basic lighting
      const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);
      light.intensity = 0.7;

      // Create ground plane
      const ground = Mesh.CreateGround("ground", 10, 10, 2, scene);
      const groundMaterial = new StandardMaterial("groundMaterial", scene);
      groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
      ground.material = groundMaterial;

      // Set up post-processing pipeline
      if (enablePostProcessing) {
        setupPostProcessing(scene, camera);
      }

      // Set up SSAO
      if (enableSSAO) {
        setupSSAO(scene);
      }

      // Set up shadows
      if (enableShadows) {
        setupShadows(scene, shadowMapSize);
      }

      // Set up physics
      if (enablePhysics) {
        await setupPhysics(scene, physicsEngine);
      }

      // Set up optimization
      if (enableOptimization) {
        setupOptimization(scene, targetFPS);
      }

      // Set up interaction
      setupInteraction(scene, camera);

      // Initialize highlight layer
      const highlightLayer = new HighlightLayer("highlightLayer", scene);
      highlightLayerRef.current = highlightLayer;

      // Call onSceneReady callback
      if (onSceneReady) {
        onSceneReady(scene, engine, camera);
      }

      dispatch({ type: 'SET_INITIALIZED', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

    } catch (error) {
      console.error('Failed to initialize Babylon.js scene:', error);
      dispatch({ type: 'SET_ERROR', payload: `Scene initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [canvasRef, config, onMeshSelect, onSceneReady, dispatch]);

  // Set up post-processing pipeline
  const setupPostProcessing = (scene: Scene, camera: ArcRotateCamera) => {
    const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);

    // Configure bloom
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 1.0;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    // Configure depth of field
    pipeline.depthOfFieldEnabled = false;
    pipeline.depthOfField.focusDistance = 10.0;
    pipeline.depthOfField.fStop = 1.4;
    pipeline.depthOfField.focalLength = 50;

    // Configure grain
    pipeline.grainEnabled = false;
    pipeline.grain.intensity = 0.5;

    // Configure vignette
    pipeline.imageProcessing.vignetteEnabled = false;
    pipeline.imageProcessing.vignetteWeight = 0.5;

    pipelineRef.current = pipeline;
  };

  // Set up SSAO
  const setupSSAO = (scene: Scene) => {
    const ssao = new SSAORenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 1 });
    ssao.totalStrength = 1.0;
    ssao.base = 0.5;
    ssao.radius = 0.0001;
    ssao.area = 0.0075;
    ssao.fallOff = 0.000001;
    ssaoPipelineRef.current = ssao;
  };

  // Set up shadows
  const setupShadows = (scene: Scene, shadowMapSize: number) => {
    // Create a directional light for shadows since HemisphericLight doesn't support shadows
    const shadowLight = new DirectionalLight("shadowLight", new Vector3(-1, -1, -1), scene);
    shadowLight.intensity = 0.5;

    const shadowGenerator = new ShadowGenerator(shadowMapSize, shadowLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
  };

  // Set up physics
  const setupPhysics = async (scene: Scene, physicsEngine: string) => {
    let physicsPlugin;

    switch (physicsEngine) {
      case 'cannon':
        physicsPlugin = new CannonJSPlugin();
        break;
      case 'ammo':
        physicsPlugin = new AmmoJSPlugin();
        break;
      case 'oimo':
        physicsPlugin = new OimoJSPlugin();
        break;
      default:
        physicsPlugin = new CannonJSPlugin();
    }

    scene.enablePhysics(new Vector3(0, -9.81, 0), physicsPlugin);
  };

  // Set up optimization
  const setupOptimization = (scene: Scene, targetFPS: number) => {
    const optimizer = new SceneOptimizer(scene, SceneOptimizerOptions.ModerateDegradationAllowed(targetFPS));

    optimizer.start();
  };

  // Set up interaction
  const setupInteraction = (scene: Scene, camera: ArcRotateCamera) => {
    // Handle mesh picking
    scene.onPointerPick = (evt, pickInfo) => {
      if (pickInfo.hit && pickInfo.pickedMesh) {
        const mesh = pickInfo.pickedMesh as Mesh;

        // Highlight the picked mesh
        if (highlightLayerRef.current) {
          highlightLayerRef.current.removeAllMeshes();
          highlightLayerRef.current.addMesh(mesh, Color3.Green());
        }

        dispatch({ type: 'SET_SELECTED_MESH', payload: mesh });

        if (onMeshSelect) {
          onMeshSelect(mesh);
        }
      }
    };

    // Handle pointer move for hover effects
    scene.onPointerMove = (evt, pickInfo) => {
      if (pickInfo.hit && pickInfo.pickedMesh) {
        dispatch({ type: 'SET_HOVERED_MESH', payload: pickInfo.pickedMesh as Mesh });
      } else {
        dispatch({ type: 'SET_HOVERED_MESH', payload: null });
      }
    };
  };

  // Handle window resize
  const handleResize = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resize();
    }
  }, []);

  // Initialize scene on mount
  useEffect(() => {
    initializeScene();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (engineRef.current) {
        engineRef.current.dispose();
      }
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
    };
  }, [initializeScene, handleResize]);

  // Render loop
  useEffect(() => {
    if (!state.engine || !state.scene) return;

    const engine = state.engine;
    const scene = state.scene;

    const renderLoop = () => {
      scene.render();
    };

    engine.runRenderLoop(renderLoop);

    return () => {
      engine.stopRenderLoop(renderLoop);
    };
  }, [state.engine, state.scene]);

  return null; // This component doesn't render anything directly
}

// Hook for accessing scene manager functionality
export function useBabylonScene() {
  const { state } = useWorkspace();

  const getScene = () => state.scene;
  const getEngine = () => state.engine;
  const getCamera = () => state.camera;

  const loadModel = async (url: string, filename: string) => {
    if (!state.scene) throw new Error('Scene not initialized');

    const result = await SceneLoader.ImportMeshAsync("", url, filename, state.scene);
    return result;
  };

  const createMaterial = (name: string, type: 'standard' | 'pbr' = 'standard') => {
    if (!state.scene) throw new Error('Scene not initialized');

    if (type === 'pbr') {
      return new PBRMaterial(name, state.scene);
    } else {
      return new StandardMaterial(name, state.scene);
    }
  };

  return {
    scene: state.scene,
    engine: state.engine,
    camera: state.camera,
    getScene,
    getEngine,
    getCamera,
    loadModel,
    createMaterial,
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    error: state.error,
  };
}
