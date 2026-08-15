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
  Box,
  Circle,
  Triangle,
  Square,
  Hexagon,
  Star,
  Heart,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  RotateCw,
  RotateCcw,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Settings,
  Plus,
  Save,
  Upload,
  Download,
  Grid3X3,
  Ruler,
  Compass,
  Crosshair,
  Focus,
  Aperture,
  Timer,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Home,
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
  Lightbulb,
  Palette,
  Layers,
  Image,
  Sparkles,
  Zap,
  Target,
  Sliders,
  Volume2,
  VolumeX,
  Power,
  PowerOff,
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
  Diamond
} from 'lucide-react';
import './ObjectControls.css';

interface ObjectControlsProps {
  onObjectAdd?: (objectType: ObjectType, position: Vector3) => void;
  onObjectRemove?: (objectId: string) => void;
  onObjectUpdate?: (objectId: string, properties: ObjectProperties) => void;
  onObjectSelect?: (objectId: string) => void;
  onGroupCreate?: (groupName: string, objectIds: string[]) => void;
  onGroupRemove?: (groupId: string) => void;
}

export type ObjectType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'plane'
  | 'torus'
  | 'capsule'
  | 'tetrahedron'
  | 'octahedron'
  | 'dodecahedron'
  | 'icosahedron'
  | 'custom';

export interface ObjectProperties {
  id: string;
  name: string;
  type: ObjectType;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  visible: boolean;
  locked: boolean;
  materialId?: string;
  color: Color3;
  opacity: number;
  wireframe: boolean;
  castShadows: boolean;
  receiveShadows: boolean;
  physicsEnabled: boolean;
  mass: number;
  friction: number;
  restitution: number;
  groupId?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ObjectGroup {
  id: string;
  name: string;
  objectIds: string[];
  color: Color3;
  visible: boolean;
  locked: boolean;
}

const OBJECT_PRESETS = {
  box: {
    name: 'Box',
    icon: Box,
    description: 'Rectangular prism',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  sphere: {
    name: 'Sphere',
    icon: Circle,
    description: 'Perfect sphere',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  cylinder: {
    name: 'Cylinder',
    icon: Circle,
    description: 'Cylindrical shape',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  cone: {
    name: 'Cone',
    icon: Triangle,
    description: 'Conical shape',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  plane: {
    name: 'Plane',
    icon: Square,
    description: 'Flat plane surface',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: false,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 0,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  torus: {
    name: 'Torus',
    icon: Circle,
    description: 'Donut-shaped ring',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  capsule: {
    name: 'Capsule',
    icon: Circle,
    description: 'Capsule shape',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  tetrahedron: {
    name: 'Tetrahedron',
    icon: Triangle,
    description: 'Four-sided pyramid',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  octahedron: {
    name: 'Octahedron',
    icon: Diamond,
    description: 'Eight-sided polyhedron',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  dodecahedron: {
    name: 'Dodecahedron',
    icon: Hexagon,
    description: 'Twelve-sided polyhedron',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  icosahedron: {
    name: 'Icosahedron',
    icon: Star,
    description: 'Twenty-sided polyhedron',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  },
  custom: {
    name: 'Custom',
    icon: Settings,
    description: 'Custom 3D model',
    defaultProperties: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      visible: true,
      locked: false,
      color: new Color3(0.8, 0.8, 0.8),
      opacity: 1,
      wireframe: false,
      castShadows: true,
      receiveShadows: true,
      physicsEnabled: false,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      tags: [],
      metadata: {}
    }
  }
};

export function ObjectControls({
  onObjectAdd,
  onObjectRemove,
  onObjectUpdate,
  onObjectSelect,
  onGroupCreate,
  onGroupRemove
}: ObjectControlsProps) {
  const { state } = useWorkspace();
  const [activeTab, setActiveTab] = useState('objects');
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [objects, setObjects] = useState<ObjectProperties[]>([]);
  const [groups, setGroups] = useState<ObjectGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get objects from scene
  useEffect(() => {
    if (state.scene) {
      const sceneObjects = state.scene.meshes?.map((mesh, index) => ({
        id: mesh.name || `object-${index}`,
        name: mesh.name || `Object ${index + 1}`,
        type: 'box' as ObjectType, // Default type for now
        position: mesh.position || new Vector3(0, 0, 0),
        rotation: mesh.rotation || new Vector3(0, 0, 0),
        scale: mesh.scaling || new Vector3(1, 1, 1),
        visible: mesh.isVisible,
        locked: false,
        color: new Color3(0.8, 0.8, 0.8),
        opacity: mesh.visibility || 1,
        wireframe: false,
        castShadows: true,
        receiveShadows: true,
        physicsEnabled: false,
        mass: 1,
        friction: 0.5,
        restitution: 0.3,
        tags: [],
        metadata: {}
      })) || [];
      setObjects(sceneObjects);
    }
  }, [state.scene]);

  // Handle object type selection
  const handleAddObject = useCallback((objectType: ObjectType) => {
    const preset = OBJECT_PRESETS[objectType];
    const newObject: ObjectProperties = {
      id: `${objectType}-${Date.now()}`,
      name: `${preset.name} ${objects.length + 1}`,
      type: objectType,
      ...preset.defaultProperties
    };

    setObjects(prev => [...prev, newObject]);
    onObjectAdd?.(objectType, newObject.position);
  }, [objects.length, onObjectAdd]);

  // Handle object removal
  const handleRemoveObject = useCallback((objectId: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    setSelectedObject(null);
    onObjectRemove?.(objectId);
  }, [onObjectRemove]);

  // Handle object property update
  const handleObjectUpdate = useCallback((objectId: string, properties: Partial<ObjectProperties>) => {
    setObjects(prev => prev.map(obj =>
      obj.id === objectId ? { ...obj, ...properties } : obj
    ));
    onObjectUpdate?.(objectId, properties as ObjectProperties);
  }, [onObjectUpdate]);

  // Handle object selection
  const handleObjectSelect = useCallback((objectId: string) => {
    setSelectedObject(objectId);
    onObjectSelect?.(objectId);
  }, [onObjectSelect]);

  // Handle group creation
  const handleCreateGroup = useCallback(() => {
    const selectedObjects = objects.filter(obj => obj.id === selectedObject);
    if (selectedObjects.length > 0) {
      const newGroup: ObjectGroup = {
        id: `group-${Date.now()}`,
        name: `Group ${groups.length + 1}`,
        objectIds: selectedObjects.map(obj => obj.id),
        color: new Color3(Math.random(), Math.random(), Math.random()),
        visible: true,
        locked: false
      };

      setGroups(prev => [...prev, newGroup]);
      onGroupCreate?.(newGroup.name, newGroup.objectIds);
    }
  }, [objects, selectedObject, groups.length, onGroupCreate]);

  // Handle group removal
  const handleRemoveGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(group => group.id !== groupId));
    setSelectedGroup(null);
    onGroupRemove?.(groupId);
  }, [onGroupRemove]);

  // Toggle object visibility
  const toggleObjectVisibility = useCallback((objectId: string) => {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
      handleObjectUpdate(objectId, { visible: !object.visible });
    }
  }, [objects, handleObjectUpdate]);

  // Toggle object lock
  const toggleObjectLock = useCallback((objectId: string) => {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
      handleObjectUpdate(objectId, { locked: !object.locked });
    }
  }, [objects, handleObjectUpdate]);

  // Duplicate object
  const duplicateObject = useCallback((objectId: string) => {
    const object = objects.find(obj => obj.id === objectId);
    if (object) {
      const newObject: ObjectProperties = {
        ...object,
        id: `${object.type}-${Date.now()}`,
        name: `${object.name} Copy`,
        position: new Vector3(
          object.position.x + 2,
          object.position.y,
          object.position.z + 2
        )
      };
      setObjects(prev => [...prev, newObject]);
    }
  }, [objects]);

  // Filter objects based on search term
  const filteredObjects = objects.filter(obj =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedObjectData = objects.find(obj => obj.id === selectedObject);

  return (
    <div className="object-controls">
      <div className="object-controls-header">
        <h3 className="object-controls-title">Object Controls</h3>
        <div className="object-controls-actions">
          <Button variant="ghost" size="sm" onClick={handleCreateGroup}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="object-controls-tabs">
        <TabsList className="object-controls-tabs-list">
          <TabsTrigger value="objects">Objects</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="objects" className="object-controls-tab-content">
          <div className="objects-section">
            <div className="objects-header">
              <div className="search-container">
                <Input
                  placeholder="Search objects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="add-object-buttons">
                {Object.entries(OBJECT_PRESETS).slice(0, 6).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddObject(type as ObjectType)}
                      className="add-object-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
              <div className="add-object-buttons">
                {Object.entries(OBJECT_PRESETS).slice(6).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddObject(type as ObjectType)}
                      className="add-object-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="objects-list">
              <h4 className="section-title">Scene Objects ({filteredObjects.length})</h4>
              <ScrollArea className="objects-scroll-area">
                <div className="objects-grid">
                  {filteredObjects.map((object) => {
                    const preset = OBJECT_PRESETS[object.type];
                    const IconComponent = preset.icon;
                    return (
                      <Card
                        key={object.id}
                        className={`object-card ${selectedObject === object.id ? 'selected' : ''}`}
                        onClick={() => handleObjectSelect(object.id)}
                      >
                        <CardContent className="object-content">
                          <div className="object-header">
                            <div className="object-info">
                              <IconComponent className="w-4 h-4" />
                              <span className="object-name">{object.name}</span>
                              <Badge variant="secondary" className="object-type">
                                {object.type}
                              </Badge>
                            </div>
                            <div className="object-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleObjectVisibility(object.id);
                                }}
                              >
                                {object.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleObjectLock(object.id);
                                }}
                              >
                                {object.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateObject(object.id);
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveObject(object.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="object-preview">
                            <div
                              className="object-color"
                              style={{
                                backgroundColor: `rgb(${object.color.r * 255}, ${object.color.g * 255}, ${object.color.b * 255})`,
                                opacity: object.opacity
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

        <TabsContent value="groups" className="object-controls-tab-content">
          <div className="groups-section">
            <div className="groups-header">
              <h4 className="section-title">Object Groups ({groups.length})</h4>
              <Button variant="outline" size="sm" onClick={handleCreateGroup}>
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </div>

            <ScrollArea className="groups-scroll-area">
              <div className="groups-grid">
                {groups.map((group) => (
                  <Card
                    key={group.id}
                    className={`group-card ${selectedGroup === group.id ? 'selected' : ''}`}
                    onClick={() => setSelectedGroup(group.id)}
                  >
                    <CardContent className="group-content">
                      <div className="group-header">
                        <div className="group-info">
                          <div
                            className="group-color"
                            style={{
                              backgroundColor: `rgb(${group.color.r * 255}, ${group.color.g * 255}, ${group.color.b * 255})`
                            }}
                          />
                          <span className="group-name">{group.name}</span>
                          <Badge variant="secondary" className="group-count">
                            {group.objectIds.length} objects
                          </Badge>
                        </div>
                        <div className="group-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveGroup(group.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="group-controls">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle group visibility
                          }}
                        >
                          {group.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle group lock
                          }}
                        >
                          {group.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="object-controls-tab-content">
          {selectedObjectData ? (
            <div className="properties-section">
              <h4 className="section-title">Object Properties</h4>
              <ScrollArea className="properties-scroll-area">
                <div className="properties-content">
                  <div className="property-group">
                    <h5 className="property-group-title">Transform</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label>Position X</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedObjectData.position.x}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            position: new Vector3(parseFloat(e.target.value), selectedObjectData.position.y, selectedObjectData.position.z)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Position Y</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedObjectData.position.y}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            position: new Vector3(selectedObjectData.position.x, parseFloat(e.target.value), selectedObjectData.position.z)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Position Z</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedObjectData.position.z}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            position: new Vector3(selectedObjectData.position.x, selectedObjectData.position.y, parseFloat(e.target.value))
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Rotation X</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedObjectData.rotation.x}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            rotation: new Vector3(parseFloat(e.target.value), selectedObjectData.rotation.y, selectedObjectData.rotation.z)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Rotation Y</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedObjectData.rotation.y}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            rotation: new Vector3(selectedObjectData.rotation.x, parseFloat(e.target.value), selectedObjectData.rotation.z)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Rotation Z</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedObjectData.rotation.z}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            rotation: new Vector3(selectedObjectData.rotation.x, selectedObjectData.rotation.y, parseFloat(e.target.value))
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Scale X</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedObjectData.scale.x}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            scale: new Vector3(parseFloat(e.target.value), selectedObjectData.scale.y, selectedObjectData.scale.z)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Scale Y</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedObjectData.scale.y}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            scale: new Vector3(selectedObjectData.scale.x, parseFloat(e.target.value), selectedObjectData.scale.z)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Scale Z</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={selectedObjectData.scale.z}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            scale: new Vector3(selectedObjectData.scale.x, selectedObjectData.scale.y, parseFloat(e.target.value))
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <h5 className="property-group-title">Appearance</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label>Color</label>
                        <div className="color-picker">
                          <input
                            type="color"
                            value={selectedObjectData.color.toHexString()}
                            onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                              color: Color3.FromHexString(e.target.value)
                            })}
                          />
                        </div>
                      </div>
                      <div className="property-item">
                        <label>Opacity</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedObjectData.opacity}
                          onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                            opacity: parseFloat(e.target.value)
                          })}
                        />
                      </div>
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedObjectData.wireframe}
                            onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                              wireframe: e.target.checked
                            })}
                          />
                          Wireframe
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <h5 className="property-group-title">Shadows</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedObjectData.castShadows}
                            onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                              castShadows: e.target.checked
                            })}
                          />
                          Cast Shadows
                        </label>
                      </div>
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedObjectData.receiveShadows}
                            onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                              receiveShadows: e.target.checked
                            })}
                          />
                          Receive Shadows
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <h5 className="property-group-title">Physics</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedObjectData.physicsEnabled}
                            onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                              physicsEnabled: e.target.checked
                            })}
                          />
                          Physics Enabled
                        </label>
                      </div>
                      {selectedObjectData.physicsEnabled && (
                        <>
                          <div className="property-item">
                            <label>Mass</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={selectedObjectData.mass}
                              onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                                mass: parseFloat(e.target.value)
                              })}
                            />
                          </div>
                          <div className="property-item">
                            <label>Friction</label>
                            <Input
                              type="number"
                              min="0"
                              max="1"
                              step="0.1"
                              value={selectedObjectData.friction}
                              onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                                friction: parseFloat(e.target.value)
                              })}
                            />
                          </div>
                          <div className="property-item">
                            <label>Restitution</label>
                            <Input
                              type="number"
                              min="0"
                              max="1"
                              step="0.1"
                              value={selectedObjectData.restitution}
                              onChange={(e) => handleObjectUpdate(selectedObjectData.id, {
                                restitution: parseFloat(e.target.value)
                              })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select an object to view its properties</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
