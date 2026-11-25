/**
 * 360 room viewer built on Babylon's PhotoDome.
 *
 * - Domes and the look-around camera live on their own layer (PANO_MASK), so the building
 *   and its lighting/post-processing are never touched; they are simply not drawn by the
 *   pano camera.
 * - Desktop/mobile: a dedicated FreeCamera (drag / touch to look).
 * - WebXR: the headset camera is switched to the pano layer for the visit and restored on exit.
 * - Time of day: up to 4 images per room (morning, day, sunset, night). Only the ones that
 *   exist are used; the slider crossfades between neighbours.
 * - Images are loaded lazily, one room at a time, and disposed on exit.
 */
import type { Camera, Scene, Texture as TextureT } from '@babylonjs/core';
import { FreeCamera, PhotoDome, Texture, Vector3 } from '@babylonjs/core';
import { TIMES_OF_DAY, panoramaUrl, type TimeOfDay } from '../data/homesData';

export const PANO_MASK = 0x10000000;

export interface RoomAvailability {
  times: TimeOfDay[];
  urls: Partial<Record<TimeOfDay, string>>;
}

const probeCache = new Map<string, Promise<string | null>>();

/** Dev servers and SPA hosts answer 200 + index.html for missing files, so check the content type. */
function probeImage(url: string): Promise<string | null> {
  let hit = probeCache.get(url);
  if (!hit) {
    hit = fetch(url, { method: 'HEAD' })
      .then((r) => (r.ok && (r.headers.get('content-type') || '').startsWith('image/') ? url : null))
      .catch(() => null);
    probeCache.set(url, hit);
  }
  return hit;
}

const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches;

export async function findRoomImages(projectId: string | undefined, homeId: string, room: string): Promise<RoomAvailability> {
  const urls: Partial<Record<TimeOfDay, string>> = {};
  await Promise.all(
    TIMES_OF_DAY.map(async (time) => {
      // Phones try a lighter "_m" file (e.g. 2048x1024) first, then the full-size image.
      const candidates = isSmallScreen()
        ? [panoramaUrl(projectId, homeId, room, time, '_m'), panoramaUrl(projectId, homeId, room, time)]
        : [panoramaUrl(projectId, homeId, room, time)];
      for (const c of candidates) {
        const ok = await probeImage(c);
        if (ok) { urls[time] = ok; return; }
      }
    }),
  );
  return { times: TIMES_OF_DAY.filter((t) => urls[t]), urls };
}

export class PanoViewer {
  private domeA: PhotoDome | null = null;
  private domeB: PhotoDome | null = null;
  private camera: FreeCamera | null = null;
  private previousCamera: Camera | null = null;
  private xrCamera: Camera | null = null;
  private xrPreviousMask = 0;
  private textures = new Map<string, TextureT>();
  private room: RoomAvailability = { times: [], urls: {} };
  active = false;

  constructor(private scene: Scene) {}

  get availableTimes(): TimeOfDay[] { return this.room.times; }
  get lookCamera(): Camera | null { return this.camera || this.xrCamera; }

  enter(): void {
    if (this.active) return;
    this.active = true;
    const scene = this.scene;
    this.previousCamera = scene.activeCamera;
    const isXR = this.previousCamera?.getClassName?.() === 'WebXRCamera';

    if (isXR && this.previousCamera) {
      this.xrCamera = this.previousCamera;
      this.xrPreviousMask = this.previousCamera.layerMask;
      this.previousCamera.layerMask = PANO_MASK;
    } else {
      const cam = new FreeCamera('__present_panoCam', Vector3.Zero(), scene);
      cam.layerMask = PANO_MASK;
      cam.fov = 1.15;
      cam.minZ = 0.1;
      cam.maxZ = 5000;
      cam.speed = 0;
      cam.inertia = 0.75;
      cam.angularSensibility = 2600;
      cam.inputs.removeByType('FreeCameraKeyboardMoveInput');
      cam.setTarget(new Vector3(0, 0, 1));
      const canvas = scene.getEngine().getRenderingCanvas();
      if (canvas) cam.attachControl(canvas, true);
      scene.activeCamera = cam;
      this.camera = cam;
    }

    this.domeA = this.makeDome('__present_panoA', 1000);
    this.domeB = this.makeDome('__present_panoB', 990);
    this.domeB.mesh.visibility = 0;
  }

  /** Loads a room and shows its first available time (prefers "day"). Returns what exists. */
  async showRoom(projectId: string | undefined, homeId: string, room: string): Promise<RoomAvailability> {
    const found = await findRoomImages(projectId, homeId, room);
    if (!this.active) return found;
    this.room = found;
    this.disposeTextures();
    if (this.camera) this.camera.setTarget(new Vector3(0, 0, 1));
    const hasImages = found.times.length > 0;
    this.domeA?.mesh.setEnabled(hasImages);
    this.domeB?.mesh.setEnabled(hasImages);
    if (hasImages) this.setTime(Math.max(0, found.times.indexOf('day')));
    return found;
  }

  /** value is an index into availableTimes; fractions crossfade between two neighbours. */
  setTime(value: number): void {
    const times = this.room.times;
    if (!this.domeA || !this.domeB || !times.length) return;
    const v = Math.min(times.length - 1, Math.max(0, value));
    const i0 = Math.floor(v);
    const i1 = Math.min(times.length - 1, i0 + 1);
    const f = v - i0;
    this.domeA.texture = this.textureFor(times[i0]);
    this.domeB.texture = this.textureFor(times[i1]);
    this.domeB.mesh.visibility = i1 === i0 ? 0 : f;
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    const scene = this.scene;
    this.domeA?.dispose();
    this.domeB?.dispose();
    this.domeA = this.domeB = null;
    this.disposeTextures();
    if (this.camera) {
      this.camera.detachControl();
      scene.activeCamera = this.previousCamera;
      this.camera.dispose();
      this.camera = null;
    }
    if (this.xrCamera) {
      this.xrCamera.layerMask = this.xrPreviousMask;
      this.xrCamera = null;
    }
    this.previousCamera = null;
  }

  // ---------------------------------------------------------------- internals

  private makeDome(name: string, size: number): PhotoDome {
    // PhotoDome needs *a* texture URL up front; 1x1 transparent PNG until the real one is set.
    const blank = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const dome = new PhotoDome(name, blank, { resolution: 48, size, useDirectMapping: false, faceForward: true }, this.scene);
    dome.mesh.layerMask = PANO_MASK;
    dome.mesh.isPickable = false;
    return dome;
  }

  private textureFor(time: TimeOfDay): TextureT {
    const url = this.room.urls[time]!;
    let tex = this.textures.get(url);
    if (!tex) {
      tex = new Texture(url, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
      this.textures.set(url, tex);
    }
    return tex;
  }

  private disposeTextures(): void {
    // The domes still reference the old textures until setTime() runs again, so swap them out first.
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
  }
}
