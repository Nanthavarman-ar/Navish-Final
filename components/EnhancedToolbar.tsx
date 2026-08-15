import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Separator } from './ui/separator';
import {
  Move, RotateCw, Scale, Camera, Eye,
  Grid3X3, Zap, Settings, Activity,
  ChevronLeft, ChevronRight, Maximize2, Minimize2
} from 'lucide-react';

interface EnhancedToolbarProps {
  // Transform controls
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

  // View controls
  onToggleGrid: () => void;
  onToggleWireframe: () => void;
  onToggleStats: () => void;
  onResetView: () => void;
  onShowAll: () => void;
  gridVisible: boolean;
  wireframeEnabled: boolean;
  statsVisible: boolean;

  // Performance
  performanceScore: number;
  activeFeaturesCount: number;

  // Layout
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const EnhancedToolbar: React.FC<EnhancedToolbarProps> = ({
  onMoveToggle,
  onRotateToggle,
  onScaleToggle,
  onCameraToggle,
  onPerspectiveToggle,
  isMoveActive,
  isRotateActive,
  isScaleActive,
  isCameraActive,
  isPerspectiveActive,
  onToggleGrid,
  onToggleWireframe,
  onToggleStats,
  onResetView,
  onShowAll,
  gridVisible,
  wireframeEnabled,
  statsVisible,
  performanceScore,
  activeFeaturesCount,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [showTooltips, setShowTooltips] = useState(true);

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const ToolbarButton: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active?: boolean;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'sm' | 'default';
  }> = ({ icon: Icon, label, active, onClick, variant = 'ghost', size = 'sm' }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size={size}
              variant={active ? 'default' : variant}
              onClick={onClick}
              className={`h-8 w-8 p-0 ${active ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            >
              <Icon className="w-4 h-4" />
            </Button>
          </motion.div>
        </TooltipTrigger>
        {showTooltips && (
          <TooltipContent side="bottom">
            <p>{label}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );

  if (isCollapsed) {
    return (
      <motion.div
        initial={{ width: 280 }}
        animate={{ width: 48 }}
        className="h-12 bg-gray-900 border border-gray-700 rounded-lg shadow-lg flex items-center"
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleCollapse}
          className="h-full w-full rounded-l-lg rounded-r-none"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ width: 48 }}
      animate={{ width: 280 }}
      className="h-12 bg-gray-900 border border-gray-700 rounded-lg shadow-lg flex items-center px-2 space-x-1"
    >
      {/* Transform Controls */}
      <div className="flex items-center space-x-1 pr-2 border-r border-gray-600">
        <ToolbarButton
          icon={Move}
          label="Move Tool"
          active={isMoveActive}
          onClick={onMoveToggle}
        />
        <ToolbarButton
          icon={RotateCw}
          label="Rotate Tool"
          active={isRotateActive}
          onClick={onRotateToggle}
        />
        <ToolbarButton
          icon={Scale}
          label="Scale Tool"
          active={isScaleActive}
          onClick={onScaleToggle}
        />
        <ToolbarButton
          icon={Camera}
          label="Camera Tool"
          active={isCameraActive}
          onClick={onCameraToggle}
        />
      </div>

      {/* View Controls */}
      <div className="flex items-center space-x-1 pr-2 border-r border-gray-600">
        <ToolbarButton
          icon={Grid3X3}
          label="Toggle Grid"
          active={gridVisible}
          onClick={onToggleGrid}
        />
        <ToolbarButton
          icon={Eye}
          label="Toggle Wireframe"
          active={wireframeEnabled}
          onClick={onToggleWireframe}
        />
        <ToolbarButton
          icon={Activity}
          label="Toggle Stats"
          active={statsVisible}
          onClick={onToggleStats}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex items-center space-x-1 pr-2 border-r border-gray-600">
        <ToolbarButton
          icon={Maximize2}
          label="Reset View"
          onClick={onResetView}
        />
        <ToolbarButton
          icon={Eye}
          label="Show All"
          onClick={onShowAll}
        />
      </div>

      {/* Performance Indicator */}
      <div className="flex items-center space-x-2 pr-2 border-r border-gray-600">
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${getPerformanceColor(performanceScore)}`} />
          <span className="text-xs text-gray-300">{performanceScore}%</span>
        </div>
        <Badge variant="outline" className="text-xs px-1 py-0">
          {activeFeaturesCount}
        </Badge>
      </div>

      {/* Settings */}
      <div className="flex items-center space-x-1">
        <ToolbarButton
          icon={Settings}
          label="Settings"
          onClick={() => setShowTooltips(!showTooltips)}
          active={showTooltips}
        />
        <ToolbarButton
          icon={ChevronLeft}
          label="Collapse Toolbar"
          onClick={onToggleCollapse || (() => {})}
        />
      </div>
    </motion.div>
  );
};

export default EnhancedToolbar;
