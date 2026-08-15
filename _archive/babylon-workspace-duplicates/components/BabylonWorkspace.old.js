import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useRef, useEffect, useState } from 'react';
import './BabylonWorkspace.css';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import EnhancedToolbar from './EnhancedToolbar';
import { SimulationManager } from './SimulationManager';
import { FeatureManager } from './FeatureManager';
// Import all feature components
import WeatherSystem from './WeatherSystem';
import FloodSimulation from './FloodSimulation';
import EnhancedFloodSimulation from './EnhancedFloodSimulation';
import WindTunnelSimulation from './WindTunnelSimulation';
import NoiseSimulation from './NoiseSimulation';
import ShadowImpactAnalysis from './ShadowImpactAnalysis';
import TrafficParkingSimulation from './TrafficParkingSimulation';
import MeasureTool from './MeasureTool';
import AIStructuralAdvisor from './AIStructuralAdvisor';
import CirculationFlowSimulation from './CirculationFlowSimulation';
import ErgonomicTesting from './ErgonomicTesting';
import SoundPrivacySimulation from './SoundPrivacySimulation';
import MultiSensoryPreview from './MultiSensoryPreview';
import LightingMoodBoardsFixed from './LightingMoodBoardsFixed';
import FurnitureClearanceChecker from './FurnitureClearanceChecker';
import SiteContextGenerator from './SiteContextGenerator';
import TopographyGenerator from './TopographyGenerator';
import ConstructionOverlay from './ConstructionOverlay';
import GeoLocationContext from './GeoLocationContext';
import AICoDesigner from './AICoDesigner';
import AutoFurnish from './AutoFurnish';
import SunlightAnalysis from './SunlightAnalysis';
import BIMIntegration from './BIMIntegration';
import CostEstimatorWrapper from './CostEstimatorWrapper';
import MaterialManagerWrapper from './MaterialManagerWrapper';
import VRARMode from './VRARMode';
import HandTracking from './HandTracking';
import MultiUser from './MultiUser';
import VoiceChat from './VoiceChat';
import PresenterMode from './PresenterMode';
import Annotations from './Annotations';
import ExportTool from './ExportTool';
import PathTracing from './PathTracing';
import IoTIntegration from './IoTIntegration';
import EnergySim from './EnergySim';
import PropertyInspector from './PropertyInspector';
import SceneBrowser from './SceneBrowser';
import Minimap from './Minimap';
import MaterialEditorPanel from './MaterialEditorPanel';
import LightingPresets from './LightingPresets';
import MovementControlChecker from './MovementControlChecker';
const BabylonWorkspace = ({ workspaceId }) => {
    const canvasRef = useRef(null);
    const [engine, setEngine] = useState(null);
    const [scene, setScene] = useState(null);
    const [simulationManager, setSimulationManager] = useState(null);
    const [sceneManager, setSceneManager] = useState(null);
    const [activeFeatures, setActiveFeatures] = useState(new Set());
    // Undo/Redo state stacks with limit 1500
    const undoStack = useRef([]);
    const redoStack = useRef([]);
    const UNDO_REDO_LIMIT = 1500;
    // Feature toggle states
    const [windTunnelEnabled, setWindTunnelEnabled] = useState(false);
    const [topographyEnabled, setTopographyEnabled] = useState(false);
    const [floodSimulationEnabled, setFloodSimulationEnabled] = useState(false);
    const [noiseSimulationEnabled, setNoiseSimulationEnabled] = useState(false);
    const [scenarioWalkthroughEnabled, setScenarioWalkthroughEnabled] = useState(false);
    const [beforeAfterEnabled, setBeforeAfterEnabled] = useState(false);
    const [arModeEnabled, setArModeEnabled] = useState(false);
    const [comparativeToursEnabled, setComparativeToursEnabled] = useState(false);
    const [moodScenesEnabled, setMoodScenesEnabled] = useState(false);
    const [seasonalDecorEnabled, setSeasonalDecorEnabled] = useState(false);
    const [roiCalculatorEnabled, setRoiCalculatorEnabled] = useState(false);
    // Additional states for missing features
    const [weatherSystemEnabled, setWeatherSystemEnabled] = useState(false);
    const [enhancedFloodEnabled, setEnhancedFloodEnabled] = useState(false);
    const [trafficParkingEnabled, setTrafficParkingEnabled] = useState(false);
    const [shadowAnalysisEnabled, setShadowAnalysisEnabled] = useState(false);
    const [circulationFlowEnabled, setCirculationFlowEnabled] = useState(false);
    const [measureToolEnabled, setMeasureToolEnabled] = useState(false);
    const [ergonomicTestingEnabled, setErgonomicTestingEnabled] = useState(false);
    const [energyAnalysisEnabled, setEnergyAnalysisEnabled] = useState(false);
    const [costEstimatorEnabled, setCostEstimatorEnabled] = useState(false);
    const [soundPrivacyEnabled, setSoundPrivacyEnabled] = useState(false);
    const [furnitureClearanceEnabled, setFurnitureClearanceEnabled] = useState(false);
    const [aiAdvisorEnabled, setAiAdvisorEnabled] = useState(false);
    const [autoFurnishEnabled, setAutoFurnishEnabled] = useState(false);
    const [aiCoDesignerEnabled, setAiCoDesignerEnabled] = useState(false);
    const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false);
    const [siteContextEnabled, setSiteContextEnabled] = useState(false);
    const [lightingMoodsEnabled, setLightingMoodsEnabled] = useState(false);
    const [geoLocationEnabled, setGeoLocationEnabled] = useState(false);
    const [constructionOverlayEnabled, setConstructionOverlayEnabled] = useState(false);
    const [multiSensoryEnabled, setMultiSensoryEnabled] = useState(false);
    const [vrArModeEnabled, setVrArModeEnabled] = useState(false);
    const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);
    const [presenterModeEnabled, setPresenterModeEnabled] = useState(false);
    const [annotationsEnabled, setAnnotationsEnabled] = useState(false);
    const [propertyInspectorEnabled, setPropertyInspectorEnabled] = useState(false);
    const [workspaceModeEnabled, setWorkspaceModeEnabled] = useState(false);
    const [pathTracingEnabled, setPathTracingEnabled] = useState(false);
    const [iotIntegrationEnabled, setIotIntegrationEnabled] = useState(false);
    const [animationPlaying, setAnimationPlaying] = useState(false);
    // Additional missing state variables
    const [sunlightAnalysisEnabled, setSunlightAnalysisEnabled] = useState(false);
    const [bimIntegrationEnabled, setBimIntegrationEnabled] = useState(false);
    const [materialManagerEnabled, setMaterialManagerEnabled] = useState(false);
    const [multiUserEnabled, setMultiUserEnabled] = useState(false);
    const [exportVisible, setExportVisible] = useState(false);
    const [sceneBrowserEnabled, setSceneBrowserEnabled] = useState(false);
    const [selectedObject, setSelectedObject] = useState(null);
    // Missing feature state variables
    const [minimapEnabled, setMinimapEnabled] = useState(false);
    const [materialEditorEnabled, setMaterialEditorEnabled] = useState(false);
    const [lightingControlEnabled, setLightingControlEnabled] = useState(false);
    const [movementToolEnabled, setMovementToolEnabled] = useState(false);
    // Undo handler
    const handleUndo = () => {
        if (undoStack.current.length === 0)
            return;
        const lastState = undoStack.current.pop();
        if (lastState) {
            redoStack.current.push(lastState);
            if (redoStack.current.length > UNDO_REDO_LIMIT) {
                redoStack.current.shift();
            }
            // Apply lastState to scene or application state here
            console.log('Undo action applied:', lastState);
        }
    };
    // Redo handler
    const handleRedo = () => {
        if (redoStack.current.length === 0)
            return;
        const nextState = redoStack.current.pop();
        if (nextState) {
            undoStack.current.push(nextState);
            if (undoStack.current.length > UNDO_REDO_LIMIT) {
                undoStack.current.shift();
            }
            // Apply nextState to scene or application state here
            console.log('Redo action applied:', nextState);
        }
    };
    useEffect(() => {
        if (!canvasRef.current)
            return;
        const eng = new Engine(canvasRef.current, true);
        setEngine(eng);
        const scn = new Scene(eng);
        setScene(scn);
        // Create device capabilities for FeatureManager
        const deviceCapabilities = {
            webgl: true,
            webgl2: eng.getCaps().supportSRGBBuffers || false,
            webxr: 'xr' in navigator,
            webrtc: 'RTCPeerConnection' in window,
            webassembly: 'WebAssembly' in window,
            gpuMemory: 512, // MB - approximate
            cpuCores: navigator.hardwareConcurrency || 4,
            ram: 4096, // MB - approximate
            networkType: 'fast',
            touchEnabled: 'ontouchstart' in window,
            mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        };
        // Create FeatureManager
        const featureMgr = new FeatureManager(deviceCapabilities);
        // Create SimulationManager
        const simMgr = new SimulationManager(eng, scn, featureMgr);
        setSimulationManager(simMgr);
        // Create sceneManager
        const scnMgr = { scene: scn };
        setSceneManager(scnMgr);
        const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 4, 10, Vector3.Zero(), scn);
        camera.attachControl(canvasRef.current, true);
        const light = new HemisphericLight('light', new Vector3(0, 1, 0), scn);
        light.intensity = 0.7;
        const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scn);
        const material = new StandardMaterial('material', scn);
        material.diffuseColor = new Color3(0.4, 0.6, 0.8);
        sphere.material = material;
        eng.runRenderLoop(() => {
            scn.render();
        });
        const handleResize = () => {
            eng.resize();
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            scn.dispose();
            eng.dispose();
            simMgr.dispose();
        };
    }, [canvasRef]);
    // Toggle handlers
    const toggleWindTunnel = () => setWindTunnelEnabled(prev => !prev);
    const toggleTopography = () => setTopographyEnabled(prev => !prev);
    const toggleFloodSimulation = () => setFloodSimulationEnabled(prev => !prev);
    const toggleNoiseSimulation = () => setNoiseSimulationEnabled(prev => !prev);
    const toggleScenarioWalkthrough = () => setScenarioWalkthroughEnabled(prev => !prev);
    const toggleBeforeAfter = () => setBeforeAfterEnabled(prev => !prev);
    const toggleARMode = () => setArModeEnabled(prev => !prev);
    const toggleComparativeTours = () => setComparativeToursEnabled(prev => !prev);
    const toggleMoodScenes = () => setMoodScenesEnabled(prev => !prev);
    const toggleSeasonalDecor = () => setSeasonalDecorEnabled(prev => !prev);
    const toggleROICalculator = () => setRoiCalculatorEnabled(prev => !prev);
    // Additional toggle handlers
    const toggleWeatherSystem = () => setWeatherSystemEnabled(prev => !prev);
    const toggleEnhancedFlood = () => setEnhancedFloodEnabled(prev => !prev);
    const toggleTrafficParking = () => setTrafficParkingEnabled(prev => !prev);
    const toggleShadowAnalysis = () => setShadowAnalysisEnabled(prev => !prev);
    const toggleCirculationFlow = () => setCirculationFlowEnabled(prev => !prev);
    const toggleMeasureTool = () => setMeasureToolEnabled(prev => !prev);
    const toggleErgonomicTesting = () => setErgonomicTestingEnabled(prev => !prev);
    const toggleEnergyAnalysis = () => setEnergyAnalysisEnabled(prev => !prev);
    const toggleCostEstimator = () => setCostEstimatorEnabled(prev => !prev);
    const toggleSoundPrivacy = () => setSoundPrivacyEnabled(prev => !prev);
    const toggleFurnitureClearance = () => setFurnitureClearanceEnabled(prev => !prev);
    const toggleAiAdvisor = () => setAiAdvisorEnabled(prev => !prev);
    const toggleAutoFurnish = () => setAutoFurnishEnabled(prev => !prev);
    const toggleAiCoDesigner = () => setAiCoDesignerEnabled(prev => !prev);
    const toggleVoiceAssistant = () => setVoiceAssistantEnabled(prev => !prev);
    const toggleSiteContext = () => setSiteContextEnabled(prev => !prev);
    const toggleLightingMoods = () => setLightingMoodsEnabled(prev => !prev);
    const toggleGeoLocation = () => setGeoLocationEnabled(prev => !prev);
    const toggleConstructionOverlay = () => setConstructionOverlayEnabled(prev => !prev);
    const toggleMultiSensory = () => setMultiSensoryEnabled(prev => !prev);
    const toggleVrArMode = () => setVrArModeEnabled(prev => !prev);
    const toggleHandTracking = () => setHandTrackingEnabled(prev => !prev);
    const togglePresenterMode = () => setPresenterModeEnabled(prev => !prev);
    const toggleAnnotations = () => setAnnotationsEnabled(prev => !prev);
    const togglePropertyInspector = () => setPropertyInspectorEnabled(prev => !prev);
    const toggleWorkspaceMode = () => setWorkspaceModeEnabled(prev => !prev);
    const togglePathTracing = () => setPathTracingEnabled(prev => !prev);
    const toggleIotIntegration = () => setIotIntegrationEnabled(prev => !prev);
    const toggleAnimationPlayPause = () => setAnimationPlaying(prev => !prev);
    // Additional toggle handlers for missing features
    const toggleSunlightAnalysis = () => setSunlightAnalysisEnabled(prev => !prev);
    const toggleBimIntegration = () => setBimIntegrationEnabled(prev => !prev);
    const toggleMaterialManager = () => setMaterialManagerEnabled(prev => !prev);
    const toggleMultiUser = () => setMultiUserEnabled(prev => !prev);
    const toggleExport = () => setExportVisible(prev => !prev);
    const toggleSceneBrowser = () => setSceneBrowserEnabled(prev => !prev);
    // Missing feature toggle handlers
    const toggleMinimap = () => setMinimapEnabled(prev => !prev);
    const toggleMaterialEditor = () => setMaterialEditorEnabled(prev => !prev);
    const toggleLightingControl = () => setLightingControlEnabled(prev => !prev);
    const toggleMovementTool = () => setMovementToolEnabled(prev => !prev);
    // Feature toggle handler for EnhancedToolbar
    const handleFeatureToggle = (featureId, enabled) => {
        const newActiveFeatures = new Set(activeFeatures);
        if (enabled) {
            newActiveFeatures.add(featureId);
        }
        else {
            newActiveFeatures.delete(featureId);
        }
        setActiveFeatures(newActiveFeatures);
        // Map feature IDs to existing toggle functions
        const toggleMap = {
            measure: toggleMeasureTool,
            lighting: toggleLightingControl,
            materials: toggleMaterialEditor,
            weather: toggleWeatherSystem,
            flood: toggleFloodSimulation,
            wind: toggleWindTunnel,
            noise: toggleNoiseSimulation,
            traffic: toggleTrafficParking,
            energy: toggleEnergyAnalysis,
            aiAdvisor: toggleAiAdvisor,
            autoFurnish: toggleAutoFurnish,
            voiceAssistant: toggleVoiceAssistant,
            aiCoDesigner: toggleAiCoDesigner,
            cost: toggleCostEstimator,
            sunlight: toggleSunlightAnalysis,
            shadow: toggleShadowAnalysis,
            ergonomic: toggleErgonomicTesting,
            soundPrivacy: toggleSoundPrivacy,
            furniture: toggleFurnitureClearance,
            siteContext: toggleSiteContext,
            topography: toggleTopography,
            geoLocation: toggleGeoLocation,
            construction: toggleConstructionOverlay,
            multiUser: toggleMultiUser,
            voiceChat: toggleVoiceAssistant,
            annotations: toggleAnnotations,
            presenter: togglePresenterMode,
            vr: toggleVrArMode,
            ar: toggleARMode,
            handTracking: toggleHandTracking,
            multiSensory: toggleMultiSensory,
            propertyInspector: togglePropertyInspector,
            sceneBrowser: toggleSceneBrowser,
            minimap: toggleMinimap,
            export: toggleExport,
            pathTracing: togglePathTracing,
            iot: toggleIotIntegration
        };
        if (toggleMap[featureId]) {
            toggleMap[featureId]();
        }
    };
    // Joystick/gamepad input handling for move, rotate, scale tools and material editor, camera movement
    React.useEffect(() => {
        if (!scene)
            return;
        let animationFrameId;
        const handleGamepadInput = () => {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            if (!gamepads) {
                animationFrameId = requestAnimationFrame(handleGamepadInput);
                return;
            }
            for (const gp of gamepads) {
                if (!gp)
                    continue;
                // Assuming standard gamepad mapping
                // Left stick controls movement (axes 0 and 1)
                const moveX = gp.axes[0] || 0;
                const moveY = gp.axes[1] || 0;
                // Right stick controls rotation (axes 2 and 3)
                const rotateX = gp.axes[2] || 0;
                const rotateY = gp.axes[3] || 0;
                // Buttons for scale up/down (e.g., buttons 4 and 5)
                const scaleUp = gp.buttons[4]?.pressed;
                const scaleDown = gp.buttons[5]?.pressed;
                // Apply movement to selected object if movement tool enabled
                if (movementToolEnabled && selectedObject) {
                    const moveSpeed = 0.1;
                    selectedObject.position.x += moveX * moveSpeed;
                    selectedObject.position.z += moveY * moveSpeed;
                    // Apply rotation
                    const rotateSpeed = 0.05;
                    selectedObject.rotation.y += rotateX * rotateSpeed;
                    selectedObject.rotation.x += rotateY * rotateSpeed;
                    // Apply scaling
                    const scaleSpeed = 0.01;
                    if (scaleUp) {
                        selectedObject.scaling = selectedObject.scaling.add(new Vector3(scaleSpeed, scaleSpeed, scaleSpeed));
                    }
                    if (scaleDown) {
                        selectedObject.scaling = selectedObject.scaling.subtract(new Vector3(scaleSpeed, scaleSpeed, scaleSpeed));
                    }
                }
                // Joystick support for material editor controls
                if (materialEditorEnabled) {
                    // Example: map left stick to navigate material editor UI
                    // This is a placeholder; actual implementation depends on MaterialEditorPanel API
                    const navX = moveX;
                    const navY = moveY;
                    // TODO: Call MaterialEditorPanel joystick navigation handlers here
                    // e.g., materialEditorRef.current?.handleJoystickNavigation(navX, navY);
                }
                // Joystick support for camera movement (system/laptop movement control)
                if (scene.activeCamera) {
                    const camera = scene.activeCamera;
                    const cameraMoveSpeed = 0.2;
                    const cameraRotateSpeed = 0.02;
                    // Move camera position with left stick always
                    camera.position.x += moveX * cameraMoveSpeed;
                    camera.position.z += moveY * cameraMoveSpeed;
                    // Rotate camera with right stick if camera supports rotation property
                    if ('rotation' in camera) {
                        camera.rotation.y += rotateX * cameraRotateSpeed;
                        camera.rotation.x += rotateY * cameraRotateSpeed;
                    }
                }
            }
            animationFrameId = requestAnimationFrame(handleGamepadInput);
        };
        animationFrameId = requestAnimationFrame(handleGamepadInput);
        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [scene, movementToolEnabled, selectedObject, materialEditorEnabled]);
    return (_jsxs("div", { className: "babylon-workspace-container", children: [_jsx(EnhancedToolbar, { activeFeatures: activeFeatures, onFeatureToggle: handleFeatureToggle, onUndo: handleUndo, onRedo: handleRedo, isPlaying: animationPlaying, isVisible: true, lightingEnabled: lightingControlEnabled }), _jsx("canvas", { ref: canvasRef, className: "babylon-canvas" }), weatherSystemEnabled && _jsx(WeatherSystem, { scene: scene }), floodSimulationEnabled && _jsx(FloodSimulation, { scene: scene, terrainMesh: undefined }), enhancedFloodEnabled && _jsx(EnhancedFloodSimulation, { scene: scene }), windTunnelEnabled && _jsx(WindTunnelSimulation, { scene: scene }), noiseSimulationEnabled && _jsx(NoiseSimulation, { scene: scene }), shadowAnalysisEnabled && _jsx(ShadowImpactAnalysis, { scene: scene, engine: engine }), trafficParkingEnabled && simulationManager && _jsx(TrafficParkingSimulation, { simulationManager: simulationManager }), measureToolEnabled && _jsx(MeasureTool, { scene: scene, engine: engine, isActive: measureToolEnabled }), aiAdvisorEnabled && _jsx(AIStructuralAdvisor, { scene: scene, engine: engine, isActive: aiAdvisorEnabled }), circulationFlowEnabled && _jsx(CirculationFlowSimulation, { scene: scene, engine: engine, isActive: circulationFlowEnabled }), ergonomicTestingEnabled && _jsx(ErgonomicTesting, { scene: scene }), soundPrivacyEnabled && _jsx(SoundPrivacySimulation, { scene: scene }), multiSensoryEnabled && _jsx(MultiSensoryPreview, { scene: scene }), lightingMoodsEnabled && _jsx(LightingMoodBoardsFixed, { scene: scene }), furnitureClearanceEnabled && _jsx(FurnitureClearanceChecker, { scene: scene }), siteContextEnabled && _jsx(SiteContextGenerator, { scene: scene }), topographyEnabled && _jsx(TopographyGenerator, { scene: scene }), constructionOverlayEnabled && _jsx(ConstructionOverlay, { scene: scene }), geoLocationEnabled && _jsx(GeoLocationContext, { scene: scene }), aiCoDesignerEnabled && sceneManager && _jsx(AICoDesigner, { sceneManager: sceneManager, onClose: toggleAiCoDesigner }), autoFurnishEnabled && sceneManager && _jsx(AutoFurnish, { sceneManager: sceneManager, onClose: toggleAutoFurnish }), sunlightAnalysisEnabled && _jsx(SunlightAnalysis, { scene: scene, isActive: sunlightAnalysisEnabled }), bimIntegrationEnabled && _jsx(BIMIntegration, { scene: scene, isActive: bimIntegrationEnabled }), costEstimatorEnabled && _jsx(CostEstimatorWrapper, { scene: scene }), materialManagerEnabled && _jsx(MaterialManagerWrapper, { scene: scene, socket: null, userId: "user1" }), vrArModeEnabled && _jsx(VRARMode, { scene: scene, isActive: vrArModeEnabled }), handTrackingEnabled && _jsx(HandTracking, { scene: scene, isActive: handTrackingEnabled }), multiUserEnabled && _jsx(MultiUser, { scene: scene, isActive: multiUserEnabled }), voiceAssistantEnabled && _jsx(VoiceChat, { scene: scene, isActive: voiceAssistantEnabled }), presenterModeEnabled && _jsx(PresenterMode, { scene: scene, isActive: presenterModeEnabled }), annotationsEnabled && _jsx(Annotations, { scene: scene }), exportVisible && _jsx(ExportTool, { scene: scene }), pathTracingEnabled && _jsx(PathTracing, { scene: scene }), iotIntegrationEnabled && _jsx(IoTIntegration, { scene: scene }), energyAnalysisEnabled && _jsx(EnergySim, { scene: scene }), propertyInspectorEnabled && _jsx(PropertyInspector, { scene: scene, engine: engine, selectedObject: selectedObject }), sceneBrowserEnabled && _jsx(SceneBrowser, { scene: scene, engine: engine }), minimapEnabled && scene.activeCamera && _jsx(Minimap, { scene: scene, camera: scene.activeCamera }), materialEditorEnabled && _jsx(MaterialEditorPanel, { selectedMesh: selectedObject, scene: scene }), lightingControlEnabled && _jsx(LightingPresets, { scene: scene }), movementToolEnabled && scene.activeCamera && _jsx(MovementControlChecker, { scene: scene, camera: scene.activeCamera })] }));
};
export default BabylonWorkspace;
