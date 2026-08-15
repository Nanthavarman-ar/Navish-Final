import React, { useState } from "react";
import type { AbstractMesh } from '@babylonjs/core';

export interface WorkspaceState {
  // Tool states
  moveActive: boolean;
  setMoveActive: (active: boolean) => void;
  rotateActive: boolean;
  setRotateActive: (active: boolean) => void;
  scaleActive: boolean;
  setScaleActive: (active: boolean) => void;
  cameraActive: boolean;
  setCameraActive: (active: boolean) => void;
  perspectiveActive: boolean;
  setPerspectiveActive: (active: boolean) => void;

  // Workspace selection
  selectedWorkspaceId: string;
  setSelectedWorkspaceId: (id: string) => void;

  // UI states
  realTimeEnabled: boolean;
  setRealTimeEnabled: (value: boolean) => void;
  cameraMode: 'orbit' | 'free' | 'first-person';
  setCameraMode: (mode: 'orbit' | 'free' | 'first-person') => void;
  gridVisible: boolean;
  setGridVisible: (value: boolean | ((prev: boolean) => boolean)) => void;
  wireframeEnabled: boolean;
  setWireframeEnabled: (value: boolean | ((prev: boolean) => boolean)) => void;
  statsVisible: boolean;
  setStatsVisible: (value: boolean | ((prev: boolean) => boolean)) => void;

  // Panel visibility states
  leftPanelVisible: boolean;
  setLeftPanelVisible: (visible: boolean) => void;
  rightPanelVisible: boolean;
  setRightPanelVisible: (visible: boolean) => void;
  bottomPanelVisible: boolean;
  setBottomPanelVisible: (visible: boolean) => void;

  // Category panel states
  categoryPanelVisible: Record<string, boolean>;
  setCategoryPanelVisible: (value: Record<string, boolean>) => void;

  // Layout and navigation
  layoutMode: string;
  setLayoutMode: (mode: string) => void;
  currentLayoutMode: string;
  setCurrentLayoutMode: (mode: string) => void;

  // Tool and feature states
  activeTool: string | null;
  setActiveTool: (tool: string | null) => void;
  performanceMode: 'low' | 'medium' | 'high';
  setPerformanceMode: (value: 'low' | 'medium' | 'high') => void;

  // Search and filtering
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;

  // Floating toolbar
  showFloatingToolbar: boolean;
  setShowFloatingToolbar: (visible: boolean) => void;
  floatingToolbarVisible: boolean;
  setFloatingToolbarVisible: (visible: boolean) => void;
  toolbarPosition: { x: number; y: number };
  setToolbarPosition: (pos: { x: number; y: number }) => void;

  // Mesh selection
  selectedMesh: AbstractMesh | null;
  setSelectedMesh: (mesh: AbstractMesh | null) => void;

  // Animation and tour functionality
  animationManager: any;
  setAnimationManager: (manager: any) => void;
  handleTourSequenceCreate: (sequence: any) => void;
  handleTourSequencePlay: (sequenceId: string) => void;

  // State management
  updateState: (updates: Partial<WorkspaceState>) => void;
  togglePanel: (panel: string) => void;
  deactivateAllTools: () => void;
  resetToDefaults: () => void;
}

export function useWorkspaceState(initialWorkspaceId: string): WorkspaceState {
  const [moveActive, setMoveActive] = useState<boolean>(false);
  const [rotateActive, setRotateActive] = useState<boolean>(false);
  const [scaleActive, setScaleActive] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [perspectiveActive, setPerspectiveActive] = useState<boolean>(false);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(initialWorkspaceId);
  const [realTimeEnabled, setRealTimeEnabled] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'free' | 'first-person'>('orbit');
  const [gridVisible, setGridVisible] = useState<boolean>(true);
  const [wireframeEnabled, setWireframeEnabled] = useState<boolean>(false);
  const [statsVisible, setStatsVisible] = useState<boolean>(false);
  const [categoryPanelVisible, setCategoryPanelVisible] = useState<Record<string, boolean>>({});

  // Additional workspace state
  const [layoutMode, setLayoutMode] = useState<string>("default");
  const [currentLayoutMode, setCurrentLayoutMode] = useState<string>("default");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'low' | 'medium' | 'high'>('medium');
  const [activeTab, setActiveTab] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [floatingToolbarVisible, setFloatingToolbarVisible] = useState<boolean>(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Panel visibility states
  const [leftPanelVisible, setLeftPanelVisible] = useState<boolean>(true);
  const [rightPanelVisible, setRightPanelVisible] = useState<boolean>(true);
  const [bottomPanelVisible, setBottomPanelVisible] = useState<boolean>(true);

  // Floating toolbar states
  const [showFloatingToolbar, setShowFloatingToolbar] = useState<boolean>(false);

  // Mesh selection
  const [selectedMesh, setSelectedMesh] = useState<AbstractMesh | null>(null);

  // Animation and tour functionality
  const [animationManager, setAnimationManager] = useState<any>(null);
  const handleTourSequenceCreate = (sequence: any) => {
    // Implementation for tour sequence creation
    // For example, log and handle animation group creation
    console.log('Tour sequence created:', sequence);
    // You can add more logic here as needed
  };
  const handleTourSequencePlay = (sequenceId: string) => {
    // Implementation for tour sequence play
    console.log('Play tour sequence:', sequenceId);
    // You can add more logic here as needed
  };

  // Logic for updating state
  const updateState: WorkspaceState["updateState"] = (updates) => {
    Object.entries(updates).forEach(([key, value]) => {
      switch (key) {
        case "selectedWorkspaceId": setSelectedWorkspaceId(value as string); break;
        case "realTimeEnabled": setRealTimeEnabled(value as boolean); break;
        case "cameraMode": setCameraMode(value as 'orbit' | 'free' | 'first-person'); break;
        case "gridVisible":
          if (typeof value === 'function') {
            setGridVisible(value as (prev: boolean) => boolean);
          } else {
            setGridVisible(value as boolean);
          }
          break;
        case "wireframeEnabled":
          if (typeof value === 'function') {
            setWireframeEnabled(value as (prev: boolean) => boolean);
          } else {
            setWireframeEnabled(value as boolean);
          }
          break;
        case "statsVisible":
          if (typeof value === 'function') {
            setStatsVisible(value as (prev: boolean) => boolean);
          } else {
            setStatsVisible(value as boolean);
          }
          break;
        case "categoryPanelVisible": setCategoryPanelVisible(value as Record<string, boolean>); break;
        case "layoutMode": setLayoutMode(value as string); break;
        case "currentLayoutMode": setCurrentLayoutMode(value as string); break;
        case "activeTool": setActiveTool(value as string | null); break;
        case "performanceMode": setPerformanceMode(value as 'low' | 'medium' | 'high'); break;
        case "activeTab": setActiveTab(value as string); break;
        case "searchQuery": setSearchQuery(value as string); break;
        case "selectedCategory": setSelectedCategory(value as string); break;
        case "floatingToolbarVisible": setFloatingToolbarVisible(value as boolean); break;
        case "toolbarPosition": setToolbarPosition(value as { x: number; y: number }); break;
        case "leftPanelVisible": setLeftPanelVisible(value as boolean); break;
        case "rightPanelVisible": setRightPanelVisible(value as boolean); break;
        case "bottomPanelVisible": setBottomPanelVisible(value as boolean); break;
        case "showFloatingToolbar": setShowFloatingToolbar(value as boolean); break;
        case "selectedMesh": setSelectedMesh(value as AbstractMesh | null); break;
        case "animationManager": setAnimationManager(value as any); break;
        default: break;
      }
    });
  };

  const togglePanel = (panel: string) => {
    setCategoryPanelVisible(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  const deactivateAllTools = () => setActiveTool(null);

  const resetToDefaults = () => {
    setLayoutMode("default");
    setCurrentLayoutMode("default");
    setActiveTool(null);
    setPerformanceMode('medium');
    setActiveTab("");
    setSearchQuery("");
    setSelectedCategory("");
    setFloatingToolbarVisible(false);
    setToolbarPosition({ x: 0, y: 0 });
    setLeftPanelVisible(true);
    setRightPanelVisible(true);
    setBottomPanelVisible(true);
    setShowFloatingToolbar(false);
    setSelectedMesh(null);
    setAnimationManager(null);
  };

  return {
    // Tool states
    moveActive,
    setMoveActive,
    rotateActive,
    setRotateActive,
    scaleActive,
    setScaleActive,
    cameraActive,
    setCameraActive,
    perspectiveActive,
    setPerspectiveActive,

    // Workspace selection
    selectedWorkspaceId,
    setSelectedWorkspaceId,

    // UI states
    realTimeEnabled,
    setRealTimeEnabled,
    cameraMode,
    setCameraMode,
    gridVisible,
    setGridVisible,
    wireframeEnabled,
    setWireframeEnabled,
    statsVisible,
    setStatsVisible,

    // Panel visibility states
    leftPanelVisible,
    setLeftPanelVisible,
    rightPanelVisible,
    setRightPanelVisible,
    bottomPanelVisible,
    setBottomPanelVisible,

    // Category panel states
    categoryPanelVisible,
    setCategoryPanelVisible,

    // Layout and navigation
    layoutMode,
    setLayoutMode,
    currentLayoutMode,
    setCurrentLayoutMode,

    // Tool and feature states
    activeTool,
    setActiveTool,
    performanceMode,
    setPerformanceMode,

    // Search and filtering
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,

    // Floating toolbar
    showFloatingToolbar,
    setShowFloatingToolbar,
    floatingToolbarVisible,
    setFloatingToolbarVisible,
    toolbarPosition,
    setToolbarPosition,

    // Mesh selection
    selectedMesh,
    setSelectedMesh,

    // Animation and tour functionality
    animationManager,
    setAnimationManager,
    handleTourSequenceCreate,
    handleTourSequencePlay,

    // State management
    updateState,
    togglePanel,
    deactivateAllTools,
    resetToDefaults,
  };
}
