# TODO: Feature Integration Redesign

This file tracks the progress of redesigning the ControlPanel to integrate all features with working buttons, using the ControlsRegistry and adapters. Features are prioritized as Core (Priority 1), Important (Priority 2), and Nice-to-Have (Priority 3). Steps are broken down logically, with updates after each completion.

## 1. Setup and Configuration (Foundation)
- [x] Create src/config/featureCategories.ts: Define full featuresByCategory with all ~60 features grouped by priority (Core, Important, Nice-to-Have). Include id, name, description (from feedback), icon (Lucide icons), hotkey (assigned), performanceImpact (1-3), isEssential (true for Core), dependencies (e.g., Energy depends on BIM).
- [x] Update TODO.md: Mark this step complete and note any icon/hotkey assignments. Icons assigned (e.g., Palette for MaterialEditor, Headphones for VR, Route for PathTracing); hotkeys assigned (e.g., 'M' for Material, 'V' for VR).

## 2. Enhance Adapters for Important Features (Priority 2)
- [x] Edit src/adapters/FeatureAdapters.ts: Add/enhance adapters for remaining Important features (e.g., adaptEnergy: call bimManagerRef.current.getEnergyAnalysis() + setState; adaptCost: getModelCostBreakdown(); adaptMultiUser: collabManagerRef.current.connect(); adaptAIAdvisor: aiManagerRef.current.startAdvice(); adaptVoiceAssistant: startVoiceListening(); adaptChat: show basic chat UI div; adaptSharing: generate share link/console.log; adaptErgonomic: basic analysis log; adaptNoise: create visualization spheres; adaptTraffic: stub with TrafficParkingSimulation integration; adaptShadowAnalysis: adjust lighting like sunlight). Keep stubs for Nice-to-Have. Ensure registerAllAdapters includes all.
- [x] Update TODO.md: Mark complete, list added adapters. Added adaptWind (particles), adaptNoise (spheres), adaptTraffic (car mesh), adaptShadowAnalysis (light), adaptAIAdvisor (startAdvice), adaptVoiceAssistant (startVoiceListening), adaptErgonomic (ergonomicAnalysis), adaptEnergy (getEnergyAnalysis), adaptCost (getModelCostBreakdown), adaptMultiUser (connect), adaptChat (DOM div), adaptSharing (clipboard), adaptSpatialAudio (enableSpatialAudio), adaptHaptic (enableHapticFeedback), adaptGeoLocation (getCurrentPosition).

## 3. Integrate in Parent Component (BabylonWorkspace.tsx)
- [ ] Edit components/BabylonWorkspace/BabylonWorkspace.tsx: Import config and useControlsRegistry hook. In component: const registry = useControlsRegistry(); useEffect to call registerAllAdapters(context, registry) with context={setFeatureState, featureStates, all refs (sceneRef, bimManagerRef, etc.)}. Build featuresByCategory from config (map to Feature objects, set enabled=featureStates[id] || false). Set activeFeatures = new Set(Object.keys(featureStates).filter(id => featureStates[id])); Define onToggle = (id) => { const current = registry.getState(id); if (current) { registry.disable(id); setFeatureState(prev => ({...prev, [id]: false})); } else { registry.enable(id); setFeatureState(prev => ({...prev, [id]: true})); } }; Pass to renderLeftPanel({featuresByCategory, activeFeatures, onToggle, ...}).
- [ ] Update TODO.md: Mark complete, confirm parent path if needed.

## 4. UI Enhancements (ControlPanel and Subcomponents)
- [ ] Edit src/components/UI/ControlPanel/ControlPanel.tsx: Import config if fallback needed (but prefer parent). Add performance summary in header (e.g., totalImpact = sum(performanceImpact for active features), show warning if >10). Ensure search filters by name/description/hotkey.
- [ ] Edit src/components/UI/ControlPanel/FeatureButton.tsx: Add performanceImpact visual (e.g., if >2, add small badge "High Impact" next to state badge). Enhance tooltip to include performanceImpact and dependencies if any.
- [ ] Update TODO.md: Mark complete.

## 5. Testing and Validation
- [ ] Run app: Use execute_command 'npm run dev' to start dev server. Test Core features (toggle MaterialEditor: verify UI shows; Minimap: 2D map appears; MeasurementTool: measurement UI; BIMIntegration: demo model loads/clash detection). Test Important (e.g., Flood: water mesh appears; Energy: dashboard renders; VR/AR: mode enters if XRManager ready). Check console for stub logs on Nice-to-Have, no errors. Use browser_action to launch localhost:3000, interact with buttons, verify state changes/tooltips/hotkeys.
- [ ] Update TODO.md: Mark tests complete, note any issues (e.g., missing manager refs → add stubs).
- [ ] Final: If all pass, attempt_completion with summary of integrated features.

## Progress Notes
- Started: After plan approval.
- Core adapters already partially implemented; focus on full coverage.
- If manager refs (e.g., BIMManager) missing in parent, add placeholder objects in useEffect.
- Total steps: 5 main phases, iterative updates to this file.
