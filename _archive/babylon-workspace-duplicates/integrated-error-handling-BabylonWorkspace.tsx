import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AIErrorHandler } from './components/AIErrorHandlerFixed';
import { useRetryUtils } from '../utils/retryUtilsFixed';
import { ErrorHandlingTestSuite } from './components/ErrorHandlingTestSuiteFixed';
import { NetworkMonitor } from './components/NetworkMonitor';
import { OfflineFallback } from './components/OfflineFallback';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import existing Babylon.js dependencies
import {
  Engine,
  Scene,
  ArcRotateCamera,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  AbstractMesh,
  Mesh,
  StandardMaterial,
  PBRMaterial,
  ShadowGenerator,
  DefaultRenderingPipeline,
  SSAORenderingPipeline,
  SceneOptimizer,
  SceneOptimizerOptions,
  HardwareScalingOptimization,
  ShadowsOptimization,
  PostProcessesOptimization,
  LensFlaresOptimization,
  ParticlesOptimization,
  RenderTargetsOptimization,
  MergeMeshesOptimization,
  GizmoManager,
  UtilityLayerRenderer,
  PickingInfo,
  AssetContainer,
  Material,
  SceneLoader
} from '@babylonjs/core';

// Import other existing dependencies
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { QRCodeTour } from './src/integrated/QRCodeTour';

// Error handling wrapper component
const BabylonWorkspaceWithErrorHandling: React.FC<any> = (props) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [errorState, setErrorState] = useState<{
    hasError: boolean;
    error: Error | null;
    errorInfo: any;
  }>({
    hasError: false,
    error: null,
    errorInfo: null
  });

  const { retryWithBackoff, isRetrying } = useRetryUtils({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000
  });

  // Network monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced error handler
  const handleError = useCallback((error: Error, errorInfo?: any) => {
    console.error('BabylonWorkspace Error:', error, errorInfo);
    setErrorState({
      hasError: true,
      error,
      errorInfo
    });
  }, []);

  // Retry handler for failed operations
  const handleRetry = useCallback(async (operation: () => Promise<any>) => {
    try {
      await retryWithBackoff(operation);
      setErrorState({ hasError: false, error: null, errorInfo: null });
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      handleError(retryError as Error);
    }
  }, [retryWithBackoff, handleError]);

  // If offline, show offline fallback
  if (!isOnline) {
    return (
      <OfflineFallback
        onRetry={() => window.location.reload()}
        message="3D workspace is currently offline. Please check your connection."
      />
    );
  }

  // If there's an error, show error handler
  if (errorState.hasError) {
    return (
      <AIErrorHandler
        error={errorState.error!}
        errorInfo={errorState.errorInfo}
        onRetry={() => handleRetry(() => Promise.resolve())}
        context="BabylonWorkspace"
      />
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <NetworkMonitor onNetworkChange={setIsOnline}>
        <div className="relative w-full h-screen bg-gray-900">
          {/* Error Handling Test Suite - Development Only */}
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute top-4 left-4 z-50">
              <ErrorHandlingTestSuite />
            </div>
          )}

          {/* Network Status Indicator */}
          <div className={`absolute top-4 right-4 z-40 px-3 py-1 rounded-full text-sm font-medium ${
            isOnline
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </div>

          {/* Retry Status Indicator */}
          {isRetrying && (
            <div className="absolute top-16 right-4 z-40 px-3 py-1 rounded-full text-sm font-medium bg-yellow-600 text-white">
              🔄 Retrying...
            </div>
          )}

          {/* Main BabylonWorkspace content would go here */}
          <BabylonWorkspaceContent
            {...props}
            isOnline={isOnline}
            onError={handleError}
            onRetry={handleRetry}
          />
        </div>
      </NetworkMonitor>
    </ErrorBoundary>
  );
};

// Main content component (extracted from original BabylonWorkspace)
const BabylonWorkspaceContent: React.FC<any> = ({
  workspaceId,
  isAdmin = false,
  layoutMode = 'standard',
  enableXR = false,
  xrOptions = {},
  enablePhysics,
  renderingQuality,
  performanceMode: propPerformanceMode,
  isOnline,
  onError,
  onRetry
}) => {
  // ... existing refs and state ...

  // Enhanced Firebase operations with retry logic
  const saveTourWithRetry = useCallback(async (tour: any) => {
    const operation = async () => {
      await addDoc(collection(db, 'tours'), tour);
    };

    try {
      await onRetry(operation);
    } catch (error) {
      onError(new Error(`Failed to save tour: ${error}`));
    }
  }, [onRetry, onError]);

  const loadToursWithRetry = useCallback(async () => {
    const operation = async () => {
      const querySnapshot = await getDocs(collection(db, 'tours'));
      return querySnapshot.docs.map(doc => doc.data());
    };

    try {
      return await onRetry(operation);
    } catch (error) {
      onError(new Error(`Failed to load tours: ${error}`));
      return [];
    }
  }, [onRetry, onError]);

  // Enhanced model loading with retry logic
  const loadModelWithRetry = useCallback(async (file: File | string) => {
    const operation = async () => {
      if (!sceneManager) throw new Error('Scene manager not initialized');

      const modelId = `model_${Date.now()}`;
      let url: string;

      if (typeof file === 'string') {
        url = file;
      } else {
        url = URL.createObjectURL(file);
      }

      const result = await SceneLoader.ImportMeshAsync('', '', url, sceneManager.getScene());

      if (result.meshes.length === 0) {
        throw new Error('No meshes found in model');
      }

      const container = new AssetContainer(sceneManager.getScene());
      result.meshes.forEach(mesh => container.meshes.push(mesh));

      sceneManager.autoCenterAndScale(result.meshes);

      if (sceneManager.shadowGenerator) {
        result.meshes.forEach(mesh => {
          if (mesh instanceof Mesh) {
            sceneManager.shadowGenerator!.addShadowCaster(mesh);
            mesh.receiveShadows = true;
          }
        });
      }

      if (typeof file !== 'string') {
        URL.revokeObjectURL(url);
      }

      return modelId;
    };

    try {
      const modelId = await onRetry(operation);
      setLoadedModels(prev => [...prev, modelId]);
      return modelId;
    } catch (error) {
      onError(new Error(`Failed to load model: ${error}`));
      return null;
    }
  }, [sceneManager, onRetry, onError]);

  // Enhanced collaboration with error handling
  const setupCollaborationWithRetry = useCallback(async () => {
    const operation = async () => {
      const url = `wss://your-collab-server.example/ws/${workspaceId}`;
      const socket = new WebSocket(url);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        socket.onopen = () => {
          clearTimeout(timeout);
          socket.send(JSON.stringify({
            type: 'join',
            workspaceId,
            user: { name: 'User_' + Math.floor(Math.random() * 1000) }
          }));
          resolve(socket);
        };

        socket.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    };

    try {
      const socket = await onRetry(operation);
      setWs(socket as WebSocket);
      setCollabStatus('connected');
    } catch (error) {
      onError(new Error(`Failed to connect to collaboration: ${error}`));
      setCollabStatus('disconnected');
    }
  }, [workspaceId, onRetry, onError]);

  // ... rest of the existing component logic with error handling integration ...

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Main 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full outline-none-canvas"
      />

      {/* Error Recovery Panel */}
      <div className="absolute bottom-4 left-4 w-96 bg-black/80 text-white border border-gray-600 rounded-lg p-4">
        <h3 className="text-sm font-bold mb-3">Error Recovery</h3>

        <div className="space-y-2">
          <button
            onClick={() => onRetry(() => Promise.resolve())}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Retry Failed Operations'}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Reload Workspace
          </button>

          <button
            onClick={() => setErrorState({ hasError: false, error: null, errorInfo: null })}
            className="w-full px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Errors
          </button>
        </div>

        {/* Error Details */}
        {errorState.error && (
          <div className="mt-3 p-2 bg-red-900/50 rounded text-xs">
            <div className="font-bold text-red-300">Last Error:</div>
            <div className="text-red-200">{errorState.error.message}</div>
          </div>
        )}
      </div>

      {/* ... rest of the existing UI ... */}
    </div>
  );
};

// Export the enhanced component
export default BabylonWorkspaceWithErrorHandling;
