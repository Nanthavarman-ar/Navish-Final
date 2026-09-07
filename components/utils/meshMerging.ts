import { AbstractMesh, Mesh, Scene, Vector3 } from '@babylonjs/core';
import { runChunked } from './runChunked';

// Small, repeated decorative clutter - trees' foliage aside (see exclusion note below),
// bushes/hedges/railings/fences/rocks/lamps in a real architectural export are commonly
// hundreds of separate meshes, each costing its own draw call every frame regardless of
// the freezeWorldMatrix() optimization already applied elsewhere (that only saves CPU
// matrix recomputation, not the GPU draw call itself). Merging them into one mesh per
// shared material is a straightforward, safe win: same triangles, same material, far
// fewer draw calls.
const DECORATIVE_NAME_PATTERN = /bush|shrub|hedge|rail|baluster|fence|planter|rock|stone|pebble|gravel|lamp|lantern|topiary|flower|grass/i;

// Deliberately excludes "tree"/"plant"/"foliage"/"vine"/"ivy" even though those are also
// common decorative clutter: components/InteractiveFixtures.tsx's "Wind Sway" fixture
// type animates a tree/plant mesh's own vertices, and that requires the exact original
// mesh to still exist under its saved meshId after a reload. Also excludes anything
// matching this app's own structural/fixture-type keywords as a safety net against an
// ambiguous name (e.g. "Fence_Door").
const STRUCTURAL_EXCLUDE_PATTERN = /wall|floor|ceiling|door|window|glass|beam|column|pillar|roof|slab|stair|tree|plant|foliage|vine|ivy|fan\b|\btv\b|curtain|elevator|shutter/i;

// Same non-model-helper-mesh prefix list already reused verbatim in BIMManager.ts
// (registerLoadedModelFromScene), computePrecipitationBounds (BabylonWorkspace.tsx), and
// InteractiveFixtures.tsx's getPlaceableMeshes - markers/tools this app creates itself,
// never part of the actual uploaded model.
const NON_MODEL_MESH_PREFIX = /^(ground|__root__|measure_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|ar_reticle|ar_placement_root|preview_|scenario_|proceduralSkybox|analytics_heatmap)/i;

// A misnamed large structural element (e.g. a whole facade oddly named "StoneWall")
// shouldn't get merged away just because it matched a decorative keyword - real
// decorative clutter is small relative to the whole model.
const MAX_CANDIDATE_SIZE_RATIO = 0.25;

function isMergeCandidate(mesh: AbstractMesh, modelDiagonal: number): mesh is Mesh {
  if (!(mesh instanceof Mesh)) return false;
  if (mesh.getTotalVertices() === 0) return false;
  const name = mesh.name || '';
  if (NON_MODEL_MESH_PREFIX.test(name)) return false;
  if (!DECORATIVE_NAME_PATTERN.test(name)) return false;
  if (STRUCTURAL_EXCLUDE_PATTERN.test(name)) return false;
  if (!mesh.material) return false;
  if (modelDiagonal > 0) {
    const bb = mesh.getBoundingInfo().boundingBox;
    const size = bb.maximumWorld.subtract(bb.minimumWorld);
    if (size.length() > modelDiagonal * MAX_CANDIDATE_SIZE_RATIO) return false;
  }
  return true;
}

/**
 * Merges small, repeated decorative meshes (bushes, hedges, railings, fences, rocks,
 * lamps - see DECORATIVE_NAME_PATTERN) sharing the same material into one mesh per
 * group, to cut draw calls on mesh-heavy architectural imports. Mutates `meshes` in
 * place: removes every mesh that got merged away, pushes each successful merge result.
 * Structural/interactive elements (walls, doors, windows, furniture) and anything this
 * app's own tools created are never touched, so per-element selection (Material editor,
 * Measure tool, BIM cost estimate) keeps working exactly as before for those.
 *
 * Async and chunked (see runChunked) rather than one flat pass - on a heavy, high-mesh-
 * count import this is one of several back-to-back per-mesh scans that run right after
 * load (alongside shadow-caster registration and BIM registration in BabylonWorkspace.tsx)
 * with nothing yielding to the browser in between, which is what was tripping Chrome's own
 * "Page Unresponsive" hang detector on large models rather than the work being slow per se.
 */
export async function mergeDecorativeMeshes(meshes: AbstractMesh[], _scene: Scene): Promise<void> {
  if (meshes.length === 0) return;

  let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
  let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
  await runChunked(meshes, (m) => {
    if (m.getTotalVertices() === 0) return;
    const bb = m.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bb.minimumWorld);
    max = Vector3.Maximize(max, bb.maximumWorld);
  });
  const modelDiagonal = max.subtract(min).length();

  const groups = new Map<unknown, Mesh[]>();
  await runChunked(meshes, (mesh) => {
    if (!isMergeCandidate(mesh, modelDiagonal)) return;
    const key = mesh.material!;
    const group = groups.get(key);
    if (group) group.push(mesh);
    else groups.set(key, [mesh]);
  });

  const merged: Mesh[] = [];
  const mergedAway = new Set<AbstractMesh>();
  let groupIndex = 0;
  groups.forEach((group) => {
    if (group.length < 2) return;
    const hadCollisions = group.some((m) => m.checkCollisions);
    let result: Mesh | null;
    try {
      result = Mesh.MergeMeshes(group, true, true);
    } catch (error) {
      // Incompatible vertex layouts (e.g. mismatched UV channels) across an otherwise
      // same-material group - skip merging this one group rather than losing the model.
      console.warn('Skipped merging a decorative mesh group:', error);
      return;
    }
    if (!result) return;
    result.name = `merged_decorative_${groupIndex++}`;
    result.checkCollisions = hadCollisions;
    result.receiveShadows = true;
    group.forEach((m) => mergedAway.add(m));
    merged.push(result);
  });

  if (merged.length === 0) return;

  for (let i = meshes.length - 1; i >= 0; i--) {
    if (mergedAway.has(meshes[i])) meshes.splice(i, 1);
  }
  meshes.push(...merged);
}
