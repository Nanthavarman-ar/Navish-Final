import * as BABYLON from '@babylonjs/core';
import { GPSCoordinates } from './GPSTransformUtils';

// AR Cloud Anchors implementation

export interface AnchorData {
  id: string;
  position: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  timestamp?: Date;
  gpsCoordinates?: GPSCoordinates;
  modelUrl?: string;
  userId?: string;
  roomId?: string;
  sessionId?: string;
  deviceId?: string;
  version?: number;
}
export class ARCloudAnchors {
  public scene?: BABYLON.Scene;

  private anchors: Map<string, AnchorData> = new Map();
  private callbacks?: {
    onAnchorPlaced?: (anchor: AnchorData) => void;
    onAnchorRemoved?: (anchorId: string) => void;
  };
  private checkAREnabled: () => boolean;

  // isAREnabledCheck lets the caller wire this up to a real XR session state check
  // (e.g. xrManager.getXRState().isInSession) - this used to unconditionally return
  // true regardless of whether an AR session was actually active, which made
  // ARAnchorUI's "Place New Anchor" button always look clickable/enabled even outside
  // AR. Defaults to true only if no check is supplied, so existing/other callers keep
  // their prior behavior.
  constructor(scene?: BABYLON.Scene, isAREnabledCheck?: () => boolean) {
    this.scene = scene;
    this.checkAREnabled = isAREnabledCheck ?? (() => true);
  }

  async createAnchor(position: BABYLON.Vector3, rotation?: BABYLON.Vector3, options?: Partial<AnchorData>): Promise<string> {
    const anchorId = `anchor_${Date.now()}`;
    const anchor: AnchorData = {
      id: anchorId,
      position,
      rotation,
      timestamp: new Date(),
      ...options
    };
    this.anchors.set(anchorId, anchor);
    this.callbacks?.onAnchorPlaced?.(anchor);
    return anchorId;
  }

  async resolveAnchor(anchorId: string): Promise<any | null> {
    return this.anchors.get(anchorId) || null;
  }

  async deleteAnchor(anchorId: string): Promise<void> {
    this.anchors.delete(anchorId);
    this.callbacks?.onAnchorRemoved?.(anchorId);
  }

  getAnchors(): AnchorData[] {
    return Array.from(this.anchors.values());
  }

  setCallbacks(callbacks: {
    onAnchorPlaced?: (anchor: AnchorData) => void;
    onAnchorRemoved?: (anchorId: string) => void;
  }): void {
    this.callbacks = callbacks;
  }

  isAREnabled(): boolean {
    return this.checkAREnabled();
  }

  getAllAnchors(): string[] {
    return Array.from(this.anchors.keys());
  }
}
