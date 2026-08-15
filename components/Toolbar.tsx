import React, { useState } from 'react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import {
  Box,
  Download,
  Camera,
  Undo,
  Redo,
  Play,
  Pause,
  Square,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  Scale,
  Sun,
  Eye,
  EyeOff,
  Layers,
  Settings,
  Wind,
  Mountain,
  Droplet,
  Volume2,
  Cloud,
  Car,
  Activity,
  Ruler,
  Zap,
  DollarSign,
  Shield,
  Sofa,
  Brain,
  Wand2,
  Mic,
  MapPin,
  Palette,
  Construction,
  Eye as EyeIcon,
  Smartphone,
  Hand,
  Presentation,
  MessageSquare,
  Search,
  Cpu,
  Network,
  Users,
  CloudSnow
} from 'lucide-react';

interface ToolbarButton {
  id: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  icon: string;
  tooltip: string;
}

interface ToolbarProps {
  buttons?: ToolbarButton[];
  onAddCube?: () => void;
  onExportGLB?: () => void;
  onScreenshot?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onRotate?: () => void;
  onMove?: () => void;
  onScale?: () => void;
  onToggleLighting?: () => void;
  onToggleVisibility?: () => void;
  onToggleLayers?: () => void;
  onSettings?: () => void;
  isPlaying?: boolean;
  isVisible?: boolean;
  lightingEnabled?: boolean;
  onToggleWindTunnel?: () => void;
  onToggleTopography?: () => void;
  onToggleFloodSimulation?: () => void;
  onToggleNoiseSimulation?: () => void;
  onToggleSnowSimulation?: () => void;
  onToggleRainSimulation?: () => void;
  // Presentation feature handlers
  onToggleScenarioWalkthrough?: () => void;
  onToggleBeforeAfter?: () => void;
  onToggleARMode?: () => void;
  onToggleComparativeTours?: () => void;
  onToggleMoodScenes?: () => void;
  onToggleSeasonalDecor?: () => void;
  onToggleROICalculator?: () => void;
  // Additional feature handlers
  onToggleWeatherSystem?: () => void;
  onToggleEnhancedFlood?: () => void;
  onToggleTrafficParking?: () => void;
  onToggleShadowAnalysis?: () => void;
  onToggleCirculationFlow?: () => void;
  onToggleMeasureTool?: () => void;
  onToggleErgonomicTesting?: () => void;
  onToggleEnergyAnalysis?: () => void;
  onToggleCostEstimator?: () => void;
  onToggleSoundPrivacy?: () => void;
  onToggleFurnitureClearance?: () => void;
  onToggleAiAdvisor?: () => void;
  onToggleAutoFurnish?: () => void;
  onToggleAiCoDesigner?: () => void;
  onToggleVoiceAssistant?: () => void;
  onToggleSiteContext?: () => void;
  onToggleLightingMoods?: () => void;
  onToggleGeoLocation?: () => void;
  onToggleConstructionOverlay?: () => void;
  onToggleMultiSensory?: () => void;
  onToggleVrArMode?: () => void;
  onToggleHandTracking?: () => void;
  onTogglePresenterMode?: () => void;
  onToggleAnnotations?: () => void;
  onTogglePropertyInspector?: () => void;
  onToggleWorkspaceMode?: () => void;
  onTogglePathTracing?: () => void;
  onToggleIotIntegration?: () => void;
  onToggleAnimationPlayPause?: () => void;
  // Additional missing handlers
  onToggleSunlightAnalysis?: () => void;
  onToggleBimIntegration?: () => void;
  onToggleMaterialManager?: () => void;
  onToggleMultiUser?: () => void;
  onToggleExport?: () => void;
  onToggleSceneBrowser?: () => void;
  // Missing feature handlers
  onToggleMinimap?: () => void;
  onToggleMaterialEditor?: () => void;
  onToggleLightingControl?: () => void;
  onToggleMovementTool?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onAddCube,
  onExportGLB,
  onScreenshot,
  onUndo,
  onRedo,
  onPlay,
  onPause,
  onStop,
  onZoomIn,
  onZoomOut,
  onRotate,
  onMove,
  onScale,
  onToggleLighting,
  onToggleVisibility,
  onToggleLayers,
  onSettings,
  isPlaying = false,
  isVisible = true,
  lightingEnabled = true,
  onToggleWindTunnel,
  onToggleTopography,
  onToggleFloodSimulation,
  onToggleNoiseSimulation,
  onToggleSnowSimulation,
  onToggleRainSimulation,
  // Presentation feature handlers
  onToggleScenarioWalkthrough,
  onToggleBeforeAfter,
  onToggleARMode,
  onToggleComparativeTours,
  onToggleMoodScenes,
  onToggleSeasonalDecor,
  onToggleROICalculator,
  // Additional handlers
  onToggleWeatherSystem,
  onToggleEnhancedFlood,
  onToggleTrafficParking,
  onToggleShadowAnalysis,
  onToggleCirculationFlow,
  onToggleMeasureTool,
  onToggleErgonomicTesting,
  onToggleEnergyAnalysis,
  onToggleCostEstimator,
  onToggleSoundPrivacy,
  onToggleFurnitureClearance,
  onToggleAiAdvisor,
  onToggleAutoFurnish,
  onToggleAiCoDesigner,
  onToggleVoiceAssistant,
  onToggleSiteContext,
  onToggleLightingMoods,
  onToggleGeoLocation,
  onToggleConstructionOverlay,
  onToggleMultiSensory,
  onToggleVrArMode,
  onToggleHandTracking,
  onTogglePresenterMode,
  onToggleAnnotations,
  onTogglePropertyInspector,
  onToggleWorkspaceMode,
  onTogglePathTracing,
  onToggleIotIntegration,
  onToggleAnimationPlayPause,
  // Additional missing handlers
  onToggleSunlightAnalysis,
  onToggleBimIntegration,
  onToggleMaterialManager,
  onToggleMultiUser,
  onToggleExport,
  onToggleSceneBrowser,
  // Missing feature handlers
  onToggleMinimap,
  onToggleMaterialEditor,
  onToggleLightingControl,
  onToggleMovementTool
}) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const handleToolClick = (tool: string, callback?: () => void) => {
    setActiveTool(activeTool === tool ? null : tool);
    if (callback) callback();
  };

  return (
    <div className="vertical-toolbar bg-slate-800 border-r border-slate-700 p-2 flex flex-col items-center gap-2 h-full overflow-y-auto w-16">
      {/* File Operations */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">File</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('addCube', onAddCube)}
          className={`toolbar-button w-10 h-10 ${activeTool === 'addCube' ? 'bg-slate-600' : ''}`}
          title="Add Cube"
        >
          <Box className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('export', onExportGLB)}
          className="w-10 h-10"
          title="Export GLB"
        >
          <Download className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('screenshot', onScreenshot)}
          className="w-10 h-10"
          title="Screenshot"
        >
          <Camera className="w-5 h-5" />
        </Button>
      </div>

      {/* Edit Operations */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Edit</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('undo', onUndo)}
          className="w-10 h-10"
          title="Undo"
        >
          <Undo className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('redo', onRedo)}
          className="w-10 h-10"
          title="Redo"
        >
          <Redo className="w-5 h-5" />
        </Button>
      </div>

      {/* Animation Controls */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Anim</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('play', onToggleAnimationPlayPause)}
          className={`w-10 h-10 ${isPlaying ? 'bg-green-600' : ''}`}
          title="Play/Pause Animation"
        >
          <Play className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('pause', onPause)}
          className="w-10 h-10"
          title="Pause Animation"
        >
          <Pause className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('stop', onStop)}
          className="w-10 h-10"
          title="Stop Animation"
        >
          <Square className="w-5 h-5" />
        </Button>
      </div>

      {/* View Controls */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">View</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('zoomIn', onZoomIn)}
          className="w-10 h-10"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('zoomOut', onZoomOut)}
          className="w-10 h-10"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('minimap', onToggleMinimap)}
          className="w-10 h-10"
          title="Toggle Minimap"
        >
          <MapPin className="w-5 h-5" />
        </Button>
      </div>

      {/* Transform Tools */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Tools</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('move', onMove)}
          className={`toolbar-button w-10 h-10 ${activeTool === 'move' ? 'bg-blue-600' : ''}`}
          title="Move Tool"
        >
          <Move className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('rotate', onRotate)}
          className={`toolbar-button w-10 h-10 ${activeTool === 'rotate' ? 'bg-blue-600' : ''}`}
          title="Rotate Tool"
        >
          <RotateCw className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('scale', onScale)}
          className={`toolbar-button w-10 h-10 ${activeTool === 'scale' ? 'bg-blue-600' : ''}`}
          title="Scale Tool"
        >
          <Scale className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('materialEditor', onToggleMaterialEditor)}
          className="w-10 h-10"
          title="Material Editor"
        >
          <Palette className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('movementTool', onToggleMovementTool)}
          className="w-10 h-10"
          title="Movement Tool"
        >
          <Move className="w-5 h-5" />
        </Button>
      </div>

      {/* Display Controls */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Display</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('lighting', onToggleLighting)}
          className={`w-10 h-10 ${lightingEnabled ? 'bg-yellow-600' : ''}`}
          title="Toggle Lighting"
        >
          <Sun className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('visibility', onToggleVisibility)}
          className={`w-10 h-10 ${isVisible ? '' : 'bg-red-600'}`}
          title="Toggle Visibility"
        >
          {isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('layers', onToggleLayers)}
          className="w-10 h-10"
          title="Toggle Layers"
        >
          <Layers className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('lightingControl', onToggleLightingControl)}
          className="w-10 h-10"
          title="Lighting Control"
        >
          <Sun className="w-5 h-5" />
        </Button>
      </div>

      {/* Settings */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('settings', onSettings)}
          className="w-10 h-10"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Simulation Buttons */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Sim</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('weatherSystem', onToggleWeatherSystem)}
          className="w-10 h-10"
          title="Weather System"
        >
          <Cloud className="w-5 h-5" />
        </Button>

        {/* Removed duplicate Flood Simulation button */}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('enhancedFlood', onToggleEnhancedFlood)}
          className="w-10 h-10"
          title="Enhanced Flood"
        >
          <Droplet className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('windTunnel', onToggleWindTunnel)}
          className="w-10 h-10"
          title="Wind Tunnel"
        >
          <Wind className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('noiseSimulation', onToggleNoiseSimulation)}
          className="w-10 h-10"
          title="Noise Simulation"
        >
          <Volume2 className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('snowSimulation', onToggleSnowSimulation)}
          className="w-10 h-10"
          title="Snow Simulation"
        >
          <CloudSnow className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('rainSimulation', onToggleRainSimulation)}
          className="w-10 h-10"
          title="Rain Simulation"
        >
          <Droplet className="w-5 h-5" />
        </Button>
      </div>

      {/* Analysis Tools */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Analysis</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('measureTool', onToggleMeasureTool)}
          className="w-10 h-10"
          title="Measure Tool"
        >
          <Ruler className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('energyAnalysis', onToggleEnergyAnalysis)}
          className="w-10 h-10"
          title="Energy Analysis"
        >
          <Zap className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('costEstimator', onToggleCostEstimator)}
          className="w-10 h-10"
          title="Cost Estimator"
        >
          <DollarSign className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('soundPrivacy', onToggleSoundPrivacy)}
          className="w-10 h-10"
          title="Sound Privacy"
        >
          <Shield className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('furnitureClearance', onToggleFurnitureClearance)}
          className="w-10 h-10"
          title="Furniture Clearance"
        >
          <Sofa className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('sunlightAnalysis', onToggleSunlightAnalysis)}
          className="w-10 h-10"
          title="Sunlight Analysis"
        >
          <Sun className="w-5 h-5" />
        </Button>
      </div>

      {/* AI Features */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">AI</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('aiAdvisor', onToggleAiAdvisor)}
          className="w-10 h-10"
          title="AI Structural Advisor"
        >
          <Brain className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('autoFurnish', onToggleAutoFurnish)}
          className="w-10 h-10"
          title="Auto-Furnish"
        >
          <Wand2 className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('aiCoDesigner', onToggleAiCoDesigner)}
          className="w-10 h-10"
          title="AI Co-Designer"
        >
          <Palette className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('voiceAssistant', onToggleVoiceAssistant)}
          className="w-10 h-10"
          title="Voice Assistant"
        >
          <Mic className="w-5 h-5" />
        </Button>
      </div>

      {/* Environment Features */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Env</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('siteContext', onToggleSiteContext)}
          className="w-10 h-10"
          title="Site Context"
        >
          <MapPin className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('topography', onToggleTopography)}
          className="w-10 h-10"
          title="Topography"
        >
          <Mountain className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('lightingMoods', onToggleLightingMoods)}
          className="w-10 h-10"
          title="Lighting Moods"
        >
          <Sun className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('geoLocation', onToggleGeoLocation)}
          className="w-10 h-10"
          title="Geo Location"
        >
          <MapPin className="w-5 h-5" />
        </Button>
      </div>

      {/* Construction Features */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Constr</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('constructionOverlay', onToggleConstructionOverlay)}
          className="w-10 h-10"
          title="Construction Overlay"
        >
          <Construction className="w-5 h-5" />
        </Button>
      </div>

      {/* Interaction Features */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Interact</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('multiSensory', onToggleMultiSensory)}
          className="w-10 h-10"
          title="Multi-Sensory"
        >
          <EyeIcon className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('vrArMode', onToggleVrArMode)}
          className="w-10 h-10"
          title="VR/AR Mode"
        >
          <Smartphone className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('handTracking', onToggleHandTracking)}
          className="w-10 h-10"
          title="Hand Tracking"
        >
          <Hand className="w-5 h-5" />
        </Button>
      </div>

      {/* Collaboration Features */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Collab</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('presenterMode', onTogglePresenterMode)}
          className="w-10 h-10"
          title="Presenter Mode"
        >
          <Presentation className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('annotations', onToggleAnnotations)}
          className="w-10 h-10"
          title="Annotations"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </div>

      {/* Utilities */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Utils</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('propertyInspector', onTogglePropertyInspector)}
          className="w-10 h-10"
          title="Property Inspector"
        >
          <Search className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('workspaceMode', onToggleWorkspaceMode)}
          className="w-10 h-10"
          title="Workspace Mode"
        >
          <Box className="w-5 h-5" />
        </Button>
      </div>

      {/* Advanced Features */}
      <div className="flex flex-col items-center gap-2 p-2 border-b border-slate-600 w-full">
        <div className="text-xs text-slate-400 mb-1">Adv</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('pathTracing', onTogglePathTracing)}
          className="w-10 h-10"
          title="Path Tracing"
        >
          <Activity className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('iotIntegration', onToggleIotIntegration)}
          className="w-10 h-10"
          title="IoT Integration"
        >
          <Network className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('bimIntegration', onToggleBimIntegration)}
          className="w-10 h-10"
          title="BIM Integration"
        >
          <Construction className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('materialManager', onToggleMaterialManager)}
          className="w-10 h-10"
          title="Material Manager"
        >
          <Palette className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('multiUser', onToggleMultiUser)}
          className="w-10 h-10"
          title="Multi-User"
        >
          <Users className="w-5 h-5" />
        </Button>
      </div>

      {/* Presentation Features */}
      <div className="flex flex-col items-center gap-2 p-2 w-full">
        <div className="text-xs text-slate-400 mb-1">Pres</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('scenarioWalkthrough', onToggleScenarioWalkthrough)}
          className="w-10 h-10 text-lg"
          title="Scenario Walkthroughs"
        >
          🎭
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('beforeAfter', onToggleBeforeAfter)}
          className="w-10 h-10 text-lg"
          title="Before/After Toggle"
        >
          ⚖️
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('arMode', onToggleARMode)}
          className="w-10 h-10 text-lg"
          title="AR Mini Model Mode"
        >
          📱
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('comparativeTours', onToggleComparativeTours)}
          className="w-10 h-10 text-lg"
          title="Comparative Tours"
        >
          🔄
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('moodScenes', onToggleMoodScenes)}
          className="w-10 h-10 text-lg"
          title="Interactive Mood Scenes"
        >
          🎨
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('seasonalDecor', onToggleSeasonalDecor)}
          className="w-10 h-10 text-lg"
          title="Seasonal Auto-Decor"
        >
          🎄
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToolClick('roiCalculator', onToggleROICalculator)}
          className="w-10 h-10 text-lg"
          title="Mortgage/ROI Calculator"
        >
          💰
        </Button>
      </div>
    </div>
  );
};

export default Toolbar;
