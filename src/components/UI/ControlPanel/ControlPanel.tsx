import React, { useState, lazy, Suspense } from 'react';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Search } from 'lucide-react';
import FeatureGroup from './FeatureGroup';
import { featureCategories } from '../../../../config/featureCategories'; // Import from config
import { Feature } from './FeatureButton';

interface ControlPanelProps {
  featuresByCategory: Record<string, Feature[]>;
  activeFeatures: Set<string>;
  onToggle: (id: string | number, enabled: boolean) => void;
  layoutMode?: 'standard' | 'compact' | 'immersive';
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  featuresByCategory,
  activeFeatures,
  onToggle,
  layoutMode = 'standard'
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFeaturesByCategory = React.useMemo(() => {
    const filtered: Record<string, Feature[]> = {};
    Object.entries(featuresByCategory).forEach(([category, features]) => {
      const filteredFeatures = features.filter(feature =>
        feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filteredFeatures.length > 0) {
        filtered[category] = filteredFeatures;
      }
    });
    return filtered;
  }, [featuresByCategory, searchTerm]);

  const totalActive = Array.from(activeFeatures).length;

  return (
    <div className={`flex flex-col h-full ${layoutMode === 'compact' ? 'p-2' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Control Panel</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{totalActive} Active</Badge>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search features..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10 w-48"
            />
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {Object.entries(filteredFeaturesByCategory).map(([category, features]) => (
          <FeatureGroup
            key={category}
            category={category}
            features={features}
            activeFeatures={activeFeatures}
            onToggle={(id: string | number, enabled: boolean) => onToggle(id, enabled)}
            defaultExpanded={searchTerm === ''} // Expand all if no search
          />
        ))}
        {Object.keys(filteredFeaturesByCategory).length === 0 && searchTerm && (
          <p className="text-muted-foreground text-center py-8">No features found for "{searchTerm}"</p>
        )}
      </div>

      {/* Footer */}
      {layoutMode !== 'immersive' && (
        <div className="mt-auto pt-4 border-t border-gray-700">
          <p className="text-xs text-muted-foreground">
            Use hotkeys for quick access. Hover for descriptions.
          </p>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
