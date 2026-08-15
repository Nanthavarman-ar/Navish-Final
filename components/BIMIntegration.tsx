import React, { useState, useRef, useCallback } from 'react';
import { Scene, Mesh } from '@babylonjs/core';
import { BIMManager, BIMModel, BIMElement, BIMClash } from './BIMManager';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import {
  Upload, Eye, EyeOff, AlertTriangle, DollarSign, Layers, Search,
  Settings, Download, Trash2, Plus, Minus, RotateCcw, Info
} from 'lucide-react';

interface BIMIntegrationProps {
  scene: Scene;
  isActive: boolean;
  bimManager?: BIMManager;
  onClose?: () => void;
}

const BIMIntegration: React.FC<BIMIntegrationProps> = ({
  scene,
  isActive,
  bimManager,
  onClose
}) => {
  const [models, setModels] = useState<BIMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<BIMModel | null>(null);
  const [selectedElement, setSelectedElement] = useState<BIMElement | null>(null);
  const [clashes, setClashes] = useState<BIMClash[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHiddenDetails, setShowHiddenDetails] = useState(false);
  const [transparencyMode, setTransparencyMode] = useState(false);
  const [wallPeelingMode, setWallPeelingMode] = useState(false);
  const [clashDetectionEnabled, setClashDetectionEnabled] = useState(false);
  const [elementFilter, setElementFilter] = useState<string>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize BIM Manager if not provided
  const [localBimManager] = useState(() => {
    if (bimManager) return bimManager;
    // This would need proper initialization with FeatureManager
    // For now, return null and show message
    return null;
  });

  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !localBimManager) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const importedModel = await localBimManager.importBIMModel(file);
      clearInterval(progressInterval);
      setImportProgress(100);

      setModels(prev => [...prev, importedModel]);
      setSelectedModel(importedModel);

      // Delay to show completion
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
      }, 500);

    } catch (error) {
      console.error('BIM import failed:', error);
      setIsImporting(false);
      setImportProgress(0);
    }
  }, [localBimManager]);

  const handleElementSelect = useCallback((element: BIMElement) => {
    setSelectedElement(element);
    if (localBimManager) {
      localBimManager.highlightElement(element.id, true);
    }
  }, [localBimManager]);

  const toggleHiddenDetails = useCallback(() => {
    if (!localBimManager) return;
    localBimManager.toggleHiddenDetails();
    setShowHiddenDetails(!showHiddenDetails);
  }, [localBimManager, showHiddenDetails]);

  const toggleTransparency = useCallback(() => {
    if (!localBimManager) return;
    localBimManager.toggleTransparencyMode();
    setTransparencyMode(!transparencyMode);
  }, [localBimManager, transparencyMode]);

  const toggleWallPeeling = useCallback(() => {
    if (!localBimManager) return;
    localBimManager.toggleWallPeeling();
    setWallPeelingMode(!wallPeelingMode);
  }, [localBimManager, wallPeelingMode]);

  const toggleClashDetection = useCallback(() => {
    if (!localBimManager) return;
    if (!clashDetectionEnabled) {
      localBimManager.enableClashDetection();
      setClashes(localBimManager.getClashes());
    } else {
      localBimManager.disableClashDetection();
      setClashes([]);
    }
    setClashDetectionEnabled(!clashDetectionEnabled);
  }, [localBimManager, clashDetectionEnabled]);

  const filteredElements = selectedModel?.elements.filter(element => {
    const matchesSearch = element.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         element.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = elementFilter === 'all' || element.type === elementFilter;
    return matchesSearch && matchesFilter;
  }) || [];

  if (!isActive) return null;

  if (!localBimManager) {
    return (
      <div className="absolute top-4 left-4 z-50">
        <Alert className="w-80">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            BIM Manager not initialized. Please ensure proper workspace setup.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-50 w-96 max-h-96">
      <Card className="bg-background/95 backdrop-blur border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">BIM Integration</CardTitle>
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="models" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="elements">Elements</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="models" className="space-y-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex-1"
                  aria-label="Import BIM file"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import BIM
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.ifc,.rvt,.dwg"
                  onChange={handleFileImport}
                  className="hidden"
                  title="Import BIM file"
                />
              </div>

              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importing...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              <ScrollArea className="h-32">
                {models.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No BIM models loaded
                  </p>
                ) : (
                  <div className="space-y-2">
                    {models.map(model => (
                      <div
                        key={model.id}
                        className={`p-2 rounded border cursor-pointer ${
                          selectedModel?.id === model.id ? 'border-primary bg-primary/10' : 'border-border'
                        }`}
                        onClick={() => setSelectedModel(model)}
                      >
                        <div className="font-medium text-sm">{model.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.elements.length} elements • {model.source}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="elements" className="space-y-3">
              {selectedModel ? (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Search elements..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8"
                        title="Search elements input"
                      />
                    </div>
                    <Select value={elementFilter} onValueChange={setElementFilter}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="wall">Walls</SelectItem>
                        <SelectItem value="floor">Floors</SelectItem>
                        <SelectItem value="door">Doors</SelectItem>
                        <SelectItem value="window">Windows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {filteredElements.map(element => (
                        <div
                          key={element.id}
                          className={`p-2 rounded border cursor-pointer text-sm ${
                            selectedElement?.id === element.id ? 'border-primary bg-primary/10' : 'border-border'
                          }`}
                          onClick={() => handleElementSelect(element)}
                        >
                          <div className="font-medium">{element.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {element.type} • {element.category}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Select a BIM model first
                </p>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={showHiddenDetails ? "default" : "outline"}
                  onClick={toggleHiddenDetails}
                  className="text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Hidden
                </Button>
                <Button
                  size="sm"
                  variant={transparencyMode ? "default" : "outline"}
                  onClick={toggleTransparency}
                  className="text-xs"
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  X-Ray
                </Button>
                <Button
                  size="sm"
                  variant={wallPeelingMode ? "default" : "outline"}
                  onClick={toggleWallPeeling}
                  className="text-xs"
                >
                  <Layers className="w-3 h-3 mr-1" />
                  Peel
                </Button>
                <Button
                  size="sm"
                  variant={clashDetectionEnabled ? "default" : "outline"}
                  onClick={toggleClashDetection}
                  className="text-xs"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Clashes
                </Button>
              </div>

              {clashes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">
                      {clashes.length} clash{clashes.length !== 1 ? 'es' : ''} detected
                    </span>
                  </div>
                  <ScrollArea className="h-20">
                    <div className="space-y-1">
                      {clashes.slice(0, 5).map(clash => (
                        <div key={clash.id} className="text-xs p-2 bg-destructive/10 rounded">
                          {clash.description}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {selectedElement && (
                <div className="space-y-2 p-2 bg-muted rounded">
                  <div className="font-medium text-sm">{selectedElement.name}</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Type: {selectedElement.type}</div>
                    <div>Category: {selectedElement.category}</div>
                    {selectedElement.material && <div>Material: {selectedElement.material}</div>}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default BIMIntegration;
