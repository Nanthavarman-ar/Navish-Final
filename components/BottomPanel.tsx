import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Activity, AlertTriangle, CheckCircle, Clock,
  Cpu, Zap, Users, Settings, Info, Play, Pause, RotateCcw,
  Download, Video, Image, FileText, PlayCircle, Square, SkipBack, SkipForward
} from 'lucide-react';
import { AbstractMesh } from '@babylonjs/core';
import { AnimationTimeline } from './AnimationTimeline';
import type { AnimationManager } from './AnimationManager';

interface BottomPanelProps {
  activeFeatures: string[];
  performanceMode: 'low' | 'medium' | 'high';
  selectedMesh: AbstractMesh | null;
  onFeatureToggle: (featureId: string) => void;
  onPerformanceModeChange: (mode: 'low' | 'medium' | 'high') => void;
  featureStats: {
    total: number;
    active: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
  warnings: string[];
  suggestions: string[];
  onSequenceCreate: (sequence: any) => void;
  onSequencePlay: (sequenceId: string) => void;
  // Optional - the Timeline tab falls back to AnimationTimeline's own "no manager" empty
  // state when this is omitted, same as it did with the hardcoded null it used to get.
  animationManager?: AnimationManager | null;
}

const BottomPanel: React.FC<BottomPanelProps> = ({
  activeFeatures,
  performanceMode,
  selectedMesh,
  onFeatureToggle,
  onPerformanceModeChange,
  featureStats,
  warnings,
  suggestions,
  onSequenceCreate,
  onSequencePlay,
  animationManager = null
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="w-3 h-3 text-green-500" />;
      case 'inactive': return <Pause className="w-3 h-3 text-gray-500" />;
      case 'error': return <AlertTriangle className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-blue-500" />;
    }
  };

  // Timeline and Export state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportFormat, setExportFormat] = useState('gltf');
  const [exportQuality, setExportQuality] = useState('high');
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    // Simulate export progress
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="h-64 bg-background border-t border-gray-600">
      <Tabs defaultValue="performance" className="h-full">
        <TabsList className="flex overflow-x-auto sm:grid sm:w-full sm:grid-cols-5">
          <TabsTrigger value="performance" className="shrink-0 sm:shrink">Performance</TabsTrigger>
          <TabsTrigger value="features" className="shrink-0 sm:shrink">Features</TabsTrigger>
          <TabsTrigger value="timeline" className="shrink-0 sm:shrink">Timeline</TabsTrigger>
          <TabsTrigger value="export" className="shrink-0 sm:shrink">Export</TabsTrigger>
          <TabsTrigger value="selected" className="shrink-0 sm:shrink">Selected Object</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="p-4 h-full">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Performance Mode</h3>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={performanceMode === mode ? 'default' : 'outline'}
                      onClick={() => onPerformanceModeChange(mode)}
                      className="capitalize"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-2">Feature Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Total Features</span>
                      <Badge variant="secondary">{featureStats.total}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Active Features</span>
                      <Badge variant="secondary">{featureStats.active}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium">By Category</div>
                    {Object.entries(featureStats.byCategory).slice(0, 3).map(([category, count]) => (
                      <div key={category} className="flex justify-between text-xs">
                        <span className="capitalize">{category}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium">Warnings</span>
                  </div>
                  <ul className="text-xs space-y-1">
                    {warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Suggestions</span>
                  </div>
                  <ul className="text-xs space-y-1">
                    {suggestions.map((suggestion, index) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="features" className="p-4 h-full">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              <h3 className="text-sm font-medium mb-2">Active Features</h3>
              {activeFeatures.length === 0 ? (
                <p className="text-xs text-muted-foreground">No features active</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {activeFeatures.map((featureId) => (
                    <TooltipProvider key={featureId}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="justify-start text-xs"
                            onClick={() => onFeatureToggle(featureId)}
                          >
                            <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                            {featureId}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Click to deactivate</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="timeline" className="p-4 h-full">
        <AnimationTimeline
          animationManager={animationManager}
          selectedObject={selectedMesh}
          onSequenceCreate={onSequenceCreate}
          onSequencePlay={onSequencePlay}
        />
          {/* Additional timeline controls can be added here */}
        </TabsContent>

        <TabsContent value="export" className="p-4 h-full">
          <div>
            <h3 className="text-sm font-medium mb-2">Export Scene</h3>
            <Select value={exportFormat} onValueChange={setExportFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gltf">GLTF</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <Label className="mt-4">Quality</Label>
            <Select value={exportQuality} onValueChange={setExportQuality}>
              <SelectTrigger>
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="mt-4"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export"}
            </Button>
            {isExporting && (
              <Progress value={exportProgress} className="mt-2" />
            )}
            {/* Export status and settings can be expanded here */}
          </div>
        </TabsContent>

        <TabsContent value="selected" className="p-4 h-full">
          <ScrollArea className="h-full">
            {selectedMesh ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Object Properties</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="font-mono">{selectedMesh.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ID:</span>
                      <span className="font-mono">{selectedMesh.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Position:</span>
                      <span className="font-mono">
                        ({selectedMesh.position.x.toFixed(2)}, {selectedMesh.position.y.toFixed(2)}, {selectedMesh.position.z.toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Visible:</span>
                      <Badge variant={selectedMesh.isVisible ? 'default' : 'secondary'}>
                        {selectedMesh.isVisible ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">Material</h3>
                  {selectedMesh.material ? (
                    <div className="text-xs">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="font-mono">{selectedMesh.material.getClassName()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No material assigned</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No object selected</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BottomPanel;
