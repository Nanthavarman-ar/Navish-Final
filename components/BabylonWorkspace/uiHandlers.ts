import { useCallback } from "react";

export interface UIHandlersProps {
  setSelectedWorkspaceId: (id: string) => void;
  setRealTimeEnabled: (value: boolean) => void;
  setCameraMode: (mode: 'orbit' | 'free' | 'first-person') => void;
  setGridVisible: (value: boolean) => void;
  setWireframeEnabled: (value: boolean) => void;
  setStatsVisible: (value: boolean) => void;
  setCategoryPanelVisible: (value: Record<string, boolean>) => void;
  // Current state getters
  getRealTimeEnabled?: () => boolean;
  getGridVisible?: () => boolean;
  getWireframeEnabled?: () => boolean;
  getStatsVisible?: () => boolean;
  getCategoryPanelVisible?: () => Record<string, boolean>;
}

export function useUIHandlers({
  setSelectedWorkspaceId,
  setRealTimeEnabled,
  setCameraMode,
  setGridVisible,
  setWireframeEnabled,
  setStatsVisible,
  setCategoryPanelVisible,
  getRealTimeEnabled,
  getGridVisible,
  getWireframeEnabled,
  getStatsVisible,
  getCategoryPanelVisible,
}: UIHandlersProps) {
  const handleWorkspaceSelect = useCallback((workspaceId: string) => {
    try {
      setSelectedWorkspaceId(workspaceId);
    } catch (error) {
      // Silently handle setter errors
      console.warn('Error in setSelectedWorkspaceId:', error);
    }
  }, [setSelectedWorkspaceId]);

  const handleToggleRealTime = useCallback(() => {
    try {
      // Safely get current value with error handling
      let currentValue = false;
      try {
        currentValue = getRealTimeEnabled?.() ?? false;
      } catch (error) {
        // Use default value if getter throws
        console.warn('Error in getRealTimeEnabled:', error);
        currentValue = false;
      }

      // Safely set new value with error handling
      try {
        setRealTimeEnabled(!currentValue);
      } catch (error) {
        // Silently handle setter errors
        console.warn('Error in setRealTimeEnabled:', error);
      }
    } catch (error) {
      // Fallback error handling
      console.warn('Error in handleToggleRealTime:', error);
    }
  }, [setRealTimeEnabled, getRealTimeEnabled]);

  const handleCameraModeChange = useCallback((mode: 'orbit' | 'free' | 'first-person') => {
    try {
      setCameraMode(mode);
    } catch (error) {
      // Silently handle setter errors
      console.warn('Error in setCameraMode:', error);
    }
  }, [setCameraMode]);

  const handleToggleGrid = useCallback(() => {
    try {
      // Safely get current value with error handling
      let currentValue = false;
      try {
        currentValue = getGridVisible?.() ?? false;
      } catch (error) {
        // Use default value if getter throws
        console.warn('Error in getGridVisible:', error);
        currentValue = false;
      }

      // Safely set new value with error handling
      try {
        setGridVisible(!currentValue);
      } catch (error) {
        // Silently handle setter errors
        console.warn('Error in setGridVisible:', error);
      }
    } catch (error) {
      // Fallback error handling
      console.warn('Error in handleToggleGrid:', error);
    }
  }, [setGridVisible, getGridVisible]);

  const handleToggleWireframe = useCallback(() => {
    try {
      // Safely get current value with error handling
      let currentValue = false;
      try {
        currentValue = getWireframeEnabled?.() ?? false;
      } catch (error) {
        // Use default value if getter throws
        console.warn('Error in getWireframeEnabled:', error);
        currentValue = false;
      }

      // Safely set new value with error handling
      try {
        setWireframeEnabled(!currentValue);
      } catch (error) {
        // Silently handle setter errors
        console.warn('Error in setWireframeEnabled:', error);
      }
    } catch (error) {
      // Fallback error handling
      console.warn('Error in handleToggleWireframe:', error);
    }
  }, [setWireframeEnabled, getWireframeEnabled]);

  const handleToggleStats = useCallback(() => {
    try {
      // Safely get current value with error handling
      let currentValue = false;
      try {
        currentValue = getStatsVisible?.() ?? false;
      } catch (error) {
        // Use default value if getter throws
        console.warn('Error in getStatsVisible:', error);
        currentValue = false;
      }

      // Safely set new value with error handling
      try {
        setStatsVisible(!currentValue);
      } catch (error) {
        // Silently handle setter errors
        console.warn('Error in setStatsVisible:', error);
      }
    } catch (error) {
      // Fallback error handling
      console.warn('Error in handleToggleStats:', error);
    }
  }, [setStatsVisible, getStatsVisible]);

  const handleCategoryToggle = useCallback((category: string) => {
    try {
      // Safely get current state with error handling
      let currentState: Record<string, boolean> = {};
      try {
        currentState = getCategoryPanelVisible?.() ?? {};
      } catch (error) {
        // Use default empty object if getter throws
        console.warn('Error in getCategoryPanelVisible:', error);
        currentState = {};
      }

      const currentValue = currentState[category] ?? false;

      // Safely set new state with error handling
      try {
        setCategoryPanelVisible({
          ...currentState,
          [category]: !currentValue
        });
      } catch (error) {
        // Silently handle setter errors
        console.warn('Error in setCategoryPanelVisible:', error);
      }
    } catch (error) {
      // Fallback error handling
      console.warn('Error in handleCategoryToggle:', error);
    }
  }, [setCategoryPanelVisible, getCategoryPanelVisible]);

  return {
    handleWorkspaceSelect,
    handleToggleRealTime,
    handleCameraModeChange,
    handleToggleGrid,
    handleToggleWireframe,
    handleToggleStats,
    handleCategoryToggle,
  };
}
