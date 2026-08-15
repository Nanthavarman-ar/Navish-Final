import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ScrollArea } from '../../ui/scroll-area';
import { Vector3 } from '@babylonjs/core';
import {
  Play,
  Pause,
  Square,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Atom,
  Mountain as MountainIcon,
  Move3D,
  User,
  Settings,
  Link,
  Wind as WindIcon
} from 'lucide-react';
import './PhysicsControls.css';

interface PhysicsControlsProps {
  onPhysicsCreate?: (physicsType: PhysicsType, targetId: string) => void;
  onPhysicsRemove?: (physicsId: string) => void;
  onPhysicsUpdate?: (physicsId: string, properties: PhysicsProperties) => void;
  onPhysicsPlay?: (physicsId: string) => void;
  onPhysicsPause?: (physicsId: string) => void;
  onPhysicsStop?: (physicsId: string) => void;
}

export type PhysicsType =
  | 'rigidbody'
  | 'static'
  | 'kinematic'
  | 'character'
  | 'vehicle'
  | 'ragdoll'
  | 'cloth'
  | 'softbody'
  | 'fluid'
  | 'particle'
  | 'constraint'
  | 'joint'
  | 'spring'
  | 'motor'
  | 'custom';

export interface PhysicsProperties {
  id: string;
  name: string;
  type: PhysicsType;
  targetId: string;
  enabled: boolean;
  mass: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  gravityFactor: number;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  lockPosition: Vector3;
  lockRotation: Vector3;
  useGravity: boolean;
  isTrigger: boolean;
  collisionGroup: number;
  collisionMask: number;
  material: PhysicsMaterial;
  constraints: PhysicsConstraint[];
  forces: PhysicsForce[];
  impulses: PhysicsImpulse[];
}

export interface PhysicsMaterial {
  staticFriction: number;
  dynamicFriction: number;
  restitution: number;
  frictionCombine: string;
  restitutionCombine: string;
}

export interface PhysicsConstraint {
  id: string;
  type: string;
  targetId: string;
  position: Vector3;
  rotation: Vector3;
  limits: Vector3;
  enabled: boolean;
}

export interface PhysicsForce {
  id: string;
  type: string;
  position: Vector3;
  direction: Vector3;
  magnitude: number;
  duration: number;
  enabled: boolean;
}

export interface PhysicsImpulse {
  id: string;
  position: Vector3;
  direction: Vector3;
  magnitude: number;
  enabled: boolean;
}

const PHYSICS_PRESETS = {
  rigidbody: {
    name: 'Rigid Body',
    icon: Atom,
    description: 'Dynamic physics object',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  static: {
    name: 'Static',
    icon: MountainIcon,
    description: 'Non-moving physics object',
    defaultProperties: {
      enabled: true,
      mass: 0,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0,
      angularDamping: 0,
      gravityFactor: 0,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(1, 1, 1),
      lockRotation: new Vector3(1, 1, 1),
      useGravity: false,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  kinematic: {
    name: 'Kinematic',
    icon: Move3D,
    description: 'Animated physics object',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0,
      angularDamping: 0,
      gravityFactor: 0,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: false,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  character: {
    name: 'Character',
    icon: User,
    description: 'Character controller physics',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  vehicle: {
    name: 'Vehicle',
    icon: Move3D,
    description: 'Vehicle physics',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  ragdoll: {
    name: 'Ragdoll',
    icon: User,
    description: 'Ragdoll physics',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  cloth: {
    name: 'Cloth',
    icon: Atom,
    description: 'Cloth simulation',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  softbody: {
    name: 'Soft Body',
    icon: Atom,
    description: 'Soft body physics',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  fluid: {
    name: 'Fluid',
    icon: WindIcon,
    description: 'Fluid simulation',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  particle: {
    name: 'Particle',
    icon: Atom,
    description: 'Particle system',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  constraint: {
    name: 'Constraint',
    icon: Link,
    description: 'Physics constraint',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  joint: {
    name: 'Joint',
    icon: Link,
    description: 'Physics joint',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  spring: {
    name: 'Spring',
    icon: Link,
    description: 'Spring constraint',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  motor: {
    name: 'Motor',
    icon: Settings,
    description: 'Motor constraint',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  },
  custom: {
    name: 'Custom',
    icon: Settings,
    description: 'Custom physics object',
    defaultProperties: {
      enabled: true,
      mass: 1,
      friction: 0.5,
      restitution: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
      gravityFactor: 1,
      linearVelocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lockPosition: new Vector3(0, 0, 0),
      lockRotation: new Vector3(0, 0, 0),
      useGravity: true,
      isTrigger: false,
      collisionGroup: 1,
      collisionMask: -1,
      material: {
        staticFriction: 0.5,
        dynamicFriction: 0.3,
        restitution: 0.3,
        frictionCombine: 'average',
        restitutionCombine: 'average'
      },
      constraints: [],
      forces: [],
      impulses: []
    }
  }
};

export function PhysicsControls({
  onPhysicsCreate,
  onPhysicsRemove,
  onPhysicsUpdate,
  onPhysicsPlay,
  onPhysicsPause,
  onPhysicsStop
}: PhysicsControlsProps) {
  const [activeTab, setActiveTab] = useState('objects');
  const [selectedPhysics, setSelectedPhysics] = useState<string | null>(null);
  const [physicsObjects, setPhysicsObjects] = useState<PhysicsProperties[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);

  // Initialize with default physics objects
  useEffect(() => {
    const defaultPhysics = Object.entries(PHYSICS_PRESETS).map(([type, preset]) => ({
      id: `${type}-default`,
      name: `${preset.name} Physics`,
      type: type as PhysicsType,
      targetId: '',
      ...preset.defaultProperties
    } as PhysicsProperties));
    setPhysicsObjects(defaultPhysics);
  }, []);

  // Handle physics type selection
  const handleAddPhysics = useCallback((physicsType: PhysicsType) => {
    const preset = PHYSICS_PRESETS[physicsType];
    const newPhysics: PhysicsProperties = {
      id: `${physicsType}-${Date.now()}`,
      name: `${preset.name} Physics ${physicsObjects.length + 1}`,
      type: physicsType,
      targetId: '',
      ...preset.defaultProperties
    };

    setPhysicsObjects(prev => [...prev, newPhysics]);
    onPhysicsCreate?.(physicsType, newPhysics.targetId);
  }, [physicsObjects.length, onPhysicsCreate]);

  // Handle physics removal
  const handleRemovePhysics = useCallback((physicsId: string) => {
    setPhysicsObjects(prev => prev.filter(obj => obj.id !== physicsId));
    setSelectedPhysics(null);
    onPhysicsRemove?.(physicsId);
  }, [onPhysicsRemove]);

  // Handle physics property update
  const handlePhysicsUpdate = useCallback((physicsId: string, properties: Partial<PhysicsProperties>) => {
    setPhysicsObjects(prev => prev.map(obj =>
      obj.id === physicsId ? { ...obj, ...properties } : obj
    ));
    onPhysicsUpdate?.(physicsId, properties as PhysicsProperties);
  }, [onPhysicsUpdate]);

  // Handle simulation control
  const handleSimulationControl = useCallback((action: 'play' | 'pause' | 'stop') => {
    setIsSimulationRunning(action === 'play');
    physicsObjects.forEach(obj => {
      switch (action) {
        case 'play':
          onPhysicsPlay?.(obj.id);
          break;
        case 'pause':
          onPhysicsPause?.(obj.id);
          break;
        case 'stop':
          onPhysicsStop?.(obj.id);
          break;
      }
    });
  }, [physicsObjects, onPhysicsPlay, onPhysicsPause, onPhysicsStop]);

  // Filter physics objects based on search term
  const filteredPhysics = physicsObjects.filter(obj =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPhysicsData = physicsObjects.find(obj => obj.id === selectedPhysics);

  return (
    <div className="physics-controls">
      <div className="physics-controls-header">
        <h3 className="physics-controls-title">Physics Controls</h3>
        <div className="physics-controls-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSimulationControl('play')}
            disabled={isSimulationRunning}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSimulationControl('pause')}
            disabled={!isSimulationRunning}
          >
            <Pause className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSimulationControl('stop')}
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="physics-controls-tabs">
        <TabsList className="physics-controls-tabs-list">
          <TabsTrigger value="objects">Objects</TabsTrigger>
          <TabsTrigger value="forces">Forces</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="objects" className="physics-controls-tab-content">
          <div className="objects-section">
            <div className="objects-header">
              <div className="search-container">
                <Input
                  placeholder="Search physics objects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="add-physics-buttons">
                {Object.entries(PHYSICS_PRESETS).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddPhysics(type as PhysicsType)}
                      className="add-physics-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="objects-list">
              <h4 className="section-title">Physics Objects ({filteredPhysics.length})</h4>
              <ScrollArea className="objects-scroll-area">
                <div className="objects-grid">
                  {filteredPhysics.map((physics) => {
                    const preset = PHYSICS_PRESETS[physics.type];
                    const IconComponent = preset.icon;
                    return (
                      <Card
                        key={physics.id}
                        className={`physics-card ${selectedPhysics === physics.id ? 'selected' : ''}`}
                        onClick={() => setSelectedPhysics(physics.id)}
                      >
                        <CardContent className="physics-content">
                          <div className="physics-header">
                            <div className="physics-info">
                              <IconComponent className="w-4 h-4" />
                              <span className="physics-name">{physics.name}</span>
                            </div>
                            <div className="physics-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePhysicsUpdate(physics.id, { enabled: !physics.enabled });
                                }}
                              >
                                {physics.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePhysics(physics.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="physics-properties">
                            <div className="property-row">
                              <span className="property-label">Mass</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={physics.mass}
                                onChange={(e) => handlePhysicsUpdate(physics.id, { mass: parseFloat(e.target.value) })}
                                className="property-input"
                              />
                            </div>
                            <div className="property-row">
                              <span className="property-label">Friction</span>
                              <Input
                                type="number"
                                min="0"
                                max="1"
                                step="0.1"
                                value={physics.friction}
                                onChange={(e) => handlePhysicsUpdate(physics.id, { friction: parseFloat(e.target.value) })}
                                className="property-input"
                              />
                            </div>
                            <div className="property-row">
                              <span className="property-label">Restitution</span>
                              <Input
                                type="number"
                                min="0"
                                max="1"
                                step="0.1"
                                value={physics.restitution}
                                onChange={(e) => handlePhysicsUpdate(physics.id, { restitution: parseFloat(e.target.value) })}
                                className="property-input"
                              />
                            </div>
                            <div className="property-row">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={physics.useGravity}
                                  onChange={(e) => handlePhysicsUpdate(physics.id, { useGravity: e.target.checked })}
                                />
                                Gravity
                              </label>
                            </div>
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

        <TabsContent value="forces" className="physics-controls-tab-content">
          <div className="forces-section">
            <div className="forces-header">
              <h4 className="section-title">Forces & Impulses</h4>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Force
              </Button>
            </div>

            <ScrollArea className="forces-scroll-area">
              <div className="forces-grid">
                {selectedPhysicsData?.forces.map((force) => (
                  <Card key={force.id} className="force-card">
                    <CardContent className="force-content">
                      <div className="force-header">
                        <div className="force-info">
                          <WindIcon className="w-4 h-4" />
                          <span className="force-name">{force.type}</span>
                        </div>
                        <div className="force-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Toggle force
                            }}
                          >
                            {force.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Remove force
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="force-properties">
                        <div className="property-row">
                          <span className="property-label">Magnitude</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={force.magnitude}
                            onChange={(e) => {
                              // Update force magnitude
                            }}
                            className="property-input"
                          />
                        </div>
                        <div className="property-row">
                          <span className="property-label">Duration</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={force.duration}
                            onChange={(e) => {
                              // Update force duration
                            }}
                            className="property-input"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="constraints" className="physics-controls-tab-content">
          <div className="constraints-section">
            <div className="constraints-header">
              <h4 className="section-title">Constraints & Joints</h4>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Constraint
              </Button>
            </div>

            <ScrollArea className="constraints-scroll-area">
              <div className="constraints-grid">
                {selectedPhysicsData?.constraints.map((constraint) => (
                  <Card key={constraint.id} className="constraint-card">
                    <CardContent className="constraint-content">
                      <div className="constraint-header">
                        <div className="constraint-info">
                          <Link className="w-4 h-4" />
                          <span className="constraint-name">{constraint.type}</span>
                        </div>
                        <div className="constraint-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Toggle constraint
                            }}
                          >
                            {constraint.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Remove constraint
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="constraint-properties">
                        <div className="property-row">
                          <span className="property-label">Target</span>
                          <Input
                            value={constraint.targetId}
                            onChange={(e) => {
                              // Update constraint target
                            }}
                            className="property-input"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="physics-controls-tab-content">
          {selectedPhysicsData ? (
            <div className="properties-section">
              <h4 className="section-title">Physics Properties</h4>
              <ScrollArea className="properties-scroll-area">
                <div className="properties-content">
                  <div className="property-group">
                    <h5 className="property-group-title">Basic Properties</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label>Name</label>
                        <Input
                          value={selectedPhysicsData.name}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Target ID</label>
                        <Input
                          placeholder="Object ID"
                          value={selectedPhysicsData.targetId}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { targetId: e.target.value })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Mass</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={selectedPhysicsData.mass}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { mass: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Friction</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedPhysicsData.friction}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { friction: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Restitution</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedPhysicsData.restitution}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { restitution: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Linear Damping</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedPhysicsData.linearDamping}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { linearDamping: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Angular Damping</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedPhysicsData.angularDamping}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { angularDamping: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Gravity Factor</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={selectedPhysicsData.gravityFactor}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { gravityFactor: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedPhysicsData.useGravity}
                            onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { useGravity: e.target.checked })}
                          />
                          Use Gravity
                        </label>
                      </div>
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedPhysicsData.isTrigger}
                            onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { isTrigger: e.target.checked })}
                          />
                          Is Trigger
                        </label>
                      </div>
                      <div className="property-item">
                        <label>Collision Group</label>
                        <Input
                          type="number"
                          value={selectedPhysicsData.collisionGroup}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { collisionGroup: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Collision Mask</label>
                        <Input
                          type="number"
                          value={selectedPhysicsData.collisionMask}
                          onChange={(e) => handlePhysicsUpdate(selectedPhysicsData.id, { collisionMask: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a physics object to view its properties</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
