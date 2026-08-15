// GPS Transform Utils for AR positioning

export interface GPSCoordinates {
  lat: number;
  lng: number;
  alt?: number;
}
export class GPSTransformUtils {
  private referenceLocation: { lat: number; lng: number; alt: number } | null = null;

  constructor() {
    // Initialize GPS transform utilities
  }

  setReferenceLocation(lat: number, lng: number, alt: number = 0): void {
    this.referenceLocation = { lat, lng, alt };
  }

  gpsToLocalCoordinates(lat: number, lng: number, alt: number = 0): { x: number; y: number; z: number } {
    if (!this.referenceLocation) {
      throw new Error('Reference location not set');
    }

    // Simplified GPS to local coordinate conversion
    // In a real implementation, this would use proper geospatial transformations
    const latDiff = lat - this.referenceLocation.lat;
    const lngDiff = lng - this.referenceLocation.lng;
    const altDiff = alt - this.referenceLocation.alt;

    // Convert to meters (approximate)
    const x = lngDiff * 111320; // meters per degree longitude
    const z = latDiff * 110540; // meters per degree latitude
    const y = altDiff;

    return { x, y, z };
  }

  localToGPSCoordinates(x: number, y: number, z: number): { lat: number; lng: number; alt: number } {
    if (!this.referenceLocation) {
      throw new Error('Reference location not set');
    }

    // Simplified local to GPS coordinate conversion
    const lng = this.referenceLocation.lng + (x / 111320);
    const lat = this.referenceLocation.lat + (z / 110540);
    const alt = this.referenceLocation.alt + y;

    return { lat, lng, alt };
  }
}
