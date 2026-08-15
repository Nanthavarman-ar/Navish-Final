import { useCallback } from 'react';
import { Mesh } from '@babylonjs/core';

export interface UIHandlers {
  handleMeshSelect: (mesh: Mesh | null) => void;
  handleWorkspaceSelect: (workspaceId: string) => void;
  handleRealTimeToggle: (enabled: boolean) => void;
  handleCameraModeChange: (mode?: 'orbit' | 'fly' | 'walk') => void;
  handleGridToggle: (visible: boolean) => void;
  handleWireframeToggle: (enabled: boolean) => void;
  handleStatsToggle: (visible: boolean) => void;
  handlePerformanceModeChange: (mode: 'low' | 'medium' | 'high') => void;
  handleTourSequenceCreate: () => void;
  handleTourSequencePlay: () => void;
  handlePanelToggle: (panel: 'left' | 'right' | 'bottom', visible: boolean) => void;
  handleToolbarToggle: (show: boolean) => void;
  handleTransformToggle: (transform: 'move' | 'rotate' | 'scale', active: boolean) => void;
  handleCameraToggle: (active: boolean) => void;
  handlePerspectiveToggle: (active: boolean) => void;
  handleCategoryPanelToggle: (category: string) => void;
  handleCategoryToggle: (category: string) => void;
  handleToggleRealTime: () => void;
  handleToggleGrid: () => void;
  handleToggleWireframe: () => void;
  handleToggleStats: () => void;
  handleFeatureToggle: (featureId: string, enabled: boolean) => void;
  handleStateUpdate: (updates: Record<string, any>) => void;
}

export const useUIHandlers = (): UIHandlers => {
  const handleMeshSelect = useCallback((mesh: Mesh | null) => {
    console.log('Mesh selected:', mesh?.name || 'none');
  }, []);

  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    console.log('Workspace selected:', workspaceId);
  }, []);

  const handleRealTimeToggle = useCallback((enabled: boolean) => {
    console.log('Real-time toggled:', enabled);
  }, []);

  const handleCameraModeChange = useCallback((mode?: 'orbit' | 'fly' | 'walk') => {
    if (!mode) return;
    console.log('Camera mode changed:', mode);
  }, []);

  const handleGridToggle = useCallback((visible: boolean) => {
    console.log('Grid toggled:', visible);
  }, []);

  const handleWireframeToggle = useCallback((enabled: boolean) => {
    console.log('Wireframe toggled:', enabled);
  }, []);

  const handleStatsToggle = useCallback((visible: boolean) => {
    console.log('Stats toggled:', visible);
  }, []);

  const handlePerformanceModeChange = useCallback((mode: 'low' | 'medium' | 'high') => {
    console.log('Performance mode changed:', mode);
  }, []);

  const handleTourSequenceCreate = useCallback(() => {
    console.log('Tour sequence create');
  }, []);

  const handleTourSequencePlay = useCallback(() => {
    console.log('Tour sequence play');
  }, []);

  const handlePanelToggle = useCallback((panel: 'left' | 'right' | 'bottom', visible: boolean) => {
    console.log(`${panel} panel toggled:`, visible);
  }, []);

  const handleToolbarToggle = useCallback((show: boolean) => {
    console.log('Toolbar toggled:', show);
  }, []);

  const handleTransformToggle = useCallback((transform: 'move' | 'rotate' | 'scale', active: boolean) => {
    console.log(`${transform} transform toggled:`, active);
  }, []);

  const handleCameraToggle = useCallback((active: boolean) => {
    console.log('Camera toggled:', active);
  }, []);

  const handlePerspectiveToggle = useCallback((active: boolean) => {
    console.log('Perspective toggled:', active);
  }, []);

  const handleCategoryPanelToggle = useCallback((category: string) => {
    console.log('Category panel toggled:', category);
  }, []);

  const handleCategoryToggle = useCallback((category: string) => {
    console.log('Category toggled:', category);
  }, []);

  const handleToggleRealTime = useCallback(() => {
    console.log('Toggle real time');
  }, []);

  const handleToggleGrid = useCallback(() => {
    console.log('Toggle grid');
  }, []);

  const handleToggleWireframe = useCallback(() => {
    console.log('Toggle wireframe');
  }, []);

  const handleToggleStats = useCallback(() => {
    console.log('Toggle stats');
  }, []);

  const handleFeatureToggle = useCallback((featureId: string, enabled: boolean) => {
    console.log(`Feature ${featureId} toggled:`, enabled);
  }, []);

  const handleStateUpdate = useCallback((updates: Record<string, any>) => {
    console.log('State updated:', updates);
  }, []);

  return {
    handleMeshSelect,
    handleWorkspaceSelect,
    handleRealTimeToggle,
    handleCameraModeChange,
    handleGridToggle,
    handleWireframeToggle,
    handleStatsToggle,
    handlePerformanceModeChange,
    handleTourSequenceCreate,
    handleTourSequencePlay,
    handlePanelToggle,
    handleToolbarToggle,
    handleTransformToggle,
    handleCameraToggle,
    handlePerspectiveToggle,
    handleCategoryPanelToggle,
    handleCategoryToggle,
    handleToggleRealTime,
    handleToggleGrid,
    handleToggleWireframe,
    handleToggleStats,
    handleFeatureToggle,
    handleStateUpdate
  };
};
