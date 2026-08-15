import React, { useState } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  Move,
  RotateCw,
  Scale,
  Camera,
  Eye,
  Minimize,
  Maximize
} from 'lucide-react';

interface FloatingToolbarProps {
  onMoveToggle: () => void;
  onRotateToggle: () => void;
  onScaleToggle: () => void;
  onCameraToggle: () => void;
  onPerspectiveToggle: () => void;
  isMoveActive: boolean;
  isRotateActive: boolean;
  isScaleActive: boolean;
  isCameraActive: boolean;
  isPerspectiveActive: boolean;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onMoveToggle,
  onRotateToggle,
  onScaleToggle,
  onCameraToggle,
  onPerspectiveToggle,
  isMoveActive,
  isRotateActive,
  isScaleActive,
  isCameraActive,
  isPerspectiveActive
}) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <div className="fixed top-20 left-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          title="Show Toolbar"
          aria-label="Show Toolbar"
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed top-20 left-4 z-50 bg-background/95 backdrop-blur border border-gray-600 rounded-lg shadow-lg p-2 flex flex-col gap-2"
      aria-label="Floating Toolbar"
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-300">Tools</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => setIsVisible(false)}
          title="Hide Toolbar"
          aria-label="Hide Toolbar"
        >
          <Minimize className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isMoveActive ? 'default' : 'outline'}
                onClick={onMoveToggle}
                aria-pressed={isMoveActive}
                title="Move Tool"
              >
                <Move className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move Tool</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isRotateActive ? 'default' : 'outline'}
                onClick={onRotateToggle}
                aria-pressed={isRotateActive}
                title="Rotate Tool"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate Tool</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isScaleActive ? 'default' : 'outline'}
                onClick={onScaleToggle}
                aria-pressed={isScaleActive}
                title="Scale Tool"
              >
                <Scale className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Scale Tool</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isCameraActive ? 'default' : 'outline'}
                onClick={onCameraToggle}
                aria-pressed={isCameraActive}
                title="Camera Controls"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Camera Controls</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isPerspectiveActive ? 'default' : 'outline'}
                onClick={onPerspectiveToggle}
                aria-pressed={isPerspectiveActive}
                title="Perspective View"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Perspective View</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default FloatingToolbar;
