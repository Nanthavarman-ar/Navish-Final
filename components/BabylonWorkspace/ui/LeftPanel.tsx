import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../core/WorkspaceContext';
import { useFeatureManager } from '../core/FeatureManager';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { showToast } from '../../utils/toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ScrollArea } from '../../ui/scroll-area';
import { Input } from '../../ui/input';
import { Separator } from '../../ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { featureCategories, type Feature } from '../../../config/featureCategories';
import {
  Move,
  RotateCw,
  Scale,
  Ruler,
  Sun,
  Palette,
  Undo,
  Redo,
  Map,
  Edit,
  Play,
  Layers,
  CloudSnow,
  Droplet,
  Wind,
  Volume2,
  Car,
  Brain,
  Sofa,
  Wand2,
  Mic,
  Users,
  Zap,
  DollarSign,
  Eye,
  Smartphone,
  Volume,
  Hand,
  Download,
  Upload,
  Settings,
  MapPin,
  Mountain,
  Network,
  EyeOff,
  MessageSquare,
  Pencil,
  Share,
  Construction,
  Activity,
  Presentation,
  Compass,
  Target,
  Trash,
  FileText,
  Bell,
  Camera,
  Maximize,
  Minimize,
  RotateCcw,
  Grid3X3,
  MousePointer,
  Navigation,
  VolumeX,
  Headphones,
  Gamepad2,
  MonitorSpeaker,
  Radio,
  Music,
  Speaker,
  HelpCircle
} from 'lucide-react';
import './LeftPanel.css';

interface LeftPanelProps {
  onFeatureToggle?: (featureId: string, enabled: boolean) => void;
  onCategoryToggle?: (category: string, visible: boolean) => void;
  onSearch?: (query: string) => void;
  onTabChange?: (tab: string) => void;
}

export function LeftPanel({
  onFeatureToggle,
  onCategoryToggle,
  onSearch,
  onTabChange
}: LeftPanelProps) {
  const { state, dispatch } = useWorkspace();
  const { enabledFeatures, disabledFeatures, handleFeatureToggle, handleCategoryToggle, toggleAI, importBIM } = useFeatureManager();

  const panelRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !panelRef.current) return;

    const newWidth = e.clientX;
    const minWidth = 200;
    const maxWidth = 500;

    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    dispatch({ type: 'SET_PANEL_WIDTH', payload: { panel: 'left' as const, width: clampedWidth } });
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  React.useEffect(() => {
    if (isResizing) {
      const handleMouseMoveWrapper = (e: MouseEvent) => handleMouseMove(e);
      const handleMouseUpWrapper = () => handleMouseUp();

      document.addEventListener('mousemove', handleMouseMoveWrapper);
      document.addEventListener('mouseup', handleMouseUpWrapper);

      return () => {
        document.removeEventListener('mousemove', handleMouseMoveWrapper);
        document.removeEventListener('mouseup', handleMouseUpWrapper);
      };
    }
  }, [isResizing]);

  // Handle search (placeholder - search not implemented in context yet)
  const handleSearch = (query: string) => {
    console.log('Search:', query);
    if (onSearch) {
      onSearch(query);
    }
  };

  // Handle tab change (placeholder - tabs not implemented in context yet)
  const handleTabChange = (tab: string) => {
    console.log('Tab change:', tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Handle feature toggle
  const handleFeatureToggleLocal = (featureId: string, enabled: boolean) => {
    handleFeatureToggle(featureId, enabled);
    if (onFeatureToggle) {
      onFeatureToggle(featureId, enabled);
    }
  };

  // quick action handlers
  const handleImportClick = () => {
    showToast.info('Import feature not implemented');
  };
  const handleExportClick = () => {
    showToast.info('Export feature not implemented');
  };
  const handleShareClick = () => {
    showToast.info('Share feature not implemented');
  };
  const handleSettingsClick = () => {
    showToast.info('Settings panel not implemented');
  };

  // Handle category toggle
  const handleCategoryToggleLocal = (category: string, visible: boolean) => {
    handleCategoryToggle(category, visible);
    if (onCategoryToggle) {
      onCategoryToggle(category, visible);
    }
  };

  // Get icon component for feature
  const getFeatureIcon = (featureId: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      move: <Move className="w-4 h-4" />,
      rotate: <RotateCw className="w-4 h-4" />,
      scale: <Scale className="w-4 h-4" />,
      measure: <Ruler className="w-4 h-4" />,
      lighting: <Sun className="w-4 h-4" />,
      materials: <Palette className="w-4 h-4" />,
      undo: <Undo className="w-4 h-4" />,
      redo: <Redo className="w-4 h-4" />,
      minimap: <Map className="w-4 h-4" />,
      materialEditor: <Edit className="w-4 h-4" />,
      gps: <MapPin className="w-4 h-4" />,
      geoWorkspaceArea: <Mountain className="w-4 h-4" />,
      geoSync: <Network className="w-4 h-4" />,
      underwaterMode: <Droplet className="w-4 h-4" />,
      waterShader: <Droplet className="w-4 h-4" />,
      voiceChat: <Mic className="w-4 h-4" />,
      vrarMode: <Eye className="w-4 h-4" />,
      wetMaterialManager: <Droplet className="w-4 h-4" />,
      windTunnelSimulation: <Wind className="w-4 h-4" />,
    };

    return iconMap[featureId] || <Settings className="w-4 h-4" />;
  };

  // Get features by category
  const getFeaturesByCategory = (category: string) => {
    return Object.values(featureCategories).flat().filter((feature: Feature) => feature.category === category);
  };

  return (
    <motion.div
      ref={panelRef}
      className="left-panel h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg relative"
      animate={{ width: `${state.leftPanelWidth}px`, x: 0 }}
      initial={{ x: -320, width: `${state.leftPanelWidth}px` }}
      exit={{ x: -320 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        className="left-panel-header p-4 border-b border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="left-panel-title text-lg font-semibold text-gray-900 dark:text-white">Features</h2>
        <Button variant="ghost" size="sm" className="left-panel-close hover:bg-gray-100 dark:hover:bg-gray-800">
          ✕
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div
        className="left-panel-search p-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Input
          placeholder="Search features..."
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input w-full"
        />
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Tabs defaultValue="essential" onValueChange={handleTabChange} className="left-panel-tabs">
          <TabsList className="left-panel-tabs-list grid w-full grid-cols-3 lg:grid-cols-6 mx-4 mb-4">
            <TabsTrigger value="essential" className="left-panel-tab text-xs md:text-sm">
              Essential
            </TabsTrigger>
            <TabsTrigger value="simulation" className="left-panel-tab text-xs md:text-sm">
              Simulation
            </TabsTrigger>
            <TabsTrigger value="ai" className="left-panel-tab text-xs md:text-sm">
              AI
            </TabsTrigger>
            <TabsTrigger value="analysis" className="left-panel-tab text-xs md:text-sm">
              Analysis
            </TabsTrigger>
            <TabsTrigger value="collaboration" className="left-panel-tab text-xs md:text-sm">
              Collaboration
            </TabsTrigger>
            <TabsTrigger value="immersive" className="left-panel-tab text-xs md:text-sm">
              Immersive
            </TabsTrigger>
          </TabsList>

        <ScrollArea className="left-panel-scroll-area">
          {/* Essential Features */}
          <TabsContent value="essential" className="left-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Essential Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFeaturesByCategory('essential').map((feature: Feature) => (
                  <Button
                    key={feature.id}
                    variant={enabledFeatures.some((f: Feature) => f.id === feature.id) ? 'default' : 'outline'}
                    size="sm"
                    className="feature-button"
                    onClick={() => handleFeatureToggleLocal(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id))}
                    title={feature.description}
                  >
                    {getFeatureIcon(feature.id)}
                    <span className="feature-name">{feature.name}</span>
                    <Badge variant="secondary" className="feature-badge">
                      {feature.hotkey}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Simulation Features */}
          <TabsContent value="simulation" className="left-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Simulation Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFeaturesByCategory('simulation').map((feature: Feature) => (
                  <Button
                    key={feature.id}
                    variant={enabledFeatures.some((f: Feature) => f.id === feature.id) ? 'default' : 'outline'}
                    size="sm"
                    className="feature-button"
                    onClick={() => handleFeatureToggleLocal(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id))}
                    title={feature.description}
                  >
                    {getFeatureIcon(feature.id)}
                    <span className="feature-name">{feature.name}</span>
                    <Badge variant="secondary" className="feature-badge">
                      {feature.hotkey}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Features */}
          <TabsContent value="ai" className="left-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFeaturesByCategory('ai').map((feature: Feature) => (
                  <Button
                    key={feature.id}
                    variant={enabledFeatures.some((f: Feature) => f.id === feature.id) ? 'default' : 'outline'}
                    size="sm"
                    className="feature-button"
                    onClick={() => handleFeatureToggleLocal(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id))}
                    title={feature.description}
                  >
                    {getFeatureIcon(feature.id)}
                    <span className="feature-name">{feature.name}</span>
                    <Badge variant="secondary" className="feature-badge">
                      {feature.hotkey}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis Features */}
          <TabsContent value="analysis" className="left-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Analysis Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFeaturesByCategory('analysis').map((feature: Feature) => (
                  <Button
                    key={feature.id}
                    variant={enabledFeatures.some((f: Feature) => f.id === feature.id) ? 'default' : 'outline'}
                    size="sm"
                    className="feature-button"
                    onClick={() => handleFeatureToggleLocal(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id))}
                    title={feature.description}
                  >
                    {getFeatureIcon(feature.id)}
                    <span className="feature-name">{feature.name}</span>
                    <Badge variant="secondary" className="feature-badge">
                      {feature.hotkey}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collaboration Features */}
          <TabsContent value="collaboration" className="left-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Collaboration Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFeaturesByCategory('collaboration').map((feature: Feature) => (
                  <Button
                    key={feature.id}
                    variant={enabledFeatures.some((f: Feature) => f.id === feature.id) ? 'default' : 'outline'}
                    size="sm"
                    className="feature-button"
                    onClick={() => handleFeatureToggleLocal(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id))}
                    title={feature.description}
                  >
                    {getFeatureIcon(feature.id)}
                    <span className="feature-name">{feature.name}</span>
                    <Badge variant="secondary" className="feature-badge">
                      {feature.hotkey}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Immersive Features */}
          <TabsContent value="immersive" className="left-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Immersive Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {getFeaturesByCategory('immersive').map((feature: Feature) => (
                  <Button
                    key={feature.id}
                    variant={enabledFeatures.some((f: Feature) => f.id === feature.id) ? 'default' : 'outline'}
                    size="sm"
                    className="feature-button"
                    onClick={() => handleFeatureToggleLocal(feature.id, !enabledFeatures.some((f: Feature) => f.id === feature.id))}
                    title={feature.description}
                  >
                    {getFeatureIcon(feature.id)}
                    <span className="feature-name">{feature.name}</span>
                    <Badge variant="secondary" className="feature-badge">
                      {feature.hotkey}
                    </Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="left-panel-quick-actions p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Separator className="mb-4" />
        <div className="quick-actions-grid grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="quick-action-button hover:scale-105 transition-transform" onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" className="quick-action-button hover:scale-105 transition-transform" onClick={handleExportClick}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="quick-action-button hover:scale-105 transition-transform" onClick={handleShareClick}>
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="quick-action-button hover:scale-105 transition-transform" onClick={handleSettingsClick}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </motion.div>

      {/* Object Selection & Transform Controls */}
      <motion.div
        className="left-panel-transform-controls p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Separator className="mb-4" />
        <div className="transform-section mb-4">
          <h4 className="section-title text-sm font-medium mb-2">Object Selection</h4>
          <div className="selection-buttons grid grid-cols-1 gap-2">
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <MousePointer className="w-4 h-4 mr-2" />
              Select All
            </Button>
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <Target className="w-4 h-4 mr-2" />
              Select None
            </Button>
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <Navigation className="w-4 h-4 mr-2" />
              Invert Selection
            </Button>
          </div>
        </div>

        <div className="transform-section">
          <h4 className="section-title text-sm font-medium mb-2">Transform Controls</h4>
          <div className="transform-buttons grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <Move className="w-4 h-4 mr-2" />
              Move
            </Button>
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <RotateCw className="w-4 h-4 mr-2" />
              Rotate
            </Button>
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <Scale className="w-4 h-4 mr-2" />
              Scale
            </Button>
            <Button variant="outline" size="sm" className="transform-button hover:scale-105 transition-transform justify-start">
              <Ruler className="w-4 h-4 mr-2" />
              Measure
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </motion.div>
  );
}

