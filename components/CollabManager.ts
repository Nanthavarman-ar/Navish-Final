import { Scene, TransformNode, Vector3, Quaternion, Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { io, Socket } from 'socket.io-client';

export interface CollabUser {
  id: string;
  name: string;
  avatar?: string;
  position: Vector3;
  rotation: Quaternion;
  color: Color3;
  isOnline: boolean;
  lastSeen: Date;
  node?: TransformNode;
}

export interface CollabObject {
  id: string;
  name: string;
  type: 'model' | 'annotation' | 'measurement' | 'note';
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  ownerId: string;
  isShared: boolean;
  metadata?: any;
  node?: TransformNode;
}

export interface CollabManagerOptions {
  serverUrl?: string;
  apiKey?: string;
  roomId?: string;
  userId?: string;
  userName?: string;
  enableRealTimeSync?: boolean;
  syncInterval?: number;
  maxUsers?: number;
  enableVoiceChat?: boolean;
  enableScreenShare?: boolean;
}

export class CollabManager {
  private scene: Scene;
  private users: Map<string, CollabUser> = new Map();
  private objects: Map<string, CollabObject> = new Map();
  private options: Required<CollabManagerOptions>;
  private eventListeners: Array<(event: CollabEvent) => void> = [];
  private isConnected: boolean = false;
  // Distinct from "still connecting" - set once socket.io has exhausted every
  // reconnection attempt, so the UI can show "couldn't connect" instead of an infinite
  // "Connecting..." that never resolves either way.
  private connectionFailed: boolean = false;
  private currentUser: CollabUser | null = null;
  private socket: Socket | null = null;
  private syncEnabled: boolean = true;
  // Voice chat (WebRTC, full-mesh - each participant connects directly to every other
  // participant, which is fine for the small rooms this product targets). Signaling
  // (offer/answer/ICE) rides over the existing 'signal' relay the server already has.
  private localAudioStream: MediaStream | null = null;
  private voicePeers: Map<string, RTCPeerConnection> = new Map(); // keyed by userId
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map(); // keyed by userId
  private userIdToSocketId: Map<string, string> = new Map();
  private voiceChatEnabled: boolean = false;
  private chatHistory: ChatMessage[] = [];
  private positionBroadcastInterval: ReturnType<typeof setInterval> | null = null;
  private getLocalCameraTransform: (() => { position: Vector3; rotation: Quaternion } | null) | null = null;

  constructor(scene: Scene, options: CollabManagerOptions = {}) {
    this.scene = scene;
    this.options = {
      // The real signaling server (server/server.js) is a standalone process, not part
      // of the Supabase Edge Function backend - it needs to be deployed and reachable
      // at its own URL. Defaults to localhost for local dev (`npm run dev:full` starts
      // it on port 3004); set VITE_COLLAB_SERVER_URL for a deployed environment.
      serverUrl: options.serverUrl || (import.meta as any).env?.VITE_COLLAB_SERVER_URL || 'http://localhost:3004',
      apiKey: options.apiKey || '',
      roomId: options.roomId || 'default-room',
      userId: options.userId || this.generateUserId(),
      userName: options.userName || 'Anonymous User',
      enableRealTimeSync: options.enableRealTimeSync ?? true,
      syncInterval: options.syncInterval ?? 1000, // 1 second
      maxUsers: options.maxUsers ?? 50,
      enableVoiceChat: options.enableVoiceChat ?? false,
      enableScreenShare: options.enableScreenShare ?? false,
    };
  }

  /**
   * Register a function that returns the local camera's current position/rotation.
   * Needed so the manager can actually broadcast where this user is looking/standing -
   * without this, other participants would connect but never see this user move.
   */
  setLocalCameraProvider(provider: () => { position: Vector3; rotation: Quaternion } | null): void {
    this.getLocalCameraTransform = provider;
  }

  /**
   * Enable real-time position/object sync broadcasting.
   */
  enableSync(): void {
    this.syncEnabled = true;
    this.startPositionBroadcast();
  }

  /**
   * Disable real-time sync broadcasting without disconnecting from the room.
   */
  disableSync(): void {
    this.syncEnabled = false;
    this.stopPositionBroadcast();
  }

  private startPositionBroadcast(): void {
    this.stopPositionBroadcast();
    if (!this.options.enableRealTimeSync) return;
    this.positionBroadcastInterval = setInterval(() => {
      if (!this.syncEnabled || !this.isConnected || !this.getLocalCameraTransform) return;
      const transform = this.getLocalCameraTransform();
      if (transform) {
        this.updateUserPosition(transform.position, transform.rotation);
      }
    }, this.options.syncInterval);
  }

  private stopPositionBroadcast(): void {
    if (this.positionBroadcastInterval !== null) {
      clearInterval(this.positionBroadcastInterval);
      this.positionBroadcastInterval = null;
    }
  }

  /**
   * Connect to the collaboration server
   */
  async connect(): Promise<boolean> {
    this.connectionFailed = false;
    return new Promise((resolve) => {
      try {
        console.log(`Connecting to collaboration server: ${this.options.serverUrl}`);

        this.socket = io(this.options.serverUrl, {
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
          auth: this.options.apiKey ? { apiKey: this.options.apiKey } : undefined,
        });

        let settled = false;

        this.socket.on('connect', () => {
          console.log('Connected to collaboration server');
          this.isConnected = true;
          this.connectionFailed = false;
          this.joinRoom();
          this.startPositionBroadcast();
          if (!settled) { settled = true; resolve(true); }
        });

        this.registerServerEventHandlers();

        this.socket.on('disconnect', () => {
          console.log('Disconnected from collaboration server');
          this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('Collaboration server connection error:', error);
          if (!settled) { settled = true; resolve(false); }
        });

        // Fires once socket.io has used up all reconnectionAttempts (5, set above) -
        // without this, a permanently unreachable server (wrong URL, not deployed, etc)
        // left isConnected stuck at false forever with no way to tell "still trying"
        // apart from "gave up", so the UI just showed "Connecting..." indefinitely.
        this.socket.on('reconnect_failed', () => {
          console.error('Collaboration server: all reconnection attempts failed');
          this.connectionFailed = true;
          if (!settled) { settled = true; resolve(false); }
        });

        // Don't hang forever if the server never responds
        setTimeout(() => {
          if (!settled) { settled = true; resolve(this.isConnected); }
        }, 10000);
      } catch (error) {
        console.error('Failed to connect to collaboration server:', error);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from the collaboration server
   */
  async disconnect(): Promise<void> {
    try {
      this.stopPositionBroadcast();
      if (this.socket) {
        this.socket.emit('leave', { room: this.options.roomId });
        this.socket.disconnect();
        this.socket = null;
      }
      this.isConnected = false;
      console.log('Disconnected from collaboration server');
    } catch (error) {
      console.error('Error disconnecting from collaboration server:', error);
    }
  }

  /**
   * Join the collaboration room
   */
  private joinRoom(): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.currentUser = {
      id: this.options.userId,
      name: this.options.userName,
      position: Vector3.Zero(),
      rotation: Quaternion.Identity(),
      color: this.generateUserColor(),
      isOnline: true,
      lastSeen: new Date(),
    };

    this.socket.emit('join', {
      room: this.options.roomId,
      name: this.options.userName,
      userId: this.options.userId,
    });

    this.emitEvent({
      type: 'user_joined',
      userId: this.currentUser.id,
      timestamp: new Date(),
      data: this.currentUser,
    });
  }

  /**
   * Update current user position
   */
  async updateUserPosition(position: Vector3, rotation: Quaternion): Promise<void> {
    if (!this.currentUser) {
      return;
    }

    this.currentUser.position = position.clone();
    this.currentUser.rotation = rotation.clone();
    this.currentUser.lastSeen = new Date();

    if (this.socket && this.isConnected) {
      this.socket.emit('transform', {
        room: this.options.roomId,
        id: this.currentUser.id,
        transform: { position, rotation },
      });
    }

    this.emitEvent({
      type: 'user_moved',
      userId: this.currentUser.id,
      timestamp: new Date(),
      data: { position, rotation },
    });
  }

  /**
   * Create a collaboration object
   */
  async createObject(object: Omit<CollabObject, 'node'>): Promise<CollabObject> {
    const fullObject: CollabObject = {
      ...object,
      node: this.createObjectNode(object),
    };

    this.objects.set(object.id, fullObject);

    if (this.socket && this.isConnected) {
      this.socket.emit('object-sync', {
        room: this.options.roomId,
        type: 'create',
        objectId: object.id,
        data: fullObject,
      });
    }

    this.emitEvent({
      type: 'object_created',
      objectId: object.id,
      userId: object.ownerId,
      timestamp: new Date(),
      data: object,
    });

    return fullObject;
  }

  /**
   * Update collaboration object
   */
  async updateObject(objectId: string, updates: Partial<CollabObject>): Promise<boolean> {
    const object = this.objects.get(objectId);
    if (!object) {
      return false;
    }

    Object.assign(object, updates);

    if (object.node) {
      object.node.position = object.position;
      object.node.rotationQuaternion = object.rotation;
      object.node.scaling = object.scale;
    }

    if (this.socket && this.isConnected) {
      this.socket.emit('object-sync', {
        room: this.options.roomId,
        type: 'update',
        objectId,
        data: updates,
      });
    }

    this.emitEvent({
      type: 'object_updated',
      objectId,
      userId: object.ownerId,
      timestamp: new Date(),
      data: updates,
    });

    return true;
  }

  /**
   * Delete collaboration object
   */
  async deleteObject(objectId: string): Promise<boolean> {
    const object = this.objects.get(objectId);
    if (!object) {
      return false;
    }

    if (object.node) {
      object.node.dispose();
    }

    this.objects.delete(objectId);

    if (this.socket && this.isConnected) {
      this.socket.emit('object-sync', {
        room: this.options.roomId,
        type: 'delete',
        objectId,
      });
    }

    this.emitEvent({
      type: 'object_deleted',
      objectId,
      userId: object.ownerId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Get all users in the room
   */
  getUsers(): CollabUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): CollabUser | undefined {
    return this.users.get(userId);
  }

  /**
   * Get current user
   */
  getCurrentUser(): CollabUser | null {
    return this.currentUser;
  }

  /**
   * Get all objects
   */
  getObjects(): CollabObject[] {
    return Array.from(this.objects.values());
  }

  /**
   * Get object by ID
   */
  getObject(objectId: string): CollabObject | undefined {
    return this.objects.get(objectId);
  }

  /**
   * Get objects by user
   */
  getObjectsByUser(userId: string): CollabObject[] {
    return this.getObjects().filter(obj => obj.ownerId === userId);
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: CollabEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: CollabEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private createObjectNode(object: CollabObject): TransformNode {
    const node = new TransformNode(`collab_object_${object.id}`, this.scene);
    node.position = object.position;
    node.rotationQuaternion = object.rotation;
    node.scaling = object.scale;

    // Create visual representation based on object type
    let mesh;
    switch (object.type) {
      case 'model':
        mesh = MeshBuilder.CreateBox(`object_mesh_${object.id}`, { size: 0.2 }, this.scene);
        break;
      case 'annotation':
        mesh = MeshBuilder.CreateSphere(`object_mesh_${object.id}`, { diameter: 0.1 }, this.scene);
        break;
      case 'measurement':
        mesh = MeshBuilder.CreateCylinder(`object_mesh_${object.id}`, { height: 0.3, diameter: 0.05 }, this.scene);
        break;
      case 'note':
        mesh = MeshBuilder.CreatePlane(`object_mesh_${object.id}`, { size: 0.2 }, this.scene);
        break;
      default:
        mesh = MeshBuilder.CreateBox(`object_mesh_${object.id}`, { size: 0.1 }, this.scene);
    }

    mesh.position = node.position;
    mesh.material = new StandardMaterial(`object_material_${object.id}`, this.scene);
    (mesh.material as StandardMaterial).diffuseColor = Color3.Yellow();

    node.addChild(mesh);

    return node;
  }

  /**
   * Enable voice chat: grabs the local microphone and starts calling everyone
   * currently in the room. New joiners are called automatically while enabled.
   */
  async enableVoiceChat(): Promise<boolean> {
    if (this.voiceChatEnabled) return true;
    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Microphone access denied or unavailable:', error);
      return false;
    }
    this.voiceChatEnabled = true;
    // Call everyone already in the room
    this.userIdToSocketId.forEach((_socketId, userId) => this.callPeer(userId));
    return true;
  }

  /**
   * Disable voice chat: closes all peer connections and releases the microphone.
   */
  disableVoiceChat(): void {
    this.voiceChatEnabled = false;
    this.voicePeers.forEach((pc) => pc.close());
    this.voicePeers.clear();
    this.remoteAudioElements.forEach((audio) => { audio.pause(); audio.srcObject = null; });
    this.remoteAudioElements.clear();
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((track) => track.stop());
      this.localAudioStream = null;
    }
  }

  /**
   * Mute/unmute the local microphone without tearing down the peer connections.
   */
  setVoiceChatMuted(muted: boolean): void {
    this.localAudioStream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }

  isVoiceChatEnabled(): boolean {
    return this.voiceChatEnabled;
  }

  /**
   * Whether this manager currently has a live connection to the collaboration server.
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * True once every reconnection attempt has been exhausted with no successful
   * connection - the server is unreachable and retrying automatically has stopped.
   */
  getConnectionFailed(): boolean {
    return this.connectionFailed;
  }

  private getOrCreatePeerConnection(userId: string): RTCPeerConnection {
    let pc = this.voicePeers.get(userId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((track) => pc!.addTrack(track, this.localAudioStream!));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(userId, { type: 'ice-candidate', candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      let audio = this.remoteAudioElements.get(userId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.remoteAudioElements.set(userId, audio);
      }
      audio.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
        this.voicePeers.delete(userId);
      }
    };

    this.voicePeers.set(userId, pc);
    return pc;
  }

  private async callPeer(userId: string): Promise<void> {
    if (userId === this.currentUser?.id || !this.userIdToSocketId.has(userId)) return;
    const pc = this.getOrCreatePeerConnection(userId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal(userId, { type: 'offer', sdp: offer });
    } catch (error) {
      console.error(`Failed to create voice call offer for ${userId}:`, error);
    }
  }

  private sendSignal(toUserId: string, data: any): void {
    const toSocketId = this.userIdToSocketId.get(toUserId);
    if (!toSocketId || !this.socket) return;
    this.socket.emit('signal', { to: toSocketId, data: { ...data, fromUserId: this.currentUser?.id } });
  }

  private async handleSignal(fromSocketId: string, data: any): Promise<void> {
    const fromUserId: string | undefined = data.fromUserId;
    if (!fromUserId) return;
    // Keep the socketId mapping fresh in case presence hasn't been processed yet
    this.userIdToSocketId.set(fromUserId, fromSocketId);

    if (!this.voiceChatEnabled && data.type === 'offer') {
      // Someone is calling us but we haven't opted into voice chat - politely ignore.
      return;
    }

    const pc = this.getOrCreatePeerConnection(fromUserId);

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(fromUserId, { type: 'answer', sdp: answer });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'ice-candidate' && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error(`Voice chat signaling error with ${fromUserId}:`, error);
    }
  }

  /**
   * Broadcast where this user is currently pointing in the 3D scene (e.g. mouse pick
   * point on a mesh), so other participants see a live pointer marker. Pass null when
   * not hovering anything to hide the local user's marker for everyone else.
   */
  /**
   * Send a text chat message to everyone in the room.
   */
  sendChatMessage(text: string): boolean {
    if (!this.currentUser || !this.socket || !this.isConnected || !text.trim()) return false;
    this.socket.emit('chat', {
      room: this.options.roomId,
      id: this.currentUser.id,
      name: this.currentUser.name,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Get the chat history received so far in this session (not persisted server-side -
   * new joiners won't see messages sent before they connected).
   */
  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  updateCursorPosition(point: Vector3 | null): void {
    if (!this.currentUser || !this.socket || !this.isConnected) return;
    this.socket.emit('cursor', {
      room: this.options.roomId,
      id: this.currentUser.id,
      point: point ? { x: point.x, y: point.y, z: point.z } : null,
    });
  }

  private cursorMarkers: Map<string, TransformNode> = new Map();

  private handleRemoteCursor(userId: string, point: { x: number; y: number; z: number } | null): void {
    if (userId === this.currentUser?.id) return;
    let marker = this.cursorMarkers.get(userId);

    if (!point) {
      // User stopped pointing at anything - hide their marker.
      if (marker) marker.setEnabled(false);
      return;
    }

    if (!marker) {
      const user = this.users.get(userId);
      const sphere = MeshBuilder.CreateSphere(`cursor_${userId}`, { diameter: 0.06 }, this.scene);
      const mat = new StandardMaterial(`cursor_mat_${userId}`, this.scene);
      mat.diffuseColor = user?.color || new Color3(1, 1, 0);
      mat.emissiveColor = (user?.color || new Color3(1, 1, 0)).scale(0.6);
      sphere.material = mat;
      marker = sphere;
      this.cursorMarkers.set(userId, marker);
    }

    marker.setEnabled(true);
    marker.position.set(point.x, point.y, point.z);
  }

  private createUserNode(user: CollabUser): TransformNode {
    const node = new TransformNode(`collab_user_${user.id}`, this.scene);
    node.position = user.position;
    node.rotationQuaternion = user.rotation;

    // Create avatar representation
    const avatar = MeshBuilder.CreateCapsule(`user_avatar_${user.id}`, { height: 1.8, radius: 0.3 }, this.scene);
    avatar.position = node.position;
    avatar.material = new StandardMaterial(`user_material_${user.id}`, this.scene);
    (avatar.material as StandardMaterial).diffuseColor = user.color;

    node.addChild(avatar);

    return node;
  }

  // Wire up handlers matching the REAL server's actual event names/payload shapes
  // (server/server.js): presence, people, user-left, transform, anim, object-sync,
  // scene-sync. These replace the previous invented protocol that never matched
  // anything the server actually sends.
  private registerServerEventHandlers(): void {
    if (!this.socket) return;

    // A single other user just joined the room
    this.socket.on('presence', (data: { id: string; name: string; userId: string }) => {
      this.userIdToSocketId.set(data.userId, data.id);
      this.handleUserJoined({
        id: data.userId,
        name: data.name,
        position: Vector3.Zero(),
        rotation: Quaternion.Identity(),
        color: this.generateUserColor(),
        isOnline: true,
        lastSeen: new Date(),
      });
      // If voice chat is on, call the new participant (they'll answer via their own
      // 'presence' handling of us, or we initiate - whoever's code runs first offers).
      if (this.voiceChatEnabled) {
        this.callPeer(data.userId);
      }
    });

    // Full roster of users already in the room, sent once on join
    this.socket.on('people', (people: Array<{ id: string; name: string; userId: string }>) => {
      people.forEach((p) => {
        this.userIdToSocketId.set(p.userId, p.id);
        this.handleUserJoined({
          id: p.userId,
          name: p.name,
          position: Vector3.Zero(),
          rotation: Quaternion.Identity(),
          color: this.generateUserColor(),
          isOnline: true,
          lastSeen: new Date(),
        });
        if (this.voiceChatEnabled) {
          this.callPeer(p.userId);
        }
      });
    });

    this.socket.on('user-left', (data: { id: string; userId?: string }) => {
      this.handleUserLeft(data.userId || data.id);
    });

    this.socket.on('transform', (payload: { id: string; transform: { position: any; rotation: any } }) => {
      const position = payload.transform?.position
        ? new Vector3(payload.transform.position.x, payload.transform.position.y, payload.transform.position.z)
        : Vector3.Zero();
      const r = payload.transform?.rotation;
      const rotation = r ? new Quaternion(r.x, r.y, r.z, r.w) : Quaternion.Identity();
      this.handleUserUpdate(payload.id, position, rotation);
    });

    this.socket.on('cursor', (payload: { id: string; point: { x: number; y: number; z: number } | null }) => {
      this.handleRemoteCursor(payload.id, payload.point);
    });

    this.socket.on('signal', (payload: { from: string; data: any }) => {
      this.handleSignal(payload.from, payload.data);
    });

    this.socket.on('chat', (payload: { id: string; name: string; text: string; timestamp: string }) => {
      const message: ChatMessage = {
        userId: payload.id,
        userName: payload.name,
        text: payload.text,
        timestamp: new Date(payload.timestamp),
      };
      this.chatHistory.push(message);
      this.emitEvent({
        type: 'chat_message',
        userId: payload.id,
        timestamp: message.timestamp,
        data: message,
      });
    });

    this.socket.on('object-sync', (event: { type: string; objectId: string; data: any }) => {
      switch (event.type) {
        case 'create':
          this.handleObjectCreated(event.data);
          break;
        case 'update':
        case 'transform':
        case 'material':
        case 'animation':
          this.handleObjectUpdated(event.objectId, event.data);
          break;
        case 'delete':
          this.handleObjectDeleted(event.objectId);
          break;
      }
    });

    // Full scene state, sent to newly-joined clients so they see what's already there
    this.socket.on('scene-sync', (sceneState: { objects: CollabObject[] }) => {
      (sceneState.objects || []).forEach((obj) => this.handleObjectCreated(obj));
    });
  }

  private handleUserJoined(user: CollabUser): void {
    if (user.id !== this.currentUser?.id && !this.users.has(user.id)) {
      user.node = this.createUserNode(user);
      this.users.set(user.id, user);

      this.emitEvent({
        type: 'user_joined',
        userId: user.id,
        timestamp: new Date(),
        data: user,
      });
    }
  }

  private handleUserLeft(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      if (user.node) {
        user.node.dispose();
      }
      this.users.delete(userId);

      const marker = this.cursorMarkers.get(userId);
      if (marker) {
        marker.dispose();
        this.cursorMarkers.delete(userId);
      }

      const peer = this.voicePeers.get(userId);
      if (peer) {
        peer.close();
        this.voicePeers.delete(userId);
      }
      const audio = this.remoteAudioElements.get(userId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        this.remoteAudioElements.delete(userId);
      }
      this.userIdToSocketId.delete(userId);

      this.emitEvent({
        type: 'user_left',
        userId,
        timestamp: new Date(),
      });
    }
  }

  private handleUserUpdate(userId: string, position: Vector3, rotation: Quaternion): void {
    const user = this.users.get(userId);
    if (user) {
      user.position = position;
      user.rotation = rotation;
      user.lastSeen = new Date();

      if (user.node) {
        user.node.position = position;
        user.node.rotationQuaternion = rotation;
      }

      this.emitEvent({
        type: 'user_moved',
        userId,
        timestamp: new Date(),
        data: { position, rotation },
      });
    }
  }

  private handleObjectCreated(object: CollabObject): void {
    if (this.objects.has(object.id)) return; // already have it (e.g. from scene-sync + object-sync race)
    object.node = this.createObjectNode(object);
    this.objects.set(object.id, object);

    this.emitEvent({
      type: 'object_created',
      objectId: object.id,
      userId: object.ownerId,
      timestamp: new Date(),
      data: object,
    });
  }

  private handleObjectUpdated(objectId: string, updates: Partial<CollabObject>): void {
    const object = this.objects.get(objectId);
    if (object) {
      Object.assign(object, updates);

      if (object.node) {
        object.node.position = object.position;
        object.node.rotationQuaternion = object.rotation;
        object.node.scaling = object.scale;
      }

      this.emitEvent({
        type: 'object_updated',
        objectId,
        userId: object.ownerId,
        timestamp: new Date(),
        data: updates,
      });
    }
  }

  private handleObjectDeleted(objectId: string): void {
    const object = this.objects.get(objectId);
    if (object) {
      if (object.node) {
        object.node.dispose();
      }
      this.objects.delete(objectId);

      this.emitEvent({
        type: 'object_deleted',
        objectId,
        userId: object.ownerId,
        timestamp: new Date(),
      });
    }
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  private generateUserColor(): Color3 {
    const colors = [
      new Color3(1, 0, 0), // Red
      new Color3(0, 1, 0), // Green
      new Color3(0, 0, 1), // Blue
      new Color3(1, 1, 0), // Yellow
      new Color3(0.5, 0, 0.5), // Purple
      new Color3(0, 1, 1), // Cyan
      new Color3(1, 0, 1), // Magenta
      new Color3(1, 0.5, 0), // Orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private emitEvent(event: CollabEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in collaboration event listener:', error);
      }
    });
  }

  /**
   * Update the collaboration manager (called per frame)
   */
  update(): void {
    // Per-frame collaboration updates (e.g. throttled position broadcasts) can hook in
    // here if needed; socket.io-client handles its own heartbeat/reconnection.
  }

  /**
   * Dispose of the collaboration manager resources
   */
  dispose(): void {
    this.stopPositionBroadcast();
    this.disableVoiceChat();
    if (this.socket) {
      this.socket.emit('leave', { room: this.options.roomId });
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear all users and objects
    this.users.forEach((user) => user.node?.dispose());
    this.objects.forEach((object) => object.node?.dispose());
    this.cursorMarkers.forEach((marker) => marker.dispose());
    this.cursorMarkers.clear();
    this.users.clear();
    this.objects.clear();

    // Clear event listeners
    this.eventListeners.length = 0;

    console.log('CollabManager disposed');
  }
}

export interface ChatMessage {
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
}

export interface CollabEvent {
  type: 'user_joined' | 'user_left' | 'user_moved' | 'object_created' | 'object_updated' | 'object_deleted' | 'chat_message';
  userId?: string;
  objectId?: string;
  timestamp: Date;
  data?: any;
}
