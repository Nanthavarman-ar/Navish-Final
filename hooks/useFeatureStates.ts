import { useState, useCallback, useMemo } from 'react';
import { Feature, featureCategories } from '../config/featureCategories';

export interface FeatureStates {
  [key: string]: boolean;
}

export interface UseFeatureStatesReturn {
  featureStates: FeatureStates;
  setFeatureStates: (states: FeatureStates) => void;
  toggleFeature: (featureId: string) => void;
  setFeatureState: (featureId: string, enabled: boolean) => void;
  enableFeature: (featureId: string) => void;
  disableFeature: (featureId: string) => void;
  activeFeatures: Set<string>;
  featuresByCategory: Record<string, Feature[]>;
}

export const useFeatureStates = (
  initialFeatureStates: FeatureStates = {}
): UseFeatureStatesReturn => {
  const [featureStates, setFeatureStates] = useState<FeatureStates>(initialFeatureStates);

  const toggleFeature = useCallback((featureId: string) => {
    setFeatureStates(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  }, []);

  const setFeatureState = useCallback((featureId: string, enabled: boolean) => {
    setFeatureStates(prev => ({
      ...prev,
      [featureId]: enabled
    }));
  }, []);

  const enableFeature = useCallback((featureId: string) => {
    setFeatureState(featureId, true);
  }, [setFeatureState]);

  const disableFeature = useCallback((featureId: string) => {
    setFeatureState(featureId, false);
  }, [setFeatureState]);

  const activeFeatures = new Set(
    Object.entries(featureStates)
      .filter(([, enabled]) => enabled)
      .map(([featureId]) => featureId)
  );

  return {
    featureStates,
    setFeatureStates,
    toggleFeature,
    setFeatureState,
    enableFeature,
    disableFeature,
    activeFeatures,
    featuresByCategory: featureCategories
  };
};
