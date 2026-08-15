import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Vector3, PointerEventTypes, PickingInfo, GizmoManager, UtilityLayerRenderer, StandardMaterial, Color3, MeshBuilder } from '@babylonjs/core';
import { FurnitureManager, FurnitureItem, PlacedFurniture } from './managers/FurnitureManager';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Icons
import {
  Search, Sofa, Armchair, Bed, Table, Lamp, Box, Trash2, RotateCw, Move, Scale,
  Undo, Redo, Eye, EyeOff, Plus, Minus, Grid3X3, Target, Zap, Settings, X
} from 'lucide-react';

interface AutoFurnishProps {
  sceneManager: any;
  onClose: () => void;
}

const AutoFurnish: React.FC<AutoFurnishProps> = ({ sceneManager, onClose }) => {
  // State management
  const [furnitureManager, setFurnitureManager] = useState<FurnitureManager | null>(null);
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [furnitureItems, setFurnitureItems] = useState<FurnitureItem[]>([]);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurniture[]>([]);
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItem | null>(null);
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<PlacedFurniture | null>(null);
  const [placementMode, setPlacementMode] = useState<'auto' | 'manual'>('manual');
  const [isPlacing, setIsPlacing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Workspace area state
  const [isPlacementActive, setIsPlacementActive] = useState(false);
  const [gizmoManager, setGizmoManager] = useState<GizmoManager | null>(null);
  const [previewMesh, setPreviewMesh] = useState<any>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(0.5);
  const [collisionVisualization, setCollisionVisualization] = useState(false);

  // Refs
  const placementPreviewRef = useRef<any>(null);

  // Initialize FurnitureManager and workspace tools
  useEffect(() => {
    if (sceneManager?.scene && !furnitureManager) {
      const manager = new FurnitureManager(sceneManager.scene);
      setFurnitureManager(manager);

      // Initialize gizmo manager for manipulation
      const utilityLayer = new UtilityLayerRenderer(sceneManager.scene);
      const gizmoMgr = new GizmoManager(sceneManager.scene, 2, utilityLayer);
      gizmoMgr.positionGizmoEnabled = true;
      gizmoMgr.rotationGizmoEnabled = true;
      gizmoMgr.scaleGizmoEnabled = true;
      gizmoMgr.boundingBoxGizmoEnabled = false;
      setGizmoManager(gizmoMgr);

      // Load initial furniture items
      updateFurnitureItems();
      updatePlacedFurniture();
    }

    return () => {
      if (gizmoManager) {
        gizmoManager.dispose();
      }
      if (furnitureManager) {
        furnitureManager.dispose();
      }
      if (previewMesh) {
        previewMesh.dispose();
      }
    };
  }, [sceneManager, furnitureManager]);

  // Update furniture items based on filters
  const updateFurnitureItems = () => {
    if (!furnitureManager) return;

    let items: FurnitureItem[] = [];

    if (searchQuery) {
      items = furnitureManager.searchFurniture(searchQuery);
    } else if (selectedCategory !== 'all') {
      items = furnitureManager.getFurnitureByCategory(selectedCategory);
    } else if (selectedBrand !== 'all') {
      items = furnitureManager.getFurnitureByBrand(selectedBrand);
    } else {
      // Get all items
      const categories = furnitureManager.getCategories();
      categories.forEach(category => {
        items.push(...furnitureManager!.getFurnitureByCategory(category));
      });
    }

    setFurnitureItems(items);
  };

  // Update placed furniture list
  const updatePlacedFurniture = () => {
    if (!furnitureManager) return;
    setPlacedFurniture(furnitureManager.getPlacedFurniture());
  };

  // Handle search and filter changes
  useEffect(() => {
    updateFurnitureItems();
  }, [searchQuery, selectedCategory, selectedBrand, furnitureManager]);



  // Create preview mesh for selected furniture
  const createPreviewMesh = useCallback(() => {
    if (!selectedFurniture || !sceneManager?.scene) return;

    // Dispose existing preview
    if (previewMesh) {
      previewMesh.dispose();
    }

    // Create a simple box preview with dimensions
    const { width, height, depth } = selectedFurniture.dimensions;
    const mesh = MeshBuilder.CreateBox('furniturePreview', {
      width: width,
      height: height,
      depth: depth
    }, sceneManager.scene);

    const material = new StandardMaterial('previewMaterial', sceneManager.scene);
    material.diffuseColor = new Color3(0, 1, 0);
    material.alpha = 0.5;
    mesh.material = material;

    mesh.isPickable = false;
    setPreviewMesh(mesh);
  }, [selectedFurniture, sceneManager, previewMesh]);

  // Update preview position
  const updatePreviewPosition = useCallback((position: Vector3) => {
    if (previewMesh) {
      const finalPosition = position.clone();

      if (snapToGrid) {
        finalPosition.x = Math.round(finalPosition.x / gridSize) * gridSize;
        finalPosition.z = Math.round(finalPosition.z / gridSize) * gridSize;
      }

      previewMesh.position = finalPosition;

      // Update material based on clearance
      if (furnitureManager && selectedFurniture) {
        const isClear = furnitureManager.checkClearance(finalPosition, selectedFurniture.dimensions);
        const material = previewMesh.material as StandardMaterial;
        material.diffuseColor = isClear ? new Color3(0, 1, 0) : new Color3(1, 0, 0);
      }
    }
  }, [previewMesh, snapToGrid, gridSize, furnitureManager, selectedFurniture]);

  // Handle scene pointer events for placement
  useEffect(() => {
    if (!sceneManager?.scene || !isPlacementActive || placementMode !== 'manual') return;

    const handlePointerDown = (pointerInfo: any) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.pickInfo?.hit) {
        const pickInfo = pointerInfo.pickInfo as PickingInfo;
        if (pickInfo.pickedPoint && selectedFurniture && furnitureManager) {
          const position = pickInfo.pickedPoint.clone();
          position.y = 0; // Place on ground

          if (furnitureManager.checkClearance(position, selectedFurniture.dimensions)) {
            furnitureManager.placeFurniture(position).then(() => {
              updatePlacedFurniture();
            });
          }
        }
      }
    };

    const handlePointerMove = (pointerInfo: any) => {
      if (pointerInfo.type === PointerEventTypes.POINTERMOVE && pointerInfo.pickInfo?.hit && previewMesh) {
        const pickInfo = pointerInfo.pickInfo as PickingInfo;
        if (pickInfo.pickedPoint) {
          const position = pickInfo.pickedPoint.clone();
          position.y = selectedFurniture ? selectedFurniture.dimensions.height / 2 : 0;
          updatePreviewPosition(position);
        }
      }
    };

    const observerDown = sceneManager.scene.onPointerObservable.add(handlePointerDown);
    const observerMove = sceneManager.scene.onPointerObservable.add(handlePointerMove);

    return () => {
      sceneManager.scene.onPointerObservable.remove(observerDown);
      sceneManager.scene.onPointerObservable.remove(observerMove);
    };
  }, [sceneManager, isPlacementActive, placementMode, selectedFurniture, furnitureManager, previewMesh, updatePreviewPosition]);

  // Handle furniture selection with preview
  const handleFurnitureSelect = (item: FurnitureItem) => {
    setSelectedFurniture(item);
    if (furnitureManager) {
      furnitureManager.selectFurniture(item.id);
    }
    if (isPlacementActive && placementMode === 'manual') {
      createPreviewMesh();
    }
  };

  // Toggle placement mode
  const togglePlacementMode = () => {
    const newActive = !isPlacementActive;
    setIsPlacementActive(newActive);

    if (newActive && placementMode === 'manual' && selectedFurniture) {
      createPreviewMesh();
    } else if (!newActive && previewMesh) {
      previewMesh.dispose();
      setPreviewMesh(null);
    }
  };

  // Handle furniture placement
  const handlePlaceFurniture = async () => {
    if (!furnitureManager || !selectedFurniture) return;

    setIsPlacing(true);
    setLoadingProgress(0);

    try {
      if (placementMode === 'auto') {
        // Auto-placement logic (simplified - would need room analysis)
        const positions = [
          new Vector3(-2, 0, 0),
          new Vector3(2, 0, 0),
          new Vector3(0, 0, -2),
          new Vector3(0, 0, 2)
        ];

        for (let i = 0; i < Math.min(4, furnitureItems.length); i++) {
          setLoadingProgress((i / Math.min(4, furnitureItems.length)) * 100);
          const item = furnitureItems[i];
          furnitureManager.selectFurniture(item.id);

          const position = positions[i % positions.length];
          if (furnitureManager.checkClearance(position, item.dimensions)) {
            await furnitureManager.placeFurniture(position);
          }
        }
      } else {
        // Manual placement - place at center for now
        const position = new Vector3(0, 0, 0);
        if (furnitureManager.checkClearance(position, selectedFurniture.dimensions)) {
          await furnitureManager.placeFurniture(position);
        }
      }

      updatePlacedFurniture();
      setLoadingProgress(100);
    } catch (error) {
      console.error('Failed to place furniture:', error);
    } finally {
      setIsPlacing(false);
      setTimeout(() => setLoadingProgress(0), 1000);
    }
  };

  // Handle placed furniture selection with gizmos
  const handlePlacedItemSelect = (item: PlacedFurniture) => {
    setSelectedPlacedItem(item);
    if (gizmoManager) {
      // Attach gizmo to the first child mesh of the transform node
      const childMeshes = item.mesh.getChildMeshes();
      if (childMeshes.length > 0) {
        gizmoManager.attachToMesh(childMeshes[0]);
      } else {
        gizmoManager.attachToMesh(null);
      }
    }
  };

  // Handle furniture removal
  const handleRemoveFurniture = (placedId: string) => {
    if (furnitureManager) {
      furnitureManager.removeFurniture(placedId);
      updatePlacedFurniture();
      if (selectedPlacedItem?.id === placedId) {
        setSelectedPlacedItem(null);
      }
    }
  };

  // Clear all furniture
  const handleClearAll = () => {
    if (furnitureManager) {
      furnitureManager.clearAllFurniture();
      updatePlacedFurniture();
      setSelectedPlacedItem(null);
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'chair': return <Armchair className="w-4 h-4" />;
      case 'table': return <Table className="w-4 h-4" />;
      case 'sofa': return <Sofa className="w-4 h-4" />;
      case 'bed': return <Bed className="w-4 h-4" />;
      case 'lamp': return <Lamp className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  // Render furniture item card
  const renderFurnitureCard = (item: FurnitureItem) => (
    <Card
      key={item.id}
      className={`cursor-pointer transition-all hover:shadow-md ${
        selectedFurniture?.id === item.id ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => handleFurnitureSelect(item)}
    >
      <CardContent className="p-3">
        <div className="aspect-square bg-gray-100 rounded mb-2 flex items-center justify-center">
          {getCategoryIcon(item.category)}
        </div>
        <h4 className="font-medium text-sm truncate">{item.name}</h4>
        <p className="text-xs text-gray-500">{item.brand}</p>
        <div className="flex items-center justify-between mt-2">
          <Badge variant="secondary" className="text-xs">
            ${item.price}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {item.category}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  // Render placed furniture item
  const renderPlacedItem = (item: PlacedFurniture) => (
    <div
      key={item.id}
      className={`p-3 border rounded cursor-pointer transition-all ${
        selectedPlacedItem?.id === item.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
      }`}
      onClick={() => handlePlacedItemSelect(item)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getCategoryIcon(item.item.category)}
          <div>
            <p className="font-medium text-sm">{item.item.name}</p>
            <p className="text-xs text-gray-500">
              {item.position.x.toFixed(1)}, {item.position.y.toFixed(1)}, {item.position.z.toFixed(1)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveFurniture(item.id);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-900 text-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold">Auto Furnish</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Loading Progress */}
      {isPlacing && (
        <div className="px-4 py-2">
          <Progress value={loadingProgress} className="w-full" />
          <p className="text-xs text-gray-400 mt-1">Placing furniture...</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="place">Place</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          {/* Catalog Tab */}
          <TabsContent value="catalog" className="flex-1 px-4 pb-4 mt-4 overflow-hidden">
            <div className="space-y-4 h-full flex flex-col">
              {/* Search and Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search furniture..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {furnitureManager?.getCategories().map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {furnitureManager && (
                        <>
                          {Array.from(new Set(furnitureItems.map(item => item.brand))).map(brand => (
                            <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Furniture Grid */}
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-2 gap-3">
                  {furnitureItems.map(renderFurnitureCard)}
                </div>
                {furnitureItems.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No furniture found matching your criteria
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Place Tab */}
          <TabsContent value="place" className="flex-1 px-4 pb-4 mt-4 overflow-hidden">
            <div className="space-y-4 h-full flex flex-col">
              {/* Placement Mode */}
              <div className="space-y-2">
                <h3 className="font-medium">Placement Mode</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={placementMode === 'manual' ? 'default' : 'outline'}
                    onClick={() => setPlacementMode('manual')}
                  >
                    <Target className="w-4 h-4 mr-1" />
                    Manual
                  </Button>
                  <Button
                    size="sm"
                    variant={placementMode === 'auto' ? 'default' : 'outline'}
                    onClick={() => setPlacementMode('auto')}
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Auto
                  </Button>
                </div>
              </div>

              {/* Selected Furniture Info */}
              {selectedFurniture && (
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {getCategoryIcon(selectedFurniture.category)}
                      <span className="font-medium">{selectedFurniture.name}</span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Brand: {selectedFurniture.brand}</p>
                      <p>Dimensions: {selectedFurniture.dimensions.width}" × {selectedFurniture.dimensions.height}" × {selectedFurniture.dimensions.depth}"</p>
                      <p>Price: ${selectedFurniture.price}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Workspace Controls */}
              <div className="space-y-2">
                <h3 className="font-medium">Workspace Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={isPlacementActive ? 'default' : 'outline'}
                    onClick={togglePlacementMode}
                    disabled={!selectedFurniture}
                  >
                    <Target className="w-4 h-4 mr-1" />
                    {isPlacementActive ? 'Exit Place Mode' : 'Enter Place Mode'}
                  </Button>
                  <Button
                    size="sm"
                    variant={snapToGrid ? 'default' : 'outline'}
                    onClick={() => setSnapToGrid(!snapToGrid)}
                  >
                    <Grid3X3 className="w-4 h-4 mr-1" />
                    Snap Grid
                  </Button>
                </div>
                {snapToGrid && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Grid Size:</label>
                    <Input
                      type="number"
                      value={gridSize}
                      onChange={(e) => setGridSize(parseFloat(e.target.value) || 0.5)}
                      className="w-20"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="collisionViz"
                    checked={collisionVisualization}
                    onChange={(e) => setCollisionVisualization(e.target.checked)}
                  />
                  <label htmlFor="collisionViz" className="text-sm">Collision Visualization</label>
                </div>
              </div>

              {/* Placement Controls */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showPreview"
                    checked={showPreview}
                    onChange={(e) => setShowPreview(e.target.checked)}
                  />
                  <label htmlFor="showPreview" className="text-sm">Show placement preview</label>
                </div>
                <Button
                  onClick={handlePlaceFurniture}
                  disabled={!selectedFurniture || isPlacing}
                  className="w-full"
                >
                  {placementMode === 'auto' ? 'Auto-Place Furniture' : 'Place Selected Furniture'}
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <h3 className="font-medium">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline">
                    <Grid3X3 className="w-4 h-4 mr-1" />
                    Snap to Grid
                  </Button>
                  <Button size="sm" variant="outline">
                    <Eye className="w-4 h-4 mr-1" />
                    Toggle Preview
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="flex-1 px-4 pb-4 mt-4 overflow-hidden">
            <div className="space-y-4 h-full flex flex-col">
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{placedFurniture.length}</div>
                    <div className="text-sm text-gray-400">Placed Items</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{furnitureItems.length}</div>
                    <div className="text-sm text-gray-400">Available Items</div>
                  </CardContent>
                </Card>
              </div>

              {/* Placed Furniture List */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Placed Furniture</h3>
                  <Button size="sm" variant="outline" onClick={handleClearAll}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {placedFurniture.map(renderPlacedItem)}
                    {placedFurniture.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No furniture placed yet
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Selected Item Controls */}
              {selectedPlacedItem && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Selected: {selectedPlacedItem.item.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant="outline">
                        <Move className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <RotateCw className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Scale className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Undo className="w-4 h-4 mr-1" />
                        Undo
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Redo className="w-4 h-4 mr-1" />
                        Redo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AutoFurnish;
