import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { AbstractMesh, Engine, Scene, ArcRotateCamera } from '@babylonjs/core';

// State interface
export interface WorkspaceState {
  // Core Babylon.js objects
  engine: Engine | null;
  scene: Scene | null;
  camera: ArcRotateCamera | null;

  // UI State
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  bottomPanelVisible: boolean;
  showFloatingToolbar: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;

  // Tool States
  moveActive: boolean;
  rotateActive: boolean;
  scaleActive: boolean;
  cameraActive: boolean;
  perspectiveActive: boolean;

  // Workspace Settings
  selectedWorkspaceId: string;
  layoutMode: 'standard' | 'compact' | 'immersive' | 'split';
  performanceMode: 'low' | 'medium' | 'high';
  renderingQuality: 'low' | 'medium' | 'high' | 'ultra';

  // Feature States
  activeFeatures: Set<string>;
  categoryPanelVisible: Record<string, boolean>;

  // Selection and Interaction
  selectedMesh: AbstractMesh | null;
  hoveredMesh: AbstractMesh | null;

  // Animation and Tour
  animationManager: any;
  currentAnimation: any;

  // Material State
  materials: any[];
  currentMaterial: any;

  // BIM State
  bimModels: any[];
  clashCount: number;
  costEstimate: number;
  costBreakdown: {
    total: number;
    labor: number;
    materials: number;
    overhead: number;
    elements: Array<{ id: string; name: string; cost: number }>;
  } | null;
  bimUploadState: 'idle' | 'uploading' | 'success' | 'error';
  bimError: string | null;

  // Loading and Error States
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
}

// Action types
type WorkspaceAction =
  | { type: 'SET_ENGINE'; payload: Engine }
  | { type: 'SET_SCENE'; payload: Scene }
  | { type: 'SET_CAMERA'; payload: ArcRotateCamera }
  | { type: 'TOGGLE_PANEL'; payload: keyof Pick<WorkspaceState, 'leftPanelVisible' | 'rightPanelVisible' | 'bottomPanelVisible' | 'showFloatingToolbar'> }
  | { type: 'SET_TOOL_ACTIVE'; payload: { tool: keyof Pick<WorkspaceState, 'moveActive' | 'rotateActive' | 'scaleActive' | 'cameraActive' | 'perspectiveActive'>; active: boolean } }
  | { type: 'SET_WORKSPACE_ID'; payload: string }
  | { type: 'SET_LAYOUT_MODE'; payload: WorkspaceState['layoutMode'] }
  | { type: 'SET_PERFORMANCE_MODE'; payload: WorkspaceState['performanceMode'] }
  | { type: 'SET_RENDERING_QUALITY'; payload: WorkspaceState['renderingQuality'] }
  | { type: 'TOGGLE_FEATURE'; payload: { featureId: string; enabled: boolean } }
  | { type: 'TOGGLE_CATEGORY_PANEL'; payload: { category: string; visible: boolean } }
  | { type: 'SET_SELECTED_MESH'; payload: AbstractMesh | null }
  | { type: 'SET_HOVERED_MESH'; payload: AbstractMesh | null }
  | { type: 'SET_ANIMATION_MANAGER'; payload: any }
  | { type: 'SET_CURRENT_ANIMATION'; payload: any }
  | { type: 'ADD_MATERIAL'; payload: any }
  | { type: 'SET_CURRENT_MATERIAL'; payload: any }
  | { type: 'SET_BIM_MODELS'; payload: any[] }
  | { type: 'SET_CLASH_COUNT'; payload: number }
  | { type: 'SET_COST_ESTIMATE'; payload: number }
  | { type: 'SET_COST_BREAKDOWN'; payload: WorkspaceState['costBreakdown'] }
  | { type: 'SET_BIM_UPLOAD_STATE'; payload: WorkspaceState['bimUploadState'] }
  | { type: 'SET_BIM_ERROR'; payload: WorkspaceState['bimError'] }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PANEL_WIDTH'; payload: { panel: 'left' | 'right'; width: number } }
  | { type: 'SET_PANEL_HEIGHT'; payload: { panel: 'bottom'; height: number } }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: WorkspaceState = {
  engine: null,
  scene: null,
  camera: null,
  leftPanelVisible: true,
  rightPanelVisible: true,
  bottomPanelVisible: true,
  showFloatingToolbar: false,
  leftPanelWidth: 320,
  rightPanelWidth: 320,
  bottomPanelHeight: 200,
  moveActive: false,
  rotateActive: false,
  scaleActive: false,
  cameraActive: false,
  perspectiveActive: false,
  selectedWorkspaceId: 'default',
  layoutMode: 'standard',
  performanceMode: 'medium',
  renderingQuality: 'high',
  activeFeatures: new Set(),
  categoryPanelVisible: {},
  selectedMesh: null,
  hoveredMesh: null,
  animationManager: null,
  currentAnimation: null,
  materials: [],
  currentMaterial: null,
  bimModels: [],
  clashCount: 0,
  costEstimate: 0,
  costBreakdown: null,
  bimUploadState: 'idle',
  bimError: null,
  isInitialized: false,
  isLoading: false,
  error: null,
};

// Reducer
function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'SET_ENGINE':
      return { ...state, engine: action.payload };
    case 'SET_SCENE':
      return { ...state, scene: action.payload };
    case 'SET_CAMERA':
      return { ...state, camera: action.payload };
    case 'TOGGLE_PANEL':
      return { ...state, [action.payload]: !state[action.payload] };
    case 'SET_TOOL_ACTIVE':
      return { ...state, [action.payload.tool]: action.payload.active };
    case 'SET_WORKSPACE_ID':
      return { ...state, selectedWorkspaceId: action.payload };
    case 'SET_LAYOUT_MODE':
      return { ...state, layoutMode: action.payload };
    case 'SET_PERFORMANCE_MODE':
      return { ...state, performanceMode: action.payload };
    case 'SET_RENDERING_QUALITY':
      return { ...state, renderingQuality: action.payload };
    case 'TOGGLE_FEATURE': {
      const newFeatures = new Set(state.activeFeatures);
      if (action.payload.enabled) {
        newFeatures.add(action.payload.featureId);
      } else {
        newFeatures.delete(action.payload.featureId);
      }
      return { ...state, activeFeatures: newFeatures };
    }
    case 'TOGGLE_CATEGORY_PANEL':
      return {
        ...state,
        categoryPanelVisible: {
          ...state.categoryPanelVisible,
          [action.payload.category]: action.payload.visible
        }
      };
    case 'SET_SELECTED_MESH':
      return { ...state, selectedMesh: action.payload };
    case 'SET_HOVERED_MESH':
      return { ...state, hoveredMesh: action.payload };
    case 'SET_ANIMATION_MANAGER':
      return { ...state, animationManager: action.payload };
    case 'SET_CURRENT_ANIMATION':
      return { ...state, currentAnimation: action.payload };
    case 'ADD_MATERIAL':
      return { ...state, materials: [...state.materials, action.payload] };
    case 'SET_CURRENT_MATERIAL':
      return { ...state, currentMaterial: action.payload };
    case 'SET_BIM_MODELS':
      return { ...state, bimModels: action.payload };
    case 'SET_CLASH_COUNT':
      return { ...state, clashCount: action.payload };
    case 'SET_COST_ESTIMATE':
      return { ...state, costEstimate: action.payload };
    case 'SET_COST_BREAKDOWN':
      return { ...state, costBreakdown: action.payload };
    case 'SET_BIM_UPLOAD_STATE':
      return { ...state, bimUploadState: action.payload };
    case 'SET_BIM_ERROR':
      return { ...state, bimError: action.payload };
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PANEL_WIDTH':
      return { ...state, [`${action.payload.panel}PanelWidth`]: action.payload.width };
    case 'SET_PANEL_HEIGHT':
      return { ...state, bottomPanelHeight: action.payload.height };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// Context
interface WorkspaceContextType {
  state: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  // Helper functions
  togglePanel: (panel: keyof Pick<WorkspaceState, 'leftPanelVisible' | 'rightPanelVisible' | 'bottomPanelVisible' | 'showFloatingToolbar'>) => void;
  setToolActive: (tool: keyof Pick<WorkspaceState, 'moveActive' | 'rotateActive' | 'scaleActive' | 'cameraActive' | 'perspectiveActive'>, active: boolean) => void;
  toggleFeature: (featureId: string, enabled: boolean) => void;
  toggleCategoryPanel: (category: string, visible: boolean) => void;
  setSelectedMesh: (mesh: AbstractMesh | null) => void;
  setHoveredMesh: (mesh: AbstractMesh | null) => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  setPanelHeight: (height: number) => void;
  resetState: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Provider component
interface WorkspaceProviderProps {
  children: ReactNode;
  initialWorkspaceId?: string;
}

export function WorkspaceProvider({ children, initialWorkspaceId = 'default' }: WorkspaceProviderProps) {
  const [state, dispatch] = useReducer(workspaceReducer, {
    ...initialState,
    selectedWorkspaceId: initialWorkspaceId,
  });

  // Helper functions
  const togglePanel = (panel: keyof Pick<WorkspaceState, 'leftPanelVisible' | 'rightPanelVisible' | 'bottomPanelVisible' | 'showFloatingToolbar'>) => {
    dispatch({ type: 'TOGGLE_PANEL', payload: panel });
  };

  const setToolActive = (tool: keyof Pick<WorkspaceState, 'moveActive' | 'rotateActive' | 'scaleActive' | 'cameraActive' | 'perspectiveActive'>, active: boolean) => {
    dispatch({ type: 'SET_TOOL_ACTIVE', payload: { tool, active } });
  };

  const toggleFeature = (featureId: string, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_FEATURE', payload: { featureId, enabled } });
  };

  const toggleCategoryPanel = (category: string, visible: boolean) => {
    dispatch({ type: 'TOGGLE_CATEGORY_PANEL', payload: { category, visible } });
  };

  const setSelectedMesh = (mesh: AbstractMesh | null) => {
    dispatch({ type: 'SET_SELECTED_MESH', payload: mesh });
  };

  const setHoveredMesh = (mesh: AbstractMesh | null) => {
    dispatch({ type: 'SET_HOVERED_MESH', payload: mesh });
  };

  const setPanelWidth = (panel: 'left' | 'right', width: number) => {
    dispatch({ type: 'SET_PANEL_WIDTH', payload: { panel, width } });
  };

  const setPanelHeight = (height: number) => {
    dispatch({ type: 'SET_PANEL_HEIGHT', payload: { panel: 'bottom', height } });
  };

  const resetState = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  const contextValue: WorkspaceContextType = {
    state,
    dispatch,
    togglePanel,
    setToolActive,
    toggleFeature,
    toggleCategoryPanel,
    setSelectedMesh,
    setHoveredMesh,
    setPanelWidth,
    setPanelHeight,
    resetState,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// Hook to use the context
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// Selector hooks for specific state slices
export function useWorkspaceUI() {
  const { state } = useWorkspace();
  return {
    leftPanelVisible: state.leftPanelVisible,
    rightPanelVisible: state.rightPanelVisible,
    bottomPanelVisible: state.bottomPanelVisible,
    showFloatingToolbar: state.showFloatingToolbar,
    leftPanelWidth: state.leftPanelWidth,
    rightPanelWidth: state.rightPanelWidth,
    bottomPanelHeight: state.bottomPanelHeight,
    layoutMode: state.layoutMode,
    isLoading: state.isLoading,
    error: state.error,
  };
}

export function useWorkspaceTools() {
  const { state, setToolActive } = useWorkspace();
  return {
    moveActive: state.moveActive,
    rotateActive: state.rotateActive,
    scaleActive: state.scaleActive,
    cameraActive: state.cameraActive,
    perspectiveActive: state.perspectiveActive,
    setToolActive,
  };
}

export function useWorkspaceFeatures() {
  const { state, toggleFeature, toggleCategoryPanel } = useWorkspace();
  return {
    activeFeatures: state.activeFeatures,
    categoryPanelVisible: state.categoryPanelVisible,
    toggleFeature,
    toggleCategoryPanel,
  };
}

export function useWorkspaceSelection() {
  const { state, setSelectedMesh, setHoveredMesh } = useWorkspace();
  return {
    selectedMesh: state.selectedMesh,
    hoveredMesh: state.hoveredMesh,
    setSelectedMesh,
    setHoveredMesh,
  };
}
