import { useState, useMemo } from "react";

export function useFeatureStates(
  initialStates: Record<string, boolean>,
  featuresByCategory: Record<string, string[]>
) {
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>(initialStates);

  const toggleFeature = (feature: string) => {
    setFeatureStates(prev => ({
      ...prev,
      [feature]: !prev[feature]
    }));
  };

  const setFeatureState = (feature: string, enabled: boolean) => {
    setFeatureStates(prev => ({
      ...prev,
      [feature]: enabled
    }));
  };

  const enableFeature = (feature: string) => setFeatureState(feature, true);
  const disableFeature = (feature: string) => setFeatureState(feature, false);

  const activeFeatures = useMemo(() => {
    return Object.keys(featureStates).filter(f => featureStates[f]);
  }, [featureStates]);

  return {
    featureStates,
    setFeatureStates,
    toggleFeature,
    setFeatureState,
    enableFeature,
    disableFeature,
    activeFeatures,
    featuresByCategory,
  };
}
