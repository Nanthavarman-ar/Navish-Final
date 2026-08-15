import * as React from "react";
import { Button } from "../ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Feature } from "../../config/featureCategories";

interface FeatureButtonProps {
  feature: Feature;
  active: boolean;
  onToggle: (featureId: string, enabled: boolean) => void;
  size?: "default" | "sm" | "lg" | "icon";
}

export const FeatureButton: React.FC<FeatureButtonProps> = ({ feature, active, onToggle, size = "default" }) => (
  <TooltipProvider key={feature.id}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size={size}
          variant={active ? 'default' : 'outline'}
          onClick={() => onToggle(feature.id, !active)}
          className={`flex items-center gap-2 transition-all duration-200 hover:scale-105 ${
            feature.category === 'essential'
              ? 'bg-blue-700 hover:bg-blue-800 text-white border-blue-700 shadow-lg'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <feature.icon className="w-4 h-4" />
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
