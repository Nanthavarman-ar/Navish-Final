import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../../components/ui/accordion';
import { Badge } from '../../../../components/ui/badge';
import FeatureButton from './FeatureButton';
import { Feature } from './FeatureButton';

interface FeatureGroupProps {
  category: string;
  features: Feature[];
  activeFeatures: Set<string>;
  onToggle: (id: string | number, enabled: boolean) => void;
  defaultExpanded?: boolean;
}

const FeatureGroup: React.FC<FeatureGroupProps> = ({
  category,
  features,
  activeFeatures,
  onToggle,
  defaultExpanded = false
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const activeCount = features.filter(f => activeFeatures.has(f.id)).length;
  const totalCount = features.length;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={category}>
        <AccordionTrigger
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{category}</span>
            <Badge variant="outline">
              {activeCount}/{totalCount}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {features.map(feature => (
              <FeatureButton
                key={feature.id}
                feature={feature}
                active={activeFeatures.has(feature.id)}
                onToggle={(id: string | number, enabled: boolean) => onToggle(id, enabled)}
                size="sm"
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default FeatureGroup;
