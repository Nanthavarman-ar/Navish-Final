// Cheap approximation of indirect/bounce lighting (real-time global illumination is not
// something Babylon.js has a mature built-in solver for - see the conversation this was
// designed from) - a few soft, localized fill lights placed near detected windows, instead
// of true multi-bounce light transport. Strictly additive: this only ever ADDS new Light
// objects to the scene. It never reads, disables, or modifies the sun/hemispheric lights,
// HDRI/environment texture, shadow generator, SSAO/SSR/IBL Shadows pipelines, or any
// existing material - none of those are touched or imported here.
import { AbstractMesh, Color3, PointLight, Scene, Vector3 } from '@babylonjs/core';
import { isGlassLabel } from './materialEnhancement';

// Hard cap on how many fill lights ever get created for one model, regardless of how many
// windows it has - both a performance guard (each light is a real per-pixel shading cost,
// even without shadows) and, combined with FILL_TARGET_ILLUMINANCE below, the actual
// mechanism that keeps this "additive" rather than able to over-light a room: more windows
// never means more total added brightness past this ceiling.
const MAX_FILL_LIGHTS = 6;
const MIN_WINDOW_VERTICES = 12; // skip trivial slivers (a thin mullion, a handle)

// Babylon's PBR light falloff is a physical inverse-square law - `Light.range` (a hard
// cutoff distance) is explicitly documented as NOT applied to PBR materials, which is all
// this app's imported glTF models ever use (confirmed earlier this session: @babylonjs/
// loaders' glTF importer always creates PBRMaterial). That means a light positioned too
// close to real geometry can spike arbitrarily bright with no way to clamp it via range -
// the actual safety mechanism here is choosing a generous inward offset distance AND an
// intensity calibrated to be subtle AT that exact distance, not relying on a cutoff.
// FILL_TARGET_ILLUMINANCE is deliberately low (well under hemiLight's existing 0.4 base
// ambient) - "subtle" was an explicit requirement, and erring toward too-subtle is the safe
// direction to err in given the physics above; erring toward too-bright risks a visible hot
// spot right next to a window with no way to catch it before a user sees it live.
const FILL_TARGET_ILLUMINANCE = 0.12;
const MIN_OFFSET_METERS = 1.0;
const MAX_OFFSET_METERS = 2.0;

// Used only when no window/glass meshes were found at all (an exterior-only view, or a
// model whose glass isn't named in any way isGlassLabel recognizes) - a much rougher
// approximation with no real anchor point, so it's deliberately fewer and dimmer than the
// window-anchored case.
const FALLBACK_MAX_LIGHTS = 2;
const FALLBACK_ILLUMINANCE = 0.08;

export interface AmbientFillLightsResult {
  lights: PointLight[];
  windowsDetected: number;
}

function computeBounds(meshes: AbstractMesh[]): { min: Vector3; max: Vector3 } | null {
  let min: Vector3 | null = null;
  let max: Vector3 | null = null;
  for (const m of meshes) {
    if (m.getTotalVertices() === 0) continue;
    const bb = m.getBoundingInfo().boundingBox;
    min = min ? Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone();
    max = max ? Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone();
  }
  return min && max ? { min, max } : null;
}

function makeFillLight(scene: Scene, name: string, position: Vector3, offsetDistance: number): PointLight {
  const light = new PointLight(name, position, scene);
  // Calibrated so illuminance AT this light's own offset distance equals the target - see
  // FILL_TARGET_ILLUMINANCE's own comment for why this (not a range cutoff) is what
  // actually keeps this subtle/safe under PBR's inverse-square falloff.
  light.intensity = FILL_TARGET_ILLUMINANCE * offsetDistance * offsetDistance;
  // Slightly warm, like real daylight bounced off interior surfaces - subtle, not a
  // colored-light effect (this app's own Interactive Fixtures lamp glow uses a similarly
  // restrained warm tint for the same "reads as natural, not as a stage light" reason).
  light.diffuse = new Color3(1, 0.97, 0.9);
  // Pure diffuse fill, no specular contribution - a small point light's specular highlight
  // on a glossy floor/countertop reads as an obvious fake bright dot, not as ambient fill.
  light.specular = Color3.Black();
  // Deliberately never registered with the shadow generator/IBL Shadows (no
  // addShadowCaster-equivalent call for casting FROM this light exists, and none is added
  // here) - keeps this cheap (no extra shadow map) and, per the task requirement, leaves
  // every existing shadow/lighting system completely untouched.
  return light;
}

/**
 * Adds a small number of soft, localized fill lights near detected windows, as a cheap
 * stand-in for the indirect bounce light real GI would produce. Returns the created lights
 * so the caller can dispose them on the next model load (see BabylonWorkspace.tsx's
 * per-model cleanup, alongside where loadedModelMeshesRef's own meshes get disposed) -
 * this module never tracks or disposes anything itself.
 */
export function addAmbientFillLights(scene: Scene, meshes: AbstractMesh[]): AmbientFillLightsResult {
  const bounds = computeBounds(meshes);
  if (!bounds) return { lights: [], windowsDetected: 0 };

  const center = Vector3.Center(bounds.min, bounds.max);
  const diagonal = Vector3.Distance(bounds.min, bounds.max);
  const offsetDistance = Math.min(MAX_OFFSET_METERS, Math.max(MIN_OFFSET_METERS, diagonal * 0.06));

  const windowMeshes = meshes.filter((m) =>
    m.getTotalVertices() >= MIN_WINDOW_VERTICES &&
    isGlassLabel(`${m.name || ''} ${m.material?.name || ''}`.replace(/_/g, ' '))
  );

  const lights: PointLight[] = [];

  if (windowMeshes.length > 0) {
    // More windows than the cap: spread the sample across the whole list (every Nth one)
    // rather than always the first MAX_FILL_LIGHTS in mesh order, which on a real export
    // could mean every chosen window comes from the same wall/room while others get none.
    const step = Math.max(1, Math.floor(windowMeshes.length / MAX_FILL_LIGHTS));
    for (let i = 0; i < windowMeshes.length && lights.length < MAX_FILL_LIGHTS; i += step) {
      const windowMesh = windowMeshes[i];
      const windowCenter = windowMesh.getBoundingInfo().boundingBox.centerWorld;
      const towardCenter = center.subtract(windowCenter);
      // A window mesh with zero extent toward the model center (sitting exactly on it -
      // not realistic for a real building, but a degenerate/malformed import could do it)
      // would normalize a zero-length vector into NaN - fall back to straight up in that
      // one unlikely case rather than placing a NaN-positioned light.
      const direction = towardCenter.lengthSquared() > 1e-6 ? towardCenter.normalize() : Vector3.Up();
      const position = windowCenter.add(direction.scale(offsetDistance));
      lights.push(makeFillLight(scene, `ambient_fill_window_${i}`, position, offsetDistance));
    }
  } else {
    // No named glass/window meshes found - place a couple of generic, dimmer fill points
    // along the model's longest horizontal span at roughly mid-height, as a rough
    // "somewhere inside the building" approximation rather than no fallback at all.
    const size = bounds.max.subtract(bounds.min);
    const horizontalIsX = size.x >= size.z;
    const span = horizontalIsX ? size.x : size.z;
    const midY = bounds.min.y + size.y * 0.55;
    for (let i = 0; i < FALLBACK_MAX_LIGHTS; i++) {
      const t = (i + 1) / (FALLBACK_MAX_LIGHTS + 1); // e.g. 1/3, 2/3 for 2 lights
      const position = horizontalIsX
        ? new Vector3(bounds.min.x + span * t, midY, center.z)
        : new Vector3(center.x, midY, bounds.min.z + span * t);
      const light = makeFillLight(scene, `ambient_fill_fallback_${i}`, position, offsetDistance);
      // Fallback has no real anchor point, so it's held to the dimmer fallback target
      // regardless of the window-case calibration above.
      light.intensity = FALLBACK_ILLUMINANCE * offsetDistance * offsetDistance;
      lights.push(light);
    }
  }

  return { lights, windowsDetected: windowMeshes.length };
}
