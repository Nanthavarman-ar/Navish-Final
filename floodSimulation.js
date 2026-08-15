// Flood Simulation for Babylon.js workspace
class FloodSimulation {
  constructor(scene, terrainMesh = null) {
    this.scene = scene;
    this.terrainMesh = terrainMesh;
    this.floodLevel = 0;
    this.waterMesh = null;
    this.onFloodLevelChange = null;

    this.init();
  }

  init() {
    // Create water mesh as a plane above terrain
    this.waterMesh = BABYLON.MeshBuilder.CreateGround('waterPlane', {
      width: 200,
      height: 200,
      subdivisions: 1
    }, this.scene);

    const waterMaterial = new BABYLON.StandardMaterial('waterMaterial', this.scene);
    waterMaterial.diffuseColor = new BABYLON.Color3(0.0, 0.3, 0.6);
    waterMaterial.alpha = 0.5;
    this.waterMesh.material = waterMaterial;

    this.waterMesh.position.y = this.floodLevel;
  }

  setFloodLevel(level) {
    this.floodLevel = level;
    if (this.waterMesh) {
      this.waterMesh.position.y = this.floodLevel;
    }
    if (this.onFloodLevelChange) {
      this.onFloodLevelChange(this.floodLevel);
    }
  }

  setOnFloodLevelChange(callback) {
    this.onFloodLevelChange = callback;
  }

  dispose() {
    if (this.waterMesh) {
      this.waterMesh.dispose();
      this.waterMesh = null;
    }
  }
}

// Global flood simulation instance
let floodSimulation = null;

// Exported functions for use in workspace.html
function initFloodSimulation(scene, terrainMesh = null) {
  floodSimulation = new FloodSimulation(scene, terrainMesh);
}

function setFloodLevel(level) {
  if (floodSimulation) {
    floodSimulation.setFloodLevel(level);
  }
}

function disposeFloodSimulation() {
  if (floodSimulation) {
    floodSimulation.dispose();
    floodSimulation = null;
  }
}

// Make functions globally available
window.initFloodSimulation = initFloodSimulation;
window.setFloodLevel = setFloodLevel;
window.disposeFloodSimulation = disposeFloodSimulation;
