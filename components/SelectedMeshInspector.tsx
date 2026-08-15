import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Maximize } from 'lucide-react';

interface SelectedMeshInspectorProps {
  selectedMesh: any; // Ideally type as Babylon.Mesh or similar
  rightPanelVisible: boolean;
  onClose: () => void;
}

const SelectedMeshInspector: React.FC<SelectedMeshInspectorProps> = React.memo(({ selectedMesh, rightPanelVisible, onClose }) => {
  if (!rightPanelVisible) return null;

  return (
    <div className="w-80 border-l border-gray-700 bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inspector</h2>
        <Button size="sm" variant="ghost" aria-label="Close Right Panel" onClick={onClose}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="p-4">
          <div>
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
          </div>
        </TabsContent>
        <TabsContent value="features" className="p-4">
          <div className="text-muted-foreground">
            Feature management is handled through the left panel.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default SelectedMeshInspector;
