import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Maximize } from 'lucide-react';
import { Mesh } from '@babylonjs/core';
import EnergyDashboard from '../EnergyDashboard';

interface InspectorLogicProps {
  workspaceState: {
    rightPanelVisible: boolean;
    selectedMesh: Mesh | null;
  };
  updateState: (updates: any) => void;
  bimManagerRef: React.RefObject<any>;
  simulationManagerRef: React.RefObject<any>;
  currentModelId: string;
  collabManagerRef?: React.RefObject<any>;
  cloudAnchorManagerRef?: React.RefObject<any>;
  featureStates?: Record<string, boolean>;
}

export const useInspectorLogic = ({
  workspaceState,
  updateState,
  bimManagerRef,
  simulationManagerRef,
  currentModelId,
  collabManagerRef,
  cloudAnchorManagerRef,
  featureStates
}: InspectorLogicProps) => {
  const renderRightPanel = () => {
    if (!workspaceState.rightPanelVisible) return null;

    return (
      <div className="w-80 border-l border-gray-700 bg-gray-900 text-white">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inspector</h2>
          <Button size="sm" variant="ghost" aria-label="Close Right Panel" onClick={() => updateState({ rightPanelVisible: false })}>
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="collab">Collab</TabsTrigger>
            <TabsTrigger value="cloud">Cloud</TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="p-4">
            <Card>
              <CardHeader>
                <CardTitle>Object Properties</CardTitle>
              </CardHeader>
              <CardContent>
                {workspaceState.selectedMesh ? (
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {workspaceState.selectedMesh.name}</div>
                    <div><strong>Position:</strong> {workspaceState.selectedMesh.position.toString()}</div>
                    <div><strong>Rotation:</strong> {workspaceState.selectedMesh.rotation.toString()}</div>
                    <div><strong>Scale:</strong> {workspaceState.selectedMesh.scaling.toString()}</div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No object selected</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="materials" className="p-4">
            <Card>
              <CardHeader>
                <CardTitle>Material Properties</CardTitle>
              </CardHeader>
              <CardContent>
                {workspaceState.selectedMesh?.material ? (
                  <div className="space-y-2">
                    <div><strong>Material Type:</strong> {workspaceState.selectedMesh.material.getClassName()}</div>
                    <div><strong>Diffuse Color:</strong> {(workspaceState.selectedMesh.material as any).diffuseColor?.toString() || 'N/A'}</div>
                    <div><strong>Specular Color:</strong> {(workspaceState.selectedMesh.material as any).specularColor?.toString() || 'N/A'}</div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No material assigned</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="features" className="p-4">
            <div className="text-muted-foreground">
              Feature management is handled through the left panel.
            </div>
          </TabsContent>
          <TabsContent value="energy" className="p-4">
            {bimManagerRef.current && (
              <EnergyDashboard
                bimManager={bimManagerRef.current}
                simulationManager={simulationManagerRef.current}
                modelId={String(currentModelId)}
              />
            )}
          </TabsContent>
          <TabsContent value="collab" className="p-4">
            <Card>
              <CardHeader>
                <CardTitle>Collaboration Debug</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div><strong>Connected:</strong> {collabManagerRef?.current?.isConnected ? 'Yes' : 'No'}</div>
                  <div><strong>Users:</strong> {collabManagerRef?.current?.getUsers()?.length || 0}</div>
                  <div><strong>Objects:</strong> {collabManagerRef?.current?.getObjects()?.length || 0}</div>
                  <div><strong>Current User:</strong> {collabManagerRef?.current?.getCurrentUser()?.name || 'N/A'}</div>
                  <Button size="sm" onClick={() => collabManagerRef?.current?.connect()}>
                    Connect
                  </Button>
                  <Button size="sm" onClick={() => collabManagerRef?.current?.disconnect()}>
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cloud" className="p-4">
            <Card>
              <CardHeader>
                <CardTitle>Cloud Anchor Debug</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div><strong>Connected:</strong> {cloudAnchorManagerRef?.current?.isConnected ? 'Yes' : 'No'}</div>
                  <div><strong>Anchors:</strong> {cloudAnchorManagerRef?.current?.getAnchors()?.length || 0}</div>
                  <div><strong>Sync Status:</strong> {cloudAnchorManagerRef?.current?.syncStatus || 'N/A'}</div>
                  <Button size="sm" onClick={() => cloudAnchorManagerRef?.current?.connect()}>
                    Connect
                  </Button>
                  <Button size="sm" onClick={() => cloudAnchorManagerRef?.current?.syncAllAnchors()}>
                    Sync All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return { renderRightPanel };
};
