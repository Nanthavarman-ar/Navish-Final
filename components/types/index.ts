// Common types for BabylonWorkspace
export interface Feature {
  id: string;
  name: string;
  category: string;
  description?: string;
  enabled: boolean;
  dependencies?: string[];
  icon?: string;
}

export interface GeoWorkspaceArea {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    alt: number;
  };
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    minAlt: number;
    maxAlt: number;
  };
  created: number;
  lastModified: number;
}

export interface DeviceCapabilities {
  webGLSupported: boolean;
  webGL2Supported: boolean;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxViewportDims: [number, number];
  supportedExtensions: string[];
  devicePixelRatio: number;
  hardwareConcurrency: number;
  maxAnisotropy: number;
}

export interface SimulationManager {
  startSimulation: (type: string, params: any) => void;
  stopSimulation: (type: string) => void;
  updateSimulation: (type: string, params: any) => void;
  getSimulationResults: (type: string) => any;
}

export interface XRManager {
  integrateWithBabylonWorkspace: (config: any) => void;
  initialize: () => Promise<boolean>;
  dispose: () => void;
}
