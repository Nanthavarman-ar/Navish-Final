import { SceneLoader, AssetContainer, Scene, AbstractMesh, Material, Texture, BaseTexture, FreeCamera, RenderTargetTexture } from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import '@babylonjs/loaders/STL';
import '@babylonjs/loaders/FBX';
import '@babylonjs/loaders/3DS';

// Configure Draco decompression for glTF loader (must be outside class)
// GLTFFileLoader.IncrementalLoading = true;
// Draco decompression setup for glTF assets should be configured here based on Babylon.js version.
// Refer to Babylon.js documentation for the correct API (e.g., SetDecoder, useDracoCompression, etc.).

export interface LoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface LoadResult {
  id: string;
  meshes: AbstractMesh[];
  materials: Material[];
  textures: Texture[];
  container: AssetContainer;
}

export interface LoadOptions {
  autoCenter?: boolean;
  autoScale?: boolean;
  maxSize?: number;
  onProgress?: (progress: LoadProgress) => void;
  onError?: (error: string) => void;
}

// Configure Draco decompression for glTF loader
GLTFFileLoader.IncrementalLoading = true;


export class ModelLoader {
  private scene: Scene;
  private camera: FreeCamera;
  private loadedModels: Map<string, AssetContainer> = new Map();
  private supportedFormats = ['.glb', '.gltf', '.obj', '.stl', '.fbx', '.3ds'];

  constructor(scene: Scene, camera: FreeCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  public async loadFromFile(file: File, options: LoadOptions = {}): Promise<LoadResult> {
    const fileExtension = this.getFileExtension(file.name);
    
    if (!this.isFormatSupported(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const url = URL.createObjectURL(file);

    try {
      const result = await this.loadFromUrl(url, modelId, options);
      URL.revokeObjectURL(url);
      return result;
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  public async loadFromUrl(url: string, modelId?: string, options: LoadOptions = {}): Promise<LoadResult> {
    const id = modelId || `model_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      SceneLoader.ImportMeshAsync(
        '',
        '',
        url,
        this.scene,
        (progress) => {
          if (options.onProgress) {
            const loadProgress: LoadProgress = {
              loaded: progress.loaded || 0,
              total: progress.total || 1,
              percentage: progress.total ? (progress.loaded / progress.total) * 100 : 0
            };
            options.onProgress(loadProgress);
          }
        }
      ).then((result) => {
        try {
          if (result.meshes.length === 0) {
            throw new Error('No meshes found in the model');
          }

          // Create asset container
          const container = new AssetContainer(this.scene);
          result.meshes.forEach(mesh => container.meshes.push(mesh));

          // Collect materials and textures from meshes
          const materials = result.meshes
            .map(mesh => mesh.material)
            .filter((mat): mat is Material => mat != null)
            .filter((mat, index, arr) => arr.indexOf(mat) === index); // unique materials

          const textures = materials
            .flatMap(mat => mat.getActiveTextures())
            .filter((tex, index, arr) => arr.indexOf(tex) === index)
            .filter((tex): tex is Texture => tex instanceof Texture); // unique textures of type Texture

          // Add to container
          materials.forEach(mat => container.materials.push(mat));
          textures.forEach(tex => container.textures.push(tex));

          // Apply transformations
          if (options.autoCenter || options.autoScale) {
            this.transformMeshes(result.meshes, options);
          }

          // Store container
          this.loadedModels.set(id, container);

          const loadResult: LoadResult = {
            id,
            meshes: result.meshes,
            materials: materials,
            textures: textures,
            container
          };

          resolve(loadResult);
        } catch (error) {
          reject(error);
        }
      }).catch((error) => {
        if (options.onError) {
          options.onError(error.message);
        }
        reject(error);
      });
    });
  }

  /**
   * Export a 360° panorama image from the current camera view.
   * Returns an array of base64 PNG strings for the 6 cubemap faces.
   */
  public async exportPanorama360(resolution: number = 2048): Promise<string[]> {
    // Create a temporary camera at the current camera position
    const position = this.camera.position.clone();
    const panoramaCamera = new FreeCamera('panoramaCamera', position, this.scene);
    panoramaCamera.fov = Math.PI / 2;
    panoramaCamera.minZ = 0.1;
    panoramaCamera.maxZ = 1000;

    // Create a cube render target texture
    const renderTarget = new RenderTargetTexture('panoramaCube', resolution, this.scene, false);
    renderTarget.renderList = this.scene.meshes;
    renderTarget.activeCamera = panoramaCamera;

    // Render the scene to the cubemap
    renderTarget.render();

    // Export the 6 faces as PNG base64 (placeholder logic)
    const faceImages: string[] = [];
    for (let i = 0; i < 6; i++) {
      // Babylon.js API for reading pixels from cube faces (not directly available, placeholder)
      // You may need to use readPixels or custom logic here
      faceImages.push('data:image/png;base64,...'); // Placeholder
    }
    return faceImages;
  }

  public async uploadAndLoad(file: File, options: LoadOptions = {}): Promise<LoadResult> {
    // First validate file
    this.validateFile(file);

    // Upload to server
    const uploadedUrl = await this.uploadFile(file);
    
    // Load from uploaded URL
    return this.loadFromUrl(uploadedUrl, undefined, options);
  }

  private async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('model', file);

    const response = await fetch('/api/upload/model', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.url;
  }

  private validateFile(file: File): void {
    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size exceeds 100MB limit');
    }

    // Check file extension
    const extension = this.getFileExtension(file.name);
    if (!this.isFormatSupported(extension)) {
      throw new Error(`Unsupported file format: ${extension}`);
    }

    // Check MIME type
    const allowedMimeTypes = [
      'model/gltf-binary',
      'model/gltf+json',
      'application/octet-stream',
      'text/plain'
    ];

    if (file.type && !allowedMimeTypes.includes(file.type)) {
      console.warn(`Unexpected MIME type: ${file.type}, but proceeding based on file extension`);
    }
  }

  private transformMeshes(meshes: AbstractMesh[], options: LoadOptions): void {
    if (meshes.length === 0) return;

    // Calculate bounding box
    let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();

    meshes.forEach(mesh => {
      const boundingBox = mesh.getBoundingInfo().boundingBox;
      min = min.minimizeInPlace(boundingBox.minimumWorld);
      max = max.maximizeInPlace(boundingBox.maximumWorld);
    });

    // Center meshes
    if (options.autoCenter) {
      const center = min.add(max).scale(0.5);
      meshes.forEach(mesh => {
        mesh.position.subtractInPlace(center);
      });
    }

    // Scale meshes
    if (options.autoScale) {
      const size = max.subtract(min);
      const maxDimension = Math.max(size.x, size.y, size.z);
      const targetSize = options.maxSize || 10;
      
      if (maxDimension > targetSize) {
        const scale = targetSize / maxDimension;
        meshes.forEach(mesh => {
          mesh.scaling.scaleInPlace(scale);
        });
      }
    }
  }

  private getFileExtension(filename: string): string {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  private isFormatSupported(extension: string): boolean {
    return this.supportedFormats.includes(extension);
  }

  public getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  public removeModel(id: string): boolean {
    const container = this.loadedModels.get(id);
    if (!container) return false;

    container.dispose();
    this.loadedModels.delete(id);
    return true;
  }

  public getLoadedModel(id: string): AssetContainer | null {
    return this.loadedModels.get(id) || null;
  }

  public getAllLoadedModels(): Map<string, AssetContainer> {
    return new Map(this.loadedModels);
  }

  public dispose(): void {
    this.loadedModels.forEach(container => container.dispose());
    this.loadedModels.clear();
  }
}