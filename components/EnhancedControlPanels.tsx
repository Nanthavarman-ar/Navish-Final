import React, { useState, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { AnimationTimeline } from './AnimationTimeline';
import { MaterialPropertyEditor } from './MaterialPropertyEditor';
import { MaterialPresetSelector } from './MaterialPresetSelector';
import { useDrop } from 'react-dnd';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useIsMobile } from './ui/use-mobile';

interface EnhancedControlPanelsProps {
  scene: BABYLON.Scene;
  engine: BABYLON.Engine;
  selectedObject: BABYLON.AbstractMesh | null;
  selectedMaterial: BABYLON.Material | null;
  animationManager: any;
  materialManager: any;
  onAnimationSequenceCreate: (sequence: any) => void;
  onAnimationSequencePlay: (sequenceId: string) => void;
  onMaterialPropertyChange: (property: string, value: number) => void;
  onMaterialPresetApply: (preset: any) => void;
}

export const EnhancedControlPanels: React.FC<EnhancedControlPanelsProps> = ({
  scene,
  engine,
  selectedObject,
  selectedMaterial,
  animationManager,
  materialManager,
  onAnimationSequenceCreate,
  onAnimationSequencePlay,
  onMaterialPropertyChange,
  onMaterialPresetApply
}) => {
  const [activeTab, setActiveTab] = useState<string>('animations');
  const [panelsVisible, setPanelsVisible] = useState<boolean>(true);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [isRealTimePreview, setIsRealTimePreview] = useState<boolean>(true);
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const isMobile = useIsMobile();

  // Responsive design: auto-compact on mobile
  useEffect(() => {
    setIsCompactMode(isMobile);
  }, [isMobile]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when panels are visible
      if (!panelsVisible) return;

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'z':
            event.preventDefault();
            if (event.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            event.preventDefault();
            redo();
            break;
          case '1':
            event.preventDefault();
            setActiveTab('animations');
            break;
          case '2':
            event.preventDefault();
            setActiveTab('materials');
            break;
          case '3':
            event.preventDefault();
            setActiveTab('presets');
            break;
        }
      } else {
        switch (event.key) {
          case ' ':
            event.preventDefault();
            // Toggle play/pause for animations
            if (animationManager && selectedObject) {
              // This would need to be implemented based on current animation state
            }
            break;
          case 'Escape':
            event.preventDefault();
            setPanelsVisible(false);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [panelsVisible, activeTab, animationManager, selectedObject]);

  const togglePanels = () => {
    setPanelsVisible(!panelsVisible);
  };

  // Undo/Redo functionality
  const saveState = useCallback((action: string, data: any) => {
    if (!isRealTimePreview) return;

    const state = {
      action,
      data,
      timestamp: Date.now(),
      selectedObject: selectedObject?.name,
      selectedMaterial: selectedMaterial?.name
    };

    setUndoStack(prev => [...prev, state]);
    setRedoStack([]); // Clear redo stack when new action is performed
  }, [selectedObject, selectedMaterial, isRealTimePreview]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const lastState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastState]);

    // Restore state based on action type
    switch (lastState.action) {
      case 'materialPropertyChange':
        if (lastState.data.previousValue !== undefined) {
          onMaterialPropertyChange(lastState.data.property, lastState.data.previousValue);
        }
        break;
      case 'materialPresetApply':
        // This would need more complex logic to revert preset application
        break;
    }
  }, [undoStack, onMaterialPropertyChange]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const stateToRedo = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, stateToRedo]);

    // Reapply state based on action type
    switch (stateToRedo.action) {
      case 'materialPropertyChange':
        onMaterialPropertyChange(stateToRedo.data.property, stateToRedo.data.newValue);
        break;
      case 'materialPresetApply':
        onMaterialPresetApply(stateToRedo.data.preset);
        break;
    }
  }, [redoStack, onMaterialPropertyChange, onMaterialPresetApply]);

  const getObjectInfo = () => {
    if (!selectedObject) return null;

    return {
      name: selectedObject.name,
      type: selectedObject.constructor.name,
      position: selectedObject.position,
      rotation: selectedObject.rotation,
      scale: selectedObject.scaling,
      vertices: selectedObject.getTotalVertices(),
      faces: selectedObject.getTotalIndices() / 3
    };
  };

  const getMaterialInfo = () => {
    if (!selectedMaterial) return null;

    return {
      name: selectedMaterial.name || 'Unnamed Material',
      type: selectedMaterial.constructor.name,
      id: selectedMaterial.id
    };
  };

  const objectInfo = getObjectInfo();
  const materialInfo = getMaterialInfo();

  return (
    <div className="w-full h-full">
      {/* Toggle Button */}
      <Button
        onClick={togglePanels}
        className="mb-2 shadow-lg w-full"
        variant={panelsVisible ? "default" : "outline"}
      >
        {panelsVisible ? 'Hide Controls' : 'Show Controls'}
      </Button>

      {panelsVisible && (
        <Card className="w-full max-h-[70vh] overflow-hidden shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Enhanced Control Panels</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {objectInfo && (
                <Badge variant="secondary" className="text-xs">
                  Object: {objectInfo.name}
                </Badge>
              )}
              {materialInfo && (
                <Badge variant="outline" className="text-xs">
                  Material: {materialInfo.name}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
                <TabsTrigger value="animations" className="text-xs">
                  Animations
                </TabsTrigger>
                <TabsTrigger value="materials" className="text-xs">
                  Materials
                </TabsTrigger>
                <TabsTrigger value="presets" className="text-xs">
                  Presets
                </TabsTrigger>
              </TabsList>

              <div className="max-h-[60vh] overflow-y-auto">
                <TabsContent value="animations" className="p-4 m-0">
                  <AnimationTimeline
                    animationManager={animationManager}
                    selectedObject={selectedObject}
                    onSequenceCreate={onAnimationSequenceCreate}
                    onSequencePlay={onAnimationSequencePlay}
                  />
                </TabsContent>

                <TabsContent value="materials" className="p-4 m-0">
                  <MaterialPropertyEditor
                    material={selectedMaterial}
                    onPropertyChange={onMaterialPropertyChange}
                  />
                </TabsContent>

                <TabsContent value="presets" className="p-4 m-0">
                  <MaterialPresetSelector
                    material={selectedMaterial}
                    onPresetApply={onMaterialPresetApply}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>

          {/* Object Info Panel */}
          {objectInfo && (
            <div className="border-t p-3 bg-gray-50">
              <h4 className="text-sm font-semibold mb-2">Object Details</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium">Type:</span> {objectInfo.type}
                </div>
                <div>
                  <span className="font-medium">Vertices:</span> {objectInfo.vertices}
                </div>
                <div>
                  <span className="font-medium">Faces:</span> {objectInfo.faces}
                </div>
                <div>
                  <span className="font-medium">Position:</span>
                  <br />
                  X: {objectInfo.position.x.toFixed(2)}
                  <br />
                  Y: {objectInfo.position.y.toFixed(2)}
                  <br />
                  Z: {objectInfo.position.z.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Material Info Panel */}
          {materialInfo && (
            <div className="border-t p-3 bg-blue-50">
              <h4 className="text-sm font-semibold mb-2">Material Details</h4>
              <div className="text-xs">
                <div>
                  <span className="font-medium">Type:</span> {materialInfo.type}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {materialInfo.id}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
