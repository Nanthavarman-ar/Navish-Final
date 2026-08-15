import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../core/WorkspaceContext';
import { useFeatureManager } from '../core/FeatureManager';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ScrollArea } from '../../ui/scroll-area';
import { Input } from '../../ui/input';
import { Separator } from '../../ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Progress } from '../../ui/progress';
import {
  Eye,
  Settings,
  Palette,
  Move3D,
  RotateCcw,
  Scale,
  Ruler,
  Sun,
  Camera,
  Grid3X3,
  Layers,
  Activity,
  Zap,
  Monitor,
  HardDrive,
  Cpu,
  MemoryStick,
  Thermometer,
  Wifi,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Maximize,
  Minimize,
  RotateCw,
  Copy,
  Trash,
  Edit,
  Save,
  Download,
  Upload,
  DollarSign
} from 'lucide-react';
import CostEstimatorWrapper from '../../CostEstimatorWrapper';
import './RightPanel.css';

interface RightPanelProps {
  onClose?: () => void;
  onMeshSelect?: (meshId: string) => void;
  onMaterialEdit?: (materialId: string) => void;
  onSceneExport?: () => void;
  onSceneImport?: () => void;
}

export function RightPanel({
  onClose,
  onMeshSelect,
  onMaterialEdit,
  onSceneExport,
  onSceneImport
}: RightPanelProps) {
  const { state, dispatch } = useWorkspace();
  const { importBIM, toggleClashDetection, toggleWallPeeling, showCostEstimation } = useFeatureManager();

  // Get selected mesh info
  const selectedMesh = state.selectedMesh;
  const meshInfo = selectedMesh ? {
    name: selectedMesh.name,
    id: selectedMesh.id,
    position: selectedMesh.position,
    rotation: selectedMesh.rotation,
    scaling: selectedMesh.scaling,
    material: selectedMesh.material?.name || 'None',
    visible: selectedMesh.isVisible,
    enabled: selectedMesh.isEnabled(),
  } : null;

  // Get scene statistics
  const sceneStats = {
    meshes: state.scene?.meshes?.length || 0,
    materials: state.materials?.length || 0,
    lights: state.scene?.lights?.length || 0,
    cameras: state.scene?.cameras?.length || 0,
    textures: state.scene?.textures?.length || 0,
    particles: state.scene?.particleSystems?.length || 0,
  };

  // Get performance metrics
  const performanceMetrics = {
    fps: 60, // Placeholder - would get from Babylon.js engine
    frameTime: 16.67, // Placeholder
    drawCalls: 150, // Placeholder
    triangles: 50000, // Placeholder
    memoryUsage: '256 MB', // Placeholder
    gpuMemory: '128 MB', // Placeholder
  };

  return (
    <motion.div
      className="right-panel w-80 md:w-96 lg:w-80 xl:w-96 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg"
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div
        className="right-panel-header p-4 border-b border-gray-200 dark:border-gray-700"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="right-panel-title text-lg font-semibold text-gray-900 dark:text-white">Inspector</h2>
        <Button variant="ghost" size="sm" className="right-panel-close hover:bg-gray-100 dark:hover:bg-gray-800" onClick={onClose}>
          <Maximize className="w-4 h-4" />
        </Button>
      </motion.div>

      <Tabs defaultValue="inspector" className="right-panel-tabs">
        <TabsList className="right-panel-tabs-list">
          <TabsTrigger value="inspector" className="right-panel-tab">
            <Eye className="w-4 h-4" />
            Inspector
          </TabsTrigger>
          <TabsTrigger value="scene" className="right-panel-tab">
            <Grid3X3 className="w-4 h-4" />
            Scene
          </TabsTrigger>
          <TabsTrigger value="performance" className="right-panel-tab">
            <Activity className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="materials" className="right-panel-tab">
            <Palette className="w-4 h-4" />
            Materials
          </TabsTrigger>
          <TabsTrigger value="bim" className="right-panel-tab">
            <Settings className="w-4 h-4" />
            BIM
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="right-panel-scroll-area">
          {/* Inspector Tab */}
          <TabsContent value="inspector" className="right-panel-tab-content">
            <AnimatePresence mode="wait">
              {meshInfo ? (
                <motion.div
                  key="inspector-selected"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Selected Object</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Object Info */}
                      <motion.div
                        className="object-info"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="info-row">
                          <span className="info-label">Name:</span>
                          <span className="info-value">{meshInfo.name}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">ID:</span>
                          <span className="info-value">{meshInfo.id}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Material:</span>
                          <span className="info-value">{meshInfo.material}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Visible:</span>
                          <span className="info-value">
                            {meshInfo.visible ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </span>
                        </div>
                      </motion.div>

                      <Separator />

                      {/* Transform Controls */}
                      <motion.div
                        className="transform-controls"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <h4 className="section-title">Transform</h4>

                        {/* Position */}
                        <div className="control-group">
                          <label className="control-label">Position</label>
                          <div className="vector-inputs">
                            <Input
                              type="number"
                              placeholder="X"
                              value={meshInfo.position?.x?.toFixed(2) || '0.00'}
                              className="vector-input"
                              readOnly
                            />
                            <Input
                              type="number"
                              placeholder="Y"
                              value={meshInfo.position?.y?.toFixed(2) || '0.00'}
                              className="vector-input"
                              readOnly
                            />
                            <Input
                              type="number"
                              placeholder="Z"
                              value={meshInfo.position?.z?.toFixed(2) || '0.00'}
                              className="vector-input"
                              readOnly
                            />
                          </div>
                        </div>

                        {/* Rotation */}
                        <div className="control-group">
                          <label className="control-label">Rotation</label>
                          <div className="vector-inputs">
                            <Input
                              type="number"
                              placeholder="X"
                              value={meshInfo.rotation?.x?.toFixed(2) || '0.00'}
                              className="vector-input"
                              readOnly
                            />
                            <Input
                              type="number"
                              placeholder="Y"
                              value={meshInfo.rotation?.y?.toFixed(2) || '0.00'}
                              className="vector-input"
                              readOnly
                            />
                            <Input
                              type="number"
                              placeholder="Z"
                              value={meshInfo.rotation?.z?.toFixed(2) || '0.00'}
                              className="vector-input"
                              readOnly
                            />
                          </div>
                        </div>

                        {/* Scale */}
                        <div className="control-group">
                          <label className="control-label">Scale</label>
                          <div className="vector-inputs">
                            <Input
                              type="number"
                              placeholder="X"
                              value={meshInfo.scaling?.x?.toFixed(2) || '1.00'}
                              className="vector-input"
                              readOnly
                            />
                            <Input
                              type="number"
                              placeholder="Y"
                              value={meshInfo.scaling?.y?.toFixed(2) || '1.00'}
                              className="vector-input"
                              readOnly
                            />
                            <Input
                              type="number"
                              placeholder="Z"
                              value={meshInfo.scaling?.z?.toFixed(2) || '1.00'}
                              className="vector-input"
                              readOnly
                            />
                          </div>
                        </div>
                      </motion.div>

                      <Separator />

                      {/* Quick Actions */}
                      <motion.div
                        className="quick-actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <Button variant="outline" size="sm" className="action-button">
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </Button>
                        <Button variant="outline" size="sm" className="action-button">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Material
                        </Button>
                        <Button variant="outline" size="sm" className="action-button">
                          <Trash className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </motion.div>

                      <Separator />

                      {/* Material & Lighting Sub-Controls */}
                      <motion.div
                        className="sub-controls"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <h4 className="section-title">Material & Lighting</h4>
                        <div className="control-buttons">
                          <Button variant="outline" size="sm" className="sub-control-button">
                            <Palette className="w-4 h-4 mr-2" />
                            Material Picker
                          </Button>
                          <Button variant="outline" size="sm" className="sub-control-button">
                            <Sun className="w-4 h-4 mr-2" />
                            Lighting Adjust
                          </Button>
                          <Button variant="outline" size="sm" className="sub-control-button">
                            <Zap className="w-4 h-4 mr-2" />
                            Physics Toggle
                          </Button>
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="inspector-empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardContent className="p-6 text-center text-gray-500">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No object selected</p>
                        <p className="text-sm">Click on an object in the scene to inspect it</p>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* Scene Tab */}
          <TabsContent value="scene" className="right-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Scene Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="scene-stats">
                  <div className="stat-row">
                    <span className="stat-label">Meshes:</span>
                    <Badge variant="secondary">{sceneStats.meshes}</Badge>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Materials:</span>
                    <Badge variant="secondary">{sceneStats.materials}</Badge>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Lights:</span>
                    <Badge variant="secondary">{sceneStats.lights}</Badge>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Cameras:</span>
                    <Badge variant="secondary">{sceneStats.cameras}</Badge>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Textures:</span>
                    <Badge variant="secondary">{sceneStats.textures}</Badge>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Particles:</span>
                    <Badge variant="secondary">{sceneStats.particles}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="scene-actions">
                  <Button variant="outline" size="sm" className="scene-action-button" onClick={onSceneImport}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Scene
                  </Button>
                  <Button variant="outline" size="sm" className="scene-action-button" onClick={onSceneExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Scene
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="right-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* FPS */}
                <div className="metric-group">
                  <div className="metric-row">
                    <span className="metric-label">FPS:</span>
                    <span className="metric-value">{performanceMetrics.fps}</span>
                  </div>
                  <Progress value={(performanceMetrics.fps / 60) * 100} className="metric-progress" />
                </div>

                {/* Frame Time */}
                <div className="metric-group">
                  <div className="metric-row">
                    <span className="metric-label">Frame Time:</span>
                    <span className="metric-value">{performanceMetrics.frameTime.toFixed(1)}ms</span>
                  </div>
                  <Progress value={Math.min((performanceMetrics.frameTime / 33.33) * 100, 100)} className="metric-progress" />
                </div>

                {/* Draw Calls */}
                <div className="metric-group">
                  <div className="metric-row">
                    <span className="metric-label">Draw Calls:</span>
                    <span className="metric-value">{performanceMetrics.drawCalls}</span>
                  </div>
                  <Progress value={Math.min((performanceMetrics.drawCalls / 1000) * 100, 100)} className="metric-progress" />
                </div>

                {/* Triangles */}
                <div className="metric-group">
                  <div className="metric-row">
                    <span className="metric-label">Triangles:</span>
                    <span className="metric-value">{performanceMetrics.triangles.toLocaleString()}</span>
                  </div>
                  <Progress value={Math.min((performanceMetrics.triangles / 100000) * 100, 100)} className="metric-progress" />
                </div>

                <Separator />

                {/* System Info */}
                <div className="system-info">
                  <div className="info-row">
                    <HardDrive className="w-4 h-4" />
                    <span>Memory: {performanceMetrics.memoryUsage}</span>
                  </div>
                  <div className="info-row">
                    <Monitor className="w-4 h-4" />
                    <span>GPU Memory: {performanceMetrics.gpuMemory}</span>
                  </div>
                  <div className="info-row">
                    <Cpu className="w-4 h-4" />
                    <span>CPU Usage: 45%</span>
                  </div>
                  <div className="info-row">
                    <Thermometer className="w-4 h-4" />
                    <span>GPU Temp: 65°C</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Materials Tab */}
          <TabsContent value="materials" className="right-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Materials</CardTitle>
              </CardHeader>
              <CardContent>
                {state.materials && state.materials.length > 0 ? (
                  <div className="materials-list">
                    {state.materials.map((material, index) => (
                      <div key={index} className="material-item">
                        <div className="material-info">
                          <div className="material-name">{material.name || `Material ${index + 1}`}</div>
                          <div className="material-type">{material.constructor?.name || 'Unknown'}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="material-edit-button"
                          onClick={() => onMaterialEdit && onMaterialEdit(material.id || index.toString())}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No materials found</p>
                    <p className="text-sm">Materials will appear here when loaded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BIM Tab */}
          <TabsContent value="bim" className="right-panel-tab-content">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">BIM Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bim-actions">
                  <Button variant="outline" size="sm" className="bim-action-button" onClick={importBIM}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import BIM Model
                  </Button>
                  <Button variant="outline" size="sm" className="bim-action-button" onClick={() => {}}>
                    <Eye className="w-4 h-4 mr-2" />
                    Toggle Hidden Details
                  </Button>
                  <Button variant="outline" size="sm" className="bim-action-button" onClick={toggleClashDetection}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Clash Detection
                  </Button>
                  <Button variant="outline" size="sm" className="bim-action-button" onClick={toggleWallPeeling}>
                    <Layers className="w-4 h-4 mr-2" />
                    Wall Peeling Mode
                  </Button>
                  <Button variant="outline" size="sm" className="bim-action-button" onClick={showCostEstimation}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Cost Estimate
                  </Button>
                </div>

                <Separator />

                {/* Cost Estimator Display */}
                {state.activeFeatures.has('costEstimation') && state.scene && (
                  <div className="cost-estimator-section">
                    <CostEstimatorWrapper
                      scene={state.scene}
                      selectedMesh={selectedMesh}
                      onCostUpdate={(totalCost: number, breakdown: any) => {
                        // Update cost estimate in workspace state
                        dispatch({ type: 'SET_COST_ESTIMATE', payload: totalCost });
                      }}
                    />
                  </div>
                )}

                <Separator />

                <div className="bim-info">
                  <div className="info-row">
                    <span className="info-label">BIM Models:</span>
                    <span className="info-value">{state.bimModels?.length || 0}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Clashes Detected:</span>
                    <span className="info-value">{state.clashCount || 0}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Cost Estimate:</span>
                    <span className="info-value">${state.costEstimate?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </motion.div>
  );
}

// Material Inspector Component
interface MaterialInspectorProps {
  material: any;
  onPropertyChange?: (property: string, value: any) => void;
  onSave?: () => void;
  onReset?: () => void;
}

export function MaterialInspector({
  material,
  onPropertyChange,
  onSave,
  onReset
}: MaterialInspectorProps) {
  if (!material) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No material selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Material Inspector</CardTitle>
        <div className="material-header-actions">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="material-info">
          <div className="info-row">
            <span className="info-label">Name:</span>
            <Input
              value={material.name || 'Unnamed'}
              onChange={(e) => onPropertyChange && onPropertyChange('name', e.target.value)}
              className="info-input"
            />
          </div>
          <div className="info-row">
            <span className="info-label">Type:</span>
            <span className="info-value">{material.constructor?.name || 'Unknown'}</span>
          </div>
        </div>

        <Separator />

        {/* Material properties would go here based on material type */}
        <div className="material-properties">
          <p className="text-sm text-gray-500">Material properties editor would be implemented here based on material type.</p>
        </div>
      </CardContent>
    </Card>
  );
}
