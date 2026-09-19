import { AbstractMesh, PBRMaterial, VertexBuffer } from '@babylonjs/core';

// Helpers for "Baked Lighting Mode" - models whose lighting was baked into textures
// (typically a Blender/Cycles bake, see scripts/blender/02_BAKE_FINAL_BABYLON_STATIC_FAST_v4.py)
// and therefore must be shown as-is instead of being lit a second time by this app.
//
// v4 of the bake script exports every baked material as glTF KHR_materials_unlit, which
// Babylon's glTF loader turns into PBRMaterial.unlit = true - detected below as "authored
// unlit". Files exported by the OLDER bake scripts have no such flag: their baked image is
// wired into the material's EMISSION (baseColor black, emissiveTexture set) and the material
// name carries the "__BABYLON_BAKED" suffix - detected below as a fallback so those files are
// still shown correctly instead of silently getting this app's lighting, tone mapping and
// SSAO layered on top.

const BAKED_MATERIAL_NAME = /__BABYLON_BAKED/i;
const NEAR_BLACK_ALBEDO_SUM = 0.03;

export interface BakedDetectionResult {
  /** Materials the file itself marks unlit (KHR_materials_unlit). */
  authoredUnlitCount: number;
  /** Materials recognised as older-script bakes (emissive-only, "__BABYLON_BAKED"). */
  legacyBakedCount: number;
  /** True when any material in the loaded meshes is an authored or legacy bake. */
  bakedFound: boolean;
}

function isNearBlackAlbedo(material: PBRMaterial): boolean {
  const c = material.albedoColor;
  return !!c && c.r + c.g + c.b < NEAR_BLACK_ALBEDO_SUM;
}

/**
 * Legacy (pre-v4) bake: baked image in the EMISSIVE slot, no albedo texture, black
 * albedo, and the script's material-name suffix. Requires the name suffix so an ordinary
 * emissive-only material (a lamp, a screen) is never mistaken for a bake.
 */
export function isLegacyBakedMaterial(material: PBRMaterial): boolean {
  if (material.unlit) return false;
  if (!material.emissiveTexture) return false;
  if (material.albedoTexture) return false;
  return BAKED_MATERIAL_NAME.test(material.name) && isNearBlackAlbedo(material);
}

/**
 * Records, per material, whether the FILE says it's a bake (metadata.authoredUnlit /
 * metadata.legacyBaked) so toggling Baked Lighting Mode off later can restore each
 * material to what the file itself authored rather than force-lighting a bake.
 * Legacy bakes are also switched to unlit here, and their emissive texture is re-pointed at
 * the lightmap UV set (UV2 / TEXCOORD_1) when the mesh still has one - the old script never
 * wrote a texCoord, so the loader sampled the baked image with the original tiled UV0.
 */
export function detectBakedMaterials(meshes: AbstractMesh[]): BakedDetectionResult {
  const seen = new Set<PBRMaterial>();
  let authoredUnlitCount = 0;
  let legacyBakedCount = 0;

  for (const mesh of meshes) {
    const material = mesh.material;
    if (!(material instanceof PBRMaterial)) continue;

    if (seen.has(material)) continue;
    seen.add(material);

    const metadata: Record<string, unknown> = { ...(material.metadata || {}) };

    if (material.unlit) {
      metadata.authoredUnlit = true;
      authoredUnlitCount++;
    } else if (isLegacyBakedMaterial(material)) {
      metadata.authoredUnlit = true;
      metadata.legacyBaked = true;
      material.unlit = true;
      legacyBakedCount++;

      const emissive = material.emissiveTexture as { coordinatesIndex?: number } | null;
      if (emissive && emissive.coordinatesIndex === 0 && mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
        emissive.coordinatesIndex = 1;
      }
    } else {
      metadata.authoredUnlit = false;
    }

    material.metadata = metadata;
  }

  return {
    authoredUnlitCount,
    legacyBakedCount,
    bakedFound: authoredUnlitCount + legacyBakedCount > 0,
  };
}

/**
 * material.unlit = mode || what the file authored. PBRMaterial only (the glTF loader always
 * creates PBRMaterial for imported models). Safe to call repeatedly and on any mesh list.
 */
export function applyBakedLightingState(meshes: readonly AbstractMesh[], mode: boolean): void {
  const done = new Set<PBRMaterial>();

  for (const mesh of meshes) {
    const material = mesh.material;
    if (!(material instanceof PBRMaterial) || done.has(material)) continue;
    done.add(material);

    material.unlit = mode || !!material.metadata?.authoredUnlit;
  }
}
