import { useState, useCallback, useMemo } from 'react';
import { AbstractMesh } from '@babylonjs/core';

export interface FeatureCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  enabled: boolean;
  hotkey?: string;
  description: string;
}

export interface FeatureStats {
  total: number;
  active: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}

export const useFeatureManagement = (
  initialFeatures: FeatureCategory[],
  selectedMesh: AbstractMesh | null
) => {
  const [activeFeatures, setActiveFeatures] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredFeatures = useMemo(() => {
    return initialFeatures.filter(feature => {
      const matchesSearch = feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           feature.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [initialFeatures, searchQuery, selectedCategory]);

  const featureStats: FeatureStats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = { active: 0, inactive: 0 };

    initialFeatures.forEach(feature => {
      byCategory[feature.category] = (byCategory[feature.category] || 0) + 1;
      if (activeFeatures.includes(feature.id)) {
        byStatus.active++;
      } else {
        byStatus.inactive++;
      }
    });

    return {
      total: initialFeatures.length,
      active: activeFeatures.length,
      byCategory,
      byStatus
    };
  }, [initialFeatures, activeFeatures]);

  const toggleFeature = useCallback((featureId: string) => {
    setActiveFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  }, []);

  const enableFeature = useCallback((featureId: string) => {
    setActiveFeatures(prev =>
      prev.includes(featureId) ? prev : [...prev, featureId]
    );
  }, []);

  const disableFeature = useCallback((featureId: string) => {
    setActiveFeatures(prev => prev.filter(id => id !== featureId));
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    setActiveFeatures(prev => {
      const categoryFeatures = initialFeatures
        .filter(f => f.category === categoryId)
        .map(f => f.id);

      const allEnabled = categoryFeatures.every(id => prev.includes(id));
      if (allEnabled) {
        return prev.filter(id => !categoryFeatures.includes(id));
      } else {
        return [...new Set([...prev, ...categoryFeatures])];
      }
    });
  }, [initialFeatures]);

  const warnings = useMemo(() => {
    const warningList: string[] = [];

    if (activeFeatures.length > 10) {
      warningList.push('High number of active features may impact performance');
    }

    if (activeFeatures.includes('physics') && activeFeatures.includes('vr')) {
      warningList.push('Physics and VR features may have compatibility issues');
    }

    if (selectedMesh && activeFeatures.includes('measure') && !selectedMesh.isVisible) {
      warningList.push('Measurement tool may not work on invisible objects');
    }

    return warningList;
  }, [activeFeatures.length, activeFeatures.includes('physics'), activeFeatures.includes('vr'), activeFeatures.includes('measure'), selectedMesh?.isVisible, selectedMesh]);

  const suggestions = useMemo(() => {
    const suggestionList: string[] = [];

    if (!activeFeatures.includes('shadows') && activeFeatures.includes('lighting')) {
      suggestionList.push('Consider enabling shadows for better lighting visualization');
    }

    if (activeFeatures.includes('ai') && !activeFeatures.includes('annotations')) {
      suggestionList.push('AI features work better with annotations enabled');
    }

    if (activeFeatures.length === 0) {
      suggestionList.push('Enable some features to get started with the workspace');
    }

    return suggestionList;
  }, [activeFeatures]);

  return {
    activeFeatures,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredFeatures,
    featureStats,
    toggleFeature,
    enableFeature,
    disableFeature,
    toggleCategory,
    warnings,
    suggestions
  };
};
