import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import './BabylonWorkspace.css';

// Babylon.js imports
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

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

// Extracted Feature Components
import { CameraControls } from './features/CameraControlsFinal';
import { LightingControls } from './features/LightingControlsFinal';
import { PhysicsControls } from './features/PhysicsControlsFixed';
import { AnimationControls } from './features/AnimationControlsFixed';

// Core Components
import { WorkspaceContext, useWorkspace } from './core/WorkspaceContextFixed';
import { BabylonSceneManager } from './core/BabylonSceneManager';
import { FeatureManager } from './core/FeatureManager';

// UI Components
import { WorkspaceLayout } from './ui/WorkspaceLayout';
import { TopBar } from './ui/TopBar';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';
import { BottomPanel } from './ui/BottomPanel';

// Feature Categories Configuration
import { featureCategoriesArray, FEATURE_CATEGORIES, Feature } from '../../config/featureCategories';

// Additional UI Components
import MaterialEditor from '../MaterialEditor';
import Minimap from '../Minimap';
import MeasureTool from '../MeasureTool';
import AutoFurnish from '../AutoFurnish';
import AICoDesigner from '../AICoDesigner';
import MoodScenePanel from '../MoodScenePanel';
import SeasonalDecorPanel from '../SeasonalDecorPanel';
import ARScalePanel from '../ARScalePanel';
import Annotations from '../Annotations';
import ARAnchorUI from '../ARAnchorUI';
import ARCameraView from '../ARCameraView';
import { ARCloudAnchors } from '../ARCloudAnchors';
import { CloudAnchorManager } from '../CloudAnchorManager';
import { GPSTransformUtils } from '../GPSTransformUtils';
import ScenarioPanel from '../ScenarioPanel';
import FloatingToolbar from '../FloatingToolbar';
import AIStructuralAdvisor from '../AIStructuralAdvisor';
import { AnimationTimeline } from '../AnimationTimeline';

// Additional Components for Integration
import MovementControlChecker from '../MovementControlChecker';
import MultiSensoryPreview from '../MultiSensoryPreview';
import NoiseSimulation from '../NoiseSimulation';
import PathTracing from '../PathTracing';
import { PHashIntegration } from '../PHashIntegration';
import PrefabModulePreview from '../PrefabModulePreview';
import { PresentationManager } from '../PresentationManager';
import PresenterMode from '../PresenterMode';
import { ProgressiveLoader } from '../ProgressiveLoader';
import PropertyInspector from '../PropertyInspector';
import { QuantumSimulationInterface } from '../QuantumSimulationInterface';
import SceneBrowser from '../SceneBrowser';
import * as Simulations from '../Simulations';
import SiteContextGenerator from '../SiteContextGenerator';
import SmartAlternatives from '../SmartAlternatives';
import SoundPrivacySimulation from '../SoundPrivacySimulation';
import SunlightAnalysis from '../SunlightAnalysis';
import SustainabilityCompliancePanel from '../SustainabilityCompliancePanel';
import { SwimMode } from '../SwimMode';

// Geo-Location Components
import GeoLocationContext from '../GeoLocationContext';
import GeoWorkspaceArea from '../GeoWorkspaceArea';
import { GeoSyncManager } from '../GeoSyncManager';

// Specialized Components for Enhancement
import CameraViews from '../CameraViews';
import CirculationFlowSimulation from '../CirculationFlowSimulation';
import { CollabManager } from '../CollabManager';
import ComprehensiveSimulation from '../ComprehensiveSimulation';
import ConstructionOverlay from '../ConstructionOverlay';
import FloodSimulation from '../FloodSimulation';
import ShadowImpactAnalysis from '../ShadowImpactAnalysis';
import TrafficParkingSimulation from '../TrafficParkingSimulation';

// Manager Components
import { SeasonalDecorManager } from '../managers/SeasonalDecorManager';
import { ARScaleManager } from '../managers/ARScaleManager';
import { BeforeAfterManager } from '../managers/BeforeAfterManager';
import { ComparativeTourManager } from '../managers/ComparativeTourManager';
import { FurnitureManager } from '../managers/FurnitureManager';
import { MoodSceneManager } from '../managers/MoodSceneManager';
import { ROICalculatorManager } from '../managers/ROICalculatorManager';
import { ScenarioManager } from '../managers/ScenarioManager';
import { BIMManager } from '../BIMManager';
import { AnalyticsManager } from '../AnalyticsManager';
import { IoTManager } from '../IoTManager';

// Additional Manager Components for Integration
import { AnimationManager } from '../AnimationManager';
import { SyncManager } from '../SyncManager';
import { MaterialManager } from '../MaterialManager';
import { AudioManager } from '../AudioManager';
import { PostProcessingManager } from '../PostProcessingManager';
import { PhysicsManager } from '../PhysicsManager';
import { XRManager } from '../XRManager';
import BIMIntegration from '../BIMIntegration';

// Device and Feature Enhancement Components
import { DeviceDetector } from '../DeviceDetector';
import EnergyDashboard from '../EnergyDashboard';

// Enhanced Real-Time Components
import { WetMaterialManager } from '../WetMaterialManager';
import WindTunnelSimulation from '../WindTunnelSimulation';
import { UnderwaterMode } from '../UnderwaterMode';
import { WaterShader } from '../WaterShader';
import VoiceChat from '../VoiceChat';
import VRARMode from '../VRARMode';

// Icons
import {
  Activity, Bell, Box, Brain, Camera, Car, CloudSnow, Compass, Construction, DollarSign, Download,
  Droplet, Edit, Eye, EyeOff, FileText, Gamepad2, Grid3X3, Hand, Headphones, HelpCircle, Layers,
  Map, MapPin, Maximize, MessageSquare, Mic, Minimize, MonitorSpeaker, Mountain, MousePointer,
  Move, Music, Navigation, Network, Palette, Pause, Pencil, Play, Presentation, Radio, Redo,
  RotateCcw, RotateCw, Ruler, Scale, Search, Settings, Share, Shield, Smartphone, Sofa, Speaker,
  Volume, Volume2, VolumeX, Wand2, Wind, Zap, Sun, Undo, Upload, Users
} from 'lucide-react';

// Utils imports
import { cacheManager } from '../utils/CacheManager';
import { logger } from '../utils/Logger';
import { showToast } from '../utils/toast';

// Interfaces
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

interface RefactoredBabylonWorkspaceProps {
  workspaceId: string;
  isAdmin?: boolean;
  layoutMode?: 'standard' | 'compact' | 'immersive' | 'split';
  performanceMode?: 'low' | 'medium' | 'high';
  enablePhysics?: boolean;
  enableXR?: boolean;
  enableSpatialAudio?: boolean;
  renderingQuality?: 'low' | 'medium' | 'high' | 'ultra';
  onMeshSelect?: (mesh: Mesh) => void;
  onAnimationCreate?: (animation: any) => void;
  onMaterialChange?: (material: any) => void;
}

const ErrorBoundary: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setError(new Error(event.message));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(new Error(`Unhandled promise rejection: ${event.reason}`));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (error) {
    return (
      <div data-testid="error-boundary" className="error-boundary">
        <div>Error: {error.message}</div>
        <button
          onClick={resetError}
          className="error-boundary-btn"
        >
          Reset Error
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const RefactoredBabylonWorkspace: React.FC<RefactoredBabylonWorkspaceProps> = ({
  workspaceId,
  isAdmin = false,
  layoutMode = 'standard',
  performanceMode = 'medium',
  enablePhysics = false,
  enableXR = false,
  enableSpatialAudio = false,
  renderingQuality = 'high',
  onMeshSelect,
  onAnimationCreate,
  onMaterialChange
}) => {
  // Core state management
  const [workspaceState, setWorkspaceState] = useState({
    selectedMesh: null as Mesh | null,
    leftPanelVisible: true,
    rightPanelVisible: true,
    bottomPanelVisible: true,
    moveActive: false,
    rotateActive: false,
    scaleActive: false,
    cameraActive: false,
    perspectiveActive: false,
    showFloatingToolbar: true,
    categoryPanelVisible: false,
    realTimeEnabled: false,
    cameraMode: 'orbit' as 'orbit' | 'free' | 'first-person',
    gridVisible: true,
    wireframeEnabled: false,
    statsVisible: false,
    selectedWorkspaceId: workspaceId
  });

  // Feature state management
  const [featureStates, setFeatureStates] = useState({
    // Core Features
    showMaterialEditor: false,
    showMinimap: false,
    showMeasurementTool: false,
    showAutoFurnish: false,
    showAICoDesigner: false,
    showScanAnimal: false,
    showMoodScene: false,
    showSeasonalDecor: false,
    showARScale: false,
    showScenario: false,
    showAnnotations: false,
    showBIMIntegration: false,

    // Navigation & Controls
    showMovementControlChecker: false,
    showTeleportManager: false,
    showSwimMode: false,

    // Analysis & Simulation
    showMultiSensoryPreview: false,
    showNoiseSimulation: false,
    showPropertyInspector: false,
    showSceneBrowser: false,
    showSiteContextGenerator: false,
    showSmartAlternatives: false,
    showSoundPrivacySimulation: false,
    showSunlightAnalysis: false,
    showSustainabilityCompliancePanel: false,
    showWindTunnelSimulation: false,

    // Advanced Features
    showPathTracing: false,
    showPHashIntegration: false,
    showProgressiveLoader: false,
    showPresentationManager: false,
    showPresenterMode: false,
    showQuantumSimulationInterface: false,

    // Additional Simulations
    showWeather: false,
    showWind: false,
    showNoise: false,

    // AI Features
    showAIAdvisor: false,
    showVoiceAssistant: false,

    // Analysis Features
    showErgonomic: false,
    showEnergy: false,
    showCost: false,
    showBeforeAfter: false,
    showComparativeTour: false,
    showROICalculator: false,

    // Collaboration Features
    showMultiUser: false,
    showChat: false,
    showSharing: false,

    // Immersive Features
    showVR: false,
    showAR: false,
    showSpatialAudio: false,
    showHaptic: false,

    // Geo-Location Features
    showGeoLocation: false,
    showGeoWorkspaceArea: false,
    showGeoSync: false,

    // Specialized Components
    showCameraViews: false,
    showCirculationFlowSimulation: false,
    showCollabManager: false,
    showComprehensiveSimulation: false,
    showConstructionOverlay: false,
    showFloodSimulation: false,
    showShadowImpactAnalysis: false,
    showTrafficParkingSimulation: false
  });

  // Scene and engine refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);

  // Manager refs
  const featureManagerRef = useRef<typeof FeatureManager | null>(null);
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const syncManagerRef = useRef<SyncManager | null>(null);
  const materialManagerRef = useRef<MaterialManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const bimManagerRef = useRef<BIMManager | null>(null);
  const iotManagerRef = useRef<IoTManager | null>(null);
  const xrManagerRef = useRef<XRManager | null>(null);

  // AR refs
  const arCloudAnchorsRef = useRef<ARCloudAnchors | null>(null);
  const cloudAnchorManagerRef = useRef<CloudAnchorManager | null>(null);
  const gpsTransformUtilsRef = useRef<GPSTransformUtils | null>(null);

  // Specialized component refs
  const cameraViewsRef = useRef<any>(null);
  const circulationFlowSimulationRef = useRef<any>(null);
  const collabManagerRef = useRef<any>(null);
  const comprehensiveSimulationRef = useRef<any>(null);
  const constructionOverlayRef = useRef<any>(null);

  // State for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [fps, setFps] = useState(60);
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  // Initialize Babylon.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Create engine
      const engine = new Engine(canvasRef.current, true);
      engineRef.current = engine;

      // Create scene
      const scene = new Scene(engine);
      sceneRef.current = scene;

      // Create camera
      const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
      camera.attachControl(canvasRef.current, true);
      cameraRef.current = camera;

      // Create basic lighting
      const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);
      light.intensity = 0.7;

      // Create ground plane
      const ground = Mesh.CreateGround("ground", 10, 10, 2, scene);
      const groundMaterial = new StandardMaterial("groundMaterial", scene);
      groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
      ground.material = groundMaterial;

      // Initialize managers
      const deviceDetector = (DeviceDetector as any).getInstance();
      const capabilities = deviceDetector.detectCapabilities();

      const featureManager = new (FeatureManager as any)({});
      featureManagerRef.current = featureManager;

      const analyticsManager = new AnalyticsManager(engine, scene, featureManager as any);
      const materialManager = new MaterialManager(scene);
      materialManagerRef.current = materialManager;

      const userId = 'local-user';
      const syncManager = new SyncManager(null, scene, userId);
      const animationManager = new AnimationManager(scene, syncManager);

      animationManagerRef.current = animationManager;
      syncManagerRef.current = syncManager;

      if (enableSpatialAudio) {
        const audioManager = new AudioManager(scene);
        audioManagerRef.current = audioManager;
      }

      if (enableXR) {
        const xrManager = new XRManager(scene);
        xrManagerRef.current = xrManager;
      }

      // Start render loop
      engine.runRenderLoop(() => {
        scene.render();
        if (audioManagerRef.current) {
          // audioManagerRef.current.update();
        }
      });

      // Handle window resize
      const handleResize = () => engine.resize();
      window.addEventListener('resize', handleResize);

      setIsInitialized(true);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        analyticsManager.dispose();
        animationManager.dispose();
        syncManager.dispose();
        if (cloudAnchorManagerRef.current) {
          cloudAnchorManagerRef.current.dispose();
        }
        if (collabManagerRef.current) {
          collabManagerRef.current.dispose();
        }
        scene.dispose();
        engine.dispose();
      };
    } catch (error) {
      console.error('Failed to initialize Babylon.js engine:', error);
      showToast.error('Failed to initialize 3D workspace. WebGL may not be supported.');
    }
  }, []);

  // Feature toggle handlers
  const toggleFeature = useCallback((featureId: string, enabled: boolean) => {
    setFeatureStates(prev => ({
      ...prev,
      [featureId]: enabled
    }));
  }, []);

  const enableFeature = useCallback((featureId: string) => {
    toggleFeature(featureId, true);
  }, [toggleFeature]);

  const disableFeature = useCallback((featureId: string) => {
    toggleFeature(featureId, false);
  }, [toggleFeature]);

  // Workspace state handlers
  const updateState = useCallback((updates: Partial<typeof workspaceState>) => {
    setWorkspaceState(prev => ({ ...prev, ...updates }));
  }, []);

  // Event handlers
  const handleMeshSelect = useCallback((mesh: Mesh) => {
    if (onMeshSelect) {
      onMeshSelect(mesh);
    }
  }, [onMeshSelect, updateState]);

  const handleAnimationCreate = useCallback((animation: any) => {
    if (onAnimationCreate) {
      onAnimationCreate(animation);
    }
  }, [onAnimationCreate]);

  const handleMaterialChange = useCallback((material: any) => {
    if (onMaterialChange) {
      onMaterialChange(material);
    }
  }, [onMaterialChange]);

  // Camera handlers
  const handleCameraChange = useCallback((cameraType: string) => {
    updateState({ cameraMode: cameraType as 'orbit' | 'free' | 'first-person' });
  }, [updateState]);

  const handlePositionChange = useCallback((position: Vector3) => {
    if (cameraRef.current) {
      cameraRef.current.position = position;
    }
  }, []);

  const handleRotationChange = useCallback((rotation: Vector3) => {
    if (cameraRef.current) {
      cameraRef.current.rotation = rotation;
    }
  }, []);

  const handleSettingsChange = useCallback((settings: any) => {
    // Handle camera settings changes
    console.log('Camera settings changed:', settings);
  }, []);

  // Lighting handlers
  const handleLightAdd = useCallback((lightType: any, position: Vector3) => {
    if (!sceneRef.current) return;

    let light: any;
    switch (lightType) {
      case 'directional':
        light = new DirectionalLight('directionalLight', position, sceneRef.current);
        break;
      case 'point':
        light = new DirectionalLight('pointLight', position, sceneRef.current);
        break;
      case 'spot':
        light = new DirectionalLight('spotLight', position, sceneRef.current);
        break;
      case 'hemispheric':
        light = new HemisphericLight('hemisphericLight', position, sceneRef.current);
        break;
    }

    if (light) {
      sceneRef.current.addLight(light);
    }
  }, []);

  const handleLightRemove = useCallback((lightId: string) => {
    if (!sceneRef.current) return;

    const light = sceneRef.current.lights.find(l => l.name === lightId);
    if (light) {
      sceneRef.current.removeLight(light);
      light.dispose();
    }
  }, []);

  const handleLightUpdate = useCallback((lightId: string, properties: any) => {
    if (!sceneRef.current) return;

    const light = sceneRef.current.lights.find(l => l.name === lightId);
    if (light) {
      Object.assign(light, properties);
    }
  }, []);

  const handleEnvironmentChange = useCallback((environment: any) => {
    // Handle environment settings changes
    console.log('Environment changed:', environment);
  }, []);

  // Physics handlers
  const handlePhysicsCreate = useCallback((physicsType: any, targetId: string) => {
    // Handle physics creation
    console.log('Physics created:', physicsType, targetId);
  }, []);

  const handlePhysicsRemove = useCallback((physicsId: string) => {
    // Handle physics removal
    console.log('Physics removed:', physicsId);
  }, []);

  const handlePhysicsUpdate = useCallback((physicsId: string, properties: any) => {
    // Handle physics update
    console.log('Physics updated:', physicsId, properties);
  }, []);

  const handlePhysicsPlay = useCallback((physicsId: string) => {
    // Handle physics play
    console.log('Physics play:', physicsId);
  }, []);

  const handlePhysicsPause = useCallback((physicsId: string) => {
    // Handle physics pause
    console.log('Physics pause:', physicsId);
  }, []);

  const handlePhysicsStop = useCallback((physicsId: string) => {
    // Handle physics stop
    console.log('Physics stop:', physicsId);
  }, []);

  // Context value
  const contextValue = {
    state: {
      scene: sceneRef.current,
      engine: engineRef.current,
      camera: cameraRef.current,
      ...workspaceState
    },
    updateState,
    setLeftPanelVisible: (visible: boolean) => updateState({ leftPanelVisible: visible }),
    setRightPanelVisible: (visible: boolean) => updateState({ rightPanelVisible: visible }),
    setBottomPanelVisible: (visible: boolean) => updateState({ bottomPanelVisible: visible }),
    setMoveActive: (active: boolean) => updateState({ moveActive: active }),
    setRotateActive: (active: boolean) => updateState({ rotateActive: active }),
    setScaleActive: (active: boolean) => updateState({ scaleActive: active }),
    setCameraActive: (active: boolean) => updateState({ cameraActive: active }),
    setPerspectiveActive: (active: boolean) => updateState({ perspectiveActive: active }),
    setShowFloatingToolbar: (show: boolean) => updateState({ showFloatingToolbar: show }),
    setCategoryPanelVisible: (visible: boolean) => updateState({ categoryPanelVisible: visible }),
    setRealTimeEnabled: (enabled: boolean) => updateState({ realTimeEnabled: enabled }),
    setCameraMode: (mode: 'orbit' | 'free' | 'first-person') => updateState({ cameraMode: mode }),
    setGridVisible: (visible: boolean) => updateState({ gridVisible: visible }),
    setWireframeEnabled: (enabled: boolean) => updateState({ wireframeEnabled: enabled }),
    setStatsVisible: (visible: boolean) => updateState({ statsVisible: visible }),
    setSelectedWorkspaceId: (id: string) => updateState({ selectedWorkspaceId: id })
  };

  // Render feature panels
  const renderFeaturePanels = () => {
    const sceneManager = sceneRef.current ? { scene: sceneRef.current } : null;

    return (
      <>
        {/* Core Features */}
        {featureStates.showMaterialEditor && sceneManager && (
          <MaterialEditor
            sceneManager={sceneManager}
            onClose={() => disableFeature('showMaterialEditor')}
            onMaterialChange={handleMaterialChange}
          />
        )}

        {featureStates.showMinimap && sceneRef.current && cameraRef.current && (
          <Minimap
            scene={sceneRef.current}
            camera={cameraRef.current}
            onCameraMove={() => {}}
            workspaces={workspaces}
            selectedWorkspaceId={workspaceState.selectedWorkspaceId}
            onWorkspaceSelect={(id: string) => updateState({ selectedWorkspaceId: id })}
          />
        )}

        {featureStates.showMeasurementTool && sceneRef.current && engineRef.current && (
          <MeasureTool
            scene={sceneRef.current}
            engine={engineRef.current}
            isActive={featureStates.showMeasurementTool}
            onMeasurementComplete={(measurement: any) => console.log('Measurement completed:', measurement)}
          />
        )}

        {featureStates.showAutoFurnish && sceneManager && (
          <AutoFurnish
            sceneManager={sceneManager}
            onClose={() => disableFeature('showAutoFurnish')}
          />
        )}

        {featureStates.showAICoDesigner && sceneManager && (
          <AICoDesigner
            scene={sceneManager.scene}
            isActive={featureStates.showAICoDesigner}
            onClose={() => disableFeature('showAICoDesigner')}
          />
        )}

        {featureStates.showMoodScene && sceneManager && (
          <MoodScenePanel
            sceneManager={sceneManager}
            onClose={() => disableFeature('showMoodScene')}
          />
        )}

        {featureStates.showSeasonalDecor && sceneManager && (
          <SeasonalDecorPanel
            sceneManager={sceneManager}
            onClose={() => disableFeature('showSeasonalDecor')}
          />
        )}

        {featureStates.showARScale && sceneManager && (
          <ARScalePanel
            sceneManager={sceneManager}
            onClose={() => disableFeature('showARScale')}
          />
        )}

        {featureStates.showScenario && sceneManager && (
          <ScenarioPanel
            sceneManager={sceneManager}
            onClose={() => disableFeature('showScenario')}
          />
        )}

        {featureStates.showAnnotations && sceneManager && (
          <Annotations
            scene={sceneManager.scene}
            isActive={featureStates.showAnnotations}
          />
        )}

        {featureStates.showBIMIntegration && sceneManager && (
          <BIMIntegration
            scene={sceneManager.scene}
            isActive={featureStates.showBIMIntegration}
            bimManager={bimManagerRef.current ?? undefined}
            onClose={() => disableFeature('showBIMIntegration')}
          />
        )}

        {/* Animation Timeline */}
        {sceneRef.current && animationManagerRef.current && (
          <AnimationTimeline
            animationManager={animationManagerRef.current}
            selectedObject={workspaceState.selectedMesh}
            onSequenceCreate={handleAnimationCreate}
            onSequencePlay={(sequenceId: string) => {
              if (animationManagerRef.current) {
                animationManagerRef.current.playAnimation(sequenceId);
              }
            }}
          />
        )}

        {/* Feature Controls */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {workspaceState.rightPanelVisible && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-80">
              <Tabs defaultValue="camera" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="camera">Camera</TabsTrigger>
                  <TabsTrigger value="lighting">Lighting</TabsTrigger>
                  <TabsTrigger value="physics">Physics</TabsTrigger>
                  <TabsTrigger value="animation">Animation</TabsTrigger>
                </TabsList>

                <TabsContent value="camera" className="mt-4">
                  <CameraControls
                    onCameraChange={handleCameraChange}
                    onPositionChange={handlePositionChange}
                    onRotationChange={handleRotationChange}
                    onSettingsChange={handleSettingsChange}
                  />
                </TabsContent>

                <TabsContent value="lighting" className="mt-4">
                  <LightingControls
                    onLightAdd={handleLightAdd}
                    onLightRemove={handleLightRemove}
                    onLightUpdate={handleLightUpdate}
                    onEnvironmentChange={handleEnvironmentChange}
                  />
                </TabsContent>

                <TabsContent value="physics" className="mt-4">
                  <PhysicsControls
                    onPhysicsCreate={handlePhysicsCreate}
                    onPhysicsRemove={handlePhysicsRemove}
                    onPhysicsUpdate={handlePhysicsUpdate}
                    onPhysicsPlay={handlePhysicsPlay}
                    onPhysicsPause={handlePhysicsPause}
                    onPhysicsStop={handlePhysicsStop}
                  />
                </TabsContent>

                <TabsContent value="animation" className="mt-4">
                  <AnimationControls />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <ErrorBoundary>
      <WorkspaceContext.Provider value={contextValue as any}>
        <WorkspaceLayout
          layoutMode={layoutMode}
        >
          {/* Top Bar */}
          <TopBar
            onSave={() => console.log('Save clicked')}
            onExport={() => console.log('Export clicked')}
            onImport={() => console.log('Import clicked')}
            onSettings={() => console.log('Settings clicked')}
            onPlay={() => console.log('Play clicked')}
            onPause={() => console.log('Pause clicked')}
            onReset={() => console.log('Reset clicked')}
            onFullscreen={() => console.log('Fullscreen clicked')}
            onMinimize={() => console.log('Minimize clicked')}
            onHelp={() => console.log('Help clicked')}
            onShare={() => console.log('Share clicked')}
            onChat={() => console.log('Chat clicked')}
            onCollaborate={() => console.log('Collaborate clicked')}
          />

          {/* Main Canvas */}
          <div className="flex-1 relative">
            <canvas
              ref={canvasRef}
              className="w-full h-full babylon-canvas"
              role="img"
              aria-label="Babylon.js 3D Canvas"
            />

            {/* Feature Panels */}
            {renderFeaturePanels()}

            {/* Loading Overlay */}
            {!isInitialized && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="bg-black/80 text-white border-gray-600">
                  <CardContent className="p-6 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>Initializing 3D Workspace...</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Bottom Panel */}
          {workspaceState.bottomPanelVisible && (
            <BottomPanel
              onToggleStats={() => console.log('Toggle stats clicked')}
              onToggleConsole={() => console.log('Toggle console clicked')}
              onToggleTimeline={() => console.log('Toggle timeline clicked')}
              onExportStats={() => console.log('Export stats clicked')}
              onClearStats={() => console.log('Clear stats clicked')}
            />
          )}
        </WorkspaceLayout>
      </WorkspaceContext.Provider>
    </ErrorBoundary>
  );
};

export default React.memo(RefactoredBabylonWorkspace);
