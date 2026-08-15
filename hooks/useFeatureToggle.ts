import { useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import { Feature } from '../config/featureCategories';

export interface FeatureToggleHandlers {
  [key: string]: (enabled: boolean) => void;
}

export const useFeatureToggle = (
  featureStates: Record<string, boolean>,
  setFeatureStates: Dispatch<SetStateAction<Record<string, boolean>>>
) => {
  // Create a mapping of feature IDs to their state keys
  const featureIdToStateKey = useMemo(() => {
    const mapping: Record<string, string> = {};

    // Core Features
    mapping['materialEditor'] = 'showMaterialEditor';
    mapping['minimap'] = 'showMinimap';
    mapping['measure'] = 'showMeasurementTool';
    mapping['autoFurnish'] = 'showAutoFurnish';
    mapping['aiCoDesigner'] = 'showAICoDesigner';
    mapping['moodScene'] = 'showMoodScene';
    mapping['seasonalDecor'] = 'showSeasonalDecor';
    mapping['arScale'] = 'showARScale';
    mapping['scenario'] = 'showScenario';
    mapping['animationTimeline'] = 'showAnimationTimeline';
    mapping['bimIntegration'] = 'showBIMIntegration';

    // Navigation & Controls Features
    mapping['movementControlChecker'] = 'showMovementControlChecker';
    mapping['teleportManager'] = 'showTeleportManager';
    mapping['swimMode'] = 'showSwimMode';

    // Analysis & Simulation Features
    mapping['multiSensoryPreview'] = 'showMultiSensoryPreview';
    mapping['noiseSimulation'] = 'showNoiseSimulation';
    mapping['propertyInspector'] = 'showPropertyInspector';
    mapping['sceneBrowser'] = 'showSceneBrowser';
    mapping['siteContextGenerator'] = 'showSiteContextGenerator';
    mapping['smartAlternatives'] = 'showSmartAlternatives';
    mapping['soundPrivacySimulation'] = 'showSoundPrivacySimulation';
    mapping['sunlightAnalysis'] = 'showSunlightAnalysis';
    mapping['sustainabilityCompliancePanel'] = 'showSustainabilityCompliancePanel';
    mapping['windTunnelSimulation'] = 'showWindTunnelSimulation';

    // Advanced Features
    mapping['pathTracing'] = 'showPathTracing';
    mapping['pHashIntegration'] = 'showPHashIntegration';
    mapping['progressiveLoader'] = 'showProgressiveLoader';
    mapping['presentationManager'] = 'showPresentationManager';
    mapping['presenterMode'] = 'showPresenterMode';
    mapping['quantumSimulationInterface'] = 'showQuantumSimulationInterface';

    // Additional simulation features
    mapping['weather'] = 'showWeather';
    mapping['wind'] = 'showWind';
    mapping['noise'] = 'showNoise';

    // AI features
    mapping['aiAdvisor'] = 'showAIAdvisor';
    mapping['voiceAssistant'] = 'showVoiceAssistant';

    // Analysis features
    mapping['ergonomic'] = 'showErgonomic';
    mapping['energy'] = 'showEnergy';
    mapping['cost'] = 'showCost';
    mapping['beforeAfter'] = 'showBeforeAfter';
    mapping['comparativeTour'] = 'showComparativeTour';
    mapping['roiCalculator'] = 'showROICalculator';

    // Collaboration features
    mapping['multiUser'] = 'showMultiUser';
    mapping['chat'] = 'showChat';
    mapping['sharing'] = 'showSharing';

    // Immersive features
    mapping['vr'] = 'showVR';
    mapping['ar'] = 'showAR';
    mapping['spatialAudio'] = 'showSpatialAudio';
    mapping['haptic'] = 'showHaptic';
    mapping['xr'] = 'showXRManager';

    // Geo-location features
    mapping['geoLocation'] = 'showGeoLocation';
    mapping['geoWorkspaceArea'] = 'showGeoWorkspaceArea';
    mapping['geoSync'] = 'showGeoSync';

    // Enhanced Real-Time Components
    mapping['wetMaterialManager'] = 'showWetMaterialManager';
    mapping['underwaterMode'] = 'showUnderwaterMode';
    mapping['waterShader'] = 'showWaterShader';
    mapping['voiceChat'] = 'showVoiceChat';
    mapping['vrarMode'] = 'showVRARMode';

    // Specialized Components
    mapping['cameraViews'] = 'showCameraViews';
    mapping['circulationFlowSimulation'] = 'showCirculationFlowSimulation';
    mapping['collabManager'] = 'showCollabManager';
    mapping['comprehensiveSimulation'] = 'showComprehensiveSimulation';
    mapping['constructionOverlay'] = 'showConstructionOverlay';
    mapping['flood'] = 'showFloodSimulation';
    mapping['shadow'] = 'showShadowImpactAnalysis';
    mapping['traffic'] = 'showTrafficParkingSimulation';
    mapping['annotations'] = 'showAnnotations';

    return mapping;
  }, []);

  // Generic feature toggle handler
  const toggleFeature = useCallback((featureId: string, enabled: boolean) => {
    const stateKey = featureIdToStateKey[featureId];
    if (stateKey) {
      setFeatureStates((prev: Record<string, boolean>) => ({
        ...prev,
        [stateKey]: enabled
      }));
    }
  }, [featureIdToStateKey, setFeatureStates]);

  // Batch toggle multiple features
  const toggleMultipleFeatures = useCallback((featureIds: string[], enabled: boolean) => {
    const stateUpdates: Record<string, boolean> = {};

    featureIds.forEach(featureId => {
      const stateKey = featureIdToStateKey[featureId];
      if (stateKey) {
        stateUpdates[stateKey] = enabled;
      }
    });

    setFeatureStates((prev: Record<string, boolean>) => ({
      ...prev,
      ...stateUpdates
    }));
  }, [featureIdToStateKey, setFeatureStates]);

  // Toggle features by category
  const toggleCategoryFeatures = useCallback((category: string, enabled: boolean, features: Feature[]) => {
    const categoryFeatureIds = features
      .filter(feature => feature.category === category)
      .map(feature => feature.id);

    toggleMultipleFeatures(categoryFeatureIds, enabled);
  }, [toggleMultipleFeatures]);

  // Get feature state by ID
  const getFeatureState = useCallback((featureId: string): boolean => {
    const stateKey = featureIdToStateKey[featureId];
    return stateKey ? featureStates[stateKey] : false;
  }, [featureIdToStateKey, featureStates]);

  // Get all active features
  const getActiveFeatures = useCallback(() => {
    return Object.entries(featureStates)
      .filter(([_, isActive]) => isActive)
      .map(([stateKey, _]) => {
        // Reverse lookup to get feature ID from state key
        const featureId = Object.entries(featureIdToStateKey)
          .find(([_, key]) => key === stateKey)?.[0];
        return featureId || stateKey;
      });
  }, [featureStates, featureIdToStateKey]);

  // Get features by category
  const getFeaturesByCategory = useCallback((category: string, features: Feature[]) => {
    return features.filter(feature => feature.category === category);
  }, []);

  // Check if any feature in a category is active
  const isCategoryActive = useCallback((category: string, features: Feature[]) => {
    const categoryFeatures = getFeaturesByCategory(category, features);
    return categoryFeatures.some(feature => getFeatureState(feature.id));
  }, [getFeaturesByCategory, getFeatureState]);

  // Get count of active features in a category
  const getCategoryActiveCount = useCallback((category: string, features: Feature[]) => {
    const categoryFeatures = getFeaturesByCategory(category, features);
    return categoryFeatures.filter(feature => getFeatureState(feature.id)).length;
  }, [getFeaturesByCategory, getFeatureState]);

  return {
    toggleFeature,
    toggleMultipleFeatures,
    toggleCategoryFeatures,
    getFeatureState,
    getActiveFeatures,
    getFeaturesByCategory,
    isCategoryActive,
    getCategoryActiveCount
  };
};
