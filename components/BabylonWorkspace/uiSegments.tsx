import React, { useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Globe, Maximize, Map, Hand } from 'lucide-react';
import { showToast } from '../utils/toast';
import type { CollabUser } from '../CollabManager';
import { usePanelStack } from '../../hooks/usePanelStack';

// Lazy load components
const LeftPanel = React.lazy(() => import('../LeftPanel'));
const ControlPanel = React.lazy(() => import('../../src/components/UI/ControlPanel/ControlPanel'));
const TopBar = React.lazy(() => import('../TopBar'));
const SimpleWorkspaceTopBar = React.lazy(() => import('./SimpleWorkspaceTopBar').then(m => ({ default: m.SimpleWorkspaceTopBar })));
const BottomPanel = React.lazy(() => import('../BottomPanel'));
const FloatingToolbar = React.lazy(() => import('../FloatingToolbar'));
const EnhancedWorkspaceLayout = React.lazy(() => import('../EnhancedWorkspaceLayout'));
const EnhancedToolbar = React.lazy(() => import('../EnhancedToolbar'));

// Props interfaces
interface LeftPanelSegmentProps {
  featureCategories: Record<string, any[]>;
  categoryPanelVisible: Record<string, boolean>;
  searchTerm: string;
  activeFeatures: Set<string>;
  currentLayoutMode: 'standard' | 'compact' | 'immersive';
  onCategoryToggle: (category: string) => void;
  onSearchChange: (term: string) => void;
  onFeatureToggle: (featureId: string | number, enabled: boolean) => void;
  onClose: () => void;
  aiManagerRef?: React.RefObject<any>;
  bimManagerRef?: React.RefObject<any>;
}

interface TopBarSegmentProps {
  isGenerating: boolean;
  generationProgress: number;
  onToggleRealTime: () => void;
  realTimeEnabled: boolean;
  fps: number;
  activeFeatures: Set<string>;
  cameraMode: 'orbit' | 'fly' | 'walk' | undefined;
  onCameraModeChange: (mode: 'orbit' | 'fly' | 'walk' | undefined) => void;
  onToggleGrid: () => void;
  gridVisible: boolean;
  onToggleWireframe: () => void;
  wireframeEnabled: boolean;
  onToggleStats: () => void;
  statsVisible: boolean;
}

interface BottomPanelSegmentProps {
  activeFeatures: string[];
  performanceMode: 'low' | 'medium' | 'high';
  selectedMesh: any;
  onFeatureToggle: (featureId: string) => void;
  onPerformanceModeChange: (mode: 'low' | 'medium' | 'high') => void;
  featureStats: { total: number; active: number; byCategory: Record<string, number>; byStatus: Record<string, number> };
  warnings: string[];
  suggestions: string[];
  onSequenceCreate: (sequence: any) => void;
  onSequencePlay: (sequenceId: string) => void;
}

interface FloatingToolbarSegmentProps {
  onMoveToggle: () => void;
  onRotateToggle: () => void;
  onScaleToggle: () => void;
  onCameraToggle: () => void;
  onPerspectiveToggle: () => void;
  isMoveActive: boolean;
  isRotateActive: boolean;
  isScaleActive: boolean;
  isCameraActive: boolean;
  isPerspectiveActive: boolean;
}

// Components
export const LeftPanelSegment: React.FC<LeftPanelSegmentProps> = ({
  featureCategories,
  categoryPanelVisible,
  searchTerm,
  activeFeatures,
  currentLayoutMode,
  onCategoryToggle,
  onSearchChange,
  onFeatureToggle,
  onClose,
  aiManagerRef,
  bimManagerRef
}) => (
  <Suspense fallback={<div className="p-4">Loading Left Panel...</div>}>
    <LeftPanel
      featureCategories={featureCategories}
      categoryPanelVisible={categoryPanelVisible}
      searchTerm={searchTerm}
      activeFeatures={activeFeatures}
      currentLayoutMode={currentLayoutMode}
      onCategoryToggle={onCategoryToggle}
      onSearchChange={onSearchChange}
      onFeatureToggle={onFeatureToggle}
      onClose={onClose}
      aiManagerRef={aiManagerRef}
      bimManagerRef={bimManagerRef}
    />
  </Suspense>
);

export const TopBarSegment: React.FC<TopBarSegmentProps> = ({
  isGenerating,
  generationProgress,
  onToggleRealTime,
  realTimeEnabled,
  fps,
  activeFeatures,
  cameraMode,
  onCameraModeChange,
  onToggleGrid,
  gridVisible,
  onToggleWireframe,
  wireframeEnabled,
  onToggleStats,
  statsVisible
}) => (
  <Suspense fallback={<div className="p-2">Loading Top Bar...</div>}>
    <TopBar
      isGenerating={isGenerating}
      generationProgress={generationProgress}
      onToggleRealTime={onToggleRealTime}
      realTimeEnabled={realTimeEnabled}
      fps={fps.toString()}
      activeFeatures={activeFeatures.size.toString()}
      cameraMode={cameraMode}
      onCameraModeChange={onCameraModeChange}
      onToggleGrid={onToggleGrid}
      gridVisible={gridVisible}
      onToggleWireframe={onToggleWireframe}
      wireframeEnabled={wireframeEnabled}
      onToggleStats={onToggleStats}
      statsVisible={statsVisible}
    />
  </Suspense>
);

export const BottomPanelSegment: React.FC<BottomPanelSegmentProps> = ({
  activeFeatures,
  performanceMode,
  selectedMesh,
  onFeatureToggle,
  onPerformanceModeChange,
  featureStats,
  warnings,
  suggestions,
  onSequenceCreate,
  onSequencePlay
}) => (
  <Suspense fallback={<div className="p-2">Loading Bottom Panel...</div>}>
    <BottomPanel
      activeFeatures={activeFeatures}
      performanceMode={performanceMode}
      selectedMesh={selectedMesh}
      onFeatureToggle={onFeatureToggle}
      onPerformanceModeChange={onPerformanceModeChange}
      featureStats={featureStats}
      warnings={warnings}
      suggestions={suggestions}
      onSequenceCreate={onSequenceCreate}
      onSequencePlay={onSequencePlay}
    />
  </Suspense>
);

export const FloatingToolbarSegment: React.FC<FloatingToolbarSegmentProps> = ({
  onMoveToggle,
  onRotateToggle,
  onScaleToggle,
  onCameraToggle,
  onPerspectiveToggle,
  isMoveActive,
  isRotateActive,
  isScaleActive,
  isCameraActive,
  isPerspectiveActive
}) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  return (
  <Suspense fallback={<div className="p-2">Loading Toolbar...</div>}>
    <div ref={panelRef} style={panelStyle} className="fixed left-6 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3">
      <FloatingToolbar
        onMoveToggle={onMoveToggle}
        onRotateToggle={onRotateToggle}
        onScaleToggle={onScaleToggle}
        onCameraToggle={onCameraToggle}
        onPerspectiveToggle={onPerspectiveToggle}
        isMoveActive={isMoveActive}
        isRotateActive={isRotateActive}
        isScaleActive={isScaleActive}
        isCameraActive={isCameraActive}
        isPerspectiveActive={isPerspectiveActive}
      />
    </div>
  </Suspense>
  );
};

// Immersive mode controls component
export const ImmersiveControls: React.FC<{
  activeFeatures: Set<string>;
  featuresByCategory: Record<string, any[]>;
  handleCategoryToggle: (category: string) => void;
  updateState: (updates: any) => void;
}> = ({ activeFeatures, featuresByCategory, handleCategoryToggle, updateState }) => (
  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
    <Card className="bg-background">
      <CardContent className="p-2 flex items-center gap-2">
        <Badge variant="outline">{activeFeatures.size}</Badge>
        <Separator orientation="vertical" className="h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label="Feature Categories">
              📂
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.keys(featuresByCategory).map(category => (
              <DropdownMenuItem key={category} onClick={() => handleCategoryToggle(category)}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" onClick={() => updateState({ leftPanelVisible: false })} title="Toggle Left Panel">
          🎛️
        </Button>
        <Button size="sm" variant="ghost" onClick={() => updateState({ rightPanelVisible: false })} title="Toggle Right Panel">
          ⚙️
        </Button>
        <Button size="sm" variant="ghost" onClick={() => updateState({ leftPanelVisible: true, rightPanelVisible: true, bottomPanelVisible: true })} title="Exit Immersive Mode">
          🔙
        </Button>
      </CardContent>
    </Card>
  </div>
);

// Loading overlay component
export const LoadingOverlay: React.FC<{
  isInitialized: boolean;
}> = ({ isInitialized }) => {
  if (isInitialized) return null;

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 overflow-hidden">
      <div className="ambient-glow" aria-hidden><span className="ambient-glow-blob" /></div>
      <Card className="bg-black/80 text-white border-gray-600 relative z-10">
        <CardContent className="p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Initializing 3D Workspace....</p>
        </CardContent>
      </Card>
    </div>
  );
};

// Keyboard shortcuts help component
interface KeyboardShortcutsHelpProps {
  visible?: boolean;
  onClose?: () => void;
}

const keyboardShortcutsList = [
  { keys: 'Ctrl+1/2/3', label: 'Switch layout modes' },
  { keys: 'Ctrl+H/J/K', label: 'Toggle panels' },
  { keys: 'W/F', label: 'Weather / flood simulation' },
  { keys: 'T', label: 'Measurement tool' },
  { keys: 'A/U', label: 'AI helpers' },
  { keys: 'X/Z', label: 'VR/AR modes' },
  { keys: 'Ctrl+Z', label: 'Undo' },
  { keys: 'Esc', label: 'Close this overlay' },
];

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  visible = true,
  onClose,
}) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-right');
  useEffect(() => {
    if (!visible || !onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <div ref={panelRef} style={panelStyle} className="fixed right-4 z-50 flex flex-col items-end gap-2 text-xs">
      <div className="w-64 bg-slate-900/90 text-white p-3 rounded-lg border border-slate-800 shadow-xl space-y-2">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-400">Keyboard shortcuts</div>
        <div className="space-y-1 text-[12px]">
          {keyboardShortcutsList.map(({ keys, label }) => (
            <div
              key={keys}
              className="flex items-center justify-between border-b border-slate-800 pb-1 last:border-b-0 last:pb-0"
            >
              <kbd className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[10px]">{keys}</kbd>
              <span className="text-slate-200 text-[11px]">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button size="sm" variant="ghost" className="px-3" onClick={() => onClose?.()}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

const domainOptions = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'interiors', label: 'Interior Design' },
  { id: 'urban', label: 'Urban Planning' },
] as const;

const gestureSamples = [
  'Swipe Left',
  'Swipe Right',
  'Wave',
  'Pinch',
  'Spread',
  'Thumbs Up',
];

const DomainSelectorOverlay: React.FC<{ visible: boolean; onClose: () => void; onDomainChange?: (domainId: string) => void }> = ({ visible, onClose, onDomainChange }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [selectedDomain, setSelectedDomain] = useState(domainOptions[0].id);

  if (!visible) {
    return null;
  }

  const handleSelect = (option: typeof domainOptions[number]) => {
    if (selectedDomain === option.id) {
      return;
    }
    setSelectedDomain(option.id as 'architecture');
    onDomainChange?.(option.id);
    showToast.info(`Domain set to ${option.label}`, 'Relevant tool categories expanded in the panel');
  };

  const resetSelection = () => {
    setSelectedDomain(domainOptions[0].id);
    onDomainChange?.(domainOptions[0].id);
    showToast.info(`Domain reset to ${domainOptions[0].label}`);
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed right-4 z-50 w-64 rounded-lg border border-slate-800 bg-slate-900/95 p-4 shadow-xl text-slate-100">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Map className="h-4 w-4 text-sky-400" />
        <span>Domain Selector</span>
      </div>
      <p className="text-xs text-slate-400">
        Expands the tool categories most relevant to your project type.
      </p>
      <div className="space-y-2 pt-2">
        {domainOptions.map(option => (
          <Button
            key={option.id}
            size="sm"
            variant={selectedDomain === option.id ? 'default' : 'outline'}
            className="flex w-full justify-between px-2 py-1"
            onClick={() => handleSelect(option)}
          >
            <span className="text-left text-[12px]">{option.label}</span>
            {selectedDomain === option.id && <Badge variant="outline" className="text-[10px]">Active</Badge>}
          </Button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2 text-[11px]">
        <Button size="sm" variant="ghost" onClick={resetSelection}>
          Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

// GestureManager (real camera-based skin-tone hand detection, wired in
// BabylonWorkspace.tsx alongside "Gesture Detection") now feeds real entries in here via
// the realHistory prop - previously this panel had no camera pipeline behind it at all
// and only showed fake events from "Log Test Gesture", which is kept below as a manual
// way to preview the UI without needing camera access/a hand in frame.
const GestureInspectorOverlay: React.FC<{ visible: boolean; onClose: () => void; realHistory?: { gesture: string; confidence: number; timestamp: number }[]; isDetectionActive?: boolean }> = ({ visible, onClose, realHistory = [], isDetectionActive = false }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-left');
  const [testHistory, setTestHistory] = useState<{ id: string; gesture: string; timestamp: string }[]>([]);

  if (!visible) {
    return null;
  }

  const handleLogTestGesture = () => {
    const sample = gestureSamples[Math.floor(Math.random() * gestureSamples.length)];
    const entry = {
      id: `${sample}-${Date.now()}`,
      gesture: sample,
      timestamp: new Date().toLocaleTimeString(),
    };
    setTestHistory(prev => [entry, ...prev].slice(0, 5));
    showToast.info(`Test gesture logged: ${sample}`);
  };

  const clearHistory = () => {
    setTestHistory([]);
    showToast.info('Test gesture log cleared');
  };

  const combined = [
    ...[...realHistory].reverse().map((g) => ({
      id: `real-${g.timestamp}`,
      gesture: `${g.gesture.replace(/_/g, ' ')} (${Math.round(g.confidence * 100)}%)`,
      timestamp: new Date(g.timestamp).toLocaleTimeString(),
    })),
    ...testHistory,
  ].slice(0, 8);

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-50 w-72 max-w-[90vw] rounded-lg border border-slate-800 bg-slate-900/95 p-4 text-slate-100 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Hand className="h-4 w-4 text-pink-400" />
          Gesture Inspector
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
        {isDetectionActive ? (
          <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Watching camera for real gestures - turn on "Gesture Detection" if not already active.</>
        ) : (
          <>Turn on "Gesture Detection" to watch the camera for real gestures, or use "Log Test Gesture" below to preview the UI.</>
        )}
      </div>
      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto text-[12px]">
        {combined.length > 0 ? (
          combined.map(entry => (
            <div key={entry.id} className="flex items-center justify-between text-slate-200">
              <span className="capitalize">{entry.gesture}</span>
              <span className="text-[10px] text-slate-500">{entry.timestamp}</span>
            </div>
          ))
        ) : (
          <div className="text-slate-500 text-[11px]">No gestures logged yet.</div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={handleLogTestGesture}>
          Log Test Gesture
        </Button>
        <Button size="sm" variant="outline" onClick={clearHistory}>
          Clear Test Log
        </Button>
      </div>
    </div>
  );
};

// Hidden file input component
export const HiddenFileInput: React.FC<{
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFilesSelected?: (files: FileList | null) => void;
}> = ({ fileInputRef, onFilesSelected }) => (
  <>
    <label htmlFor="file-upload" className="hidden">File Upload</label>
    <input
      id="file-upload"
      ref={fileInputRef}
      type="file"
      multiple
      accept=".gltf,.glb,.obj,.fbx,.stl"
      className="hidden"
      onChange={(e) => {
        const files = e.target.files;
        if (onFilesSelected) {
          onFilesSelected(files);
        }
      }}
    />
  </>
);

// Additional lazy loads for custom panels
const MaterialEditor = React.lazy(() => import('../MaterialEditor'));
const Minimap = React.lazy(() => import('../Minimap'));
const MeasureTool = React.lazy(() => import('../MeasureTool'));
const AutoFurnish = React.lazy(() => import('../AutoFurnish'));
const ARAnchorUI = React.lazy(() => import('../ARAnchorUI'));
const DragDropMaterialHandler = React.lazy(() => import('../DragDropMaterialHandler').then(module => ({ default: module.DragDropMaterialHandler })));
const BIMIntegration = React.lazy(() => import('../BIMIntegration'));
const EnergyDashboard = React.lazy(() => import('../EnergyDashboard'));
const GeoLocationContext = React.lazy(() => import('../GeoLocationContext'));
const FloodSimulation = React.lazy(() => import('../FloodSimulation'));
const WindTunnelSimulation = React.lazy(() => import('../WindTunnelSimulation'));
const LightingPresets = React.lazy(() => import('../LightingPresets'));
const GraphicsQualityPanel = React.lazy(() => import('../GraphicsQualityPanel'));
const SunStudyPanel = React.lazy(() => import('../SunStudyPanel'));
const ErgonomicTesting = React.lazy(() => import('../ErgonomicTesting'));
const AIStructuralAdvisor = React.lazy(() => import('../AIStructuralAdvisor'));
const TopographyGenerator = React.lazy(() => import('../TopographyGenerator'));
const ConstructionOverlay = React.lazy(() => import('../ConstructionOverlay'));
const ShadowImpactAnalysis = React.lazy(() => import('../ShadowImpactAnalysis'));
const CirculationFlowSimulation = React.lazy(() => import('../CirculationFlowSimulation'));
const AICoDesigner = React.lazy(() => import('../AICoDesigner'));
const VersionHistoryPanel = React.lazy(() => import('../VersionHistoryPanel'));
const AnnotationTool = React.lazy(() => import('../AnnotationTool'));
const SiteContextPanel = React.lazy(() => import('../SiteContextPanel'));
const ROICalculatorPanel = React.lazy(() => import('../ROICalculatorPanel'));
const DesignReportPanel = React.lazy(() => import('../DesignReportPanel'));
const MobileHandoffPanel = React.lazy(() => import('../MobileHandoffPanel'));
const ApprovalPanel = React.lazy(() => import('../ApprovalPanel'));
const WalkthroughRecorderPanel = React.lazy(() => import('../WalkthroughRecorderPanel'));
const BudgetTierPanel = React.lazy(() => import('../BudgetTierPanel'));
const BeforeAfterPanel = React.lazy(() => import('../BeforeAfterPanel'));
const SessionInsightsPanel = React.lazy(() => import('../SessionInsightsPanel'));
const MoodLightingPanel = React.lazy(() => import('../MoodLightingPanel'));
const IoTSensorsPanel = React.lazy(() => import('../IoTSensorsPanel'));
const ScenarioTourPanel = React.lazy(() => import('../ScenarioTourPanel'));
const ARScalePanel = React.lazy(() => import('../ARScalePanel'));
const SpatialAudioPanel = React.lazy(() => import('../SpatialAudioPanel'));
const AIAdvisorPanel = React.lazy(() => import('../AIAdvisorPanel'));
const MovementControlPanel = React.lazy(() => import('../MovementControlPanel'));
const SmartAlternativesPanel = React.lazy(() => import('../SmartAlternativesPanel'));
const SoundPrivacyPanel = React.lazy(() => import('../SoundPrivacyPanel'));
const MultiSensoryPanel = React.lazy(() => import('../MultiSensoryPanel'));
const CostEstimatorWrapper = React.lazy(() => import('../CostEstimatorWrapper'));

// Props interface for CustomPanelsSegment
interface CustomPanelsSegmentProps {
  featureStates: Record<string, boolean>;
  sceneRef: React.RefObject<any>;
  engineRef: React.RefObject<any>;
  cameraRef: React.RefObject<any>;
  bimManagerRef: React.RefObject<any>;
  analyticsManagerRef: React.RefObject<any>;
  presentationManagerRef: React.RefObject<any>;
  iotManagerRef: React.RefObject<any>;
  simulationManagerRef: React.RefObject<any>;
  aiManagerRef: React.RefObject<any>;
  collabManagerRef: React.RefObject<any>;
  siteContextManagerRef: React.RefObject<any>;
  geoSyncManagerRef: React.RefObject<any>;
  costEstimatorRef: React.RefObject<any>;
  scenarioManagerRef: React.RefObject<any>;
  moodSceneManagerRef: React.RefObject<any>;
  animationManagerRef: React.RefObject<any>;
  sustainabilityManagerRef: React.RefObject<any>;
  audioManagerRef: React.RefObject<any>;
  cloudAnchorManagerRef: React.RefObject<any>;
  arCloudAnchorsRef: React.RefObject<any>;
  gpsTransformUtilsRef: React.RefObject<any>;
  xrManagerRef: React.RefObject<any>;
  gestureHistory: { gesture: string; confidence: number; timestamp: number }[];
  onDomainChange?: (domainId: string) => void;
  currentModelId: string;
  workspaces: any[];
  selectedWorkspaceId: string;
  handleWorkspaceSelect: (id: string) => void;
  handleMaterialApplied: (mesh: any, material: any) => void;
  handleAnimationCreate: (sequence: any) => void;
  handleSequencePlay: (sequenceId: string, options?: any) => void;
  handleTourSequenceCreate: (sequence: any) => void;
  handleTourSequencePlay: (sequenceId: string) => void;
  disableFeature: (id: string) => void;
  enableFeature: (id: string) => void;
  onRainToggle?: (on: boolean) => void;
  rainOn?: boolean;
  rainIntensity?: number;
  onRainIntensityChange?: (v: number) => void;
  onSnowToggle?: (on: boolean) => void;
  snowOn?: boolean;
  particleSize?: number;
  onParticleSizeChange?: (v: number) => void;
  onFloodToggle?: (on: boolean) => void;
  floodOn?: boolean;
  onFloodLevelChange?: (level: number) => void;
  onFloodWaveSpeedChange?: (speed: number) => void;
  workspaceState: {
    selectedMesh: any;
  };
  updateState: (updates: any) => void;
  graphicsQuality?: 'auto' | 'low' | 'medium' | 'high' | 'ultra';
  setGraphicsQuality?: (value: 'auto' | 'low' | 'medium' | 'high' | 'ultra') => void;
  recommendedQuality?: 'low' | 'medium' | 'high' | 'ultra';
  gpuName?: string;
  deviceCapabilities?: any;
  sustainabilityReport?: {
    greenScore: number;
    energyEfficiency: number;
    waterEfficiency: number;
    waterFootprint: number;
    renewableEnergyUsage: number;
    carbonFootprint: number;
    energyUsage: number;
    complianceStatus: boolean;
    recommendations: string[];
  } | null;
}

// Main CustomPanelsSegment that composes all sub-segments
export const CustomPanelsSegment: React.FC<CustomPanelsSegmentProps> = (props) => (
  <>
    <CoreFeaturesSegment {...props} />
    <NavigationControlsSegment {...props} />
    <SimulationAnalysisSegment {...props} />
    <AdvancedFeaturesSegment {...props} />
    <AdditionalSimulationSegment {...props} />
    <AIFeaturesSegment {...props} />
    <AnalysisFeaturesSegment {...props} />
    <CollaborationFeaturesSegment {...props} />
    <ImmersiveFeaturesSegment {...props} />
    <GeoFeaturesSegment {...props} />
    <SpecializedComponentsSegment {...props} />
  </>
);

// Sub-segment components for CustomPanels
const CoreFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'engineRef' | 'cameraRef' | 'bimManagerRef' | 'aiManagerRef' | 'workspaces' | 'selectedWorkspaceId' | 'handleWorkspaceSelect' | 'handleMaterialApplied' | 'handleAnimationCreate' | 'handleSequencePlay' | 'disableFeature' | 'workspaceState' | 'scenarioManagerRef' | 'moodSceneManagerRef' | 'animationManagerRef' | 'cloudAnchorManagerRef' | 'arCloudAnchorsRef' | 'gpsTransformUtilsRef' | 'xrManagerRef' | 'graphicsQuality' | 'setGraphicsQuality' | 'recommendedQuality' | 'gpuName' | 'deviceCapabilities' | 'simulationManagerRef' | 'currentModelId'>> = ({
  featureStates, sceneRef, engineRef, cameraRef, bimManagerRef, aiManagerRef, workspaces, selectedWorkspaceId, handleWorkspaceSelect, handleMaterialApplied, handleAnimationCreate, handleSequencePlay, disableFeature, workspaceState, scenarioManagerRef, moodSceneManagerRef, animationManagerRef, cloudAnchorManagerRef, arCloudAnchorsRef, gpsTransformUtilsRef, xrManagerRef, graphicsQuality, setGraphicsQuality, recommendedQuality, gpuName, deviceCapabilities, simulationManagerRef, currentModelId
}) => {
  const lightingPanel = usePanelStack('top-left', !!featureStates.showLighting);
  const graphicsQualityPanel = usePanelStack('top-right');
  const ergonomicPanel = usePanelStack('top-right');
  const topographyPanel = usePanelStack('top-right');
  const constructionPanel = usePanelStack('top-right');
  const shadowImpactPanel = usePanelStack('top-right');
  const circulationPanel = usePanelStack('top-right');
  const energyPanel = usePanelStack('top-right');
  const measurementPanel = usePanelStack('top-right');
  const autoFurnishPanel = usePanelStack('top-right');
  const cloudAnchorPanel = usePanelStack('top-right');
  const versionHistoryFallbackPanel = usePanelStack('top-right');
  const bimFallbackPanel = usePanelStack('top-right');
  return (
  <>
    {featureStates.showMaterialEditor && sceneRef.current && (
      <Suspense fallback={<div className="absolute top-4 right-4 z-40 w-48 p-4 bg-slate-900/95 rounded-lg animate-pulse">Loading Material Editor...</div>}>
        <MaterialEditor
          sceneManager={{ scene: sceneRef.current }}
          selectedMesh={workspaceState?.selectedMesh}
          onClose={() => disableFeature('showMaterialEditor')}
          onMaterialChange={() => {}}
          onMaterialApplied={handleMaterialApplied}
        />
      </Suspense>
    )}
    {featureStates.showMinimap && sceneRef.current && cameraRef.current && (
      <Suspense fallback={<div className="absolute top-4 right-4 z-40 w-52 h-32 bg-slate-900/95 rounded-lg animate-pulse" />}>
      <div className="absolute top-4 right-4 z-40 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl pointer-events-auto">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-slate-300">Minimap</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => disableFeature('showMinimap')} aria-label="Close Minimap">✕</Button>
        </div>
        <Minimap
          scene={sceneRef.current}
          camera={cameraRef.current}
          workspaces={workspaces ?? []}
          selectedWorkspaceId={selectedWorkspaceId ?? ''}
          onWorkspaceSelect={handleWorkspaceSelect}
          onCameraMove={(pos) => {
            if (cameraRef.current) {
              cameraRef.current.position.copyFrom(pos);
              if (cameraRef.current.setTarget) cameraRef.current.setTarget(pos);
            }
          }}
        />
      </div>
      </Suspense>
    )}
    {sceneRef.current && (
      // Kept mounted (visibility toggled via CSS) instead of conditionally rendered on
      // featureStates.showLighting - LightingPresets owns real Babylon scene resources
      // (the procedural sky dome mesh, the HDRI skybox/texture) that its own effects
      // dispose on unmount. Gating the whole component on panel visibility meant closing
      // this panel didn't just hide the UI, it destroyed whichever sky/lighting effect
      // was currently active in the 3D scene - reopening the panel could never show it
      // as still selected because it had actually been torn down.
      <Suspense fallback={<div ref={lightingPanel.ref} style={lightingPanel.style} className="fixed bottom-4 left-4 z-50 w-96 max-w-[90vw] h-48 bg-slate-900/95 rounded-xl animate-pulse border border-slate-600" />}>
      <div ref={lightingPanel.ref} style={{ ...lightingPanel.style, bottom: 16 }} className={`fixed left-4 z-50 w-96 max-w-[90vw] flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden ${featureStates.showLighting ? 'flex' : 'hidden'}`}>
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Lighting
          </span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showLighting')} aria-label="Close Lighting">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <LightingPresets scene={sceneRef.current} />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showGraphicsQuality && (
      <Suspense fallback={<div ref={graphicsQualityPanel.ref} style={graphicsQualityPanel.style} className="fixed right-4 z-50 w-80 max-w-[90vw] h-48 bg-slate-900/95 rounded-xl animate-pulse border border-slate-600" />}>
      <div ref={graphicsQualityPanel.ref} style={graphicsQualityPanel.style} className="fixed right-4 z-50 w-80 max-w-[90vw] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> Graphics Quality
          </span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showGraphicsQuality')} aria-label="Close Graphics Quality">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <GraphicsQualityPanel
            value={graphicsQuality ?? 'auto'}
            onChange={(v) => setGraphicsQuality?.(v)}
            recommended={recommendedQuality ?? 'medium'}
            gpuName={gpuName}
            capabilities={deviceCapabilities}
          />
        </div>
      </div>
      </Suspense>
    )}
    {/* Previously-orphaned tools revived from the site audit - each already existed as a
        real component but had no featureStates flag or UI path to reach it. Reachable now
        via Tools & Features' "Open in Workspace" button (toolPageDefinitions.ts's
        workspaceFeature mapping) same as every other feature. SunStudyPanel,
        AIStructuralAdvisor, and AICoDesigner already render their own fixed-position
        panel chrome (header + close button) - wrapping them again here would double them
        up, so they're rendered directly. The rest render bare content meant to sit inside
        a container, so they get the same floating-panel shell used elsewhere in this file. */}
    {featureStates.showSunStudy && sceneRef.current && (
      <Suspense fallback={null}>
        <SunStudyPanel scene={sceneRef.current} onClose={() => disableFeature('showSunStudy')} />
      </Suspense>
    )}
    {featureStates.showAIStructuralAdvisor && sceneRef.current && (
      <Suspense fallback={null}>
        <AIStructuralAdvisor scene={sceneRef.current} isActive onClose={() => disableFeature('showAIStructuralAdvisor')} />
      </Suspense>
    )}
    {featureStates.showAICoDesigner && sceneRef.current && (
      <Suspense fallback={null}>
        <AICoDesigner
          scene={sceneRef.current}
          isActive
          onClose={() => disableFeature('showAICoDesigner')}
          selectedMesh={workspaceState?.selectedMesh ?? null}
        />
      </Suspense>
    )}
    {featureStates.showErgonomicTesting && sceneRef.current && (
      <Suspense fallback={<div ref={ergonomicPanel.ref} style={ergonomicPanel.style} className="fixed right-4 z-50 w-80 h-40 bg-slate-900/95 rounded-lg animate-pulse border border-slate-600" />}>
      <div ref={ergonomicPanel.ref} style={ergonomicPanel.style} className="fixed right-4 z-50 w-80 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200">Ergonomic Testing</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showErgonomicTesting')} aria-label="Close Ergonomic Testing">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <ErgonomicTesting scene={sceneRef.current} />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showTopographyGenerator && sceneRef.current && (
      <Suspense fallback={<div ref={topographyPanel.ref} style={topographyPanel.style} className="fixed right-4 z-50 w-80 h-40 bg-slate-900/95 rounded-lg animate-pulse border border-slate-600" />}>
      <div ref={topographyPanel.ref} style={topographyPanel.style} className="fixed right-4 z-50 w-80 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200">Topography Generator</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showTopographyGenerator')} aria-label="Close Topography Generator">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <TopographyGenerator scene={sceneRef.current} />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showConstructionOverlay && sceneRef.current && (
      <Suspense fallback={<div ref={constructionPanel.ref} style={constructionPanel.style} className="fixed right-4 z-50 w-80 h-40 bg-slate-900/95 rounded-lg animate-pulse border border-slate-600" />}>
      <div ref={constructionPanel.ref} style={constructionPanel.style} className="fixed right-4 z-50 w-80 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200">Construction Overlay</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showConstructionOverlay')} aria-label="Close Construction Overlay">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <ConstructionOverlay scene={sceneRef.current} />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showShadowImpactAnalysis && sceneRef.current && engineRef.current && (
      <Suspense fallback={<div ref={shadowImpactPanel.ref} style={shadowImpactPanel.style} className="fixed right-4 z-50 w-96 h-40 bg-slate-900/95 rounded-lg animate-pulse border border-slate-600" />}>
      <div ref={shadowImpactPanel.ref} style={shadowImpactPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200">Shadow Impact Analysis</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showShadowImpactAnalysis')} aria-label="Close Shadow Impact Analysis">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <ShadowImpactAnalysis scene={sceneRef.current} engine={engineRef.current} />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showCirculationFlowSimulation && sceneRef.current && engineRef.current && (
      <Suspense fallback={<div ref={circulationPanel.ref} style={circulationPanel.style} className="fixed right-4 z-50 w-96 h-40 bg-slate-900/95 rounded-lg animate-pulse border border-slate-600" />}>
      <div ref={circulationPanel.ref} style={circulationPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200">Circulation Flow Simulation</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showCirculationFlowSimulation')} aria-label="Close Circulation Flow Simulation">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <CirculationFlowSimulation scene={sceneRef.current} engine={engineRef.current} isActive />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showEnergyDashboard && (
      <Suspense fallback={<div ref={energyPanel.ref} style={energyPanel.style} className="fixed right-4 z-50 w-96 h-40 bg-slate-900/95 rounded-lg animate-pulse border border-slate-600" />}>
      <div ref={energyPanel.ref} style={energyPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200">Energy Analysis</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showEnergyDashboard')} aria-label="Close Energy Analysis">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <EnergyDashboard bimManager={bimManagerRef.current ?? undefined} simulationManager={simulationManagerRef?.current ?? undefined} modelId={currentModelId} />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showVersionHistory && (
      <Suspense fallback={<div ref={versionHistoryFallbackPanel.ref} style={versionHistoryFallbackPanel.style} className="fixed right-4 z-40 w-96 max-w-[90vw] h-48 bg-slate-900/95 rounded-xl animate-pulse border border-slate-600" />}>
        <VersionHistoryPanel
          roomId={selectedWorkspaceId || 'default-room'}
          onClose={() => disableFeature('showVersionHistory')}
        />
      </Suspense>
    )}
    {featureStates.showMeasurementTool && sceneRef.current && engineRef.current && (
      <Suspense fallback={<div ref={measurementPanel.ref} style={measurementPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] h-48 bg-slate-900/95 rounded-xl animate-pulse border border-slate-600" />}>
      <div ref={measurementPanel.ref} style={measurementPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] max-h-[85vh] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl pointer-events-auto overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
          <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Measure
          </span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showMeasurementTool')} aria-label="Close Measure">✕</Button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <MeasureTool
            scene={sceneRef.current}
            engine={engineRef.current}
            isActive={featureStates.showMeasurementTool}
            onMeasurementComplete={(measurement: any) => console.log('Measurement completed:', measurement)}
          />
        </div>
      </div>
      </Suspense>
    )}
    {featureStates.showAutoFurnish && sceneRef.current && (
      <Suspense fallback={<div ref={autoFurnishPanel.ref} style={autoFurnishPanel.style} className="fixed right-4 z-50 w-64 p-4 bg-slate-800 rounded-lg animate-pulse">Loading Auto Furnish...</div>}>
        <AutoFurnish sceneManager={{ scene: sceneRef.current }} onClose={() => disableFeature('showAutoFurnish')} />
      </Suspense>
    )}
    {/* Cloud Anchors previously had no UI at all - toggling it only ran
        CloudAnchorManager.connect() in the background with a toast, giving the user no
        way to actually place/view/remove an anchor. ARAnchorUI already existed with a
        real place/list/sync/GPS UI, it just needed ARCloudAnchors/GPSTransformUtils
        (created alongside cloudAnchorManagerRef in BabylonWorkspace.tsx) and mounting
        here. */}
    {featureStates.showCloudAnchorManager && sceneRef.current && arCloudAnchorsRef?.current && cloudAnchorManagerRef?.current && gpsTransformUtilsRef?.current && (
      <Suspense fallback={<div ref={cloudAnchorPanel.ref} style={cloudAnchorPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] h-48 bg-slate-900/95 rounded-xl animate-pulse border border-slate-600" />}>
        <div ref={cloudAnchorPanel.ref} style={{ ...cloudAnchorPanel.style, bottom: 16 }} className="fixed right-4 z-50 w-96 max-w-[90vw] flex flex-col bg-slate-900/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl overflow-hidden text-white">
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-600 bg-slate-800/80 shrink-0">
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> Cloud Anchors
            </span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-white" onClick={() => disableFeature('showCloudAnchorManager')} aria-label="Close Cloud Anchors">✕</Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ARAnchorUI
              arAnchors={arCloudAnchorsRef.current}
              cloudManager={cloudAnchorManagerRef.current}
              gpsUtils={gpsTransformUtilsRef.current}
            />
          </div>
        </div>
      </Suspense>
    )}
    {featureStates.showARScale && sceneRef.current && (
      <Suspense fallback={null}>
        <ARScalePanel
          scene={sceneRef.current}
          onClose={() => disableFeature('showARScale')}
          xrManagerRef={xrManagerRef}
        />
      </Suspense>
    )}
    {featureStates.showAnnotations && sceneRef.current && (
      <Suspense fallback={<div className="fixed top-1/2 left-4 z-40 w-80 max-w-[90vw] h-48 bg-slate-900/95 rounded-xl animate-pulse border border-slate-600" />}>
        <AnnotationTool
          scene={sceneRef.current}
          roomId={selectedWorkspaceId || 'default-room'}
          onClose={() => disableFeature('showAnnotations')}
        />
      </Suspense>
    )}
    {featureStates.showBIMIntegration && sceneRef.current && bimManagerRef.current && (
      <Suspense fallback={<div ref={bimFallbackPanel.ref} style={bimFallbackPanel.style} className="fixed right-4 z-50 w-64 p-4 bg-slate-800 rounded-lg animate-pulse">Loading BIM...</div>}>
        <BIMIntegration scene={sceneRef.current} isActive={featureStates.showBIMIntegration} bimManager={bimManagerRef.current} onClose={() => disableFeature('showBIMIntegration')} />
      </Suspense>
    )}
    {sceneRef.current && engineRef.current && (
      <Suspense fallback={null}>
        <DragDropMaterialHandler
          scene={sceneRef.current}
          canvas={engineRef.current.getRenderingCanvas()!}
          onMaterialApplied={handleMaterialApplied}
        />
      </Suspense>
    )}
  </>
  );
};

const NavigationControlsSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'cameraRef' | 'disableFeature'>> = ({
  featureStates, sceneRef, cameraRef, disableFeature
}) => {
  const teleportPanel = usePanelStack('top-left');
  const swimPanel = usePanelStack('top-right');
  return (
  <>
    {featureStates.showMovementControlChecker && sceneRef.current && cameraRef.current && (
      <Suspense fallback={null}>
        <MovementControlPanel
          scene={sceneRef.current}
          camera={cameraRef.current}
          onClose={() => disableFeature('showMovementControlChecker')}
        />
      </Suspense>
    )}
    {featureStates.showTeleportManager && sceneRef.current && cameraRef.current && (
      <div ref={teleportPanel.ref} style={teleportPanel.style} className="fixed left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">Teleport Navigation</h3>
        <p className="text-slate-300 text-sm">Click anywhere on the floor to move there instantly.</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showTeleportManager')} className="mt-2">Close</Button>
      </div>
    )}
    {featureStates.showSwimMode && sceneRef.current && cameraRef.current && (
      <div ref={swimPanel.ref} style={swimPanel.style} className="fixed right-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">Underwater / Swim Mode</h3>
        <p className="text-slate-300 text-sm">Underwater fog, caustics, and bubbles are active around the camera.</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showSwimMode')} className="mt-2">Close</Button>
      </div>
    )}
  </>
  );
};

// Position/Scale fields write straight to the live mesh (Babylon renders the change on its
// own render loop - no React re-render needed for the 3D scene to update), while local state
// keeps the number inputs controlled and in sync when a different mesh gets selected. This
// used to be read-only text ("Position: 1.00, 2.00, 3.00") despite the feature being named
// and described as an *editor* - Material Editor already covers materials, so this adds the
// remaining transform + visibility properties rather than duplicating that.
const PropertyInspectorPanel: React.FC<{ mesh: any; meshCount: number; lightCount: number; onClose: () => void }> = ({ mesh, meshCount, lightCount, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotationDeg, setRotationDeg] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
  const [visible, setVisible] = useState(true);
  // Diffuse (StandardMaterial) and albedo (PBRMaterial) are the two color properties
  // that actually exist depending on which material type the mesh has - tracked
  // separately from a generic "color" so the right one gets read/written.
  const [materialColor, setMaterialColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [materialAlpha, setMaterialAlpha] = useState(1);
  const colorPropertyName = mesh?.material ? ('diffuseColor' in mesh.material ? 'diffuseColor' : 'albedoColor' in mesh.material ? 'albedoColor' : null) : null;

  // Position/Rotation/Scale edits here used to write straight to the mesh with no undo
  // tracking at all - Ctrl+Z (BabylonWorkspace.tsx's 'naviz:transformSnapshot' listener,
  // wired to the same pushUndo() every other edit source uses) could never revert them.
  // Snapshots the mesh's state on the FIRST change of a burst (not every keystroke/drag
  // tick) and pushes ~600ms after the user stops, so dragging a slider or typing a number
  // produces one undo entry, not dozens.
  const pendingTransformSnapshotRef = useRef<{ position: any; rotationQuaternion: any; rotation: any; scaling: any } | null>(null);
  const transformIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginTransformUndoSession = () => {
    if (!mesh) return;
    if (!pendingTransformSnapshotRef.current) {
      pendingTransformSnapshotRef.current = {
        position: mesh.position.clone(),
        rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
        rotation: mesh.rotation.clone(),
        scaling: mesh.scaling.clone(),
      };
    }
    if (transformIdleTimerRef.current) clearTimeout(transformIdleTimerRef.current);
    transformIdleTimerRef.current = setTimeout(() => {
      const snapshot = pendingTransformSnapshotRef.current;
      pendingTransformSnapshotRef.current = null;
      if (!snapshot) return;
      window.dispatchEvent(new CustomEvent('naviz:transformSnapshot', { detail: { mesh, ...snapshot } }));
    }, 600);
  };

  // Same idea for material color/alpha, reusing the exact snapshot shape (and the
  // 'naviz:materialSnapshot' event/listener) MaterialEditor.tsx's own snapshotForUndo()
  // already established - capturing every property the undo-apply code restores
  // (BabylonWorkspace.tsx's Ctrl+Z handler), not just the two this panel edits, so undoing
  // a color tweak made here can't blank out metallic/roughness/textures nobody touched.
  const pendingMaterialSnapshotRef = useRef<Record<string, any> | null>(null);
  const materialIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginMaterialUndoSession = () => {
    const material = mesh?.material;
    if (!material) return;
    if (!pendingMaterialSnapshotRef.current) {
      if ('diffuseColor' in material) {
        pendingMaterialSnapshotRef.current = {
          kind: 'standard',
          diffuseColor: material.diffuseColor.clone(),
          specularColor: material.specularColor.clone(),
          emissiveColor: material.emissiveColor.clone(),
          alpha: material.alpha,
          specularPower: material.specularPower,
          diffuseTexture: material.diffuseTexture,
          bumpTexture: material.bumpTexture,
          emissiveTexture: material.emissiveTexture,
        };
      } else if ('albedoColor' in material) {
        pendingMaterialSnapshotRef.current = {
          kind: 'pbr',
          albedoColor: material.albedoColor.clone(),
          emissiveColor: material.emissiveColor.clone(),
          alpha: material.alpha,
          metallic: material.metallic,
          roughness: material.roughness,
          environmentIntensity: material.environmentIntensity,
          reflectivityColor: material.reflectivityColor?.clone(),
          indexOfRefraction: material.indexOfRefraction,
          albedoTexture: material.albedoTexture,
          bumpTexture: material.bumpTexture,
          emissiveTexture: material.emissiveTexture,
        };
      }
    }
    if (materialIdleTimerRef.current) clearTimeout(materialIdleTimerRef.current);
    materialIdleTimerRef.current = setTimeout(() => {
      const snapshot = pendingMaterialSnapshotRef.current;
      pendingMaterialSnapshotRef.current = null;
      if (!snapshot) return;
      window.dispatchEvent(new CustomEvent('naviz:materialSnapshot', { detail: { material, snapshot } }));
    }, 600);
  };

  useEffect(() => {
    if (!mesh) return;
    setPosition({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z });
    setRotationDeg({
      x: (mesh.rotation.x * 180) / Math.PI,
      y: (mesh.rotation.y * 180) / Math.PI,
      z: (mesh.rotation.z * 180) / Math.PI
    });
    setScale({ x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z });
    setVisible(mesh.isVisible);
    const colorProp = mesh.material ? ('diffuseColor' in mesh.material ? 'diffuseColor' : 'albedoColor' in mesh.material ? 'albedoColor' : null) : null;
    if (colorProp && mesh.material[colorProp]) {
      const c = mesh.material[colorProp];
      setMaterialColor({ r: c.r, g: c.g, b: c.b });
      setMaterialAlpha(mesh.material.alpha ?? 1);
    } else {
      setMaterialColor(null);
    }
  }, [mesh]);

  const updatePosition = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!mesh || Number.isNaN(value)) return;
    beginTransformUndoSession();
    mesh.position[axis] = value;
    setPosition((p) => ({ ...p, [axis]: value }));
  };
  const updateRotation = (axis: 'x' | 'y' | 'z', valueDeg: number) => {
    if (!mesh || Number.isNaN(valueDeg)) return;
    beginTransformUndoSession();
    mesh.rotation[axis] = (valueDeg * Math.PI) / 180;
    setRotationDeg((r) => ({ ...r, [axis]: valueDeg }));
  };
  const updateScale = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!mesh || Number.isNaN(value) || value === 0) return;
    beginTransformUndoSession();
    mesh.scaling[axis] = value;
    setScale((s) => ({ ...s, [axis]: value }));
  };
  const toggleVisible = () => {
    if (!mesh) return;
    const next = !visible;
    mesh.isVisible = next;
    setVisible(next);
  };
  const updateMaterialColor = (channel: 'r' | 'g' | 'b', value: number) => {
    if (!mesh?.material || !colorPropertyName || !materialColor) return;
    beginMaterialUndoSession();
    mesh.material[colorPropertyName][channel] = value;
    setMaterialColor((c) => (c ? { ...c, [channel]: value } : c));
  };
  const updateMaterialAlpha = (value: number) => {
    if (!mesh?.material) return;
    beginMaterialUndoSession();
    mesh.material.alpha = value;
    setMaterialAlpha(value);
  };
  // "axis zero" - a quick way to zero out just one position/rotation axis instead of
  // clearing the number field by hand.
  const zeroPositionAxis = (axis: 'x' | 'y' | 'z') => updatePosition(axis, 0);
  const zeroRotationAxis = (axis: 'x' | 'y' | 'z') => updateRotation(axis, 0);
  // Resets position and rotation back to the origin (scale left alone - "reset" here means
  // "put it back where it was placed," not "undo any intentional resizing"). Pushes one
  // undo entry for the whole reset by flushing any pending session first, so Ctrl+Z
  // reverts it in a single step rather than three.
  const resetTransform = () => {
    if (!mesh) return;
    if (transformIdleTimerRef.current) clearTimeout(transformIdleTimerRef.current);
    if (!pendingTransformSnapshotRef.current) {
      pendingTransformSnapshotRef.current = {
        position: mesh.position.clone(),
        rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
        rotation: mesh.rotation.clone(),
        scaling: mesh.scaling.clone(),
      };
    }
    const snapshot = pendingTransformSnapshotRef.current;
    pendingTransformSnapshotRef.current = null;
    window.dispatchEvent(new CustomEvent('naviz:transformSnapshot', { detail: { mesh, ...snapshot } }));
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    if (mesh.rotationQuaternion) mesh.rotationQuaternion = null;
    setPosition({ x: 0, y: 0, z: 0 });
    setRotationDeg({ x: 0, y: 0, z: 0 });
  };

  // onZero renders a small "0" button next to the field - a one-click way to zero out just
  // that axis, for Position/Rotation only (a zero Scale would make the mesh disappear, so
  // Scale fields don't get one).
  const numberField = (label: string, value: number, onChange: (v: number) => void, onZero?: () => void) => (
    <label className="flex items-center gap-1 text-slate-400">
      {label}
      <input
        type="number"
        step={0.1}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-14 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-slate-200"
      />
      {onZero && (
        <button
          type="button"
          onClick={onZero}
          title={`Zero ${label} axis`}
          aria-label={`Zero ${label} axis`}
          className="w-4 h-4 flex items-center justify-center rounded text-[10px] text-slate-500 hover:text-white hover:bg-slate-700 border border-slate-700"
        >
          0
        </button>
      )}
    </label>
  );

  return (
    <Card ref={panelRef} style={panelStyle} className="fixed left-4 z-50 w-72 max-w-[90vw] bg-slate-800 border-slate-600 text-white">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">Property Inspector</CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {mesh ? (
          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-200 truncate">{mesh.name}</p>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={toggleVisible}>
                {visible ? 'Visible' : 'Hidden'}
              </Button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-500">Position</p>
                <button
                  type="button"
                  onClick={resetTransform}
                  title="Reset position and rotation to the origin"
                  className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 hover:bg-slate-700"
                >
                  Reset
                </button>
              </div>
              <div className="flex gap-2">
                {numberField('X', position.x, (v) => updatePosition('x', v), () => zeroPositionAxis('x'))}
                {numberField('Y', position.y, (v) => updatePosition('y', v), () => zeroPositionAxis('y'))}
                {numberField('Z', position.z, (v) => updatePosition('z', v), () => zeroPositionAxis('z'))}
              </div>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Rotation (°)</p>
              <div className="flex gap-2">
                {numberField('X', rotationDeg.x, (v) => updateRotation('x', v), () => zeroRotationAxis('x'))}
                {numberField('Y', rotationDeg.y, (v) => updateRotation('y', v), () => zeroRotationAxis('y'))}
                {numberField('Z', rotationDeg.z, (v) => updateRotation('z', v), () => zeroRotationAxis('z'))}
              </div>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Scale</p>
              <div className="flex gap-2">
                {numberField('X', scale.x, (v) => updateScale('x', v))}
                {numberField('Y', scale.y, (v) => updateScale('y', v))}
                {numberField('Z', scale.z, (v) => updateScale('z', v))}
              </div>
            </div>
            <p className="text-slate-400">Material: {mesh.material?.name || 'None'}</p>
            {materialColor && (
              <div>
                <p className="text-slate-500 mb-1">Material Color</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Material color"
                    value={`#${Math.round(materialColor.r * 255).toString(16).padStart(2, '0')}${Math.round(materialColor.g * 255).toString(16).padStart(2, '0')}${Math.round(materialColor.b * 255).toString(16).padStart(2, '0')}`}
                    onChange={(e) => {
                      const hex = e.target.value;
                      updateMaterialColor('r', parseInt(hex.slice(1, 3), 16) / 255);
                      updateMaterialColor('g', parseInt(hex.slice(3, 5), 16) / 255);
                      updateMaterialColor('b', parseInt(hex.slice(5, 7), 16) / 255);
                    }}
                    className="w-8 h-6 rounded border border-slate-600 bg-slate-900"
                  />
                  <label className="flex items-center gap-1 text-slate-400 flex-1">
                    Alpha
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={materialAlpha}
                      onChange={(e) => updateMaterialAlpha(parseFloat(e.target.value))}
                      className="flex-1"
                      aria-label="Material alpha"
                    />
                    <span className="w-8 text-right">{materialAlpha.toFixed(2)}</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-300 text-xs">Click a mesh in the scene to inspect its properties.</p>
        )}
        <p className="text-slate-500 text-xs pt-1">Objects: {meshCount} | Lights: {lightCount}</p>
      </CardContent>
    </Card>
  );
};

// Clicking a row selects that mesh (mirrors clicking it in the 3D view) and the eye icon
// toggles visibility - was a plain non-interactive name list despite being named/described as
// a scene *manager*.
const SceneBrowserPanel: React.FC<{ scene: any; selectedMesh: any; onSelect: (mesh: any) => void; onClose: () => void }> = ({ scene, selectedMesh, onSelect, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [, forceUpdate] = useState(0);
  const meshes = scene.meshes.filter((m: any) => !m.name.startsWith('__'));

  // Without this, the list only ever refreshed on a manual action inside this panel
  // (e.g. toggling visibility) - opening this panel, then loading/importing a model
  // while it stayed open, never showed the new meshes until the panel was closed and
  // reopened.
  useEffect(() => {
    const added = scene.onNewMeshAddedObservable.add(() => forceUpdate((n) => n + 1));
    const removed = scene.onMeshRemovedObservable.add(() => forceUpdate((n) => n + 1));
    return () => {
      scene.onNewMeshAddedObservable.remove(added);
      scene.onMeshRemovedObservable.remove(removed);
    };
  }, [scene]);

  const toggleVisible = (m: any, e: React.MouseEvent) => {
    e.stopPropagation();
    m.isVisible = !m.isVisible;
    forceUpdate((n) => n + 1);
  };

  return (
    <Card ref={panelRef} style={panelStyle} className="fixed right-4 z-50 w-72 max-w-[90vw] max-h-80 overflow-y-auto bg-slate-800 border-slate-600 text-white">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">Scene Browser</CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
          {meshes.slice(0, 20).map((m: any) => (
            <button
              key={m.uniqueId}
              type="button"
              onClick={() => onSelect(m)}
              className={`w-full flex items-center justify-between gap-2 p-1 rounded truncate text-left transition-colors ${
                selectedMesh?.uniqueId === m.uniqueId ? 'bg-cyan-600/40 border border-cyan-500/50' : 'bg-slate-700/50 hover:bg-slate-700'
              }`}
              title={m.name}
            >
              <span className="truncate">{m.name}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => toggleVisible(m, e)}
                className={`shrink-0 px-1 rounded ${m.isVisible ? 'text-slate-300' : 'text-slate-600'}`}
                title={m.isVisible ? 'Hide' : 'Show'}
              >
                {m.isVisible ? '👁' : '🚫'}
              </span>
            </button>
          ))}
          {meshes.length > 20 && (
            <p className="text-slate-500 text-xs">+ {meshes.length - 20} more</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const SimulationAnalysisSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'engineRef' | 'disableFeature' | 'workspaceState' | 'updateState' | 'onFloodToggle' | 'floodOn' | 'onFloodLevelChange' | 'onFloodWaveSpeedChange' | 'sustainabilityReport' | 'siteContextManagerRef' | 'geoSyncManagerRef' | 'moodSceneManagerRef' | 'audioManagerRef'>> = ({
  featureStates, sceneRef, engineRef, disableFeature, workspaceState, updateState, onFloodToggle, floodOn = false, onFloodLevelChange, onFloodWaveSpeedChange, sustainabilityReport, siteContextManagerRef, geoSyncManagerRef, moodSceneManagerRef, audioManagerRef
}) => {
  const floodFallbackPanel = usePanelStack('bottom-left');
  const windTunnelPanel = usePanelStack('top-right');
  return (
    <>
      {featureStates.showMultiSensoryPreview && sceneRef.current && (
        <Suspense fallback={null}>
          <MultiSensoryPanel
            moodSceneManager={moodSceneManagerRef?.current || null}
            audioManager={audioManagerRef?.current || null}
            onClose={() => disableFeature('showMultiSensoryPreview')}
          />
        </Suspense>
      )}
      {featureStates.showFloodSimulation && sceneRef.current && (
        <Suspense fallback={<div ref={floodFallbackPanel.ref} style={floodFallbackPanel.style} className="fixed left-4 z-50 w-80 max-w-[90vw] bg-slate-800 p-4 rounded">Loading Flood...</div>}>
          <FloodSimulation
            scene={sceneRef.current}
            isActive={featureStates.showFloodSimulation}
            onClose={() => { onFloodToggle?.(false); disableFeature('showFloodSimulation'); }}
            onFloodToggle={onFloodToggle}
            floodOn={floodOn}
            onWaterLevelChange={onFloodLevelChange}
            onWaveSpeedChange={onFloodWaveSpeedChange}
          />
        </Suspense>
      )}
      {featureStates.showPropertyInspector && sceneRef.current && (
        <PropertyInspectorPanel
          mesh={workspaceState?.selectedMesh}
          meshCount={sceneRef.current.meshes.length}
          lightCount={sceneRef.current.lights.length}
          onClose={() => disableFeature('showPropertyInspector')}
        />
      )}
      {featureStates.showSceneBrowser && sceneRef.current && (
        <SceneBrowserPanel
          scene={sceneRef.current}
          selectedMesh={workspaceState?.selectedMesh}
          onSelect={(mesh) => updateState({ selectedMesh: mesh })}
          onClose={() => disableFeature('showSceneBrowser')}
        />
      )}
      {featureStates.showSiteContextGenerator && sceneRef.current && (
        <Suspense fallback={null}>
          <SiteContextPanel
            siteContextManager={siteContextManagerRef?.current || null}
            geoSyncManager={geoSyncManagerRef?.current || null}
            onClose={() => disableFeature('showSiteContextGenerator')}
          />
        </Suspense>
      )}
      {featureStates.showSmartAlternatives && sceneRef.current && (
        <Suspense fallback={null}>
          <SmartAlternativesPanel
            selectedMesh={workspaceState?.selectedMesh}
            onClose={() => disableFeature('showSmartAlternatives')}
          />
        </Suspense>
      )}
      {featureStates.showSoundPrivacySimulation && sceneRef.current && engineRef.current && (
        <Suspense fallback={null}>
          <SoundPrivacyPanel
            scene={sceneRef.current}
            onClose={() => disableFeature('showSoundPrivacySimulation')}
          />
        </Suspense>
      )}
      {featureStates.showSustainabilityCompliancePanel && sceneRef.current && (
        <div className="fixed top-1/2 right-4 z-50 w-80 max-w-[90vw] bg-slate-800 p-4 rounded-lg border border-slate-600">
          <h3 className="text-white mb-2">Sustainability Compliance</h3>
          {sustainabilityReport ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Green Score</span>
                <span className={`font-technical font-semibold ${sustainabilityReport.greenScore >= 70 ? 'text-green-400' : sustainabilityReport.greenScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {sustainabilityReport.greenScore.toFixed(0)}/100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Compliance</span>
                <span className={sustainabilityReport.complianceStatus ? 'text-green-400' : 'text-red-400'}>
                  {sustainabilityReport.complianceStatus ? 'Compliant' : 'Non-compliant'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Carbon Footprint</span>
                <span className="font-technical text-slate-200">{sustainabilityReport.carbonFootprint.toFixed(1)} kg CO2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Water Footprint</span>
                <span className="font-technical text-slate-200">{sustainabilityReport.waterFootprint.toFixed(1)} L</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Energy Efficiency</span>
                <span className="font-technical text-slate-200">{sustainabilityReport.energyEfficiency.toFixed(0)}%</span>
              </div>
              {sustainabilityReport.recommendations.length > 0 && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="text-slate-400 mb-1">Recommendations</div>
                  <ul className="list-disc list-inside text-slate-300 space-y-1">
                    {sustainabilityReport.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="text-xs">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-300 text-sm">No model loaded yet - load a model to see its sustainability report.</p>
          )}
          <Button size="sm" variant="outline" onClick={() => disableFeature('showSustainabilityCompliancePanel')} className="mt-3">Close</Button>
        </div>
      )}
      {featureStates.showWindTunnelSimulation && sceneRef.current && (
        <Suspense fallback={<div ref={windTunnelPanel.ref} style={windTunnelPanel.style} className="fixed right-4 z-50 w-80 max-w-[90vw] bg-slate-800 p-4 rounded">Loading Wind...</div>}>
          <div ref={windTunnelPanel.ref} style={windTunnelPanel.style} className="fixed right-4 z-50 w-96 max-w-[90vw] max-h-[80vh] overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-4">
            <WindTunnelSimulation scene={sceneRef.current} />
            <div className="mt-3 pt-3 border-t border-slate-600">
              <Button size="sm" variant="outline" onClick={() => disableFeature('showWindTunnelSimulation')} className="w-full">Close</Button>
            </div>
          </div>
        </Suspense>
      )}
    </>
  );
};

// Additional sub-segment components for CustomPanels
const AdvancedFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'disableFeature' | 'scenarioManagerRef'>> = ({
  featureStates, sceneRef, disableFeature, scenarioManagerRef
}) => (
  <>
    {featureStates.showPresentationManager && sceneRef.current && (
      <Suspense fallback={null}>
        <ScenarioTourPanel
          scenarioManager={scenarioManagerRef?.current || null}
          title="Presentation Mode"
          autoStart
          onClose={() => disableFeature('showPresentationManager')}
        />
      </Suspense>
    )}
    {featureStates.showPresenterMode && sceneRef.current && (
      <Suspense fallback={null}>
        <ScenarioTourPanel
          scenarioManager={scenarioManagerRef?.current || null}
          title="Presenter Mode"
          autoStart
          onClose={() => disableFeature('showPresenterMode')}
        />
      </Suspense>
    )}
  </>
);

const AdditionalSimulationSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'disableFeature' | 'onRainToggle' | 'rainOn' | 'rainIntensity' | 'onRainIntensityChange' | 'onSnowToggle' | 'snowOn' | 'particleSize' | 'onParticleSizeChange'>> = ({
  featureStates, sceneRef, disableFeature, onRainToggle, rainOn = false, rainIntensity = 1, onRainIntensityChange,
  onSnowToggle, snowOn = false, particleSize = 1, onParticleSizeChange
}) => {
  const weatherPanel = usePanelStack('bottom-right');
  return (
  <>
    {featureStates.showWeather && sceneRef.current && (
      <Card ref={weatherPanel.ref} style={weatherPanel.style} className="fixed right-4 z-50 w-72 max-w-[90vw] bg-slate-800 border-slate-600 text-white pointer-events-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Weather</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => { onRainToggle?.(false); onSnowToggle?.(false); disableFeature('showWeather'); }}>Close</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300 text-sm">Rain</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={rainOn ? 'default' : 'outline'}
                onClick={() => { onSnowToggle?.(false); onRainToggle?.(true); }}
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={rainOn ? 'outline' : 'default'}
                onClick={() => onRainToggle?.(false)}
              >
                Off
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300 text-sm">Snow</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={snowOn ? 'default' : 'outline'}
                onClick={() => { onRainToggle?.(false); onSnowToggle?.(true); }}
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={snowOn ? 'outline' : 'default'}
                onClick={() => onSnowToggle?.(false)}
              >
                Off
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>Intensity (speed &amp; quantity)</span>
              <span className="font-technical text-cyan-300">{rainIntensity.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.1}
              value={rainIntensity}
              onChange={(e) => onRainIntensityChange?.(Number(e.target.value))}
              className="w-full"
              aria-label="Precipitation Intensity"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>Particle Size</span>
              <span className="font-technical text-cyan-300">{particleSize.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={particleSize}
              onChange={(e) => onParticleSizeChange?.(Number(e.target.value))}
              className="w-full"
              aria-label="Particle Size"
            />
          </div>
        </CardContent>
      </Card>
    )}
  </>
  );
};

const AIFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'aiManagerRef' | 'disableFeature' | 'sustainabilityManagerRef' | 'costEstimatorRef' | 'bimManagerRef' | 'currentModelId'>> = ({
  featureStates, sceneRef, aiManagerRef, disableFeature, sustainabilityManagerRef, costEstimatorRef, bimManagerRef, currentModelId
}) => (
  <>
    {featureStates.showAIAdvisor && sceneRef.current && aiManagerRef.current && (
      <Suspense fallback={null}>
        <AIAdvisorPanel
          sustainabilityManager={sustainabilityManagerRef?.current || null}
          costEstimator={costEstimatorRef?.current || null}
          bimManager={bimManagerRef?.current || null}
          modelId={currentModelId}
          onClose={() => disableFeature('showAIAdvisor')}
        />
      </Suspense>
    )}
  </>
);

const AnalysisFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'engineRef' | 'bimManagerRef' | 'simulationManagerRef' | 'currentModelId' | 'disableFeature' | 'workspaceState' | 'costEstimatorRef' | 'scenarioManagerRef' | 'sustainabilityManagerRef' | 'selectedWorkspaceId' | 'analyticsManagerRef' | 'iotManagerRef'>> = ({
  featureStates, sceneRef, engineRef, bimManagerRef, simulationManagerRef, currentModelId, disableFeature, workspaceState, costEstimatorRef, scenarioManagerRef, sustainabilityManagerRef, selectedWorkspaceId, analyticsManagerRef, iotManagerRef
}) => (
  <>
    {featureStates.showCost && sceneRef.current && (
      <Suspense fallback={<div>Loading Cost Estimator...</div>}>
        {/* bimManagerRef/simulationManagerRef weren't being passed here, so
            CostEstimatorWrapper fell back to creating its own empty BIMManager (see the
            component's own fallback) whose model registry never had the real loaded
            model registered - the project-wide "Total Cost" section stayed permanently
            blank even with a model loaded, while per-mesh selection cost (which doesn't
            depend on the registry) worked fine. */}
        <CostEstimatorWrapper
          scene={sceneRef.current}
          selectedMesh={workspaceState.selectedMesh}
          bimManager={bimManagerRef?.current ?? undefined}
          simulationManager={simulationManagerRef?.current ?? undefined}
        />
      </Suspense>
    )}
    {featureStates.showBeforeAfter && sceneRef.current && engineRef.current && (
      <Suspense fallback={null}>
        <BeforeAfterPanel
          scene={sceneRef.current}
          engine={engineRef.current}
          onClose={() => disableFeature('showBeforeAfter')}
        />
      </Suspense>
    )}
    {featureStates.showROICalculator && sceneRef.current && (
      <Suspense fallback={null}>
        <ROICalculatorPanel
          costEstimator={costEstimatorRef?.current || null}
          modelId={currentModelId}
          onClose={() => disableFeature('showROICalculator')}
        />
      </Suspense>
    )}
    {featureStates.showDesignReport && sceneRef.current && engineRef.current && (
      <Suspense fallback={null}>
        <DesignReportPanel
          scene={sceneRef.current}
          engine={engineRef.current}
          costEstimator={costEstimatorRef?.current || null}
          sustainabilityManager={sustainabilityManagerRef?.current || null}
          bimManager={bimManagerRef?.current || null}
          modelId={currentModelId}
          onClose={() => disableFeature('showDesignReport')}
        />
      </Suspense>
    )}
    {featureStates.showMobileHandoff && sceneRef.current && (
      <Suspense fallback={null}>
        <MobileHandoffPanel onClose={() => disableFeature('showMobileHandoff')} />
      </Suspense>
    )}
    {featureStates.showApproval && sceneRef.current && (
      <Suspense fallback={null}>
        {/* Was roomId={currentModelId} - a per-loaded-MODEL id ('default-model', or a
            local-<filename> slug), not the collaborative ROOM id the server's approval
            storage is actually keyed on (server/index.tsx). Every sibling room-scoped
            panel (VersionHistoryPanel, AnnotationTool above) uses selectedWorkspaceId;
            this one didn't, so approval history never correlated with the room's real
            saved scene/version history, and any two rooms happening to load the same
            model (or no model at all) would collide/share approval state. */}
        <ApprovalPanel roomId={selectedWorkspaceId || 'default-room'} onClose={() => disableFeature('showApproval')} />
      </Suspense>
    )}
    {featureStates.showWalkthroughRecorder && engineRef.current && (
      <Suspense fallback={null}>
        <WalkthroughRecorderPanel engine={engineRef.current} onClose={() => disableFeature('showWalkthroughRecorder')} />
      </Suspense>
    )}
    {featureStates.showBudgetTiers && sceneRef.current && (
      <Suspense fallback={null}>
        <BudgetTierPanel
          costEstimator={costEstimatorRef?.current || null}
          sustainabilityManager={sustainabilityManagerRef?.current || null}
          modelId={currentModelId}
          onClose={() => disableFeature('showBudgetTiers')}
        />
      </Suspense>
    )}
    {featureStates.showSessionInsights && (
      <Suspense fallback={null}>
        <SessionInsightsPanel
          analyticsManager={analyticsManagerRef?.current || null}
          onClose={() => disableFeature('showSessionInsights')}
        />
      </Suspense>
    )}
    {featureStates.showIoTPanel && (
      <Suspense fallback={null}>
        <IoTSensorsPanel
          iotManager={iotManagerRef?.current || null}
          onClose={() => disableFeature('showIoTPanel')}
        />
      </Suspense>
    )}
  </>
);

const SharingPanelContent: React.FC<{ onClose: () => void; currentModelId?: string }> = ({ onClose, currentModelId }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-left');
  const [copied, setCopied] = React.useState(false);
  const shareUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    // Only include a model reference if a real model is actually loaded - sharing the
    // 'default-model'/'local-...' placeholder id would be meaningless to the recipient.
    if (currentModelId && currentModelId !== 'default-model' && !currentModelId.startsWith('local-')) {
      url.searchParams.set('model', currentModelId);
    }
    return url.toString();
  }, [currentModelId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy share link:', error);
    }
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-50 w-80 max-w-[90vw] bg-slate-800 p-4 rounded-lg border border-slate-600">
      <h3 className="text-white mb-2">Share this workspace</h3>
      <p className="text-slate-400 text-xs mb-2">Anyone with this link (and access to this project) can open it.</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.target.select()}
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 font-technical"
        />
        <Button size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <Button size="sm" variant="outline" onClick={onClose} className="mt-3">Close</Button>
    </div>
  );
};

const ChatPanel = React.lazy(() => import('../ChatPanel'));

// collabManagerRef.current is assigned unconditionally at scene-init time, before connect()
// is ever called and regardless of whether it succeeds - so a plain truthiness check on the
// ref (the previous implementation) always read as "Connected", even offline / mid-connect /
// after a failed connection. getIsConnected() is the real socket state, but it's a plain
// class field the manager mutates internally (not React state), so it has to be polled to
// reflect updates - same pattern ChatPanel.tsx already uses for the same manager.
const MultiUserStatus: React.FC<{ collabManagerRef?: React.RefObject<any> }> = ({ collabManagerRef }) => {
  const [connected, setConnected] = useState(() => !!collabManagerRef?.current?.getIsConnected());
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    const poll = () => {
      const mgr = collabManagerRef?.current;
      setConnected(!!mgr?.getIsConnected());
      setParticipantCount(mgr ? mgr.getUsers().length + 1 : 0);
    };
    poll();
    const pollId = setInterval(poll, 1000);
    return () => clearInterval(pollId);
  }, [collabManagerRef]);

  if (!connected) return <>Connecting...</>;
  return <>Connected · {participantCount} participant{participantCount !== 1 ? 's' : ''}</>;
};

// "Who's here" roster - CollabManager already tracks every joined user (name, color,
// online state) via getUsers()/getCurrentUser(), fed by the real 'presence'/'people'
// socket events (see CollabManager.ts's registerServerEventHandlers) - this panel used to
// only show a bare participant COUNT with no names, even though the roster data behind it
// was already real and complete. Same polling pattern as MultiUserStatus above, since
// CollabManager's user map is a plain mutated field, not React state.
const PresenceRoster: React.FC<{ collabManagerRef?: React.RefObject<any> }> = ({ collabManagerRef }) => {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CollabUser | null>(null);

  useEffect(() => {
    const poll = () => {
      const mgr = collabManagerRef?.current;
      setUsers(mgr ? mgr.getUsers() : []);
      setCurrentUser(mgr ? mgr.getCurrentUser() : null);
    };
    poll();
    const pollId = setInterval(poll, 1500);
    return () => clearInterval(pollId);
  }, [collabManagerRef]);

  const entries = [
    ...(currentUser ? [{ user: currentUser, isYou: true }] : []),
    ...users.map((user) => ({ user, isYou: false })),
  ];

  if (entries.length === 0) {
    return <p className="text-slate-500 text-xs mt-2">No one here yet.</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
      {entries.map(({ user, isYou }) => (
        <li key={user.id} className="flex items-center gap-2 text-sm min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: user.color?.toHexString?.() ?? '#22d3ee' }}
            aria-hidden
          />
          <span className="text-slate-200 truncate">{user.name}{isYou ? ' (you)' : ''}</span>
          {!isYou && (
            <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${user.isOnline ? 'bg-green-400' : 'bg-slate-600'}`} title={user.isOnline ? 'Online' : 'Offline'} />
          )}
        </li>
      ))}
    </ul>
  );
};

// Voice chat itself (enableVoiceChat/getUserMedia/WebRTC) was always real - the gap was that
// once enabled there was no ongoing indicator that the mic was live, and no way to mute
// without disabling the whole feature. This panel gives it both.
const VoiceChatPanel: React.FC<{ collabManagerRef?: React.RefObject<any>; onClose: () => void }> = ({ collabManagerRef, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('bottom-left');
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    const next = !muted;
    collabManagerRef?.current?.setVoiceChatMuted(next);
    setMuted(next);
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600 w-60">
      <h3 className="text-white mb-2 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${muted ? 'bg-slate-500' : 'bg-red-500 animate-pulse'}`} />
        Voice Chat
      </h3>
      <p className="text-slate-300 text-sm">{muted ? 'Microphone muted' : 'Microphone live'}</p>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant={muted ? 'outline' : 'default'} onClick={toggleMute} className="flex-1">
          {muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};

const CollaborationFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'disableFeature' | 'collabManagerRef' | 'currentModelId'>> = ({
  featureStates, sceneRef, disableFeature, collabManagerRef, currentModelId
}) => {
  const multiUserPanel = usePanelStack('top-left');
  return (
  <>
    {featureStates.showMultiUser && sceneRef.current && (
      <div ref={multiUserPanel.ref} style={multiUserPanel.style} className="fixed left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600 w-64">
        <h3 className="text-white mb-2">Multi-User Collaboration</h3>
        <p className="text-slate-300 text-sm">
          <MultiUserStatus collabManagerRef={collabManagerRef} />
        </p>
        <PresenceRoster collabManagerRef={collabManagerRef} />
        <p className="text-slate-500 text-xs mt-2">Open Chat or Sharing from the feature list to interact.</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showMultiUser')} className="mt-2">Close</Button>
      </div>
    )}
    {featureStates.showChat && sceneRef.current && (
      <React.Suspense fallback={null}>
        <ChatPanel
          collabManager={collabManagerRef?.current || null}
          onClose={() => disableFeature('showChat')}
        />
      </React.Suspense>
    )}
    {featureStates.showSharing && sceneRef.current && (
      <SharingPanelContent onClose={() => disableFeature('showSharing')} currentModelId={currentModelId} />
    )}
    {featureStates.showVoiceChat && sceneRef.current && (
      <VoiceChatPanel collabManagerRef={collabManagerRef} onClose={() => disableFeature('showVoiceChat')} />
    )}
  </>
  );
};

const ImmersiveFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'disableFeature' | 'audioManagerRef'>> = ({
  featureStates, sceneRef, disableFeature, audioManagerRef
}) => {
  const vrPanel = usePanelStack('top-left');
  const arPanel = usePanelStack('top-right');
  const hapticPanel = usePanelStack('bottom-right');
  return (
  <>
    {featureStates.showVR && sceneRef.current && (
      <div ref={vrPanel.ref} style={vrPanel.style} className="fixed left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">VR Mode</h3>
        <p className="text-slate-300 text-sm">VR mode active</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showVR')} className="mt-2">Close</Button>
      </div>
    )}
    {featureStates.showAR && sceneRef.current && (
      <div ref={arPanel.ref} style={arPanel.style} className="fixed right-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">AR Mode</h3>
        <p className="text-slate-300 text-sm">AR mode active</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showAR')} className="mt-2">Close</Button>
      </div>
    )}
    {featureStates.showSpatialAudio && sceneRef.current && (
      <Suspense fallback={null}>
        <SpatialAudioPanel
          audioManager={audioManagerRef?.current || null}
          onClose={() => disableFeature('showSpatialAudio')}
        />
      </Suspense>
    )}
    {featureStates.showHaptic && sceneRef.current && (
      <div ref={hapticPanel.ref} style={hapticPanel.style} className="fixed right-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">Haptic Feedback</h3>
        <p className="text-slate-300 text-sm">Haptic feedback active</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showHaptic')} className="mt-2">Close</Button>
      </div>
    )}
  </>
  );
};

const GeoFeaturesSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'disableFeature'>> = ({
  featureStates, sceneRef, disableFeature
}) => {
  const geoSyncPanel = usePanelStack('bottom-left');
  return (
  <>
    {featureStates.showGeoLocation && sceneRef.current && (
      <Suspense fallback={<div>Loading Geo Location...</div>}>
        <GeoLocationContext scene={sceneRef.current} onClose={() => disableFeature('showGeoLocation')} />
      </Suspense>
    )}
    {featureStates.showGeoSync && sceneRef.current && (
      <div ref={geoSyncPanel.ref} style={geoSyncPanel.style} className="fixed left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">Geo Sync</h3>
        <p className="text-slate-300 text-sm">Geo sync active</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showGeoSync')} className="mt-2">Close</Button>
      </div>
    )}
  </>
  );
};

const SpecializedComponentsSegment: React.FC<Pick<CustomPanelsSegmentProps, 'featureStates' | 'sceneRef' | 'cameraRef' | 'engineRef' | 'simulationManagerRef' | 'presentationManagerRef' | 'disableFeature' | 'enableFeature' | 'gestureHistory' | 'onDomainChange'>> = ({
  featureStates, sceneRef, cameraRef, engineRef, simulationManagerRef, presentationManagerRef, disableFeature, enableFeature, gestureHistory, onDomainChange
}) => {
  const collabManagerPanel = usePanelStack('top-left');
  return (
  <>
    {featureStates.showCollabManager && sceneRef.current && (
      <div ref={collabManagerPanel.ref} style={collabManagerPanel.style} className="fixed left-4 z-50 bg-slate-800 p-4 rounded-lg border border-slate-600">
        <h3 className="text-white mb-2">Collaboration Manager</h3>
        <p className="text-slate-300 text-sm">Collaboration manager active</p>
        <Button size="sm" variant="outline" onClick={() => disableFeature('showCollabManager')} className="mt-2">Close</Button>
      </div>
    )}
    {featureStates.showDomainSelector && (
      <DomainSelectorOverlay
        visible
        onClose={() => disableFeature('showDomainSelector')}
        onDomainChange={onDomainChange}
      />
    )}
    {featureStates.showGestureInspector && (
      <GestureInspectorOverlay
        visible
        onClose={() => disableFeature('showGestureInspector')}
        realHistory={gestureHistory}
        isDetectionActive={!!featureStates.showGestureDetection}
      />
    )}
    {featureStates.showKeyboardShortcuts && (
      <KeyboardShortcutsHelp
        visible
        onClose={() => disableFeature('showKeyboardShortcuts')}
      />
    )}
    {featureStates.showMoodLighting && sceneRef.current && (
      <Suspense fallback={null}>
        <MoodLightingPanel
          presentationManager={presentationManagerRef?.current || null}
          onClose={() => disableFeature('showMoodLighting')}
        />
      </Suspense>
    )}
  </>
  );
};

// Props interfaces for render functions
interface RenderLeftPanelProps {
  featureCategories: Record<string, any[]>;
  categoryPanelVisible: Record<string, boolean>;
  searchTerm: string;
  activeFeatures: Set<string>;
  layoutMode: 'standard' | 'compact' | 'immersive' | 'split';
  onCategoryToggle: (category: string) => void;
  onToggleAllCategories?: (visible: boolean) => void;
  setSearchTerm: (term: string) => void;
  handleFeatureToggle: (featureId: string | number, enabled: boolean) => void;
  handleCategoryToggle: (category: string) => void;
  updateState: (updates: any) => void;
  setLeftPanelVisible: (visible: boolean) => void;
  aiManagerRef?: React.RefObject<any>;
  bimManagerRef?: React.RefObject<any>;
}

interface RenderTopBarProps {
  fps: number;
  activeFeatures: Set<string>;
  topBarVisible?: boolean;
  onToggleTopBar?: () => void;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  cameraMode: 'orbit' | 'fly' | 'walk' | undefined;
  viewMode?: 'walk' | 'orbit' | 'dollhouse' | 'vr' | 'ar';
  workspaceId?: string;
  handleCameraModeChange: (mode: 'orbit' | 'fly' | 'walk' | undefined) => void;
  onViewModeChange?: (mode: 'walk' | 'orbit' | 'dollhouse' | 'vr' | 'ar') => void;
  onImport?: () => void;
  onExport?: () => void;
  onScreenshot?: (format?: 'png' | 'jpeg') => void;
  onAutoZoom?: () => void;
  onHelp?: () => void;
  onShare?: () => void;
}

interface RenderRightPanelProps {
  workspaceState: { rightPanelVisible: boolean; selectedMesh: any };
  updateState: (updates: any) => void;
  bimManagerRef: React.RefObject<any>;
  simulationManagerRef: React.RefObject<any>;
  currentModelId: string;
}

interface RenderBottomPanelProps {
  workspaceState: { bottomPanelVisible: boolean };
  activeFeatures: Set<string>;
  performanceMode: 'low' | 'medium' | 'high';
  selectedMesh: any;
  handleFeatureToggle: (featureId: string | number, enabled: boolean) => void;
  setPerformanceMode: (mode: 'low' | 'medium' | 'high') => void;
  handleTourSequenceCreate: (sequence: any) => void;
  handleTourSequencePlay: (sequenceId: string) => void;
  // The real AnimationManager instance (BabylonWorkspace.tsx's animationManagerRef) - the
  // Timeline tab used to always get a hardcoded null here regardless of this being
  // available, leaving its play/sequence controls permanently non-functional.
  animationManagerRef?: React.RefObject<import('../AnimationManager').AnimationManager | null>;
}

interface RenderFloatingToolbarProps {
  workspaceState: { showFloatingToolbar: boolean; cameraActive: boolean; perspectiveActive: boolean };
  updateState: (updates: any) => void;
  transformMode: 'none' | 'position' | 'rotation' | 'scale';
  setTransformMode: (updater: (m: 'none' | 'position' | 'rotation' | 'scale') => 'none' | 'position' | 'rotation' | 'scale') => void;
}

interface RenderCustomPanelsProps {
  featureStates: Record<string, boolean>;
  sceneRef: React.RefObject<any>;
  engineRef: React.RefObject<any>;
  cameraRef: React.RefObject<any>;
  bimManagerRef: React.RefObject<any>;
  analyticsManagerRef: React.RefObject<any>;
  presentationManagerRef: React.RefObject<any>;
  iotManagerRef: React.RefObject<any>;
  simulationManagerRef: React.RefObject<any>;
  aiManagerRef: React.RefObject<any>;
  collabManagerRef: React.RefObject<any>;
  siteContextManagerRef: React.RefObject<any>;
  geoSyncManagerRef: React.RefObject<any>;
  costEstimatorRef: React.RefObject<any>;
  scenarioManagerRef: React.RefObject<any>;
  moodSceneManagerRef: React.RefObject<any>;
  animationManagerRef: React.RefObject<any>;
  sustainabilityManagerRef: React.RefObject<any>;
  audioManagerRef: React.RefObject<any>;
  cloudAnchorManagerRef: React.RefObject<any>;
  arCloudAnchorsRef: React.RefObject<any>;
  gpsTransformUtilsRef: React.RefObject<any>;
  xrManagerRef: React.RefObject<any>;
  gestureHistory: { gesture: string; confidence: number; timestamp: number }[];
  onDomainChange?: (domainId: string) => void;
  currentModelId: string;
  workspaces: any[];
  selectedWorkspaceId: string;
  handleWorkspaceSelect: (id: string) => void;
  handleMaterialApplied: (mesh: any, material: any) => void;
  handleAnimationCreate: (sequence: any) => void;
  handleSequencePlay: (sequenceId: string, options?: any) => void;
  handleTourSequenceCreate: (sequence: any) => void;
  handleTourSequencePlay: (sequenceId: string) => void;
  disableFeature: (id: string) => void;
  enableFeature: (id: string) => void;
  onRainToggle?: (on: boolean) => void;
  rainOn?: boolean;
  rainIntensity?: number;
  onRainIntensityChange?: (v: number) => void;
  onSnowToggle?: (on: boolean) => void;
  snowOn?: boolean;
  particleSize?: number;
  onParticleSizeChange?: (v: number) => void;
  onFloodToggle?: (on: boolean) => void;
  floodOn?: boolean;
  onFloodLevelChange?: (level: number) => void;
  onFloodWaveSpeedChange?: (speed: number) => void;
  workspaceState: { selectedMesh: any };
  updateState: (updates: any) => void;
  graphicsQuality?: CustomPanelsSegmentProps['graphicsQuality'];
  setGraphicsQuality?: CustomPanelsSegmentProps['setGraphicsQuality'];
  recommendedQuality?: CustomPanelsSegmentProps['recommendedQuality'];
  gpuName?: string;
  deviceCapabilities?: any;
  sustainabilityReport?: CustomPanelsSegmentProps['sustainabilityReport'];
}

// Render functions - use LeftPanel for full category/feature support
export const renderLeftPanel = (props: RenderLeftPanelProps) => (
  <React.Suspense fallback={<div className="p-4">Loading Left Panel...</div>}>
    <LeftPanel
      featureCategories={props.featureCategories}
      categoryPanelVisible={props.categoryPanelVisible}
      searchTerm={props.searchTerm}
      activeFeatures={props.activeFeatures}
      currentLayoutMode={props.layoutMode === 'split' ? 'standard' : props.layoutMode}
      onCategoryToggle={props.handleCategoryToggle}
      onToggleAllCategories={props.onToggleAllCategories}
      onSearchChange={props.setSearchTerm}
      onFeatureToggle={props.handleFeatureToggle}
      onClose={() => props.setLeftPanelVisible(false)}
      aiManagerRef={props.aiManagerRef}
      bimManagerRef={props.bimManagerRef}
    />
  </React.Suspense>
);

export const renderTopBar = (props: RenderTopBarProps) => (
  <React.Suspense fallback={<div className="p-2">Loading Top Bar...</div>}>
    <SimpleWorkspaceTopBar
      fps={props.fps}
      activeFeatures={props.activeFeatures.size}
      topBarVisible={props.topBarVisible}
      onToggleTopBar={props.onToggleTopBar}
      leftPanelVisible={props.leftPanelVisible}
      rightPanelVisible={props.rightPanelVisible}
      onToggleLeftPanel={props.onToggleLeftPanel}
      onToggleRightPanel={props.onToggleRightPanel}
      cameraMode={props.cameraMode ?? 'orbit'}
      viewMode={props.viewMode ?? 'orbit'}
      workspaceId={props.workspaceId}
      onCameraModeChange={(m) => props.handleCameraModeChange(m)}
      onViewModeChange={props.onViewModeChange}
      onImport={props.onImport}
      onExport={props.onExport}
      onScreenshot={props.onScreenshot}
      onAutoZoom={props.onAutoZoom}
      onHelp={props.onHelp}
    />
  </React.Suspense>
);

export const renderRightPanel = (props: RenderRightPanelProps) => {
  if (!props.workspaceState.rightPanelVisible) return null;
  return (
    <div className="absolute inset-y-0 right-0 z-30 w-[85vw] max-w-[320px] sm:relative sm:z-auto sm:w-80 sm:max-w-none border-l border-gray-700 bg-gray-900 text-white h-full overflow-y-auto shadow-2xl sm:shadow-none">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inspector</h2>
        <Button size="sm" variant="ghost" aria-label="Close Right Panel" onClick={() => props.updateState({ rightPanelVisible: false })}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>Object Properties</CardTitle>
            </CardHeader>
            <CardContent>
              {props.workspaceState.selectedMesh ? (
                <div className="space-y-2">
                  <div><strong>Name:</strong> {props.workspaceState.selectedMesh.name}</div>
                  <div><strong>Position:</strong> {props.workspaceState.selectedMesh.position.toString()}</div>
                  <div><strong>Rotation:</strong> {props.workspaceState.selectedMesh.rotation.toString()}</div>
                  <div><strong>Scale:</strong> {props.workspaceState.selectedMesh.scaling.toString()}</div>
                </div>
              ) : (
                <p className="text-muted-foreground">No object selected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="features" className="p-4">
          <div className="text-muted-foreground">
            Feature management is handled through the left panel.
          </div>
        </TabsContent>
        <TabsContent value="energy" className="p-4">
          {props.bimManagerRef.current && props.simulationManagerRef.current && (
            <EnergyDashboard
              bimManager={props.bimManagerRef.current}
              simulationManager={props.simulationManagerRef.current}
              modelId={String(props.currentModelId)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const renderBottomPanel = (props: RenderBottomPanelProps) => {
  if (!props.workspaceState.bottomPanelVisible) return null;
  return (
    <React.Suspense fallback={<div className="p-2">Loading Bottom Panel...</div>}>
      <BottomPanel
        activeFeatures={Array.from(props.activeFeatures)}
        performanceMode={props.performanceMode}
        selectedMesh={props.selectedMesh}
        onFeatureToggle={(featureId: string) => props.handleFeatureToggle(featureId, false)}
        onPerformanceModeChange={props.setPerformanceMode}
        featureStats={{ total: 0, active: 0, byCategory: {}, byStatus: {} }}
        warnings={[]}
        suggestions={[]}
        onSequenceCreate={props.handleTourSequenceCreate}
        onSequencePlay={props.handleTourSequencePlay}
        animationManager={props.animationManagerRef?.current ?? null}
      />
    </React.Suspense>
  );
};

export const renderFloatingToolbar = (props: RenderFloatingToolbarProps) => {
  if (!props.workspaceState.showFloatingToolbar) return null;
  // Move/Rotate/Scale here drive the same transformMode-based GizmoManager as the bottom
  // selection toolbar and the g/r/s hotkeys - they used to drive a separate moveActive/
  // rotateActive/scaleActive PointerDragBehavior system instead, which could be independently
  // active on the same mesh at the same time as the gizmo (e.g. press 'g' for the gizmo, then
  // also click Move here), producing two conflicting drag handlers on one mesh at once.
  return (
    <React.Suspense fallback={<div className="p-2">Loading Toolbar...</div>}>
      <div className="absolute top-4 left-4 z-40 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl p-2 pointer-events-auto">
        <FloatingToolbar
          onMoveToggle={() => props.setTransformMode((m) => m === 'position' ? 'none' : 'position')}
          onRotateToggle={() => props.setTransformMode((m) => m === 'rotation' ? 'none' : 'rotation')}
          onScaleToggle={() => props.setTransformMode((m) => m === 'scale' ? 'none' : 'scale')}
          onCameraToggle={() => props.updateState({ cameraActive: !props.workspaceState.cameraActive })}
          onPerspectiveToggle={() => props.updateState({ perspectiveActive: !props.workspaceState.perspectiveActive })}
          isMoveActive={props.transformMode === 'position'}
          isRotateActive={props.transformMode === 'rotation'}
          isScaleActive={props.transformMode === 'scale'}
          isCameraActive={props.workspaceState.cameraActive}
          isPerspectiveActive={props.workspaceState.perspectiveActive}
        />
      </div>
    </React.Suspense>
  );
};

export const renderCustomPanels = (props: RenderCustomPanelsProps) => (
  <CustomPanelsSegment {...props} />
);
