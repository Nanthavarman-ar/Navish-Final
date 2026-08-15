// Unified feature state interface to replace 200+ individual props
export interface FeatureState {
  // Core Features
  essential: {
    materialEditor: boolean;
    minimap: boolean;
    measure: boolean;
    autoFurnish: boolean;
    aiCoDesigner: boolean;
    moodScene: boolean;
    seasonalDecor: boolean;
    arScale: boolean;
    scenario: boolean;
    animationTimeline: boolean;
    bimIntegration: boolean;
    propertyInspector: boolean;
    sceneBrowser: boolean;
    materialManager: boolean;
    lightingPresets: boolean;
  };

  // Simulation Features
  simulation: {
    weather: boolean;
    flood: boolean;
    enhancedFlood: boolean;
    wind: boolean;
    noise: boolean;
    traffic: boolean;
    circulation: boolean;
    shadow: boolean;
    sunlight: boolean;
    windTunnel: boolean;
  };

  // Analysis Features
  analysis: {
    ergonomic: boolean;
    energy: boolean;
    cost: boolean;
    beforeAfter: boolean;
    comparativeTour: boolean;
    roiCalculator: boolean;
    soundPrivacy: boolean;
    furniture: boolean;
  };

  // AI Features
  ai: {
    aiAdvisor: boolean;
    voiceAssistant: boolean;
  };

  // Environment Features
  environment: {
    siteContext: boolean;
    topography: boolean;
    geoLocation: boolean;
    construction: boolean;
    lighting: boolean;
  };

  // Collaboration Features
  collaboration: {
    multiUser: boolean;
    chat: boolean;
    sharing: boolean;
    annotations: boolean;
    presenter: boolean;
  };

  // Immersive Features
  immersive: {
    vr: boolean;
    ar: boolean;
    spatialAudio: boolean;
    haptic: boolean;
    xr: boolean;
    handTracking: boolean;
    multiSensory: boolean;
  };

  // Navigation & Controls
  navigation: {
    movementControlChecker: boolean;
    teleportManager: boolean;
    swimMode: boolean;
  };

  // Advanced Features
  advanced: {
    pathTracing: boolean;
    pHashIntegration: boolean;
    progressiveLoader: boolean;
    presentationManager: boolean;
    presenterMode: boolean;
    quantumSimulationInterface: boolean;
  };

  // Utilities
  utilities: {
    export: boolean;
    import: boolean;
    settings: boolean;
  };
}

// Helper type for feature categories
export type FeatureCategory = keyof FeatureState;

// Helper type for individual features within a category
export type FeatureKey<T extends FeatureCategory> = keyof FeatureState[T];

// Helper function to get all feature IDs
export const getAllFeatureIds = (featureState: FeatureState): string[] => {
  const features: string[] = [];

  Object.entries(featureState).forEach(([category, categoryFeatures]) => {
    Object.keys(categoryFeatures).forEach(featureId => {
      features.push(featureId);
    });
  });

  return features;
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (
  featureState: FeatureState,
  category: FeatureCategory,
  featureId: string
): boolean => {
  return featureState[category]?.[featureId as keyof FeatureState[typeof category]] || false;
};

// Helper function to toggle a feature
export const toggleFeature = (
  featureState: FeatureState,
  category: FeatureCategory,
  featureId: string
): FeatureState => {
  const newState = { ...featureState };
  const currentValue = isFeatureEnabled(featureState, category, featureId);

  if (newState[category] && featureId in newState[category]) {
    (newState[category] as any)[featureId] = !currentValue;
  }

  return newState;
};

// Helper function to enable a feature
export const enableFeature = (
  featureState: FeatureState,
  category: FeatureCategory,
  featureId: string
): FeatureState => {
  const newState = { ...featureState };

  if (newState[category] && featureId in newState[category]) {
    (newState[category] as any)[featureId] = true;
  }

  return newState;
};

// Helper function to disable a feature
export const disableFeature = (
  featureState: FeatureState,
  category: FeatureCategory,
  featureId: string
): FeatureState => {
  const newState = { ...featureState };

  if (newState[category] && featureId in newState[category]) {
    (newState[category] as any)[featureId] = false;
  }

  return newState;
};

// Default feature state
export const defaultFeatureState: FeatureState = {
  essential: {
    materialEditor: false,
    minimap: false,
    measure: false,
    autoFurnish: false,
    aiCoDesigner: false,
    moodScene: false,
    seasonalDecor: false,
    arScale: false,
    scenario: false,
    animationTimeline: false,
    bimIntegration: false,
    propertyInspector: false,
    sceneBrowser: false,
    materialManager: false,
    lightingPresets: false,
  },
  simulation: {
    weather: false,
    flood: false,
    enhancedFlood: false,
    wind: false,
    noise: false,
    traffic: false,
    circulation: false,
    shadow: false,
    sunlight: false,
    windTunnel: false,
  },
  analysis: {
    ergonomic: false,
    energy: false,
    cost: false,
    beforeAfter: false,
    comparativeTour: false,
    roiCalculator: false,
    soundPrivacy: false,
    furniture: false,
  },
  ai: {
    aiAdvisor: false,
    voiceAssistant: false,
  },
  environment: {
    siteContext: false,
    topography: false,
    geoLocation: false,
    construction: false,
    lighting: false,
  },
  collaboration: {
    multiUser: false,
    chat: false,
    sharing: false,
    annotations: false,
    presenter: false,
  },
  immersive: {
    vr: false,
    ar: false,
    spatialAudio: false,
    haptic: false,
    xr: false,
    handTracking: false,
    multiSensory: false,
  },
  navigation: {
    movementControlChecker: false,
    teleportManager: false,
    swimMode: false,
  },
  advanced: {
    pathTracing: false,
    pHashIntegration: false,
    progressiveLoader: false,
    presentationManager: false,
    presenterMode: false,
    quantumSimulationInterface: false,
  },
  utilities: {
    export: false,
    import: false,
    settings: false,
  },
};
