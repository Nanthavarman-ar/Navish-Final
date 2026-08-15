import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import { Feature } from "../../config/featureCategories";

interface PanelsProps {
  featuresByCategory: Record<string, Feature[]>;
  categoryPanelVisible: Record<string, boolean>;
  getFilteredFeatures: (features: Feature[]) => Feature[];
  renderFeatureButton: (feature: Feature, size?: "default" | "sm" | "lg" | "icon") => React.ReactNode;
  layoutMode: string;
}

export const Panels: React.FC<PanelsProps> = ({
  featuresByCategory,
  categoryPanelVisible,
  getFilteredFeatures,
  renderFeatureButton,
  layoutMode,
}) => (
  <div>
    {Object.entries(featuresByCategory).map(([category, features], index) => (
      categoryPanelVisible[category] && Array.isArray(features) && features.length > 0 ? (
        <div key={category}>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="capitalize">{category} Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                {getFilteredFeatures(features).map(feature =>
                  renderFeatureButton(feature, (layoutMode === 'standard' ? 'sm' : 'default') as "default" | "sm" | "lg" | "icon")
                )}
              </div>
            </CardContent>
          </Card>
          {index < Object.entries(featuresByCategory).filter(([cat]) => categoryPanelVisible[cat]).length - 1 && (
            <Separator className="my-4 bg-gray-600" />
          )}
        </div>
      ) : null
    ))}
  </div>
);
