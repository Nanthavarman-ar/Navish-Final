// Material interfaces for BabylonWorkspace
export interface MaterialState {
  id: string;
  name: string;
  type: 'pbr' | 'standard' | 'custom' | 'procedural' | 'node';
  properties: any;
  isActive: boolean;
  lastModified: number;
}

export interface MaterialProperty {
  name: string;
  value: any;
  type: 'color' | 'number' | 'boolean' | 'texture' | 'vector';
  min?: number;
  max?: number;
  step?: number;
}

export interface TextureInfo {
  id: string;
  name: string;
  url: string;
  type: 'diffuse' | 'normal' | 'specular' | 'emissive' | 'ambient' | 'opacity';
}

export interface MaterialPreset {
  id: string;
  name: string;
  description: string;
  materialType: string;
  properties: Record<string, any>;
  thumbnail?: string;
  category: string;
  preview: string;
  tags?: string[];
}

export interface MaterialEvent {
  type: string;
  materialId: string;
  timestamp: number;
  data?: any;
}

export interface MaterialManagerOptions {
  syncManager?: any;
  maxPoolSize?: number;
  maxErrors?: number;
}

export interface TextureLoadOptions {
  invertY?: boolean;
  samplingMode?: number;
  anisotropicFilteringLevel?: number;
  onLoad?: (texture: any) => void;
  onError?: (message: string, error: any) => void;
}

export interface MaterialPerformanceMetrics {
  totalMaterials: number;
  activeMaterials: number;
  cachedTextures: number;
  memoryUsage: number;
  lastUpdateTime: number;
}

export interface MaterialVariation {
  name?: string;
  colorOffset?: any;
  metallicOffset?: number;
  roughnessOffset?: number;
  specularOffset?: number;
  scaleMultiplier?: number;
}

export interface ProceduralMaterialConfig {
  id: string;
  name: string;
  type: 'noise' | 'gradient' | 'pattern' | 'custom';
  parameters: Record<string, any>;
  shaderCode?: string;
}
