import React, { useRef, useCallback, useEffect } from 'react';
import { Mesh, Scene, Engine, ArcRotateCamera } from '@babylonjs/core';
import { WorkspaceProvider, useWorkspace } from './core/WorkspaceContext';
import { BabylonSceneManager, useBabylonScene } from './core/BabylonSceneManager';
import { FeatureManager, useFeatureManager } from './core/FeatureManager';
import './BabylonWorkspace.css';

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

// Main workspace component that uses the refactored architecture
function RefactoredBabylonWorkspaceContent({
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
}: RefactoredBabylonWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch } = useWorkspace();
  const { isFeatureEnabled, handleFeatureToggle } = useFeatureManager();
  const { loadModel, createMaterial } = useBabylonScene();

  // Handle mesh selection
  const handleMeshSelect = useCallback((mesh: Mesh) => {
    dispatch({ type: 'SET_SELECTED_MESH', payload: mesh });
    if (onMeshSelect) {
      onMeshSelect(mesh);
    }
  }, [dispatch, onMeshSelect]);

  // Handle scene ready callback
  const handleSceneReady = useCallback((scene: Scene, engine: Engine, camera: ArcRotateCamera) => {
    dispatch({ type: 'SET_INITIALIZED', payload: true });
    console.log('Scene initialized successfully');
  }, [dispatch]);

  // Scene configuration based on props
  const sceneConfig = {
    enablePhysics,
    enablePostProcessing: renderingQuality !== 'low',
    enableSSAO: renderingQuality === 'high' || renderingQuality === 'ultra',
    enableShadows: renderingQuality !== 'low',
    shadowMapSize: renderingQuality === 'ultra' ? 4096 : 2048,
    enableOptimization: performanceMode !== 'low',
    targetFPS: performanceMode === 'low' ? 30 : performanceMode === 'medium' ? 45 : 60,
    physicsEngine: 'cannon' as const
  };

  // Handle feature toggles
  const handleFeatureToggleCallback = useCallback((featureId: string, enabled: boolean) => {
    handleFeatureToggle(featureId, enabled);
  }, [handleFeatureToggle]);

  return (
    <div className="babylon-workspace-container">
      {/* Canvas for Babylon.js */}
      <canvas
        ref={canvasRef}
        className="babylon-canvas"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Babylon Scene Manager */}
      <BabylonSceneManager
        canvasRef={canvasRef}
        config={sceneConfig}
        onMeshSelect={handleMeshSelect}
        onSceneReady={handleSceneReady}
      />

      {/* Feature Manager */}
      <FeatureManager onFeatureToggle={handleFeatureToggleCallback}>
        {/* UI Components will go here in Phase 2 */}
        <div className="workspace-ui">
          {/* Status indicators */}
          <div className="workspace-status">
            <div className="status-item">
              <span>Status:</span>
              <span className={state.isInitialized ? 'text-green-500' : 'text-yellow-500'}>
                {state.isInitialized ? 'Ready' : 'Initializing...'}
              </span>
            </div>
            <div className="status-item">
              <span>Loading:</span>
              <span className={state.isLoading ? 'text-yellow-500' : 'text-green-500'}>
                {state.isLoading ? 'Yes' : 'No'}
              </span>
            </div>
            {state.error && (
              <div className="status-item error">
                <span>Error:</span>
                <span className="text-red-500">{state.error}</span>
              </div>
            )}
          </div>

          {/* Selected mesh info */}
          {state.selectedMesh && (
            <div className="selected-mesh-info">
              <h3>Selected: {state.selectedMesh.name}</h3>
              <p>Position: {state.selectedMesh.position.toString()}</p>
              <p>Rotation: {state.selectedMesh.rotation.toString()}</p>
              <p>Scale: {state.selectedMesh.scaling.toString()}</p>
            </div>
          )}

          {/* Feature controls */}
          <div className="feature-controls">
            <h3>Features</h3>
            <div className="feature-buttons">
              <button
                onClick={() => handleFeatureToggleCallback('showMaterialEditor', !isFeatureEnabled('showMaterialEditor'))}
                className={isFeatureEnabled('showMaterialEditor') ? 'active' : ''}
              >
                Material Editor
              </button>
              <button
                onClick={() => handleFeatureToggleCallback('showMinimap', !isFeatureEnabled('showMinimap'))}
                className={isFeatureEnabled('showMinimap') ? 'active' : ''}
              >
                Minimap
              </button>
              <button
                onClick={() => handleFeatureToggleCallback('showMeasurementTool', !isFeatureEnabled('showMeasurementTool'))}
                className={isFeatureEnabled('showMeasurementTool') ? 'active' : ''}
              >
                Measure Tool
              </button>
            </div>
          </div>
        </div>
      </FeatureManager>
    </div>
  );
}

// Main exported component with provider
export function RefactoredBabylonWorkspace(props: RefactoredBabylonWorkspaceProps) {
  return (
    <WorkspaceProvider>
      <RefactoredBabylonWorkspaceContent {...props} />
    </WorkspaceProvider>
  );
}

export default RefactoredBabylonWorkspace;
