import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, Mesh, StandardMaterial, Color3, Vector3,
  DefaultRenderingPipeline, SSAORenderingPipeline
} from '@babylonjs/core';
import { showToast } from './utils/toast';
import { DeviceDetector } from './DeviceDetector';
import { FeatureManager } from './FeatureManager';
import { AnalyticsManager } from './AnalyticsManager';
import { AnimationManager } from './AnimationManager';
import { SyncManager } from './SyncManager';
import { MaterialManager } from './MaterialManager';
import { AudioManager } from './AudioManager';
import { BIMManager } from './BIMManager';
import { IoTManager } from './IoTManager';
import { CloudAnchorManager } from './CloudAnchorManager';
import { ARCloudAnchors } from './ARCloudAnchors';
import { GPSTransformUtils } from './GPSTransformUtils';
import { CollabManager } from './CollabManager';
import { XRManager } from './XRManager';

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

interface SceneRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  enablePostProcessing: boolean;
  enableBloom: boolean;
  bloomIntensity: number;
  enableDepthOfField: boolean;
  depthOfFieldFocusDistance: number;
  enableGrain: boolean;
  grainIntensity: number;
  enableVignette: boolean;
  vignetteIntensity: number;
  enableSSAO: boolean;
  ssaoIntensity: number;
  onSceneReady?: (scene: Scene) => void;
  onEngineReady?: (engine: Engine) => void;
  onError?: (error: Error) => void;
  enableSpatialAudio?: boolean;
}

const SceneRenderer: React.FC<SceneRendererProps> = ({
  canvasRef,
  enablePostProcessing,
  enableBloom,
  bloomIntensity,
  enableDepthOfField,
  depthOfFieldFocusDistance,
  enableGrain,
  grainIntensity,
  enableVignette,
  vignetteIntensity,
  enableSSAO,
  ssaoIntensity,
  onSceneReady,
  onEngineReady,
  onError,
  enableSpatialAudio = false
}) => {
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const pipelineRef = useRef<DefaultRenderingPipeline | null>(null);
  const ssaoPipelineRef = useRef<SSAORenderingPipeline | null>(null);

  // Manager refs
  const analyticsManagerRef = useRef<AnalyticsManager | null>(null);
  const featureManagerRef = useRef<FeatureManager | null>(null);
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const syncManagerRef = useRef<SyncManager | null>(null);
  const materialManagerRef = useRef<MaterialManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const bimManagerRef = useRef<BIMManager | null>(null);
  const iotManagerRef = useRef<IoTManager | null>(null);
  const cloudAnchorManagerRef = useRef<CloudAnchorManager | null>(null);
  const collabManagerRef = useRef<CollabManager | null>(null);
  const xrManagerRef = useRef<XRManager | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const engine = new Engine(canvasRef.current, true);
      engineRef.current = engine;
      onEngineReady && onEngineReady(engine);
    } catch (error) {
      onError && onError(error as Error);
      showToast.error('Failed to initialize 3D workspace. WebGL may not be supported.');
      return;
    }

    const scene = new Scene(engineRef.current!);
    sceneRef.current = scene;

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);
    cameraRef.current = camera;

    const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);
    light.intensity = 0.7;

    const ground = Mesh.CreateGround("ground", 10, 10, 2);
    const groundMaterial = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
    ground.material = groundMaterial;

    if (enablePostProcessing) {
      const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
      pipeline.bloomEnabled = enableBloom;
      if (enableBloom) {
        pipeline.bloomThreshold = 0.8;
        pipeline.bloomWeight = bloomIntensity;
        pipeline.bloomKernel = 64;
        pipeline.bloomScale = 0.5;
      }
      pipeline.depthOfFieldEnabled = enableDepthOfField;
      if (enableDepthOfField) {
        pipeline.depthOfField.focusDistance = depthOfFieldFocusDistance;
        pipeline.depthOfField.fStop = 1.4;
        pipeline.depthOfField.focalLength = 50;
      }
      pipeline.grainEnabled = enableGrain;
      if (enableGrain) {
        pipeline.grain.intensity = grainIntensity;
      }
      pipeline.imageProcessing.vignetteEnabled = enableVignette;
      if (enableVignette) {
        pipeline.imageProcessing.vignetteWeight = vignetteIntensity;
      }
      pipelineRef.current = pipeline;
    }

    if (enableSSAO) {
      const ssao = new SSAORenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 1 });
      ssao.totalStrength = ssaoIntensity;
      ssao.base = 0.5;
      ssao.radius = 0.0001;
      ssao.area = 0.0075;
      ssao.fallOff = 0.000001;
      ssaoPipelineRef.current = ssao;
    }

    // Device capabilities detection
    const deviceDetector = DeviceDetector.getInstance();
    const detectedCapabilities = deviceDetector.detectCapabilities();
    if (detectedCapabilities instanceof Promise) {
      detectedCapabilities.then(capabilities => {
        featureManagerRef.current = new FeatureManager(capabilities);
      });
    } else {
      featureManagerRef.current = new FeatureManager(detectedCapabilities);
    }

    analyticsManagerRef.current = new AnalyticsManager(engineRef.current!, scene, featureManagerRef.current!);
    materialManagerRef.current = new MaterialManager(scene);

    const userId = 'local-user'; // TODO: dynamic user id
    syncManagerRef.current = new SyncManager(null, scene, userId);
    animationManagerRef.current = new AnimationManager(scene, syncManagerRef.current);

    if (enableSpatialAudio) {
      audioManagerRef.current = new AudioManager(scene);
    }

    // Initialize other managers as needed...

    if (engineRef.current) {
      engineRef.current.runRenderLoop(() => {
        scene.render();
        // Update audio manager if exists
        if (audioManagerRef.current) {
          // audioManagerRef.current.update();
        }
      });
    }

    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);

    onSceneReady && onSceneReady(scene);

    return () => {
      window.removeEventListener('resize', handleResize);
      analyticsManagerRef.current?.dispose();
      animationManagerRef.current?.dispose();
      syncManagerRef.current?.dispose();
      scene.dispose();
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, [
    canvasRef,
    enablePostProcessing,
    enableBloom,
    bloomIntensity,
    enableDepthOfField,
    depthOfFieldFocusDistance,
    enableGrain,
    grainIntensity,
    enableVignette,
    vignetteIntensity,
    enableSSAO,
    ssaoIntensity,
    enableSpatialAudio,
    onSceneReady,
    onEngineReady,
    onError
  ]);

  return null;
};

export default SceneRenderer;
