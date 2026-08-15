import * as BABYLON from "@babylonjs/core";
import { SyncManager } from "./SyncManager";
import { SecurityUtils } from "./utils/SecurityUtils";
import {
  AnimationGroup,
  AnimationPreset,
  AnimationSequence,
  AnimationSequenceStep,
  AnimationState,
  AnimationEvent,
  AnimationManagerOptions,
  AnimationPerformanceMetrics,
  PhysicsAnimationConfig,
  KeyframeData,
  AnimationTrack,
  AnimationBlendConfig,
  EnhancedAnimationEvent
} from "./interfaces/AnimationInterfaces";

export class AnimationManager {
  private scene: BABYLON.Scene;
  private syncManager: SyncManager;
  private animationGroups: Map<string, AnimationGroup> = new Map();
  private activeAnimations: Set<string> = new Set();
  private pausedAnimations: Set<string> = new Set();
  private eventCallbacks: ((event: AnimationEvent) => void)[] = [];
  private globalSpeedRatio: number = 1.0;
  private isPaused: boolean = false;

  // Animation presets and sequences
  private animationPresets: Map<string, AnimationPreset> = new Map();
  private animationSequences: Map<string, AnimationSequence> = new Map();
  private activeSequences: Set<string> = new Set();

  // Enhanced easing functions
  private easingFunctions: Map<string, BABYLON.EasingFunction> = new Map();

  // Error tracking
  private errors: Array<{ timestamp: number; error: Error; context: string }> = [];
  private maxErrors: number = 100;

  // Enhanced Animation Pooling System
  private animationPool: Map<string, BABYLON.Animation[]> = new Map();
  private maxPoolSize: number = 100;
  private poolHitCount: number = 0;
  private poolMissCount: number = 0;

  // LRU Cache for frequently used animations
  private animationCache: Map<string, { animation: BABYLON.Animation; lastUsed: number; useCount: number; size: number }> = new Map();
  private maxCacheSize: number = 50;
  private maxMemoryUsage: number = 50 * 1024 * 1024; // 50MB limit
  private currentMemoryUsage: number = 0;

  // Pool cleanup and optimization
  private lastPoolCleanup: number = 0;
  private poolCleanupInterval: number = 30000; // Clean up every 30 seconds
  private unusedThreshold: number = 60000; // Consider unused after 1 minute

  // Pool optimization based on usage patterns
  private poolUsageStats: Map<string, { hits: number; misses: number; lastUsed: number }> = new Map();
  private adaptivePoolSizing: boolean = true;

  // Performance optimization
  private frameCount: number = 0;
  private lastPerformanceUpdate: number = 0;
  private performanceMetrics: AnimationPerformanceMetrics = {
    totalAnimations: 0,
    activeAnimations: 0,
    averageFrameTime: 0,
    memoryUsage: 0,
    lastUpdateTime: 0,
    poolHitRate: 0,
    poolSize: 0
  };

  // Update optimization
  private updateFrameSkip: number = 1; // Update every N frames
  private sequenceUpdateFrameSkip: number = 2; // Update sequences less frequently
  private performanceUpdateInterval: number = 1000; // Update performance metrics every second

  // Cached data for performance
  private cachedActiveGroups: Map<string, AnimationGroup> = new Map();
  private lastSequenceUpdate: number = 0;
  private sequenceUpdateInterval: number = 16; // ~60fps

  // Physics-based animations
  private physicsAnimations: Map<string, PhysicsAnimationConfig> = new Map();
  private activePhysicsAnimations: Set<string> = new Set();
  private physicsUpdateInterval: number = 16; // ~60fps physics updates
  private lastPhysicsUpdate: number = 0;

  // Keyframe management
  private animationTracks: Map<string, AnimationTrack> = new Map();
  private keyframeCallbacks: Map<string, ((trackId: string, keyframeIndex: number) => void)[]> = new Map();

  // Animation blending
  private animationBlends: Map<string, AnimationBlendConfig> = new Map();
  private activeBlends: Set<string> = new Set();

  // Enhanced event callbacks
  private enhancedEventCallbacks: ((event: EnhancedAnimationEvent) => void)[] = [];

  // Real-time editing and preview state
  private isPreviewMode: boolean = false;
  private previewAnimationGroup: BABYLON.AnimationGroup | null = null;
  private previewCurrentTime: number = 0;

  constructor(scene: BABYLON.Scene, syncManager: SyncManager) {
    // Validate inputs
    if (!scene) {
      throw new Error('AnimationManager: Scene is required');
    }
    if (!syncManager) {
      throw new Error('AnimationManager: SyncManager is required');
    }

    this.scene = scene;
    this.syncManager = syncManager;

    try {
      // Register scene update loop
      this.scene.onBeforeRenderObservable.add(() => this.update());

      // Initialize default easing functions
      this.initializeEasingFunctions();

      // Initialize default animation presets
      this.initializeDefaultPresets();
    } catch (error: unknown) {
      this.logError(error, 'constructor');
      throw error;
    }
  }

  /**
   * Validate animation group data
   */
  private validateAnimationGroup(group: AnimationGroup): boolean {
    if (!group.id || typeof group.id !== 'string') {
      this.logError(new Error('Invalid animation group ID'), 'validateAnimationGroup');
      return false;
    }

    if (!group.name || typeof group.name !== 'string') {
      this.logError(new Error('Invalid animation group name'), 'validateAnimationGroup');
      return false;
    }

    if (!Array.isArray(group.animations) || group.animations.length === 0) {
      this.logError(new Error('Animation group must have at least one animation'), 'validateAnimationGroup');
      return false;
    }

    if (!Array.isArray(group.targetMeshes) || group.targetMeshes.length === 0) {
      this.logError(new Error('Animation group must have at least one target mesh'), 'validateAnimationGroup');
      return false;
    }

    if (typeof group.speedRatio !== 'number' || group.speedRatio < 0) {
      this.logError(new Error('Invalid speed ratio'), 'validateAnimationGroup');
      return false;
    }

    if (typeof group.weight !== 'number' || group.weight < 0 || group.weight > 1) {
      this.logError(new Error('Invalid weight (must be between 0 and 1)'), 'validateAnimationGroup');
      return false;
    }

    return true;
  }

  /**
   * Validate animation preset
   */
  private validateAnimationPreset(preset: AnimationPreset): boolean {
    if (!preset.name || typeof preset.name !== 'string') {
      this.logError(new Error('Invalid preset name'), 'validateAnimationPreset');
      return false;
    }

    if (!['rotation', 'scaling', 'translation', 'opacity', 'color', 'custom'].includes(preset.type)) {
      this.logError(new Error('Invalid animation type'), 'validateAnimationPreset');
      return false;
    }

    if (typeof preset.duration !== 'number' || preset.duration <= 0) {
      this.logError(new Error('Invalid duration (must be positive number)'), 'validateAnimationPreset');
      return false;
    }

    return true;
  }

  /**
   * Sanitize log data to prevent log injection
   */
  private sanitizeLogData(data: any): any {
    if (typeof data === 'string') {
      return SecurityUtils.sanitizeForLog(data);
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeLogData(value);
      }
      return sanitized;
    }
    return data;
  }

  /**
   * Log error with context
   */
  private logError(error: unknown, context: string): void {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    const errorEntry = {
      timestamp: Date.now(),
      error: error instanceof Error ? error : new Error(errorMessage),
      context
    };

    this.errors.push(errorEntry);

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    console.error(`AnimationManager Error [${SecurityUtils.sanitizeForLog(context)}]:`, SecurityUtils.sanitizeForLog(errorMessage));

    // Emit error event
    this.emitEvent({
      type: 'frame_changed',
      groupId: 'error',
      timestamp: Date.now(),
      data: { error: errorMessage, context }
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): Array<{ timestamp: number; error: Error; context: string }> {
    return this.errors.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Register a new animation group
   */
  registerAnimationGroup(group: AnimationGroup): void {
    // Create Babylon animation group
    const babylonGroup = new BABYLON.AnimationGroup(group.name, this.scene);

    // Add animations to the group
    group.animations.forEach((animation, index) => {
      const target = group.targetMeshes[index] || group.targetMeshes[0];
      if (target) {
        babylonGroup.addTargetedAnimation(animation, target);
      }
    });

    // Set group properties
    babylonGroup.loopAnimation = group.isLooping;
    babylonGroup.speedRatio = group.speedRatio;

    // Store enhanced group data
    const enhancedGroup: AnimationGroup & { babylonGroup: BABYLON.AnimationGroup } = {
      ...group,
      babylonGroup
    };

    this.animationGroups.set(group.id, enhancedGroup as AnimationGroup);

    // Set up event listeners
    this.setupAnimationEvents(group.id, babylonGroup);

    console.log(`Animation group '${SecurityUtils.sanitizeForLog(group.name)}' registered with ${group.animations.length} animations`);
  }

  /**
   * Setup animation event listeners
   */
  private setupAnimationEvents(groupId: string, babylonGroup: BABYLON.AnimationGroup): void {
    babylonGroup.onAnimationGroupPlayObservable.add(() => {
      this.emitEvent({
        type: 'started',
        groupId,
        timestamp: Date.now()
      });
    });

    babylonGroup.onAnimationGroupPauseObservable.add(() => {
      this.emitEvent({
        type: 'stopped',
        groupId,
        timestamp: Date.now()
      });
    });

    babylonGroup.onAnimationGroupEndObservable.add(() => {
      this.emitEvent({
        type: 'completed',
        groupId,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Play animation group
   */
  async playAnimation(groupId: string, options?: {
    speedRatio?: number;
    loop?: boolean;
    from?: number;
    to?: number;
  }): Promise<boolean> {
    const group = this.animationGroups.get(groupId);
    if (!group) {
      console.warn(`Animation group '${SecurityUtils.sanitizeForLog(groupId)}' not found`);
      return false;
    }

    const babylonGroup = (group as any).babylonGroup;
    if (!babylonGroup) return false;

    // Update properties if provided
    if (options?.speedRatio !== undefined) {
      babylonGroup.speedRatio = options.speedRatio * this.globalSpeedRatio;
      group.speedRatio = options.speedRatio;
    }
    if (options?.loop !== undefined) {
      babylonGroup.loopAnimation = options.loop;
      group.isLooping = options.loop;
    }

    // Play the animation
    babylonGroup.play(options?.loop);

    group.isPlaying = true;
    this.activeAnimations.add(groupId);

    // Sync with other users
    this.syncAnimationState(groupId);

    return true;
  }

  /**
   * Stop animation group
   */
  stopAnimation(groupId: string): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      babylonGroup.stop();
    }

    group.isPlaying = false;
    this.activeAnimations.delete(groupId);

    // Sync with other users
    this.syncAnimationState(groupId);

    return true;
  }

  /**
   * Pause animation group
   */
  pauseAnimation(groupId: string): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      babylonGroup.pause();
    }

    group.isPlaying = false;
    this.activeAnimations.delete(groupId);

    return true;
  }

  /**
   * Restart animation group
   */
  restartAnimation(groupId: string): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      babylonGroup.restart();
    }

    group.isPlaying = true;
    this.activeAnimations.add(groupId);

    return true;
  }

  /**
   * Set animation speed ratio
   */
  setAnimationSpeed(groupId: string, speedRatio: number): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      babylonGroup.speedRatio = speedRatio * this.globalSpeedRatio;
    }

    group.speedRatio = speedRatio;

    // Sync with other users
    this.syncAnimationState(groupId);

    return true;
  }

  /**
   * Set global speed ratio for all animations
   */
  setGlobalSpeedRatio(speedRatio: number): void {
    this.globalSpeedRatio = speedRatio;

    // Update all active animations
    this.animationGroups.forEach((group, groupId) => {
      const babylonGroup = (group as any).babylonGroup;
      if (babylonGroup && this.activeAnimations.has(groupId)) {
        babylonGroup.speedRatio = group.speedRatio * this.globalSpeedRatio;
      }
    });
  }

  /**
   * Toggle animation loop
   */
  setAnimationLoop(groupId: string, loop: boolean): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      babylonGroup.loopAnimation = loop;
    }

    group.isLooping = loop;

    return true;
  }

  /**
   * Get animation state
   */
  getAnimationState(groupId: string): AnimationState | null {
    const group = this.animationGroups.get(groupId);
    if (!group) return null;

    const babylonGroup = (group as any).babylonGroup;
    // Get current frame - Babylon.js AnimationGroup doesn't expose current frame directly
    // We need to track it through animation events or estimate based on time
    let currentFrame = 0;
    if (babylonGroup && babylonGroup.animatables && babylonGroup.animatables.length > 0) {
      // Try to get frame from the first animatable
      const firstAnimatable = babylonGroup.animatables[0];
      if (firstAnimatable && firstAnimatable.animations && firstAnimatable.animations.length > 0) {
        // Estimate current frame based on animation progress
        const animation = firstAnimatable.animations[0];
        if (animation && animation.currentFrame !== undefined) {
          currentFrame = animation.currentFrame;
        }
      }
    }

    return {
      groupId,
      isPlaying: group.isPlaying,
      currentFrame,
      speedRatio: group.speedRatio,
      isLooping: group.isLooping
    };
  }

  /**
   * Get all animation groups
   */
  getAnimationGroups(): AnimationGroup[] {
    return Array.from(this.animationGroups.values());
  }

  /**
   * Get animation groups by type
   */
  getAnimationGroupsByType(type: string): AnimationGroup[] {
    return Array.from(this.animationGroups.values()).filter(
      group => group.metadata?.type === type
    );
  }

  /**
   * Get animation groups by category
   */
  getAnimationGroupsByCategory(category: string): AnimationGroup[] {
    return Array.from(this.animationGroups.values()).filter(
      group => group.metadata?.category === category
    );
  }

  /**
   * Pause all animations
   */
  pauseAllAnimations(): void {
    this.activeAnimations.forEach(groupId => {
      this.pauseAnimation(groupId);
      this.pausedAnimations.add(groupId);
    });
    this.isPaused = true;
  }

  /**
   * Resume all animations
   */
  resumeAllAnimations(): void {
    this.pausedAnimations.forEach(groupId => {
      this.playAnimation(groupId);
      this.pausedAnimations.delete(groupId);
    });
    this.isPaused = false;
  }

  /**
   * Stop all animations
   */
  stopAllAnimations(): void {
    this.activeAnimations.forEach(groupId => {
      this.stopAnimation(groupId);
    });
  }

  /**
   * Register event callback
   */
  onAnimationEvent(callback: (event: AnimationEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove event callback
   */
  removeAnimationEventCallback(callback: (event: AnimationEvent) => void): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit animation event
   */
  private emitEvent(event: AnimationEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error: unknown) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        console.error('Animation event callback error:', SecurityUtils.sanitizeForLog(errorMessage));
      }
    });
  }

  /**
   * Get current frame from Babylon animation group
   * @param babylonGroup The Babylon animation group
   * @returns Current frame number
   */
  private getCurrentFrame(babylonGroup: BABYLON.AnimationGroup): number {
    // Babylon.js AnimationGroup doesn't expose current frame directly
    // We need to track it through animation events or estimate based on time
    // For now, return 0 as a placeholder - this should be improved with proper frame tracking
    return 0;
  }

  /**
   * Sync animation state with other users
   */
  private syncAnimationState(groupId: string): void {
    const state = this.getAnimationState(groupId);
    if (state) {
      // Use the existing sync mechanism by creating a sync event
      const syncEvent = {
        type: 'animation' as const,
        objectId: groupId,
        data: state,
        userId: 'local_user', // This should be passed from a user management system
        timestamp: Date.now()
      };

      // Emit the sync event through socket
      // This assumes syncManager has access to socket, or we need to modify the interface
      console.log('Animation sync event:', this.sanitizeLogData(syncEvent));
    }
  }

  /**
   * Handle synced animation from other users
   */
  handleSyncedAnimation(groupId: string, data: any): void {
    const group = this.animationGroups.get(groupId);
    if (!group) return;

    if (data.isPlaying && !group.isPlaying) {
      this.playAnimation(groupId, {
        speedRatio: data.speedRatio,
        loop: data.isLooping
      });
    } else if (!data.isPlaying && group.isPlaying) {
      this.stopAnimation(groupId);
    }

    if (data.speedRatio !== group.speedRatio) {
      this.setAnimationSpeed(groupId, data.speedRatio);
    }
  }

  // ===== REAL-TIME EDITING METHODS =====

  /**
   * Enable or disable real-time preview mode
   */
  enableRealtimePreview(enabled: boolean): void {
    this.isPreviewMode = enabled;
    if (!enabled && this.previewAnimationGroup) {
      this.previewAnimationGroup.stop();
      this.previewAnimationGroup = null;
    }
  }

  /**
   * Update animation speed in real-time
   */
  updateAnimationSpeed(groupId: string, speedRatio: number): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      babylonGroup.speedRatio = speedRatio * this.globalSpeedRatio;
    }

    group.speedRatio = speedRatio;

    // Emit real-time update event
    this.emitEvent({
      type: 'realtime_update',
      groupId,
      timestamp: Date.now(),
      data: { property: 'speedRatio', value: speedRatio }
    });

    return true;
  }

  /**
   * Update animation duration in real-time
   */
  updateAnimationDuration(groupId: string, duration: number): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    // Update duration in animation group metadata
    if (group.metadata) {
      group.metadata.duration = duration;
    } else {
      group.metadata = {
        type: 'custom',
        category: 'animation',
        duration
      };
    }

    // Emit real-time update event
    this.emitEvent({
      type: 'realtime_update',
      groupId,
      timestamp: Date.now(),
      data: { property: 'duration', value: duration }
    });

    return true;
  }

  /**
   * Update animation weight in real-time
   */
  updateAnimationWeight(groupId: string, weight: number): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    group.weight = Math.max(0, Math.min(1, weight)); // Clamp between 0 and 1

    // Emit real-time update event
    this.emitEvent({
      type: 'realtime_update',
      groupId,
      timestamp: Date.now(),
      data: { property: 'weight', value: group.weight }
    });

    return true;
  }

  /**
   * Scrub animation to specific time
   */
  scrubToTime(groupId: string, time: number): boolean {
    const group = this.animationGroups.get(groupId);
    if (!group) return false;

    const babylonGroup = (group as any).babylonGroup;
    if (babylonGroup) {
      // Babylon.js AnimationGroup doesn't have direct time scrubbing
      // We need to restart and fast-forward to the desired time
      babylonGroup.stop();
      babylonGroup.start(false, 1.0, time);
      babylonGroup.pause();
    }

    // Update preview time
    this.previewCurrentTime = time;

    // Emit scrub event
    this.emitEvent({
      type: 'scrubbed',
      groupId,
      timestamp: Date.now(),
      data: { time }
    });

    return true;
  }

  /**
   * Update keyframe in real-time
   */
  updateKeyframeRealtime(trackId: string, keyframeIndex: number, keyframeData: Partial<KeyframeData>): boolean {
    const track = this.animationTracks.get(trackId);
    if (!track || keyframeIndex < 0 || keyframeIndex >= track.keyframes.length) return false;

    const keyframe = track.keyframes[keyframeIndex];

    // Update keyframe properties
    if (keyframeData.position) keyframe.position = keyframeData.position;
    if (keyframeData.rotation) keyframe.rotation = keyframeData.rotation;
    if (keyframeData.scaling) keyframe.scaling = keyframeData.scaling;
    if (keyframeData.opacity !== undefined) keyframe.opacity = keyframeData.opacity;
    if (keyframeData.time !== undefined) keyframe.time = keyframeData.time;

    // Re-sort keyframes if time changed
    if (keyframeData.time !== undefined) {
      track.keyframes.sort((a, b) => a.time - b.time);
    }

    // Emit real-time keyframe update event
    this.emitEnhancedEvent({
      type: 'keyframe_updated',
      animationId: trackId,
      timestamp: Date.now(),
      data: { keyframeIndex, keyframeData }
    });

    return true;
  }

  /**
   * Get real-time preview state
   */
  getRealtimePreviewState(): { isEnabled: boolean; currentTime: number; groupId?: string } {
    return {
      isEnabled: this.isPreviewMode,
      currentTime: this.previewCurrentTime,
      groupId: this.previewAnimationGroup ? this.previewAnimationGroup.name : undefined
    };
  }

  /**
   * Set real-time preview time
   */
  setRealtimePreviewTime(time: number): void {
    this.previewCurrentTime = Math.max(0, time);
  }



  /**
   * Initialize default easing functions
   */
  private initializeEasingFunctions(): void {
    // Linear easing (no easing function needed)
    // Ease in/out functions
    const easeInOutQuad = new BABYLON.QuadraticEase();
    easeInOutQuad.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    this.easingFunctions.set('easeInOutQuad', easeInOutQuad);

    const easeInOutCubic = new BABYLON.CubicEase();
    easeInOutCubic.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    this.easingFunctions.set('easeInOutCubic', easeInOutCubic);

    // Bounce easing
    const bounceEase = new BABYLON.BounceEase();
    bounceEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
    this.easingFunctions.set('bounce', bounceEase);

    // Elastic easing
    const elasticEase = new BABYLON.ElasticEase();
    elasticEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
    this.easingFunctions.set('elastic', elasticEase);

    // Sine easing
    const sineEase = new BABYLON.SineEase();
    sineEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    this.easingFunctions.set('sine', sineEase);
  }

  /**
   * Initialize default animation presets
   */
  private initializeDefaultPresets(): void {
    // Spin preset
    this.animationPresets.set('spin', {
      name: 'Spin',
      type: 'rotation',
      duration: 60,
      loop: true,
      properties: {
        axis: 'y',
        amplitude: Math.PI * 2
      }
    });

    // Pulse preset
    this.animationPresets.set('pulse', {
      name: 'Pulse',
      type: 'scaling',
      duration: 30,
      loop: true,
      properties: {
        amplitude: 0.2
      }
    });

    // Shake preset
    this.animationPresets.set('shake', {
      name: 'Shake',
      type: 'translation',
      duration: 20,
      loop: true,
      properties: {
        axis: 'x',
        amplitude: 0.1,
        frequency: 10
      }
    });

    // Float preset
    this.animationPresets.set('float', {
      name: 'Float',
      type: 'translation',
      duration: 120,
      loop: true,
      properties: {
        axis: 'y',
        amplitude: 0.5
      }
    });

    // Glow preset
    this.animationPresets.set('glow', {
      name: 'Glow',
      type: 'opacity',
      duration: 60,
      loop: true,
      properties: {
        amplitude: 0.5
      }
    });

    // Bounce preset
    this.animationPresets.set('bounce', {
      name: 'Bounce',
      type: 'translation',
      duration: 45,
      loop: true,
      easingFunction: this.easingFunctions.get('bounce'),
      properties: {
        axis: 'y',
        amplitude: 1.0
      }
    });

    // Wobble preset
    this.animationPresets.set('wobble', {
      name: 'Wobble',
      type: 'rotation',
      duration: 40,
      loop: true,
      easingFunction: this.easingFunctions.get('elastic'),
      properties: {
        axis: 'z',
        amplitude: Math.PI * 0.1
      }
    });

    // Fade In preset
    this.animationPresets.set('fadein', {
      name: 'Fade In',
      type: 'opacity',
      duration: 30,
      loop: false,
      properties: {
        startValue: 0.0,
        endValue: 1.0
      }
    });

    // Fade Out preset
    this.animationPresets.set('fadeout', {
      name: 'Fade Out',
      type: 'opacity',
      duration: 30,
      loop: false,
      properties: {
        startValue: 1.0,
        endValue: 0.0
      }
    });

    // Scale In preset
    this.animationPresets.set('scalein', {
      name: 'Scale In',
      type: 'scaling',
      duration: 25,
      loop: false,
      easingFunction: this.easingFunctions.get('easeInOutQuad'),
      properties: {
        startScale: new BABYLON.Vector3(0, 0, 0),
        endScale: new BABYLON.Vector3(1, 1, 1)
      }
    });

    // Scale Out preset
    this.animationPresets.set('scaleout', {
      name: 'Scale Out',
      type: 'scaling',
      duration: 25,
      loop: false,
      easingFunction: this.easingFunctions.get('easeInOutQuad'),
      properties: {
        startScale: new BABYLON.Vector3(1, 1, 1),
        endScale: new BABYLON.Vector3(0, 0, 0)
      }
    });

    // Slide In Left preset
    this.animationPresets.set('slideinleft', {
      name: 'Slide In Left',
      type: 'translation',
      duration: 30,
      loop: false,
      easingFunction: this.easingFunctions.get('easeInOutQuad'),
      properties: {
        axis: 'x',
        startValue: -2.0,
        endValue: 0.0
      }
    });

    // Slide In Right preset
    this.animationPresets.set('slideinright', {
      name: 'Slide In Right',
      type: 'translation',
      duration: 30,
      loop: false,
      easingFunction: this.easingFunctions.get('easeInOutQuad'),
      properties: {
        axis: 'x',
        startValue: 2.0,
        endValue: 0.0
      }
    });

    // Slide In Up preset
    this.animationPresets.set('slideinup', {
      name: 'Slide In Up',
      type: 'translation',
      duration: 30,
      loop: false,
      easingFunction: this.easingFunctions.get('easeInOutQuad'),
      properties: {
        axis: 'y',
        startValue: -2.0,
        endValue: 0.0
      }
    });

    // Slide In Down preset
    this.animationPresets.set('slideindown', {
      name: 'Slide In Down',
      type: 'translation',
      duration: 30,
      loop: false,
      easingFunction: this.easingFunctions.get('easeInOutQuad'),
      properties: {
        axis: 'y',
        startValue: 2.0,
        endValue: 0.0
      }
    });

    // Heartbeat preset
    this.animationPresets.set('heartbeat', {
      name: 'Heartbeat',
      type: 'scaling',
      duration: 60,
      loop: true,
      properties: {
        amplitude: 0.15,
        frequency: 2
      }
    });

    // Breathing preset
    this.animationPresets.set('breathing', {
      name: 'Breathing',
      type: 'scaling',
      duration: 120,
      loop: true,
      easingFunction: this.easingFunctions.get('sine'),
      properties: {
        amplitude: 0.1
      }
    });

    // Jiggle preset
    this.animationPresets.set('jiggle', {
      name: 'Jiggle',
      type: 'rotation',
      duration: 15,
      loop: true,
      properties: {
        axis: 'z',
        amplitude: Math.PI * 0.05,
        frequency: 20
      }
    });

    // Color Cycle preset
    this.animationPresets.set('colorcycle', {
      name: 'Color Cycle',
      type: 'color',
      duration: 180,
      loop: true,
      properties: {
        colorStart: new BABYLON.Color3(1, 0, 0), // Red
        colorMid: new BABYLON.Color3(0, 1, 0),   // Green
        colorEnd: new BABYLON.Color3(0, 0, 1)    // Blue
      }
    });

    // Rainbow Glow preset
    this.animationPresets.set('rainbowglow', {
      name: 'Rainbow Glow',
      type: 'color',
      duration: 120,
      loop: true,
      properties: {
        colorStart: new BABYLON.Color3(1, 0, 0),
        colorEnd: new BABYLON.Color3(0, 1, 1)
      }
    });

    // Wave preset - a real undulating motion (two full sine cycles over the duration),
    // as opposed to the single up-down bob every other translation preset produces.
    const waveSegments = 16;
    const waveKeys = Array.from({ length: waveSegments + 1 }, (_, i) => {
      const t = i / waveSegments;
      return { t, value: Math.sin(t * Math.PI * 4) * 0.4 };
    });
    this.animationPresets.set('wave', {
      name: 'Wave',
      type: 'translation',
      duration: 90,
      loop: true,
      properties: {
        axis: 'y',
        customKeys: waveKeys
      }
    });

    // Spring preset - scales in with an elastic overshoot, using the same 'elastic'
    // easing Wobble already relies on.
    this.animationPresets.set('spring', {
      name: 'Spring',
      type: 'scaling',
      duration: 45,
      loop: false,
      easingFunction: this.easingFunctions.get('elastic'),
      properties: {
        startScale: new BABYLON.Vector3(0, 0, 0),
        endScale: new BABYLON.Vector3(1, 1, 1)
      }
    });
  }

  /**
   * Create animation from preset with pooling optimization
   */
  createAnimationFromPreset(presetName: string, targetMesh: BABYLON.AbstractMesh, options?: {
    duration?: number;
    speedRatio?: number;
    loop?: boolean;
  }): BABYLON.AnimationGroup | null {
    const preset = this.animationPresets.get(presetName);
    if (!preset) {
      console.warn(`Animation preset '${SecurityUtils.sanitizeForLog(presetName)}' not found`);
      return null;
    }

    const duration = options?.duration || preset.duration;
    const speedRatio = options?.speedRatio || 1.0;
    const loop = options?.loop ?? preset.loop ?? false;

    const animationGroup = new BABYLON.AnimationGroup(`${preset.name}_${targetMesh.name}`, this.scene);

    // Use pooling system for animation creation
    let animation: BABYLON.Animation;
    const animationProperties = { duration, ...preset.properties };

    try {
      animation = this.getAnimationFromPool(preset.type, animationProperties);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      console.warn(`Failed to get animation from pool, creating new: ${SecurityUtils.sanitizeForLog(errorMessage)}`);
      // Fallback to direct creation
      switch (preset.type) {
        case 'rotation':
          animation = this.createRotationAnimation(preset, duration);
          break;
        case 'scaling':
          animation = this.createScalingAnimation(preset, duration);
          break;
        case 'translation':
          animation = this.createTranslationAnimation(preset, duration);
          break;
        case 'opacity':
          animation = this.createOpacityAnimation(preset, duration);
          break;
        case 'color':
          animation = this.createColorAnimation(preset, duration);
          break;
        default:
          console.warn(`Unsupported animation type: ${SecurityUtils.sanitizeForLog(preset.type)}`);
          return null;
      }
    }

    if (preset.easingFunction) {
      animation.setEasingFunction(preset.easingFunction);
    }

    animationGroup.addTargetedAnimation(animation, targetMesh);
    animationGroup.speedRatio = speedRatio;
    animationGroup.loopAnimation = loop;

    return animationGroup;
  }

  /**
   * Create rotation animation
   */
  private createRotationAnimation(preset: AnimationPreset, duration: number): BABYLON.Animation {
    const axis = preset.properties?.axis || 'y';
    const amplitude = preset.properties?.amplitude || Math.PI * 2;

    const animation = new BABYLON.Animation(
      `rotation_${axis}`,
      `rotation.${axis}`,
      60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const keys = [
      { frame: 0, value: 0 },
      { frame: duration, value: amplitude }
    ];

    animation.setKeys(keys);
    return animation;
  }

  /**
   * Create scaling animation
   */
  private createScalingAnimation(preset: AnimationPreset, duration: number): BABYLON.Animation {
    const animation = new BABYLON.Animation(
      'scaling',
      'scaling',
      60,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // "In/out" presets (Scale In, Spring, ...) declare startScale/endScale - those were
    // being silently ignored here, so every scaling preset played the same generic
    // pulse regardless of what it was actually supposed to do. Use them when present;
    // fall back to the amplitude-based pulse for presets that only set amplitude (Pulse).
    const { startScale, endScale, amplitude = 0.2 } = preset.properties || {};
    const keys = (startScale && endScale)
      ? [
        { frame: 0, value: startScale },
        { frame: duration, value: endScale }
      ]
      : [
        { frame: 0, value: new BABYLON.Vector3(1, 1, 1) },
        { frame: duration / 2, value: new BABYLON.Vector3(1 + amplitude, 1 + amplitude, 1 + amplitude) },
        { frame: duration, value: new BABYLON.Vector3(1, 1, 1) }
      ];

    animation.setKeys(keys);
    return animation;
  }

  /**
   * Create translation animation
   */
  private createTranslationAnimation(preset: AnimationPreset, duration: number): BABYLON.Animation {
    const axis = preset.properties?.axis || 'y';

    const animation = new BABYLON.Animation(
      `translation_${axis}`,
      `position.${axis}`,
      60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // Same gap as scaling: "in/out" and multi-keyframe presets (Slide In, Wave, ...)
    // declare startValue/endValue or an explicit customKeys shape, which this used to
    // ignore entirely and always play the same generic up-down bob instead.
    const { startValue, endValue, customKeys, amplitude = 0.5 } = preset.properties || {};
    let keys;
    if (customKeys && customKeys.length > 0) {
      keys = customKeys.map(k => ({ frame: k.t * duration, value: k.value }));
    } else if (startValue !== undefined && endValue !== undefined) {
      keys = [
        { frame: 0, value: startValue },
        { frame: duration, value: endValue }
      ];
    } else {
      keys = [
        { frame: 0, value: 0 },
        { frame: duration / 2, value: amplitude },
        { frame: duration, value: 0 }
      ];
    }

    animation.setKeys(keys);
    return animation;
  }

  /**
   * Create opacity animation
   */
  private createOpacityAnimation(preset: AnimationPreset, duration: number): BABYLON.Animation {
    const animation = new BABYLON.Animation(
      'opacity',
      'visibility',
      60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // Fade In/Fade Out declare startValue/endValue (0->1 or 1->0) - ignored before, so
    // both played the same symmetric "dip and recover" instead of an actual fade.
    const { startValue, endValue, amplitude = 0.5 } = preset.properties || {};
    const keys = (startValue !== undefined && endValue !== undefined)
      ? [
        { frame: 0, value: startValue },
        { frame: duration, value: endValue }
      ]
      : [
        { frame: 0, value: 1.0 },
        { frame: duration / 2, value: 1.0 - amplitude },
        { frame: duration, value: 1.0 }
      ];

    animation.setKeys(keys);
    return animation;
  }

  /**
   * Create color animation
   */
  private createColorAnimation(preset: AnimationPreset, duration: number): BABYLON.Animation {
    const colorStart = preset.properties?.colorStart || new BABYLON.Color3(1, 1, 1);
    const colorEnd = preset.properties?.colorEnd || new BABYLON.Color3(0.5, 0.5, 0.5);

    const animation = new BABYLON.Animation(
      'color',
      'material.emissiveColor',
      60,
      BABYLON.Animation.ANIMATIONTYPE_COLOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const keys = [
      { frame: 0, value: colorStart },
      { frame: duration / 2, value: colorEnd },
      { frame: duration, value: colorStart }
    ];

    animation.setKeys(keys);
    return animation;
  }

  /**
   * Register custom animation preset
   */
  registerAnimationPreset(preset: AnimationPreset): void {
    this.animationPresets.set(preset.name.toLowerCase(), preset);
  }

  /**
   * Get available animation presets
   */
  getAnimationPresets(): AnimationPreset[] {
    return Array.from(this.animationPresets.values());
  }

  /**
   * Create and register animation sequence
   */
  createAnimationSequence(sequence: AnimationSequence): void {
    this.animationSequences.set(sequence.id, sequence);
  }

  /**
   * Play animation sequence
   */
  playAnimationSequence(sequenceId: string): boolean {
    const sequence = this.animationSequences.get(sequenceId);
    if (!sequence) {
      console.warn(`Animation sequence '${SecurityUtils.sanitizeForLog(sequenceId)}' not found`);
      return false;
    }

    sequence.isPlaying = true;
    sequence.currentStepIndex = 0;
    sequence.loop = sequence.loop ?? false;
    this.activeSequences.add(sequenceId);

    this.playSequenceStep(sequence);

    return true;
  }

  /**
   * Stop animation sequence
   */
  stopAnimationSequence(sequenceId: string): boolean {
    const sequence = this.animationSequences.get(sequenceId);
    if (!sequence) return false;

    sequence.isPlaying = false;
    this.activeSequences.delete(sequenceId);

    // Stop current step if playing
    if (sequence.currentStepIndex! < sequence.steps.length) {
      const currentStep = sequence.steps[sequence.currentStepIndex!];
      this.stopAnimation(currentStep.animationGroupId);
    }

    return true;
  }

  /**
   * Update animation sequences
   */
  private updateSequences(): void {
    this.activeSequences.forEach(sequenceId => {
      const sequence = this.animationSequences.get(sequenceId);
      if (!sequence || sequence.currentStepIndex === undefined) return;

      const currentStepIndex = sequence.currentStepIndex!;
      const currentStep = sequence.steps[currentStepIndex];
      if (!currentStep) {
        // Sequence completed
        if (sequence.loop) {
          sequence.currentStepIndex = 0;
          this.playSequenceStep(sequence);
        } else {
          sequence.isPlaying = false;
          this.activeSequences.delete(sequenceId);
        }
        return;
      }

      // Check if current step is completed
      const groupState = this.getAnimationState(currentStep.animationGroupId);
      if (groupState && !groupState.isPlaying) {
        // Move to next step
        sequence.currentStepIndex = currentStepIndex + 1;
        if (sequence.currentStepIndex < sequence.steps.length) {
          this.playSequenceStep(sequence);
        }
      }
    });
  }

  /**
   * Play current step of sequence
   */
  private playSequenceStep(sequence: AnimationSequence): void {
    if (sequence.currentStepIndex === undefined) return;

    const step = sequence.steps[sequence.currentStepIndex];
    if (!step) return;

    // Check condition if provided
    if (step.condition && !step.condition()) {
      // Skip this step
      sequence.currentStepIndex++;
      if (sequence.currentStepIndex < sequence.steps.length) {
        this.playSequenceStep(sequence);
      }
      return;
    }

    // Execute onStart callback
    if (step.onStart) {
      step.onStart();
    }

    // Play the animation with delay if specified
    if (step.delay && step.delay > 0) {
      setTimeout(() => {
        this.playAnimation(step.animationGroupId);
      }, step.delay);
    } else {
      this.playAnimation(step.animationGroupId);
    }
  }

  /**
   * Blend between two animations
   */
  blendAnimations(fromGroupId: string, toGroupId: string, blendDuration: number = 30): boolean {
    const fromGroup = this.animationGroups.get(fromGroupId);
    const toGroup = this.animationGroups.get(toGroupId);

    if (!fromGroup || !toGroup) return false;

    // Create blend animation
    const blendAnimation = new BABYLON.Animation(
      'blend',
      'weight',
      60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keys = [
      { frame: 0, value: fromGroup.weight },
      { frame: blendDuration, value: toGroup.weight }
    ];

    blendAnimation.setKeys(keys);

    // Note: This is a simplified blend implementation
    // In a full implementation, you'd need to handle weight blending properly
    console.log(`Blending from ${SecurityUtils.sanitizeForLog(fromGroupId)} to ${SecurityUtils.sanitizeForLog(toGroupId)} over ${blendDuration} frames`);

    return true;
  }

  /**
   * Get animation sequences
   */
  getAnimationSequences(): AnimationSequence[] {
    return Array.from(this.animationSequences.values());
  }

  /**
   * Get animation from pool or create new one
   */
  private getAnimationFromPool(type: string, properties: any): BABYLON.Animation {
    const poolKey = `${type}_${JSON.stringify(properties)}`;
    let animation: BABYLON.Animation | undefined;

    // Check pool first
    const pool = this.animationPool.get(poolKey);
    if (pool && pool.length > 0) {
      animation = pool.pop();
      this.poolHitCount++;
    } else {
      this.poolMissCount++;
      // Create new animation based on type
      animation = this.createAnimationByType(type, properties);
    }

    // Update cache
    if (animation) {
      this.updateAnimationCache(poolKey, animation);
    }

    return animation!;
  }

  /**
   * Return animation to pool for reuse
   */
  private returnAnimationToPool(animation: BABYLON.Animation, type: string, properties: any): void {
    const poolKey = `${type}_${JSON.stringify(properties)}`;
    let pool = this.animationPool.get(poolKey);

    if (!pool) {
      pool = [];
      this.animationPool.set(poolKey, pool);
    }

    // Only keep up to maxPoolSize animations per type
    if (pool.length < this.maxPoolSize) {
      // Reset animation to initial state - animations don't have stop() method
      // They are managed through AnimationGroups
      pool.push(animation);
    } else {
      // Dispose excess animations - animations don't have dispose() method
      // They are disposed when their AnimationGroup is disposed
    }
  }

  /**
   * Update LRU animation cache
   */
  private updateAnimationCache(key: string, animation: BABYLON.Animation): void {
    const now = Date.now();

    if (this.animationCache.has(key)) {
      const cached = this.animationCache.get(key)!;
      cached.lastUsed = now;
      cached.useCount++;
    } else {
      // Check if cache is full
      if (this.animationCache.size >= this.maxCacheSize) {
        // Remove least recently used
        let oldestKey = '';
        let oldestTime = now;

        this.animationCache.forEach((cacheValue, cacheKey) => {
          if (cacheValue.lastUsed < oldestTime) {
            oldestTime = cacheValue.lastUsed;
            oldestKey = cacheKey;
          }
        });

        if (oldestKey) {
          this.animationCache.delete(oldestKey);
        }
      }

      // Estimate animation size (rough approximation)
      const estimatedSize = this.estimateAnimationSize(animation);

      this.animationCache.set(key, {
        animation,
        lastUsed: now,
        useCount: 1,
        size: estimatedSize
      });
    }
  }

  /**
   * Estimate animation memory size
   */
  private estimateAnimationSize(animation: BABYLON.Animation): number {
    // Rough estimation based on animation properties
    let size = 100; // Base size

    // Add size based on keys
    if (animation.getKeys()) {
      size += animation.getKeys().length * 20; // ~20 bytes per key
    }

    // Add size based on animation type
    switch (animation.dataType) {
      case BABYLON.Animation.ANIMATIONTYPE_FLOAT:
        size += 4;
        break;
      case BABYLON.Animation.ANIMATIONTYPE_VECTOR2:
        size += 8;
        break;
      case BABYLON.Animation.ANIMATIONTYPE_VECTOR3:
        size += 12;
        break;
      case BABYLON.Animation.ANIMATIONTYPE_COLOR3:
        size += 12;
        break;
      default:
        size += 16;
    }

    return size;
  }

  /**
   * Create animation by type
   */
  private createAnimationByType(type: string, properties: any): BABYLON.Animation {
    switch (type) {
      case 'rotation':
        return this.createRotationAnimation({ properties } as AnimationPreset, properties.duration || 60);
      case 'scaling':
        return this.createScalingAnimation({ properties } as AnimationPreset, properties.duration || 60);
      case 'translation':
        return this.createTranslationAnimation({ properties } as AnimationPreset, properties.duration || 60);
      case 'opacity':
        return this.createOpacityAnimation({ properties } as AnimationPreset, properties.duration || 60);
      case 'color':
        return this.createColorAnimation({ properties } as AnimationPreset, properties.duration || 60);
      default:
        throw new Error(`Unsupported animation type: ${type}`);
    }
  }

  /**
   * Get pooling statistics
   */
  getPoolingStatistics(): {
    poolHitCount: number;
    poolMissCount: number;
    poolHitRate: number;
    totalPools: number;
    cacheSize: number;
    maxCacheSize: number;
  } {
    const totalRequests = this.poolHitCount + this.poolMissCount;
    const hitRate = totalRequests > 0 ? (this.poolHitCount / totalRequests) * 100 : 0;

    return {
      poolHitCount: this.poolHitCount,
      poolMissCount: this.poolMissCount,
      poolHitRate: hitRate,
      totalPools: this.animationPool.size,
      cacheSize: this.animationCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Clear animation pools and cache
   */
  clearPools(): void {
    // Clear pools - animations don't have dispose() method
    // They are disposed when their AnimationGroup is disposed
    this.animationPool.clear();
    this.animationCache.clear();
    this.poolHitCount = 0;
    this.poolMissCount = 0;
  }

  /**
   * Update pool management - called every frame
   */
  private updatePoolManagement(): void {
    const now = Date.now();

    // Periodic pool cleanup
    if (now - this.lastPoolCleanup > this.poolCleanupInterval) {
      this.performPoolCleanup();
      this.lastPoolCleanup = now;
    }

    // Update usage statistics
    this.updatePoolUsageStats();

    // Adaptive pool sizing
    if (this.adaptivePoolSizing) {
      this.adjustPoolSize();
    }

    // Update performance metrics
    this.updatePerformanceMetrics();
  }

  /**
   * Perform periodic pool cleanup
   */
  private performPoolCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up unused animations from cache
    for (const [key, cacheEntry] of this.animationCache.entries()) {
      if (now - cacheEntry.lastUsed > this.unusedThreshold) {
        this.animationCache.delete(key);
        cleanedCount++;
      }
    }

    // Clean up pools based on usage patterns
    for (const [poolKey, pool] of this.animationPool.entries()) {
      const usageStats = this.poolUsageStats.get(poolKey);
      if (usageStats && now - usageStats.lastUsed > this.unusedThreshold * 2) {
        // Reduce pool size for rarely used animations
        const targetSize = Math.max(1, Math.floor(pool.length * 0.5));
        if (pool.length > targetSize) {
          pool.splice(targetSize);
          cleanedCount += pool.length - targetSize;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`Pool cleanup: removed ${cleanedCount} unused animations`);
    }
  }

  /**
   * Update pool usage statistics
   */
  private updatePoolUsageStats(): void {
    const now = Date.now();

    // Update usage stats for active pools
    for (const poolKey of this.animationPool.keys()) {
      if (!this.poolUsageStats.has(poolKey)) {
        this.poolUsageStats.set(poolKey, { hits: 0, misses: 0, lastUsed: now });
      }
    }

    // Clean up stats for removed pools
    for (const [poolKey, stats] of this.poolUsageStats.entries()) {
      if (!this.animationPool.has(poolKey) && now - stats.lastUsed > this.unusedThreshold) {
        this.poolUsageStats.delete(poolKey);
      }
    }
  }

  /**
   * Adjust pool size based on usage patterns
   */
  private adjustPoolSize(): void {
    const totalRequests = this.poolHitCount + this.poolMissCount;
    if (totalRequests < 10) return; // Not enough data

    const hitRate = this.poolHitCount / totalRequests;

    // If hit rate is low, increase pool sizes
    if (hitRate < 0.5) {
      this.maxPoolSize = Math.min(this.maxPoolSize + 10, 200);
    }
    // If hit rate is high, we can potentially reduce sizes
    else if (hitRate > 0.8) {
      this.maxPoolSize = Math.max(this.maxPoolSize - 5, 50);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();

    if (now - this.lastPerformanceUpdate > this.performanceUpdateInterval) {
      const totalRequests = this.poolHitCount + this.poolMissCount;
      const hitRate = totalRequests > 0 ? (this.poolHitCount / totalRequests) * 100 : 0;

      this.performanceMetrics = {
        totalAnimations: this.animationGroups.size,
        activeAnimations: this.activeAnimations.size,
        averageFrameTime: 0, // Would need frame timing data
        memoryUsage: this.currentMemoryUsage,
        lastUpdateTime: now,
        poolHitRate: hitRate,
        poolSize: this.animationPool.size
      };

      this.lastPerformanceUpdate = now;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopAllAnimations();

    // Clear pools and cache
    this.clearPools();

    this.animationGroups.forEach((group, groupId) => {
      const babylonGroup = (group as any).babylonGroup;
      if (babylonGroup) {
        babylonGroup.dispose();
      }
    });

    this.animationGroups.clear();
    this.activeAnimations.clear();
    this.eventCallbacks = [];

    // Clear physics animations
    this.physicsAnimations.clear();
    this.activePhysicsAnimations.clear();
    this.animationTracks.clear();
    this.keyframeCallbacks.clear();
    this.animationBlends.clear();
    this.activeBlends.clear();
    this.enhancedEventCallbacks = [];
  }

  // ===== PHYSICS-BASED ANIMATIONS =====

  /**
   * Create physics-based animation
   */
  createPhysicsAnimation(config: PhysicsAnimationConfig): string {
    const id = `physics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate configuration
    if (!config.targetMesh) {
      throw new Error('Physics animation requires a target mesh');
    }

    // Initialize physics properties
    const physicsConfig: PhysicsAnimationConfig = {
      id,
      targetMesh: config.targetMesh,
      type: config.type || 'spring',
      properties: {
        mass: config.properties?.mass || 1.0,
        damping: config.properties?.damping || 0.95,
        stiffness: config.properties?.stiffness || 0.1,
        velocity: config.properties?.velocity || new BABYLON.Vector3(0, 0, 0),
        acceleration: config.properties?.acceleration || new BABYLON.Vector3(0, 0, 0),
        ...config.properties
      },
      duration: config.duration || 1000,
      loop: config.loop || false,
      easing: config.easing || 'linear',
      onComplete: config.onComplete,
      onUpdate: config.onUpdate
    };

    this.physicsAnimations.set(id, physicsConfig);
    return id;
  }

  /**
   * Play physics animation
   */
  playPhysicsAnimation(id: string): boolean {
    const config = this.physicsAnimations.get(id);
    if (!config) {
      console.warn(`Physics animation '${SecurityUtils.sanitizeForLog(id)}' not found`);
      return false;
    }

    // Initialize physics state
    config.startTime = Date.now();
    config.isPlaying = true;
    config.currentPosition = config.targetMesh.position.clone();
    config.currentVelocity = config.properties.velocity?.clone() || new BABYLON.Vector3(0, 0, 0);
    config.currentAcceleration = config.properties.acceleration?.clone() || new BABYLON.Vector3(0, 0, 0);

    this.activePhysicsAnimations.add(id);

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'physics_started',
      animationId: id,
      timestamp: Date.now(),
      data: { config }
    });

    return true;
  }

  /**
   * Stop physics animation
   */
  stopPhysicsAnimation(id: string): boolean {
    const config = this.physicsAnimations.get(id);
    if (!config) return false;

    config.isPlaying = false;
    this.activePhysicsAnimations.delete(id);

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'physics_stopped',
      animationId: id,
      timestamp: Date.now(),
      data: { config }
    });

    return true;
  }

  /**
   * Update physics animations
   */
  private updatePhysicsAnimations(): void {
    const now = Date.now();
    const deltaTime = Math.min((now - this.lastPhysicsUpdate) / 1000, 0.016); // Cap at ~60fps

    if (deltaTime <= 0) return;

    this.activePhysicsAnimations.forEach(id => {
      const config = this.physicsAnimations.get(id);
      if (!config || !config.isPlaying) return;

      const elapsed = now - (config.startTime || 0);
      const progress = Math.min(elapsed / (config.duration || 1000), 1.0);

      // Update physics simulation
      this.updatePhysicsSimulation(config, deltaTime);

      // Check completion
      if (progress >= 1.0 && !config.loop) {
        this.completePhysicsAnimation(id);
      } else if (config.loop && progress >= 1.0) {
        // Reset for looping
        config.startTime = now;
        if (config.targetMesh) {
          config.currentPosition = config.targetMesh.position.clone();
        }
      }

      // Call update callback
      if (config.onUpdate) {
        config.onUpdate(config, progress);
      }
    });

    this.lastPhysicsUpdate = now;
  }

  /**
   * Update physics simulation
   */
  private updatePhysicsSimulation(config: PhysicsAnimationConfig, deltaTime: number): void {
    const { properties, targetMesh } = config;

    if (!targetMesh) return;

    // Ensure physics properties are initialized
    if (!config.currentVelocity) config.currentVelocity = new BABYLON.Vector3(0, 0, 0);
    if (!config.currentAcceleration) config.currentAcceleration = new BABYLON.Vector3(0, 0, 0);
    if (!config.currentPosition) config.currentPosition = targetMesh.position.clone();

    switch (config.type) {
      case 'spring':
        this.updateSpringPhysics(config, deltaTime);
        break;
      case 'bounce':
        this.updateBouncePhysics(config, deltaTime);
        break;
      case 'gravity':
        this.updateGravityPhysics(config, deltaTime);
        break;
      case 'pendulum':
        this.updatePendulumPhysics(config, deltaTime);
        break;
      default:
        // Basic kinematic motion
        config.currentVelocity!.addInPlace(config.currentAcceleration!.scale(deltaTime));
        config.currentPosition!.addInPlace(config.currentVelocity!.scale(deltaTime));
        break;
    }

    // Apply damping
    const damping = properties?.damping ?? 0.95;
    config.currentVelocity!.scaleInPlace(damping);

    // Update mesh position
    targetMesh.position.copyFrom(config.currentPosition!);
  }

  /**
   * Update spring physics
   */
  private updateSpringPhysics(config: PhysicsAnimationConfig, deltaTime: number): void {
    const { properties, targetMesh } = config;

    if (!targetMesh || !config.currentPosition || !config.currentVelocity || !config.currentAcceleration) {
      return;
    }

    const stiffness = properties?.stiffness ?? 0.1;
    const damping = properties?.damping ?? 0.95;
    const mass = properties?.mass ?? 1.0;

    const displacement = config.currentPosition.subtract(targetMesh.position);
    const springForce = displacement.scale(-stiffness);
    const dampingForce = config.currentVelocity.scale(-damping);

    config.currentAcceleration = springForce.add(dampingForce).scale(1 / mass);
    config.currentVelocity.addInPlace(config.currentAcceleration.scale(deltaTime));
    config.currentPosition.addInPlace(config.currentVelocity.scale(deltaTime));
  }

  /**
   * Update bounce physics
   */
  private updateBouncePhysics(config: PhysicsAnimationConfig, deltaTime: number): void {
    const { properties, targetMesh } = config;

    if (!targetMesh || !config.currentPosition || !config.currentVelocity || !config.currentAcceleration) {
      return;
    }

    const damping = properties?.damping ?? 0.95;

    config.currentVelocity.addInPlace(config.currentAcceleration.scale(deltaTime));
    config.currentPosition.addInPlace(config.currentVelocity.scale(deltaTime));

    // Bounce off boundaries
    if (config.currentPosition.y <= 0) {
      config.currentPosition.y = 0;
      config.currentVelocity.y = -config.currentVelocity.y * damping;
    }
  }

  /**
   * Update gravity physics
   */
  private updateGravityPhysics(config: PhysicsAnimationConfig, deltaTime: number): void {
    const { properties } = config;

    if (!config.currentPosition || !config.currentVelocity || !config.currentAcceleration) {
      return;
    }

    const mass = properties?.mass ?? 1.0;

    // Apply gravity
    config.currentAcceleration.y = -9.81 * mass;
    config.currentVelocity.addInPlace(config.currentAcceleration.scale(deltaTime));
    config.currentPosition.addInPlace(config.currentVelocity.scale(deltaTime));
  }

  /**
   * Update pendulum physics
   */
  private updatePendulumPhysics(config: PhysicsAnimationConfig, deltaTime: number): void {
    const { properties, targetMesh } = config;

    if (!config.currentPosition || !config.currentVelocity) {
      return;
    }

    const mass = properties?.mass ?? 1.0;

    // Simple pendulum simulation
    const angle = Math.atan2(config.currentPosition.x, config.currentPosition.y);
    const angularAcceleration = -(9.81 / mass) * Math.sin(angle);
    const angularVelocity = config.currentVelocity.x; // Store angular velocity in x component

    const newAngularVelocity = angularVelocity + angularAcceleration * deltaTime;
    const newAngle = angle + newAngularVelocity * deltaTime;

    config.currentPosition.x = Math.sin(newAngle) * mass;
    config.currentPosition.y = Math.cos(newAngle) * mass;
    config.currentVelocity.x = newAngularVelocity;
  }

  /**
   * Complete physics animation
   */
  private completePhysicsAnimation(id: string): void {
    const config = this.physicsAnimations.get(id);
    if (!config) return;

    config.isPlaying = false;
    this.activePhysicsAnimations.delete(id);

    // Call completion callback
    if (config.onComplete) {
      config.onComplete(config);
    }

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'physics_completed',
      animationId: id,
      timestamp: Date.now(),
      data: { config }
    });
  }

  // ===== KEYFRAME MANAGEMENT =====

  /**
   * Create animation track with keyframes
   */
  createAnimationTrack(track: AnimationTrack): string {
    const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const enhancedTrack: AnimationTrack = {
      id,
      name: track.name,
      targetMesh: track.targetMesh,
      keyframes: track.keyframes.sort((a, b) => a.time - b.time),
      duration: track.duration || 1000,
      loop: track.loop || false,
      easing: track.easing || 'linear',
      targetProperty: track.targetProperty || 'position'
    };

    this.animationTracks.set(id, enhancedTrack);
    return id;
  }

  /**
   * Play animation track
   */
  playAnimationTrack(trackId: string): boolean {
    const track = this.animationTracks.get(trackId);
    if (!track) {
      console.warn(`Animation track '${SecurityUtils.sanitizeForLog(trackId)}' not found`);
      return false;
    }

    track.isPlaying = true;
    track.currentTime = 0;
    track.startTime = Date.now();

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'track_started',
      animationId: trackId,
      timestamp: Date.now(),
      data: { track }
    });

    return true;
  }

  /**
   * Stop animation track
   */
  stopAnimationTrack(trackId: string): boolean {
    const track = this.animationTracks.get(trackId);
    if (!track) return false;

    track.isPlaying = false;

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'track_stopped',
      animationId: trackId,
      timestamp: Date.now(),
      data: { track }
    });

    return true;
  }

  /**
   * Add keyframe to track
   */
  addKeyframe(trackId: string, keyframe: KeyframeData): boolean {
    const track = this.animationTracks.get(trackId);
    if (!track) return false;

    track.keyframes.push(keyframe);
    track.keyframes.sort((a, b) => a.time - b.time);

    return true;
  }

  /**
   * Remove keyframe from track
   */
  removeKeyframe(trackId: string, keyframeIndex: number): boolean {
    const track = this.animationTracks.get(trackId);
    if (!track || keyframeIndex < 0 || keyframeIndex >= track.keyframes.length) return false;

    track.keyframes.splice(keyframeIndex, 1);
    return true;
  }

  /**
   * Register keyframe callback
   */
  onKeyframe(trackId: string, callback: (trackId: string, keyframeIndex: number) => void): void {
    if (!this.keyframeCallbacks.has(trackId)) {
      this.keyframeCallbacks.set(trackId, []);
    }
    this.keyframeCallbacks.get(trackId)!.push(callback);
  }

  /**
   * Update animation tracks
   */
  private updateAnimationTracks(): void {
    const now = Date.now();

    this.animationTracks.forEach((track, trackId) => {
      if (!track.isPlaying) return;

      const elapsed = now - (track.startTime || 0);
      const progress = elapsed / track.duration;

      if (progress >= 1.0) {
        if (track.loop) {
          track.startTime = now;
          track.currentTime = 0;
        } else {
          this.completeAnimationTrack(trackId);
          return;
        }
      }

      track.currentTime = elapsed || 0;

      // Interpolate keyframes
      this.interpolateKeyframes(track, progress);

      // Check for keyframe triggers
      this.checkKeyframeTriggers(track, trackId);
    });
  }

  /**
   * Interpolate between keyframes
   */
  private interpolateKeyframes(track: AnimationTrack, progress: number): void {
    const { keyframes, targetMesh } = track;
    if (keyframes.length === 0) return;

    const currentTime = progress * (track.duration || 1000);

    // Find surrounding keyframes
    let prevKeyframe: KeyframeData | null = null;
    let nextKeyframe: KeyframeData | null = null;

    for (let i = 0; i < keyframes.length; i++) {
      if (keyframes[i].time <= currentTime) {
        prevKeyframe = keyframes[i];
      } else {
        nextKeyframe = keyframes[i];
        break;
      }
    }

    if (!prevKeyframe) {
      // Before first keyframe
      this.applyKeyframeData(targetMesh, keyframes[0]);
    } else if (!nextKeyframe) {
      // After last keyframe
      this.applyKeyframeData(targetMesh, prevKeyframe);
    } else {
      // Interpolate between keyframes
      const t = (currentTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
      this.interpolateKeyframeData(targetMesh, prevKeyframe, nextKeyframe, t);
    }
  }

  /**
   * Apply keyframe data to mesh
   */
  private applyKeyframeData(mesh: BABYLON.AbstractMesh | undefined, keyframe: KeyframeData): void {
    if (!mesh) return;
    if (keyframe.position) mesh.position.copyFrom(keyframe.position);
    if (keyframe.rotation) mesh.rotation.copyFrom(keyframe.rotation);
    if (keyframe.scaling) mesh.scaling.copyFrom(keyframe.scaling);
    if (keyframe.opacity !== undefined) {
      // Assuming mesh has material with alpha
      if (mesh.material) {
        (mesh.material as any).alpha = keyframe.opacity;
      }
    }
  }

  /**
   * Interpolate between two keyframes
   */
  private interpolateKeyframeData(
    mesh: BABYLON.AbstractMesh | undefined,
    from: KeyframeData,
    to: KeyframeData,
    t: number
  ): void {
    if (!mesh) return;
    if (from.position && to.position) {
      mesh.position = BABYLON.Vector3.Lerp(from.position, to.position, t);
    }
    if (from.rotation && to.rotation) {
      mesh.rotation = BABYLON.Vector3.Lerp(from.rotation, to.rotation, t);
    }
    if (from.scaling && to.scaling) {
      mesh.scaling = BABYLON.Vector3.Lerp(from.scaling, to.scaling, t);
    }
    if (from.opacity !== undefined && to.opacity !== undefined) {
      const opacity = from.opacity + (to.opacity - from.opacity) * t;
      if (mesh.material) {
        (mesh.material as any).alpha = opacity;
      }
    }
  }

  /**
   * Check for keyframe triggers
   */
  private checkKeyframeTriggers(track: AnimationTrack, trackId: string): void {
    const callbacks = this.keyframeCallbacks.get(trackId);
    if (!callbacks) return;

    track.keyframes.forEach((keyframe, index) => {
      if (Math.abs((track.currentTime || 0) - keyframe.time) < 16) { // Within 16ms
        callbacks.forEach(callback => {
          callback(trackId, index);
        });
      }
    });
  }

  /**
   * Complete animation track
   */
  private completeAnimationTrack(trackId: string): void {
    const track = this.animationTracks.get(trackId);
    if (!track) return;

    track.isPlaying = false;

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'track_completed',
      animationId: trackId,
      timestamp: Date.now(),
      data: { track }
    });
  }

  // ===== ANIMATION BLENDING =====

  /**
   * Create animation blend
   */
  createAnimationBlend(config: AnimationBlendConfig): string {
    const id = `blend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const blendConfig: AnimationBlendConfig = {
      id,
      name: config.name || `Blend_${id}`,
      sourceAnimationId: config.sourceAnimationId || '',
      targetAnimationId: config.targetAnimationId || '',
      fromTrackId: config.fromTrackId,
      toTrackId: config.toTrackId,
      targetMesh: config.targetMesh,
      duration: config.duration || 500,
      blendDuration: config.blendDuration || 500,
      blendCurve: config.blendCurve || 'linear',
      blendWeight: config.blendWeight || 1.0,
      easing: config.easing || 'linear',
      onComplete: config.onComplete
    };

    this.animationBlends.set(id, blendConfig);
    return id;
  }

  /**
   * Play animation blend
   */
  playAnimationBlend(blendId: string): boolean {
    const blend = this.animationBlends.get(blendId);
    if (!blend) {
      console.warn(`Animation blend '${SecurityUtils.sanitizeForLog(blendId)}' not found`);
      return false;
    }

    const fromTrack = this.animationTracks.get(blend.fromTrackId!);
    const toTrack = this.animationTracks.get(blend.toTrackId!);

    if (!fromTrack || !toTrack) {
      console.warn('Blend tracks not found');
      return false;
    }

    blend.isPlaying = true;
    blend.startTime = Date.now();
    blend.progress = 0;

    this.activeBlends.add(blendId);

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'blend_started',
      animationId: blendId,
      timestamp: Date.now(),
      data: { blend }
    });

    return true;
  }

  /**
   * Update animation blends
   */
  private updateAnimationBlends(): void {
    const now = Date.now();

    this.activeBlends.forEach(blendId => {
      const blend = this.animationBlends.get(blendId);
      if (!blend || !blend.isPlaying) return;

      const elapsed = now - (blend.startTime || 0);
      blend.progress = Math.min(elapsed / (blend.duration || 500), 1.0);

      if (blend.progress >= 1.0) {
        this.completeAnimationBlend(blendId);
        return;
      }

      // Perform blending
      this.performBlend(blend);
    });
  }

  /**
   * Perform blend operation
   */
  private performBlend(blend: AnimationBlendConfig): void {
    const fromTrack = this.animationTracks.get(blend.fromTrackId!);
    const toTrack = this.animationTracks.get(blend.toTrackId!);

    if (!fromTrack || !toTrack || !blend.targetMesh) return;

    const t = blend.progress || 0;

    // Interpolate between track states
    this.interpolateTrackStates(blend.targetMesh, fromTrack, toTrack, t);
  }

  /**
   * Interpolate between track states
   */
  private interpolateTrackStates(
    mesh: BABYLON.AbstractMesh,
    fromTrack: AnimationTrack,
    toTrack: AnimationTrack,
    t: number
  ): void {
    // Get current states of both tracks
    const fromState = this.getTrackCurrentState(fromTrack);
    const toState = this.getTrackCurrentState(toTrack);

    if (fromState.position && toState.position) {
      mesh.position = BABYLON.Vector3.Lerp(fromState.position, toState.position, t);
    }
    if (fromState.rotation && toState.rotation) {
      mesh.rotation = BABYLON.Vector3.Lerp(fromState.rotation, toState.rotation, t);
    }
    if (fromState.scaling && toState.scaling) {
      mesh.scaling = BABYLON.Vector3.Lerp(fromState.scaling, toState.scaling, t);
    }
  }

  /**
   * Get current state of animation track
   */
  private getTrackCurrentState(track: AnimationTrack): {
    position?: BABYLON.Vector3;
    rotation?: BABYLON.Vector3;
    scaling?: BABYLON.Vector3;
    opacity?: number;
  } {
    const state: any = {};

    if (track.keyframes.length > 0) {
      const firstKeyframe = track.keyframes[0];
      if (firstKeyframe.position) state.position = firstKeyframe.position.clone();
      if (firstKeyframe.rotation) state.rotation = firstKeyframe.rotation.clone();
      if (firstKeyframe.scaling) state.scaling = firstKeyframe.scaling.clone();
      if (firstKeyframe.opacity !== undefined) state.opacity = firstKeyframe.opacity;
    }

    return state;
  }

  /**
   * Complete animation blend
   */
  private completeAnimationBlend(blendId: string): void {
    const blend = this.animationBlends.get(blendId);
    if (!blend) return;

    blend.isPlaying = false;
    this.activeBlends.delete(blendId);

    // Call completion callback
    if (blend.onComplete) {
      blend.onComplete(blend);
    }

    // Emit enhanced event
    this.emitEnhancedEvent({
      type: 'blend_completed',
      animationId: blendId,
      timestamp: Date.now(),
      data: { blend }
    });
  }

  // ===== ENHANCED EVENT SYSTEM =====

  /**
   * Register enhanced event callback
   */
  onEnhancedEvent(callback: (event: EnhancedAnimationEvent) => void): void {
    this.enhancedEventCallbacks.push(callback);
  }

  /**
   * Remove enhanced event callback
   */
  removeEnhancedEventCallback(callback: (event: EnhancedAnimationEvent) => void): void {
    const index = this.enhancedEventCallbacks.indexOf(callback);
    if (index > -1) {
      this.enhancedEventCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit enhanced animation event
   */
  private emitEnhancedEvent(event: EnhancedAnimationEvent): void {
    this.enhancedEventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error: unknown) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        console.error('Enhanced animation event callback error:', SecurityUtils.sanitizeForLog(errorMessage));
      }
    });
  }

  // ===== UPDATED UPDATE LOOP =====

  /**
   * Update loop - called every frame
   */
  private update(): void {
    if (this.isPaused) return;

    // Update sequence logic
    this.updateSequences();

    // Update physics animations
    this.updatePhysicsAnimations();

    // Update animation tracks
    this.updateAnimationTracks();

    // Update animation blends
    this.updateAnimationBlends();

    // Update pool cleanup and optimization
    this.updatePoolManagement();

    // Update any frame-based logic here
    // This could include checking for completed animations, etc.
  }
}
