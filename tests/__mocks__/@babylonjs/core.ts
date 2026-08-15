// Mock Babylon.js core classes for testing
export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static Zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static One(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  static Up(): Vector3 {
    return new Vector3(0, 1, 0);
  }

  static Forward(): Vector3 {
    return new Vector3(0, 0, 1);
  }

  static Right(): Vector3 {
    return new Vector3(1, 0, 0);
  }

  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  multiply(other: Vector3 | number): Vector3 {
    if (typeof other === 'number') {
      return new Vector3(this.x * other, this.y * other, this.z * other);
    }
    return new Vector3(this.x * other.x, this.y * other.y, this.z * other.z);
  }

  divide(other: Vector3 | number): Vector3 {
    if (typeof other === 'number') {
      return new Vector3(this.x / other, this.y / other, this.z / other);
    }
    return new Vector3(this.x / other.x, this.y / other.y, this.z / other.z);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) return new Vector3(0, 0, 0);
    return new Vector3(this.x / len, this.y / len, this.z / len);
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }
}

export class Color3 {
  r: number;
  g: number;
  b: number;

  constructor(r: number = 0, g: number = 0, b: number = 0) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  static White(): Color3 {
    return new Color3(1, 1, 1);
  }

  static Black(): Color3 {
    return new Color3(0, 0, 0);
  }

  static Red(): Color3 {
    return new Color3(1, 0, 0);
  }

  static Green(): Color3 {
    return new Color3(0, 1, 0);
  }

  static Blue(): Color3 {
    return new Color3(0, 0, 1);
  }
}

export class Color4 extends Color3 {
  a: number;

  constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 1) {
    super(r, g, b);
    this.a = a;
  }
}

export class Engine {
  constructor(canvas: HTMLCanvasElement, antialias: boolean = false) {
    // Mock engine initialization
  }

  runRenderLoop(renderFunction: () => void): void {
    // Mock render loop
  }

  resize(): void {
    // Mock resize
  }

  dispose(): void {
    // Mock dispose
  }
}

export class Scene {
  onBeforeRenderObservable: any;

  constructor(engine: Engine) {
    // Mock scene initialization
    this.onBeforeRenderObservable = {
      add: jest.fn(),
      remove: jest.fn()
    };
  }

  render(): void {
    // Mock render
  }

  dispose(): void {
    // Mock dispose
  }
}

export class ArcRotateCamera {
  constructor(name: string, alpha: number, beta: number, radius: number, target: Vector3, scene: Scene) {
    // Mock camera initialization
  }

  attachControl(canvas: HTMLCanvasElement, noPreventDefault: boolean): void {
    // Mock attach control
  }
}

export class UniversalCamera {
  constructor(name: string, position: Vector3, scene: Scene) {
    // Mock camera initialization
  }

  attachControl(canvas: HTMLCanvasElement, noPreventDefault: boolean): void {
    // Mock attach control
  }
}

export class HemisphericLight {
  intensity: number;

  constructor(name: string, direction: Vector3, scene: Scene) {
    this.intensity = 1.0;
    // Mock light initialization
  }
}

export class DirectionalLight {
  constructor(name: string, direction: Vector3, scene: Scene) {
    // Mock light initialization
  }
}

export class AbstractMesh {
  name: string;
  position: Vector3;
  rotation: Vector3;
  scaling: Vector3;
  material: any;

  constructor(name: string, scene: Scene) {
    this.name = name;
    this.position = Vector3.Zero();
    this.rotation = Vector3.Zero();
    this.scaling = Vector3.One();
    this.material = null;
  }
}

export class Mesh extends AbstractMesh {
  private _isEnabled: boolean = true;

  static CreateGround(name: string, width: number, height: number, subdivisions: number): Mesh {
    const mesh = new Mesh(name, null as any);
    return mesh;
  }

  static CreateBox(name: string, size: number, scene: Scene): Mesh {
    const mesh = new Mesh(name, scene);
    return mesh;
  }

  static CreateSphere(name: string, segments: number, diameter: number, scene: Scene): Mesh {
    const mesh = new Mesh(name, scene);
    return mesh;
  }

  setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
  }
}

export class Material {
  id: string;
  name: string;

  constructor(id: string, scene: Scene) {
    this.id = id;
    this.name = id;
  }
}

export class StandardMaterial extends Material {
  diffuseColor: Color3;

  constructor(name: string, scene: Scene) {
    super(name, scene);
    this.diffuseColor = Color3.White();
  }
}

export class PBRMaterial extends Material {
  constructor(name: string, scene: Scene) {
    super(name, scene);
  }
}

export class DynamicTexture {
  name: string;
  width: number;
  height: number;
  scene: Scene;
  generateMipMaps: boolean;

  constructor(name: string, options: { width: number; height: number } | number, scene: Scene, generateMipMaps: boolean = false) {
    this.name = name;
    this.width = typeof options === 'number' ? options : options.width;
    this.height = typeof options === 'number' ? options : options.height;
    this.scene = scene;
    this.generateMipMaps = generateMipMaps;
  }

  update(): void {
    // Mock update method
  }

  dispose(): void {
    // Mock dispose method
  }
}

export class ShadowGenerator {
  constructor(size: number, light: any) {
    // Mock shadow generator
  }
}

export class DefaultRenderingPipeline {
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomWeight: number;
  bloomKernel: number;
  bloomScale: number;
  depthOfFieldEnabled: boolean;
  depthOfField: any;
  grainEnabled: boolean;
  grain: any;
  imageProcessing: any;

  constructor(name: string, hdr: boolean, scene: Scene, cameras: any[]) {
    this.bloomEnabled = false;
    this.bloomThreshold = 0.8;
    this.bloomWeight = 1.0;
    this.bloomKernel = 64;
    this.bloomScale = 0.5;
    this.depthOfFieldEnabled = false;
    this.grainEnabled = false;
    this.imageProcessing = {};
  }
}

export class SSAORenderingPipeline {
  totalStrength: number;
  base: number;
  radius: number;
  area: number;
  fallOff: number;

  constructor(name: string, scene: Scene, options: any) {
    this.totalStrength = 1.0;
    this.base = 0.5;
    this.radius = 0.0001;
    this.area = 0.0075;
    this.fallOff = 0.000001;
  }
}

export class SceneOptimizer {
  static OptimizeAsync(scene: Scene, options?: any): Promise<any> {
    return Promise.resolve({ success: true });
  }
}

export class SceneOptimizerOptions {
  constructor() {
    // Mock options
  }
}

export class HardwareScalingOptimization {
  constructor(priority: number = 0, maximumScale: number = 1) {
    // Mock optimization
  }
}

export class ShadowsOptimization {
  constructor(priority: number = 0) {
    // Mock optimization
  }
}

export class PostProcessesOptimization {
  constructor(priority: number = 0) {
    // Mock optimization
  }
}

export class LensFlaresOptimization {
  constructor(priority: number = 0) {
    // Mock optimization
  }
}

export class ParticlesOptimization {
  constructor(priority: number = 0) {
    // Mock optimization
  }
}

export class RenderTargetsOptimization {
  constructor(priority: number = 0) {
    // Mock optimization
  }
}

export class MergeMeshesOptimization {
  constructor(priority: number = 0) {
    // Mock optimization
  }
}

export class GizmoManager {
  constructor(scene: Scene) {
    // Mock gizmo manager
  }
}

export class UtilityLayerRenderer {
  constructor(scene: Scene) {
    // Mock utility layer renderer
  }
}

export class PickingInfo {
  hit: boolean;
  distance: number;
  pickedMesh: AbstractMesh | null;
  pickedPoint: Vector3 | null;

  constructor() {
    this.hit = false;
    this.distance = 0;
    this.pickedMesh = null;
    this.pickedPoint = null;
  }
}

export class AssetContainer {
  constructor(scene: Scene) {
    // Mock asset container
  }
}

export class SceneLoader {
  static ImportMeshAsync(
    meshNames: string | string[] | null,
    rootUrl: string,
    sceneFilename: string,
    scene: Scene,
    onProgress?: (event: any) => void
  ): Promise<any> {
    return Promise.resolve({
      meshes: [],
      particleSystems: [],
      skeletons: [],
      animationGroups: []
    });
  }
}

export class ActionManager {
  constructor(scene: Scene) {
    // Mock action manager
  }
}

export class HighlightLayer {
  constructor(name: string, scene: Scene) {
    // Mock highlight layer
  }
}

export class Plane {
  constructor(x: number, y: number, z: number, d: number) {
    // Mock plane
  }
}

export class PhysicsImpostor {
  constructor(object: any, type: number, options: any, scene: Scene) {
    // Mock physics impostor
  }
}

export class CannonJSPlugin {
  constructor(iterations: number = 10) {
    // Mock physics plugin
  }
}

export class AmmoJSPlugin {
  constructor() {
    // Mock physics plugin
  }
}

export class OimoJSPlugin {
  constructor(iterations: number = 10) {
    // Mock physics plugin
  }
}

export class QuadraticEase {
  constructor() {
    // Mock quadratic ease
  }

  setEasingMode(mode: number): void {
    // Mock set easing mode
  }
}

export class EasingFunction {
  static EASINGMODE_EASEINOUT: number = 0;
  static EASINGMODE_EASEIN: number = 1;
  static EASINGMODE_EASEOUT: number = 2;
}

export class CubicEase {
  constructor() {
    // Mock cubic ease
  }

  setEasingMode(mode: number): void {
    // Mock set easing mode
  }
}

export class BounceEase {
  constructor() {
    // Mock bounce ease
  }

  setEasingMode(mode: number): void {
    // Mock set easing mode
  }
}

export class ElasticEase {
  constructor() {
    // Mock elastic ease
  }

  setEasingMode(mode: number): void {
    // Mock set easing mode
  }
}

export class SineEase {
  constructor() {
    // Mock sine ease
  }

  setEasingMode(mode: number): void {
    // Mock set easing mode
  }
}

// Export other classes that might be needed
export const Tools = {
  ToRadians: (degrees: number) => degrees * Math.PI / 180,
  ToDegrees: (radians: number) => radians * 180 / Math.PI
};

export const Constants = {
  ALPHA_DISABLE: 0,
  ALPHA_ADD: 1,
  ALPHA_COMBINE: 2,
  ALPHA_SUBTRACT: 3,
  ALPHA_MULTIPLY: 4,
  ALPHA_MAXIMIZED: 5,
  ALPHA_ONEONE: 6,
  ALPHA_PREMULTIPLIED: 7,
  ALPHA_PREMULTIPLIED_PORTERDUFF: 8,
  ALPHA_INTERPOLATE: 9,
  ALPHA_SCREENMODE: 10
};

// Default export to match Babylon.js module structure
const BabylonJS = {
  Vector3,
  Color3,
  Color4,
  Engine,
  Scene,
  ArcRotateCamera,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  AbstractMesh,
  Mesh,
  Material,
  StandardMaterial,
  PBRMaterial,
  ShadowGenerator,
  DefaultRenderingPipeline,
  SSAORenderingPipeline,
  SceneOptimizer,
  SceneOptimizerOptions,
  HardwareScalingOptimization,
  ShadowsOptimization,
  PostProcessesOptimization,
  LensFlaresOptimization,
  ParticlesOptimization,
  RenderTargetsOptimization,
  MergeMeshesOptimization,
  GizmoManager,
  UtilityLayerRenderer,
  PickingInfo,
  AssetContainer,
  SceneLoader,
  ActionManager,
  HighlightLayer,
  Plane,
  PhysicsImpostor,
  CannonJSPlugin,
  AmmoJSPlugin,
  OimoJSPlugin,
  Tools,
  Constants
};

export default BabylonJS;
