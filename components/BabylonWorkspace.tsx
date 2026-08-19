import React, { useState, useEffect, useCallback, useRef, Suspense, lazy, startTransition } from "react";
import { createPortal } from "react-dom";
import './BabylonWorkspace.css';

// Core Babylon.js imports only (minimal for initial load)
import { Engine, Scene, ArcRotateCamera, FreeCamera, UniversalCamera, HemisphericLight, DirectionalLight, Vector3, Vector2, Quaternion, Color3, Color4, Mesh, AbstractMesh, StandardMaterial, DefaultRenderingPipeline, SSAORenderingPipeline, HighlightLayer, PBRMaterial, Material, ImageProcessingConfiguration, PointerInfo, PickingInfo, Camera, PointerEventTypes, ParticleSystem, MeshBuilder, Texture, GizmoManager, ShadowGenerator, Ray } from '@babylonjs/core';
import { WaterMaterial } from '@babylonjs/materials/water';
import { PerlinNoiseProceduralTexture } from '@babylonjs/procedural-textures';

// Essential UI Components
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Maximize, MapPin, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Move, RotateCw, Maximize2, X } from 'lucide-react';

// Import proper hooks from hooks directory
import { useFeatureStates, UseFeatureStatesReturn } from '../hooks/useFeatureStates';
import { useWorkspaceState, WorkspaceState } from '../hooks/useWorkspaceState';
import { useUIHandlers } from '../hooks/useUIHandlers';
import { useApp } from '../contexts/AppContext';
import { supabase, projectId } from '../supabase/client';

// Import extracted modules
import { useMeshSceneHandlers } from './BabylonWorkspace/meshSceneHandlers';
import { LeftPanelSegment, TopBarSegment, BottomPanelSegment, FloatingToolbarSegment, ImmersiveControls, renderLeftPanel, renderTopBar, renderRightPanel, renderBottomPanel, renderFloatingToolbar, renderCustomPanels } from './BabylonWorkspace/uiSegments';

// Interfaces
import * as AnimationInterfaces from './interfaces/AnimationInterfaces';
import * as MaterialInterfaces from './interfaces/MaterialInterfaces';
import type { GeoWorkspaceArea } from './types';
import { featureCategories } from '../config/featureCategories';

// Manager imports
import { AnalyticsManager } from './AnalyticsManager';
import { FeatureManager } from './FeatureManager';
import { AnimationManager } from './AnimationManager';
import { SyncManager } from './SyncManager';
import { MaterialManager } from './MaterialManager';
import { AudioManager } from './AudioManager';
import { BIMManager } from './BIMManager';
import { AIManager } from './AIManager';
import { ExternalAPIManager } from './ExternalAPIManager';
import { SiteContextManager } from './SiteContextManager';
import { CostEstimator } from './CostEstimator';
import { ScenarioManager } from './managers/ScenarioManager';
import { MoodSceneManager } from './managers/MoodSceneManager';
import { GeoSyncManager } from './GeoSyncManager';
import { XRManager } from './XRManager';
import { SwimMode } from './SwimMode';
import { UnderwaterMode } from './UnderwaterMode';
import { DeviceDetector } from './DeviceDetector';
import { CloudAnchorManager } from './CloudAnchorManager';
import { ARCloudAnchors } from './ARCloudAnchors';
import { GPSTransformUtils } from './GPSTransformUtils';
import { CollabManager } from './CollabManager';
import { SimulationManager } from './SimulationManager';
import { SustainabilityManager, SustainabilityReport } from './SustainabilityManager';

// UI Component imports
import FeatureButton from './FeatureButton';
import CategoryToggles from './CategoryToggles';

import ComprehensiveSimulation from './ComprehensiveSimulation';

// Lazy load heavy components
const LeftPanel = lazy(() => import('./LeftPanel'));
// NOTE: RightPanel/TopBar/BottomPanel/FloatingToolbar/MaterialEditor/Minimap/MeasureTool/
// AutoFurnish/AICoDesigner are actually rendered via the render* helpers imported from
// ./BabylonWorkspace/uiSegments below, which have their own lazy() declarations for these
// same components. A duplicate, unused set of lazy() consts for them used to live here -
// harmless at runtime since lazy() only executes on render, but confusing dead code.
const AnimationTimeline = lazy(() => import('./AnimationTimeline').then(module => ({ default: module.AnimationTimeline })));
const DragDropMaterialHandler = lazy(() => import('./DragDropMaterialHandler').then(module => ({ default: module.DragDropMaterialHandler })));
const BIMIntegration = lazy(() => import('./BIMIntegration'));
const EnergyDashboard = lazy(() => import('./EnergyDashboard'));
const GeoLocationContext = lazy(() => import('./GeoLocationContext'));
const CameraViews = lazy(() => import('./CameraViews'));
const CirculationFlowSimulation = lazy(() => import('./CirculationFlowSimulation'));
const FloodSimulation = lazy(() => import('./FloodSimulation'));
const ShadowImpactAnalysis = lazy(() => import('./ShadowImpactAnalysis'));
const TrafficParkingSimulation = lazy(() => import('./TrafficParkingSimulation'));

// Utils
import { showToast } from './utils/toast';

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

interface BabylonWorkspaceProps {
  workspaceId: string;
  isAdmin?: boolean;
  layoutMode?: 'standard' | 'compact' | 'immersive' | 'split';
  performanceMode?: 'low' | 'medium' | 'high';
  enablePhysics?: boolean;
  enableXR?: boolean;
  enableSpatialAudio?: boolean;
  renderingQuality?: 'auto' | 'low' | 'medium' | 'high' | 'ultra';
  onMeshSelect?: (mesh: Mesh) => void;
  onAnimationCreate?: (animation: AnimationInterfaces.AnimationGroup) => void;
  onMaterialChange?: (material: MaterialInterfaces.MaterialState) => void;
  sceneRef?: React.MutableRefObject<Scene | null>;
  onSceneReady?: () => void;
}

const ErrorBoundary: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  // Only catch React errors via componentDidCatch - avoid global handlers that break the entire UI

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

// The rain particle texture used to be a hand-typed base64 PNG blob of unknown origin -
// decoding it shows it's actually a semi-transparent solid RED pixel. Babylon multiplies
// a particle's texture color against its color1/color2 tint, so that red texture was
// crushing the intended blue-white rain tint's G/B channels toward zero, rendering as
// faint reddish specks instead of visible rain. Generating real, correct textures here
// instead - a soft vertical streak for rain (reads as motion/falling), a soft round
// dot for snow - also gives an actual place to hook a size control into.
function createRainDropTexture(scene: Scene): Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, 'rgba(220,235,255,0)');
  gradient.addColorStop(0.15, 'rgba(220,235,255,0.9)');
  gradient.addColorStop(0.85, 'rgba(200,220,255,0.6)');
  gradient.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(size * 0.4, 0, size * 0.2, size);
  const tex = new Texture(canvas.toDataURL('image/png'), scene, false, false);
  tex.hasAlpha = true;
  return tex;
}

function createSnowflakeTexture(scene: Scene): Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2, r = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const tex = new Texture(canvas.toDataURL('image/png'), scene, false, false);
  tex.hasAlpha = true;
  return tex;
}

// Shared with the shadow-caster registration below: a window/glass pane shouldn't cast
// a fully opaque shadow the way a solid wall does, or direct sunlight can never reach
// an interior at all regardless of how transparent the glass material itself looks.
const GLASS_NAME_PATTERN = /glass|window|glazing|pane/i;

function isGlassMesh(mesh: AbstractMesh): boolean {
  return GLASS_NAME_PATTERN.test(`${mesh.name || ''} ${mesh.material?.name || ''}`);
}

// The placeholder ground+box (see the scene-init effect below) get created whenever
// selectedModel is still null AT THE EXACT MOMENT the scene first initializes - which
// is the common case, since restoring the last-opened model is an async fetch that
// hasn't resolved yet by then. Nothing previously removed them once a real model
// actually loaded moments later, so the placeholder ground sat directly underneath
// the real model's own ground/road geometry - two coincident surfaces fighting over
// which one the depth buffer draws on top, which is exactly what shows up as visible
// flicker/ghosting on-screen. Call this once a real model's meshes are in the scene.
function removePlaceholderGeometry(scene: Scene): void {
  scene.getMeshByName('ground')?.dispose();
  scene.getMeshByName('defaultBox')?.dispose();
}

// Uploaded .glb/.gltf models already come in as real PBRMaterial (glTF's native format),
// which is correct - but most quick/test exports never actually author proper glass or
// mirror surfaces (alpha, metallic, roughness are usually left at generic defaults), so
// windows/mirrors end up looking like plain opaque walls. This scans newly-imported
// meshes by name (mesh name and material name - glTF exporters usually preserve
// whatever the surface was called in the original 3D app, e.g. "Window_Glass",
// "Mirror_01") and nudges PBR properties toward a believable glass or mirror/chrome
// look automatically, without requiring the user to find and fix each surface by hand
// in the Material Editor. Materials that don't match any keyword are left untouched.
function enhanceRealisticMaterials(meshes: AbstractMesh[]): void {
  const mirrorPattern = /mirror|chrome|polished[_\s-]?(metal|steel)/i;
  const seen = new Set<Material>();

  meshes.forEach((mesh) => {
    const material = mesh.material;
    if (!material || !(material instanceof PBRMaterial) || seen.has(material)) return;
    const nameHint = `${mesh.name || ''} ${material.name || ''}`;

    if (GLASS_NAME_PATTERN.test(nameHint)) {
      seen.add(material);
      material.metallic = 0;
      material.roughness = 0.05;
      material.alpha = Math.min(material.alpha, 0.25) || 0.2;
      material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      material.subSurface.isRefractionEnabled = true;
      material.subSurface.indexOfRefraction = 1.5;
    } else if (mirrorPattern.test(nameHint)) {
      seen.add(material);
      material.metallic = 1;
      material.roughness = 0.04;
      material.alpha = 1;
    }
  });
}

// Shared by rain and snow: sizes the precipitation emission area to the actual loaded
// model's real footprint, not a fixed box - a fixed box doesn't match whatever model
// happens to be loaded (too small a building sits lost in a huge field; too large a
// building only gets precipitation over part of it).
function computePrecipitationBounds(scene: Scene): { centerX: number; centerZ: number; topY: number; bottomY: number; halfExtent: number } {
  const realMeshes = scene.meshes.filter((m) =>
    m.isEnabled() && m.getTotalVertices() > 0 &&
    !/^(ground|measure_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|__root__)/i.test(m.name || '')
  );
  let halfExtent = 25;
  let centerX = 0, centerZ = 0, topY = 15, bottomY = 0;
  if (realMeshes.length > 0) {
    let min = realMeshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = realMeshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
    realMeshes.forEach((m) => {
      const bb = m.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bb.minimumWorld);
      max = Vector3.Maximize(max, bb.maximumWorld);
    });
    centerX = (min.x + max.x) / 2;
    centerZ = (min.z + max.z) / 2;
    halfExtent = Math.max((max.x - min.x) / 2, (max.z - min.z) / 2, 5) * 1.3; // slight overhang past the edges
    topY = max.y + 8; // start comfortably above the tallest point (roof)
    bottomY = min.y; // the model's actual foundation/lowest point
  }
  return { centerX, centerZ, topY, bottomY, halfExtent };
}

interface PrecipitationHeightmap {
  originX: number;
  originZ: number;
  cellSize: number;
  resolution: number;
  heights: Float32Array;
}

// Babylon's CPU ParticleSystem has no built-in mesh collision - left alone, rain/snow
// just falls straight through the roof and shows up floating inside the building's
// interior, which is what was happening. Real per-particle raycasting against the scene
// every frame for thousands of particles isn't viable, so instead: cast a coarse grid of
// rays straight down ONCE (when the effect starts) to build a height lookup of whatever
// surface - roof, ground, anything pickable - is actually there, then have particles
// stop at that height as they fall. Cheap per-particle (one array lookup), and the
// surface only needs to be resampled if the effect is restarted.
function buildPrecipitationHeightmap(scene: Scene, centerX: number, centerZ: number, halfExtent: number, topY: number, resolution = 20): PrecipitationHeightmap {
  const cellSize = (halfExtent * 2) / resolution;
  const originX = centerX - halfExtent;
  const originZ = centerZ - halfExtent;
  const heights = new Float32Array(resolution * resolution).fill(-1000);
  const rayStartY = topY + 20;
  const rayLength = rayStartY + 1000;
  const predicate = (mesh: AbstractMesh) =>
    mesh.isEnabled() && mesh.isPickable !== false && mesh.getTotalVertices() > 0 &&
    !/^(measure_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|__root__|weatherRain|weatherSnow)/i.test(mesh.name || '');
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = originX + (i + 0.5) * cellSize;
      const z = originZ + (j + 0.5) * cellSize;
      const ray = new Ray(new Vector3(x, rayStartY, z), new Vector3(0, -1, 0), rayLength);
      const hit = scene.pickWithRay(ray, predicate);
      if (hit?.hit && hit.pickedPoint) {
        heights[i * resolution + j] = hit.pickedPoint.y;
      }
    }
  }
  return { originX, originZ, cellSize, resolution, heights };
}

function getPrecipitationSurfaceHeight(map: PrecipitationHeightmap, x: number, z: number): number {
  const i = Math.floor((x - map.originX) / map.cellSize);
  const j = Math.floor((z - map.originZ) / map.cellSize);
  if (i < 0 || i >= map.resolution || j < 0 || j >= map.resolution) return -1000;
  return map.heights[i * map.resolution + j];
}

// Wraps a particle system's default per-frame update with a "stop at the surface below"
// check, so particles land on/near the roof (or ground, wherever nothing taller is in
// the way) instead of continuing straight through it into the interior.
function attachSurfaceCollision(ps: ParticleSystem, heightmap: PrecipitationHeightmap): void {
  const defaultUpdate = ps.updateFunction;
  ps.updateFunction = (particles) => {
    defaultUpdate(particles);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const surfaceY = getPrecipitationSurfaceHeight(heightmap, p.position.x, p.position.z);
      if (p.position.y <= surfaceY) {
        p.position.y = surfaceY;
        p.age = p.lifeTime; // recycle on the next update pass instead of sinking further
      }
    }
  };
}

const BabylonWorkspace: React.FC<BabylonWorkspaceProps> = ({
  workspaceId,
  isAdmin = false,
  // default to standard layout so UI panels and buttons are visible immediately
  layoutMode: layoutModeProp = 'standard',
  performanceMode = 'medium',
  enablePhysics = false,
  enableXR = false,
  enableSpatialAudio = false,
  // No caller in this app currently passes this prop, which meant every device -
  // a flagship desktop or a low-end phone struggling with a heavy uploaded model -
  // always rendered at full native resolution regardless of GPU capability. 'auto' is
  // now the default: an initial conservative scale is applied immediately below, then
  // corrected to the actual device-appropriate quality once DeviceDetector's real
  // capability check resolves (see the "Apply device-recommended quality" block further
  // down). An explicit value here still always wins over auto-detection.
  renderingQuality = 'auto',
  onMeshSelect,
  onAnimationCreate,
  onMaterialChange,
  sceneRef: externalSceneRef,
  onSceneReady
}) => {
  // UI-only local state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [canvasError, setCanvasError] = React.useState<string | null>(null);
  const [layoutMode, setLayoutMode] = React.useState(layoutModeProp);

  useEffect(() => {
    return () => {
      if (externalSceneRef) {
        externalSceneRef.current = null;
      }
    };
  }, [externalSceneRef]);

  // Comprehensive initial feature states for all components
  const initialFeatureStates = {
    showMaterialEditor: false,
    showMinimap: false,
    showMeasurementTool: false,
    showAutoFurnish: false,
    showAICoDesigner: false,
    showScanAnimal: false,
    showARScale: false,
    showAnnotations: false,
    showBIMIntegration: false,
    // helpful overlay showing available input methods
    showMovementControlChecker: true,
    showTeleportManager: false,
    showSwimMode: false,
    showMultiSensoryPreview: false,
    showPropertyInspector: false,
    showSceneBrowser: false,
    showSiteContextGenerator: false,
    showSmartAlternatives: false,
    showSoundPrivacySimulation: false,
    showSustainabilityCompliancePanel: false,
    showWindTunnelSimulation: false,
    showPathTracing: false,
    showProgressiveLoader: false,
    showPresentationManager: false,
    showPresenterMode: false,
    showQuantumSimulationInterface: false,
    showWeather: false,
    showWind: false,
    showNoise: false,
    showAIAdvisor: false,
    showVoiceAssistant: false,
    showCost: false,
    showBeforeAfter: false,
    showROICalculator: false,
    showMultiUser: false,
    showChat: false,
    showSharing: false,
    showVR: false,
    showAR: false,
    showSpatialAudio: false,
    showHaptic: false,
    showGeoLocation: false,
    showGeoWorkspaceArea: false,
    showGeoSync: false,
    showCollabManager: false,
    showAnimationTimeline: false,
    showClashDetection: false,
    showCloudAnchorManager: false,
    showExport: true,
    showFloodSimulation: false,
    showGestureDetection: false,
    showGestureInspector: false,
    showImport: true,
    // show the shortcuts overlay initially to help users discover controls
    showKeyboardShortcuts: true,
    showDomainSelector: false,
    showLighting: true,
    showMiscellaneous: false,
    // false so these don't render as "pressed" on load while transformMode is still 'none' -
    // they used to default true while the state actually driving the tool defaulted false, so
    // the first click toggled the feature off (already-"active"-looking button) before a
    // second click could turn the tool on.
    showMove: false,
    showRotate: false,
    showScale: false,
    showVoiceChat: false,
  };

  // Consolidated feature state and workspace state hooks
  const {
    featureStates,
    setFeatureStates,
    toggleFeature,
    setFeatureState,
    enableFeature,
    disableFeature,
    activeFeatures,
    featuresByCategory: rawFeaturesByCategory
  } = useFeatureStates(initialFeatureStates);

  // Workspace state hook
  const {
    updateState,
    selectedMesh,
    setSelectedMesh,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    cameraMode,
    setCameraMode,
    setPerformanceMode,
    animationManager,
    handleTourSequenceCreate,
    handleTourSequencePlay,
    topBarVisible,
    setTopBarVisible,
    leftPanelVisible,
    setLeftPanelVisible,
    rightPanelVisible,
    setRightPanelVisible,
    bottomPanelVisible,
    setBottomPanelVisible,
    showFloatingToolbar,
    setShowFloatingToolbar,
    cameraActive,
    setCameraActive,
    perspectiveActive,
    setPerspectiveActive,
    categoryPanelVisible,
    setCategoryPanelVisible
  } = useWorkspaceState(workspaceId);

  // global keyboard shortcuts - registered after handleFeatureToggle is defined (see useEffect below)

  // Sync layoutMode prop changes to local state
  React.useEffect(() => {
    setLayoutMode(layoutModeProp);
  }, [layoutModeProp]);

  // UI Handlers hook
  const {
    handleWorkspaceSelect,
    handleRealTimeToggle,
    handleGridToggle,
    handleWireframeToggle,
    handleStatsToggle,
    handleCategoryPanelToggle,
  } = useUIHandlers();

  const { selectedModel, setSelectedModel } = useApp();
  const [sceneReadyForLoad, setSceneReadyForLoad] = React.useState(false);

  // Load selected model from User/Admin when navigating to workspace with modelUrl
  React.useEffect(() => {
    const scene = sceneRef?.current;
    const url = selectedModel?.modelUrl;
    if (!sceneReadyForLoad || !scene || !url || typeof url !== 'string') return;

    // Keep currentModelId in sync with whatever model is actually loaded - this feeds
    // every model-scoped feature (cost estimate, sustainability report, annotations,
    // version history, etc), so it must reflect the real model, not stay on the
    // 'default-model' placeholder forever.
    if (selectedModel?.id) {
      setCurrentModelId(String(selectedModel.id));
    }

    let cancelled = false;
    const MAX_RETRIES = 3;
    const toastId = showToast.loading(`Loading ${selectedModel?.name || 'model'}...`, 'Starting');

    // blob: URLs (e.g. the "Preview" button before a model is even uploaded)
    // have no file extension for SceneLoader to detect the right plugin from,
    // so it fell back to the wrong parser and failed with "importScene ...
    // has failed JSON parse" instead of loading the actual GLB. Passing the
    // extension explicitly fixes both that and any signed URL whose real
    // extension is followed by a "?token=..." query string.
    const pluginExtension = (() => {
      const fmt = String(selectedModel?.format || '').trim().replace(/^\./, '').toLowerCase();
      if (fmt) return `.${fmt}`;
      const fileName = String(selectedModel?.fileName || selectedModel?.name || '');
      const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
      return match ? `.${match[1].toLowerCase()}` : undefined;
    })();

    // Dispose whatever the previous model loaded before importing the next one,
    // otherwise this and the prior model's meshes both end up in the scene at
    // once with no way to remove the old one from the UI.
    if (loadedModelMeshesRef.current.length) {
      loadedModelMeshesRef.current.forEach((m) => {
        if (m.isDisposed()) return;
        shadowGeneratorRef.current?.removeShadowCaster(m);
        m.dispose();
      });
      loadedModelMeshesRef.current = [];
    }

    const attemptLoad = (attempt: number) => {
      // @babylonjs/loaders registers the glTF/OBJ/STL/etc plugins as a side effect of
      // being imported - it was previously fired off without awaiting it, so
      // SceneLoader.Append below could (and on a fresh page load, reliably did) run
      // before the .glb plugin had finished registering. With no matching plugin found,
      // SceneLoader silently fell back to its native .babylon JSON scene parser, which
      // tried to JSON.parse the raw binary GLB bytes and failed with a confusing
      // "importScene ... has failed JSON parse" error instead of actually loading the
      // model.
      Promise.all([
        import('@babylonjs/core/Loading/sceneLoader'),
        import('@babylonjs/loaders')
      ]).then(([{ SceneLoader }]) => {
        const meshesBefore = new Set(scene.meshes);
        SceneLoader.Append('', url, scene, () => {
          if (cancelled) return;
          const newMeshes = scene.meshes.filter((m) => !meshesBefore.has(m));
          loadedModelMeshesRef.current = newMeshes;
          enhanceRealisticMaterials(newMeshes);
          removePlaceholderGeometry(scene);
          // Some exported CAD/BIM files mark certain nodes hidden (e.g. glTF's
          // KHR_node_visibility, from an alternate design option or hidden layer in the
          // source tool) - those load with isVisible=false and silently don't render,
          // while still being enabled/pickable, so clicking that empty-looking spot
          // selected an invisible mesh with no way to ever see it. This app has no UI for
          // toggling hidden layers back on, so treat "hidden in the source file" as a
          // loader quirk to override rather than a real feature.
          newMeshes.forEach((m) => { m.isVisible = true; });
          // Register the real loaded meshes as a BIM model so Cost Estimator,
          // ROI Calculator, Budget Tier Comparison, and Ergonomic/Energy/
          // Shadow Analysis (all of which look up bimManager.getModelById())
          // have real data instead of showing "load a model first" forever.
          if (bimManagerRef.current && selectedModel?.id) {
            bimManagerRef.current.registerLoadedModelFromScene(String(selectedModel.id), selectedModel?.name || 'Uploaded Model');
          }
          const shadowGenerator = shadowGeneratorRef.current;
          if (shadowGenerator) {
            newMeshes.forEach((m) => {
              // A window/glass pane cast a fully opaque shadow like a solid wall would,
              // even after enhanceRealisticMaterials makes it look transparent - shadow
              // maps are depth-only and don't account for material alpha, so sunlight
              // could never actually reach an interior through a mesh still registered
              // here. Excluding glass from casting (it still receives shadows normally)
              // is what actually lets "sunlight ulla" (sunlight inside) happen.
              if (!isGlassMesh(m)) {
                shadowGenerator.addShadowCaster(m);
              }
              m.receiveShadows = true;
            });
          }
          showToast.dismiss(toastId);
          showToast.success(`Model loaded: ${selectedModel?.name || 'Model'}`);
          setSelectedModel(null);
        }, (event) => {
          if (cancelled) return;
          const retrySuffix = attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '';
          if (event.lengthComputable && event.total) {
            const pct = Math.round((event.loaded / event.total) * 100);
            showToast.update(toastId, `Loading ${selectedModel?.name || 'model'}...`, `${pct}%${retrySuffix}`);
          } else {
            const mb = (event.loaded / (1024 * 1024)).toFixed(1);
            showToast.update(toastId, `Loading ${selectedModel?.name || 'model'}...`, `${mb} MB loaded${retrySuffix}`);
          }
        }, (_s, msg, exception) => {
          if (cancelled) return;
          // Network/timeout failures are worth retrying (common on slow/unstable
          // connections with a large file); a bad/corrupt file or unsupported format
          // will fail the same way every time, so don't waste the user's bandwidth
          // retrying those.
          const isLikelyNetworkError = !exception || exception?.name === 'TypeError' || /network|fetch|timeout|ECONNRESET/i.test(msg || '');
          if (isLikelyNetworkError && attempt < MAX_RETRIES) {
            const delayMs = Math.min(1000 * 2 ** attempt, 8000); // exponential backoff, capped
            showToast.update(toastId, `Connection issue, retrying...`, `Attempt ${attempt + 1} of ${MAX_RETRIES} in ${Math.round(delayMs / 1000)}s`);
            setTimeout(() => {
              if (!cancelled) attemptLoad(attempt + 1);
            }, delayMs);
          } else {
            showToast.dismiss(toastId);
            showToast.error(`Failed to load model: ${msg}`, attempt > 0 ? `Gave up after ${attempt} retries` : undefined);
            setSelectedModel(null);
          }
        }, pluginExtension);
      });
    };

    attemptLoad(0);
    return () => { cancelled = true; };
  }, [sceneReadyForLoad, selectedModel?.id, selectedModel?.modelUrl]);

  // Expanding/collapsing a category in the Tools accordion should only reveal or hide
  // its list of buttons to choose from - it previously also force-enabled (or disabled)
  // every single feature inside that category at the same time, so tapping a category
  // like "Core Workspace" instantly opened every one of its ~10 tool panels at once
  // instead of just showing the list. Turning an individual tool on/off is exactly what
  // FeatureButton's own click handler (handleFeatureToggle) already does.
  const handleCategoryToggle = useCallback((category: string) => {
    setCategoryPanelVisible({
      ...categoryPanelVisible,
      [category]: !categoryPanelVisible[category]
    });
  }, [categoryPanelVisible, setCategoryPanelVisible]);

  const handleToggleAllCategories = useCallback((visible: boolean) => {
    const updates: Record<string, boolean> = {};
    Object.keys(featureCategories).forEach(cat => { updates[cat] = visible; });
    setCategoryPanelVisible(updates);
    if (visible) {
      Object.values(featureCategories).flat().forEach(f => enableFeature(f.id));
    } else {
      Object.values(featureCategories).flat().forEach(f => disableFeature(f.id));
    }
  }, [setCategoryPanelVisible, enableFeature, disableFeature]);

  // Listen for custom event from portaled top bar expand button (bypasses closure issues)
  useEffect(() => {
    const handler = () => updateState({ topBarVisible: true });
    window.addEventListener('naviz:showTopBar', handler);
    return () => window.removeEventListener('naviz:showTopBar', handler);
  }, [updateState]);

  // AppLayout.tsx's real voice assistant panel dispatches this when the user closes it
  // via its own X button - without this, the Voice Assistant tool-panel button would
  // keep showing "on" after the actual panel it opened had already been closed.
  useEffect(() => {
    const handler = () => disableFeature('showVoiceAssistant');
    window.addEventListener('naviz:voiceAssistantClosed', handler);
    return () => window.removeEventListener('naviz:voiceAssistantClosed', handler);
  }, [disableFeature]);

  // Define workspaceState object to group relevant state variables for usage in render functions
  const workspaceState = {
    topBarVisible,
    leftPanelVisible,
    rightPanelVisible,
    bottomPanelVisible,
    selectedMesh,
    cameraActive,
    perspectiveActive,
    showFloatingToolbar
  };

  // Memoize feature categories array
  const featureCategoriesArrayMemo = React.useMemo(() => Object.keys(rawFeaturesByCategory), [rawFeaturesByCategory]);

  // Local state declarations
  const [deviceCapabilities, setDeviceCapabilities] = React.useState<any>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const [transformMode, setTransformMode] = React.useState<'none' | 'position' | 'rotation' | 'scale'>('none');
  type UndoEntry =
    | { kind: 'transform'; mesh: Mesh; position: Vector3; rotationQuaternion: Quaternion | null; rotation: Vector3; scaling: Vector3 }
    | { kind: 'material'; material: Material; snapshot: Record<string, any> }
    | { kind: 'materialSwap'; mesh: AbstractMesh; previousMaterial: Material };
  const undoHistoryRef = useRef<UndoEntry[]>([]);
  const [sustainabilityReport, setSustainabilityReport] = React.useState<SustainabilityReport | null>(null);
  const sustainabilityManagerRef = useRef<SustainabilityManager | null>(null);
  const simulationManagerRef = useRef<SimulationManager | null>(null);
  const [rainOn, setRainOn] = React.useState(false);
  const [rainIntensity, setRainIntensity] = React.useState(1); // 0.2 (light) - 2 (heavy) - shared speed/quantity for rain AND snow
  const [snowOn, setSnowOn] = React.useState(false);
  const [particleSize, setParticleSize] = React.useState(1); // shared size multiplier for rain + snow, 0.3 (fine) - 3 (large)
  const [floodOn, setFloodOn] = React.useState(false);
  const [currentModelId, setCurrentModelId] = React.useState<string>('default-model');
  const [fps, setFps] = React.useState(60);
  const [workspaces, setWorkspaces] = React.useState<GeoWorkspaceArea[]>([]);
  const [enablePostProcessing, setEnablePostProcessing] = React.useState(true);
  const [enableBloom, setEnableBloom] = React.useState(true);
  const [enableDepthOfField, setEnableDepthOfField] = React.useState(false);
  const [enableMotionBlur, setEnableMotionBlur] = React.useState(false);
  const [enableSSAO, setEnableSSAO] = React.useState(false);
  const [enableGrain, setEnableGrain] = React.useState(false);
  const [enableVignette, setEnableVignette] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'walk' | 'orbit' | 'dollhouse' | 'vr' | 'ar'>('orbit');
  const [bloomIntensity, setBloomIntensity] = React.useState(1.0);
  const [depthOfFieldFocusDistance, setDepthOfFieldFocusDistance] = React.useState(10.0);
  const [motionBlurIntensity, setMotionBlurIntensity] = React.useState(1.0);
  const [ssaoIntensity, setSsaoIntensity] = React.useState(1.0);
  const [grainIntensity, setGrainIntensity] = React.useState(0.5);
  const [vignetteIntensity, setVignetteIntensity] = React.useState(0.5);

  // Initialize state
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Animation state
  const [animationGroups, setAnimationGroups] = React.useState<AnimationInterfaces.AnimationGroup[]>([]);
  const [currentAnimation, setCurrentAnimation] = React.useState<AnimationInterfaces.AnimationGroup | null>(null);

  // Material state
  const [materials, setMaterials] = React.useState<MaterialInterfaces.MaterialState[]>([]);
  const [currentMaterial, setCurrentMaterial] = React.useState<MaterialInterfaces.MaterialState | null>(null);

  // Refs
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const weatherRainRef = React.useRef<InstanceType<typeof ParticleSystem> | null>(null);
  const weatherSnowRef = React.useRef<InstanceType<typeof ParticleSystem> | null>(null);
  const floodWaterRef = React.useRef<{ mesh: Mesh; material: any; bodyMesh: Mesh; bodyMaterial: any; floorY: number } | null>(null);

  // Auto zoom: frame whole model area (all meshes; prefer model, exclude ground/defaultBox when imported)
  const runAutoZoom = React.useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    if (!(camera as any).setTarget) {
      showToast.info('Switch to Orbit mode to use Auto Zoom');
      return;
    }
    const arcCam = camera as ArcRotateCamera;
    const alwaysExclude = (m: AbstractMesh) => m.name && (m.name.startsWith('measure_') || m.name.startsWith('preview_') || m.name.startsWith('measurement_'));
    const defaultScene = (m: AbstractMesh) => m.name && (/^ground$/i.test(m.name) || /^defaultBox$/i.test(m.name));
    const getBounds = (skipDefault: boolean) => {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      let count = 0;
      for (const m of scene.meshes) {
        if (alwaysExclude(m) || !m.isVisible) continue;
        if (skipDefault && defaultScene(m)) continue;
        m.computeWorldMatrix(true);
        const hv = (m as any).getHierarchyBoundingVectors?.();
        const min = hv ? hv.min : m.getBoundingInfo().boundingBox.minimumWorld;
        const max = hv ? hv.max : m.getBoundingInfo().boundingBox.maximumWorld;
        const sizeX = max.x - min.x, sizeY = max.y - min.y, sizeZ = max.z - min.z;
        if (sizeX < 1e-6 && sizeY < 1e-6 && sizeZ < 1e-6) continue;
        minX = Math.min(minX, min.x); minY = Math.min(minY, min.y); minZ = Math.min(minZ, min.z);
        maxX = Math.max(maxX, max.x); maxY = Math.max(maxY, max.y); maxZ = Math.max(maxZ, max.z);
        count++;
      }
      return { minX, minY, minZ, maxX, maxY, maxZ, count };
    };
    let bounds = getBounds(true);
    if (bounds.count === 0) bounds = getBounds(false);
    if (bounds.count === 0) {
      arcCam.setTarget(Vector3.Zero());
      arcCam.radius = 15;
      return;
    }
    const { minX, minY, minZ, maxX, maxY, maxZ } = bounds;
    const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.1);
    const wantedRadius = Math.max(size * 1.5, 2);
    const prevLower = arcCam.lowerRadiusLimit;
    const prevUpper = arcCam.upperRadiusLimit;
    arcCam.lowerRadiusLimit = 1;
    arcCam.upperRadiusLimit = Math.max(wantedRadius * 2, 1000);
    arcCam.setTarget(center);
    arcCam.radius = wantedRadius;
    arcCam.lowerRadiusLimit = prevLower;
    arcCam.upperRadiusLimit = prevUpper;
    showToast.success('Zoomed to fit model');
  }, []);

  // handle files selected via workspace import dialog
  const handleWorkspaceFileUpload = React.useCallback((files: FileList | null) => {
    if (!files || !sceneRef.current) return;
    Array.from(files).forEach(file => {
      const toastId = showToast.loading(`Loading ${file.name}...`, 'Starting');
      // No database id exists for an ad-hoc local file upload, but model-scoped
      // features (cost, sustainability, annotations, etc) still need *some* stable id
      // to key their data by - use a sanitized filename rather than leaving
      // currentModelId stuck on the generic 'default-model' placeholder.
      setCurrentModelId(`local-${file.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
      // @babylonjs/loaders must actually finish registering the format plugins (glTF/
      // OBJ/STL/etc) before SceneLoader.Append runs - see the matching fix in the
      // selected-model load effect above for what goes wrong if that's only fired off
      // without being awaited.
      Promise.all([
        import('@babylonjs/core/Loading/sceneLoader'),
        import('@babylonjs/loaders')
      ]).then(([{ SceneLoader }]) => {
        const meshesBefore = new Set(sceneRef.current!.meshes);
        // Pass the File object directly rather than a blob: URL. A blob URL has no
        // file extension, so Babylon can't reliably pick the right loader plugin for
        // non-GLB formats (OBJ/STL/FBX); File objects carry file.name, which Babylon
        // uses to detect the extension correctly for every supported format.
        SceneLoader.Append('', file, sceneRef.current!, () => {
          // Some exported CAD/BIM files mark certain nodes hidden (e.g. glTF's
          // KHR_node_visibility, from an alternate design option or hidden layer in the
          // source tool) - those load with isVisible=false and silently don't render,
          // while still being enabled/pickable, so clicking that empty-looking spot
          // selected an invisible mesh with no way to ever see it. This app has no UI for
          // toggling hidden layers back on, so treat "hidden in the source file" as a
          // loader quirk to override rather than a real feature.
          const newMeshes = sceneRef.current!.meshes.filter((m) => !meshesBefore.has(m));
          newMeshes.forEach((m) => { m.isVisible = true; });
          enhanceRealisticMaterials(newMeshes);
          removePlaceholderGeometry(sceneRef.current!);
          showToast.dismiss(toastId);
          showToast.success(`Model loaded: ${file.name}`);
          const s = sceneRef.current;
          if (s) {
            const run = () => runAutoZoom();
            s.onAfterRenderObservable.addOnce(() => {
              s.onAfterRenderObservable.addOnce(run);
            });
          } else runAutoZoom();
        }, (event) => {
          if (event.lengthComputable && event.total) {
            const pct = Math.round((event.loaded / event.total) * 100);
            showToast.update(toastId, `Loading ${file.name}...`, `${pct}%`);
          } else {
            const mb = (event.loaded / (1024 * 1024)).toFixed(1);
            showToast.update(toastId, `Loading ${file.name}...`, `${mb} MB loaded`);
          }
        }, (scene, message, exception) => {
          showToast.dismiss(toastId);
          showToast.error(`Failed to load ${file.name}`);
          console.error('load error', message, exception);
        });
      });
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [runAutoZoom]);

  // Babylon.js refs
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const pipelineRef = useRef<DefaultRenderingPipeline | null>(null);
  const ssaoPipelineRef = useRef<SSAORenderingPipeline | null>(null);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  // Shadow generator for the scene's "sun" light - lets Sun Study actually show
  // moving shadows instead of only a faint brightness/color shift.
  const shadowGeneratorRef = useRef<ShadowGenerator | null>(null);
  // Meshes imported by the last user-selected model (SceneLoader.Append only
  // ever adds meshes, never removes what was already there - without tracking
  // and disposing these first, loading a new/different model just piled its
  // meshes on top of whatever was loaded before).
  const loadedModelMeshesRef = useRef<AbstractMesh[]>([]);

  const switchCamera = useCallback((mode: 'orbit' | 'fly' | 'walk') => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!scene || !canvas) return;

    const previousCamera = cameraRef.current;
    if (previousCamera) {
      pipelineRef.current?.removeCamera(previousCamera);
      // SSAO pipeline doesn't have removeCamera method
      previousCamera.detachControl();
      previousCamera.dispose();
    }

    const applyMovementKeys = (cam: ArcRotateCamera | FreeCamera | UniversalCamera) => {
      cam.keysUp = [87, 38];
      cam.keysDown = [83, 40];
      cam.keysLeft = [65, 37];
      cam.keysRight = [68, 39];
    };

    let newCamera: ArcRotateCamera | FreeCamera | UniversalCamera;

    if (mode === 'fly') {
      newCamera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
      newCamera.speed = 0.5;
      newCamera.applyGravity = false;
    } else if (mode === 'walk') {
      newCamera = new UniversalCamera('camera', new Vector3(0, 1.8, -10), scene);
      newCamera.speed = 0.35;
      newCamera.checkCollisions = true;
      newCamera.applyGravity = true;
      (newCamera as UniversalCamera).ellipsoid = new Vector3(0.5, 1.7, 0.5);
    } else {
      newCamera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
      (newCamera as ArcRotateCamera).lowerRadiusLimit = 2;
      (newCamera as ArcRotateCamera).upperRadiusLimit = 30;
    }

    applyMovementKeys(newCamera);
    newCamera.attachControl(canvas, true);
    scene.activeCamera = newCamera;

    if (pipelineRef.current) {
      pipelineRef.current.addCamera(newCamera);
    }
    // SSAO pipeline doesn't have addCamera method - cameras are set during initialization

    cameraRef.current = newCamera as ArcRotateCamera;
    setCameraActive(true);
  }, [setCameraActive]);

  const handleCameraModeChange = useCallback((mode: 'orbit' | 'fly' | 'walk' | undefined) => {
    if (!mode) return;
    setCameraMode(mode);
  }, [setCameraMode]);

  useEffect(() => {
    if (!sceneRef.current) return;
    switchCamera(cameraMode);
  }, [cameraMode, switchCamera]);

  // AR managers and utils refs
  const cloudAnchorManagerRef = useRef<any>(null);
  const arCloudAnchorsRef = useRef<ARCloudAnchors | null>(null);
  const gpsTransformUtilsRef = useRef<GPSTransformUtils | null>(null);

  // Analytics and Feature Managers refs
  const analyticsManagerRef = useRef<AnalyticsManager | null>(null);
  const featureManagerRef = useRef<FeatureManager | null>(null);
  const animationManagerRef = useRef<AnimationManager | null>(null);
  const syncManagerRef = useRef<SyncManager | null>(null);
  const materialManagerRef = useRef<MaterialManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const bimManagerRef = useRef<BIMManager | null>(null);
  const geoSyncManagerRef = useRef<any>(null);
  const swimModeRef = useRef<SwimMode | null>(null);
  const underwaterModeRef = useRef<UnderwaterMode | null>(null);
  const externalAPIManagerRef = useRef<ExternalAPIManager | null>(null);
  const siteContextManagerRef = useRef<SiteContextManager | null>(null);
  const costEstimatorRef = useRef<CostEstimator | null>(null);
  const scenarioManagerRef = useRef<ScenarioManager | null>(null);
  const moodSceneManagerRef = useRef<MoodSceneManager | null>(null);

  // New specialized component refs
  const cameraViewsRef = useRef<any>(null);
  const circulationFlowSimulationRef = useRef<any>(null);
  const collabManagerRef = useRef<any>(null);
  const comprehensiveSimulationRef = useRef<any>(null);
  const constructionOverlayRef = useRef<any>(null);

  // XR Manager ref
  const xrManagerRef = useRef<XRManager | null>(null);

  // AI Manager ref
  const aiManagerRef = useRef<any>(null);

  // Mesh scene handlers hook
  const { handleMeshSelect } = useMeshSceneHandlers({
    sceneRef,
    cameraRef,
    selectedMesh,
    cameraActive,
    perspectiveActive,
    highlightLayerRef,
    onMeshSelect,
    updateState,
    featureStates
  });

  // Create feature categories mapping
  // Use featuresByCategory from useFeatureStates hook for feature categories
  // ...existing code...





  // Initialize Babylon.js scene and managers
  useEffect(() => {
    if (!canvasRef.current) return;

    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let camera: ArcRotateCamera | null = null;
    let analyticsManager: AnalyticsManager | null = null;
    let materialManager: MaterialManager | null = null;
    let syncManager: SyncManager | null = null;
    let animationManager: AnimationManager | null = null;
    let audioManager: AudioManager | null = null;
    let bimManager: BIMManager | null = null;
    let aiManager: AIManager | null = null;
    let xrManager: XRManager | null = null;
    let collabManager: CollabManager | null = null;
    let cloudAnchorManager: CloudAnchorManager | null = null;
    let geoSyncManager: GeoSyncManager | null = null;
    let isCancelled = false;
    const shouldAbort = () => isCancelled || !engine || engine.isDisposed;

    const initializeScene = async () => {
      try {
        // Create engine with error handling
        engine = new Engine(canvasRef.current!, true, { preserveDrawingBuffer: true });
        engineRef.current = engine;

        // A lost WebGL context (the GPU driver reclaiming memory under pressure - common
        // on phones/low-VRAM devices with a heavy model, or just too many tabs open) used
        // to leave the canvas silently frozen/black with no indication anything had gone
        // wrong and no way to recover short of the user guessing to reload. Babylon can't
        // reliably resume a complex scene with custom pipelines/managers in place after
        // this, so rather than attempt fragile in-place recovery, surface it plainly and
        // let the user reload - the same recovery path already used for the stale-deploy
        // chunk-load crash in BabylonErrorBoundary.
        engine.onContextLostObservable.add(() => {
          console.error('WebGL context lost');
          const message = 'Graphics context lost - this usually means the device ran out of GPU memory (a large model, or too many tabs/apps open). Please reload.';
          showToast.error(message);
          setCanvasError(message);
        });

        // Apply the renderingQuality setting as an actual hardware scaling level -
        // previously this prop was accepted but never used anywhere, so every device
        // (including headsets and phones with much less GPU power than a desktop)
        // always rendered at full native resolution regardless of what quality was
        // requested. 'auto' starts at this conservative mid-range default immediately
        // (detection below is async) and gets corrected to the real device-appropriate
        // level once DeviceDetector resolves.
        // Pulled back from more aggressive downscaling (was low:1.75/medium:1.25) after
        // it made model edges/corners visibly soft on real devices - the actual WebGL
        // crash risk this was originally guarding against was the context-leak bug in
        // DeviceDetector (fixed separately), not resolution itself, so there's room to
        // keep more native sharpness here.
        const qualityToScaling: Record<string, number> = {
          low: 1.3,     // render at ~77% resolution, upscaled
          medium: 1.1,  // ~91% resolution
          high: 1.0,    // native resolution
          ultra: 1.0    // native resolution (headroom reserved for post-processing/SSAO instead)
        };
        engine.setHardwareScalingLevel(renderingQuality === 'auto' ? qualityToScaling.medium : (qualityToScaling[renderingQuality] ?? 1.0));

        // Create scene
        scene = new Scene(engine);
        sceneRef.current = scene;
        if (externalSceneRef) {
          externalSceneRef.current = scene;
        }
        setSceneReadyForLoad(true);
        onSceneReady?.();

        // PBR materials (what every uploaded .glb/.gltf model uses natively) render
        // glass/metal/mirror surfaces flat or black with nothing to reflect - previously
        // the scene had no environment texture at all unless the user manually uploaded
        // an HDRI via the Lighting panel. This gives every model a reasonable-looking
        // default reflection environment immediately; LightingPresets.tsx's own HDRI
        // upload/sky-dome features still take over and replace this when used.
        try {
          scene.createDefaultEnvironment({ createSkybox: false, createGround: false });
          // This IBL texture contributes its own diffuse/specular lighting to every PBR
          // material on top of the hemi+directional lights below - at full strength that
          // stacked with them and washed highlights out toward white. Dimmed to a level
          // that still gives reflections something believable to show without
          // overpowering the scene's actual light sources.
          scene.environmentIntensity = 0.6;
        } catch (envError) {
          console.warn('Default environment texture unavailable (offline/CDN blocked?) - PBR reflections will be flat:', envError);
        }

        // Create camera with safe fallback
        const cameraTarget = Vector3.Zero();
        camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, cameraTarget, scene);
        camera.attachControl(canvasRef.current!, true);
        cameraRef.current = camera;

        // Create basic lighting (HemisphericLight for ambient)
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(1, 1, 0), scene);
        hemiLight.intensity = 0.4;
        // Add DirectionalLight (sun) for LightingPresets to control
        const dirLight = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
        dirLight.position = new Vector3(10, 20, 10);
        dirLight.intensity = 1.2;

        // Shadow casting for the sun light - without this, Sun Study (and any
        // other tool that moves "sun") only produces a faint brightness/color
        // shift with no actual moving shadows, which is the whole visible point
        // of simulating time-of-day.
        const shadowGenerator = new ShadowGenerator(1024, dirLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 32;
        shadowGeneratorRef.current = shadowGenerator;

        // Placeholder ground + box so there's something to click/test tools on
        // in an empty workspace - but a real model was requested (e.g. Preview
        // after upload, or opening an assigned model), so skip them entirely
        // rather than leaving them sitting alongside the real upload looking
        // like stray extra geometry.
        if (!selectedModel?.modelUrl) {
          const ground = Mesh.CreateGround("ground", 10, 10, 2, scene);
          ground.receiveShadows = true;
          const groundMaterial = new StandardMaterial("groundMaterial", scene);
          groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
          ground.material = groundMaterial;

          const box = Mesh.CreateBox("defaultBox", 1.5, scene);
          box.position = new Vector3(0, 0.75, 0);
          const boxMaterial = new StandardMaterial("boxMaterial", scene);
          boxMaterial.diffuseColor = new Color3(0.2, 0.5, 0.9);
          box.material = boxMaterial;
        }

        // Set up post-processing pipeline
        if (enablePostProcessing) {
          const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
          // Filmic tonemapping is what gives Enscape/Lumion/D5-style renders their
          // characteristic look (rolled-off highlights instead of harshly clipping to
          // white) - Babylon defaults this to off, which is a big part of why the
          // viewport looked flatter/harsher than those tools even with correct PBR
          // materials and lighting.
          pipeline.imageProcessing.toneMappingEnabled = true;
          pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
          pipeline.imageProcessing.contrast = 1.0;
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

        // Set up SSAO if enabled
        if (enableSSAO) {
          const ssao = new SSAORenderingPipeline("ssao", scene, 1.0);
          ssao.totalStrength = ssaoIntensity;
          ssao.base = 0.5;
          ssao.radius = 0.0001;
          ssao.area = 0.0075;
          ssao.fallOff = 0.000001;
          ssaoPipelineRef.current = ssao;
        }

        // Initialize HighlightLayer
        const highlightLayer = new HighlightLayer("highlightLayer", scene);
        highlightLayerRef.current = highlightLayer;

        // Detect device capabilities
        const deviceDetector = new (DeviceDetector as any)();
        const detectedCapabilities = deviceDetector.detectCapabilities();

        let capabilities: any;
        if (detectedCapabilities instanceof Promise) {
          capabilities = await detectedCapabilities;
        } else {
          capabilities = detectedCapabilities;
        }
        setDeviceCapabilities(capabilities);

        // Now that the device's actual capability is known, correct the conservative
        // guess applied at engine creation above to what this specific device can
        // really handle - a weak/mobile GPU gets scaled down further (reducing the
        // risk of running out of graphics memory on a heavy model), while a capable
        // desktop gets scaled back up to native resolution instead of staying stuck at
        // the mid-range default.
        const resolvedQuality = renderingQuality === 'auto' ? deviceDetector.getRecommendedQuality() : renderingQuality;
        if (renderingQuality === 'auto' && !shouldAbort()) {
          engine.setHardwareScalingLevel(qualityToScaling[resolvedQuality] ?? qualityToScaling.medium);
        }

        // Sharper textures at oblique viewing angles (a wall/floor texture stays crisp
        // instead of turning to mush toward the horizon) - this was never actively set
        // for uploaded models, since glTF import loads textures straight through
        // Babylon's own loader rather than any app code that could configure it.
        // Capped lower on weak/mobile GPUs, where high anisotropic filtering has a real
        // sampling cost per pixel.
        Texture.DEFAULT_ANISOTROPIC_FILTERING_LEVEL = (resolvedQuality === 'low' || resolvedQuality === 'medium') ? 4 : 8;

        // Screen-space reflections were tried here and pulled back out - SSR is
        // inherently prone to flickering under camera movement (the ray-marched
        // intersection shifts frame to frame near geometry edges/gaps), and that
        // showed up as visible flicker/"blinking" on the model with no way to tune it
        // further without live device testing. Reflections now come only from the
        // environment texture above, which is stable even if less dynamic.

        // Initialize FeatureManager
        const featureManager = new FeatureManager(capabilities);
        featureManagerRef.current = featureManager;

        // Initialize managers with comprehensive error handling
        try {
          analyticsManager = new AnalyticsManager(engine, scene, featureManager);
          analyticsManagerRef.current = analyticsManager;
          console.log("AnalyticsManager initialized successfully");
        } catch (error) {
          console.error("Failed to initialize AnalyticsManager:", error);
          showToast.error("Analytics features unavailable");
        }

        try {
          materialManager = new MaterialManager(scene);
          materialManagerRef.current = materialManager;
          console.log("MaterialManager initialized successfully");
        } catch (error) {
          console.error("Failed to initialize MaterialManager:", error);
          showToast.error("Material features unavailable");
        }

        try {
          const simManager = new SimulationManager(engine, scene, featureManager);
          simulationManagerRef.current = simManager;
          console.log("SimulationManager initialized successfully");
        } catch (error) {
          console.error("Failed to initialize SimulationManager:", error);
          showToast.error("Simulation features unavailable");
        }

        try {
          const userId = 'local-user';
          syncManager = new SyncManager(null, scene, userId);
          animationManager = new AnimationManager(scene, syncManager);
          animationManagerRef.current = animationManager;
          syncManagerRef.current = syncManager;
          console.log("Animation/SyncManager initialized successfully");
        } catch (error) {
          console.error("Failed to initialize Animation/SyncManager:", error);
          showToast.error("Animation features unavailable");
        }

        // Always create the AudioManager - the Spatial Audio panel (music
        // upload/volume/mute) needs it regardless of whether 3D spatial
        // positioning is turned on, and nothing ever actually passes
        // enableSpatialAudio=true into this component, so gating creation
        // behind that flag left audioManagerRef permanently null and the
        // panel stuck on "Audio system isn't ready yet" forever. Spatial
        // mode itself is still toggled separately below via
        // enableSpatialAudio()/disableSpatialAudio().
        try {
          audioManager = new AudioManager(scene);
          audioManagerRef.current = audioManager;
          console.log("AudioManager initialized successfully");
        } catch (error) {
          console.error("Failed to initialize AudioManager:", error);
          showToast.error("Audio features unavailable");
        }

        // Initialize CloudAnchorManager
        try {
          cloudAnchorManager = new CloudAnchorManager(scene);
          cloudAnchorManagerRef.current = cloudAnchorManager;
          const success = await cloudAnchorManager.connect();
          if (success) {
            console.log("CloudAnchorManager initialized successfully");
            // Add event listeners for cloud anchor events
            cloudAnchorManager.addEventListener((event) => {
              switch (event.type) {
                case 'anchor_created':
                  showToast.success(`Cloud anchor "${event.data?.name || event.anchorId}" created`);
                  break;
                case 'anchor_deleted':
                  showToast.info(`Cloud anchor "${event.anchorId}" deleted`);
                  break;
                case 'anchor_updated':
                  console.log(`Cloud anchor "${event.anchorId}" updated`);
                  break;
                case 'sync_completed':
                  showToast.success("Cloud anchors synchronized");
                  break;
              }
            });
          } else {
            console.error("CloudAnchorManager failed to initialize");
            showToast.error("Cloud anchor features unavailable");
          }
        } catch (error) {
          console.error("Failed to initialize CloudAnchorManager:", error);
          showToast.error("Cloud anchor features unavailable");
        }

        // ARAnchorUI (the actual Cloud Anchors panel - see uiSegments.tsx) needs these
        // two lightweight companions alongside CloudAnchorManager above: ARCloudAnchors
        // for the local anchor list the panel displays, GPSTransformUtils for its
        // optional GPS-coordinate fields. Neither talks to a backend on its own.
        try {
          arCloudAnchorsRef.current = new ARCloudAnchors(scene, () => !!xrManagerRef.current?.getXRState().isInSession);
          gpsTransformUtilsRef.current = new GPSTransformUtils();
        } catch (error) {
          console.error("Failed to initialize AR anchor UI helpers:", error);
        }

        // Initialize CollabManager
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const realUserId = authUser?.id || `guest_${Math.random().toString(36).substr(2, 9)}`;
          const realUserName = authUser?.user_metadata?.username || authUser?.email || 'Guest';
          collabManager = new CollabManager(scene, { userId: realUserId, userName: realUserName });
          collabManager.setLocalCameraProvider(() => {
            const cam = cameraRef.current;
            if (!cam) return null;
            return {
              position: cam.position,
              rotation: cam.rotationQuaternion || Quaternion.Identity()
            };
          });
          collabManagerRef.current = collabManager;
          console.log("CollabManager initialized");
          // Add event listeners for collaboration events
          collabManager.addEventListener((event) => {
            switch (event.type) {
              case 'user_joined':
                showToast.success(`User "${event.data?.name || event.userId}" joined the session`);
                break;
              case 'user_left':
                showToast.info(`User "${event.userId}" left the session`);
                break;
              case 'user_moved':
                // Don't show toast for every movement, just log
                console.log(`User "${event.userId}" moved`);
                break;
              case 'object_created':
                showToast.success(`Object "${event.data?.name || event.objectId}" created`);
                break;
              case 'object_updated':
                console.log(`Object "${event.objectId}" updated`);
                break;
              case 'object_deleted':
                showToast.info(`Object "${event.objectId}" deleted`);
                break;
            }
          });
        } catch (error) {
          console.error("Failed to initialize CollabManager:", error);
          showToast.error("Collaboration features unavailable");
        }

        // Initialize GeoSyncManager
        try {
          geoSyncManager = new GeoSyncManager(scene);
          geoSyncManagerRef.current = geoSyncManager;
          console.log("GeoSyncManager initialized");
        } catch (error) {
          console.error("Failed to initialize GeoSyncManager:", error);
          showToast.error("Geo sync features unavailable");
        }

        // Initialize BIMManager
        try {
          bimManager = new BIMManager(engine, scene);
          bimManagerRef.current = bimManager;
          // Skip the demo/placeholder model when the workspace was opened to
          // load a specific model (e.g. Preview after upload) - otherwise the
          // demo geometry sits in the scene alongside (or ahead of) the real
          // model and looks like "my upload isn't showing, only the default
          // model is".
          if (typeof bimManager.loadDemoModel === 'function' && !selectedModel?.modelUrl) {
            await bimManager.loadDemoModel();
            console.log("BIMManager initialized with demo model");
          } else {
            console.log("BIMManager initialized" + (selectedModel?.modelUrl ? " (demo model skipped, loading selected model)" : ""));
          }
        } catch (error) {
          console.error("Failed to initialize BIMManager:", error);
          showToast.error("BIM features unavailable");
        }

        // Initialize SustainabilityManager (real carbon/water footprint reporting on
        // the loaded model) - existed as a fully working class but was never wired in.
        try {
          if (bimManagerRef.current && simulationManagerRef.current) {
            sustainabilityManagerRef.current = new SustainabilityManager(bimManagerRef.current, simulationManagerRef.current);
            console.log("SustainabilityManager initialized successfully");
          }
        } catch (error) {
          console.error("Failed to initialize SustainabilityManager:", error);
        }

        // Initialize AIManager
        try {
          aiManager = new AIManager(scene, canvasRef.current!, handleFeatureToggle);
          aiManagerRef.current = aiManager;
          if (featureStates.showVoiceAssistant) {
            aiManager.startVoiceListening();
          }
          console.log("AIManager initialized");
        } catch (error) {
          console.error("Failed to initialize AIManager:", error);
          showToast.error("AI features unavailable");
        }

        // Initialize ExternalAPIManager + SiteContextManager (real-world surrounding
        // terrain/buildings generation around the workspace's geo location)
        try {
          if (featureManagerRef.current) {
            externalAPIManagerRef.current = new ExternalAPIManager(engine, scene, featureManagerRef.current);
          }
          if (
            featureManagerRef.current &&
            geoSyncManagerRef.current &&
            externalAPIManagerRef.current &&
            aiManagerRef.current &&
            simulationManagerRef.current &&
            bimManagerRef.current
          ) {
            siteContextManagerRef.current = new SiteContextManager(
              engine,
              scene,
              featureManagerRef.current,
              geoSyncManagerRef.current,
              externalAPIManagerRef.current,
              aiManagerRef.current,
              simulationManagerRef.current,
              bimManagerRef.current
            );
            console.log("SiteContextManager initialized");
          }
        } catch (error) {
          console.error("Failed to initialize SiteContextManager:", error);
        }

        // Initialize CostEstimator (real material/labor cost breakdown from the loaded
        // BIM model - feeds the ROI Calculator)
        try {
          if (bimManagerRef.current && simulationManagerRef.current) {
            costEstimatorRef.current = new CostEstimator(bimManagerRef.current, simulationManagerRef.current);
            console.log("CostEstimator initialized");
          }
        } catch (error) {
          console.error("Failed to initialize CostEstimator:", error);
        }

        // Initialize ScenarioManager (presentation scenarios: time-of-day/weather/
        // lighting presets with camera transitions - powers Immersive Scenarios,
        // Presentation Mode, and Comparative Tour, which are all this same capability)
        try {
          scenarioManagerRef.current = new ScenarioManager(engine, scene);
          console.log("ScenarioManager initialized");
        } catch (error) {
          console.error("Failed to initialize ScenarioManager:", error);
        }

        // Initialize MoodSceneManager (real pre-built mood/lighting presets - Cozy,
        // Dramatic, etc - never wired into the app despite being fully implemented)
        try {
          if (bimManagerRef.current) {
            moodSceneManagerRef.current = new MoodSceneManager(scene, bimManagerRef.current);
            console.log("MoodSceneManager initialized");
          }
        } catch (error) {
          console.error("Failed to initialize MoodSceneManager:", error);
        }

        // Initialize XRManager
        try {
          xrManager = new XRManager(scene);
          xrManagerRef.current = xrManager;
          console.log("XRManager initialized");
        } catch (error) {
          console.error("Failed to initialize XRManager:", error);
          showToast.error("XR features unavailable");
        }

        // Connect AudioManager to XRManager if both are available
        if (enableSpatialAudio && audioManager && xrManager) {
          xrManager.setAudioManager(audioManager);
        }

        // Initialize GeoLocation if enabled
        if (featureStates.showGeoLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("GeoLocation initialized:", position);
              if (cameraRef.current) {
                cameraRef.current.position = new Vector3(position.coords.longitude * 0.01, position.coords.latitude * 0.01, 10);
              }
            },
            (error) => {
              console.error("GeoLocation error:", error);
              showToast.error("Location services unavailable");
            }
          );
        }

        // Start render loop
        if (shouldAbort()) {
          console.warn("Babylon workspace initialization aborted before render loop");
          return () => {};
        }
        engine.runRenderLoop(() => {
          scene!.render();
          // Update managers that need per-frame updates
          if (audioManager && typeof audioManager.update === 'function') {
            audioManager.update();
          }
          if (xrManager && typeof xrManager.update === 'function') {
            xrManager.update();
          }
          if (collabManager && typeof collabManager.update === 'function') {
            collabManager.update();
          }
        });

        // Handle window resize
        const handleResize = () => {
          if (engine) {
            engine.resize();
          }
        };
        if (shouldAbort()) {
          console.warn("Babylon workspace initialization aborted during window setup");
          return () => {};
        }
        window.addEventListener('resize', handleResize);

        // Mark as initialized
        if (!shouldAbort()) {
          setIsInitialized(true);
        }

        // Store cleanup function references
        return () => {
          window.removeEventListener('resize', handleResize);
        };

      } catch (error) {
        console.error('Failed to initialize Babylon.js scene:', error);
        // This catch spans engine/scene/camera/lighting/pipeline setup, so a bug in any
        // one of those (not just an actually-missing WebGL context) lands here too.
        // Surfacing the real message instead of a blanket "WebGL may not be supported"
        // is the difference between a debuggable report and a dead end.
        //
        // Deliberately NOT branching on Engine.isSupported() here: it caches its result
        // in a static field the first time it's called (see @babylonjs/core's
        // ThinEngine.isSupported), so a single transient failure - e.g. hitting the
        // browser's WebGL context limit from repeated navigation in/out of this page -
        // gets remembered as "unsupported" for the rest of the tab's life, permanently
        // showing this generic message even once contexts free back up.
        const detail = error instanceof Error ? error.message : String(error);
        const message = `Failed to initialize 3D workspace: ${detail}`;
        showToast.error(message);
        setCanvasError(message);
      }
    };

    // Initialize and store cleanup
    const cleanupPromise = initializeScene();

    // Cleanup function
    return () => {
      isCancelled = true;
      cleanupPromise.then((cleanup) => {
        if (cleanup) cleanup();
      });

      // Dispose all managers and resources
      try {
        if (analyticsManager && typeof analyticsManager.dispose === 'function') {
          analyticsManager.dispose();
        }
        if (animationManager && typeof animationManager.dispose === 'function') {
          animationManager.dispose();
        }
        if (syncManager && typeof syncManager.dispose === 'function') {
          syncManager.dispose();
        }
        if (materialManager && typeof materialManager.dispose === 'function') {
          materialManager.dispose();
        }
        if (audioManager && typeof audioManager.dispose === 'function') {
          audioManager.dispose();
        }
        if (cloudAnchorManager && typeof cloudAnchorManager.dispose === 'function') {
          cloudAnchorManager.dispose();
        }
        if (collabManager && typeof collabManager.dispose === 'function') {
          collabManager.dispose();
        }
        if (geoSyncManager && typeof geoSyncManager.dispose === 'function') {
          geoSyncManager.dispose();
        }
        if (scenarioManagerRef.current && typeof scenarioManagerRef.current.dispose === 'function') {
          scenarioManagerRef.current.dispose();
        }
        if (bimManager && typeof bimManager.dispose === 'function') {
          bimManager.dispose();
        }
        if (aiManager && typeof aiManager.dispose === 'function') {
          aiManager.dispose();
        }
        if (xrManager && typeof xrManager.dispose === 'function') {
          xrManager.dispose();
        }
        if (weatherRainRef.current) {
          weatherRainRef.current.stop();
          const tex = weatherRainRef.current.particleTexture;
          weatherRainRef.current.dispose();
          if (tex) tex.dispose();
          weatherRainRef.current = null;
        }
        if (weatherSnowRef.current) {
          weatherSnowRef.current.stop();
          const tex = weatherSnowRef.current.particleTexture;
          weatherSnowRef.current.dispose();
          if (tex) tex.dispose();
          weatherSnowRef.current = null;
        }
        if (floodWaterRef.current) {
          floodWaterRef.current.mesh.dispose();
          floodWaterRef.current.material.dispose();
          floodWaterRef.current.bodyMesh.dispose();
          floodWaterRef.current.bodyMaterial.dispose();
          floodWaterRef.current = null;
        }
        if (scene) {
          scene.dispose();
        }
        if (engine) {
          engine.dispose();
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    };
    // NOTE: this effect creates the engine/scene/camera/lights/all managers ONCE on mount.
    // It intentionally does NOT depend on enablePostProcessing/enableBloom/enableSSAO/etc,
    // or on featureStates.showVoiceAssistant/showGeoLocation - those used to be in this
    // effect's dependency array, which meant toggling any one of them (e.g. clicking the
    // Voice Assistant button) destroyed and rebuilt the ENTIRE 3D scene: the loaded model,
    // camera position, and every manager were lost. Those toggles are now each handled by
    // their own small effect further below that updates the existing pipeline/manager
    // in place, without touching the engine or scene.
  }, []);

  // Reactively create/dispose the post-processing pipeline itself when toggled after mount
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    if (enablePostProcessing && !pipelineRef.current) {
      const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      pipeline.imageProcessing.contrast = 1.0;
      pipelineRef.current = pipeline;
    } else if (!enablePostProcessing && pipelineRef.current) {
      pipelineRef.current.dispose();
      pipelineRef.current = null;
    }
  }, [enablePostProcessing]);

  // Reactively create/dispose the SSAO pipeline itself when toggled after mount
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (enableSSAO && !ssaoPipelineRef.current) {
      const ssao = new SSAORenderingPipeline("ssao", scene, 1.0);
      ssao.totalStrength = ssaoIntensity;
      ssao.base = 0.5;
      ssao.radius = 0.0001;
      ssao.area = 0.0075;
      ssao.fallOff = 0.000001;
      ssaoPipelineRef.current = ssao;
    } else if (!enableSSAO && ssaoPipelineRef.current) {
      ssaoPipelineRef.current.dispose();
      ssaoPipelineRef.current = null;
    }
  }, [enableSSAO]);

  // Reactively update post-processing pipeline settings without recreating the scene
  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;
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
  }, [enableBloom, bloomIntensity, enableDepthOfField, depthOfFieldFocusDistance, enableGrain, grainIntensity, enableVignette, vignetteIntensity]);

  // Reactively update SSAO settings without recreating the scene
  useEffect(() => {
    const ssao = ssaoPipelineRef.current;
    if (!ssao) return;
    ssao.totalStrength = ssaoIntensity;
  }, [enableSSAO, ssaoIntensity]);

  // Reactively toggle spatial audio without recreating AudioManager
  useEffect(() => {
    const audioManager = audioManagerRef.current;
    if (!audioManager) return;
    if (enableSpatialAudio) {
      audioManager.enableSpatialAudio();
    } else {
      audioManager.disableSpatialAudio();
    }
  }, [enableSpatialAudio]);

  // Reactively toggle voice assistant listening without recreating AIManager
  useEffect(() => {
    const aiManager = aiManagerRef.current;
    if (!aiManager) return;
    if (featureStates.showVoiceAssistant) {
      aiManager.startVoiceListening();
    } else {
      aiManager.stopVoiceListening();
    }
  }, [featureStates.showVoiceAssistant]);

  // Move/Rotate/Scale gizmo tools - previously completely absent from the live app
  // (Toolbar.tsx had button props for these but was dead code, never wired to any
  // actual Babylon gizmo). Attaches to workspaceState.selectedMesh (see the click-to-select
  // effect below) and records a pre-drag snapshot for undo.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const gizmoManager = new GizmoManager(scene);
    gizmoManager.usePointerToAttachGizmos = false; // we control attachment via selectedMesh instead
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManagerRef.current = gizmoManager;

    return () => {
      gizmoManager.dispose();
      gizmoManagerRef.current = null;
    };
  }, []);

  // Attach the gizmo to whatever is currently selected
  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current;
    const mesh = workspaceState.selectedMesh;
    if (!gizmoManager) return;
    gizmoManager.attachToMesh(mesh || null);
  }, [workspaceState.selectedMesh]);

  // Switch which gizmo (move/rotate/scale) is active, and record an undo snapshot the
  // moment a drag starts on the currently-active gizmo.
  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current;
    if (!gizmoManager) return;

    gizmoManager.positionGizmoEnabled = transformMode === 'position';
    gizmoManager.rotationGizmoEnabled = transformMode === 'rotation';
    gizmoManager.scaleGizmoEnabled = transformMode === 'scale';

    const recordSnapshot = () => {
      const mesh = workspaceState.selectedMesh;
      if (!mesh) return;
      undoHistoryRef.current.push({
        kind: 'transform',
        mesh,
        position: mesh.position.clone(),
        rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
        rotation: mesh.rotation.clone(),
        scaling: mesh.scaling.clone(),
      });
      // Cap history so it can't grow unbounded during a long editing session
      if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift();
    };

    const gizmos = [gizmoManager.gizmos.positionGizmo, gizmoManager.gizmos.rotationGizmo, gizmoManager.gizmos.scaleGizmo];
    const disposers: Array<() => void> = [];
    gizmos.forEach((gizmo) => {
      if (!gizmo) return;
      const observer = gizmo.onDragStartObservable.add(recordSnapshot);
      disposers.push(() => gizmo.onDragStartObservable.remove(observer));
    });

    return () => { disposers.forEach((d) => d()); };
  }, [transformMode, workspaceState.selectedMesh]);

  // Click-to-select: clicking any real object mesh in the scene selects it, which
  // Material Editor, Smart Alternatives, and other selection-aware panels rely on via
  // workspaceState.selectedMesh. This was previously completely missing - setSelectedMesh
  // existed on the state hook but nothing in the scene ever actually called it.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Exclude helper/UI geometry (measurement lines, cursor markers, annotation pins,
    // teleport/AR-scale helper meshes) so clicking a tool's own visual aid doesn't
    // accidentally "select" it as if it were part of the design.
    const isSelectableMesh = (mesh: AbstractMesh) =>
      mesh.isEnabled() && mesh.isVisible && mesh.isPickable &&
      !/^(ground|ceiling_light|measure_|annotation_pin_|cursor_|collab_|sound_privacy_marker_|__root__)/i.test(mesh.name || '');

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      // Don't steal the click if a mode that handles its own picking is active (teleport
      // navigation already interprets clicks as "move here", not "select this"; the
      // Measurement Tool interprets clicks as "place a measurement point" - this second
      // guard used to be missing here, so clicking to measure also selected the mesh
      // underneath, popping the Move/Rotate/Scale toolbar and Property Inspector mid-measurement).
      if (featureStates.showTeleportManager || featureStates.showMeasurementTool) return;

      const pickResult = scene.pick(scene.pointerX, scene.pointerY, isSelectableMesh);
      if (pickResult?.hit && pickResult.pickedMesh) {
        setSelectedMesh(pickResult.pickedMesh as Mesh);
      }
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [featureStates.showTeleportManager, featureStates.showMeasurementTool]);

  // Desktop click-to-teleport: when active, clicking a floor/walkable surface smoothly
  // moves the camera there. This is the desktop equivalent of the VR teleportation
  // already wired up in XRManager (which uses controller pointing instead of a mouse
  // click) - same floor-detection approach, different input method.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!featureStates.showTeleportManager || !scene) return;

    const isFloorMesh = (mesh: AbstractMesh) =>
      mesh.isEnabled() && mesh.isPickable && /ground|floor|terrain|site|plot|land/i.test(mesh.name || '');

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, isFloorMesh);
      if (!pickResult?.hit || !pickResult.pickedPoint) {
        showToast.info('Click on the floor/ground to teleport there');
        return;
      }

      const camera = cameraRef.current;
      const destination = pickResult.pickedPoint;
      if (camera) {
        // Keep the camera's height/orbit distance, just move where it's looking
        const heightOffset = camera.position.y - camera.target.y;
        camera.setTarget(new Vector3(destination.x, destination.y, destination.z));
        camera.position = new Vector3(camera.position.x, destination.y + heightOffset, camera.position.z);
      }
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [featureStates.showTeleportManager]);

  // Underwater/Swim Mode: create real underwater visual effects (caustics, bubbles,
  // fog, modified lighting) and swim physics when toggled on. Both classes existed
  // fully built but were never instantiated anywhere in the app.
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!featureStates.showSwimMode || !scene || !camera) return;

    let underwater: UnderwaterMode | null = null;
    let swim: SwimMode | null = null;
    let updateObserver: any = null;

    try {
      underwater = new UnderwaterMode(scene, camera, { waterLevel: 0 });
      underwaterModeRef.current = underwater;
      underwater.activate();

      swim = new SwimMode(scene, camera, underwater, {
        waterLevel: 0,
        swimSpeed: 2,
        buoyancyForce: 0.5,
        surfaceTension: 0.1,
        enableExitRails: true,
        railDistance: 5,
        railHeight: 1.2,
        railMaterial: null,
        enableVRComfort: true,
        comfortZoneRadius: 3,
      });
      swimModeRef.current = swim;

      updateObserver = scene.onBeforeRenderObservable.add(() => {
        underwater?.update();
      });
    } catch (error) {
      console.error('Failed to enable underwater/swim mode:', error);
      showToast.error('Underwater mode unavailable', error instanceof Error ? error.message : 'This device may not support the required effects');
    }

    return () => {
      if (updateObserver) scene.onBeforeRenderObservable.remove(updateObserver);
      swim?.dispose();
      underwater?.deactivate();
      underwater?.dispose();
      swimModeRef.current = null;
      underwaterModeRef.current = null;
    };
    // Re-run on cameraMode changes too - switchCamera() disposes and replaces
    // cameraRef.current, so without this dependency the caustics post-process
    // stayed bound to a since-disposed camera object after switching to
    // walk/dollhouse mode while underwater mode was already active.
  }, [featureStates.showSwimMode, cameraMode]);

  // Broadcast the local user's pointer position to other participants when Multi User
  // mode is active, so everyone can see where teammates are pointing in the scene.
  useEffect(() => {
    const scene = sceneRef.current;
    const collab = collabManagerRef.current;
    if (!featureStates.showMultiUser || !scene || !collab) return;

    let lastSent = 0;
    const THROTTLE_MS = 100; // ~10 updates/sec is plenty for a pointer indicator

    const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERMOVE) return;
      const now = performance.now();
      if (now - lastSent < THROTTLE_MS) return;
      lastSent = now;

      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (pickResult?.hit && pickResult.pickedPoint) {
        collab.updateCursorPosition(pickResult.pickedPoint);
      } else {
        collab.updateCursorPosition(null);
      }
    });

    return () => {
      scene.onPointerObservable.remove(pointerObserver);
      collab.updateCursorPosition(null);
    };
  }, [featureStates.showMultiUser]);

  // Reactively handle geolocation without recreating the scene
  useEffect(() => {
    if (!featureStates.showGeoLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("GeoLocation updated:", position);
        if (cameraRef.current) {
          cameraRef.current.position = new Vector3(position.coords.longitude * 0.01, position.coords.latitude * 0.01, 10);
        }
      },
      (error) => {
        console.warn("GeoLocation error:", error);
      }
    );
  }, [featureStates.showGeoLocation]);

  // Handlers
  // ...existing code...





  // Animation handlers
  const handleAnimationCreate = (sequence: any) => {
    // Convert AnimationSequence to AnimationGroup format if needed
    const animationGroup: AnimationInterfaces.AnimationGroup = {
      id: sequence.id,
      name: sequence.name,
      animations: [], // Will be populated by AnimationManager
      targetMeshes: [], // Will be populated by AnimationManager
      speedRatio: 1.0,
      weight: 1.0,
      isPlaying: false,
      isLooping: sequence.loop,
      from: 0,
      to: sequence.duration || 100
    };

    setAnimationGroups((prev: AnimationInterfaces.AnimationGroup[]) => [...prev, animationGroup]);
    setCurrentAnimation(animationGroup);
    if (onAnimationCreate) {
      onAnimationCreate(animationGroup);
    }
  };

  // Animation play handler for AnimationTimeline
  const handleSequencePlay = (sequenceId: string, options?: any) => {
    if (!animationManagerRef.current) return;
    animationManagerRef.current.playAnimation(sequenceId, options);
  };


  // Material handlers
  const handleMaterialChange = (materialState: MaterialInterfaces.MaterialState) => {
    setMaterials(prev => {
      const index = prev.findIndex(m => m.id === materialState.id);
      if (index >= 0) {
        const newMaterials = [...prev];
        newMaterials[index] = materialState;
        return newMaterials;
      } else {
        return [...prev, materialState];
      }
    });
    setCurrentMaterial(materialState);
    if (onMaterialChange) {
      onMaterialChange(materialState);
    }
  };

  const handleMaterialApplied = useCallback((mesh: Mesh, material: Material) => {
    // Apply material to mesh
    mesh.material = material;
    // Update selected mesh if it's the same
    if (selectedMesh === mesh) {
      // setSelectedMesh is already available from workspaceState
      updateState({ selectedMesh: mesh });
    }
    // Call onMaterialChange if needed
    if (onMaterialChange) {
      // Safely access material properties with fallbacks
      const materialId = (material as any).id || String(material.uniqueId) || `material_${Date.now()}`;
      const materialName = (material as any).name || `Material ${materialId}`;

      onMaterialChange({
        id: String(materialId),
        name: String(materialName),
        type: material instanceof PBRMaterial ? 'pbr' : 'standard',
        properties: material,
        isActive: true,
        lastModified: Date.now()
      });
    }
  }, [selectedMesh, onMaterialChange, updateState]);






  const onRainToggle = useCallback((on: boolean) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (on) {
      if (weatherRainRef.current) {
        weatherRainRef.current.start();
        setRainOn(true);
        showToast.success('Rain on');
        return;
      }
      try {
        const { centerX, centerZ, topY, halfExtent } = computePrecipitationBounds(scene);

        const ps = new ParticleSystem('weatherRainParticles', 4000, scene);
        ps.particleTexture = createRainDropTexture(scene);
        ps.emitter = new Vector3(centerX, topY, centerZ);
        ps.minEmitBox = new Vector3(-halfExtent, 0, -halfExtent);
        ps.maxEmitBox = new Vector3(halfExtent, 0, halfExtent);
        ps.color1 = new Color4(0.75, 0.85, 1.0, 0.9);
        ps.color2 = new Color4(0.85, 0.92, 1.0, 0.7);
        ps.colorDead = new Color4(0.85, 0.92, 1.0, 0);
        // Sized relative to the actual loaded model (via halfExtent, computed above from
        // real bounds) AND the user's Particle Size control - the original fixed
        // 0.008-0.04 size was tuned for a small ~10-unit test scene and was next to
        // invisible against a real building viewed from a realistic camera distance.
        const rainSizeScale = Math.max(halfExtent / 15, 1) * particleSize;
        ps.minSize = 0.15 * rainSizeScale;
        ps.maxSize = 0.4 * rainSizeScale;
        ps.minLifeTime = 1.5;
        ps.maxLifeTime = 3.5;
        ps.emitRate = 1200 * rainIntensity; // quantity
        ps.direction1 = new Vector3(-0.05, -1, -0.05);
        ps.direction2 = new Vector3(0.05, -1, 0.05);
        ps.minEmitPower = 6 * rainIntensity; // fall speed
        ps.maxEmitPower = 14 * rainIntensity;
        ps.gravity = new Vector3(0, -6, 0);
        ps.updateSpeed = 0.02;
        ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
        // Stop rain at the roof/ground instead of falling straight through into the
        // building's interior.
        attachSurfaceCollision(ps, buildPrecipitationHeightmap(scene, centerX, centerZ, halfExtent, topY));
        ps.start();
        weatherRainRef.current = ps;
        setRainOn(true);
        showToast.success('Rain on');
      } catch (e) {
        console.error('Rain start failed:', e);
        showToast.error('Failed to start rain');
      }
    } else {
      if (weatherRainRef.current) {
        weatherRainRef.current.stop();
        const tex = weatherRainRef.current.particleTexture;
        weatherRainRef.current.dispose();
        if (tex) tex.dispose();
        weatherRainRef.current = null;
      }
      const existing = scene.particleSystems.find((p: any) => p.name === 'weatherRainParticles');
      if (existing) {
        existing.stop();
        const t = existing.particleTexture;
        existing.dispose();
        if (t) t.dispose();
      }
      setRainOn(false);
      showToast.success('Rain off');
    }
  }, [rainIntensity, particleSize]);

  const onSnowToggle = useCallback((on: boolean) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (on) {
      if (weatherSnowRef.current) {
        weatherSnowRef.current.start();
        setSnowOn(true);
        showToast.success('Snow on');
        return;
      }
      try {
        const { centerX, centerZ, topY, halfExtent } = computePrecipitationBounds(scene);

        const ps = new ParticleSystem('weatherSnowParticles', 6000, scene);
        ps.particleTexture = createSnowflakeTexture(scene);
        ps.emitter = new Vector3(centerX, topY, centerZ);
        ps.minEmitBox = new Vector3(-halfExtent, 0, -halfExtent);
        ps.maxEmitBox = new Vector3(halfExtent, 0, halfExtent);
        // Pure white at low speed/density read as almost invisible against the app's
        // default pale/overcast sky - barely-there specks that never moved enough to
        // notice, which is what "snow doesn't work" actually was. A cooler, slightly
        // dimmer tint keeps snow looking natural while giving it real contrast against
        // a light sky, and bigger/denser/faster particles below make it unmistakably
        // "falling snow" instead of static dust.
        ps.color1 = new Color4(0.85, 0.91, 1.0, 0.95);
        ps.color2 = new Color4(0.7, 0.8, 0.95, 0.85);
        ps.colorDead = new Color4(0.8, 0.87, 1.0, 0);
        const snowSizeScale = Math.max(halfExtent / 15, 1) * particleSize;
        ps.minSize = 0.22 * snowSizeScale;
        ps.maxSize = 0.55 * snowSizeScale;
        ps.minLifeTime = 4;
        ps.maxLifeTime = 8;
        ps.emitRate = 900 * rainIntensity; // quantity - snow is naturally sparser than rain
        // Snow drifts sideways as it falls rather than dropping in a near-straight line -
        // the wide direction spread plus a slow angular spin is what actually reads as
        // "snow" instead of "rain but white and slower".
        ps.direction1 = new Vector3(-0.6, -1, -0.6);
        ps.direction2 = new Vector3(0.6, -1, 0.6);
        ps.minAngularSpeed = 0;
        ps.maxAngularSpeed = Math.PI / 2;
        ps.minEmitPower = 2 * rainIntensity; // fall speed
        ps.maxEmitPower = 4 * rainIntensity;
        ps.gravity = new Vector3(0, -1.4, 0);
        ps.updateSpeed = 0.015;
        ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
        // Stop snow at the roof/ground instead of falling straight through into the
        // building's interior.
        attachSurfaceCollision(ps, buildPrecipitationHeightmap(scene, centerX, centerZ, halfExtent, topY));
        ps.start();
        weatherSnowRef.current = ps;
        setSnowOn(true);
        showToast.success('Snow on');
      } catch (e) {
        console.error('Snow start failed:', e);
        showToast.error('Failed to start snow');
      }
    } else {
      if (weatherSnowRef.current) {
        weatherSnowRef.current.stop();
        const tex = weatherSnowRef.current.particleTexture;
        weatherSnowRef.current.dispose();
        if (tex) tex.dispose();
        weatherSnowRef.current = null;
      }
      const existing = scene.particleSystems.find((p: any) => p.name === 'weatherSnowParticles');
      if (existing) {
        existing.stop();
        const t = existing.particleTexture;
        existing.dispose();
        if (t) t.dispose();
      }
      setSnowOn(false);
      showToast.success('Snow off');
    }
  }, [rainIntensity, particleSize]);

  // Live-update rain/snow speed & quantity while already running, so the intensity
  // slider has an immediate visible effect instead of only applying on next toggle.
  useEffect(() => {
    const rain = weatherRainRef.current;
    if (rain) {
      rain.emitRate = 1200 * rainIntensity;
      rain.minEmitPower = 6 * rainIntensity;
      rain.maxEmitPower = 14 * rainIntensity;
    }
    const snow = weatherSnowRef.current;
    if (snow) {
      snow.emitRate = 900 * rainIntensity;
      snow.minEmitPower = 2 * rainIntensity;
      snow.maxEmitPower = 4 * rainIntensity;
    }
  }, [rainIntensity]);

  // Live-update particle size the same way - both rain and snow re-derive their base
  // size scale from the model's footprint, so only the particleSize multiplier changes here.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { halfExtent } = computePrecipitationBounds(scene);
    const sizeScale = Math.max(halfExtent / 15, 1) * particleSize;
    const rain = weatherRainRef.current;
    if (rain) {
      rain.minSize = 0.15 * sizeScale;
      rain.maxSize = 0.4 * sizeScale;
    }
    const snow = weatherSnowRef.current;
    if (snow) {
      snow.minSize = 0.22 * sizeScale;
      snow.maxSize = 0.55 * sizeScale;
    }
  }, [particleSize]);

  const onFloodToggle = useCallback((on: boolean) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (on) {
      if (floodWaterRef.current) {
        floodWaterRef.current.mesh.setEnabled(true);
        floodWaterRef.current.bodyMesh.setEnabled(true);
        setFloodOn(true);
        showToast.success('Flood on');
        return;
      }
      try {
        const { centerX, centerZ, bottomY, halfExtent } = computePrecipitationBounds(scene);
        const floorY = bottomY - 1; // comfortably below the model's actual foundation
        const surfaceY = -0.5;
        const size = halfExtent * 2;

        const waterMesh = MeshBuilder.CreateGround('flood-water', { width: size, height: size, subdivisions: 32 }, scene);
        waterMesh.position.set(centerX, surfaceY, centerZ);
        const bumpTexture = new PerlinNoiseProceduralTexture('flood-bump', 256, scene);
        bumpTexture.translationSpeed = 2;
        const waterMat = new WaterMaterial('flood-water-mat', scene, new Vector2(256, 256));
        waterMat.bumpTexture = bumpTexture;
        waterMat.waterColor = new Color3(0.15, 0.35, 0.65);
        waterMat.waterColor2 = new Color3(0.1, 0.25, 0.5);
        waterMat.colorBlendFactor = 0.3;
        waterMat.colorBlendFactor2 = 0.4;
        waterMat.waveHeight = 0.15;
        waterMat.waveSpeed = 25;
        waterMat.waveLength = 0.12;
        waterMat.windForce = 12;
        waterMat.windDirection = new Vector2(1, 0.5);
        waterMat.bumpHeight = 0.4;
        waterMesh.material = waterMat;

        // The animated surface above is a flat plane with nothing underneath - correct
        // looking straight down at it, but from any angle that reveals what's below (a
        // window, a lower floor, the side of the model) there was simply nothing there.
        // This solid, murky body fills that space so a flooded building actually looks
        // like it's sitting in standing water, not floating a water sheet above a void.
        const bodyMesh = MeshBuilder.CreateBox('flood-water-body', { width: size, height: 1, depth: size }, scene);
        const bodyHeight = Math.max(surfaceY - floorY, 0.05);
        bodyMesh.position.set(centerX, floorY + bodyHeight / 2, centerZ);
        bodyMesh.scaling.y = bodyHeight;
        const bodyMat = new StandardMaterial('flood-water-body-mat', scene);
        bodyMat.diffuseColor = new Color3(0.08, 0.2, 0.35);
        bodyMat.specularColor = new Color3(0.1, 0.15, 0.2);
        bodyMat.alpha = 0.88;
        bodyMat.backFaceCulling = false; // stays visible from inside a submerged room too
        bodyMesh.material = bodyMat;

        scene.meshes.forEach((m: any) => {
          if (m !== waterMesh && m !== bodyMesh && m.isVisible()) waterMat.addToRenderList(m);
        });
        floodWaterRef.current = { mesh: waterMesh, material: waterMat, bodyMesh, bodyMaterial: bodyMat, floorY };
        setFloodOn(true);
        showToast.success('Flood on');
      } catch (e) {
        console.error('Flood start failed:', e);
        showToast.error('Failed to start flood - using fallback');
        try {
          const { centerX, centerZ, bottomY, halfExtent } = computePrecipitationBounds(scene);
          const floorY = bottomY - 1;
          const surfaceY = -0.5;
          const size = halfExtent * 2;

          const waterMesh = MeshBuilder.CreateGround('flood-water', { width: size, height: size, subdivisions: 16 }, scene);
          const fallbackMat = new StandardMaterial('flood-water-mat', scene);
          fallbackMat.diffuseColor = new Color3(0.15, 0.35, 0.65);
          fallbackMat.alpha = 0.75;
          fallbackMat.specularColor = new Color3(0.8, 0.9, 1);
          waterMesh.material = fallbackMat;
          waterMesh.position.set(centerX, surfaceY, centerZ);

          const bodyMesh = MeshBuilder.CreateBox('flood-water-body', { width: size, height: 1, depth: size }, scene);
          const bodyHeight = Math.max(surfaceY - floorY, 0.05);
          bodyMesh.position.set(centerX, floorY + bodyHeight / 2, centerZ);
          bodyMesh.scaling.y = bodyHeight;
          const bodyMat = new StandardMaterial('flood-water-body-mat', scene);
          bodyMat.diffuseColor = new Color3(0.08, 0.2, 0.35);
          bodyMat.alpha = 0.88;
          bodyMat.backFaceCulling = false;
          bodyMesh.material = bodyMat;

          floodWaterRef.current = { mesh: waterMesh, material: fallbackMat, bodyMesh, bodyMaterial: bodyMat, floorY };
          setFloodOn(true);
          showToast.success('Flood on');
        } catch (e2) {
          showToast.error('Failed to start flood');
        }
      }
    } else {
      if (floodWaterRef.current) {
        floodWaterRef.current.mesh.dispose();
        floodWaterRef.current.material.dispose();
        floodWaterRef.current.bodyMesh.dispose();
        floodWaterRef.current.bodyMaterial.dispose();
        floodWaterRef.current = null;
      }
      const existing = scene.getMeshByName('flood-water');
      if (existing) {
        if (existing.material) existing.material.dispose();
        existing.dispose();
      }
      const existingBody = scene.getMeshByName('flood-water-body');
      if (existingBody) {
        if (existingBody.material) existingBody.material.dispose();
        existingBody.dispose();
      }
      setFloodOn(false);
      showToast.success('Flood off');
    }
  }, []);

  const onFloodLevelChange = useCallback((level: number) => {
    if (floodWaterRef.current) {
      const surfaceY = -1 + level * 2.5;
      floodWaterRef.current.mesh.position.y = surfaceY;
      const { floorY, bodyMesh } = floodWaterRef.current;
      const bodyHeight = Math.max(surfaceY - floorY, 0.05);
      bodyMesh.scaling.y = bodyHeight;
      bodyMesh.position.y = floorY + bodyHeight / 2;
    }
  }, []);

  const onFloodWaveSpeedChange = useCallback((speed: number) => {
    if (floodWaterRef.current?.material?.waveSpeed !== undefined) {
      floodWaterRef.current.material.waveSpeed = 10 + speed * 30;
    }
  }, []);

  // Centralized feature toggle logic - use startTransition for lazy-loading features to avoid sync suspend
  const handleFeatureToggle = useCallback((featureId: string | number, enabled: boolean) => {
    const id = String(featureId);
    startTransition(() => {
    if (enabled) {
      enableFeature(id);
      // Call manager methods for specific features
      try {
        // BIM Features
        if (id === 'showBIMIntegration' && bimManagerRef.current) {
          try {
            // toggleHiddenDetails() is a real flip, not a "set true" - calling it
            // unconditionally on every enable meant re-enabling the feature twice silently
            // hid the details it had just shown. Only turn it on if it isn't already.
            if (!bimManagerRef.current.getConfig?.()?.showHiddenDetails) {
              bimManagerRef.current.toggleHiddenDetails();
            }
            showToast.success('Hidden details toggled');
          } catch (error) {
            console.error('Error toggling hidden details:', error);
            showToast.error('Failed to toggle hidden details');
          }
          try {
            bimManagerRef.current.enableClashDetection();
            showToast.success('Clash detection enabled');
          } catch (error) {
            console.error('Error enabling clash detection:', error);
            showToast.error('Failed to enable clash detection');
          }
          try {
            if (typeof bimManagerRef.current.loadDemoModel === 'function') {
              bimManagerRef.current.loadDemoModel();
              showToast.success('Demo model loaded');
            }
          } catch (error) {
            console.error('Error loading demo model:', error);
            showToast.error('Failed to load demo model');
          }
        }

        // Tool toggles: drive the same GizmoManager (transformMode) that the keyboard
        // shortcuts (g/r/s) and the always-visible bottom mini-toolbar use. These buttons
        // used to drive a separate, cruder PointerDragBehavior-based implementation
        // (single-axis rotate, horizontal-plane-only move, mouse-delta scale, no visual
        // handles) that could be active on the same mesh at the same time as the gizmo -
        // dragging the mesh body would trigger the drag behavior while the gizmo's own
        // handles were also live, producing compounding/conflicting transforms.
        if (id === 'showMove') {
          setTransformMode('position');
          showToast.success('Move tool activated');
        }
        if (id === 'showRotate') {
          setTransformMode('rotation');
          showToast.success('Rotate tool activated');
        }
        if (id === 'showScale') {
          setTransformMode('scale');
          showToast.success('Scale tool activated');
        }
        if (id === 'showMinimap') showToast.success('Minimap enabled');
        if (id === 'showMeasurementTool') showToast.success('Measure tool enabled - click scene to measure');
        if (id === 'showMaterialEditor') showToast.success('Material editor opened - color pick & swap available');
        if (id === 'showPropertyInspector') showToast.success('Property inspector enabled');
        if (id === 'showSceneBrowser') showToast.success('Scene browser opened');
        if (id === 'showLighting') showToast.success('Lighting controls enabled');
        if (id === 'showClashDetection' && bimManagerRef.current) {
          try {
            const bimManager = bimManagerRef.current;
            const toastId = showToast.loading('Scanning for clashes...');
            bimManager.enableClashDetection().then(() => {
              const count = bimManager.getClashes().length;
              showToast.dismiss(toastId);
              if (count > 0) {
                showToast.success(`${count} clash${count === 1 ? '' : 'es'} found`, 'Highlighted in red in the 3D view');
              } else {
                showToast.success('No clashes found');
              }
            });
          } catch (error) {
            console.error('Error running clash detection:', error);
            showToast.error('Failed to run clash detection');
          }
        }

        // AI Features
        if (id === 'showVoiceAssistant' && aiManagerRef.current) {
          try {
            aiManagerRef.current.startVoiceListening();
            showToast.success('Voice assistant started');
            // This toggle used to only start a silent background listener with no
            // visible UI at all - AppLayout.tsx separately owns a fully-featured voice
            // panel (live transcript, command history, mic status) behind its own
            // independent "AI Voice" button, completely disconnected from this one.
            // Opening that real panel here too is what actually gives this button
            // something to show the user, instead of a toast and nothing else.
            window.dispatchEvent(new CustomEvent('naviz:openVoiceAssistant'));
          } catch (error) {
            console.error('Error starting voice listening:', error);
            showToast.error('Failed to start voice assistant');
          }
        }
        if (id === 'showAICoDesigner' && aiManagerRef.current) {
          try {
            aiManagerRef.current.enableGestureDetection();
            showToast.success('AI co-designer enabled');
          } catch (error) {
            console.error('Error enabling gesture detection:', error);
            showToast.error('Failed to enable AI co-designer');
          }
        }
        if (id === 'showGestureDetection' && aiManagerRef.current) {
          try {
            aiManagerRef.current.enableGestureDetection();
            showToast.success('Gesture detection enabled');
          } catch (error) {
            console.error('Error enabling gesture detection feature:', error);
            showToast.error('Failed to enable gesture detection');
          }
        }
        if (id === 'showGestureInspector') {
          showToast.info('Gesture inspector active');
        }
        if (id === 'showVoiceChat') {
          if (collabManagerRef.current) {
            collabManagerRef.current.enableVoiceChat().then((ok: boolean) => {
              if (ok) {
                showToast.success('Voice chat connected', 'Microphone is live');
              } else {
                showToast.error('Voice chat unavailable', 'Microphone access was denied or is unavailable');
              }
            });
          } else {
            showToast.error('Voice chat unavailable', 'Collaboration is not ready yet');
          }
        }

        // XR Features
        if (id === 'showVR' && xrManagerRef.current) {
          xrManagerRef.current.enterVR()
            .then((success) => {
              if (success) {
                showToast.success('VR mode enabled');
              } else {
                showToast.error('Failed to enter VR mode', 'This device/browser may not support VR');
              }
            })
            .catch((error) => {
              console.error('Error entering VR:', error);
              showToast.error('Failed to enter VR mode');
            });
        }
        if (id === 'showAR' && xrManagerRef.current) {
          xrManagerRef.current.enterAR()
            .then((success) => {
              if (success) {
                showToast.success('AR mode enabled');
              } else {
                showToast.error('Failed to enter AR mode', 'This device/browser may not support AR');
              }
            })
            .catch((error) => {
              console.error('Error entering AR:', error);
              showToast.error('Failed to enter AR mode');
            });
        }
        if (id === 'showSpatialAudio' && audioManagerRef.current) {
          try {
            audioManagerRef.current.enableSpatialAudio();
            showToast.success('Spatial audio enabled');
          } catch (error) {
            console.error('Error enabling spatial audio:', error);
            showToast.error('Failed to enable spatial audio');
          }
        }
        if (id === 'showHaptic') {
          try {
            const enabled = !!xrManagerRef.current?.enableHapticFeedback();
            if (enabled) {
              showToast.success('Haptic feedback enabled');
            } else {
              showToast.error('No VR controller detected', 'Haptic feedback needs an active VR session with a controller that supports vibration');
            }
          } catch (error) {
            console.error('Error enabling haptic feedback:', error);
            showToast.error('Failed to enable haptic feedback');
          }
        }

        // Cost and Analysis Features: the actual Cost Estimation UI is the independent
        // CostEstimatorWrapper panel (rendered via uiSegments.tsx), which fetches and
        // displays its own data - this used to also fetch a cost breakdown here and
        // console.log it, never shown anywhere, on every enable.
        // Simulation Features - sync SimulationManager config
        if (simulationManagerRef.current) {
          const sim = simulationManagerRef.current;
          const configMap: Record<string, Record<string, boolean>> = {
            showFloodSimulation: { floodSimulationEnabled: true },
            showWindTunnelSimulation: { windTunnelEnabled: true },
          };
          const updates = configMap[id];
          if (updates) {
            sim.updateConfig(updates);
            sim.startSimulation();
          }
        }
        if (id === 'showFloodSimulation') {
          showToast.success('Flood simulation panel opened - use On/Off to control water');
        }
        if (id === 'showWindTunnelSimulation') {
          // The WindTunnelSimulation panel (uiSegments.tsx) creates and fully owns its own
          // particle system/wind vectors/airflow meshes for as long as it's mounted, and
          // disposes them all on unmount - nothing else needs to be created here. (A
          // duplicate decorative particle system used to be created in this handler too,
          // which the panel's own Close button never cleaned up - a real per-toggle leak.)
          showToast.success('Wind tunnel simulation enabled');
        }
        if (id === 'showWeather') {
          showToast.success('Weather panel opened - use Rain On/Off to control rain');
        }
        if (id === 'showLighting') {
          showToast.success('Lighting presets unlocked');
        }

        // Navigation Features
        if (id === 'showTeleportManager' && cameraRef.current) {
          try {
            // Enable teleport navigation
            console.log('Teleport navigation enabled');
          } catch (error) {
            console.error('Error enabling teleport navigation:', error);
            showToast.error('Failed to enable teleport navigation');
          }
        }
        if (id === 'showSwimMode' && cameraRef.current) {
          try {
            // Enable swim mode
            console.log('Swim mode enabled');
          } catch (error) {
            console.error('Error enabling swim mode:', error);
            showToast.error('Failed to enable swim mode');
          }
        }

        // Geo Features
        if (id === 'showGeoLocation' && navigator.geolocation) {
          try {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('GeoLocation enabled:', position.coords);
                if (cameraRef.current) {
                  cameraRef.current.position.x = position.coords.longitude * 0.01;
                  cameraRef.current.position.z = position.coords.latitude * 0.01;
                }
              },
              (error) => {
                console.error('GeoLocation error:', error);
                showToast.error('Location services unavailable');
              }
            );
          } catch (error) {
            console.error('Error enabling geo location:', error);
            showToast.error('Failed to enable geo location');
          }
        }

        // Geo Sync - previously had no handler at all, so clicking this button did
        // nothing visible even though GeoSyncManager existed and was fully functional.
        if (id === 'showGeoSync' && geoSyncManagerRef.current) {
          geoSyncManagerRef.current.connect()
            .then((success: boolean) => {
              if (success) {
                showToast.success('Geo sync connected', 'Tracking real-world location');
              } else {
                showToast.error('Geo sync unavailable', 'Location services may be disabled');
              }
            })
            .catch((error: unknown) => {
              console.error('Error connecting geo sync:', error);
              showToast.error('Failed to enable geo sync');
            });
        }

        // Sustainability Compliance - previously just showed "active" with no real
        // data; SustainabilityManager.generateReport() was fully implemented but
        // never actually called from anywhere.
        if (id === 'showSustainabilityCompliancePanel' && sustainabilityManagerRef.current) {
          try {
            const report = sustainabilityManagerRef.current.generateReport(currentModelId);
            setSustainabilityReport(report);
            if (!report) {
              showToast.warning('No sustainability data available', 'Load a model first');
            }
          } catch (error) {
            console.error('Error generating sustainability report:', error);
            showToast.error('Failed to generate sustainability report');
          }
        }

        // Export (feature-list entry point, same action as the top bar Export button)
        if (id === 'showExport') {
          const scene = sceneRef.current;
          if (!scene) {
            showToast.error('Scene not ready to export');
          } else {
            const toastId = showToast.loading('Exporting scene...', 'Preparing GLB file');
            import('@babylonjs/serializers/glTF/2.0/glTFSerializer').then(({ GLTF2Export }) => {
              GLTF2Export.GLBAsync(scene, `naviz-scene-${new Date().toISOString().slice(0, 10)}`)
                .then((glb) => {
                  showToast.dismiss(toastId);
                  glb.downloadFiles();
                  showToast.success('Scene exported', 'Downloaded as .glb');
                })
                .catch((error) => {
                  showToast.dismiss(toastId);
                  console.error('Scene export failed:', error);
                  showToast.error('Failed to export scene');
                });
            });
          }
          // This is a one-shot action, not a persistent panel - immediately release the
          // toggled-on state so the button doesn't appear permanently "active".
          disableFeature(id);
        }

        // Animation Features
        if (id === 'showAnimationTimeline' && animationManagerRef.current) {
          try {
            // Enable animation timeline
            console.log('Animation timeline enabled');
          } catch (error) {
            console.error('Error enabling animation timeline:', error);
            showToast.error('Failed to enable animation timeline');
          }
        }

        // Material Features
        if (id === 'showMaterialEditor' && materialManagerRef.current) {
          try {
            // Enable material editor
            console.log('Material editor enabled');
          } catch (error) {
            console.error('Error enabling material editor:', error);
            showToast.error('Failed to enable material editor');
          }
        }

        // Collaboration Features
        if (id === 'showMultiUser' && collabManagerRef.current) {
          try {
            collabManagerRef.current.connect();
          } catch (error) {
            console.error('Error connecting to multi-user:', error);
            showToast.error('Failed to connect to multi-user session');
          }
        }
        if (id === 'showCollabManager' && collabManagerRef.current) {
          try {
            collabManagerRef.current.enableSync();
          } catch (error) {
            console.error('Error enabling collaboration sync:', error);
            showToast.error('Failed to enable collaboration sync');
          }
        }

        // Cloud Features
        if (id === 'showCloudAnchorManager' && cloudAnchorManagerRef.current) {
          cloudAnchorManagerRef.current.connect()
            .then((success: boolean) => {
              if (success) {
                if (cloudAnchorManagerRef.current?.hasRealEndpointConfigured?.()) {
                  showToast.success('Cloud anchors connected');
                } else {
                  showToast.info('Cloud anchors active (local only)', 'No cloud anchor backend is configured, so anchors are saved for this session only and won\'t sync to other devices.');
                }
              } else {
                showToast.error('Failed to connect cloud anchors');
              }
            })
            .catch((error: unknown) => {
              console.error('Error connecting cloud anchor manager:', error);
              showToast.error('Failed to connect cloud anchor manager');
            });
        }

        // Performance Features
        if (id === 'showImport') {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
          showToast.success('Import dialog opened');
        }
        if (id === 'showKeyboardShortcuts') {
          showToast.info('Keyboard shortcuts panel activated');
        }
        if (id === 'showDomainSelector') {
          showToast.info('Domain selector ready');
        }

      } catch (error) {
        console.error(`Error enabling feature ${id}:`, error);
        showToast.error(`Failed to enable ${id}`);
        disableFeature(id); // Revert on error
      }
    } else {
      disableFeature(id);
      if (id === 'showMove' || id === 'showRotate' || id === 'showScale') {
        setTransformMode((m) => {
          const modeForId = id === 'showMove' ? 'position' : id === 'showRotate' ? 'rotation' : 'scale';
          // Only clear it if this tool is the one currently active - don't clobber the
          // gizmo if the user already switched to a different tool (or used g/r/s) since.
          return m === modeForId ? 'none' : m;
        });
      }
      if (id === 'showClashDetection' && bimManagerRef.current) {
        bimManagerRef.current.disableClashDetection();
        showToast.info('Clash detection disabled');
      }
      if (id === 'showGestureDetection' && aiManagerRef.current) {
        aiManagerRef.current.disableGestureDetection();
      }
      if (id === 'showGestureInspector') {
        showToast.info('Gesture inspector hidden');
      }
      if (id === 'showImport') {
        showToast.info('Import dialog closed');
      }
      if (id === 'showKeyboardShortcuts') {
        showToast.info('Keyboard shortcuts hidden');
      }
      if (id === 'showDomainSelector') {
        showToast.info('Domain selector closed');
      }
      if (id === 'showVoiceChat') {
        collabManagerRef.current?.disableVoiceChat();
        showToast.info('Voice chat closed');
      }
      if (id === 'showHaptic') {
        xrManagerRef.current?.disableHapticFeedback();
      }
      if (id === 'showGeoSync') {
        geoSyncManagerRef.current?.disconnect();
      }
      // Cleanup for specific features
      try {
        // AI Features
        if (id === 'showVoiceAssistant' && aiManagerRef.current) {
          aiManagerRef.current.stopVoiceListening();
          window.dispatchEvent(new CustomEvent('naviz:closeVoiceAssistant'));
        }
        if (id === 'showAICoDesigner' && aiManagerRef.current) {
          aiManagerRef.current.disableGestureDetection();
        }

        // XR Features
        if ((id === 'showVR' || id === 'showAR') && xrManagerRef.current) {
          xrManagerRef.current.exitXR();
        }
        if (id === 'showSpatialAudio' && audioManagerRef.current) {
          audioManagerRef.current.disableSpatialAudio();
        }
        // Simulation Features - sync SimulationManager config on disable
        if (simulationManagerRef.current) {
          const sim = simulationManagerRef.current;
          const configMap: Record<string, Record<string, boolean>> = {
            showFloodSimulation: { floodSimulationEnabled: false },
            showWindTunnelSimulation: { windTunnelEnabled: false },
          };
          const updates = configMap[id];
          if (updates) {
            sim.updateConfig(updates);
          }
        }

        // Simulation Features
        if (id === 'showFloodSimulation') {
          if (floodWaterRef.current) {
            floodWaterRef.current.mesh.dispose();
            floodWaterRef.current.material.dispose();
            floodWaterRef.current.bodyMesh.dispose();
            floodWaterRef.current.bodyMaterial.dispose();
            floodWaterRef.current = null;
          }
          const water = sceneRef.current?.getMeshByName('flood-water');
          if (water) {
            if (water.material) water.material.dispose();
            water.dispose();
          }
          const waterBody = sceneRef.current?.getMeshByName('flood-water-body');
          if (waterBody) {
            if (waterBody.material) waterBody.material.dispose();
            waterBody.dispose();
          }
          setFloodOn(false);
        }
        // showWindTunnelSimulation cleanup: handled entirely by the WindTunnelSimulation
        // panel's own unmount effect once disableFeature (above) hides it - see the enable
        // branch comment for why nothing needs to happen here.
        if (id === 'showWeather') {
          // The real rain/snow implementation lives entirely in this file (onRainToggle/
          // onSnowToggle below) - SimulationManager's own duplicate rain/snow subsystem was
          // permanently inert (showWeather always forced its config flags to false) and has
          // been removed.
          //
          // This branch also runs whenever the panel is closed via anything other than its
          // own Close button (the W keyboard shortcut, the sidebar Weather toggle) - it used
          // to only reset the rainOn flag (never snowOn, and never actually stopped either
          // particle system), so rain/snow kept silently falling with no panel left to turn
          // them off from. Route through the real toggle functions so both the visual effect
          // and its state flag are actually cleared, matching what the Close button does.
          onRainToggle(false);
          onSnowToggle(false);
        }

        // Collaboration Features
        if (id === 'showMultiUser' && collabManagerRef.current) {
          collabManagerRef.current.disconnect();
        }
        if (id === 'showCollabManager' && collabManagerRef.current) {
          collabManagerRef.current.disableSync();
        }

        // Cloud Features
        if (id === 'showCloudAnchorManager' && cloudAnchorManagerRef.current) {
          cloudAnchorManagerRef.current.disconnect();
        }

      } catch (error) {
        console.error(`Error disabling feature ${id}:`, error);
      }
    }
    });
  }, [enableFeature, disableFeature, setTransformMode, setCameraActive]);

  // Global keyboard shortcuts (must be after handleFeatureToggle)
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Z (undo) has to be handled here, inside the ctrl-key branch - this
        // whole branch unconditionally returns at the end, and 'z' was never checked
        // here, so every Ctrl+Z press fell into this block, matched none of the T/H/J/K/
        // 1/2/3 shortcuts below, and hit that return before ever reaching the *separate*
        // undo handler that used to live further down in this same function. That block
        // was completely unreachable - undo never fired for anything, ever, regardless
        // of how correct its own logic was.
        if (key === 'z') {
          e.preventDefault();
          const last = undoHistoryRef.current.pop();
          if (!last) {
            showToast.info('Nothing to undo');
          } else if (last.kind === 'transform') {
            last.mesh.position.copyFrom(last.position);
            if (last.rotationQuaternion) {
              last.mesh.rotationQuaternion = last.rotationQuaternion;
            } else {
              last.mesh.rotation.copyFrom(last.rotation);
            }
            last.mesh.scaling.copyFrom(last.scaling);
            showToast.success('Undone');
          } else if (last.kind === 'material') {
            const mat = last.material;
            const snap = last.snapshot;
            if (mat instanceof StandardMaterial && snap.kind === 'standard') {
              mat.diffuseColor = snap.diffuseColor;
              mat.specularColor = snap.specularColor;
              mat.emissiveColor = snap.emissiveColor;
              mat.alpha = snap.alpha;
              mat.specularPower = snap.specularPower;
              mat.diffuseTexture = snap.diffuseTexture ?? null;
              mat.bumpTexture = snap.bumpTexture ?? null;
              mat.emissiveTexture = snap.emissiveTexture ?? null;
            } else if (mat instanceof PBRMaterial && snap.kind === 'pbr') {
              mat.albedoColor = snap.albedoColor;
              mat.emissiveColor = snap.emissiveColor;
              mat.alpha = snap.alpha;
              mat.metallic = snap.metallic;
              mat.roughness = snap.roughness;
              mat.environmentIntensity = snap.environmentIntensity;
              if (snap.reflectivityColor) mat.reflectivityColor = snap.reflectivityColor;
              mat.indexOfRefraction = snap.indexOfRefraction;
              mat.albedoTexture = snap.albedoTexture ?? null;
              mat.bumpTexture = snap.bumpTexture ?? null;
              mat.emissiveTexture = snap.emissiveTexture ?? null;
            }
            showToast.success(`Undone material changes to "${mat.name}"`);
          } else if (last.kind === 'materialSwap') {
            last.mesh.material = last.previousMaterial;
            showToast.success('Undone material type change');
          }
          return;
        }
        if (key === 't') { e.preventDefault(); updateState({ topBarVisible: !topBarVisible }); }
        if (key === 'h') { e.preventDefault(); updateState({ leftPanelVisible: !leftPanelVisible }); }
        if (key === 'j') { e.preventDefault(); updateState({ rightPanelVisible: !rightPanelVisible }); }
        if (key === 'k') { e.preventDefault(); updateState({ bottomPanelVisible: !bottomPanelVisible }); }
        if (key === '1') { e.preventDefault(); setLayoutMode('standard'); }
        if (key === '2') { e.preventDefault(); setLayoutMode('compact'); }
        if (key === '3') { e.preventDefault(); setLayoutMode('immersive'); }
        return;
      }
      // 'w' previously toggled Weather (which never actually declared its own hotkey in
      // config/featureCategories.tsx) - meanwhile Wind Tunnel Simulation DOES declare
      // 'W' as its hotkey (shown on its own button), but nothing here ever bound it, so
      // pressing W always opened Weather instead of the feature it's actually labeled
      // on. Giving 'w' to the feature that actually documents it.
      if (key === 'w') { e.preventDefault(); handleFeatureToggle('showWindTunnelSimulation', !featureStates.showWindTunnelSimulation); }
      if (key === 'f') { e.preventDefault(); handleFeatureToggle('showFloodSimulation', !featureStates.showFloodSimulation); }
      if (key === 't') { e.preventDefault(); handleFeatureToggle('showMeasurementTool', !featureStates.showMeasurementTool); }
      if (key === 'm') { e.preventDefault(); handleFeatureToggle('showMaterialEditor', !featureStates.showMaterialEditor); }
      if (key === 'a') { e.preventDefault(); handleFeatureToggle('showAIAdvisor', !featureStates.showAIAdvisor); }
      if (key === 'u') { e.preventDefault(); handleFeatureToggle('showAutoFurnish', !featureStates.showAutoFurnish); }
      // The following six hotkeys are all declared on their buttons in
      // config/featureCategories.tsx (and shown to the user via FeatureButton's
      // tooltip/badge) but were never actually bound anywhere - pressing them did
      // nothing (or, for F5, triggered the browser's native page reload instead,
      // losing all workspace state).
      if (key === '?') { e.preventDefault(); handleFeatureToggle('showKeyboardShortcuts', !featureStates.showKeyboardShortcuts); }
      if (key === 'd' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showDomainSelector', !featureStates.showDomainSelector); }
      if (e.key === 'F5') { e.preventDefault(); handleFeatureToggle('showPresentationManager', !featureStates.showPresentationManager); }
      if (key === 'e' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showExport', true); }
      if (key === 'i' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showImport', true); }
      if (key === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showAnnotations', !featureStates.showAnnotations); }
      // 'v' toggles Voice Assistant per its own advertised hotkey (config/
      // featureCategories.tsx, shown on the button itself) - this used to toggle
      // showAICoDesigner instead, a feature with no category entry/button of its own,
      // so pressing V silently did the wrong thing while Voice Assistant's own hotkey
      // did nothing.
      if (key === 'v') { e.preventDefault(); handleFeatureToggle('showVoiceAssistant', !featureStates.showVoiceAssistant); }
      if (key === 'x') { e.preventDefault(); handleFeatureToggle('showVR', !featureStates.showVR); }
      // Transform tool shortcuts (Blender/Maya convention): G = move/grab, R = rotate, S = scale
      if (key === 'g' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTransformMode((m) => m === 'position' ? 'none' : 'position'); }
      if (key === 'r' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTransformMode((m) => m === 'rotation' ? 'none' : 'rotation'); }
      if (key === 's' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTransformMode((m) => m === 'scale' ? 'none' : 'scale'); }
      if (e.key === 'Escape') { setTransformMode('none'); setSelectedMesh(null); }
      // 'z' toggles AR mode, but only when NOT combined with Ctrl/Cmd (Ctrl/Cmd+Z is
      // undo, handled above in the ctrl-key branch).
      if (key === 'z' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showAR', !featureStates.showAR); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topBarVisible, leftPanelVisible, rightPanelVisible, bottomPanelVisible, updateState, setLayoutMode, handleFeatureToggle, featureStates]);

  // Voice command listener - toggle features from AI Voice Assistant
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ action: string; featureId?: string; on?: boolean }>;
      const { action, featureId, on } = ev.detail || {};
      if (!featureId) return;
      if (on === true) {
        enableFeature(featureId);
      } else if (on === false) {
        disableFeature(featureId);
      }
    };
    window.addEventListener('naviz:voiceCommand', handler);
    return () => window.removeEventListener('naviz:voiceCommand', handler);
  }, [enableFeature, disableFeature]);

  // Material Editor undo baseline - see snapshotForUndo() in MaterialEditor.tsx.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ material: Material; snapshot: Record<string, any> }>;
      const { material, snapshot } = ev.detail || {};
      if (!material || !snapshot) return;
      undoHistoryRef.current.push({ kind: 'material', material, snapshot });
      if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift();
    };
    window.addEventListener('naviz:materialSnapshot', handler);
    return () => window.removeEventListener('naviz:materialSnapshot', handler);
  }, []);

  // Material Type switch undo - see the naviz:materialSwapUndo dispatch in
  // MaterialEditor.tsx's applyMaterialType/ensurePBRMaterial. Switching type replaces the
  // mesh's material with a genuinely different object, so unlike ordinary property edits
  // this can't be undone by mutating properties on a snapshot - it has to swap the actual
  // previous material object back onto the mesh.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ mesh: AbstractMesh; previousMaterial: Material }>;
      const { mesh, previousMaterial } = ev.detail || {};
      if (!mesh || !previousMaterial) return;
      undoHistoryRef.current.push({ kind: 'materialSwap', mesh, previousMaterial });
      if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift();
    };
    window.addEventListener('naviz:materialSwapUndo', handler);
    return () => window.removeEventListener('naviz:materialSwapUndo', handler);
  }, []);

interface Feature {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  enabled: boolean;
  hotkey?: string;
  description: string;
  performanceImpact?: number;
  dependencies?: string[];
  isEssential?: boolean;
}

// Render helpers
const getFilteredFeatures = useCallback((features: Feature[]) => {
  if (!searchTerm) return features;
  return features.filter(f => f.name && f.name.toLowerCase().includes(searchTerm.toLowerCase()));
}, [searchTerm]);

  const renderFeatureButton = useCallback((feature: Feature, size: "default" | "sm" | "lg" = 'default') => (
    <FeatureButton
      feature={feature}
      active={activeFeatures.has(feature.id)}
      onToggle={(featureId: string | number, enabled: boolean) => handleFeatureToggle(String(featureId), enabled)}
      size={size}
    />
  ), [activeFeatures, handleFeatureToggle]);

const renderCategoryToggles = useCallback(() => {
  // Transform featureCategories to CategoryInfo format
  type CategoryInfo = { name: string; count: number; activeCount: number; color: string; priority: number; description: string; };
  const categories: Record<string, CategoryInfo> = {};
  Object.entries(featureCategories).forEach(([categoryName, features]) => {
    const activeCount = features.filter(feature =>
      activeFeatures.has(feature.id)
    ).length;

    categories[categoryName] = {
      name: categoryName,
      count: features.length,
      activeCount,
      color: getCategoryColor(categoryName),
      priority: getCategoryPriority(categoryName),
      description: getCategoryDescription(categoryName)
    };
  });

  return (
    <CategoryToggles
      categories={categories}
      visibleCategories={categoryPanelVisible}
      onCategoryToggle={handleCategoryToggle}
      onToggleAll={(visible) => {
        const updated = Object.keys(categoryPanelVisible).reduce((acc, key) => {
          acc[key] = visible;
          return acc;
        }, {} as Record<string, boolean>);
        setCategoryPanelVisible(updated);
      }}
      onFilterByPriority={(priority) => {
        // Filter categories by priority
        const filtered = Object.keys(categories).reduce((acc, key) => {
          acc[key] = categories[key].priority <= priority;
          return acc;
        }, {} as Record<string, boolean>);
        setCategoryPanelVisible(filtered);
      }}
      layout="expanded"
    />
  );
}, [featureCategories, categoryPanelVisible, handleCategoryToggle, activeFeatures, setCategoryPanelVisible]);

// Helper functions for category transformation
const getCategoryColor = (categoryName: string): string => {
  const colorMap: Record<string, string> = {
    "Core Workspace": "blue",
    "UI and Controls": "green",
    "AI and Automation": "purple",
    "AR and Spatial": "orange",
    "Simulations and Analysis": "cyan",
    "Tools and Editors": "teal",
    "Auto Furnish & AR Anchor": "pink",
    "Audio and Multimedia": "gray",
    "Collaboration and Multi-user": "slate",
    "Geo and Location": "indigo",
    "IoT and Smart Features": "yellow",
    "Lighting and Mood": "red",
    "Other": "gray"
  };
  return colorMap[categoryName] || "gray";
};

const getCategoryPriority = (categoryName: string): number => {
  const priorityMap: Record<string, number> = {
    "Core Workspace": 1,
    "UI and Controls": 2,
    "AI and Automation": 3,
    "AR and Spatial": 4,
    "Simulations and Analysis": 5,
    "Tools and Editors": 2,
    "Auto Furnish & AR Anchor": 3,
    "Audio and Multimedia": 4,
    "Collaboration and Multi-user": 3,
    "Geo and Location": 4,
    "IoT and Smart Features": 5,
    "Lighting and Mood": 4,
    "Other": 6
  };
  return priorityMap[categoryName] || 6;
};

const getCategoryDescription = (categoryName: string): string => {
  const descriptionMap: Record<string, string> = {
    "Core Workspace": "Essential workspace tools and controls",
    "UI and Controls": "User interface and application controls",
    "AI and Automation": "Artificial intelligence and automated features",
    "AR and Spatial": "Augmented reality and spatial computing",
    "Simulations and Analysis": "Simulation and analysis tools",
    "Tools and Editors": "Import, export, and editing tools",
    "Auto Furnish & AR Anchor": "Automatic furnishing and AR anchoring",
    "Audio and Multimedia": "Audio and multimedia features",
    "Collaboration and Multi-user": "Multi-user collaboration tools",
    "Geo and Location": "Geographic and location-based features",
    "IoT and Smart Features": "Internet of Things integration",
    "Lighting and Mood": "Lighting and atmospheric controls",
    "Other": "Miscellaneous features"
  };
  return descriptionMap[categoryName] || "";
};

  const renderCategoryPanels = useCallback(() => (
    <div>Category Panels Placeholder</div>
  ), []);





  // Layout classes - min-w-0 min-h-0 prevents flex overflow from hiding children
  const layoutClasses = {
    container: 'relative flex h-screen bg-gray-800',
    leftPanel: 'flex flex-col w-72 border-r border-gray-700 bg-gray-900 text-white shrink-0',
    mainWorkspace: 'flex-1 flex flex-col min-w-0 min-h-0',
  };

  // Show error message if canvas is missing
  if (canvasError) {
    return (
  <div data-testid="canvas-error" className="canvas-error">
        {canvasError}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={layoutClasses.container}>
  {leftPanelVisible && renderLeftPanel({
    featureCategories: rawFeaturesByCategory,
    categoryPanelVisible,
    searchTerm,
    activeFeatures,
    layoutMode,
    setSearchTerm,
    handleFeatureToggle,
    handleCategoryToggle,
    onCategoryToggle: handleCategoryToggle,
    onToggleAllCategories: handleToggleAllCategories,
    updateState,
    setLeftPanelVisible,
    aiManagerRef,
    bimManagerRef
  })}
        <div className={layoutClasses.mainWorkspace}>
          {/* Top bar - flex-shrink-0 so it stays visible */}
          {topBarVisible && (
            <div className="flex-shrink-0 w-full z-10 bg-gray-900 border-b border-gray-700">
              {renderTopBar({
            fps,
            activeFeatures,
            topBarVisible,
            onToggleTopBar: () => updateState({ topBarVisible: !topBarVisible }),
            leftPanelVisible,
            rightPanelVisible,
            onToggleLeftPanel: () => setLeftPanelVisible(!leftPanelVisible),
            onToggleRightPanel: () => updateState({ rightPanelVisible: !rightPanelVisible }),
            cameraMode,
            viewMode,
            workspaceId,
            handleCameraModeChange,
            onViewModeChange: (mode) => {
              setViewMode(mode);
              if (mode === 'walk') handleCameraModeChange('walk');
              else if (mode === 'orbit') handleCameraModeChange('orbit');
              else if (mode === 'dollhouse') handleCameraModeChange('fly');
              else if (mode === 'vr') { handleCameraModeChange('orbit'); showToast.info('VR mode - use VR headset to enter'); }
              else if (mode === 'ar') { handleCameraModeChange('orbit'); showToast.info('AR mode - use mobile device on-site'); }
            },
            onHelp: () => {
              if (featureStates.showKeyboardShortcuts) {
                disableFeature('showKeyboardShortcuts');
              } else {
                enableFeature('showKeyboardShortcuts');
              }
            },
            onImport: () => {
              if (fileInputRef.current) fileInputRef.current.click();
              showToast.success('Import dialog opened');
            },
            onExport: () => {
              const scene = sceneRef.current;
              if (!scene) {
                showToast.error('Scene not ready to export');
                return;
              }
              const toastId = showToast.loading('Exporting scene...', 'Preparing GLB file');
              import('@babylonjs/serializers/glTF/2.0/glTFSerializer').then(({ GLTF2Export }) => {
                GLTF2Export.GLBAsync(scene, `naviz-scene-${new Date().toISOString().slice(0, 10)}`)
                  .then((glb) => {
                    showToast.dismiss(toastId);
                    glb.downloadFiles();
                    showToast.success('Scene exported', 'Downloaded as .glb');
                  })
                  .catch((error) => {
                    showToast.dismiss(toastId);
                    console.error('Scene export failed:', error);
                    showToast.error('Failed to export scene');
                  });
              });
            },
            onScreenshot: (format?: 'png' | 'jpeg') => {
              const canvas = engineRef.current?.getRenderingCanvas() as HTMLCanvasElement | null;
              if (!canvas) { showToast.error('Canvas not ready'); return; }
              const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
              const ext = format === 'jpeg' ? 'jpg' : 'png';
              try {
                const dataUrl = canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined);
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.${ext}`;
                a.click();
                showToast.success(`Screenshot saved as ${ext.toUpperCase()}`);
              } catch (e) {
                showToast.error('Screenshot failed');
              }
            },
            onAutoZoom: () => {
              const scene = sceneRef.current;
              const camera = cameraRef.current;
              if (!scene || !camera || !(camera as any).setTarget) return;
              const arcCam = camera as ArcRotateCamera;
              const exclude = (m: AbstractMesh) => m.name && (m.name.startsWith('measure_') || m.name.startsWith('preview_') || m.name.startsWith('measurement_'));
              let minX = Infinity, minY = Infinity, minZ = Infinity;
              let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
              let count = 0;
              for (const m of scene.meshes) {
                if (exclude(m) || !m.isVisible) continue;
                const b = m.getBoundingInfo();
                const min = b.boundingBox.minimumWorld;
                const max = b.boundingBox.maximumWorld;
                minX = Math.min(minX, min.x); minY = Math.min(minY, min.y); minZ = Math.min(minZ, min.z);
                maxX = Math.max(maxX, max.x); maxY = Math.max(maxY, max.y); maxZ = Math.max(maxZ, max.z);
                count++;
              }
              if (count === 0) {
                arcCam.setTarget(Vector3.Zero());
                arcCam.radius = 15;
                return;
              }
              const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
              const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.1);
              arcCam.setTarget(center);
              arcCam.radius = Math.max(size * 1.2, 2);
              showToast.success('Zoomed to fit');
            }
          })}
            </div>
          )}
          <div className="flex-1 min-h-0 relative">
            <canvas
              ref={canvasRef}
              className="w-full h-full babylon-canvas"
              role="img"
              aria-label="Babylon.js 3D Canvas"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-3 left-3 h-8 px-2 gap-1 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-white text-xs z-10"
              title="Fit to view (Auto Zoom)"
              onClick={runAutoZoom}
            >
              <Maximize className="w-4 h-4" />
              Fit
            </Button>
            {workspaceState.selectedMesh && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl px-2 py-1.5 text-white">
                <span className="text-xs text-gray-300 px-2 max-w-[140px] truncate" title={workspaceState.selectedMesh.name}>
                  {workspaceState.selectedMesh.name}
                </span>
                <div className="w-px h-5 bg-gray-700 mx-1" />
                <Button
                  size="sm" variant={transformMode === 'position' ? 'default' : 'ghost'}
                  className="h-8 px-2" title="Move (G)"
                  onClick={() => setTransformMode((m) => m === 'position' ? 'none' : 'position')}
                >
                  <Move className="w-4 h-4" />
                </Button>
                <Button
                  size="sm" variant={transformMode === 'rotation' ? 'default' : 'ghost'}
                  className="h-8 px-2" title="Rotate (R)"
                  onClick={() => setTransformMode((m) => m === 'rotation' ? 'none' : 'rotation')}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm" variant={transformMode === 'scale' ? 'default' : 'ghost'}
                  className="h-8 px-2" title="Scale (S)"
                  onClick={() => setTransformMode((m) => m === 'scale' ? 'none' : 'scale')}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <div className="w-px h-5 bg-gray-700 mx-1" />
                <Button
                  size="sm" variant="ghost" className="h-8 px-2" title="Deselect (Esc)"
                  onClick={() => { setTransformMode('none'); setSelectedMesh(null); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {renderCustomPanels({
              featureStates,
              sceneRef,
              engineRef,
              cameraRef,
              bimManagerRef,
              simulationManagerRef,
              aiManagerRef,
              collabManagerRef,
              siteContextManagerRef,
              geoSyncManagerRef,
              costEstimatorRef,
              scenarioManagerRef,
              moodSceneManagerRef,
              animationManagerRef,
              sustainabilityManagerRef,
              audioManagerRef,
              cloudAnchorManagerRef,
              arCloudAnchorsRef,
              gpsTransformUtilsRef,
              currentModelId,
              workspaces,
              selectedWorkspaceId,
              handleWorkspaceSelect,
              handleMaterialApplied,
              handleAnimationCreate,
              handleSequencePlay,
              handleTourSequenceCreate,
              handleTourSequencePlay,
              disableFeature,
              enableFeature,
              sustainabilityReport,
              onRainToggle,
              rainOn,
              rainIntensity,
              onRainIntensityChange: setRainIntensity,
              onSnowToggle,
              snowOn,
              particleSize,
              onParticleSizeChange: setParticleSize,
              onFloodToggle,
              floodOn,
              onFloodLevelChange,
              onFloodWaveSpeedChange,
              workspaceState,
              updateState
            })}
            {renderFloatingToolbar({
              workspaceState,
              updateState,
              transformMode,
              setTransformMode
            })}
            {layoutMode === 'immersive' && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
                <Card className="bg-background">
                <CardContent className="p-2 flex items-center gap-2">
                  <Badge variant="outline">{activeFeatures.size.toString()}</Badge>
                  <Separator orientation="vertical" className="h-6" />
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label="Feature Categories">
                          📂
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {(Object.keys(featureCategories) as string[]).map((category: string) => (
                          <DropdownMenuItem key={String(category)} onClick={() => handleCategoryToggle(String(category))}>
                            {String(category).charAt(0).toUpperCase() + String(category).slice(1)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  {/* exit immersive shortcut button */}
                  <Separator orientation="vertical" className="h-6" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLayoutMode('standard');
                      updateState({ topBarVisible: true, leftPanelVisible: true, rightPanelVisible: true, bottomPanelVisible: true });
                    }}
                  >
                    Exit Immersive
                  </Button>
                    <Button
                      size="sm"
                      variant={featureStates.showMinimap ? 'default' : 'ghost'}
                      className="rounded-full"
                      onClick={() => handleFeatureToggle('showMinimap', !featureStates.showMinimap)}
                      title="Toggle Minimap"
                      aria-label="Toggle Minimap"
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateState({ leftPanelVisible: !workspaceState.leftPanelVisible })} title="Toggle Left Panel">
                      🎛️
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateState({ rightPanelVisible: !workspaceState.rightPanelVisible })} title="Toggle Right Panel">
                      ⚙️
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateState({ topBarVisible: true, leftPanelVisible: true, rightPanelVisible: true, bottomPanelVisible: true })} title="Exit Immersive Mode">
                      🔙
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          {layoutMode !== 'immersive' && workspaceState.bottomPanelVisible && renderBottomPanel({
            workspaceState,
            activeFeatures,
            performanceMode,
            selectedMesh,
            handleFeatureToggle,
            setPerformanceMode,
            handleTourSequenceCreate,
            handleTourSequencePlay
          })}
        </div>
        {renderRightPanel({
          workspaceState,
          updateState,
          bimManagerRef,
          simulationManagerRef,
          currentModelId
        })}
        {/* Floating aeromark tab - portaled to body so it's always clickable above canvas */}
        {layoutMode !== 'immersive' && !leftPanelVisible && createPortal(
          <button
            type="button"
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[99998] h-16 w-6 flex items-center justify-center rounded-r-md bg-gray-800 hover:bg-gray-700 border border-l-0 border-gray-600 text-gray-400 hover:text-white shadow-lg transition-colors cursor-pointer"
            style={{ pointerEvents: 'auto' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLeftPanelVisible(true);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLeftPanelVisible(true);
            }}
            title="Show Features panel"
            aria-label="Show Features panel"
          >
            <ChevronRight className="w-4 h-4 pointer-events-none" />
          </button>,
          document.body
        )}
        {/* Floating aeromark tab at top center to expand top bar when hidden */}
        {layoutMode !== 'immersive' && !topBarVisible && createPortal(
          <button
            type="button"
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[99998] w-16 h-6 flex items-center justify-center rounded-b-md bg-gray-800 hover:bg-gray-700 border border-t-0 border-gray-600 text-gray-400 hover:text-white shadow-lg transition-colors cursor-pointer"
            style={{ pointerEvents: 'auto' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('naviz:showTopBar'));
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('naviz:showTopBar'));
            }}
            title="Show top bar"
            aria-label="Show top bar"
          >
            <ChevronDown className="w-4 h-4 pointer-events-none" />
          </button>,
          document.body
        )}
        {/* Hidden file input */}
        <label htmlFor="file-upload" className="hidden">File Upload</label>
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          multiple
          accept=".gltf,.glb,.obj,.fbx,.stl"
          className="hidden"
          onChange={(e) => handleWorkspaceFileUpload(e.target.files)}
        />
        {/* Loading Overlay */}
        {!isInitialized && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="bg-black/80 text-white border-gray-600">
              <CardContent className="p-6 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Initializing 3D Workspace....</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(BabylonWorkspace);

// TODO: Extract mesh/scene event handlers to BabylonWorkspace/meshSceneHandlers.ts
// TODO: Extract inspector logic to BabylonWorkspace/inspectorLogic.ts
// TODO: Extract major UI segments (e.g., renderLeftPanel, renderTopBar, renderRightPanel) to BabylonWorkspace/uiSegments.tsx
