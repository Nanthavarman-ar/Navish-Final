import type { Scene } from '@babylonjs/core';
import { ArcRotateCamera, Vector3 } from '@babylonjs/core';

export interface ViewTarget {
  target: Vector3;
  radius: number;
  alpha?: number;
  beta?: number;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shortest way round for angles, so the camera never spins 300 degrees to reach a nearby heading. */
function nearestAngle(from: number, to: number): number {
  const tau = Math.PI * 2;
  return from + ((((to - from) % tau) + tau + Math.PI) % tau) - Math.PI;
}

let activeFlight: { stop: () => void } | null = null;

export function getOrbitCamera(scene: Scene): ArcRotateCamera | null {
  const cam = scene.activeCamera;
  return cam instanceof ArcRotateCamera ? cam : null;
}

/** Smoothly flies an orbit camera. Does nothing (resolves immediately) for other camera types. */
export function flyTo(scene: Scene, view: ViewTarget, ms = 900): Promise<void> {
  const cam = getOrbitCamera(scene);
  if (!cam) return Promise.resolve();
  activeFlight?.stop();

  const from = { target: cam.target.clone(), radius: cam.radius, alpha: cam.alpha, beta: cam.beta };
  const to = {
    target: view.target,
    radius: view.radius,
    alpha: view.alpha === undefined ? cam.alpha : nearestAngle(cam.alpha, view.alpha),
    beta: view.beta === undefined ? cam.beta : view.beta,
  };

  return new Promise<void>((resolve) => {
    const start = performance.now();
    const savedInertia = cam.inertia;
    cam.inertia = 0;
    cam.inertialAlphaOffset = 0;
    cam.inertialBetaOffset = 0;
    cam.inertialRadiusOffset = 0;

    const finish = () => {
      scene.onBeforeRenderObservable.remove(observer);
      cam.inertia = savedInertia;
      if (activeFlight === handle) activeFlight = null;
      resolve();
    };
    const handle = { stop: () => finish() };
    activeFlight = handle;

    const observer = scene.onBeforeRenderObservable.add(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const k = easeInOutCubic(t);
      cam.target = Vector3.Lerp(from.target, to.target, k);
      cam.radius = from.radius + (to.radius - from.radius) * k;
      cam.alpha = from.alpha + (to.alpha - from.alpha) * k;
      cam.beta = from.beta + (to.beta - from.beta) * k;
      if (t >= 1) finish();
    });
  });
}

/** Opening view that frames a whole building (also used by "Reset view"). */
export function overviewFor(center: Vector3, size: Vector3, camera?: ArcRotateCamera | null): ViewTarget {
  const diag = Math.max(size.length(), 1);
  const fov = camera?.fov ?? 0.8;
  return {
    target: center.clone(),
    radius: (diag * 0.55) / Math.tan(fov / 2),
    alpha: -Math.PI / 4,
    beta: Math.PI / 2.6,
  };
}

/** View for looking down into a sliced level. */
export function levelViewFor(center: Vector3, size: Vector3, cutY: number, camera?: ArcRotateCamera | null): ViewTarget {
  const span = Math.max(size.x, size.z, 1);
  const fov = camera?.fov ?? 0.8;
  return {
    target: new Vector3(center.x, cutY, center.z),
    radius: (span * 0.62) / Math.tan(fov / 2),
    beta: Math.PI / 4.2,
  };
}
