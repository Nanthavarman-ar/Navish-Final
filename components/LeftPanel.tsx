import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Search, X, ChevronLeft, ChevronDown, ChevronRight, MoreVertical, CloudRain, Droplet, Wind, Sun, MapPin, Ruler, Palette, Settings, Layers, Eye, EyeOff } from 'lucide-react';
import FeatureButton from './FeatureButton';

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
  onClose
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [showPerformance, setShowPerformance] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);
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

  const isSearching = localSearchTerm.trim().length > 0;

  // Each category's own tool list (hidden buttons removed, search filter applied) -
  // rendered directly nested under that category's row below, instead of every visible
  // category's features being dumped together into one big undifferentiated grid.
  const categoryFeatureLists = useMemo(() => {
    const result: Record<string, Feature[]> = {};
    const searchLower = localSearchTerm.toLowerCase();
    Object.entries(featureCategories).forEach(([categoryKey, features]) => {
      let list = (features as Feature[]).filter(feature => !hiddenFeatureIds.has(feature.id));
      if (isSearching) {
        list = list.filter(feature =>
          feature.name.toLowerCase().includes(searchLower) ||
          feature.description.toLowerCase().includes(searchLower) ||
          feature.category.toLowerCase().includes(searchLower)
        );
      }
      result[categoryKey] = list;
    });
    return result;
  }, [featureCategories, localSearchTerm, hiddenFeatureIds, isSearching]);

  const totalMatches = useMemo(
    () => Object.values(categoryFeatureLists).reduce((sum, list) => sum + list.length, 0),
    [categoryFeatureLists]
  );

  // All features currently hidden by the user, across every category - shown in the
  // "manage hidden" panel so they can be unhidden again.
  const hiddenFeaturesList = useMemo(() => {
    if (hiddenFeatureIds.size === 0) return [];
    const allFeatures: Feature[] = Object.values(featureCategories).flat() as Feature[];
    return allFeatures.filter(feature => hiddenFeatureIds.has(feature.id));
  }, [featureCategories, hiddenFeatureIds]);

  const variant = currentLayoutMode === 'immersive' ? 'compact' : 'grid';

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
            <button
              type="button"
              tabIndex={0}
              data-testid="features-hide-btn"
              className="h-9 w-9 p-0 rounded-md border border-gray-600 bg-transparent text-gray-400 hover:text-white hover:bg-gray-700 inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer select-none"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              title="Hide Features panel"
              aria-label="Hide Features panel"
            >
              <ChevronLeft className="w-5 h-5 pointer-events-none" aria-hidden />
            </button>
            <CardTitle className="text-lg font-semibold">Tools</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {/* Everything that isn't "find and click a tool" (performance numbers,
                customize/hide mode, viewing what's hidden) lives in one menu instead of
                three separate always-visible icon buttons. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 w-9 p-0 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                  title="Panel options"
                  aria-label="Panel options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem checked={showPerformance} onCheckedChange={setShowPerformance}>
                  Show performance impact
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={customizeMode} onCheckedChange={setCustomizeMode}>
                  Customize (hide buttons)
                </DropdownMenuCheckboxItem>
                {hiddenFeaturesList.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowHiddenPanel(v => !v)}>
                      <EyeOff className="w-4 h-4 mr-2" />
                      {showHiddenPanel ? 'Hide' : 'Show'} hidden buttons ({hiddenFeaturesList.length})
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              tabIndex={0}
              data-testid="features-close-btn"
              className="h-9 w-9 p-0 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors cursor-pointer select-none"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              title="Close panel"
              aria-label="Close Features panel"
            >
              <X className="w-5 h-5 pointer-events-none" aria-hidden />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search tools..."
            value={localSearchTerm}
            onChange={handleSearchChange}
            className="pl-10 h-11 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
        </div>

        {/* Core Tools - the ones almost everyone uses, always one tap away */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs font-medium text-gray-400 mb-2">Core Tools</div>
          <div className="grid grid-cols-3 gap-2">
            {CORE_TOOLS.map(({ id, name, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={activeFeatures.has(id) ? 'default' : 'outline'}
                className="h-11 px-2 text-xs flex-col gap-1"
                onClick={() => onFeatureToggle(id, !activeFeatures.has(id))}
                title={name}
              >
                <Icon className="w-4 h-4" />
                {name}
              </Button>
            ))}
          </div>
        </div>

        {/* Simulations */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs font-medium text-gray-400 mb-2">Simulations</div>
          <div className="grid grid-cols-3 gap-2">
            {SIMULATION_FEATURES.map(({ id, name, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                variant={activeFeatures.has(id) ? 'default' : 'outline'}
                className="h-11 px-2 text-xs flex-col gap-1"
                onClick={() => onFeatureToggle(id, !activeFeatures.has(id))}
                title={`${name} Simulation`}
              >
                <Icon className="w-4 h-4" />
                {name}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      {/* Content - relative z-10 so it stacks above the absolutely-positioned ambient-glow layer */}
      <div className="flex-1 min-h-0 overflow-y-auto relative z-10 p-4 space-y-4">
        {customizeMode && (
          <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-200">
            Tap the ✕ on any button below to hide it from this list. Bring hidden buttons back from the ⋮ menu above.
          </div>
        )}

        {showHiddenPanel && hiddenFeaturesList.length > 0 && (
          <div className="p-3 bg-gray-800/60 border border-gray-700 rounded-lg space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-400">Hidden buttons - tap to bring back:</div>
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
                  className="h-9 px-2 text-xs gap-1"
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

        {/* Category accordion - each category's tools render directly under its OWN
            row, in the same loop as the row itself, so opening "Core Workspace" (the
            first category) shows its list right there instead of after every other
            category's header further down the panel (which is what happened when the
            header list and the expanded-content list were two separate blocks). While
            searching, any category with a match auto-expands (and categories with none
            disappear) so results are immediately visible without tapping each one open. */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">Tool Categories</h2>
          <button
            type="button"
            onClick={() => {
              const allVisible = Object.keys(categories).length > 0 && Object.keys(categories).every(key => categoryPanelVisible[key]);
              if (onToggleAllCategories) {
                onToggleAllCategories(!allVisible);
              } else {
                Object.keys(categories).forEach(cat => {
                  if (categoryPanelVisible[cat] !== !allVisible) onCategoryToggle(cat);
                });
              }
            }}
            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 -mr-2"
          >
            {Object.keys(categories).length > 0 && Object.keys(categories).every(key => categoryPanelVisible[key]) ? 'Collapse all' : 'Expand all'}
          </button>
        </div>

        <div className="space-y-1.5">
          {Object.entries(categories).map(([key, category]) => {
            const list = categoryFeatureLists[key] || [];
            if (isSearching && list.length === 0) return null;
            const expanded = isSearching ? true : !!categoryPanelVisible[key];

            return (
              <div key={key} className="rounded-lg bg-gray-800/70 border border-gray-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onCategoryToggle(key)}
                  aria-expanded={expanded}
                  className="w-full min-h-[48px] flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-800 active:bg-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm text-white truncate">{category.name}</span>
                      {category.description && (
                        <span className="block text-xs text-gray-500 truncate">{category.description}</span>
                      )}
                    </span>
                  </span>
                  {category.activeCount > 0 && (
                    <span className="shrink-0 text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2 py-0.5">
                      {category.activeCount} on
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-1 border-t border-gray-700">
                        {list.length > 0 ? (
                          <div className={`mt-2 ${variant === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                            {list.map((feature) => (
                              <FeatureButton
                                key={feature.id}
                                feature={feature}
                                active={activeFeatures.has(feature.id)}
                                showPerformance={showPerformance}
                                onToggle={(id, enabled) => onFeatureToggle(id, enabled)}
                                onHide={() => hideFeature(feature.id)}
                                forceShowHideControl={customizeMode}
                                variant={variant}
                                size="default"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-2">Nothing in this category yet.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {isSearching && totalMatches === 0 && (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">🔍</div>
            <p>No tools found</p>
            <p className="text-sm">Try a different search term</p>
            {hiddenFeaturesList.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-9 text-xs"
                onClick={() => setShowHiddenPanel(true)}
              >
                <Eye className="w-3 h-3 mr-1" />
                {hiddenFeaturesList.length} hidden - tap to view
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Helper functions for category data. Keyed by the real category names from
// config/featureCategories.tsx.
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
