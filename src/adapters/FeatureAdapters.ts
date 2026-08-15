import { FeatureAdapter } from '../utils/ControlsRegistry';
import { MeshBuilder, ParticleSystem, Vector3, Color4, HemisphericLight, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

// Context interface for BabylonWorkspace
interface BabylonContext {
  setFeatureState: (id: string, enabled: boolean) => void;
  featureStates: Record<string, boolean>;
  sceneRef: React.RefObject<any>;
  cameraRef: React.RefObject<any>;
  bimManagerRef: React.RefObject<any>;
  xrManagerRef: React.RefObject<any>;
  audioManagerRef: React.RefObject<any>;
  materialManagerRef: React.RefObject<any>;
  aiManagerRef: React.RefObject<any>;
  collabManagerRef: React.RefObject<any>;
  iotManagerRef: React.RefObject<any>;
  cloudAnchorManagerRef: React.RefObject<any>;
}

// Adapter for Material Editor (Core)
export const adaptMaterialEditor = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.materialManagerRef.current) {
      // Assume MaterialManager has enableEditor method; fallback to toggle
      context.setFeatureState('showMaterialEditor', true);
    }
  },
  disable: () => {
    context.setFeatureState('showMaterialEditor', false);
  },
  execute: (payload?: any) => {
    // Optional: Apply specific material
    if (payload && context.materialManagerRef.current) {
      // context.materialManagerRef.current.applyMaterial(payload);
    }
  },
  getState: () => context.featureStates.showMaterialEditor
});

// Adapter for BIM Integration (Core)
export const adaptBIMIntegration = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.bimManagerRef.current) {
      context.bimManagerRef.current.loadDemoModel();
      context.bimManagerRef.current.enableClashDetection();
    }
    context.setFeatureState('showBIMIntegration', true);
  },
  disable: () => {
    context.setFeatureState('showBIMIntegration', false);
  },
  execute: (payload?: any) => {
    if (payload === 'cost' && context.bimManagerRef.current) {
      const models = context.bimManagerRef.current.getAllModels();
      const modelId = models.length > 0 ? models[0].id : 'default-model';
      return context.bimManagerRef.current.getModelCostBreakdown(modelId);
    }
  },
  getState: () => context.featureStates.showBIMIntegration
});

// Adapter for Minimap (Core)
export const adaptMinimap = (context: BabylonContext): FeatureAdapter => ({
  enable: () => context.setFeatureState('showMinimap', true),
  disable: () => context.setFeatureState('showMinimap', false),
  execute: () => {},
  getState: () => context.featureStates.showMinimap
});

// Adapter for Measurement Tool (Core)
export const adaptMeasurementTool = (context: BabylonContext): FeatureAdapter => ({
  enable: () => context.setFeatureState('showMeasurementTool', true),
  disable: () => context.setFeatureState('showMeasurementTool', false),
  execute: () => {},
  getState: () => context.featureStates.showMeasurementTool
});

// Adapter for Auto Furnish (Important)
export const adaptAutoFurnish = (context: BabylonContext): FeatureAdapter => ({
  enable: () => context.setFeatureState('showAutoFurnish', true),
  disable: () => context.setFeatureState('showAutoFurnish', false),
  execute: () => {},
  getState: () => context.featureStates.showAutoFurnish
});

// Adapter for AI Co-Designer (Important)
export const adaptAICoDesigner = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.aiManagerRef.current) {
      context.aiManagerRef.current.enableGestureDetection();
    }
    context.setFeatureState('showAICoDesigner', true);
  },
  disable: () => {
    if (context.aiManagerRef.current) {
      context.aiManagerRef.current.disableGestureDetection();
    }
    context.setFeatureState('showAICoDesigner', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showAICoDesigner
});

// Adapter for Annotations (Important)
export const adaptAnnotations = (context: BabylonContext): FeatureAdapter => ({
  enable: () => context.setFeatureState('showAnnotations', true),
  disable: () => context.setFeatureState('showAnnotations', false),
  execute: () => {},
  getState: () => context.featureStates.showAnnotations
});

// Adapter for Weather (Important)
export const adaptWeather = (context: BabylonContext): FeatureAdapter => ({
  enable: () => context.setFeatureState('showWeather', true),
  disable: () => context.setFeatureState('showWeather', false),
  execute: () => {},
  getState: () => context.featureStates.showWeather
});

// Adapter for Flood Simulation (Important)
export const adaptFloodSimulation = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.sceneRef.current) {
      const water = Mesh.CreateGround('flood-water', 20, 20, 2, context.sceneRef.current);
      const waterMat = new StandardMaterial('flood-water-mat', context.sceneRef.current);
      waterMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
      waterMat.alpha = 0.7;
      water.material = waterMat;
      water.position.y = -0.5;
    }
    context.setFeatureState('showFloodSimulation', true);
  },
  disable: () => {
    if (context.sceneRef.current) {
      const water = context.sceneRef.current.getMeshByName('flood-water');
      if (water) water.dispose();
    }
    context.setFeatureState('showFloodSimulation', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showFloodSimulation
});

// Adapter for Wind Tunnel Simulation (Important)
export const adaptWindTunnelSimulation = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.sceneRef.current) {
      const particleSystem = new ParticleSystem("windParticles", 2000, context.sceneRef.current);
      particleSystem.emitter = context.cameraRef.current ? context.cameraRef.current.position : Vector3.Zero();
      particleSystem.minEmitBox = new Vector3(-10, -10, -10);
      particleSystem.maxEmitBox = new Vector3(10, 10, 10);
      particleSystem.color1 = new Color4(0.7, 0.8, 1.0, 1.0);
      particleSystem.color2 = new Color4(0.2, 0.5, 1.0, 1.0);
      particleSystem.minSize = 0.1;
      particleSystem.maxSize = 0.5;
      particleSystem.minLifeTime = 0.3;
      particleSystem.maxLifeTime = 1.5;
      particleSystem.emitRate = 1500;
      particleSystem.direction1 = new Vector3(-7, 8, 3);
      particleSystem.direction2 = new Vector3(7, -8, -3);
      particleSystem.minAngularSpeed = 0;
      particleSystem.maxAngularSpeed = Math.PI;
      particleSystem.minEmitPower = 1;
      particleSystem.maxEmitPower = 3;
      particleSystem.updateSpeed = 0.005;
      particleSystem.start();
    }
    context.setFeatureState('showWindTunnelSimulation', true);
  },
  disable: () => {
    if (context.sceneRef.current) {
      context.sceneRef.current.particleSystems.forEach((ps: any) => {
        if (ps.name === 'windParticles') {
          ps.stop();
          ps.dispose();
        }
      });
    }
    context.setFeatureState('showWindTunnelSimulation', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showWindTunnelSimulation
});

// Adapter for VR (Important)
export const adaptVR = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.xrManagerRef.current) {
      context.xrManagerRef.current.enterVR();
    }
    context.setFeatureState('showVR', true);
  },
  disable: () => {
    if (context.xrManagerRef.current) {
      context.xrManagerRef.current.exitXR();
    }
    context.setFeatureState('showVR', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showVR
});

// Adapter for AR (Important)
export const adaptAR = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.xrManagerRef.current) {
      context.xrManagerRef.current.enterAR();
    }
    context.setFeatureState('showAR', true);
  },
  disable: () => {
    if (context.xrManagerRef.current) {
      context.xrManagerRef.current.exitAR();
    }
    context.setFeatureState('showAR', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showAR
});

// Adapter for Wind (Important)
export const adaptWind = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.sceneRef.current) {
      const particleSystem = new ParticleSystem("windParticles", 1000, context.sceneRef.current);
      particleSystem.emitter = Vector3.Zero();
      particleSystem.minEmitBox = new Vector3(-5, 0, -5);
      particleSystem.maxEmitBox = new Vector3(5, 5, 5);
      particleSystem.color1 = new Color4(0.8, 0.9, 1.0, 0.5);
      particleSystem.color2 = new Color4(0.5, 0.7, 1.0, 0.5);
      particleSystem.minSize = 0.05;
      particleSystem.maxSize = 0.2;
      particleSystem.minLifeTime = 1;
      particleSystem.maxLifeTime = 3;
      particleSystem.emitRate = 500;
      particleSystem.direction1 = new Vector3(0, 0, 1);
      particleSystem.direction2 = new Vector3(0, 0, 1);
      particleSystem.minEmitPower = 0.5;
      particleSystem.maxEmitPower = 1;
      particleSystem.start();
    }
    context.setFeatureState('showWind', true);
  },
  disable: () => {
    if (context.sceneRef.current) {
      context.sceneRef.current.particleSystems.forEach((ps: any) => {
        if (ps.name === 'windParticles') {
          ps.stop();
          ps.dispose();
        }
      });
    }
    context.setFeatureState('showWind', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showWind
});

// Adapter for Noise (Important)
export const adaptNoise = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.sceneRef.current) {
      for (let i = 0; i < 10; i++) {
        const sphere = MeshBuilder.CreateSphere(`noiseSphere${i}`, { diameter: 0.5 }, context.sceneRef.current);
        sphere.position = new Vector3(Math.random() * 10 - 5, Math.random() * 5, Math.random() * 10 - 5);
        const mat = new StandardMaterial(`noiseMat${i}`, context.sceneRef.current);
        mat.diffuseColor = new Color3(1, 0, 0);
        mat.alpha = 0.5;
        sphere.material = mat;
      }
    }
    context.setFeatureState('showNoise', true);
  },
  disable: () => {
    if (context.sceneRef.current) {
      for (let i = 0; i < 10; i++) {
        const sphere = context.sceneRef.current.getMeshByName(`noiseSphere${i}`);
        if (sphere) sphere.dispose();
      }
    }
    context.setFeatureState('showNoise', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showNoise
});

// Adapter for Traffic (Important)
export const adaptTraffic = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.sceneRef.current) {
      // Stub: Integrate TrafficParkingSimulation if available
      console.log('Traffic simulation enabled');
      const car = MeshBuilder.CreateBox('trafficCar', { width: 2, height: 1, depth: 4 }, context.sceneRef.current);
      car.position = new Vector3(0, 0, 0);
      const mat = new StandardMaterial('trafficMat', context.sceneRef.current);
      mat.diffuseColor = new Color3(0, 0, 1);
      car.material = mat;
    }
    context.setFeatureState('showTraffic', true);
  },
  disable: () => {
    if (context.sceneRef.current) {
      const car = context.sceneRef.current.getMeshByName('trafficCar');
      if (car) car.dispose();
    }
    context.setFeatureState('showTraffic', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showTraffic
});

// Adapter for Shadow Analysis (Important)
export const adaptShadowAnalysis = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.sceneRef.current) {
      const light = new HemisphericLight('sunlight', new Vector3(0, 1, 0), context.sceneRef.current);
      light.intensity = 0.8;
      light.diffuse = new Color3(1, 1, 0.8);
    }
    context.setFeatureState('showSunlightAnalysis', true);
  },
  disable: () => {
    if (context.sceneRef.current) {
      const light = context.sceneRef.current.getLightByName('sunlight');
      if (light) light.dispose();
    }
    context.setFeatureState('showSunlightAnalysis', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showSunlightAnalysis
});

// Adapter for AI Advisor (Important)
export const adaptAIAdvisor = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.aiManagerRef.current) {
      context.aiManagerRef.current.startAdvice();
    }
    context.setFeatureState('showAIAdvisor', true);
  },
  disable: () => {
    if (context.aiManagerRef.current) {
      context.aiManagerRef.current.stopAdvice();
    }
    context.setFeatureState('showAIAdvisor', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showAIAdvisor
});

// Adapter for Voice Assistant (Important)
export const adaptVoiceAssistant = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.aiManagerRef.current) {
      context.aiManagerRef.current.startVoiceListening();
    }
    context.setFeatureState('showVoiceAssistant', true);
  },
  disable: () => {
    if (context.aiManagerRef.current) {
      context.aiManagerRef.current.stopVoiceListening();
    }
    context.setFeatureState('showVoiceAssistant', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showVoiceAssistant
});

// Adapter for Ergonomic (Important)
export const adaptErgonomic = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.bimManagerRef.current) {
      context.bimManagerRef.current.ergonomicAnalysis();
    }
    context.setFeatureState('showErgonomic', true);
  },
  disable: () => {
    context.setFeatureState('showErgonomic', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showErgonomic
});

// Adapter for Energy (Important)
export const adaptEnergy = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.bimManagerRef.current) {
      context.bimManagerRef.current.getEnergyAnalysis();
    }
    context.setFeatureState('showEnergy', true);
  },
  disable: () => {
    context.setFeatureState('showEnergy', false);
  },
  execute: () => {
    if (context.bimManagerRef.current) {
      return context.bimManagerRef.current.getEnergyAnalysis();
    }
  },
  getState: () => context.featureStates.showEnergy
});

// Adapter for Cost (Important)
export const adaptCost = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.bimManagerRef.current) {
      context.bimManagerRef.current.getModelCostBreakdown();
    }
    context.setFeatureState('showCost', true);
  },
  disable: () => {
    context.setFeatureState('showCost', false);
  },
  execute: () => {
    if (context.bimManagerRef.current) {
      const models = context.bimManagerRef.current.getAllModels();
      const modelId = models.length > 0 ? models[0].id : 'default-model';
      return context.bimManagerRef.current.getModelCostBreakdown(modelId);
    }
  },
  getState: () => context.featureStates.showCost
});

// Adapter for Multi User (Important)
export const adaptMultiUser = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.collabManagerRef.current) {
      context.collabManagerRef.current.connect();
    }
    context.setFeatureState('showMultiUser', true);
  },
  disable: () => {
    if (context.collabManagerRef.current) {
      context.collabManagerRef.current.disconnect();
    }
    context.setFeatureState('showMultiUser', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showMultiUser
});

// Adapter for Chat (Important)
export const adaptChat = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    const chatDiv = document.createElement('div');
    chatDiv.id = 'chat-ui';
    chatDiv.style.position = 'absolute';
    chatDiv.style.top = '10px';
    chatDiv.style.right = '10px';
    chatDiv.style.width = '300px';
    chatDiv.style.height = '400px';
    chatDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
    chatDiv.style.color = 'white';
    chatDiv.style.padding = '10px';
    chatDiv.innerHTML = '<h3>Chat</h3><div id="messages"></div><input id="chatInput" type="text" placeholder="Type message..." />';
    document.body.appendChild(chatDiv);
    context.setFeatureState('showChat', true);
  },
  disable: () => {
    const chatDiv = document.getElementById('chat-ui');
    if (chatDiv) document.body.removeChild(chatDiv);
    context.setFeatureState('showChat', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showChat
});

// Adapter for Sharing (Important)
export const adaptSharing = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    const shareLink = `https://example.com/share/${Date.now()}`;
    console.log(`Share link: ${shareLink}`);
    navigator.clipboard.writeText(shareLink);
    context.setFeatureState('showSharing', true);
  },
  disable: () => {
    context.setFeatureState('showSharing', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showSharing
});

// Adapter for Spatial Audio (Important)
export const adaptSpatialAudio = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.audioManagerRef.current) {
      context.audioManagerRef.current.enableSpatialAudio();
    }
    context.setFeatureState('showSpatialAudio', true);
  },
  disable: () => {
    if (context.audioManagerRef.current) {
      context.audioManagerRef.current.disableSpatialAudio();
    }
    context.setFeatureState('showSpatialAudio', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showSpatialAudio
});

// Adapter for Haptic (Important)
export const adaptHaptic = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (context.xrManagerRef.current) {
      context.xrManagerRef.current.enableHapticFeedback();
    }
    context.setFeatureState('showHaptic', true);
  },
  disable: () => {
    if (context.xrManagerRef.current) {
      context.xrManagerRef.current.disableHapticFeedback();
    }
    context.setFeatureState('showHaptic', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showHaptic
});

// Adapter for Geo Location (Important)
export const adaptGeoLocation = (context: BabylonContext): FeatureAdapter => ({
  enable: () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        console.log(`Location: ${position.coords.latitude}, ${position.coords.longitude}`);
      });
    }
    context.setFeatureState('showGeoLocation', true);
  },
  disable: () => {
    context.setFeatureState('showGeoLocation', false);
  },
  execute: () => {},
  getState: () => context.featureStates.showGeoLocation
});

// Stub for Nice-to-Have features (e.g., Scan Animal)
export const adaptStub = (context: BabylonContext, featureId: string): FeatureAdapter => ({
  enable: () => {
    // TODO: Implement adapter for ${featureId}
    console.log(`Stub: Enabling ${featureId}`);
    context.setFeatureState(featureId, true);
  },
  disable: () => {
    console.log(`Stub: Disabling ${featureId}`);
    context.setFeatureState(featureId, false);
  },
  execute: () => {},
  getState: () => context.featureStates[featureId] || false
});

// Function to register all adapters
export const registerAllAdapters = (context: BabylonContext, registry: any) => {
  // Core
  registry.register('showMaterialEditor', adaptMaterialEditor(context));
  registry.register('showMinimap', adaptMinimap(context));
  registry.register('showMeasurementTool', adaptMeasurementTool(context));
  registry.register('showBIMIntegration', adaptBIMIntegration(context));

  // Important
  registry.register('showAutoFurnish', adaptAutoFurnish(context));
  registry.register('showAICoDesigner', adaptAICoDesigner(context));
  registry.register('showAnnotations', adaptAnnotations(context));
  registry.register('showWeather', adaptWeather(context));
  registry.register('showFloodSimulation', adaptFloodSimulation(context));
  registry.register('showWindTunnelSimulation', adaptWindTunnelSimulation(context));
  registry.register('showVR', adaptVR(context));
  registry.register('showAR', adaptAR(context));
  registry.register('showWind', adaptWind(context));
  registry.register('showNoise', adaptNoise(context));
  registry.register('showTraffic', adaptTraffic(context));
  registry.register('showSunlightAnalysis', adaptShadowAnalysis(context));
  registry.register('showAIAdvisor', adaptAIAdvisor(context));
  registry.register('showVoiceAssistant', adaptVoiceAssistant(context));
  registry.register('showErgonomic', adaptErgonomic(context));
  registry.register('showEnergy', adaptEnergy(context));
  registry.register('showCost', adaptCost(context));
  registry.register('showMultiUser', adaptMultiUser(context));
  registry.register('showChat', adaptChat(context));
  registry.register('showSharing', adaptSharing(context));
  registry.register('showSpatialAudio', adaptSpatialAudio(context));
  registry.register('showHaptic', adaptHaptic(context));
  registry.register('showGeoLocation', adaptGeoLocation(context));

  // Stub others (Nice-to-Have)
  const stubFeatures = [
    'showScanAnimal', 'showMoodScene', 'showSeasonalDecor', 'showARScale', 'showScenario',
    'showMovementControlChecker', 'showTeleportManager', 'showSwimMode', 'showMultiSensoryPreview',
    'showNoiseSimulation', 'showPropertyInspector', 'showSceneBrowser', 'showSiteContextGenerator',
    'showSmartAlternatives', 'showSoundPrivacySimulation',
    'showSustainabilityCompliancePanel', 'showPathTracing', 'showPHashIntegration',
    'showProgressiveLoader', 'showPresentationManager', 'showPresenterMode',
    'showQuantumSimulationInterface', 'showBeforeAfter',
    'showComparativeTour', 'showROICalculator', 'showGeoWorkspaceArea',
    'showGeoSync', 'showCameraViews', 'showCollabManager', 'showComprehensiveSimulation'
  ];
  stubFeatures.forEach(id => registry.register(id, adaptStub(context, id)));
};
