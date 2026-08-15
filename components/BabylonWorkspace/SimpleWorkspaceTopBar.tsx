import React, { useState } from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import {
  Upload,
  Download,
  Camera,
  Settings,
  Grid3X3,
  Layers,
  Activity,
  HelpCircle,
  Orbit,
  Move,
  Navigation,
  Share2,
  Maximize2,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { ViewModeSelector, type ViewMode } from '../ViewModeSelector';
import { FloorPlanOverlay } from '../FloorPlanOverlay';
import { ShareEmbedPanel } from '../ShareEmbedPanel';

interface SimpleWorkspaceTopBarProps {
  fps: number;
  realTimeEnabled: boolean;
  activeFeatures: number;
  topBarVisible?: boolean;
  onToggleTopBar?: () => void;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  cameraMode?: 'orbit' | 'fly' | 'walk';
  viewMode?: ViewMode;
  gridVisible: boolean;
  wireframeEnabled: boolean;
  statsVisible: boolean;
  floorPlanVisible?: boolean;
  workspaceId?: string;
  onToggleRealTime: () => void;
  onCameraModeChange: (mode: 'orbit' | 'fly' | 'walk') => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onToggleGrid: () => void;
  onToggleWireframe: () => void;
  onToggleStats: () => void;
  onToggleFloorPlan?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onScreenshot?: (format?: 'png' | 'jpeg') => void;
  onAutoZoom?: () => void;
  onSave?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onShare?: () => void;
  onChat?: () => void;
  onCollaborate?: () => void;
}

export function SimpleWorkspaceTopBar({
  fps,
  realTimeEnabled,
  activeFeatures,
  topBarVisible = true,
  onToggleTopBar,
  leftPanelVisible = true,
  rightPanelVisible = false,
  onToggleLeftPanel,
  onToggleRightPanel,
  cameraMode = 'orbit',
  viewMode = 'orbit',
  gridVisible,
  wireframeEnabled,
  statsVisible,
  floorPlanVisible = false,
  workspaceId = 'workspace',
  onToggleRealTime,
  onCameraModeChange,
  onViewModeChange,
  onToggleGrid,
  onToggleWireframe,
  onToggleStats,
  onToggleFloorPlan,
  onImport,
  onExport,
  onScreenshot,
  onAutoZoom,
  onSave,
  onSettings,
  onHelp,
  onShare
}: SimpleWorkspaceTopBarProps) {
  const noop = () => {};
  const [showSharePanel, setShowSharePanel] = useState(false);

  const handleViewMode = (mode: ViewMode) => {
    onViewModeChange?.(mode);
    if (mode === 'walk') onCameraModeChange('walk');
    else if (mode === 'orbit') onCameraModeChange('orbit');
    else if (mode === 'dollhouse') onCameraModeChange('fly');
  };

  return (
    <div className="flex flex-col shrink-0">
      <div className="flex items-center justify-between gap-2 py-2 px-4 bg-gray-900/95 border-b border-cyan-500/20 text-white min-h-12 flex-wrap shadow-[0_1px_0_0_rgba(34,211,238,0.08)]">
        {/* Left - Panel toggles + File ops */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleTopBar && (
            <button
              type="button"
              className={`h-8 w-8 p-0 rounded-md inline-flex items-center justify-center transition-colors ${topBarVisible ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggleTopBar(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleTopBar(); }}
              title={topBarVisible ? 'Hide top bar' : 'Show top bar'}
              aria-label={topBarVisible ? 'Hide top bar' : 'Show top bar'}
            >
              {topBarVisible ? <ChevronDown className="w-4 h-4 pointer-events-none" /> : <ChevronUp className="w-4 h-4 pointer-events-none" />}
            </button>
          )}
          {onToggleLeftPanel && (
            <button
              type="button"
              className={`h-8 w-8 p-0 rounded-md inline-flex items-center justify-center transition-colors ${leftPanelVisible ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggleLeftPanel(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleLeftPanel(); }}
              title={leftPanelVisible ? 'Hide left sidebar' : 'Show left sidebar'}
            >
              {leftPanelVisible ? <PanelLeftClose className="w-4 h-4 pointer-events-none" /> : <PanelLeftOpen className="w-4 h-4 pointer-events-none" />}
            </button>
          )}
          {onToggleRightPanel && (
            <Button type="button" variant={rightPanelVisible ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={onToggleRightPanel} title={rightPanelVisible ? 'Hide right sidebar' : 'Show right sidebar'}>
              {rightPanelVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>
          )}
          <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onSave || noop} title="Save">
            Save
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onImport || noop} title="Import">
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onExport || noop} title="Export">
            <Download className="w-4 h-4" />
          </Button>
          {onScreenshot && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Screenshot">
                  <Camera className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onScreenshot('png')}>PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onScreenshot('jpeg')}>JPEG</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onSettings || noop} title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Center - Camera / view modes - compact */}
        <div className="flex items-center gap-1 shrink-0">
          {onViewModeChange ? (
            <ViewModeSelector mode={viewMode} onModeChange={handleViewMode} compact />
          ) : (
            <>
              <Button variant={cameraMode === 'orbit' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => onCameraModeChange('orbit')} title="Orbit">
                <Orbit className="w-4 h-4" />
              </Button>
              <Button variant={cameraMode === 'fly' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => onCameraModeChange('fly')} title="Fly">
                <Move className="w-4 h-4" />
              </Button>
              <Button variant={cameraMode === 'walk' ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => onCameraModeChange('walk')} title="Walk">
                <Navigation className="w-4 h-4" />
              </Button>
            </>
          )}
          <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
          {onAutoZoom && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onAutoZoom} title="Fit to view (Auto Zoom)">
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant={gridVisible ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onToggleGrid} title="Toggle grid">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant={wireframeEnabled ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onToggleWireframe} title="Wireframe">
            <Layers className="w-4 h-4" />
          </Button>
          <Button variant={statsVisible ? 'default' : 'ghost'} size="sm" className="h-8 w-8 p-0 shrink-0" onClick={onToggleStats} title="Stats">
            <Activity className="w-4 h-4" />
          </Button>
          <Button variant={realTimeEnabled ? 'default' : 'ghost'} size="sm" className="h-8 px-2 shrink-0" onClick={onToggleRealTime} title="Real-time">
            RT
          </Button>
          {onToggleFloorPlan && (
            <FloorPlanOverlay visible={floorPlanVisible} onToggle={onToggleFloorPlan} />
          )}
        </div>

        {/* Right - FPS, Share & help */}
        <div className="flex items-center gap-2 shrink-0 relative">
          <Badge variant="outline" className="text-xs">{activeFeatures}</Badge>
          <Badge variant="outline" className="text-xs">{fps} FPS</Badge>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowSharePanel((v) => !v)} title="Share & Embed">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onHelp || noop} title="Help">
            <HelpCircle className="w-4 h-4" />
          </Button>
          {showSharePanel && (
            <div className="absolute top-full right-0 mt-1 z-[100]">
              <ShareEmbedPanel workspaceId={workspaceId} onClose={() => setShowSharePanel(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
