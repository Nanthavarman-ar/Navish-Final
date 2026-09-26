import { Matrix, Vector3, type Scene, type TransformNode } from '@babylonjs/core';

// XRManager moves the whole model in two situations: VR re-centres it under the player
// (a translation-only root), and AR places/scales/rotates it as a tabletop miniature. In
// both cases the model's meshes end up under a TransformNode whose LOCAL space is the
// model's original, authored world space ("model space") - and that's the space every
// saved marker position (notes, material-switcher swatches, fixtures) is stored in.
//
// Markers that are positioned on the model are reparented under the same node, so they
// travel with it, and any code that turns a live pick into a stored position (or a stored
// position back into a live one) goes through these helpers instead of assuming world
// space == model space, which only holds while neither XR transform is active.

export const VR_WORLD_SHIFT_ROOT_NAME = 'xrVRWorldShiftRoot';
export const AR_MODEL_SPACE_NAME = 'ar_placement_model_space';

// Overlay meshes that are anchored to a point ON the model (and so must move with it),
// as opposed to HUD/controller UI that must stay with the player.
export const MODEL_ANCHORED_OVERLAY_RE = /^(annotation_pin_|annotation_popup_panel_|swatch_marker_|swatch_popup_panel_)/;

export function getModelSpaceNode(scene: Scene): TransformNode | null {
  const vr = scene.getTransformNodeByName(VR_WORLD_SHIFT_ROOT_NAME);
  if (vr && !vr.isDisposed()) return vr;
  const ar = scene.getTransformNodeByName(AR_MODEL_SPACE_NAME);
  if (ar && !ar.isDisposed()) return ar;
  return null;
}

/** Live world-space point (e.g. a pick) -> the model-space point that should be saved. */
export function toModelSpace(scene: Scene, world: Vector3): Vector3 {
  const node = getModelSpaceNode(scene);
  if (!node) return world.clone();
  const inv = Matrix.Invert(node.computeWorldMatrix(true));
  return Vector3.TransformCoordinates(world, inv);
}

/** Saved model-space point -> where it currently is in the live world. */
export function fromModelSpace(scene: Scene, point: { x: number; y: number; z: number }): Vector3 {
  const p = new Vector3(point.x, point.y, point.z);
  const node = getModelSpaceNode(scene);
  if (!node) return p;
  return Vector3.TransformCoordinates(p, node.computeWorldMatrix(true));
}

/**
 * Call right after creating a model-anchored overlay mesh, BEFORE positioning it: while
 * VR/AR has the model moved, the mesh goes under the model-space node, so a saved
 * model-space `position` lands on the right spot (and setAbsolutePosition still works
 * for popups placed from live world coordinates). No-op on the plain desktop view.
 */
export function attachToModelSpace(scene: Scene, mesh: TransformNode): void {
  const node = getModelSpaceNode(scene);
  if (!node) return;
  mesh.parent = node;
  // setAbsolutePosition() on a popup right after this reads the parent's world matrix -
  // make sure it reflects this frame's placement/scale, not last frame's.
  node.computeWorldMatrix(true);
}
