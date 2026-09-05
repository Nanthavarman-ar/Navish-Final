import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Loader2, Star, AlertTriangle, EyeOff, Info } from 'lucide-react';

interface Feature {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  enabled?: boolean;
  hotkey?: string;
  description: string;
  performanceImpact?: number;
  dependencies?: string[];
  isEssential?: boolean;
}

interface FeatureButtonProps {
  feature: Feature;
  active: boolean;
  isLoading?: boolean;
  showPerformance?: boolean;
  onToggle: (featureId: string | number, enabled: boolean) => void;
  onHide?: () => void;
  // When true, the hide control stays fully visible instead of only appearing on
  // hover/focus - used for "Customize" mode so touch/mobile users (who have no hover
  // state) can actually find and use it.
  forceShowHideControl?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'grid' | 'list' | 'compact';
}

const FeatureButton: React.FC<FeatureButtonProps> = ({
  feature,
  active,
  isLoading = false,
  showPerformance = false,
  onToggle,
  onHide,
  forceShowHideControl = false,
  size = 'sm',
  variant = 'grid'
}) => {
  const getPerformanceColor = (impact: number) => {
    if (impact <= 2) return 'text-green-500';
    if (impact <= 5) return 'text-yellow-500';
    if (impact <= 8) return 'text-orange-500';
    return 'text-red-500';
  };

  const getPerformanceIcon = (impact: number) => {
    if (impact <= 2) return null;
    if (impact <= 5) return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
    if (impact <= 8) return <AlertTriangle className="w-3 h-3 text-orange-500" />;
    return <AlertTriangle className="w-3 h-3 text-red-500" />;
  };

  const buttonContent = (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative group"
    >
      <Button
        variant={active ? "default" : "outline"}
        size={size}
        onClick={() => onToggle(feature.id, !active)}
        disabled={isLoading}
        className={`h-auto p-3 flex ${
          variant === 'grid' ? 'flex-col items-center space-y-1' :
          variant === 'list' ? 'flex-row items-center space-x-2 justify-start' :
          'flex-col items-center space-y-1'
        } relative ${
          active
            ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
        } ${variant === 'compact' ? 'p-2' : ''}`}
        aria-pressed={active}
        aria-label={`${feature.name}: ${feature.description}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <feature.icon className={`w-4 h-4 ${variant === 'list' ? '' : ''}`} />
        )}

        <span className={`text-center leading-tight ${
          variant === 'grid' ? 'text-xs' :
          variant === 'list' ? 'text-sm flex-1 text-left' :
          'text-xs'
        }`}>
          {feature.name}
        </span>

        {/* Essential indicator */}
        {feature.isEssential && (
          <Star className="w-3 h-3 text-yellow-500 absolute top-1 right-1" />
        )}

        {/* Always-visible hint that hovering this button explains what it does - the
            tooltip itself only shows on hover (Radix's default), but without some visible
            marker there was nothing on the button telling anyone that info exists at all. */}
        <Info className="w-3 h-3 text-gray-400/70 absolute top-1 left-1" />

        {/* Performance impact indicator */}
        {showPerformance && feature.performanceImpact && feature.performanceImpact > 0 && (
          <div className="absolute bottom-1 right-1 flex items-center space-x-1">
            {getPerformanceIcon(feature.performanceImpact)}
            <span className={`text-xs font-medium ${getPerformanceColor(feature.performanceImpact)}`}>
              {feature.performanceImpact}
            </span>
          </div>
        )}

        {/* Hotkey badge */}
        {feature.hotkey && variant !== 'compact' && (
          <Badge
            variant="outline"
            className="text-xs px-1 py-0 absolute bottom-1 left-1 bg-gray-900/80"
          >
            {feature.hotkey}
          </Badge>
        )}
      </Button>

      {onHide && !feature.isEssential && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-900 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center justify-center transition-colors focus:opacity-100 ${
            forceShowHideControl ? 'opacity-100' : 'opacity-55 group-hover:opacity-100'
          }`}
          title={`Hide ${feature.name} from this list`}
          aria-label={`Hide ${feature.name} from this list`}
        >
          <EyeOff className="w-2.5 h-2.5" />
        </button>
      )}
    </motion.div>
  );

  // Previously only the (unused-in-practice) 'compact' variant ever got this tooltip -
  // the grid/list variants actually rendered everywhere in the app (see
  // BabylonWorkspace.tsx's renderFeatureButton, which never passes a variant) showed
  // nothing on hover at all, despite every Feature entry (config/featureCategories.tsx)
  // already carrying a real description and hotkey with nowhere to display them. Now
  // every variant gets it, matching the always-visible Info icon on the button itself.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div>
            <div className="font-medium">{feature.name}</div>
            <div className="text-sm text-gray-300 mt-1">
              {feature.description}
            </div>
            <div className="text-xs text-gray-300 mt-2">
              {active ? 'Click to turn this off.' : 'Click to turn this on.'}
              {feature.hotkey && <> Or press <kbd className="px-1.5 py-0.5 mx-0.5 bg-gray-800 text-gray-100 rounded font-mono">{feature.hotkey}</kbd> to toggle it from the keyboard.</>}
            </div>
            {feature.performanceImpact ? (
              <div className="text-xs text-gray-300 mt-1">
                Performance Impact: {feature.performanceImpact}/10
              </div>
            ) : null}
            {feature.dependencies && feature.dependencies.length > 0 && (
              <div className="text-xs text-gray-300 mt-1">
                Needs: {feature.dependencies.join(', ')} to already be on
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FeatureButton;
