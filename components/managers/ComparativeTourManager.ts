import { Scene, Vector3, Color3, StandardMaterial, Mesh, AbstractMesh, TransformNode, MeshBuilder } from '@babylonjs/core';
import { BIMManager } from '../BIMManager';

export interface ComparativeTour {
  id: string;
  name: string;
  description: string;
  leftView: TourView;
  rightView: TourView;
  splitPosition: number; // 0.5 = center
}

export interface TourView {
  position: Vector3;
  target: Vector3;
  description: string;
  annotations?: TourAnnotation[];
}

export interface TourAnnotation {
  id: string;
  position: Vector3;
  text: string;
  color: Color3;
}

/**
 * Manages comparative tours with side-by-side split-screen views
 */
export class ComparativeTourManager {
  private scene: Scene;
  private bimManager: BIMManager;

  private tours: Map<string, ComparativeTour> = new Map();
  private currentTour: ComparativeTour | null = null;
  private splitPlane: Mesh | null = null;
  private annotationMeshes: Map<string, Mesh> = new Map();
  private isActive: boolean = false;

  constructor(scene: Scene, bimManager: BIMManager) {
    this.scene = scene;
    this.bimManager = bimManager;
  }

  /**
   * Creates a new comparative tour
   * @param id - Unique identifier for the tour
   * @param name - Display name
   * @param description - Tour description
   * @param leftView - Left side view configuration
   * @param rightView - Right side view configuration
   */
  createTour(id: string, name: string, description: string, leftView: TourView, rightView: TourView): void {
    try {
      if (this.tours.has(id)) {
        throw new Error(`Tour with id '${id}' already exists`);
      }

      const tour: ComparativeTour = {
        id,
        name,
        description,
        leftView,
        rightView,
        splitPosition: 0.5
      };

      this.tours.set(id, tour);
      console.log(`Created comparative tour: ${name}`);
    } catch (error) {
      console.error('Failed to create tour:', error);
      throw error;
    }
  }

  /**
   * Starts a comparative tour
   * @param tourId - ID of the tour to start
   */
  startTour(tourId: string): void {
    try {
      const tour = this.tours.get(tourId);
      if (!tour) {
        throw new Error(`Tour '${tourId}' not found`);
      }

      // Stop current tour if active
      this.stopTour();

      this.currentTour = tour;
      this.isActive = true;

      // Create split plane
      this.createSplitPlane();

      // Apply initial views
      this.applyTourViews();

      console.log(`Started comparative tour: ${tour.name}`);
    } catch (error) {
      console.error('Failed to start tour:', error);
      throw error;
    }
  }

  /**
   * Stops the current comparative tour
   */
  stopTour(): void {
    try {
      if (!this.isActive) return;

      // Remove split plane
      this.disposeSplitPlane();

      // Clear annotations
      this.clearAnnotations();

      // Reset camera to default
      this.resetCamera();

      this.currentTour = null;
      this.isActive = false;

      console.log('Stopped comparative tour');
    } catch (error) {
      console.error('Failed to stop tour:', error);
      throw error;
    }
  }

  /**
   * Updates the split position
   * @param position - Split position (0 = full left, 1 = full right, 0.5 = center)
   */
  setSplitPosition(position: number): void {
    if (!this.isActive || !this.currentTour) return;

    try {
      this.currentTour.splitPosition = Math.max(0, Math.min(1, position));

      // Update split plane position
      if (this.splitPlane) {
        this.splitPlane.position.x = (this.currentTour.splitPosition - 0.5) * 10; // Assuming scene bounds
      }

      console.log(`Set split position to ${position}`);
    } catch (error) {
      console.error('Failed to set split position:', error);
      throw error;
    }
  }

  /**
   * Adds an annotation to the current tour
   * @param annotation - Annotation to add
   */
  addAnnotation(annotation: TourAnnotation): void {
    if (!this.isActive) return;

    try {
      // Create annotation mesh
      const annotationMesh = this.createAnnotationMesh(annotation);
      this.annotationMeshes.set(annotation.id, annotationMesh);

      console.log(`Added annotation: ${annotation.text}`);
    } catch (error) {
      console.error('Failed to add annotation:', error);
      throw error;
    }
  }

  /**
   * Removes an annotation
   * @param annotationId - ID of the annotation to remove
   */
  removeAnnotation(annotationId: string): void {
    try {
      const mesh = this.annotationMeshes.get(annotationId);
      if (mesh) {
        mesh.dispose();
        this.annotationMeshes.delete(annotationId);
      }

      console.log(`Removed annotation: ${annotationId}`);
    } catch (error) {
      console.error('Failed to remove annotation:', error);
      throw error;
    }
  }

  /**
   * Creates the split plane for side-by-side view
   */
  private createSplitPlane(): void {
    try {
      // Create a large plane that splits the view
      this.splitPlane = MeshBuilder.CreatePlane('split_plane', { width: 20, height: 20 }, this.scene);

      // Position in center initially
      this.splitPlane.position.x = 0;
      this.splitPlane.position.z = -5; // In front of camera

      // Create clipping material
      const material = new StandardMaterial('split_material', this.scene);
      material.diffuseColor = new Color3(0.5, 0.5, 0.5);
      material.alpha = 0.1;
      this.splitPlane.material = material;

      // Note: Actual clipping would require custom shader or render target splitting
      // This is a simplified visual representation
    } catch (error) {
      console.error('Failed to create split plane:', error);
    }
  }

  /**
   * Applies the tour views to the scene
   */
  private applyTourViews(): void {
    if (!this.currentTour) return;

    try {
      // For a full implementation, this would require dual camera setup
      // or render target splitting. For now, we'll just set the camera
      // to an interpolated position between the two views

      const leftPos = this.currentTour.leftView.position;
      const rightPos = this.currentTour.rightView.position;
      const split = this.currentTour.splitPosition;

      // Interpolate camera position based on split
      const cameraPos = Vector3.Lerp(leftPos, rightPos, split);

      if (this.scene.activeCamera) {
        this.scene.activeCamera.position = cameraPos;
      }

      // Add annotations for both views
      this.addViewAnnotations(this.currentTour.leftView);
      this.addViewAnnotations(this.currentTour.rightView);
    } catch (error) {
      console.error('Failed to apply tour views:', error);
    }
  }

  /**
   * Adds annotations for a tour view
   * @param view - Tour view to add annotations for
   */
  private addViewAnnotations(view: TourView): void {
    try {
      view.annotations?.forEach(annotation => {
        this.addAnnotation(annotation);
      });
    } catch (error) {
      console.error('Failed to add view annotations:', error);
    }
  }

  /**
   * Creates a mesh for an annotation
   * @param annotation - Annotation configuration
   * @returns Annotation mesh
   */
  private createAnnotationMesh(annotation: TourAnnotation): Mesh {
    // Create a small sphere for the annotation point
    const sphere = MeshBuilder.CreateSphere(`annotation_${annotation.id}`, { diameter: 0.1 }, this.scene);
    sphere.position = annotation.position;

    // Create material
    const material = new StandardMaterial(`annotation_material_${annotation.id}`, this.scene);
    material.diffuseColor = annotation.color;
    material.emissiveColor = annotation.color.scale(0.3);
    sphere.material = material;

    return sphere;
  }

  /**
   * Disposes of the split plane
   */
  private disposeSplitPlane(): void {
    try {
      if (this.splitPlane) {
        this.splitPlane.dispose();
        this.splitPlane = null;
      }
    } catch (error) {
      console.error('Failed to dispose split plane:', error);
    }
  }

  /**
   * Clears all annotations
   */
  private clearAnnotations(): void {
    try {
      this.annotationMeshes.forEach(mesh => mesh.dispose());
      this.annotationMeshes.clear();
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  }

  /**
   * Resets the camera to default position
   */
  private resetCamera(): void {
    try {
      if (this.scene.activeCamera) {
        this.scene.activeCamera.position = new Vector3(0, 5, -10);
        // Use lookAt if setTarget is not available
        if (typeof (this.scene.activeCamera as any).setTarget === 'function') {
          (this.scene.activeCamera as any).setTarget(Vector3.Zero());
        } else if (typeof (this.scene.activeCamera as any).lookAt === 'function') {
          (this.scene.activeCamera as any).lookAt(Vector3.Zero());
        }
      }
    } catch (error) {
      console.error('Failed to reset camera:', error);
    }
  }

  /**
   * Gets all available tours
   * @returns Array of tour IDs
   */
  getAvailableTours(): string[] {
    return Array.from(this.tours.keys());
  }

  /**
   * Gets the current tour
   * @returns Current tour or null
   */
  getCurrentTour(): ComparativeTour | null {
    return this.currentTour;
  }

  /**
   * Checks if a comparative tour is currently active
   * @returns True if tour is active
   */
  isTourActive(): boolean {
    return this.isActive;
  }

  /**
   * Gets the current split position
   * @returns Split position (0-1)
   */
  getSplitPosition(): number {
    return this.currentTour?.splitPosition ?? 0.5;
  }

  /**
   * Disposes of the comparative tour manager
   */
  dispose(): void {
    this.stopTour();
    this.tours.clear();
  }
}
