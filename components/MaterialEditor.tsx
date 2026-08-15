import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { WaterMaterial } from '@babylonjs/materials';
import { PerlinNoiseProceduralTexture } from '@babylonjs/procedural-textures';
import * as MaterialInterfaces from './interfaces/MaterialInterfaces';

interface MaterialEditorProps {
  sceneManager: any;
  selectedMesh?: BABYLON.AbstractMesh | null;
  onClose: () => void;
  onMaterialChange?: (material: MaterialInterfaces.MaterialState) => void;
  onMaterialApplied?: (mesh: BABYLON.AbstractMesh, material: BABYLON.Material) => void;
}

// Material "types" modeled after Enscape's Material Editor (Default, Emissive, Glass
// Simple/Advanced, Water, Foliage, Car Paint, Cloth, Carbon/Glossy). Each one reconfigures
// the underlying Babylon material's real, working features rather than just relabeling a
// preset - Enscape types with no faithful real-time Babylon equivalent (e.g. Toon, Liquid)
// were left out rather than faked with something that wouldn't actually look right.
type MaterialTypePreset = 'default' | 'emissive' | 'glassSimple' | 'glassAdvanced' | 'water' | 'foliage' | 'carPaint' | 'cloth' | 'carbon';

const MATERIAL_TYPE_OPTIONS: { value: MaterialTypePreset; label: string }[] = [
  { value: 'default', label: 'Default (PBR)' },
  { value: 'emissive', label: 'Emissive / Self-Illuminated' },
  { value: 'glassSimple', label: 'Glass (Simple)' },
  { value: 'glassAdvanced', label: 'Glass (Advanced / Refractive)' },
  { value: 'water', label: 'Water' },
  { value: 'foliage', label: 'Foliage (Two-Sided)' },
  { value: 'carPaint', label: 'Car Paint' },
  { value: 'cloth', label: 'Cloth / Curtain (Translucent)' },
  { value: 'carbon', label: 'Carbon Fiber / Glossy' },
];

const MaterialEditor: React.FC<MaterialEditorProps> = ({ sceneManager, selectedMesh, onClose, onMaterialChange, onMaterialApplied }) => {
  const [materials, setMaterials] = useState<MaterialInterfaces.MaterialState[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialInterfaces.MaterialState | null>(null);
  const [materialProperties, setMaterialProperties] = useState({
    diffuseColor: { r: 1, g: 1, b: 1 },
    specularColor: { r: 1, g: 1, b: 1 },
    emissiveColor: { r: 0, g: 0, b: 0 },
    alpha: 1,
    metallic: 0,
    roughness: 0.5,
    specularPower: 64,
    environmentIntensityScale: 1,
    reflectivityScale: 0.5,
    indexOfRefraction: 1.5,
    autoScaleReflection: true,
    autoScaleRefraction: true,
    emissiveIntensity: 1,
    uScale: 1,
    vScale: 1
  });

  const [materialTypePreset, setMaterialTypePreset] = useState<MaterialTypePreset>('default');
  const [waterProps, setWaterProps] = useState({ waveHeight: 0.15, windForce: 5, waveSpeed: 25, colorBlendFactor: 0.3 });

  // Enscape-style emissive lighting: "Luminance"/"Radius" are calibrated separately
  // from the bloom-facing Emissive Intensity above, so a surface can look bright on
  // screen without necessarily flooding the scene with fake bounce light, or vice
  // versa. When enabled, a real Babylon PointLight is parented to the mesh to stand
  // in for the GI contribution a path tracer would compute for a glowing surface -
  // WebGL rasterization can't derive that from the material alone.
  const [giSettings, setGiSettings] = useState({ enabled: false, luminance: 5, radius: 3 });

  const isEmissiveNamed = (name: string) => name.toLowerCase().includes('emissive');

  const buildMaterialStates = (): MaterialInterfaces.MaterialState[] => {
    if (!sceneManager?.scene) return [];
    // scene.materials does NOT include MultiMaterial - Babylon keeps those in the
    // separate scene.multiMaterials array. A mesh that's split into several material
    // slots (common on imported architectural/BIM models - walls, plumbing, HVAC parts)
    // uses a MultiMaterial, so without also flattening in its subMaterials here, that
    // mesh's real materials were invisible to this list entirely: the editor would edit
    // some unrelated material while the mesh itself never changed.
    const plainMaterials: BABYLON.Material[] = sceneManager.scene.materials;
    const subMaterials: BABYLON.Material[] = sceneManager.scene.multiMaterials.flatMap(
      (mm: BABYLON.MultiMaterial) => mm.subMaterials.filter((m): m is BABYLON.Material => !!m)
    );
    const seen = new Set<BABYLON.Material>();
    const allMaterials = [...plainMaterials, ...subMaterials].filter(mat => {
      if (seen.has(mat)) return false;
      seen.add(mat);
      return true;
    });
    return allMaterials.map((mat: BABYLON.Material, index: number) => ({
      id: mat.id || `material_${index}`,
      name: mat.name || `Material ${index + 1}`,
      type: (mat instanceof BABYLON.PBRMaterial ? 'pbr' : mat instanceof WaterMaterial ? 'custom' : 'standard') as MaterialInterfaces.MaterialState['type'],
      properties: mat,
      isActive: true,
      lastModified: Date.now()
    }));
  };

  // The material actually worth editing for a mesh - unwraps MultiMaterial down to its
  // first real subMaterial, since editing/texturing that object in place is what shows
  // up on the mesh (MultiMaterial itself has no diffuseColor/texture of its own).
  const resolveEditableMaterial = (mesh: BABYLON.AbstractMesh | null | undefined): BABYLON.Material | null => {
    const mat = mesh?.material;
    if (!mat) return null;
    if (mat instanceof BABYLON.MultiMaterial) {
      return mat.subMaterials.find((m): m is BABYLON.Material => !!m) || null;
    }
    return mat;
  };

  // Puts a material on a mesh - for a MultiMaterial mesh this replaces its first
  // sub-material slot in place rather than clobbering the whole multi-material
  // assignment (which would silently collapse every part of the mesh onto one material).
  const applyMaterialToMesh = (mesh: BABYLON.AbstractMesh, material: BABYLON.Material) => {
    const current = mesh.material;
    if (current instanceof BABYLON.MultiMaterial) {
      const idx = current.subMaterials.findIndex(m => !!m);
      current.subMaterials[idx >= 0 ? idx : 0] = material;
    } else {
      mesh.material = material;
    }
  };

  // Load materials from scene
  useEffect(() => {
    if (!sceneManager?.scene) return;
    const materialStates = buildMaterialStates();
    setMaterials(materialStates);
    if (materialStates.length === 0) return;

    // Prefer whatever mesh was already picked in the 3D view over just
    // defaulting to the first material in the scene (which was often the
    // leftover ground/box placeholder material, not the actual model) -
    // editing a mesh's material should mean editing THAT mesh's material.
    const editableMat = resolveEditableMaterial(selectedMesh);
    const forSelectedMesh = editableMat
      ? materialStates.find(m => m.properties === editableMat)
      : undefined;
    const initial = forSelectedMesh || materialStates[0];
    setSelectedMaterial(initial);
    loadMaterialProperties(initial);
    // Deliberately depends on the Scene instance, not the sceneManager wrapper object -
    // the caller passes a fresh `{ scene: ... }` literal every render, so keying on it
    // directly reran this effect (and reset every slider) on every parent re-render,
    // fighting any edit in progress the instant the workspace re-rendered for any
    // unrelated reason. Keying on the actual stable Scene fixes that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneManager?.scene]);

  // Keep the editor in sync with whatever mesh is currently picked in the
  // 3D view - previously picking a different mesh had no effect here, so
  // color/property edits could silently land on the wrong material.
  useEffect(() => {
    if (!sceneManager?.scene) return;
    const mat = resolveEditableMaterial(selectedMesh);
    if (!mat) return;
    let states = materials;
    let found = states.find(m => m.properties === mat);
    if (!found) {
      // The mesh's material isn't in our list yet (e.g. a model finished
      // loading after the initial scan) - refresh from the scene.
      states = buildMaterialStates();
      setMaterials(states);
      found = states.find(m => m.properties === mat);
    }
    if (found) {
      setSelectedMaterial(found);
      loadMaterialProperties(found);
    }
  }, [selectedMesh]);

  // Snapshot this material's current values the moment it's loaded into the
  // editor (not on every slider tick, which would flood the stack with
  // intermediate drag states) - Ctrl+Z restores to this baseline, undoing
  // the whole editing session on this material. Global undo previously only
  // tracked mesh transforms; material edits had no undo path at all.
  const snapshotForUndo = (babylonMaterial: BABYLON.Material) => {
    let snapshot: Record<string, any> | null = null;
    if (babylonMaterial instanceof BABYLON.StandardMaterial) {
      snapshot = {
        kind: 'standard',
        diffuseColor: babylonMaterial.diffuseColor.clone(),
        specularColor: babylonMaterial.specularColor.clone(),
        emissiveColor: babylonMaterial.emissiveColor.clone(),
        alpha: babylonMaterial.alpha,
        specularPower: babylonMaterial.specularPower,
        // Previously untracked - undo restored colors but left a just-applied texture
        // in place, since nothing here recorded what the texture slots looked like before.
        diffuseTexture: babylonMaterial.diffuseTexture,
        bumpTexture: babylonMaterial.bumpTexture,
        emissiveTexture: babylonMaterial.emissiveTexture,
      };
    } else if (babylonMaterial instanceof BABYLON.PBRMaterial) {
      snapshot = {
        kind: 'pbr',
        albedoColor: babylonMaterial.albedoColor.clone(),
        emissiveColor: babylonMaterial.emissiveColor.clone(),
        alpha: babylonMaterial.alpha,
        metallic: babylonMaterial.metallic,
        roughness: babylonMaterial.roughness,
        environmentIntensity: babylonMaterial.environmentIntensity,
        reflectivityColor: babylonMaterial.reflectivityColor?.clone(),
        indexOfRefraction: babylonMaterial.indexOfRefraction,
        albedoTexture: babylonMaterial.albedoTexture,
        bumpTexture: babylonMaterial.bumpTexture,
        emissiveTexture: babylonMaterial.emissiveTexture,
      };
    }
    if (snapshot) {
      window.dispatchEvent(new CustomEvent('naviz:materialSnapshot', { detail: { material: babylonMaterial, snapshot } }));
    }
  };

  const loadMaterialProperties = (material: MaterialInterfaces.MaterialState) => {
    const babylonMaterial = material.properties as BABYLON.Material;
    snapshotForUndo(babylonMaterial);

    if (babylonMaterial instanceof BABYLON.StandardMaterial) {
      setMaterialProperties({
        diffuseColor: {
          r: babylonMaterial.diffuseColor.r,
          g: babylonMaterial.diffuseColor.g,
          b: babylonMaterial.diffuseColor.b
        },
        specularColor: {
          r: babylonMaterial.specularColor.r,
          g: babylonMaterial.specularColor.g,
          b: babylonMaterial.specularColor.b
        },
        emissiveColor: {
          r: babylonMaterial.emissiveColor.r,
          g: babylonMaterial.emissiveColor.g,
          b: babylonMaterial.emissiveColor.b
        },
        alpha: babylonMaterial.alpha,
        metallic: 0,
        roughness: 1 - babylonMaterial.specularPower / 128,
        specularPower: babylonMaterial.specularPower,
        environmentIntensityScale: 1,
        reflectivityScale: 0.5,
        indexOfRefraction: 1.5,
        autoScaleReflection: true,
        autoScaleRefraction: true,
        emissiveIntensity: 1,
        uScale: (babylonMaterial.diffuseTexture as BABYLON.Texture)?.uScale ?? 1,
        vScale: (babylonMaterial.diffuseTexture as BABYLON.Texture)?.vScale ?? 1
      });
    } else if (babylonMaterial instanceof BABYLON.PBRMaterial) {
      const refl = babylonMaterial.reflectivityColor;
      const reflScale = refl ? (refl.r + refl.g + refl.b) / 3 : 0.5;
      setMaterialProperties({
        diffuseColor: {
          r: babylonMaterial.albedoColor.r,
          g: babylonMaterial.albedoColor.g,
          b: babylonMaterial.albedoColor.b
        },
        specularColor: { r: 1, g: 1, b: 1 },
        emissiveColor: {
          r: babylonMaterial.emissiveColor.r,
          g: babylonMaterial.emissiveColor.g,
          b: babylonMaterial.emissiveColor.b
        },
        alpha: babylonMaterial.alpha,
        metallic: babylonMaterial.metallic ?? 0,
        roughness: babylonMaterial.roughness ?? 0.5,
        specularPower: 64,
        environmentIntensityScale: babylonMaterial.environmentIntensity ?? 1,
        reflectivityScale: reflScale,
        indexOfRefraction: babylonMaterial.indexOfRefraction ?? 1.5,
        autoScaleReflection: true,
        autoScaleRefraction: true,
        emissiveIntensity: babylonMaterial.emissiveIntensity ?? 1,
        uScale: (babylonMaterial.albedoTexture as BABYLON.Texture)?.uScale ?? 1,
        vScale: (babylonMaterial.albedoTexture as BABYLON.Texture)?.vScale ?? 1
      });
    } else if (babylonMaterial instanceof WaterMaterial) {
      setWaterProps({
        waveHeight: babylonMaterial.waveHeight,
        windForce: babylonMaterial.windForce,
        waveSpeed: babylonMaterial.waveSpeed,
        colorBlendFactor: babylonMaterial.colorBlendFactor
      });
    }

    // Restore this material's own saved GI settings if we've touched it before in
    // this session; otherwise default enabled=true for anything named "Emissive",
    // matching the SketchUp/Enscape naming-convention workflow this mirrors.
    const savedGI = (babylonMaterial as any).__navizEmissiveGI as typeof giSettings | undefined;
    setGiSettings(savedGI || { enabled: isEmissiveNamed(material.name), luminance: 5, radius: 3 });

    // Restore which Enscape-style type this material was last set to, so re-selecting
    // it doesn't reset the dropdown back to Default.
    const savedType = (babylonMaterial as any).__navizMaterialType as MaterialTypePreset | undefined;
    setMaterialTypePreset(savedType || (babylonMaterial instanceof WaterMaterial ? 'water' : 'default'));
  };

  // Selecting a material in the list both loads it into the editor AND puts it on the
  // currently picked mesh - previously these were two separate steps (select, then a
  // hover-only "Apply" button), and if you forgot the second step every subsequent edit
  // (texture, type switch, color) was silently mutating a material that wasn't actually
  // on the mesh, so nothing changed on screen.
  const handleMaterialSelect = (material: MaterialInterfaces.MaterialState) => {
    setSelectedMaterial(material);
    loadMaterialProperties(material);
    if (selectedMesh) {
      const mat = material.properties as BABYLON.Material;
      applyMaterialToMesh(selectedMesh, mat);
      onMaterialApplied?.(selectedMesh, mat);
    }
  };

  // Finds/creates (or removes) the auxiliary light standing in for this material's
  // GI contribution. Looked up by name rather than only the local ref cache so it
  // survives the editor panel itself unmounting/remounting - the light is meant to
  // keep lighting the scene even after you close the Material Editor.
  const updateGILight = useCallback((material: MaterialInterfaces.MaterialState, gi: typeof giSettings, emissive: { r: number; g: number; b: number }) => {
    if (!sceneManager?.scene) return;
    const scene = sceneManager.scene as BABYLON.Scene;
    const babylonMaterial = material.properties as BABYLON.Material;
    (babylonMaterial as any).__navizEmissiveGI = gi;

    const lightName = `${material.name}_GILight`;
    if (!gi.enabled) {
      scene.getLightByName(lightName)?.dispose();
      return;
    }

    // Anchor to whichever mesh is actually wearing this material - prefer the
    // currently selected one, otherwise the first mesh in the scene using it.
    const hostMesh = (resolveEditableMaterial(selectedMesh) === babylonMaterial ? selectedMesh : undefined)
      || scene.meshes.find(m => resolveEditableMaterial(m) === babylonMaterial);
    if (!hostMesh) return;

    let light = scene.getLightByName(lightName) as BABYLON.PointLight | null;
    if (!light) {
      light = new BABYLON.PointLight(lightName, BABYLON.Vector3.Zero(), scene);
    }
    light.parent = hostMesh;
    light.position = hostMesh.getBoundingInfo().boundingBox.center.clone();
    light.diffuse = new BABYLON.Color3(emissive.r, emissive.g, emissive.b);
    light.specular = light.diffuse;
    light.intensity = gi.luminance;
    light.range = gi.radius;
  }, [sceneManager?.scene, selectedMesh]);

  const handleGIChange = (field: 'enabled' | 'luminance' | 'radius', value: any) => {
    const next = { ...giSettings, [field]: value };
    setGiSettings(next);
    if (selectedMaterial) updateGILight(selectedMaterial, next, materialProperties.emissiveColor);
  };

  // Larger surfaces at moderate luminance stay noise-free; small ones pushed to
  // extreme brightness are exactly what produces the "firefly" effect - so warn
  // on the luminance-to-surface-area ratio rather than luminance alone.
  const estimateFireflyRisk = (): string | null => {
    if (!giSettings.enabled || !selectedMesh) return null;
    const size = selectedMesh.getBoundingInfo().boundingBox.extendSizeWorld.scale(2);
    const area = Math.max(2 * (size.x * size.y + size.y * size.z + size.x * size.z), 0.01);
    const ratio = giSettings.luminance / area;
    if (ratio > 15) {
      return `High luminance on a small surface (${area.toFixed(2)} m² surface area) - likely to cause fireflies/noise. Lower luminance or raise radius instead of cranking brightness on a small emitter.`;
    }
    return null;
  };

  const handlePropertyChange = (property: string, value: any, applyNow = true) => {
    const next = { ...materialProperties, [property]: value };
    setMaterialProperties(next);
    if (applyNow && selectedMaterial && sceneManager?.scene) {
      applyChangesToMaterial(selectedMaterial, next);
      if (property === 'emissiveColor' && giSettings.enabled) {
        updateGILight(selectedMaterial, giSettings, value);
      }
    }
  };

  // Converts StandardMaterial -> PBRMaterial in place (same mesh assignment, texture
  // carried over) so the Enscape-style types below - which all lean on PBR-only
  // features like clearCoat/subSurface - have something to configure. No-op if already PBR.
  const ensurePBRMaterial = (matState: MaterialInterfaces.MaterialState): BABYLON.PBRMaterial => {
    const mat = matState.properties as BABYLON.Material;
    if (mat instanceof BABYLON.PBRMaterial) return mat;
    const scene = sceneManager.scene as BABYLON.Scene;
    const pbr = new BABYLON.PBRMaterial(mat.name, scene);
    if (mat instanceof BABYLON.StandardMaterial) {
      pbr.albedoColor = mat.diffuseColor.clone();
      pbr.emissiveColor = mat.emissiveColor.clone();
      pbr.alpha = mat.alpha;
      if (mat.diffuseTexture) pbr.albedoTexture = mat.diffuseTexture;
      if (mat.bumpTexture) pbr.bumpTexture = mat.bumpTexture;
      pbr.roughness = 1 - mat.specularPower / 128;
    }
    pbr.metallic = 0;
    // Don't dispose the old material - Ctrl+Z (see naviz:materialSwapUndo in
    // BabylonWorkspace.tsx) needs to be able to swap it back onto the mesh. A
    // property-snapshot undo (like the rest of this editor uses) can't work for a type
    // switch: the mesh's material is now a genuinely different object, so mutating
    // properties on the disposed old one would have no visible effect at all.
    if (selectedMesh && resolveEditableMaterial(selectedMesh) === mat) {
      window.dispatchEvent(new CustomEvent('naviz:materialSwapUndo', { detail: { mesh: selectedMesh, previousMaterial: mat } }));
    }
    scene.meshes.forEach(m => { if (resolveEditableMaterial(m) === mat) applyMaterialToMesh(m, pbr); });
    return pbr;
  };

  // Applies an Enscape-style material type by reconfiguring the underlying Babylon
  // material's actual rendering features (or, for Water, swapping in a real WaterMaterial)
  // - not just changing a label.
  const applyMaterialType = (type: MaterialTypePreset) => {
    if (!selectedMaterial || !sceneManager?.scene) return;
    const scene = sceneManager.scene as BABYLON.Scene;
    const oldId = selectedMaterial.id;
    const oldMat = selectedMaterial.properties as BABYLON.Material;

    if (type === 'water') {
      const water = new WaterMaterial(oldMat.name, scene, new BABYLON.Vector2(512, 512));
      water.bumpTexture = new PerlinNoiseProceduralTexture(`${oldMat.name}_bump`, 256, scene);
      water.windForce = waterProps.windForce;
      water.waveHeight = waterProps.waveHeight;
      water.waveSpeed = waterProps.waveSpeed;
      water.colorBlendFactor = waterProps.colorBlendFactor;
      water.bumpHeight = 0.3;
      water.waterColor = new BABYLON.Color3(0.05, 0.25, 0.35);
      water.waveLength = 0.15;

      // Everything else in the scene needs to be in the water's own reflection/refraction
      // render list, or it just shows the water color with no reflected surroundings.
      scene.meshes.forEach(m => { if (m.material !== water) water.addToRenderList(m); });
      scene.onNewMeshAddedObservable.add((m) => { if (m.material !== water) water.addToRenderList(m); });

      // See the comment in ensurePBRMaterial - the old material is kept alive (not
      // disposed) so Ctrl+Z can swap it back onto the mesh.
      if (selectedMesh && resolveEditableMaterial(selectedMesh) === oldMat) {
        window.dispatchEvent(new CustomEvent('naviz:materialSwapUndo', { detail: { mesh: selectedMesh, previousMaterial: oldMat } }));
      }
      scene.meshes.forEach(m => { if (resolveEditableMaterial(m) === oldMat) applyMaterialToMesh(m, water); });
      (water as any).__navizMaterialType = 'water';

      const newState: MaterialInterfaces.MaterialState = { id: water.id, name: water.name, type: 'custom', properties: water, isActive: true, lastModified: Date.now() };
      setMaterials(prev => prev.map(m => m.id === oldId ? newState : m));
      setSelectedMaterial(newState);
      setMaterialTypePreset('water');
      if (selectedMesh && resolveEditableMaterial(selectedMesh) === water) onMaterialApplied?.(selectedMesh, water);
      return;
    }

    const pbr = ensurePBRMaterial(selectedMaterial);
    // Reset to a clean baseline before applying this type's preset, so switching
    // between types doesn't leave stray flags (e.g. refraction) from a previous one.
    pbr.subSurface.isRefractionEnabled = false;
    pbr.subSurface.isTranslucencyEnabled = false;
    pbr.clearCoat.isEnabled = false;
    pbr.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
    pbr.backFaceCulling = true;
    pbr.alpha = 1;

    // Also clear any glow left over from a previous "Emissive" pass on this material -
    // without this, switching Emissive -> anything else kept both the material's own
    // emissiveColor/Intensity AND its GI point light burning at full brightness forever,
    // which is what a stray glowing blob sitting in the scene actually was.
    if (type !== 'emissive') {
      pbr.emissiveColor = new BABYLON.Color3(0, 0, 0);
      pbr.emissiveIntensity = 1;
      setMaterialProperties(prev => ({ ...prev, emissiveColor: { r: 0, g: 0, b: 0 } }));
      if (giSettings.enabled) {
        const offGI = { ...giSettings, enabled: false };
        setGiSettings(offGI);
        updateGILight({ id: pbr.id, name: pbr.name, type: 'pbr', properties: pbr, isActive: true, lastModified: Date.now() }, offGI, { r: 0, g: 0, b: 0 });
      }
    }

    switch (type) {
      case 'default':
        pbr.metallic = 0.1; pbr.roughness = 0.7;
        break;
      case 'emissive': {
        // A material switched TO Emissive should actually glow immediately, not
        // require the user to separately go pick a color and crank intensity.
        const isBlack = materialProperties.emissiveColor.r === 0 && materialProperties.emissiveColor.g === 0 && materialProperties.emissiveColor.b === 0;
        const emissiveColorToUse = isBlack ? { r: 1, g: 0.9, b: 0.7 } : materialProperties.emissiveColor;
        pbr.emissiveColor = new BABYLON.Color3(emissiveColorToUse.r, emissiveColorToUse.g, emissiveColorToUse.b);
        const nextIntensity = Math.max(materialProperties.emissiveIntensity, 2);
        pbr.emissiveIntensity = nextIntensity;
        setMaterialProperties(prev => ({ ...prev, emissiveColor: emissiveColorToUse, emissiveIntensity: nextIntensity }));
        const nextGI = { ...giSettings, enabled: true, luminance: Math.max(giSettings.luminance, 5) };
        setGiSettings(nextGI);
        updateGILight({ id: pbr.id, name: pbr.name, type: 'pbr', properties: pbr, isActive: true, lastModified: Date.now() }, nextGI, emissiveColorToUse);
        break;
      }
      case 'glassSimple':
        pbr.alpha = 0.2; pbr.metallic = 0; pbr.roughness = 0.05;
        pbr.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        break;
      case 'glassAdvanced':
        pbr.metallic = 0; pbr.roughness = 0.02;
        pbr.subSurface.isRefractionEnabled = true;
        pbr.subSurface.indexOfRefraction = 1.5;
        pbr.subSurface.refractionIntensity = 1;
        pbr.subSurface.tintColor = new BABYLON.Color3(0.9, 0.95, 1);
        pbr.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        break;
      case 'foliage':
        pbr.backFaceCulling = false;
        pbr.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATEST;
        pbr.alphaCutOff = 0.4;
        pbr.subSurface.isTranslucencyEnabled = true;
        pbr.subSurface.translucencyIntensity = 0.6;
        pbr.metallic = 0; pbr.roughness = 0.8;
        break;
      case 'carPaint':
        pbr.metallic = 0.9; pbr.roughness = 0.25;
        pbr.clearCoat.isEnabled = true; pbr.clearCoat.intensity = 1; pbr.clearCoat.roughness = 0.1;
        break;
      case 'cloth':
        pbr.metallic = 0; pbr.roughness = 0.85;
        pbr.backFaceCulling = false;
        pbr.subSurface.isTranslucencyEnabled = true; pbr.subSurface.translucencyIntensity = 0.8;
        break;
      case 'carbon':
        pbr.metallic = 0.3; pbr.roughness = 0.15;
        pbr.clearCoat.isEnabled = true; pbr.clearCoat.intensity = 0.6; pbr.clearCoat.roughness = 0.2;
        break;
    }

    (pbr as any).__navizMaterialType = type;
    const newState: MaterialInterfaces.MaterialState = { id: pbr.id, name: pbr.name, type: 'pbr', properties: pbr, isActive: true, lastModified: Date.now() };
    setMaterials(prev => prev.map(m => m.id === oldId ? newState : m));
    setSelectedMaterial(newState);
    setMaterialTypePreset(type);
    loadMaterialProperties(newState);
    if (selectedMesh && resolveEditableMaterial(selectedMesh) === pbr) onMaterialApplied?.(selectedMesh, pbr);
  };

  const handleWaterPropChange = (field: keyof typeof waterProps, value: number) => {
    const next = { ...waterProps, [field]: value };
    setWaterProps(next);
    const mat = selectedMaterial?.properties;
    if (mat instanceof WaterMaterial) {
      mat.waveHeight = next.waveHeight;
      mat.windForce = next.windForce;
      mat.waveSpeed = next.waveSpeed;
      mat.colorBlendFactor = next.colorBlendFactor;
    }
  };

  // Generic "Advanced" surface controls (bump strength, parallax/displacement) that
  // apply to whichever texture-mapped material is selected, regardless of type.
  const [surfaceProps, setSurfaceProps] = useState({ bumpStrength: 1, parallaxEnabled: false, parallaxScale: 0.05 });

  const handleSurfacePropChange = (field: keyof typeof surfaceProps, value: any) => {
    const next = { ...surfaceProps, [field]: value };
    setSurfaceProps(next);
    const mat = selectedMaterial?.properties as BABYLON.Material | undefined;
    if (mat instanceof BABYLON.PBRMaterial || mat instanceof BABYLON.StandardMaterial) {
      if (mat.bumpTexture) (mat.bumpTexture as BABYLON.Texture).level = next.bumpStrength;
      mat.useParallax = next.parallaxEnabled;
      mat.useParallaxOcclusion = next.parallaxEnabled;
      mat.parallaxScaleBias = next.parallaxScale;
    }
  };

  const applyChangesToMaterial = useCallback((material: MaterialInterfaces.MaterialState, props: typeof materialProperties) => {
    const babylonMaterial = material.properties as BABYLON.Material;
    if (!babylonMaterial || !sceneManager?.scene) return;

    if (babylonMaterial instanceof BABYLON.StandardMaterial) {
      babylonMaterial.diffuseColor = new BABYLON.Color3(props.diffuseColor.r, props.diffuseColor.g, props.diffuseColor.b);
      babylonMaterial.specularColor = new BABYLON.Color3(props.specularColor.r, props.specularColor.g, props.specularColor.b);
      // StandardMaterial has no emissiveIntensity property, so the "intensity" slider
      // is simulated by scaling the picked color past 1.0 - that's what lets the glow
      // clear the Bloom threshold instead of capping out at a flat, un-glowing color.
      babylonMaterial.emissiveColor = new BABYLON.Color3(props.emissiveColor.r, props.emissiveColor.g, props.emissiveColor.b).scale(props.emissiveIntensity);
      babylonMaterial.alpha = props.alpha;
      babylonMaterial.specularPower = props.specularPower;
      if (babylonMaterial.diffuseTexture) {
        (babylonMaterial.diffuseTexture as BABYLON.Texture).uScale = props.uScale;
        (babylonMaterial.diffuseTexture as BABYLON.Texture).vScale = props.vScale;
      }
    } else if (babylonMaterial instanceof BABYLON.PBRMaterial) {
      babylonMaterial.albedoColor = new BABYLON.Color3(props.diffuseColor.r, props.diffuseColor.g, props.diffuseColor.b);
      babylonMaterial.emissiveColor = new BABYLON.Color3(props.emissiveColor.r, props.emissiveColor.g, props.emissiveColor.b);
      babylonMaterial.emissiveIntensity = props.emissiveIntensity;
      babylonMaterial.alpha = props.alpha;
      babylonMaterial.metallic = props.metallic;
      if (babylonMaterial.albedoTexture) {
        (babylonMaterial.albedoTexture as BABYLON.Texture).uScale = props.uScale;
        (babylonMaterial.albedoTexture as BABYLON.Texture).vScale = props.vScale;
      }
      if (babylonMaterial.bumpTexture) {
        (babylonMaterial.bumpTexture as BABYLON.Texture).uScale = props.uScale;
        (babylonMaterial.bumpTexture as BABYLON.Texture).vScale = props.vScale;
      }
      if (babylonMaterial.metallicTexture) {
        (babylonMaterial.metallicTexture as BABYLON.Texture).uScale = props.uScale;
        (babylonMaterial.metallicTexture as BABYLON.Texture).vScale = props.vScale;
      }
      babylonMaterial.roughness = props.roughness;
      if (props.environmentIntensityScale !== undefined) babylonMaterial.environmentIntensity = props.environmentIntensityScale;
      if (props.reflectivityScale !== undefined) babylonMaterial.reflectivityColor = new BABYLON.Color3(props.reflectivityScale, props.reflectivityScale, props.reflectivityScale);
      if (props.indexOfRefraction !== undefined) babylonMaterial.indexOfRefraction = props.indexOfRefraction;
    }

    if (onMaterialChange) onMaterialChange({ ...material, properties: babylonMaterial, lastModified: Date.now() });
  }, [sceneManager?.scene, onMaterialChange]);

  const applyMaterialChanges = () => {
    if (!selectedMaterial) return;
    applyChangesToMaterial(selectedMaterial, materialProperties);
  };

  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  // Revoke any blob URLs created for uploaded textures when the editor unmounts, to avoid
  // leaking memory. Textures load asynchronously, so revoking any earlier than unmount
  // risks breaking an in-flight load; unmount is the one point it's always safe.
  useEffect(() => {
    return () => {
      createdBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      createdBlobUrlsRef.current.clear();
    };
  }, []);

  // Applies an image straight onto the material the mesh already has - diffuse/albedo
  // (a plain color map) and normal/bump (auto-converted from whatever photo is given,
  // see below - a real tangent-space normal map). No emissive/glow map here anymore:
  // it was forcing emissiveColor to white to make the texture visible, which combined
  // with Bloom washed the whole surface out to solid white and hid the diffuse texture
  // underneath it. Emissive glow is still available as a plain color+intensity in the
  // "Emissive Lighting" section below, without the image-masking problem.
  const [selectedMatTextureUrls, setSelectedMatTextureUrls] = useState({ diffuse: '', normal: '' });
  // Texture loading is async and was previously fire-and-forget - a bad blob URL, a
  // corrupt file, or any other load failure just silently did nothing with zero
  // indication why "Apply" didn't visibly change the mesh. Now it's tracked and shown.
  const [textureLoadStatus, setTextureLoadStatus] = useState<Record<string, 'loading' | 'ok' | string>>({});

  const handleSelectedMatFileLoad = (e: React.ChangeEvent<HTMLInputElement>, slot: 'diffuse' | 'normal') => {
    const file = e.target.files?.[0];
    if (!file || !sceneManager?.scene) return;
    const url = URL.createObjectURL(file);
    createdBlobUrlsRef.current.add(url);
    setSelectedMatTextureUrls(prev => ({ ...prev, [slot]: url }));
    setTextureLoadStatus(prev => ({ ...prev, [slot]: '' }));
    e.target.value = '';
  };

  // Turns an ordinary photo into a real tangent-space normal map (Sobel-filtered height
  // gradient -> XYZ normal, encoded as RGB) instead of handing the raw photo straight to
  // bumpTexture - a plain photo used directly as a normal map produces garbage lighting,
  // since the shader expects RGB to encode a surface normal direction, not color.
  const generateNormalMapDataUrl = (imageUrl: string, strength = 2.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D not supported')); return; }
        ctx.drawImage(img, 0, 0);
        let src: ImageData;
        try {
          src = ctx.getImageData(0, 0, w, h);
        } catch {
          reject(new Error('Could not read image pixels (cross-origin image?)'));
          return;
        }
        const heights = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const r = src.data[i * 4], g = src.data[i * 4 + 1], b = src.data[i * 4 + 2];
          heights[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        }
        const at = (x: number, y: number) => heights[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
        const out = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
            const l = at(x - 1, y), r2 = at(x + 1, y);
            const bl = at(x - 1, y + 1), b2 = at(x, y + 1), br = at(x + 1, y + 1);
            const dx = (tr + 2 * r2 + br) - (tl + 2 * l + bl);
            const dy = (bl + 2 * b2 + br) - (tl + 2 * t + tr);
            let nx = -dx * strength, ny = -dy * strength, nz = 1;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= len; ny /= len; nz /= len;
            const idx = (y * w + x) * 4;
            out.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
            out.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
            out.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
            out.data[idx + 3] = 255;
          }
        }
        ctx.putImageData(out, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load source image'));
      img.src = imageUrl;
    });
  };

  const applyTextureToSelectedMaterial = async (slot: 'diffuse' | 'normal') => {
    if (!selectedMaterial || !sceneManager?.scene) return;
    const url = selectedMatTextureUrls[slot].trim();
    if (!url) return;
    const babylonMaterial = selectedMaterial.properties as BABYLON.Material;
    const scene = sceneManager.scene;
    // A fresh checkpoint for THIS action specifically - without this, the only undo
    // checkpoint was the one taken when the material was first loaded into the editor,
    // so applying two textures in a row (or a texture after already having tweaked
    // colors) collapsed into a single Ctrl+Z instead of one step back per action.
    snapshotForUndo(babylonMaterial);
    setTextureLoadStatus(prev => ({ ...prev, [slot]: 'loading' }));

    let textureUrl = url;
    if (slot === 'normal') {
      try {
        textureUrl = await generateNormalMapDataUrl(url);
      } catch (err) {
        setTextureLoadStatus(prev => ({ ...prev, [slot]: err instanceof Error ? err.message : 'Failed to generate normal map' }));
        return;
      }
    }

    const texture = new BABYLON.Texture(
      textureUrl,
      scene,
      undefined,
      undefined,
      undefined,
      () => setTextureLoadStatus(prev => ({ ...prev, [slot]: 'ok' })),
      (message) => setTextureLoadStatus(prev => ({ ...prev, [slot]: message || 'Failed to load image' }))
    );

    if (babylonMaterial instanceof BABYLON.StandardMaterial || babylonMaterial instanceof BABYLON.PBRMaterial) {
      if (slot === 'diffuse') {
        if (babylonMaterial instanceof BABYLON.StandardMaterial) babylonMaterial.diffuseTexture = texture;
        else babylonMaterial.albedoTexture = texture;
        // A diffuse/albedo texture is multiplied by diffuseColor/albedoColor - if that's
        // dark, the texture would be tinted dark or masked out with no visible sign why.
        const dc = babylonMaterial instanceof BABYLON.StandardMaterial ? babylonMaterial.diffuseColor : babylonMaterial.albedoColor;
        if (dc.r < 0.1 && dc.g < 0.1 && dc.b < 0.1) {
          const white = new BABYLON.Color3(1, 1, 1);
          if (babylonMaterial instanceof BABYLON.StandardMaterial) babylonMaterial.diffuseColor = white;
          else babylonMaterial.albedoColor = white;
          setMaterialProperties(prev => ({ ...prev, diffuseColor: { r: 1, g: 1, b: 1 } }));
        }
      } else {
        babylonMaterial.bumpTexture = texture;
      }
    }

    if (selectedMesh && babylonMaterial === resolveEditableMaterial(selectedMesh)) {
      onMaterialApplied?.(selectedMesh, babylonMaterial);
    }
    if (onMaterialChange) onMaterialChange({ ...selectedMaterial, properties: babylonMaterial, lastModified: Date.now() });
  };

  const createNewMaterial = () => {
    if (!sceneManager?.scene) return;

    const newMaterial = new BABYLON.StandardMaterial(`New Material ${materials.length + 1}`, sceneManager.scene);
    newMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    const newMaterialState: MaterialInterfaces.MaterialState = {
      id: newMaterial.id,
      name: newMaterial.name,
      type: 'standard',
      properties: newMaterial,
      isActive: true,
      lastModified: Date.now()
    };

    setMaterials(prev => [...prev, newMaterialState]);
    setSelectedMaterial(newMaterialState);
    loadMaterialProperties(newMaterialState);
    if (selectedMesh) {
      applyMaterialToMesh(selectedMesh, newMaterial);
      onMaterialApplied?.(selectedMesh, newMaterial);
    }
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => {
      const h = Math.round(x * 255).toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
  };
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
  };
  // Touch/click a surface to apply the selected material directly to it -
  // works in VR too, since Babylon's default WebXR experience already routes
  // controller trigger picks through the same scene.onPointerObservable used
  // here for mouse/touch, so no separate XR-specific input code is needed.
  const [touchToApply, setTouchToApply] = useState(false);
  useEffect(() => {
    const scene = sceneManager?.scene as BABYLON.Scene | undefined;
    if (!touchToApply || !scene || !selectedMaterial || !onMaterialApplied) return;

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
      const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
      if (!pickedMesh) return;
      const mat = selectedMaterial.properties as BABYLON.Material;
      if (!mat) return;
      applyMaterialToMesh(pickedMesh, mat);
      onMaterialApplied(pickedMesh, mat);
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [touchToApply, sceneManager?.scene, selectedMaterial, onMaterialApplied]);

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-gray-900 text-white p-4 z-50 overflow-y-auto border-l border-gray-700">
        <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Material Editor</h2>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
            ✕
          </button>
        </div>
      </div>

      {selectedMaterial && (
        <button
          onClick={() => setTouchToApply(v => !v)}
          className={`w-full mb-4 py-2 rounded text-sm font-semibold transition-colors ${
            touchToApply ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title="While on, click/touch any surface (including a VR controller trigger) to apply the selected material to it"
        >
          {touchToApply ? '● Touch to Apply: ON' : 'Touch to Apply: OFF'}
        </button>
      )}

      {/* Material List */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Materials</h3>
          <button
            onClick={createNewMaterial}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            + New Material
          </button>
        </div>
        <div className="max-h-32 overflow-y-auto">
          {materials.map(material => (
            <button
              key={material.id}
              onClick={() => handleMaterialSelect(material)}
              title={selectedMesh ? `Apply to ${selectedMesh.name}` : material.name}
              className={`block w-full text-left p-2 mb-1 rounded cursor-pointer text-sm hover:bg-gray-600 ${
                selectedMaterial?.id === material.id ? 'bg-gray-600 text-blue-400 font-medium' : 'bg-gray-700'
              }`}
            >
              {material.name} ({material.properties instanceof WaterMaterial ? 'water' : material.type})
            </button>
          ))}
        </div>
      </div>

      {/* Material Type - Enscape-style presets that reconfigure the real material */}
      {selectedMaterial && selectedMaterial.type !== 'node' && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <label className="block text-xs mb-1 text-cyan-400 font-semibold">Material Type</label>
          <select
            value={materialTypePreset}
            onChange={(e) => applyMaterialType(e.target.value as MaterialTypePreset)}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs"
            aria-label="Material Type"
          >
            {MATERIAL_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">
            Switching type reconfigures this material's real rendering features (reflections, refraction, translucency, clear coat, etc.), same as picking a type in Enscape's Material Editor.
          </p>
        </div>
      )}

      {/* Texture - applies an image directly onto the currently selected material,
          upgrading it to PBR automatically if a Normal map needs it. */}
      {selectedMaterial && selectedMaterial.type !== 'custom' && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <h3 className="text-sm font-semibold mb-2 text-cyan-400">Texture</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs mb-1">Diffuse / Albedo Image</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="https://... or pick a file"
                  value={selectedMatTextureUrls.diffuse}
                  onChange={(e) => setSelectedMatTextureUrls(prev => ({ ...prev, diffuse: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
                <input type="file" accept="image/*" className="hidden" id="selmat-diffuse-file" onChange={(e) => handleSelectedMatFileLoad(e, 'diffuse')} />
                <button onClick={() => document.getElementById('selmat-diffuse-file')?.click()} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs" title="Load from file">📁</button>
              </div>
              <button onClick={() => applyTextureToSelectedMaterial('diffuse')} className="w-full mt-1 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold">
                Apply as Diffuse Texture
              </button>
              {textureLoadStatus.diffuse === 'loading' && <p className="text-[10px] text-gray-400 mt-1">Loading...</p>}
              {textureLoadStatus.diffuse === 'ok' && <p className="text-[10px] text-emerald-400 mt-1">✓ Applied</p>}
              {textureLoadStatus.diffuse && textureLoadStatus.diffuse !== 'loading' && textureLoadStatus.diffuse !== 'ok' && (
                <p className="text-[10px] text-red-400 mt-1">✗ {textureLoadStatus.diffuse}</p>
              )}
            </div>
            <div>
              <label className="block text-xs mb-1">Normal / Bump Image (any photo - bump map is generated automatically)</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="https://... or pick a file"
                  value={selectedMatTextureUrls.normal}
                  onChange={(e) => setSelectedMatTextureUrls(prev => ({ ...prev, normal: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs"
                />
                <input type="file" accept="image/*" className="hidden" id="selmat-normal-file" onChange={(e) => handleSelectedMatFileLoad(e, 'normal')} />
                <button onClick={() => document.getElementById('selmat-normal-file')?.click()} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs" title="Load from file">📁</button>
              </div>
              <button onClick={() => applyTextureToSelectedMaterial('normal')} className="w-full mt-1 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs font-semibold">
                Generate &amp; Apply Bump Map
              </button>
              {textureLoadStatus.normal === 'loading' && <p className="text-[10px] text-gray-400 mt-1">Generating normal map...</p>}
              {textureLoadStatus.normal === 'ok' && <p className="text-[10px] text-emerald-400 mt-1">✓ Applied</p>}
              {textureLoadStatus.normal && textureLoadStatus.normal !== 'loading' && textureLoadStatus.normal !== 'ok' && (
                <p className="text-[10px] text-red-400 mt-1">✗ {textureLoadStatus.normal}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UV Tiling - applies to whichever texture(s) the selected material has */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
        <h3 className="text-sm font-semibold mb-2 text-cyan-400">UV Tiling</h3>
        <label className="block text-xs mb-1">U (horizontal): {materialProperties.uScale.toFixed(2)}</label>
        <input
          type="range" min="0.1" max="10" step="0.1"
          value={materialProperties.uScale}
          onChange={(e) => handlePropertyChange('uScale', parseFloat(e.target.value))}
          className="w-full" aria-label="UV U Scale" title="UV U Scale"
        />
        <label className="block text-xs mb-1 mt-2">V (vertical): {materialProperties.vScale.toFixed(2)}</label>
        <input
          type="range" min="0.1" max="10" step="0.1"
          value={materialProperties.vScale}
          onChange={(e) => handlePropertyChange('vScale', parseFloat(e.target.value))}
          className="w-full" aria-label="UV V Scale" title="UV V Scale"
        />
      </div>

      {/* Advanced Surface - bump strength + parallax/displacement, applies to whichever
          bump/normal texture the selected material already has. */}
      {selectedMaterial && (selectedMaterial.type === 'pbr' || selectedMaterial.type === 'standard') && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <h3 className="text-sm font-semibold mb-2 text-cyan-400">Advanced Surface</h3>
          <label className="block text-xs mb-1">Bump/Normal Strength: {surfaceProps.bumpStrength.toFixed(2)}</label>
          <input
            type="range" min="0" max="3" step="0.05"
            value={surfaceProps.bumpStrength}
            onChange={(e) => handleSurfacePropChange('bumpStrength', parseFloat(e.target.value))}
            className="w-full" aria-label="Bump Strength" title="Bump Strength"
          />
          <label className="flex items-center gap-2 text-xs mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={surfaceProps.parallaxEnabled}
              onChange={(e) => handleSurfacePropChange('parallaxEnabled', e.target.checked)}
            />
            Parallax / Displacement (needs a bump map)
          </label>
          {surfaceProps.parallaxEnabled && (
            <>
              <label className="block text-xs mb-1 mt-2">Displacement Depth: {surfaceProps.parallaxScale.toFixed(3)}</label>
              <input
                type="range" min="0" max="0.3" step="0.005"
                value={surfaceProps.parallaxScale}
                onChange={(e) => handleSurfacePropChange('parallaxScale', parseFloat(e.target.value))}
                className="w-full" aria-label="Displacement Depth" title="Displacement Depth"
              />
            </>
          )}
        </div>
      )}

      {/* Water Properties - WaterMaterial doesn't share StandardMaterial/PBRMaterial's
          color/metallic/roughness model, so it gets its own dedicated controls instead
          of the generic Properties block below (which would silently no-op on it). */}
      {selectedMaterial && selectedMaterial.type === 'custom' && selectedMaterial.properties instanceof WaterMaterial && (
        <div className="space-y-3 p-3 bg-gray-800 rounded-lg border border-gray-600">
          <h3 className="text-sm font-semibold text-cyan-400">Water Properties</h3>
          <div>
            <label className="block text-xs mb-1">Wave Height: {waterProps.waveHeight.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.01" value={waterProps.waveHeight}
              onChange={(e) => handleWaterPropChange('waveHeight', parseFloat(e.target.value))}
              className="w-full" aria-label="Wave Height" title="Wave Height" />
          </div>
          <div>
            <label className="block text-xs mb-1">Wind Force: {waterProps.windForce.toFixed(1)}</label>
            <input type="range" min="0" max="20" step="0.5" value={waterProps.windForce}
              onChange={(e) => handleWaterPropChange('windForce', parseFloat(e.target.value))}
              className="w-full" aria-label="Wind Force" title="Wind Force" />
          </div>
          <div>
            <label className="block text-xs mb-1">Wave Speed: {waterProps.waveSpeed.toFixed(0)}</label>
            <input type="range" min="0" max="100" step="1" value={waterProps.waveSpeed}
              onChange={(e) => handleWaterPropChange('waveSpeed', parseFloat(e.target.value))}
              className="w-full" aria-label="Wave Speed" title="Wave Speed" />
          </div>
          <div>
            <label className="block text-xs mb-1">Color Blend: {waterProps.colorBlendFactor.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.01" value={waterProps.colorBlendFactor}
              onChange={(e) => handleWaterPropChange('colorBlendFactor', parseFloat(e.target.value))}
              className="w-full" aria-label="Color Blend Factor" title="Color Blend Factor" />
          </div>
          <p className="text-[10px] text-gray-500">
            Other scene meshes are automatically added to this water's reflection/refraction render list as they're created.
          </p>
        </div>
      )}

      {/* Material Properties */}
      {selectedMaterial && selectedMaterial.type !== 'custom' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Properties</h3>

          {/* Diffuse Color - Color Picker */}
          <div>
            <label className="block text-xs mb-1">Diffuse Color</label>
            <div className="flex gap-2 items-center mb-1">
              <input
                type="color"
                value={rgbToHex(materialProperties.diffuseColor.r, materialProperties.diffuseColor.g, materialProperties.diffuseColor.b)}
                onChange={(e) => handlePropertyChange('diffuseColor', hexToRgb(e.target.value))}
                className="w-10 h-8 cursor-pointer rounded border border-gray-600"
                title="Color picker"
              />
              <span className="text-xs text-gray-400">Pick color</span>
            </div>
            <div className="flex gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={materialProperties.diffuseColor.r}
              onChange={(e) => handlePropertyChange('diffuseColor', {
                ...materialProperties.diffuseColor,
                r: parseFloat(e.target.value)
              })}
              className="flex-1"
              aria-label="Diffuse Color Red"
              title="Diffuse Color Red"
              placeholder="Diffuse Color Red"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={materialProperties.diffuseColor.g}
              onChange={(e) => handlePropertyChange('diffuseColor', {
                ...materialProperties.diffuseColor,
                g: parseFloat(e.target.value)
              })}
              className="flex-1"
              aria-label="Diffuse Color Green"
              title="Diffuse Color Green"
              placeholder="Diffuse Color Green"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={materialProperties.diffuseColor.b}
              onChange={(e) => handlePropertyChange('diffuseColor', {
                ...materialProperties.diffuseColor,
                b: parseFloat(e.target.value)
              })}
              className="flex-1"
              aria-label="Diffuse Color Blue"
              title="Diffuse Color Blue"
              placeholder="Diffuse Color Blue"
            />
            </div>
            <div className="flex gap-1 mt-1">
              <span className="text-xs">R:{materialProperties.diffuseColor.r.toFixed(2)}</span>
              <span className="text-xs">G:{materialProperties.diffuseColor.g.toFixed(2)}</span>
              <span className="text-xs">B:{materialProperties.diffuseColor.b.toFixed(2)}</span>
            </div>
          </div>

          {/* Emissive Color */}
          <div>
            <label className="block text-xs mb-1">Emissive Color</label>
            <div className="flex gap-2 items-center mb-1">
              <input
                type="color"
                value={rgbToHex(materialProperties.emissiveColor.r, materialProperties.emissiveColor.g, materialProperties.emissiveColor.b)}
                onChange={(e) => handlePropertyChange('emissiveColor', hexToRgb(e.target.value))}
                className="w-10 h-8 cursor-pointer rounded border border-gray-600"
                title="Emissive color"
              />
              <span className="text-xs text-gray-400">Pick emissive</span>
            </div>
            <label className="block text-xs mb-1 mt-2">
              Emissive Intensity: {materialProperties.emissiveIntensity.toFixed(2)}
              {materialProperties.emissiveIntensity <= 0.05 && (materialProperties.emissiveColor.r + materialProperties.emissiveColor.g + materialProperties.emissiveColor.b) === 0 && (
                <span className="text-amber-400 ml-1">(pick a color above first)</span>
              )}
            </label>
            <input
              type="range" min="0" max="8" step="0.1"
              value={materialProperties.emissiveIntensity}
              onChange={(e) => handlePropertyChange('emissiveIntensity', parseFloat(e.target.value))}
              className="w-full" aria-label="Emissive Intensity" title="Emissive Intensity"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Push above 1.0 for a real glow (needs Bloom enabled in post-processing to actually bleed light).
            </p>
          </div>

          {/* Enscape-style emissive GI: visual glow (above) stays separate from this
              material's physical light contribution, calibrated independently. */}
          <div className="p-3 bg-gray-800 rounded-lg border border-gray-600">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-cyan-400">Emissive Lighting (GI)</h3>
              {isEmissiveNamed(selectedMaterial.name) && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-600/30 text-amber-300 rounded">🔆 named "Emissive"</span>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={giSettings.enabled}
                onChange={(e) => handleGIChange('enabled', e.target.checked)}
              />
              Contribute to Global Illumination
            </label>
            {!selectedMesh && giSettings.enabled && (
              <p className="text-[10px] text-amber-400 mb-2">No mesh selected - pick the mesh wearing this material so the light has somewhere to anchor.</p>
            )}
            {giSettings.enabled && (
              <>
                <label className="block text-xs mb-1">Luminance: {giSettings.luminance.toFixed(1)}</label>
                <input
                  type="range" min="0" max="50" step="0.5"
                  value={giSettings.luminance}
                  onChange={(e) => handleGIChange('luminance', parseFloat(e.target.value))}
                  className="w-full" aria-label="GI Luminance" title="GI Luminance"
                />
                <label className="block text-xs mb-1 mt-2">Radius: {giSettings.radius.toFixed(1)} m</label>
                <input
                  type="range" min="0.1" max="20" step="0.1"
                  value={giSettings.radius}
                  onChange={(e) => handleGIChange('radius', parseFloat(e.target.value))}
                  className="w-full" aria-label="GI Radius" title="GI Radius"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Larger surfaces at moderate luminance stay clean; small surfaces pushed to extreme luminance flicker (fireflies).
                  If this light needs to stay off-camera, this already tracks the mesh, so it keeps lighting the scene regardless of view.
                </p>
                {estimateFireflyRisk() && (
                  <p className="text-[10px] text-red-400 mt-1">⚠ {estimateFireflyRisk()}</p>
                )}
              </>
            )}
          </div>

          {/* Metallic/Roughness for PBR */}
          {selectedMaterial.type === 'pbr' && (
            <>
              <div>
                <label className="block text-xs mb-1">Metallic: {materialProperties.metallic.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={materialProperties.metallic}
                  onChange={(e) => handlePropertyChange('metallic', parseFloat(e.target.value))}
                  className="w-full"
                  aria-label="Metallic"
                  title="Metallic"
                  placeholder="Metallic"
                />
              </div>

              <div>
                <label className="block text-xs mb-1">Roughness: {materialProperties.roughness.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={materialProperties.roughness}
                  onChange={(e) => handlePropertyChange('roughness', parseFloat(e.target.value))}
                  className="w-full"
                  aria-label="Roughness"
                  title="Roughness"
                  placeholder="Roughness"
                />
              </div>

              {/* Auto-scale reflection / refraction */}
              <div className="pt-2 mt-2 border-t border-gray-700 space-y-3">
                <h4 className="text-xs font-semibold text-cyan-400">Reflection & Refraction</h4>
                <div>
                  <label className="block text-xs mb-1">Environment / Reflection Scale: {(materialProperties.environmentIntensityScale ?? 1).toFixed(2)}</label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.05"
                    value={materialProperties.environmentIntensityScale ?? 1}
                    onChange={(e) => handlePropertyChange('environmentIntensityScale', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Reflectivity: {(materialProperties.reflectivityScale ?? 0.5).toFixed(2)}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={materialProperties.reflectivityScale ?? 0.5}
                    onChange={(e) => handlePropertyChange('reflectivityScale', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Refraction Index: {(materialProperties.indexOfRefraction ?? 1.5).toFixed(2)}</label>
                  <input
                    type="range"
                    min="1"
                    max="2"
                    step="0.05"
                    value={materialProperties.indexOfRefraction ?? 1.5}
                    onChange={(e) => handlePropertyChange('indexOfRefraction', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </>
          )}

          {/* Specular Power for Standard */}
          {selectedMaterial.type === 'standard' && (
            <div>
              <label className="block text-xs mb-1">Specular Power: {materialProperties.specularPower}</label>
              <input
                type="range"
                min="1"
                max="128"
                step="1"
                value={materialProperties.specularPower}
                onChange={(e) => handlePropertyChange('specularPower', parseInt(e.target.value))}
                className="w-full"
                aria-label="Specular Power"
                title="Specular Power"
                placeholder="Specular Power"
              />
            </div>
          )}

          {/* Alpha */}
          <div>
            <label className="block text-xs mb-1">Alpha: {materialProperties.alpha.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={materialProperties.alpha}
              onChange={(e) => handlePropertyChange('alpha', parseFloat(e.target.value))}
              className="w-full"
              aria-label="Alpha"
              title="Alpha"
              placeholder="Alpha"
            />
          </div>

          {/* Apply Button */}
          <button
            onClick={applyMaterialChanges}
            className="w-full py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
          >
            Apply Changes
          </button>
        </div>
      )}

    </div>
  );
};

export default MaterialEditor;
