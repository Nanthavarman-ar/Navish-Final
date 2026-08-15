// BIM Integration for Babylon.js workspace
class BIMIntegration {
  constructor(scene) {
    this.scene = scene;
    this.isActive = false;
    this.models = [];
  }

  activate() {
    this.isActive = true;
    console.log('BIM Integration activated');
    // Add BIM-specific functionality here
  }

  deactivate() {
    this.isActive = false;
    console.log('BIM Integration deactivated');
    // Clean up BIM-specific resources
  }

  loadBIMModel(url) {
    if (!this.isActive) return;

    BABYLON.SceneLoader.ImportMesh("", url, "", this.scene, (meshes) => {
      this.models.push(...meshes);
      console.log(`Loaded BIM model with ${meshes.length} meshes`);
    });
  }

  dispose() {
    this.models.forEach(mesh => mesh.dispose());
    this.models = [];
    this.deactivate();
  }
}

// Global BIM integration instance
let bimIntegration = null;

// Exported functions for use in workspace.html
function initBIMIntegration(scene) {
  bimIntegration = new BIMIntegration(scene);
}

function activateBIM() {
  if (bimIntegration) {
    bimIntegration.activate();
  }
}

function deactivateBIM() {
  if (bimIntegration) {
    bimIntegration.deactivate();
  }
}

function loadBIMModel(url) {
  if (bimIntegration) {
    bimIntegration.loadBIMModel(url);
  }
}

function disposeBIMIntegration() {
  if (bimIntegration) {
    bimIntegration.dispose();
    bimIntegration = null;
  }
}

// Make functions globally available
window.initBIMIntegration = initBIMIntegration;
window.activateBIM = activateBIM;
window.deactivateBIM = deactivateBIM;
window.loadBIMModel = loadBIMModel;
window.disposeBIMIntegration = disposeBIMIntegration;
