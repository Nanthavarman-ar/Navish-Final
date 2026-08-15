import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { Maximize } from 'lucide-react';

interface Feature {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  enabled: boolean;
  hotkey: string;
  description: string;
}

interface FeaturePanelProps {
  featureCategories: Record<string, Feature[]>;
  categoryPanelVisible: Record<string, boolean>;
  searchTerm: string;
  activeFeatures: Set<string>;
  currentLayoutMode: 'standard' | 'compact' | 'immersive';
  onCategoryToggle: (category: string) => void;
  onSearchChange: (value: string) => void;
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
  onClose: () => void;
}

const FeaturePanel: React.FC<FeaturePanelProps> = ({
  featureCategories,
  categoryPanelVisible,
  searchTerm,
  activeFeatures,
  currentLayoutMode,
  onCategoryToggle,
  onSearchChange,
  onFeatureToggle,
  onClose
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  const getFilteredFeatures = (features: Feature[]) => {
    const term = localSearchTerm || searchTerm;
    if (!term) return features;
    return features.filter(f => f.name.toLowerCase().includes(term.toLowerCase()));
  };

  const renderFeatureButton = (feature: Feature, size: 'sm' | 'default') => (
    <TooltipProvider key={feature.id}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={activeFeatures.has(feature.id) ? 'default' : 'outline'}
            onClick={() => onFeatureToggle(feature.id, !activeFeatures.has(feature.id))}
            className="flex items-center gap-2 transition-all duration-200 hover:scale-105"
          >
            {feature.icon}
            <span className="font-semibold">{feature.name}</span>
            {activeFeatures.has(feature.id) && (
              <Badge variant="secondary" className="ml-1 text-xs">
                ON
              </Badge>
            )}
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

  const renderCategoryToggles = () => (
    <div className="flex gap-3 mb-4 flex-wrap">
      {Object.keys(featureCategories).map(category => (
        <TooltipProvider key={category}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="default"
                variant={categoryPanelVisible[category] ? "default" : "outline"}
                onClick={() => onCategoryToggle(category)}
                className="capitalize font-semibold"
              >
                {categoryPanelVisible[category] ? "Hide" : "Show"} {category}
                <Badge variant="outline" className="ml-2">
                  {featureCategories[category]?.length || 0}
                </Badge>
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

  const renderCategoryPanels = () => (
    <div>
      {Object.entries(featureCategories).map(([category, features], index) => (
        categoryPanelVisible[category] && (
          <div key={category}>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="capitalize flex items-center justify-between">
                  {category} Features
                  <Badge variant="secondary">
                    {features.filter(f => activeFeatures.has(f.id)).length}/{features.length} Active
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                  {getFilteredFeatures(features).map(feature =>
                    renderFeatureButton(feature, (currentLayoutMode === 'standard' ? 'sm' : 'default') as "default" | "sm")
                  )}
                </div>
              </CardContent>
            </Card>
            {index < Object.entries(featureCategories).filter(([cat]) => categoryPanelVisible[cat]).length - 1 && (
              <Separator className="my-4 bg-gray-600" />
            )}
          </div>
        )
      ))}
    </div>
  );

  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
    onSearchChange(value);
  };

  const activeFeatureCount = Object.values(featureCategories).flat().filter(f => activeFeatures.has(f.id)).length;
  const totalFeatureCount = Object.values(featureCategories).flat().length;

  return (
    <div className="flex flex-col w-72 border-r border-gray-700 bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Features</h2>
          <Badge variant="outline" className="text-xs">
            {activeFeatureCount}/{totalFeatureCount}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {renderCategoryToggles()}
          <div className="mb-4">
            <Input
              placeholder="Search features..."
              value={localSearchTerm || searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full"
            />
          </div>
          {renderCategoryPanels()}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FeaturePanel;
