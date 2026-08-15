import React, { useState, useCallback, useEffect } from 'react';
import { useWorkspace } from '../core/WorkspaceContext';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Separator } from '../../ui/separator';
import { ScrollArea } from '../../ui/scroll-area';
import { Progress } from '../../ui/progress';
import { Vector3, Color3, Texture } from '@babylonjs/core';
import {
  Palette,
  Layers,
  Image,
  Sparkles,
  Zap,
  Target,
  Settings,
  Plus,
  Trash2,
  Copy,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Sliders,
  Volume2,
  VolumeX,
  Power,
  PowerOff,
  Grid3X3,
  Ruler,
  Compass,
  Crosshair,
  Focus,
  Aperture,
  Timer,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Home,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize,
  Minimize,
  Navigation,
  MapPin,
  Globe,
  Orbit,
  User,
  Gamepad2,
  Monitor,
  Camera,
  Move3D,
  Sun,
  Moon,
  Star,
  Lightbulb,
  Droplets,
  Flame,
  Wind,
  Mountain,
  Waves,
  Leaf,
  Snowflake,
  Cloud,
  Rainbow,
  Gem,
  Diamond,
  Circle,
  Square as SquareIcon,
  Triangle,
  Hexagon
} from 'lucide-react';
import './MaterialControls.css';

interface MaterialControlsProps {
  onMaterialAdd?: (materialType: MaterialType) => void;
  onMaterialRemove?: (materialId: string) => void;
  onMaterialUpdate?: (materialId: string, properties: MaterialProperties) => void;
  onTextureAdd?: (textureUrl: string, textureType: TextureType) => void;
  onTextureRemove?: (textureId: string) => void;
}

export type MaterialType = 'standard' | 'pbr' | 'glass' | 'metal' | 'plastic' | 'wood' | 'fabric' | 'stone' | 'water' | 'fire' | 'ice' | 'custom';

export type TextureType = 'diffuse' | 'normal' | 'specular' | 'emissive' | 'ambient' | 'opacity' | 'bump' | 'reflection' | 'refraction';

export interface MaterialProperties {
  id: string;
  name: string;
  type: MaterialType;
  baseColor: Color3;
  metallic: number;
  roughness: number;
  emissiveColor: Color3;
  emissiveIntensity: number;
  opacity: number;
  transparent: boolean;
  alphaTest: number;
  backFaceCulling: boolean;
  wireframe: boolean;
  specularColor: Color3;
  specularPower: number;
  indexOfRefraction: number;
  reflectionTexture?: string;
  refractionTexture?: string;
  bumpTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  ambientTexture?: string;
  opacityTexture?: string;
  specularTexture?: string;
}

export interface TextureProperties {
  id: string;
  name: string;
  url: string;
  type: TextureType;
  uScale: number;
  vScale: number;
  uOffset: number;
  vOffset: number;
  rotation: number;
  hasAlpha: boolean;
  invertY: boolean;
  coordinatesMode: number;
  wrapU: number;
  wrapV: number;
}

const MATERIAL_PRESETS = {
  standard: {
    name: 'Standard',
    icon: Layers,
    description: 'Basic material with diffuse and specular',
    defaultProperties: {
      baseColor: new Color3(0.8, 0.8, 0.8),
      metallic: 0,
      roughness: 0.5,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 64,
      indexOfRefraction: 1.5
    }
  },
  pbr: {
    name: 'PBR Metallic',
    icon: Gem,
    description: 'Physically based rendering material',
    defaultProperties: {
      baseColor: new Color3(0.8, 0.8, 0.8),
      metallic: 0.8,
      roughness: 0.2,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 64,
      indexOfRefraction: 1.5
    }
  },
  glass: {
    name: 'Glass',
    icon: Droplets,
    description: 'Transparent glass-like material',
    defaultProperties: {
      baseColor: new Color3(0.9, 0.95, 1),
      metallic: 0,
      roughness: 0,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 0.1,
      transparent: true,
      alphaTest: 0,
      backFaceCulling: false,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 128,
      indexOfRefraction: 1.5
    }
  },
  metal: {
    name: 'Metal',
    icon: Diamond,
    description: 'Reflective metallic material',
    defaultProperties: {
      baseColor: new Color3(0.8, 0.8, 0.9),
      metallic: 1,
      roughness: 0.1,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 256,
      indexOfRefraction: 1.5
    }
  },
  plastic: {
    name: 'Plastic',
    icon: Circle,
    description: 'Smooth plastic material',
    defaultProperties: {
      baseColor: new Color3(0.9, 0.9, 0.9),
      metallic: 0,
      roughness: 0.3,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 32,
      indexOfRefraction: 1.5
    }
  },
  wood: {
    name: 'Wood',
    icon: Mountain,
    description: 'Wooden material with grain texture',
    defaultProperties: {
      baseColor: new Color3(0.6, 0.4, 0.2),
      metallic: 0,
      roughness: 0.8,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(0.3, 0.2, 0.1),
      specularPower: 16,
      indexOfRefraction: 1.5
    }
  },
  fabric: {
    name: 'Fabric',
    icon: Waves,
    description: 'Soft fabric material',
    defaultProperties: {
      baseColor: new Color3(0.7, 0.7, 0.8),
      metallic: 0,
      roughness: 0.9,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(0.1, 0.1, 0.1),
      specularPower: 8,
      indexOfRefraction: 1.5
    }
  },
  stone: {
    name: 'Stone',
    icon: SquareIcon,
    description: 'Rough stone material',
    defaultProperties: {
      baseColor: new Color3(0.5, 0.5, 0.5),
      metallic: 0,
      roughness: 1,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(0.2, 0.2, 0.2),
      specularPower: 4,
      indexOfRefraction: 1.5
    }
  },
  water: {
    name: 'Water',
    icon: Droplets,
    description: 'Transparent water material',
    defaultProperties: {
      baseColor: new Color3(0.2, 0.4, 0.8),
      metallic: 0,
      roughness: 0,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 0.3,
      transparent: true,
      alphaTest: 0,
      backFaceCulling: false,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 512,
      indexOfRefraction: 1.33
    }
  },
  fire: {
    name: 'Fire',
    icon: Flame,
    description: 'Emissive fire material',
    defaultProperties: {
      baseColor: new Color3(1, 0.5, 0),
      metallic: 0,
      roughness: 0,
      emissiveColor: new Color3(1, 0.3, 0),
      emissiveIntensity: 2,
      opacity: 0.8,
      transparent: true,
      alphaTest: 0,
      backFaceCulling: false,
      wireframe: false,
      specularColor: new Color3(1, 0.8, 0.6),
      specularPower: 32,
      indexOfRefraction: 1.5
    }
  },
  ice: {
    name: 'Ice',
    icon: Snowflake,
    description: 'Transparent ice material',
    defaultProperties: {
      baseColor: new Color3(0.8, 0.9, 1),
      metallic: 0,
      roughness: 0,
      emissiveColor: new Color3(0.1, 0.2, 0.3),
      emissiveIntensity: 0.5,
      opacity: 0.2,
      transparent: true,
      alphaTest: 0,
      backFaceCulling: false,
      wireframe: false,
      specularColor: new Color3(1, 1, 1),
      specularPower: 256,
      indexOfRefraction: 1.31
    }
  },
  custom: {
    name: 'Custom',
    icon: Settings,
    description: 'Fully customizable material',
    defaultProperties: {
      baseColor: new Color3(0.5, 0.5, 0.5),
      metallic: 0.5,
      roughness: 0.5,
      emissiveColor: new Color3(0, 0, 0),
      emissiveIntensity: 0,
      opacity: 1,
      transparent: false,
      alphaTest: 0,
      backFaceCulling: true,
      wireframe: false,
      specularColor: new Color3(0.5, 0.5, 0.5),
      specularPower: 64,
      indexOfRefraction: 1.5
    }
  }
};

export function MaterialControls({
  onMaterialAdd,
  onMaterialRemove,
  onMaterialUpdate,
  onTextureAdd,
  onTextureRemove
}: MaterialControlsProps) {
  const { state } = useWorkspace();
  const [activeTab, setActiveTab] = useState('materials');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialProperties[]>([]);
  const [textures, setTextures] = useState<TextureProperties[]>([]);
  const [selectedTexture, setSelectedTexture] = useState<string | null>(null);

  // Initialize with default materials
  useEffect(() => {
    const defaultMaterials: MaterialProperties[] = Object.entries(MATERIAL_PRESETS).map(([type, preset]) => ({
      id: `${type}-default`,
      name: preset.name,
      type: type as MaterialType,
      ...preset.defaultProperties
    }));
    setMaterials(defaultMaterials);
  }, []);

  // Handle material type selection
  const handleAddMaterial = useCallback((materialType: MaterialType) => {
    const preset = MATERIAL_PRESETS[materialType];
    const newMaterial: MaterialProperties = {
      id: `${materialType}-${Date.now()}`,
      name: `${preset.name} ${materials.length + 1}`,
      type: materialType,
      ...preset.defaultProperties
    };

    setMaterials(prev => [...prev, newMaterial]);
    onMaterialAdd?.(materialType);
  }, [materials.length, onMaterialAdd]);

  // Handle material removal
  const handleRemoveMaterial = useCallback((materialId: string) => {
    setMaterials(prev => prev.filter(m => m.id !== materialId));
    setSelectedMaterial(null);
    onMaterialRemove?.(materialId);
  }, [onMaterialRemove]);

  // Handle material property update
  const handleMaterialUpdate = useCallback((materialId: string, properties: Partial<MaterialProperties>) => {
    setMaterials(prev => prev.map(material =>
      material.id === materialId ? { ...material, ...properties } : material
    ));
    onMaterialUpdate?.(materialId, properties as MaterialProperties);
  }, [onMaterialUpdate]);

  // Handle texture addition
  const handleAddTexture = useCallback((textureType: TextureType) => {
    const newTexture: TextureProperties = {
      id: `${textureType}-${Date.now()}`,
      name: `${textureType} texture`,
      url: '',
      type: textureType,
      uScale: 1,
      vScale: 1,
      uOffset: 0,
      vOffset: 0,
      rotation: 0,
      hasAlpha: false,
      invertY: false,
      coordinatesMode: 0,
      wrapU: 0,
      wrapV: 0
    };

    setTextures(prev => [...prev, newTexture]);
  }, []);

  // Handle texture removal
  const handleRemoveTexture = useCallback((textureId: string) => {
    setTextures(prev => prev.filter(t => t.id !== textureId));
    setSelectedTexture(null);
    onTextureRemove?.(textureId);
  }, [onTextureRemove]);

  // Handle texture property update
  const handleTextureUpdate = useCallback((textureId: string, properties: Partial<TextureProperties>) => {
    setTextures(prev => prev.map(texture =>
      texture.id === textureId ? { ...texture, ...properties } : texture
    ));
  }, []);

  // Duplicate material
  const duplicateMaterial = useCallback((materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      const newMaterial: MaterialProperties = {
        ...material,
        id: `${material.type}-${Date.now()}`,
        name: `${material.name} Copy`
      };
      setMaterials(prev => [...prev, newMaterial]);
    }
  }, [materials]);

  // Reset material to preset defaults
  const resetMaterial = useCallback((materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      const preset = MATERIAL_PRESETS[material.type];
      handleMaterialUpdate(materialId, preset.defaultProperties);
    }
  }, [materials, handleMaterialUpdate]);

  const selectedMaterialData = materials.find(m => m.id === selectedMaterial);
  const selectedTextureData = textures.find(t => t.id === selectedTexture);

  return (
    <div className="material-controls">
      <div className="material-controls-header">
        <h3 className="material-controls-title">Material Controls</h3>
        <div className="material-controls-actions">
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="material-controls-tabs">
        <TabsList className="material-controls-tabs-list">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="textures">Textures</TabsTrigger>
          <TabsTrigger value="shaders">Shaders</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="material-controls-tab-content">
          <div className="materials-section">
            <div className="materials-header">
              <h4 className="section-title">Add Material</h4>
              <div className="add-material-buttons">
                {Object.entries(MATERIAL_PRESETS).slice(0, 8).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMaterial(type as MaterialType)}
                      className="add-material-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
              <div className="add-material-buttons">
                {Object.entries(MATERIAL_PRESETS).slice(8).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddMaterial(type as MaterialType)}
                      className="add-material-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="materials-list">
              <h4 className="section-title">Scene Materials ({materials.length})</h4>
              <ScrollArea className="materials-scroll-area">
                <div className="materials-grid">
                  {materials.map((material) => {
                    const preset = MATERIAL_PRESETS[material.type];
                    const IconComponent = preset.icon;
                    return (
                      <Card
                        key={material.id}
                        className={`material-card ${selectedMaterial === material.id ? 'selected' : ''}`}
                        onClick={() => setSelectedMaterial(material.id)}
                      >
                        <CardContent className="material-content">
                          <div className="material-header">
                            <div className="material-info">
                              <IconComponent className="w-4 h-4" />
                              <span className="material-name">{material.name}</span>
                              <Badge variant="secondary" className="material-type">
                                {material.type}
                              </Badge>
                            </div>
                            <div className="material-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetMaterial(material.id);
                                }}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateMaterial(material.id);
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveMaterial(material.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="material-preview">
                            <div
                              className="material-color"
                              style={{
                                backgroundColor: `rgb(${material.baseColor.r * 255}, ${material.baseColor.g * 255}, ${material.baseColor.b * 255})`
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="textures" className="material-controls-tab-content">
          <div className="textures-section">
            <div className="textures-header">
              <h4 className="section-title">Add Texture</h4>
              <div className="add-texture-buttons">
                {(['diffuse', 'normal', 'specular', 'emissive', 'ambient', 'opacity', 'bump', 'reflection', 'refraction'] as TextureType[]).map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddTexture(type)}
                    className="add-texture-button"
                    title={`${type} texture`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="textures-list">
              <h4 className="section-title">Scene Textures ({textures.length})</h4>
              <ScrollArea className="textures-scroll-area">
                <div className="textures-grid">
                  {textures.map((texture) => (
                    <Card
                      key={texture.id}
                      className={`texture-card ${selectedTexture === texture.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTexture(texture.id)}
                    >
                      <CardContent className="texture-content">
                        <div className="texture-header">
                          <div className="texture-info">
                            <span className="texture-name">{texture.name}</span>
                            <Badge variant="secondary" className="texture-type">
                              {texture.type}
                            </Badge>
                          </div>
                          <div className="texture-actions">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTexture(texture.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="texture-properties">
                          <div className="texture-property">
                            <label>URL</label>
                            <Input
                              placeholder="Texture URL"
                              value={texture.url}
                              onChange={(e) => handleTextureUpdate(texture.id, { url: e.target.value })}
                            />
                          </div>
                          <div className="texture-property">
                            <label>U Scale</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={texture.uScale}
                              onChange={(e) => handleTextureUpdate(texture.id, { uScale: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div className="texture-property">
                            <label>V Scale</label>
                            <Input
                              type="number"
                              step="0.1"
                              value={texture.vScale}
                              onChange={(e) => handleTextureUpdate(texture.id, { vScale: parseFloat(e.target.value) })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shaders" className="material-controls-tab-content">
          <div className="shaders-section">
            <h4 className="section-title">Shader Editor</h4>
            <div className="shaders-info">
              <p className="shaders-description">
                Advanced shader customization for custom materials.
              </p>
            </div>

            <div className="shaders-content">
              <div className="shader-editor">
                <div className="shader-tabs">
                  <Button variant="outline" size="sm" className="shader-tab">Vertex</Button>
                  <Button variant="outline" size="sm" className="shader-tab">Fragment</Button>
                  <Button variant="outline" size="sm" className="shader-tab">Geometry</Button>
                </div>
                <div className="shader-code">
                  <textarea
                    placeholder="Enter your shader code here..."
                    className="shader-textarea"
                    defaultValue={`// Vertex Shader
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 worldViewProjection;
uniform mat4 world;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vPosition = (world * vec4(position, 1.0)).xyz;
  vNormal = normalize((world * vec4(normal, 0.0)).xyz);
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`}
                  />
                </div>
              </div>

              <div className="shader-controls">
                <div className="shader-control-group">
                  <label className="shader-label">Shader Language</label>
                  <div className="shader-options">
                    <Button variant="outline" size="sm">GLSL</Button>
                    <Button variant="outline" size="sm">HLSL</Button>
                    <Button variant="outline" size="sm">WGSL</Button>
                  </div>
                </div>

                <div className="shader-control-group">
                  <label className="shader-label">Compile</label>
                  <Button variant="default" size="sm" className="compile-button">
                    <Play className="w-4 h-4 mr-2" />
                    Compile Shader
                  </Button>
                </div>

                <div className="shader-control-group">
                  <label className="shader-label">Presets</label>
                  <div className="shader-presets">
                    <Button variant="outline" size="sm">Basic</Button>
                    <Button variant="outline" size="sm">PBR</Button>
                    <Button variant="outline" size="sm">Toon</Button>
                    <Button variant="outline" size="sm">Custom</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
