import React, { useRef } from 'react';
import { useWorkspace } from '../core/WorkspaceContext';
import { useFeatureManager } from '../core/FeatureManager';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { showToast } from '../../utils/toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import {
  Save,
  Download,
  Upload,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Sun,
  Moon,
  Monitor,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  Share,
  HelpCircle,
  FileText,
  Grid3X3,
  Eye,
  EyeOff,
  Layers,
  Zap,
  Activity,
  Headset,
  // Design & Furniture
  Palette,
  Sofa,
  Home,
  Wrench,
  // Analysis
  TrendingUp,
  Calculator,
  Volume2 as VolumeIcon,
  // Simulation
  CloudRain,
  Wind,
  Car,
  Users as CrowdIcon,
  // Collaboration
  MessageCircle,
  Video,
  UserPlus,
  // Immersive
  Hand,
  Move3D,
  // AI & BIM
  Sparkles,
  Shield,
  Mic,
  MicOff,
  // Navigation
  Navigation,
  Compass,
  // Additional
  ChevronDown,
  Plus,
  Minus,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Globe
} from 'lucide-react';
import { AIManager } from '../../AIManager';
import { BIMManager } from '../../BIMManager';
import './TopBar.css';

interface TopBarProps {
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSettings?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onFullscreen?: () => void;
  onMinimize?: () => void;
  onHelp?: () => void;
  onShare?: () => void;
  onChat?: () => void;
  onCollaborate?: () => void;
}

export function TopBar({
  onSave,
  onExport,
  onImport,
  onSettings,
  onPlay,
  onPause,
  onReset,
  onFullscreen,
  onMinimize,
  onHelp,
  onShare,
  onChat,
  onCollaborate
}: TopBarProps) {
  const { state, dispatch, toggleFeature } = useWorkspace();
  const { importBIM, importBIMFile, toggleClashDetection, toggleWallPeeling, toggleHiddenDetails, showCostEstimation } = useFeatureManager();
  const bimFileInputRef = useRef<HTMLInputElement>(null);

  // local UI state for theme/audio/network
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [audioEnabled, setAudioEnabled] = React.useState(true);
  const [networkEnabled, setNetworkEnabled] = React.useState(true);

  // Handle theme toggle (switch between light and dark)
  const handleThemeToggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    showToast.info(`Switched to ${next} theme`);
  };

  // Handle audio toggle (mute/unmute)
  const handleAudioToggle = () => {
    setAudioEnabled(prev => {
      const next = !prev;
      showToast.info(`Audio ${next ? 'enabled' : 'muted'}`);
      return next;
    });
  };

  // Handle network toggle (simulate connectivity changes)
  const handleNetworkToggle = () => {
    setNetworkEnabled(prev => {
      const next = !prev;
      showToast.info(`Network ${next ? 'connected' : 'disconnected'}`);
      return next;
    });
  };

  // Handle performance mode change
  const handlePerformanceModeChange = (mode: 'low' | 'medium' | 'high') => {
    dispatch({ type: 'SET_PERFORMANCE_MODE', payload: mode });
  };

  // Handle rendering quality change
  const handleRenderingQualityChange = (quality: 'low' | 'medium' | 'high' | 'ultra') => {
    dispatch({ type: 'SET_RENDERING_QUALITY', payload: quality });
  };

  // Handle BIM file import
  const handleBIMImport = () => {
    bimFileInputRef.current?.click();
  };

  const handleBIMFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importBIMFile(file);
    }
  };

  // Handle BIM features
  const handleClashDetection = () => {
    if (state.scene && state.engine) {
      const bimManager = BIMManager.getInstance(state.engine, state.scene);
      if (state.activeFeatures.has('clashDetection')) {
        bimManager.disableClashDetection();
        toggleFeature('clashDetection', false);
      } else {
        bimManager.enableClashDetection();
        toggleFeature('clashDetection', true);
      }
    }
  };

  const handleCostEstimation = () => {
    if (state.scene && state.engine) {
      const bimManager = BIMManager.getInstance(state.engine, state.scene);
      const costBreakdown = bimManager.getCostDisplayData();
      dispatch({ type: 'SET_COST_BREAKDOWN', payload: costBreakdown });
    }
  };

  const handleWallPeeling = () => {
    if (state.scene && state.engine) {
      const bimManager = BIMManager.getInstance(state.engine, state.scene);
      bimManager.toggleWallPeeling();
    }
  };

  return (
    <div className="topbar">
      {/* Left Section - File Operations */}
      <div className="topbar-section topbar-left">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="File menu">
              <FileText className="w-4 h-4" />
              File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
                if (onSave) onSave();
                else showToast.info('Save action not implemented');
              }}>
              <Save className="w-4 h-4 mr-2" />
              Save Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
                if (onImport) onImport();
                else showToast.info('Import action not implemented');
              }}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
                if (onExport) onExport();
                else showToast.info('Export action not implemented');
              }}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onSettings}
          aria-label="Settings"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSettings?.();
            }
          }}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Center Section - Feature Categories */}
      <div className="topbar-section topbar-center">
        {/* Design & Furniture */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Design menu">
              <Palette className="w-4 h-4" />
              Design
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => toggleFeature('autoFurnish', true)}>
              <Sofa className="w-4 h-4 mr-2" />
              Auto-Furnish
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('materialEditor', true)}>
              <Palette className="w-4 h-4 mr-2" />
              Material Editor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('aiCoDesigner', true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI Co-Designer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('futureCity', true)}>
              <Home className="w-4 h-4 mr-2" />
              Future City
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Analysis */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Analysis menu">
              <TrendingUp className="w-4 h-4" />
              Analysis
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => toggleFeature('sunlightAnalysis', true)}>
              <Sun className="w-4 h-4 mr-2" />
              Sunlight Analysis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('acousticsAnalysis', true)}>
              <VolumeIcon className="w-4 h-4 mr-2" />
              Acoustics Analysis
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('spaceUtilization', true)}>
              <Calculator className="w-4 h-4 mr-2" />
              Space Utilization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Simulation */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Simulation menu">
              <CloudRain className="w-4 h-4" />
              Simulation
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => toggleFeature('weatherSimulation', true)}>
              <CloudRain className="w-4 h-4 mr-2" />
              Weather Effects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('windSimulation', true)}>
              <Wind className="w-4 h-4 mr-2" />
              Wind Effects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('trafficFlow', true)}>
              <Car className="w-4 h-4 mr-2" />
              Traffic Flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('crowdSimulation', true)}>
              <CrowdIcon className="w-4 h-4 mr-2" />
              Crowd Circulation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI & BIM */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="AI and BIM menu">
              <Sparkles className="w-4 h-4" />
              AI & BIM
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              if (state.scene) {
                const aiManager = AIManager.getInstance(state.scene);
                if (state.activeFeatures.has('aiAssistant')) {
                  aiManager.stopVoiceListening();
                  toggleFeature('aiAssistant', false);
                } else {
                  aiManager.startVoiceListening();
                  toggleFeature('aiAssistant', true);
                }
              }
            }}>
              <Mic className="w-4 h-4 mr-2" />
              Voice Toggle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (state.scene) {
                const aiManager = AIManager.getInstance(state.scene);
                aiManager.toggleGestureDetection();
              }
            }}>
              <Hand className="w-4 h-4 mr-2" />
              Gesture Detection
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleWallPeeling}>
              <Eye className="w-4 h-4 mr-2" />
              Wall Peeling Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleHiddenDetails}>
              <EyeOff className="w-4 h-4 mr-2" />
              Toggle Hidden Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBIMImport}>
              <Shield className="w-4 h-4 mr-2" />
              BIM Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleClashDetection}>
              <Shield className="w-4 h-4 mr-2" />
              Clash Detection
            </DropdownMenuItem>
            <DropdownMenuItem onClick={showCostEstimation}>
              <Calculator className="w-4 h-4 mr-2" />
              Cost Estimation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Navigation */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Navigation menu">
              <Navigation className="w-4 h-4" />
              Navigate
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => toggleFeature('walkMode', true)}>
              <Navigation className="w-4 h-4 mr-2" />
              Walk Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('flyMode', true)}>
              <Navigation className="w-4 h-4 mr-2" />
              Fly Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('teleportMode', true)}>
              <Move3D className="w-4 h-4 mr-2" />
              Teleport
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Immersive */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Immersive menu">
              <Headset className="w-4 h-4" />
              Immersive
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => toggleFeature('vrMode', true)}>
              <Headset className="w-4 h-4 mr-2" />
              VR Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('arMode', true)}>
              <Headset className="w-4 h-4 mr-2" />
              AR Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('handTracking', true)}>
              <Hand className="w-4 h-4 mr-2" />
              Hand Tracking
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFeature('spatialAudio', true)}>
              <VolumeIcon className="w-4 h-4 mr-2" />
              Spatial Audio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Playback Controls */}
        <div className="flex items-center gap-1 ml-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="topbar-button" 
            onClick={onReset}
            aria-label="Reset scene"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onReset?.();
              }
            }}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="topbar-button" 
            onClick={onPlay}
            aria-label="Play simulation"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPlay?.();
              }
            }}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="topbar-button" 
            onClick={onPause}
            aria-label="Pause simulation"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPause?.();
              }
            }}
          >
            <Pause className="w-4 h-4" />
          </Button>
        </div>

        {/* Performance indicator */}
        <Badge variant="outline" className="performance-badge ml-2">
          <Activity className="w-3 h-3 mr-1" />
          {state.performanceMode.toUpperCase()}
        </Badge>
      </div>

      {/* Right Section - View & System Controls */}
      <div className="topbar-section topbar-right">
        {/* View Controls */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="View controls">
              <Eye className="w-4 h-4" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'showFloatingToolbar' })}>
              <Grid3X3 className="w-4 h-4 mr-2" />
              Toggle Toolbar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'leftPanelVisible' })}>
              <Layers className="w-4 h-4 mr-2" />
              Toggle Left Panel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'rightPanelVisible' })}>
              <EyeOff className="w-4 h-4 mr-2" />
              Toggle Right Panel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Performance Controls */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Performance settings">
              <Zap className="w-4 h-4" />
              Performance
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handlePerformanceModeChange('low')}>
              Low Performance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePerformanceModeChange('medium')}>
              Medium Performance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePerformanceModeChange('high')}>
              High Performance
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Rendering Quality */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Rendering quality">
              <Monitor className="w-4 h-4" />
              Quality
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleRenderingQualityChange('low')}>
              Low Quality
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRenderingQualityChange('medium')}>
              Medium Quality
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRenderingQualityChange('high')}>
              High Quality
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRenderingQualityChange('ultra')}>
              Ultra Quality
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="topbar-button" aria-label="Language selector">
              <Globe className="w-4 h-4" />
              Language
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              if (state.scene) {
                const aiManager = AIManager.getInstance(state.scene);
                aiManager.setLanguage('en-US');
              }
            }}>
              English (US)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (state.scene) {
                const aiManager = AIManager.getInstance(state.scene);
                aiManager.setLanguage('es-ES');
              }
            }}>
              Español
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (state.scene) {
                const aiManager = AIManager.getInstance(state.scene);
                aiManager.setLanguage('fr-FR');
              }
            }}>
              Français
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (state.scene) {
                const aiManager = AIManager.getInstance(state.scene);
                aiManager.setLanguage('de-DE');
              }
            }}>
              Deutsch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* System Controls */}
        <Button
          variant="ghost"
          size="sm"
          className="topbar-button"
          onClick={handleAudioToggle}
          aria-label="Toggle audio"
          title="Audio Controls"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleAudioToggle();
            }
          }}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="topbar-button"
          onClick={handleNetworkToggle}
          aria-label="Toggle network"
          title="Network Controls"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNetworkToggle();
            }
          }}
        >
          {networkEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="topbar-button"
          onClick={handleThemeToggle}
          aria-label="Toggle theme"
          title="Theme Controls"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleThemeToggle();
            }
          }}
        >
          {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Collaboration Controls */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onCollaborate}
          aria-label="Start collaboration"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCollaborate?.();
            }
          }}
        >
          <Users className="w-4 h-4" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onChat}
          aria-label="Open chat"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChat?.();
            }
          }}
        >
          <MessageSquare className="w-4 h-4" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onShare}
          aria-label="Share workspace"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onShare?.();
            }
          }}
        >
          <Share className="w-4 h-4" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onHelp}
          aria-label="Open help"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onHelp?.();
            }
          }}
        >
          <HelpCircle className="w-4 h-4" />
        </Button>

        {/* Window Controls */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onMinimize}
          aria-label="Minimize window"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onMinimize?.();
            }
          }}
        >
          <Minimize className="w-4 h-4" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="topbar-button" 
          onClick={onFullscreen}
          aria-label="Toggle fullscreen"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFullscreen?.();
            }
          }}
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Hidden file input for BIM import */}
      <input
        type="file"
        ref={bimFileInputRef}
        onChange={handleBIMFileChange}
        accept=".ifc,.rvt,.dwg,.obj,.fbx,.gltf,.glb"
        style={{ display: 'none' }}
      />
    </div>
  );
}

// Floating Toolbar Component
interface FloatingToolbarProps {
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  onClose?: () => void;
}

export function FloatingToolbar({
  position = { x: 100, y: 100 },
  onPositionChange,
  onClose
}: FloatingToolbarProps) {
  const { state, dispatch } = useWorkspace();

  // Handle drag for repositioning
  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      const newPosition = { x: newX, y: newY };

      if (onPositionChange) {
        onPositionChange(newPosition);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Quick tool access
  const tools = [
    { id: 'move', icon: '⬆️', label: 'Move', active: state.moveActive },
    { id: 'rotate', icon: '🔄', label: 'Rotate', active: state.rotateActive },
    { id: 'scale', icon: '📏', label: 'Scale', active: state.scaleActive },
    { id: 'camera', icon: '📷', label: 'Camera', active: state.cameraActive },
    { id: 'measure', icon: '📐', label: 'Measure', active: state.perspectiveActive },
  ];

  const handleToolClick = (toolId: string) => {
    const toolMap = {
      move: 'moveActive',
      rotate: 'rotateActive',
      scale: 'scaleActive',
      camera: 'cameraActive',
      measure: 'perspectiveActive',
    };

    const stateKey = toolMap[toolId as keyof typeof toolMap];
    if (stateKey) {
      dispatch({ type: 'SET_TOOL_ACTIVE', payload: { tool: stateKey as any, active: !state[stateKey as keyof typeof state] } });
    }
  };

  return (
    <div
      className="floating-toolbar"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="floating-toolbar-header">
        <span className="floating-toolbar-title">Quick Tools</span>
        <Button variant="ghost" size="sm" className="floating-toolbar-close" onClick={onClose}>
          ✕
        </Button>
      </div>

      <div className="floating-toolbar-content">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={tool.active ? 'default' : 'ghost'}
            size="sm"
            className="floating-tool-button"
            onClick={() => handleToolClick(tool.id)}
            aria-label={tool.label}
            title={tool.label}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToolClick(tool.id);
              }
            }}
          >
            {tool.icon}
          </Button>
        ))}
      </div>
    </div>
  );
}
