export interface ToolPageDefinition {
  title: string;
  description: string;
  focus?: string;
  highlights?: string[];
  status?: string;
  // The real BabylonWorkspace feature flag (initialFeatureStates key) this tool maps
  // to, if one exists and is genuinely wired up (has a working panel or a real effect
  // on the 3D scene) - drives the "Open in Workspace" button on ToolPage.tsx. Left
  // unset for tools that describe a capability with no live equivalent yet (verified
  // against a full audit of all ~60 feature flags, not guessed), rather than pointing
  // at a flag that would silently do nothing when enabled.
  workspaceFeature?: string;
}

export const toolPageDefinitions: Record<string, ToolPageDefinition> = {
  'flood-simulation': {
    title: 'Flood Simulation',
    description: 'Model floodplains, rainfall, and water build-up inside NAVIZ to test resilience strategies.',
    focus: 'Use this tool while the Babylon workspace is active to compare barrier placements and drainage fixes.',
    status: 'Workspace-only feature',
    workspaceFeature: 'showFloodSimulation',
    highlights: [
      'Visualize rising water levels and flow direction',
      'Adjust retention walls and containment zones',
      'Capture snapshots for stakeholder review'
    ]
  },
  'wind-tunnel-simulation': {
    title: 'Wind Tunnel Simulation',
    description: 'Run aerodynamic tests on building masses to understand pressure and force distribution.',
    focus: 'Enable different wind speeds and angles to see how your form reacts in real-time.',
    status: 'Simulation module',
    workspaceFeature: 'showWindTunnelSimulation',
    highlights: [
      'Sweep through low/medium/high wind speeds',
      'Render particle trails for visualization',
      'Compare structural load scenarios with one click'
    ]
  },
  'noise-simulation': {
    title: 'Noise Simulation',
    description: 'Analyze sound diffusion across spaces and identify hotspots of excessive noise.',
    focus: 'Combine source placement with material absorption to optimize comfort.',
    status: 'Acoustic analysis',
    workspaceFeature: 'showSoundPrivacySimulation',
    highlights: [
      'Map dB levels on the scene geometry',
      'Toggle people simulations to add vitality',
      'Export heatmaps or audio-guided walkthroughs'
    ]
  },
  'circulation-flow-simulation': {
    title: 'Circulation Flow Simulation',
    description: 'Model pedestrian movement to optimize wayfinding, queuing, and evacuation paths.',
    focus: 'Adjust entrance/exit points and observe density change in real-time.',
    status: 'Immersive simulation',
    workspaceFeature: 'showCirculationFlowSimulation',
    highlights: [
      'Set density thresholds per zone',
      'Visualize walking speeds and congestion',
      'Capture simulation reports for planners'
    ]
  },
  'cost-estimator': {
    title: 'Cost Estimator',
    description: 'Estimate materials and labor costs based on selected meshes and quantities.',
    focus: 'Sync with your material library to keep budgets updated as designs evolve.',
    status: 'Estimator dashboard',
    workspaceFeature: 'showCost',
    highlights: [
      'Automatic quantity take-offs from scene geometry',
      'Scenario comparison (baseline vs optimized)',
      'Export editable CSV or PDF summaries'
    ]
  },
  'measure-tool': {
    title: 'Measure Tool',
    description: 'Capture distances, angles, and areas to verify compliance with design standards.',
    focus: 'Drop markers or use smart snapping to measure irregular forms.',
    status: 'Essential utilities',
    workspaceFeature: 'showMeasurementTool',
    highlights: [
      'Switch between metric and imperial units',
      'Record measurement history for reports',
      'Annotate directly on panels before sharing'
    ]
  },
  'energy-analysis': {
    title: 'Energy Analysis',
    description: 'Monitor simulated energy usage, HVAC loads, and efficiencies.',
    focus: 'Couple HVAC zones with schedules to understand peak demand.',
    status: 'Performance insight',
    workspaceFeature: 'showEnergyDashboard',
    highlights: [
      'Map energy use intensity per floor',
      'Compare baseline vs passive strategies',
      'Export optimization recommendations'
    ]
  },
  'sunlight-analysis': {
    title: 'Sunlight Analysis',
    description: 'Study daylight penetration, solar heat gain, and shadow casting.',
    focus: 'Slide time-of-day and date to observe seasonal sun paths.',
    status: 'Daylight toolset',
    workspaceFeature: 'showSunStudy',
    highlights: [
      'Animate sun path for any latitude',
      'Highlight critical shading zones',
      'Quantify useful daylight illuminance'
    ]
  },
  'shadow-impact-analysis': {
    title: 'Shadow Impact Analysis',
    description: 'Compare neighboring shadow envelopes to protect daylight rights.',
    focus: 'Overlay shadow diagrams over multiple time ranges.',
    status: 'Urban design support',
    workspaceFeature: 'showShadowImpactAnalysis',
    highlights: [
      'Capture before/after shadow overlays',
      'Export images for planning submissions',
      'Run diurnal studies across seasons'
    ]
  },
  'ergonomic-testing': {
    title: 'Ergonomic Testing',
    description: 'Evaluate human scale, reach, and interaction comfort within your space.',
    focus: 'Use skeletal mannequins to validate circulation and workstation layouts.',
    status: 'Comfort assessment',
    workspaceFeature: 'showErgonomicTesting',
    highlights: [
      'Simulate sitting/standing postures',
      'Measure task-plane heights and reach zones',
      'Generate accessibility compliance reports'
    ]
  },
  'ai-structural-advisor': {
    title: 'AI Structural Advisor',
    description: 'Let the AI analyze your load paths and suggest bracing strategies.',
    focus: 'Run context-aware checks while you model to avoid overstressing members.',
    status: 'AI assistance',
    workspaceFeature: 'showAIStructuralAdvisor',
    highlights: [
      'Receive reinforcement suggestions quickly',
      'Compare material alternatives',
      'Document decisions with audit-friendly notes'
    ]
  },
  'ai-co-designer': {
    title: 'AI Co-Designer',
    description: 'Collaborate with the AI to explore stylistic and spatial possibilities.',
    focus: 'Share a concept and let the assistant generate complementary options.',
    status: 'Creative partner',
    workspaceFeature: 'showAICoDesigner',
    highlights: [
      'Sketch prompts or upload inspiration',
      'Generate multiple design options simultaneously',
      'Accept, modify, or bookmark suggestions'
    ]
  },
  'ai-voice-assistant': {
    title: 'AI Voice Assistant',
    description: 'Interact with NAVIZ by voice to toggle features, ask for stats, or play back walkthroughs.',
    focus: 'Say “Show energy usage” or “Toggle flood sim” to control the workspace hands-free.',
    status: 'Conversational control',
    workspaceFeature: 'showVoiceAssistant',
    highlights: [
      'Natural language commands over workspace data',
      'Audio confirmations and status updates',
      'Fall-back text controls for quieter environments'
    ]
  },
  'auto-furnish': {
    title: 'Auto-Furnish',
    description: 'Populate rooms with context-aware furniture layouts.',
    focus: 'Set program criteria and let NAVIZ rapidly furnish the space.',
    status: 'AI-powered utility',
    workspaceFeature: 'showAutoFurnish',
    highlights: [
      'Drag-and-drop suggestions from curated libraries',
      'Balance circulation with storage needs',
      'Export layout boards with specs'
    ]
  },
  'weather-system': {
    title: 'Weather System',
    description: 'Simulate rain, snow, sun, and winds to understand exposure.',
    focus: 'Use weather presets or your own climate data to test strategies.',
    status: 'Environmental context',
    workspaceFeature: 'showWeather',
    highlights: [
      'Layer particle systems for precipitation',
      'Tie lighting presets to cloud cover',
      'Share recordings with remote stakeholders'
    ]
  },
  'site-context-generator': {
    title: 'Site Context Generator',
    description: 'Bring surrounding buildings, streets, and topography into your canvas.',
    focus: 'Sketch site boundaries and watch NAVIZ populate context massing.',
    status: 'Urban integration',
    workspaceFeature: 'showSiteContextGenerator',
    highlights: [
      'Import GIS meshes or draw footprints',
      'Auto-generate vehicular/pedestrian zones',
      'Balance new massing with existing fabric'
    ]
  },
  'topography-generator': {
    title: 'Topography Generator',
    description: 'Shape terrain, berms, and landscape features interactively.',
    focus: 'Blend imported survey data with parametric manipulations.',
    status: 'Landscape modeling',
    workspaceFeature: 'showTopographyGenerator',
    highlights: [
      'Sculpt hills, terraces, and retaining walls',
      'Preview water runoff and flow paths',
      'Synchronize with drainage analysis tools'
    ]
  },
  'geo-location-context': {
    title: 'Geo Location Context',
    description: 'Link designs to real-world coordinates for planning and navigation.',
    focus: 'Snap to latitude/longitude and adjust anchors for AR tours.',
    status: 'Site intelligence',
    workspaceFeature: 'showGeoLocation',
    highlights: [
      'Use GPS anchors for field verification',
      'Share geo-referenced bookmarks with the team',
      'Validate orientation against cardinal directions'
    ]
  },
  'construction-overlay': {
    title: 'Construction Overlay',
    description: 'Overlay phasing visuals to coordinate construction documentation.',
    focus: 'Sequence trades and see dependencies at a glance.',
    status: 'Program coordination',
    workspaceFeature: 'showConstructionOverlay',
    highlights: [
      'Stage-by-stage visibility toggles',
      'Export overlay PDFs for contractors',
      'Link to issue tracking for follow-up'
    ]
  },
  'bim-integration': {
    title: 'BIM Integration',
    description: 'Bring NAVIZ into the BIM workflow with federated model coordination.',
    focus: 'Sync geometry, metadata, and clash checks with Revit/IFC sources.',
    status: 'Federated modeling',
    workspaceFeature: 'showBIMIntegration',
    highlights: [
      'Link building elements to external BIM IDs',
      'Run clash analysis and visualize results',
      'Back-populate changes to the central model repository'
    ]
  },
  'material-manager': {
    title: 'Material Manager',
    description: 'Author, compare, and apply materials across the workspace.',
    focus: 'Use presets or create custom composites with embedded performance data.',
    status: 'Material governance',
    // No standalone "material manager" panel exists - the real UI for this is the
    // Material Editor, which the manager class backs.
    workspaceFeature: 'showMaterialEditor',
    highlights: [
      'Track sustainability metadata per material',
      'Swap textures globally with one click',
      'Publish approved libraries to collaborators'
    ]
  },
  'vr-ar-mode': {
    title: 'VR/AR Mode',
    description: 'Enter immersive navigation using VR headsets or AR devices.',
    focus: 'Toggle your headset and let operators inspect the model naturally.',
    status: 'Immersive experience',
    workspaceFeature: 'showVR',
    highlights: [
      'Hand-tracking hand-offs for gestures',
      'Teleport or walk through spaces',
      'Review annotated checkpoints in situ'
    ]
  },
  'hand-tracking': {
    title: 'Hand Tracking',
    description: 'Use gestures to select, move, and manipulate content.',
    focus: 'Pair with your XR device to work without controllers.',
    status: 'XR control',
    workspaceFeature: 'showGestureDetection',
    highlights: [
      'Pinch/grab interactions with meshes',
      'Custom gesture shortcuts for repeat tasks',
      'Haptic confirmation when enabled'
    ]
  },
  'multi-user': {
    title: 'Multi-User Collaboration',
    description: 'Invite teammates into the same scene to co-review design options.',
    focus: 'Share voice, annotations, and live pointers.',
    status: 'Collaboration hub',
    workspaceFeature: 'showMultiUser',
    highlights: [
      'Assign roles (editor/viewer/admin)',
      'Pass control of the camera',
      'Record session notes automatically'
    ]
  },
  'voice-chat': {
    title: 'Voice Chat',
    description: 'Communicate with teammates without leaving NAVIZ.',
    focus: 'Activate push-to-talk or permanent mic for stand-ups.',
    status: 'Communication',
    workspaceFeature: 'showVoiceChat',
    highlights: [
      'Spatialized audio tied to avatar positions',
      'Mute/unmute per participant',
      'Log chat transcripts for traceability'
    ]
  },
  'presenter-mode': {
    title: 'Presenter Mode',
    description: 'Package guided tours with curated viewpoints and narration.',
    focus: 'Control the audience experience while locking interactions.',
    status: 'Presentation toolkit',
    workspaceFeature: 'showPresenterMode',
    highlights: [
      'Trigger automatic panning sequences',
      'Overlay talking points and captions',
      'Deliver timed reveals for dramatic effect'
    ]
  },
  'annotations': {
    title: 'Annotations',
    description: 'Pin notes, markups, and issue tags to any object.',
    focus: 'Assign actions to teammates directly from within NAVIZ.',
    status: 'Design feedback',
    workspaceFeature: 'showAnnotations',
    highlights: [
      'Add voice or text notes',
      'Track resolution status',
      'Export annotated reports'
    ]
  },
  'property-inspector': {
    title: 'Property Inspector',
    description: 'Inspect mesh metadata, materials, and engineering data.',
    focus: 'Audit object parameters and ensure compliance.',
    workspaceFeature: 'showPropertyInspector',
    highlights: [
      'Custom property groups per discipline',
      'Inline editing with live validation',
      'History log for every change'
    ]
  },
  'scene-browser': {
    title: 'Scene Browser',
    description: 'Navigate the scene hierarchy and isolate components quickly.',
    focus: 'Search by name, tag, or metadata and toggle visibility.',
    workspaceFeature: 'showSceneBrowser',
    highlights: [
      'Multi-select and group operations',
      'Bookmark favorite views',
      'Sync with left/right panel filters'
    ]
  },
  'minimap': {
    title: 'Minimap',
    description: 'Stay oriented with an overhead view of the entire scene.',
    focus: 'Use it to jump between zones or align camera angles.',
    workspaceFeature: 'showMinimap',
    highlights: [
      'Live camera position indicator',
      'Clickable heatmap overlays',
      'Auto-sync with navigation bookmarks'
    ]
  },
  'material-editor': {
    title: 'Material Editor',
    description: 'Create PBR materials, stack textures, and preview live results.',
    focus: 'Preview your material under studio lighting and export presets.',
    workspaceFeature: 'showMaterialEditor',
    highlights: [
      'Layer maps (albedo, roughness, normal, etc.)',
      'Instant bake previews',
      'Share palettes with the team'
    ]
  },
  'lighting-presets': {
    title: 'Lighting Presets',
    description: 'Switch between curated lighting moods instantly.',
    focus: 'Combine HDRI, sun, and volumetric setups for immersive effects.',
    workspaceFeature: 'showLighting',
    highlights: [
      'Save and name custom presets',
      'Animate light transitions',
      'Compare energy vs aesthetic settings'
    ]
  },
  'export-tool': {
    title: 'Export Tool',
    description: 'Bundle geometry, data, and presentations for delivery.',
    focus: 'Select formats (GLTF, PDF, CSV) and include metadata easily.',
    workspaceFeature: 'showExport',
    highlights: [
      'Publish to BIM/CAD platforms',
      'Embed analytic dashboards in exports',
      'Track recipients and approvals'
    ]
  }
} as const satisfies Record<string, ToolPageDefinition>;

export type ToolPageId = keyof typeof toolPageDefinitions;

