import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  Settings,
  BarChart3
} from 'lucide-react';
import { Scene, Mesh, Vector3, Material, PBRMaterial, StandardMaterial, Color3, HighlightLayer } from '@babylonjs/core';

interface StructuralAnalysis {
  id: string;
  type: 'stress' | 'load' | 'stability' | 'material' | 'connection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: Vector3;
  description: string;
  recommendation: string;
  confidence: number;
  affectedMeshes: string[];
}

interface StructuralMetrics {
  overallStability: number;
  stressDistribution: number;
  loadCapacity: number;
  materialEfficiency: number;
  connectionIntegrity: number;
  safetyFactor: number;
}

interface AIStructuralAdvisorProps {
  scene: Scene;
  isActive: boolean;
  onClose: () => void;
  onAnalysisComplete?: (results: StructuralAnalysis[]) => void;
  onRecommendationApply?: (recommendation: StructuralAnalysis) => void;
}

const AIStructuralAdvisor: React.FC<AIStructuralAdvisorProps> = ({
  scene,
  isActive,
  onClose,
  onAnalysisComplete,
  onRecommendationApply
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analyses, setAnalyses] = useState<StructuralAnalysis[]>([]);
  const [metrics, setMetrics] = useState<StructuralMetrics | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<StructuralAnalysis | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<StructuralAnalysis[][]>([]);
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);

  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI Analysis Engine
  const performStructuralAnalysis = useCallback(async (): Promise<StructuralAnalysis[]> => {
    const results: StructuralAnalysis[] = [];
    // Filter for actual Mesh instances, not AbstractMesh
    const meshes = scene.meshes.filter((mesh): mesh is Mesh => {
      return mesh instanceof Mesh &&
             mesh.name !== null &&
             typeof mesh.name === 'string' &&
             !mesh.name.includes('ground');
    });

    // Analyze each mesh for structural issues
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      setAnalysisProgress((i / meshes.length) * 100);

      // Stress analysis based on mesh properties
      const stressAnalysis = analyzeStress(mesh);
      if (stressAnalysis) results.push(stressAnalysis);

      // Load bearing analysis
      const loadAnalysis = analyzeLoadBearing(mesh);
      if (loadAnalysis) results.push(loadAnalysis);

      // Material analysis
      const materialAnalysis = analyzeMaterial(mesh);
      if (materialAnalysis) results.push(materialAnalysis);

      // Connection analysis
      const connectionAnalysis = analyzeConnections(mesh);
      if (connectionAnalysis) results.push(connectionAnalysis);

      // Stability analysis
      const stabilityAnalysis = analyzeStability(mesh);
      if (stabilityAnalysis) results.push(stabilityAnalysis);

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }, [scene]);

  const analyzeStress = (mesh: Mesh): StructuralAnalysis | null => {
    const boundingInfo = mesh.getBoundingInfo();
    const dimensions = boundingInfo.boundingBox.maximum.subtract(boundingInfo.boundingBox.minimum);
    const volume = dimensions.x * dimensions.y * dimensions.z; // Calculate volume manually
    const surfaceArea = calculateSurfaceArea(mesh);
    const stressRatio = surfaceArea / volume;

    if (stressRatio > 10) {
      return {
        id: `stress-${mesh.name}-${Date.now()}`,
        type: 'stress',
        severity: stressRatio > 20 ? 'critical' : stressRatio > 15 ? 'high' : 'medium',
        location: mesh.position.clone(),
        description: `High stress concentration detected. Surface area to volume ratio: ${stressRatio.toFixed(2)}`,
        recommendation: 'Consider adding structural reinforcements or redistributing load.',
        confidence: Math.min(0.95, 1 - (stressRatio / 30)),
        affectedMeshes: [mesh.name]
      };
    }
    return null;
  };

  const analyzeLoadBearing = (mesh: Mesh): StructuralAnalysis | null => {
    const height = mesh.getBoundingInfo().boundingBox.maximum.y - mesh.getBoundingInfo().boundingBox.minimum.y;
    const baseArea = mesh.getBoundingInfo().boundingBox.maximum.x - mesh.getBoundingInfo().boundingBox.minimum.x;
    const aspectRatio = height / baseArea;

    if (aspectRatio > 5) {
      return {
        id: `load-${mesh.name}-${Date.now()}`,
        type: 'load',
        severity: aspectRatio > 10 ? 'critical' : aspectRatio > 7 ? 'high' : 'medium',
        location: mesh.position.clone(),
        description: `Unstable load-bearing structure. Height to base ratio: ${aspectRatio.toFixed(2)}`,
        recommendation: 'Add lateral supports or increase base dimensions for stability.',
        confidence: Math.min(0.9, 1 - (aspectRatio / 15)),
        affectedMeshes: [mesh.name]
      };
    }
    return null;
  };

  const analyzeMaterial = (mesh: Mesh): StructuralAnalysis | null => {
    const material = mesh.material;
    if (!material) return null;

    let materialStrength = 1.0;

    if (material instanceof PBRMaterial) {
      materialStrength = 0.8; // PBR materials might be decorative
    } else if (material instanceof StandardMaterial) {
      materialStrength = 0.9; // Standard materials are more structural
    }

    if (materialStrength < 0.85) {
      return {
        id: `material-${mesh.name}-${Date.now()}`,
        type: 'material',
        severity: materialStrength < 0.7 ? 'high' : 'medium',
        location: mesh.position.clone(),
        description: `Material may not be suitable for structural use. Strength factor: ${materialStrength.toFixed(2)}`,
        recommendation: 'Consider using structural-grade materials or adding reinforcements.',
        confidence: 0.85,
        affectedMeshes: [mesh.name]
      };
    }
    return null;
  };

  const analyzeConnections = (mesh: Mesh): StructuralAnalysis | null => {
    // Filter for actual Mesh instances, not AbstractMesh
    const connectedMeshes = scene.meshes.filter((m): m is Mesh =>
      m instanceof Mesh && m !== mesh && m.position.subtract(mesh.position).length() < 2
    );

    if (connectedMeshes.length === 0) {
      return {
        id: `connection-${mesh.name}-${Date.now()}`,
        type: 'connection',
        severity: 'medium',
        location: mesh.position.clone(),
        description: 'Isolated structural element detected. No nearby connections found.',
        recommendation: 'Connect to adjacent structural elements for load distribution.',
        confidence: 0.8,
        affectedMeshes: [mesh.name]
      };
    }
    return null;
  };

  const analyzeStability = (mesh: Mesh): StructuralAnalysis | null => {
    const boundingInfo = mesh.getBoundingInfo();
    const centerOfMass = boundingInfo.boundingBox.center;
    const baseCenter = new Vector3(centerOfMass.x, boundingInfo.boundingBox.minimum.y, centerOfMass.z);
    const offset = centerOfMass.subtract(baseCenter);

    if (offset.length() > 0.5) {
      return {
        id: `stability-${mesh.name}-${Date.now()}`,
        type: 'stability',
        severity: offset.length() > 1.0 ? 'high' : 'medium',
        location: mesh.position.clone(),
        description: `Center of mass offset detected. Offset distance: ${offset.length().toFixed(2)}`,
        recommendation: 'Redistribute mass or add counterweights to improve stability.',
        confidence: Math.min(0.9, 1 - (offset.length() / 2)),
        affectedMeshes: [mesh.name]
      };
    }
    return null;
  };

  const calculateSurfaceArea = (mesh: Mesh): number => {
    // Simplified surface area calculation
    const boundingInfo = mesh.getBoundingInfo();
    const dimensions = boundingInfo.boundingBox.maximum.subtract(boundingInfo.boundingBox.minimum);
    return 2 * (dimensions.x * dimensions.y + dimensions.x * dimensions.z + dimensions.y * dimensions.z);
  };

  const calculateOverallMetrics = useCallback((analyses: StructuralAnalysis[]): StructuralMetrics => {
    const criticalCount = analyses.filter(a => a.severity === 'critical').length;
    const highCount = analyses.filter(a => a.severity === 'high').length;
    const mediumCount = analyses.filter(a => a.severity === 'medium').length;
    const totalIssues = analyses.length;

    const overallStability = Math.max(0, 100 - (criticalCount * 30 + highCount * 20 + mediumCount * 10));
    const stressDistribution = Math.max(0, 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 8));
    const loadCapacity = Math.max(0, 100 - (criticalCount * 20 + highCount * 15 + mediumCount * 5));
    const materialEfficiency = Math.max(0, 100 - (criticalCount * 15 + highCount * 10 + mediumCount * 5));
    const connectionIntegrity = Math.max(0, 100 - (criticalCount * 10 + highCount * 8 + mediumCount * 3));

    const safetyFactor = overallStability > 80 ? 2.0 :
                        overallStability > 60 ? 1.5 :
                        overallStability > 40 ? 1.2 : 1.0;

    return {
      overallStability,
      stressDistribution,
      loadCapacity,
      materialEfficiency,
      connectionIntegrity,
      safetyFactor
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!scene || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const results = await performStructuralAnalysis();
      setAnalyses(results);
      const calculatedMetrics = calculateOverallMetrics(results);
      setMetrics(calculatedMetrics);

      // Add to history
      setAnalysisHistory(prev => [results, ...prev.slice(0, 9)]); // Keep last 10 analyses

      if (onAnalysisComplete) {
        onAnalysisComplete(results);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [scene, isAnalyzing, performStructuralAnalysis, calculateOverallMetrics, onAnalysisComplete]);

  const applyRecommendation = useCallback((analysis: StructuralAnalysis) => {
    if (onRecommendationApply) {
      onRecommendationApply(analysis);
    }

    // Visual feedback - highlight affected meshes
    analysis.affectedMeshes.forEach(meshName => {
      const mesh = scene.getMeshByName(meshName);
      if (mesh && mesh instanceof Mesh) {
        // Create highlight layer if it doesn't exist
        let highlightLayer = scene.getHighlightLayerByName('structural-highlight');
        if (!highlightLayer) {
          highlightLayer = new HighlightLayer('structural-highlight', scene);
        }

        // Add highlight effect
        highlightLayer.addMesh(mesh, new Color3(1, 0.5, 0));
        setTimeout(() => {
          highlightLayer.removeMesh(mesh);
        }, 3000);
      }
    });
  }, [scene, onRecommendationApply]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  // Real-time analysis mode
  useEffect(() => {
    if (isRealTimeMode && isActive) {
      analysisIntervalRef.current = setInterval(() => {
        runAnalysis();
      }, 10000); // Analyze every 10 seconds
    } else {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    }

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [isRealTimeMode, isActive, runAnalysis]);

  // Auto-run analysis when component becomes active
  useEffect(() => {
    if (isActive && analyses.length === 0) {
      runAnalysis();
    }
  }, [isActive, analyses.length, runAnalysis]);

  if (!isActive) return null;

  return (
    <div className="fixed top-4 right-4 w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-cyan-400" />
              AI Structural Advisor
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isRealTimeMode ? "default" : "outline"}
                onClick={() => setIsRealTimeMode(!isRealTimeMode)}
                className="text-xs"
              >
                <Activity className="w-3 h-3 mr-1" />
                Real-time
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Analysis Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="flex-1"
              size="sm"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="space-y-2">
              <Progress value={analysisProgress} className="w-full" />
              <p className="text-xs text-slate-400 text-center">
                Analyzing structural integrity... {Math.round(analysisProgress)}%
              </p>
            </div>
          )}

          {/* Overall Metrics */}
          {metrics && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-400">
                  {Math.round(metrics.overallStability)}%
                </div>
                <div className="text-xs text-slate-400">Stability</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">
                  {metrics.safetyFactor.toFixed(1)}x
                </div>
                <div className="text-xs text-slate-400">Safety Factor</div>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analyses.length > 0 && (
            <Tabs defaultValue="issues" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="issues" className="text-xs">
                  Issues ({analyses.length})
                </TabsTrigger>
                <TabsTrigger value="metrics" className="text-xs">
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="issues" className="space-y-2">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {analyses.map((analysis) => (
                      <Alert key={analysis.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1">
                            {getSeverityIcon(analysis.severity)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={getSeverityColor(analysis.severity)} className="text-xs">
                                  {analysis.severity.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-slate-400">
                                  {analysis.type}
                                </span>
                              </div>
                              <AlertDescription className="text-sm mb-2">
                                {analysis.description}
                              </AlertDescription>
                              <div className="text-xs text-slate-400 mb-2">
                                Confidence: {Math.round(analysis.confidence * 100)}%
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyRecommendation(analysis)}
                                className="text-xs"
                              >
                                Apply Fix
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Alert>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="metrics" className="space-y-3">
                {metrics && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Stress Distribution</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.stressDistribution)}%
                        </span>
                      </div>
                      <Progress value={metrics.stressDistribution} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Load Capacity</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.loadCapacity)}%
                        </span>
                      </div>
                      <Progress value={metrics.loadCapacity} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Material Efficiency</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.materialEfficiency)}%
                        </span>
                      </div>
                      <Progress value={metrics.materialEfficiency} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Connection Integrity</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.connectionIntegrity)}%
                        </span>
                      </div>
                      <Progress value={metrics.connectionIntegrity} className="h-2" />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-2">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {analysisHistory.map((history, index) => (
                      <div key={index} className="p-2 bg-slate-800 rounded text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span>Analysis #{analysisHistory.length - index}</span>
                          <span className="text-slate-400">
                            {history.length} issues
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {history.slice(0, 3).map((analysis, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {analysis.severity}
                            </Badge>
                          ))}
                          {history.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{history.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          {/* No Issues Found */}
          {analyses.length === 0 && !isAnalyzing && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-400">No structural issues detected</p>
              <p className="text-xs text-slate-500 mt-1">
                Run analysis to check for potential problems
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIStructuralAdvisor;
