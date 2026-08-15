import React, { useState, useEffect, useCallback } from 'react';
import { Scene, Engine } from '@babylonjs/core';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Activity, AlertTriangle, CheckCircle, Clock, 
  Cpu, Zap, Users, Settings, Info 
} from 'lucide-react';

// Import all feature components
import WeatherSystem from './WeatherSystem';
import FloodSimulation from './FloodSimulation';
import EnhancedFloodSimulation from './EnhancedFloodSimulation';
import WindTunnelSimulation from './WindTunnelSimulation';
import NoiseSimulation from './NoiseSimulation';
import ShadowImpactAnalysis from './ShadowImpactAnalysis';
import TrafficParkingSimulation from './TrafficParkingSimulation';
import MeasureTool from './MeasureTool';
import AIStructuralAdvisor from './AIStructuralAdvisor';
import CirculationFlowSimulation from './CirculationFlowSimulation';
import ErgonomicTesting from './ErgonomicTesting';
import SoundPrivacySimulation from './SoundPrivacySimulation';
import MultiSensoryPreview from './MultiSensoryPreview';
import LightingMoodBoardsFixed from './LightingMoodBoardsFixed';
import FurnitureClearanceChecker from './FurnitureClearanceChecker';
import SiteContextGenerator from './SiteContextGenerator';
import TopographyGenerator from './TopographyGenerator';
import ConstructionOverlay from './ConstructionOverlay';
import GeoLocationContext from './GeoLocationContext';
import AICoDesigner from './AICoDesigner';
import AutoFurnish from './AutoFurnish';
import SunlightAnalysis from './SunlightAnalysis';
import BIMIntegration from './BIMIntegration';
import CostEstimatorWrapper from './CostEstimatorWrapper';
import MaterialManagerWrapper from './MaterialManagerWrapper';
import VRARMode from './VRARMode';
import HandTracking from './HandTracking';
import MultiUser from './MultiUser';
import VoiceChat from './VoiceChat';
import PresenterMode from './PresenterMode';
import Annotations from './Annotations';
import ExportTool from './ExportTool';
import PathTracing from './PathTracing';
import IoTIntegration from './IoTIntegration';
import EnergySim from './EnergySim';
import PropertyInspector from './PropertyInspector';
import SceneBrowser from './SceneBrowser';
import Minimap from './Minimap';
import { MaterialEditorPanel } from './MaterialEditorPanel';
import LightingPresets from './LightingPresets';
import MovementControlChecker from './MovementControlChecker';

interface FeatureConfig {
  id: string;
  name: string;
  category: string;
  component: React.ComponentType<any>;
  props?: any;
  dependencies?: string[];
  conflicts?: string[];
  performance: 'low' | 'medium' | 'high';
  status: 'stable' | 'beta' | 'experimental';
  description: string;
  hotkey?: string;
  premium?: boolean;
}

interface FeatureManagerProps {
  scene: Scene | null;
  engine: Engine | null;
  activeFeatures: Set<string>;
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
  performanceMode: 'performance' | 'balanced' | 'quality';
  selectedObject?: any;
}

const FeatureManager: React.FC<FeatureManagerProps> = ({
  scene,
  engine,
  activeFeatures,
  onFeatureToggle,
  performanceMode,
  selectedObject
}) => {
  const [performanceScore, setPerformanceScore] = useState(100);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [featureStats, setFeatureStats] = useState<any>({});

  // Complete feature configuration
  const features: FeatureConfig[] = [
    // Essential Features
    { 
      id: 'measure', 
      name: 'Measure Tool', 
      category: 'essential', 
      component: MeasureTool, 
      props: { isActive: true },
      performance: 'low', 
      status: 'stable',
      description: 'Precision measurement and dimensioning tools',
      hotkey: 'M'
    },
    { 
      id: 'propertyInspector', 
      name: 'Property Inspector', 
      category: 'essential', 
      component: PropertyInspector, 
      props: { selectedObject },
      performance: 'low', 
      status: 'stable',
      description: 'Object property editor and inspector',
      hotkey: 'I'
    },
    { 
      id: 'sceneBrowser', 
      name: 'Scene Browser', 
      category: 'essential', 
      component: SceneBrowser, 
      performance: 'low', 
      status: 'stable',
      description: 'Hierarchical scene object browser'
    },
    { 
      id: 'minimap', 
      name: 'Minimap', 
      category: 'essential', 
      component: Minimap, 
      props: { camera: scene?.activeCamera },
      performance: 'low', 
      status: 'stable',
      description: 'Navigation minimap overview'
    },
    { 
      id: 'materialEditor', 
      name: 'Material Editor', 
      category: 'essential', 
      component: MaterialEditorPanel, 
      props: { selectedMesh: selectedObject },
      performance: 'low', 
      status: 'stable',
      description: 'Advanced material editing panel'
    },
    { 
      id: 'lightingPresets', 
      name: 'Lighting Presets', 
      category: 'essential', 
      component: LightingPresets, 
      performance: 'low', 
      status: 'stable',
      description: 'Lighting control and presets'
    },

    // Simulation Features
    { 
      id: 'weather', 
      name: 'Weather System', 
      category: 'simulation', 
      component: WeatherSystem, 
      performance: 'medium', 
      status: 'stable',
      description: 'Real-time weather simulation with dynamic effects',
      hotkey: 'W'
    },
    { 
      id: 'flood', 
      name: 'Flood Simulation', 
      category: 'simulation', 
      component: FloodSimulation, 
      props: { terrainMesh: undefined },
      performance: 'high', 
      status: 'stable',
      description: 'Water level simulation and flood analysis',
      hotkey: 'F'
    },
    { 
      id: 'enhancedFlood', 
      name: 'Enhanced Flood', 
      category: 'simulation', 
      component: EnhancedFloodSimulation, 
      dependencies: ['flood'],
      performance: 'high', 
      status: 'beta',
      description: 'Advanced flood simulation with particle effects',
      premium: true
    },
    { 
      id: 'wind', 
      name: 'Wind Tunnel', 
      category: 'simulation', 
      component: WindTunnelSimulation, 
      performance: 'high', 
      status: 'stable',
      description: 'Aerodynamic analysis and wind flow visualization',
      hotkey: 'T'
    },
    { 
      id: 'noise', 
      name: 'Noise Simulation', 
      category: 'simulation', 
      component: NoiseSimulation, 
      performance: 'medium', 
      status: 'stable',
      description: 'Acoustic analysis and sound propagation',
      hotkey: 'N'
    },
    { 
      id: 'traffic', 
      name: 'Traffic & Parking', 
      category: 'simulation', 
      component: TrafficParkingSimulation, 
      performance: 'medium', 
      status: 'stable',
      description: 'Traffic flow and parking optimization',
      hotkey: 'R'
    },
    { 
      id: 'circulation', 
      name: 'Circulation Flow', 
      category: 'simulation', 
      component: CirculationFlowSimulation, 
      props: { isActive: true },
      performance: 'medium', 
      status: 'stable',
      description: 'Pedestrian flow and circulation patterns'
    },

    // Analysis Features
    { 
      id: 'shadow', 
      name: 'Shadow Analysis', 
      category: 'analysis', 
      component: ShadowImpactAnalysis, 
      performance: 'low', 
      status: 'stable',
      description: 'Sun path and shadow impact analysis',
      hotkey: 'S'
    },
    { 
      id: 'sunlight', 
      name: 'Sunlight Analysis', 
      category: 'analysis', 
      component: SunlightAnalysis, 
      props: { isActive: true },
      performance: 'medium', 
      status: 'stable',
      description: 'Natural lighting and solar analysis'
    },
    { 
      id: 'energy', 
      name: 'Energy Analysis', 
      category: 'analysis', 
      component: EnergySim, 
      performance: 'medium', 
      status: 'stable',
      description: 'Energy efficiency and consumption analysis',
      hotkey: 'E'
    },
    { 
      id: 'cost', 
      name: 'Cost Estimator', 
      category: 'analysis', 
      component: CostEstimatorWrapper, 
      performance: 'low', 
      status: 'stable',
      description: 'Real-time cost estimation and budgeting',
      hotkey: 'C'
    },
    { 
      id: 'ergonomic', 
      name: 'Ergonomic Testing', 
      category: 'analysis', 
      component: ErgonomicTesting, 
      performance: 'medium', 
      status: 'stable',
      description: 'Human factors and ergonomic analysis'
    },
    { 
      id: 'soundPrivacy', 
      name: 'Sound Privacy', 
      category: 'analysis', 
      component: SoundPrivacySimulation, 
      performance: 'medium', 
      status: 'stable',
      description: 'Acoustic privacy and sound isolation analysis'
    },
    { 
      id: 'furniture', 
      name: 'Furniture Clearance', 
      category: 'analysis', 
      component: FurnitureClearanceChecker, 
      performance: 'low', 
      status: 'stable',
      description: 'Furniture placement and clearance checking'
    },

    // AI Features
    { 
      id: 'aiAdvisor', 
      name: 'AI Structural Advisor', 
      category: 'ai', 
      component: AIStructuralAdvisor, 
      props: { isActive: true },
      performance: 'low', 
      status: 'beta',
      description: 'AI-powered structural analysis and recommendations',
      hotkey: 'A',
      premium: true
    },
    { 
      id: 'autoFurnish', 
      name: 'Auto-Furnish', 
      category: 'ai', 
      component: AutoFurnish, 
      props: { isActive: true },
      performance: 'medium', 
      status: 'beta',
      description: 'Automatic furniture placement and room optimization',
      hotkey: 'U',
      premium: true
    },
    { 
      id: 'aiCoDesigner', 
      name: 'AI Co-Designer', 
      category: 'ai', 
      component: AICoDesigner, 
      props: { isActive: true },
      performance: 'low', 
      status: 'experimental',
      description: 'Collaborative AI design assistant',
      premium: true
    },

    // Environment Features
    { 
      id: 'siteContext', 
      name: 'Site Context', 
      category: 'environment', 
      component: SiteContextGenerator, 
      performance: 'medium', 
      status: 'stable',
      description: 'Real-world site context integration'
    },
    { 
      id: 'topography', 
      name: 'Topography', 
      category: 'environment', 
      component: TopographyGenerator, 
      performance: 'medium', 
      status: 'stable',
      description: 'Terrain generation and modification'
    },
    { 
      id: 'geoLocation', 
      name: 'Geo Location', 
      category: 'environment', 
      component: GeoLocationContext, 
      performance: 'low', 
      status: 'stable',
      description: 'GPS-based positioning and mapping'
    },
    { 
      id: 'construction', 
      name: 'Construction Overlay', 
      category: 'environment', 
      component: ConstructionOverlay, 
      performance: 'medium', 
      status: 'stable',
      description: 'Construction phase visualization'
    },
    { 
      id: 'lighting', 
      name: 'Lighting Moods', 
      category: 'environment', 
      component: LightingMoodBoardsFixed, 
      performance: 'low', 
      status: 'stable',
      description: 'Dynamic lighting and mood presets'
    },

    // Collaboration Features
    { 
      id: 'multiUser', 
      name: 'Multi-User', 
      category: 'collaboration', 
      component: MultiUser, 
      props: { isActive: true },
      performance: 'medium', 
      status: 'beta',
      description: 'Real-time collaborative workspace',
      hotkey: 'J',
      premium: true
    },
    { 
      id: 'voiceChat', 
      name: 'Voice Chat', 
      category: 'collaboration', 
      component: VoiceChat, 
      props: { isActive: true },
      dependencies: ['multiUser'],
      performance: 'low', 
      status: 'beta',
      description: 'Integrated voice communication'
    },
    { 
      id: 'annotations', 
      name: 'Annotations', 
      category: 'collaboration', 
      component: Annotations, 
      performance: 'low', 
      status: 'stable',
      description: '3D annotations and markup tools',
      hotkey: 'P'
    },
    { 
      id: 'presenter', 
      name: 'Presenter Mode', 
      category: 'collaboration', 
      component: PresenterMode, 
      props: { isActive: true },
      performance: 'low', 
      status: 'stable',
      description: 'Presentation and walkthrough mode',
      hotkey: 'O'
    },

    // Immersive Features
    { 
      id: 'vr', 
      name: 'VR Mode', 
      category: 'immersive', 
      component: VRARMode, 
      props: { isActive: true },
      conflicts: ['ar'],
      performance: 'high', 
      status: 'beta',
      description: 'Virtual reality workspace experience',
      hotkey: 'X',
      premium: true
    },
    { 
      id: 'handTracking', 
      name: 'Hand Tracking', 
      category: 'immersive', 
      component: HandTracking, 
      props: { isActive: true },
      dependencies: ['vr'],
      performance: 'medium', 
      status: 'experimental',
      description: 'Gesture-based interaction',
      premium: true
    },
    { 
      id: 'multiSensory', 
      name: 'Multi-Sensory', 
      category: 'immersive', 
      component: MultiSensoryPreview, 
      performance: 'medium', 
      status: 'experimental',
      description: 'Multi-sensory feedback and haptics',
      premium: true
    },

    // Construction Features
    { 
      id: 'bim', 
      name: 'BIM Integration', 
      category: 'construction', 
      component: BIMIntegration, 
      props: { isActive: true },
      performance: 'medium', 
      status: 'stable',
      description: 'Building Information Modeling integration',
      premium: true
    },
    { 
      id: 'materials', 
      name: 'Material Manager', 
      category: 'construction', 
      component: MaterialManagerWrapper, 
      props: { socket: null, userId: 'user1' },
      performance: 'low', 
      status: 'stable',
      description: 'Advanced material editing and management'
    },

    // Utilities
    { 
      id: 'export', 
      name: 'Export Tool', 
      category: 'utilities', 
      component: ExportTool, 
      performance: 'low', 
      status: 'stable',
      description: 'Export designs and reports'
    },
    { 
      id: 'pathTracing', 
      name: 'Path Tracing', 
      category: 'utilities', 
      component: PathTracing, 
      performance: 'high', 
      status: 'experimental',
      description: 'Photorealistic ray-traced rendering',
      premium: true
    },
    { 
      id: 'iot', 
      name: 'IoT Integration', 
      category: 'utilities', 
      component: IoTIntegration, 
      performance: 'low', 
      status: 'beta',
      description: 'Internet of Things device integration',
      premium: true
    },
    { 
      id: 'movementTool', 
      name: 'Movement Tool', 
      category: 'utilities', 
      component: MovementControlChecker, 
      props: { camera: scene?.activeCamera },
      performance: 'low', 
      status: 'stable',
      description: 'Advanced movement and navigation controls'
    }
  ];

  // Calculate performance impact
  useEffect(() => {
    let totalImpact = 0;
    const activeFeatureList = Array.from(activeFeatures);
    
    activeFeatureList.forEach(featureId => {
      const feature = features.find(f => f.id === featureId);
      if (feature) {
        switch (feature.performance) {
          case 'low': totalImpact += 5; break;
          case 'medium': totalImpact += 15; break;
          case 'high': totalImpact += 30; break;
        }
      }
    });

    const performanceMultiplier = {
      performance: 0.7,
      balanced: 1.0,
      quality: 1.3
    }[performanceMode];

    const adjustedImpact = totalImpact * performanceMultiplier;
    const score = Math.max(0, 100 - adjustedImpact);
    setPerformanceScore(score);

    // Generate warnings and suggestions
    const newWarnings: string[] = [];
    const newSuggestions: string[] = [];

    if (score < 30) {
      newWarnings.push('Performance critically low - consider disabling some features');
    } else if (score < 60) {
      newWarnings.push('Performance impact detected - monitor frame rate');
    }

    // Check for conflicts and dependencies
    activeFeatureList.forEach(featureId => {
      const feature = features.find(f => f.id === featureId);
      if (feature?.conflicts) {
        feature.conflicts.forEach(conflictId => {
          if (activeFeatures.has(conflictId)) {
            newWarnings.push(`${feature.name} conflicts with ${features.find(f => f.id === conflictId)?.name}`);
          }
        });
      }

      if (feature?.dependencies) {
        feature.dependencies.forEach(depId => {
          if (!activeFeatures.has(depId)) {
            newSuggestions.push(`${feature.name} requires ${features.find(f => f.id === depId)?.name}`);
          }
        });
      }
    });

    setWarnings(newWarnings);
    setSuggestions(newSuggestions);

    // Update feature stats
    const stats = {
      total: features.length,
      active: activeFeatures.size,
      byCategory: features.reduce((acc, feature) => {
        acc[feature.category] = (acc[feature.category] || 0) + (activeFeatures.has(feature.id) ? 1 : 0);
        return acc;
      }, {} as Record<string, number>),
      byStatus: features.reduce((acc, feature) => {
        if (activeFeatures.has(feature.id)) {
          acc[feature.status] = (acc[feature.status] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    };
    setFeatureStats(stats);
  }, [activeFeatures, performanceMode, features]);

  // Render active feature components
  const renderActiveFeatures = (): React.ReactNode | null => {
    if (!scene || !engine) return null;

    return Array.from(activeFeatures).map(featureId => {
      const feature = features.find(f => f.id === featureId);
      if (!feature) return null;

      const Component = feature.component;
      const props = {
        scene,
        engine,
        ...feature.props
      };

      // Use React.createElement to improve type inference
      return React.createElement(Component, { key: featureId, ...props });
    });
  };

  const getPerformanceColor = () => {
    if (performanceScore >= 80) return 'text-green-500';
    if (performanceScore >= 60) return 'text-yellow-500';
    if (performanceScore >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'stable': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'beta': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'experimental': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Performance Monitor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Performance Monitor
            </div>
            <Badge variant="outline" className={getPerformanceColor()}>
              {performanceScore.toString()}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={performanceScore} className="mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{activeFeatures.size} features active</span>
            <span>{performanceMode} mode</span>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-xs">{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index} className="text-xs">{suggestion}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Feature Statistics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Feature Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-medium mb-1">By Category</div>
              {Object.entries(featureStats.byCategory || {}).map(([category, count]: [string, number]) => (
                <div key={category} className="flex justify-between">
                  <span className="capitalize">{category}</span>
                  <Badge variant="secondary" className="text-xs">{count.toString()}</Badge>
                </div>
              ))}
            </div>
            <div>
              <div className="font-medium mb-1">By Status</div>
              {Object.entries(featureStats.byStatus || {}).map(([status, count]: [string, number]) => (
                <div key={status} className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(status)}
                    <span className="capitalize">{status}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{count.toString()}</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render Active Features */}
      <div className="hidden">
        {renderActiveFeatures()}
      </div>
    </div>
  );
};

export default FeatureManager;