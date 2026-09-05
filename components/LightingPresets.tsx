import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SkyMaterial } from '@babylonjs/materials';
import { calculateRealWorldLighting, temperatureToRGB, calculateSunAngle, calculateSunIntensity, calculateColorTemperature } from '../utils/lightingUtils';
import { Sun, Moon, Sparkles, Home, Building2, Zap, Lightbulb, Brain, Image as ImageIcon, CloudSun, RotateCcw, Trash2 } from 'lucide-react';
import { showToast } from './utils/toast';

// Persists the uploaded HDRI (as its raw file, in IndexedDB - it's typically tens of MB,
// too large for localStorage/a project JSON) so it survives a page reload instead of
// vanishing the moment the blob: URL created for it goes stale. IndexedDB is scoped per
// browser/device, so this covers "reload this same browser tab later" - it does not by
// itself sync the file to a physically separate VR headset's own browser session; that
// would need the file going through whatever backend project-save system loads the
// scene there, which is outside this component.
const HDRI_DB_NAME = 'naviz-lighting';
const HDRI_STORE_NAME = 'hdri';
const HDRI_KEY = 'current';

// Everything below (preset choice, custom sun/ambient sliders, exposure, exterior/
// interior mode, flat/procedural sky) previously lived only in useState with no
// persistence at all, unlike the HDRI file above - so switching lighting worked fine
// in the moment but silently reset back to the hardcoded defaults on every reload/reopen.
const LIGHTING_SETTINGS_KEY = 'naviz:lightingSettings';

interface PersistedLightingSettings {
  mode: 'exterior' | 'interior';
  selectedPreset: string;
  customIntensity: number;
  customAngle: number;
  ambientIntensity: number;
  exposure: number;
  skyMode: 'flat' | 'procedural';
}

function loadPersistedLightingSettings(): Partial<PersistedLightingSettings> {
  try {
    const raw = localStorage.getItem(LIGHTING_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

interface StoredHdri {
  blob: Blob;
  fileName: string;
  intensity: number;
  envLightingIntensity: number;
  rotation: number;
}

function openHdriDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HDRI_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(HDRI_STORE_NAME)) {
        req.result.createObjectStore(HDRI_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHdriToDb(data: StoredHdri): Promise<void> {
  const db = await openHdriDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HDRI_STORE_NAME, 'readwrite');
    tx.objectStore(HDRI_STORE_NAME).put(data, HDRI_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHdriFromDb(): Promise<StoredHdri | null> {
  const db = await openHdriDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HDRI_STORE_NAME, 'readonly');
    const req = tx.objectStore(HDRI_STORE_NAME).get(HDRI_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteHdriFromDb(): Promise<void> {
  const db = await openHdriDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HDRI_STORE_NAME, 'readwrite');
    tx.objectStore(HDRI_STORE_NAME).delete(HDRI_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// A real .hdr file (especially the high-res ones - "16k", "32k" - that actually look good
// as a visible sky) is commonly 50-200MB+, and IndexedDB quotas vary a lot by browser -
// small in Safari/private browsing especially. Warn before storing rather than after a
// silent failure with nothing to explain why it didn't survive the next reload.
const HDRI_PERSIST_WARN_BYTES = 80 * 1024 * 1024;

interface LightingPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  sunIntensity: number;
  sunAngle: number;
  ambientIntensity: number;
  skyboxColor: BABYLON.Color3;
  groundColor: BABYLON.Color3;
}

interface MaterialAnalysis {
  name: string;
  color: { r: number; g: number; b: number };
  suggestedLightColor: { r: number; g: number; b: number };
  luminance: number;
}

interface LightingPresetsProps {
  scene: BABYLON.Scene;
  onPresetChange?: (preset: LightingPreset) => void;
  workspaceArea?: { latitude?: number; longitude?: number };
}

const LightingPresets: React.FC<LightingPresetsProps> = ({ scene, onPresetChange, workspaceArea }) => {
  const persistedLighting = useRef(loadPersistedLightingSettings()).current;
  const [mode, setMode] = useState<'exterior' | 'interior'>(persistedLighting.mode ?? 'exterior');
  const [selectedPreset, setSelectedPreset] = useState<string>(persistedLighting.selectedPreset ?? 'day');
  const [customIntensity, setCustomIntensity] = useState(persistedLighting.customIntensity ?? 1.0);
  const [customAngle, setCustomAngle] = useState(persistedLighting.customAngle ?? 45);
  const [ambientIntensity, setAmbientIntensity] = useState(persistedLighting.ambientIntensity ?? 0.3);
  const [exposure, setExposure] = useState(persistedLighting.exposure ?? 1.0);
  const [realWorldTimeMode, setRealWorldTimeMode] = useState(false);
  interface InteriorLight {
    id: string;
    type: 'Point' | 'Spot';
    intensity: number;
    position: { x: number; y: number; z: number };
    direction?: { x: number; y: number; z: number }; // Spot only
    angleDeg?: number; // Spot only - cone width
    light: BABYLON.Light;
  }
  const [interiorLights, setInteriorLights] = useState<InteriorLight[]>([]);
  const [materialAnalysis, setMaterialAnalysis] = useState<MaterialAnalysis[]>([]);
  const [aiOptimizing, setAiOptimizing] = useState(false);

  // Sky: flat color (original behavior), a real procedural sky dome (like
  // Enscape's built-in sun/sky), or an imported real-world HDRI.
  //
  // Defaults to 'procedural' rather than 'flat' - a scene with no skybox at all (the old
  // default) rendered every new session with nothing but a flat clear-color void behind
  // the model, no matter how good the PBR materials/shadows/post-processing were. The
  // procedural sky costs nothing extra to ship (no HDRI asset file needed - SkyMaterial
  // is a real-time atmospheric-scattering shader already built into this component,
  // synced to the actual sun direction) and gives every session a real, dynamic outdoor
  // sky by default instead of requiring the user to find and click "Sky Dome" first.
  const [skyMode, setSkyMode] = useState<'flat' | 'procedural' | 'hdri'>(persistedLighting.skyMode ?? 'procedural');
  const [hdriFileName, setHdriFileName] = useState<string | null>(null);
  // "Sky Brightness" is purely visual (how bright the background dome looks);
  // "Environment Lighting" is how much the HDRI actually lights/reflects onto other
  // PBR materials in the scene - Babylon's default skybox helper clones the HDR
  // texture for its own material (see handleHdriUpload), so these were always two
  // separate texture instances under the hood even though only one slider existed.
  // Now each slider drives the instance it actually affects.
  const [hdriIntensity, setHdriIntensity] = useState(1.0);
  const [envLightingIntensity, setEnvLightingIntensity] = useState(1.0);
  const [hdriRotation, setHdriRotation] = useState(0);
  const skyboxRef = useRef<BABYLON.Mesh | null>(null);
  const skyMaterialRef = useRef<SkyMaterial | null>(null);
  const hdriTextureRef = useRef<BABYLON.HDRCubeTexture | null>(null);
  // The skybox's own reflectionTexture is a *clone* Babylon makes internally
  // (Scene.prototype.createDefaultSkybox does `environmentTexture.clone()`) - it is
  // not the same object as hdriTextureRef, so rotating/dimming hdriTextureRef alone
  // never touched what the visible sky dome actually samples. Both must be kept in sync.
  const skyboxReflectionTextureRef = useRef<BABYLON.EnvCubeTexture | null>(null);
  const hdriBlobUrlRef = useRef<string | null>(null);
  const preHdriIntensityRef = useRef<{ dir: number; hemi: number } | null>(null);

  // Merged from the old standalone Sun Study panel: scrub any hour/month to
  // preview shadows and light color across the day, independent of the real
  // current date (Real World Time, above, uses the actual current moment).
  const [timeSimEnabled, setTimeSimEnabled] = useState(false);
  const [simHour, setSimHour] = useState(12);
  const [simMonth, setSimMonth] = useState(new Date().getMonth());

  const presets: LightingPreset[] = [
    { id: 'day', name: 'Day', icon: '☀️', description: 'Bright daylight', sunIntensity: 1.2, sunAngle: 45, ambientIntensity: 0.3, skyboxColor: new BABYLON.Color3(0.5, 0.7, 1.0), groundColor: new BABYLON.Color3(0.2, 0.3, 0.1) },
    { id: 'sunset', name: 'Sunset', icon: '🌅', description: 'Warm evening', sunIntensity: 0.8, sunAngle: 15, ambientIntensity: 0.2, skyboxColor: new BABYLON.Color3(1.0, 0.6, 0.3), groundColor: new BABYLON.Color3(0.3, 0.2, 0.1) },
    { id: 'night', name: 'Night', icon: '🌙', description: 'Dark night', sunIntensity: 0.1, sunAngle: -30, ambientIntensity: 0.05, skyboxColor: new BABYLON.Color3(0.1, 0.1, 0.2), groundColor: new BABYLON.Color3(0.05, 0.05, 0.05) },
    { id: 'studio', name: 'Studio', icon: '💡', description: 'Even studio', sunIntensity: 0.6, sunAngle: 90, ambientIntensity: 0.4, skyboxColor: new BABYLON.Color3(0.8, 0.8, 0.9), groundColor: new BABYLON.Color3(0.4, 0.4, 0.4) },
  ];

  const getDirLight = () => scene.lights.find(l => l instanceof BABYLON.DirectionalLight) as BABYLON.DirectionalLight | undefined;
  const getHemiLight = () => scene.lights.find(l => l instanceof BABYLON.HemisphericLight) as BABYLON.HemisphericLight | undefined;

  const applyPreset = useCallback((preset: LightingPreset) => {
    if (realWorldTimeMode) return;
    setSelectedPreset(preset.id);
    const dir = getDirLight();
    const hemi = getHemiLight();
    if (dir) {
      dir.intensity = preset.sunIntensity;
      const rad = (preset.sunAngle * Math.PI) / 180;
      dir.direction = new BABYLON.Vector3(Math.sin(rad), -Math.cos(rad), 0);
    }
    if (hemi) {
      hemi.intensity = preset.ambientIntensity;
      hemi.groundColor = preset.groundColor;
    }
    // Keep the Custom sliders (the values that get persisted below and reapplied on
    // mount) in sync with whatever preset was just clicked - previously these two
    // control paths were disconnected, so a preset choice never survived a reload.
    setCustomIntensity(preset.sunIntensity);
    setCustomAngle(preset.sunAngle);
    setAmbientIntensity(preset.ambientIntensity);
    onPresetChange?.(preset);
  }, [scene, realWorldTimeMode, onPresetChange]);

  // Deliberately still usable while an HDRI is active (not gated on skyMode) - the
  // HDRI-entry effect below only sets a reasonable *default* dim for the sun/ambient,
  // it doesn't lock them; StandardMaterial surfaces (which don't read
  // scene.environmentTexture at all - see BIMManager.ts) may need more light than that
  // default gives them, so these sliders stay the manual override for that.
  const applyCustomExterior = useCallback(() => {
    if (realWorldTimeMode) return;
    const dir = getDirLight();
    const hemi = getHemiLight();
    if (dir) {
      dir.intensity = customIntensity;
      const rad = (customAngle * Math.PI) / 180;
      dir.direction = new BABYLON.Vector3(Math.sin(rad), -Math.cos(rad), 0);
    }
    if (hemi) hemi.intensity = ambientIntensity;
  }, [customIntensity, customAngle, ambientIntensity, realWorldTimeMode, scene]);

  useEffect(() => { applyCustomExterior(); }, [customIntensity, customAngle, ambientIntensity]);
  useEffect(() => { if (scene) scene.imageProcessingConfiguration.exposure = exposure; }, [scene, exposure]);

  // Every lighting choice here persists to localStorage (see the effect below) and gets
  // silently REAPPLIED on every future mount, before the user touches anything - this
  // component is always mounted regardless of whether the Lighting panel is open (see
  // uiSegments.tsx). That's normally the point (a chosen look survives a reload), but it
  // means a single Night/Sunset/Interior click during a demo or test session bakes a dark
  // scene into every future load in that browser, with nothing visibly "wrong" to explain
  // why - the exact "opens dark instead of bright" report this button exists to fix. One
  // click gets back to the same bright baseline a brand new browser would start at.
  const resetToBrightDay = useCallback(() => {
    // Turn off Real World Time / Time Simulation FIRST, not via applyPreset - applyPreset
    // bails out early whenever realWorldTimeMode is still true (by design, for a normal
    // preset click), but React batches this same function's state updates, so
    // realWorldTimeMode would still read as its OLD value inside applyPreset's closure
    // this same tick, silently no-op-ing the whole reset.
    setRealWorldTimeMode(false);
    setTimeSimEnabled(false);
    setMode('exterior');
    const day = presets[0]; // 'day' preset
    setSelectedPreset(day.id);
    const dir = getDirLight();
    const hemi = getHemiLight();
    if (dir) {
      dir.intensity = day.sunIntensity;
      const rad = (day.sunAngle * Math.PI) / 180;
      dir.direction = new BABYLON.Vector3(Math.sin(rad), -Math.cos(rad), 0);
    }
    if (hemi) {
      hemi.intensity = day.ambientIntensity;
      hemi.groundColor = day.groundColor;
    }
    setCustomIntensity(day.sunIntensity);
    setCustomAngle(day.sunAngle);
    setAmbientIntensity(day.ambientIntensity);
    setExposure(1.0);
    // An HDRI deliberately dims the sun/ambient to 35%/60% of whatever they were (see the
    // skyMode==='hdri' effect further down, needed so StandardMaterial surfaces - which get
    // no light at all from an environment texture - don't go dark) - staying in HDRI mode
    // through this reset would leave the values just set above clamped right back down,
    // which is exactly why a first version of this reset still looked dull. Also re-seeds
    // preHdriIntensityRef with these same bright values (rather than leaving it holding
    // whatever was captured back whenever the HDRI was first turned on) so if that effect's
    // own cleanup path runs after this, it restores to THIS bright baseline, not a stale
    // dim one.
    preHdriIntensityRef.current = { dir: day.sunIntensity, hemi: day.ambientIntensity };
    setSkyMode('procedural');
    onPresetChange?.(day);
  }, [onPresetChange]);

  // Persist lighting choices so they survive a reload/reopen instead of silently
  // snapping back to the hardcoded defaults. skyMode is only saved as 'flat'/'procedural'
  // here - 'hdri' is skipped because the actual HDRI file has its own restore path above
  // (loadHdriFromDb) which sets skyMode itself once the file is confirmed to still exist.
  useEffect(() => {
    try {
      const previous = loadPersistedLightingSettings();
      const next: PersistedLightingSettings = {
        mode,
        selectedPreset,
        customIntensity,
        customAngle,
        ambientIntensity,
        exposure,
        skyMode: skyMode === 'hdri' ? (previous.skyMode ?? 'flat') : skyMode,
      };
      localStorage.setItem(LIGHTING_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable (private browsing, etc) - lighting still works in-session
    }
  }, [mode, selectedPreset, customIntensity, customAngle, ambientIntensity, exposure, skyMode]);

  // Time Simulation (merged from the old standalone Sun Study panel): scrub
  // any hour/month to preview shadow movement, independent of the real
  // current date/time.
  const applyTimeSimulation = useCallback((hour: number, month: number) => {
    const dir = getDirLight();
    const hemi = getHemiLight();
    if (!dir) return;
    const date = new Date();
    date.setMonth(month);
    date.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
    const elevation = calculateSunAngle(date, workspaceArea?.latitude ?? 40.71, workspaceArea?.longitude ?? -74);
    const intensity = calculateSunIntensity(elevation);
    const kelvin = calculateColorTemperature(elevation);
    const azimuthDeg = ((hour - 6) / 12) * 180;
    const azimuthRad = (azimuthDeg * Math.PI) / 180;
    const elevationRad = (Math.max(elevation, 2) * Math.PI) / 180;
    dir.direction = new BABYLON.Vector3(
      -Math.cos(elevationRad) * Math.sin(azimuthRad),
      -Math.sin(elevationRad),
      -Math.cos(elevationRad) * Math.cos(azimuthRad)
    );
    dir.intensity = Math.max(0.1, intensity * 1.5);
    const rgb = temperatureToRGB(kelvin);
    dir.diffuse.set(rgb.r, rgb.g, rgb.b);
    if (hemi) hemi.intensity = Math.max(0.05, intensity * 0.3);
  }, [scene, workspaceArea]);

  useEffect(() => {
    if (!timeSimEnabled) return;
    applyTimeSimulation(simHour, simMonth);
  }, [timeSimEnabled, simHour, simMonth, applyTimeSimulation]);

  // Sky mode management: dispose whatever the previous mode created before
  // switching, so flat/procedural/HDRI never leak resources or stack on
  // top of each other.
  useEffect(() => {
    if (skyMode !== 'hdri') {
      hdriTextureRef.current?.dispose();
      hdriTextureRef.current = null;
      skyboxReflectionTextureRef.current?.dispose();
      skyboxReflectionTextureRef.current = null;
      if (hdriBlobUrlRef.current) { URL.revokeObjectURL(hdriBlobUrlRef.current); hdriBlobUrlRef.current = null; }
      if (scene) scene.environmentTexture = null;
      setHdriFileName(null);
      // The HDRI skybox mesh must be disposed here regardless of which mode we're
      // switching TO - this previously only happened when landing on 'flat'
      // specifically, so switching HDRI -> Sky Dome left the old HDRI skybox mesh
      // orphaned and still fully opaque in the scene, which made the switch look
      // like it silently did nothing (the old sky just kept covering everything).
      if (skyboxRef.current) {
        skyboxRef.current.dispose();
        skyboxRef.current = null;
      }
    }
    if (skyMode !== 'procedural' && skyMaterialRef.current) {
      skyboxRef.current?.dispose();
      skyMaterialRef.current.dispose();
      skyboxRef.current = null;
      skyMaterialRef.current = null;
    }
  }, [skyMode, scene]);

  // A real HDRI encodes real-world sun + sky lighting for PBRMaterial (which reads
  // scene.environmentTexture directly) - but StandardMaterial has NO mechanism to
  // receive any lighting from an environment texture at all, only from actual Light
  // objects. Dimming the sun/ambient to near-zero (an earlier version of this fix)
  // made HDRI lighting read correctly on PBR materials but left every
  // StandardMaterial surface - which is what this app's BIM-imported walls/pipes/etc.
  // actually use (see BIMManager.ts) - with almost no light source at all, i.e. black.
  // A moderate reduction with a floor keeps those surfaces visibly lit while still
  // giving the HDRI room to read on anything that IS PBR.
  useEffect(() => {
    const dir = getDirLight();
    const hemi = getHemiLight();
    if (skyMode === 'hdri') {
      if (!preHdriIntensityRef.current) {
        preHdriIntensityRef.current = { dir: dir?.intensity ?? 1, hemi: hemi?.intensity ?? 0.3 };
      }
      if (dir) dir.intensity = Math.max(preHdriIntensityRef.current.dir * 0.35, 0.35);
      if (hemi) hemi.intensity = Math.max(preHdriIntensityRef.current.hemi * 0.6, 0.25);
    } else if (preHdriIntensityRef.current) {
      if (dir) dir.intensity = preHdriIntensityRef.current.dir;
      if (hemi) hemi.intensity = preHdriIntensityRef.current.hemi;
      preHdriIntensityRef.current = null;
    }
  }, [skyMode, scene]);

  // Real-time procedural sky dome (like Enscape's built-in sun/sky), kept in
  // sync with whatever is currently driving the sun direction (presets,
  // custom sliders, Real World Time, or Time Simulation above).
  useEffect(() => {
    if (skyMode !== 'procedural' || !scene) return;
    const skyboxMesh = BABYLON.MeshBuilder.CreateBox('proceduralSkybox', { size: 1000 }, scene);
    skyboxMesh.infiniteDistance = true;
    const skyMaterial = new SkyMaterial('proceduralSkyMaterial', scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.turbidity = 10;
    skyMaterial.luminance = 1;
    skyMaterial.useSunPosition = true;
    skyboxMesh.material = skyMaterial;
    skyboxRef.current = skyboxMesh;
    skyMaterialRef.current = skyMaterial;

    const sync = () => {
      const dir = getDirLight();
      if (dir) skyMaterial.sunPosition = dir.direction.scale(-1000);
    };
    sync();
    const observer = scene.onBeforeRenderObservable.add(sync);

    return () => {
      scene.onBeforeRenderObservable.remove(observer);
      skyboxMesh.dispose();
      skyMaterial.dispose();
      skyboxRef.current = null;
      skyMaterialRef.current = null;
    };
  }, [skyMode, scene]);

  // Core "make this file the active HDRI" logic, shared by the file-picker handler and
  // the auto-restore-on-mount effect below. Takes explicit intensity/rotation values
  // instead of reading the hdriIntensity/envLightingIntensity/hdriRotation state
  // directly, because on the restore path those state setters haven't committed yet
  // when this runs (same render pass) - reading them would apply the stale defaults.
  const applyHdriFile = useCallback((file: Blob, fileName: string, intensity: number, envIntensity: number, rotationDeg: number) => {
    if (!scene) return;

    if (hdriBlobUrlRef.current) URL.revokeObjectURL(hdriBlobUrlRef.current);
    hdriTextureRef.current?.dispose();
    skyboxReflectionTextureRef.current?.dispose();
    skyboxReflectionTextureRef.current = null;
    skyboxRef.current?.dispose();
    skyboxRef.current = null;

    const url = URL.createObjectURL(file);
    hdriBlobUrlRef.current = url;
    const rotationRad = (rotationDeg * Math.PI) / 180;

    // Drives lighting/reflections on every other PBR material in the scene, via
    // scene.environmentTexture - independent of how bright the visible sky looks.
    const hdrTexture = new BABYLON.HDRCubeTexture(url, scene, 512, false, true, false, true);
    hdrTexture.level = envIntensity;
    hdrTexture.rotationY = rotationRad;
    hdriTextureRef.current = hdrTexture;
    scene.environmentTexture = hdrTexture;

    const skybox = scene.createDefaultSkybox(hdrTexture, true, 1000, 0.3);
    if (skybox) {
      skyboxRef.current = skybox as BABYLON.Mesh;
      // createDefaultSkybox clones the texture for the skybox material rather than
      // reusing hdrTexture directly - that clone is what the visible sky dome
      // actually samples, so it needs its own brightness/rotation kept in sync.
      const skyboxTex = (skybox.material as BABYLON.PBRMaterial)?.reflectionTexture as BABYLON.EnvCubeTexture | null;
      if (skyboxTex) {
        skyboxTex.level = intensity;
        skyboxTex.rotationY = rotationRad;
        skyboxReflectionTextureRef.current = skyboxTex;
      }
    }

    setHdriFileName(fileName);
    setSkyMode('hdri');
  }, [scene]);

  const handleHdriUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyHdriFile(file, file.name, hdriIntensity, envLightingIntensity, hdriRotation);
    if (file.size > HDRI_PERSIST_WARN_BYTES) {
      showToast.info('Large HDRI file', `${(file.size / (1024 * 1024)).toFixed(0)}MB - this browser may not have room to keep it saved for next time. It'll still work for this session.`);
    }
    // Was a console.warn only on failure and nothing at all on success - IndexedDB quotas
    // vary a lot by browser (much smaller in Safari/private browsing especially), so a
    // real, common failure here looked identical to it just working, and there was no
    // toast to distinguish "saved for next time" from "worked now, but won't survive a
    // reload".
    saveHdriToDb({ blob: file, fileName: file.name, intensity: hdriIntensity, envLightingIntensity, rotation: hdriRotation })
      .then(() => showToast.success('HDRI saved', 'It will load automatically the next time this model opens, on this device.'))
      .catch(err => {
        console.warn('[LightingPresets] Could not save HDRI for persistence:', err);
        showToast.error('Could not save this HDRI for next time', 'It works for this session, but you\'ll need to re-upload it after a reload - the file may be too large for this browser to store.');
      });
    e.target.value = '';
  };

  // Clears the active HDRI (back to the procedural sky) and forgets it from IndexedDB -
  // previously the only way to move off an HDRI was switching to Flat/Sky Dome, which left
  // the file itself still stored and silently restored again on the next reload.
  const clearHdri = () => {
    if (hdriBlobUrlRef.current) { URL.revokeObjectURL(hdriBlobUrlRef.current); hdriBlobUrlRef.current = null; }
    setSkyMode('procedural');
    setHdriFileName(null);
    deleteHdriFromDb().catch(err => console.warn('[LightingPresets] Could not remove saved HDRI:', err));
  };

  // Restore a previously uploaded HDRI on mount, if one was saved - otherwise every
  // reload silently lost it even though the intent was clearly to keep using it.
  useEffect(() => {
    if (!scene) return;
    let cancelled = false;
    loadHdriFromDb()
      .then(saved => {
        if (cancelled || !saved) return;
        setHdriIntensity(saved.intensity);
        setEnvLightingIntensity(saved.envLightingIntensity);
        setHdriRotation(saved.rotation);
        applyHdriFile(saved.blob, saved.fileName, saved.intensity, saved.envLightingIntensity, saved.rotation);
      })
      .catch(err => console.warn('[LightingPresets] Could not restore saved HDRI:', err));
    return () => { cancelled = true; };
    // Deliberately mount-only (plus whenever the Scene itself changes) - this should
    // run once to restore state, not every time applyHdriFile's identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // "Sky Brightness" - visual only, the skybox's own cloned texture.
  useEffect(() => {
    if (skyboxReflectionTextureRef.current) skyboxReflectionTextureRef.current.level = hdriIntensity;
  }, [hdriIntensity]);

  // "Environment Lighting" - how much the HDRI lights/reflects onto other materials.
  useEffect(() => {
    if (hdriTextureRef.current) hdriTextureRef.current.level = envLightingIntensity;
  }, [envLightingIntensity]);

  // Rotates both the visible sky AND everything it's reflecting/lighting on other PBR
  // materials - unlike intensity, rotation is kept as one control on purpose (an HDRI
  // rotated out of sync with its own lighting would look broken, sun in the wrong
  // place relative to its own highlights), but both texture instances (see above) need
  // the update or only the lighting silently rotated while the visible sky stayed put.
  useEffect(() => {
    const rad = (hdriRotation * Math.PI) / 180;
    if (hdriTextureRef.current) hdriTextureRef.current.rotationY = rad;
    if (skyboxReflectionTextureRef.current) skyboxReflectionTextureRef.current.rotationY = rad;
  }, [hdriRotation]);

  // Full cleanup on unmount, regardless of which sky mode was last active.
  useEffect(() => {
    return () => {
      skyboxRef.current?.dispose();
      skyMaterialRef.current?.dispose();
      hdriTextureRef.current?.dispose();
      if (hdriBlobUrlRef.current) URL.revokeObjectURL(hdriBlobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!scene || !realWorldTimeMode) return;
    const update = () => {
      const params = calculateRealWorldLighting(new Date(), workspaceArea?.latitude ?? 40.71, workspaceArea?.longitude ?? -74);
      const dir = getDirLight();
      const hemi = getHemiLight();
      if (dir) {
        dir.intensity = params.intensity;
        const rad = (params.sunAngle * Math.PI) / 180;
        dir.direction = new BABYLON.Vector3(Math.sin(rad), -Math.cos(rad), 0);
      }
      if (hemi) {
        hemi.intensity = Math.max(0.05, params.intensity * 0.3);
        const rgb = temperatureToRGB(params.temperature);
        hemi.groundColor = new BABYLON.Color3(rgb.r * 0.3, rgb.g * 0.3, rgb.b * 0.3);
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [scene, realWorldTimeMode, workspaceArea]);

  // Interior: Analyze scene materials
  const analyzeMaterials = useCallback(() => {
    const results: MaterialAnalysis[] = [];
    scene.materials.forEach((mat, i) => {
      if (!(mat instanceof BABYLON.PBRMaterial) && !(mat instanceof BABYLON.StandardMaterial)) return;
      const col = mat instanceof BABYLON.PBRMaterial ? mat.albedoColor : mat.diffuseColor;
      const r = col.r, g = col.g, b = col.b;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const suggested = { r: Math.min(1, r + 0.3), g: Math.min(1, g + 0.3), b: Math.min(1, b + 0.3) };
      results.push({ name: mat.name || `Material ${i}`, color: { r, g, b }, suggestedLightColor: suggested, luminance });
    });
    setMaterialAnalysis(results);
  }, [scene]);

  // Interior: Add point light. Each new light previously spawned at the exact
  // same hardcoded position every time with no way to move it afterward -
  // slightly offsetting each new one and exposing real position sliders
  // below fixes both "always in one spot" and "can't place it".
  const addInteriorPointLight = useCallback(() => {
    const n = interiorLights.length;
    const pos = { x: 2 + (n % 3), y: 3, z: 2 + Math.floor(n / 3) };
    const pt = new BABYLON.PointLight(`interior-pt-${Date.now()}`, new BABYLON.Vector3(pos.x, pos.y, pos.z), scene);
    pt.intensity = 0.8;
    pt.range = 10;
    setInteriorLights(prev => [...prev, { id: pt.name, type: 'Point', intensity: 0.8, position: pos, light: pt }]);
  }, [scene, interiorLights.length]);

  // Interior: Add spot light - a real spotlight needs angle (cone width) and
  // exponent (edge falloff sharpness) to look like an actual fixture rather
  // than a flat disc of light; both are now adjustable, along with position
  // and aim direction.
  const addInteriorSpotLight = useCallback(() => {
    const n = interiorLights.length;
    const pos = { x: (n % 3) * 2, y: 5, z: Math.floor(n / 3) * 2 };
    const dir = { x: 0, y: -1, z: 0 };
    const angleDeg = 45;
    const sp = new BABYLON.SpotLight(
      `interior-spot-${Date.now()}`,
      new BABYLON.Vector3(pos.x, pos.y, pos.z),
      new BABYLON.Vector3(dir.x, dir.y, dir.z),
      (angleDeg * Math.PI) / 180,
      2,
      scene
    );
    sp.intensity = 1.2;
    sp.range = 15;
    setInteriorLights(prev => [...prev, { id: sp.name, type: 'Spot', intensity: 1.2, position: pos, direction: dir, angleDeg, light: sp }]);
  }, [scene, interiorLights.length]);

  const updateInteriorLight = (id: string, updates: Partial<InteriorLight>) => {
    setInteriorLights(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, ...updates };
      const light = item.light;
      if (updates.position) {
        (light as BABYLON.PointLight | BABYLON.SpotLight).position = new BABYLON.Vector3(updates.position.x, updates.position.y, updates.position.z);
      }
      if (updates.direction && light instanceof BABYLON.SpotLight) {
        light.direction = new BABYLON.Vector3(updates.direction.x, updates.direction.y, updates.direction.z);
      }
      if (updates.angleDeg !== undefined && light instanceof BABYLON.SpotLight) {
        light.angle = (updates.angleDeg * Math.PI) / 180;
      }
      if (updates.intensity !== undefined) {
        light.intensity = updates.intensity;
      }
      return next;
    }));
  };

  // Interior: dim the direct sun (indoors, it shouldn't blast in like open daylight) and
  // lift ambient a bit, but SCALED from the user's own exterior settings rather than a
  // flat hardcoded 0.2/0.5 - a flat override ignores whatever customIntensity actually is
  // (which could itself already be quite low, e.g. a Night/Sunset preset was chosen
  // earlier), and specifically because `mode` is persisted (see loadPersistedLightingSettings
  // above) and this effect fires again on every future mount purely from that stale value -
  // a proportional floor is far less likely to read as "the scene is just broken" than a
  // flat 0.2 would if it's compounding on top of an already-dim customIntensity.
  const setInteriorMode = useCallback((on: boolean) => {
    const dir = getDirLight();
    const hemi = getHemiLight();
    // Raised from *0.3/floor 0.3 and floor 0.4 - interior was reading as noticeably darker
    // than intended, closer to a dim evening than "indoors on a bright day". Ambient
    // (hemi) is what actually reads as "room brightness" here - direct sun stays dimmer
    // than exterior on purpose (it's not meant to blast straight in like open daylight).
    if (dir) dir.intensity = on ? Math.max(customIntensity * 0.5, 0.5) : customIntensity;
    if (hemi) hemi.intensity = on ? Math.max(ambientIntensity * 1.5, 0.6) : ambientIntensity;
  }, [customIntensity, ambientIntensity, scene]);

  useEffect(() => {
    setInteriorMode(mode === 'interior');
  }, [mode]);

  // AI: Optimize lighting based on materials
  const aiOptimizeLighting = useCallback(async () => {
    setAiOptimizing(true);
    const results: MaterialAnalysis[] = [];
    scene.materials.forEach((mat, i) => {
      if (!(mat instanceof BABYLON.PBRMaterial) && !(mat instanceof BABYLON.StandardMaterial)) return;
      const col = mat instanceof BABYLON.PBRMaterial ? mat.albedoColor : mat.diffuseColor;
      const r = col.r, g = col.g, b = col.b;
      const suggested = { r: Math.min(1, r + 0.3), g: Math.min(1, g + 0.3), b: Math.min(1, b + 0.3) };
      results.push({ name: mat.name || `Material ${i}`, color: { r, g, b }, suggestedLightColor: suggested, luminance: 0.299 * r + 0.587 * g + 0.114 * b });
    });
    setMaterialAnalysis(results);
    await new Promise(r => setTimeout(r, 600));
    const hemi = getHemiLight();
    if (results.length > 0 && hemi) {
      const avg = results.reduce((a, m) => ({ r: a.r + m.suggestedLightColor.r, g: a.g + m.suggestedLightColor.g, b: a.b + m.suggestedLightColor.b }), { r: 0, g: 0, b: 0 });
      const n = results.length;
      hemi.groundColor = new BABYLON.Color3(avg.r / n, avg.g / n, avg.b / n);
      hemi.intensity = 0.4;
    } else if (hemi) {
      hemi.intensity = 0.45;
    }
    setAiOptimizing(false);
  }, [scene]);

  return (
    <div className="lighting-panel">
      <div className="lighting-mode-tabs">
        <button className={mode === 'exterior' ? 'active' : ''} onClick={() => setMode('exterior')} title="Outdoor / Sun">
          <Sun className="w-4 h-4" /> Exterior
        </button>
        <button className={mode === 'interior' ? 'active' : ''} onClick={() => setMode('interior')} title="Indoor lighting">
          <Building2 className="w-4 h-4" /> Interior
        </button>
        <button
          onClick={resetToBrightDay}
          title="Reset lighting back to bright daylight - use this if the model looks dark on open"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RotateCcw className="w-4 h-4" /> Reset to Bright
        </button>
      </div>

      <div className="lighting-scroll">
        {mode === 'exterior' && (
          <>
            <div className="preset-grid">
              {presets.map(p => (
                <button key={p.id} className={`preset-btn ${selectedPreset === p.id ? 'selected' : ''}`} onClick={() => applyPreset(p)} disabled={realWorldTimeMode || timeSimEnabled} title={p.description}>
                  <span className="preset-icon">{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            <div className="section">
              <label className="section-label">
                <span>Real World Time</span>
                <button className={`toggle-btn ${realWorldTimeMode ? 'on' : ''}`} disabled={timeSimEnabled} onClick={() => setRealWorldTimeMode(!realWorldTimeMode)}>{realWorldTimeMode ? 'ON' : 'OFF'}</button>
              </label>
              {realWorldTimeMode && <p className="hint">Lighting updates by time &amp; location</p>}
            </div>
            <div className="section">
              <label className="section-label">
                <span>Time Simulation</span>
                <button className={`toggle-btn ${timeSimEnabled ? 'on' : ''}`} disabled={realWorldTimeMode} onClick={() => setTimeSimEnabled(!timeSimEnabled)}>{timeSimEnabled ? 'ON' : 'OFF'}</button>
              </label>
              {timeSimEnabled && (
                <>
                  <p className="hint" style={{ marginBottom: 8 }}>Scrub any hour/month to preview sun position and shadows</p>
                  <Slider label={`Hour (${Math.floor(simHour) % 12 === 0 ? 12 : Math.floor(simHour) % 12}:${((simHour % 1) * 60).toFixed(0).padStart(2, '0')} ${simHour < 12 ? 'AM' : 'PM'})`} value={simHour} min={5} max={20} step={0.25} onChange={setSimHour} />
                  <Slider label={`Month (${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][simMonth]})`} value={simMonth} min={0} max={11} step={1} onChange={setSimMonth} />
                </>
              )}
            </div>
            <div className="section">
              <h4 className="section-title">Custom</h4>
              <Slider label="Sun" value={customIntensity} min={0} max={2} step={0.1} onChange={setCustomIntensity} />
              <Slider label="Angle" value={customAngle} min={-90} max={90} step={5} onChange={setCustomAngle} />
              <Slider label="Ambient" value={ambientIntensity} min={0} max={1} step={0.05} onChange={setAmbientIntensity} />
              <Slider label="Exposure" value={exposure} min={0.1} max={3} step={0.1} onChange={setExposure} />
            </div>
            <div className="section">
              <h4 className="section-title">
                <CloudSun className="w-4 h-4" /> Sky
              </h4>
              <div className="add-light-row">
                <button className={`add-btn ${skyMode === 'flat' ? 'active-mode' : ''}`} onClick={() => setSkyMode('flat')}>Flat</button>
                <button className={`add-btn ${skyMode === 'procedural' ? 'active-mode' : ''}`} onClick={() => setSkyMode('procedural')} title="Real-time sun/sky dome">
                  <CloudSun className="w-4 h-4" /> Sky Dome
                </button>
                <label className={`add-btn ${skyMode === 'hdri' ? 'active-mode' : ''}`} style={{ cursor: 'pointer' }} title={hdriFileName ? 'Pick a different .hdr file to replace the current one' : 'Upload a .hdr file'}>
                  <ImageIcon className="w-4 h-4" /> {hdriFileName ? 'Change HDRI' : 'HDRI'}
                  <input type="file" accept=".hdr" onChange={handleHdriUpload} style={{ display: 'none' }} />
                </label>
              </div>
              {skyMode === 'hdri' && (
                <>
                  {hdriFileName && (
                    <p className="hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span>Loaded: {hdriFileName}</span>
                      <button
                        onClick={clearHdri}
                        title="Remove this HDRI and go back to the sky dome"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </p>
                  )}
                  <Slider label="Sky Brightness" value={hdriIntensity} min={0} max={3} step={0.05} onChange={setHdriIntensity} />
                  <p className="hint" style={{ marginTop: -6 }}>How bright the visible sky background looks.</p>
                  <Slider label="Environment Lighting" value={envLightingIntensity} min={0} max={3} step={0.05} onChange={setEnvLightingIntensity} />
                  <p className="hint" style={{ marginTop: -6 }}>How much the HDRI actually lights and reflects onto materials in the scene - independent of the sky's visual brightness above.</p>
                  <Slider label="HDRI Rotation" value={hdriRotation} min={0} max={360} step={1} onChange={setHdriRotation} />
                  <p className="hint">Rotation turns both the visible sky and the light/reflections it casts on the scene - use it to point the sun (or brightest part of the sky) wherever you need it.</p>
                </>
              )}
              {skyMode === 'procedural' && (
                <p className="hint">Procedural sky follows the current sun direction automatically</p>
              )}
            </div>
          </>
        )}

        {mode === 'interior' && (
          <>
            <div className="section">
              <h4 className="section-title">Add Lights</h4>
              <div className="add-light-row">
                <button className="add-btn" onClick={addInteriorPointLight} title="Point light (omnidirectional)">
                  <Lightbulb className="w-4 h-4" /> Point
                </button>
                <button className="add-btn" onClick={addInteriorSpotLight} title="Spotlight (directional cone)">
                  <Zap className="w-4 h-4" /> Spot
                </button>
              </div>
              {interiorLights.length > 0 && (
                <div className="lights-list">
                  {interiorLights.map((item) => {
                    const { id, type, intensity, position, direction, angleDeg, light } = item;
                    return (
                      <div key={id} className="light-item-full">
                        <div className="light-item-header">
                          <span>{type} — {intensity.toFixed(1)}</span>
                          <button className="del-btn" onClick={() => { light.dispose(); setInteriorLights(prev => prev.filter(x => x.id !== id)); }}>✕</button>
                        </div>
                        <Slider label="Intensity" value={intensity} min={0} max={3} step={0.1} onChange={(v) => updateInteriorLight(id, { intensity: v })} />
                        <div className="pos-row">
                          <span className="pos-label">Position</span>
                          <Slider label="X" value={position.x} min={-15} max={15} step={0.25} onChange={(v) => updateInteriorLight(id, { position: { ...position, x: v } })} />
                          <Slider label="Y" value={position.y} min={0} max={10} step={0.25} onChange={(v) => updateInteriorLight(id, { position: { ...position, y: v } })} />
                          <Slider label="Z" value={position.z} min={-15} max={15} step={0.25} onChange={(v) => updateInteriorLight(id, { position: { ...position, z: v } })} />
                        </div>
                        {type === 'Spot' && direction && angleDeg !== undefined && (
                          <div className="pos-row">
                            <span className="pos-label">Aim &amp; Cone (real IES-style spotlight)</span>
                            <Slider label="Aim X" value={direction.x} min={-1} max={1} step={0.05} onChange={(v) => updateInteriorLight(id, { direction: { ...direction, x: v } })} />
                            <Slider label="Aim Y" value={direction.y} min={-1} max={1} step={0.05} onChange={(v) => updateInteriorLight(id, { direction: { ...direction, y: v } })} />
                            <Slider label="Aim Z" value={direction.z} min={-1} max={1} step={0.05} onChange={(v) => updateInteriorLight(id, { direction: { ...direction, z: v } })} />
                            <Slider label="Cone Angle" value={angleDeg} min={5} max={90} step={1} onChange={(v) => updateInteriorLight(id, { angleDeg: v })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="section">
              <h4 className="section-title">Material Analysis</h4>
              <button className="analyze-btn" onClick={analyzeMaterials}>
                <Sparkles className="w-4 h-4" /> Analyze Materials
              </button>
              {materialAnalysis.length > 0 && (
                <div className="material-list">
                  {materialAnalysis.slice(0, 6).map((m, i) => (
                    <div key={i} className="material-item">
                      <span>{m.name}</span>
                      <div className="color-dots">
                        <span className="dot" style={{ background: `rgb(${m.color.r*255},${m.color.g*255},${m.color.b*255})` }} title="Material" />
                        <span className="dot" style={{ background: `rgb(${m.suggestedLightColor.r*255},${m.suggestedLightColor.g*255},${m.suggestedLightColor.b*255})` }} title="Suggested light" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="section ai-section">
              <h4 className="section-title">
                <Brain className="w-4 h-4" /> AI Lighting
              </h4>
              <button className="ai-btn" onClick={aiOptimizeLighting} disabled={aiOptimizing}>
                {aiOptimizing ? 'Optimizing…' : 'Optimize for Materials'}
              </button>
              <p className="hint">Adjusts ambient and light colors based on scene materials</p>
            </div>
          </>
        )}
      </div>

      <style>{`
        .lighting-panel { display: flex; flex-direction: column; height: 100%; min-height: 320px; color: #f1f5f9; }
        .lighting-mode-tabs { display: flex; gap: 4px; margin-bottom: 12px; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 8px; }
        .lighting-mode-tabs button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border: none; border-radius: 6px; background: transparent; color: #94a3b8; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; }
        .lighting-mode-tabs button:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
        .lighting-mode-tabs button.active { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; }
        .lighting-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
        .lighting-scroll::-webkit-scrollbar { width: 6px; }
        .lighting-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        .preset-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
        .preset-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; background: rgba(51,65,85,0.8); border: 1px solid #475569; border-radius: 8px; color: #e2e8f0; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .preset-btn:hover:not(:disabled) { background: rgba(59,130,246,0.2); border-color: #3b82f6; }
        .preset-btn.selected { background: rgba(59,130,246,0.3); border-color: #3b82f6; box-shadow: 0 0 12px rgba(59,130,246,0.3); }
        .preset-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .preset-icon { font-size: 20px; }
        .section { margin-bottom: 16px; padding-top: 12px; border-top: 1px solid rgba(71,85,105,0.5); }
        .section:first-of-type { border-top: none; padding-top: 0; }
        .section-label { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
        .section-title { font-size: 12px; font-weight: 600; margin: 0 0 10px 0; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
        .toggle-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #475569; background: #334155; color: #94a3b8; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .toggle-btn.on { background: #10b981; border-color: #34d399; color: white; }
        .hint { font-size: 11px; color: #64748b; margin: 6px 0 0 0; }
        .add-light-row { display: flex; gap: 8px; margin-bottom: 12px; }
        .add-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; background: linear-gradient(135deg, #334155, #1e293b); border: 1px solid #475569; border-radius: 8px; color: #e2e8f0; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .add-btn:hover { background: linear-gradient(135deg, #3b82f6, #2563eb); border-color: #60a5fa; }
        .add-btn.active-mode { background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-color: #60a5fa; }
        .lights-list { display: flex; flex-direction: column; gap: 8px; }
        .light-item { display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 11px; }
        .light-item-full { padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 11px; margin-bottom: 8px; }
        .light-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-weight: 600; }
        .pos-row { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(71,85,105,0.4); }
        .pos-label { display: block; font-size: 10px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .light-item input { flex: 1; accent-color: #3b82f6; }
        .del-btn { padding: 2px 8px; background: #dc2626; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 10px; }
        .analyze-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: linear-gradient(135deg, #7c3aed, #5b21b6); border: none; border-radius: 8px; color: white; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .analyze-btn:hover { filter: brightness(1.1); }
        .material-list { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
        .material-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: 6px; font-size: 11px; }
        .color-dots { display: flex; gap: 6px; }
        .dot { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); }
        .ai-section { background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08)); padding: 12px; border-radius: 8px; border: 1px solid rgba(139,92,246,0.3); }
        .ai-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border: none; border-radius: 8px; color: white; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .ai-btn:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
        .ai-btn:disabled { opacity: 0.7; cursor: wait; }
      `}</style>
    </div>
  );
};

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="slider-row" style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>{label}: {value.toFixed(2)}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
    </div>
  );
}

export default LightingPresets;
