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
import { Vector3, Color3, Animation, AnimationGroup } from '@babylonjs/core';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
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
  Diamond,
  Activity,
  Clock,
  Repeat,
  Shuffle,
  FastForward,
  Rewind,
  Volume1,
  VolumeX as VolumeMute,
  BarChart3,
  TrendingUp,
  Zap as Lightning,
  Heart,
  Star,
  Circle,
  Square as SquareIcon,
  Triangle,
  Hexagon,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  RotateCw,
  FlipHorizontal,
  FlipVertical
} from 'lucide-react';
import './AnimationControls.css';

interface AnimationControlsProps {
  onAnimationCreate?: (animationType: AnimationType, targetId: string) => void;
  onAnimationRemove?: (animationId: string) => void;
  onAnimationUpdate?: (animationId: string, properties: AnimationProperties) => void;
  onAnimationPlay?: (animationId: string) => void;
  onAnimationPause?: (animationId: string) => void;
  onAnimationStop?: (animationId: string) => void;
}

export type AnimationType =
  | 'position'
  | 'rotation'
  | 'scale'
  | 'color'
  | 'opacity'
  | 'material'
  | 'morph'
  | 'skeleton'
  | 'camera'
  | 'light'
  | 'particle'
  | 'custom';

export interface AnimationProperties {
  id: string;
  name: string;
  type: AnimationType;
  targetId: string;
  duration: number;
  loop: boolean;
  loopCount: number;
  speed: number;
  easing: string;
  autoPlay: boolean;
  enabled: boolean;
  keys: AnimationKey[];
  events: AnimationEvent[];
  blendMode: string;
  weight: number;
}

export interface AnimationKey {
  frame: number;
  value: any;
  interpolation: string;
}

export interface AnimationEvent {
  frame: number;
  eventType: string;
  data: any;
}

export interface LocalAnimationGroup {
  id: string;
  name: string;
  animations: string[];
  duration: number;
  loop: boolean;
  speed: number;
  enabled: boolean;
}

const ANIMATION_PRESETS = {
  position: {
    name: 'Position',
    icon: Move3D,
    description: 'Animate object position',
    defaultProperties: {
      duration: 2,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'easeInOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  rotation: {
    name: 'Rotation',
    icon: RotateCw,
    description: 'Animate object rotation',
    defaultProperties: {
      duration: 3,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'linear',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  scale: {
    name: 'Scale',
    icon: Maximize,
    description: 'Animate object scale',
    defaultProperties: {
      duration: 1.5,
      loop: false,
      loopCount: 1,
      speed: 1,
      easing: 'easeOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  color: {
    name: 'Color',
    icon: Palette,
    description: 'Animate material color',
    defaultProperties: {
      duration: 2.5,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'easeInOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  opacity: {
    name: 'Opacity',
    icon: Eye,
    description: 'Animate transparency',
    defaultProperties: {
      duration: 1,
      loop: false,
      loopCount: 1,
      speed: 1,
      easing: 'easeIn',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  material: {
    name: 'Material',
    icon: Layers,
    description: 'Animate material properties',
    defaultProperties: {
      duration: 3,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'easeInOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  morph: {
    name: 'Morph',
    icon: Triangle,
    description: 'Animate morph targets',
    defaultProperties: {
      duration: 2,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'linear',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  skeleton: {
    name: 'Skeleton',
    icon: User,
    description: 'Animate skeletal structure',
    defaultProperties: {
      duration: 4,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'easeInOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  camera: {
    name: 'Camera',
    icon: Camera,
    description: 'Animate camera movement',
    defaultProperties: {
      duration: 5,
      loop: false,
      loopCount: 1,
      speed: 1,
      easing: 'easeInOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  light: {
    name: 'Light',
    icon: Sun,
    description: 'Animate light properties',
    defaultProperties: {
      duration: 3,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'easeInOut',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  particle: {
    name: 'Particle',
    icon: Sparkles,
    description: 'Animate particle systems',
    defaultProperties: {
      duration: 2,
      loop: true,
      loopCount: -1,
      speed: 1,
      easing: 'linear',
      autoPlay: true,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  },
  custom: {
    name: 'Custom',
    icon: Settings,
    description: 'Custom animation',
    defaultProperties: {
      duration: 2,
      loop: false,
      loopCount: 1,
      speed: 1,
      easing: 'linear',
      autoPlay: false,
      enabled: true,
      blendMode: 'additive',
      weight: 1
    }
  }
};

const EASING_FUNCTIONS = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeInSine',
  'easeOutSine',
  'easeInOutSine',
  'easeInExpo',
  'easeOutExpo',
  'easeInOutExpo',
  'easeInCirc',
  'easeOutCirc',
  'easeInOutCirc',
  'easeInElastic',
  'easeOutElastic',
  'easeInOutElastic',
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',
  'easeInBounce',
  'easeOutBounce',
  'easeInOutBounce'
];

export function AnimationControls({
  onAnimationCreate,
  onAnimationRemove,
  onAnimationUpdate,
  onAnimationPlay,
  onAnimationPause,
  onAnimationStop
}: AnimationControlsProps) {
  const { state } = useWorkspace();
  const [activeTab, setActiveTab] = useState('animations');
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [animations, setAnimations] = useState<AnimationProperties[]>([]);
  const [groups, setGroups] = useState<LocalAnimationGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize with default animations
  useEffect(() => {
    const defaultAnimations: AnimationProperties[] = Object.entries(ANIMATION_PRESETS).slice(0, 3).map(([type, preset]) => ({
      id: `${type}-default`,
      name: `${preset.name} Animation`,
      type: type as AnimationType,
      targetId: '',
      keys: [],
      events: [],
      ...preset.defaultProperties
    }));
    setAnimations(defaultAnimations);
  }, []);

  // Handle animation type selection
  const handleAddAnimation = useCallback((animationType: AnimationType) => {
    const preset = ANIMATION_PRESETS[animationType];
    const newAnimation: AnimationProperties = {
      id: `${animationType}-${Date.now()}`,
      name: `${preset.name} Animation ${animations.length + 1}`,
      type: animationType,
      targetId: '',
      keys: [
        { frame: 0, value: new Vector3(0, 0, 0), interpolation: 'linear' },
        { frame: preset.defaultProperties.duration * 60, value: new Vector3(1, 1, 1), interpolation: 'linear' }
      ],
      events: [],
      ...preset.defaultProperties
    };

    setAnimations(prev => [...prev, newAnimation]);
    onAnimationCreate?.(animationType, newAnimation.targetId);
  }, [animations.length, onAnimationCreate]);

  // Handle animation removal
  const handleRemoveAnimation = useCallback((animationId: string) => {
    setAnimations(prev => prev.filter(anim => anim.id !== animationId));
    setSelectedAnimation(null);
    onAnimationRemove?.(animationId);
  }, [onAnimationRemove]);

  // Handle animation property update
  const handleAnimationUpdate = useCallback((animationId: string, properties: Partial<AnimationProperties>) => {
    setAnimations(prev => prev.map(anim =>
      anim.id === animationId ? { ...anim, ...properties } : anim
    ));
    onAnimationUpdate?.(animationId, properties as AnimationProperties);
  }, [onAnimationUpdate]);

  // Handle animation play
  const handlePlayAnimation = useCallback((animationId: string) => {
    setIsPlaying(true);
    onAnimationPlay?.(animationId);
  }, [onAnimationPlay]);

  // Handle animation pause
  const handlePauseAnimation = useCallback((animationId: string) => {
    setIsPlaying(false);
    onAnimationPause?.(animationId);
  }, [onAnimationPause]);

  // Handle animation stop
  const handleStopAnimation = useCallback((animationId: string) => {
    setIsPlaying(false);
    setCurrentTime(0);
    onAnimationStop?.(animationId);
  }, [onAnimationStop]);

  // Handle group creation
  const handleCreateGroup = useCallback(() => {
    const selectedAnimations = animations.filter(anim => anim.id === selectedAnimation);
    if (selectedAnimations.length > 0) {
      const newGroup: LocalAnimationGroup = {
        id: `group-${Date.now()}`,
        name: `Animation Group ${groups.length + 1}`,
        animations: selectedAnimations.map(anim => anim.id),
        duration: Math.max(...selectedAnimations.map(anim => anim.duration)),
        loop: true,
        speed: 1,
        enabled: true
      };

      setGroups(prev => [...prev, newGroup]);
    }
  }, [animations, selectedAnimation, groups.length]);

  // Handle group removal
  const handleRemoveGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(group => group.id !== groupId));
    setSelectedGroup(null);
  }, []);

  // Duplicate animation
  const duplicateAnimation = useCallback((animationId: string) => {
    const animation = animations.find(anim => anim.id === animationId);
    if (animation) {
      const newAnimation: AnimationProperties = {
        ...animation,
        id: `${animation.type}-${Date.now()}`,
        name: `${animation.name} Copy`
      };
      setAnimations(prev => [...prev, newAnimation]);
    }
  }, [animations]);

  // Filter animations based on search term
  const filteredAnimations = animations.filter(anim =>
    anim.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    anim.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedAnimationData = animations.find(anim => anim.id === selectedAnimation);

  return (
    <div className="animation-controls">
      <div className="animation-controls-header">
        <h3 className="animation-controls-title">Animation Controls</h3>
        <div className="animation-controls-actions">
          <Button variant="ghost" size="sm" onClick={handleCreateGroup}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="animation-controls-tabs">
        <TabsList className="animation-controls-tabs-list">
          <TabsTrigger value="animations">Animations</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="animations" className="animation-controls-tab-content">
          <div className="animations-section">
            <div className="animations-header">
              <div className="search-container">
                <Input
                  placeholder="Search animations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="add-animation-buttons">
                {Object.entries(ANIMATION_PRESETS).slice(0, 6).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddAnimation(type as AnimationType)}
                      className="add-animation-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
              <div className="add-animation-buttons">
                {Object.entries(ANIMATION_PRESETS).slice(6).map(([type, preset]) => {
                  const IconComponent = preset.icon;
                  return (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddAnimation(type as AnimationType)}
                      className="add-animation-button"
                      title={preset.description}
                    >
                      <IconComponent className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="animations-list">
              <h4 className="section-title">Scene Animations ({filteredAnimations.length})</h4>
              <ScrollArea className="animations-scroll-area">
                <div className="animations-grid">
                  {filteredAnimations.map((animation) => {
                    const preset = ANIMATION_PRESETS[animation.type];
                    const IconComponent = preset.icon;
                    return (
                      <Card
                        key={animation.id}
                        className={`animation-card ${selectedAnimation === animation.id ? 'selected' : ''}`}
                        onClick={() => setSelectedAnimation(animation.id)}
                      >
                        <CardContent className="animation-content">
                          <div className="animation-header">
                            <div className="animation-info">
                              <IconComponent className="w-4 h-4" />
                              <span className="animation-name">{animation.name}</span>
                              <Badge variant="secondary" className="animation-type">
                                {animation.type}
                              </Badge>
                            </div>
                            <div className="animation-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isPlaying) {
                                    handlePauseAnimation(animation.id);
                                  } else {
                                    handlePlayAnimation(animation.id);
                                  }
                                }}
                              >
                                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStopAnimation(animation.id);
                                }}
                              >
                                <Square className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateAnimation(animation.id);
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveAnimation(animation.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="animation-properties">
                            <div className="property-row">
                              <span className="property-label">Duration</span>
                              <Input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={animation.duration}
                                onChange={(e) => handleAnimationUpdate(animation.id, { duration: parseFloat(e.target.value) })}
                                className="property-input"
                              />
                            </div>
                            <div className="property-row">
                              <span className="property-label">Speed</span>
                              <Input
                                type="number"
                                min="0.1"
                                max="5"
                                step="0.1"
                                value={animation.speed}
                                onChange={(e) => handleAnimationUpdate(animation.id, { speed: parseFloat(e.target.value) })}
                                className="property-input"
                              />
                            </div>
                            <div className="property-row">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={animation.loop}
                                  onChange={(e) => handleAnimationUpdate(animation.id, { loop: e.target.checked })}
                                />
                                Loop
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

        <TabsContent value="groups" className="animation-controls-tab-content">
          <div className="groups-section">
            <div className="groups-header">
              <h4 className="section-title">Animation Groups ({groups.length})</h4>
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
                          <Activity className="w-4 h-4" />
                          <span className="group-name">{group.name}</span>
                          <Badge variant="secondary" className="group-count">
                            {group.animations.length} animations
                          </Badge>
                        </div>
                        <div className="group-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Play group
                            }}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Stop group
                            }}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
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
                      <div className="group-properties">
                        <div className="property-row">
                          <span className="property-label">Duration</span>
                          <Input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={group.duration}
                            onChange={(e) => {
                              // Update group duration
                            }}
                            className="property-input"
                          />
                        </div>
                        <div className="property-row">
                          <span className="property-label">Speed</span>
                          <Input
                            type="number"
                            min="0.1"
                            max="5"
                            step="0.1"
                            value={group.speed}
                            onChange={(e) => {
                              // Update group speed
                            }}
                            className="property-input"
                          />
                        </div>
                        <div className="property-row">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={group.loop}
                              onChange={(e) => {
                                // Update group loop
                              }}
                            />
                            Loop
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="animation-controls-tab-content">
          <div className="timeline-section">
            <div className="timeline-header">
              <h4 className="section-title">Timeline</h4>
              <div className="timeline-controls">
                <Button variant="outline" size="sm">
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Rewind className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm">
                  <FastForward className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="timeline-content">
              <div className="timeline-ruler">
                <div className="ruler-marks">
                  {Array.from({ length: 100 }, (_, i) => (
                    <div key={i} className="ruler-mark" style={{ left: `${i * 10}px` }}>
                      <span className="mark-label">{i}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="timeline-tracks">
                {animations.slice(0, 3).map((animation) => (
                  <div key={animation.id} className="timeline-track">
                    <div className="track-header">
                      <span className="track-name">{animation.name}</span>
                      <div className="track-controls">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Lock className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="track-content">
                      <div
                        className="track-clip"
                        style={{
                          width: `${(animation.duration / 10) * 100}px`
                        }}
                      >
                        <div className="clip-content">
                          <span className="clip-name">{animation.type}</span>
                          <div className="clip-handles">
                            <div className="handle left"></div>
                            <div className="handle right"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="animation-controls-tab-content">
          {selectedAnimationData ? (
            <div className="properties-section">
              <h4 className="section-title">Animation Properties</h4>
              <ScrollArea className="properties-scroll-area">
                <div className="properties-content">
                  <div className="property-group">
                    <h5 className="property-group-title">Basic Settings</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label>Name</label>
                        <Input
                          value={selectedAnimationData.name}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Target ID</label>
                        <Input
                          placeholder="Object ID"
                          value={selectedAnimationData.targetId}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { targetId: e.target.value })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Duration (s)</label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={selectedAnimationData.duration}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { duration: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label>Speed</label>
                        <Input
                          type="number"
                          min="0.1"
                          max="5"
                          step="0.1"
                          value={selectedAnimationData.speed}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { speed: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label htmlFor="easing-select">Easing</label>
                        <select
                          id="easing-select"
                          value={selectedAnimationData.easing}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { easing: e.target.value })}
                          className="property-select"
                          aria-label="Select easing function"
                        >
                          {EASING_FUNCTIONS.map(easing => (
                            <option key={easing} value={easing}>{easing}</option>
                          ))}
                        </select>
                      </div>
                      <div className="property-item">
                        <label>Blend Mode</label>
                        <select
                          value={selectedAnimationData.blendMode}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { blendMode: e.target.value })}
                          className="property-select"
                          aria-label="Select blend mode"
                        >
                          <option value="additive">Additive</option>
                          <option value="override">Override</option>
                          <option value="multiply">Multiply</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <h5 className="property-group-title">Loop Settings</h5>
                    <div className="property-grid">
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedAnimationData.loop}
                            onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { loop: e.target.checked })}
                          />
                          Loop Animation
                        </label>
                      </div>
                      <div className="property-item">
                        <label>Loop Count</label>
                        <Input
                          type="number"
                          min="-1"
                          value={selectedAnimationData.loopCount}
                          onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { loopCount: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="property-item">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedAnimationData.autoPlay}
                            onChange={(e) => handleAnimationUpdate(selectedAnimationData.id, { autoPlay: e.target.checked })}
                          />
                          Auto Play
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="property-group">
                    <h5 className="property-group-title">Animation Keys</h5>
                    <div className="keys-list">
                      {selectedAnimationData.keys.map((key, index) => (
                        <div key={index} className="key-item">
                          <div className="key-info">
                            <span className="key-frame">Frame {key.frame}</span>
                            <span className="key-interpolation">{key.interpolation}</span>
                          </div>
                          <div className="key-actions">
                            <Button variant="ghost" size="sm">
                              <Settings className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="add-key-button">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Keyframe
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select an animation to view its properties</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
