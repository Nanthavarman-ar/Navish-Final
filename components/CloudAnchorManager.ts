import { Scene, TransformNode, Vector3, Quaternion, Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { GPSCoordinates } from './GPSTransformUtils';

export interface CloudAnchor {
  id: string;
  name: string;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  cloudId?: string;
  lastSync: Date;
  isPersistent: boolean;
  node?: TransformNode;
  gpsCoordinates?: GPSCoordinates;
  modelUrl?: string;
  userId?: string;
  roomId?: string;
  sessionId?: string;
  deviceId?: string;
  version?: number;
}

export interface CloudAnchorData extends CloudAnchor {
  // Additional data if needed for cloud-specific info
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface CloudAnchorManagerOptions {
  apiEndpoint?: string;
  apiKey?: string;
  autoSync?: boolean;
  syncInterval?: number;
  enablePersistence?: boolean;
  maxAnchors?: number;
}

export class CloudAnchorManager {
  private scene: Scene;
  private anchors: Map<string, CloudAnchor> = new Map();
  private options: Required<CloudAnchorManagerOptions>;
  private eventListeners: Array<(event: CloudAnchorEvent) => void> = [];
  private isConnected: boolean = false;
  // No real cloud-anchor backend exists in this project yet (server/index.tsx has no
  // /anchors routes) - remote sync is only attempted if a real endpoint is supplied.
  private static readonly PLACEHOLDER_ENDPOINT = 'https://api.cloudanchors.example.com';
  private hasRealEndpoint: boolean;
  private callbacks?: {
    onAnchorSynced?: (anchor: CloudAnchor) => void;
    onAnchorConflict?: (local: CloudAnchor, remote: CloudAnchor) => void;
    onSyncError?: (error: any) => void;
    onConnectivityChanged?: (online: boolean) => void;
  };

  constructor(scene: Scene, options: CloudAnchorManagerOptions = {}) {
    this.scene = scene;
    this.hasRealEndpoint = !!options.apiEndpoint && options.apiEndpoint !== CloudAnchorManager.PLACEHOLDER_ENDPOINT;
    this.options = {
      apiEndpoint: options.apiEndpoint || CloudAnchorManager.PLACEHOLDER_ENDPOINT,
      apiKey: options.apiKey || '',
      autoSync: options.autoSync ?? true,
      syncInterval: options.syncInterval ?? 30000, // 30 seconds
      enablePersistence: options.enablePersistence ?? true,
      maxAnchors: options.maxAnchors ?? 100,
    };
  }

  /**
   * Whether a real cloud-anchor backend is configured, versus running in local-only
   * mode (no anchor persistence/sync beyond this session).
   */
  hasRealEndpointConfigured(): boolean {
    return this.hasRealEndpoint;
  }

  /**
   * Connect to the cloud anchor service
   */
  async connect(): Promise<boolean> {
    try {
      if (this.hasRealEndpoint) {
        console.log(`Connecting to cloud anchor service: ${this.options.apiEndpoint}`);
      } else {
        console.log('No real cloud-anchor backend configured - anchors will persist locally only for this session.');
      }
      this.isConnected = true;
      await this.loadAnchors();
      this.callbacks?.onConnectivityChanged?.(true);
      return true;
    } catch (error) {
      console.error('Failed to connect to cloud anchor service:', error);
      this.callbacks?.onSyncError?.(error);
      return false;
    }
  }

  /**
   * Disconnect from the cloud anchor service
   */
  async disconnect(): Promise<void> {
    try {
      if (this.options.autoSync) {
        await this.syncAllAnchors();
      }
      this.isConnected = false;
      this.callbacks?.onConnectivityChanged?.(false);
      console.log('Disconnected from cloud anchor service');
    } catch (error) {
      console.error('Error disconnecting from cloud anchor service:', error);
      this.callbacks?.onSyncError?.(error);
    }
  }

  setCallbacks(callbacks: {
    onAnchorSynced?: (anchor: CloudAnchor) => void;
    onAnchorConflict?: (local: CloudAnchor, remote: CloudAnchor) => void;
    onSyncError?: (error: any) => void;
    onConnectivityChanged?: (online: boolean) => void;
  }): void {
    this.callbacks = callbacks;
  }

  /**
   * Create a new cloud anchor
   */
  async createAnchor(anchor: Omit<CloudAnchor, 'node'>): Promise<CloudAnchor> {
    if (this.anchors.size >= this.options.maxAnchors) {
      throw new Error(`Maximum number of anchors (${this.options.maxAnchors}) reached`);
    }

    const fullAnchor: CloudAnchor = {
      ...anchor,
      node: this.createAnchorNode(anchor),
    };

    this.anchors.set(anchor.id, fullAnchor);

    if (this.options.enablePersistence) {
      await this.persistAnchor(fullAnchor);
    }

    this.emitEvent({
      type: 'anchor_created',
      anchorId: anchor.id,
      timestamp: new Date(),
      data: anchor,
    });

    // Call callback if synced
    if (fullAnchor.cloudId) {
      this.callbacks?.onAnchorSynced?.(fullAnchor);
    }

    return fullAnchor;
  }

  /**
   * Delete a cloud anchor
   */
  async deleteAnchor(anchorId: string): Promise<boolean> {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) {
      return false;
    }

    if (anchor.node) {
      anchor.node.dispose();
    }

    this.anchors.delete(anchorId);

    if (this.options.enablePersistence && anchor.cloudId) {
      await this.deleteRemoteAnchor(anchor.cloudId);
    }

    this.emitEvent({
      type: 'anchor_deleted',
      anchorId,
      timestamp: new Date(),
    });

    return true;
  }

  async removeAnchor(anchorId: string): Promise<{ success: boolean; errors?: any[] }> {
    try {
      const success = await this.deleteAnchor(anchorId);
      return { success };
    } catch (error) {
      return { success: false, errors: [error] };
    }
  }

  /**
   * Update anchor position
   */
  async updateAnchorPosition(anchorId: string, position: Vector3, rotation?: Quaternion): Promise<boolean> {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) {
      return false;
    }

    const localAnchor = anchor;
    // Simulate conflict detection
    // For now, assume no conflict; in real impl, compare with remote
    // if (conflict) this.callbacks?.onAnchorConflict?.(localAnchor, remoteAnchor);

    anchor.position = position.clone();
    if (rotation) {
      anchor.rotation = rotation.clone();
    }
    anchor.lastSync = new Date();

    // Update 3D node
    if (anchor.node) {
      anchor.node.position = position;
      if (rotation) {
        anchor.node.rotationQuaternion = rotation;
      }
    }

    if (this.options.autoSync) {
      try {
        await this.syncAnchor(anchor);
        this.callbacks?.onAnchorSynced?.(anchor);
      } catch (error) {
        this.callbacks?.onSyncError?.(error);
      }
    }

    this.emitEvent({
      type: 'anchor_updated',
      anchorId,
      timestamp: new Date(),
      data: { position, rotation },
    });

    return true;
  }

  /**
   * Find nearby anchors
   */
  findNearbyAnchors(position: Vector3, radius: number): CloudAnchor[] {
    return Array.from(this.anchors.values()).filter(anchor => {
      const distance = Vector3.Distance(anchor.position, position);
      return distance <= radius;
    });
  }

  /**
   * Get anchor by ID
   */
  getAnchor(anchorId: string): CloudAnchor | undefined {
    return this.anchors.get(anchorId);
  }

  /**
   * Get all anchors
   */
  getAnchors(): CloudAnchor[] {
    return Array.from(this.anchors.values());
  }

  getCloudAnchors(): CloudAnchorData[] {
    return this.getAnchors() as CloudAnchorData[];
  }

  /**
   * Resolve anchor from cloud ID
   */
  async resolveAnchor(cloudId: string): Promise<CloudAnchor | null> {
    try {
      if (!this.hasRealEndpoint) {
        console.log(`resolveAnchor(${cloudId}): no cloud-anchor backend configured, cannot resolve remotely.`);
        return null;
      }
      // No cloud-anchor route exists in server/index.tsx yet; when one is added, this
      // should fetch(`${this.options.apiEndpoint}/anchors/${cloudId}`) and map the result.
      console.log(`Resolving anchor with cloud ID: ${cloudId}`);
      return null;
    } catch (error) {
      console.error(`Failed to resolve anchor ${cloudId}:`, error);
      return null;
    }
  }

  /**
   * Sync all anchors with cloud service
   */
  async syncAllAnchors(): Promise<void> {
    const anchors = Array.from(this.anchors.values());

    for (const anchor of anchors) {
      if (this.options.autoSync) {
        await this.syncAnchor(anchor);
      }
    }

    console.log(`Synced ${anchors.length} anchors with cloud service`);
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: CloudAnchorEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: CloudAnchorEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private createAnchorNode(anchor: CloudAnchor): TransformNode {
    const node = new TransformNode(`cloud_anchor_${anchor.id}`, this.scene);
    node.position = anchor.position;
    node.rotationQuaternion = anchor.rotation;

    // Create visual representation
    const sphere = MeshBuilder.CreateSphere(`anchor_mesh_${anchor.id}`, { diameter: 0.1 }, this.scene);
    sphere.position = node.position;
    sphere.material = new StandardMaterial(`anchor_material_${anchor.id}`, this.scene);
    (sphere.material as StandardMaterial).diffuseColor = Color3.Purple();

    node.addChild(sphere);

    return node;
  }

  private async persistAnchor(anchor: CloudAnchor): Promise<void> {
    if (!this.hasRealEndpoint) {
      return; // No cloud-anchor backend configured - anchor stays local-only.
    }
    try {
      const response = await fetch(`${this.options.apiEndpoint}/anchors`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: anchor.name,
          position: anchor.position,
          rotation: anchor.rotation,
          scale: anchor.scale,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to persist anchor: ${response.status}`);
      }
      const result = await response.json();
      anchor.cloudId = result.cloudId;
    } catch (error) {
      console.error(`Failed to persist anchor ${anchor.id}:`, error);
    }
  }

  private async deleteRemoteAnchor(cloudId: string): Promise<void> {
    if (!this.hasRealEndpoint) {
      return;
    }
    try {
      const response = await fetch(`${this.options.apiEndpoint}/anchors/${cloudId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to delete remote anchor: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to delete remote anchor ${cloudId}:`, error);
    }
  }

  private async syncAnchor(anchor: CloudAnchor): Promise<void> {
    if (!anchor.cloudId || !this.hasRealEndpoint) {
      return;
    }

    try {
      const response = await fetch(`${this.options.apiEndpoint}/anchors/${anchor.cloudId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position: anchor.position,
          rotation: anchor.rotation,
          scale: anchor.scale,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to sync anchor: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to sync anchor ${anchor.id}:`, error);
    }
  }

  private async loadAnchors(): Promise<void> {
    if (!this.hasRealEndpoint) {
      console.log('loadAnchors: no cloud-anchor backend configured, skipping remote load.');
      return;
    }
    try {
      const response = await fetch(`${this.options.apiEndpoint}/anchors`, {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load anchors: ${response.status}`);
      }
      const anchors = await response.json();
      anchors.forEach((anchorData: any) => {
        const anchor: CloudAnchor = {
          ...anchorData,
          node: this.createAnchorNode(anchorData),
        };
        this.anchors.set(anchor.id, anchor);
      });
    } catch (error) {
      console.error('Failed to load anchors:', error);
    }
  }

  private emitEvent(event: CloudAnchorEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in cloud anchor event listener:', error);
      }
    });
  }

  /**
   * Update the cloud anchor manager (called per frame)
   */
  update(): void {
    // Update anchor positions, sync with cloud, etc.
    // This method is called from the render loop
  }

  /**
   * Dispose of the cloud anchor manager resources
   */
  dispose(): void {
    // Clear all anchors
    this.anchors.clear();

    // Clear event listeners
    this.eventListeners.length = 0;

    console.log('CloudAnchorManager disposed');
  }
}

export interface CloudAnchorEvent {
  type: 'anchor_created' | 'anchor_deleted' | 'anchor_updated' | 'anchor_resolved' | 'sync_completed';
  anchorId?: string;
  timestamp: Date;
  data?: any;
}
