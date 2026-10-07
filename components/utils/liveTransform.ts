import type { AbstractMesh } from '@babylonjs/core';

// Meshes that are animated every frame by a feature (Interactive Fixtures: fan blades,
// doors, elevators, shutters, curtains, trees) must keep a live world matrix. The workspace
// freezes static meshes for performance and RE-freezes a mesh after it's been edited with
// the gizmo, undone, or after VR - which used to silently stop a fan/door the moment you
// clicked something else ("works once, then stops"). Anything that re-freezes meshes
// checks this first.
const KEY = 'navishLiveTransform';

export function markLiveTransform(mesh: AbstractMesh): void {
  mesh.metadata = { ...(mesh.metadata || {}), [KEY]: true };
}

export function isLiveTransform(mesh: AbstractMesh): boolean {
  return !!mesh.metadata?.[KEY];
}
