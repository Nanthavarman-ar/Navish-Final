import { AbstractMesh } from '@babylonjs/core';
import { supabase, projectId } from '../../supabase/client';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

interface SavedMaterialEdit {
  colorProperty: 'albedoColor' | 'diffuseColor';
  r: number;
  g: number;
  b: number;
  alpha: number;
}

interface SavedMeshEdit {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scaling: { x: number; y: number; z: number };
  material?: SavedMaterialEdit;
}

export interface SavedHomeView {
  alpha: number;
  beta: number;
  radius: number;
  target: { x: number; y: number; z: number };
}

export interface SavedFloorPlan {
  id: string;
  name: string;
  previewImage: string; // rendered PNG data URL of the PDF's first page
}

// User-entered state for the analysis-tool panels that have real editable inputs (not the
// ones that are pure live-computed reports/one-shot exports with nothing to save - Cost
// Estimation's manual overrides are the exception, see costEstimator below). Grouped under
// one key so each panel's save only has to merge this one sub-object (see
// savePartialSceneEdits) rather than the whole top-level record.
export interface SavedSwatchOption {
  id: string;
  label: string;
  // 'scene-material' pins one of the materials already present on the loaded model
  // (e.g. "groundMaterial", the same list the Material Editor's own Materials panel
  // shows) rather than a generic preset or an uploaded texture - the option most people
  // actually want, since it reuses a material that's already known to look right on
  // this specific model instead of a generic named color.
  kind: 'preset' | 'texture' | 'scene-material';
  presetId?: string;
  previewColor?: string;
  textureDataUrl?: string;
  tileWidthCm?: number;
  tileHeightCm?: number;
  // kind === 'scene-material' - the source material's own .name at the time it was
  // pinned. Applying always clones it fresh (see applySceneMaterialOption) rather than
  // assigning this same live reference, specifically so switching one marked mesh's
  // material never visually changes any OTHER mesh that happens to share the same
  // original material, and so a later edit to the original in the Material Editor can't
  // retroactively change what this marker already applied.
  sourceMaterialName?: string;
}

// Per-mesh material-swap markers (components/MeshMaterialSwatches.tsx) - saved here
// (instead of that component's own backend call) specifically so they're visible to
// every client who opens this model, not just the browser that placed them. localStorage
// was the first cut, but that's per-browser only - an admin's markers never reached
// anyone viewing the model from a different device/account, which is the whole point of
// the feature.
export interface SavedSwatchMarker {
  id: string;
  meshId: string;
  meshName: string;
  position: { x: number; y: number; z: number };
  options: SavedSwatchOption[];
}

// User-entered state for the analysis-tool panels that have real editable inputs (not the
// ones that are pure live-computed reports/one-shot exports with nothing to save - Cost
// Estimation's manual overrides are the exception, see costEstimator below). Grouped under
// one key so each panel's save only has to merge this one sub-object (see
// savePartialSceneEdits) rather than the whole top-level record.
export interface SavedFeatureState {
  budgetTierOverrides?: Record<string, { materials: number; total: number }>;
  roiInputs?: { annualReturn: number; horizonYears: number };
  beforeAfter?: { beforeImage?: string; afterImage?: string };
  windTunnel?: { windDirection: number; windSpeed: number; turbulence: number; temperature: number };
  costEstimator?: {
    region: string;
    budget: number;
    breakdownOverrides?: Record<string, { material: number; labor: number; equipment: number; overhead: number; total: number }>;
    // The uploaded "Reference PDF" (e.g. a contractor's quote) - previously only ever a
    // local blob: URL held in component state, so it vanished the moment the panel
    // unmounted or the page reloaded, and never reached anyone viewing the model on
    // another device. Saved as a data URL (rather than uploaded to storage) to match how
    // Minimap's floor plans and swatch textures already embed their images in this same
    // per-model record, instead of introducing a second persistence mechanism.
    referencePdf?: { name: string; dataUrl: string };
  };
  swatches?: SavedSwatchMarker[];
  ambientZones?: SavedAmbientZone[];
  fixtures?: SavedFixture[];
}

// "Living details" - interactive placed fixtures (InteractiveFixtures.tsx) - a fan whose
// blades spin, a light switch that toggles a real light + the fixture's own glow, a TV
// screen that lights up - each placed ON a specific mesh in THIS model (meshId/meshName/
// position resolved back via resolveMeshRef, same disambiguation swatches use for
// duplicate-named meshes) rather than assumed to exist at a fixed name like "Fan_Blades",
// since an arbitrary uploaded Revit/SketchUp/Blender export has no predictable mesh
// naming. Saved per-model so every viewer sees the same fixtures in the same place and
// the same on/off state the admin left them in, not just whoever placed them.
export interface SavedFixture {
  id: string;
  type: 'fan' | 'light' | 'tv' | 'door' | 'fire' | 'water' | 'curtain' | 'wind' | 'rain' | 'person' | 'pet' | 'elevator' | 'shutter';
  label: string;
  position: { x: number; y: number; z: number };
  // The mesh this fixture acts on - fan blades to spin, bulb/fixture mesh to glow, TV
  // screen to light up, the door/cabinet/shutter panel itself to swing/slide, the curtain/
  // tree mesh to sway, the window mesh the rain overlay sits in front of, the elevator
  // cabin mesh to travel. Absent for a 'light'/'fire'/'water'/'person'/'pet' placed on
  // empty air (no mesh under the click) - those still create a real light/particle/prop
  // there, just with no mesh to glow/attach to.
  meshId?: string;
  meshName?: string;
  isOn: boolean;
  // 'tv' only - a real uploaded video (Cloudflare R2, same storage models use) that plays
  // on the screen mesh while "on". Without one, TV falls back to an animated glow with no
  // real video - see InteractiveFixtures.tsx.
  videoUrl?: string;
  // 'door' only - which side of the door mesh's own (world-space) bounding box the hinge
  // sits on. There's no reliable way to detect which edge is the real hinge from geometry
  // alone, so this defaults to 'min' and the admin corrects it with the "Flip hinge" list
  // control if it swings from the wrong edge.
  hingeSide?: 'min' | 'max';
  // 'door' only - flips which way it swings open, for the same reason as hingeSide (no
  // reliable way to know which side of the wall the room is on) - the "Reverse swing"
  // list control.
  swingReversed?: boolean;
  // 'elevator' only - how far up (metres) the cabin travels when "on", since a real
  // floor-to-floor height varies by building and can't be measured from the cabin mesh
  // alone. Defaults to 3m (one typical storey) if unset.
  travelHeight?: number;
  // 'person' only - defaults to 'standing'.
  personVariant?: 'standing' | 'sitting';
  // 'pet' only - defaults to 'dog'.
  petVariant?: 'dog' | 'cat' | 'bird';
}

// Directional ambience markers (SpatialAudioPanel.tsx) - e.g. a marker near the balcony
// playing traffic/birds, one in the living room playing TV chatter/a fountain. Saved here
// (instead of only ever existing as live Web Audio nodes in one browser tab) so every
// client who opens this model hears the same placed ambience, not just whoever placed it.
export interface SavedAmbientZone {
  id: string;
  preset: 'traffic' | 'birds' | 'tv' | 'fountain';
  label: string;
  position: { x: number; y: number; z: number };
  volume: number;
  maxDistance: number;
}

export interface SceneEditsData {
  meshes: Record<string, SavedMeshEdit>;
  // The camera view captured by the workspace's "Set" button (BabylonWorkspace.tsx's
  // setHomeView) - saved alongside mesh edits under the same per-model record so Fit and
  // Presentation Mode's reference point are the same on every device, not just the browser
  // that clicked Set.
  homeView?: SavedHomeView;
  // PDF floor plans uploaded via the Minimap panel - previously kept only in this browser's
  // localStorage (per Minimap.tsx), so they didn't follow the model to another device.
  floorPlans?: SavedFloorPlan[];
  features?: SavedFeatureState;
}

// Real model meshes only - loadedModelMeshesRef (BabylonWorkspace.tsx) already scopes this
// to exactly what the current load actually added, so no separate ground/helper-name
// exclusion pattern is needed here the way AR placement (XRManager.getPlaceableMeshes) or
// the desktop Scale panel need one.
export function captureSceneEdits(meshes: AbstractMesh[]): SceneEditsData {
  const result: SceneEditsData = { meshes: {} };
  meshes.forEach((mesh) => {
    if (!mesh.name) return;
    const material = mesh.material as any;
    const colorProperty: 'albedoColor' | 'diffuseColor' | null =
      material && 'albedoColor' in material ? 'albedoColor' : material && 'diffuseColor' in material ? 'diffuseColor' : null;

    const entry: SavedMeshEdit = {
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
      scaling: { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z },
    };
    if (colorProperty && material[colorProperty]) {
      const c = material[colorProperty];
      entry.material = { colorProperty, r: c.r, g: c.g, b: c.b, alpha: material.alpha ?? 1 };
    }
    // A mesh can share a name with others in the same model (glTF doesn't guarantee
    // uniqueness) - later entries for the same name overwrite earlier ones here, and
    // applySceneEdits() below applies one saved entry to every mesh sharing that name, so
    // meshes with a duplicate name are only correctly restored if their edits matched.
    // Acceptable trade-off: real-world duplicate-named meshes are rare, and the
    // alternative (positional/index-based keys) breaks the moment the source file's mesh
    // order changes between exports.
    result.meshes[mesh.name] = entry;
  });
  return result;
}

export function applySceneEdits(meshes: AbstractMesh[], data: SceneEditsData | null | undefined): void {
  if (!data?.meshes) return;
  meshes.forEach((mesh) => {
    const entry = data.meshes[mesh.name];
    if (!entry) return;
    mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
    mesh.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
    mesh.scaling.set(entry.scaling.x, entry.scaling.y, entry.scaling.z);
    if (entry.material && mesh.material) {
      const material = mesh.material as any;
      if (entry.material.colorProperty in material) {
        const c = material[entry.material.colorProperty];
        c.r = entry.material.r;
        c.g = entry.material.g;
        c.b = entry.material.b;
        material.alpha = entry.material.alpha;
      }
    }
  });
}

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// modelId is currentModelId (BabylonWorkspace.tsx), NOT selectedWorkspaceId - the latter is
// a hardcoded per-page literal ("workspace", "naviz-studio-main", ...) shared by every model
// that ever loads on that page, so saving under it would let two unrelated models silently
// clobber each other's saved edits. currentModelId is the one value that actually identifies
// the loaded model across a reload. AnnotationTool, VersionHistoryPanel, and ApprovalPanel
// (uiSegments.tsx) all now pass currentModelId as their roomId too, for the same reason -
// they used to pass selectedWorkspaceId on the assumption that was the correct
// "collaborative room" key, but nothing else in this app actually saves anything under
// selectedWorkspaceId, so that just meant notes/versions/approvals from every model loaded
// on the same page bled into each other.
// Returns whether the save actually reached storage - callers that only ever fire this
// off without checking (most of them, historically) keep working unchanged, but anything
// that needs to know if it silently failed (e.g. a large payload getting rejected by the
// backend with a non-2xx status - a fetch() promise resolves normally for that, it never
// rejects on its own) can now find out instead of wrongly assuming success.
export async function saveSceneEdits(modelId: string, data: SceneEditsData): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false; // not signed in (or session expired) - silently skip, don't spam errors for a background autosave
  try {
    const body = JSON.stringify({ sceneData: data });
    const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body,
    });
    if (!response.ok) {
      // The caller only gets a boolean back, so log the server's actual reason here -
      // e.g. a request-too-large rejection from an accumulated record (floor plan preview
      // images, before/after photos, etc. all live in this same per-model JSON blob) looks
      // identical to any other failure without this.
      const errorText = await response.text().catch(() => '');
      console.error(`Failed to save scene edits for ${modelId}: ${response.status} ${errorText} (payload ${body.length} bytes)`);
    }
    return response.ok;
  } catch (error) {
    console.error('Failed to auto-save scene edits:', error);
    return false;
  }
}

// Merge-and-save a single feature panel's own slice of `features` without needing every
// panel to route through BabylonWorkspace.tsx's central sceneEditsRef (that ref only exists
// there; the panels using this - CostEstimatorWrapper, ROICalculatorPanel, BudgetTierPanel,
// BeforeAfterPanel, WindTunnelSimulation - are separate lazy-loaded components several
// levels deep in uiSegments.tsx, and threading a shared merge target down to all of them
// would mean plumbing new props through half a dozen intermediate segment components).
// Read-modify-write instead: fetches the current record, merges `patch.features` one level
// deep into the existing `features` (so saving ROI inputs doesn't wipe out an already-saved
// Wind Tunnel setting), then saves the whole merged record. This has the same small
// last-write-wins race a save-only approach would if two panels save within the same
// instant, which is an acceptable trade-off for what's normally one person editing one
// panel at a time - not worth a backend PATCH endpoint + server-side merge for.
export async function savePartialFeatureState(modelId: string, patch: SavedFeatureState): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;
  try {
    const current = await loadSceneEdits(modelId);
    const merged: SceneEditsData = {
      ...(current ?? { meshes: {} }),
      features: { ...(current?.features ?? {}), ...patch },
    };
    const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ sceneData: merged }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to save feature state:', error);
    return false;
  }
}

export async function loadSceneEdits(modelId: string): Promise<SceneEditsData | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  try {
    const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(modelId)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      // 404 just means nothing has been saved for this model yet - expected and silent.
      // Anything else (network hiccup, auth glitch, server error) means saved edits DO
      // exist but failed to load, which the caller (and every panel restoring from them -
      // floor plans, home view, mesh edits) would otherwise treat identically to "nothing
      // saved", quietly showing an empty/default state instead of what was actually saved.
      if (response.status !== 404) {
        const errorText = await response.text().catch(() => '');
        console.error(`Failed to load saved scene edits for ${modelId}: ${response.status} ${errorText}`);
      }
      return null;
    }
    const data = await response.json();
    return data?.scene?.data ?? null;
  } catch (error) {
    console.error('Failed to load saved scene edits:', error);
    return null;
  }
}
