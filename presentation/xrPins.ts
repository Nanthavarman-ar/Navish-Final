/**
 * VR support for pins: numbered 3D pin discs (only shown while a WebXR headset camera is
 * active) and a floating 3D info panel. Selection uses the same pointer events Babylon's
 * XR controller ray (pointer selection) already raises, so it works with controllers, hands
 * and mouse alike.
 */
import type { Mesh as MeshT, Observer, PointerInfo, Scene } from '@babylonjs/core';
import { Color3, DynamicTexture, Mesh, MeshBuilder, PointerEventTypes, StandardMaterial, Vector3 } from '@babylonjs/core';
import { PRESENT_PREFIX, type Building } from './sceneModel';
import { formatArea, statusLabel, type Home } from '../data/homesData';

const PIN_KEY = 'presentHomeId';

export class XRPins {
  private pins: MeshT[] = [];
  private panel: MeshT | null = null;
  private observers: Observer<any>[] = [];
  private inXR = false;
  private disposed = false;

  constructor(
    private scene: Scene,
    private building: Building,
    private homeById: (id: string) => Home | undefined,
    private getUnit: () => 'm2' | 'ft2',
    private accent: string,
  ) {
    this.build();
    this.observers.push(
      scene.onBeforeRenderObservable.add(() => this.syncXRState()),
      scene.onPointerObservable.add((info: PointerInfo) => this.onPointer(info)),
    );
  }

  setVisibleLevel(maxLevel: number | null): void {
    this.pins.forEach((p) => {
      const home = this.building.homes.find((h) => h.id === p.metadata?.[PIN_KEY]);
      p.setEnabled(this.inXR && (maxLevel === null || !home || home.level <= maxLevel));
    });
  }

  dispose(): void {
    this.disposed = true;
    this.observers.forEach((o) => {
      this.scene.onBeforeRenderObservable.remove(o);
      this.scene.onPointerObservable.remove(o);
    });
    this.pins.forEach((p) => p.material?.dispose(true, true));
    this.pins.forEach((p) => p.dispose());
    this.closePanel();
    this.pins = [];
  }

  // ----------------------------------------------------------------------

  private build(): void {
    const diag = Math.max(this.building.size.length(), 1);
    const pinSize = diag * 0.035;
    const accent = Color3.FromHexString(/^#[0-9a-f]{6}$/i.test(this.accent) ? this.accent : '#ff4d4f');
    this.building.homes.forEach((home, index) => {
      const pin = MeshBuilder.CreateDisc(`${PRESENT_PREFIX}pin_${home.id}`, { radius: pinSize / 2, tessellation: 32 }, this.scene);
      pin.billboardMode = Mesh.BILLBOARDMODE_ALL;
      pin.position = home.top.add(new Vector3(0, pinSize * 0.8, 0));
      pin.isPickable = true;
      pin.metadata = { [PIN_KEY]: home.id };
      pin.renderingGroupId = 1; // always on top of the building
      pin.setEnabled(false);

      const tex = new DynamicTexture(`${PRESENT_PREFIX}pinTex_${home.id}`, { width: 128, height: 128 }, this.scene, true);
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      ctx.fillStyle = this.accent;
      ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), 64, 68);
      tex.hasAlpha = true;
      tex.update();

      const mat = new StandardMaterial(`${PRESENT_PREFIX}pinMat_${home.id}`, this.scene);
      mat.diffuseTexture = tex;
      mat.emissiveColor = accent.scale(0.2).add(new Color3(0.6, 0.6, 0.6));
      mat.disableLighting = true;
      mat.useAlphaFromDiffuseTexture = true;
      mat.backFaceCulling = false;
      pin.material = mat;
      this.pins.push(pin);
    });
  }

  private syncXRState(): void {
    const inXR = this.scene.activeCamera?.getClassName?.() === 'WebXRCamera';
    if (inXR === this.inXR) return;
    this.inXR = inXR;
    this.pins.forEach((p) => p.setEnabled(inXR));
    if (!inXR) this.closePanel();
  }

  private onPointer(info: PointerInfo): void {
    if (this.disposed || !this.inXR) return;
    if (info.type !== PointerEventTypes.POINTERPICK && info.type !== PointerEventTypes.POINTERTAP) return;
    const picked = info.pickInfo?.pickedMesh;
    if (!picked) { this.closePanel(); return; }
    if (picked.name === `${PRESENT_PREFIX}infoPanel`) { this.closePanel(); return; }
    const id = picked.metadata?.[PIN_KEY];
    if (typeof id === 'string') this.openPanel(id);
  }

  private openPanel(homeId: string): void {
    this.closePanel();
    const entry = this.building.homes.find((h) => h.id === homeId);
    const home = this.homeById(homeId);
    if (!entry) return;
    const diag = Math.max(this.building.size.length(), 1);
    const width = diag * 0.16;
    const height = width * 0.6;

    const plane = MeshBuilder.CreatePlane(`${PRESENT_PREFIX}infoPanel`, { width, height }, this.scene);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.position = entry.top.add(new Vector3(0, diag * 0.1, 0));
    plane.renderingGroupId = 1;
    plane.isPickable = true;

    const tex = new DynamicTexture(`${PRESENT_PREFIX}infoTex`, { width: 1024, height: 614 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = 'rgba(18,20,24,0.88)';
    ctx.fillRect(0, 0, 1024, 614);
    ctx.fillStyle = this.accent;
    ctx.fillRect(0, 0, 14, 614);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.font = '600 64px sans-serif';
    ctx.fillText(home?.name || homeId, 56, 48);
    ctx.font = '40px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const lines = [
      `Level ${entry.level}`,
      `Area: ${formatArea(home?.areaM2 ?? 0, this.getUnit())}`,
      `Status: ${statusLabel(home?.status ?? 'available')}`,
    ];
    if (home?.bedrooms) lines.push(`${home.bedrooms} bedrooms`);
    lines.forEach((line, i) => ctx.fillText(line, 56, 160 + i * 62));
    ctx.font = '30px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Point at this panel and press to close', 56, 540);
    tex.hasAlpha = true;
    tex.update();

    const mat = new StandardMaterial(`${PRESENT_PREFIX}infoMat`, this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.disableLighting = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    plane.material = mat;
    this.panel = plane;
  }

  private closePanel(): void {
    if (!this.panel) return;
    const mat = this.panel.material as StandardMaterial | null;
    mat?.diffuseTexture?.dispose();
    mat?.dispose();
    this.panel.dispose();
    this.panel = null;
  }
}
