// Mock Babylon.js HighlightLayer
export class HighlightLayer {
    constructor(name, scene) {
        Object.defineProperty(this, "name", {
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
        Object.defineProperty(this, "innerGlow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "outerGlow", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "highlightedMeshes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.name = name;
        this.scene = scene;
    }
    addMesh(mesh, color) {
        this.highlightedMeshes.push(mesh);
    }
    removeAllMeshes() {
        this.highlightedMeshes = [];
    }
    dispose() {
        this.highlightedMeshes = [];
    }
    setEnabled(enabled) {
        // Mock setEnabled method
    }
}
