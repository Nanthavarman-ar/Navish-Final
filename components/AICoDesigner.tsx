import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import {
  Palette,
  Sparkles,
  Wand2,
  Lightbulb,
  CheckCircle,
  XCircle,
  Info,
  Zap,
  Target,
  Layers,
  Move3D,
  RotateCcw,
  Download,
  Upload,
  Settings,
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw,
  Star,
  Heart,
  ThumbsUp
} from 'lucide-react';
import { Scene, Mesh, Vector3, Material, PBRMaterial, StandardMaterial, Color3, HighlightLayer, DynamicTexture, Texture } from '@babylonjs/core';

interface DesignSuggestion {
  id: string;
  type: 'layout' | 'material' | 'color' | 'structure' | 'optimization' | 'aesthetic';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  category: 'functional' | 'aesthetic' | 'performance';
  beforeState?: any;
  afterState?: any;
  affectedMeshes: string[];
  estimatedTime: number; // in seconds
}

interface DesignMetrics {
  aestheticScore: number;
  functionalityScore: number;
  efficiencyScore: number;
  overallScore: number;
  suggestionsApplied: number;
  totalSuggestions: number;
}

interface AICoDesignerProps {
  scene: Scene;
  isActive: boolean;
  onClose: () => void;
  onSuggestionApply?: (suggestion: DesignSuggestion) => void;
  onDesignUpdate?: (metrics: DesignMetrics) => void;
  // The mesh the user has selected in the workspace - "ask about this area"
  // answers are grounded in real space around this point (or the scene
  // center if nothing is selected), not a generic canned response.
  selectedMesh?: Mesh | null;
}

const AICoDesigner: React.FC<AICoDesignerProps> = ({
  scene,
  isActive,
  onClose,
  onSuggestionApply,
  onDesignUpdate,
  selectedMesh
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<DesignSuggestion[]>([]);
  const [metrics, setMetrics] = useState<DesignMetrics | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<DesignSuggestion | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  const [designHistory, setDesignHistory] = useState<DesignSuggestion[][]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [areaQuestion, setAreaQuestion] = useState('');
  const [areaAnswer, setAreaAnswer] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // AI Design Analysis Engine
  const performDesignAnalysis = useCallback(async (): Promise<DesignSuggestion[]> => {
    const results: DesignSuggestion[] = [];

    // Filter for actual Mesh instances, not AbstractMesh
    const meshes = scene.meshes.filter((mesh): mesh is Mesh => {
      return mesh instanceof Mesh &&
             mesh.name !== null &&
             typeof mesh.name === 'string' &&
             !mesh.name.includes('ground');
    });

    setAnalysisProgress(0);

    // Analyze each mesh for design improvements
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      setAnalysisProgress((i / meshes.length) * 100);

      // Layout optimization suggestions
      const layoutSuggestions = analyzeLayout(mesh, meshes);
      results.push(...layoutSuggestions);

      // Material improvement suggestions
      const materialSuggestions = analyzeMaterials(mesh);
      results.push(...materialSuggestions);

      // Color harmony suggestions
      const colorSuggestions = analyzeColors(mesh, meshes);
      results.push(...colorSuggestions);

      // Structural optimization suggestions
      const structureSuggestions = analyzeStructure(mesh);
      results.push(...structureSuggestions);

      // Aesthetic enhancement suggestions
      const aestheticSuggestions = analyzeAesthetics(mesh, meshes);
      results.push(...aestheticSuggestions);

      // Performance optimization suggestions
      const performanceSuggestions = analyzePerformance(mesh);
      results.push(...performanceSuggestions);

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }, [scene]);

  const analyzeLayout = (mesh: Mesh, allMeshes: Mesh[]): DesignSuggestion[] => {
    const suggestions: DesignSuggestion[] = [];
    const meshPosition = mesh.position;
    const meshBoundingInfo = mesh.getBoundingInfo();
    const meshSize = meshBoundingInfo.boundingBox.maximum.subtract(meshBoundingInfo.boundingBox.minimum);

    // Check for overlapping meshes
    const overlappingMeshes = allMeshes.filter(m =>
      m !== mesh &&
      m.position.subtract(meshPosition).length() < (meshSize.length() + m.getBoundingInfo().boundingBox.maximum.subtract(m.getBoundingInfo().boundingBox.minimum).length()) / 4
    );

    if (overlappingMeshes.length > 0) {
      suggestions.push({
        id: `layout-overlap-${mesh.name}-${Date.now()}`,
        type: 'layout',
        title: 'Resolve Mesh Overlap',
        description: `Mesh "${mesh.name}" overlaps with ${overlappingMeshes.length} other mesh(es). Consider repositioning for better spatial organization.`,
        confidence: 0.85,
        impact: 'medium',
        category: 'functional',
        affectedMeshes: [mesh.name, ...overlappingMeshes.map(m => m.name)],
        estimatedTime: 30
      });
    }

    // Check for isolated meshes
    const nearbyMeshes = allMeshes.filter(m =>
      m !== mesh &&
      m.position.subtract(meshPosition).length() < 5
    );

    if (nearbyMeshes.length === 0) {
      suggestions.push({
        id: `layout-isolation-${mesh.name}-${Date.now()}`,
        type: 'layout',
        title: 'Improve Spatial Grouping',
        description: `Mesh "${mesh.name}" appears isolated. Consider grouping with related elements for better visual hierarchy.`,
        confidence: 0.7,
        impact: 'low',
        category: 'aesthetic',
        affectedMeshes: [mesh.name],
        estimatedTime: 45
      });
    }

    // Check for alignment opportunities
    const alignedMeshes = allMeshes.filter(m =>
      m !== mesh &&
      (Math.abs(m.position.x - meshPosition.x) < 0.1 ||
       Math.abs(m.position.y - meshPosition.y) < 0.1 ||
       Math.abs(m.position.z - meshPosition.z) < 0.1)
    );

    if (alignedMeshes.length > 2) {
      suggestions.push({
        id: `layout-alignment-${mesh.name}-${Date.now()}`,
        type: 'layout',
        title: 'Enhance Alignment',
        description: `Mesh "${mesh.name}" is part of an alignment group with ${alignedMeshes.length} other meshes. Consider refining alignment for precision.`,
        confidence: 0.6,
        impact: 'low',
        category: 'aesthetic',
        affectedMeshes: [mesh.name, ...alignedMeshes.map(m => m.name)],
        estimatedTime: 20
      });
    }

    return suggestions;
  };

  const analyzeMaterials = (mesh: Mesh): DesignSuggestion[] => {
    const suggestions: DesignSuggestion[] = [];
    const material = mesh.material;

    if (!material) {
      suggestions.push({
        id: `material-missing-${mesh.name}-${Date.now()}`,
        type: 'material',
        title: 'Add Material Properties',
        description: `Mesh "${mesh.name}" lacks material definition. Adding appropriate materials will enhance visual appeal and realism.`,
        confidence: 0.9,
        impact: 'high',
        category: 'aesthetic',
        affectedMeshes: [mesh.name],
        estimatedTime: 60
      });
      return suggestions;
    }

    // Check for basic materials that could be enhanced
    if (material instanceof StandardMaterial) {
      suggestions.push({
        id: `material-upgrade-${mesh.name}-${Date.now()}`,
        type: 'material',
        title: 'Upgrade to PBR Material',
        description: `Mesh "${mesh.name}" uses basic StandardMaterial. Upgrading to PBR material will provide more realistic lighting and reflections.`,
        confidence: 0.8,
        impact: 'medium',
        category: 'aesthetic',
        affectedMeshes: [mesh.name],
        estimatedTime: 90
      });
    }

    // Check for material complexity
    if (material instanceof PBRMaterial) {
      const hasTextures = material.albedoTexture || material.bumpTexture || material.metallicTexture;
      if (!hasTextures) {
        suggestions.push({
          id: `material-textures-${mesh.name}-${Date.now()}`,
          type: 'material',
          title: 'Add Texture Details',
          description: `PBR material on "${mesh.name}" lacks texture maps. Adding albedo, bump, or metallic textures will enhance surface detail.`,
          confidence: 0.75,
          impact: 'medium',
          category: 'aesthetic',
          affectedMeshes: [mesh.name],
          estimatedTime: 120
        });
      }
    }

    return suggestions;
  };

  const analyzeColors = (mesh: Mesh, allMeshes: Mesh[]): DesignSuggestion[] => {
    const suggestions: DesignSuggestion[] = [];

    if (!mesh.material) return suggestions;

    // Extract dominant colors from materials
    let meshColor = new Color3(0.5, 0.5, 0.5);
    if (mesh.material instanceof StandardMaterial) {
      meshColor = mesh.material.diffuseColor || new Color3(0.5, 0.5, 0.5);
    } else if (mesh.material instanceof PBRMaterial) {
      meshColor = mesh.material.albedoColor || new Color3(0.5, 0.5, 0.5);
    }

    // Check for color harmony with nearby meshes
    const nearbyMeshes = allMeshes.filter(m =>
      m !== mesh &&
      m.position.subtract(mesh.position).length() < 3
    );

    let colorHarmonyScore = 0;
    nearbyMeshes.forEach(nearbyMesh => {
      if (nearbyMesh.material) {
        let nearbyColor = new Color3(0.5, 0.5, 0.5);
        if (nearbyMesh.material instanceof StandardMaterial) {
          nearbyColor = nearbyMesh.material.diffuseColor || new Color3(0.5, 0.5, 0.5);
        } else if (nearbyMesh.material instanceof PBRMaterial) {
          nearbyColor = nearbyMesh.material.albedoColor || new Color3(0.5, 0.5, 0.5);
        }

        const colorDistance = Math.sqrt(
          Math.pow(meshColor.r - nearbyColor.r, 2) +
          Math.pow(meshColor.g - nearbyColor.g, 2) +
          Math.pow(meshColor.b - nearbyColor.b, 2)
        );

        colorHarmonyScore += Math.max(0, 1 - colorDistance);
      }
    });

    colorHarmonyScore = colorHarmonyScore / Math.max(1, nearbyMeshes.length);

    if (colorHarmonyScore < 0.3) {
      suggestions.push({
        id: `color-harmony-${mesh.name}-${Date.now()}`,
        type: 'color',
        title: 'Improve Color Harmony',
        description: `Colors in "${mesh.name}" and nearby meshes lack harmony. Consider using complementary or analogous color schemes.`,
        confidence: 0.7,
        impact: 'medium',
        category: 'aesthetic',
        affectedMeshes: [mesh.name, ...nearbyMeshes.map(m => m.name)],
        estimatedTime: 45
      });
    }

    // Check for overly bright or dark colors
    const brightness = (meshColor.r + meshColor.g + meshColor.b) / 3;
    if (brightness > 0.9) {
      suggestions.push({
        id: `color-brightness-${mesh.name}-${Date.now()}`,
        type: 'color',
        title: 'Adjust Color Brightness',
        description: `Mesh "${mesh.name}" uses very bright colors that may cause visual fatigue. Consider slightly desaturated tones.`,
        confidence: 0.6,
        impact: 'low',
        category: 'aesthetic',
        affectedMeshes: [mesh.name],
        estimatedTime: 15
      });
    }

    return suggestions;
  };

  const analyzeStructure = (mesh: Mesh): DesignSuggestion[] => {
    const suggestions: DesignSuggestion[] = [];
    const boundingInfo = mesh.getBoundingInfo();
    const dimensions = boundingInfo.boundingBox.maximum.subtract(boundingInfo.boundingBox.minimum);

    // Check for extreme aspect ratios
    const aspectRatios = [dimensions.x / dimensions.y, dimensions.x / dimensions.z, dimensions.y / dimensions.z];
    const maxAspectRatio = Math.max(...aspectRatios);

    if (maxAspectRatio > 10) {
      suggestions.push({
        id: `structure-ratio-${mesh.name}-${Date.now()}`,
        type: 'structure',
        title: 'Optimize Proportions',
        description: `Mesh "${mesh.name}" has extreme proportions (${maxAspectRatio.toFixed(1)}:1 ratio). Consider more balanced dimensions.`,
        confidence: 0.8,
        impact: 'medium',
        category: 'functional',
        affectedMeshes: [mesh.name],
        estimatedTime: 60
      });
    }

    // Check for thin structures that might need reinforcement
    const minDimension = Math.min(dimensions.x, dimensions.y, dimensions.z);
    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);

    if (minDimension / maxDimension < 0.1 && maxDimension > 2) {
      suggestions.push({
        id: `structure-thin-${mesh.name}-${Date.now()}`,
        type: 'structure',
        title: 'Add Structural Support',
        description: `Mesh "${mesh.name}" has very thin sections that may need structural reinforcement for stability.`,
        confidence: 0.75,
        impact: 'high',
        category: 'functional',
        affectedMeshes: [mesh.name],
        estimatedTime: 120
      });
    }

    return suggestions;
  };

  const analyzeAesthetics = (mesh: Mesh, allMeshes: Mesh[]): DesignSuggestion[] => {
    const suggestions: DesignSuggestion[] = [];

    // Check for visual balance
    const meshPosition = mesh.position;
    const sceneCenter = allMeshes.reduce((center, m) => {
      center.x += m.position.x;
      center.y += m.position.y;
      center.z += m.position.z;
      return center;
    }, new Vector3(0, 0, 0));

    sceneCenter.x /= allMeshes.length;
    sceneCenter.y /= allMeshes.length;
    sceneCenter.z /= allMeshes.length;

    const distanceFromCenter = meshPosition.subtract(sceneCenter).length();

    if (distanceFromCenter > 5) {
      suggestions.push({
        id: `aesthetic-balance-${mesh.name}-${Date.now()}`,
        type: 'aesthetic',
        title: 'Improve Visual Balance',
        description: `Mesh "${mesh.name}" is positioned far from the scene center, affecting visual balance. Consider repositioning.`,
        confidence: 0.65,
        impact: 'low',
        category: 'aesthetic',
        affectedMeshes: [mesh.name],
        estimatedTime: 30
      });
    }

    // Check for visual hierarchy
    const meshSize = mesh.getBoundingInfo().boundingBox.maximum.subtract(mesh.getBoundingInfo().boundingBox.minimum).length();

    const similarSizedMeshes = allMeshes.filter(m =>
      m !== mesh &&
      Math.abs(m.getBoundingInfo().boundingBox.maximum.subtract(m.getBoundingInfo().boundingBox.minimum).length() - meshSize) / meshSize < 0.2
    );

    if (similarSizedMeshes.length > 3) {
      suggestions.push({
        id: `aesthetic-hierarchy-${mesh.name}-${Date.now()}`,
        type: 'aesthetic',
        title: 'Establish Visual Hierarchy',
        description: `Multiple meshes of similar size (${similarSizedMeshes.length + 1} total) create visual confusion. Consider varying sizes for better hierarchy.`,
        confidence: 0.7,
        impact: 'medium',
        category: 'aesthetic',
        affectedMeshes: [mesh.name, ...similarSizedMeshes.map(m => m.name)],
        estimatedTime: 90
      });
    }

    return suggestions;
  };

  const analyzePerformance = (mesh: Mesh): DesignSuggestion[] => {
    const suggestions: DesignSuggestion[] = [];

    // Check for high polygon count (simplified check based on mesh type)
    const vertexCount = mesh.getTotalVertices();
    if (vertexCount > 10000) {
      suggestions.push({
        id: `performance-polygons-${mesh.name}-${Date.now()}`,
        type: 'optimization',
        title: 'Optimize Mesh Geometry',
        description: `Mesh "${mesh.name}" has high polygon count (${vertexCount} vertices). Consider mesh simplification for better performance.`,
        confidence: 0.8,
        impact: 'high',
        category: 'performance',
        affectedMeshes: [mesh.name],
        estimatedTime: 180
      });
    }

    // Check for unnecessary materials
    if (mesh.material && mesh.material instanceof PBRMaterial) {
      const hasComplexTextures = mesh.material.albedoTexture || mesh.material.bumpTexture || mesh.material.metallicTexture;

      if (!hasComplexTextures && mesh.material.bumpTexture) {
        suggestions.push({
          id: `performance-material-${mesh.name}-${Date.now()}`,
          type: 'optimization',
          title: 'Simplify Material',
          description: `Mesh "${mesh.name}" uses PBR material without textures. Consider using StandardMaterial for better performance.`,
          confidence: 0.6,
          impact: 'low',
          category: 'performance',
          affectedMeshes: [mesh.name],
          estimatedTime: 30
        });
      }
    }

    return suggestions;
  };

  const calculateDesignMetrics = useCallback((suggestions: DesignSuggestion[], appliedCount: number): DesignMetrics => {
    const aestheticSuggestions = suggestions.filter(s => s.category === 'aesthetic');
    const functionalSuggestions = suggestions.filter(s => s.category === 'functional');
    const performanceSuggestions = suggestions.filter(s => s.category === 'performance');

    const aestheticScore = Math.max(0, 100 - (aestheticSuggestions.length * 15));
    const functionalityScore = Math.max(0, 100 - (functionalSuggestions.length * 20));
    const efficiencyScore = Math.max(0, 100 - (performanceSuggestions.length * 25));

    const overallScore = (aestheticScore + functionalityScore + efficiencyScore) / 3;
    const totalSuggestions = suggestions.length;

    return {
      aestheticScore,
      functionalityScore,
      efficiencyScore,
      overallScore,
      suggestionsApplied: appliedCount,
      totalSuggestions
    };
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!scene || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const results = await performDesignAnalysis();
      setSuggestions(results);
      const calculatedMetrics = calculateDesignMetrics(results, appliedSuggestions.length);
      setMetrics(calculatedMetrics);

      // Add to history
      setDesignHistory(prev => [results, ...prev.slice(0, 9)]); // Keep last 10 analyses

      if (onDesignUpdate) {
        onDesignUpdate(calculatedMetrics);
      }
    } catch (error) {
      console.error('Design analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [scene, isAnalyzing, performDesignAnalysis, calculateDesignMetrics, appliedSuggestions.length, onDesignUpdate]);

  const applySuggestion = useCallback(async (suggestion: DesignSuggestion) => {
    if (onSuggestionApply) {
      onSuggestionApply(suggestion);
    }

    // Mark as applied
    setAppliedSuggestions(prev => [...prev, suggestion.id]);

    // Visual feedback - highlight affected meshes
    suggestion.affectedMeshes.forEach(meshName => {
      const mesh = scene.getMeshByName(meshName);
      if (mesh && mesh instanceof Mesh) {
        // Create highlight layer if it doesn't exist
        let highlightLayer = scene.getHighlightLayerByName('design-highlight');
        if (!highlightLayer) {
          highlightLayer = new HighlightLayer('design-highlight', scene);
        }

        // Add highlight effect
        highlightLayer.addMesh(mesh, new Color3(0.5, 0.5, 1)); // Blue highlight
        setTimeout(() => {
          highlightLayer.removeMesh(mesh);
        }, 3000);
      }
    });

    // Update metrics
    if (metrics) {
      const updatedMetrics = calculateDesignMetrics(suggestions, appliedSuggestions.length + 1);
      setMetrics(updatedMetrics);

      if (onDesignUpdate) {
        onDesignUpdate(updatedMetrics);
      }
    }
  }, [scene, onSuggestionApply, metrics, suggestions, appliedSuggestions.length, calculateDesignMetrics, onDesignUpdate]);

  const generateDesign = useCallback(async () => {
    setIsGenerating(true);

    try {
      // Simulate AI design generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate a few high-impact suggestions
      const generatedSuggestions: DesignSuggestion[] = [
        {
          id: `generated-aesthetic-${Date.now()}`,
          type: 'aesthetic',
          title: 'AI-Generated Aesthetic Enhancement',
          description: 'Apply AI-curated color palette and material combination for enhanced visual appeal.',
          confidence: 0.9,
          impact: 'high',
          category: 'aesthetic',
          affectedMeshes: scene.meshes.filter(m => m instanceof Mesh && m.name && !m.name.includes('ground')).map(m => m.name || '').filter(Boolean),
          estimatedTime: 180
        },
        {
          id: `generated-layout-${Date.now()}`,
          type: 'layout',
          title: 'AI-Optimized Layout',
          description: 'Rearrange elements using AI-optimized spatial relationships and visual flow principles.',
          confidence: 0.85,
          impact: 'medium',
          category: 'functional',
          affectedMeshes: scene.meshes.filter(m => m instanceof Mesh && m.name && !m.name.includes('ground')).map(m => m.name || '').filter(Boolean),
          estimatedTime: 240
        }
      ];

      setSuggestions(prev => [...generatedSuggestions, ...prev]);
    } catch (error) {
      console.error('Design generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [scene]);

  // "What can I put in this area?" - grounded in the actual selected mesh's
  // surroundings (real open floor area, real nearby mesh names), not a fake
  // canned answer. There's no LLM configured in this app, so this matches
  // real keywords in the question against a curated suggestion set the same
  // way the app's voice commands already do, rather than pretending to be a
  // true conversational AI it can't honestly be without an API key.
  const AREA_SUGGESTIONS: { keywords: string[]; minArea: number; items: string[] }[] = [
    { keywords: ['seat', 'sit', 'lounge', 'sofa', 'living', 'relax'], minArea: 3, items: ['a two-seat sofa or bench', 'a low coffee table', 'a floor lamp for ambient lighting'] },
    { keywords: ['storage', 'shelf', 'shelving', 'cabinet', 'closet', 'organize'], minArea: 1, items: ['a slim wall-mounted shelving unit', 'a storage cabinet', 'built-in cubbies'] },
    { keywords: ['plant', 'green', 'nature', 'garden'], minArea: 0.5, items: ['a potted floor plant', 'a hanging planter', 'a small vertical garden panel'] },
    { keywords: ['light', 'lighting', 'lamp', 'bright'], minArea: 0.3, items: ['a pendant light fixture', 'a floor lamp', 'wall sconces'] },
    { keywords: ['table', 'desk', 'work', 'office', 'study'], minArea: 2, items: ['a compact desk or console table', 'a small dining table', 'bar-height counter seating'] },
    { keywords: ['decor', 'art', 'wall', 'display'], minArea: 0.2, items: ['wall art or a gallery wall', 'a decorative mirror', 'textured wall paneling'] },
    { keywords: ['kitchen', 'cook', 'dining'], minArea: 4, items: ['a kitchen island', 'an additional counter/cabinet run', 'a breakfast bar'] },
    { keywords: ['bedroom', 'bed', 'sleep', 'rest'], minArea: 6, items: ['a bed with nightstands', 'a wardrobe', 'a reading nook'] },
  ];

  const askAboutArea = useCallback(() => {
    const question = areaQuestion.trim();
    if (!question || !scene) return;
    setIsAnswering(true);
    setAreaAnswer(null);

    setTimeout(() => {
      const refPoint = selectedMesh?.position
        ?? scene.meshes.reduce((acc, m) => acc.add(m.position), Vector3.Zero()).scale(1 / Math.max(1, scene.meshes.length));

      const nearbyRadius = 4;
      const nearby = scene.meshes.filter((m): m is Mesh =>
        m instanceof Mesh && !!m.name && !m.name.includes('ground') && m !== selectedMesh &&
        m.position.subtract(refPoint).length() > 0.01 && m.position.subtract(refPoint).length() < nearbyRadius
      );

      const circleArea = Math.PI * nearbyRadius * nearbyRadius;
      const occupied = nearby.reduce((sum, m) => {
        const bb = m.getBoundingInfo().boundingBox;
        const size = bb.maximum.subtract(bb.minimum);
        return sum + size.x * size.z;
      }, 0);
      const openArea = Math.max(0, circleArea - occupied);

      const lower = question.toLowerCase();
      const matched = AREA_SUGGESTIONS.filter(s => s.keywords.some(k => lower.includes(k)));
      const candidates = matched.length > 0 ? matched : AREA_SUGGESTIONS;
      const fitting = candidates.filter(s => openArea >= s.minArea);
      const pick = (fitting.length > 0 ? fitting : candidates).slice(0, 3);

      const nearbyNames = nearby.slice(0, 3).map(m => m.name).filter(Boolean);
      const locationDesc = selectedMesh ? `near "${selectedMesh.name}"` : 'around the scene center (select an object first to ask about a specific spot)';

      let answer = `Looking at the area ${locationDesc}: roughly ${openArea.toFixed(1)} m² of open space`;
      if (nearbyNames.length > 0) answer += `, next to ${nearbyNames.join(', ')}`;
      answer += '.\n\nSuggestions:\n';
      pick.forEach(s => {
        answer += `• ${s.items[Math.floor(Math.random() * s.items.length)]}\n`;
      });
      if (openArea < 1) {
        answer += `\nThis is a tight space (${openArea.toFixed(1)} m²) - favor slim, wall-mounted, or vertical elements over floor furniture.`;
      }

      setAreaAnswer(answer.trim());
      setIsAnswering(false);
    }, 500);
  }, [areaQuestion, scene, selectedMesh]);

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <Zap className="w-4 h-4 text-red-500" />;
      case 'medium': return <Target className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Layers className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'aesthetic': return <Palette className="w-4 h-4 text-purple-500" />;
      case 'functional': return <Target className="w-4 h-4 text-blue-500" />;
      case 'performance': return <Zap className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'layout': return 'bg-blue-500';
      case 'material': return 'bg-purple-500';
      case 'color': return 'bg-pink-500';
      case 'structure': return 'bg-orange-500';
      case 'optimization': return 'bg-green-500';
      case 'aesthetic': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  // Auto-run analysis when component becomes active
  useEffect(() => {
    if (isActive && suggestions.length === 0) {
      runAnalysis();
    }
  }, [isActive, suggestions.length, runAnalysis]);

  if (!isActive) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 w-[800px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-cyan-400" />
              AI Co-Designer
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={generateDesign}
                disabled={isGenerating}
                className="text-xs"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Generate
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Ask about a specific area */}
          <div className="p-3 bg-slate-800 rounded-lg space-y-2">
            <div className="text-xs text-slate-400">
              Ask about {selectedMesh ? <>the area near <strong className="text-slate-300">"{selectedMesh.name}"</strong></> : 'this space'} - e.g. "what can I put in this corner?"
            </div>
            <div className="flex gap-2">
              <Input
                value={areaQuestion}
                onChange={(e) => setAreaQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') askAboutArea(); }}
                placeholder="What should go here?"
                className="flex-1 text-sm bg-slate-900 border-slate-700"
              />
              <Button size="sm" onClick={askAboutArea} disabled={isAnswering || !areaQuestion.trim()}>
                {isAnswering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Ask'}
              </Button>
            </div>
            {areaAnswer && (
              <Alert className="p-3 whitespace-pre-line text-sm">
                <AlertDescription>{areaAnswer}</AlertDescription>
              </Alert>
            )}
          </div>

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
                  <Wand2 className="w-4 h-4 mr-2" />
                  Run Design Analysis
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="space-y-2">
              <Progress value={analysisProgress} className="w-full" />
              <p className="text-xs text-slate-400 text-center">
                Analyzing design elements... {Math.round(analysisProgress)}%
              </p>
            </div>
          )}

          {/* Design Metrics */}
          {metrics && (
            <div className="grid grid-cols-4 gap-2 p-3 bg-slate-800 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400">
                  {Math.round(metrics.aestheticScore)}%
                </div>
                <div className="text-xs text-slate-400">Aesthetic</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400">
                  {Math.round(metrics.functionalityScore)}%
                </div>
                <div className="text-xs text-slate-400">Functional</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">
                  {Math.round(metrics.efficiencyScore)}%
                </div>
                <div className="text-xs text-slate-400">Performance</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-400">
                  {Math.round(metrics.overallScore)}%
                </div>
                <div className="text-xs text-slate-400">Overall</div>
              </div>
            </div>
          )}

          {/* Design Suggestions */}
          {suggestions.length > 0 && (
            <Tabs defaultValue="suggestions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="suggestions" className="text-xs">
                  Suggestions ({suggestions.length})
                </TabsTrigger>
                <TabsTrigger value="metrics" className="text-xs">
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="suggestions" className="space-y-2">
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <Alert key={suggestion.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1">
                            {getImpactIcon(suggestion.impact)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${getTypeColor(suggestion.type)}`} />
                                <Badge variant="outline" className="text-xs">
                                  {suggestion.type.toUpperCase()}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {suggestion.category}
                                </Badge>
                                <span className="text-xs text-slate-400">
                                  {Math.round(suggestion.confidence * 100)}%
                                </span>
                              </div>
                              <AlertDescription className="text-sm mb-2">
                                <strong>{suggestion.title}</strong><br />
                                {suggestion.description}
                              </AlertDescription>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-slate-400">
                                  Impact: {suggestion.impact.toUpperCase()}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Est. time: {suggestion.estimatedTime}s
                                </span>
                                <span className="text-xs text-slate-400">
                                  Affects: {suggestion.affectedMeshes.length} mesh(es)
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applySuggestion(suggestion)}
                                disabled={appliedSuggestions.includes(suggestion.id)}
                                className="text-xs"
                              >
                                {appliedSuggestions.includes(suggestion.id) ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Applied
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="w-3 h-3 mr-1" />
                                    Apply Design
                                  </>
                                )}
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
                        <span className="text-sm">Aesthetic Score</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.aestheticScore)}%
                        </span>
                      </div>
                      <Progress value={metrics.aestheticScore} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Functionality Score</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.functionalityScore)}%
                        </span>
                      </div>
                      <Progress value={metrics.functionalityScore} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Performance Score</span>
                        <span className="text-sm font-mono">
                          {Math.round(metrics.efficiencyScore)}%
                        </span>
                      </div>
                      <Progress value={metrics.efficiencyScore} className="h-2" />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-slate-800 rounded">
                        <div className="text-2xl font-bold text-cyan-400">
                          {metrics.suggestionsApplied}
                        </div>
                        <div className="text-xs text-slate-400">Applied</div>
                      </div>
                      <div className="text-center p-3 bg-slate-800 rounded">
                        <div className="text-2xl font-bold text-purple-400">
                          {metrics.totalSuggestions}
                        </div>
                        <div className="text-xs text-slate-400">Total</div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-2">
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {designHistory.map((history, index) => (
                      <div key={index} className="p-2 bg-slate-800 rounded text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span>Analysis #{designHistory.length - index}</span>
                          <span className="text-slate-400">
                            {history.length} suggestions
                          </span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {history.slice(0, 5).map((suggestion, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {suggestion.type}
                            </Badge>
                          ))}
                          {history.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{history.length - 5}
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

          {/* No Suggestions Found */}
          {suggestions.length === 0 && !isAnalyzing && (
            <div className="text-center py-8">
              <Palette className="w-12 h-12 text-purple-500 mx-auto mb-3" />
              <p className="text-slate-400">No design suggestions available</p>
              <p className="text-xs text-slate-500 mt-1">
                Run analysis to discover design improvements
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AICoDesigner;
