import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Activity, AlertTriangle, CheckCircle, Clock,
  Cpu, Zap, Users, Settings, Info, Star,
  Grid3X3, Eye, EyeOff, RotateCcw, Move,
  Scale, Camera, Maximize2, Minimize2
} from 'lucide-react';

// Feature categories with priority levels
const FEATURE_CATEGORIES = {
  essential: { name: 'Essential', priority: 1, color: 'blue' },
  simulation: { name: 'Simulation', priority: 2, color: 'green' },
  analysis: { name: 'Analysis', priority: 3, color: 'purple' },
  ai: { name: 'AI & ML', priority: 4, color: 'orange' },
  collaboration: { name: 'Collaboration', priority: 5, color: 'pink' },
  immersive: { name: 'Immersive', priority: 6, color: 'cyan' },
  environment: { name: 'Environment', priority: 7, color: 'teal' },
  construction: { name: 'Construction', priority: 8, color: 'gray' },
  utilities: { name: 'Utilities', priority: 9, color: 'slate' }
};

interface EnhancedWorkspaceLayoutProps {
  activeFeatures: Set<string>;
  performanceScore: number;
  featureStats: any;
  warnings: string[];
  suggestions: string[];
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
  onPerformanceModeChange: (mode: string) => void;
  performanceMode: string;
  layoutMode: 'standard' | 'compact' | 'immersive';
  onLayoutModeChange: (mode: string) => void;
  features: any[];
  selectedMesh?: any;
}

const EnhancedWorkspaceLayout: React.FC<EnhancedWorkspaceLayoutProps> = ({
  activeFeatures,
  performanceScore,
  featureStats,
  warnings,
  suggestions,
  onFeatureToggle,
  onPerformanceModeChange,
  performanceMode,
  layoutMode,
  onLayoutModeChange,
  features,
  selectedMesh
}) => {
  const [activeTab, setActiveTab] = useState('quick-access');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);

  // Group features by priority and usage
  const groupedFeatures = useMemo(() => {
    const groups = {
      quickAccess: [] as any[],
      essential: [] as any[],
      simulation: [] as any[],
      analysis: [] as any[],
      advanced: [] as any[]
    };

    features.forEach(feature => {
      const isActive = activeFeatures.has(feature.id);
      const category = FEATURE_CATEGORIES[feature.category as keyof typeof FEATURE_CATEGORIES];

      // Quick access: most used features
      if (['measure', 'propertyInspector', 'sceneBrowser', 'minimap', 'materialEditor'].includes(feature.id)) {
        groups.quickAccess.push({ ...feature, isActive, category });
      }
      // Essential: core workspace features
      else if (category?.priority <= 2) {
        groups.essential.push({ ...feature, isActive, category });
      }
      // Simulation: physics and environment
      else if (['simulation', 'analysis'].includes(feature.category)) {
        groups.simulation.push({ ...feature, isActive, category });
      }
      // Analysis: measurement and inspection
      else if (feature.category === 'analysis') {
        groups.analysis.push({ ...feature, isActive, category });
      }
      // Advanced: everything else
      else {
        groups.advanced.push({ ...feature, isActive, category });
      }
    });

    return groups;
  }, [features, activeFeatures]);

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  const getPerformanceIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (score >= 60) return <Clock className="w-4 h-4 text-yellow-500" />;
    if (score >= 30) return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  const FeatureButton: React.FC<{ feature: any }> = ({ feature }) => (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        variant={feature.isActive ? "default" : "outline"}
        size="sm"
        onClick={() => onFeatureToggle(feature.id, !feature.isActive)}
        className={`h-auto p-3 flex flex-col items-center space-y-1 relative ${
          feature.isActive
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
        }`}
      >
        <feature.icon className="w-4 h-4" />
        <span className="text-xs text-center leading-tight">{feature.name}</span>
        {feature.hotkey && (
          <Badge variant="outline" className="text-xs px-1 py-0">
            {feature.hotkey}
          </Badge>
        )}
        {feature.category?.priority <= 2 && (
          <Star className="w-3 h-3 text-yellow-500 absolute top-1 right-1" />
        )}
      </Button>
    </motion.div>
  );

  const FeatureGroup: React.FC<{ title: string; features: any[]; showPerformance?: boolean }> = ({
    title,
    features,
    showPerformance = false
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {showPerformance && (
          <Badge variant="outline" className="text-xs">
            {features.filter(f => f.isActive).length}/{features.length}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {features.map(feature => (
          <FeatureButton key={feature.id} feature={feature} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-80 h-full bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Header with Performance Indicator */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Workspace</h2>
          <div className="flex items-center space-x-2">
            {getPerformanceIcon(performanceScore)}
            <span className={`text-sm font-medium ${getPerformanceColor(performanceScore)}`}>
              {performanceScore}%
            </span>
          </div>
        </div>

        {/* Layout Mode Selector */}
        <div className="flex space-x-1">
          {['standard', 'compact', 'immersive'].map(mode => (
            <Button
              key={mode}
              size="sm"
              variant={layoutMode === mode ? "default" : "outline"}
              onClick={() => onLayoutModeChange(mode)}
              className="text-xs capitalize"
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      {/* Performance Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-700">
          <div className="flex items-center space-x-2 text-orange-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>{warnings.length} performance warning(s)</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quick-access" className="text-xs">Quick</TabsTrigger>
              <TabsTrigger value="essential" className="text-xs">Core</TabsTrigger>
              <TabsTrigger value="simulation" className="text-xs">Sim</TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs">More</TabsTrigger>
            </TabsList>

            <TabsContent value="quick-access" className="space-y-4 mt-4">
              <FeatureGroup
                title="Most Used Features"
                features={groupedFeatures.quickAccess}
                showPerformance={true}
              />

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="text-xs">
                    <Grid3X3 className="w-3 h-3 mr-1" />
                    Reset View
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    Show All
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset Scene
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    <Maximize2 className="w-3 h-3 mr-1" />
                    Fullscreen
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="essential" className="space-y-4 mt-4">
              <FeatureGroup
                title="Essential Tools"
                features={groupedFeatures.essential}
                showPerformance={true}
              />

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Performance Mode</h3>
                <div className="grid grid-cols-3 gap-2">
                  {['performance', 'balanced', 'quality'].map(mode => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={performanceMode === mode ? "default" : "outline"}
                      onClick={() => onPerformanceModeChange(mode)}
                      className="text-xs capitalize"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="simulation" className="space-y-4 mt-4">
              <FeatureGroup
                title="Simulation & Analysis"
                features={[...groupedFeatures.simulation, ...groupedFeatures.analysis]}
                showPerformance={true}
              />

              {selectedMesh && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">Selected Object</h3>
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-3">
                        <div className="text-xs text-gray-300 space-y-1">
                          <div><strong>Name:</strong> {selectedMesh.name}</div>
                          <div><strong>Type:</strong> {selectedMesh.getClassName()}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <FeatureGroup
                title="Advanced Features"
                features={groupedFeatures.advanced}
                showPerformance={true}
              />

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">Performance Details</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPerformanceDetails(!showPerformanceDetails)}
                  >
                    {showPerformanceDetails ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </Button>
                </div>

                <AnimatePresence>
                  {showPerformanceDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2"
                    >
                      <div className="text-xs text-gray-400 space-y-1">
                        <div>Active Features: {activeFeatures.size}</div>
                        <div>Performance Mode: {performanceMode}</div>
                        <div>Layout Mode: {layoutMode}</div>
                      </div>

                      {warnings.length > 0 && (
                        <div className="text-xs text-orange-400 space-y-1">
                          {warnings.map((warning, index) => (
                            <div key={index}>• {warning}</div>
                          ))}
                        </div>
                      )}

                      {suggestions.length > 0 && (
                        <div className="text-xs text-blue-400 space-y-1">
                          {suggestions.map((suggestion, index) => (
                            <div key={index}>• {suggestion}</div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Footer with Stats */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Active: {activeFeatures.size}</span>
          <span>Categories: {Object.keys(featureStats.byCategory || {}).length}</span>
          <span>Layout: {layoutMode}</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedWorkspaceLayout;
