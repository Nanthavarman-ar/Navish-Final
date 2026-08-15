import { Socket } from "socket.io-client";
import * as BABYLON from "@babylonjs/core";

export interface SceneObject {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  materialId?: string;
  type: 'box' | 'sphere' | 'cylinder' | 'plane' | 'custom';
  userId?: string;
  timestamp: number;
}

export interface SyncEvent {
  type: 'create' | 'update' | 'delete' | 'transform' | 'material' | 'animation';
  objectId: string;
  data: any;
  userId: string;
  timestamp: number;
}

export class SyncManager {
  private socket: Socket | null;
  protected scene: BABYLON.Scene;
  private sceneObjects: Map<string, SceneObject> = new Map();
  private localUserId: string;
  private isHost: boolean = false;
  private pendingChanges: SyncEvent[] = [];
  private lastSyncTime: number = 0;
  private syncInterval: number = 100; // ms
  private conflictResolver: (local: any, remote: any) => any;

  constructor(socket: Socket | null, scene: BABYLON.Scene, userId: string) {
    this.socket = socket;
    this.scene = scene;
    this.localUserId = userId;
    this.conflictResolver = this.defaultConflictResolver;

    if (this.socket) {
      this.setupSocketListeners();
    }
    this.startSyncLoop();
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Listen for scene sync events
    this.socket.on('scene-sync', (data: { objects: SceneObject[], timestamp: number }) => {
      this.handleSceneSync(data);
    });

    this.socket.on('object-sync', (event: SyncEvent) => {
      this.handleObjectSync(event);
    });

    this.socket.on('user-joined', (data: { userId: string, isHost: boolean }) => {
      if (data.userId === this.localUserId) {
        this.isHost = data.isHost;
      }
      this.requestSceneSync();
    });

    this.socket.on('user-left', (userId: string) => {
      this.removeUserObjects(userId);
    });
  }

  // Handle full scene synchronization
  private handleSceneSync(data: { objects: SceneObject[], timestamp: number }): void {
    if (data.timestamp <= this.lastSyncTime) return;

    this.lastSyncTime = data.timestamp;
    this.sceneObjects.clear();

    data.objects.forEach(obj => {
      this.sceneObjects.set(obj.id, obj);
      this.applyObjectToScene(obj, false);
    });
  }

  // Handle individual object synchronization
  private handleObjectSync(event: SyncEvent): void {
    if (event.userId === this.localUserId) return; // Ignore our own events

    switch (event.type) {
      case 'create':
        this.sceneObjects.set(event.objectId, event.data);
        this.applyObjectToScene(event.data, false);
        break;
      case 'update': {
        const existing = this.sceneObjects.get(event.objectId);
        if (existing) {
          const resolved = this.conflictResolver(existing, event.data);
          this.sceneObjects.set(event.objectId, resolved);
          this.applyObjectToScene(resolved, false);
        }
        break;
      }
      case 'delete':
        this.sceneObjects.delete(event.objectId);
        this.removeObjectFromScene(event.objectId);
        break;
      case 'transform':
        this.applyTransform(event.objectId, event.data);
        break;
      case 'material':
        this.applyMaterial(event.objectId, event.data);
        break;
      case 'animation':
        this.applyAnimation(event.objectId, event.data);
        break;
    }
  }

  // Apply object to Babylon scene
  private applyObjectToScene(obj: SceneObject, isLocal: boolean = true): void {
    let mesh = this.scene.getMeshByName(`sync_${obj.id}`);

    if (!mesh) {
      // Create new mesh
      switch (obj.type) {
        case 'box':
          mesh = BABYLON.MeshBuilder.CreateBox(`sync_${obj.id}`, {}, this.scene);
          break;
        case 'sphere':
          mesh = BABYLON.MeshBuilder.CreateSphere(`sync_${obj.id}`, {}, this.scene);
          break;
        case 'cylinder':
          mesh = BABYLON.MeshBuilder.CreateCylinder(`sync_${obj.id}`, {}, this.scene);
          break;
        case 'plane':
          mesh = BABYLON.MeshBuilder.CreatePlane(`sync_${obj.id}`, {}, this.scene);
          break;
        default:
          mesh = BABYLON.MeshBuilder.CreateBox(`sync_${obj.id}`, {}, this.scene);
      }

      // Set mesh properties
      mesh.position = new BABYLON.Vector3(...obj.position);
      mesh.rotation = new BABYLON.Vector3(...obj.rotation);
      mesh.scaling = new BABYLON.Vector3(...obj.scale);

      // Add material if specified
      if (obj.materialId) {
        this.applyMaterial(obj.id, { materialId: obj.materialId });
      }

      // Add user indicator for remote objects
      if (!isLocal && obj.userId) {
        this.addUserIndicator(mesh, obj.userId);
      }
    } else {
      // Update existing mesh
      mesh.position = new BABYLON.Vector3(...obj.position);
      mesh.rotation = new BABYLON.Vector3(...obj.rotation);
      mesh.scaling = new BABYLON.Vector3(...obj.scale);
    }
  }

  // Remove object from scene
  private removeObjectFromScene(objectId: string): void {
    const mesh = this.scene.getMeshByName(`sync_${objectId}`);
    if (mesh) {
      mesh.dispose();
    }
  }

  // Apply transform to object
  private applyTransform(objectId: string, transform: any): void {
    const mesh = this.scene.getMeshByName(`sync_${objectId}`);
    if (mesh) {
      if (transform.position) {
        mesh.position = new BABYLON.Vector3(...transform.position);
      }
      if (transform.rotation) {
        mesh.rotation = new BABYLON.Vector3(...transform.rotation);
      }
      if (transform.scale) {
        mesh.scaling = new BABYLON.Vector3(...transform.scale);
      }
    }
  }

  // Apply material to object
  private applyMaterial(objectId: string, data: any): void {
    const mesh = this.scene.getMeshByName(`sync_${objectId}`);
    if (mesh && data.materialId) {
      // This would integrate with MaterialManager
      // For now, create a simple material
      const material = new BABYLON.PBRMaterial(`mat_${objectId}`, this.scene);
      material.albedoColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      mesh.material = material;
    }
  }

  // Apply animation to object
  private applyAnimation(objectId: string, data: any): void {
    // This would integrate with AnimationManager
    const sanitizedObjectId = objectId.replace(/[\r\n\t]/g, '_');
    const sanitizedData = JSON.stringify(data).replace(/[\r\n\t]/g, '_');
    console.log('Animation sync:', sanitizedObjectId, sanitizedData);
  }

  // Add visual indicator for user ownership
  private addUserIndicator(mesh: BABYLON.AbstractMesh, userId: string): void {
    // Create a small indicator sphere above the object
    const indicator = BABYLON.MeshBuilder.CreateSphere(`indicator_${mesh.name}`, { diameter: 0.1 }, this.scene);
    indicator.position = mesh.position.add(new BABYLON.Vector3(0, 1.5, 0));
    indicator.parent = mesh; // Attach to object

    const material = new BABYLON.PBRMaterial(`indicator_mat_${userId}`, this.scene);
    material.albedoColor = new BABYLON.Color3(0, 1, 0); // Green for remote users
    material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
    indicator.material = material;
  }

  // Remove objects owned by a user
  private removeUserObjects(userId: string): void {
    for (const [id, obj] of this.sceneObjects.entries()) {
      if (obj.userId === userId) {
        this.sceneObjects.delete(id);
        this.removeObjectFromScene(id);
      }
    }
  }

  // Default conflict resolver (last write wins)
  private defaultConflictResolver(local: any, remote: any): any {
    return remote.timestamp > local.timestamp ? remote : local;
  }

  // Public API methods

  // Create a new synchronized object
  createObject(type: SceneObject['type'], position: [number, number, number], name?: string): string {
    const objectId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const obj: SceneObject = {
      id: objectId,
      name: name || `${type}_${objectId}`,
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type,
      userId: this.localUserId,
      timestamp: Date.now()
    };

    this.sceneObjects.set(objectId, obj);
    this.applyObjectToScene(obj, true);

    // Broadcast creation
    this.broadcastEvent({
      type: 'create',
      objectId,
      data: obj,
      userId: this.localUserId,
      timestamp: obj.timestamp
    });

    return objectId;
  }

  // Update an existing object
  updateObject(objectId: string, updates: Partial<SceneObject>): void {
    const obj = this.sceneObjects.get(objectId);
    if (!obj) return;

    const updatedObj: SceneObject = {
      ...obj,
      ...updates,
      timestamp: Date.now(),
      id: objectId // Ensure id is preserved
    };
    this.sceneObjects.set(objectId, updatedObj);
    this.applyObjectToScene(updatedObj, true);

    // Broadcast update
    this.broadcastEvent({
      type: 'update',
      objectId,
      data: updatedObj,
      userId: this.localUserId,
      timestamp: updatedObj.timestamp
    });
  }

  // Delete an object
  deleteObject(objectId: string): void {
    if (!this.sceneObjects.has(objectId)) return;

    this.sceneObjects.delete(objectId);
    this.removeObjectFromScene(objectId);

    // Broadcast deletion
    this.broadcastEvent({
      type: 'delete',
      objectId,
      data: null,
      userId: this.localUserId,
      timestamp: Date.now()
    });
  }

  // Broadcast sync event
  private broadcastEvent(event: SyncEvent): void {
    if (this.socket) {
      this.socket.emit('object-sync', event);
    }
  }

  // Request full scene sync
  private requestSceneSync(): void {
    if (this.socket) {
      this.socket.emit('request-scene-sync');
    }
  }

  // Start synchronization loop
  private startSyncLoop(): void {
    setInterval(() => {
      this.processPendingChanges();
    }, this.syncInterval);
  }

  // Process pending changes
  private processPendingChanges(): void {
    // Process pending changes if any
    // This could be used for batching or retry logic
  }

  // Get all scene objects
  getSceneObjects(): SceneObject[] {
    return Array.from(this.sceneObjects.values());
  }

  // Get object by ID
  getObject(objectId: string): SceneObject | undefined {
    return this.sceneObjects.get(objectId);
  }

  // Set custom conflict resolver
  setConflictResolver(resolver: (local: any, remote: any) => any): void {
    this.conflictResolver = resolver;
  }

  // Cleanup
  dispose(): void {
    this.sceneObjects.clear();
    // Remove all sync meshes
    const syncMeshes = this.scene.meshes.filter(mesh => mesh.name.startsWith('sync_'));
    syncMeshes.forEach(mesh => mesh.dispose());
  }
}
