import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  Move, RotateCw, Scale, Ruler, Sun, Palette, Undo, Redo, Map, Edit, Play, Layers, CloudSnow, Droplet, Wind, Volume2, Car, Sun as SunIcon, Brain, Wand2, Mic, Users, MessageSquare, Share, Eye, Smartphone, Volume, Hand, Presentation, Activity, Network, Mountain, Construction, Zap, DollarSign, EyeOff, Target, Trash, FileText, Bell, Pencil, Download, Upload, Settings, MapPin
} from 'lucide-react';

// Feature categories array from BabylonWorkspace.tsx
const featureCategoriesArray = [
  { id: 'move', name: 'Move', icon: <Move className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'M', description: 'Move objects in 3D space' },
  { id: 'rotate', name: 'Rotate', icon: <RotateCw className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'R', description: 'Rotate objects' },
  { id: 'scale', name: 'Scale', icon: <Scale className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'S', description: 'Scale objects' },
  { id: 'measure', name: 'Measure', icon: <Ruler className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'T', description: 'Measure distances and dimensions' },
  { id: 'lighting', name: 'Lighting', icon: <Sun className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'L', description: 'Control scene lighting' },
  { id: 'materials', name: 'Materials', icon: <Palette className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'P', description: 'Manage materials and textures' },
  { id: 'undo', name: 'Undo', icon: <Undo className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'Ctrl+Z', description: 'Undo last action' },
  { id: 'redo', name: 'Redo', icon: <Redo className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'Ctrl+Y', description: 'Redo last undone action' },
  { id: 'minimap', name: 'Minimap', icon: <Map className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'N', description: 'Show minimap' },
  { id: 'materialEditor', name: 'Material Editor', icon: <Edit className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'E', description: 'Edit materials' },
  { id: 'animationTimeline', name: 'Animation Timeline', icon: <Play className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'A', description: 'Control and manage animations' },
  { id: 'bimIntegration', name: 'BIM Integration', icon: <Layers className="w-4 h-4" />, category: 'essential', enabled: true, hotkey: 'B', description: 'Building Information Modeling' },
  { id: 'weather', name: 'Weather', icon: <CloudSnow className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'W', description: 'Weather simulation and effects' },
  { id: 'flood', name: 'Flood', icon: <Droplet className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'F', description: 'Flood simulation' },
  { id: 'wind', name: 'Wind Tunnel', icon: <Wind className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'T', description: 'Wind tunnel simulation' },
  { id: 'noise', name: 'Noise', icon: <Volume2 className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'N', description: 'Noise simulation' },
  { id: 'traffic', name: 'Traffic', icon: <Car className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'R', description: 'Traffic simulation' },
  { id: 'shadow', name: 'Shadow Analysis', icon: <SunIcon className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'H', description: 'Shadow analysis' },
  { id: 'moodScene', name: 'Mood Scenes', icon: <SunIcon className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'M', description: 'Interactive lighting mood scenes' },
  { id: 'seasonalDecor', name: 'Seasonal Decor', icon: <CloudSnow className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'D', description: 'Seasonal decoration management' },
  { id: 'aiAdvisor', name: 'AI Advisor', icon: <Brain className="w-4 h-4" />, category: 'ai', enabled: true, hotkey: 'A', description: 'AI-powered design advisor' },
  { id: 'autoFurnish', name: 'Auto Furnish', icon: <Wand2 className="w-4 h-4" />, category: 'ai', enabled: true, hotkey: 'U', description: 'Automatic furniture placement' },
  { id: 'aiCoDesigner', name: 'Co-Designer', icon: <Wand2 className="w-4 h-4" />, category: 'ai', enabled: true, hotkey: 'C', description: 'AI collaborative design' },
  { id: 'voiceAssistant', name: 'Voice AI', icon: <Mic className="w-4 h-4" />, category: 'ai', enabled: true, hotkey: 'V', description: 'Voice-controlled assistant' },
  { id: 'ergonomic', name: 'Ergonomic', icon: <Users className="w-4 h-4" />, category: 'analysis', enabled: true, hotkey: 'E', description: 'Ergonomic analysis' },
  { id: 'energy', name: 'Energy', icon: <Zap className="w-4 h-4" />, category: 'analysis', enabled: true, hotkey: 'G', description: 'Energy efficiency analysis' },
  { id: 'cost', name: 'Cost Est.', icon: <DollarSign className="w-4 h-4" />, category: 'analysis', enabled: true, hotkey: 'O', description: 'Cost estimation' },
  { id: 'beforeAfter', name: 'Before/After', icon: <Layers className="w-4 h-4" />, category: 'analysis', enabled: true, hotkey: 'B', description: 'Compare before and after states' },
  { id: 'comparativeTour', name: 'Comparative Tour', icon: <Eye className="w-4 h-4" />, category: 'analysis', enabled: true, hotkey: 'C', description: 'Side-by-side comparative tours' },
  { id: 'roiCalculator', name: 'ROI Calculator', icon: <DollarSign className="w-4 h-4" />, category: 'analysis', enabled: true, hotkey: 'R', description: 'Real estate ROI calculations' },
  { id: 'multiUser', name: 'Multi-User', icon: <Users className="w-4 h-4" />, category: 'collaboration', enabled: true, hotkey: 'U', description: 'Multi-user collaboration' },
  { id: 'chat', name: 'Chat', icon: <MessageSquare className="w-4 h-4" />, category: 'collaboration', enabled: true, hotkey: 'C', description: 'Real-time chat' },
  { id: 'annotations', name: 'Annotations', icon: <Pencil className="w-4 h-4" />, category: 'collaboration', enabled: true, hotkey: 'A', description: 'Add annotations' },
  { id: 'sharing', name: 'Share', icon: <Share className="w-4 h-4" />, category: 'collaboration', enabled: true, hotkey: 'S', description: 'Share workspace' },
  { id: 'vr', name: 'VR Mode', icon: <Eye className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'X', description: 'Virtual reality mode' },
  { id: 'ar', name: 'AR Mode', icon: <Smartphone className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'Z', description: 'Augmented reality mode' },
  { id: 'spatialAudio', name: 'Spatial Audio', icon: <Volume className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'B', description: '3D spatial audio' },
  { id: 'haptic', name: 'Haptic', icon: <Hand className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'H', description: 'Haptic feedback' },
  { id: 'arScale', name: 'AR Scale', icon: <Scale className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'S', description: 'Augmented reality scaling tools' },
  { id: 'scenario', name: 'Scenario', icon: <Presentation className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'P', description: 'Interactive scenario presentation' },
  { id: 'export', name: 'Export', icon: <Download className="w-4 h-4" />, category: 'utilities', enabled: true, hotkey: 'E', description: 'Export scene' },
  { id: 'import', name: 'Import', icon: <Upload className="w-4 h-4" />, category: 'utilities', enabled: true, hotkey: 'I', description: 'Import models' },
  { id: 'settings', name: 'Settings', icon: <Settings className="w-4 h-4" />, category: 'utilities', enabled: true, hotkey: 'S', description: 'Workspace settings' },
  // Geo-Location Features
  { id: 'geoLocation', name: 'Geo Location', icon: <MapPin className="w-4 h-4" />, category: 'location', enabled: true, hotkey: 'G', description: 'GPS-based location services' },
  { id: 'geoWorkspaceArea', name: 'Geo Workspace Area', icon: <Mountain className="w-4 h-4" />, category: 'location', enabled: true, hotkey: 'W', description: 'Define workspace area with geo-coordinates' },
  { id: 'geoSync', name: 'Geo Sync', icon: <Network className="w-4 h-4" />, category: 'location', enabled: true, hotkey: 'Y', description: 'Synchronize with geo-location data' },
  // Enhanced Real-Time Components
  { id: 'underwaterMode', name: 'Underwater Mode', icon: <Droplet className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'U', description: 'Underwater exploration mode' },
  { id: 'waterShader', name: 'Water Shader', icon: <Droplet className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'W', description: 'Advanced water shader effects' },
  { id: 'voiceChat', name: 'Voice Chat', icon: <Mic className="w-4 h-4" />, category: 'collaboration', enabled: true, hotkey: 'V', description: 'Voice communication' },
  { id: 'vrarMode', name: 'VR/AR Mode', icon: <Eye className="w-4 h-4" />, category: 'immersive', enabled: true, hotkey: 'X', description: 'Virtual and augmented reality mode' },
  { id: 'wetMaterialManager', name: 'Wet Material Manager', icon: <Droplet className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'M', description: 'Wet material effects' },
  { id: 'windTunnelSimulation', name: 'Wind Tunnel Simulation', icon: <Wind className="w-4 h-4" />, category: 'simulation', enabled: true, hotkey: 'T', description: 'Wind tunnel simulation' },
];

// Create feature categories mapping
const featureCategories = featureCategoriesArray.reduce((acc: Record<string, typeof featureCategoriesArray>, feature: any) => {
  if (!acc[feature.category]) {
    acc[feature.category] = [];
  }
  acc[feature.category].push(feature);
  return acc;
}, {});

interface ProjectAssetsPanelProps {
  onFeatureToggle?: (featureId: string, enabled: boolean) => void;
}

const ProjectAssetsPanel: React.FC<ProjectAssetsPanelProps> = ({ onFeatureToggle }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryPanelVisible, setCategoryPanelVisible] = useState<Record<string, boolean>>({});
  const [activeFeaturesSet, setActiveFeaturesSet] = useState<Set<string>>(new Set());

  const handleCategoryToggle = (category: string) => {
    setCategoryPanelVisible(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleFeatureToggle = (featureId: string, enabled: boolean) => {
    setActiveFeaturesSet(prev => {
      const newSet = new Set(prev);
      if (enabled) {
        newSet.add(featureId);
      } else {
        newSet.delete(featureId);
      }
      return newSet;
    });
    if (onFeatureToggle) {
      onFeatureToggle(featureId, enabled);
    }
  };

  const getFilteredFeatures = (features: any[]) => {
    if (!searchTerm) return features;
    return features.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const renderFeatureButton = (feature: any) => (
    <TooltipProvider key={feature.id}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={activeFeaturesSet.has(feature.id) ? 'default' : 'outline'}
            onClick={() => handleFeatureToggle(feature.id, !activeFeaturesSet.has(feature.id))}
            className={`flex items-center gap-2 transition-all duration-200 hover:scale-105 ${
              feature.category === 'essential'
                ? 'bg-blue-700 hover:bg-blue-800 text-white border-blue-700 shadow-lg'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {feature.icon}
            <span className="font-semibold">{feature.name}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="text-sm">
            <div className="font-semibold text-blue-500">{feature.name}</div>
            <div className="text-muted-foreground mt-1">{feature.description}</div>
            <div className="text-muted-foreground mt-2 flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs font-mono">{feature.hotkey}</kbd>
              <span className="text-xs">Hotkey</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderCategoryToggles = () => (
    <div className="flex gap-3 mb-4 flex-wrap">
      {Object.keys(featureCategories).map(category => (
        <TooltipProvider key={category}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={categoryPanelVisible[category] ? "default" : "outline"}
                onClick={() => handleCategoryToggle(category)}
                className="capitalize font-semibold"
              >
                {categoryPanelVisible[category] ? "Hide" : "Show"} {category}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-semibold capitalize">{category} Features</div>
                <div className="text-muted-foreground">
                  {categoryPanelVisible[category] ? "Hide" : "Show"} {category} feature panel
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );

  const renderCategoryPanels = () => (
    <div>
      {Object.entries(featureCategories).map(([category, features], index) => (
        categoryPanelVisible[category] && (
          <div key={category}>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="capitalize">{category} Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-1">
                  {getFilteredFeatures(features).map(feature =>
                    renderFeatureButton(feature)
                  )}
                </div>
              </CardContent>
            </Card>
            {index < Object.entries(featureCategories).filter(([cat]) => categoryPanelVisible[cat]).length - 1 && (
              <Separator className="my-4 bg-gray-600" />
            )}
          </div>
        )
      ))}
    </div>
  );

  return (
    <div style={{ width: 300, backgroundColor: '#222', color: 'white', padding: 10, overflowY: 'auto', height: '100%' }}>
      <h3>Project / Assets</h3>
      <ScrollArea className="flex-1">
        <div className="p-5">
          {renderCategoryToggles()}
          <div className="mb-6">
            <Input
              placeholder="Search features..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
              aria-label="Search Features"
            />
          </div>
          {renderCategoryPanels()}
        </div>
      </ScrollArea>
      {/* TODO: Implement drag-drop asset management */}
      <p>Drag and drop assets here</p>
    </div>
  );
};

export default ProjectAssetsPanel;
