import { AbstractMesh, Material, PBRMaterial, Texture } from '@babylonjs/core';
import { showToast } from './toast';

// Enscape-style "actually look at the texture" material recognition, as a companion to
// materialEnhancement.ts's name-based pass. That pass can only give a believable look to a
// material whose MESH/MATERIAL NAME happens to say what it is ("Marble_Floor") - reported
// this session as a real gap on models exported with generic/blank names (SketchUp/Enscape
// exports commonly name every node "Geom3D_<something>" or just "Geom3D_"), where the only
// way to tell a marble floor from a painted wall is to look at the actual texture image, the
// same way a person would. Runs a real zero-shot image classifier (CLIP, via transformers.js)
// against each material's own albedoTexture, entirely client-side - no API key, no backend,
// no per-image cost, works offline after the model is cached by the browser once.
//
// Deliberately scoped to materials that already HAVE a real albedoTexture (an actual photo/
// scan baked into the glTF) - there is nothing to classify for the ~100+ "no material
// assigned at all" meshes materialEnhancement.ts's MISSING_MATERIAL_NAME path already flags;
// no amount of image analysis can identify a texture that was never in the file.

export interface TextureMaterialLook {
  metallic: number;
  roughness: number;
  clearcoat?: boolean;
  clearcoatRoughness?: number;
  /** Only assigned when the classifier is confident this is actual see-through glass. */
  glassAlpha?: number;
}

// CLIP zero-shot classification works by ranking the image against a list of candidate text
// labels and returning a confidence per label - there's no fixed "vocabulary" to pick from,
// these are just the categories this app knows how to turn into a believable PBR response.
// Phrased as short scene descriptions (CLIP's own training data is image/caption pairs, so a
// natural-language description ranks more reliably than a single bare word) rather than the
// single keywords materialEnhancement.ts's regex list uses - that's a different, string-only
// technique with different phrasing needs.
const LABEL_LOOKS: Record<string, TextureMaterialLook> = {
  'polished marble or granite stone surface': { metallic: 0, roughness: 0.12, clearcoat: true, clearcoatRoughness: 0.1 },
  'clear glass or window pane': { metallic: 0, roughness: 0.05, glassAlpha: 0.2 },
  'mirror or highly reflective metal surface': { metallic: 1, roughness: 0.03 },
  'wood grain or timber surface': { metallic: 0, roughness: 0.55 },
  'ceramic floor or wall tile': { metallic: 0, roughness: 0.22, clearcoat: true, clearcoatRoughness: 0.15 },
  'fabric, carpet, or upholstery surface': { metallic: 0, roughness: 0.85 },
  'brushed or painted metal surface': { metallic: 0.55, roughness: 0.4 },
  'plain painted wall, plaster, or drywall': { metallic: 0.05, roughness: 0.8 },
  'bare concrete surface': { metallic: 0, roughness: 0.85 },
};
const LABELS = Object.keys(LABEL_LOOKS);

// Below this, the classifier itself is saying "none of these labels fit well" (CLIP's scores
// are a softmax over the label list, so even a genuinely unrelated image always sums to 1
// across labels - a low top score is the actual signal something doesn't match any of them,
// not an error). Leaving the material at whatever materialEnhancement.ts's name-based pass
// already gave it is safer than forcing a confident-sounding but wrong material response.
const MIN_CONFIDENCE = 0.35;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifierPromise: Promise<any> | null = null;

// Lazy-loaded (only the first time a model with real textures is actually imported) rather
// than at app startup - the model weights (~150MB for clip-vit-base-patch16) are a real,
// one-time download this feature's own value has to justify, not a cost every visitor pays
// just for opening the app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClassifier(): Promise<any> {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch16');
    })().catch((error) => {
      // Reset so a transient failure (offline, CDN hiccup) can be retried on the next
      // model load instead of permanently wedging this feature for the rest of the session.
      classifierPromise = null;
      throw error;
    });
  }
  return classifierPromise;
}

async function waitForTextureReady(texture: Texture, timeoutMs = 15000): Promise<boolean> {
  if (texture.isReady()) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    texture.onLoadObservable.addOnce(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function textureToRawImage(texture: Texture): Promise<any | null> {
  const ready = await waitForTextureReady(texture);
  if (!ready) return null;
  const size = texture.getSize();
  if (!size.width || !size.height) return null;
  // Downscale before readback for large source textures - CLIP's own preprocessor resizes
  // to 224x224 regardless, so reading a multi-K source at full resolution only spends extra
  // GPU readback time for detail the model throws away immediately after.
  const MAX_DIM = 256;
  const scale = Math.min(1, MAX_DIM / Math.max(size.width, size.height));
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  try {
    const pixels = await texture.readPixels(0, 0, null, true, false, 0, 0, width, height);
    if (!pixels) return null;
    const { RawImage } = await import('@huggingface/transformers');
    const data = pixels instanceof Uint8ClampedArray ? pixels : new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength);
    return new RawImage(data, width, height, 4);
  } catch {
    // readPixels can throw on textures the engine can't read back from in this context
    // (some compressed/KTX2 formats, a texture mid-dispose) - skip this one material rather
    // than failing the whole batch over it.
    return null;
  }
}

export interface TextureClassificationResult {
  classifiedCount: number;
  skippedCount: number;
}

/**
 * Walks a just-loaded model's meshes and, for every PBRMaterial that already has a real
 * albedoTexture but hasn't been given a deliberate metallic/roughness response (the same
 * "untouched" condition materialEnhancement.ts's name-based pass uses), classifies that
 * texture image against a small set of real-world surface categories and applies a
 * believable PBR look. Independent of, and meant to run AFTER, enhanceImportedMaterials()
 * - this only touches materials that pass had no name-based signal for, using the actual
 * texture pixels instead. Runs the classifier lazily and reports progress via toast, since
 * downloading the model + classifying many textures can take real time on first use.
 */
export async function classifyMaterialsByTexture(meshes: AbstractMesh[]): Promise<TextureClassificationResult> {
  const processed = new Set<Material>();
  const candidates: PBRMaterial[] = [];

  for (const mesh of meshes) {
    const material = mesh.material;
    if (!material || processed.has(material)) continue;
    processed.add(material);
    if (!(material instanceof PBRMaterial)) continue;
    if (!material.albedoTexture || !(material.albedoTexture instanceof Texture)) continue;
    // Already has a deliberate metallic/roughness texture or non-default transparency - a
    // real authored PBR material materialEnhancement.ts also leaves alone for the same
    // "don't fight real authored data" reason.
    if (material.metallicTexture || material.microSurfaceTexture || material.alpha < 1) continue;
    candidates.push(material);
  }

  if (candidates.length === 0) return { classifiedCount: 0, skippedCount: 0 };

  let toastId: string | number | undefined;
  let classifier;
  try {
    toastId = showToast.loading('Identifying materials from textures…', `0 / ${candidates.length}`);
    classifier = await getClassifier();
  } catch (error) {
    if (toastId !== undefined) showToast.dismiss(toastId);
    console.warn('[textureMaterialClassifier] Could not load the material classifier model:', error);
    showToast.error('Could not identify materials from textures', 'The material recognition model failed to load - textures keep whatever look they already had.');
    return { classifiedCount: 0, skippedCount: 0 };
  }

  let classifiedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const material = candidates[i];
    if (toastId !== undefined) showToast.update(toastId, 'Identifying materials from textures…', `${i + 1} / ${candidates.length}`);
    try {
      const image = await textureToRawImage(material.albedoTexture as Texture);
      if (!image) {
        skippedCount++;
        continue;
      }
      const results = await classifier(image, LABELS);
      const top = Array.isArray(results) ? results[0] : null;
      if (!top || top.score < MIN_CONFIDENCE) {
        skippedCount++;
        continue;
      }
      const look = LABEL_LOOKS[top.label as string];
      if (!look) {
        skippedCount++;
        continue;
      }
      material.metallic = look.metallic;
      material.roughness = look.roughness;
      if (look.clearcoat) {
        material.clearCoat.isEnabled = true;
        material.clearCoat.intensity = 0.3;
        material.clearCoat.roughness = look.clearcoatRoughness ?? 0.15;
      }
      if (look.glassAlpha !== undefined) {
        material.alpha = look.glassAlpha;
        material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      }
      classifiedCount++;
    } catch (error) {
      console.warn(`[textureMaterialClassifier] Could not classify material "${material.name}":`, error);
      skippedCount++;
    }
  }

  if (toastId !== undefined) showToast.dismiss(toastId);
  if (classifiedCount > 0) {
    showToast.success(`Identified ${classifiedCount} material${classifiedCount > 1 ? 's' : ''} from their textures`, skippedCount > 0 ? `${skippedCount} left unchanged - no confident match` : undefined);
  }
  return { classifiedCount, skippedCount };
}
