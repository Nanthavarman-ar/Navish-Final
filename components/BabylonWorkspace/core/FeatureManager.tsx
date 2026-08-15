import React, { useCallback, useMemo, createContext, useContext, useRef } from 'react';
import { featureCategories, featureCategoriesArray, Feature, FEATURE_CATEGORIES } from '../../../config/featureCategories';
import { useWorkspace } from './WorkspaceContext';
import { AIManager } from '../../AIManager';
import { BIMManager } from '../../BIMManager';
import { XRManager } from '../../XRManager';

interface FeatureManagerProps {
  onFeatureToggle?: (featureId: string, enabled: boolean) => void;
  onCategoryToggle?: (category: string, visible: boolean) => void;
  children?: React.ReactNode;
}

export function FeatureManager({ onFeatureToggle, onCategoryToggle, children }: FeatureManagerProps) {
  const { state, dispatch, toggleFeature, toggleCategoryPanel } = useWorkspace();

  // Handle feature toggle
  const handleFeatureToggle = useCallback((featureId: string, enabled: boolean) => {
    toggleFeature(featureId, enabled);

    // AI-specific integrations
    if (!aiManagerRef.current && state.scene) {
      aiManagerRef.current = AIManager.getInstance(state.scene);
    }
    const aiManager = aiManagerRef.current;

    if (enabled) {
      switch (featureId) {
        case 'aiAssistant':
          if (aiManager) aiManager.startVoiceListening();
          break;
        case 'handTracking':
          if (aiManager) aiManager.toggleGestureDetection();
          break;
        case 'hiddenDetails':
          if (aiManager) aiManager.toggleHiddenDetails();
          break;
        default:
          break;
      }
    } else {
      switch (featureId) {
        case 'aiAssistant':
          if (aiManager) aiManager.stopVoiceListening();
          break;
        case 'handTracking':
          if (aiManager) aiManager.toggleGestureDetection();
          break;
        default:
          break;
      }
    }

    if (onFeatureToggle) {
      onFeatureToggle(featureId, enabled);
    }
  }, [toggleFeature, onFeatureToggle, state.scene]);

  // Handle category panel toggle
  const handleCategoryToggle = useCallback((category: string, visible: boolean) => {
    toggleCategoryPanel(category, visible);

    if (onCategoryToggle) {
      onCategoryToggle(category, visible);
    }
  }, [toggleCategoryPanel, onCategoryToggle]);

  // Get features by category
  const featuresByCategory = useMemo(() => {
    return Object.entries(featureCategories).reduce((acc, [category, features]) => {
      acc[category] = features.filter((feature: Feature) =>
        state.activeFeatures.has(feature.id)
      );
      return acc;
    }, {} as Record<string, Feature[]>);
  }, [state.activeFeatures]);

  // Get enabled features
  const enabledFeatures = useMemo(() => {
    return featureCategoriesArray.filter((feature: Feature) =>
      state.activeFeatures.has(feature.id)
    );
  }, [state.activeFeatures]);

  // Get disabled features
  const disabledFeatures = useMemo(() => {
    return featureCategoriesArray.filter((feature: Feature) =>
      !state.activeFeatures.has(feature.id)
    );
  }, [state.activeFeatures]);

  // Check if feature is enabled
  const isFeatureEnabled = useCallback((featureId: string) => {
    return state.activeFeatures.has(featureId);
  }, [state.activeFeatures]);

  // Check if category panel is visible
  const isCategoryPanelVisible = useCallback((category: string) => {
    return state.categoryPanelVisible[category] || false;
  }, [state.categoryPanelVisible]);

  // Get features for a specific category
  const getFeaturesByCategory = useCallback((category: string) => {
    return featuresByCategory[category] || [];
  }, [featuresByCategory]);

  // Get all categories
  const getCategories = useCallback(() => {
    return Object.keys(featureCategories);
  }, []);

  // Enable all features in a category
  const enableCategory = useCallback((category: string) => {
    const categoryFeatures = featureCategories[category] || [];
    categoryFeatures.forEach((feature: Feature) => {
      toggleFeature(feature.id, true);
    });
  }, [toggleFeature]);

  // Disable all features in a category
  const disableCategory = useCallback((category: string) => {
    const categoryFeatures = featureCategories[category] || [];
    categoryFeatures.forEach((feature: Feature) => {
      toggleFeature(feature.id, false);
    });
  }, [toggleFeature]);

  // Enable all features
  const enableAllFeatures = useCallback(() => {
    featureCategoriesArray.forEach((feature: Feature) => {
      toggleFeature(feature.id, true);
    });
  }, [toggleFeature]);

  // Disable all features
  const disableAllFeatures = useCallback(() => {
    featureCategoriesArray.forEach((feature: Feature) => {
      toggleFeature(feature.id, false);
    });
  }, [toggleFeature]);

  // Get feature statistics
  const getFeatureStats = useCallback(() => {
    const totalFeatures = featureCategoriesArray.length;
    const enabledCount = state.activeFeatures.size;
    const disabledCount = totalFeatures - enabledCount;

    return {
      total: totalFeatures,
      enabled: enabledCount,
      disabled: disabledCount,
      percentage: totalFeatures > 0 ? Math.round((enabledCount / totalFeatures) * 100) : 0,
    };
  }, [state.activeFeatures.size]);

  // Get category statistics
  const getCategoryStats = useCallback(() => {
    const stats: Record<string, { total: number; enabled: number; percentage: number }> = {};

    Object.entries(featureCategories).forEach(([category, features]) => {
      const enabled = features.filter((f: Feature) => state.activeFeatures.has(f.id)).length;
      stats[category] = {
        total: features.length,
        enabled,
        percentage: features.length > 0 ? Math.round((enabled / features.length) * 100) : 0,
      };
    });

    return stats;
  }, [state.activeFeatures]);

  // Initialize managers
  const aiManagerRef = useRef<AIManager | null>(null);
  const bimManagerRef = useRef<BIMManager | null>(null);
  const xrManagerRef = useRef<XRManager | null>(null);

  // Initialize managers on mount
  React.useEffect(() => {
    // Managers will be initialized when first used to avoid null engine/scene issues
    aiManagerRef.current = null;
    bimManagerRef.current = null;
    xrManagerRef.current = null;
  }, []);

  // Get BIMManager instance
  const getBIMManager = useCallback((): BIMManager => {
    if (!bimManagerRef.current && state.engine && state.scene) {
      bimManagerRef.current = BIMManager.getInstance(state.engine, state.scene);
    }
    if (!bimManagerRef.current) {
      throw new Error('BIMManager not initialized. Ensure engine and scene are available.');
    }
    return bimManagerRef.current;
  }, [state.engine, state.scene]);

  // Button-triggered feature methods
  const toggleAI = useCallback(() => {
    if (!aiManagerRef.current && state.scene) {
      aiManagerRef.current = AIManager.getInstance(state.scene);
    }
    const aiManager = aiManagerRef.current;
    if (!aiManager) return;

    const isEnabled = state.activeFeatures.has('aiAssistant');
    if (isEnabled) {
      aiManager.stopVoiceListening();
      toggleFeature('aiAssistant', false);
    } else {
      aiManager.startVoiceListening();
      toggleFeature('aiAssistant', true);
    }
  }, [state.activeFeatures, toggleFeature, state.scene]);

  // Import BIM file handler
  const importBIMFile = useCallback(async (file: File): Promise<void> => {
    try {
      dispatch({ type: 'SET_BIM_UPLOAD_STATE', payload: 'uploading' });
      dispatch({ type: 'SET_BIM_ERROR', payload: null });

      const bimManager = getBIMManager();
      await bimManager.importBIMModel(file, 'custom');

      dispatch({ type: 'SET_BIM_UPLOAD_STATE', payload: 'success' });
      toggleFeature('bimImport', true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during BIM import';
      dispatch({ type: 'SET_BIM_ERROR', payload: message });
      dispatch({ type: 'SET_BIM_UPLOAD_STATE', payload: 'error' });
      console.error('Failed to import BIM:', error);
    }
  }, [dispatch, getBIMManager, toggleFeature]);

  const importBIM = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ifc,.rvt,.dwg';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        for (const file of Array.from(files)) {
          await importBIMFile(file);
        }
      }
    };
    input.click();
  }, [importBIMFile]);

  const toggleClashDetection = useCallback(() => {
    if (!bimManagerRef.current) {
      if (!state.engine || !state.scene) {
        console.error('Engine or scene not ready for BIMManager');
        return;
      }
      bimManagerRef.current = new BIMManager(state.engine, state.scene);
    }
    const isEnabled = state.activeFeatures.has('clashDetection');
    if (isEnabled) {
      bimManagerRef.current.disableClashDetection();
    } else {
      bimManagerRef.current.enableClashDetection();
    }
    toggleFeature('clashDetection', !isEnabled);
  }, [state.engine, state.scene, state.activeFeatures, toggleFeature]);

  const toggleWallPeeling = useCallback(() => {
    if (!bimManagerRef.current) {
      if (!state.engine || !state.scene) {
        console.error('Engine or scene not ready for BIMManager');
        return;
      }
      bimManagerRef.current = new BIMManager(state.engine, state.scene);
    }
    const isEnabled = state.activeFeatures.has('wallPeelingMode');
    bimManagerRef.current.toggleWallPeeling();
    toggleFeature('wallPeelingMode', !isEnabled);
  }, [state.engine, state.scene, state.activeFeatures, toggleFeature]);

  const toggleHiddenDetails = useCallback(() => {
    if (!bimManagerRef.current) {
      if (!state.engine || !state.scene) {
        console.error('Engine or scene not ready for BIMManager');
        return;
      }
      bimManagerRef.current = new BIMManager(state.engine, state.scene);
    }
    const isEnabled = state.activeFeatures.has('hiddenDetails');
    bimManagerRef.current.toggleHiddenDetails();
    toggleFeature('hiddenDetails', !isEnabled);
  }, [state.engine, state.scene, state.activeFeatures, toggleFeature]);

  const showCostEstimation = useCallback(() => {
    try {
      const bimManager = getBIMManager();
      const models = bimManager.getAllModels();
      if (models.length > 0) {
        const modelId = models[0].id;
        const costData = bimManager.getCostDisplayData(modelId);
        if (costData) {
          dispatch({ type: 'SET_COST_BREAKDOWN', payload: costData });
        }
      }
      toggleFeature('costEstimation', true);
    } catch (error) {
      console.error('Failed to show cost estimation:', error);
    }
  }, [getBIMManager, dispatch, toggleFeature]);

  const toggleVR = useCallback(async () => {
    try {
      if (!xrManagerRef.current) {
        if (!state.scene) {
          console.error('Scene not ready for XRManager');
          return;
        }
        xrManagerRef.current = XRManager.getInstance(state.scene);
      }
      const isEnabled = state.activeFeatures.has('vrMode');
      if (isEnabled) {
        await xrManagerRef.current.exitXR();
        toggleFeature('vrMode', false);
      } else {
        const success = await xrManagerRef.current.enterVR();
        if (success) {
          toggleFeature('vrMode', true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle VR:', error);
    }
  }, [state.scene, state.activeFeatures, toggleFeature]);

  const toggleAR = useCallback(async () => {
    try {
      if (!xrManagerRef.current) {
        if (!state.scene) {
          console.error('Scene not ready for XRManager');
          return;
        }
        xrManagerRef.current = XRManager.getInstance(state.scene);
      }
      const isEnabled = state.activeFeatures.has('arMode');
      if (isEnabled) {
        await xrManagerRef.current.exitXR();
        toggleFeature('arMode', false);
      } else {
        const success = await xrManagerRef.current.enterAR();
        if (success) {
          toggleFeature('arMode', true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle AR:', error);
    }
  }, [state.scene, state.activeFeatures, toggleFeature]);

  const toggleHandTracking = useCallback(() => {
    if (!xrManagerRef.current) {
      if (!state.scene) {
        console.error('Scene not ready for XRManager');
        return;
      }
      xrManagerRef.current = XRManager.getInstance(state.scene);
    }
    const isEnabled = state.activeFeatures.has('handTracking');
    xrManagerRef.current.toggleHandTracking();
    toggleFeature('handTracking', !isEnabled);
  }, [state.scene, state.activeFeatures, toggleFeature]);

  const toggleSpatialAudio = useCallback(() => {
    const isEnabled = state.activeFeatures.has('spatialAudio');
    toggleFeature('spatialAudio', !isEnabled);
  }, [state.activeFeatures, toggleFeature]);

  const toggleWalkMode = useCallback(() => {
    if (aiManagerRef.current) {
      aiManagerRef.current.setNavigationMode('walk');
    }
    toggleFeature('walkMode', true);
    toggleFeature('flyMode', false);
    toggleFeature('teleportMode', false);
  }, [toggleFeature]);

  const toggleFlyMode = useCallback(() => {
    if (aiManagerRef.current) {
      aiManagerRef.current.setNavigationMode('fly');
    }
    toggleFeature('walkMode', false);
    toggleFeature('flyMode', true);
    toggleFeature('teleportMode', false);
  }, [toggleFeature]);

  const toggleTeleportMode = useCallback(() => {
    if (aiManagerRef.current) {
      aiManagerRef.current.setNavigationMode('teleport');
    }
    toggleFeature('walkMode', false);
    toggleFeature('flyMode', false);
    toggleFeature('teleportMode', true);
  }, [toggleFeature]);

  // Context value
  const contextValue: FeatureManagerContextType = {
    // State
    activeFeatures: state.activeFeatures,
    categoryPanelVisible: state.categoryPanelVisible,

    // Feature data
    featuresByCategory,
    enabledFeatures,
    disabledFeatures,
    featureCategories: Object.keys(featureCategories),

    // Feature checks
    isFeatureEnabled,
    isCategoryPanelVisible,

    // Feature operations
    handleFeatureToggle,
    handleCategoryToggle,
    toggleFeature,
    toggleCategoryPanel,

    // Category operations
    getFeaturesByCategory,
    getCategories,
    enableCategory,
    disableCategory,

    // Bulk operations
    enableAllFeatures,
    disableAllFeatures,

    // Statistics
    getFeatureStats,
    getCategoryStats,

    // Button-triggered feature methods
    toggleAI,
    importBIM,
    toggleClashDetection,
    toggleWallPeeling,
    toggleHiddenDetails,
    showCostEstimation,
    toggleVR,
    toggleAR,
    toggleHandTracking,
    toggleSpatialAudio,
    toggleWalkMode,
    toggleFlyMode,
    toggleTeleportMode,

    // Manager access
    getBIMManager,
    importBIMFile,
  };

  return (
    <FeatureManagerContext.Provider value={contextValue}>
      {children}
    </FeatureManagerContext.Provider>
  );
}

// Context for FeatureManager
interface FeatureManagerContextType {
  activeFeatures: Set<string>;
  categoryPanelVisible: Record<string, boolean>;
  featuresByCategory: Record<string, Feature[]>;
  enabledFeatures: Feature[];
  disabledFeatures: Feature[];
  featureCategories: string[];
  isFeatureEnabled: (featureId: string) => boolean;
  isCategoryPanelVisible: (category: string) => boolean;
  handleFeatureToggle: (featureId: string, enabled: boolean) => void;
  handleCategoryToggle: (category: string, visible: boolean) => void;
  toggleFeature: (featureId: string, enabled: boolean) => void;
  toggleCategoryPanel: (category: string, visible: boolean) => void;
  getFeaturesByCategory: (category: string) => Feature[];
  getCategories: () => string[];
  enableCategory: (category: string) => void;
  disableCategory: (category: string) => void;
  enableAllFeatures: () => void;
  disableAllFeatures: () => void;
  getFeatureStats: () => { total: number; enabled: number; disabled: number; percentage: number };
  getCategoryStats: () => Record<string, { total: number; enabled: number; percentage: number }>;
  // Button-triggered feature methods
  toggleAI: () => void;
  importBIM: () => Promise<void>;
  toggleClashDetection: () => void;
  toggleWallPeeling: () => void;
  toggleHiddenDetails: () => void;
  showCostEstimation: () => void;
  toggleVR: () => Promise<void>;
  toggleAR: () => Promise<void>;
  toggleHandTracking: () => void;
  toggleSpatialAudio: () => void;
  toggleWalkMode: () => void;
  toggleFlyMode: () => void;
  toggleTeleportMode: () => void;
  // Manager access
  getBIMManager: () => BIMManager;
  importBIMFile: (file: File) => Promise<void>;
}

const FeatureManagerContext = createContext<FeatureManagerContextType | undefined>(undefined);

// Hook to use FeatureManager context
export function useFeatureManager() {
  const context = useContext(FeatureManagerContext);
  if (context === undefined) {
    throw new Error('useFeatureManager must be used within a FeatureManager');
  }
  return context;
}

// Feature category components
interface FeatureCategoryProps {
  category: string;
  title: string;
  features: Feature[];
  isVisible: boolean;
  onToggle: (category: string, visible: boolean) => void;
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
}

export function FeatureCategory({
  category,
  title,
  features,
  isVisible,
  onToggle,
  onFeatureToggle
}: FeatureCategoryProps) {
  if (!isVisible) return null;

  return (
    <div className="feature-category">
      <div className="category-header">
        <h3>{title}</h3>
        <button onClick={() => onToggle(category, false)}>Close</button>
      </div>
      <div className="category-features">
        {features.map((feature: Feature) => (
          <FeatureItem
            key={feature.id}
            feature={feature}
            isEnabled={true}
            onToggle={onFeatureToggle}
          />
        ))}
      </div>
    </div>
  );
}

interface FeatureItemProps {
  feature: Feature;
  isEnabled: boolean;
  onToggle: (featureId: string, enabled: boolean) => void;
}

export function FeatureItem({ feature, isEnabled, onToggle }: FeatureItemProps) {
  return (
    <div className={`feature-item ${isEnabled ? 'enabled' : 'disabled'}`}>
      <div className="feature-icon">
        <feature.icon className="w-4 h-4" />
      </div>
      <div className="feature-info">
        <div className="feature-name">{feature.name}</div>
        <div className="feature-description">{feature.description}</div>
        <div className="feature-hotkey">Hotkey: {feature.hotkey}</div>
      </div>
      <button
        className={`feature-toggle ${isEnabled ? 'active' : ''}`}
        onClick={() => onToggle(feature.id, !isEnabled)}
        aria-label={`Toggle ${feature.name}`}
      >
        {isEnabled ? 'On' : 'Off'}
      </button>
    </div>
  );
}

// Feature toolbar component
interface FeatureToolbarProps {
  onFeatureToggle?: (featureId: string, enabled: boolean) => void;
  onCategoryToggle?: (category: string, visible: boolean) => void;
}

export function FeatureToolbar({ onFeatureToggle, onCategoryToggle }: FeatureToolbarProps) {
  const { enabledFeatures, handleFeatureToggle, handleCategoryToggle } = useFeatureManager();

  const handleFeatureClick = useCallback((feature: Feature) => {
    handleFeatureToggle(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id));

    if (onFeatureToggle) {
      onFeatureToggle(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id));
    }
  }, [handleFeatureToggle, enabledFeatures, onFeatureToggle]);

  const handleCategoryClick = useCallback((category: string) => {
    handleCategoryToggle(category, true);

    if (onCategoryToggle) {
      onCategoryToggle(category, true);
    }
  }, [handleCategoryToggle, onCategoryToggle]);

  return (
    <div className="feature-toolbar">
      <div className="toolbar-section">
        <h4>Active Features</h4>
        <div className="active-features">
          {enabledFeatures.slice(0, 10).map((feature: Feature) => (
            <button
              key={feature.id}
              className="feature-button active"
              onClick={() => handleFeatureClick(feature)}
              title={`${feature.name} (${feature.hotkey})`}
            >
              <feature.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <h4>Categories</h4>
        <div className="feature-categories">
          {Object.entries(FEATURE_CATEGORIES).map(([key, category]) => (
            <button
              key={category}
              className="category-button"
              onClick={() => handleCategoryClick(category)}
              title={`Open ${key.toLowerCase()} features`}
            >
              {key.charAt(0) + key.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
