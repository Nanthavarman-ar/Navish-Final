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
import { Vector3, Color3 } from '@babylonjs/core';
import {
  Sun,
  Lightbulb,
  Zap,
  Moon,
  Star,
  Target,
  Settings,
  Plus,
  Trash2,
  Copy,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Palette,
  Sliders,
  Volume2,
  VolumeX,
  Power,
  PowerOff,
  Layers,
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
  Move3D
} from 'lucide-react';
import './LightingControls.css';

interface LightingControlsProps {
  onLightAdd?: (lightType: LightType, position: Vector3) => void;
  onLightRemove?: (lightId: string) => void;
  onLightUpdate?: (lightId: string, properties: LightProperties) => void;
  onEnvironmentChange?: (environment: EnvironmentSettings) => void;
}

export type LightType = 'directional' | 'point' | 'spot' | 'hemispheric';

export interface LightProperties {
  id: string;
  type: LightType;
  position: Vector3;
  direction?: Vector3;
  intensity: number;
  color: Color3;
  range?: number;
  angle?: number;
  exponent?: number;
  shadowEnabled: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
  enabled: boolean;
}

export interface EnvironmentSettings {
  skybox: boolean;
  skyboxTexture?: string;
  ground: boolean;
  groundTexture?: string;
  fog: boolean;
  fogColor: Color3;
  fogDensity: number;
  fogStart: number;
  fogEnd: number;
  ambientColor: Color3;
  ambientIntensity: number;
  reflectionTexture?: string;
  refractionTexture?: string;
}

const LIGHT_PRESETS = {
  directional: {
    name: 'Directional Light',
    icon: Sun,
    description: 'Simulates sunlight or moonlight',
    defaultProperties: {
      intensity: 1.0,
      color: new Color3(1, 1, 1),
      shadowEnabled: true,
      shadowQuality: 'medium' as const
    }
  },
  point: {
    name: 'Point Light',
    icon: Lightbulb,
    description: 'Emits light in all directions from a point',
    defaultProperties: {
      intensity: 1.0,
      color: new Color3(1, 1, 0.8),
      range: 10,
      shadowEnabled: false,
      shadowQuality: 'low' as const
    }
  },
  spot: {
    name: 'Spot Light',
    icon: Zap,
    description: 'Emits light in a cone shape',
    defaultProperties: {
      intensity: 1.0,
      color: new Color3(1, 1, 1),
      range: 10,
      angle: Math.PI / 4,
      exponent: 2,
      shadowEnabled: true,
      shadowQuality: 'medium' as const
    }
  },
  hemispheric: {
    name: 'Hemispheric Light',
    icon: Moon,
    description: 'Simulates ambient lighting from above and below',
    defaultProperties: {
      intensity: 0.5,
      color: new Color3(0.8, 0.9, 1),
      shadowEnabled: false,
      shadowQuality: 'low' as const
    }
  }
};

export function LightingControls({
  onLightAdd,
  onLightRemove,
  onLightUpdate,
  onEnvironmentChange
}: LightingControlsProps) {
  const { state } = useWorkspace();
  const [activeTab, setActiveTab] = useState('lights');
  const [selectedLight, setSelectedLight] = useState<string | null>(null);
  const [lights, setLights] = useState<LightProperties[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentSettings>({
    skybox: false,
    ground: false,
    fog: false,
    fogColor: new Color3(0.5, 0.5, 0.5),
    fogDensity: 0.01,
    fogStart: 10,
    fogEnd: 100,
    ambientColor: new Color3(0.2, 0.2, 0.2),
    ambientIntensity: 0.3
  });

  // Get lights from scene
  useEffect(() => {
    if (state.scene) {
      const sceneLights = state.scene.lights?.map((light, index) => {
        // Determine light type based on constructor name
        const type = light.constructor.name.toLowerCase().includes('directional') ? 'directional' :
                    light.constructor.name.toLowerCase().includes('point') ? 'point' :
                    light.constructor.name.toLowerCase().includes('spot') ? 'spot' : 'hemispheric';

        return {
          id: light.name || `light-${index}`,
          type: type as LightType,
          position: (light as any).position || new Vector3(0, 0, 0),
          direction: (light as any).direction,
          intensity: light.intensity || 1,
          color: light.diffuse || new Color3(1, 1, 1),
          range: (light as any).range,
          angle: (light as any).angle,
          exponent: (light as any).exponent,
          shadowEnabled: false, // Default for now
          shadowQuality: 'medium' as const,
          enabled: light.isEnabled()
        };
      }) || [];
      setLights(sceneLights);
    }
  }, [state.scene]);

  // Handle light type selection
  const handleAddLight = useCallback((lightType: LightType) => {
    const preset = LIGHT_PRESETS[lightType];
    const newLight: LightProperties = {
      id: `${lightType}-${Date.now()}`,
      type: lightType,
      position: new Vector3(0, 5, 0),
      intensity: preset.defaultProperties.intensity,
      color: preset.defaultProperties.color,
      shadowEnabled: preset.defaultProperties.shadowEnabled,
      shadowQuality: preset.defaultProperties.shadowQuality,
      enabled: true
    };

    setLights(prev => [...prev, newLight]);
    onLightAdd?.(lightType, newLight.position);
  }, [onLightAdd]);

  // Handle light removal
  const handleRemoveLight = useCallback((lightId: string) => {
    setLights(prev => prev.filter(l => l.id !== lightId));
    setSelectedLight(null);
    onLightRemove?.(lightId);
  }, [onLightRemove]);

  // Handle light property update
  const handleLightUpdate = useCallback((lightId: string, properties: Partial<LightProperties>) => {
    setLights(prev => prev.map(light =>
      light.id === lightId ? { ...light, ...properties } : light
    ));
    onLightUpdate?.(lightId, properties as LightProperties);
  }, [onLightUpdate]);

  // Handle environment settings change
  const handleEnvironmentChange = useCallback((newEnvironment: Partial<EnvironmentSettings>) => {
    const updatedEnvironment = { ...environment, ...newEnvironment };
    setEnvironment(updatedEnvironment);
    onEnvironmentChange?.(updatedEnvironment);
  }, [environment, onEnvironmentChange]);

  // Toggle light visibility
  const toggleLight = useCallback((lightId: string) => {
    const light = lights.find(l => l.id === lightId);
    if (light) {
      handleLightUpdate(lightId, { enabled: !light.enabled });
    }
  }, [lights, handleLightUpdate]);

  // Duplicate light
  const duplicateLight = useCallback((lightId: string) => {
    const light = lights.find(l => l.id === lightId);
    if (light) {
      const newLight: LightProperties = {
        ...light,
        id: `${light.type}-${Date.now()}`,
        position: new Vector3(
          light.position.x + 2,
          light.position.y,
          light.position.z + 2
        )
      };
      setLights(prev => [...prev, newLight]);
    }
  }, [lights]);

  // Reset environment to default
  const resetEnvironment = useCallback(() => {
    setEnvironment({
      skybox: false,
      ground: false,
      fog: false,
      fogColor: new Color3(0.5, 0.5, 0.5),
      fogDensity: 0.01,
      fogStart: 10,
      fogEnd: 100,
      ambientColor: new Color3(0.2, 0.2, 0.2),
      ambientIntensity: 0.3
    });
  }, []);

  const selectedLightData = lights.find(l => l.id === selectedLight);

  return (
    <div className="lighting-controls">
      <div className="lighting-controls-header">
        <h3 className="lighting-controls-title">Lighting Controls</h3>
        <div className="lighting-controls-actions">
          <Button variant="ghost" size="sm" onClick={resetEnvironment}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="lighting-controls-tabs">
        <TabsList className="lighting-controls-tabs-list">
          <TabsTrigger value="lights">Lights</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="shadows">Shadows</TabsTrigger>
        </TabsList>

        <TabsContent value="lights" className="lighting-controls-tab-content">
          <div className="lights-section">
            <div className="lights-header">
              <h4 className="section-title">Add Light</h4>
              <div className="add-light-buttons">
                {Object.entries(LIGHT_PRESETS).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddLight(type as LightType)}
                      className="add-light-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="lights-list">
              <h4 className="section-title">Scene Lights ({lights.length})</h4>
              <ScrollArea className="lights-scroll-area">
                <div className="lights-grid">
                  {lights.map((light) => {
                    const preset = LIGHT_PRESETS[light.type];
                    const IconComponent = preset.icon;
                    return (
                      <Card
                        key={light.id}
                        className={`light-card ${selectedLight === light.id ? 'selected' : ''}`}
                        onClick={() => setSelectedLight(light.id)}
                      >
                        <CardContent className="light-content">
                          <div className="light-header">
                            <div className="light-info">
                              <IconComponent className="w-4 h-4" />
                              <span className="light-name">{light.id}</span>
                            </div>
                            <div className="light-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLight(light.id);
                                }}
                              >
                                {light.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateLight(light.id);
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveLight(light.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="light-properties">
                            <div className="property-row">
                              <span className="property-label">Intensity</span>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={light.intensity}
                                onChange={(e) => handleLightUpdate(light.id, { intensity: parseFloat(e.target.value) })}
                                className="property-input"
                              />
                            </div>
                            <div className="property-row">
                              <span className="property-label">Color</span>
                              <div className="color-picker">
                                <input
                                  type="color"
                                  value={light.color.toHexString()}
                                  onChange={(e) => handleLightUpdate(light.id, { color: Color3.FromHexString(e.target.value) })}
                                />
                              </div>
                            </div>
                            {light.range && (
                              <div className="property-row">
                                <span className="property-label">Range</span>
                                <Input
                                  type="number"
                                  min="0.1"
                                  max="100"
                                  step="0.1"
                                  value={light.range}
                                  onChange={(e) => handleLightUpdate(light.id, { range: parseFloat(e.target.value) })}
                                  className="property-input"
                                />
                              </div>
                            )}
                            {light.angle && (
                              <div className="property-row">
                                <span className="property-label">Angle</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max={Math.PI}
                                  step="0.01"
                                  value={light.angle}
                                  onChange={(e) => handleLightUpdate(light.id, { angle: parseFloat(e.target.value) })}
                                  className="property-input"
                                />
                              </div>
                            )}
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

        <TabsContent value="environment" className="lighting-controls-tab-content">
          <ScrollArea className="environment-scroll-area">
            <div className="environment-section">
              <h4 className="section-title">Sky & Ground</h4>
              <div className="environment-group">
                <div className="environment-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={environment.skybox}
                      onChange={(e) => handleEnvironmentChange({ skybox: e.target.checked })}
                    />
                    Enable Skybox
                  </label>
                  {environment.skybox && (
                    <Input
                      placeholder="Skybox texture URL"
                      value={environment.skyboxTexture || ''}
                      onChange={(e) => handleEnvironmentChange({ skyboxTexture: e.target.value })}
                    />
                  )}
                </div>
                <div className="environment-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={environment.ground}
                      onChange={(e) => handleEnvironmentChange({ ground: e.target.checked })}
                    />
                    Enable Ground
                  </label>
                  {environment.ground && (
                    <Input
                      placeholder="Ground texture URL"
                      value={environment.groundTexture || ''}
                      onChange={(e) => handleEnvironmentChange({ groundTexture: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="environment-section">
              <h4 className="section-title">Fog Settings</h4>
              <div className="environment-group">
                <div className="environment-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={environment.fog}
                      onChange={(e) => handleEnvironmentChange({ fog: e.target.checked })}
                    />
                    Enable Fog
                  </label>
                </div>
                {environment.fog && (
                  <>
                    <div className="environment-item">
                      <label>Fog Color</label>
                      <div className="color-picker">
                        <input
                          type="color"
                          value={environment.fogColor.toHexString()}
                          onChange={(e) => handleEnvironmentChange({ fogColor: Color3.FromHexString(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="environment-item">
                      <label>Fog Density</label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={environment.fogDensity}
                        onChange={(e) => handleEnvironmentChange({ fogDensity: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="environment-item">
                      <label>Fog Start</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={environment.fogStart}
                        onChange={(e) => handleEnvironmentChange({ fogStart: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="environment-item">
                      <label>Fog End</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={environment.fogEnd}
                        onChange={(e) => handleEnvironmentChange({ fogEnd: parseFloat(e.target.value) })}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="environment-section">
              <h4 className="section-title">Ambient Lighting</h4>
              <div className="environment-group">
                <div className="environment-item">
                  <label>Ambient Color</label>
                  <div className="color-picker">
                    <input
                      type="color"
                      value={environment.ambientColor.toHexString()}
                      onChange={(e) => handleEnvironmentChange({ ambientColor: Color3.FromHexString(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="environment-item">
                  <label>Ambient Intensity</label>
                  <Input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={environment.ambientIntensity}
                    onChange={(e) => handleEnvironmentChange({ ambientIntensity: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="environment-section">
              <h4 className="section-title">Reflection & Refraction</h4>
              <div className="environment-group">
                <div className="environment-item">
                  <label>Reflection Texture</label>
                  <Input
                    placeholder="Reflection texture URL"
                    value={environment.reflectionTexture || ''}
                    onChange={(e) => handleEnvironmentChange({ reflectionTexture: e.target.value })}
                  />
                </div>
                <div className="environment-item">
                  <label>Refraction Texture</label>
                  <Input
                    placeholder="Refraction texture URL"
                    value={environment.refractionTexture || ''}
                    onChange={(e) => handleEnvironmentChange({ refractionTexture: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="shadows" className="lighting-controls-tab-content">
          <div className="shadows-section">
            <h4 className="section-title">Shadow Settings</h4>
            <div className="shadows-info">
              <p className="shadows-description">
                Configure shadow quality and performance settings for all lights in the scene.
              </p>
            </div>

            <div className="shadows-group">
              <div className="shadows-item">
                <label className="shadows-label">Global Shadow Quality</label>
                <div className="shadows-controls">
                  <Button variant="outline" size="sm">Low</Button>
                  <Button variant="outline" size="sm">Medium</Button>
                  <Button variant="default" size="sm">High</Button>
                  <Button variant="outline" size="sm">Ultra</Button>
                </div>
              </div>

              <div className="shadows-item">
                <label className="shadows-label">Shadow Map Size</label>
                <div className="shadows-controls">
                  <Button variant="outline" size="sm">512</Button>
                  <Button variant="outline" size="sm">1024</Button>
                  <Button variant="default" size="sm">2048</Button>
                  <Button variant="outline" size="sm">4096</Button>
                </div>
              </div>

              <div className="shadows-item">
                <label className="shadows-label">Shadow Bias</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.001"
                  defaultValue="0.001"
                  className="shadows-input"
                />
              </div>

              <div className="shadows-item">
                <label className="shadows-label">Shadow Darkness</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  defaultValue="0.5"
                  className="shadows-input"
                />
              </div>
            </div>

            <div className="shadows-presets">
              <h5 className="shadows-presets-title">Shadow Presets</h5>
              <div className="shadows-presets-grid">
                <Button variant="outline" size="sm" className="shadows-preset">
                  Performance
                </Button>
                <Button variant="outline" size="sm" className="shadows-preset">
                  Balanced
                </Button>
                <Button variant="default" size="sm" className="shadows-preset">
                  Quality
                </Button>
                <Button variant="outline" size="sm" className="shadows-preset">
                  Ultra
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
