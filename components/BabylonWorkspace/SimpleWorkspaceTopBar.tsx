import React, { useState } from 'react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Upload,
  Download,
  Camera,
  HelpCircle,
  Orbit,
  Move,
  Navigation,
  Share2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronUp,
  ChevronDown,
  RotateCw,
  Scale,
  Video,
  Eye
} from 'lucide-react';
import { ViewModeSelector, type ViewMode } from '../ViewModeSelector';
import { ShareEmbedPanel } from '../ShareEmbedPanel';

interface SimpleWorkspaceTopBarProps {
  fps: number;
  activeFeatures: number;
  topBarVisible?: boolean;
  onToggleTopBar?: () => void;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  cameraMode?: 'orbit' | 'fly' | 'walk';
  viewMode?: ViewMode;
  workspaceId?: string;
  onCameraModeChange: (mode: 'orbit' | 'fly' | 'walk') => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onImport?: () => void;
  onExport?: () => void;
  onScreenshot?: (format?: 'png' | 'jpeg') => void;
  onAutoZoom?: () => void;
  onHelp?: () => void;
  onShare?: () => void;
  onChat?: () => void;
  onCollaborate?: () => void;
  // Move/Rotate/Scale gizmo + camera controls/perspective toggles - previously a separate
  // FloatingToolbar floating over the top-left corner, which is also where the "My Models"
  // left panel lives, so the two visibly overlapped. Living in the top bar avoids that.
  transformMode?: 'none' | 'position' | 'rotation' | 'scale';
  setTransformMode?: (updater: (m: 'none' | 'position' | 'rotation' | 'scale') => 'none' | 'position' | 'rotation' | 'scale') => void;
  cameraActive?: boolean;
  perspectiveActive?: boolean;
  onCameraActiveToggle?: () => void;
  onPerspectiveToggle?: () => void;
  // Host-page buttons (e.g. AppLayout's "My Models"/"AI Voice" shortcuts) - these used to be
  // separate `fixed`-position overlays landing on top of the left panel/FPS badge. Rendered
  // here as normal flex children instead, in the bar's own left/right clusters.
  topBarExtraLeft?: React.ReactNode;
  topBarExtraRight?: React.ReactNode;
}

// This bar's ~15 icon-only buttons (camera modes, gizmo tools, import/export, share, help,
// ...) previously relied on the browser's own plain `title` tooltip - functional, but
// inconsistent with the rich hover tooltip + always-visible info affordance every
// FeatureButton (the Features panel's own toggle buttons) now has. Wraps whatever's passed
// in without changing its own markup/styling at all, just adds the same richer tooltip on
// top - purely additive, so it can't accidentally change how any of these buttons look.
function Tip({ label, description, side = 'bottom', children }: { label: string; description?: string; side?: 'top' | 'bottom' | 'left' | 'right'; children: React.ReactElement }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="font-medium">{label}</div>
          {description && <div className="text-xs text-gray-300 mt-1">{description}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SimpleWorkspaceTopBar({
  fps,
  activeFeatures,
  topBarVisible = true,
  onToggleTopBar,
  leftPanelVisible = true,
  rightPanelVisible = false,
  onToggleLeftPanel,
  onToggleRightPanel,
  cameraMode = 'orbit',
  viewMode = 'orbit',
  workspaceId = 'workspace',
  onCameraModeChange,
  onViewModeChange,
  onImport,
  onExport,
  onScreenshot,
  onAutoZoom,
  onHelp,
  transformMode = 'none',
  setTransformMode,
  cameraActive = false,
  perspectiveActive = false,
  onCameraActiveToggle,
  onPerspectiveToggle,
  topBarExtraLeft,
  topBarExtraRight
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
      <div className="flex items-center justify-between gap-2 py-2 px-4 bg-gray-900/95 text-white min-h-12 flex-wrap">
        {/* Left - Panel toggles + File ops */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleTopBar && (
            <Tip label={topBarVisible ? 'Hide top bar' : 'Show top bar'} description="Frees up vertical screen space when you're not using the bar's buttons.">
              <button
                type="button"
                className={`h-10 w-10 p-0 rounded-md inline-flex items-center justify-center transition-colors ${topBarVisible ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggleTopBar(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleTopBar(); }}
                aria-label={topBarVisible ? 'Hide top bar' : 'Show top bar'}
              >
                {topBarVisible ? <ChevronDown className="w-4 h-4 pointer-events-none" /> : <ChevronUp className="w-4 h-4 pointer-events-none" />}
              </button>
            </Tip>
          )}
          {onToggleLeftPanel && (
            <Tip label={leftPanelVisible ? 'Hide left sidebar' : 'Show left sidebar'} description="The left sidebar lists your models and the Features panel.">
              <button
                type="button"
                className={`h-10 w-10 p-0 rounded-md inline-flex items-center justify-center transition-colors ${leftPanelVisible ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onToggleLeftPanel(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleLeftPanel(); }}
                aria-label={leftPanelVisible ? 'Hide left sidebar' : 'Show left sidebar'}
              >
                {leftPanelVisible ? <PanelLeftClose className="w-4 h-4 pointer-events-none" /> : <PanelLeftOpen className="w-4 h-4 pointer-events-none" />}
              </button>
            </Tip>
          )}
          <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
          {onImport && (
            <Tip label="Import" description="Load a 3D model file (GLB, OBJ, and more) into the workspace.">
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0" onClick={onImport}>
                <Upload className="w-4 h-4" />
              </Button>
            </Tip>
          )}
          <Tip label="Export" description="Save the current scene out to a file.">
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0" onClick={onExport || noop}>
              <Download className="w-4 h-4" />
            </Button>
          </Tip>
          {onScreenshot && (
            <DropdownMenu>
              {/* Tip wraps OUTSIDE DropdownMenuTrigger here (both compose via nested
                  asChild down onto the same Button) rather than the other way around -
                  DropdownMenuTrigger's asChild needs to attach its own open/aria props
                  directly onto the Button, which Tip (a plain wrapper component, not a
                  Radix Slot target) can't forward if it were the innermost child instead. */}
              <Tip label="Screenshot" description="Capture the current view as a PNG or JPEG image.">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                    <Camera className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onScreenshot('png')}>PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onScreenshot('jpeg')}>JPEG</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {topBarExtraLeft && (
            <>
              <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
              {topBarExtraLeft}
            </>
          )}
        </div>

        {/* Center - Camera / view modes - compact */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onViewModeChange ? (
            <ViewModeSelector mode={viewMode} onModeChange={handleViewMode} compact />
          ) : (
            <>
              <Tip label="Orbit" description="Rotate around the model with the camera pivoting around a fixed point.">
                <Button variant={cameraMode === 'orbit' ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0" onClick={() => onCameraModeChange('orbit')}>
                  <Orbit className="w-4 h-4" />
                </Button>
              </Tip>
              <Tip label="Fly" description="Free-fly the camera in any direction, not locked to a pivot point.">
                <Button variant={cameraMode === 'fly' ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0" onClick={() => onCameraModeChange('fly')}>
                  <Move className="w-4 h-4" />
                </Button>
              </Tip>
              <Tip label="Walk" description="Move through the model at eye level, like walking through the real space.">
                <Button variant={cameraMode === 'walk' ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0" onClick={() => onCameraModeChange('walk')}>
                  <Navigation className="w-4 h-4" />
                </Button>
              </Tip>
            </>
          )}
          {onAutoZoom && (
            <>
              <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
              <Tip label="Fit to view" description="Auto-zoom the camera to frame the whole model.">
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 shrink-0" onClick={onAutoZoom}>
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </Tip>
            </>
          )}
          {setTransformMode && (
            <>
              <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
              <Tip label="Move Tool" description="Drag the selected object to reposition it.">
                <Button variant={transformMode === 'position' ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0 shrink-0" onClick={() => setTransformMode((m) => m === 'position' ? 'none' : 'position')}>
                  <Move className="w-4 h-4" />
                </Button>
              </Tip>
              <Tip label="Rotate Tool" description="Drag to rotate the selected object.">
                <Button variant={transformMode === 'rotation' ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0 shrink-0" onClick={() => setTransformMode((m) => m === 'rotation' ? 'none' : 'rotation')}>
                  <RotateCw className="w-4 h-4" />
                </Button>
              </Tip>
              <Tip label="Scale Tool" description="Drag to resize the selected object.">
                <Button variant={transformMode === 'scale' ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0 shrink-0" onClick={() => setTransformMode((m) => m === 'scale' ? 'none' : 'scale')}>
                  <Scale className="w-4 h-4" />
                </Button>
              </Tip>
              {onCameraActiveToggle && (
                <Tip label="Camera Controls" description="Toggle whether the camera can be moved right now.">
                  <Button variant={cameraActive ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0 shrink-0" onClick={onCameraActiveToggle}>
                    <Video className="w-4 h-4" />
                  </Button>
                </Tip>
              )}
              {onPerspectiveToggle && (
                <Tip label="Perspective View" description="Switch between perspective and orthographic projection.">
                  <Button variant={perspectiveActive ? 'default' : 'ghost'} size="sm" className="h-10 w-10 p-0 shrink-0" onClick={onPerspectiveToggle}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </Tip>
              )}
            </>
          )}
        </div>

        {/* Right - FPS, Share & help */}
        <div className="flex items-center gap-2 shrink-0 relative">
          {topBarExtraRight && (
            <>
              {topBarExtraRight}
              <span className="w-px h-5 bg-gray-600 mx-1 shrink-0" />
            </>
          )}
          {/* Wrapped in a plain span, not the Badge directly - Badge isn't a
              forwardRef component, and TooltipTrigger's asChild needs a real DOM ref
              target to anchor to. */}
          <Tip label="Active features" description="How many features are currently turned on - see the Features panel to change them." side="left">
            <span><Badge variant="outline" className="text-xs">{activeFeatures}</Badge></span>
          </Tip>
          <Tip label="Frame rate" description="Frames per second - drops if the scene is too heavy for this device." side="left">
            <span><Badge variant="outline" className="text-xs">{fps} FPS</Badge></span>
          </Tip>
          <Tip label="Share & Embed" description="Get a link or embed code to share this workspace." side="left">
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0" onClick={() => setShowSharePanel((v) => !v)}>
              <Share2 className="w-4 h-4" />
            </Button>
          </Tip>
          <Tip label="Keyboard shortcuts" description="See every hotkey for the tools and features in this workspace." side="left">
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0" onClick={onHelp || noop}>
              <HelpCircle className="w-4 h-4" />
            </Button>
          </Tip>
          {showSharePanel && (
            <div className="absolute top-full right-0 mt-1 z-[100]">
              <ShareEmbedPanel workspaceId={workspaceId} onClose={() => setShowSharePanel(false)} />
            </div>
          )}
        </div>
      </div>
      <div className="shimmer-line" aria-hidden />
    </div>
  );
}
