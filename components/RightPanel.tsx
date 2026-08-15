import React from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Maximize } from 'lucide-react';
import { Mesh } from '@babylonjs/core';
import { FeatureManager } from './FeatureManager';

interface RightPanelProps {
  visible: boolean;
  selectedMesh: Mesh | null;
  scene: any;
  engine: any;
  activeFeatures: Set<string>;
  performanceMode: 'performance' | 'balanced' | 'quality';
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
  onClose: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  visible,
  selectedMesh,
  scene,
  engine,
  activeFeatures,
  performanceMode,
  onFeatureToggle,
  onClose
}) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-[85vw] max-w-[320px] sm:relative sm:z-auto sm:w-80 sm:max-w-none border-l border-gray-700 bg-gray-900 text-white h-full overflow-y-auto shadow-2xl sm:shadow-none">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inspector</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>
      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>Object Properties</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedMesh ? (
                <div className="space-y-2">
                  <div><strong>Name:</strong> {selectedMesh.name}</div>
                  <div><strong>Position:</strong> {selectedMesh.position.toString()}</div>
                  <div><strong>Rotation:</strong> {selectedMesh.rotation.toString()}</div>
                  <div><strong>Scale:</strong> {selectedMesh.scaling.toString()}</div>
                </div>
              ) : (
                <p className="text-muted-foreground">No object selected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="features" className="p-4">
          {/* TODO: Implement FeatureManager component wrapper */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Manager</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Feature management interface will be implemented here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RightPanel;
