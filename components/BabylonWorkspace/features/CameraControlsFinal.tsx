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
import { Vector3 } from '@babylonjs/core';
import {
  Camera,
  RotateCcw,
  Move3D,
  Eye,
  Target,
  Settings,
  Bookmark,
  Copy,
  Trash2,
  Plus,
  Save,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Navigation,
  MapPin,
  Globe,
  Orbit,
  User,
  Gamepad2,
  Monitor,
  Sun,
  Moon,
  Star,
  Home,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  FlipHorizontal,
  FlipVertical,
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
  Volume2,
  VolumeX,
  Mic,
  MicOff
} from 'lucide-react';
import './CameraControls.css';

interface CameraControlsProps {
  onCameraChange?: (cameraType: string) => void;
  onPositionChange?: (position: Vector3) => void;
  onRotationChange?: (rotation: Vector3) => void;
  onSettingsChange?: (settings: CameraSettings) => void;
}

export interface CameraSettings {
  fov: number;
  nearClip: number;
  farClip: number;
  exposure: number;
  sensitivity: number;
  smoothing: number;
  autoExposure: boolean;
  hdr: boolean;
  bloom: boolean;
  vignette: boolean;
  chromaticAberration: boolean;
  filmGrain: boolean;
  motionBlur: boolean;
  depthOfField: boolean;
}

export interface CameraPreset {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  type: 'orbit' | 'free' | 'first-person';
  description: string;
}

const DEFAULT_PRESETS: CameraPreset[] = [
  {
    id: 'default',
    name: 'Default View',
    position: { x: 0, y: 5, z: 10 },
    rotation: { x: 0, y: 0, z: 0 },
    fov: 75,
    type: 'orbit',
    description: 'Standard isometric view'
  },
  {
    id: 'top',
    name: 'Top View',
    position: { x: 0, y: 20, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    fov: 75,
    type: 'orbit',
    description: 'Direct top-down view'
  },
  {
    id: 'front',
    name: 'Front View',
    position: { x: 0, y: 0, z: 10 },
    rotation: { x: 0, y: 0, z: 0 },
    fov: 75,
    type: 'orbit',
    description: 'Front-facing view'
  },
  {
    id: 'side',
    name: 'Side View',
    position: { x: 10, y: 0, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    fov: 75,
    type: 'orbit',
    description: 'Side profile view'
  },
  {
    id: 'isometric',
    name: 'Isometric',
    position: { x: 10, y: 10, z: 10 },
    rotation: { x: -Math.PI / 6, y: Math.PI / 4, z: 0 },
    fov: 75,
    type: 'orbit',
    description: 'Isometric projection view'
  }
];

export function CameraControls({
  onCameraChange,
  onPositionChange,
  onRotationChange,
  onSettingsChange
}: CameraControlsProps) {
  const { state } = useWorkspace();
  const [activeTab, setActiveTab] = useState('controls');
  const [selectedPreset, setSelectedPreset] = useState<string>('default');
  const [customPresets, setCustomPresets] = useState<CameraPreset[]>([]);
  const [settings, setSettings] = useState<CameraSettings>({
    fov: 75,
    nearClip: 0.1,
    farClip: 1000,
    exposure: 1.0,
    sensitivity: 1.0,
    smoothing: 0.5,
    autoExposure: true,
    hdr: false,
    bloom: false,
    vignette: false,
    chromaticAberration: false,
    filmGrain: false,
    motionBlur: false,
    depthOfField: false
  });

  // Get current camera position and rotation
  const currentPosition = state.scene?.activeCamera?.position || { x: 0, y: 0, z: 0 };
  const currentRotation = { x: 0, y: 0, z: 0 }; // Default rotation since camera doesn't expose rotation directly

  // Handle camera type change
  const handleCameraTypeChange = useCallback((type: 'orbit' | 'free' | 'first-person') => {
    onCameraChange?.(type);
  }, [onCameraChange]);

  // Handle position change
  const handlePositionChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    const newPosition = { ...currentPosition, [axis]: value };
    onPositionChange?.(newPosition as Vector3);
  }, [currentPosition, onPositionChange]);

  // Handle rotation change
  const handleRotationChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    const newRotation = { ...currentRotation, [axis]: value };
    onRotationChange?.(newRotation as Vector3);
  }, [currentRotation, onRotationChange]);

  // Handle preset selection
  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = [...DEFAULT_PRESETS, ...customPresets].find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      onPositionChange?.(preset.position as Vector3);
      onRotationChange?.(preset.rotation as Vector3);
      setSettings(prev => ({ ...prev, fov: preset.fov }));
    }
  }, [customPresets, onPositionChange, onRotationChange]);

  // Handle settings change
  const handleSettingsChange = useCallback((newSettings: Partial<CameraSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    onSettingsChange?.(updatedSettings);
  }, [settings, onSettingsChange]);

  // Save current camera as preset
  const saveCurrentAsPreset = useCallback(() => {
    const newPreset: CameraPreset = {
      id: `custom-${Date.now()}`,
      name: `Custom ${customPresets.length + 1}`,
      position: currentPosition,
      rotation: currentRotation,
      fov: settings.fov,
      type: 'orbit', // Default to orbit for now
      description: 'Custom camera preset'
    };

    setCustomPresets(prev => [...prev, newPreset]);
  }, [currentPosition, currentRotation, settings.fov, customPresets.length]);

  // Delete custom preset
  const deletePreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
    if (selectedPreset === presetId) {
      setSelectedPreset('default');
    }
  }, [selectedPreset]);

  // Reset camera to default
  const resetCamera = useCallback(() => {
    handlePresetSelect('default');
  }, [handlePresetSelect]);

  // Quick camera movements
  const moveCamera = useCallback((direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down', distance: number = 1) => {
    const moveVector = { x: 0, y: 0, z: 0 };
    switch (direction) {
      case 'forward': moveVector.z = -distance; break;
      case 'backward': moveVector.z = distance; break;
      case 'left': moveVector.x = -distance; break;
      case 'right': moveVector.x = distance; break;
      case 'up': moveVector.y = distance; break;
      case 'down': moveVector.y = -distance; break;
    }
    onPositionChange?.({
      x: currentPosition.x + moveVector.x,
      y: currentPosition.y + moveVector.y,
      z: currentPosition.z + moveVector.z
    } as Vector3);
  }, [currentPosition, onPositionChange]);

  return (
    <div className="camera-controls">
      <div className="camera-controls-header">
        <h3 className="camera-controls-title">Camera Controls</h3>
        <div className="camera-controls-actions">
          <Button variant="ghost" size="sm" onClick={resetCamera}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={saveCurrentAsPreset}>
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="camera-controls-tabs">
        <TabsList className="camera-controls-tabs-list">
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="position">Position</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="camera-controls-tab-content">
          <div className="camera-controls-section">
            <h4 className="section-title">Camera Type</h4>
            <div className="camera-type-buttons">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCameraTypeChange('orbit')}
                className="camera-type-button"
              >
                <Orbit className="w-4 h-4 mr-2" />
                Orbit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCameraTypeChange('free')}
                className="camera-type-button"
              >
                <Move3D className="w-4 h-4 mr-2" />
                Free
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCameraTypeChange('first-person')}
                className="camera-type-button"
              >
                <User className="w-4 h-4 mr-2" />
                First Person
              </Button>
            </div>
          </div>

          <div className="camera-controls-section">
            <h4 className="section-title">Quick Movement</h4>
            <div className="movement-controls">
              <div className="movement-row">
                <Button variant="outline" size="sm" onClick={() => moveCamera('forward')}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
              </div>
              <div className="movement-row">
                <Button variant="outline" size="sm" onClick={() => moveCamera('left')}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveCamera('up')}>
                  <ArrowUp className="w-4 h-4 rotate-90" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveCamera('down')}>
                  <ArrowDown className="w-4 h-4 rotate-90" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveCamera('right')}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="movement-row">
                <Button variant="outline" size="sm" onClick={() => moveCamera('backward')}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="camera-controls-section">
            <h4 className="section-title">Rotation</h4>
            <div className="rotation-controls">
              <Button variant="outline" size="sm" onClick={() => handleRotationChange('y', currentRotation.y + 0.1)}>
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRotationChange('x', currentRotation.x + 0.1)}>
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRotationChange('y', currentRotation.y - 0.1)}>
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="position" className="camera-controls-tab-content">
          <div className="position-controls">
            <div className="position-group">
              <label className="position-label">Position</label>
              <div className="position-inputs">
                <div className="position-input">
                  <label>X</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={currentPosition.x}
                    onChange={(e) => handlePositionChange('x', parseFloat(e.target.value))}
                  />
                </div>
                <div className="position-input">
                  <label>Y</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={currentPosition.y}
                    onChange={(e) => handlePositionChange('y', parseFloat(e.target.value))}
                  />
                </div>
                <div className="position-input">
                  <label>Z</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={currentPosition.z}
                    onChange={(e) => handlePositionChange('z', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="position-group">
              <label className="position-label">Rotation</label>
              <div className="position-inputs">
                <div className="position-input">
                  <label>X</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentRotation.x}
                    onChange={(e) => handleRotationChange('x', parseFloat(e.target.value))}
                  />
                </div>
                <div className="position-input">
                  <label>Y</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentRotation.y}
                    onChange={(e) => handleRotationChange('y', parseFloat(e.target.value))}
                  />
                </div>
                <div className="position-input">
                  <label>Z</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentRotation.z}
                    onChange={(e) => handleRotationChange('z', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="camera-controls-tab-content">
          <ScrollArea className="settings-scroll-area">
            <div className="settings-section">
              <h4 className="section-title">Basic Settings</h4>
              <div className="setting-group">
                <div className="setting-item">
                  <label>Field of View</label>
                  <div className="setting-control">
                    <Input
                      type="number"
                      min="1"
                      max="180"
                      value={settings.fov}
                      onChange={(e) => handleSettingsChange({ fov: parseFloat(e.target.value) })}
                    />
                    <span className="setting-unit">°</span>
                  </div>
                </div>
                <div className="setting-item">
                  <label>Near Clip</label>
                  <div className="setting-control">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={settings.nearClip}
                      onChange={(e) => handleSettingsChange({ nearClip: parseFloat(e.target.value) })}
                    />
                    <span className="setting-unit">m</span>
                  </div>
                </div>
                <div className="setting-item">
                  <label>Far Clip</label>
                  <div className="setting-control">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={settings.farClip}
                      onChange={(e) => handleSettingsChange({ farClip: parseFloat(e.target.value) })}
                    />
                    <span className="setting-unit">m</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="section-title">Advanced Settings</h4>
              <div className="setting-group">
                <div className="setting-item">
                  <label>Exposure</label>
                  <div className="setting-control">
                    <Input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={settings.exposure}
                      onChange={(e) => handleSettingsChange({ exposure: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="setting-item">
                  <label>Sensitivity</label>
                  <div className="setting-control">
                    <Input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={settings.sensitivity}
                      onChange={(e) => handleSettingsChange({ sensitivity: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="setting-item">
                  <label>Smoothing</label>
                  <div className="setting-control">
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.smoothing}
                      onChange={(e) => handleSettingsChange({ smoothing: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="section-title">Post Effects</h4>
              <div className="setting-group">
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.autoExposure}
                      onChange={(e) => handleSettingsChange({ autoExposure: e.target.checked })}
                    />
                    Auto Exposure
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.hdr}
                      onChange={(e) => handleSettingsChange({ hdr: e.target.checked })}
                    />
                    HDR
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.bloom}
                      onChange={(e) => handleSettingsChange({ bloom: e.target.checked })}
                    />
                    Bloom
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.vignette}
                      onChange={(e) => handleSettingsChange({ vignette: e.target.checked })}
                    />
                    Vignette
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.chromaticAberration}
                      onChange={(e) => handleSettingsChange({ chromaticAberration: e.target.checked })}
                    />
                    Chromatic Aberration
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.filmGrain}
                      onChange={(e) => handleSettingsChange({ filmGrain: e.target.checked })}
                    />
                    Film Grain
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.motionBlur}
                      onChange={(e) => handleSettingsChange({ motionBlur: e.target.checked })}
                    />
                    Motion Blur
                  </label>
                </div>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.depthOfField}
                      onChange={(e) => handleSettingsChange({ depthOfField: e.target.checked })}
                    />
                    Depth of Field
                  </label>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="presets" className="camera-controls-tab-content">
          <div className="presets-section">
            <div className="presets-header">
              <h4 className="section-title">Camera Presets</h4>
              <Button variant="outline" size="sm" onClick={saveCurrentAsPreset}>
                <Plus className="w-4 h-4 mr-2" />
                Save Current
              </Button>
            </div>

            <ScrollArea className="presets-list">
              <div className="presets-grid">
                {DEFAULT_PRESETS.map((preset) => (
                  <Card
                    key={preset.id}
                    className={`preset-card ${selectedPreset === preset.id ? 'selected' : ''}`}
                    onClick={() => handlePresetSelect(preset.id)}
                  >
                    <CardContent className="preset-content">
                      <div className="preset-info">
                        <h5 className="preset-name">{preset.name}</h5>
                        <p className="preset-description">{preset.description}</p>
                        <div className="preset-meta">
                          <Badge variant="secondary" className="preset-type">
                            {preset.type}
                          </Badge>
                          <span className="preset-fov">{preset.fov}°</span>
                        </div>
                      </div>
                      <div className="preset-position">
                        <div className="position-display">
                          <span>X: {preset.position.x.toFixed(1)}</span>
                          <span>Y: {preset.position.y.toFixed(1)}</span>
                          <span>Z: {preset.position.z.toFixed(1)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {customPresets.map((preset) => (
                  <Card
                    key={preset.id}
                    className={`preset-card ${selectedPreset === preset.id ? 'selected' : ''}`}
                    onClick={() => handlePresetSelect(preset.id)}
                  >
                    <CardContent className="preset-content">
                      <div className="preset-info">
                        <h5 className="preset-name">{preset.name}</h5>
                        <p className="preset-description">{preset.description}</p>
                        <div className="preset-meta">
                          <Badge variant="secondary" className="preset-type">
                            {preset.type}
                          </Badge>
                          <span className="preset-fov">{preset.fov}°</span>
                        </div>
                      </div>
                      <div className="preset-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePreset(preset.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
