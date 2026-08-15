// Mock Babylon.js core classes for testing
export class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "z", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.x = x;
        this.y = y;
        this.z = z;
    }
    static Zero() {
        return new Vector3(0, 0, 0);
    }
    static One() {
        return new Vector3(1, 1, 1);
    }
    static Up() {
        return new Vector3(0, 1, 0);
    }
    static Forward() {
        return new Vector3(0, 0, 1);
    }
    static Right() {
        return new Vector3(1, 0, 0);
    }
    add(other) {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    subtract(other) {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    multiply(other) {
        if (typeof other === 'number') {
            return new Vector3(this.x * other, this.y * other, this.z * other);
        }
        return new Vector3(this.x * other.x, this.y * other.y, this.z * other.z);
    }
    divide(other) {
        if (typeof other === 'number') {
            return new Vector3(this.x / other, this.y / other, this.z / other);
        }
        return new Vector3(this.x / other.x, this.y / other.y, this.z / other.z);
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    normalize() {
        const len = this.length();
        if (len === 0)
            return new Vector3(0, 0, 0);
        return new Vector3(this.x / len, this.y / len, this.z / len);
    }
    toString() {
        return `Vector3(${this.x}, ${this.y}, ${this.z})`;
    }
}
export class Color3 {
    constructor(r = 0, g = 0, b = 0) {
        Object.defineProperty(this, "r", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "g", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "b", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.r = r;
        this.g = g;
        this.b = b;
    }
    static White() {
        return new Color3(1, 1, 1);
    }
    static Black() {
        return new Color3(0, 0, 0);
    }
    static Red() {
        return new Color3(1, 0, 0);
    }
    static Green() {
        return new Color3(0, 1, 0);
    }
    static Blue() {
        return new Color3(0, 0, 1);
    }
}
export class Color4 extends Color3 {
    constructor(r = 0, g = 0, b = 0, a = 1) {
        super(r, g, b);
        Object.defineProperty(this, "a", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.a = a;
    }
}
export class Engine {
    constructor(canvas, antialias = false) {
        // Mock engine initialization
    }
    runRenderLoop(renderFunction) {
        // Mock render loop
    }
    resize() {
        // Mock resize
    }
    dispose() {
        // Mock dispose
    }
}
export class Scene {
    constructor(engine) {
        Object.defineProperty(this, "onBeforeRenderObservable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Mock scene initialization
        this.onBeforeRenderObservable = {
            add: jest.fn(),
            remove: jest.fn()
        };
    }
    render() {
        // Mock render
    }
    dispose() {
        // Mock dispose
    }
}
export class ArcRotateCamera {
    constructor(name, alpha, beta, radius, target, scene) {
        // Mock camera initialization
    }
    attachControl(canvas, noPreventDefault) {
        // Mock attach control
    }
}
export class UniversalCamera {
    constructor(name, position, scene) {
        // Mock camera initialization
    }
    attachControl(canvas, noPreventDefault) {
        // Mock attach control
    }
}
export class HemisphericLight {
    constructor(name, direction, scene) {
        Object.defineProperty(this, "intensity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.intensity = 1.0;
        // Mock light initialization
    }
}
export class DirectionalLight {
    constructor(name, direction, scene) {
        // Mock light initialization
    }
}
export class AbstractMesh {
    constructor(name, scene) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "position", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scaling", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "material", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
        this.position = Vector3.Zero();
        this.rotation = Vector3.Zero();
        this.scaling = Vector3.One();
        this.material = null;
    }
}
export class Mesh extends AbstractMesh {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "_isEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
    }
    static CreateGround(name, width, height, subdivisions) {
        const mesh = new Mesh(name, null);
        return mesh;
    }
    static CreateBox(name, size, scene) {
        const mesh = new Mesh(name, scene);
        return mesh;
    }
    static CreateSphere(name, segments, diameter, scene) {
        const mesh = new Mesh(name, scene);
        return mesh;
    }
    setEnabled(enabled) {
        this._isEnabled = enabled;
    }
    get isEnabled() {
        return this._isEnabled;
    }
}
export class Material {
    constructor(id, scene) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.id = id;
        this.name = id;
    }
}
export class StandardMaterial extends Material {
    constructor(name, scene) {
        super(name, scene);
        Object.defineProperty(this, "diffuseColor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.diffuseColor = Color3.White();
    }
}
export class PBRMaterial extends Material {
    constructor(name, scene) {
        super(name, scene);
    }
}
export class DynamicTexture {
    constructor(name, options, scene, generateMipMaps = false) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "width", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "height", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "generateMipMaps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
        this.width = typeof options === 'number' ? options : options.width;
        this.height = typeof options === 'number' ? options : options.height;
        this.scene = scene;
        this.generateMipMaps = generateMipMaps;
    }
    update() {
        // Mock update method
    }
    dispose() {
        // Mock dispose method
    }
}
export class ShadowGenerator {
    constructor(size, light) {
        // Mock shadow generator
    }
}
export class DefaultRenderingPipeline {
    constructor(name, hdr, scene, cameras) {
        Object.defineProperty(this, "bloomEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bloomThreshold", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bloomWeight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bloomKernel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "bloomScale", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "depthOfFieldEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "depthOfField", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "grainEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "grain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "imageProcessing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
    constructor(name, scene, options) {
        Object.defineProperty(this, "totalStrength", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "base", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "radius", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "area", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fallOff", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.totalStrength = 1.0;
        this.base = 0.5;
        this.radius = 0.0001;
        this.area = 0.0075;
        this.fallOff = 0.000001;
    }
}
export class SceneOptimizer {
    static OptimizeAsync(scene, options) {
        return Promise.resolve({ success: true });
    }
}
export class SceneOptimizerOptions {
    constructor() {
        // Mock options
    }
}
export class HardwareScalingOptimization {
    constructor(priority = 0, maximumScale = 1) {
        // Mock optimization
    }
}
export class ShadowsOptimization {
    constructor(priority = 0) {
        // Mock optimization
    }
}
export class PostProcessesOptimization {
    constructor(priority = 0) {
        // Mock optimization
    }
}
export class LensFlaresOptimization {
    constructor(priority = 0) {
        // Mock optimization
    }
}
export class ParticlesOptimization {
    constructor(priority = 0) {
        // Mock optimization
    }
}
export class RenderTargetsOptimization {
    constructor(priority = 0) {
        // Mock optimization
    }
}
export class MergeMeshesOptimization {
    constructor(priority = 0) {
        // Mock optimization
    }
}
export class GizmoManager {
    constructor(scene) {
        // Mock gizmo manager
    }
}
export class UtilityLayerRenderer {
    constructor(scene) {
        // Mock utility layer renderer
    }
}
export class PickingInfo {
    constructor() {
        Object.defineProperty(this, "hit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "distance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pickedMesh", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pickedPoint", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.hit = false;
        this.distance = 0;
        this.pickedMesh = null;
        this.pickedPoint = null;
    }
}
export class AssetContainer {
    constructor(scene) {
        // Mock asset container
    }
}
export class SceneLoader {
    static ImportMeshAsync(meshNames, rootUrl, sceneFilename, scene, onProgress) {
        return Promise.resolve({
            meshes: [],
            particleSystems: [],
            skeletons: [],
            animationGroups: []
        });
    }
}
export class ActionManager {
    constructor(scene) {
        // Mock action manager
    }
}
export class HighlightLayer {
    constructor(name, scene) {
        // Mock highlight layer
    }
}
export class Plane {
    constructor(x, y, z, d) {
        // Mock plane
    }
}
export class PhysicsImpostor {
    constructor(object, type, options, scene) {
        // Mock physics impostor
    }
}
export class CannonJSPlugin {
    constructor(iterations = 10) {
        // Mock physics plugin
    }
}
export class AmmoJSPlugin {
    constructor() {
        // Mock physics plugin
    }
}
export class OimoJSPlugin {
    constructor(iterations = 10) {
        // Mock physics plugin
    }
}
export class QuadraticEase {
    constructor() {
        // Mock quadratic ease
    }
    setEasingMode(mode) {
        // Mock set easing mode
    }
}
export class EasingFunction {
}
Object.defineProperty(EasingFunction, "EASINGMODE_EASEINOUT", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0
});
Object.defineProperty(EasingFunction, "EASINGMODE_EASEIN", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1
});
Object.defineProperty(EasingFunction, "EASINGMODE_EASEOUT", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2
});
export class CubicEase {
    constructor() {
        // Mock cubic ease
    }
    setEasingMode(mode) {
        // Mock set easing mode
    }
}
export class BounceEase {
    constructor() {
        // Mock bounce ease
    }
    setEasingMode(mode) {
        // Mock set easing mode
    }
}
export class ElasticEase {
    constructor() {
        // Mock elastic ease
    }
    setEasingMode(mode) {
        // Mock set easing mode
    }
}
export class SineEase {
    constructor() {
        // Mock sine ease
    }
    setEasingMode(mode) {
        // Mock set easing mode
    }
}
// Export other classes that might be needed
export const Tools = {
    ToRadians: (degrees) => degrees * Math.PI / 180,
    ToDegrees: (radians) => radians * 180 / Math.PI
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
