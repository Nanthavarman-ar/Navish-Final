import { AbstractMesh, Material, PBRMaterial } from '@babylonjs/core';

// Closes the "walls look flat/plastic, not like Enscape" gap reported this session -
// confirmed by code search that nothing in this app actually tunes an imported model's
// OWN materials at load time (every other `.metallic`/`.roughness`/`.alpha` assignment
// found elsewhere - MeshMaterialSwatches, MaterialEditor, BIMManager's own generated demo
// meshes, all the simulation overlay tools - only ever touches materials THIS APP creates
// itself, never the uploaded model's real materials). Enscape (and every other real-time
// architectural viewer) auto-classifies "dumb" imported materials like this by name/type
// and gives them a believable PBR response instead of showing them exactly as authored,
// which for a SketchUp/Revit export is very often just a flat diffuse color with whatever
// metallic/roughness the exporter defaulted to (frequently the glTF spec default of
// metallic=1/roughness=1 - fully metallic AND fully rough at once, which reads as dead
// grey plastic under PBR lighting) rather than anything actually tuned per element.
//
// Deliberately conservative about what it touches, per this session's explicit ask to
// implement this "without breaking anything":
// - PBRMaterial only. This app's real imported models (glTF/GLB, the entire upload path -
//   see modelOptimizer.ts/UploadPage.tsx) load through @babylonjs/loaders' glTF importer,
//   which always creates PBRMaterial. StandardMaterial in this codebase only ever shows up
//   on meshes this app generates itself (BIMManager's demo geometry, tool overlays) -
//   those already look intentional and are out of scope here.
// - Skips any material that already has a metallicTexture, roughness-driving texture, or
//   alpha < 1 - all three are strong signals of real authored PBR/transparency data (a
//   proper texture-driven workflow, or a glass material someone already tuned by hand),
//   which this must never fight or override.
// - Reuses the exact same numeric presets MaterialEditor.tsx's own type switcher already
//   uses for "default"/"glassSimple"/"cloth" materials, rather than inventing new numbers,
//   so a material this pass touches looks the same as if a person had picked that same
//   preset by hand in the Material Editor.
// - Every material is visited at most once (materials are commonly shared across many
//   meshes) via the `processed` set, and the whole thing is wrapped per-material so one
//   unexpected material shape can't take down the rest of the pass.
const GLASS_PATTERN = /glass|window|glazing|pane/i;
const METAL_PATTERN = /steel|metal|aluminu?m|chrome|iron\b|railing|balustrade|hinge|handle|grille|mesh_wire/i;
const FLOOR_PATTERN = /floor|tile|marble|granite|terrazzo|slab/i;
const WOOD_PATTERN = /wood|timber|plywood|veneer|\bdoor\b/i;
const FABRIC_PATTERN = /fabric|carpet|\brug\b|sofa|cushion|curtain|upholstery/i;
// Left alone entirely - InteractiveFixtures' "Running Water" fixture and
// EnhancedFloodSimulation already own what "water" should look like in this app; a
// generically-named water surface in an uploaded model is rare enough not to be worth the
// risk of this pass fighting either of those for the same material.
const WATER_PATTERN = /water|pool|pond|fountain/i;

interface MaterialLook {
  metallic: number;
  roughness: number;
  /** Only glass gets this - see MaterialEditor.tsx's 'glassSimple' preset. */
  glassAlpha?: number;
}

function classify(label: string): MaterialLook | null {
  if (WATER_PATTERN.test(label)) return null;
  if (GLASS_PATTERN.test(label)) return { metallic: 0, roughness: 0.05, glassAlpha: 0.2 };
  if (METAL_PATTERN.test(label)) return { metallic: 0.85, roughness: 0.35 };
  if (FLOOR_PATTERN.test(label)) return { metallic: 0, roughness: 0.3 };
  if (WOOD_PATTERN.test(label)) return { metallic: 0, roughness: 0.55 };
  if (FABRIC_PATTERN.test(label)) return { metallic: 0, roughness: 0.85 };
  // Generic fallback (wall/plaster/paint/concrete/anything unnamed) - MaterialEditor.tsx's
  // own 'default' preset values, not a from-scratch guess.
  return { metallic: 0.1, roughness: 0.7 };
}

/**
 * Walks a just-loaded model's meshes and gives any "untouched" PBRMaterial a believable,
 * per-element-type PBR response instead of leaving it at whatever flat default the source
 * file's exporter left it with. Returns how many distinct materials it actually changed,
 * for an optional toast/log - not required for correctness.
 */
export function enhanceImportedMaterials(meshes: AbstractMesh[]): number {
  const processed = new Set<Material>();
  let enhancedCount = 0;

  for (const mesh of meshes) {
    const material = mesh.material;
    if (!material || processed.has(material)) continue;
    processed.add(material);

    if (!(material instanceof PBRMaterial)) continue;
    // Real authored PBR texture data, or a material someone already made transparent on
    // purpose (a hand-tuned glass, or an intentionally see-through overlay) - leave both
    // completely alone.
    if (material.metallicTexture || material.microSurfaceTexture || material.alpha < 1) continue;

    try {
      const label = `${mesh.name || ''} ${material.name || ''}`;
      const look = classify(label);
      if (!look) continue;

      material.metallic = look.metallic;
      material.roughness = look.roughness;
      if (look.glassAlpha !== undefined) {
        material.alpha = look.glassAlpha;
        material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      }
      enhancedCount++;
    } catch (error) {
      console.warn('[materialEnhancement] Skipped a material that could not be enhanced:', error);
    }
  }

  return enhancedCount;
}
