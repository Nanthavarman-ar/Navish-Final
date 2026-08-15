import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Physics/physicsEngineComponent';

export interface PhysicsConfig {
  engine: 'havok' | 'cannon' | 'ammo' | 'oimo';
  gravity: BABYLON.Vector3;
  enableDebugMode: boolean;
  enableCCD: boolean;
  timeStep: number;
}

export class PhysicsManager {
  private scene: BABYLON.Scene;
  private config: PhysicsConfig;
  private physicsPlugin: BABYLON.IPhysicsEnginePlugin | null = null;

  constructor(scene: BABYLON.Scene, config?: Partial<PhysicsConfig>) {
    this.scene = scene;
    this.config = {
      engine: 'havok',
      gravity: new BABYLON.Vector3(0, -9.81, 0),
      enableDebugMode: false,
      enableCCD: true,
      timeStep: 1 / 60,
      ...config
    };

    this.initializePhysics();
  }

  private async initializePhysics() {
    switch (this.config.engine) {
      case 'havok':
        try {
          // Note: Havok import may vary by version
          const Havok = await import('@babylonjs/havok');
          this.physicsPlugin = new (Havok as any).HavokPlugin();
        } catch (error) {
          console.warn('Failed to load Havok physics engine, falling back to Cannon.js');
          this.config.engine = 'cannon';
          this.initializePhysics();
          return;
        }
        break;
      case 'cannon':
        try {
          const Cannon = await import('cannon');
          this.physicsPlugin = new BABYLON.CannonJSPlugin(true, 10, Cannon);
        } catch (error) {
          console.warn('Failed to load Cannon.js physics engine');
          this.physicsPlugin = null;
        }
        break;
      case 'ammo':
        try {
          const Ammo = await import('ammo.js');
          this.physicsPlugin = new BABYLON.AmmoJSPlugin(true, Ammo);
        } catch (error) {
          console.warn('Failed to load Ammo.js physics engine');
          this.physicsPlugin = null;
        }
        break;
      case 'oimo':
        try {
          const Oimo = await import('oimo');
          this.physicsPlugin = new BABYLON.OimoJSPlugin();
        } catch (error) {
          console.warn('Failed to load Oimo physics engine');
          this.physicsPlugin = null;
        }
        break;
      default:
        console.warn('Unknown physics engine specified, defaulting to Cannon.js');
        this.config.engine = 'cannon';
        this.initializePhysics();
        break;
    }

    if (this.physicsPlugin) {
      this.scene.enablePhysics(this.config.gravity, this.physicsPlugin);
      if (this.config.enableDebugMode) {
        this.scene.debugLayer.show();
      }
    }
  }

  public updateConfig(newConfig: Partial<PhysicsConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (this.scene.isPhysicsEnabled()) {
      this.scene.disablePhysicsEngine();
    }
    this.initializePhysics();
  }

  public dispose() {
    if (this.scene.isPhysicsEnabled()) {
      this.scene.disablePhysicsEngine();
    }
    this.physicsPlugin = null;
  }
}
