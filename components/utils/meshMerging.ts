import { AbstractMesh, Geometry, Material, Mesh, Scene, Vector3 } from '@babylonjs/core';
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
//
// lamp/lantern/candle/fireplace/sconce/chandelier/pendant are the SAME "a fixture type
// needs the exact original mesh" reasoning as tree/plant above, just missed when this was
// first written - DECORATIVE_NAME_PATTERN above already matches "lamp"/"lantern" as
// candidates to merge away, and InteractiveFixtures.tsx's Light Switch/Fireplace-Candle
// fixture types place themselves onto exactly that kind of mesh ("Click the bulb/fixture",
// "Click the fireplace/candle"). A merged-away lamp/candle mesh is exactly the same
// "clicking what looks like the fixture actually picks the whole merged blob instead" bug
// already handled for door/curtain/elevator/shutter via MAX_FIXTURE_MESH_SIZE in that
// file - reported this session as a fire/candle fixture ending up "in the wrong place".
const STRUCTURAL_EXCLUDE_PATTERN = /wall|floor|ceiling|door|window|glass|beam|column|pillar|roof|slab|stair|tree|plant|foliage|vine|ivy|fan\b|\btv\b|curtain|elevator|shutter|lamp|lantern|candle|fireplace|sconce|chandelier|pendant/i;

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

// Exported for BabylonWorkspace.tsx's post-load LOD/isPickable pass - "is this mesh
// decorative background clutter" is the SAME question this file already answers
// carefully for merging (bush/rail/lamp-shaped, not structural, not something a fixture/
// Material Editor/BIM tool would ever reference by identity), and reusing it there is
// what makes LOD/isPickable safe to apply automatically: a NEGATIVE-only filter ("isn't
// a wall") would also match furniture (a sofa, a table) that legitimately needs to stay
// selectable in the Property Inspector/Material Editor - this POSITIVE match (must
// actually look like bush/rail/lamp/etc clutter) is what a merged_decorative_* result
// already passed to exist, and what this checks for anything that didn't get merged
// (no material-sharing neighbor, or excluded by the size-ratio guard) but is still the
// same kind of thing.
export function isDecorativeClutterMesh(mesh: AbstractMesh, modelDiagonal: number): boolean {
  if (/^merged_decorative_/i.test(mesh.name || '')) return true;
  return isMergeCandidate(mesh, modelDiagonal);
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

// How many copies of the exact same geometry+material have to repeat before thin-instancing
// them is worth the bookkeeping (dispose N-1 meshes, add N-1 matrices to one buffer) over
// just leaving them as separate draw calls (or letting mergeDecorativeMeshes below combine
// them with same-material neighbors of DIFFERENT geometry, which thin instancing can't do -
// a thin instance is the master's exact vertex/index buffer replayed at a new transform, not
// a distinct shape).
const MIN_THIN_INSTANCE_GROUP_SIZE = 3;

/**
 * Thin-instances exact repeats of the same decorative-clutter mesh (see
 * isDecorativeClutterMesh/isMergeCandidate above - the identical safety filter this shares
 * with mergeDecorativeMeshes and BabylonWorkspace.tsx's isPickable/LOD pass: no structural/
 * fixture/furniture identity this app's tools depend on ever gets touched). Meant to run
 * BEFORE mergeDecorativeMeshes on the same array: a repeated lamp/baluster/bush that's the
 * SAME source mesh copy-pasted many times (common after modelOptimizer.ts's upload-time
 * dedup() pass, which already collapses duplicate geometry data in the glTF itself before
 * this ever reaches the browser - so true repeats commonly already share one Geometry
 * object by the time they're loaded here) is a better fit for instancing than merging: a
 * thin instance replays the master's existing vertex/index buffer via a per-copy transform
 * matrix (a few bytes each), where MergeMeshes would instead concatenate a full duplicate
 * copy of that same vertex data into a bigger buffer for every repeat - real, avoidable VRAM
 * and CPU (build-time) cost for exactly the kind of "one object copy-pasted all over the
 * site" case this was asked to solve (rows of identical bollards/lamps/balusters). Whatever
 * ISN'T an exact repeat (different geometry, same material - e.g. varied bush shapes with a
 * shared leaf material) is left untouched for mergeDecorativeMeshes to combine afterward,
 * same as before this existed.
 *
 * Mutates `meshes` in place: disposes every mesh that became a thin instance and removes it
 * from the array, exactly like mergeDecorativeMeshes' own mergedAway bookkeeping.
 */
export async function thinInstanceDecorativeMeshes(meshes: AbstractMesh[], _scene: Scene): Promise<void> {
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

  // Geometry identity is the grouping key - NOT a vertex-data hash. Two visually-identical
  // meshes that happen to have been exported as separate, never-deduplicated Geometry
  // objects are deliberately left ungrouped here rather than risking a false-positive
  // fuzzy-hash match silently instancing two similar-but-not-actually-identical shapes onto
  // the wrong one's geometry.
  const groups = new Map<Geometry, Mesh[]>();
  await runChunked(meshes, (mesh) => {
    if (!isMergeCandidate(mesh, modelDiagonal)) return;
    if (mesh.skeleton) return; // thin instances don't support per-instance skinning
    const geometry = mesh.geometry;
    if (!geometry) return;
    const group = groups.get(geometry);
    if (group) group.push(mesh);
    else groups.set(geometry, [mesh]);
  });

  const instancedAway = new Set<AbstractMesh>();
  groups.forEach((geometryGroup) => {
    if (geometryGroup.length < MIN_THIN_INSTANCE_GROUP_SIZE) return;
    // Thin instances all render with the master's single material, so a same-geometry group
    // still needs splitting by material (e.g. the same lamp mesh reused with two different
    // paint-color materials across a site).
    const byMaterial = new Map<Material | null, Mesh[]>();
    for (const mesh of geometryGroup) {
      const materialKey = mesh.material ?? null;
      const materialGroup = byMaterial.get(materialKey);
      if (materialGroup) materialGroup.push(mesh);
      else byMaterial.set(materialKey, [mesh]);
    }
    byMaterial.forEach((sameMaterialGroup) => {
      if (sameMaterialGroup.length < MIN_THIN_INSTANCE_GROUP_SIZE) return;
      const master = sameMaterialGroup[0];
      // Capture every mesh's own world matrix (the master's included) BEFORE touching
      // anything - a thin instance's matrix is used as that instance's complete world
      // matrix directly (Babylon uploads it into a per-instance buffer literally named
      // "world"), not combined with whatever separate transform the master mesh itself
      // still has. Confirmed live: leaving the master at its own original position and
      // adding only the OTHER duplicates' world matrices as thin instances rendered
      // nothing at all (the master's real transform and each instance's matrix compounded
      // into the wrong place). Resetting the master to identity first and adding every
      // mesh's captured matrix - the master's own included - as a thin instance is what
      // actually makes each one land at its original spot.
      const worldMatrices = sameMaterialGroup.map((mesh) => {
        mesh.computeWorldMatrix(true);
        return mesh.getWorldMatrix().clone();
      });
      master.position.setAll(0);
      master.rotationQuaternion = null;
      master.rotation.setAll(0);
      master.scaling.setAll(1);
      master.computeWorldMatrix(true);
      // refresh=true only on the LAST add - confirmed live this is load-bearing, not just an
      // optimization: thinInstanceRefreshBoundingInfo below only recomputes CPU-side bounds
      // from the matrix data already written into the CPU array: it never flushes that array
      // to the actual GPU instance buffer itself (thinInstanceBufferUpdated("matrix") is what
      // does that, called internally when refresh=true). Passing refresh=false on every call
      // and relying on thinInstanceRefreshBoundingInfo to "finish the job" renders nothing at
      // all - the GPU buffer is left stale - even though thinInstanceCount, the CPU-side
      // bounding box, and every other piece of bookkeeping look completely correct.
      worldMatrices.forEach((matrix, i) => {
        master.thinInstanceAdd(matrix, i === worldMatrices.length - 1);
      });
      master.thinInstanceRefreshBoundingInfo(true);
      // Without this, the master mesh was confirmed live to render nothing at all: its own
      // per-frame active-mesh/frustum check runs before thin instance bounds are accounted
      // for in some code paths, so it can get culled out despite thinInstanceRefreshBoundingInfo
      // above having computed the right combined bounds.
      master.alwaysSelectAsActiveMesh = true;
      for (let i = 1; i < sameMaterialGroup.length; i++) {
        instancedAway.add(sameMaterialGroup[i]);
      }
    });
  });

  if (instancedAway.size === 0) return;

  for (let i = meshes.length - 1; i >= 0; i--) {
    if (instancedAway.has(meshes[i])) meshes.splice(i, 1);
  }
  for (const duplicate of instancedAway) {
    duplicate.dispose();
  }
}
