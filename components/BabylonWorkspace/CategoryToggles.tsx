import * as React from "react";
import { Button } from "../ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface CategoryTogglesProps {
  featuresByCategory: Record<string, any[]>;
  categoryPanelVisible: Record<string, boolean>;
  handleCategoryToggle: (category: string) => void;
}

export const CategoryToggles: React.FC<CategoryTogglesProps> = ({
  featuresByCategory,
  categoryPanelVisible,
  handleCategoryToggle,
}) => (
  <div className="flex gap-3 mb-4 flex-wrap">
    {Object.keys(featuresByCategory).map(category => (
      <TooltipProvider key={category}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="default"
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
