// Mock Babylon.js SceneLoader
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
