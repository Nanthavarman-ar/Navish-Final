import React from 'react';

// Minimal icon imports - only ~25 needed for actual features (uniques only)
import {
  // Core/Essential (8 icons)
  Palette, MapPin, Ruler, Layers, RotateCw, Settings, Sun, Undo, ArrowLeftRight, Scale,
  // UI/Tools (4 icons)
  ChevronDown, Search, Key, Play,
  // AI/Automation (5 icons)
  Brain, Wand2, Hand, Mic, Camera,
  // AR/Spatial/Immersive (5 icons)
  Smartphone, Gamepad2, Volume2, Target, Navigation,
  // Simulations/Analysis (6 icons)
  CloudRain, Droplet, Wind, Volume, DollarSign, Gauge, Leaf, AlertTriangle, BarChart3,
  // Tools/Editors (3 icons)
  Edit3, Download, Upload, History, Video,
  // Analytics/Monitoring (3 icons)
  Activity, HardDrive, Bell,
  // Collaboration/Multi-user (3 icons)
  Users, MessageCircle, Share2,
  // Geo/Location (3 icons)
  Map, Anchor,
  // IoT/Smart (2 icons)
  Zap,
  // Other (1 icon)
  HelpCircle,
  // Missing icons with aliases
  RotateCcw as RotateLeft,
  RotateCw as RotateRight,
  Box as Cube,
  Circle as Sphere,
  Pill as Capsule,
  Grid as Iso
} from 'lucide-react';

export interface Feature {
  id: string;
  name: string;
  description: string;
  hotkey?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  enabled?: boolean;
  enabledByDefault?: boolean;
  loading?: boolean;
  error?: string;
  action?: (sceneRef: any, cameraRef: any) => Promise<void>;
}

export type FeaturesByCategory = Record<string, Feature[]>;

export interface FeatureCategory {
  id: string;
  name: string;
}

export const featureCategories: FeaturesByCategory = {
  "Core Workspace": [
    { id: 'showMaterialEditor', name: 'Material Editor', description: 'Edit and apply materials to objects', hotkey: 'M', icon: Palette, category: 'Core Workspace', enabledByDefault: false },
    { id: 'showMinimap', name: 'Minimap', description: 'Display scene overview minimap', hotkey: 'Tab', icon: MapPin, category: 'Core Workspace', enabledByDefault: false },
    { id: 'showMeasurementTool', name: 'Measurement Tool', description: 'Measure distances and dimensions', hotkey: 'T', icon: Ruler, category: 'Core Workspace', enabledByDefault: false },
    { id: 'showBIMIntegration', name: 'BIM Integration', description: 'Load and interact with BIM models', icon: Layers, category: 'Core Workspace', enabledByDefault: false },
    { id: 'showPropertyInspector', name: 'Property Inspector', description: 'Inspect and edit object properties', hotkey: 'P', icon: Settings, category: 'Core Workspace', enabledByDefault: false },
    { id: 'showSceneBrowser', name: 'Scene Browser', description: 'Browse and manage scene assets', icon: Layers, category: 'Core Workspace', enabledByDefault: false },
    { id: 'showLighting', name: 'Lighting Controls', description: 'Adjust scene lighting', hotkey: 'L', icon: Sun, category: 'Core Workspace', enabledByDefault: true },
    { id: 'showUndo', name: 'Undo/Redo', description: 'Undo and redo actions', hotkey: 'Ctrl+Z / Ctrl+Y', icon: Undo, category: 'Core Workspace', enabledByDefault: true },
    { id: 'showMove', name: 'Move Tool', description: 'Move objects in the scene', hotkey: 'W', icon: ArrowLeftRight, category: 'Core Workspace', enabledByDefault: true },
    { id: 'showRotate', name: 'Rotate Tool', description: 'Rotate selected objects', hotkey: 'E', icon: RotateCw, category: 'Core Workspace', enabledByDefault: true },
    { id: 'showScale', name: 'Scale Tool', description: 'Scale objects uniformly', hotkey: 'R', icon: Scale, category: 'Core Workspace', enabledByDefault: true }
  ],
  "UI and Controls": [
    { id: 'showSettings', name: 'Settings', description: 'Application settings', hotkey: 'S', icon: Settings, category: 'UI and Controls', enabledByDefault: true },
    { id: 'showKeyboardShortcuts', name: 'Keyboard Shortcuts', description: 'View keyboard shortcuts', hotkey: '?', icon: Key, category: 'UI and Controls', enabledByDefault: false },
    { id: 'showDomainSelector', name: 'Domain Selector', description: 'Scope the experience to a specific design domain', hotkey: 'D', icon: Map, category: 'UI and Controls', enabledByDefault: false },
    { id: 'showNotificationSystem', name: 'Notifications', description: 'Manage notifications', icon: Bell, category: 'UI and Controls', enabledByDefault: true },
    { id: 'showPresentationManager', name: 'Presentation Mode', description: 'Enter presentation mode', hotkey: 'F5', icon: Play, category: 'UI and Controls', enabledByDefault: false }
  ],
  "AI and Automation": [
    { id: 'showAIAdvisor', name: 'AI Advisor', description: 'Get AI design suggestions', icon: Brain, category: 'AI and Automation', enabledByDefault: false },
    { id: 'showVoiceAssistant', name: 'Voice Assistant', description: 'Control via voice commands', hotkey: 'V', icon: Mic, category: 'AI and Automation', enabledByDefault: false },
    { id: 'showGestureDetection', name: 'Gesture Detection', description: 'Interact using hand gestures', icon: Hand, category: 'AI and Automation', enabledByDefault: false },
    { id: 'showGestureInspector', name: 'Gesture Inspector', description: 'Monitor gesture recognition events', icon: Hand, category: 'AI and Automation', enabledByDefault: false }
  ],
  "AR and Spatial": [
    { id: 'showVR', name: 'VR Mode', description: 'Enter virtual reality mode', hotkey: 'F11', icon: Gamepad2, category: 'AR and Spatial', enabledByDefault: false },
    { id: 'showAR', name: 'AR Mode', description: 'Enter augmented reality mode', icon: Smartphone, category: 'AR and Spatial', enabledByDefault: false },
    { id: 'showSpatialAudio', name: 'Spatial Audio', description: 'Enable 3D spatial audio', icon: Volume2, category: 'AR and Spatial', enabledByDefault: false },
    { id: 'showHaptic', name: 'Haptic Feedback', description: 'Enable haptic vibrations', icon: Gamepad2, category: 'AR and Spatial', enabledByDefault: false },
    { id: 'showARScale', name: 'AR Scale', description: 'Scale objects in AR', icon: Target, category: 'AR and Spatial', enabledByDefault: false },
    { id: 'showTeleportManager', name: 'Teleport Navigation', description: 'Teleport in immersive mode', icon: Navigation, category: 'AR and Spatial', enabledByDefault: false }
  ],
  "Simulations and Analysis": [
    { id: 'showWeather', name: 'Weather Simulation', description: 'Simulate weather conditions', icon: CloudRain, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showFloodSimulation', name: 'Flood Simulation', description: 'Simulate flooding scenarios', icon: Droplet, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showWindTunnelSimulation', name: 'Wind Tunnel Simulation', description: 'Simulate wind effects and airflow', hotkey: 'W', icon: Wind, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showSwimMode', name: 'Underwater Mode', description: 'Enable underwater simulation', icon: Droplet, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showCost', name: 'Cost Estimation', description: 'Estimate project costs', icon: DollarSign, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showBeforeAfter', name: 'Before/After Comparison', description: 'Compare design iterations', icon: Activity, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showROICalculator', name: 'ROI Calculator', description: 'Calculate return on investment', icon: BarChart3, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showDesignReport', name: 'Design Report', description: 'Export a PDF summary with cost and sustainability data', icon: Download, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showMobileHandoff', name: 'View on Phone', description: 'Scan a QR code to open this workspace on your phone', icon: Smartphone, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showApproval', name: 'Design Approval', description: 'Approve this design or request changes', icon: History, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showWalkthroughRecorder', name: 'Record Walkthrough', description: 'Record a video of your camera walkthrough', icon: Video, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showBudgetTiers', name: 'Budget Tiers', description: 'Compare Budget, Standard, and Premium cost tiers', icon: BarChart3, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showClashDetection', name: 'Clash Detection', description: 'Detect model clashes', icon: AlertTriangle, category: 'Simulations and Analysis', enabledByDefault: false },
    { id: 'showSustainabilityCompliancePanel', name: 'Sustainability Analysis', description: 'Analyze sustainability compliance', icon: Leaf, category: 'Simulations and Analysis', enabledByDefault: false }
  ],
  "Tools and Editors": [
    { id: 'showExport', name: 'Export', description: 'Export scene data', hotkey: 'E', icon: Download, category: 'Tools and Editors', enabledByDefault: true },
    { id: 'showImport', name: 'Import', description: 'Import models and data', hotkey: 'I', icon: Upload, category: 'Tools and Editors', enabledByDefault: true },
    { id: 'showHelpSupport', name: 'Help & Support', description: 'Access help documentation', hotkey: 'F1', icon: HelpCircle, category: 'Tools and Editors', enabledByDefault: true },
    { id: 'showAnnotations', name: 'Annotations', description: 'Add and share annotations', hotkey: 'N', icon: Edit3, category: 'Tools and Editors', enabledByDefault: false },
    { id: 'showVersionHistory', name: 'Version History', description: 'View and restore previous saves', icon: History, category: 'Tools and Editors', enabledByDefault: false }
  ],
  "Auto Furnish & AR Anchor": [
    { id: 'showAutoFurnish', name: 'Auto Furnish', description: 'Automatically furnish spaces with AI', icon: Wand2, category: 'Auto Furnish & AR Anchor', enabledByDefault: false },
    { id: 'showAR', name: 'AR Mode', description: 'Enter augmented reality mode', icon: Smartphone, category: 'Auto Furnish & AR Anchor', enabledByDefault: false },
    { id: 'showCloudAnchorManager', name: 'Cloud Anchors', description: 'Manage shared AR cloud anchors', icon: Anchor, category: 'Auto Furnish & AR Anchor', enabledByDefault: false }
  ],
  "Audio and Multimedia": [
    { id: 'showVoiceChat', name: 'Voice Chat', description: 'Enable voice communication', icon: Mic, category: 'Audio and Multimedia', enabledByDefault: false },
    { id: 'showSpatialAudio', name: 'Spatial Audio', description: 'Enable 3D spatial audio', icon: Volume2, category: 'Audio and Multimedia', enabledByDefault: false }
  ],
  "Collaboration and Multi-user": [
    { id: 'showMultiUser', name: 'Multi-User Collaboration', description: 'Enable real-time multi-user editing', icon: Users, category: 'Collaboration and Multi-user', enabledByDefault: false },
    { id: 'showChat', name: 'Chat', description: 'In-app messaging for collaboration', icon: MessageCircle, category: 'Collaboration and Multi-user', enabledByDefault: false },
    { id: 'showSharing', name: 'Sharing', description: 'Share scenes and models', icon: Share2, category: 'Collaboration and Multi-user', enabledByDefault: false },
    { id: 'showCollabManager', name: 'Collaboration Manager', description: 'Manage collaborative sessions', icon: Users, category: 'Collaboration and Multi-user', enabledByDefault: false }
  ],
  "Geo and Location": [
    { id: 'showGeoLocation', name: 'Geo-Location', description: 'Use device GPS location', icon: Map, category: 'Geo and Location', enabledByDefault: false },
    { id: 'showGeoSync', name: 'Geo Sync', description: 'Synchronize with geographic data', icon: Navigation, category: 'Geo and Location', enabledByDefault: false }
  ]
};

export const featureCategoriesArray = Object.values(featureCategories).flat();
export const FEATURE_CATEGORIES = Object.keys(featureCategories);
