// Mock Babylon.js SceneLoader
export class SceneLoader {
  static ImportMeshAsync(
    meshNames: string | string[] | null,
    rootUrl: string,
    sceneFilename: string,
    scene: any,
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
