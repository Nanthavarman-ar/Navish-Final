import { Scene, Mesh, TransformNode, Vector3, AbstractMesh } from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { logger } from '../utils/Logger';
import { cacheManager } from '../utils/CacheManager';

export interface FurnitureItem {
  id: string;
  name: string;
  brand: string;
  category: 'chair' | 'table' | 'sofa' | 'bed' | 'cabinet' | 'lamp' | 'decor';
  modelUrl: string;
  thumbnailUrl: string;
  dimensions: { width: number; height: number; depth: number };
  price: number;
  materials: string[];
  tags: string[];
}

export interface PlacedFurniture {
  id: string;
  item: FurnitureItem;
  mesh: TransformNode;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

/**
 * Manages furniture catalog and placement in the scene
 */
export class FurnitureManager {
  private scene: Scene;
  private furnitureCatalog: Map<string, FurnitureItem[]> = new Map();
  private placedFurniture: Map<string, PlacedFurniture> = new Map();
  private selectedFurniture: FurnitureItem | null = null;
  private categories: Set<string> = new Set();

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeDefaultCatalog();
    logger.info('FurnitureManager initialized');
  }

  /**
   * Initialize default furniture catalog
   */
  private initializeDefaultCatalog(): void {
    const ikeaItems: FurnitureItem[] = [
      {
        id: 'ikea_chair_1',
        name: 'IKEA Markus Office Chair',
        brand: 'IKEA',
        category: 'chair',
        modelUrl: '/models/furniture/ikea_markus_chair.glb',
        thumbnailUrl: '/thumbnails/furniture/ikea_markus_chair.jpg',
        dimensions: { width: 0.6, height: 0.85, depth: 0.6 },
        price: 149,
        materials: ['fabric', 'metal'],
        tags: ['office', 'ergonomic', 'modern']
      },
      {
        id: 'ikea_table_1',
        name: 'IKEA Linnmon Table',
        brand: 'IKEA',
        category: 'table',
        modelUrl: '/models/furniture/ikea_linnmon_table.glb',
        thumbnailUrl: '/thumbnails/furniture/ikea_linnmon_table.jpg',
        dimensions: { width: 1.2, height: 0.74, depth: 0.6 },
        price: 79,
        materials: ['wood', 'particleboard'],
        tags: ['desk', 'workspace', 'simple']
      },
      {
        id: 'ikea_sofa_1',
        name: 'IKEA Friheten Sofa',
        brand: 'IKEA',
        category: 'sofa',
        modelUrl: '/models/furniture/ikea_friheten_sofa.glb',
        thumbnailUrl: '/thumbnails/furniture/ikea_friheten_sofa.jpg',
        dimensions: { width: 2.3, height: 0.88, depth: 1.4 },
        price: 899,
        materials: ['fabric', 'wood'],
        tags: ['comfortable', 'spacious', 'classic']
      }
    ];

    const hermanMillerItems: FurnitureItem[] = [
      {
        id: 'hm_chair_1',
        name: 'Herman Miller Aeron Chair',
        brand: 'Herman Miller',
        category: 'chair',
        modelUrl: '/models/furniture/hm_aeron_chair.glb',
        thumbnailUrl: '/thumbnails/furniture/hm_aeron_chair.jpg',
        dimensions: { width: 0.65, height: 0.95, depth: 0.6 },
        price: 1499,
        materials: ['mesh', 'aluminum'],
        tags: ['office', 'premium', 'ergonomic']
      },
      {
        id: 'hm_table_1',
        name: 'Herman Miller Eames Table',
        brand: 'Herman Miller',
        category: 'table',
        modelUrl: '/models/furniture/hm_eames_table.glb',
        thumbnailUrl: '/thumbnails/furniture/hm_eames_table.jpg',
        dimensions: { width: 1.8, height: 0.74, depth: 0.9 },
        price: 599,
        materials: ['wood', 'metal'],
        tags: ['dining', 'mid-century', 'iconic']
      }
    ];

    const westElmItems: FurnitureItem[] = [
      {
        id: 'we_bed_1',
        name: 'West Elm Modern Bed',
        brand: 'West Elm',
        category: 'bed',
        modelUrl: '/models/furniture/we_modern_bed.glb',
        thumbnailUrl: '/thumbnails/furniture/we_modern_bed.jpg',
        dimensions: { width: 1.6, height: 0.85, depth: 2.1 },
        price: 1299,
        materials: ['wood', 'upholstery'],
        tags: ['bedroom', 'platform', 'contemporary']
      }
    ];

    this.furnitureCatalog.set('IKEA', ikeaItems);
    this.furnitureCatalog.set('Herman Miller', hermanMillerItems);
    this.furnitureCatalog.set('West Elm', westElmItems);

    // Update categories
    this.updateCategories();

    logger.info(`Initialized furniture catalog with ${this.getTotalItems()} items`);
  }

  /**
   * Update available categories
   */
  private updateCategories(): void {
    this.categories.clear();
    for (const items of this.furnitureCatalog.values()) {
      items.forEach(item => this.categories.add(item.category));
    }
  }

  /**
   * Get all available categories
   * @returns Array of category names
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Get furniture items by category
   * @param category The category to filter by
   * @returns Array of furniture items
   */
  getFurnitureByCategory(category: string): FurnitureItem[] {
    const result: FurnitureItem[] = [];

    for (const items of this.furnitureCatalog.values()) {
      result.push(...items.filter(item => item.category === category));
    }

    return result;
  }

  /**
   * Get furniture items by brand
   * @param brand The brand to filter by
   * @returns Array of furniture items
   */
  getFurnitureByBrand(brand: string): FurnitureItem[] {
    return this.furnitureCatalog.get(brand) || [];
  }

  /**
   * Search furniture by query
   * @param query Search query
   * @returns Array of matching furniture items
   */
  searchFurniture(query: string): FurnitureItem[] {
    const lowerQuery = query.toLowerCase();
    const result: FurnitureItem[] = [];

    for (const items of this.furnitureCatalog.values()) {
      result.push(...items.filter(item =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.brand.toLowerCase().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery) ||
        item.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        item.materials.some(material => material.toLowerCase().includes(lowerQuery))
      ));
    }

    return result;
  }

  /**
   * Select a furniture item
   * @param furnitureId The ID of the furniture item to select
   */
  selectFurniture(furnitureId: string): void {
    const item = this.findFurnitureById(furnitureId);
    if (item) {
      this.selectedFurniture = item;
      logger.debug(`Selected furniture: ${item.name}`);
    } else {
      const sanitizedId = furnitureId.replace(/[\r\n\t]/g, '_');
      logger.warn(`Furniture item not found: ${sanitizedId}`);
    }
  }

  /**
   * Get currently selected furniture
   * @returns The selected furniture item or null
   */
  getSelectedFurniture(): FurnitureItem | null {
    return this.selectedFurniture;
  }

  /**
   * Find furniture item by ID
   * @param id The furniture ID
   * @returns The furniture item or null
   */
  private findFurnitureById(id: string): FurnitureItem | null {
    for (const items of this.furnitureCatalog.values()) {
      const item = items.find(item => item.id === id);
      if (item) return item;
    }
    return null;
  }

  /**
   * Place furniture in the scene
   * @param position Position to place the furniture
   * @param rotation Optional rotation
   * @returns Placed furniture object or null if failed
   */
  async placeFurniture(position: Vector3, rotation?: Vector3): Promise<PlacedFurniture | null> {
    if (!this.selectedFurniture) {
      logger.warn('No furniture selected for placement');
      return null;
    }

    try {
      const item = this.selectedFurniture;
      const cacheKey = `furniture_${item.id}`;

      // Check cache first
      let furnitureNode: TransformNode | null = cacheManager.get<TransformNode>('furnitureCache', cacheKey);

      if (!furnitureNode) {
        // Load the model
        const result = await SceneLoader.ImportMeshAsync('', item.modelUrl, '', this.scene);
        furnitureNode = new TransformNode(`furniture_${item.id}_${Date.now()}`);

        result.meshes.forEach(mesh => {
          mesh.parent = furnitureNode;
        });

        // Cache the loaded node for future use
        cacheManager.set('furnitureCache', cacheKey, furnitureNode);
        logger.debug(`Loaded and cached furniture model: ${item.name}`);
      } else {
        // Clone the cached node
        furnitureNode = furnitureNode.clone(`furniture_${item.id}_${Date.now()}`, null);
        logger.debug(`Cloned cached furniture model: ${item.name}`);
      }

      if (!furnitureNode) {
        logger.error('Failed to create or clone furniture node');
        return null;
      }

      // Position and scale
      furnitureNode.position = position;
      if (rotation) {
        furnitureNode.rotation = rotation;
      }

      // Find first AbstractMesh child for bounds calculation
      const meshChild = furnitureNode.getChildMeshes(false)[0];
      if (!meshChild) {
        logger.warn('No mesh child found for furniture node bounds calculation');
        return null;
      }

      // Scale to real-world dimensions
      const bounds = cacheManager.calculateAndCacheMeshBounds(meshChild);
      const scale = new Vector3(
        item.dimensions.width / bounds.width,
        item.dimensions.height / bounds.height,
        item.dimensions.depth / bounds.depth
      );
      furnitureNode.scaling = scale;

      // Create placed furniture object
      const placed: PlacedFurniture = {
        id: furnitureNode.name,
        item: item,
        mesh: furnitureNode,
        position: position.clone(),
        rotation: rotation || Vector3.Zero(),
        scale: scale
      };

      this.placedFurniture.set(placed.id, placed);

      logger.info(`Placed furniture: ${item.name} at position ${position.toString()}`);
      return placed;

    } catch (error) {
      logger.error('Failed to place furniture', error);
      return null;
    }
  }

  /**
   * Remove furniture from the scene
   * @param placedId The ID of the placed furniture
   * @returns True if removed successfully
   */
  removeFurniture(placedId: string): boolean {
    const placed = this.placedFurniture.get(placedId);
    if (placed) {
      placed.mesh.dispose();
      this.placedFurniture.delete(placedId);
      logger.info(`Removed furniture: ${placed.item.name}`);
      return true;
    }
    return false;
  }

  /**
   * Move placed furniture to new position
   * @param placedId The ID of the placed furniture
   * @param newPosition New position
   * @returns True if moved successfully
   */
  moveFurniture(placedId: string, newPosition: Vector3): boolean {
    const placed = this.placedFurniture.get(placedId);
    if (placed) {
      placed.mesh.position = newPosition;
      placed.position = newPosition.clone();
      logger.debug(`Moved furniture ${placed.item.name} to ${newPosition.toString()}`);
      return true;
    }
    return false;
  }

  /**
   * Rotate placed furniture
   * @param placedId The ID of the placed furniture
   * @param newRotation New rotation
   * @returns True if rotated successfully
   */
  rotateFurniture(placedId: string, newRotation: Vector3): boolean {
    const placed = this.placedFurniture.get(placedId);
    if (placed) {
      placed.mesh.rotation = newRotation;
      placed.rotation = newRotation.clone();
      logger.debug(`Rotated furniture ${placed.item.name} to ${newRotation.toString()}`);
      return true;
    }
    return false;
  }

  /**
   * Check if furniture can be placed at position without collision
   * @param position Position to check
   * @param dimensions Dimensions of the furniture
   * @returns True if placement is clear
   */
  checkClearance(position: Vector3, dimensions: { width: number; height: number; depth: number }): boolean {
    const halfWidth = dimensions.width / 2;
    const halfDepth = dimensions.depth / 2;

    // Check against all placed furniture
    for (const placed of this.placedFurniture.values()) {
      // Get first child mesh for bounds calculation
      const meshChild = placed.mesh.getChildMeshes(false)[0];
      if (!meshChild) continue;

      const placedBounds = cacheManager.calculateAndCacheMeshBounds(meshChild);
      const distance = Vector3.Distance(position, placed.position);

      // Simple bounding sphere collision check
      const combinedRadius = Math.max(halfWidth, halfDepth, placedBounds.width / 2, placedBounds.depth / 2);
      if (distance < combinedRadius * 1.2) { // 20% buffer
        return false;
      }
    }

    return true;
  }

  /**
   * Get all placed furniture
   * @returns Array of placed furniture objects
   */
  getPlacedFurniture(): PlacedFurniture[] {
    return Array.from(this.placedFurniture.values());
  }

  /**
   * Clear all placed furniture
   */
  clearAllFurniture(): void {
    for (const placed of this.placedFurniture.values()) {
      placed.mesh.dispose();
    }
    this.placedFurniture.clear();
    logger.info('Cleared all placed furniture');
  }

  /**
   * Get furniture statistics
   * @returns Statistics object
   */
  getFurnitureStats(): any {
    const stats = {
      totalItems: this.getTotalItems(),
      placedItems: this.placedFurniture.size,
      categories: Array.from(this.categories),
      brands: Array.from(this.furnitureCatalog.keys()),
      selectedItem: this.selectedFurniture?.name || null
    };

    return stats;
  }

  /**
   * Get total number of furniture items in catalog
   * @returns Total count
   */
  private getTotalItems(): number {
    let count = 0;
    for (const items of this.furnitureCatalog.values()) {
      count += items.length;
    }
    return count;
  }

  /**
   * Add furniture item to catalog
   * @param item Furniture item to add
   */
  addFurnitureItem(item: FurnitureItem): void {
    if (!this.furnitureCatalog.has(item.brand)) {
      this.furnitureCatalog.set(item.brand, []);
    }

    const brandItems = this.furnitureCatalog.get(item.brand)!;
    brandItems.push(item);
    this.categories.add(item.category);

    const sanitizedName = item.name.replace(/[\r\n\t]/g, '_');
    logger.info(`Added furniture item: ${sanitizedName}`);
  }

  /**
   * Remove furniture item from catalog
   * @param itemId ID of the item to remove
   * @returns True if removed successfully
   */
  removeFurnitureItem(itemId: string): boolean {
    for (const [brand, items] of this.furnitureCatalog) {
      const index = items.findIndex(item => item.id === itemId);
      if (index !== -1) {
        const removed = items.splice(index, 1)[0];
        logger.info(`Removed furniture item: ${removed.name}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearAllFurniture();
    this.furnitureCatalog.clear();
    this.categories.clear();
    this.selectedFurniture = null;
    logger.info('FurnitureManager disposed');
  }
}
