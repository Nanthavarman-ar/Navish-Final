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
  kind: 'preset' | 'texture';
  presetId?: string;
  previewColor?: string;
  textureDataUrl?: string;
  tileWidthCm?: number;
  tileHeightCm?: number;
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
  };
  swatches?: SavedSwatchMarker[];
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
export async function saveSceneEdits(modelId: string, data: SceneEditsData): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) return; // not signed in (or session expired) - silently skip, don't spam errors for a background autosave
  try {
    await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ sceneData: data }),
    });
  } catch (error) {
    console.error('Failed to auto-save scene edits:', error);
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
export async function savePartialFeatureState(modelId: string, patch: SavedFeatureState): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) return;
  try {
    const current = await loadSceneEdits(modelId);
    const merged: SceneEditsData = {
      ...(current ?? { meshes: {} }),
      features: { ...(current?.features ?? {}), ...patch },
    };
    await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ sceneData: merged }),
    });
  } catch (error) {
    console.error('Failed to save feature state:', error);
  }
}

export async function loadSceneEdits(modelId: string): Promise<SceneEditsData | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  try {
    const response = await fetch(`${functionsBaseUrl}/api/scenes/${encodeURIComponent(modelId)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) return null; // 404 (no saved edits yet) or any other failure - just start fresh
    const data = await response.json();
    return data?.scene?.data ?? null;
  } catch (error) {
    console.error('Failed to load saved scene edits:', error);
    return null;
  }
}
