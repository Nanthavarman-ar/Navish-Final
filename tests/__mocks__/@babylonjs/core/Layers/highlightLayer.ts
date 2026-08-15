// Mock Babylon.js HighlightLayer
export class HighlightLayer {
  name: string;
  scene: any;
  innerGlow: boolean = false;
  outerGlow: boolean = true;
  private highlightedMeshes: any[] = [];

  constructor(name: string, scene: any) {
    this.name = name;
    this.scene = scene;
  }

  addMesh(mesh: any, color: any): void {
    this.highlightedMeshes.push(mesh);
  }

  removeAllMeshes(): void {
    this.highlightedMeshes = [];
  }

  dispose(): void {
    this.highlightedMeshes = [];
  }

  setEnabled(enabled: boolean): void {
    // Mock setEnabled method
  }
}
