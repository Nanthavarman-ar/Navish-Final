import { Engine, Scene, Mesh, InstancedMesh, Vector3, Color3, StandardMaterial, PBRMaterial, TransformNode, SceneLoader } from '@babylonjs/core';
import { CostEstimator, CostEstimate, CostBreakdown } from './CostEstimator';

export interface BIMElement {
  id: string;
  name: string;
  type: BIMElementType;
  category: BIMCategory;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  material?: string;
  properties: BIMElementProperties;
  hiddenDetails?: BIMHiddenDetail[];
  mesh?: Mesh | InstancedMesh;
  visible: boolean;
}

export type BIMElementType = 'wall' | 'floor' | 'ceiling' | 'door' | 'window' | 'beam' | 'column' | 'duct' | 'pipe' | 'cable' | 'fixture' | 'roof' | 'slab';

export type BIMCategory = 'Architecture' | 'Structure' | 'MEP' | 'Interior' | 'Landscape' | 'Civil';

export interface BIMElementProperties {
  thickness?: number;
  height?: number;
  width?: number;
  depth?: number;
  area?: number;
  volume?: number;
  fireRating?: string;
  finish?: string;
  level?: string;
  voltage?: string;
  amperage?: string;
  diameter?: string;
  material?: string;
  pressure?: string;
  airflow?: string;
  [key: string]: any;
}

export interface BIMHiddenDetail {
  id: string;
  type: 'wiring' | 'plumbing' | 'hvac' | 'electrical' | 'structural' | 'insulation';
  position: Vector3;
  description: string;
  specifications: { [key: string]: any };
  mesh?: Mesh;
  visible: boolean;
}

export interface BIMModel {
  id: string;
  name: string;
  source: 'revit' | 'autocad' | 'ifc' | 'custom' | 'obj' | 'fbx' | 'gltf';
  elements: BIMElement[];
  hiddenDetails: BIMHiddenDetail[];
  metadata: {
    author: string;
    created: Date;
    lastModified: Date;
    units: string;
    coordinateSystem: string;
  };
}

export interface BIMLayer {
  id: string;
  name: string;
  type: 'design' | 'technical' | 'structural' | 'mechanical' | 'electrical' | 'plumbing';
  visible: boolean;
  elements: string[]; // Element IDs in this layer
  opacity: number;
}

export interface BIMClash {
  id: string;
  type: 'intersection' | 'clearance' | 'proximity';
  severity: 'critical' | 'warning' | 'info';
  elements: string[]; // Element IDs involved
  description: string;
  position: Vector3;
  distance?: number; // For clearance/proximity clashes
}

export interface BIMConfig {
  showHiddenDetails: boolean;
  detailLevel: 'low' | 'medium' | 'high';
  transparencyMode: boolean;
  colorCoding: boolean;
  realTimeUpdates: boolean;
  wallPeelingMode: boolean;
  clashDetectionEnabled: boolean;
}

export class BIMManager {
  private static instance: BIMManager | null = null;

  private engine: Engine;
  private scene: Scene;
  private models: Map<string, BIMModel> = new Map();
  private demoModelId: string | null = null;
  private config: BIMConfig;
  private hiddenDetailGroup: TransformNode | null = null;
  private isInitialized: boolean = false;
  private costEstimator: CostEstimator | null = null;
  private layers: Map<string, BIMLayer> = new Map();
  private clashes: BIMClash[] = [];
  private wallGroup: TransformNode | null = null;
  private clashHighlightGroup: TransformNode | null = null;

  // Performance optimization: Mesh instancing system
  private meshInstances: Map<string, { sourceMesh: Mesh; instances: (Mesh | InstancedMesh)[] }> = new Map();
  private instanceThreshold: number = 3; // Minimum instances before using instancing

  constructor(engine: Engine, scene: Scene) {
    this.engine = engine;
    this.scene = scene;

    this.config = {
      showHiddenDetails: false,
      detailLevel: 'medium',
      transparencyMode: false,
      colorCoding: true,
      realTimeUpdates: false,
      wallPeelingMode: false,
      clashDetectionEnabled: false
    };

    this.initializeBIMSystem();
  }

  static getInstance(engine: Engine, scene: Scene): BIMManager {
    if (!BIMManager.instance) {
      BIMManager.instance = new BIMManager(engine, scene);
    }
    return BIMManager.instance;
  }

  // Get formatted cost display data for UI
  getCostDisplayData(modelId?: string, region?: string): {
    total: number;
    labor: number;
    materials: number;
    overhead: number;
    elements: Array<{ id: string; name: string; cost: number }>;
  } | null {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return null;
    }

    const breakdown = this.getModelCostBreakdown(modelId || Array.from(this.models.keys())[0], region);
    if (!breakdown) return null;

    // Get elements from the model and calculate their costs
    const model = this.models.get(modelId || Array.from(this.models.keys())[0]);
    const elements = model?.elements.map(el => ({
      id: el.id,
      name: el.name,
      cost: this.getElementCostEstimate(el.id, region)?.costBreakdown.total || 0
    })) || [];

    return {
      total: breakdown.total,
      labor: breakdown.labor,
      materials: breakdown.materials,
      overhead: breakdown.overhead,
      elements
    };
  }

  // Initialize BIM system
  private initializeBIMSystem(): void {
    // Create hidden detail group for organization
    this.hiddenDetailGroup = new TransformNode('bim_hidden_details', this.scene);
    this.hiddenDetailGroup.setEnabled(false); // Initially hidden

    // Create wall group for wall peeling functionality
    this.wallGroup = new TransformNode('bim_walls', this.scene);
    this.wallGroup.setEnabled(true);

    // Create clash highlight group
    this.clashHighlightGroup = new TransformNode('bim_clash_highlights', this.scene);
    this.clashHighlightGroup.setEnabled(false); // Initially hidden

    this.isInitialized = true;
    console.log('BIM system initialized');
  }

  // Import BIM model from file
  async importBIMModel(file: File, source: 'revit' | 'autocad' | 'ifc' | 'custom' = 'custom'): Promise<BIMModel> {
    if (!file) {
      throw new Error('No file provided for BIM model import');
    }
    try {
      const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let model: BIMModel;

      switch (source) {
        case 'revit':
          model = await this.parseRevitFile(file, modelId);
          break;
        case 'autocad':
          model = await this.parseAutoCADFile(file, modelId);
          break;
        case 'ifc':
          model = await this.parseIFCFile(file, modelId);
          break;
        default:
          model = await this.parseCustomFormat(file, modelId);
      }

      if (!model || !model.elements) {
        throw new Error('Parsed BIM model is invalid or empty');
      }

      this.models.set(modelId, model);
      await this.createBIMMeshes(model);

      console.log(`BIM model imported: ${model.name} (${model.elements.length} elements)`);
      return model;

    } catch (error) {
      console.error('Failed to import BIM model:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`BIM import failed: ${message}`);
    }
  }

  // Parse Revit file (simplified implementation)
  private async parseRevitFile(file: File, modelId: string): Promise<BIMModel> {
    // In a real implementation, this would parse actual Revit (.rvt) files
    // For demo purposes, we'll create a mock BIM model
    return this.createMockBIMModel(modelId, 'Revit Import', 'revit');
  }

  // Parse AutoCAD file (simplified implementation)
  private async parseAutoCADFile(file: File, modelId: string): Promise<BIMModel> {
    // In a real implementation, this would parse actual AutoCAD (.dwg) files
    return this.createMockBIMModel(modelId, 'AutoCAD Import', 'autocad');
  }

  // Parse IFC file (Industry Foundation Classes) - real parsing via web-ifc, an open-source
  // WASM IFC engine. Unlike Revit/AutoCAD (proprietary, no legal local parser), IFC is an
  // open standard this can genuinely read: real geometry, real element names/types, not a
  // mock building.
  private async parseIFCFile(file: File, modelId: string): Promise<BIMModel> {
    const { parseIFCToBIMModel } = await import('./utils/ifcParser');
    return parseIFCToBIMModel(file, modelId, this.scene);
  }

  // Parse custom format
  private async parseCustomFormat(file: File, modelId: string): Promise<BIMModel> {
    try {
      if (!file) {
        throw new Error('No file provided for custom format parsing');
      }

      const text = await file.text();
      if (!text || text.trim().length === 0) {
        throw new Error('File is empty or contains no data');
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Invalid JSON format in file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Parsed data is not a valid object');
      }

      // Validate required fields
      if (data.elements && !Array.isArray(data.elements)) {
        throw new Error('Elements field must be an array');
      }

      if (data.hiddenDetails && !Array.isArray(data.hiddenDetails)) {
        throw new Error('HiddenDetails field must be an array');
      }

      return {
        id: modelId,
        name: data.name || 'Custom BIM Model',
        source: 'custom',
        elements: data.elements || [],
        hiddenDetails: data.hiddenDetails || [],
        metadata: {
          author: data.author || 'Unknown',
          created: new Date(data.created || Date.now()),
          lastModified: new Date(data.lastModified || Date.now()),
          units: data.units || 'meters',
          coordinateSystem: data.coordinateSystem || 'local'
        }
      };
    } catch (error) {
      console.error('Failed to parse custom format:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Custom format parsing failed: ${message}`);
    }
  }

  // Create mock BIM model for demonstration
  private createMockBIMModel(modelId: string, name: string, source: BIMModel['source']): BIMModel {
    const elements: BIMElement[] = [];
    const hiddenDetails: BIMHiddenDetail[] = [];

    // Create sample building elements
    const wallPositions = [
      new Vector3(0, 1, 0), new Vector3(5, 1, 0), new Vector3(0, 1, 5), new Vector3(5, 1, 5)
    ];

    wallPositions.forEach((pos, index) => {
      elements.push({
        id: `wall_${index}`,
        name: `Wall ${index + 1}`,
        type: 'wall',
        category: 'Architecture',
        position: pos,
        rotation: new Vector3(0, 0, 0),
        scale: new Vector3(5, 2.5, 0.2),
        material: 'concrete',
        properties: {
          thickness: 0.2,
          height: 2.5,
          fireRating: '1hr'
        },
        visible: true
      });
    });

    // Add floor
    elements.push({
      id: 'floor_1',
      name: 'Ground Floor',
      type: 'floor',
      category: 'Architecture',
      position: new Vector3(2.5, 0, 2.5),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(5, 0.1, 5),
      material: 'concrete',
      properties: {
        thickness: 0.1,
        level: 'Ground',
        finish: 'polished'
      },
      visible: true
    });

    // Add ceiling
    elements.push({
      id: 'ceiling_1',
      name: 'Ceiling',
      type: 'ceiling',
      category: 'Architecture',
      position: new Vector3(2.5, 2.5, 2.5),
      rotation: new Vector3(0, 0, 0),
      scale: new Vector3(5, 0.1, 5),
      material: 'gypsum',
      properties: {
        thickness: 0.1,
        finish: 'painted'
      },
      visible: true
    });

    // Add hidden details (wiring, plumbing, HVAC)
    const wiringDetails: BIMHiddenDetail[] = [
      {
        id: 'wiring_1',
        type: 'wiring',
        position: new Vector3(1, 2.2, 1),
        description: 'Electrical wiring for lighting circuit',
        specifications: {
          voltage: '120V',
          amperage: '15A',
          conductor: 'Copper 12AWG'
        },
        visible: false
      },
      {
        id: 'wiring_2',
        type: 'wiring',
        position: new Vector3(4, 2.2, 1),
        description: 'Data cable for network connection',
        specifications: {
          type: 'Cat6',
          length: '10m',
          termination: 'RJ45'
        },
        visible: false
      }
    ];

    const plumbingDetails: BIMHiddenDetail[] = [
      {
        id: 'plumbing_1',
        type: 'plumbing',
        position: new Vector3(3, 1.5, 0.5),
        description: 'Hot water supply line',
        specifications: {
          diameter: '0.5"',
          material: 'Copper',
          pressure: '60psi'
        },
        visible: false
      },
      {
        id: 'plumbing_2',
        type: 'plumbing',
        position: new Vector3(3, 1.2, 0.5),
        description: 'Cold water supply line',
        specifications: {
          diameter: '0.5"',
          material: 'Copper',
          pressure: '60psi'
        },
        visible: false
      }
    ];

    const hvacDetails: BIMHiddenDetail[] = [
      {
        id: 'hvac_1',
        type: 'hvac',
        position: new Vector3(2.5, 2.3, 2.5),
        description: 'HVAC duct for air distribution',
        specifications: {
          diameter: '8"',
          material: 'Sheet Metal',
          airflow: '500 CFM'
        },
        visible: false
      }
    ];

    hiddenDetails.push(...wiringDetails, ...plumbingDetails, ...hvacDetails);

    return {
      id: modelId,
      name,
      source,
      elements,
      hiddenDetails,
      metadata: {
        author: 'BIM Import System',
        created: new Date(),
        lastModified: new Date(),
        units: 'meters',
        coordinateSystem: 'local'
      }
    };
  }

  // Create Babylon.js meshes for BIM elements
  private async createBIMMeshes(model: BIMModel): Promise<void> {
    if (!model || !model.elements) {
      throw new Error('Invalid BIM model provided for mesh creation');
    }

    try {
      // Create meshes for main elements
      for (const element of model.elements) {
        if (!element || !element.id) {
          console.warn('Skipping invalid BIM element during mesh creation');
          continue;
        }
        await this.createElementMesh(element);
      }

      // Create meshes for hidden details
      for (const detail of model.hiddenDetails) {
        if (!detail || !detail.id) {
          console.warn('Skipping invalid BIM hidden detail during mesh creation');
          continue;
        }
        await this.createHiddenDetailMesh(detail);
      }
    } catch (error) {
      console.error('Failed to create BIM meshes:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`BIM mesh creation failed: ${message}`);
    }
  }

  // Create mesh for BIM element
  private async createElementMesh(element: BIMElement): Promise<void> {
    try {
      if (!element || !element.id) {
        throw new Error('Invalid BIM element provided for mesh creation');
      }

      if (!this.scene) {
        throw new Error('Scene not available for mesh creation');
      }

      // Real geometry (e.g. from the IFC parser) is already built and assigned before this
      // runs - only fall through to the generic primitive-per-type shapes below for elements
      // that don't have real geometry of their own (the mock/demo model).
      if (element.mesh instanceof Mesh) {
        const material = new StandardMaterial(`${element.id}_material`, this.scene);
        material.diffuseColor = this.getElementColor(element);
        element.mesh.material = material;
        element.visible = true;
        if (element.type === 'wall' && this.wallGroup) {
          element.mesh.parent = this.wallGroup;
        }
        return;
      }

      let mesh: Mesh;

      switch (element.type) {
        case 'wall':
          mesh = Mesh.CreateBox(element.id, 1, this.scene);
          break;
        case 'floor':
        case 'ceiling':
          mesh = Mesh.CreateGround(element.id, 1, 1, 1, this.scene);
          break;
        case 'door':
          mesh = Mesh.CreateBox(element.id, 1, this.scene);
          mesh.scaling.y = 0.8; // Door height
          break;
        case 'window':
          mesh = Mesh.CreateBox(element.id, 1, this.scene);
          mesh.scaling.y = 0.6; // Window height
          break;
        case 'beam':
        case 'column':
          mesh = Mesh.CreateCylinder(element.id, 1, 0.1, 0.1, 8, 1, this.scene);
          break;
        default:
          mesh = Mesh.CreateBox(element.id, 1, this.scene);
      }

      if (!mesh) {
        throw new Error(`Failed to create mesh for element ${element.id}`);
      }

      mesh.position = element.position;
      mesh.rotation = element.rotation;
      mesh.scaling = element.scale;

      // Apply material
      const material = new StandardMaterial(`${element.id}_material`, this.scene);
      if (!material) {
        throw new Error(`Failed to create material for element ${element.id}`);
      }

      material.diffuseColor = this.getElementColor(element);
      mesh.material = material;

      element.mesh = mesh;
      element.visible = true;

      // Add wall elements to wall group for peeling functionality
      if (element.type === 'wall' && this.wallGroup) {
        mesh.parent = this.wallGroup;
      }
    } catch (error) {
      console.error(`Failed to create mesh for element ${element.id}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Element mesh creation failed for ${element.id}: ${message}`);
    }
  }

  // Create mesh for hidden detail
  private async createHiddenDetailMesh(detail: BIMHiddenDetail): Promise<void> {
    try {
      if (!detail || !detail.id) {
        throw new Error('Invalid BIM hidden detail provided for mesh creation');
      }

      if (!this.scene) {
        throw new Error('Scene not available for hidden detail mesh creation');
      }

      let mesh: Mesh;

      switch (detail.type) {
        case 'wiring':
          mesh = Mesh.CreateCylinder(detail.id, 0.05, 0.01, 0.01, 6, 1, this.scene);
          mesh.scaling.z = 2; // Extend along wall
          break;
        case 'plumbing':
          mesh = Mesh.CreateCylinder(detail.id, 0.05, 0.02, 0.02, 8, 1, this.scene);
          mesh.scaling.z = 1.5; // Pipe length
          break;
        case 'hvac':
          mesh = Mesh.CreateCylinder(detail.id, 0.1, 0.15, 0.15, 8, 1, this.scene);
          mesh.scaling.z = 3; // Duct length
          break;
        default:
          mesh = Mesh.CreateSphere(detail.id, 8, 0.05, this.scene);
      }

      if (!mesh) {
        throw new Error(`Failed to create mesh for hidden detail ${detail.id}`);
      }

      mesh.position = detail.position;

      // Apply material for hidden details
      const material = new StandardMaterial(`${detail.id}_material`, this.scene);
      if (!material) {
        throw new Error(`Failed to create material for hidden detail ${detail.id}`);
      }

      material.diffuseColor = this.getHiddenDetailColor(detail);
      material.alpha = this.config.transparencyMode ? 0.7 : 1.0;
      mesh.material = material;

      // Add to hidden detail group
      if (this.hiddenDetailGroup) {
        mesh.parent = this.hiddenDetailGroup;
      }

      detail.mesh = mesh;
      detail.visible = false;
    } catch (error) {
      console.error(`Failed to create mesh for hidden detail ${detail.id}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Hidden detail mesh creation failed for ${detail.id}: ${message}`);
    }
  }

  // Get color for BIM element based on type
  private getElementColor(element: BIMElement): Color3 {
    if (!this.config.colorCoding) {
      return new Color3(0.8, 0.8, 0.8); // Default gray
    }

    const colorMap: { [key: string]: Color3 } = {
      wall: new Color3(0.9, 0.9, 0.9),      // Light gray
      floor: new Color3(0.7, 0.7, 0.7),     // Medium gray
      ceiling: new Color3(0.95, 0.95, 0.95), // Very light gray
      door: new Color3(0.6, 0.4, 0.2),      // Brown
      window: new Color3(0.3, 0.6, 0.9),    // Light blue
      beam: new Color3(0.5, 0.5, 0.5),      // Gray
      column: new Color3(0.4, 0.4, 0.4),    // Dark gray
      duct: new Color3(0.8, 0.6, 0.4),      // Tan
      pipe: new Color3(0.2, 0.4, 0.6),      // Blue
      cable: new Color3(0.4, 0.4, 0.1),     // Yellow
      fixture: new Color3(0.8, 0.8, 0.2)    // Yellow
    };

    return colorMap[element.type] || new Color3(0.8, 0.8, 0.8);
  }

  // Get color for hidden detail based on type
  private getHiddenDetailColor(detail: BIMHiddenDetail): Color3 {
    const colorMap: { [key: string]: Color3 } = {
      wiring: new Color3(1, 1, 0),      // Yellow
      plumbing: new Color3(0, 0, 1),    // Blue
      hvac: new Color3(1, 0.5, 0),      // Orange
      electrical: new Color3(1, 0, 0),  // Red
      structural: new Color3(0.5, 0.5, 0.5), // Gray
      insulation: new Color3(1, 0.8, 0.8)    // Pink
    };

    return colorMap[detail.type] || new Color3(0.5, 0.5, 0.5);
  }

  // Toggle hidden details visibility
  toggleHiddenDetails(): void {
    this.config.showHiddenDetails = !this.config.showHiddenDetails;

    if (this.hiddenDetailGroup) {
      this.hiddenDetailGroup.setEnabled(this.config.showHiddenDetails);
    }

    // Update all hidden detail meshes
    this.models.forEach(model => {
      model.hiddenDetails.forEach(detail => {
        if (detail.mesh) {
          detail.visible = this.config.showHiddenDetails;
          detail.mesh.setEnabled(this.config.showHiddenDetails);
        }
      });
    });

    console.log(`Hidden details ${this.config.showHiddenDetails ? 'shown' : 'hidden'}`);
  }

  // Set detail level
  setDetailLevel(level: 'low' | 'medium' | 'high'): void {
    this.config.detailLevel = level;

    // Adjust mesh complexity based on detail level
    this.models.forEach(model => {
      model.elements.forEach(element => {
        if (element.mesh) {
          this.adjustMeshDetail(element.mesh, level);
        }
      });
    });

    console.log(`Detail level set to: ${level}`);
  }

  // Adjust mesh detail level
  private adjustMeshDetail(mesh: Mesh | InstancedMesh, level: 'low' | 'medium' | 'high'): void {
    // In a real implementation, this would switch between different LOD meshes
    // For now, we'll just adjust material properties
    const material = mesh.material as StandardMaterial;
    if (material) {
      switch (level) {
        case 'low':
          material.alpha = 0.8;
          break;
        case 'medium':
          material.alpha = 0.9;
          break;
        case 'high':
          material.alpha = 1.0;
          break;
      }
    }
  }

  // Toggle transparency mode
  toggleTransparencyMode(): void {
    this.config.transparencyMode = !this.config.transparencyMode;

    this.models.forEach(model => {
      // Update element transparency
      model.elements.forEach(element => {
        if (element.mesh && element.mesh.material) {
          const material = element.mesh.material as StandardMaterial;
          material.alpha = this.config.transparencyMode ? 0.7 : 1.0;
        }
      });

      // Update hidden detail transparency
      model.hiddenDetails.forEach(detail => {
        if (detail.mesh && detail.mesh.material) {
          const material = detail.mesh.material as StandardMaterial;
          material.alpha = this.config.transparencyMode ? 0.5 : 1.0;
        }
      });
    });

    console.log(`Transparency mode ${this.config.transparencyMode ? 'enabled' : 'disabled'}`);
  }

  // Get BIM element by ID
  getElementById(elementId: string): BIMElement | null {
    for (const model of this.models.values()) {
      const element = model.elements.find(e => e.id === elementId);
      if (element) return element;
    }
    return null;
  }

  // Get BIM model by ID
  getModelById(modelId: string | null): BIMModel | null {
    if (!modelId) return null;
    return this.models.get(modelId) || null;
  }

  // Get all BIM models
  getAllModels(): BIMModel[] {
    return Array.from(this.models.values());
  }

  // Export BIM data
  exportBIMData(modelId: string): string {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    return JSON.stringify(model, null, 2);
  }

  // Update BIM configuration
  updateConfig(newConfig: Partial<BIMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfigChanges();
  }

  // Apply configuration changes
  private applyConfigChanges(): void {
    this.toggleHiddenDetails();
    this.setDetailLevel(this.config.detailLevel);
    this.toggleTransparencyMode();
  }

  // Get current configuration
  getConfig(): BIMConfig {
    return { ...this.config };
  }

  // Highlight BIM element
  highlightElement(elementId: string, highlight: boolean = true): void {
    const element = this.getElementById(elementId);
    if (!element || !element.mesh) return;

    const material = element.mesh.material as StandardMaterial;
    if (highlight) {
      material.emissiveColor = new Color3(0.2, 0.2, 0.2);
    } else {
      material.emissiveColor = Color3.Black();
    }
  }

  // Get element information for display
  getElementInfo(elementId: string): any {
    const element = this.getElementById(elementId);
    if (!element) return null;

    return {
      id: element.id,
      name: element.name,
      type: element.type,
      category: element.category,
      material: element.material,
      properties: element.properties,
      hiddenDetails: element.hiddenDetails?.length || 0
    };
  }

  // Calculate quantity for BIM element based on its type and dimensions
  private calculateElementQuantity(element: BIMElement): number {
    const { scale, type, properties } = element;

    switch (type) {
      case 'wall':
        // Calculate wall area (length * height)
        return scale.x * scale.y;

      case 'floor':
      case 'ceiling':
        // Calculate floor/ceiling area (width * depth)
        return scale.x * scale.z;

      case 'door':
        // Calculate door area (width * height)
        return scale.x * scale.y;

      case 'window':
        // Calculate window area (width * height)
        return scale.x * scale.y;

      case 'beam':
        // Calculate beam volume (length * width * height)
        return scale.x * scale.y * scale.z;

      case 'column':
        // Calculate column volume (width * depth * height)
        return scale.x * scale.z * scale.y;

      case 'duct':
      case 'pipe':
        // Calculate linear length
        return scale.x;

      case 'cable':
        // Calculate cable length
        return scale.x;

      case 'fixture':
        // Usually counted as units
        return 1;

      default:
        // Default to volume calculation
        return scale.x * scale.y * scale.z;
    }
  }

  // Set cost estimator for cost calculations
  setCostEstimator(costEstimator: CostEstimator): void {
    this.costEstimator = costEstimator;
  }

  // Get cost estimate for a specific BIM element
  getElementCostEstimate(elementId: string, region?: string): CostEstimate | null {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return null;
    }

    const element = this.getElementById(elementId);
    if (!element) return null;

    const quantity = this.calculateElementQuantity(element);
    return this.costEstimator.calculateElementCost(element, quantity, region);
  }

  // Get cost breakdown for entire BIM model
  getModelCostBreakdown(modelId: string, region?: string): CostBreakdown | null {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return null;
    }

    return this.costEstimator.calculateProjectCost(modelId, region || this.costEstimator['defaultRegion']);
  }

  // Compare material costs for a BIM element
  compareElementMaterialCosts(
    elementId: string,
    alternatives?: string[],
    region?: string
  ): any {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return null;
    }

    const element = this.getElementById(elementId);
    if (!element || !element.material) return null;

    const quantity = this.calculateElementQuantity(element);
    return this.costEstimator.compareMaterialCosts(element.material, quantity, region, alternatives);
  }

  // Get all available materials from cost estimator
  getAvailableMaterials(): any[] {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return [];
    }

    return this.costEstimator.getAllMaterials();
  }

  // Update material cost in real-time
  updateMaterialCost(materialId: string, newCost: number, region?: string): boolean {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return false;
    }

    return this.costEstimator.updateMaterialCost(materialId, newCost, region);
  }

  // Get cost estimate by ID
  getCostEstimate(estimateId: string): CostEstimate | null {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return null;
    }

    return this.costEstimator.getCostEstimate(estimateId);
  }

  // Get all cost estimates
  getAllCostEstimates(): CostEstimate[] {
    if (!this.costEstimator) {
      console.warn('CostEstimator not set');
      return [];
    }

    return this.costEstimator.getAllCostEstimates();
  }

  // Toggle wall peeling mode
  toggleWallPeeling(): void {
    this.config.wallPeelingMode = !this.config.wallPeelingMode;

    if (this.wallGroup) {
      if (this.config.wallPeelingMode) {
        // Make walls semi-transparent for peeling effect
        this.wallGroup.getChildMeshes().forEach(mesh => {
          const material = mesh.material as StandardMaterial;
          if (material) {
            material.alpha = 0.3;
          }
        });
      } else {
        // Restore wall opacity
        this.wallGroup.getChildMeshes().forEach(mesh => {
          const material = mesh.material as StandardMaterial;
          if (material) {
            material.alpha = 1.0;
          }
        });
      }
    }

    console.log(`Wall peeling mode ${this.config.wallPeelingMode ? 'enabled' : 'disabled'}`);
  }

  // Enable clash detection
  enableClashDetection(): Promise<void> {
    this.config.clashDetectionEnabled = true;
    // Highlight spheres are created by performClashDetection() below (via
    // createClashHighlight -> parented under clashHighlightGroup), but the group itself
    // was created disabled at init and never re-enabled anywhere - every clash marker
    // was rendered invisible forever, with the only trace of a clash being a
    // console.log. Returning the promise (instead of fire-and-forget) also lets the
    // caller report a real "N clashes found" result instead of just "running".
    this.clashHighlightGroup?.setEnabled(true);
    console.log('Clash detection enabled');
    return this.performClashDetection();
  }

  // Disable clash detection
  disableClashDetection(): void {
    this.config.clashDetectionEnabled = false;

    // Clear existing clash highlights
    if (this.clashHighlightGroup) {
      this.clashHighlightGroup.getChildMeshes().forEach(mesh => {
        mesh.dispose();
      });
    }

    this.clashes = [];
    console.log('Clash detection disabled');
  }

  // Perform clash detection. Was a naive synchronous all-pairs O(n^2) scan over every element
  // in every model - on a model with a few thousand elements that's millions of bounding-box
  // checks done synchronously on the main thread, which is a multi-second UI freeze the
  // instant Clash Detection is enabled. Fixed two ways:
  //  1. Sweep-and-prune broad phase: sort by min.x once, then only compare a mesh against
  //     others whose X range could still overlap (break out as soon as it can't) - for
  //     typical, spatially-distributed BIM geometry this rules out the vast majority of pairs
  //     without ever touching Y/Z, turning O(n^2) into roughly O(n log n) in practice.
  //  2. Yield periodically (chunked async loop) so even a pathological worst case (e.g. every
  //     element's bounding box overlapping on X) can't block the main thread for more than a
  //     chunk's worth of work at a time.
  private async performClashDetection(): Promise<void> {
    if (!this.config.clashDetectionEnabled) return;

    this.clashes = [];

    interface BoundedMesh { mesh: Mesh | InstancedMesh; min: Vector3; max: Vector3 }
    const boundedMeshes: BoundedMesh[] = [];
    this.models.forEach(model => {
      model.elements.forEach(element => {
        if (element.mesh) {
          const box = element.mesh.getBoundingInfo().boundingBox;
          boundedMeshes.push({ mesh: element.mesh, min: box.minimumWorld, max: box.maximumWorld });
        }
      });
    });

    boundedMeshes.sort((a, b) => a.min.x - b.min.x);

    const CHUNK_PAIR_LIMIT = 200; // comparisons per tick - keeps each chunk well under one frame
    let pairsSinceYield = 0;

    for (let i = 0; i < boundedMeshes.length; i++) {
      const a = boundedMeshes[i];
      for (let j = i + 1; j < boundedMeshes.length; j++) {
        const b = boundedMeshes[j];
        // Sorted by min.x: once b starts after a ends on X, nothing further in this inner
        // loop can overlap a on X either.
        if (b.min.x > a.max.x) break;

        if (
          a.max.y >= b.min.y && a.min.y <= b.max.y &&
          a.max.z >= b.min.z && a.min.z <= b.max.z
        ) {
          const clash: BIMClash = {
            id: `clash_${this.clashes.length}`,
            type: 'intersection',
            severity: 'critical',
            elements: [a.mesh.id, b.mesh.id],
            description: `Intersection detected between ${a.mesh.id} and ${b.mesh.id}`,
            position: a.mesh.position.add(b.mesh.position).scale(0.5)
          };
          this.clashes.push(clash);
          this.createClashHighlight(clash);
        }

        pairsSinceYield++;
        if (pairsSinceYield >= CHUNK_PAIR_LIMIT) {
          pairsSinceYield = 0;
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          // Bail out if the feature was disabled while this scan was still mid-flight (e.g.
          // on a very large model) - disableClashDetection() already cleared this.clashes and
          // the highlight group, so continuing would silently repopulate both after the user
          // turned the feature off.
          if (!this.config.clashDetectionEnabled) return;
        }
      }
    }

    console.log(`Clash detection complete: ${this.clashes.length} clashes found`);
  }

  // Create visual highlight for clash
  private createClashHighlight(clash: BIMClash): void {
    if (!this.clashHighlightGroup) return;

    // Create a sphere to highlight the clash position
    const highlightMesh = Mesh.CreateSphere(`clash_highlight_${clash.id}`, 16, 0.2, this.scene);
    highlightMesh.position = clash.position;

    // Apply red material for clash highlight
    const material = new StandardMaterial(`clash_material_${clash.id}`, this.scene);
    material.diffuseColor = new Color3(1, 0, 0);
    material.emissiveColor = new Color3(0.5, 0, 0);
    highlightMesh.material = material;

    // Add to clash highlight group
    highlightMesh.parent = this.clashHighlightGroup;
  }

  // Get all detected clashes
  getClashes(): BIMClash[] {
    return [...this.clashes];
  }

  // Get clash by ID
  getClashById(clashId: string): BIMClash | null {
    return this.clashes.find(clash => clash.id === clashId) || null;
  }

  // Performance optimization: Mesh instancing methods

  // Create or get instanced mesh for repeated elements
  private createInstancedMesh(element: BIMElement, meshType: string): Mesh | InstancedMesh {
    const instanceKey = `${meshType}_${element.material || 'default'}`;

    // Check if we already have instances for this type
    if (this.meshInstances.has(instanceKey)) {
      const instanceData = this.meshInstances.get(instanceKey)!;

      // Create new instance from source mesh
      const newInstance = instanceData.sourceMesh.createInstance(`${element.id}_instance`);
      newInstance.position = element.position;
      newInstance.rotation = element.rotation;
      newInstance.scaling = element.scale;

      // Track the instance
      instanceData.instances.push(newInstance);
      return newInstance;
    }

    // Create source mesh for future instances
    let sourceMesh: Mesh;

    switch (meshType) {
      case 'wall':
        sourceMesh = Mesh.CreateBox('wall_source', 1, this.scene);
        break;
      case 'door':
        sourceMesh = Mesh.CreateBox('door_source', 1, this.scene);
        sourceMesh.scaling.y = 0.8;
        break;
      case 'window':
        sourceMesh = Mesh.CreateBox('window_source', 1, this.scene);
        sourceMesh.scaling.y = 0.6;
        break;
      case 'beam':
      case 'column':
        sourceMesh = Mesh.CreateCylinder('structural_source', 1, 0.1, 0.1, 8, 1, this.scene);
        break;
      default:
        sourceMesh = Mesh.CreateBox('default_source', 1, this.scene);
    }

    // Apply material to source mesh
    const material = new StandardMaterial(`${instanceKey}_material`, this.scene);
    material.diffuseColor = this.getElementColor(element);
    sourceMesh.material = material;

    // Make source mesh invisible (only instances will be visible)
    sourceMesh.setEnabled(false);

    // Create first instance
    const firstInstance = sourceMesh.createInstance(element.id);
    firstInstance.position = element.position;
    firstInstance.rotation = element.rotation;
    firstInstance.scaling = element.scale;

    // Store instance data
    this.meshInstances.set(instanceKey, {
      sourceMesh,
      instances: [firstInstance]
    });

    return firstInstance;
  }

  // Check if element should use instancing
  private shouldUseInstancing(elementType: string): boolean {
    // Count existing elements of this type
    let count = 0;
    this.models.forEach(model => {
      model.elements.forEach(element => {
        if (element.type === elementType) {
          count++;
        }
      });
    });

    return count >= this.instanceThreshold;
  }

  // Get mesh creation key for instancing
  private getMeshCreationKey(element: BIMElement): string {
    return `${element.type}_${element.material || 'default'}_${JSON.stringify(element.scale)}`;
  }

  // Clean up mesh instances
  private cleanupMeshInstances(): void {
    this.meshInstances.forEach((instanceData, key) => {
      // Dispose all instances
      instanceData.instances.forEach(instance => {
        instance.dispose();
      });

      // Dispose source mesh
      instanceData.sourceMesh.dispose();
    });

    this.meshInstances.clear();
  }

  // Update instance threshold
  setInstanceThreshold(threshold: number): void {
    if (threshold < 1) {
      console.warn('Instance threshold must be at least 1');
      return;
    }

    this.instanceThreshold = threshold;
    console.log(`Instance threshold set to: ${threshold}`);
  }

  // Get current instance statistics
  getInstanceStats(): { totalInstances: number; uniqueTypes: number; memorySavings: string } {
    let totalInstances = 0;
    const uniqueTypes = this.meshInstances.size;

    this.meshInstances.forEach(instanceData => {
      totalInstances += instanceData.instances.length;
    });

    // Estimate memory savings (rough calculation)
    const estimatedSavings = totalInstances * 0.8; // Assume 80% memory savings per instance

    return {
      totalInstances,
      uniqueTypes,
      memorySavings: `${estimatedSavings.toFixed(1)}MB`
    };
  }

  // Wraps an already-loaded GLB's real meshes as a BIM model (real
  // position/rotation/scale, real element count) instead of the mock demo
  // data - without this, every uploaded model was invisible to the whole
  // BIM-dependent tool suite (Cost Estimator, ROI Calculator, Budget Tier
  // Comparison, Ergonomic/Energy/Shadow Analysis all call getModelById()
  // and got nothing back, showing "load a model first" even with a real
  // model fully loaded and visible in the 3D view).
  registerLoadedModelFromScene(modelId: string, name: string): BIMModel {
    const meshes = this.scene.meshes.filter((m): m is Mesh =>
      m instanceof Mesh &&
      m.getTotalVertices() > 0 &&
      !!m.name &&
      !/^(ground|__root__|measure_|preview_|scenario_|proceduralSkybox|analytics_heatmap)/i.test(m.name)
    );

    const inferType = (meshName: string): BIMElementType => {
      const n = meshName.toLowerCase();
      if (n.includes('wall')) return 'wall';
      if (n.includes('floor') || n.includes('ground') || n.includes('slab')) return 'floor';
      if (n.includes('ceiling')) return 'ceiling';
      if (n.includes('door')) return 'door';
      if (n.includes('window') || n.includes('glass')) return 'window';
      if (n.includes('beam')) return 'beam';
      if (n.includes('column') || n.includes('pillar')) return 'column';
      if (n.includes('roof')) return 'roof';
      return 'wall';
    };
    const inferCategory = (type: BIMElementType): BIMCategory =>
      type === 'beam' || type === 'column' ? 'Structure' : 'Architecture';
    const inferMaterial = (type: BIMElementType): string => {
      if (type === 'door') return 'wood_sustainable';
      if (type === 'window') return 'glass_standard';
      if (type === 'beam' || type === 'column') return 'steel_standard';
      return 'concrete_standard';
    };

    const elements: BIMElement[] = meshes.map((mesh, index) => {
      const type = inferType(mesh.name);
      const bb = mesh.getBoundingInfo().boundingBox;
      const size = bb.maximum.subtract(bb.minimum);
      return {
        id: mesh.id || `element_${index}`,
        name: mesh.name || `Element ${index + 1}`,
        type,
        category: inferCategory(type),
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        scale: mesh.scaling.clone(),
        material: inferMaterial(type),
        properties: {
          width: size.x,
          height: size.y,
          depth: size.z,
          area: size.x * size.z,
          volume: size.x * size.y * size.z,
        },
        mesh,
        visible: mesh.isVisible,
      };
    });

    const model: BIMModel = {
      id: modelId,
      name,
      source: 'gltf',
      elements,
      hiddenDetails: [],
      metadata: {
        author: 'upload',
        created: new Date(),
        lastModified: new Date(),
        units: 'm',
        coordinateSystem: 'right-handed-y-up',
      },
    };

    this.models.set(modelId, model);
    return model;
  }

  // Load demo BIM model. Idempotent - returns the existing demo model (and its already-created
  // meshes) if one was already loaded, instead of creating a fresh one every call. This used
  // to generate a brand-new modelId (Date.now()) and a full new set of wall/floor/ceiling/
  // wiring/plumbing/hvac meshes on every call with no cleanup of the previous set, so
  // re-enabling the BIM Integration feature repeatedly permanently stacked duplicate,
  // overlapping demo geometry in the scene.
  async loadDemoModel(): Promise<BIMModel> {
    if (this.demoModelId) {
      const existing = this.models.get(this.demoModelId);
      if (existing) return existing;
    }
    const modelId = `demo_model_${Date.now()}`;
    const model = this.createMockBIMModel(modelId, 'Demo BIM Model', 'custom');
    this.models.set(modelId, model);
    await this.createBIMMeshes(model);
    this.demoModelId = modelId;
    console.log('Demo BIM model loaded');
    return model;
  }

  // Get energy analysis for a model
  getEnergyAnalysis(modelId: string): any {
    const model = this.models.get(modelId);
    if (!model) {
      console.warn(`Model ${modelId} not found for energy analysis`);
      return null;
    }

    // Calculate basic energy metrics based on building elements
    let totalArea = 0;
    let totalVolume = 0;
    let windowArea = 0;
    let wallArea = 0;

    model.elements.forEach(element => {
      const quantity = this.calculateElementQuantity(element);
      if (element.type === 'wall') {
        wallArea += quantity;
      } else if (element.type === 'window') {
        windowArea += quantity;
      } else if (element.type === 'floor' || element.type === 'ceiling') {
        totalArea += quantity;
      }
      totalVolume += quantity;
    });

    // Mock energy calculations
    const heatingLoad = totalVolume * 0.05; // BTU per cubic foot
    const coolingLoad = totalArea * 0.1; // BTU per square foot
    const lightingLoad = totalArea * 3; // Watts per square foot
    const solarGain = windowArea * 0.8; // Solar heat gain factor

    return {
      modelId,
      totalArea,
      totalVolume,
      windowArea,
      wallArea,
      energyMetrics: {
        heatingLoad,
        coolingLoad,
        lightingLoad,
        solarGain,
        totalLoad: heatingLoad + coolingLoad + lightingLoad
      },
      efficiency: {
        insulationRating: 'R-13',
        windowEfficiency: 'Low-E',
        overallScore: 75
      }
    };
  }

  // Dispose resources
  dispose(): void {
    // Clean up mesh instances first
    this.cleanupMeshInstances();

    this.models.forEach(model => {
      // Dispose element meshes
      model.elements.forEach(element => {
        if (element.mesh) {
          element.mesh.dispose();
        }
      });

      // Dispose hidden detail meshes
      model.hiddenDetails.forEach(detail => {
        if (detail.mesh) {
          detail.mesh.dispose();
        }
      });
    });

    if (this.hiddenDetailGroup) {
      this.hiddenDetailGroup.dispose();
    }

    if (this.wallGroup) {
      this.wallGroup.dispose();
    }

    if (this.clashHighlightGroup) {
      this.clashHighlightGroup.dispose();
    }

    this.models.clear();

    if (this.costEstimator) {
      this.costEstimator.dispose();
    }
  }
}
