import { Scene, TransformNode, Vector3, Quaternion, MeshBuilder, StandardMaterial, Color3, Texture } from '@babylonjs/core';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Date;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoWorkspaceArea {
  id: string;
  name: string;
  center: GeoLocation;
  bounds: GeoBounds;
  area: number;
  elevation: number;
}

export interface GeoSyncObject {
  id: string;
  name: string;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  geoLocation: GeoLocation;
  lastSync: Date;
  isSynchronized: boolean;
  node?: TransformNode;
}

export interface GeoSyncManagerOptions {
  apiEndpoint?: string;
  apiKey?: string;
  autoSync?: boolean;
  syncInterval?: number;
  enableRealTimeUpdates?: boolean;
  coordinateSystem?: 'wgs84' | 'utm' | 'local';
}

export class GeoSyncManager {
  private scene: Scene;
  private objects: Map<string, GeoSyncObject> = new Map();
  private mapOverlays: Map<string, TransformNode> = new Map();
  private workspaces: Map<string, GeoWorkspaceArea> = new Map();
  private options: Required<GeoSyncManagerOptions>;
  private eventListeners: Array<(event: GeoSyncEvent) => void> = [];
  private isConnected: boolean = false;
  private currentLocation: GeoLocation | null = null;
  // Local reference point that geo<->3D conversions are measured relative to. Defaults
  // to whatever GPS fix comes in first (see startLocationTracking), or can be set
  // explicitly via setOrigin() to anchor conversions to a specific site/workspace.
  private originLocation: GeoLocation | null = null;
  // The default endpoint below is a placeholder (no such service exists) - remote sync
  // is only attempted when the caller supplies a real apiEndpoint.
  private static readonly PLACEHOLDER_ENDPOINT = 'https://api.geosync.example.com';
  private hasRealEndpoint: boolean;

  constructor(scene: Scene, options: GeoSyncManagerOptions = {}) {
    this.scene = scene;
    this.hasRealEndpoint = !!options.apiEndpoint && options.apiEndpoint !== GeoSyncManager.PLACEHOLDER_ENDPOINT;
    this.options = {
      apiEndpoint: options.apiEndpoint || GeoSyncManager.PLACEHOLDER_ENDPOINT,
      apiKey: options.apiKey || '',
      autoSync: options.autoSync ?? true,
      syncInterval: options.syncInterval ?? 10000, // 10 seconds
      enableRealTimeUpdates: options.enableRealTimeUpdates ?? true,
      coordinateSystem: options.coordinateSystem || 'wgs84',
    };
  }

  /**
   * Set the local reference point that 3D positions are measured relative to (e.g. the
   * project site's real-world coordinates). Call this once you know the site location;
   * until then, conversions fall back to the first GPS fix or a documented default.
   */
  setOrigin(location: GeoLocation): void {
    this.originLocation = location;
  }


  /**
   * Connect to the geo-sync service
   */
  async connect(): Promise<boolean> {
    try {
      if (this.hasRealEndpoint) {
        console.log(`Connecting to geo-sync service: ${this.options.apiEndpoint}`);
      } else {
        console.log('No remote geo-sync endpoint configured - running in local-only mode (GPS tracking still active).');
      }
      this.isConnected = true;

      // Start location tracking
      if (this.options.enableRealTimeUpdates) {
        await this.startLocationTracking();
      }

      await this.loadObjects();
      return true;
    } catch (error) {
      console.error('Failed to connect to geo-sync service:', error);
      return false;
    }
  }

  /**
   * Disconnect from the geo-sync service
   */
  async disconnect(): Promise<void> {
    try {
      this.stopLocationTracking();
      this.isConnected = false;
      console.log('Disconnected from geo-sync service');
    } catch (error) {
      console.error('Error disconnecting from geo-sync service:', error);
    }
  }

  /**
   * Dispose of all resources (meshes, overlays, listeners). Call this when the manager
   * is no longer needed, e.g. on workspace unmount.
   */
  dispose(): void {
    this.stopLocationTracking();
    this.objects.forEach((object) => object.node?.dispose());
    this.objects.clear();
    this.mapOverlays.forEach((node) => node.dispose(false, true));
    this.mapOverlays.clear();
    this.workspaces.clear();
    this.eventListeners.length = 0;
    this.isConnected = false;
  }

  /**
   * Register a new geo-sync object
   */
  async registerObject(object: Omit<GeoSyncObject, 'node'>): Promise<GeoSyncObject> {
    const fullObject: GeoSyncObject = {
      ...object,
      node: this.createObjectNode(object),
    };

    this.objects.set(object.id, fullObject);

    if (this.options.autoSync) {
      await this.syncObject(fullObject);
    }

    this.emitEvent({
      type: 'object_registered',
      objectId: object.id,
      timestamp: new Date(),
      data: object,
    });

    return fullObject;
  }

  /**
   * Unregister a geo-sync object
   */
  async unregisterObject(objectId: string): Promise<boolean> {
    const object = this.objects.get(objectId);
    if (!object) {
      return false;
    }

    if (object.node) {
      object.node.dispose();
    }

    this.objects.delete(objectId);

    if (this.options.autoSync) {
      await this.deleteRemoteObject(objectId);
    }

    this.emitEvent({
      type: 'object_unregistered',
      objectId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Update object position and sync with geo-location
   */
  async updateObjectPosition(objectId: string, position: Vector3, rotation?: Quaternion): Promise<boolean> {
    const object = this.objects.get(objectId);
    if (!object) {
      return false;
    }

    object.position = position.clone();
    if (rotation) {
      object.rotation = rotation.clone();
    }
    object.lastSync = new Date();

    // Update 3D node
    if (object.node) {
      object.node.position = position;
      if (rotation) {
        object.node.rotationQuaternion = rotation;
      }
    }

    // Convert to geo-location and sync
    const geoLocation = this.positionToGeoLocation(position);
    if (geoLocation) {
      object.geoLocation = geoLocation;
      object.isSynchronized = true;

      if (this.options.autoSync) {
        await this.syncObject(object);
      }

      this.emitEvent({
        type: 'position_updated',
        objectId,
        timestamp: new Date(),
        data: { position, geoLocation },
      });
    }

    return true;
  }

  /**
   * Sync object with remote geo-location
   */
  async syncObjectFromGeoLocation(objectId: string): Promise<boolean> {
    const object = this.objects.get(objectId);
    if (!object) {
      return false;
    }

    try {
      if (this.hasRealEndpoint) {
        const response = await fetch(
          `${this.options.apiEndpoint}/objects/${encodeURIComponent(objectId)}/location`,
          { headers: this.options.apiKey ? { 'Authorization': `Bearer ${this.options.apiKey}` } : {} }
        );
        if (!response.ok) {
          throw new Error(`Geo-sync request failed: ${response.status}`);
        }
        const remoteLocation: GeoLocation = await response.json();
        object.geoLocation = remoteLocation;
        const position = this.geoLocationToPosition(remoteLocation);
        if (position && object.node) {
          object.position = position;
          object.node.position = position;
        }
      } else {
        // No remote geo-sync service configured - recompute the object's local 3D
        // position from its already-known geoLocation instead of a no-op.
        const position = this.geoLocationToPosition(object.geoLocation);
        if (position && object.node) {
          object.position = position;
          object.node.position = position;
        }
      }

      object.lastSync = new Date();
      object.isSynchronized = true;

      this.emitEvent({
        type: 'sync_completed',
        objectId,
        timestamp: new Date(),
        data: object,
      });

      return true;
    } catch (error) {
      console.error(`Failed to sync object ${objectId} from geo-location:`, error);
      object.isSynchronized = false;
      return false;
    }
  }

  /**
   * Get all objects
   */
  getObjects(): GeoSyncObject[] {
    return Array.from(this.objects.values());
  }

  /**
   * Get object by ID
   */
  getObject(objectId: string): GeoSyncObject | undefined {
    return this.objects.get(objectId);
  }

  /**
   * Get current location
   */
  getCurrentLocation(): GeoLocation | null {
    return this.currentLocation;
  }

  /**
   * Convert geo-location to 3D position
   *
   * Uses an equirectangular (local tangent plane) projection around the manager's
   * origin point - accurate to well under a meter of error at site/city scale, which
   * is what this 3D workspace actually needs. Requires no external geocoding service.
   */
  geoLocationToPosition(geoLocation: GeoLocation): Vector3 | null {
    const origin = this.originLocation || this.currentLocation;
    if (!origin) {
      console.warn('geoLocationToPosition: no origin set yet (no GPS fix and setOrigin() not called). Returning null.');
      return null;
    }

    const EARTH_RADIUS_METERS = 6378137; // WGS84 equatorial radius
    const originLatRad = (origin.latitude * Math.PI) / 180;
    const dLat = ((geoLocation.latitude - origin.latitude) * Math.PI) / 180;
    const dLon = ((geoLocation.longitude - origin.longitude) * Math.PI) / 180;

    const x = dLon * EARTH_RADIUS_METERS * Math.cos(originLatRad); // east-west (meters)
    const z = dLat * EARTH_RADIUS_METERS; // north-south (meters)
    const y = (geoLocation.altitude || 0) - (origin.altitude || 0);

    return new Vector3(x, y, z);
  }

  /**
   * Convert 3D position to geo-location
   *
   * Inverse of geoLocationToPosition - same equirectangular projection, same origin.
   */
  positionToGeoLocation(position: Vector3): GeoLocation | null {
    const origin = this.originLocation || this.currentLocation;
    if (!origin) {
      console.warn('positionToGeoLocation: no origin set yet (no GPS fix and setOrigin() not called). Returning null.');
      return null;
    }

    const EARTH_RADIUS_METERS = 6378137;
    const originLatRad = (origin.latitude * Math.PI) / 180;

    const dLat = position.z / EARTH_RADIUS_METERS;
    const dLon = position.x / (EARTH_RADIUS_METERS * Math.cos(originLatRad));

    const latitude = origin.latitude + (dLat * 180) / Math.PI;
    const longitude = origin.longitude + (dLon * 180) / Math.PI;
    const altitude = (origin.altitude || 0) + position.y;

    return {
      latitude,
      longitude,
      altitude,
      timestamp: new Date(),
    };
  }

  /**
   * Get all workspaces
   */
  getWorkspaces(): GeoWorkspaceArea[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Create a new workspace area
   */
  createWorkspaceArea(name: string, bounds: GeoBounds, elevation: number): GeoWorkspaceArea {
    const id = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate center
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    // Calculate area (approximate in square meters)
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const area = latDiff * lngDiff * 111000 * 111000 * Math.cos(centerLat * Math.PI / 180);

    const workspace: GeoWorkspaceArea = {
      id,
      name,
      center: {
        latitude: centerLat,
        longitude: centerLng,
        altitude: elevation,
        timestamp: new Date(),
      },
      bounds,
      area,
      elevation,
    };

    this.workspaces.set(id, workspace);

    this.emitEvent({
      type: 'workspace_created',
      objectId: id,
      timestamp: new Date(),
      data: workspace,
    });

    return workspace;
  }

  /**
   * Remove a workspace
   */
  removeWorkspace(workspaceId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }

    this.workspaces.delete(workspaceId);

    this.emitEvent({
      type: 'workspace_removed',
      objectId: workspaceId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Add map overlay to workspace
   */
  addMapOverlay(workspaceId: string, imageUrl: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return false;
    }

    // Remove any existing overlay for this workspace before adding the new one.
    this.removeMapOverlay(workspaceId);

    // Convert the workspace's real-world geo bounds into local scene coordinates
    // using the same projection the rest of this class uses, so the overlay lines up
    // correctly with anything else placed via geoLocationToPosition.
    const nw = this.geoLocationToPosition({ latitude: workspace.bounds.north, longitude: workspace.bounds.west, timestamp: new Date() });
    const se = this.geoLocationToPosition({ latitude: workspace.bounds.south, longitude: workspace.bounds.east, timestamp: new Date() });

    if (!nw || !se) {
      console.warn(`addMapOverlay: no origin set yet, cannot position overlay for workspace ${workspaceId}`);
      return false;
    }

    const width = Math.abs(se.x - nw.x) || 10;
    const depth = Math.abs(se.z - nw.z) || 10;
    const centerX = (nw.x + se.x) / 2;
    const centerZ = (nw.z + se.z) / 2;

    const node = new TransformNode(`map_overlay_${workspaceId}`, this.scene);
    const ground = MeshBuilder.CreateGround(`map_overlay_mesh_${workspaceId}`, { width, height: depth }, this.scene);
    ground.position.set(centerX, workspace.elevation || 0, centerZ);

    const material = new StandardMaterial(`map_overlay_material_${workspaceId}`, this.scene);
    material.diffuseTexture = new Texture(imageUrl, this.scene);
    material.specularColor = new Color3(0, 0, 0); // flat, map-like appearance, no glare
    material.backFaceCulling = false;
    ground.material = material;
    ground.parent = node;

    this.mapOverlays.set(workspaceId, node);

    this.emitEvent({
      type: 'map_overlay_added',
      objectId: workspaceId,
      timestamp: new Date(),
      data: { imageUrl, width, depth },
    });

    return true;
  }

  /**
   * Remove a previously added map overlay.
   */
  removeMapOverlay(workspaceId: string): boolean {
    const node = this.mapOverlays.get(workspaceId);
    if (!node) return false;
    node.dispose(false, true); // also dispose the mesh/material/texture it owns
    this.mapOverlays.delete(workspaceId);
    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: GeoSyncEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: GeoSyncEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private createObjectNode(object: GeoSyncObject): TransformNode {
    const node = new TransformNode(`geosync_object_${object.id}`, this.scene);
    node.position = object.position;
    node.rotationQuaternion = object.rotation;

    // Create a simple visual representation
    const sphere = MeshBuilder.CreateSphere(`object_mesh_${object.id}`, { diameter: 0.2 }, this.scene);
    sphere.position = node.position;
    sphere.material = new StandardMaterial(`object_material_${object.id}`, this.scene);
    (sphere.material as StandardMaterial).diffuseColor = Color3.Green();

    node.addChild(sphere);

    return node;
  }

  private async startLocationTracking(): Promise<void> {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            timestamp: new Date(),
          };
          if (!this.originLocation) {
            this.originLocation = this.currentLocation;
          }

          this.emitEvent({
            type: 'location_updated',
            timestamp: new Date(),
            data: this.currentLocation,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000,
        }
      );

      // Store watch ID for cleanup
      (this as any).locationWatchId = watchId;
    } else {
      console.warn('Geolocation is not supported by this browser');
    }
  }

  private stopLocationTracking(): void {
    if ((this as any).locationWatchId) {
      navigator.geolocation.clearWatch((this as any).locationWatchId);
      (this as any).locationWatchId = null;
    }
  }

  private async loadObjects(): Promise<void> {
    if (!this.hasRealEndpoint) {
      return; // No remote geo-sync service configured - objects stay local-only.
    }
    try {
      const response = await fetch(`${this.options.apiEndpoint}/objects`, {
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load objects: ${response.status}`);
      }
      const objects = await response.json();
      objects.forEach((obj: any) => {
        this.objects.set(obj.id, { ...obj, node: this.createObjectNode(obj) });
      });
    } catch (error) {
      console.error('Failed to load objects:', error);
    }
  }

  private async syncObject(object: GeoSyncObject): Promise<void> {
    if (!this.hasRealEndpoint) {
      return;
    }
    try {
      const response = await fetch(`${this.options.apiEndpoint}/objects/${object.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(object),
      });
      if (!response.ok) {
        throw new Error(`Failed to sync object: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to sync object ${object.id}:`, error);
    }
  }

  private async deleteRemoteObject(objectId: string): Promise<void> {
    if (!this.hasRealEndpoint) {
      return;
    }
    try {
      const response = await fetch(`${this.options.apiEndpoint}/objects/${objectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to delete remote object: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to delete remote object ${objectId}:`, error);
    }
  }

  private emitEvent(event: GeoSyncEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in geo-sync event listener:', error);
      }
    });
  }
}

export interface GeoSyncEvent {
  type: 'object_registered' | 'object_unregistered' | 'position_updated' | 'sync_completed' | 'location_updated' | 'workspace_created' | 'workspace_removed' | 'map_overlay_added';
  objectId?: string;
  timestamp: Date;
  data?: any;
}
