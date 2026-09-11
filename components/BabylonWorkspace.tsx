import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from 'react-router-dom';
import './BabylonWorkspace.css';

// Core Babylon.js imports only (minimal for initial load)
import { Engine, Scene, ArcRotateCamera, FreeCamera, UniversalCamera, HemisphericLight, DirectionalLight, PointLight, Vector3, Vector2, Quaternion, Color3, Color4, Mesh, AbstractMesh, StandardMaterial, DefaultRenderingPipeline, SSAO2RenderingPipeline, SSRRenderingPipeline, TAARenderingPipeline, IblShadowsRenderPipeline, HighlightLayer, PBRMaterial, Material, ImageProcessingConfiguration, ColorCurves, PointerInfo, PickingInfo, Camera, PointerEventTypes, ParticleSystem, MeshBuilder, Texture, GizmoManager, GizmoAnchorPoint, ShadowGenerator, CascadedShadowGenerator, Ray, Axis } from '@babylonjs/core';
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
import { Maximize, MapPin, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Move, RotateCw, Maximize2, X, FlipHorizontal, Trash2, Home, SwitchCamera } from 'lucide-react';

// Import proper hooks from hooks directory
import { useFeatureStates, UseFeatureStatesReturn } from '../hooks/useFeatureStates';
import { useWorkspaceState, WorkspaceState } from '../hooks/useWorkspaceState';
import { useUIHandlers } from '../hooks/useUIHandlers';
import { useApp, LAST_MODEL_ID_KEY } from '../contexts/AppContext';
import { supabase, projectId } from '../supabase/client';

// Import extracted modules
import { useMeshSceneHandlers, isSelectableMesh } from './BabylonWorkspace/meshSceneHandlers';
import { renderLeftPanel, renderTopBar, renderRightPanel, renderBottomPanel, renderCustomPanels } from './BabylonWorkspace/uiSegments';

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
import { GestureManager, GestureData } from './GestureManager';
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
import { PresentationManager } from './PresentationManager';
import { IoTManager } from './IoTManager';
import { captureSceneEdits, applySceneEdits, mergeAndSaveSceneEdits, loadSceneEdits, type SceneEditsData } from './utils/sceneEditsPersistence';
import { mergeDecorativeMeshes, isDecorativeClutterMesh } from './utils/meshMerging';
import { runChunked } from './utils/runChunked';
import { enhanceImportedMaterials } from './utils/materialEnhancement';
import { classifyMaterialsByTexture } from './utils/textureMaterialClassifier';
import { addAmbientFillLights } from './utils/ambientFillLights';

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
  // Extra buttons the host page wants living in the top bar's own empty space (e.g.
  // AppLayout's "My Models" shortcut and "AI Voice" trigger) - these used to be rendered as
  // separate `fixed`-position overlays on top of everything, landing directly on top of the
  // left panel/FPS badge instead of actually being part of the bar.
  topBarExtraLeft?: React.ReactNode;
  topBarExtraRight?: React.ReactNode;
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

// Shared between the camera's initial setup and the Shift-held fast-zoom effect below -
// both need to agree on what "normal" actually is to revert to it correctly.
//
// Percentage-based zoom (see the wheelDeltaPercentage comment where this is applied) moves
// the camera by this fraction of its CURRENT distance to target per scroll tick - it
// naturally decelerates the closer the camera gets, which is the intended "precise up
// close" behavior, but it's also proportional to how close minZ lets the camera get in the
// first place. minZ used to be Babylon's default of 1 world unit, which was itself the near-
// clip bug fixed elsewhere this session - at that distance floor, this deceleration was
// never really reachable/noticeable. Now that minZ is 0.05, the camera can get 20x closer,
// and at that range 0.01 (1% of a much smaller remaining distance) reads as "scroll barely
// does anything" - reported this session as scroll feeling very slow. Doubled to keep
// close-up zoom feeling responsive without making the far-away case (where 1% of a large
// distance is already a big absolute step) uncomfortably twitchy.
const CAMERA_WHEEL_DELTA_NORMAL = 0.02;
const CAMERA_WHEEL_DELTA_FAST = 0.06;

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

// Shared by rain and snow: sizes the precipitation emission area to the actual loaded
// model's real footprint, not a fixed box - a fixed box doesn't match whatever model
// happens to be loaded (too small a building sits lost in a huge field; too large a
// building only gets precipitation over part of it).
function computePrecipitationBounds(scene: Scene): { centerX: number; centerZ: number; topY: number; bottomY: number; halfExtent: number } {
  const realMeshes = scene.meshes.filter((m) =>
    m.isEnabled() && m.getTotalVertices() > 0 &&
    // infiniteDistance marks skybox meshes (procedural sky dome, HDRI skybox) - without
    // excluding those, their ~1000-unit box gets folded into this bounding box, ballooning
    // halfExtent/topY so rain/snow spawns far above and spread far wider than the actual
    // model, dying of old age before ever falling into view (looks like "nothing happens").
    !m.infiniteDistance &&
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
    // The procedural sky dome (unlike the HDRI skybox) never sets isPickable = false, so
    // without this a ray over an empty cell (no roof/ground under it) can travel all the
    // way out and register the sky box's inner surface as the "ground", parking rain/snow
    // hundreds of units above where it should land.
    !mesh.infiniteDistance &&
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

// @babylonjs/loaders registers the glTF/OBJ/STL/etc format plugins as a side effect of
// being imported, and every model load has to wait for that to finish (see the two
// load-model call sites below). It used to be re-imported from scratch on every single
// model load - the module itself was already cached by the bundler, but the dynamic
// import() call, its promise machinery, and the registration side effect were all
// redundantly paid for again each time. Caching the promise here means that cost is
// only ever paid once per page load, and prewarmModelLoaders() (called on mount below)
// moves it off the critical path of the very first model load too.
let sceneLoaderModulePromise: Promise<[typeof import('@babylonjs/core/Loading/sceneLoader'), typeof import('@babylonjs/loaders')]> | null = null;
function getSceneLoaderModule() {
  if (!sceneLoaderModulePromise) {
    sceneLoaderModulePromise = Promise.all([
      import('@babylonjs/core/Loading/sceneLoader'),
      import('@babylonjs/loaders')
    ]);
  }
  return sceneLoaderModulePromise;
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
  onSceneReady,
  topBarExtraLeft,
  topBarExtraRight
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
    showHotspotNav: false,
    showMeshMaterialSwatches: false,
    showInteractiveFixtures: false,
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
    showGraphicsQuality: false,
    // Real components that existed in the codebase but had no way to reach them from
    // the UI (see the site audit) - now reachable via the Tools & Features catalog's
    // "Open in Workspace" button (toolPageDefinitions.ts's workspaceFeature mapping),
    // same as every other feature flag.
    showErgonomicTesting: false,
    // Was missing from this object entirely - toolPageDefinitions.ts's presenter-mode
    // entry pointed "Open in Workspace" at 'showPresenterMode', but with no matching key
    // here the bootstrap effect's hasOwnProperty guard rejected it, so the button
    // silently did nothing. See PresenterMode's render site in uiSegments.tsx.
    showPresenterMode: false,
    showAIStructuralAdvisor: false,
    showTopographyGenerator: false,
    showConstructionOverlay: false,
    showShadowImpactAnalysis: false,
    showCirculationFlowSimulation: false,
    showEnergyDashboard: false,
    showSessionInsights: false,
    showIoTPanel: false,
    showMoodLighting: false,
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

  // Import is admin-only (see handleFeatureToggle/onImport/handleWorkspaceFileUpload's
  // own isAdmin checks below, which block the action itself) - filtered out of the
  // feature list entirely for a client so the button doesn't appear at all, rather than
  // being visible but erroring when clicked.
  const rawFeaturesByCategoryVisible = React.useMemo(() => {
    if (isAdmin) return rawFeaturesByCategory;
    const filtered: Record<string, any[]> = {};
    Object.entries(rawFeaturesByCategory).forEach(([category, features]) => {
      filtered[category] = (features as any[]).filter((f) => f.id !== 'showImport');
    });
    return filtered;
  }, [rawFeaturesByCategory, isAdmin]);

  // Real counts for the Bottom Panel's "Feature Statistics" (Performance tab) - this used
  // to be a hardcoded { total: 0, active: 0, byCategory: {}, byStatus: {} } passed straight
  // through at the render call site, even though the real data (activeFeatures,
  // rawFeaturesByCategoryVisible) was already available here, so the tab always rendered
  // as permanently empty regardless of how many features were actually on.
  const featureStatsComputed = React.useMemo(() => {
    const byCategory: Record<string, number> = {};
    let total = 0;
    Object.entries(rawFeaturesByCategoryVisible).forEach(([category, features]) => {
      const count = (features as any[]).length;
      byCategory[category] = count;
      total += count;
    });
    return { total, active: activeFeatures.size, byCategory, byStatus: {} };
  }, [rawFeaturesByCategoryVisible, activeFeatures]);

  // "Open in Workspace" from a Tools & Features page (ToolPage.tsx) navigates here as
  // /workspace?feature=showXxx - this is what actually turns that flag on. Only enables
  // a flag that's a real key in initialFeatureStates, so an arbitrary/malformed query
  // string can't toggle on something unexpected.
  //
  // Routed through handleFeatureToggle (not the raw enableFeature setter) - nearly every
  // flag's actual visible effect (opening a panel via a CustomEvent dispatch, running a
  // one-shot action like Export, initializing a manager) lives in handleFeatureToggle's
  // per-id branches below, not just in the featureStates boolean itself. Landing here via
  // "Open in Workspace" used to call enableFeature directly, which only flips the
  // boolean - for any feature whose flag already defaulted to true (e.g. showExport) that
  // was a true->true no-op, and for any feature whose real panel only opens via a
  // CustomEvent (e.g. showVoiceAssistant) nothing ever became visible. Both looked like
  // the button silently doing nothing.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const requestedFeature = searchParams.get('feature');
    if (requestedFeature && Object.prototype.hasOwnProperty.call(initialFeatureStates, requestedFeature)) {
      handleFeatureToggle(requestedFeature, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    if (!sceneReadyForLoad || !scene || !url || typeof url !== 'string') {
      // Traces the other half of the restore-on-refresh handoff (see the
      // '[restore-last-model]' logs in AppLayout.tsx) - if that side logs "found model,
      // handing off" but this line never logs "loading", the scene/sceneReadyForLoad
      // side of this guard is where the hand-off is actually getting dropped.
      if (url) console.log('[model-load-effect] skipped despite having a URL', { sceneReadyForLoad, hasScene: !!scene, url });
      return;
    }
    console.log('[model-load-effect] loading', { id: selectedModel?.id, url });

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

    // A saved Home view (see setHomeView/runAutoZoom further down) only makes sense for the
    // model it was captured on - carrying it over to whatever loads next could frame empty
    // space or the wrong object entirely. The just-loaded model's own saved record (if any)
    // is re-fetched and re-applied below once SceneLoader.Append finishes.
    homeViewRef.current = null;
    scenarioManagerRef.current?.setHomeCenter(null);
    sceneEditsRef.current = { meshes: {} };
    setFloorPlans([]);

    // Dispose whatever the previous model loaded before importing the next one,
    // otherwise this and the prior model's meshes both end up in the scene at
    // once with no way to remove the old one from the UI.
    if (loadedModelMeshesRef.current.length) {
      loadedModelMeshesRef.current.forEach((m) => {
        if (m.isDisposed()) return;
        shadowGeneratorRef.current?.removeShadowCaster(m);
        iblShadowsRef.current?.removeShadowCastingMesh(m as Mesh);
        // mesh.dispose() with no arguments defaults disposeMaterialAndTextures to false -
        // it only frees the mesh's own geometry buffers, leaving the previous model's
        // materials AND the (often much larger) textures they reference sitting in GPU
        // VRAM indefinitely every time a different model gets loaded into this same
        // workspace. Safe to pass true here even though materials/textures are commonly
        // shared across many meshes of the same model: every mesh that could reference
        // one is being disposed in this exact same loop, so nothing survives to hold a
        // dangling reference to an already-disposed material once it finishes.
        m.dispose(false, true);
      });
      loadedModelMeshesRef.current = [];
    }
    // Same reasoning as the mesh disposal just above - the previous model's ambient fill
    // lights (see ambientFillLights.ts) are positioned relative to ITS geometry, so they'd
    // be meaningless (and just extra unexplained light sources) once a different model
    // loads in.
    if (ambientFillLightsRef.current.length) {
      ambientFillLightsRef.current.forEach((light) => light.dispose());
      ambientFillLightsRef.current = [];
    }

    // Floor plan PDFs aren't 3D models - SceneLoader has no plugin for them at all.
    // Instead: render the PDF's first page (floor plans are effectively always single-
    // page) to an offscreen canvas via pdf.js, then treat that image as a texture on a
    // flat plane laid on the ground - viewed from above, the way a real printed floor
    // plan would be laid on a table or the site itself. It's registered in
    // loadedModelMeshesRef the same as a real model's meshes, so the existing
    // dispose-on-next-load cleanup above and every AR placement/scale/rotate control
    // already built for 3D models work on it completely unchanged.
    // A genuine, final load failure (not a retry) for whichever model/floor-plan
    // AppLayout's restore-last-model effect just handed off left it stuck in localStorage
    // forever: every future refresh reads the same remembered id, refetches the same
    // broken URL, and fails again, with no way out short of manually opening a different
    // model or clearing browser storage by hand. AppLayout already clears this same key
    // for the two failure cases it can detect itself (no modelUrl on record, or the id not
    // found in /models at all) - this covers the remaining case, where the record and URL
    // both look fine but the actual file fetch fails once a load is actually attempted.
    const clearStaleRestoredModelId = () => {
      try {
        if (selectedModel?.id && localStorage.getItem(LAST_MODEL_ID_KEY) === String(selectedModel.id)) {
          localStorage.removeItem(LAST_MODEL_ID_KEY);
        }
      } catch { /* localStorage unavailable - nothing to clean up */ }
    };

    const loadPdfFloorPlan = async () => {
      try {
        const [pdfjsLib, workerUrlModule] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.mjs?url')
        ]);
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;

        const pdfDocument = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        const page = await pdfDocument.getPage(1);
        // scale: 2 renders at roughly double the PDF's native point resolution - sharp
        // enough to read room labels/dimensions up close without an enormous texture.
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not create a 2D canvas context to render the PDF page');
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (cancelled) return;

        // Longer side normalized to 4 metres - a reasonable default "on the table"
        // scale for a floor plan with no inherent real-world size of its own; the AR
        // Scale panel and the AR overlay's own scale buttons (already built for 3D
        // models) resize it from there to actually match the real site.
        const aspect = viewport.width / viewport.height;
        const planeWidth = aspect >= 1 ? 4 : 4 * aspect;
        const planeHeight = aspect >= 1 ? 4 / aspect : 4;

        const plane = MeshBuilder.CreatePlane('pdf_floorplan', { width: planeWidth, height: planeHeight }, scene);
        plane.rotation.x = Math.PI / 2; // lie flat on the ground, viewed from above
        plane.position.y = 0.01; // just clear of the ground plane - avoids z-fighting

        const texture = new Texture(canvas.toDataURL('image/png'), scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
        const material = new StandardMaterial('pdf_floorplan_material', scene);
        material.diffuseTexture = texture;
        // Unlit (reads like a printed page/photo regardless of scene lighting/shadows,
        // rather than a 3D surface that darkens toward the edges of a light's range).
        material.emissiveTexture = texture;
        material.disableLighting = true;
        material.backFaceCulling = false;
        plane.material = material;
        plane.isPickable = true;

        // Missing here (unlike the regular 3D model load path a little further down, and
        // the file-upload path) was exactly the bug removePlaceholderGeometry itself was
        // written to fix (see its own comment above): selectedModel is still null the
        // instant the scene first initializes on a fresh page load/refresh, since
        // restoring the last-opened model is an async fetch that hasn't resolved yet -
        // so the placeholder ground+box get created regardless, and nothing ever
        // removed them once a PDF floor plan (as opposed to a regular 3D model)
        // subsequently loaded successfully. They stayed stuck floating in the scene
        // forever, sitting right on top of the real floor plan.
        removePlaceholderGeometry(scene);
        loadedModelMeshesRef.current = [plane];
        showToast.dismiss(toastId);
        showToast.success(`Floor plan loaded: ${selectedModel?.name || 'Floor plan'}`);
        setSelectedModel(null);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load PDF floor plan:', error);
        showToast.dismiss(toastId);
        showToast.error('Failed to load floor plan PDF', error instanceof Error ? error.message : undefined);
        setSelectedModel(null);
        clearStaleRestoredModelId();
      }
    };

    const attemptLoad = (attempt: number) => {
      if (pluginExtension === '.pdf') {
        loadPdfFloorPlan();
        return;
      }
      // @babylonjs/loaders registers the glTF/OBJ/STL/etc plugins as a side effect of
      // being imported - it was previously fired off without awaiting it, so
      // SceneLoader.Append below could (and on a fresh page load, reliably did) run
      // before the .glb plugin had finished registering. With no matching plugin found,
      // SceneLoader silently fell back to its native .babylon JSON scene parser, which
      // tried to JSON.parse the raw binary GLB bytes and failed with a confusing
      // "importScene ... has failed JSON parse" error instead of actually loading the
      // model.
      getSceneLoaderModule().then(([{ SceneLoader }]) => {
        const meshesBefore = new Set(scene.meshes);
        SceneLoader.Append('', url, scene, async () => {
          if (cancelled) return;
          const newMeshes = scene.meshes.filter((m) => !meshesBefore.has(m));
          loadedModelMeshesRef.current = newMeshes;
          // Re-applies whatever was auto-saved (see pushUndo/scheduleAutoSave above) the
          // last time this same model was edited - a fresh SceneLoader.Append here always
          // recreates meshes straight from the source file with none of that, which is why
          // an edit used to vanish the moment you navigated away and back. Computed
          // directly from selectedModel rather than reading the currentModelId state
          // variable, since this closure was created before this same effect's own
          // setCurrentModelId() call above would have taken effect.
          //
          // Kicked off here (not awaited yet) so this fetch runs in parallel with the
          // merge/BIM/shadow-registration work below rather than after it - it's only
          // actually awaited further down, once that work (which the freeze loop needs to
          // run after - see the comment there) has finished.
          const loadedModelId = selectedModel?.id ? String(selectedModel.id) : 'default-model';
          const savedEditsPromise = loadSceneEdits(loadedModelId);

          removePlaceholderGeometry(scene);
          // Some exported CAD/BIM files mark certain nodes hidden (e.g. glTF's
          // KHR_node_visibility, from an alternate design option or hidden layer in the
          // source tool) - those load with isVisible=false and silently don't render,
          // while still being enabled/pickable, so clicking that empty-looking spot
          // selected an invisible mesh with no way to ever see it. This app has no UI for
          // toggling hidden layers back on, so treat "hidden in the source file" as a
          // loader quirk to override rather than a real feature.
          newMeshes.forEach((m) => {
            m.isVisible = true;
            // Real building geometry (walls/floors/furniture) should block the walking
            // camera - see scene.collisionsEnabled above for why this was a no-op before.
            if (m.getTotalVertices() > 0) m.checkCollisions = true;
          });
          // Collapses small repeated decorative clutter (bushes, hedges, railings,
          // fences, rocks, lamps - see meshMerging.ts) sharing a material into one mesh
          // per group, cutting draw calls on mesh-heavy architectural imports. Mutates
          // newMeshes in place, so BIM registration, both shadow-caster loops below, and
          // the freeze loop further down (via loadedModelMeshesRef.current, the same
          // array object) all automatically see the corrected post-merge list. Must run
          // before BIM registration specifically - that snapshots direct mesh references,
          // which would go stale the moment a merge disposes the originals.
          //
          // Awaited (and chunked internally, along with BIM registration and both
          // shadow-caster loops below) rather than left as one long synchronous run - on
          // a genuinely "high mesh" import (thousands of separate meshes) these four
          // per-mesh passes running back-to-back with nothing yielding to the browser in
          // between was long enough for Chrome to conclude the tab had hung and show its
          // own "Page Unresponsive" dialog, even though the work itself was going to
          // finish fine given a few more seconds.
          if (cancelled) return;
          await mergeDecorativeMeshes(newMeshes, scene);
          // Gives any "untouched" imported material (still at whatever flat default the
          // source file's exporter left it with) a believable per-element PBR response by
          // name (glass, metal, floor, wood, fabric, generic) - see materialEnhancement.ts
          // for exactly what it will and won't touch. This is what actually closes the
          // "walls look flat/plastic, not like Enscape" gap - the PBR pipeline, HDRI, and
          // post-processing were already in place, but nothing was tuning the model's own
          // material response until now. Cheap (property sets only, no textures/geometry
          // touched) so left synchronous rather than chunked like the passes above.
          if (cancelled) return;
          const materialEnhancementResult = enhanceImportedMaterials(newMeshes);
          // Surface meshes whose source file assigned them no material at all (Babylon's
          // own glTF-loader fallback, MISSING_MATERIAL_NAME - see materialEnhancement.ts).
          // enhanceImportedMaterials already gave these a plausible generic PBR look so the
          // scene doesn't render broken, but no name-based heuristic can invent real
          // wood-grain/stone/glass data that was never in the file - flagging them (rather
          // than silently leaving one object looking flatter than the rest with no
          // explanation) is what lets a user go fix it via the Material Editor instead of
          // wondering why lighting/HDRI changes never make that one object look right.
          if (materialEnhancementResult.missingMaterialMeshes.length > 0) {
            materialEnhancementResult.missingMaterialMeshes.forEach((m) => {
              m.metadata = { ...(m.metadata || {}), missingMaterial: true };
            });
            const names = materialEnhancementResult.missingMaterialMeshes.map((m) => m.name);
            console.warn('[materialEnhancement] Meshes with no material in the source file:', names);
            const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '');
            showToast.warning(
              `${names.length} object${names.length > 1 ? 's have' : ' has'} no material assigned`,
              `${preview} - the source file didn't include material data for ${names.length > 1 ? 'these' : 'this'}. Open Material Editor and assign a material to fix ${names.length > 1 ? 'them' : 'it'}.`
            );
          }
          // Real image-based material recognition (Enscape-style "look at the actual
          // texture", not just the mesh/material name) - see textureMaterialClassifier.ts.
          // Deliberately fire-and-forget, not awaited: downloading the CLIP model (first use
          // only, then cached by the browser) and classifying every real texture in the
          // model can take anywhere from a couple seconds to tens of seconds, and none of
          // that should hold up the model finishing its load / becoming interactive - this
          // only ever IMPROVES materials that already have real texture data as results
          // arrive, same as a progressive enhancement. Guarded on `cancelled` at the only
          // point that matters (before it does anything) - if the user has already
          // navigated to a different model by the time this would run, its result would
          // only ever touch this now-unused mesh list, harmless but pointless.
          if (!cancelled) {
            classifyMaterialsByTexture(newMeshes).catch((error) => {
              console.warn('[textureMaterialClassifier] Material recognition pass failed:', error);
            });
          }
          // Cheap real-time approximation of indirect/bounce light (see
          // ambientFillLights.ts's own top comment for why this exists and how it stays
          // safe/subtle) - a few soft lights placed near detected windows. Purely additive:
          // does not touch the sun/hemispheric lights, HDRI, shadows, or any post-process
          // pipeline set up elsewhere in this effect (all still ahead of this point in the
          // file, at scene-init - this only ever adds new Light objects on top).
          const fillResult = addAmbientFillLights(scene, newMeshes);
          ambientFillLightsRef.current = fillResult.lights;
          console.log(`[ambient-fill-lights] added ${fillResult.lights.length} (windows detected: ${fillResult.windowsDetected})`);

          // Fixes a real, pre-existing bug reported this session (visible banding/stripe
          // lines across roofs/walls, appearing specifically right after the "Reduced
          // shadow quality" toast - i.e. exactly when the CSM watchdog further below trips
          // and disables autoCalcDepthBounds under sustained low FPS). CascadedShadowGenerator's
          // own shadowMaxZ defaults to camera.maxZ (confirmed in Babylon's own source) -
          // fine while autoCalcDepthBounds is on (it recomputes tight bounds from the
          // actual rendered scene every couple of frames, ignoring shadowMaxZ), but once
          // that's disabled, cascades fall back to splitting the FULL camera near/far
          // range - exactly the "far larger than the actual scene" mismatch this file's own
          // CSM setup comment already documents as the cause of banded seam lines. camera.maxZ
          // was deliberately widened earlier this session (for a separate Z-fighting fix,
          // to comfortably fit a model at max zoom-out) to something much larger than a
          // typical building actually needs for shadows specifically - shadowMaxZ is
          // independently settable, so this keeps the shadow cascade range tight to the
          // real model regardless of how far the camera's own far plane reaches.
          if (shadowGeneratorRef.current instanceof CascadedShadowGenerator) {
            let shadowMinY = Infinity, shadowMaxY = -Infinity;
            let shadowMinX = Infinity, shadowMaxX = -Infinity, shadowMinZv = Infinity, shadowMaxZv = -Infinity;
            for (const m of newMeshes) {
              if (m.getTotalVertices() === 0) continue;
              const bb = m.getBoundingInfo().boundingBox;
              shadowMinX = Math.min(shadowMinX, bb.minimumWorld.x); shadowMaxX = Math.max(shadowMaxX, bb.maximumWorld.x);
              shadowMinY = Math.min(shadowMinY, bb.minimumWorld.y); shadowMaxY = Math.max(shadowMaxY, bb.maximumWorld.y);
              shadowMinZv = Math.min(shadowMinZv, bb.minimumWorld.z); shadowMaxZv = Math.max(shadowMaxZv, bb.maximumWorld.z);
            }
            if (Number.isFinite(shadowMinX)) {
              const modelDiagonal = Vector3.Distance(
                new Vector3(shadowMinX, shadowMinY, shadowMinZv),
                new Vector3(shadowMaxX, shadowMaxY, shadowMaxZv)
              );
              // Generous multiple of the model's own size (not a fixed constant) so a
              // large site still gets a far plane that comfortably covers it, while a
              // small room doesn't inherit a needlessly huge one - floor keeps very tiny
              // models from getting an unreasonably tight shadowMaxZ.
              (shadowGeneratorRef.current as CascadedShadowGenerator).shadowMaxZ = Math.max(modelDiagonal * 3, 50);
            }
          }
          // A cheap, safe win for decorative background clutter specifically (bush/rail/
          // lamp-shaped meshes - see isDecorativeClutterMesh, the exact same check
          // mergeDecorativeMeshes above already uses) - NOT applied to the rest of the
          // model. Furniture, walls, and anything fixture/BIM-relevant are deliberately
          // left untouched: isPickable=false would make a sofa/table unselectable in the
          // Property Inspector/Material Editor. Decorative clutter has no such identity
          // dependency anywhere in this app, so it's the one category safe to apply this
          // to automatically - removes it from every future raycast (Movement Check,
          // click-to-select, teleport-to-floor) for the rest of the session, for free.
          //
          // This used to also queue each qualifying mesh onto Babylon's mesh.simplify()
          // (a runtime LOD swap at distance 25). Removed: modelOptimizer.ts already runs
          // real geometry simplification once, offline, at upload time (see its
          // gltf-transform simplify() call) - queuing a SECOND, runtime decimation pass on
          // top of that was pure duplicated cost, and Babylon's simplification queue
          // processes one mesh at a time, so on an exterior model with hundreds of bushes/
          // rails/lamps it kept the main thread busy for a long stretch AFTER the "Model
          // loaded" toast (reported this session as ongoing lag right after load). Worse,
          // each generated LOD mesh is a brand-new Mesh object Babylon creates and swaps in
          // asynchronously and unpredictably relative to camera distance - it never got
          // freezeWorldMatrix/doNotSyncBoundingInfo/culling-strategy/shadow-caster
          // registration (all applied further below, before that swap had resolved) or
          // isPickable=false, so it could pop to a visibly lower-detail mesh mid-session
          // with no fade and silently become pickable/un-shadowed again right as it did -
          // exactly the exterior "glitch" reported this session.
          if (cancelled) return;
          {
            let minV = newMeshes[0]?.getBoundingInfo().boundingBox.minimumWorld.clone() ?? Vector3.Zero();
            let maxV = newMeshes[0]?.getBoundingInfo().boundingBox.maximumWorld.clone() ?? Vector3.Zero();
            for (const m of newMeshes) {
              if (m.getTotalVertices() === 0) continue;
              const bb = m.getBoundingInfo().boundingBox;
              minV = Vector3.Minimize(minV, bb.minimumWorld);
              maxV = Vector3.Maximize(maxV, bb.maximumWorld);
            }
            const modelDiagonal = maxV.subtract(minV).length();
            await runChunked(newMeshes, (m) => {
              if (!isDecorativeClutterMesh(m, modelDiagonal)) return;
              m.isPickable = false;
            });
          }
          // Register the real loaded meshes as a BIM model so Cost Estimator,
          // ROI Calculator, Budget Tier Comparison, and Ergonomic/Energy/
          // Shadow Analysis (all of which look up bimManager.getModelById())
          // have real data instead of showing "load a model first" forever.
          if (cancelled) return;
          if (bimManagerRef.current && selectedModel?.id) {
            await bimManagerRef.current.registerLoadedModelFromScene(String(selectedModel.id), selectedModel?.name || 'Uploaded Model');
          }
          if (cancelled) return;
          const shadowGenerator = shadowGeneratorRef.current;
          if (shadowGenerator) {
            await runChunked(newMeshes, (m) => {
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
          if (cancelled) return;
          // Same glass exclusion for IBL Shadows' voxel grid, if that pipeline is active
          // (Ultra tier - see the enableIBLShadows effect above). updateSceneBounds/
          // updateVoxelization only need to run once per batch, after every mesh in this
          // model has been registered, not per-mesh.
          if (iblShadowsRef.current) {
            await runChunked(newMeshes, (m) => {
              if (!isGlassMesh(m)) {
                iblShadowsRef.current!.addShadowCastingMesh(m as Mesh);
              }
            });
            if (cancelled) return;
            iblShadowsRef.current.updateSceneBounds();
            iblShadowsRef.current.updateVoxelization();
          }
          showToast.dismiss(toastId);
          showToast.success(`Model loaded: ${selectedModel?.name || 'Model'}`);
          setSelectedModel(null);

          const savedEdits = await savedEditsPromise;
          if (cancelled) return;
          if (savedEdits) {
            sceneEditsRef.current = savedEdits;
            applySceneEdits(loadedModelMeshesRef.current, savedEdits);
            // Restores the saved Home view (see setHomeView) on this device too - previously
            // this only ever lived in a plain useRef, so it reset the moment you navigated
            // away and back, let alone opened the model on a different device.
            const home = savedEdits.homeView;
            const cam = cameraRef.current;
            if (home && cam && typeof cam.setTarget === 'function') {
              const target = new Vector3(home.target.x, home.target.y, home.target.z);
              cam.setTarget(target);
              cam.alpha = home.alpha;
              cam.beta = home.beta;
              cam.radius = home.radius;
              homeViewRef.current = { alpha: home.alpha, beta: home.beta, radius: home.radius, target };
              scenarioManagerRef.current?.setHomeCenter(target);
            }
            // Restores the model's saved floor plan PDFs on this device too (see
            // handleFloorPlansChange/Minimap.tsx) - previously localStorage-only.
            setFloorPlans(savedEdits.floorPlans || []);
          }
          // Freezing has to wait until AFTER any saved position/rotation/scaling edits
          // above are applied - freezeWorldMatrix() makes a mesh skip recomputing its
          // world matrix from its transform entirely, so freezing first would make
          // applySceneEdits' mesh.position.set() calls silently do nothing visually. It
          // also has to wait until AFTER mergeDecorativeMeshes above, now guaranteed by
          // running sequentially after it (rather than racing it via a separate promise
          // chain, as this used to) - freezing a mesh that merge is about to dispose, or
          // missing the freshly-created merged mesh entirely, both silently no-op.
          // A real architectural import (2,000+ separate meshes) recomputing every
          // static mesh's matrix and re-syncing its bounding info every frame for
          // nothing - none of them move on their own - is real, measurable per-frame
          // cost; the gizmo attach effect below unfreezes/refreezes whichever single
          // mesh is actually being edited, so this doesn't break moving/editing meshes,
          // only skips redoing work for the thousands that never move.
          // Deliberately NOT using scene.createOrUpdateSelectionOctree() here even though
          // it's the other standard win for a mesh-heavy scene: Babylon builds it once
          // from a snapshot of scene.meshes at call time, and once it exists, the active-
          // mesh list for BOTH rendering and scene.pick() candidates comes ONLY from the
          // octree - not a union with anything added after. Every marker this app creates
          // post-load (hotspots, annotations, swatches, measurements, ambient audio zones)
          // would silently stop rendering/being pickable the moment one was added after
          // this ran, without touching every one of those tools to rebuild the octree on
          // every marker add/remove. Not worth that regression risk for this win.
          // Frustum culling (cullingStrategy below) only helps once a mesh is actually
          // inside the camera's view cone - it can't know a wall is hiding a whole room's
          // furniture behind it. Occlusion culling is the complementary win for that: each
          // mesh gets its own GPU visibility query, and any one that was fully hidden
          // behind opaque geometry in the last rendered frame skips its own draw call on
          // the next one. This has to be applied broadly (every real content mesh above a
          // trivial size), not just to walls - Babylon's occlusion query is per-mesh (it
          // answers "was THIS mesh visible", not "does this mesh hide others"), so a wall
          // alone never culls the room behind it; the furniture itself needs the query.
          // OPTIMISTIC (not STRICT) keeps rendering a mesh while its query result is still
          // pending, so this can never cause pop-in/flicker - it only skips a frame once a
          // query has actually confirmed a mesh is hidden. Gated on the engine actually
          // supporting occlusion queries and skipped on mobile, where GPU/driver support
          // for this is inconsistent enough not to trust blindly without live testing -
          // EXCEPT a standalone VR headset's browser, which reports itself as "mobile"
          // (Quest OS is Android-based, so its UA contains "Android" the same as any
          // phone - DeviceDetector.isMobileDevice() can't tell them apart) but doesn't
          // carry that same driver-inconsistency risk: Meta Quest's browser is a single,
          // consistent, modern Chromium build, not the heterogeneous "any Android
          // vendor's GPU driver" landscape the mobile gate exists to guard against. A
          // headset is also exactly the case this matters most for - VR renders the
          // whole scene twice (once per eye) at a much higher target framerate than flat
          // desktop, so an interior scene's draw-call cost hits hardest exactly here.
          // Reported this session as the interior being very slow specifically on a
          // Meta Quest headset.
          const isStandaloneXRHeadsetBrowser = /OculusBrowser|Quest/i.test(navigator.userAgent);
          const engine = engineRef.current;
          // TEMPORARILY DISABLED (hardcoded false) - reported this session as whole models
          // rendering fine for the first frame or two, then vanishing entirely, with no user
          // interaction required and independent of graphics quality tier (which rules out
          // the tier-gated SSR/IBL Shadows conflict documented elsewhere in this file). That
          // symptom shape - visible while OPTIMISTIC has no query result yet, gone once the
          // first result comes back - points straight at occlusion queries returning wrong
          // results, and this session also switched the engine to a reverse depth buffer
          // (engine.useReverseDepthBuffer = true, see initializeScene) to fix a separate
          // Z-fighting issue, which changes which depth comparison direction counts as
          // "passed" for every depth test in the scene, occlusion queries included. This
          // mechanism has also already caused a similar wrongly-hides-real-geometry bug once
          // before, in VR specifically (see the "guard occlusion culling against fast
          // head-turns" fix elsewhere in this file) - a second, broader instance of the same
          // class of bug is more likely than two unrelated causes. Disabling outright rather
          // than trying to patch the interaction blind, with no way to verify a fix live in
          // this environment: frustum culling (cullingStrategy right below) still applies on
          // its own, so this only gives up the additional behind-a-wall win, not correctness.
          // Re-enable once confirmed fixed (or confirmed unrelated) via live testing.
          const supportsOcclusion = false && !!engine?.getCaps().supportOcclusionQuery && (!deviceCapabilities?.mobile || isStandaloneXRHeadsetBrowser);
          const OCCLUSION_MIN_VERTICES = 24; // skip trivial hardware (a screw, a handle) - query overhead isn't worth it for those
          occlusionMeshesRef.current = [];
          await runChunked(loadedModelMeshesRef.current, (m) => {
            const vertexCount = m.getTotalVertices();
            if (vertexCount === 0) return;
            m.freezeWorldMatrix();
            m.doNotSyncBoundingInfo = true;
            // Babylon's default culling strategy tests a mesh's full bounding BOX against
            // the camera frustum (several plane/corner checks); BOUNDINGSPHERE_ONLY tests
            // one sphere instead - meaningfully cheaper per mesh, at the cost of very
            // slightly less precise culling (a mesh right at the frustum edge might stay
            // "visible" one or two extra frames before culling catches up) - a real, free
            // trade for every one of potentially thousands of static meshes tested this
            // way every single frame. Same meshes already getting frozen above, so no
            // additional risk beyond what freezeWorldMatrix already carries.
            m.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
            if (supportsOcclusion && vertexCount >= OCCLUSION_MIN_VERTICES) {
              m.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
              m.occlusionQueryAlgorithmType = AbstractMesh.OCCLUSION_ALGORITHM_TYPE_CONSERVATIVE;
              m.occlusionRetryCount = 2;
              occlusionMeshesRef.current.push(m);
            }
          });
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
          // retrying those. "status: 0" (Babylon's LoadFileError message for this) is
          // its own real, common case that this keyword list used to miss entirely -
          // it's what the browser reports when an XHR got no HTTP response at all
          // (a transient CORS preflight hiccup, a dropped connection, a network
          // switch), as opposed to a real numeric status like 404/415 that means the
          // file/format itself is the problem and retrying won't help. Without this,
          // every one of those transient cases failed permanently on the very first
          // attempt instead of getting the same retry a plain network error would.
          const isLikelyNetworkError = !exception || exception?.name === 'TypeError' || /network|fetch|timeout|ECONNRESET|status:?\s*0\b/i.test(msg || '');
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
            clearStaleRestoredModelId();
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

  // Same bug as handleCategoryToggle above, just at the "Expand all" scale: this was
  // force-enabling (or disabling) every single feature in every category - clicking
  // "Expand all" turned on all ~60 tools (BIM, Weather, VR, AR, everything) at once
  // instead of just opening every category's list to choose from.
  const handleToggleAllCategories = useCallback((visible: boolean) => {
    const updates: Record<string, boolean> = {};
    Object.keys(featureCategories).forEach(cat => { updates[cat] = visible; });
    setCategoryPanelVisible(updates);
  }, [setCategoryPanelVisible]);

  // Domain Selector previously only set local component state and showed a toast with
  // zero effect on the rest of the workspace, despite being described as scoping "the
  // experience to a specific design domain" - picking a domain now expands the Tool
  // Categories most relevant to it (additively - it doesn't collapse whatever the user
  // already had open), so it actually does something instead of being decorative.
  const DOMAIN_RELEVANT_CATEGORIES: Record<string, string[]> = {
    architecture: ['Core Workspace', 'Simulations and Analysis', 'Tools and Editors'],
    interiors: ['Core Workspace', 'Auto Furnish & AR Anchor'],
    urban: ['Simulations and Analysis', 'Geo and Location'],
  };
  const handleDomainChange = useCallback((domainId: string) => {
    const relevant = DOMAIN_RELEVANT_CATEGORIES[domainId];
    if (!relevant) return;
    const next = { ...categoryPanelVisible };
    relevant.forEach((category) => { next[category] = true; });
    setCategoryPanelVisible(next);
  }, [categoryPanelVisible, setCategoryPanelVisible]);

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
  // User-selectable graphics quality override ('auto' defers to recommendedQuality, the
  // device-detected recommendation) - lets someone drop to Low on a device that's
  // lagging, or force Ultra on a strong desktop that auto-detection under-recommended,
  // without reloading. Applied live by the effect keyed on [graphicsQuality,
  // recommendedQuality] further below.
  const [graphicsQuality, setGraphicsQuality] = React.useState<'auto' | 'low' | 'medium' | 'high' | 'ultra'>(renderingQuality);
  const [recommendedQuality, setRecommendedQuality] = React.useState<'low' | 'medium' | 'high' | 'ultra'>('medium');
  // Bottom Panel's 3-button Performance Mode control (low/medium/high only) is a simplified
  // view onto the real 5-tier graphicsQuality system above, not a separate setting - it used
  // to be backed by useWorkspaceState's setPerformanceMode, which was a TODO stub that only
  // console.logged, so clicking Low/Medium/High visibly highlighted a button but never
  // actually changed anything. 'auto' resolves to whatever tier recommendedQuality currently
  // is; 'ultra' collapses into 'high' since the simplified control has no ultra button.
  const performanceModeResolved = React.useMemo<'low' | 'medium' | 'high'>(() => {
    const resolved = graphicsQuality === 'auto' ? recommendedQuality : graphicsQuality;
    return resolved === 'ultra' ? 'high' : resolved;
  }, [graphicsQuality, recommendedQuality]);
  const handlePerformanceModeChange = React.useCallback((mode: 'low' | 'medium' | 'high') => {
    setGraphicsQuality(mode);
  }, []);

  // Real scene export (GLB via glTF-Serializer) - named/hoisted here (rather than inline
  // in the top bar's props object, where it originally lived) so the Bottom Panel's own
  // Export tab can call the SAME real export instead of the fake setInterval-driven
  // progress bar it used to simulate with no actual file ever produced.
  const handleExportScene = React.useCallback(() => {
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
  }, []);

  // Real screenshot capture - same hoisting reason as handleExportScene above, so the
  // Bottom Panel's Export tab's "PNG" option produces an actual downloaded image instead
  // of a fake progress bar.
  const handleScreenshotCapture = React.useCallback((format?: 'png' | 'jpeg') => {
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
  }, []);
  const [gpuName, setGpuName] = React.useState<string>('');
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const [transformMode, setTransformMode] = React.useState<'none' | 'position' | 'rotation' | 'scale'>('none');
  type UndoEntry =
    | { kind: 'transform'; mesh: Mesh; position: Vector3; rotationQuaternion: Quaternion | null; rotation: Vector3; scaling: Vector3 }
    | { kind: 'material'; material: Material; snapshot: Record<string, any> }
    | { kind: 'materialSwap'; mesh: AbstractMesh; previousMaterial: Material }
    | { kind: 'delete'; mesh: AbstractMesh };
  const undoHistoryRef = useRef<UndoEntry[]>([]);
  // Debounce handle for the auto-save scheduled by pushUndo() (declared further below,
  // once loadedModelMeshesRef/currentModelId are in scope) - one timer shared across every
  // edit source (gizmo, Mirror, Material Editor, Property Inspector) so a burst of edits
  // triggers a single save ~1.5s after the user stops, not one network call per edit.
  const saveEditsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sustainabilityReport, setSustainabilityReport] = React.useState<SustainabilityReport | null>(null);
  const sustainabilityManagerRef = useRef<SustainabilityManager | null>(null);
  const presentationManagerRef = useRef<PresentationManager | null>(null);
  const iotManagerRef = useRef<IoTManager | null>(null);
  const simulationManagerRef = useRef<SimulationManager | null>(null);
  const [rainOn, setRainOn] = React.useState(false);
  const [rainIntensity, setRainIntensity] = React.useState(1); // 0.2 (light) - 2 (heavy) - shared speed/quantity for rain AND snow
  const [snowOn, setSnowOn] = React.useState(false);
  const [particleSize, setParticleSize] = React.useState(1); // shared size multiplier for rain + snow, 0.3 (fine) - 3 (large)
  const [floodOn, setFloodOn] = React.useState(false);
  // Mirrors rainOn/snowOn/floodOn for the VR menu's provider function (see the
  // registerVRMenuProvider effect below) - that provider is registered with XRManager
  // ONCE and then called fresh on every in-headset menu refresh, potentially long after
  // this render; reading raw `rainOn` etc there would close over whatever they were AT
  // REGISTRATION TIME, not their current value, the same staleness InteractiveFixtures'
  // own fixturesRef already exists to avoid.
  const rainOnRef = useRef(rainOn);
  useEffect(() => { rainOnRef.current = rainOn; }, [rainOn]);
  const snowOnRef = useRef(snowOn);
  useEffect(() => { snowOnRef.current = snowOn; }, [snowOn]);
  const floodOnRef = useRef(floodOn);
  useEffect(() => { floodOnRef.current = floodOn; }, [floodOn]);
  const [currentModelId, setCurrentModelId] = React.useState<string>('default-model');
  const [fps, setFps] = React.useState(60);
  // Real "Warnings" content for the Bottom Panel's Performance tab (previously always []
  // regardless of actual scene performance) - a genuinely low live FPS is exactly what that
  // tab exists to surface, using the same `fps` state the FPS badge elsewhere already reads.
  const performanceWarnings = React.useMemo(
    () => (fps > 0 && fps < 30 ? [`Low frame rate (${fps} FPS) - try switching Performance Mode to a lower tier.`] : []),
    [fps]
  );
  const [workspaces, setWorkspaces] = React.useState<GeoWorkspaceArea[]>([]);
  const [enablePostProcessing, setEnablePostProcessing] = React.useState(true);
  const [enableBloom, setEnableBloom] = React.useState(true);
  const [enableDepthOfField, setEnableDepthOfField] = React.useState(false);
  const [enableMotionBlur, setEnableMotionBlur] = React.useState(false);
  const [enableSSAO, setEnableSSAO] = React.useState(false);
  // Real screen-space reflections, gated to the Ultra quality tier only - the earlier
  // attempt at this used Babylon's older ScreenSpaceReflectionPostProcess and was pulled
  // for visible flicker near geometry edges under camera movement (see the removed-code
  // comment further down). SSRRenderingPipeline (Babylon's newer SSR2 implementation) has
  // built-in edge/distance/iteration attenuation specifically to fade reflections out
  // instead of hard-cutting them at the exact spots that caused that flicker, so it's
  // worth a second attempt - restricted to Ultra since ray-marching a reflection buffer
  // per pixel is the most expensive effect in this pipeline.
  const [enableSSR, setEnableSSR] = React.useState(false);
  // null = follow the tier-driven automatic choice above (today's default, unchanged);
  // true/false = an explicit choice from the Graphics Quality panel's "Reflections" toggle
  // that wins over the tier default - see the quality effect further down and the FPS
  // watchdog effect, which can clear this back to null if it has to force SSR off.
  const [ssrOverride, setSsrOverride] = React.useState<boolean | null>(null);
  // Real voxel-traced ambient shadowing from the scene's environment texture
  // (IblShadowsRenderPipeline, new in Babylon 9.x) - distinct from both the CSM sun
  // shadows and SSAO2's screen-space approximation. Same Ultra-only/overridable/
  // FPS-watchdog treatment as SSR above since voxelizing + tracing + blurring +
  // accumulating a shadow buffer every frame is at least as expensive.
  const [enableIBLShadows, setEnableIBLShadows] = React.useState(false);
  const [iblShadowsOverride, setIblShadowsOverride] = React.useState<boolean | null>(null);
  // SSR and IBL Shadows both reconfigure the scene's shared GeometryBufferRenderer when
  // enabled (see their creation effects further down for the exact mechanism - confirmed
  // by reading @babylonjs/core's own IblShadowsRenderPipeline source, which forces
  // generateNormalsInWorldSpace=true on it, conflicting with what SSR's own
  // forceGeometryBuffer=true depends on). Having both active at once is what broke
  // rendering into a black scene with only bloom-lit edges glowing (reported this
  // session). Not defaulting IBL Shadows on at Ultra alongside SSR (an earlier fix this
  // same session) only closed the AUTOMATIC path into that combination - manually
  // toggling both on via the Graphics Quality panel's own switches hits the exact same
  // conflict, which these wrappers close too: turning one on while the other is
  // currently active turns the other off, with an explanation, rather than allowing the
  // broken combination through any path.
  const handleSsrOverrideChange = React.useCallback((value: boolean | null) => {
    setSsrOverride(value);
    if (value === true && enableIBLShadows) {
      setIblShadowsOverride(false);
      showToast.info('Turned off Ambient Shadows', 'Reflections and Ambient Shadows conflict with each other when both are on at once - only one can be active at a time.');
    }
  }, [enableIBLShadows]);
  const handleIblShadowsOverrideChange = React.useCallback((value: boolean | null) => {
    setIblShadowsOverride(value);
    if (value === true && enableSSR) {
      setSsrOverride(false);
      showToast.info('Turned off Reflections', 'Reflections and Ambient Shadows conflict with each other when both are on at once - only one can be active at a time.');
    }
  }, [enableSSR]);
  const [enableGrain, setEnableGrain] = React.useState(false);
  const [enableVignette, setEnableVignette] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'walk' | 'orbit' | 'dollhouse' | 'vr' | 'ar'>('orbit');
  // Babylon's DefaultRenderingPipeline.bloomWeight isn't a gentle 0-1 fraction the way
  // it reads - at 1.0 (this state's previous default, with no UI slider anywhere ever
  // calling setBloomIntensity to bring it down) it aggressively blooms everything past
  // the 0.8 threshold, and combined with the large bloomKernel already configured below,
  // that's exactly what produced the sun and any bright sunlit surface "bleaching" out
  // to a huge soft white glow. 0.3 matches the bloomWeight this same codebase already
  // uses elsewhere (src/scenes/sceneManager.ts) for a normal, realistic amount of bloom
  // rather than an overexposed one.
  const [bloomIntensity, setBloomIntensity] = React.useState(0.3);
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

  // "Home" camera view - captured on demand via the Set button next to Fit, so Fit can
  // return to the exact same position/angle every time instead of recomputing bounds fresh
  // on each click (which can land differently depending on what's currently visible/
  // selected at that moment). Closer to a SketchUp-style "reset to a saved position" than a
  // pure bounds-only auto-zoom. Cleared whenever a new model is loaded (see the model-load
  // effect above) since a saved view only makes sense for the model it was captured on.
  const homeViewRef = React.useRef<{ alpha: number; beta: number; radius: number; target: Vector3 } | null>(null);

  // PDF floor plans (Minimap panel) - real React state (not just sceneEditsRef) so Minimap
  // re-renders with the model's saved plans once loadSceneEdits resolves, instead of only
  // ever seeing whatever was in local state when it first mounted.
  const [floorPlans, setFloorPlans] = React.useState<SceneEditsData['floorPlans']>([]);
  const handleFloorPlansChange = React.useCallback(async (next: SceneEditsData['floorPlans']) => {
    const wasAdded = (next?.length ?? 0) > (floorPlans?.length ?? 0);
    setFloorPlans(next);
    sceneEditsRef.current = { ...sceneEditsRef.current, floorPlans: next };
    // Was fire-and-forget with the result ignored - a save the backend rejected (a PDF
    // preview image can make this record large) failed completely silently, so it
    // looked saved in this browser but was never actually on the server: gone on
    // reload, never visible on a different device. Merges just this field onto the
    // server's latest record (mergeAndSaveSceneEdits) rather than sending the whole
    // sceneEditsRef.current wholesale - that ref has no way to know about a swatch/
    // fixture/ambient-zone another panel saved independently a moment earlier, and a
    // plain overwrite here would have silently erased it.
    const saved = await mergeAndSaveSceneEdits(currentModelId, { floorPlans: next });
    if (!saved) {
      showToast.error('Could not save floor plan', 'It will disappear on reload - try again or use a smaller PDF');
    } else if (wasAdded) {
      // Uploading is a deliberate, occasional action (unlike the mesh-edit autosave, which
      // stays quiet on success because it fires on every drag) - confirming this actually
      // reached the server is what makes a real failure elsewhere distinguishable from
      // this just silently working, both for the user and for diagnosing future reports.
      showToast.success('Floor plan saved', 'Visible on every device that opens this model');
    }
  }, [currentModelId, floorPlans]);

  const setHomeView = React.useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || !(camera as any).setTarget) {
      showToast.info('Switch to Orbit mode to set a home view');
      return;
    }
    const arcCam = camera as ArcRotateCamera;
    const target = arcCam.target.clone();
    homeViewRef.current = { alpha: arcCam.alpha, beta: arcCam.beta, radius: arcCam.radius, target };
    // Presentation Mode's auto-rotate (ScenarioManager) should circle this same identified
    // point too, not a separately-computed bounds center - see setHomeCenter's own comment.
    scenarioManagerRef.current?.setHomeCenter(target);

    // Persisted to the backend (same per-model record as mesh edits) rather than just this
    // ref, so it's the same on every device that opens this model, not just this browser tab.
    const homeView = { alpha: arcCam.alpha, beta: arcCam.beta, radius: arcCam.radius, target: { x: target.x, y: target.y, z: target.z } };
    sceneEditsRef.current = { ...sceneEditsRef.current, homeView };
    // Used to show "saved" unconditionally regardless of whether the request actually
    // succeeded - now only claims that once the backend has confirmed it. Merges just this
    // field onto the server's latest record (see the matching comment on
    // handleFloorPlansChange above) instead of sending sceneEditsRef.current wholesale.
    const saved = await mergeAndSaveSceneEdits(currentModelId, { homeView });
    if (saved) {
      showToast.success('Home view saved', 'Fit and Presentation Mode will use this point on every device from now on');
    } else {
      showToast.error('Could not save home view', 'It will reset on reload - try again');
    }
  }, [currentModelId]);

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

    // A saved Home view always wins once one exists - Fit becomes "return to my saved
    // position" instead of a fresh bounds computation (see homeViewRef above).
    const home = homeViewRef.current;
    if (home) {
      arcCam.setTarget(home.target);
      arcCam.alpha = home.alpha;
      arcCam.beta = home.beta;
      arcCam.radius = home.radius;
      showToast.success('Returned to saved view');
      return;
    }

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

  // Spins the camera 180 around whatever it's currently looking at, keeping the same
  // target/height/distance - the model has no stored idea of which side is architecturally
  // "front", so this is the general-purpose fix for "I'm looking at the wrong side, get me
  // to the opposite one" without needing that metadata: reported this session as the sun
  // looking wrong only because the camera happened to be facing the back of the building.
  const flipView = React.useCallback(() => {
    const camera = cameraRef.current;
    if (!camera || !(camera as any).setTarget) {
      showToast.info('Switch to Orbit mode to flip the view');
      return;
    }
    const arcCam = camera as ArcRotateCamera;
    arcCam.alpha += Math.PI;
  }, []);

  // Central entry point for every undoable edit (gizmo drag, Mirror, Delete, Material
  // Editor, Property Inspector) - pushes the entry (same shape/cap every call site already
  // used individually) AND schedules the debounced auto-save that's what actually makes an
  // edit survive navigating away and back. Without persisting through this single choke
  // point, every new kind of edit would need its own separate save wiring, and it'd be easy
  // for one to quietly fall through the cracks the way ALL of them did before this existed.
  // scheduleAutoSave is split out so a gizmo drag's onDragEnd (further below) can also
  // refresh the save timer without pushing a second undo entry - recordSnapshot already
  // pushes the "before" state once at onDragStart, which is all undo needs, but a drag
  // lasting longer than the debounce window would otherwise get auto-saved mid-drag (from
  // the onDragStart push) and never again, missing wherever the mesh actually ended up.
  // loadedModelMeshesRef is a ref (declared further below) rather than a dependency here -
  // only read inside these callbacks' bodies once they actually fire, by which point every
  // ref for this render has long since been assigned.
  const scheduleAutoSave = useCallback(() => {
    if (saveEditsDebounceRef.current) clearTimeout(saveEditsDebounceRef.current);
    saveEditsDebounceRef.current = setTimeout(() => {
      saveEditsDebounceRef.current = null;
      if (loadedModelMeshesRef.current.length === 0) return;
      // Merge mesh edits into the existing per-model record rather than overwriting the
      // whole thing from this local sceneEditsRef snapshot - it has no way to know about a
      // Home view, floor plan, swatch/fixture/ambient-zone, etc. that got saved
      // independently (by this same ref going stale, or by a completely different panel
      // via savePartialFeatureState) since this ref was last refreshed, and a mesh drag is
      // by far the most frequent save in the app - the single most likely place for that
      // staleness to actually bite.
      const meshes = captureSceneEdits(loadedModelMeshesRef.current).meshes;
      sceneEditsRef.current = { ...sceneEditsRef.current, meshes };
      // Quiet on success (this fires after every drag/edit - a toast each time would be
      // noisy), but a failed save here means the edit that was just made is NOT actually
      // persisted anywhere, which is worth surfacing rather than staying silent about.
      mergeAndSaveSceneEdits(currentModelId, { meshes }).then((saved) => {
        if (!saved) showToast.error('Could not save your changes', 'They will be lost on reload - try again');
      });
    }, 1500);
  }, [currentModelId]);

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoHistoryRef.current.push(entry);
    if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift();
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // One-shot flip of the selected mesh across its local X axis (left-right mirror) -
  // negating a scaling component is the standard way to mirror a mesh in Babylon;
  // rendering stays correct (no inside-out faces) because Babylon flips the culling
  // winding order automatically whenever a mesh's world matrix has a negative
  // determinant. Pushes the same 'transform' undo entry shape the gizmo-drag snapshot
  // uses (BabylonWorkspace.tsx's transformMode effect) so Ctrl+Z un-mirrors it too.
  const handleMirrorSelected = React.useCallback(() => {
    // A model placed/adjusted via AR (components/XRManager.ts) has its meshes reparented
    // under one shared placementRoot, which XRManager keeps alive even after exiting the
    // AR session (see the comment on teardownARPlacement) - mirroring an individual mesh
    // directly here instead would only flip part of the placed group and desync it from
    // whatever the AR overlay's own mirror button did. Same routing ARScalePanel.tsx
    // already uses for scale, for the same reason. Not undo-tracked on this path, matching
    // that existing precedent - the AR placement isn't part of the desktop undo stack.
    if (xrManagerRef.current?.hasActivePlacement()) {
      xrManagerRef.current.mirrorPlacedModel();
      showToast.success('Mirrored');
      return;
    }
    const mesh = workspaceState.selectedMesh;
    if (!mesh) return;
    pushUndo({
      kind: 'transform',
      mesh,
      position: mesh.position.clone(),
      rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
      rotation: mesh.rotation.clone(),
      scaling: mesh.scaling.clone(),
    });
    mesh.scaling.x *= -1;
    showToast.success('Mirrored');
  }, [workspaceState.selectedMesh, pushUndo]);

  // "Delete" the selected mesh - a soft delete (setEnabled(false), not dispose()) so
  // Ctrl+Z can bring it back. A real dispose() frees the mesh's GPU buffers permanently;
  // recreating a disposed mesh would mean re-loading its geometry from the original
  // model file, which isn't something undo can do. Hiding it is indistinguishable to the
  // user (it disappears from the view and stops being pickable) and trivially reversible.
  const handleDeleteSelected = React.useCallback(() => {
    const mesh = workspaceState.selectedMesh;
    if (!mesh) return;
    pushUndo({ kind: 'delete', mesh });
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeMesh(mesh as Mesh);
    }
    mesh.setEnabled(false);
    setTransformMode('none');
    setSelectedMesh(null);
    showToast.success('Deleted');
  }, [workspaceState.selectedMesh, pushUndo]);

  // handle files selected via workspace import dialog
  const handleWorkspaceFileUpload = React.useCallback((files: FileList | null) => {
    if (!files || !sceneRef.current) return;
    // Importing a model straight into the live scene is admin-only - guarded here (not
    // just by hiding the button/hotkey below) so it's blocked even if something else
    // ever manages to trigger the hidden file input directly.
    if (!isAdmin) {
      showToast.error('Only admins can import models');
      return;
    }
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
      getSceneLoaderModule().then(([{ SceneLoader }]) => {
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
          newMeshes.forEach((m) => {
            m.isVisible = true;
            if (m.getTotalVertices() > 0) m.checkCollisions = true;
          });
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
  }, [runAutoZoom, isAdmin]);

  // Babylon.js refs
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const pipelineRef = useRef<DefaultRenderingPipeline | null>(null);
  const ssaoPipelineRef = useRef<SSAO2RenderingPipeline | null>(null);
  const ssrPipelineRef = useRef<SSRRenderingPipeline | null>(null);
  const iblShadowsRef = useRef<IblShadowsRenderPipeline | null>(null);
  // TAA is constructed once at mount (before any other pipeline - Babylon requires TAA to
  // be first on the camera) and just toggled via isEnabled afterward, so it never needs
  // to be recreated/reordered relative to the other pipelines.
  const taaPipelineRef = useRef<TAARenderingPipeline | null>(null);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  // Shadow generator for the scene's "sun" light - lets Sun Study actually show
  // moving shadows instead of only a faint brightness/color shift.
  const shadowGeneratorRef = useRef<ShadowGenerator | null>(null);
  // Meshes imported by the last user-selected model (SceneLoader.Append only
  // ever adds meshes, never removes what was already there - without tracking
  // and disposing these first, loading a new/different model just piled its
  // meshes on top of whatever was loaded before).
  const loadedModelMeshesRef = useRef<AbstractMesh[]>([]);
  // Subset of loadedModelMeshesRef.current that occlusion queries were actually enabled on
  // (see the occlusion-culling loop below) - tracked separately so the fast-rotation guard
  // effect further down doesn't need to re-filter the whole mesh list every time it runs.
  const occlusionMeshesRef = useRef<AbstractMesh[]>([]);
  // Soft fill lights approximating indirect/bounce light near windows (see
  // ambientFillLights.ts) - tracked so the next model load can dispose the previous
  // model's lights before adding its own, the same way loadedModelMeshesRef's own meshes
  // get disposed just below.
  const ambientFillLightsRef = useRef<PointLight[]>([]);
  // The full per-model record last loaded from (or about to be saved to) the backend -
  // holds every field of SceneEditsData (mesh edits, homeView, ...), not just whichever one
  // the caller currently cares about. Saves must always write this whole merged object back,
  // not a freshly-built one containing only e.g. `meshes` - otherwise saving a mesh edit
  // would silently wipe out a previously-saved Home view (and vice versa), since the backend
  // record is a single JSON blob per model that a POST fully replaces.
  const sceneEditsRef = useRef<SceneEditsData>({ meshes: {} });

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

    // Frame the actual loaded model instead of a hardcoded point near the world origin -
    // Walk/Dollhouse/Orbit all used to spawn at fixed coordinates regardless of where the
    // uploaded model actually sits or how big it is, so Walk could drop the camera outside
    // the building entirely and Dollhouse/Orbit showed an arbitrary empty view for any
    // model not centered near (0,0,0). Mirrors the same exclusion list as runAutoZoom/Fit.
    const exclude = (m: AbstractMesh) => m.name && (m.name.startsWith('measure_') || m.name.startsWith('preview_') || m.name.startsWith('measurement_') || /^ground$/i.test(m.name) || /^defaultBox$/i.test(m.name));
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let meshCount = 0;
    scene.meshes.forEach((m) => {
      if (exclude(m) || !m.isVisible || m.getTotalVertices() === 0) return;
      const bb = m.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bb.minimumWorld.x); minY = Math.min(minY, bb.minimumWorld.y); minZ = Math.min(minZ, bb.minimumWorld.z);
      maxX = Math.max(maxX, bb.maximumWorld.x); maxY = Math.max(maxY, bb.maximumWorld.y); maxZ = Math.max(maxZ, bb.maximumWorld.z);
      meshCount++;
    });
    const modelCenter = meshCount > 0 ? new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2) : Vector3.Zero();
    const floorY = meshCount > 0 ? minY : 0;
    const modelSpan = meshCount > 0 ? Math.max(maxX - minX, maxZ - minZ, 1) : 20;

    let newCamera: ArcRotateCamera | FreeCamera | UniversalCamera;

    if (mode === 'fly') {
      // Dollhouse: a tilted bird's-eye overview of the whole model, not a generic free-fly
      // camera parked at a fixed spot - scaled to the model's actual footprint so a tiny
      // room and a whole house both start framed rather than either lost in empty space
      // or viewed from inside a wall.
      newCamera = new FreeCamera('camera', new Vector3(modelCenter.x, floorY + modelSpan * 0.9, modelCenter.z - modelSpan * 0.9), scene);
      (newCamera as FreeCamera).setTarget(modelCenter);
      newCamera.speed = Math.max(modelSpan * 0.03, 0.3);
      newCamera.applyGravity = false;
    } else if (mode === 'walk') {
      // Walk: start standing at floor level, inside/near the actual model instead of at a
      // fixed world-space offset that has no relation to where the model was placed.
      newCamera = new UniversalCamera('camera', new Vector3(modelCenter.x, floorY + 1.8, modelCenter.z - modelSpan * 0.3), scene);
      newCamera.speed = 0.35;
      newCamera.checkCollisions = true;
      newCamera.applyGravity = true;
      (newCamera as UniversalCamera).ellipsoid = new Vector3(0.5, 1.7, 0.5);
    } else {
      newCamera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, Math.max(modelSpan * 1.5, 5), modelCenter, scene);
      (newCamera as ArcRotateCamera).lowerRadiusLimit = 2;
      (newCamera as ArcRotateCamera).upperRadiusLimit = Math.max(modelSpan * 4, 30);
      // See the matching comment on the main scene-init camera for why percentage-based
      // zoom (not the fixed-step default) is what this project actually wants.
      (newCamera as ArcRotateCamera).wheelDeltaPercentage = CAMERA_WHEEL_DELTA_NORMAL;
    }

    // Babylon's default minZ (near clip plane) is 1 world unit - for an architectural
    // walkthrough in meters, that's most of a step away, so Walk/Orbit/Dollhouse could all
    // get close enough to a wall/door/window for it to clip straight through (visibly
    // disappearing) well before actually touching it. 0.05 keeps geometry solid right up to
    // the lens. Z-fighting precision is handled separately by engine.useReverseDepthBuffer
    // (see the scene-init comment where the engine is created) rather than by squeezing
    // maxZ down toward minZ - that was tried first and made flicker WORSE for anything but
    // a small model, since cutting minZ 20x while only cutting maxZ a few x actually widens
    // the maxZ/minZ ratio that governs precision. So maxZ just needs to comfortably fit the
    // model at the camera's farthest zoomed-out position (Orbit's upperRadiusLimit below is
    // modelSpan*4) with real headroom, not to be minimized.
    newCamera.minZ = 0.05;
    newCamera.maxZ = Math.max(modelSpan * 50, 1000);

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

  // Keeps Multi-User Collaboration scoped to whichever model is actually loaded - see
  // CollabManager.setRoomId's own comment for why this was needed (it's constructed once
  // at scene init, before any model is necessarily selected, and defaulted every session
  // to one hardcoded global room otherwise).
  useEffect(() => {
    collabManagerRef.current?.setRoomId?.(currentModelId);
  }, [currentModelId]);

  // XR Manager ref
  const xrManagerRef = useRef<XRManager | null>(null);
  // Remembers the desktop SSAO preference (auto-detected or user-toggled) across a VR/AR
  // session, so entering XR can safely force SSAO off (it's a full-screen, per-eye-cost
  // post effect - real money on a standalone headset's GPU, on top of the render-scale
  // reduction XRManager already applies) without losing the user's actual desktop choice
  // once they exit.
  const desktopSSAOPreferenceRef = useRef<boolean>(false);
  const desktopSSRPreferenceRef = useRef<boolean>(false);
  // Same reasoning as SSAO/SSR above - IBL Shadows does real-time voxelization (a 64^3
  // grid, tri-planar) every frame, at least as expensive as SSR, but the VR/AR entry
  // handlers below were never updated to force it off too when it was added - it kept
  // running unthrottled through an entire XR session on a standalone headset's GPU.
  const desktopIBLShadowsPreferenceRef = useRef<boolean>(false);
  // Same "force off for the XR session, restore on exit" reasoning as SSAO/SSR/IBL
  // Shadows above - but these two were missed when that pattern was introduced, and
  // both are known, specifically-VR-relevant flicker sources rather than just extra
  // GPU cost: CascadedShadowGenerator's autoCalcDepthBounds recomputes the shadow
  // frustum from the active camera every couple of frames, and a WebXR headset's
  // camera moves with head tracking essentially every single frame (even standing
  // still there's tracking jitter) - continuously nudging the shadow frustum from
  // that never-settling input is exactly what reads as shadow flicker. TAA
  // (temporal accumulation across successive frames, assuming the camera is roughly
  // stable between them) has the same problem for the same reason, and this file
  // already has a matching precedent for post-effect VR flicker: the SSR comment a
  // few hundred lines up notes it was pulled out once before for "visible flicker
  // under camera movement" on desktop, well before VR's much more constant motion.
  // Reported this session as the model flickering in the headset.
  const desktopCSMAutoDepthBoundsPreferenceRef = useRef<boolean>(false);
  const desktopTAAPreferenceRef = useRef<boolean>(false);
  // Consecutive-low-FPS sample count while SSR is on (see the watchdog effect further
  // down) - separate from desktopSSRPreferenceRef above, which is only about remembering
  // the desktop choice across a VR/AR session, not about this device genuinely being too
  // slow for SSR regardless of session type.
  const ssrLowFpsStreakRef = useRef(0);
  // Same idea as ssrLowFpsStreakRef, tracked separately so SSR and IBL Shadows each get
  // their own independent watchdog - one being the reason for a slow frame rate shouldn't
  // require the other to also have tripped its own streak before it's turned off.
  const iblShadowsLowFpsStreakRef = useRef(0);
  // Same watchdog pattern again for CSM's autoCalcDepthBounds (see the long comment where
  // the CascadedShadowGenerator is constructed) - a third independent full-frame GPU cost
  // that can be too much on its own even if SSR/IBL Shadows are both already off. Unlike
  // those two, there's no user-facing override to reconcile against - once the watchdog
  // trips, this sticky flag just stops the tier-gating effects from turning it back on.
  const csmLowFpsStreakRef = useRef(0);
  const csmAutoDepthBoundsDisabledByWatchdogRef = useRef(false);

  // AI Manager ref
  const aiManagerRef = useRef<any>(null);
  const gestureManagerRef = useRef<GestureManager | null>(null);
  const [gestureHistory, setGestureHistory] = useState<GestureData[]>([]);

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
    let presentationManager: PresentationManager | null = null;
    let iotManager: IoTManager | null = null;
    let aiManager: AIManager | null = null;
    let xrManager: XRManager | null = null;
    let collabManager: CollabManager | null = null;
    let cloudAnchorManager: CloudAnchorManager | null = null;
    let geoSyncManager: GeoSyncManager | null = null;
    let isCancelled = false;
    const shouldAbort = () => isCancelled || !engine || engine.isDisposed;

    const initializeScene = async () => {
      try {
        // Starts fetching/registering @babylonjs/loaders's format plugins now, in
        // parallel with engine/scene setup below, instead of waiting for the user to
        // pick a model first - by the time a model is actually selected, this has
        // usually already resolved (see getSceneLoaderModule's cache above).
        void getSceneLoaderModule();

        // Create engine with error handling
        engine = new Engine(canvasRef.current!, true, { preserveDrawingBuffer: true });
        // Reverse-Z depth buffer (far=0, near=1 instead of the usual near=0, far=1) -
        // redistributes depth precision far more evenly across the whole near/far range,
        // instead of the standard buffer's precision being almost entirely wasted right
        // near the camera. This is what actually fixes Z-fighting/flicker on walls and
        // floors, especially when rotating to view more distant geometry - not shrinking
        // maxZ down toward minZ, which was tried first (see the minZ/maxZ comment in
        // switchCamera below) and made it WORSE for anything but a small model: cutting
        // minZ from Babylon's default 1 down to 0.05 (needed - see that comment) is a 20x
        // reduction, while maxZ only shrank a few x for a typical building, so the ratio
        // that actually governs precision went UP, not down. This is a single engine-wide
        // flag (not per-material/per-camera), transparently handled by Babylon's shadow
        // generators too, so CSM/shadow mapping doesn't need any matching change. WebGL2-
        // only, but this app already requires WebGL2 for CSM (see the CascadedShadowGenerator
        // try/catch further down) so that's not a new constraint.
        engine.useReverseDepthBuffer = true;
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

        // Walking (desktop "walk" camera and VR/AR locomotion alike) previously moved
        // the camera freely through walls/furniture with no collision at all -
        // collisionsEnabled was never turned on scene-wide, so every camera's own
        // checkCollisions flag was a no-op. This is what makes moving through the model
        // actually feel like walking inside a real building instead of a ghost floating
        // through solid geometry. scene.gravity already defaults to real-world (0,-9.807,0).
        scene.collisionsEnabled = true;

        // Babylon clears the depth buffer between rendering groups by default, so
        // renderingGroupId 1 (used by every marker/pin overlay - AnnotationTool,
        // HotspotNavigation, MeshMaterialSwatches, MeasureTool - specifically so they
        // draw on top of nearby glass/transparent surfaces instead of getting lost
        // behind them) was, as a side effect, ALSO ignoring the real building's own
        // depth entirely: a marker behind a wall rendered as if the wall wasn't there,
        // visible right through solid opaque geometry. Turning off the auto-clear for
        // group 1 keeps it drawing after group 0 (still wins against non-depth-writing
        // transparent surfaces) while now correctly testing against group 0's real
        // depth buffer, so an actually-occluded marker is hidden like anything else
        // behind a wall.
        scene.setRenderingAutoClearDepthStencil(1, false);

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
          //
          // It's also Babylon's generic stock studio probe, not this scene's actual
          // sky - it has a distinct cool/blue tint that has nothing to do with the
          // procedural sky or an uploaded HDRI. PBR Fresnel reflectance rises sharply
          // at grazing angles regardless of this scaling, so that mismatched blue
          // still showed as a visible rim/line along edges viewed edge-on (a roof
          // silhouette, a beam tip) - worse against light-colored materials, and
          // shifting as the sun angle changed which edges were grazing vs. face-on.
          // Dropped further so that rim stops reading as a rendering artifact while
          // still leaving PBR reflections non-black before any real HDRI is loaded.
          scene.environmentIntensity = 0.25;
        } catch (envError) {
          console.warn('Default environment texture unavailable (offline/CDN blocked?) - PBR reflections will be flat:', envError);
        }

        // Create camera with safe fallback
        const cameraTarget = Vector3.Zero();
        camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, cameraTarget, scene);
        // See the matching minZ/maxZ comment in switchCamera - this mount-time camera exists
        // before any model (and its real footprint) has loaded, so it can't scale maxZ the
        // same way, but still needs the same tight near clip plane so an early close-up
        // (or a session that never calls switchCamera) doesn't clip through geometry.
        camera.minZ = 0.05;
        camera.maxZ = 2000;
        camera.attachControl(canvasRef.current!, true);
        // Babylon's default mouse-wheel zoom moves the camera by a FIXED distance per
        // scroll tick (wheelPrecision), regardless of how far away the camera currently
        // is - fine for a small close-up object, but architectural models are viewed
        // across a much wider range of distances (walk right up to a wall, then zoom
        // out to see the whole building), so that same fixed step reads as "way too
        // fast" once zoomed in close. wheelDeltaPercentage instead moves the camera by a
        // PERCENTAGE of its current distance to the target every tick - fast when far
        // away, fine/precise up close - which is how every professional CAD/BIM viewer
        // (and this project's own touchpad pinch-zoom) already behaves. Even so, crossing
        // a genuinely huge distance (zoomed all the way out to see a whole site, then
        // scrolling in toward the building) still takes many ticks before a 1%-per-tick
        // percentage compounds into a visible difference - see the Shift-held fast-zoom
        // effect further down for the "close that gap quickly" case this alone doesn't
        // cover.
        camera.wheelDeltaPercentage = CAMERA_WHEEL_DELTA_NORMAL;
        cameraRef.current = camera;

        // Temporal Anti-Aliasing (Babylon 9.x) - Babylon requires this to be the FIRST
        // post-processing pipeline constructed on the camera, before DefaultRenderingPipeline/
        // SSAO2/SSR below, all of which are created either right here at mount or later via
        // their own reactive effects once the device's quality tier is known. Constructing it
        // now but disabled (isEnabled = false) sidesteps that ordering requirement entirely -
        // it only ever needs a live isEnabled flip afterward (see the device-detection block
        // and the graphicsQuality effect further down), never a dispose/recreate.
        try {
          const taaPipeline = new TAARenderingPipeline("taa", scene, [camera]);
          taaPipeline.isEnabled = false;
          taaPipelineRef.current = taaPipeline;
        } catch (taaError) {
          console.warn('TAA rendering pipeline unavailable on this device:', taaError);
        }

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
        //
        // CascadedShadowGenerator (not the plain ShadowGenerator this used to be)
        // splits the shadow frustum into multiple cascades at increasing distance from
        // the camera, so nearby geometry gets a sharp, high-resolution shadow while
        // far geometry still gets a soft one from the same single directional light -
        // a single flat shadow map at this size either looked blocky up close or
        // wasted resolution on distant geometry, no setting split the difference.
        // Standard choice for a single sun/directional light over an architectural
        // scene walked through at varying distances (the exact case this app is for).
        //
        // CSM requires WebGL2 - confirmed via a headless-engine test that Babylon's own
        // CascadedShadowGenerator constructor doesn't fail gracefully when it isn't
        // supported (it logs a warning, then throws mid-construction instead of falling
        // back on its own). A device/browser still on WebGL1 would otherwise crash scene
        // init entirely, which is a far worse outcome than just not getting CSM - so this
        // explicitly falls back to the plain ShadowGenerator this used to be.
        let shadowGenerator: ShadowGenerator;
        try {
          const csm = new CascadedShadowGenerator(1024, dirLight);
          csm.usePercentageCloserFiltering = true;
          csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
          // Stops the cascade boundaries visibly swimming/popping as the camera moves -
          // a known CSM artifact, worth the (small) extra cost for a walkthrough app
          // where the camera is in near-constant motion.
          csm.stabilizeCascades = true;
          // Without this, cascades split the full camera frustum (near/far planes),
          // which is far larger than the actual scene - the mismatch between
          // neighbouring cascades' shadow bias shows up as banded seam lines across
          // large flat surfaces (roads, floors), most visible when the sun direction
          // rotates and the splits shift. Fitting each cascade to the real scene depth
          // instead removes that mismatch.
          //
          // NOT enabled here unconditionally - autoCalcDepthBounds runs a full extra
          // DepthRenderer pass over the whole scene plus a GPU min/max reduction, every
          // single frame, regardless of whether the camera or light actually moved. On a
          // heavy architectural import (thousands of meshes) that's a real, constant
          // per-frame cost on top of the shadow map render itself - reported as general
          // lag "loading aagi ullukulla work panna slow" and specifically worse while
          // dragging the sun/light sliders, since that's exactly when the main thread is
          // also busiest. Gated below (with the rest of the SSAO/shadow-map-size tier
          // checks) to only capable desktop tiers, at a reduced refresh rate, and backed
          // by its own FPS watchdog further down - the same "static tier guess plus a
          // live safety net" pattern already used for SSR and IBL Shadows.
          // Babylon's shadow bias defaults to bias=0.00005, normalBias=0 - normalBias is
          // specifically what pushes a shadow sample along the surface normal to avoid
          // the surface self-intersecting its own shadow map, and at 0 that correction
          // doesn't happen at all. On flat geometry that's mostly invisible; on the
          // curved/rounded wall sections this building actually has, it shows up as
          // banded self-shadowing stripes hugging the curve, worse or better depending on
          // how grazing the sun angle is against that curvature - a distinct mechanism
          // from the cascade-seam fix above (that one's about mismatches BETWEEN cascade
          // zones; this is self-shadowing WITHIN one surface), so autoCalcDepthBounds
          // alone never touched it.
          csm.bias = 0.002;
          csm.normalBias = 0.06;
          // Renders the shadow map from each mesh's BACK faces instead of its front faces -
          // Babylon's own documented fix for shadow acne on solid/closed geometry (walls,
          // roofs, most architectural meshes), since the surface actually visible to the
          // camera then never self-intersects the depth values written by its own front
          // face. Reported this session as fine parallel diagonal banding across large flat
          // roof/ground surfaces, worst at the shallow/near-grazing sun angles a top-down or
          // aerial camera view makes common - bias/normalBias alone (raised above too, from
          // 0.0015/0.035) reduce but don't eliminate that at a steep enough grazing angle;
          // this removes the self-intersection at its source instead of just pushing the
          // sample further away from it. Only correct for solid meshes with real backfaces
          // (every wall/roof/floor here) - a truly single-sided plane would need the default
          // front-face path instead, but this app has none of those as shadow casters.
          csm.forceBackFacesOnly = true;
          shadowGenerator = csm;
        } catch (csmError) {
          console.warn('CascadedShadowGenerator unavailable (likely WebGL1) - falling back to standard shadows:', csmError);
          shadowGenerator = new ShadowGenerator(1024, dirLight);
          shadowGenerator.useBlurExponentialShadowMap = true;
          shadowGenerator.blurKernel = 32;
          shadowGenerator.bias = 0.002;
          shadowGenerator.normalBias = 0.06;
          shadowGenerator.forceBackFacesOnly = true;
        }
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
          // A neutral contrast=1.0/no saturation curve is what made the viewport read as
          // flat/washed-out next to an actual game or Enscape/Lumion-style render, which
          // lean noticeably punchier than "physically neutral". This keeps ACES' filmic
          // highlight rolloff but pushes contrast and saturation up a step for a more
          // vivid, game-like look.
          pipeline.imageProcessing.contrast = 1.15;
          // Contrast > 1 is an S-curve - it brightens highlights but also pushes shadows/
          // midtones darker, on top of an already-conservative base scene (environmentIntensity
          // 0.25, dimmed deliberately - see its own comment - plus modest hemi/directional
          // light intensities). Reported this session as the interior reading noticeably
          // dark by default, to the point of needing exposure manually pushed to ~2.9 (well
          // past readable) to compensate - a real usability problem, not just a taste
          // difference. A modest, fixed exposure lift here is a much smaller, safer
          // correction than that: it directly counteracts contrast's shadow-darkening
          // without re-flattening the highlight rolloff ACES/contrast are here for. This is
          // scene.imageProcessingConfiguration under the hood (pipeline.imageProcessing IS
          // that same shared object, confirmed in Babylon's own source), so it's applied
          // scene-wide - VR gets this too, even though the DefaultRenderingPipeline itself
          // is deliberately not attached to the XR camera (see XRManager.ts) to keep VR's
          // own extra post-process cost - bloom/DoF/grain - light on a headset's GPU.
          pipeline.imageProcessing.exposure = 1.2;
          pipeline.imageProcessing.colorCurvesEnabled = true;
          const colorCurves = new ColorCurves();
          colorCurves.globalSaturation = 25;
          pipeline.imageProcessing.colorCurves = colorCurves;
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

        // Set up SSAO if enabled - SSAO2 (Horizon-Based Ambient Occlusion) rather than the
        // older SSAORenderingPipeline: noticeably more accurate contact shadows in corners
        // and under/behind objects, which is a real part of what reads as "Enscape/Lumion-
        // style realism" versus a flatter-looking viewport. Its radius/base/samples are on
        // a completely different scale than the legacy pipeline's (radius is real world
        // units, ~2 by default, not a near-zero value) - reusing the old tuned numbers here
        // would have been meaningless on this pipeline.
        if (enableSSAO) {
          const ssao = new SSAO2RenderingPipeline("ssao", scene, 1.0, [camera]);
          ssao.totalStrength = ssaoIntensity;
          ssao.radius = 2;
          ssao.base = 0.02;
          ssao.samples = 16;
          ssaoPipelineRef.current = ssao;
        }

        // Initialize HighlightLayer
        // Default mode renders the selection outline as a blurred glow, built from a
        // downsampled (blurTextureSizeRatio 0.5) silhouette - on a thin, pointed shape
        // (e.g. a roof beam tip) that low-res blur pass can split the silhouette into two
        // parallel lines instead of one clean outline, which got worse/more visible as the
        // light angle changed what part of the edge was in view. isStroke draws a precise
        // solid outline instead of a blurred glow, avoiding that doubling entirely.
        const highlightLayer = new HighlightLayer("highlightLayer", scene, { isStroke: true, blurTextureSizeRatio: 1 });
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
        // Drives the Graphics Quality panel: what auto-detection actually recommends for
        // this device, and the GPU name shown there so the choice isn't a black box.
        if (!shouldAbort()) {
          setRecommendedQuality(deviceDetector.getRecommendedQuality());
          setGpuName(deviceDetector.getHardwareInfo?.()?.gpu?.renderer ?? '');
        }

        // Contact shadows (SSAO) meaningfully improve how grounded/realistic the scene
        // reads - real games lean on this exact effect - but it's a full-screen post
        // process with a real per-pixel cost, so it only auto-enables on hardware that
        // actually has headroom for it. getRecommendedQuality() already penalizes mobile
        // devices in its scoring (see DeviceDetector.getPerformanceScore's mobile
        // deduction), so requiring 'high'/'ultra' here naturally keeps phones/tablets on
        // the lighter default rather than needing a separate mobile-specific check. Not
        // applied if the device/session is already in XR at this point (shouldn't be,
        // this runs once at mount) - see the showVR/showAR handlers below for why SSAO
        // is force-disabled for the duration of any actual XR session regardless.
        if (!capabilities.mobile && (resolvedQuality === 'high' || resolvedQuality === 'ultra') && !shouldAbort()) {
          desktopSSAOPreferenceRef.current = true;
          setEnableSSAO(true);
        }

        // Shadow map resolution - created at a safe 1024 baseline above (before device
        // capability was known), bumped up here on the same capable-desktop condition as
        // SSAO. mapSize has a live setter (unlike most ShadowGenerator options, which
        // need a fresh instance), so this doesn't need to recreate the generator or its
        // shadow casters. Left untouched for mobile/VR - shadows there stay at the safe
        // baseline rather than adding more GPU cost on top of the resolution scale-down
        // XRManager already applies for headset use.
        if (!capabilities.mobile && (resolvedQuality === 'high' || resolvedQuality === 'ultra') && shadowGeneratorRef.current && !shouldAbort()) {
          shadowGeneratorRef.current.mapSize = 2048;
          shadowGeneratorRef.current.filteringQuality = ShadowGenerator.QUALITY_HIGH;
        }
        // autoCalcDepthBounds (see the long comment where CSM is constructed above) - same
        // capable-desktop-only gate as mapSize/SSAO, plus a refresh rate of 2 instead of the
        // default 1 (recompute every OTHER frame rather than every frame) to roughly halve
        // its cost even where it is on. Still backed by its own FPS watchdog further down in
        // case even that's too much for a given device.
        if (!capabilities.mobile && (resolvedQuality === 'high' || resolvedQuality === 'ultra') && shadowGeneratorRef.current instanceof CascadedShadowGenerator && !csmAutoDepthBoundsDisabledByWatchdogRef.current && !shouldAbort()) {
          shadowGeneratorRef.current.autoCalcDepthBounds = true;
          shadowGeneratorRef.current.autoCalcDepthBoundsRefreshRate = 2;
        }

        // Sharper textures at oblique viewing angles (a wall/floor texture stays crisp
        // instead of turning to mush toward the horizon) - this was never actively set
        // for uploaded models, since glTF import loads textures straight through
        // Babylon's own loader rather than any app code that could configure it.
        // Capped lower on weak/mobile GPUs, where high anisotropic filtering has a real
        // sampling cost per pixel.
        Texture.DEFAULT_ANISOTROPIC_FILTERING_LEVEL = (resolvedQuality === 'low' || resolvedQuality === 'medium') ? 4 : 8;

        // TAA (see the pipeline constructed disabled right after the camera above) only
        // costs anything while it's actually accumulating frames, so it's safe at the same
        // High/Ultra tier as SSAO rather than restricted to Ultra alone.
        if (taaPipelineRef.current && !shouldAbort()) {
          taaPipelineRef.current.isEnabled = !capabilities.mobile && (resolvedQuality === 'high' || resolvedQuality === 'ultra');
        }

        // Screen-space reflections were originally tried here using Babylon's older
        // ScreenSpaceReflectionPostProcess and pulled back out for visible flicker under
        // camera movement near geometry edges/gaps. Revisited via SSRRenderingPipeline
        // (Babylon's SSR2, with built-in edge/distance/iteration attenuation meant to fade
        // reflections at exactly those trouble spots instead of hard-cutting them) - see
        // the enableSSR reactive effect below, which only turns it on at Ultra quality.
        // IBL Shadows (voxel-traced ambient shadowing from the environment texture, see the
        // create/dispose effect below) gets the same Ultra-only treatment via that same
        // reactive effect (setEnableIBLShadows sits right next to setEnableSSR there).

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
          // roomId scoped to the loaded model (kept in sync afterward by the
          // setRoomId effect above) rather than left on CollabManager's own generic
          // 'default-room' fallback - see setRoomId's comment for why that mattered.
          collabManager = new CollabManager(scene, { userId: realUserId, userName: realUserName, roomId: currentModelId });
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
          //
          // On a full page refresh, selectedModel is still null right here even when a
          // model WILL be restored - AppLayout's restore-last-model effect is an async
          // /models fetch that hasn't resolved yet at this point in the scene-init
          // sequence. Without this extra check, the demo BIM building loaded below every
          // single time the page was refreshed while a model was open, and
          // removePlaceholderGeometry() (called once the real model loads) only disposes
          // the generic ground/defaultBox placeholder - it has no way to find and remove
          // the demo's own walls/floors/ceiling/wiring/plumbing/hvac meshes, so they sat
          // in the scene permanently once created. Checking localStorage's remembered id
          // (the same key the restore effect itself reads) tells us a restore is pending
          // so we can skip creating the demo at all and let the real model load cleanly.
          let hasPendingModelRestore = false;
          try {
            hasPendingModelRestore = !!localStorage.getItem(LAST_MODEL_ID_KEY);
          } catch {
            // localStorage unavailable (private browsing, etc) - fall through to demo model
          }
          if (typeof bimManager.loadDemoModel === 'function' && !selectedModel?.modelUrl && !hasPendingModelRestore) {
            await bimManager.loadDemoModel();
            console.log("BIMManager initialized with demo model");
          } else {
            console.log("BIMManager initialized" + (selectedModel?.modelUrl || hasPendingModelRestore ? " (demo model skipped, loading selected model)" : ""));
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

        // Initialize PresentationManager (mood lighting scenes) - existed as a fully
        // working class but was never instantiated or wired to any UI (see MoodLightingPanel).
        try {
          if (bimManagerRef.current && featureManagerRef.current) {
            presentationManager = new PresentationManager(engine, scene, bimManagerRef.current, featureManagerRef.current);
            presentationManagerRef.current = presentationManager;
            console.log("PresentationManager initialized successfully");
          }
        } catch (error) {
          console.error("Failed to initialize PresentationManager:", error);
        }

        // Initialize IoTManager - existed as a complete client wrapper (device/sensor
        // registry, auth headers, dispose) for a real, fully-deployed backend
        // (server/index.tsx's /api/iot/* routes), but was only ever instantiated as an
        // unused ref in SceneRenderer.tsx (never with a real serverUrl, so it always
        // stayed in local-only mode) - see IoTSensorsPanel. Only constructed here, not
        // connected - connect() happens on demand when the panel is opened, same as
        // GeoSyncManager/CloudAnchorManager above, so a session that never opens it
        // never pays for the network round-trip.
        try {
          iotManager = new IoTManager(scene, {
            serverUrl: `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`,
          });
          iotManagerRef.current = iotManager;
          console.log("IoTManager initialized successfully");
        } catch (error) {
          console.error("Failed to initialize IoTManager:", error);
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

        // Initialize GestureManager - real camera-based hand-gesture recognition
        // (skin-tone detection + position-based classification). Previously
        // "Gesture Detection" only ran aiManager.enableGestureDetection(), which just
        // checks WebXR capability and speaks a line - no camera, no actual gesture ever
        // recognized, despite the button implying it worked. This class already existed
        // fully built but was never instantiated/wired to anything in the live app.
        try {
          gestureManagerRef.current = new GestureManager(engine, scene, deviceDetector);
          gestureManagerRef.current.onGestureRecognized((gesture) => {
            setGestureHistory((prev) => [...prev.slice(-49), gesture]);
            showToast.info(`Gesture: ${gesture.gesture.replace(/_/g, ' ')}`, `${Math.round(gesture.confidence * 100)}% confidence`);
            gestureManagerRef.current?.createGestureFeedback(gesture);
          });
          console.log("GestureManager initialized");
        } catch (error) {
          console.error("Failed to initialize GestureManager:", error);
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
          // Offers rain/snow/flood to the in-headset VR menu (see XRManager's own
          // registerVRMenuProvider comment) - registered once here rather than in a
          // rainOn/snowOn/floodOn-dependent effect specifically so it doesn't depend on
          // the user ever having touched a weather toggle before entering VR to exist;
          // reads current values via the refs above (not the raw state) so this one
          // long-lived provider function never goes stale.
          xrManager.registerVRMenuProvider('weather', () => [
            { id: 'rain', label: 'Rain', isOn: rainOnRef.current, toggle: () => onRainToggleRef.current(!rainOnRef.current) },
            { id: 'snow', label: 'Snow', isOn: snowOnRef.current, toggle: () => onSnowToggleRef.current(!snowOnRef.current) },
            { id: 'flood', label: 'Flood', isOn: floodOnRef.current, toggle: () => onFloodToggle(!floodOnRef.current) },
          ]);
          console.log("XRManager initialized");
        } catch (error) {
          console.error("Failed to initialize XRManager:", error);
          showToast.error("XR features unavailable");
        }

        // Connect AudioManager to XRManager if both are available
        if (enableSpatialAudio && audioManager && xrManager) {
          xrManager.setAudioManager(audioManager);
        }

        // Geo Location is handled by the GeoLocationContext panel itself (see the note
        // further below where its other duplicate used to live) - no scene-init-time
        // geolocation call belongs here.

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

        // Handle window resize - batched onto the next animation frame so a browser firing
        // many resize events in quick succession during a window drag-resize only ever
        // costs one engine.resize() per painted frame, not one per event.
        let resizeRaf: number | null = null;
        const handleResize = () => {
          if (resizeRaf !== null) return;
          resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null;
            if (engine) {
              engine.resize();
            }
          });
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
          if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
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
        if (presentationManager && typeof presentationManager.dispose === 'function') {
          presentationManager.dispose();
        }
        if (iotManager && typeof iotManager.dispose === 'function') {
          iotManager.dispose();
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
        if (gestureManagerRef.current) {
          gestureManagerRef.current.dispose();
          gestureManagerRef.current = null;
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
      pipeline.imageProcessing.contrast = 1.15;
      // See the matching exposure comment on the other DefaultRenderingPipeline
      // construction above (mount-time) - this reactive-recreate path (postProcessing
      // toggled off then back on) needs the same correction, or re-enabling it mid-session
      // would silently drop back to the too-dark default.
      pipeline.imageProcessing.exposure = 1.2;
      pipeline.imageProcessing.colorCurvesEnabled = true;
      const colorCurves = new ColorCurves();
      colorCurves.globalSaturation = 25;
      pipeline.imageProcessing.colorCurves = colorCurves;
      pipelineRef.current = pipeline;
    } else if (!enablePostProcessing && pipelineRef.current) {
      pipelineRef.current.dispose();
      pipelineRef.current = null;
    }
  }, [enablePostProcessing]);

  // Reactively create/dispose the SSAO pipeline itself when toggled after mount
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    if (enableSSAO && !ssaoPipelineRef.current) {
      const ssao = new SSAO2RenderingPipeline("ssao", scene, 1.0, [camera]);
      ssao.totalStrength = ssaoIntensity;
      ssao.radius = 2;
      ssao.base = 0.02;
      ssao.samples = 16;
      ssaoPipelineRef.current = ssao;
    } else if (!enableSSAO && ssaoPipelineRef.current) {
      ssaoPipelineRef.current.dispose();
      ssaoPipelineRef.current = null;
    }
  }, [enableSSAO]);

  // Reactively create/dispose the SSR (screen-space reflections) pipeline when toggled -
  // only ever turned on by the graphicsQuality effect below at the Ultra tier. Defaults
  // lean on Babylon SSR2's built-in attenuation (all three attenuate* flags default true)
  // to fade reflections at screen edges/max-distance/max-iterations rather than cutting
  // them off hard, which is what caused the flicker in the earlier removed attempt.
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    if (enableSSR && !ssrPipelineRef.current) {
      // forceGeometryBuffer=true keeps SSR on Babylon's older GeometryBufferRenderer path
      // instead of switching the whole scene into PrePassRenderer mode (SSR2's default) -
      // nothing else in this scene (DefaultRenderingPipeline's tonemapping/bloom, the
      // environment/background compositing) was built expecting prepass mode, and turning
      // it on at Ultra was what broke the background rendering (only enableSSR differs
      // between High and Ultra in the quality effect below).
      const ssr = new SSRRenderingPipeline("ssr", scene, [camera], true);
      // Tuned down from Babylon's SSR2 defaults (strength=1, blurDispersionStrength=0.03,
      // reflectivityThreshold=0.04) - at those values flat surfaces like a road or plain
      // wall read as a hard mirror instead of a subtle reflective hint, because the
      // roughness-based blur wasn't strong enough to scatter the reflection and
      // low-reflectivity dielectric materials weren't being filtered out.
      ssr.strength = 0.35;
      ssr.thickness = 0.5;
      ssr.roughnessFactor = 0.4;
      ssr.blurDispersionStrength = 0.08;
      // Raised further still - walls facing open sky were still exceeding the previous
      // 0.08 threshold and picking up reflections.
      ssr.reflectivityThreshold = 0.18;
      // Left null rather than the environment/IBL cubemap: on a building against open sky,
      // most rays from walls and roof edges never hit any geometry and immediately fall
      // back to this texture - that's what was washing the whole building in a
      // sky-colored haze with a bright halo along silhouette edges. With no fallback, a
      // missed ray just leaves that pixel's original material color untouched instead of
      // painting sky over it - actual reflections (e.g. the floor catching the building)
      // still work fine since those rays DO hit geometry.
      ssr.environmentTexture = null;
      ssrPipelineRef.current = ssr;
    } else if (!enableSSR && ssrPipelineRef.current) {
      ssrPipelineRef.current.dispose();
      ssrPipelineRef.current = null;
    }
  }, [enableSSR]);

  // Reactively create/dispose IBL Shadows (Babylon 9.x's voxel-traced ambient shadowing
  // from the scene's environment texture) - same Ultra-only/overridable treatment as SSR
  // above. Wrapped in try/catch and gated on IsSupported like the CascadedShadowGenerator
  // fallback earlier in this file, since voxelization needs a decent WebGL2/WebGPU device.
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    if (enableIBLShadows && !iblShadowsRef.current) {
      try {
        if (!IblShadowsRenderPipeline.IsSupported) {
          console.warn('IBL Shadows unsupported on this device - skipping.');
        } else {
          const iblShadows = new IblShadowsRenderPipeline("iblShadows", scene, {
            // 2^6 = 64^3 voxel grid - a real balance point for realtime use; higher
            // sharpens shadows but multiplies voxelization/tracing cost.
            resolutionExp: 6,
            sampleDirections: 8,
            shadowRemanence: 0.75,
            // Voxelizes from 3 axes instead of 1 - meaningfully fewer "missing geometry"
            // gaps in the shadow (thin walls/beams that a single-axis voxelization can
            // miss entirely), worth the extra cost at the Ultra tier this is already
            // restricted to.
            triPlanarVoxelization: true,
          }, [camera]);
          // No specific meshes/materials passed here - the model-load effect (see
          // isGlassMesh/addShadowCaster nearby) registers casters as models are loaded/
          // swapped. Receivers default to every material in the scene.
          iblShadows.addShadowReceivingMaterial();
          iblShadowsRef.current = iblShadows;
        }
      } catch (iblError) {
        console.warn('IBL Shadows pipeline unavailable on this device:', iblError);
      }
    } else if (!enableIBLShadows && iblShadowsRef.current) {
      iblShadowsRef.current.dispose();
      iblShadowsRef.current = null;
    }
  }, [enableIBLShadows]);

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

  // Live-apply the selected graphics quality (from the Graphics Quality panel) any time
  // it changes, or the auto-detected recommendation changes ('auto' tracks that). This is
  // the same tier logic that used to only run once at mount (see qualityToScaling above in
  // initializeScene) - repeated here so a user can actually move between tiers afterward
  // instead of needing to reload. Bloom is gated off on 'low' since bloomKernel=64 has a
  // real per-pixel cost; SSAO/higher shadow resolution/anisotropic filtering follow the
  // same high/ultra-only rule the initial auto-detect already used.
  useEffect(() => {
    const engine = engineRef.current;
    const scene = sceneRef.current;
    if (!engine || !scene) return;
    const resolved = graphicsQuality === 'auto' ? recommendedQuality : graphicsQuality;
    const qualityToScaling: Record<string, number> = { low: 1.3, medium: 1.1, high: 1.0, ultra: 1.0 };
    engine.setHardwareScalingLevel(qualityToScaling[resolved] ?? qualityToScaling.medium);
    const isHighTier = resolved === 'high' || resolved === 'ultra';
    setEnableSSAO(isHighTier);
    setEnableBloom(resolved !== 'low');
    // ssrOverride (the Graphics Quality panel's "Reflections" toggle) wins over the tier
    // default when the user has explicitly set it - null means "no explicit choice yet",
    // which keeps today's behavior (Ultra only) as the default.
    setEnableSSR(ssrOverride !== null ? ssrOverride : resolved === 'ultra');
    // NOT resolved === 'ultra' by default, unlike SSR above - confirmed real conflict
    // (reported: switching to Ultra broke rendering into a dark/blank background with only
    // the selection-highlight glow visible, on a real RTX 2050). IblShadowsRenderPipeline's
    // constructor calls scene.enableGeometryBufferRenderer(...) and forces
    // generateNormalsInWorldSpace = true on it (see @babylonjs/core's
    // Rendering/IBLShadows/iblShadowsRenderPipeline.js) - the exact same shared
    // GeometryBufferRenderer that SSR's own forceGeometryBuffer=true above deliberately
    // depends on (see that comment: turning on Babylon's default PrePassRenderer path
    // instead "broke the background rendering" once already). Both defaulting on
    // simultaneously at Ultra reintroduced that same failure mode through a different
    // pipeline. Kept fully available via its own "Ambient Shadows (IBL)" toggle - this
    // only removes it from Ultra's automatic default, not the feature itself.
    setEnableIBLShadows(iblShadowsOverride !== null ? iblShadowsOverride : false);
    if (shadowGeneratorRef.current) {
      shadowGeneratorRef.current.mapSize = isHighTier ? 2048 : 1024;
      shadowGeneratorRef.current.filteringQuality = isHighTier ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
      // Same capable-tier gate as at creation time, plus the watchdog's sticky
      // "don't turn this back on" flag - see the long comment where CSM is constructed.
      if (shadowGeneratorRef.current instanceof CascadedShadowGenerator) {
        const wantAutoDepthBounds = isHighTier && !csmAutoDepthBoundsDisabledByWatchdogRef.current;
        shadowGeneratorRef.current.autoCalcDepthBounds = wantAutoDepthBounds;
        if (wantAutoDepthBounds) shadowGeneratorRef.current.autoCalcDepthBoundsRefreshRate = 2;
      }
    }
    Texture.DEFAULT_ANISOTROPIC_FILTERING_LEVEL = isHighTier ? 8 : 4;
    if (taaPipelineRef.current) {
      taaPipelineRef.current.isEnabled = isHighTier;
    }
  }, [graphicsQuality, recommendedQuality, ssrOverride, iblShadowsOverride]);

  // The top bar's FPS badge (`fps` state) was declared but never actually updated anywhere -
  // always showing a fixed "60 FPS" regardless of the real frame rate. Sampling every 500ms
  // (not every frame) is what makes this cheap enough to drive React state from - and it's
  // also the only real signal the SSR watchdog effect right below has to react to.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const interval = setInterval(() => {
      setFps(Math.round(engine.getFps()));
    }, 500);
    return () => clearInterval(interval);
  }, [sceneReadyForLoad]);

  // Backs the static tier-based SSR gate (above) with a real, live safety net: the device-
  // score heuristic can be fooled (a phone only costs a flat -10 of 100 points, so a modern
  // one with enough cores/RAM can still score 'ultra'), and the "Reflections" override in
  // the Graphics Quality panel lets anyone force SSR on regardless of tier to actually try
  // it. If the real frame rate stays under ~24fps for 3 consecutive samples (~1.5s
  // sustained, not one dip from something unrelated), turns SSR off and explains why -
  // and clears ssrOverride back to null so the next tier recompute doesn't just turn it
  // straight back on.
  useEffect(() => {
    if (!enableSSR) {
      ssrLowFpsStreakRef.current = 0;
      return;
    }
    const LOW_FPS_THRESHOLD = 24;
    const REQUIRED_STREAK = 3;
    if (fps > 0 && fps < LOW_FPS_THRESHOLD) {
      ssrLowFpsStreakRef.current += 1;
    } else {
      ssrLowFpsStreakRef.current = 0;
    }
    if (ssrLowFpsStreakRef.current >= REQUIRED_STREAK) {
      ssrLowFpsStreakRef.current = 0;
      setEnableSSR(false);
      // Explicitly false, not null - null falls back to the tier default in the quality
      // effect above, which could well BE 'ultra' (that's how SSR got turned on in the
      // first place), immediately re-enabling the very thing that just proved too slow.
      // An explicit false is what actually sticks.
      setSsrOverride(false);
      showToast.info('Turned off Reflections', 'The frame rate dropped too low on this device - reflections have been switched off to keep things smooth.');
    }
  }, [fps, enableSSR]);

  // Same live safety net as the SSR watchdog above, independently for IBL Shadows - one
  // being on shouldn't require the other to have also tripped its own streak first, and a
  // device that can hold Ultra-tier SSR fine might still choke specifically on the
  // voxelization/tracing cost IBL Shadows adds on top.
  useEffect(() => {
    if (!enableIBLShadows) {
      iblShadowsLowFpsStreakRef.current = 0;
      return;
    }
    const LOW_FPS_THRESHOLD = 24;
    const REQUIRED_STREAK = 3;
    if (fps > 0 && fps < LOW_FPS_THRESHOLD) {
      iblShadowsLowFpsStreakRef.current += 1;
    } else {
      iblShadowsLowFpsStreakRef.current = 0;
    }
    if (iblShadowsLowFpsStreakRef.current >= REQUIRED_STREAK) {
      iblShadowsLowFpsStreakRef.current = 0;
      setEnableIBLShadows(false);
      setIblShadowsOverride(false);
      showToast.info('Turned off Ambient Shadows', 'The frame rate dropped too low on this device - IBL shadows have been switched off to keep things smooth.');
    }
  }, [fps, enableIBLShadows]);

  // Third independent watchdog, for CSM's autoCalcDepthBounds (see the long comment where
  // the CascadedShadowGenerator is constructed) - a full extra depth pre-pass plus GPU
  // min/max reduction every couple of frames, on top of whatever SSR/IBL Shadows already
  // cost. Reported symptom this backs: general lag right after a model finishes loading,
  // worse specifically while dragging the sun/light sliders (main thread busiest exactly
  // then) and while selecting/dragging meshes - all sharing the same frame budget this
  // watches. No user-facing override exists for this one, so tripping it just disables it
  // and sets the sticky ref the tier-gating effects above check before re-enabling it.
  useEffect(() => {
    const shadowGenerator = shadowGeneratorRef.current;
    const csmActive = shadowGenerator instanceof CascadedShadowGenerator && shadowGenerator.autoCalcDepthBounds;
    if (!csmActive) {
      csmLowFpsStreakRef.current = 0;
      return;
    }
    const LOW_FPS_THRESHOLD = 24;
    const REQUIRED_STREAK = 3;
    if (fps > 0 && fps < LOW_FPS_THRESHOLD) {
      csmLowFpsStreakRef.current += 1;
    } else {
      csmLowFpsStreakRef.current = 0;
    }
    if (csmLowFpsStreakRef.current >= REQUIRED_STREAK) {
      csmLowFpsStreakRef.current = 0;
      csmAutoDepthBoundsDisabledByWatchdogRef.current = true;
      (shadowGenerator as CascadedShadowGenerator).autoCalcDepthBounds = false;
      showToast.info('Reduced shadow quality', 'The frame rate dropped too low on this device - simplified sun shadows to keep things smooth.');
    }
  }, [fps]);

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
  const pivotedMeshRef = useRef<Mesh | null>(null);
  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current;
    const mesh = workspaceState.selectedMesh;
    if (!gizmoManager) return;

    // Imported GLB/glTF meshes (this app's whole real-model path, see SceneLoader.Append
    // above) very commonly bake absolute vertex positions with an identity local
    // transform - every mesh's own pivot sits at (0,0,0), often nowhere near where the
    // object actually looks like it is. With the gizmo's default anchor (the raw pivot,
    // see GizmoAnchorPoint.Pivot below), selecting a wall or piece of furniture then
    // showed the move/rotate handles off at the building's origin instead of on the
    // object - clicking/dragging them didn't look like it was moving the thing you'd
    // just selected at all. Re-anchoring the pivot to the mesh's own real bounding-box
    // center fixes this without moving the mesh (setPivotPoint only changes what
    // position/rotation are measured from, not the mesh's actual world position).
    if (pivotedMeshRef.current && pivotedMeshRef.current !== mesh) {
      pivotedMeshRef.current.setPivotPoint(Vector3.Zero());
      // Re-lock it now that editing is done - see the load-time freeze comment
      // (SceneLoader.Append's success callback) for why every static mesh is frozen
      // by default. Safe here specifically because editing only ever happens while a
      // mesh is gizmo-attached, i.e. between the unfreeze below and this re-freeze.
      if (pivotedMeshRef.current.getTotalVertices() > 0) {
        pivotedMeshRef.current.freezeWorldMatrix();
        pivotedMeshRef.current.doNotSyncBoundingInfo = true;
      }
      pivotedMeshRef.current = null;
    }
    if (mesh) {
      // Unfreeze before touching pivot/bounding info - a frozen mesh silently ignores
      // position/rotation/scaling changes (including from the gizmo drag this is about
      // to enable), and a stale doNotSyncBoundingInfo would leave every tool that reads
      // this mesh's bounding box (Measure Tool snapping, swatch markers, Cost Estimator)
      // seeing its pre-move box after it's actually been dragged.
      mesh.unfreezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = false;
      mesh.setPivotPoint(mesh.getBoundingInfo().boundingBox.center);
      pivotedMeshRef.current = mesh;
    }

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
    // Anchor to the (now bounding-box-centered, see above) pivot rather than the raw
    // mesh origin - see the pivot re-anchoring comment in the attach effect for why the
    // default (Origin) anchor put the gizmo somewhere unrelated to the visible object.
    [gizmoManager.gizmos.positionGizmo, gizmoManager.gizmos.rotationGizmo, gizmoManager.gizmos.scaleGizmo].forEach((g) => {
      if (g) g.anchorPoint = GizmoAnchorPoint.Pivot;
    });

    const recordSnapshot = () => {
      const mesh = workspaceState.selectedMesh;
      if (!mesh) return;
      pushUndo({
        kind: 'transform',
        mesh,
        position: mesh.position.clone(),
        rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
        rotation: mesh.rotation.clone(),
        scaling: mesh.scaling.clone(),
      });
    };

    const gizmos = [gizmoManager.gizmos.positionGizmo, gizmoManager.gizmos.rotationGizmo, gizmoManager.gizmos.scaleGizmo];
    const disposers: Array<() => void> = [];
    gizmos.forEach((gizmo) => {
      if (!gizmo) return;
      const startObserver = gizmo.onDragStartObservable.add(recordSnapshot);
      disposers.push(() => gizmo.onDragStartObservable.remove(startObserver));
      // Refreshes the auto-save timer with wherever the mesh actually ended up, in case
      // the drag itself ran longer than the debounce window (recordSnapshot's pushUndo
      // already scheduled a save at drag START, which a slow drag could otherwise beat).
      const endObserver = gizmo.onDragEndObservable.add(scheduleAutoSave);
      disposers.push(() => gizmo.onDragEndObservable.remove(endObserver));
    });

    return () => { disposers.forEach((d) => d()); };
  }, [transformMode, workspaceState.selectedMesh, scheduleAutoSave]);

  // Click-to-select: clicking any real object mesh in the scene selects it, which
  // Material Editor, Smart Alternatives, and other selection-aware panels rely on via
  // workspaceState.selectedMesh. This was previously completely missing - setSelectedMesh
  // existed on the state hook but nothing in the scene ever actually called it.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // isSelectableMesh (excludes measurement lines, cursor markers, annotation pins,
    // hotspot-navigation/material-swatch markers, teleport/AR-scale helper meshes) is
    // imported from meshSceneHandlers.ts - useMeshSceneHandlers' own pointer listener
    // below writes to this same workspaceState.selectedMesh and used to have no
    // filtering of its own at all, so keeping two independently-maintained copies of
    // this predicate was exactly how that drifted out of sync before; importing the one
    // definition here instead of redeclaring it can't drift again.

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      // Don't steal the click if a mode that handles its own picking is active (teleport
      // navigation already interprets clicks as "move here", not "select this"; the
      // Measurement Tool interprets clicks as "place a measurement point" - this second
      // guard used to be missing here, so clicking to measure also selected the mesh
      // underneath, popping the Move/Rotate/Scale toolbar and Property Inspector mid-measurement).
      if (featureStates.showTeleportManager || featureStates.showMeasurementTool) return;

      // Was a fresh scene.pick(...) with isSelectableMesh as the predicate - a predicate
      // makes Babylon skip any mesh that fails it and keep raycasting for the NEXT hit
      // along the same ray, so clicking directly on a marker/pin (excluded by name here)
      // "saw through" it to whatever real mesh happened to be right behind, selecting
      // and highlighting THAT instead - clicking a swatch/hotspot/annotation marker to
      // open its own popup was, as a side effect, also selecting the wall/fence right
      // behind it for Move/Rotate. Checking the actual clicked mesh (Babylon's own
      // default nearest-hit for this event, no predicate) fixes that: clicking a marker
      // now selects nothing instead of whatever's behind it.
      const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
      if (pickedMesh && isSelectableMesh(pickedMesh)) {
        setSelectedMesh(pickedMesh as Mesh);
      }
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [featureStates.showTeleportManager, featureStates.showMeasurementTool]);

  // Double-click a mesh to frame it, however far away the camera currently is - the
  // percentage-based scroll-zoom above (and its Shift-held fast variant) still needs many
  // ticks to close a genuinely large distance, since each tick only closes a PERCENTAGE of
  // whatever's left; jumping straight to "center on this mesh, at a distance sized to it"
  // sidesteps that entirely regardless of how far out the camera started. Same
  // bounds-then-jump shape as runAutoZoom above, just scoped to one mesh's own bounding box
  // instead of the whole scene's, and the same temporarily-widen-then-restore
  // lowerRadiusLimit/upperRadiusLimit trick - the camera's current limits (tightened for
  // whatever it was last framing) would otherwise silently clamp the jump short.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERDOUBLETAP) return;
      if (featureStates.showTeleportManager || featureStates.showMeasurementTool) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      if (!mesh || !isSelectableMesh(mesh)) return;
      const camera = cameraRef.current;
      if (!camera || !(camera as any).setTarget) return;
      const arcCam = camera as ArcRotateCamera;

      mesh.computeWorldMatrix(true);
      const hv = (mesh as any).getHierarchyBoundingVectors?.();
      const min = hv ? hv.min : mesh.getBoundingInfo().boundingBox.minimumWorld;
      const max = hv ? hv.max : mesh.getBoundingInfo().boundingBox.maximumWorld;
      const center = new Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 0.1);
      const wantedRadius = Math.max(size * 1.5, 2);

      const prevLower = arcCam.lowerRadiusLimit;
      const prevUpper = arcCam.upperRadiusLimit;
      arcCam.lowerRadiusLimit = 1;
      arcCam.upperRadiusLimit = Math.max(wantedRadius * 2, 1000);
      arcCam.setTarget(center);
      arcCam.radius = wantedRadius;
      arcCam.lowerRadiusLimit = prevLower;
      arcCam.upperRadiusLimit = prevUpper;
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
      // waterLevel=0 is an absolute world Y coordinate - this scene has no actual body of
      // water, so 0 doesn't correspond to anything the camera would ever reach (an outdoor
      // walkthrough camera stays well above it). SwimMode's own physics/rails/comfort-zone
      // only ever engage when camera.y < waterLevel + 0.5, so with a fixed 0 they silently
      // never activated at all. Basing it on the camera's height when the mode is turned on
      // means "submerge wherever you're currently standing", which is what this toggle is
      // actually meant to do.
      const waterLevel = camera.position.y + 5;

      underwater = new UnderwaterMode(scene, camera, { waterLevel });
      underwaterModeRef.current = underwater;
      underwater.activate();

      swim = new SwimMode(scene, camera, underwater, {
        waterLevel,
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

  // The actual Geo Location feature is the GeoLocationContext panel (rendered by
  // GeoFeaturesSegment in uiSegments.tsx when featureStates.showGeoLocation is true) -
  // it owns real geolocation, sun-position, and weather handling behind its own "Get
  // current location" button. This effect used to ALSO independently call
  // getCurrentPosition and yank the camera to
  // (longitude * 0.01, latitude * 0.01, 10) - raw GPS degrees are not scene units, so
  // this just teleported the camera to an arbitrary, meaningless position the instant
  // the panel opened, with no relation to the loaded model. Removed rather than fixed:
  // camera position has nothing to do with what "Geo Location" is supposed to show.

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
  // Mirrors onRainToggle's own identity for the VR menu provider (see its registration
  // comment near xrManagerRef.current = xrManager) - useCallback above re-creates this
  // function whenever rainIntensity/particleSize change, so a closure that captured it
  // once at registration time would silently keep calling a stale version (still
  // correct on/off-wise, but baking in outdated intensity/size for any rain started
  // afterward) - reading it via a ref instead always calls the CURRENT one.
  const onRainToggleRef = useRef(onRainToggle);
  useEffect(() => { onRainToggleRef.current = onRainToggle; }, [onRainToggle]);

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
  // Same staleness fix as onRainToggleRef above, for the VR menu provider.
  const onSnowToggleRef = useRef(onSnowToggle);
  useEffect(() => { onSnowToggleRef.current = onSnowToggle; }, [onSnowToggle]);

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

  // Centralized feature toggle logic.
  //
  // This used to wrap the whole body in startTransition() so a first-time toggle of a
  // React.lazy()-loaded panel (e.g. CostEstimatorWrapper) wouldn't force the nearest
  // Suspense fallback to flash in. In this scene that backfired badly: the app has a
  // continuous 60fps Babylon render loop, and per-frame/per-second React state updates
  // (the FPS counter) count as higher-priority work that can keep preempting a pending
  // low-priority transition indefinitely - so featureStates[id] would never actually
  // commit, leaving the toggle looking like it silently did nothing (confirmed: the
  // Cost Estimator panel never mounted no matter how long you waited after clicking).
  // A user clicking a button to open a panel is exactly the kind of urgent, direct
  // update startTransition is NOT meant for - the brief Suspense fallback on a lazy
  // panel's first open is a fair trade for the toggle actually working.
  const handleFeatureToggle = useCallback((featureId: string | number, enabled: boolean) => {
    const id = String(featureId);
    if (enabled) {
      enableFeature(id);
      // Feeds the Session Insights panel (config/featureCategories.tsx's
      // 'showSessionInsights') via AnalyticsManager.generateWorkspaceReport() - this is
      // the ONE place every feature toggle already passes through, so it's the natural
      // spot to record real usage instead of AnalyticsManager sitting instantiated but
      // never actually fed any events.
      analyticsManagerRef.current?.trackFeatureUsage(id);
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
          // Both calls below return Promise<...> (BIMManager.ts:992,1338) - they were
          // previously fired without await/.then, so the success toast showed the instant
          // the call was MADE rather than once it actually finished, regardless of whether
          // it went on to succeed or reject. A rejection became a silent unhandled promise
          // rejection while the user had already been told it worked.
          bimManagerRef.current.enableClashDetection()
            .then(() => showToast.success('Clash detection enabled'))
            .catch((error: unknown) => {
              console.error('Error enabling clash detection:', error);
              showToast.error('Failed to enable clash detection');
            });
          if (typeof bimManagerRef.current.loadDemoModel === 'function') {
            bimManagerRef.current.loadDemoModel()
              .then(() => showToast.success('Demo model loaded'))
              .catch((error: unknown) => {
                console.error('Error loading demo model:', error);
                showToast.error('Failed to load demo model');
              });
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
          const bimManager = bimManagerRef.current;
          const toastId = showToast.loading('Scanning for clashes...');
          bimManager.enableClashDetection()
            .then(() => {
              const count = bimManager.getClashes().length;
              showToast.dismiss(toastId);
              if (count > 0) {
                showToast.success(`${count} clash${count === 1 ? '' : 'es'} found`, 'Highlighted in red in the 3D view');
              } else {
                showToast.success('No clashes found');
              }
            })
            // The enclosing try/catch this replaced only ever caught a SYNCHRONOUS throw
            // from initiating the call, never a rejection of the returned promise - so a
            // rejection here previously left the "Scanning for clashes..." loading toast
            // on screen forever, with no error shown and no way for the user to tell
            // anything had gone wrong.
            .catch((error: unknown) => {
              console.error('Error running clash detection:', error);
              showToast.dismiss(toastId);
              showToast.error('Failed to run clash detection');
            });
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
        if (id === 'showGestureDetection' && gestureManagerRef.current) {
          gestureManagerRef.current.startGestureRecognition()
            .then((started) => {
              if (started) {
                showToast.success('Gesture detection enabled', 'Watching the camera for thumbs up/down, open hand, and swipes');
              } else {
                showToast.error('Camera access denied or unavailable', 'Gesture detection needs camera permission');
                disableFeature('showGestureDetection');
              }
            })
            // A rejection (vs. a clean `false` resolve) previously had no .catch at all -
            // an unhandled promise rejection with no error toast and the flag left stuck
            // "on" with no real gesture recognition running behind it.
            .catch((error: unknown) => {
              console.error('Error starting gesture recognition:', error);
              showToast.error('Failed to start gesture detection');
              disableFeature('showGestureDetection');
            });
        }
        if (id === 'showGestureInspector') {
          showToast.info('Gesture inspector active');
        }
        if (id === 'showVoiceChat') {
          if (collabManagerRef.current) {
            collabManagerRef.current.enableVoiceChat()
              .then((ok: boolean) => {
                if (ok) {
                  showToast.success('Voice chat connected', 'Microphone is live');
                } else {
                  // Without this, featureStates.showVoiceChat stayed true even though the
                  // mic never actually connected - uiSegments.tsx's VoiceChatPanel is
                  // gated purely on that flag and unconditionally renders "Microphone
                  // live" with a pulsing red dot regardless of real connection state, so
                  // the panel kept lying to the user. Same bug class as the AR/VR fix.
                  showToast.error('Voice chat unavailable', 'Microphone access was denied or is unavailable');
                  disableFeature('showVoiceChat');
                }
              })
              .catch((error: unknown) => {
                console.error('Error enabling voice chat:', error);
                showToast.error('Voice chat unavailable');
                disableFeature('showVoiceChat');
              });
          } else {
            showToast.error('Voice chat unavailable', 'Collaboration is not ready yet');
            disableFeature('showVoiceChat');
          }
        }

        // XR Features
        // Snaps the desktop camera to the saved Home view (if one was ever Set) right
        // before entering VR/AR - XRManager positions the XR session's starting X/Z from
        // wherever this camera happens to be at that moment (see the comment in
        // setupTeleportation there: "wherever the desktop camera... was already looking
        // from - which is itself wherever Fit/the saved Home view left it"), but that's
        // only true if nobody navigated since setting it. In practice the desktop camera
        // usually HAS moved by the time someone clicks Enter VR (that's the point of
        // looking around first) - reported as "set பண்ணின view mobile/VR-ல காமிக்கல"
        // (the view I Set doesn't show on mobile/VR). Explicitly re-applying it here,
        // rather than relying on "wherever it happens to be", is what actually delivers
        // "VR starts at the same place I configured" regardless of what was looked at in
        // between.
        const applyHomeViewBeforeXR = () => {
          const home = homeViewRef.current;
          const arcCam = cameraRef.current;
          if (home && arcCam && 'setTarget' in arcCam) {
            (arcCam as ArcRotateCamera).setTarget(home.target);
            (arcCam as ArcRotateCamera).alpha = home.alpha;
            (arcCam as ArcRotateCamera).beta = home.beta;
            (arcCam as ArcRotateCamera).radius = home.radius;
          }
        };
        if (id === 'showVR' && xrManagerRef.current) {
          applyHomeViewBeforeXR();
          xrManagerRef.current.enterVR()
            .then((success) => {
              if (success) {
                // SSAO is a full-screen, per-eye post effect - real cost on a standalone
                // headset's GPU on top of the render-scale reduction XRManager already
                // applies for XR. desktopSSAOPreferenceRef remembers whatever the
                // desktop value actually was so it comes back once this session ends.
                desktopSSAOPreferenceRef.current = enableSSAO;
                setEnableSSAO(false);
                // SSR ray-marches a reflection buffer per pixel, even more expensive than
                // SSAO - same headset-GPU-headroom reasoning applies.
                desktopSSRPreferenceRef.current = enableSSR;
                setEnableSSR(false);
                // IBL Shadows voxelizes the scene in real time (a 64^3 grid, tri-planar) -
                // at least as expensive as SSR, same headset-GPU-headroom reasoning.
                desktopIBLShadowsPreferenceRef.current = enableIBLShadows;
                setEnableIBLShadows(false);
                // See desktopCSMAutoDepthBoundsPreferenceRef/desktopTAAPreferenceRef's
                // declaration comment - both are real flicker sources under a headset's
                // constant head-tracking motion, not just extra GPU cost.
                const csmGen = shadowGeneratorRef.current;
                if (csmGen instanceof CascadedShadowGenerator) {
                  desktopCSMAutoDepthBoundsPreferenceRef.current = csmGen.autoCalcDepthBounds;
                  csmGen.autoCalcDepthBounds = false;
                }
                if (taaPipelineRef.current) {
                  desktopTAAPreferenceRef.current = taaPipelineRef.current.isEnabled;
                  taaPipelineRef.current.isEnabled = false;
                }
                showToast.success('VR mode enabled');
              } else {
                // Without this, featureStates.showVR stayed true (handleFeatureToggle
                // already flipped it on before this async call started) even though the
                // real WebXR session never came up - the sidebar button and any UI keyed
                // off showVR kept claiming VR was active with nothing actually running.
                disableFeature('showVR');
                showToast.error('Failed to enter VR mode', 'This device/browser may not support VR');
              }
            })
            .catch((error) => {
              console.error('Error entering VR:', error);
              disableFeature('showVR');
              showToast.error('Failed to enter VR mode');
            });
        }
        if (id === 'showAR' && xrManagerRef.current) {
          applyHomeViewBeforeXR();
          xrManagerRef.current.enterAR()
            .then((success) => {
              if (success) {
                // See the matching comment on the VR entry branch above.
                desktopSSAOPreferenceRef.current = enableSSAO;
                setEnableSSAO(false);
                desktopSSRPreferenceRef.current = enableSSR;
                setEnableSSR(false);
                desktopIBLShadowsPreferenceRef.current = enableIBLShadows;
                setEnableIBLShadows(false);
                // See the matching comment on the VR entry branch above.
                const csmGenAR = shadowGeneratorRef.current;
                if (csmGenAR instanceof CascadedShadowGenerator) {
                  desktopCSMAutoDepthBoundsPreferenceRef.current = csmGenAR.autoCalcDepthBounds;
                  csmGenAR.autoCalcDepthBounds = false;
                }
                if (taaPipelineRef.current) {
                  desktopTAAPreferenceRef.current = taaPipelineRef.current.isEnabled;
                  taaPipelineRef.current.isEnabled = false;
                }
                showToast.success('AR mode enabled');
              } else {
                // Same fix as the VR branch above - a false success here previously left
                // the "AR Mode active" badge (uiSegments.tsx) and the sidebar button
                // showing AR as on over the normal desktop view, with no real session and
                // none of XRManager's on-screen controls actually present.
                disableFeature('showAR');
                showToast.error('Failed to enter AR mode', 'This device/browser may not support AR');
              }
            })
            .catch((error) => {
              console.error('Error entering AR:', error);
              disableFeature('showAR');
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
              // Without this, featureStates.showHaptic stayed true (handleFeatureToggle
              // already flipped it on before this ran) even though no controller was
              // actually found - the panel kept reading "Haptic feedback active" at the
              // exact same moment this error toast said the opposite, on any desktop
              // demo with no VR controller connected. Same fix already applied to
              // showVR/showAR/showGeoSync above.
              disableFeature('showHaptic');
              showToast.error('No VR controller detected', 'Haptic feedback needs an active VR session with a controller that supports vibration');
            }
          } catch (error) {
            console.error('Error enabling haptic feedback:', error);
            disableFeature('showHaptic');
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

        // Geo Features: enableFeature(id) above already flips featureStates.showGeoLocation,
        // which is what makes GeoFeaturesSegment (uiSegments.tsx) render the real
        // GeoLocationContext panel - that panel owns geolocation/sun-position/weather
        // itself behind its own "Get current location" button. This branch used to ALSO
        // independently call getCurrentPosition and set cameraRef.current.position.x/z to
        // raw GPS degrees * 0.01, which isn't a scene coordinate - it just snapped the
        // camera to an arbitrary spot with no relation to the loaded model the instant
        // the button was clicked, before the user had done anything in the actual panel.

        // Geo Sync - previously had no handler at all, so clicking this button did
        // nothing visible even though GeoSyncManager existed and was fully functional.
        if (id === 'showGeoSync' && geoSyncManagerRef.current) {
          geoSyncManagerRef.current.connect()
            .then((success: boolean) => {
              if (success) {
                showToast.success('Geo sync connected', 'Tracking real-world location');
              } else {
                // Without this, featureStates.showGeoSync stayed true even on a failed
                // connect - the panel it gates (uiSegments.tsx:1704-1710) has a hardcoded
                // "Geo sync active" line with no real status check, so it kept claiming
                // to be active with nothing actually connected behind it.
                showToast.error('Geo sync unavailable', 'Location services may be disabled');
                disableFeature('showGeoSync');
              }
            })
            .catch((error: unknown) => {
              console.error('Error connecting geo sync:', error);
              showToast.error('Failed to enable geo sync');
              disableFeature('showGeoSync');
            });
        }
        if (id === 'showIoTPanel' && iotManagerRef.current) {
          iotManagerRef.current.connect()
            .then((success: boolean) => {
              if (success) {
                showToast.success('IoT sensors connected');
              } else {
                showToast.error('IoT sensors unavailable', 'Could not reach the IoT service');
                disableFeature('showIoTPanel');
              }
            })
            .catch((error: unknown) => {
              console.error('Error connecting IoT service:', error);
              showToast.error('Failed to connect IoT sensors');
              disableFeature('showIoTPanel');
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
          // connect() returns Promise<boolean> (CollabManager.ts:135) - the enclosing
          // try/catch here only ever caught a synchronous throw from INITIATING the
          // call, never a rejection of the returned promise, so a rejection was
          // previously a silent unhandled promise rejection with no error toast at all.
          // The panel this gates (MultiUserStatus in uiSegments.tsx) polls the manager's
          // own getIsConnected() every second rather than trusting this toggle, so a
          // failed connect already reads as "Connecting..." rather than a false
          // "Connected" - lower severity than the other fixes here, but still worth a
          // real error toast instead of failing silently.
          collabManagerRef.current.connect()
            .then((success: boolean) => {
              if (!success) {
                showToast.error('Failed to connect to multi-user session');
                disableFeature('showMultiUser');
              }
            })
            .catch((error: unknown) => {
              console.error('Error connecting to multi-user:', error);
              showToast.error('Failed to connect to multi-user session');
              disableFeature('showMultiUser');
            });
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
                // Same fix as showGeoSync above - without reverting the flag here, the
                // sidebar kept showing Cloud Anchors as "on" with nothing actually
                // connected behind it.
                showToast.error('Failed to connect cloud anchors');
                disableFeature('showCloudAnchorManager');
              }
            })
            .catch((error: unknown) => {
              console.error('Error connecting cloud anchor manager:', error);
              showToast.error('Failed to connect cloud anchor manager');
              disableFeature('showCloudAnchorManager');
            });
        }

        // Performance Features
        if (id === 'showImport') {
          if (!isAdmin) {
            showToast.error('Only admins can import models');
            disableFeature('showImport');
          } else if (fileInputRef.current) {
            fileInputRef.current.click();
            showToast.success('Import dialog opened');
          }
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
      if (id === 'showGestureDetection' && gestureManagerRef.current) {
        gestureManagerRef.current.stopGestureRecognition();
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
          // Restore whatever SSAO/SSR/IBL Shadows were set to on the desktop before they
          // were force-disabled for the XR session - see the showVR/showAR enter handlers
          // above.
          setEnableSSAO(desktopSSAOPreferenceRef.current);
          setEnableSSR(desktopSSRPreferenceRef.current);
          setEnableIBLShadows(desktopIBLShadowsPreferenceRef.current);
          // See desktopCSMAutoDepthBoundsPreferenceRef/desktopTAAPreferenceRef's
          // declaration comment - restores whatever these were on the desktop before
          // the XR entry handlers force-disabled them for the session.
          const csmGenExit = shadowGeneratorRef.current;
          if (csmGenExit instanceof CascadedShadowGenerator) {
            csmGenExit.autoCalcDepthBounds = desktopCSMAutoDepthBoundsPreferenceRef.current;
          }
          if (taaPipelineRef.current) {
            taaPipelineRef.current.isEnabled = desktopTAAPreferenceRef.current;
          }
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
  }, [enableFeature, disableFeature, setTransformMode, setCameraActive, isAdmin]);

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
            // This mesh may well have been deselected (and, per the load-time freeze
            // optimization, re-frozen) since the edit this undo is reverting - a frozen
            // mesh silently ignores every position/rotation/scaling write below, which
            // would make Undo visibly do nothing. Unfreeze first if it's not the mesh
            // currently gizmo-attached (which is already unfrozen), and only re-freeze
            // after if it wasn't - never re-freeze the one actively being edited.
            const wasFrozen = last.mesh !== pivotedMeshRef.current;
            if (wasFrozen) {
              last.mesh.unfreezeWorldMatrix();
              last.mesh.doNotSyncBoundingInfo = false;
            }
            last.mesh.position.copyFrom(last.position);
            if (last.rotationQuaternion) {
              last.mesh.rotationQuaternion = last.rotationQuaternion;
            } else {
              last.mesh.rotation.copyFrom(last.rotation);
            }
            last.mesh.scaling.copyFrom(last.scaling);
            if (wasFrozen && last.mesh.getTotalVertices() > 0) {
              last.mesh.freezeWorldMatrix();
              last.mesh.doNotSyncBoundingInfo = true;
            }
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
            // The material being replaced here (e.g. a WaterMaterial - see MaterialEditor.tsx's
            // applyMaterialType) may itself own scene-level listeners (its render-list's
            // onNewMeshAddedObservable hook) that only MaterialEditor knows how to tear down -
            // it isn't mounted/listening for this undo any other way, so tell it which material
            // just got abandoned rather than leaving that listener running forever.
            const abandonedMaterial = last.mesh.material;
            last.mesh.material = last.previousMaterial;
            if (abandonedMaterial) {
              window.dispatchEvent(new CustomEvent('naviz:materialAbandoned', { detail: { material: abandonedMaterial } }));
            }
            showToast.success('Undone material type change');
          } else if (last.kind === 'delete') {
            last.mesh.setEnabled(true);
            setSelectedMesh(last.mesh as Mesh);
            showToast.success('Restored');
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
      // The following hotkeys are all declared on their buttons in
      // config/featureCategories.tsx (and shown to the user via FeatureButton's
      // tooltip/badge) but were never actually bound anywhere - pressing them did
      // nothing.
      if (key === '?') { e.preventDefault(); handleFeatureToggle('showKeyboardShortcuts', !featureStates.showKeyboardShortcuts); }
      if (key === 'd' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showDomainSelector', !featureStates.showDomainSelector); }
      if (key === 'e' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showExport', true); }
      if (key === 'i' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showImport', true); }
      if (key === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showAnnotations', !featureStates.showAnnotations); }
      if (key === 'j' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showHotspotNav', !featureStates.showHotspotNav); }
      if (key === 'p' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showMeshMaterialSwatches', !featureStates.showMeshMaterialSwatches); }
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
      if (key === 'h' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleMirrorSelected(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleDeleteSelected(); }
      if (e.key === 'Escape') { setTransformMode('none'); setSelectedMesh(null); }
      // 'z' toggles AR mode, but only when NOT combined with Ctrl/Cmd (Ctrl/Cmd+Z is
      // undo, handled above in the ctrl-key branch).
      if (key === 'z' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFeatureToggle('showAR', !featureStates.showAR); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topBarVisible, leftPanelVisible, rightPanelVisible, bottomPanelVisible, updateState, setLayoutMode, handleFeatureToggle, featureStates, handleMirrorSelected, handleDeleteSelected]);

  // Shift+scroll = fast zoom. wheelDeltaPercentage (see the camera setup above) already
  // makes scroll-zoom fast-when-far/precise-when-close, but a model can be viewed across a
  // genuinely huge range - zoomed all the way out to see a whole site, then scrolling in
  // toward one building - and even at 1%/tick, that full range still takes many, many
  // ticks before the percentage compounds into a visible difference; reported as "zoom
  // pannum bothu slow-a irukku" from a fully zoomed-out start. Holding Shift temporarily
  // raises wheelDeltaPercentage several times over for exactly that "close a large
  // distance quickly" case, independent of which camera mode is active - reads
  // cameraRef.current fresh on every key event rather than depending on a specific camera
  // instance, so it keeps working across a walk/orbit/dollhouse mode switch (which
  // disposes and replaces the camera - see switchCamera). Reverts on window blur too, not
  // just keyup, so alt-tabbing away mid-hold (a missed keyup) can't leave zoom stuck fast.
  React.useEffect(() => {
    const applyWheelDelta = (fast: boolean) => {
      const cam = cameraRef.current;
      if (cam && 'wheelDeltaPercentage' in cam) {
        (cam as ArcRotateCamera).wheelDeltaPercentage = fast ? CAMERA_WHEEL_DELTA_FAST : CAMERA_WHEEL_DELTA_NORMAL;
      }
    };
    const handleShiftDown = (e: KeyboardEvent) => { if (e.key === 'Shift') applyWheelDelta(true); };
    const handleShiftUp = (e: KeyboardEvent) => { if (e.key === 'Shift') applyWheelDelta(false); };
    const handleBlur = () => applyWheelDelta(false);
    window.addEventListener('keydown', handleShiftDown);
    window.addEventListener('keyup', handleShiftUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleShiftDown);
      window.removeEventListener('keyup', handleShiftUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Renders at a coarser resolution while the camera is actively moving (orbit drag,
  // wheel zoom, WASD walking), restoring full resolution a few still frames after it
  // stops - motion itself hides the softness (nobody's studying pixel-level sharpness
  // mid-spin), and the saved GPU time is exactly what makes a heavy interior feel
  // responsive to actually navigate rather than just look at once static. Doesn't touch
  // any of the three existing setHardwareScalingLevel call sites (device-detection init,
  // and the graphicsQuality tier effect) - reads whatever level is CURRENTLY set the
  // instant motion is first detected and treats that as "the real level to restore to",
  // rather than needing those to also remember a separate "base" value. Skipped entirely
  // in VR/AR: WebXR head-tracking means camera.position is essentially always moving by
  // tiny amounts every frame, which would keep this permanently downsampled for the
  // whole session, and XRManager already applies its own headset-appropriate render
  // scale independent of this.
  React.useEffect(() => {
    const scene = sceneRef.current;
    const engine = engineRef.current;
    if (!scene || !engine || featureStates.showVR || featureStates.showAR) return;

    // Was "2 still FRAMES" before - a frame count instead of real time, which is wrong in
    // both directions depending on the scene's actual framerate:
    // - At a smooth ~60fps (typical exterior view), 2 frames is only ~33ms - too short to
    //   bridge the gap between individual mouse-wheel notches during a normal scroll
    //   gesture (each notch's inertial motion can genuinely bottom out below MOVE_EPSILON
    //   for a couple of frames before the next notch arrives), so a scroll burst rapidly
    //   toggled boost -> restore -> boost -> restore, each one snapping the resolution back
    //   and forth - reported this session as heavy flicker specifically while scrolling.
    // - At the severe interior framerate this app already has a separate open issue about
    //   (5-10fps), 2 frames is 200-400ms of real time - longer than the exact ~200ms delay
    //   a previous session already identified and fixed here as its own visible glitch
    //   ("fragmented/jagged edges right after rotating" - see git history). A frame-count
    //   threshold silently reintroduces that same glitch the moment the scene is already
    //   running slow, which is exactly when this mechanism matters most.
    // A fixed real-time debounce fixes both: long enough (100ms comfortably covers typical
    // wheel-notch spacing) to stop the scroll oscillation, yet still well under the ~200ms
    // that was previously flagged as perceptible, and - unlike a frame count - it means the
    // same thing regardless of whether the scene is currently running at 5fps or 60fps.
    const STILL_MS_TO_RESTORE = 100;
    const MOTION_SCALING_BOOST = 1.5; // on top of whatever level is currently active
    const MOVE_EPSILON = 0.001;

    let lastPos: Vector3 | null = null;
    let lastMovedAt = 0;
    let boosted = false;
    let baseScalingLevel = 1;

    const observer = scene.onBeforeRenderObservable.add(() => {
      const camera = scene.activeCamera;
      if (!camera) return;
      const pos = camera.position;
      const moved = !lastPos || !pos.equalsWithEpsilon(lastPos, MOVE_EPSILON);
      lastPos = pos.clone();
      const now = performance.now();

      if (moved) {
        lastMovedAt = now;
        if (!boosted) {
          baseScalingLevel = engine.getHardwareScalingLevel();
          engine.setHardwareScalingLevel(baseScalingLevel * MOTION_SCALING_BOOST);
          boosted = true;
        }
      } else if (boosted && now - lastMovedAt >= STILL_MS_TO_RESTORE) {
        engine.setHardwareScalingLevel(baseScalingLevel);
        boosted = false;
      }
    });

    return () => {
      scene.onBeforeRenderObservable.remove(observer);
      // Restore on cleanup (feature toggled off mid-boost, unmount, etc.) rather than
      // potentially leaving the canvas permanently downsampled with nothing left running
      // to ever un-boost it.
      if (boosted) engine.setHardwareScalingLevel(baseScalingLevel);
    };
  }, [featureStates.showVR, featureStates.showAR]);

  // Guards the occlusion culling enabled on load (see OCCLUSION_TYPE_OPTIMISTIC above) against
  // its one real failure mode: a mesh that goes out of the camera's frustum stops being tested
  // altogether, so it keeps whatever isOccluded value its last query returned. Babylon's own
  // _checkOcclusionQuery only falls back to "assume visible" while a query it already started is
  // still pending - the moment a mesh re-enters the frustum with NO query in flight (exactly what
  // happens after it was out of frustum for a while), it hands back that stale flag as-is for
  // this frame. A mesh that was legitimately occluded once, then rotated out of view, then swung
  // back into view by a fast turn, is therefore invisible for a frame or more even though nothing
  // is actually hiding it anymore - reported this session as the screen going black on a quick VR
  // head-turn and gradually popping back in. Bridges that gap with Babylon's own escape hatch
  // (forceRenderingWhenOccluded, which makes render() ignore the occlusion result entirely) for
  // the duration of a fast rotation and briefly after, so every tracked mesh keeps drawing until
  // fresh queries have had a chance to catch up with where the camera actually ended up. Measures
  // rotation off the camera's forward vector rather than position so this covers VR head-turns
  // (no translation involved) the same as desktop orbit-drag, and runs regardless of
  // showVR/showAR - the VR case is the one this exists for.
  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (occlusionMeshesRef.current.length === 0 && !engineRef.current?.getCaps().supportOcclusionQuery) return;

    const FAST_TURN_THRESHOLD_RAD = 0.09; // ~5 degrees of forward-vector swing in a single frame
    const SETTLE_GRACE_MS = 350; // keep forcing renders briefly after rotation drops back below threshold
    const FORWARD_AXIS = new Vector3(0, 0, 1);

    let lastForward: Vector3 | null = null;
    let fastTurnActive = false;
    let lastFastTurnAt = 0;

    const setForced = (forced: boolean) => {
      for (const m of occlusionMeshesRef.current) {
        m.forceRenderingWhenOccluded = forced;
        if (forced) m.isOccluded = false;
      }
    };

    const observer = scene.onBeforeRenderObservable.add(() => {
      if (occlusionMeshesRef.current.length === 0) return;
      const camera = scene.activeCamera;
      if (!camera) return;
      const forward = camera.getDirection(FORWARD_AXIS);
      if (lastForward) {
        const cosAngle = Vector3.Dot(forward, lastForward);
        const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle)));
        const now = performance.now();
        if (angle >= FAST_TURN_THRESHOLD_RAD) {
          lastFastTurnAt = now;
          if (!fastTurnActive) {
            fastTurnActive = true;
            setForced(true);
          }
        } else if (fastTurnActive && now - lastFastTurnAt >= SETTLE_GRACE_MS) {
          fastTurnActive = false;
          setForced(false);
        }
      }
      lastForward = forward;
    });

    return () => {
      scene.onBeforeRenderObservable.remove(observer);
      if (fastTurnActive) setForced(false);
    };
  }, []);

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
      pushUndo({ kind: 'material', material, snapshot });
    };
    window.addEventListener('naviz:materialSnapshot', handler);
    return () => window.removeEventListener('naviz:materialSnapshot', handler);
  }, [pushUndo]);

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
      pushUndo({ kind: 'materialSwap', mesh, previousMaterial });
    };
    window.addEventListener('naviz:materialSwapUndo', handler);
    return () => window.removeEventListener('naviz:materialSwapUndo', handler);
  }, [pushUndo]);

  // Property Inspector undo - see beginTransformUndoSession()/resetTransform() in
  // uiSegments.tsx's PropertyInspectorPanel. That panel writes position/rotation/scale
  // straight to the mesh with no access to undoHistoryRef of its own, so it dispatches this
  // event (same decoupling pattern MaterialEditor.tsx already uses for material edits)
  // instead of needing pushUndo threaded all the way down through the render props.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ mesh: Mesh; position: Vector3; rotationQuaternion: Quaternion | null; rotation: Vector3; scaling: Vector3 }>;
      const { mesh, position, rotationQuaternion, rotation, scaling } = ev.detail || {};
      if (!mesh || !position || !rotation || !scaling) return;
      pushUndo({ kind: 'transform', mesh, position, rotationQuaternion, rotation, scaling });
    };
    window.addEventListener('naviz:transformSnapshot', handler);
    return () => window.removeEventListener('naviz:transformSnapshot', handler);
  }, [pushUndo]);

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
    featureCategories: rawFeaturesByCategoryVisible,
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
          {/* Top bar - shrink-0 so it stays visible */}
          {topBarVisible && (
            <div className="shrink-0 w-full z-10 bg-gray-900 border-b border-gray-700">
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
              // Previously just showed a toast telling the user to go find a DIFFERENT
              // control instead - the sidebar's separate "VR Mode"/"AR Mode" feature
              // toggle was the only thing that actually called xrManagerRef.enterVR()/
              // enterAR(). A user reasonably expects the view-mode selector's own VR/AR
              // option to enter VR/AR, so it now does exactly that (same handler the
              // sidebar toggle uses, with the same real success/failure toast+recovery).
              else if (mode === 'vr') { handleFeatureToggle('showVR', true); }
              else if (mode === 'ar') { handleFeatureToggle('showAR', true); }
            },
            onHelp: () => {
              if (featureStates.showKeyboardShortcuts) {
                disableFeature('showKeyboardShortcuts');
              } else {
                enableFeature('showKeyboardShortcuts');
              }
            },
            // Undefined (not just a no-op) when not admin - SimpleWorkspaceTopBar only
            // renders the Import button at all when this prop is present, so a client
            // never sees it rather than seeing a button that errors when clicked.
            onImport: isAdmin ? () => {
              if (fileInputRef.current) fileInputRef.current.click();
              showToast.success('Import dialog opened');
            } : undefined,
            onExport: handleExportScene,
            onScreenshot: handleScreenshotCapture,
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
            },
            transformMode,
            setTransformMode,
            cameraActive,
            perspectiveActive,
            onCameraActiveToggle: () => updateState({ cameraActive: !cameraActive }),
            onPerspectiveToggle: () => updateState({ perspectiveActive: !perspectiveActive }),
            topBarExtraLeft,
            topBarExtraRight
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
            <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 gap-1 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-white text-xs"
                title="Fit to view - returns to the saved Home view if one is set, otherwise frames the whole model"
                onClick={runAutoZoom}
              >
                <Maximize className="w-4 h-4" />
                Fit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 gap-1 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-white text-xs"
                title="Save the current camera position/angle as Home - Fit will return here every time"
                onClick={setHomeView}
              >
                <Home className="w-4 h-4" />
                Set
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 gap-1 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-white text-xs"
                title="Flip to the opposite side - spins the camera 180° around what it's currently looking at"
                onClick={flipView}
              >
                <SwitchCamera className="w-4 h-4" />
                Flip
              </Button>
            </div>
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
                <Button
                  size="sm" variant="ghost"
                  className="h-8 px-2" title="Mirror (H)"
                  onClick={handleMirrorSelected}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-8 px-2 text-red-400 hover:text-red-300" title="Delete (Del)"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="w-4 h-4" />
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
              materialManagerRef,
              analyticsManagerRef,
              presentationManagerRef,
              iotManagerRef,
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
              xrManagerRef,
              gestureHistory,
              onDomainChange: handleDomainChange,
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
              graphicsQuality,
              setGraphicsQuality,
              recommendedQuality,
              gpuName,
              deviceCapabilities,
              enableSSR,
              onSsrOverrideChange: handleSsrOverrideChange,
              enableIBLShadows,
              onIblShadowsOverrideChange: handleIblShadowsOverrideChange,
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
              updateState,
              floorPlans,
              onFloorPlansChange: handleFloorPlansChange
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
            performanceMode: performanceModeResolved,
            selectedMesh,
            handleFeatureToggle,
            setPerformanceMode: handlePerformanceModeChange,
            featureStats: featureStatsComputed,
            warnings: performanceWarnings,
            onExportScene: handleExportScene,
            onExportScreenshot: handleScreenshotCapture,
            handleTourSequenceCreate,
            handleTourSequencePlay,
            animationManagerRef
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
            className="fixed left-0 top-1/2 -translate-y-1/2 z-99998 h-16 w-6 flex items-center justify-center rounded-r-md bg-gray-800 hover:bg-gray-700 border border-l-0 border-gray-600 text-gray-400 hover:text-white shadow-lg transition-colors cursor-pointer"
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
            className="fixed top-0 left-1/2 -translate-x-1/2 z-99998 w-16 h-6 flex items-center justify-center rounded-b-md bg-gray-800 hover:bg-gray-700 border border-t-0 border-gray-600 text-gray-400 hover:text-white shadow-lg transition-colors cursor-pointer"
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
