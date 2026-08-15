import React from 'react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../components/ui/tooltip';
import { LucideIcon } from 'lucide-react';

export interface Feature {
  id: string;
  name: string;
  icon: LucideIcon;
  category: string;
  enabled: boolean;
  hotkey?: string;
  description: string;
  performanceImpact?: number;
  dependencies?: string[];
  isEssential?: boolean;
}

interface FeatureButtonProps {
  feature: Feature;
  active: boolean;
  onToggle: (id: string | number, enabled: boolean) => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  error?: boolean;
}

const FeatureButton: React.FC<FeatureButtonProps> = ({
  feature,
  active,
  onToggle,
  size = 'default',
  loading = false,
  error = false
}) => {
  const IconComponent = feature.icon;

  const handleClick = () => {
    onToggle(feature.id, !active);
  };

  const getStateBadge = () => {
    if (error) return <Badge variant="destructive">Error</Badge>;
    if (loading) return <Badge variant="secondary">Loading</Badge>;
    if (active) return <Badge variant="default">Active</Badge>;
    return null;
  };

  const tooltipText = `${feature.description}${feature.hotkey ? ` (${feature.hotkey})` : ''}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'default' : 'outline'}
            size={size}
            onClick={handleClick}
            disabled={loading}
            aria-pressed={active}
            aria-label={`${feature.name}: ${feature.description}`}
            className="flex items-center gap-2"
          >
            <IconComponent className="w-4 h-4" />
            {size !== 'icon' && <span>{feature.name}</span>}
            {getStateBadge()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default FeatureButton;
