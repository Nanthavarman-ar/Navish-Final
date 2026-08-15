import { useState, useCallback } from 'react';
import { Mesh } from '@babylonjs/core';
import { AnimationManager } from '../components/AnimationManager';
import { SyncManager } from '../components/SyncManager';

export interface WorkspaceState {
  selectedMesh: Mesh | null;
  setSelectedMesh: (mesh: Mesh | null) => void;
  selectedWorkspaceId: string;
  setSelectedWorkspaceId: (id: string) => void;
  realTimeEnabled: boolean;
  setRealTimeEnabled: (enabled: boolean) => void;
  cameraMode: 'orbit' | 'fly' | 'walk';
  setCameraMode: (mode: 'orbit' | 'fly' | 'walk') => void;
  gridVisible: boolean;
  setGridVisible: (visible: boolean) => void;
  wireframeEnabled: boolean;
  setWireframeEnabled: (enabled: boolean) => void;
  statsVisible: boolean;
  setStatsVisible: (visible: boolean) => void;
  setPerformanceMode: (mode: 'low' | 'medium' | 'high') => void;
  animationManager: AnimationManager | null;
  handleTourSequenceCreate: (sequence: any) => void;
  handleTourSequencePlay: (sequenceId: string) => void;
  topBarVisible: boolean;
  setTopBarVisible: (visible: boolean) => void;
  leftPanelVisible: boolean;
  setLeftPanelVisible: (visible: boolean) => void;
  rightPanelVisible: boolean;
  setRightPanelVisible: (visible: boolean) => void;
  bottomPanelVisible: boolean;
  setBottomPanelVisible: (visible: boolean) => void;
  showFloatingToolbar: boolean;
  setShowFloatingToolbar: (show: boolean) => void;
  moveActive: boolean;
  setMoveActive: (active: boolean) => void;
  rotateActive: boolean;
  setRotateActive: (active: boolean) => void;
  scaleActive: boolean;
  setScaleActive: (active: boolean) => void;
  cameraActive: boolean;
  setCameraActive: (active: boolean) => void;
  perspectiveActive: boolean;
  setPerspectiveActive: (active: boolean) => void;
  categoryPanelVisible: Record<string, boolean>;
  setCategoryPanelVisible: (visible: Record<string, boolean>) => void;
  updateState: (updates: Partial<WorkspaceState>) => void;
}

export const useWorkspaceState = (initialWorkspaceId: string): WorkspaceState => {
  const [selectedMesh, setSelectedMesh] = useState<Mesh | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(initialWorkspaceId);
  const [realTimeEnabled, setRealTimeEnabled] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'fly' | 'walk'>('orbit');
  const [gridVisible, setGridVisible] = useState<boolean>(false);
  const [wireframeEnabled, setWireframeEnabled] = useState<boolean>(false);
  const [statsVisible, setStatsVisible] = useState<boolean>(false);
  const [animationManager] = useState<AnimationManager | null>(null);
  const [topBarVisible, setTopBarVisible] = useState<boolean>(true);
  const [leftPanelVisible, setLeftPanelVisible] = useState<boolean>(true);
  const [rightPanelVisible, setRightPanelVisible] = useState<boolean>(false);
  const [bottomPanelVisible, setBottomPanelVisible] = useState<boolean>(false);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState<boolean>(true);
  const [moveActive, setMoveActive] = useState<boolean>(false);
  const [rotateActive, setRotateActive] = useState<boolean>(false);
  const [scaleActive, setScaleActive] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [perspectiveActive, setPerspectiveActive] = useState<boolean>(false);
  const [categoryPanelVisible, setCategoryPanelVisible] = useState<Record<string, boolean>>({});

  const handleTourSequenceCreate = useCallback((sequence: any) => {
    // TODO: Implement tour sequence creation
    console.log('Tour sequence create:', sequence);
  }, []);

  const handleTourSequencePlay = useCallback((sequenceId: string) => {
    // TODO: Implement tour sequence play
    console.log('Tour sequence play:', sequenceId);
  }, []);

  const setPerformanceMode = useCallback((mode: 'low' | 'medium' | 'high') => {
    // TODO: Implement performance mode setting
    console.log('Set performance mode:', mode);
  }, []);

  const updateState = useCallback((updates: Partial<WorkspaceState>) => {
    if (updates.selectedMesh !== undefined) setSelectedMesh(updates.selectedMesh);
    if (updates.selectedWorkspaceId !== undefined) setSelectedWorkspaceId(updates.selectedWorkspaceId);
    if (updates.realTimeEnabled !== undefined) setRealTimeEnabled(updates.realTimeEnabled);
    if (updates.cameraMode !== undefined) setCameraMode(updates.cameraMode);
    if (updates.gridVisible !== undefined) setGridVisible(updates.gridVisible);
    if (updates.wireframeEnabled !== undefined) setWireframeEnabled(updates.wireframeEnabled);
    if (updates.statsVisible !== undefined) setStatsVisible(updates.statsVisible);
    if (updates.topBarVisible !== undefined) setTopBarVisible(updates.topBarVisible);
    if (updates.leftPanelVisible !== undefined) setLeftPanelVisible(updates.leftPanelVisible);
    if (updates.rightPanelVisible !== undefined) setRightPanelVisible(updates.rightPanelVisible);
    if (updates.bottomPanelVisible !== undefined) setBottomPanelVisible(updates.bottomPanelVisible);
    if (updates.showFloatingToolbar !== undefined) setShowFloatingToolbar(updates.showFloatingToolbar);
    if (updates.moveActive !== undefined) setMoveActive(updates.moveActive);
    if (updates.rotateActive !== undefined) setRotateActive(updates.rotateActive);
    if (updates.scaleActive !== undefined) setScaleActive(updates.scaleActive);
    if (updates.cameraActive !== undefined) setCameraActive(updates.cameraActive);
    if (updates.perspectiveActive !== undefined) setPerspectiveActive(updates.perspectiveActive);
    if (updates.categoryPanelVisible !== undefined) setCategoryPanelVisible(updates.categoryPanelVisible);
  }, []);

  return {
    selectedMesh,
    setSelectedMesh,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    realTimeEnabled,
    setRealTimeEnabled,
    cameraMode,
    setCameraMode,
    gridVisible,
    setGridVisible,
    wireframeEnabled,
    setWireframeEnabled,
    statsVisible,
    setStatsVisible,
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
    moveActive,
    setMoveActive,
    rotateActive,
    setRotateActive,
    scaleActive,
    setScaleActive,
    cameraActive,
    setCameraActive,
    perspectiveActive,
    setPerspectiveActive,
    categoryPanelVisible,
    setCategoryPanelVisible,
    updateState
  };
};
