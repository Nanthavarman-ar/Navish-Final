export interface Feature {
  id: string;
  name: string;
  description: string;
  category: 'rendering' | 'physics' | 'network' | 'ui' | 'performance' | 'ai' | 'iot' | 'interaction' | 'marketing' | 'metaverse';
  defaultEnabled: boolean;
  requiresCapability?: string[];
  performanceImpact: 'low' | 'medium' | 'high';
  dependencies?: string[];
  settings?: Record<string, any>;
}

export interface DeviceCapabilities {
  webgl: boolean;
  webgl2: boolean;
  webxr: boolean;
  webrtc: boolean;
  webassembly: boolean;
  gpuMemory: number; // MB
  cpuCores: number;
  ram: number; // MB
  networkType: 'slow' | 'fast' | 'unknown';
  batteryLevel?: number;
  touchEnabled: boolean;
  mobile: boolean;
}

export interface FeatureState {
  enabled: boolean;
  settings: Record<string, any>;
  lastModified: number;
  reason?: string;
}

export class FeatureManager {
  private features: Map<string, Feature> = new Map();
  private featureStates: Map<string, FeatureState> = new Map();
  private deviceCapabilities: DeviceCapabilities;
  private userPreferences: Map<string, any> = new Map();
  private listeners: Map<string, ((featureId: string, enabled: boolean) => void)[]> = new Map();

  constructor(deviceCapabilities: DeviceCapabilities) {
    this.deviceCapabilities = deviceCapabilities;
    this.initializeDefaultFeatures();
    this.loadUserPreferences();
  }

  // Initialize default features
  private initializeDefaultFeatures(): void {
    const defaultFeatures: Feature[] = [
      {
        id: 'physics',
        name: 'Physics Engine',
        description: 'Enable physics simulation for realistic object interactions',
        category: 'physics',
        defaultEnabled: true,
        requiresCapability: ['webassembly'],
        performanceImpact: 'high',
        settings: {
          gravity: -9.81,
          substeps: 1,
          fixedTimeStep: 1/60
        }
      },
      {
        id: 'shadows',
        name: 'Dynamic Shadows',
        description: 'Enable real-time shadow casting and receiving',
        category: 'rendering',
        defaultEnabled: true,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium',
        settings: {
          shadowMapSize: 1024,
          shadowQuality: 'medium'
        }
      },
      {
        id: 'postprocessing',
        name: 'Post-Processing Effects',
        description: 'Enable visual effects like bloom, depth of field',
        category: 'rendering',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'high',
        settings: {
          bloomEnabled: false,
          dofEnabled: false,
          ssaoEnabled: false
        }
      },
      {
        id: 'vr_ar',
        name: 'VR/AR Support',
        description: 'Enable virtual and augmented reality features',
        category: 'rendering',
        defaultEnabled: false,
        requiresCapability: ['webxr'],
        performanceImpact: 'high',
        dependencies: ['webgl2']
      },
      {
        id: 'network_sync',
        name: 'Network Synchronization',
        description: 'Enable real-time multi-user synchronization',
        category: 'network',
        defaultEnabled: true,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        settings: {
          syncInterval: 100,
          compressionEnabled: true
        }
      },
      {
        id: 'voice_chat',
        name: 'Voice Chat',
        description: 'Enable voice communication between users',
        category: 'network',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'medium',
        dependencies: ['network_sync']
      },
      {
        id: 'high_quality_textures',
        name: 'High Quality Textures',
        description: 'Use higher resolution textures for better visual quality',
        category: 'rendering',
        defaultEnabled: false,
        performanceImpact: 'high',
        settings: {
          maxTextureSize: 2048,
          mipmapEnabled: true
        }
      },
      {
        id: 'particle_effects',
        name: 'Particle Effects',
        description: 'Enable particle systems for special effects',
        category: 'rendering',
        defaultEnabled: true,
        performanceImpact: 'medium',
        settings: {
          maxParticles: 1000,
          textureAtlasSize: 512
        }
      },
      {
        id: 'advanced_materials',
        name: 'Advanced Materials',
        description: 'Enable PBR materials and advanced shading',
        category: 'rendering',
        defaultEnabled: true,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium'
      },
      {
        id: 'performance_monitoring',
        name: 'Performance Monitoring',
        description: 'Monitor and display performance metrics',
        category: 'performance',
        defaultEnabled: true,
        performanceImpact: 'low',
        settings: {
          fpsDisplay: true,
          memoryDisplay: false,
          networkDisplay: false
        }
      },
      // AI & Smart Design Features
      {
        id: 'ai_co_designer',
        name: 'AI Co-Designer',
        description: 'Natural language commands for design changes',
        category: 'ai',
        defaultEnabled: true,
        requiresCapability: ['webrtc'],
        performanceImpact: 'medium',
        settings: {
          voiceCommands: true,
          textCommands: true,
          autoFurnish: true,
          styleSuggestions: true
        }
      },
      {
        id: 'auto_furnish',
        name: 'Auto-Furnish Mode',
        description: 'AI places realistic furniture procedurally',
        category: 'ai',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'high',
        dependencies: ['ai_co_designer'],
        settings: {
          furnitureDensity: 'medium',
          style: 'modern',
          budget: 'medium'
        }
      },
      {
        id: 'sunlight_analysis',
        name: 'AI Sunlight Analysis',
        description: 'Simulate sunlight with heatmaps',
        category: 'ai',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium',
        settings: {
          timeOfDay: 12,
          season: 'summer',
          yearRound: false,
          heatmapResolution: 512
        }
      },
      {
        id: 'sound_simulation',
        name: 'AI Sound Simulation',
        description: 'Predict acoustics and noise levels',
        category: 'ai',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'medium',
        settings: {
          roomType: 'office',
          noiseSources: [],
          frequencyRange: [20, 20000]
        }
      },
      // IoT Integration Features
      {
        id: 'iot_live_feeds',
        name: 'IoT Live Data Feeds',
        description: 'Connect to building sensors in real-time',
        category: 'iot',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        settings: {
          sensorTypes: ['temperature', 'humidity', 'motion'],
          updateInterval: 1000,
          dataRetention: 3600000 // 1 hour
        }
      },
      {
        id: 'smart_home_simulation',
        name: 'Smart Home Simulation',
        description: 'Control devices like AC, lighting, curtains',
        category: 'iot',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        dependencies: ['iot_live_feeds'],
        settings: {
          deviceTypes: ['lights', 'climate', 'security'],
          automationRules: [],
          energyTracking: true
        }
      },
      {
        id: 'energy_simulation',
        name: 'Energy Simulation',
        description: 'Visualize power consumption and sustainability',
        category: 'iot',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium',
        dependencies: ['iot_live_feeds'],
        settings: {
          metrics: ['consumption', 'efficiency', 'carbon'],
          timeRange: 'daily',
          visualization: 'heatmap'
        }
      },
      // Immersive Interaction Features
      {
        id: 'avatar_tracking',
        name: 'Full-body Avatar Tracking',
        description: 'Realistic avatar control with webcam/VR',
        category: 'interaction',
        defaultEnabled: false,
        requiresCapability: ['webxr', 'webrtc'],
        performanceImpact: 'high',
        settings: {
          trackingMode: 'webcam', // webcam, vr, ar
          bodyParts: ['head', 'hands', 'torso'],
          calibration: false
        }
      },
      {
        id: 'hand_tracking',
        name: 'Hand Tracking in AR/VR',
        description: 'Pinch, grab, and push virtual objects',
        category: 'interaction',
        defaultEnabled: false,
        requiresCapability: ['webxr'],
        performanceImpact: 'high',
        dependencies: ['avatar_tracking'],
        settings: {
          gestureRecognition: true,
          hapticFeedback: true,
          precision: 'high'
        }
      },
      {
        id: 'voice_gesture_commands',
        name: 'Voice + Gesture Commands',
        description: 'Combine speech and gestures for interaction',
        category: 'interaction',
        defaultEnabled: false,
        requiresCapability: ['webrtc', 'webxr'],
        performanceImpact: 'medium',
        settings: {
          voiceActivation: 'hey_naviz',
          gestureCommands: ['point', 'wave', 'grab'],
          multiModal: true
        }
      },
      // Advanced Visualization Features
      {
        id: 'path_tracing',
        name: 'Real-time Path Tracing',
        description: 'Photoreal rendering with WebGPU',
        category: 'rendering',
        defaultEnabled: false,
        requiresCapability: ['webgpu'],
        performanceImpact: 'high',
        settings: {
          bounces: 4,
          samples: 16,
          denoiser: true
        }
      },
      {
        id: 'volumetric_effects',
        name: 'Volumetric Effects',
        description: 'Add smoke, fog, fire, and god rays',
        category: 'rendering',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'high',
        settings: {
          effects: ['fog', 'smoke', 'fire', 'godrays'],
          quality: 'medium',
          density: 0.5
        }
      },
      {
        id: 'ai_texture_upscaling',
        name: 'AI Texture Upscaling',
        description: 'Enhance low-resolution textures with AI',
        category: 'rendering',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium',
        settings: {
          upscalingFactor: 2,
          quality: 'high',
          format: 'webp'
        }
      },
      {
        id: 'foveated_rendering',
        name: 'Eye-tracking Foveated Rendering',
        description: 'Optimize rendering based on gaze',
        category: 'rendering',
        defaultEnabled: false,
        requiresCapability: ['webxr'],
        performanceImpact: 'medium',
        settings: {
          foveaSize: 0.1,
          peripheralQuality: 0.5,
          eyeTracking: true
        }
      },
      // Collaboration Features
      {
        id: 'massive_sessions',
        name: 'Massive Sessions',
        description: 'Support 100+ users simultaneously',
        category: 'network',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'high',
        dependencies: ['network_sync'],
        settings: {
          maxUsers: 100,
          syncDelay: 500,
          compression: true
        }
      },
      {
        id: 'presenter_mode',
        name: 'Presenter Mode',
        description: 'Guide walkthroughs for all participants',
        category: 'network',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'medium',
        dependencies: ['massive_sessions'],
        settings: {
          presenterControls: true,
          audienceView: false,
          recording: false
        }
      },
      {
        id: 'multi_user_editing',
        name: 'Multi-user Editing',
        description: 'Real-time collaborative editing with conflict resolution',
        category: 'network',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'medium',
        dependencies: ['massive_sessions'],
        settings: {
          conflictResolution: 'last_write_wins',
          userPermissions: 'equal',
          editLocking: false
        }
      },
      {
        id: 'annotation_export',
        name: 'Annotation Export',
        description: 'Export comments and markups as PDF',
        category: 'network',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        settings: {
          exportFormat: 'pdf',
          includeScreenshots: true,
          markupTypes: ['comments', 'highlights', 'measurements']
        }
      },
      // Marketing & Engagement Features
      {
        id: 'vr_showroom',
        name: 'VR Showroom Mode',
        description: 'Present buildings like a showroom',
        category: 'marketing',
        defaultEnabled: false,
        requiresCapability: ['webxr'],
        performanceImpact: 'medium',
        settings: {
          guidedTour: true,
          highlightPoints: [],
          ambientAudio: true
        }
      },
      {
        id: 'gamified_bidding',
        name: 'Gamified Bidding/Booking',
        description: 'Interactive apartment/floor reservation',
        category: 'marketing',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        settings: {
          biddingMode: 'auction',
          timeLimit: 300000, // 5 minutes
          reservePrice: 0
        }
      },
      {
        id: 'lead_capture',
        name: 'Lead Capture Integration',
        description: 'Collect client data during walkthroughs',
        category: 'marketing',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        settings: {
          dataFields: ['name', 'email', 'phone', 'preferences'],
          consentRequired: true,
          followUp: true
        }
      },
      {
        id: 'story_mode',
        name: 'Story Mode Walkthrough',
        description: 'Scripted sequences with cinematic effects',
        category: 'marketing',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium',
        settings: {
          scripts: [],
          transitions: 'fade',
          audioNarration: true
        }
      },
      // Metaverse & Future Tech Features
      {
        id: 'nft_integration',
        name: 'NFT Integration',
        description: 'Tokenize properties for digital ownership',
        category: 'metaverse',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'low',
        settings: {
          blockchain: 'ethereum',
          tokenStandard: 'erc721',
          marketplace: true
        }
      },
      {
        id: 'virtual_marketplace',
        name: 'Virtual Marketplace',
        description: 'Buy/sell 3D assets within platform',
        category: 'metaverse',
        defaultEnabled: false,
        requiresCapability: ['webrtc'],
        performanceImpact: 'medium',
        dependencies: ['nft_integration'],
        settings: {
          assetTypes: ['furniture', 'textures', 'models'],
          paymentMethods: ['crypto', 'fiat'],
          escrow: true
        }
      },
      {
        id: 'cross_metaverse_export',
        name: 'Cross-Metaverse Export',
        description: 'Export to Unreal, Unity, Decentraland',
        category: 'metaverse',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'medium',
        settings: {
          targetPlatforms: ['unreal', 'unity', 'decentraland'],
          optimization: true,
          compression: 'draco'
        }
      },
      {
        id: 'ai_future_cities',
        name: 'AI-generated Future Cities',
        description: 'Procedurally generate futuristic neighborhoods',
        category: 'ai',
        defaultEnabled: false,
        requiresCapability: ['webgl2'],
        performanceImpact: 'high',
        settings: {
          citySize: 'medium',
          style: 'cyberpunk',
          density: 'high'
        }
      }
    ];

    defaultFeatures.forEach(feature => {
      this.registerFeature(feature);
    });
  }

  // Register a new feature
  registerFeature(feature: Feature): void {
    this.features.set(feature.id, feature);

    // Initialize feature state
    const state: FeatureState = {
      enabled: this.shouldEnableFeature(feature),
      settings: { ...feature.settings },
      lastModified: Date.now()
    };

    this.featureStates.set(feature.id, state);
  }

  // Check if a feature should be enabled based on capabilities and dependencies
  private shouldEnableFeature(feature: Feature): boolean {
    // Check device capabilities
    if (feature.requiresCapability) {
      for (const cap of feature.requiresCapability) {
        if (!this.deviceCapabilities[cap as keyof DeviceCapabilities]) {
          return false;
        }
      }
    }

    // Check dependencies
    if (feature.dependencies) {
      for (const dep of feature.dependencies) {
        const depState = this.featureStates.get(dep);
        if (!depState || !depState.enabled) {
          return false;
        }
      }
    }

    // Check performance constraints
    if (this.deviceCapabilities.mobile && feature.performanceImpact === 'high') {
      return false;
    }

    if (this.deviceCapabilities.ram < 2048 && feature.performanceImpact === 'high') {
      return false;
    }

    return feature.defaultEnabled;
  }

  // Enable or disable a feature
  setFeatureEnabled(featureId: string, enabled: boolean, reason?: string): boolean {
    const feature = this.features.get(featureId);
    const state = this.featureStates.get(featureId);

    if (!feature || !state) {
      console.warn(`Feature ${featureId} not found`);
      return false;
    }

    // Check dependencies
    if (enabled && feature.dependencies) {
      for (const dep of feature.dependencies) {
        if (!this.isFeatureEnabled(dep)) {
          console.warn(`Cannot enable ${featureId}: dependency ${dep} is not enabled`);
          return false;
        }
      }
    }

    // Check capabilities
    if (enabled && feature.requiresCapability) {
      for (const cap of feature.requiresCapability) {
        if (!this.deviceCapabilities[cap as keyof DeviceCapabilities]) {
          console.warn(`Cannot enable ${featureId}: required capability ${cap} not available`);
          return false;
        }
      }
    }

    state.enabled = enabled;
    state.lastModified = Date.now();
    if (reason) {
      state.reason = reason;
    }

    // Notify listeners
    this.notifyFeatureChange(featureId, enabled);

    // Save to user preferences
    this.saveUserPreferences();

    return true;
  }

  // Check if a feature is enabled
  isFeatureEnabled(featureId: string): boolean {
    const state = this.featureStates.get(featureId);
    return state ? state.enabled : false;
  }

  // Get feature settings
  getFeatureSettings(featureId: string): Record<string, any> | null {
    const state = this.featureStates.get(featureId);
    return state ? state.settings : null;
  }

  // Update feature settings
  updateFeatureSettings(featureId: string, settings: Record<string, any>): boolean {
    const state = this.featureStates.get(featureId);
    if (!state) {
      return false;
    }

    state.settings = { ...state.settings, ...settings };
    state.lastModified = Date.now();

    this.saveUserPreferences();
    return true;
  }

  // Get all features by category
  getFeaturesByCategory(category: Feature['category']): Feature[] {
    return Array.from(this.features.values()).filter(f => f.category === category);
  }

  // Get all enabled features
  getEnabledFeatures(): Feature[] {
    return Array.from(this.features.values()).filter(f => this.isFeatureEnabled(f.id));
  }

  // Get device capabilities
  getDeviceCapabilities(): DeviceCapabilities {
    return { ...this.deviceCapabilities };
  }

  // Update device capabilities (useful for dynamic changes)
  updateDeviceCapabilities(capabilities: Partial<DeviceCapabilities>): void {
    this.deviceCapabilities = { ...this.deviceCapabilities, ...capabilities };

    // Re-evaluate all features
    this.features.forEach(feature => {
      const shouldEnable = this.shouldEnableFeature(feature);
      const currentState = this.featureStates.get(feature.id);

      if (currentState && currentState.enabled !== shouldEnable) {
        this.setFeatureEnabled(feature.id, shouldEnable, 'capability_change');
      }
    });
  }

  // Add feature change listener
  addFeatureListener(featureId: string, callback: (featureId: string, enabled: boolean) => void): void {
    if (!this.listeners.has(featureId)) {
      this.listeners.set(featureId, []);
    }
    this.listeners.get(featureId)!.push(callback);
  }

  // Remove feature change listener
  removeFeatureListener(featureId: string, callback: (featureId: string, enabled: boolean) => void): void {
    const listeners = this.listeners.get(featureId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Notify listeners of feature changes
  private notifyFeatureChange(featureId: string, enabled: boolean): void {
    const listeners = this.listeners.get(featureId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(featureId, enabled);
        } catch (error) {
          console.error('Error in feature listener:', error);
        }
      });
    }
  }

  // Load user preferences from localStorage
  private loadUserPreferences(): void {
    try {
      const stored = localStorage.getItem('babylon_feature_preferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        this.userPreferences = new Map(Object.entries(preferences));

        // Apply stored preferences
        this.userPreferences.forEach((value, key) => {
          if (typeof value === 'boolean') {
            this.setFeatureEnabled(key, value, 'user_preference');
          } else if (typeof value === 'object') {
            this.updateFeatureSettings(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load user preferences:', error);
    }
  }

  // Save user preferences to localStorage
  private saveUserPreferences(): void {
    try {
      const preferences: Record<string, any> = {};

      this.featureStates.forEach((state, featureId) => {
        preferences[featureId] = {
          enabled: state.enabled,
          settings: state.settings
        };
      });

      localStorage.setItem('babylon_feature_preferences', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save user preferences:', error);
    }
  }

  // Get performance profile based on device capabilities
  getPerformanceProfile(): 'low' | 'medium' | 'high' {
    const { gpuMemory, cpuCores, ram, mobile } = this.deviceCapabilities;

    if (mobile || ram < 4096 || gpuMemory < 512 || cpuCores < 4) {
      return 'low';
    } else if (ram < 8192 || gpuMemory < 1024 || cpuCores < 8) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  // Optimize features based on performance profile
  optimizeForPerformance(): void {
    const profile = this.getPerformanceProfile();
    const reason = `performance_optimization_${profile}`;

    this.features.forEach(feature => {
      let shouldEnable = true;

      if (profile === 'low' && feature.performanceImpact === 'high') {
        shouldEnable = false;
      } else if (profile === 'medium' && feature.performanceImpact === 'high') {
        // Keep some high-impact features for medium profile
        shouldEnable = feature.defaultEnabled;
      }

      if (this.isFeatureEnabled(feature.id) !== shouldEnable) {
        this.setFeatureEnabled(feature.id, shouldEnable, reason);
      }
    });
  }

  // Reset all features to defaults
  resetToDefaults(): void {
    this.features.forEach(feature => {
      const shouldEnable = this.shouldEnableFeature(feature);
      this.setFeatureEnabled(feature.id, shouldEnable, 'reset_to_defaults');

      // Reset settings
      const state = this.featureStates.get(feature.id);
      if (state) {
        state.settings = { ...feature.settings };
      }
    });

    this.saveUserPreferences();
  }

  // Get feature information
  getFeature(featureId: string): Feature | null {
    return this.features.get(featureId) || null;
  }

  // Get all features
  getAllFeatures(): Feature[] {
    return Array.from(this.features.values());
  }

  // Dispose and cleanup
  dispose(): void {
    this.listeners.clear();
    this.features.clear();
    this.featureStates.clear();
    this.userPreferences.clear();
  }
}
