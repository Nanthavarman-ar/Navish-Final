// Material Editor for Babylon.js workspace
class MaterialEditor {
  constructor(scene) {
    this.scene = scene;
    this.selectedMesh = null;
    this.originalMaterial = null;
  }

  selectMesh(mesh) {
    this.selectedMesh = mesh;
    if (mesh && mesh.material) {
      this.originalMaterial = mesh.material.clone();
    }
  }

  applyMaterialChanges(changes) {
    if (!this.selectedMesh || !this.selectedMesh.material) return;

    const material = this.selectedMesh.material;

    if (changes.diffuseColor) {
      material.diffuseColor = changes.diffuseColor;
    }
    if (changes.specularColor) {
      material.specularColor = changes.specularColor;
    }
    if (changes.emissiveColor) {
      material.emissiveColor = changes.emissiveColor;
    }
    if (changes.alpha !== undefined) {
      material.alpha = changes.alpha;
    }
    if (changes.wireframe !== undefined) {
      material.wireframe = changes.wireframe;
    }
  }

  resetMaterial() {
    if (this.selectedMesh && this.originalMaterial) {
      this.selectedMesh.material = this.originalMaterial.clone();
    }
  }

  createMaterialPreview() {
    // Create a small sphere to preview material changes
    const previewSphere = BABYLON.MeshBuilder.CreateSphere('materialPreview', { diameter: 2 }, this.scene);
    previewSphere.position = new BABYLON.Vector3(10, 5, 10);

    if (this.selectedMesh && this.selectedMesh.material) {
      previewSphere.material = this.selectedMesh.material.clone();
    }

    return previewSphere;
  }

  dispose() {
    this.selectedMesh = null;
    this.originalMaterial = null;
  }
}

// Global material editor instance
let materialEditor = null;

// Exported functions for use in workspace.html
function initMaterialEditor(scene) {
  materialEditor = new MaterialEditor(scene);
}

function selectMeshForEditing(mesh) {
  if (materialEditor) {
    materialEditor.selectMesh(mesh);
  }
}

function applyMaterialChanges(changes) {
  if (materialEditor) {
    materialEditor.applyMaterialChanges(changes);
  }
}

function resetMaterial() {
  if (materialEditor) {
    materialEditor.resetMaterial();
  }
}

function createMaterialPreview() {
  if (materialEditor) {
    return materialEditor.createMaterialPreview();
  }
  return null;
}

function disposeMaterialEditor() {
  if (materialEditor) {
    materialEditor.dispose();
    materialEditor = null;
  }
}

// Make functions globally available
window.initMaterialEditor = initMaterialEditor;
window.selectMeshForEditing = selectMeshForEditing;
window.applyMaterialChanges = applyMaterialChanges;
window.resetMaterial = resetMaterial;
window.createMaterialPreview = createMaterialPreview;
window.disposeMaterialEditor = disposeMaterialEditor;
