import { useState, useCallback, useMemo } from 'react';
import { AbstractMesh } from '@babylonjs/core';

export interface WorkspaceState {
  // Layout
  currentLayoutMode: 'standard' | 'immersive' | 'split';
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  bottomPanelVisible: boolean;
  topBarVisible: boolean;

  // Tool states
  moveActive: boolean;
  rotateActive: boolean;
  scaleActive: boolean;
  cameraActive: boolean;
  perspectiveActive: boolean;

  // Performance states
  performanceMode: 'low' | 'medium' | 'high';
  showFloatingToolbar: boolean;
  toolbarPosition: { x: number; y: number };

  // UI states
  activeTab: string;
}

const initialState: WorkspaceState = {
  currentLayoutMode: 'standard',
  leftPanelVisible: true,
  rightPanelVisible: true,
  bottomPanelVisible: true,
  topBarVisible: true,
  moveActive: false,
  rotateActive: false,
  scaleActive: false,
  cameraActive: false,
  perspectiveActive: false,
  performanceMode: 'medium',
  showFloatingToolbar: true,
  toolbarPosition: { x: 20, y: 100 },
  activeTab: 'features',
};

export const useWorkspaceState = () => {
  const [state, setState] = useState<WorkspaceState>(initialState);
  const [selectedMesh, setSelectedMeshState] = useState<AbstractMesh | null>(null);

  const updateState = useCallback((updates: Partial<WorkspaceState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Layout actions
  const setLayoutMode = useCallback((mode: 'standard' | 'immersive' | 'split') => {
    updateState({ currentLayoutMode: mode });
  }, [updateState]);

  const togglePanel = useCallback((panel: keyof Pick<WorkspaceState, 'leftPanelVisible' | 'rightPanelVisible' | 'bottomPanelVisible' | 'topBarVisible'>) => {
    setState(prev => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

  // Tool actions
  const setActiveTool = useCallback((tool: keyof Pick<WorkspaceState, 'moveActive' | 'rotateActive' | 'scaleActive' | 'cameraActive' | 'perspectiveActive'>) => {
    setState(prev => ({
      ...prev,
      moveActive: false,
      rotateActive: false,
      scaleActive: false,
      cameraActive: false,
      perspectiveActive: false,
      [tool]: true
    }));
  }, []);

  const deactivateAllTools = useCallback(() => {
    setState(prev => ({
      ...prev,
      moveActive: false,
      rotateActive: false,
      scaleActive: false,
      cameraActive: false,
      perspectiveActive: false
    }));
  }, []);

  // Performance actions
  const setPerformanceMode = useCallback((mode: 'low' | 'medium' | 'high') => {
    updateState({ performanceMode: mode });
  }, [updateState]);

  // Selection actions
  const setSelectedMesh = useCallback((mesh: AbstractMesh | null) => {
    setSelectedMeshState(mesh);
  }, []);

  // UI actions
  const setActiveTab = useCallback((tab: string) => {
    updateState({ activeTab: tab });
  }, [updateState]);

  // Toolbar actions
  const toggleFloatingToolbar = useCallback(() => {
    setState(prev => ({ ...prev, showFloatingToolbar: !prev.showFloatingToolbar }));
  }, []);

  const setToolbarPosition = useCallback((position: { x: number; y: number }) => {
    updateState({ toolbarPosition: position });
  }, [updateState]);

  // Reset actions
  const resetToDefaults = useCallback(() => {
    setState(initialState);
    setSelectedMeshState(null);
  }, []);

  // Memoized combined state for backward compatibility
  const combinedState = useMemo(() => ({
    ...state,
    selectedMesh
  }), [state, selectedMesh]);

  // Memoized layout state
  const layoutState = useMemo(() => ({
    currentLayoutMode: state.currentLayoutMode,
    leftPanelVisible: state.leftPanelVisible,
    rightPanelVisible: state.rightPanelVisible,
    bottomPanelVisible: state.bottomPanelVisible,
    topBarVisible: state.topBarVisible,
  }), [state.currentLayoutMode, state.leftPanelVisible, state.rightPanelVisible, state.bottomPanelVisible, state.topBarVisible]);

  // Memoized tool state
  const toolState = useMemo(() => ({
    moveActive: state.moveActive,
    rotateActive: state.rotateActive,
    scaleActive: state.scaleActive,
    cameraActive: state.cameraActive,
    perspectiveActive: state.perspectiveActive,
  }), [state.moveActive, state.rotateActive, state.scaleActive, state.cameraActive, state.perspectiveActive]);

  return {
    state: combinedState,
    layoutState,
    toolState,
    updateState,
    setLayoutMode,
    togglePanel,
    setActiveTool,
    deactivateAllTools,
    setPerformanceMode,
    setSelectedMesh,
    setActiveTab,
    toggleFloatingToolbar,
    setToolbarPosition,
    resetToDefaults
  };
};
