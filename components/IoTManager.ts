import { Scene, TransformNode, Vector3, Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { supabase } from '../supabase/client';

export interface IoTDevice {
  id: string;
  name: string;
  type: 'sensor' | 'actuator' | 'gateway';
  position: Vector3;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  data?: any;
  node?: TransformNode;
}

export interface IoTSensorData {
  deviceId: string;
  timestamp: Date;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  light?: number;
  motion?: boolean;
  [key: string]: any;
}

export interface IoTManagerOptions {
  serverUrl?: string;
  apiKey?: string;
  autoSync?: boolean;
  syncInterval?: number;
  enableRealTimeUpdates?: boolean;
}

export class IoTManager {
  private scene: Scene;
  private devices: Map<string, IoTDevice> = new Map();
  private options: Required<IoTManagerOptions>;
  private eventListeners: Array<(event: IoTEvent) => void> = [];
  private isConnected: boolean = false;
  private static readonly PLACEHOLDER_URL = 'https://api.iot.example.com';
  private hasRealEndpoint: boolean;

  constructor(scene: Scene, options: IoTManagerOptions = {}) {
    this.scene = scene;
    this.hasRealEndpoint = !!options.serverUrl && options.serverUrl !== IoTManager.PLACEHOLDER_URL;
    this.options = {
      serverUrl: options.serverUrl || IoTManager.PLACEHOLDER_URL,
      apiKey: options.apiKey || '',
      autoSync: options.autoSync ?? true,
      syncInterval: options.syncInterval ?? 5000, // 5 seconds
      enableRealTimeUpdates: options.enableRealTimeUpdates ?? true,
    };
  }

  // Real backend routes (server/index.tsx) are behind Supabase auth (verifyUser), so
  // requests need the current user's access token, not just the static apiKey option.
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else if (this.options.apiKey) {
        headers['Authorization'] = `Bearer ${this.options.apiKey}`;
      }
    } catch {
      if (this.options.apiKey) {
        headers['Authorization'] = `Bearer ${this.options.apiKey}`;
      }
    }
    return headers;
  }

  /**
   * Connect to the IoT server
   */
  async connect(): Promise<boolean> {
    try {
      if (!this.hasRealEndpoint) {
        console.log('No real IoT server configured - running in local-only mode (devices registered in-session only).');
        this.isConnected = true;
        return true;
      }
      console.log(`Connecting to IoT server: ${this.options.serverUrl}`);
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.options.serverUrl}/api/iot/devices`, { headers });
      if (!response.ok) {
        throw new Error(`IoT server responded with ${response.status}`);
      }
      this.isConnected = true;
      await this.loadDevices();
      return true;
    } catch (error) {
      console.error('Failed to connect to IoT server:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from the IoT server
   */
  async disconnect(): Promise<void> {
    try {
      this.isConnected = false;
      console.log('Disconnected from IoT server');
    } catch (error) {
      console.error('Error disconnecting from IoT server:', error);
    }
  }

  /**
   * Register a new IoT device
   */
  async registerDevice(device: Omit<IoTDevice, 'node'>): Promise<IoTDevice> {
    const fullDevice: IoTDevice = {
      ...device,
      node: this.createDeviceNode(device),
    };

    this.devices.set(device.id, fullDevice);

    if (this.options.autoSync) {
      await this.syncDevice(fullDevice);
    }

    this.emitEvent({
      type: 'device_registered',
      deviceId: device.id,
      timestamp: new Date(),
      data: device,
    });

    return fullDevice;
  }

  /**
   * Unregister an IoT device
   */
  async unregisterDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    if (device.node) {
      device.node.dispose();
    }

    this.devices.delete(deviceId);

    if (this.options.autoSync) {
      await this.deleteRemoteDevice(deviceId);
    }

    this.emitEvent({
      type: 'device_unregistered',
      deviceId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Update device data
   */
  async updateDeviceData(deviceId: string, data: any): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    device.data = { ...device.data, ...data };
    device.lastSeen = new Date();

    // Update visual representation
    this.updateDeviceVisual(device);

    if (this.options.autoSync) {
      await this.syncDevice(device);
    }

    this.emitEvent({
      type: 'data_updated',
      deviceId,
      timestamp: new Date(),
      data,
    });

    return true;
  }

  /**
   * Get all devices
   */
  getDevices(): IoTDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get devices by type
   */
  getDevicesByType(type: IoTDevice['type']): IoTDevice[] {
    return this.getDevices().filter(device => device.type === type);
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): IoTDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Send command to device
   */
  async sendCommand(deviceId: string, command: string, params?: any): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== 'actuator') {
      return false;
    }

    try {
      const isBasicControl = command === 'on' || command === 'off' || command === 'toggle';
      if (this.hasRealEndpoint && isBasicControl) {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`${this.options.serverUrl}/api/iot/devices/${encodeURIComponent(deviceId)}/control`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ command }),
        });
        if (!response.ok) {
          throw new Error(`Device control request failed: ${response.status}`);
        }
      } else if (this.hasRealEndpoint) {
        // The backend's control endpoint only supports on/off/toggle today; anything
        // else (custom commands/params) can't be sent remotely yet.
        console.warn(`sendCommand: backend only supports on/off/toggle - '${command}' applied locally only.`);
      } else {
        console.log(`Sending command ${command} to device ${deviceId} (local-only, no server configured):`, params);
      }

      this.emitEvent({
        type: 'command_sent',
        deviceId,
        timestamp: new Date(),
        data: { command, params },
      });

      return true;
    } catch (error) {
      console.error(`Failed to send command to device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Get sensor data history
   *
   * NOTE: server/index.tsx currently exposes aggregate energy history
   * (GET /api/iot/energy-history) but no per-device time-range history endpoint yet,
   * so this can't be wired to a real backend call without a matching route being added
   * server-side. Returns an empty array rather than fabricating data.
   */
  async getSensorDataHistory(deviceId: string, startTime: Date, endTime: Date): Promise<IoTSensorData[]> {
    try {
      console.log(`getSensorDataHistory(${deviceId}): no matching backend endpoint yet, returning empty history.`);
      return [];
    } catch (error) {
      console.error(`Failed to get sensor data history for ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: IoTEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: IoTEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private createDeviceNode(device: IoTDevice): TransformNode {
    const node = new TransformNode(`iot_device_${device.id}`, this.scene);
    node.position = device.position;

    // Create visual representation based on device type
    this.createDeviceVisual(node, device);

    return node;
  }

  private createDeviceVisual(node: TransformNode, device: IoTDevice): void {
    // Remove existing visual elements
    node.getChildren().forEach(child => child.dispose());

    const color = this.getDeviceColor(device);
    const size = this.getDeviceSize(device);

    // Create a simple visual representation (box for actuators, sphere for sensors)
    let mesh;
    if (device.type === 'actuator') {
      mesh = MeshBuilder.CreateBox(`device_mesh_${device.id}`, { size }, this.scene);
    } else {
      mesh = MeshBuilder.CreateSphere(`device_mesh_${device.id}`, { diameter: size }, this.scene);
    }

    mesh.position = node.position;
    mesh.material = new StandardMaterial(`device_material_${device.id}`, this.scene);
    (mesh.material as StandardMaterial).diffuseColor = color;

    node.addChild(mesh);
  }

  private updateDeviceVisual(device: IoTDevice): void {
    if (device.node) {
      this.createDeviceVisual(device.node, device);
    }
  }

  private getDeviceColor(device: IoTDevice): Color3 {
    switch (device.status) {
      case 'online':
        return Color3.Green();
      case 'offline':
        return Color3.Gray();
      case 'error':
        return Color3.Red();
      default:
        return Color3.Yellow();
    }
  }

  private getDeviceSize(device: IoTDevice): number {
    switch (device.type) {
      case 'gateway':
        return 0.3;
      case 'actuator':
        return 0.2;
      case 'sensor':
        return 0.15;
      default:
        return 0.1;
    }
  }

  private async loadDevices(): Promise<void> {
    if (!this.hasRealEndpoint) {
      console.log('loadDevices: no real IoT server configured, skipping remote load.');
      return;
    }
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.options.serverUrl}/api/iot/devices`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to load devices: ${response.status}`);
      }
      const data = await response.json();
      const remoteDevices: any[] = data.devices || [];

      remoteDevices.forEach((remote) => {
        const existing = this.devices.get(remote.id);
        const device: IoTDevice = {
          id: remote.id,
          name: remote.name || remote.id,
          type: remote.type === 'sensor' ? 'sensor' : remote.controllable ? 'actuator' : 'gateway',
          // Keep the device's existing 3D placement if it's already in the scene;
          // otherwise place new devices at the origin until the user positions them.
          position: existing?.position || new Vector3(0, 0, 0),
          status: remote.status === 'on' || remote.status === 'active' ? 'online' : remote.status === 'error' ? 'error' : 'offline',
          lastSeen: new Date(),
          data: remote,
          node: existing?.node,
        };
        if (!device.node) {
          device.node = this.createDeviceNode(device);
        }
        this.devices.set(device.id, device);
      });

      console.log(`Loaded ${remoteDevices.length} devices from IoT server.`);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  }

  private async syncDevice(device: IoTDevice): Promise<void> {
    if (!this.hasRealEndpoint) {
      return;
    }
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.options.serverUrl}/api/iot/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(device),
      });
      if (!response.ok) {
        throw new Error(`Failed to sync device: ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to sync device ${device.id}:`, error);
    }
  }

  private async deleteRemoteDevice(deviceId: string): Promise<void> {
    // The backend (server/index.tsx) doesn't currently expose a device-delete route -
    // only sensor deletion (DELETE /api/iot/sensors/:sensorId) exists. Until a matching
    // device-delete endpoint is added server-side, this stays local-only; log clearly
    // rather than silently pretending to have deleted it remotely.
    if (this.hasRealEndpoint) {
      console.warn(`deleteRemoteDevice(${deviceId}): no device-delete endpoint exists on the backend yet - device removed locally only.`);
    }
  }

  private emitEvent(event: IoTEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in IoT event listener:', error);
      }
    });
  }

  /**
   * Update the IoT manager (called per frame)
   */
  update(): void {
    // Update device statuses, sync data, etc.
    // This method is called from the render loop
  }

  /**
   * Dispose of the IoT manager resources
   */
  dispose(): void {
    // Clear all devices
    this.devices.clear();

    // Clear event listeners
    this.eventListeners.length = 0;

    console.log('IoTManager disposed');
  }
}

export interface IoTEvent {
  type: 'device_registered' | 'device_unregistered' | 'data_updated' | 'command_sent' | 'connection_status_changed';
  deviceId?: string;
  timestamp: Date;
  data?: any;
}
