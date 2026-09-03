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

export interface SceneEditsData {
  meshes: Record<string, SavedMeshEdit>;
  // The camera view captured by the workspace's "Set" button (BabylonWorkspace.tsx's
  // setHomeView) - saved alongside mesh edits under the same per-model record so Fit and
  // Presentation Mode's reference point are the same on every device, not just the browser
  // that clicked Set.
  homeView?: SavedHomeView;
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
// the loaded model across a reload (VersionHistoryPanel.tsx and friends use
// selectedWorkspaceId for room-scoped collab data like annotations/approvals, which is a
// different, legitimately page-scoped concept - not a bug to fix there, just not the right
// key for per-model edits).
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
