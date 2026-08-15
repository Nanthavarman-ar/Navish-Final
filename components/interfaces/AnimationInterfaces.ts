import * as BABYLON from "@babylonjs/core";

// Animation interfaces for BabylonWorkspace
export interface AnimationMetadata {
  type?: string;
  category?: string;
  duration?: number;
}

export interface AnimationGroup {
  id: string;
  name: string;
  animations: BABYLON.Animation[];
  targetMeshes: BABYLON.AbstractMesh[];
  speedRatio: number;
  weight: number;
  isPlaying: boolean;
  isLooping: boolean;
  from?: number;
  to?: number;
  metadata?: AnimationMetadata;
}

export interface AnimationPresetProperties {
  axis?: 'x' | 'y' | 'z';
  amplitude?: number;
  frequency?: number;
  startValue?: number;
  endValue?: number;
  startScale?: BABYLON.Vector3;
  endScale?: BABYLON.Vector3;
  colorStart?: BABYLON.Color3;
  colorMid?: BABYLON.Color3;
  colorEnd?: BABYLON.Color3;
  /** Explicit keyframe shape (fraction of duration 0..1 -> value) for motion an
   *  amplitude/start-end pair can't express, e.g. a multi-cycle wave. */
  customKeys?: { t: number; value: number }[];
}

export interface AnimationPreset {
  name: string;
  type: 'rotation' | 'scaling' | 'translation' | 'opacity' | 'color' | 'custom';
  duration: number;
  loop?: boolean;
  properties?: AnimationPresetProperties;
  easingFunction?: BABYLON.EasingFunction;
}

export interface AnimationSequenceStep {
  animationGroupId: string;
  delay?: number;
  condition?: () => boolean;
  onStart?: () => void;
}

export interface AnimationSequence {
  id: string;
  name?: string;
  steps: AnimationSequenceStep[];
  loop?: boolean;
  isPlaying?: boolean;
  currentStepIndex?: number;
}

export interface AnimationTrack {
  id: string;
  name?: string;
  targetMesh?: BABYLON.AbstractMesh;
  keyframes: KeyframeData[];
  duration: number;
  loop?: boolean;
  easing?: string;
  targetProperty?: string;
  isPlaying?: boolean;
  currentTime?: number;
  startTime?: number;
}

export interface KeyframeData {
  time: number;
  value?: any;
  interpolation?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  position?: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  scaling?: BABYLON.Vector3;
  opacity?: number;
}

export interface AnimationState {
  groupId: string;
  isPlaying: boolean;
  currentFrame?: number;
  speedRatio: number;
  isLooping: boolean;
}

export interface AnimationEvent {
  type: string;
  groupId: string;
  timestamp: number;
  data?: any;
}

export interface AnimationManagerOptions {
  autoStart?: boolean;
  loop?: boolean;
  speed?: number;
  easing?: string;
}

export interface AnimationPerformanceMetrics {
  totalAnimations: number;
  activeAnimations: number;
  averageFrameTime: number;
  memoryUsage: number;
  lastUpdateTime: number;
  poolHitRate: number;
  poolSize: number;
}

export interface PhysicsAnimationProperties {
  mass?: number;
  damping?: number;
  stiffness?: number;
  velocity?: BABYLON.Vector3;
  acceleration?: BABYLON.Vector3;
}

export interface PhysicsAnimationConfig {
  id?: string;
  targetMesh: BABYLON.AbstractMesh;
  type: 'spring' | 'bounce' | 'gravity' | 'pendulum' | 'kinematic';
  properties: PhysicsAnimationProperties;
  duration?: number;
  loop?: boolean;
  easing?: string;
  onComplete?: (config: PhysicsAnimationConfig) => void;
  onUpdate?: (config: PhysicsAnimationConfig, progress: number) => void;
  startTime?: number;
  isPlaying?: boolean;
  currentPosition?: BABYLON.Vector3;
  currentVelocity?: BABYLON.Vector3;
  currentAcceleration?: BABYLON.Vector3;
}

export interface AnimationBlendConfig {
  id?: string;
  name?: string;
  sourceAnimationId?: string;
  targetAnimationId?: string;
  fromTrackId?: string;
  toTrackId?: string;
  targetMesh?: BABYLON.AbstractMesh;
  duration?: number;
  blendDuration?: number;
  blendCurve?: string;
  blendWeight?: number;
  easing?: string;
  onComplete?: (config: AnimationBlendConfig) => void;
  isPlaying?: boolean;
  startTime?: number;
  progress?: number;
}

export interface EnhancedAnimationEvent extends Omit<AnimationEvent, 'groupId'> {
  groupId?: string;
  animationId?: string;
  metadata?: any;
  progress?: number;
}
