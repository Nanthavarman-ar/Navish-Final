import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Search, X, Filter, ChevronLeft, Grid3X3, List, Minimize2, CloudRain, Droplet, Wind, Volume, Sun, MapPin, Ruler, Palette, Settings, Layers, Eye, EyeOff } from 'lucide-react';
import FeatureButton from './FeatureButton';
import CategoryToggles from './CategoryToggles';

const CORE_TOOLS = [
  { id: 'showMinimap', name: 'Minimap', icon: MapPin },
  { id: 'showMeasurementTool', name: 'Measure', icon: Ruler },
  { id: 'showMaterialEditor', name: 'Material', icon: Palette },
  { id: 'showPropertyInspector', name: 'Inspector', icon: Settings },
  { id: 'showSceneBrowser', name: 'Scene', icon: Layers },
  { id: 'showLighting', name: 'Lighting', icon: Sun }
] as const;

const SIMULATION_FEATURES = [
  { id: 'showWeather', name: 'Weather', icon: CloudRain },
  { id: 'showFloodSimulation', name: 'Flood', icon: Droplet },
  { id: 'showWindTunnelSimulation', name: 'Wind', icon: Wind }
] as const;

interface Feature {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  enabled: boolean;
  hotkey?: string;
  description: string;
  performanceImpact?: number;
  dependencies?: string[];
  isEssential?: boolean;
}

interface CategoryInfo {
  name: string;
  count: number;
  activeCount: number;
  color: string;
  priority: number;
  description?: string;
}

interface LeftPanelProps {
  featureCategories: Record<string, any[]>;
  categoryPanelVisible: Record<string, boolean>;
  searchTerm: string;
  activeFeatures: Set<string>;
  currentLayoutMode: 'standard' | 'compact' | 'immersive';
  onCategoryToggle: (category: string) => void;
  onToggleAllCategories?: (visible: boolean) => void;
  onSearchChange: (term: string) => void;
  onFeatureToggle: (featureId: string | number, enabled: boolean) => void;
  onClose: () => void;
  aiManagerRef?: React.RefObject<any>;
  bimManagerRef?: React.RefObject<any>;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  featureCategories,
  categoryPanelVisible,
  searchTerm,
  activeFeatures,
  currentLayoutMode,
  onCategoryToggle,
  onToggleAllCategories,
  onSearchChange,
  onFeatureToggle,
  onClose,
  aiManagerRef,
  bimManagerRef
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showPerformance, setShowPerformance] = useState(false);
  const [activeFilter, setActiveFilter] = useState<number | undefined>(undefined);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [hiddenFeatureIds, setHiddenFeatureIds] = useState<Set<string>>(() => {
    try {
      const stored = window.localStorage.getItem('naviz:hiddenFeatureIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const persistHiddenIds = (ids: Set<string>) => {
    try {
      window.localStorage.setItem('naviz:hiddenFeatureIds', JSON.stringify(Array.from(ids)));
    } catch {
      // localStorage unavailable (private browsing, etc) - hiding still works for this session
    }
  };

  const hideFeature = (featureId: string) => {
    setHiddenFeatureIds(prev => {
      const next = new Set(prev);
      next.add(featureId);
      persistHiddenIds(next);
      return next;
    });
  };

  const unhideFeature = (featureId: string) => {
    setHiddenFeatureIds(prev => {
      const next = new Set(prev);
      next.delete(featureId);
      persistHiddenIds(next);
      return next;
    });
  };

  // Derive categories from featureCategories
  const categories = useMemo(() => {
    const categoryMap: Record<string, CategoryInfo> = {};

    Object.entries(featureCategories).forEach(([categoryKey, features]) => {
      const categoryFeatures = features as Feature[];
      const activeCount = categoryFeatures.filter(f => activeFeatures.has(f.id)).length;

      categoryMap[categoryKey] = {
        name: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
        count: categoryFeatures.length,
        activeCount,
        color: getCategoryColor(categoryKey),
        priority: getCategoryPriority(categoryKey),
        description: getCategoryDescription(categoryKey)
      };
    });

    return categoryMap;
  }, [featureCategories, activeFeatures]);

  // Filter features based on search term and visible categories
  const filteredFeatures = useMemo(() => {
    const hasAnyDefined = Object.keys(categoryPanelVisible).length > 0;
    const visibleCategories = hasAnyDefined
      ? Object.keys(categoryPanelVisible).filter(cat => categoryPanelVisible[cat])
      : Object.keys(featureCategories);
    let features: Feature[] = [];

    visibleCategories.forEach(category => {
      if (featureCategories[category]) {
        features.push(...(featureCategories[category] as Feature[]));
      }
    });

    // Buttons the user has explicitly hidden from the list don't show here - see
    // hiddenFeaturesList below for the "manage hidden" panel that can unhide them.
    features = features.filter(feature => !hiddenFeatureIds.has(feature.id));

    if (localSearchTerm.trim()) {
      const searchLower = localSearchTerm.toLowerCase();
      features = features.filter(feature =>
        feature.name.toLowerCase().includes(searchLower) ||
        feature.description.toLowerCase().includes(searchLower) ||
        feature.category.toLowerCase().includes(searchLower)
      );
    }

    return features;
  }, [featureCategories, categoryPanelVisible, localSearchTerm, hiddenFeatureIds]);

  // All features currently hidden by the user, across every category - shown in the
  // "manage hidden" panel so they can be unhidden again.
  const hiddenFeaturesList = useMemo(() => {
    if (hiddenFeatureIds.size === 0) return [];
    const allFeatures: Feature[] = Object.values(featureCategories).flat() as Feature[];
    return allFeatures.filter(feature => hiddenFeatureIds.has(feature.id));
  }, [featureCategories, hiddenFeatureIds]);

  // Get layout variant based on currentLayoutMode
  const getLayoutVariant = () => {
    switch (currentLayoutMode) {
      case 'compact':
        return 'list';
      case 'immersive':
        return 'compact';
      default:
        return 'grid';
    }
  };

  const variant = getLayoutVariant();

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchTerm(value);
    onSearchChange(value);
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-y-0 left-0 z-30 w-[85vw] max-w-[320px] sm:relative sm:z-auto sm:w-80 sm:max-w-none h-full bg-gray-900 border-r border-gray-700 flex flex-col text-white overflow-hidden pointer-events-auto shadow-2xl sm:shadow-none"
    >
      <div className="ambient-glow" aria-hidden><span className="ambient-glow-blob" /></div>
      {/* Header - relative z-10 so buttons stay above any overflow content */}
      <CardHeader className="flex-shrink-0 border-b border-gray-700 bg-gray-800/90 backdrop-blur-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Aeromark: chevron to hide panel */}
            <button
              type="button"
              tabIndex={0}
              data-testid="features-hide-btn"
              className="h-7 w-7 p-0 rounded-md border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:bg-gray-700 inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer select-none"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              title="Hide Features panel"
              aria-label="Hide Features panel"
            >
              <ChevronLeft className="w-4 h-4 pointer-events-none" aria-hidden />
            </button>
            <CardTitle className="text-lg font-semibold">Features</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowPerformance(!showPerformance)}
              className="text-gray-400 hover:text-white"
              title="Toggle Performance Indicators"
            >
              <Filter className="w-4 h-4" />
            </Button>
            <button
              type="button"
              tabIndex={0}
              data-testid="features-close-btn"
              className="h-8 w-8 p-0 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors cursor-pointer select-none"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              title="Close panel"
              aria-label="Close Features panel"
            >
              <X className="w-4 h-4 pointer-events-none" aria-hidden />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search features..."
            value={localSearchTerm}
            onChange={handleSearchChange}
            className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
        </div>

        {/* Core Tools - Minimap, Measure, Material, Inspector, Scene, Lighting */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs font-medium text-gray-400 mb-2">Core Tools</div>
          <div className="flex flex-wrap gap-2">
            {CORE_TOOLS.map(({ id, name, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={activeFeatures.has(id) ? 'default' : 'outline'}
                className="h-8 px-2 text-xs"
                onClick={() => onFeatureToggle(id, !activeFeatures.has(id))}
                title={name}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {name}
              </Button>
            ))}
          </div>
        </div>

        {/* Simulations - Separate buttons for each simulation */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs font-medium text-gray-400 mb-2">Simulations</div>
          <div className="flex flex-wrap gap-2">
            {SIMULATION_FEATURES.map(({ id, name, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={activeFeatures.has(id) ? 'default' : 'outline'}
                className="h-8 px-2 text-xs"
                onClick={() => onFeatureToggle(id, !activeFeatures.has(id))}
                title={`${name} Simulation`}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {name}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      {/* Content - relative z-10 so it stacks above the absolutely-positioned ambient-glow layer */}
      <div className="flex-1 min-h-0 overflow-y-auto relative z-10">
        {/* Category Toggles */}
        <div className="p-4 border-b border-gray-700">
          <CategoryToggles
            categories={categories}
            visibleCategories={categoryPanelVisible}
            onCategoryToggle={onCategoryToggle}
            onToggleAll={(visible) => {
              if (onToggleAllCategories) {
                onToggleAllCategories(visible);
              } else {
                Object.keys(categories).forEach(cat => {
                  if (categoryPanelVisible[cat] !== visible) onCategoryToggle(cat);
                });
              }
            }}
            onFilterByPriority={(priority) => {
              setActiveFilter(priority === 0 ? undefined : priority);
            }}
            layout={currentLayoutMode === 'standard' ? 'expanded' : 'compact'}
            activeFilter={activeFilter}
          />
        </div>

        {/* Features Grid/List */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">
              Features ({filteredFeatures.length})
            </h3>
            <div className="flex items-center space-x-1">
              <Badge variant="outline" className="text-xs">
                {activeFeatures.size} active
              </Badge>
              <Button
                size="sm"
                variant={customizeMode ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => setCustomizeMode(v => !v)}
                title="Show or hide buttons in this list"
                aria-pressed={customizeMode}
              >
                <Settings className="w-3 h-3 mr-1" />
                Customize
              </Button>
              {hiddenFeaturesList.length > 0 && (
                <Button
                  size="sm"
                  variant={showHiddenPanel ? 'default' : 'ghost'}
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowHiddenPanel(v => !v)}
                  title="Show buttons you've hidden from this list"
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Hidden ({hiddenFeaturesList.length})
                </Button>
              )}
            </div>
          </div>

          {customizeMode && (
            <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-200">
              Tap the ✕ on any button below to hide it from this list. Hidden buttons can be brought back anytime from "Hidden".
            </div>
          )}

          {showHiddenPanel && hiddenFeaturesList.length > 0 && (
            <div className="mb-4 p-3 bg-gray-800/60 border border-gray-700 rounded-lg space-y-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-gray-400">Hidden buttons - click to bring back:</div>
                {hiddenFeaturesList.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                    onClick={() => hiddenFeaturesList.forEach((feature) => unhideFeature(feature.id))}
                  >
                    Show all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {hiddenFeaturesList.map((feature) => (
                  <Button
                    key={feature.id}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => unhideFeature(feature.id)}
                    title={`Unhide ${feature.name}`}
                  >
                    <Eye className="w-3 h-3" />
                    {feature.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {filteredFeatures.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={
                  variant === 'grid'
                    ? 'grid grid-cols-2 gap-3'
                    : variant === 'list'
                    ? 'space-y-2'
                    : 'grid grid-cols-1 gap-2'
                }
              >
                {filteredFeatures.map((feature) => (
                  <FeatureButton
                    key={feature.id}
                    feature={feature}
                    active={activeFeatures.has(feature.id)}
                    showPerformance={showPerformance}
                    onToggle={(id, enabled) => onFeatureToggle(id, enabled)}
                    onHide={() => hideFeature(feature.id)}
                    forceShowHideControl={customizeMode}
                    variant={variant}
                    size={variant === 'compact' ? 'sm' : 'default'}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-gray-400"
              >
                <div className="text-4xl mb-2">🔍</div>
                <p>No features found</p>
                <p className="text-sm">Try adjusting your search or category filters</p>
                {hiddenFeaturesList.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 h-7 text-xs"
                    onClick={() => setShowHiddenPanel(true)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {hiddenFeaturesList.length} hidden - click to view
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// Helper functions for category data. Keyed by the real category names from
// config/featureCategories.tsx - these previously used keys from an earlier version of the
// app (navigation/simulation/ai/analysis/collaboration/immersive/tools) that don't match any
// current category name, so every category silently fell back to the same gray color, the
// same P3 priority, and no description - the whole panel read as flat/monotone with the P1-3
// filter tabs unable to differentiate anything (everything was "P3").
const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'core workspace': 'blue',
    'ui and controls': 'gray',
    'ai and automation': 'purple',
    'ar and spatial': 'cyan',
    'simulations and analysis': 'green',
    'tools and editors': 'orange',
    'auto furnish & ar anchor': 'pink',
    'audio and multimedia': 'teal',
    'collaboration and multi-user': 'slate',
    'geo and location': 'blue',
    default: 'gray'
  };
  return colors[category.toLowerCase()] || colors.default;
};

const getCategoryPriority = (category: string): number => {
  const priorities: Record<string, number> = {
    'core workspace': 1,
    'ui and controls': 2,
    'ai and automation': 3,
    'ar and spatial': 1,
    'simulations and analysis': 2,
    'tools and editors': 1,
    'auto furnish & ar anchor': 3,
    'audio and multimedia': 3,
    'collaboration and multi-user': 2,
    'geo and location': 3,
    default: 3
  };
  return priorities[category.toLowerCase()] || priorities.default;
};

const getCategoryDescription = (category: string): string => {
  const descriptions: Record<string, string> = {
    'core workspace': 'Materials, measuring, BIM, and transform tools',
    'ui and controls': 'Shortcuts, domain scoping, and presentation mode',
    'ai and automation': 'AI advisor, voice assistant, and gesture input',
    'ar and spatial': 'VR/AR entry, spatial audio, and haptics',
    'simulations and analysis': 'Weather, flood, wind, cost, and compliance analysis',
    'tools and editors': 'Import, export, annotations, and version history',
    'auto furnish & ar anchor': 'AI furnishing and shared AR anchors',
    'audio and multimedia': 'Voice chat and in-scene audio',
    'collaboration and multi-user': 'Real-time multi-user editing, chat, and sharing',
    'geo and location': 'Device GPS and geographic data sync'
  };
  return descriptions[category.toLowerCase()] || '';
};

export default LeftPanel;
