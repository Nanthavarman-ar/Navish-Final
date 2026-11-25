/**
 * Architect's-model floor slice: fades out everything above a level, clips the building at
 * the cut height and draws white section caps on the cut face.
 *
 * Nothing here edits the model's meshes, materials, lights or the rendering pipeline.
 * It only toggles visibility/enabled on meshes, sets scene.clipPlane, and adds its own
 * "__present_" helper meshes - all of which are undone by restore().
 */
import type { AbstractMesh, Scene } from '@babylonjs/core';
import { Color3, Mesh, Plane, StandardMaterial } from '@babylonjs/core';
import { flyTo, getOrbitCamera, levelViewFor, overviewFor } from './cameraFly';
import { PRESENT_PREFIX, type Building } from './sceneModel';

interface Fade { from: number; to: number; start: number; ms: number; hideAtEnd: boolean }

export interface SliceOptions {
  cutHeightRatio: number;
  cutCaps: boolean;
}

export class FloorSlice {
  level: number | null = null;
  onChange: (level: number | null) => void = () => {};

  private fades = new Map<AbstractMesh, Fade>();
  private fadeObserver: ReturnType<Scene['onBeforeRenderObservable']['add']> | null = null;
  private faded = new Set<AbstractMesh>();
  private exteriorHidden = false;
  private caps: Mesh[] = [];
  private capMaterial: StandardMaterial | null = null;
  private cutY = 0;

  constructor(
    private scene: Scene,
    private getBuilding: () => Building,
    private getOptions: () => SliceOptions,
  ) {}

  get levels(): number[] {
    return this.getBuilding().levels.map((l) => l.level);
  }

  homesOnLevel(level: number): number {
    return this.getBuilding().homes.filter((h) => h.level === level).length;
  }

  async sliceTo(level: number): Promise<void> {
    const building = this.getBuilding();
    const entry = building.levels.find((l) => l.level === level);
    if (!entry) return;
    const opts = this.getOptions();

    this.cutY = entry.minY + (entry.maxY - entry.minY) * Math.min(1, Math.max(0.05, opts.cutHeightRatio));
    this.level = level;

    // Everything on a higher level, plus the roof, fades out; everything else is (back) on.
    const shouldHide = new Set<AbstractMesh>(building.roof);
    building.levelOf.forEach((lvl, mesh) => { if (lvl > level) shouldHide.add(mesh); });
    if (this.exteriorHidden) building.exterior.forEach((m) => shouldHide.add(m));

    shouldHide.forEach((m) => { if (!this.faded.has(m)) this.fadeTo(m, false); });
    [...this.faded].forEach((m) => { if (!shouldHide.has(m)) this.fadeTo(m, true); });

    this.scene.clipPlane = new Plane(0, 1, 0, -this.cutY);
    this.rebuildCaps(entry.meshes.concat(building.exterior));
    this.onChange(level);

    const cam = getOrbitCamera(this.scene);
    await flyTo(this.scene, levelViewFor(entry.center, entry.size, this.cutY, cam));
  }

  async restore(): Promise<void> {
    const building = this.getBuilding();
    this.level = null;
    this.scene.clipPlane = null;
    this.disposeCaps();
    [...this.faded].forEach((m) => {
      if (this.exteriorHidden && building.exterior.includes(m)) return;
      this.fadeTo(m, true);
    });
    this.onChange(null);
    const cam = getOrbitCamera(this.scene);
    await flyTo(this.scene, overviewFor(building.center, building.size, cam));
  }

  /** "Interior" view hides facade/site meshes so you can look into the homes. */
  setExteriorHidden(hidden: boolean): void {
    this.exteriorHidden = hidden;
    const building = this.getBuilding();
    building.exterior.forEach((m) => {
      this.fadeTo(m, !hidden);
    });
  }

  dispose(): void {
    this.scene.clipPlane = null;
    this.disposeCaps();
    this.fades.forEach((_f, m) => { m.visibility = 1; });
    this.faded.forEach((m) => { if (!m.isDisposed()) { m.setEnabled(true); m.visibility = 1; } });
    this.fades.clear();
    this.faded.clear();
    if (this.fadeObserver) this.scene.onBeforeRenderObservable.remove(this.fadeObserver);
    this.fadeObserver = null;
    this.capMaterial?.dispose();
    this.capMaterial = null;
  }

  // ---------------------------------------------------------------- fades

  private fadeTo(mesh: AbstractMesh, visible: boolean, ms = 450): void {
    if (mesh.isDisposed()) return;
    if (visible) {
      if (!this.faded.has(mesh) && mesh.isEnabled()) return;
      if (!mesh.isEnabled()) { mesh.visibility = 0; mesh.setEnabled(true); }
      this.faded.delete(mesh);
      this.fades.set(mesh, { from: mesh.visibility, to: 1, start: performance.now(), ms, hideAtEnd: false });
    } else {
      if (this.faded.has(mesh) || !mesh.isEnabled()) return; // already hidden (by us or by the model)
      this.faded.add(mesh);
      this.fades.set(mesh, { from: mesh.visibility, to: 0, start: performance.now(), ms, hideAtEnd: true });
    }
    this.ensureFadeLoop();
  }

  private ensureFadeLoop(): void {
    if (this.fadeObserver) return;
    this.fadeObserver = this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      this.fades.forEach((f, mesh) => {
        if (mesh.isDisposed()) { this.fades.delete(mesh); return; }
        const t = Math.min(1, (now - f.start) / f.ms);
        mesh.visibility = f.from + (f.to - f.from) * t;
        if (t >= 1) {
          this.fades.delete(mesh);
          if (f.hideAtEnd) { mesh.setEnabled(false); mesh.visibility = 1; }
        }
      });
      if (!this.fades.size && this.fadeObserver) {
        this.scene.onBeforeRenderObservable.remove(this.fadeObserver);
        this.fadeObserver = null;
      }
    });
  }

  // ----------------------------------------------------------------- caps

  /**
   * White "section" caps. With the clip plane active, the inside (back faces) of every solid
   * the plane cuts through becomes visible. Drawing a white, unlit copy of those meshes
   * that renders ONLY back faces fills the cut with solid white, like a cut architectural
   * model, without touching the original materials.
   */
  private rebuildCaps(candidates: AbstractMesh[]): void {
    this.disposeCaps();
    if (!this.getOptions().cutCaps) return;
    if (!this.capMaterial) {
      const mat = new StandardMaterial(`${PRESENT_PREFIX}capMat`, this.scene);
      mat.emissiveColor = new Color3(0.97, 0.97, 0.96);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      mat.fogEnabled = false;
      mat.backFaceCulling = true;
      mat.cullBackFaces = false; // cull FRONT faces instead -> only the inside surface is drawn
      this.capMaterial = mat;
    }
    const seen = new Set<AbstractMesh>();
    for (const mesh of candidates) {
      if (seen.has(mesh)) continue;
      seen.add(mesh);
      if (!(mesh instanceof Mesh) || !mesh.isEnabled() || mesh.getTotalVertices() === 0) continue;
      const b = mesh.getBoundingInfo().boundingBox;
      if (b.minimumWorld.y > this.cutY || b.maximumWorld.y < this.cutY) continue;
      const cap = mesh.clone(`${PRESENT_PREFIX}cap_${mesh.name}`, mesh.parent, true);
      if (!cap) continue;
      cap.material = this.capMaterial;
      cap.isPickable = false;
      cap.checkCollisions = false;
      cap.receiveShadows = false;
      cap.visibility = 1;
      cap.setEnabled(true);
      this.caps.push(cap);
    }
  }

  private disposeCaps(): void {
    this.caps.forEach((c) => { if (!c.isDisposed()) c.dispose(false, false); });
    this.caps = [];
  }
}
