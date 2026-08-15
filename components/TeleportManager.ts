import * as BABYLON from "@babylonjs/core";

export interface TeleportOptions {
  scene: BABYLON.Scene;
  camera: BABYLON.Camera;
  enablePhysics?: boolean;
  maxDistance?: number;
  arcHeight?: number;
  fadeDuration?: number;
}

export interface TeleportTarget {
  position: BABYLON.Vector3;
  normal: BABYLON.Vector3;
  isValid: boolean;
  distance: number;
}

export class TeleportManager {
  private scene: BABYLON.Scene;
  private camera: BABYLON.Camera;
  private enablePhysics: boolean;
  private maxDistance: number;
  private arcHeight: number;
  private fadeDuration: number;

  private isActive: boolean = false;
  private teleportArc: BABYLON.LinesMesh | null = null;
  private teleportReticle: BABYLON.Mesh | null = null;
  private fadePlane: BABYLON.Mesh | null = null;
  private currentTarget: TeleportTarget | null = null;

  // Materials
  private arcMaterial: BABYLON.StandardMaterial | null = null;
  private reticleMaterial: BABYLON.StandardMaterial | null = null;
  private fadeMaterial: BABYLON.StandardMaterial | null = null;

  constructor(options: TeleportOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.enablePhysics = options.enablePhysics || false;
    this.maxDistance = options.maxDistance || 10;
    this.arcHeight = options.arcHeight || 2;
    this.fadeDuration = options.fadeDuration || 300;

    this.initializeMaterials();
    this.createTeleportReticle();
    this.createFadePlane();
  }

  private initializeMaterials() {
    // Arc material
    this.arcMaterial = new BABYLON.StandardMaterial("teleportArcMat", this.scene);
    this.arcMaterial.emissiveColor = new BABYLON.Color3(0, 1, 0);
    this.arcMaterial.alpha = 0.8;

    // Reticle material
    this.reticleMaterial = new BABYLON.StandardMaterial("teleportReticleMat", this.scene);
    this.reticleMaterial.emissiveColor = new BABYLON.Color3(0, 1, 0);
    this.reticleMaterial.alpha = 0.9;

    // Fade material
    this.fadeMaterial = new BABYLON.StandardMaterial("teleportFadeMat", this.scene);
    this.fadeMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    this.fadeMaterial.alpha = 0;
  }

  private createTeleportReticle() {
    // Create a ring-shaped reticle
    this.teleportReticle = BABYLON.MeshBuilder.CreateTorus("teleportReticle", {
      diameter: 0.5,
      thickness: 0.05,
      tessellation: 16
    }, this.scene);
    this.teleportReticle.material = this.reticleMaterial;
    this.teleportReticle.isVisible = false;
    this.teleportReticle.rotation.x = Math.PI / 2; // Lay flat on ground
  }

  private createFadePlane() {
    // Create a plane for fade effect
    this.fadePlane = BABYLON.MeshBuilder.CreatePlane("teleportFadePlane", { size: 100 }, this.scene);
    this.fadePlane.material = this.fadeMaterial;
    this.fadePlane.position.z = 1; // In front of camera
    this.fadePlane.isVisible = false;

    // Parent to camera so it follows
    this.fadePlane.parent = this.camera;
  }

  /**
   * Start teleport aiming mode
   */
  startTeleportAim() {
    if (this.isActive) return;
    this.isActive = true;
    this.teleportReticle!.isVisible = true;
  }

  /**
   * Update teleport aim based on controller direction
   */
  updateTeleportAim(direction: BABYLON.Vector3, origin: BABYLON.Vector3) {
    if (!this.isActive) return;

    this.currentTarget = this.calculateTeleportTarget(direction, origin);

    if (this.currentTarget.isValid) {
      this.updateArc(this.currentTarget);
      this.updateReticle(this.currentTarget);
    } else {
      this.hideArc();
      this.teleportReticle!.isVisible = false;
    }
  }

  /**
   * Execute teleport to current target
   */
  async executeTeleport(): Promise<boolean> {
    if (!this.isActive || !this.currentTarget || !this.currentTarget.isValid) {
      return false;
    }

    // Start fade out
    await this.fadeOut();

    // Move camera to target position
    const targetPosition = this.currentTarget.position.clone();
    targetPosition.y += 1.7; // Eye height

    if (this.camera instanceof BABYLON.UniversalCamera) {
      this.camera.position = targetPosition;
    }

    // End teleport mode
    this.endTeleport();

    // Fade back in
    await this.fadeIn();

    return true;
  }

  /**
   * End teleport aiming mode
   */
  endTeleport() {
    this.isActive = false;
    this.hideArc();
    if (this.teleportReticle) {
      this.teleportReticle.isVisible = false;
    }
    this.currentTarget = null;
  }

  /**
   * Calculate teleport target based on direction and origin
   */
  private calculateTeleportTarget(direction: BABYLON.Vector3, origin: BABYLON.Vector3): TeleportTarget {
    // Calculate parabolic trajectory
    const points: BABYLON.Vector3[] = [];
    const steps = 20;
    const gravity = -9.81;
    const initialVelocity = 8; // Adjust for throw strength

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2; // 2 seconds total time
      const horizontalDistance = initialVelocity * t * Math.cos(Math.PI / 6); // 30 degree angle
      const verticalDistance = initialVelocity * t * Math.sin(Math.PI / 6) + 0.5 * gravity * t * t;

      const point = origin.clone();
      point.addInPlace(direction.scale(horizontalDistance));
      point.y += verticalDistance;

      points.push(point);

      // Check for ground collision
      if (point.y <= 0) {
        // Find intersection with ground
        const ray = new BABYLON.Ray(point, new BABYLON.Vector3(0, -1, 0));
        const hit = this.scene.pickWithRay(ray, (mesh) => {
          return mesh.isPickable && mesh.checkCollisions;
        });

        if (hit && hit.hit) {
          const targetPos = hit.pickedPoint!;
          const distance = BABYLON.Vector3.Distance(origin, targetPos);

          if (distance <= this.maxDistance) {
            return {
              position: targetPos,
              normal: hit.getNormal() || new BABYLON.Vector3(0, 1, 0),
              isValid: this.isValidTeleportLocation(targetPos),
              distance: distance
            };
          }
        }
        break;
      }
    }

    return {
      position: new BABYLON.Vector3(0, 0, 0),
      normal: new BABYLON.Vector3(0, 1, 0),
      isValid: false,
      distance: 0
    };
  }

  /**
   * Check if location is valid for teleport
   */
  private isValidTeleportLocation(position: BABYLON.Vector3): boolean {
    // Check if position is on a valid surface
    const ray = new BABYLON.Ray(position.clone().add(new BABYLON.Vector3(0, 0.1, 0)), new BABYLON.Vector3(0, -1, 0));
    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.isPickable && mesh.checkCollisions;
    });

    if (!hit || !hit.hit) return false;

    // Check surface normal (should be mostly horizontal)
    const normal = hit.getNormal();
    if (!normal) return false;

    const dotProduct = BABYLON.Vector3.Dot(normal, new BABYLON.Vector3(0, 1, 0));
    return dotProduct > 0.7; // Surface should be mostly horizontal
  }

  /**
   * Update the teleport arc visualization
   */
  private updateArc(target: TeleportTarget) {
    if (!this.camera) return;

    const points: BABYLON.Vector3[] = [];
    const startPoint = this.camera.position.clone();
    const endPoint = target.position.clone();

    // Create curved arc points
    const distance = BABYLON.Vector3.Distance(startPoint, endPoint);
    const midPoint = startPoint.clone().add(endPoint).scale(0.5);
    midPoint.y += Math.max(distance * 0.3, this.arcHeight);

    // Quadratic Bezier curve
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const point = this.quadraticBezierPoint(startPoint, midPoint, endPoint, t);
      points.push(point);
    }

    if (this.teleportArc) {
      this.teleportArc.dispose();
    }

    this.teleportArc = BABYLON.MeshBuilder.CreateLines("teleportArc", { points }, this.scene);
    this.teleportArc.material = this.arcMaterial!;
    this.teleportArc.isPickable = false;
  }

  /**
   * Calculate point on quadratic Bezier curve
   */
  private quadraticBezierPoint(p0: BABYLON.Vector3, p1: BABYLON.Vector3, p2: BABYLON.Vector3, t: number): BABYLON.Vector3 {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;

    const point = p0.clone().scale(uu);
    point.addInPlace(p1.clone().scale(2 * u * t));
    point.addInPlace(p2.clone().scale(tt));

    return point;
  }

  /**
   * Update the teleport reticle position
   */
  private updateReticle(target: TeleportTarget) {
    if (!this.teleportReticle) return;

    this.teleportReticle.position = target.position.clone();
    this.teleportReticle.position.y += 0.01; // Slightly above surface

    // Update reticle color based on validity
    if (this.reticleMaterial) {
      this.reticleMaterial.emissiveColor = target.isValid
        ? new BABYLON.Color3(0, 1, 0) // Green for valid
        : new BABYLON.Color3(1, 0, 0); // Red for invalid
    }
  }

  /**
   * Hide the teleport arc
   */
  private hideArc() {
    if (this.teleportArc) {
      this.teleportArc.dispose();
      this.teleportArc = null;
    }
  }

  /**
   * Fade out effect
   */
  private async fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.fadeMaterial || !this.fadePlane) {
        resolve();
        return;
      }

      this.fadePlane.isVisible = true;
      const animation = BABYLON.Animation.CreateAndStartAnimation(
        "fadeOut",
        this.fadeMaterial!,
        "alpha",
        30,
        this.fadeDuration / 16.67, // Convert ms to frames
        0,
        1,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      animation!.onAnimationEnd = () => resolve();
    });
  }

  /**
   * Fade in effect
   */
  private async fadeIn(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.fadeMaterial || !this.fadePlane) {
        resolve();
        return;
      }

      const animation = BABYLON.Animation.CreateAndStartAnimation(
        "fadeIn",
        this.fadeMaterial!,
        "alpha",
        30,
        this.fadeDuration / 16.67,
        1,
        0,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      animation!.onAnimationEnd = () => {
        this.fadePlane!.isVisible = false;
        resolve();
      };
    });
  }

  /**
   * Get current teleport target
   */
  getCurrentTarget(): TeleportTarget | null {
    return this.currentTarget;
  }

  /**
   * Check if teleport is currently active
   */
  isTeleportActive(): boolean {
    return this.isActive;
  }

  /**
   * Dispose of teleport manager resources
   */
  dispose() {
    this.endTeleport();

    if (this.teleportArc) {
      this.teleportArc.dispose();
    }
    if (this.teleportReticle) {
      this.teleportReticle.dispose();
    }
    if (this.fadePlane) {
      this.fadePlane.dispose();
    }
    if (this.arcMaterial) {
      this.arcMaterial.dispose();
    }
    if (this.reticleMaterial) {
      this.reticleMaterial.dispose();
    }
    if (this.fadeMaterial) {
      this.fadeMaterial.dispose();
    }
  }
}
