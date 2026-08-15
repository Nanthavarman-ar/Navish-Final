import { Engine, Scene, Mesh, Vector3, Color3, StandardMaterial, DynamicTexture } from '@babylonjs/core';
import { FeatureManager } from './FeatureManager';

export interface MapLocation {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  conditions: string;
  windSpeed: number;
  timestamp: number;
}

export interface TrafficData {
  location: Vector3;
  congestionLevel: 'low' | 'medium' | 'high' | 'severe';
  averageSpeed: number;
  timestamp: number;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  timestamp: Date;
}

export interface ExternalAPIConfig {
  googleMapsApiKey?: string;
  openStreetMapEnabled: boolean;
  weatherApiEnabled: boolean;
  trafficApiEnabled: boolean;
  geolocationEnabled: boolean;
  cacheTimeout: number; // minutes
}

interface MapTile {
  x: number;
  y: number;
  z: number;
  offsetX: number;
  offsetY: number;
}

export class ExternalAPIManager {
  private engine: Engine;
  private scene: Scene;
  private featureManager: FeatureManager;
  private config: ExternalAPIConfig;
  private mapMeshes: Map<string, Mesh> = new Map();
  private weatherCache: Map<string, WeatherData> = new Map();
  private trafficCache: Map<string, TrafficData[]> = new Map();
  private geolocationWatchId?: number;
  private currentLocation?: GeoLocation;

  constructor(engine: Engine, scene: Scene, featureManager: FeatureManager) {
    this.engine = engine;
    this.scene = scene;
    this.featureManager = featureManager;
    this.config = {
      openStreetMapEnabled: true,
      weatherApiEnabled: false,
      trafficApiEnabled: false,
      geolocationEnabled: true,
      cacheTimeout: 15 // 15 minutes
    };

    this.initializeMapSystem();
  }

  private initializeMapSystem(): void {
    // Create a base plane for map visualization
    const mapPlane = Mesh.CreateGround('map_plane', 20, 20, 2, this.scene);
    mapPlane.position.y = 0.05; // Slightly above ground
    mapPlane.setEnabled(false); // Hidden by default

    const mapMaterial = new StandardMaterial('map_material', this.scene);
    const mapTexture = new DynamicTexture('map_texture', { width: 1024, height: 1024 }, this.scene, false);
    mapMaterial.diffuseTexture = mapTexture;
    mapMaterial.disableLighting = true;
    mapPlane.material = mapMaterial;
  }

  // Google Maps integration
  async loadGoogleMap(center: MapLocation, zoom: number = 15): Promise<boolean> {
    if (!this.config.googleMapsApiKey) {
      console.warn('Google Maps API key not configured');
      return false;
    }

    try {
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center.latitude},${center.longitude}&zoom=${zoom}&size=1024x1024&key=${this.config.googleMapsApiKey}`;

      const response = await fetch(mapUrl);
      if (!response.ok) {
        throw new Error('Failed to load map');
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      // Update map texture
      const mapPlane = this.scene.getMeshByName('map_plane');
      if (mapPlane && mapPlane.material) {
        const material = mapPlane.material as StandardMaterial;
        const texture = material.diffuseTexture as DynamicTexture;

        // Load image into texture
        const img = new Image();
        img.onload = () => {
          const context = texture.getContext();
          context.drawImage(img, 0, 0, 1024, 1024);
          texture.update();
          URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
      }

      console.log('Google Map loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load Google Map:', error);
      return false;
    }
  }

  // OpenStreetMap integration
  async loadOpenStreetMap(center: MapLocation, zoom: number = 15): Promise<boolean> {
    if (!this.config.openStreetMapEnabled) {
      console.warn('OpenStreetMap integration is disabled');
      return false;
    }

    try {
      // Convert lat/lng to tile coordinates
      const tileSize = 256;
      const scale = Math.pow(2, zoom);
      const worldCoordinate = this.latLngToWorld(center.latitude, center.longitude);
      const pixelCoordinate = new Vector3(worldCoordinate.x * scale, worldCoordinate.y * scale, 0);
      const tileCoordinate = new Vector3(
        Math.floor(pixelCoordinate.x / tileSize),
        Math.floor(pixelCoordinate.y / tileSize),
        zoom
      );

      // Load multiple tiles for better coverage
      const tilesToLoad = this.getTilesToLoad(tileCoordinate, 2); // 2x2 grid

      for (const tile of tilesToLoad) {
        await this.loadMapTile(tile.x, tile.y, tile.z, tile.offsetX, tile.offsetY);
      }

      console.log('OpenStreetMap tiles loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load OpenStreetMap:', error);
      return false;
    }
  }

  private latLngToWorld(lat: number, lng: number): Vector3 {
    const x = (lng + 180) / 360;
    const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2;
    return new Vector3(x, y, 0);
  }

  private getTilesToLoad(centerTile: Vector3, radius: number): MapTile[] {
    const tiles: MapTile[] = [];
    for (let x = centerTile.x - radius; x <= centerTile.x + radius; x++) {
      for (let y = centerTile.y - radius; y <= centerTile.y + radius; y++) {
        tiles.push({
          x: x,
          y: y,
          z: centerTile.z,
          offsetX: (x - centerTile.x) * 256,
          offsetY: (y - centerTile.y) * 256
        });
      }
    }
    return tiles;
  }

  private async loadMapTile(x: number, y: number, z: number, offsetX: number, offsetY: number): Promise<void> {
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

    try {
      const response = await fetch(tileUrl);
      if (!response.ok) {
        throw new Error('Failed to load tile');
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      const mapPlane = this.scene.getMeshByName('map_plane');
      if (mapPlane && mapPlane.material) {
        const material = mapPlane.material as StandardMaterial;
        const texture = material.diffuseTexture as DynamicTexture;
        const context = texture.getContext();

        const img = new Image();
        img.onload = () => {
          context.drawImage(img, offsetX + 512, offsetY + 512, 256, 256); // Center the tiles
          texture.update();
          URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
      }
    } catch (error) {
      console.error('Failed to load map tile:', error);
    }
  }

  // Weather API integration
  async getWeatherData(location: MapLocation): Promise<WeatherData | null> {
    if (!this.config.weatherApiEnabled) {
      console.warn('Weather API is disabled');
      return null;
    }

    const cacheKey = `${location.latitude}_${location.longitude}`;
    const cached = this.weatherCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < (this.config.cacheTimeout * 60 * 1000)) {
      return cached;
    }

    try {
      // Using OpenWeatherMap API (you would need to configure your API key)
      const apiKey = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with actual key
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${apiKey}&units=metric`;

      const response = await fetch(weatherUrl);
      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = await response.json();

      const weatherData: WeatherData = {
        temperature: data.main.temp,
        humidity: data.main.humidity,
        conditions: data.weather[0].main,
        windSpeed: data.wind.speed,
        timestamp: Date.now()
      };

      this.weatherCache.set(cacheKey, weatherData);
      console.log('Weather data retrieved:', weatherData);
      return weatherData;
    } catch (error) {
      console.error('Failed to get weather data:', error);
      return null;
    }
  }

  // Traffic data integration
  async getTrafficData(center: MapLocation, radius: number = 1000): Promise<TrafficData[]> {
    if (!this.config.trafficApiEnabled) {
      console.warn('Traffic API is disabled');
      return [];
    }

    const cacheKey = `${center.latitude}_${center.longitude}_${radius}`;
    const cached = this.trafficCache.get(cacheKey);

    if (cached && (Date.now() - cached[0]?.timestamp) < (this.config.cacheTimeout * 60 * 1000)) {
      return cached;
    }

    try {
      // Using a mock traffic API - in real implementation, use Google Maps Traffic API or similar
      const trafficData: TrafficData[] = [];

      // Generate mock traffic data
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const distance = Math.random() * radius;
        const location = new Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        );

        trafficData.push({
          location,
          congestionLevel: ['low', 'medium', 'high', 'severe'][Math.floor(Math.random() * 4)] as any,
          averageSpeed: 20 + Math.random() * 40, // 20-60 km/h
          timestamp: Date.now()
        });
      }

      this.trafficCache.set(cacheKey, trafficData);
      console.log('Traffic data retrieved:', trafficData.length, 'points');
      return trafficData;
    } catch (error) {
      console.error('Failed to get traffic data:', error);
      return [];
    }
  }

  // Geolocation services
  async getCurrentLocation(): Promise<GeoLocation | null> {
    if (!this.config.geolocationEnabled) {
      console.warn('Geolocation is disabled');
      return null;
    }

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          };

          this.currentLocation = location;
          console.log('Current location retrieved:', location);
          resolve(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  startLocationTracking(): void {
    if (!this.config.geolocationEnabled || this.geolocationWatchId) {
      return;
    }

    this.geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: GeoLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          timestamp: new Date()
        };

        this.currentLocation = location;
        console.log('Location updated:', location);
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minute
      }
    );
  }

  stopLocationTracking(): void {
    if (this.geolocationWatchId) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
      this.geolocationWatchId = undefined;
    }
  }

  // Address geocoding
  async geocodeAddress(address: string): Promise<MapLocation | null> {
    try {
      // Using Nominatim (OpenStreetMap) for geocoding
      const encodedAddress = encodeURIComponent(address);
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

      const response = await fetch(geocodeUrl);
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      if (data.length === 0) {
        return null;
      }

      const result = data[0];
      const location: MapLocation = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: result.display_name,
        name: result.display_name
      };

      console.log('Address geocoded:', location);
      return location;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  }

  // Reverse geocoding
  async reverseGeocode(location: MapLocation): Promise<string | null> {
    try {
      const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}`;

      const response = await fetch(reverseUrl);
      if (!response.ok) {
        throw new Error('Reverse geocoding request failed');
      }

      const data = await response.json();
      const address = data.display_name || null;

      console.log('Reverse geocoded:', address);
      return address;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  // Map visualization controls
  toggleMapVisualization(): void {
    const mapPlane = this.scene.getMeshByName('map_plane');
    if (mapPlane) {
      mapPlane.setEnabled(!mapPlane.isEnabled());
      console.log(`Map visualization ${mapPlane.isEnabled() ? 'enabled' : 'disabled'}`);
    }
  }

  // Create location markers
  createLocationMarker(location: MapLocation, name: string, color: Color3 = Color3.Red()): Mesh {
    const marker = Mesh.CreateCylinder(`${name}_marker`, 0.5, 0.1, 0.1, 8, 1, this.scene);

    // Convert lat/lng to world coordinates (simplified)
    const worldPos = this.latLngToWorld(location.latitude, location.longitude);
    marker.position = new Vector3(worldPos.x * 20 - 10, 0.25, worldPos.y * 20 - 10);

    const material = new StandardMaterial(`${name}_marker_material`, this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.3);
    marker.material = material;

    this.mapMeshes.set(name, marker);
    return marker;
  }

  // Remove location markers
  removeLocationMarker(name: string): boolean {
    const marker = this.mapMeshes.get(name);
    if (marker) {
      marker.dispose();
      this.mapMeshes.delete(name);
      return true;
    }
    return false;
  }

  // Get route between two points
  async getRoute(start: MapLocation, end: MapLocation): Promise<Vector3[] | null> {
    try {
      // Using OSRM (Open Source Routing Machine) API
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;

      const response = await fetch(routeUrl);
      if (!response.ok) {
        throw new Error('Routing request failed');
      }

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        return null;
      }

      const coordinates = data.routes[0].geometry.coordinates;
      const route: Vector3[] = coordinates.map((coord: number[]) => {
        const worldPos = this.latLngToWorld(coord[1], coord[0]);
        return new Vector3(worldPos.x * 20 - 10, 0.1, worldPos.y * 20 - 10);
      });

      console.log('Route calculated:', route.length, 'points');
      return route;
    } catch (error) {
      console.error('Failed to get route:', error);
      return null;
    }
  }

  // Visualize route
  visualizeRoute(route: Vector3[], color: Color3 = Color3.Blue()): Mesh[] {
    const routeMeshes: Mesh[] = [];

    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i];
      const end = route[i + 1];

      const distance = Vector3.Distance(start, end);
      const direction = end.subtract(start).normalize();
      const center = start.add(direction.scale(distance / 2));

      const pathSegment = Mesh.CreateCylinder(`route_segment_${i}`, distance, 0.05, 0.05, 8, 1, this.scene);
      pathSegment.position = center;
      pathSegment.rotation.x = Math.PI / 2;
      pathSegment.lookAt(end);

      const material = new StandardMaterial(`route_material_${i}`, this.scene);
      material.diffuseColor = color;
      material.emissiveColor = color.scale(0.2);
      pathSegment.material = material;

      routeMeshes.push(pathSegment);
    }

    console.log('Route visualized with', routeMeshes.length, 'segments');
    return routeMeshes;
  }

  // Configuration
  updateConfig(newConfig: Partial<ExternalAPIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ExternalAPIConfig {
    return this.config;
  }

  getCurrentLocationData(): GeoLocation | null {
    return this.currentLocation || null;
  }

  // Clear caches
  clearCaches(): void {
    this.weatherCache.clear();
    this.trafficCache.clear();
    console.log('API caches cleared');
  }

  dispose(): void {
    this.stopLocationTracking();
    this.clearCaches();

    // Dispose map meshes
    this.mapMeshes.forEach(mesh => mesh.dispose());
    this.mapMeshes.clear();

    // Dispose map plane
    const mapPlane = this.scene.getMeshByName('map_plane');
    if (mapPlane) {
      mapPlane.dispose();
    }
  }
}
