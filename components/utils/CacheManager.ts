import { AbstractMesh, Material, Texture, Vector3 } from '@babylonjs/core';
import { logger } from './Logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
}

export interface MeshBounds {
  min: Vector3;
  max: Vector3;
  width: number;
  height: number;
  depth: number;
  center: Vector3;
}

export class CacheManager {
  private static instance: CacheManager;
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  private cleanupInterval: number | null = null;
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // Generic caching methods
  set<T>(cacheName: string, key: string, data: T, ttl?: number): void {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new Map());
    }

    const cache = this.caches.get(cacheName)!;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    cache.set(key, entry);
    logger.debug(`Cached item in ${cacheName}: ${key}`);
  }

  get<T>(cacheName: string, key: string): T | null {
    const cache = this.caches.get(cacheName);
    if (!cache) return null;

    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      logger.debug(`Expired cache entry removed: ${cacheName}:${key}`);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  has(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    if (!cache) return false;

    const entry = cache.get(key);
    if (!entry) return false;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return false;
    }

    return true;
  }

  delete(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    if (!cache) return false;

    const deleted = cache.delete(key);
    if (deleted) {
      logger.debug(`Deleted cache entry: ${cacheName}:${key}`);
    }
    return deleted;
  }

  clear(cacheName?: string): void {
    if (cacheName) {
      this.caches.delete(cacheName);
      logger.debug(`Cleared cache: ${cacheName}`);
    } else {
      this.caches.clear();
      logger.debug('Cleared all caches');
    }
  }

  // Specialized caching for mesh bounds
  setMeshBounds(meshId: string, bounds: MeshBounds): void {
    this.set('meshBounds', meshId, bounds, 10 * 60 * 1000); // 10 minutes TTL
  }

  getMeshBounds(meshId: string): MeshBounds | null {
    return this.get<MeshBounds>('meshBounds', meshId);
  }

  calculateAndCacheMeshBounds(mesh: AbstractMesh): MeshBounds {
    const meshId = mesh.id || mesh.name;
    let bounds = this.getMeshBounds(meshId);

    if (!bounds) {
      const boundingInfo = mesh.getBoundingInfo();
      const min = boundingInfo.boundingBox.minimumWorld;
      const max = boundingInfo.boundingBox.maximumWorld;

      bounds = {
        min: min.clone(),
        max: max.clone(),
        width: max.x - min.x,
        height: max.y - min.y,
        depth: max.z - min.z,
        center: boundingInfo.boundingBox.centerWorld.clone()
      };

      this.setMeshBounds(meshId, bounds);
      logger.debug(`Calculated and cached bounds for mesh: ${meshId}`);
    }

    return bounds;
  }

  // Specialized caching for materials
  setMaterial(materialId: string, material: Material): void {
    this.set('materials', materialId, material.clone(materialId), 15 * 60 * 1000); // 15 minutes TTL
  }

  getMaterial(materialId: string): Material | null {
    return this.get<Material>('materials', materialId);
  }

  // Specialized caching for textures
  setTexture(textureId: string, texture: Texture): void {
    this.set('textures', textureId, texture.clone(), 30 * 60 * 1000); // 30 minutes TTL
  }

  getTexture(textureId: string): Texture | null {
    return this.get<Texture>('textures', textureId);
  }

  // Cache statistics
  getCacheStats(): { [cacheName: string]: { entries: number; totalAccessCount: number } } {
    const stats: { [cacheName: string]: { entries: number; totalAccessCount: number } } = {};

    for (const [cacheName, cache] of this.caches) {
      const entries = Array.from(cache.values());
      stats[cacheName] = {
        entries: entries.length,
        totalAccessCount: entries.reduce((sum, entry) => sum + entry.accessCount, 0)
      };
    }

    return stats;
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [cacheName, cache] of this.caches) {
      const expiredKeys: string[] = [];

      for (const [key, entry] of cache) {
        if (now - entry.timestamp > entry.ttl) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => cache.delete(key));
      totalCleaned += expiredKeys.length;

      if (expiredKeys.length > 0) {
        logger.debug(`Cleaned ${expiredKeys.length} expired entries from cache: ${cacheName}`);
      }
    }

    if (totalCleaned > 0) {
      logger.info(`Cache cleanup completed. Removed ${totalCleaned} expired entries.`);
    }
  }

  // Start automatic cleanup interval
  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;

    // Run cleanup every 5 minutes
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // Stop automatic cleanup
  stopCleanupInterval(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Memory management
  dispose(): void {
    this.stopCleanupInterval();
    this.clear();
    logger.info('CacheManager disposed');
  }
}

// Global cache manager instance
export const cacheManager = CacheManager.getInstance();
