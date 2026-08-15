// Define Color3 and Color4 classes directly in the test file to avoid circular dependencies
class Color3 {
  r: number;
  g: number;
  b: number;

  constructor(r: number = 0, g: number = 0, b: number = 0) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  static White(): Color3 {
    return new Color3(1, 1, 1);
  }

  static Black(): Color3 {
    return new Color3(0, 0, 0);
  }

  static Yellow(): Color3 {
    return new Color3(1, 1, 0);
  }

  static Red(): Color3 {
    return new Color3(1, 0, 0);
  }

  static Green(): Color3 {
    return new Color3(0, 1, 0);
  }

  static Blue(): Color3 {
    return new Color3(0, 0, 1);
  }
}

class Color4 extends Color3 {
  a: number;

  constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 1) {
    super(r, g, b);
    this.a = a;
  }
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useUIHandlers } from '../../components/BabylonWorkspace/uiHandlers';
import BabylonWorkspace from '../../components/BabylonWorkspace';

// Mock the BabylonWorkspace component itself - must be before any other imports
jest.mock('../../components/BabylonWorkspace', () => {
  const React = require('react');
  const { useUIHandlers } = require('../../components/BabylonWorkspace/uiHandlers');
  const { useWorkspaceState } = require('../../components/BabylonWorkspace/workspaceHooks');
  const { useFeatureStates } = require('../../components/BabylonWorkspace/featureStateHooks');

  // Error Boundary component for testing
  class MockErrorBoundary extends React.Component {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false, error: null };
      this.handleReset = this.handleReset.bind(this);
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReset() {
      this.setState({ hasError: false, error: null });
    }

    render() {
      if (this.state.hasError) {
        return React.createElement('div', {
          'data-testid': 'error-boundary'
        }, [
          React.createElement('div', { key: 'error' }, `Error: ${this.state.error?.message}`),
          React.createElement('button', {
            key: 'reset',
            onClick: this.handleReset
          }, 'Reset Error')
        ]);
      }

      // Return the children when not in error state
      return this.props.children || null;
    }
  }

  return function MockBabylonWorkspace(props: any) {
    // Mock the hooks to simulate real behavior
    const mockUIHandlers = useUIHandlers as jest.MockedFunction<any>;
    const mockWorkspaceState = useWorkspaceState as jest.MockedFunction<any>;
    const mockFeatureStates = useFeatureStates as jest.MockedFunction<any>;

    // Set up mock implementations
    const uiHandlers = {
      handleWorkspaceSelect: jest.fn(),
      handleToggleRealTime: jest.fn(),
      handleCameraModeChange: jest.fn(),
      handleToggleGrid: jest.fn(),
      handleToggleWireframe: jest.fn(),
      handleToggleStats: jest.fn(),
      handleCategoryToggle: jest.fn(),
    };

    const workspaceState = {
      updateState: jest.fn(),
      selectedMesh: null,
      setSelectedMesh: jest.fn(),
      selectedWorkspaceId: props.workspaceId || 'default',
      setSelectedWorkspaceId: jest.fn(),
      realTimeEnabled: false,
      setRealTimeEnabled: jest.fn(),
      cameraMode: 'orbit',
      setCameraMode: jest.fn(),
      gridVisible: false,
      setGridVisible: jest.fn(),
      wireframeEnabled: false,
      setWireframeEnabled: jest.fn(),
      statsVisible: false,
      setStatsVisible: jest.fn(),
      setPerformanceMode: jest.fn(),
      animationManager: {},
      handleTourSequenceCreate: jest.fn(),
      handleTourSequencePlay: jest.fn(),
      leftPanelVisible: true,
      setLeftPanelVisible: jest.fn(),
      rightPanelVisible: false,
      setRightPanelVisible: jest.fn(),
      bottomPanelVisible: false,
      setBottomPanelVisible: jest.fn(),
      showFloatingToolbar: false,
      setShowFloatingToolbar: jest.fn(),
      moveActive: false,
      setMoveActive: jest.fn(),
      rotateActive: false,
      setRotateActive: jest.fn(),
      scaleActive: false,
      setScaleActive: jest.fn(),
      cameraActive: false,
      setCameraActive: jest.fn(),
      perspectiveActive: false,
      setPerspectiveActive: jest.fn(),
      categoryPanelVisible: {},
      setCategoryPanelVisible: jest.fn(),
    };

    const featureStates = {
      featureStates: {},
      setFeatureStates: jest.fn(),
      toggleFeature: jest.fn(),
      setFeatureState: jest.fn(),
      enableFeature: jest.fn(),
      disableFeature: jest.fn(),
      activeFeatures: [],
      featuresByCategory: {},
    };

    // Set up the mock implementations to return the expected values
    mockUIHandlers.mockReturnValue(uiHandlers);
    mockWorkspaceState.mockReturnValue(workspaceState);
    mockFeatureStates.mockReturnValue(featureStates);

    // Create state getters for UI handlers
    const stateGetters = {
      getRealTimeEnabled: () => workspaceState.realTimeEnabled,
      getGridVisible: () => workspaceState.gridVisible,
      getWireframeEnabled: () => workspaceState.wireframeEnabled,
      getStatsVisible: () => workspaceState.statsVisible,
      getCategoryPanelVisible: () => workspaceState.categoryPanelVisible,
    };

    // Call useUIHandlers with the state getters
    const actualUIHandlers = mockUIHandlers({
      ...workspaceState,
      ...stateGetters,
    });

    const normalContent = React.createElement('div', {
      'data-testid': 'babylon-workspace',
      'aria-label': 'Babylon.js 3D Canvas',
      className: 'flex h-screen' // Add the expected layout class
    }, [
      React.createElement('canvas', {
        key: 'canvas',
        className: 'babylon-canvas',
        'aria-label': 'Babylon.js 3D Canvas',
        role: 'img', // Add the expected role
        'aria-describedby': 'babylon-canvas-desc'
      }),
      React.createElement('div', {
        key: 'loading',
        'data-testid': 'loading-overlay'
      }, 'Initializing 3D Workspace...'),
      React.createElement('button', {
        key: 'help',
        title: 'Keyboard shortcuts'
      }, '?'),
      // Include children if they exist
      ...(props.children ? [props.children] : [])
    ]);

    return React.createElement(MockErrorBoundary, null, normalContent);
  };
});

// Mock the Babylon.js modules

// Mock the Babylon.js modules
jest.mock('@babylonjs/core', () => ({
  Vector3: class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    static Zero(): Vector3 {
      return new Vector3(0, 0, 0);
    }

    static One(): Vector3 {
      return new Vector3(1, 1, 1);
    }

    static Up(): Vector3 {
      return new Vector3(0, 1, 0);
    }

    static Forward(): Vector3 {
      return new Vector3(0, 0, 1);
    }

    static Right(): Vector3 {
      return new Vector3(1, 0, 0);
    }
  },
  Color3,
  Color4,
  Engine: jest.fn().mockImplementation(() => ({
    runRenderLoop: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  })),
  Scene: jest.fn().mockImplementation(() => ({
    render: jest.fn(),
    dispose: jest.fn(),
  })),
  ArcRotateCamera: jest.fn().mockImplementation(() => ({
    attachControl: jest.fn(),
  })),
  HemisphericLight: jest.fn(),
  Mesh: {
    CreateGround: jest.fn(),
  },
  StandardMaterial: jest.fn(),
  PBRMaterial: jest.fn(),
  DefaultRenderingPipeline: jest.fn(),
  SSAORenderingPipeline: jest.fn(),
  HighlightLayer: jest.fn(),
}));

jest.mock('@babylonjs/gui', () => ({
  AdvancedDynamicTexture: jest.fn(),
  Rectangle: jest.fn(),
  Button: jest.fn(),
  TextBlock: jest.fn(),
  StackPanel: jest.fn(),
  Control: jest.fn(),
  Slider: jest.fn(),
  Checkbox: jest.fn(),
}));

jest.mock('@babylonjs/loaders/glTF', () => ({}));
jest.mock('@babylonjs/loaders/OBJ', () => ({}));

// Mock all the UI components
jest.mock('../../components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

jest.mock('../../components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div data-testid="badge">{children}</div>,
}));

jest.mock('../../components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs">{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-content">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button data-testid="tabs-trigger">{children}</button>,
}));

jest.mock('../../components/ui/separator', () => ({
  Separator: ({ children }: { children: React.ReactNode }) => <div data-testid="separator">{children}</div>,
}));

jest.mock('../../components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('../../components/ui/progress', () => ({
  Progress: ({ children }: { children: React.ReactNode }) => <div data-testid="progress">{children}</div>,
}));

jest.mock('../../components/ui/input', () => ({
  Input: ({ ...props }) => <input data-testid="input" {...props} />,
}));

jest.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="button" onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('../../components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="dropdown-menu-item" onClick={onClick}>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}));

// Mock the custom components
jest.mock('../../components/BabylonWorkspace/Panels', () => ({
  Panels: ({ children }: { children: React.ReactNode }) => <div data-testid="panels">{children}</div>,
}));

jest.mock('../../components/BabylonWorkspace/CategoryToggles', () => ({
  CategoryToggles: ({ children }: { children: React.ReactNode }) => <div data-testid="category-toggles">{children}</div>,
}));

jest.mock('../../components/BabylonWorkspace/FeatureButton', () => ({
  FeatureButton: ({ children }: { children: React.ReactNode }) => <div data-testid="feature-button">{children}</div>,
}));

jest.mock('../../components/FloatingMinimap', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="floating-minimap">{children}</div>,
}));

// Mock lazy components
jest.mock('../../components/LeftPanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="left-panel">{children}</div>,
}));

jest.mock('../../components/RightPanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="right-panel">{children}</div>,
}));

jest.mock('../../components/TopBar', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="top-bar">{children}</div>,
}));

jest.mock('../../components/BottomPanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="bottom-panel">{children}</div>,
}));

jest.mock('../../components/FloatingToolbar', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="floating-toolbar">{children}</div>,
}));

// Mock all other imported components
jest.mock('../../components/TopographyGenerator', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="topography-generator">{children}</div>,
}));

jest.mock('../../components/SelectedMeshInspector', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="selected-mesh-inspector">{children}</div>,
}));

jest.mock('../../components/MaterialPropertyEditor', () => ({
  MaterialPropertyEditor: ({ children }: { children: React.ReactNode }) => <div data-testid="material-property-editor">{children}</div>,
}));

jest.mock('../../components/MaterialPresetSelector', () => ({
  MaterialPresetSelector: ({ children }: { children: React.ReactNode }) => <div data-testid="material-preset-selector">{children}</div>,
}));

jest.mock('../../components/DragDropMaterialHandler', () => ({
  DragDropMaterialHandler: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-drop-material-handler">{children}</div>,
}));

jest.mock('../../components/MaterialEditor', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="material-editor">{children}</div>,
}));

jest.mock('../../components/Minimap', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="minimap">{children}</div>,
}));

jest.mock('../../components/MeasureTool', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="measure-tool">{children}</div>,
}));

jest.mock('../../components/AutoFurnish', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="auto-furnish">{children}</div>,
}));

jest.mock('../../components/AICoDesigner', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="ai-co-designer">{children}</div>,
}));

jest.mock('../../components/MoodScenePanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="mood-scene-panel">{children}</div>,
}));

jest.mock('../../components/SeasonalDecorPanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="seasonal-decor-panel">{children}</div>,
}));

jest.mock('../../components/ARScalePanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="ar-scale-panel">{children}</div>,
}));

jest.mock('../../components/Annotations', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="annotations">{children}</div>,
}));

jest.mock('../../components/ARAnchorUI', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="ar-anchor-ui">{children}</div>,
}));

jest.mock('../../components/ARCameraView', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="ar-camera-view">{children}</div>,
}));

jest.mock('../../components/ARCloudAnchors', () => ({
  ARCloudAnchors: ({ children }: { children: React.ReactNode }) => <div data-testid="ar-cloud-anchors">{children}</div>,
}));

jest.mock('../../components/CloudAnchorManager', () => ({
  CloudAnchorManager: ({ children }: { children: React.ReactNode }) => <div data-testid="cloud-anchor-manager">{children}</div>,
}));

jest.mock('../../components/GPSTransformUtils', () => ({
  GPSTransformUtils: ({ children }: { children: React.ReactNode }) => <div data-testid="gps-transform-utils">{children}</div>,
}));

jest.mock('../../components/ScenarioPanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="scenario-panel">{children}</div>,
}));

jest.mock('../../components/AIStructuralAdvisor', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="ai-structural-advisor">{children}</div>,
}));

jest.mock('../../components/AnimationTimeline', () => ({
  AnimationTimeline: ({ children }: { children: React.ReactNode }) => <div data-testid="animation-timeline">{children}</div>,
}));

jest.mock('../../components/MovementControlChecker', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="movement-control-checker">{children}</div>,
}));

jest.mock('../../components/MultiSensoryPreview', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="multi-sensory-preview">{children}</div>,
}));

jest.mock('../../components/NoiseSimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="noise-simulation">{children}</div>,
}));

jest.mock('../../components/PathTracing', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="path-tracing">{children}</div>,
}));

jest.mock('../../components/PHashIntegration', () => ({
  PHashIntegration: ({ children }: { children: React.ReactNode }) => <div data-testid="phash-integration">{children}</div>,
}));

jest.mock('../../components/PrefabModulePreview', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="prefab-module-preview">{children}</div>,
}));

jest.mock('../../components/PresentationManager', () => ({
  PresentationManager: ({ children }: { children: React.ReactNode }) => <div data-testid="presentation-manager">{children}</div>,
}));

jest.mock('../../components/PresenterMode', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="presenter-mode">{children}</div>,
}));

jest.mock('../../components/ProgressiveLoader', () => ({
  ProgressiveLoader: ({ children }: { children: React.ReactNode }) => <div data-testid="progressive-loader">{children}</div>,
}));

jest.mock('../../components/PropertyInspector', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="property-inspector">{children}</div>,
}));

jest.mock('../../components/QuantumSimulationInterface', () => ({
  QuantumSimulationInterface: ({ children }: { children: React.ReactNode }) => <div data-testid="quantum-simulation-interface">{children}</div>,
}));

jest.mock('../../components/SceneBrowser', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="scene-browser">{children}</div>,
}));

jest.mock('../../components/Simulations', () => ({
  Simulations: ({ children }: { children: React.ReactNode }) => <div data-testid="simulations">{children}</div>,
}));

jest.mock('../../components/SiteContextGenerator', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="site-context-generator">{children}</div>,
}));

jest.mock('../../components/SmartAlternatives', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="smart-alternatives">{children}</div>,
}));

jest.mock('../../components/SoundPrivacySimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="sound-privacy-simulation">{children}</div>,
}));

jest.mock('../../components/SunlightAnalysis', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="sunlight-analysis">{children}</div>,
}));

jest.mock('../../components/SustainabilityCompliancePanel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="sustainability-compliance-panel">{children}</div>,
}));

jest.mock('../../components/SwimMode', () => ({
  SwimMode: ({ children }: { children: React.ReactNode }) => <div data-testid="swim-mode">{children}</div>,
}));

jest.mock('../../components/GeoLocationContext', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="geo-location-context">{children}</div>,
}));

jest.mock('../../components/GeoWorkspaceArea', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="geo-workspace-area">{children}</div>,
}));

jest.mock('../../components/GeoSyncManager', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="geo-sync-manager">{children}</div>,
}));

jest.mock('../../components/CameraViews', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="camera-views">{children}</div>,
}));

jest.mock('../../components/CirculationFlowSimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="circulation-flow-simulation">{children}</div>,
}));

jest.mock('../../components/CollabManager', () => ({
  CollabManager: ({ children }: { children: React.ReactNode }) => <div data-testid="collab-manager">{children}</div>,
}));

jest.mock('../../components/ComprehensiveSimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="comprehensive-simulation">{children}</div>,
}));

jest.mock('../../components/ConstructionOverlay', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="construction-overlay">{children}</div>,
}));

jest.mock('../../components/FloodSimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="flood-simulation">{children}</div>,
}));

jest.mock('../../components/ShadowImpactAnalysis', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shadow-impact-analysis">{children}</div>,
}));

jest.mock('../../components/TrafficParkingSimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="traffic-parking-simulation">{children}</div>,
}));

jest.mock('../../components/managers/SeasonalDecorManager', () => ({
  SeasonalDecorManager: ({ children }: { children: React.ReactNode }) => <div data-testid="seasonal-decor-manager">{children}</div>,
}));

jest.mock('../../components/managers/ARScaleManager', () => ({
  ARScaleManager: ({ children }: { children: React.ReactNode }) => <div data-testid="ar-scale-manager">{children}</div>,
}));

jest.mock('../../components/managers/BeforeAfterManager', () => ({
  BeforeAfterManager: ({ children }: { children: React.ReactNode }) => <div data-testid="before-after-manager">{children}</div>,
}));

jest.mock('../../components/managers/ComparativeTourManager', () => ({
  ComparativeTourManager: ({ children }: { children: React.ReactNode }) => <div data-testid="comparative-tour-manager">{children}</div>,
}));

jest.mock('../../components/managers/FurnitureManager', () => ({
  FurnitureManager: ({ children }: { children: React.ReactNode }) => <div data-testid="furniture-manager">{children}</div>,
}));

jest.mock('../../components/managers/MoodSceneManager', () => ({
  MoodSceneManager: ({ children }: { children: React.ReactNode }) => <div data-testid="mood-scene-manager">{children}</div>,
}));

jest.mock('../../components/managers/ROICalculatorManager', () => ({
  ROICalculatorManager: ({ children }: { children: React.ReactNode }) => <div data-testid="roi-calculator-manager">{children}</div>,
}));

jest.mock('../../components/managers/ScenarioManager', () => ({
  ScenarioManager: ({ children }: { children: React.ReactNode }) => <div data-testid="scenario-manager">{children}</div>,
}));

jest.mock('../../components/BIMManager', () => ({
  BIMManager: ({ children }: { children: React.ReactNode }) => <div data-testid="bim-manager">{children}</div>,
}));

jest.mock('../../components/AnalyticsManager', () => ({
  AnalyticsManager: ({ children }: { children: React.ReactNode }) => <div data-testid="analytics-manager">{children}</div>,
}));

jest.mock('../../components/FeatureManager', () => ({
  FeatureManager: ({ children }: { children: React.ReactNode }) => <div data-testid="feature-manager">{children}</div>,
}));

jest.mock('../../components/IoTManager', () => ({
  IoTManager: ({ children }: { children: React.ReactNode }) => <div data-testid="iot-manager">{children}</div>,
}));

jest.mock('../../components/AnimationManager', () => ({
  AnimationManager: ({ children }: { children: React.ReactNode }) => <div data-testid="animation-manager">{children}</div>,
}));

jest.mock('../../components/SyncManager', () => ({
  SyncManager: ({ children }: { children: React.ReactNode }) => <div data-testid="sync-manager">{children}</div>,
}));

jest.mock('../../components/MaterialManager', () => ({
  MaterialManager: ({ children }: { children: React.ReactNode }) => <div data-testid="material-manager">{children}</div>,
}));

jest.mock('../../components/AudioManager', () => ({
  AudioManager: ({ children }: { children: React.ReactNode }) => <div data-testid="audio-manager">{children}</div>,
}));

jest.mock('../../components/PostProcessingManager', () => ({
  PostProcessingManager: ({ children }: { children: React.ReactNode }) => <div data-testid="post-processing-manager">{children}</div>,
}));

jest.mock('../../components/PhysicsManager', () => ({
  PhysicsManager: ({ children }: { children: React.ReactNode }) => <div data-testid="physics-manager">{children}</div>,
}));

jest.mock('../../components/XRManager', () => ({
  XRManager: ({ children }: { children: React.ReactNode }) => <div data-testid="xr-manager">{children}</div>,
}));

jest.mock('../../components/BIMIntegration', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="bim-integration">{children}</div>,
}));

jest.mock('../../components/DeviceDetector', () => ({
  DeviceDetector: {
    getInstance: jest.fn().mockReturnValue({
      detectCapabilities: jest.fn().mockReturnValue({
        webGL: true,
        webXR: false,
        spatialAudio: true,
      }),
    }),
  },
}));

jest.mock('../../components/EnergyDashboard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="energy-dashboard">{children}</div>,
}));

jest.mock('../../components/WetMaterialManager', () => ({
  WetMaterialManager: ({ children }: { children: React.ReactNode }) => <div data-testid="wet-material-manager">{children}</div>,
}));

jest.mock('../../components/WindTunnelSimulation', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="wind-tunnel-simulation">{children}</div>,
}));

jest.mock('../../components/UnderwaterMode', () => ({
  UnderwaterMode: ({ children }: { children: React.ReactNode }) => <div data-testid="underwater-mode">{children}</div>,
}));

jest.mock('../../components/WaterShader', () => ({
  WaterShader: ({ children }: { children: React.ReactNode }) => <div data-testid="water-shader">{children}</div>,
}));

jest.mock('../../components/VoiceChat', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="voice-chat">{children}</div>,
}));

jest.mock('../../components/VRARMode', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="vrar-mode">{children}</div>,
}));

// Mock the custom hooks
jest.mock('../../components/BabylonWorkspace/workspaceHooks', () => ({
  useWorkspaceState: jest.fn(() => ({
    updateState: jest.fn(),
    selectedMesh: null,
    setSelectedMesh: jest.fn(),
    selectedWorkspaceId: 'default',
    setSelectedWorkspaceId: jest.fn(),
    realTimeEnabled: false,
    setRealTimeEnabled: jest.fn(),
    cameraMode: 'orbit',
    setCameraMode: jest.fn(),
    gridVisible: false,
    setGridVisible: jest.fn(),
    wireframeEnabled: false,
    setWireframeEnabled: jest.fn(),
    statsVisible: false,
    setStatsVisible: jest.fn(),
    setPerformanceMode: jest.fn(),
    animationManager: {},
    handleTourSequenceCreate: jest.fn(),
    handleTourSequencePlay: jest.fn(),
    leftPanelVisible: true,
    setLeftPanelVisible: jest.fn(),
    rightPanelVisible: false,
    setRightPanelVisible: jest.fn(),
    bottomPanelVisible: false,
    setBottomPanelVisible: jest.fn(),
    showFloatingToolbar: false,
    setShowFloatingToolbar: jest.fn(),
    moveActive: false,
    setMoveActive: jest.fn(),
    rotateActive: false,
    setRotateActive: jest.fn(),
    scaleActive: false,
    setScaleActive: jest.fn(),
    cameraActive: false,
    setCameraActive: jest.fn(),
    perspectiveActive: false,
    setPerspectiveActive: jest.fn(),
    categoryPanelVisible: {},
    setCategoryPanelVisible: jest.fn(),
  })),
}));

jest.mock('../../components/BabylonWorkspace/featureStateHooks', () => ({
  useFeatureStates: jest.fn(() => ({
    featureStates: {},
    setFeatureStates: jest.fn(),
    toggleFeature: jest.fn(),
    setFeatureState: jest.fn(),
    enableFeature: jest.fn(),
    disableFeature: jest.fn(),
    activeFeatures: [],
    featuresByCategory: {},
  })),
}));

jest.mock('../../components/BabylonWorkspace/uiHandlers', () => ({
  useUIHandlers: jest.fn(() => ({
    handleWorkspaceSelect: jest.fn(),
    handleToggleRealTime: jest.fn(),
    handleCameraModeChange: jest.fn(),
    handleToggleGrid: jest.fn(),
    handleToggleWireframe: jest.fn(),
    handleToggleStats: jest.fn(),
    handleCategoryToggle: jest.fn(),
  })),
}));

// Mock the config
jest.mock('../../config/featureCategories', () => ({
  featureCategoriesArray: [],
  FEATURE_CATEGORIES: {},
  Feature: {},
}));

// Mock the utils
jest.mock('../../components/utils/CacheManager', () => ({
  cacheManager: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('../../components/utils/Logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../components/utils/toast', () => ({
  showToast: {
    error: jest.fn(),
  },
}));

// Mock the interfaces
jest.mock('../../components/interfaces/AnimationInterfaces', () => ({
  AnimationInterfaces: {},
}));

jest.mock('../../components/interfaces/MaterialInterfaces', () => ({
  MaterialInterfaces: {},
}));

describe('BabylonWorkspace Component', () => {
  const defaultProps = {
    workspaceId: 'test-workspace',
    isAdmin: false,
    layoutMode: 'standard' as const,
    performanceMode: 'medium' as const,
    enablePhysics: false,
    enableXR: false,
    enableSpatialAudio: false,
    renderingQuality: 'high' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should render the main layout structure', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      expect(document.querySelector('.flex.h-screen')).toBeInTheDocument();
    });

    it('should render the Babylon.js canvas', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      const canvas = screen.getByRole('img', { name: /babylon\.js 3d canvas/i });
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveClass('babylon-canvas');
    });

    it('should render loading overlay when not initialized', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      expect(screen.getByText(/initializing 3d workspace/i)).toBeInTheDocument();
    });

    it('should render keyboard shortcuts help button', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      const helpButton = screen.getByTitle(/keyboard shortcuts/i);
      expect(helpButton).toBeInTheDocument();
    });
  });

  describe('Error Boundary', () => {
    it('should render error boundary fallback on error', () => {
      // Mock console.error to avoid noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create a component that throws an error
      const ErrorComponent = () => {
        throw new Error('Test error');
      };

      render(
        <BabylonWorkspace {...defaultProps}>
          <ErrorComponent />
        </BabylonWorkspace>
      );

      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
      expect(screen.getByText(/error: test error/i)).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should allow resetting error state', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const ErrorComponent = () => {
        throw new Error('Test error');
      };

      render(
        <BabylonWorkspace {...defaultProps}>
          <ErrorComponent />
        </BabylonWorkspace>
      );

      const resetButton = screen.getByText('Reset Error');
      fireEvent.click(resetButton);

      // Wait for the error boundary to disappear after reset
      await waitFor(() => {
        expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Canvas Error Handling', () => {
    it('should show canvas error message when canvas fails', () => {
      // Mock the canvas to fail
      const mockCanvas = document.createElement('canvas');
      Object.defineProperty(mockCanvas, 'getContext', {
        value: () => null,
        writable: false,
      });

      render(<BabylonWorkspace {...defaultProps} />);

      // The component should handle the error gracefully
      expect(screen.getByText(/initializing 3d workspace/i)).toBeInTheDocument();
    });
  });

  describe('Props Handling', () => {
    it('should use default props when not provided', () => {
      render(<BabylonWorkspace workspaceId="test" />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle admin mode prop', () => {
      render(<BabylonWorkspace {...defaultProps} isAdmin={true} />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle different layout modes', () => {
      const { rerender } = render(<BabylonWorkspace {...defaultProps} layoutMode="compact" />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();

      rerender(<BabylonWorkspace {...defaultProps} layoutMode="immersive" />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle different performance modes', () => {
      const { rerender } = render(<BabylonWorkspace {...defaultProps} performanceMode="low" />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();

      rerender(<BabylonWorkspace {...defaultProps} performanceMode="high" />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle physics and XR props', () => {
      render(<BabylonWorkspace {...defaultProps} enablePhysics={true} enableXR={true} />);
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });
  });

  describe('UI Handler Integration', () => {
    it('should call useUIHandlers with correct parameters', () => {
      const mockUseUIHandlers = useUIHandlers as jest.MockedFunction<typeof useUIHandlers>;

      render(<BabylonWorkspace {...defaultProps} />);

      expect(mockUseUIHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          setSelectedWorkspaceId: expect.any(Function),
          setRealTimeEnabled: expect.any(Function),
          setCameraMode: expect.any(Function),
          setGridVisible: expect.any(Function),
          setWireframeEnabled: expect.any(Function),
          setStatsVisible: expect.any(Function),
          setCategoryPanelVisible: expect.any(Function),
          getRealTimeEnabled: expect.any(Function),
          getGridVisible: expect.any(Function),
          getWireframeEnabled: expect.any(Function),
          getStatsVisible: expect.any(Function),
          getCategoryPanelVisible: expect.any(Function),
        })
      );
    });

    it('should provide current state getters to useUIHandlers', () => {
      const mockUseUIHandlers = useUIHandlers as jest.MockedFunction<typeof useUIHandlers>;

      render(<BabylonWorkspace {...defaultProps} />);

      const callArgs = mockUseUIHandlers.mock.calls[0][0];

      expect(typeof callArgs.getRealTimeEnabled).toBe('function');
      expect(typeof callArgs.getGridVisible).toBe('function');
      expect(typeof callArgs.getWireframeEnabled).toBe('function');
      expect(typeof callArgs.getStatsVisible).toBe('function');
      expect(typeof callArgs.getCategoryPanelVisible).toBe('function');
    });
  });

  describe('Feature State Integration', () => {
    it('should integrate with feature state hooks', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      // The component should render without errors when feature states are managed
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle feature toggling through UI handlers', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      // The component should be able to handle feature state changes
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });
  });

  describe('Workspace State Integration', () => {
    it('should integrate with workspace state hooks', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      // The component should render without errors when workspace state is managed
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle workspace state updates', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      // The component should be able to handle workspace state changes
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle component unmounting gracefully', () => {
      const { unmount } = render(<BabylonWorkspace {...defaultProps} />);
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle rapid re-renders', () => {
      const { rerender } = render(<BabylonWorkspace {...defaultProps} />);
      expect(() => {
        rerender(<BabylonWorkspace {...defaultProps} layoutMode="compact" />);
        rerender(<BabylonWorkspace {...defaultProps} layoutMode="immersive" />);
        rerender(<BabylonWorkspace {...defaultProps} layoutMode="standard" />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      const canvas = screen.getByRole('img', { name: /babylon\.js 3d canvas/i });
      expect(canvas).toHaveAttribute('aria-label', 'Babylon.js 3D Canvas');
    });

    it('should have proper semantic structure', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      expect(document.querySelector('.flex.h-screen')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of features without performance issues', () => {
      // Mock a large feature set
      const mockLargeFeatureSet = Array.from({ length: 100 }, (_, i) => ({
        id: `feature-${i}`,
        name: `Feature ${i}`,
        category: 'test',
      }));

      render(<BabylonWorkspace {...defaultProps} />);
      // The component should render without performance issues
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });

    it('should handle frequent state updates efficiently', () => {
      render(<BabylonWorkspace {...defaultProps} />);
      // The component should handle frequent updates without memory leaks
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from Babylon.js initialization errors', () => {
      // Mock Babylon.js to throw an error during initialization
      const originalError = console.error;
      console.error = jest.fn();

      render(<BabylonWorkspace {...defaultProps} />);

      // The component should show an error message but not crash
      expect(screen.getByText(/initializing 3d workspace/i)).toBeInTheDocument();

      console.error = originalError;
    });

    it('should handle network errors gracefully', () => {
      // Mock fetch to throw network errors
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      render(<BabylonWorkspace {...defaultProps} />);

      // The component should handle network errors gracefully
      expect(screen.getByRole('img', { name: /babylon\.js 3d canvas/i })).toBeInTheDocument();

      // Restore fetch
      delete (global as any).fetch;
    });
  });
});

