import { BIMManager, BIMElement, BIMModel } from './BIMManager';
import { SimulationManager, MaterialData, MaintenanceIssue } from './SimulationManager';
import { Vector3 } from '@babylonjs/core';
import { SecurityUtils } from './utils/SecurityUtils';

export interface MaterialCostData {
  id: string;
  name: string;
  type: 'concrete' | 'steel' | 'wood' | 'glass' | 'insulation' | 'finish' | 'plumbing' | 'electrical' | 'hvac';
  baseCostPerUnit: number; // Cost per cubic meter or square meter
  unit: 'm3' | 'm2' | 'kg' | 'linear_meter';
  regionalMultipliers: { [region: string]: number }; // Regional cost variations
  laborCostPerUnit: number; // Labor cost per unit
  disposalCostPerUnit: number; // Disposal cost per unit
  installationComplexity: 'low' | 'medium' | 'high';
  supplierDiscounts: { [supplier: string]: number }; // Percentage discounts
  lastUpdated: Date;
}

export interface LaborCostData {
  skillLevel: 'unskilled' | 'skilled' | 'specialist';
  hourlyRate: number;
  region: string;
  overheadMultiplier: number; // 1.2 = 20% overhead
  profitMargin: number; // 0.15 = 15% profit margin
}

export interface CostBreakdown {
  materials: number;
  labor: number;
  disposal: number;
  overhead: number;
  profit: number;
  total: number;
  breakdown: {
    [category: string]: {
      cost: number;
      percentage: number;
      items: Array<{
        name: string;
        quantity: number;
        unitCost: number;
        totalCost: number;
      }>;
    };
  };
}

export interface CostComparison {
  originalMaterial: string;
  alternatives: Array<{
    materialId: string;
    materialName: string;
    totalCost: number;
    costSavings: number;
    environmentalImpact: number;
    durability: number;
    recommendation: string;
  }>;
  bestAlternative: string;
}

export interface CostEstimate {
  id: string;
  projectId: string;
  elementId?: string;
  materialId: string;
  quantity: number;
  unit: string;
  region: string;
  costBreakdown: CostBreakdown;
  createdAt: Date;
  updatedAt: Date;
  validUntil: Date;
}

export interface VendorData {
  id: string;
  name: string;
  type: 'manufacturer' | 'distributor' | 'retailer' | 'wholesaler';
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  certifications: string[]; // ISO, LEED, etc.
  rating: number; // 1-5 stars
  materials: string[]; // Material IDs they supply
  leadTime: number; // Days for delivery
  minimumOrder: number;
  paymentTerms: string;
  lastUpdated: Date;
}

export interface VendorAvailability {
  vendorId: string;
  materialId: string;
  availableQuantity: number;
  unit: string;
  pricePerUnit: number;
  discountTiers: Array<{
    minQuantity: number;
    discountPercent: number;
  }>;
  leadTime: number; // Days
  lastUpdated: Date;
  inStock: boolean;
  alternativeMaterials?: string[]; // Alternative materials if out of stock
}

export interface SupplyChainLink {
  materialId: string;
  preferredVendors: VendorData[];
  availabilityData: VendorAvailability[];
  priceHistory: Array<{
    date: Date;
    vendorId: string;
    price: number;
    quantity: number;
  }>;
  alerts: Array<{
    type: 'price_change' | 'stock_low' | 'lead_time_change' | 'quality_issue';
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }>;
}

export interface PerformanceImpactData {
  energyEfficiency: {
    current: number; // kWh/m²/year
    projected: number; // kWh/m²/year
    savings: number; // kWh/m²/year
    percentageChange: number; // %
  };
  insulation: {
    rValue: {
      current: number;
      projected: number;
      improvement: number;
    };
    thermalConductivity: {
      current: number; // W/m·K
      projected: number; // W/m·K
      change: number;
    };
  };
  structural: {
    strength: {
      current: number; // MPa
      projected: number; // MPa
      change: number;
    };
    durability: {
      current: number; // years
      projected: number; // years
      change: number;
    };
  };
  environmental: {
    carbonFootprint: {
      current: number; // kg CO2/m²
      projected: number; // kg CO2/m²
      reduction: number; // kg CO2/m²
    };
    recyclability: {
      current: number; // %
      projected: number; // %
      improvement: number;
    };
  };
  cost: {
    immediate: {
      current: number;
      projected: number;
      difference: number;
      percentageChange: number;
    };
    lifecycle: {
      current: number;
      projected: number;
      savings: number;
      paybackPeriod: number; // years
    };
  };
  overallScore: {
    current: number; // 0-100
    projected: number; // 0-100
    improvement: number;
    recommendation: string;
  };
}

export interface MaterialSwapResult {
  originalEstimate: CostEstimate;
  newEstimate: CostEstimate;
  performanceImpact: PerformanceImpactData;
  recommendations: string[];
  warnings: string[];
}

export class CostEstimator {
  private bimManager: BIMManager;
  private simulationManager: SimulationManager;
  private materialDatabase: Map<string, MaterialCostData> = new Map();
  private laborDatabase: Map<string, LaborCostData> = new Map();
  private costEstimates: Map<string, CostEstimate> = new Map();
  private defaultRegion: string = 'US_East';

  // Budget-Conscious Design Mode
  private clientBudget: number = 0;
  private budgetEnabled: boolean = false;

  // Supply Chain Integration
  private vendorDatabase: Map<string, VendorData> = new Map();
  private vendorAvailability: Map<string, VendorAvailability[]> = new Map(); // materialId -> availability data
  private supplyChainLinks: Map<string, SupplyChainLink> = new Map(); // materialId -> supply chain data
  private priceUpdateInterval: number = 3600000; // 1 hour in milliseconds

  constructor(bimManager: BIMManager, simulationManager: SimulationManager) {
    this.bimManager = bimManager;
    this.simulationManager = simulationManager;
    this.initializeMaterialDatabase();
    this.initializeLaborDatabase();
    this.initializeVendorDatabase();
    this.startPriceMonitoring();
  }

  // Budget-Conscious Design Mode Methods
  setClientBudget(budget: number): void {
    this.clientBudget = budget;
    this.budgetEnabled = budget > 0;
  }

  getClientBudget(): number {
    return this.clientBudget;
  }

  isBudgetEnabled(): boolean {
    return this.budgetEnabled;
  }

  // Get materials filtered by budget constraints
  getBudgetFilteredMaterials(materialType?: MaterialCostData['type']): MaterialCostData[] {
    if (!this.budgetEnabled) {
      return materialType ? this.getAllMaterials().filter(m => m.type === materialType) : this.getAllMaterials();
    }

    const allMaterials = materialType ? this.getAllMaterials().filter(m => m.type === materialType) : this.getAllMaterials();
    return allMaterials.filter(material => {
      // Estimate if this material could fit within remaining budget
      // This is a simplified check - in practice, you'd need to consider the full project context
      const estimatedCost = material.baseCostPerUnit * 10; // Rough estimate for 10 units
      return estimatedCost <= this.clientBudget;
    });
  }

  // Calculate project cost with budget constraints
  calculateProjectCostWithBudget(modelId: string, region: string = this.defaultRegion): CostBreakdown | null {
    if (!this.budgetEnabled) {
      return this.calculateProjectCost(modelId, region);
    }

    const model = this.bimManager.getModelById(modelId);
    if (!model) return null;

    let totalMaterials = 0;
    let totalLabor = 0;
    let totalDisposal = 0;
    let totalOverhead = 0;
    let totalProfit = 0;

    const categoryBreakdown: { [key: string]: any } = {};

    for (const element of model.elements) {
      if (!element.material) continue;

      const quantity = this.calculateElementQuantity(element);
      const estimate = this.calculateElementCost(element, quantity, region);

      if (!estimate) continue;

      // Check if adding this element would exceed budget
      const projectedTotal = totalMaterials + totalLabor + totalDisposal + totalOverhead + totalProfit +
                           estimate.costBreakdown.materials + estimate.costBreakdown.labor +
                           estimate.costBreakdown.disposal + estimate.costBreakdown.overhead +
                           estimate.costBreakdown.profit;

      if (projectedTotal > this.clientBudget) {
        console.warn(`Budget constraint: Skipping element ${SecurityUtils.sanitizeForLog(element.name)} as it would exceed budget`);
        continue;
      }

      totalMaterials += estimate.costBreakdown.materials;
      totalLabor += estimate.costBreakdown.labor;
      totalDisposal += estimate.costBreakdown.disposal;
      totalOverhead += estimate.costBreakdown.overhead;
      totalProfit += estimate.costBreakdown.profit;

      const category = element.category;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = {
          cost: 0,
          percentage: 0,
          items: []
        };
      }

      categoryBreakdown[category].cost += estimate.costBreakdown.total;
      categoryBreakdown[category].items.push({
        name: element.name,
        quantity,
        unitCost: estimate.costBreakdown.total / quantity,
        totalCost: estimate.costBreakdown.total
      });
    }

    const total = totalMaterials + totalLabor + totalDisposal + totalOverhead + totalProfit;

    // Calculate percentages
    Object.keys(categoryBreakdown).forEach(category => {
      categoryBreakdown[category].percentage = (categoryBreakdown[category].cost / total) * 100;
    });

    return {
      materials: totalMaterials,
      labor: totalLabor,
      disposal: totalDisposal,
      overhead: totalOverhead,
      profit: totalProfit,
      total,
      breakdown: categoryBreakdown
    };
  }

  // Get budget recommendations for material alternatives
  getBudgetRecommendations(
    originalMaterialId: string,
    quantity: number,
    region: string = this.defaultRegion
  ): CostComparison | null {
    if (!this.budgetEnabled) {
      return this.compareMaterialCosts(originalMaterialId, quantity, region);
    }

    const originalMaterial = this.materialDatabase.get(originalMaterialId);
    if (!originalMaterial) return null;

    const originalEstimate = this.calculateElementCost(
      { id: 'temp', name: 'temp', type: 'wall', category: 'Architecture', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, material: originalMaterialId, properties: {}, visible: true } as BIMElement,
      quantity,
      region
    );

    if (!originalEstimate) return null;

    const alternativeMaterials = this.getAlternativeMaterials(originalMaterial.type);
    const budgetFilteredAlternatives = alternativeMaterials.filter(altId => {
      const altMaterial = this.materialDatabase.get(altId);
      if (!altMaterial) return false;
      const altEstimate = this.calculateElementCost(
        { id: 'temp', name: 'temp', type: 'wall', category: 'Architecture', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, material: altId, properties: {}, visible: true } as BIMElement,
        quantity,
        region
      );
      return altEstimate ? altEstimate.costBreakdown.total <= this.clientBudget : false;
    });

    const comparisonAlternatives = budgetFilteredAlternatives
      .map(altId => {
        const altMaterial = this.materialDatabase.get(altId);
        if (!altMaterial) return null;

        const altEstimate = this.calculateElementCost(
          { id: 'temp', name: 'temp', type: 'wall', category: 'Architecture', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, material: altId, properties: {}, visible: true } as BIMElement,
          quantity,
          region
        );

        if (!altEstimate) return null;

        const costSavings = originalEstimate.costBreakdown.total - altEstimate.costBreakdown.total;
        const recommendation = this.generateBudgetRecommendation(originalMaterial, altMaterial, costSavings, altEstimate.costBreakdown.total);

        return {
          materialId: altId,
          materialName: altMaterial.name,
          totalCost: altEstimate.costBreakdown.total,
          costSavings,
          environmentalImpact: this.getEnvironmentalImpact(altMaterial),
          durability: this.getDurabilityScore(altMaterial),
          recommendation
        };
      })
      .filter(alt => alt !== null) as CostComparison['alternatives'];

    const bestAlternative = comparisonAlternatives.length > 0
      ? comparisonAlternatives.reduce((best, current) =>
          current.costSavings > best.costSavings ? current : best
        ).materialId
      : '';

    return {
      originalMaterial: originalMaterialId,
      alternatives: comparisonAlternatives,
      bestAlternative
    };
  }

  // Generate budget-aware recommendation
  private generateBudgetRecommendation(
    original: MaterialCostData,
    alternative: MaterialCostData,
    costSavings: number,
    alternativeCost: number
  ): string {
    const withinBudget = alternativeCost <= this.clientBudget;
    const savingsPercent = (costSavings / (original.baseCostPerUnit * 1.5)) * 100;

    if (!withinBudget) {
      return `Not recommended: Exceeds budget by $${(alternativeCost - this.clientBudget).toFixed(0)}`;
    }

    if (savingsPercent > 15) {
      return `Strong budget recommendation: ${Math.round(savingsPercent)}% cost savings within budget`;
    } else if (savingsPercent > 5) {
      return `Good budget alternative: ${Math.round(savingsPercent)}% cost savings`;
    } else if (costSavings > 0) {
      return `Budget-friendly option: Minor savings within budget constraints`;
    } else {
      return `Budget-compliant alternative: Higher cost but within budget limits`;
    }
  }

  // Initialize material cost database with regional pricing
  private initializeMaterialDatabase(): void {
    const materials: MaterialCostData[] = [
      {
        id: 'concrete_standard',
        name: 'Standard Concrete',
        type: 'concrete',
        baseCostPerUnit: 120,
        unit: 'm3',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 1.15,
          'Europe': 1.2,
          'Asia': 0.85,
          // Approximate - real India RMC (ready-mix concrete) rates run
          // roughly Rs.5,500-7,000/m3 for standard grade in urban markets,
          // which is a fraction of US per-unit costs once labor overhead
          // (accounted separately below) is factored out. Verify against
          // local contractor quotes before using for a real budget.
          'India': 0.38
        },
        laborCostPerUnit: 25,
        disposalCostPerUnit: 15,
        installationComplexity: 'medium',
        supplierDiscounts: {
          'supplier_a': 0.05,
          'supplier_b': 0.08
        },
        lastUpdated: new Date()
      },
      {
        id: 'concrete_recycled',
        name: 'Recycled Concrete',
        type: 'concrete',
        baseCostPerUnit: 110,
        unit: 'm3',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 1.12,
          'Europe': 1.18,
          'Asia': 0.82,
          'India': 0.36
        },
        laborCostPerUnit: 28,
        disposalCostPerUnit: 12,
        installationComplexity: 'medium',
        supplierDiscounts: {
          'supplier_a': 0.07,
          'supplier_b': 0.1
        },
        lastUpdated: new Date()
      },
      {
        id: 'steel_standard',
        name: 'Standard Steel',
        type: 'steel',
        baseCostPerUnit: 800,
        unit: 'kg',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 1.08,
          'Europe': 1.15,
          'Asia': 0.75,
          // TMT steel rebar runs roughly Rs.55,000-65,000/ton in India
          'India': 0.42
        },
        laborCostPerUnit: 45,
        disposalCostPerUnit: 20,
        installationComplexity: 'high',
        supplierDiscounts: {
          'supplier_a': 0.03,
          'supplier_b': 0.06
        },
        lastUpdated: new Date()
      },
      {
        id: 'steel_recycled',
        name: 'Recycled Steel',
        type: 'steel',
        baseCostPerUnit: 750,
        unit: 'kg',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 1.05,
          'Europe': 1.12,
          'Asia': 0.72,
          'India': 0.40
        },
        laborCostPerUnit: 42,
        disposalCostPerUnit: 18,
        installationComplexity: 'high',
        supplierDiscounts: {
          'supplier_a': 0.05,
          'supplier_b': 0.08
        },
        lastUpdated: new Date()
      },
      {
        id: 'wood_sustainable',
        name: 'Sustainable Wood',
        type: 'wood',
        baseCostPerUnit: 350,
        unit: 'm3',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 0.95,
          'Europe': 1.25,
          'Asia': 0.8,
          // Structural/engineered timber in India, e.g. good-quality plywood
          // or treated construction wood
          'India': 0.45
        },
        laborCostPerUnit: 30,
        disposalCostPerUnit: 8,
        installationComplexity: 'low',
        supplierDiscounts: {
          'supplier_a': 0.1,
          'supplier_b': 0.12
        },
        lastUpdated: new Date()
      },
      {
        id: 'glass_standard',
        name: 'Standard Glass',
        type: 'glass',
        baseCostPerUnit: 180,
        unit: 'm2',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 1.1,
          'Europe': 1.05,
          'Asia': 0.9,
          'India': 0.48
        },
        laborCostPerUnit: 35,
        disposalCostPerUnit: 10,
        installationComplexity: 'medium',
        supplierDiscounts: {
          'supplier_a': 0.04,
          'supplier_b': 0.07
        },
        lastUpdated: new Date()
      },
      {
        id: 'insulation_fiberglass',
        name: 'Fiberglass Insulation',
        type: 'insulation',
        baseCostPerUnit: 25,
        unit: 'm2',
        regionalMultipliers: {
          'US_East': 1.0,
          'US_West': 0.98,
          'Europe': 1.08,
          'Asia': 0.85,
          'India': 0.44
        },
        laborCostPerUnit: 12,
        disposalCostPerUnit: 5,
        installationComplexity: 'low',
        supplierDiscounts: {
          'supplier_a': 0.08,
          'supplier_b': 0.1
        },
        lastUpdated: new Date()
      }
    ];

    materials.forEach(material => {
      this.materialDatabase.set(material.id, material);
    });
  }

  // Initialize labor cost database
  private initializeLaborDatabase(): void {
    const laborRates: LaborCostData[] = [
      {
        skillLevel: 'unskilled',
        hourlyRate: 18,
        region: 'US_East',
        overheadMultiplier: 1.25,
        profitMargin: 0.15
      },
      {
        skillLevel: 'skilled',
        hourlyRate: 32,
        region: 'US_East',
        overheadMultiplier: 1.3,
        profitMargin: 0.18
      },
      {
        skillLevel: 'specialist',
        hourlyRate: 55,
        region: 'US_East',
        overheadMultiplier: 1.35,
        profitMargin: 0.2
      }
    ];

    laborRates.forEach(labor => {
      const key = `${labor.skillLevel}_${labor.region}`;
      this.laborDatabase.set(key, labor);
    });
  }

  // Find which loaded BIM model actually contains this element, and use its id as the
  // project identifier. Falls back to 'unassigned_project' if the element isn't found
  // in any currently loaded model (e.g. a freshly-created element not yet persisted).
  private resolveProjectId(element: BIMElement): string {
    const models = this.bimManager.getAllModels();
    const owningModel = models.find((m) => m.elements.some((e) => e.id === element.id));
    return owningModel?.id || 'unassigned_project';
  }

  // Calculate real-time cost estimate for a BIM element
  calculateElementCost(
    element: BIMElement,
    quantity: number,
    region: string = this.defaultRegion,
    supplier?: string
  ): CostEstimate | null {
    const materialData = this.materialDatabase.get(element.material || '');
    if (!materialData) {
      console.warn(`Material data not found for: ${SecurityUtils.sanitizeForLog(element.material || 'unknown')}`);
      return null;
    }

    const costBreakdown = this.calculateCostBreakdown(materialData, quantity, region, supplier);
    const estimateId = `estimate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const estimate: CostEstimate = {
      id: estimateId,
      projectId: this.resolveProjectId(element),
      elementId: element.id,
      materialId: materialData.id,
      quantity,
      unit: materialData.unit,
      region,
      costBreakdown,
      createdAt: new Date(),
      updatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days validity
    };

    this.costEstimates.set(estimateId, estimate);
    return estimate;
  }

  // Calculate detailed cost breakdown
  private calculateCostBreakdown(
    material: MaterialCostData,
    quantity: number,
    region: string,
    supplier?: string
  ): CostBreakdown {
    // Apply regional multiplier
    const regionalMultiplier = material.regionalMultipliers[region] || 1.0;
    const baseMaterialCost = material.baseCostPerUnit * quantity * regionalMultiplier;

    // Apply supplier discount if available
    let materialCost = baseMaterialCost;
    if (supplier && material.supplierDiscounts[supplier]) {
      materialCost *= (1 - material.supplierDiscounts[supplier]);
    }

    // Calculate labor cost
    const laborCost = material.laborCostPerUnit * quantity;

    // Calculate disposal cost
    const disposalCost = material.disposalCostPerUnit * quantity;

    // Calculate overhead and profit based on labor rates
    const laborData = this.laborDatabase.get(`skilled_${region}`);
    const overheadMultiplier = laborData ? laborData.overheadMultiplier : 1.3;
    const profitMargin = laborData ? laborData.profitMargin : 0.18;

    const overhead = (materialCost + laborCost) * (overheadMultiplier - 1);
    const profit = (materialCost + laborCost + overhead) * profitMargin;

    const total = materialCost + laborCost + disposalCost + overhead + profit;

    // Create detailed breakdown
    const breakdown = {
      materials: {
        cost: materialCost,
        percentage: (materialCost / total) * 100,
        items: [{
          name: material.name,
          quantity,
          unitCost: material.baseCostPerUnit * regionalMultiplier,
          totalCost: materialCost
        }]
      },
      labor: {
        cost: laborCost,
        percentage: (laborCost / total) * 100,
        items: [{
          name: `Labor (${material.installationComplexity} complexity)`,
          quantity,
          unitCost: material.laborCostPerUnit,
          totalCost: laborCost
        }]
      },
      disposal: {
        cost: disposalCost,
        percentage: (disposalCost / total) * 100,
        items: [{
          name: 'Disposal/Recycling',
          quantity,
          unitCost: material.disposalCostPerUnit,
          totalCost: disposalCost
        }]
      },
      overhead: {
        cost: overhead,
        percentage: (overhead / total) * 100,
        items: [{
          name: 'Overhead',
          quantity: 1,
          unitCost: overhead,
          totalCost: overhead
        }]
      },
      profit: {
        cost: profit,
        percentage: (profit / total) * 100,
        items: [{
          name: 'Profit Margin',
          quantity: 1,
          unitCost: profit,
          totalCost: profit
        }]
      }
    };

    return {
      materials: materialCost,
      labor: laborCost,
      disposal: disposalCost,
      overhead,
      profit,
      total,
      breakdown
    };
  }

  // Compare costs for alternative materials
  compareMaterialCosts(
    originalMaterialId: string,
    quantity: number,
    region: string = this.defaultRegion,
    alternatives?: string[]
  ): CostComparison | null {
    const originalMaterial = this.materialDatabase.get(originalMaterialId);
    if (!originalMaterial) return null;

    const originalEstimate = this.calculateElementCost(
      { id: 'temp', name: 'temp', type: 'wall', category: 'Architecture', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, material: originalMaterialId, properties: {}, visible: true } as BIMElement,
      quantity,
      region
    );

    if (!originalEstimate) return null;

    const alternativeMaterials = alternatives || this.getAlternativeMaterials(originalMaterial.type);
    const comparisonAlternatives = alternativeMaterials
      .map(altId => {
        const altMaterial = this.materialDatabase.get(altId);
        if (!altMaterial) return null;

        const altEstimate = this.calculateElementCost(
          { id: 'temp', name: 'temp', type: 'wall', category: 'Architecture', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, material: altId, properties: {}, visible: true } as BIMElement,
          quantity,
          region
        );

        if (!altEstimate) return null;

        const costSavings = originalEstimate.costBreakdown.total - altEstimate.costBreakdown.total;
        const recommendation = this.generateRecommendation(originalMaterial, altMaterial, costSavings);

        return {
          materialId: altId,
          materialName: altMaterial.name,
          totalCost: altEstimate.costBreakdown.total,
          costSavings,
          environmentalImpact: this.getEnvironmentalImpact(altMaterial),
          durability: this.getDurabilityScore(altMaterial),
          recommendation
        };
      })
      .filter(alt => alt !== null) as CostComparison['alternatives'];

    const bestAlternative = comparisonAlternatives.length > 0
      ? comparisonAlternatives.reduce((best, current) =>
          current.costSavings > best.costSavings ? current : best
        ).materialId
      : '';

    return {
      originalMaterial: originalMaterialId,
      alternatives: comparisonAlternatives,
      bestAlternative
    };
  }

  // Get alternative materials for a given type
  private getAlternativeMaterials(materialType: MaterialCostData['type']): string[] {
    const alternatives: { [key: string]: string[] } = {
      concrete: ['concrete_recycled'],
      steel: ['steel_recycled'],
      wood: ['wood_sustainable'],
      glass: ['glass_standard'],
      insulation: ['insulation_fiberglass']
    };

    return alternatives[materialType] || [];
  }

  // Generate recommendation for material alternative
  private generateRecommendation(
    original: MaterialCostData,
    alternative: MaterialCostData,
    costSavings: number
  ): string {
    const savingsPercent = (costSavings / (original.baseCostPerUnit * 1.5)) * 100;

    if (savingsPercent > 15) {
      return `Strong recommendation: ${Math.round(savingsPercent)}% cost savings with similar performance`;
    } else if (savingsPercent > 5) {
      return `Good alternative: ${Math.round(savingsPercent)}% cost savings`;
    } else if (costSavings > 0) {
      return `Minor savings: Consider if environmental benefits justify the switch`;
    } else {
      return `Higher cost: Only recommend if superior performance or environmental benefits`;
    }
  }

  // Get environmental impact score (placeholder - would integrate with external data)
  private getEnvironmentalImpact(material: MaterialCostData): number {
    const impactScores: { [key: string]: number } = {
      concrete_standard: 60,
      concrete_recycled: 75,
      steel_standard: 40,
      steel_recycled: 80,
      wood_sustainable: 90,
      glass_standard: 55,
      insulation_fiberglass: 45
    };

    return impactScores[material.id] || 50;
  }

  // Get durability score (placeholder - would integrate with material database)
  private getDurabilityScore(material: MaterialCostData): number {
    const durabilityScores: { [key: string]: number } = {
      concrete_standard: 85,
      concrete_recycled: 80,
      steel_standard: 90,
      steel_recycled: 88,
      wood_sustainable: 70,
      glass_standard: 60,
      insulation_fiberglass: 40
    };

    return durabilityScores[material.id] || 50;
  }

  // Calculate total project cost from BIM model
  calculateProjectCost(modelId: string, region: string = this.defaultRegion): CostBreakdown | null {
    const model = this.bimManager.getModelById(modelId);
    if (!model) return null;

    let totalMaterials = 0;
    let totalLabor = 0;
    let totalDisposal = 0;
    let totalOverhead = 0;
    let totalProfit = 0;

    const categoryBreakdown: { [key: string]: any } = {};

    for (const element of model.elements) {
      if (!element.material) continue;

      // Calculate volume/area based on element type and scale
      const quantity = this.calculateElementQuantity(element);

      const estimate = this.calculateElementCost(element, quantity, region);
      if (!estimate) continue;

      totalMaterials += estimate.costBreakdown.materials;
      totalLabor += estimate.costBreakdown.labor;
      totalDisposal += estimate.costBreakdown.disposal;
      totalOverhead += estimate.costBreakdown.overhead;
      totalProfit += estimate.costBreakdown.profit;

      // Aggregate by category
      const category = element.category;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = {
          cost: 0,
          percentage: 0,
          items: []
        };
      }

      categoryBreakdown[category].cost += estimate.costBreakdown.total;
      categoryBreakdown[category].items.push({
        name: element.name,
        quantity,
        unitCost: estimate.costBreakdown.total / quantity,
        totalCost: estimate.costBreakdown.total
      });
    }

    const total = totalMaterials + totalLabor + totalDisposal + totalOverhead + totalProfit;

    // Calculate percentages
    Object.keys(categoryBreakdown).forEach(category => {
      categoryBreakdown[category].percentage = (categoryBreakdown[category].cost / total) * 100;
    });

    return {
      materials: totalMaterials,
      labor: totalLabor,
      disposal: totalDisposal,
      overhead: totalOverhead,
      profit: totalProfit,
      total,
      breakdown: categoryBreakdown
    };
  }

  // Calculate quantity for BIM element based on its geometry
  private calculateElementQuantity(element: BIMElement): number {
    // Simple volume/area calculation based on element type
    switch (element.type) {
      case 'wall':
        return element.scale.x * element.scale.y * element.scale.z; // Volume
      case 'floor':
      case 'ceiling':
        return element.scale.x * element.scale.z; // Area
      case 'door':
        return element.scale.x * element.scale.y; // Area
      case 'window':
        return element.scale.x * element.scale.y; // Area
      case 'beam':
      case 'column':
        return element.scale.x * element.scale.y * element.scale.z; // Volume
      default:
        return element.scale.x * element.scale.y * element.scale.z; // Default to volume
    }
  }

  // Update material costs (for real-time pricing updates)
  updateMaterialCost(materialId: string, newCost: number, region?: string): boolean {
    const material = this.materialDatabase.get(materialId);
    if (!material) return false;

    if (region) {
      material.regionalMultipliers[region] = newCost / material.baseCostPerUnit;
    } else {
      material.baseCostPerUnit = newCost;
    }

    material.lastUpdated = new Date();

    // Invalidate existing estimates for this material
    this.invalidateEstimatesForMaterial(materialId);

    return true;
  }

  // Invalidate cost estimates when material prices change
  private invalidateEstimatesForMaterial(materialId: string): void {
    for (const [id, estimate] of this.costEstimates) {
      if (estimate.materialId === materialId) {
        estimate.validUntil = new Date(); // Mark as expired
      }
    }
  }

  // Get cost estimate by ID
  getCostEstimate(estimateId: string): CostEstimate | null {
    return this.costEstimates.get(estimateId) || null;
  }

  // Get all cost estimates
  getAllCostEstimates(): CostEstimate[] {
    return Array.from(this.costEstimates.values());
  }

  // Get material cost data
  getMaterialCostData(materialId: string): MaterialCostData | null {
    return this.materialDatabase.get(materialId) || null;
  }

  // Get all available materials
  getAllMaterials(): MaterialCostData[] {
    return Array.from(this.materialDatabase.values());
  }

  // Set default region
  setDefaultRegion(region: string): void {
    this.defaultRegion = region;
  }

  // Get available regions
  getAvailableRegions(): string[] {
    const regions = new Set<string>();
    this.materialDatabase.forEach(material => {
      Object.keys(material.regionalMultipliers).forEach(region => {
        regions.add(region);
      });
    });
    return Array.from(regions);
  }

  // Export cost data for reporting
  exportCostData(modelId: string, format: 'json' | 'csv' = 'json'): string {
    const costBreakdown = this.calculateProjectCost(modelId);
    if (!costBreakdown) return '';

    if (format === 'csv') {
      // Simple CSV export
      let csv = 'Category,Cost,Percentage\n';
      Object.entries(costBreakdown.breakdown).forEach(([category, data]) => {
        csv += `${category},${data.cost.toFixed(2)},${data.percentage.toFixed(2)}%\n`;
      });
      csv += `Total,,${costBreakdown.total.toFixed(2)}\n`;
      return csv;
    }

    return JSON.stringify(costBreakdown, null, 2);
  }

  // Estimate cost for maintenance issue
  estimateIssueCost(issue: MaintenanceIssue): number {
    // Base cost calculation based on issue severity and type
    let baseCost = 0;

    switch (issue.severity) {
      case 'low':
        baseCost = 50;
        break;
      case 'medium':
        baseCost = 200;
        break;
      case 'high':
        baseCost = 1000;
        break;
      case 'critical':
        baseCost = 5000;
        break;
      default:
        baseCost = 100;
    }

    // Adjust based on issue type
    switch (issue.type) {
      case 'crack':
        baseCost *= 2; // Structural issues like cracks
        break;
      case 'electrical':
        baseCost *= 1.5;
        break;
      case 'plumbing':
        baseCost *= 1.3;
        break;
      case 'leak':
        baseCost *= 1.4; // Water leaks
        break;
      case 'hvac':
        baseCost *= 1.8;
        break;
      case 'corrosion':
        baseCost *= 1.6; // Corrosion issues
        break;
      case 'wear':
        baseCost *= 0.8; // Wear is less expensive
        break;
      default:
        break;
    }

    // Add labor costs based on estimated hours (use timeToFailure as proxy for urgency)
    const estimatedHours = Math.max(2, Math.min(8, 10 - issue.timeToFailure / 10)); // 2-8 hours based on urgency
    const laborData = this.laborDatabase.get(`skilled_${this.defaultRegion}`);
    const hourlyRate = laborData ? laborData.hourlyRate : 32;
    const laborCost = estimatedHours * hourlyRate;

    // Add material costs if applicable based on affected systems
    let materialCost = 0;
    if (issue.affectedSystems && issue.affectedSystems.length > 0) {
      for (const system of issue.affectedSystems) {
        // Estimate material costs based on system type
        switch (system) {
          case 'structure':
            materialCost += 500; // Structural repairs
            break;
          case 'plumbing':
            materialCost += 200; // Plumbing materials
            break;
          case 'electrical':
            materialCost += 150; // Electrical materials
            break;
          case 'mechanical':
            materialCost += 300; // HVAC/mechanical materials
            break;
          case 'finishes':
            materialCost += 100; // Finishes/materials
            break;
          default:
            materialCost += 50; // General materials
        }
      }
    }

    return baseCost + laborCost + materialCost;
  }

  // Estimate material lifecycle cost
  estimateMaterialLifecycleCost(material: MaterialData): number {
    // Get material cost data
    const materialData = this.materialDatabase.get(material.id);
    if (!materialData) return 0;

    // Base material cost
    const baseCost = materialData.baseCostPerUnit;

    // Maintenance costs over lifecycle (assume 50 years)
    const lifecycleYears = 50;
    const annualMaintenanceRate = 0.02; // 2% of base cost per year
    const maintenanceCost = baseCost * annualMaintenanceRate * lifecycleYears;

    // Disposal/recycling costs
    const disposalCost = materialData.disposalCostPerUnit;

    // Environmental impact cost (placeholder - could be based on carbon footprint)
    const environmentalCost = baseCost * 0.1; // 10% environmental cost

    // Energy costs for maintenance (HVAC, electrical, etc.)
    let energyCost = 0;
    switch (materialData.type) {
      case 'hvac':
        energyCost = baseCost * 0.5; // Higher energy costs for HVAC
        break;
      case 'electrical':
        energyCost = baseCost * 0.3;
        break;
      case 'insulation':
        energyCost = baseCost * 0.2; // Energy savings from insulation
        break;
      default:
        energyCost = baseCost * 0.1;
    }

    return baseCost + maintenanceCost + disposalCost + environmentalCost + energyCost;
  }

  // Dispose resources
  dispose(): void {
    this.materialDatabase.clear();
    this.laborDatabase.clear();
    this.costEstimates.clear();
    this.vendorDatabase.clear();
    this.vendorAvailability.clear();
    this.supplyChainLinks.clear();
  }

  // Initialize vendor database with sample vendors
  private initializeVendorDatabase(): void {
    const vendors: VendorData[] = [
      {
        id: 'vendor_concrete_a',
        name: 'Concrete Supply Co.',
        type: 'manufacturer',
        location: {
          address: '123 Industrial Blvd',
          city: 'Portland',
          state: 'OR',
          country: 'USA',
          coordinates: { lat: 45.5152, lng: -122.6784 }
        },
        contact: {
          phone: '+1-555-0101',
          email: 'sales@concretesupply.com',
          website: 'www.concretesupply.com'
        },
        certifications: ['ISO 9001', 'LEED'],
        rating: 4.5,
        materials: ['concrete_standard', 'concrete_recycled'],
        leadTime: 7,
        minimumOrder: 10,
        paymentTerms: 'Net 30',
        lastUpdated: new Date()
      },
      {
        id: 'vendor_steel_b',
        name: 'SteelWorks Inc.',
        type: 'distributor',
        location: {
          address: '456 Metal Ave',
          city: 'Pittsburgh',
          state: 'PA',
          country: 'USA',
          coordinates: { lat: 40.4406, lng: -79.9959 }
        },
        contact: {
          phone: '+1-555-0202',
          email: 'orders@steelworks.com',
          website: 'www.steelworks.com'
        },
        certifications: ['ISO 14001'],
        rating: 4.2,
        materials: ['steel_standard', 'steel_recycled'],
        leadTime: 14,
        minimumOrder: 5,
        paymentTerms: 'Net 15',
        lastUpdated: new Date()
      },
      {
        id: 'vendor_glass_c',
        name: 'GlassTech Solutions',
        type: 'manufacturer',
        location: {
          address: '789 Glass Rd',
          city: 'Toledo',
          state: 'OH',
          country: 'USA',
          coordinates: { lat: 41.6639, lng: -83.5552 }
        },
        contact: {
          phone: '+1-555-0303',
          email: 'info@glasstech.com',
          website: 'www.glasstech.com'
        },
        certifications: ['ISO 9001', 'Energy Star'],
        rating: 4.7,
        materials: ['glass_standard'],
        leadTime: 10,
        minimumOrder: 20,
        paymentTerms: 'Net 30',
        lastUpdated: new Date()
      }
    ];

    vendors.forEach(vendor => {
      this.vendorDatabase.set(vendor.id, vendor);
    });

    // Initialize vendor availability data
    this.initializeVendorAvailability();
  }

  // Initialize vendor availability data
  private initializeVendorAvailability(): void {
    const availabilityData: VendorAvailability[] = [
      {
        vendorId: 'vendor_concrete_a',
        materialId: 'concrete_standard',
        availableQuantity: 500,
        unit: 'm3',
        pricePerUnit: 115,
        discountTiers: [
          { minQuantity: 50, discountPercent: 5 },
          { minQuantity: 100, discountPercent: 10 }
        ],
        leadTime: 7,
        lastUpdated: new Date(),
        inStock: true
      },
      {
        vendorId: 'vendor_concrete_a',
        materialId: 'concrete_recycled',
        availableQuantity: 200,
        unit: 'm3',
        pricePerUnit: 105,
        discountTiers: [
          { minQuantity: 25, discountPercent: 7 },
          { minQuantity: 50, discountPercent: 12 }
        ],
        leadTime: 5,
        lastUpdated: new Date(),
        inStock: true
      },
      {
        vendorId: 'vendor_steel_b',
        materialId: 'steel_standard',
        availableQuantity: 1000,
        unit: 'kg',
        pricePerUnit: 790,
        discountTiers: [
          { minQuantity: 100, discountPercent: 3 },
          { minQuantity: 500, discountPercent: 8 }
        ],
        leadTime: 14,
        lastUpdated: new Date(),
        inStock: true
      },
      {
        vendorId: 'vendor_glass_c',
        materialId: 'glass_standard',
        availableQuantity: 300,
        unit: 'm2',
        pricePerUnit: 175,
        discountTiers: [
          { minQuantity: 50, discountPercent: 4 },
          { minQuantity: 100, discountPercent: 8 }
        ],
        leadTime: 10,
        lastUpdated: new Date(),
        inStock: true
      }
    ];

    availabilityData.forEach(availability => {
      if (!this.vendorAvailability.has(availability.materialId)) {
        this.vendorAvailability.set(availability.materialId, []);
      }
      this.vendorAvailability.get(availability.materialId)!.push(availability);
    });
  }

  // Start price monitoring system
  private startPriceMonitoring(): void {
    setInterval(() => {
      this.updateVendorPrices();
      this.checkStockLevels();
    }, this.priceUpdateInterval);
  }

  // Update vendor prices (simulated real-time updates)
  private updateVendorPrices(): void {
    this.vendorAvailability.forEach((availabilities, materialId) => {
      availabilities.forEach(availability => {
        // Simulate price fluctuations (-5% to +5%)
        const priceChange = (Math.random() - 0.5) * 0.1;
        availability.pricePerUnit *= (1 + priceChange);

        // Record price history
        this.recordPriceHistory(materialId, availability.vendorId, availability.pricePerUnit, availability.availableQuantity);

        availability.lastUpdated = new Date();
      });
    });
  }

  // Check stock levels and generate alerts
  private checkStockLevels(): void {
    this.vendorAvailability.forEach((availabilities, materialId) => {
      availabilities.forEach(availability => {
        if (availability.availableQuantity < 50) {
          this.addSupplyChainAlert(materialId, 'stock_low', `Low stock alert: ${availability.availableQuantity} units remaining`);
        }
      });
    });
  }

  // Record price history for analytics
  private recordPriceHistory(materialId: string, vendorId: string, price: number, quantity: number): void {
    if (!this.supplyChainLinks.has(materialId)) {
      this.supplyChainLinks.set(materialId, {
        materialId,
        preferredVendors: [],
        availabilityData: [],
        priceHistory: [],
        alerts: []
      });
    }

    const supplyChainLink = this.supplyChainLinks.get(materialId)!;
    supplyChainLink.priceHistory.push({
      date: new Date(),
      vendorId,
      price,
      quantity
    });

    // Keep only last 100 price records
    if (supplyChainLink.priceHistory.length > 100) {
      supplyChainLink.priceHistory = supplyChainLink.priceHistory.slice(-100);
    }
  }

  // Add supply chain alert
  private addSupplyChainAlert(materialId: string, type: SupplyChainLink['alerts'][0]['type'], message: string, severity: SupplyChainLink['alerts'][0]['severity'] = 'medium'): void {
    if (!this.supplyChainLinks.has(materialId)) {
      this.supplyChainLinks.set(materialId, {
        materialId,
        preferredVendors: [],
        availabilityData: [],
        priceHistory: [],
        alerts: []
      });
    }

    const supplyChainLink = this.supplyChainLinks.get(materialId)!;
    supplyChainLink.alerts.push({
      type,
      message,
      severity,
      timestamp: new Date()
    });

    // Keep only last 50 alerts
    if (supplyChainLink.alerts.length > 50) {
      supplyChainLink.alerts = supplyChainLink.alerts.slice(-50);
    }
  }

  // Get vendor data by ID
  getVendorData(vendorId: string): VendorData | null {
    return this.vendorDatabase.get(vendorId) || null;
  }

  // Get all vendors
  getAllVendors(): VendorData[] {
    return Array.from(this.vendorDatabase.values());
  }

  // Get vendors for specific material
  getVendorsForMaterial(materialId: string): VendorData[] {
    const vendors: VendorData[] = [];
    this.vendorDatabase.forEach(vendor => {
      if (vendor.materials.includes(materialId)) {
        vendors.push(vendor);
      }
    });
    return vendors;
  }

  // Get vendor availability for material
  getVendorAvailability(materialId: string): VendorAvailability[] {
    return this.vendorAvailability.get(materialId) || [];
  }

  // Get supply chain link data
  getSupplyChainLink(materialId: string): SupplyChainLink | null {
    return this.supplyChainLinks.get(materialId) || null;
  }

  // Calculate cost with vendor pricing
  calculateCostWithVendor(
    element: BIMElement,
    quantity: number,
    vendorId: string,
    region: string = this.defaultRegion
  ): CostEstimate | null {
    const materialData = this.materialDatabase.get(element.material || '');
    if (!materialData) return null;

    const vendorAvailability = this.getVendorAvailability(materialData.id)
      .find(avail => avail.vendorId === vendorId);

    if (!vendorAvailability) return null;

    // Apply vendor-specific pricing and discounts
    let vendorPrice = vendorAvailability.pricePerUnit;
    const applicableDiscount = vendorAvailability.discountTiers
      .filter(tier => quantity >= tier.minQuantity)
      .sort((a, b) => b.discountPercent - a.discountPercent)[0];

    if (applicableDiscount) {
      vendorPrice *= (1 - applicableDiscount.discountPercent / 100);
    }

    // Create cost breakdown with vendor pricing
    const costBreakdown = this.calculateCostBreakdownWithVendor(materialData, quantity, vendorPrice, region);
    const estimateId = `estimate_vendor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const estimate: CostEstimate = {
      id: estimateId,
      projectId: 'current_project',
      elementId: element.id,
      materialId: materialData.id,
      quantity,
      unit: materialData.unit,
      region,
      costBreakdown,
      createdAt: new Date(),
      updatedAt: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days validity for vendor quotes
    };

    this.costEstimates.set(estimateId, estimate);
    return estimate;
  }

  // Calculate cost breakdown with vendor pricing
  private calculateCostBreakdownWithVendor(
    material: MaterialCostData,
    quantity: number,
    vendorPrice: number,
    region: string
  ): CostBreakdown {
    const materialCost = vendorPrice * quantity;
    const laborCost = material.laborCostPerUnit * quantity;
    const disposalCost = material.disposalCostPerUnit * quantity;

    const laborData = this.laborDatabase.get(`skilled_${region}`);
    const overheadMultiplier = laborData ? laborData.overheadMultiplier : 1.3;
    const profitMargin = laborData ? laborData.profitMargin : 0.18;

    const overhead = (materialCost + laborCost) * (overheadMultiplier - 1);
    const profit = (materialCost + laborCost + overhead) * profitMargin;

    const total = materialCost + laborCost + disposalCost + overhead + profit;

    const breakdown = {
      materials: {
        cost: materialCost,
        percentage: (materialCost / total) * 100,
        items: [{
          name: `${material.name} (Vendor Price)`,
          quantity,
          unitCost: vendorPrice,
          totalCost: materialCost
        }]
      },
      labor: {
        cost: laborCost,
        percentage: (laborCost / total) * 100,
        items: [{
          name: `Labor (${material.installationComplexity} complexity)`,
          quantity,
          unitCost: material.laborCostPerUnit,
          totalCost: laborCost
        }]
      },
      disposal: {
        cost: disposalCost,
        percentage: (disposalCost / total) * 100,
        items: [{
          name: 'Disposal/Recycling',
          quantity,
          unitCost: material.disposalCostPerUnit,
          totalCost: disposalCost
        }]
      },
      overhead: {
        cost: overhead,
        percentage: (overhead / total) * 100,
        items: [{
          name: 'Overhead',
          quantity: 1,
          unitCost: overhead,
          totalCost: overhead
        }]
      },
      profit: {
        cost: profit,
        percentage: (profit / total) * 100,
        items: [{
          name: 'Profit Margin',
          quantity: 1,
          unitCost: profit,
          totalCost: profit
        }]
      }
    };

    return {
      materials: materialCost,
      labor: laborCost,
      disposal: disposalCost,
      overhead,
      profit,
      total,
      breakdown
    };
  }

  // Get best vendor for material and quantity
  getBestVendor(materialId: string, quantity: number): VendorAvailability | null {
    const availabilities = this.getVendorAvailability(materialId);
    if (availabilities.length === 0) return null;

    let bestVendor: VendorAvailability | null = null;
    let bestPrice = Infinity;

    availabilities.forEach(availability => {
      if (availability.availableQuantity >= quantity && availability.inStock) {
        let price = availability.pricePerUnit;

        // Apply quantity discounts
        const applicableDiscount = availability.discountTiers
          .filter(tier => quantity >= tier.minQuantity)
          .sort((a, b) => b.discountPercent - a.discountPercent)[0];

        if (applicableDiscount) {
          price *= (1 - applicableDiscount.discountPercent / 100);
        }

        if (price < bestPrice) {
          bestPrice = price;
          bestVendor = availability;
        }
      }
    });

    return bestVendor;
  }

  // Get supply chain alerts
  getSupplyChainAlerts(materialId?: string): SupplyChainLink['alerts'] {
    if (materialId) {
      const supplyChainLink = this.supplyChainLinks.get(materialId);
      return supplyChainLink ? supplyChainLink.alerts : [];
    }

    // Return all alerts
    const allAlerts: SupplyChainLink['alerts'] = [];
    this.supplyChainLinks.forEach(link => {
      allAlerts.push(...link.alerts);
    });
    return allAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Export supply chain data
  exportSupplyChainData(materialId?: string, format: 'json' | 'csv' = 'json'): string {
    if (materialId) {
      const supplyChainLink = this.supplyChainLinks.get(materialId);
      if (!supplyChainLink) return '';

      if (format === 'csv') {
        let csv = 'Date,Vendor,Price,Quantity\n';
        supplyChainLink.priceHistory.forEach(record => {
          csv += `${record.date.toISOString()},${record.vendorId},${record.price.toFixed(2)},${record.quantity}\n`;
        });
        return csv;
      }

      return JSON.stringify(supplyChainLink, null, 2);
    }

    // Export all supply chain data
    const allData = Object.fromEntries(this.supplyChainLinks);

    if (format === 'csv') {
      let csv = 'Material,Vendor,Price,Quantity,Date\n';
      Object.values(allData).forEach((link: SupplyChainLink) => {
        link.priceHistory.forEach(record => {
          csv += `${link.materialId},${record.vendorId},${record.price.toFixed(2)},${record.quantity},${record.date.toISOString()}\n`;
        });
      });
      return csv;
    }

    return JSON.stringify(allData, null, 2);
  }

  // Swap material with performance impact calculation
  swapMaterialWithPerformanceImpact(
    element: BIMElement,
    newMaterialId: string,
    quantity: number,
    region: string = this.defaultRegion
  ): MaterialSwapResult | null {
    const originalMaterialData = this.materialDatabase.get(element.material || '');
    const newMaterialData = this.materialDatabase.get(newMaterialId);

    if (!originalMaterialData || !newMaterialData) {
      console.warn('Material data not found for swap operation');
      return null;
    }

    // Calculate original and new estimates
    const originalEstimate = this.calculateElementCost(element, quantity, region);
    const newElement = { ...element, material: newMaterialId };
    const newEstimate = this.calculateElementCost(newElement, quantity, region);

    if (!originalEstimate || !newEstimate) {
      return null;
    }

    // Prepare MaterialData objects for lifecycle cost calculation
    const originalMaterialForLifecycle: MaterialData = {
      id: originalMaterialData.id,
      name: originalMaterialData.name,
      type: originalMaterialData.type as 'concrete' | 'steel' | 'wood' | 'glass' | 'insulation' | 'finish',
      carbonFootprint: 0.25, // Default placeholder
      durability: 50,
      maintenanceCost: 10,
      environmentalImpact: this.getEnvironmentalImpact(originalMaterialData),
      recycled: false,
      renewable: false,
      location: new Vector3(0, 0, 0),
      volume: 100
    };

    const newMaterialForLifecycle: MaterialData = {
      id: newMaterialData.id,
      name: newMaterialData.name,
      type: newMaterialData.type as 'concrete' | 'steel' | 'wood' | 'glass' | 'insulation' | 'finish',
      carbonFootprint: 0.25, // Default placeholder
      durability: 50,
      maintenanceCost: 10,
      environmentalImpact: this.getEnvironmentalImpact(newMaterialData),
      recycled: false,
      renewable: false,
      location: new Vector3(0, 0, 0),
      volume: 100
    };

    // Calculate performance impacts
    const performanceImpact = this.calculatePerformanceImpact(
      originalMaterialData,
      newMaterialData,
      quantity,
      originalEstimate.costBreakdown.total,
      newEstimate.costBreakdown.total
    );

    // Generate recommendations and warnings
    const recommendations = this.generateSwapRecommendations(
      originalMaterialData,
      newMaterialData,
      performanceImpact
    );

    const warnings = this.generateSwapWarnings(
      originalMaterialData,
      newMaterialData,
      performanceImpact
    );

    return {
      originalEstimate,
      newEstimate,
      performanceImpact,
      recommendations,
      warnings
    };
  }

  // Calculate performance impact data
  private calculatePerformanceImpact(
    originalMaterial: MaterialCostData,
    newMaterial: MaterialCostData,
    quantity: number,
    originalCost: number,
    newCost: number
  ): PerformanceImpactData {
    // Energy efficiency calculations
    const originalEnergyEfficiency = this.getEnergyEfficiency(originalMaterial);
    const newEnergyEfficiency = this.getEnergyEfficiency(newMaterial);
    const energySavings = originalEnergyEfficiency - newEnergyEfficiency;
    const energyPercentageChange = originalEnergyEfficiency > 0 ?
      (energySavings / originalEnergyEfficiency) * 100 : 0;

    // Insulation calculations
    const originalInsulation = this.getInsulationProperties(originalMaterial);
    const newInsulation = this.getInsulationProperties(newMaterial);

    // Structural calculations
    const originalStructural = this.getStructuralProperties(originalMaterial);
    const newStructural = this.getStructuralProperties(newMaterial);

    // Environmental calculations
    const originalEnvironmental = this.getEnvironmentalProperties(originalMaterial);
    const newEnvironmental = this.getEnvironmentalProperties(newMaterial);

    // Cost calculations
    const costDifference = newCost - originalCost;
    const costPercentageChange = originalCost > 0 ? (costDifference / originalCost) * 100 : 0;

    // Lifecycle cost calculations (simplified)
    const originalLifecycleCost = this.estimateMaterialLifecycleCost({
      id: originalMaterial.id,
      name: originalMaterial.name,
      type: originalMaterial.type as 'concrete' | 'steel' | 'wood' | 'glass' | 'insulation' | 'finish',
      carbonFootprint: 0.25, // Default value, would be calculated based on material
      durability: 50,
      maintenanceCost: 10,
      environmentalImpact: this.getEnvironmentalImpact(originalMaterial),
      recycled: false,
      renewable: false,
      location: { x: 0, y: 0, z: 0 } as any, // Vector3 from Babylon.js
      volume: 100
    });

    const newLifecycleCost = this.estimateMaterialLifecycleCost({
      id: newMaterial.id,
      name: newMaterial.name,
      type: newMaterial.type as 'concrete' | 'steel' | 'wood' | 'glass' | 'insulation' | 'finish',
      carbonFootprint: 0.25, // Default value, would be calculated based on material
      durability: 50,
      maintenanceCost: 10,
      environmentalImpact: this.getEnvironmentalImpact(newMaterial),
      recycled: false,
      renewable: false,
      location: { x: 0, y: 0, z: 0 } as any, // Vector3 from Babylon.js
      volume: 100
    });

    const lifecycleSavings = originalLifecycleCost - newLifecycleCost;
    const paybackPeriod = costDifference > 0 ? (costDifference / Math.abs(lifecycleSavings)) : 0;

    // Overall score calculation
    const currentScore = this.calculateOverallScore(originalMaterial, originalCost, originalLifecycleCost);
    const projectedScore = this.calculateOverallScore(newMaterial, newCost, newLifecycleCost);
    const scoreImprovement = projectedScore - currentScore;

    const recommendation = this.getOverallRecommendation(scoreImprovement, costDifference);

    return {
      energyEfficiency: {
        current: originalEnergyEfficiency,
        projected: newEnergyEfficiency,
        savings: energySavings,
        percentageChange: energyPercentageChange
      },
      insulation: {
        rValue: {
          current: originalInsulation.rValue,
          projected: newInsulation.rValue,
          improvement: newInsulation.rValue - originalInsulation.rValue
        },
        thermalConductivity: {
          current: originalInsulation.thermalConductivity,
          projected: newInsulation.thermalConductivity,
          change: newInsulation.thermalConductivity - originalInsulation.thermalConductivity
        }
      },
      structural: {
        strength: {
          current: originalStructural.strength,
          projected: newStructural.strength,
          change: newStructural.strength - originalStructural.strength
        },
        durability: {
          current: originalStructural.durability,
          projected: newStructural.durability,
          change: newStructural.durability - originalStructural.durability
        }
      },
      environmental: {
        carbonFootprint: {
          current: originalEnvironmental.carbonFootprint,
          projected: newEnvironmental.carbonFootprint,
          reduction: originalEnvironmental.carbonFootprint - newEnvironmental.carbonFootprint
        },
        recyclability: {
          current: originalEnvironmental.recyclability,
          projected: newEnvironmental.recyclability,
          improvement: newEnvironmental.recyclability - originalEnvironmental.recyclability
        }
      },
      cost: {
        immediate: {
          current: originalCost,
          projected: newCost,
          difference: costDifference,
          percentageChange: costPercentageChange
        },
        lifecycle: {
          current: originalLifecycleCost,
          projected: newLifecycleCost,
          savings: lifecycleSavings,
          paybackPeriod: paybackPeriod > 0 ? paybackPeriod : 0
        }
      },
      overallScore: {
        current: currentScore,
        projected: projectedScore,
        improvement: scoreImprovement,
        recommendation
      }
    };
  }

  // Helper methods for performance calculations
  private getEnergyEfficiency(material: MaterialCostData): number {
    const efficiencyMap: { [key: string]: number } = {
      'insulation_fiberglass': 85,
      'concrete_recycled': 75,
      'steel_recycled': 70,
      'wood_sustainable': 90,
      'glass_standard': 60,
      'concrete_standard': 65,
      'steel_standard': 60
    };
    return efficiencyMap[material.id] || 50;
  }

  private getInsulationProperties(material: MaterialCostData): { rValue: number; thermalConductivity: number } {
    const insulationMap: { [key: string]: { rValue: number; thermalConductivity: number } } = {
      'insulation_fiberglass': { rValue: 13, thermalConductivity: 0.035 },
      'concrete_standard': { rValue: 0.5, thermalConductivity: 1.7 },
      'concrete_recycled': { rValue: 0.6, thermalConductivity: 1.6 },
      'wood_sustainable': { rValue: 4.0, thermalConductivity: 0.12 },
      'steel_standard': { rValue: 0.1, thermalConductivity: 50 },
      'steel_recycled': { rValue: 0.1, thermalConductivity: 50 },
      'glass_standard': { rValue: 0.2, thermalConductivity: 1.0 }
    };
    return insulationMap[material.id] || { rValue: 1, thermalConductivity: 1 };
  }

  private getStructuralProperties(material: MaterialCostData): { strength: number; durability: number } {
    const structuralMap: { [key: string]: { strength: number; durability: number } } = {
      'concrete_standard': { strength: 30, durability: 75 },
      'concrete_recycled': { strength: 28, durability: 70 },
      'steel_standard': { strength: 400, durability: 80 },
      'steel_recycled': { strength: 380, durability: 78 },
      'wood_sustainable': { strength: 50, durability: 60 },
      'glass_standard': { strength: 70, durability: 40 },
      'insulation_fiberglass': { strength: 5, durability: 30 }
    };
    return structuralMap[material.id] || { strength: 20, durability: 50 };
  }

  private getEnvironmentalProperties(material: MaterialCostData): { carbonFootprint: number; recyclability: number } {
    const environmentalMap: { [key: string]: { carbonFootprint: number; recyclability: number } } = {
      'concrete_standard': { carbonFootprint: 300, recyclability: 30 },
      'concrete_recycled': { carbonFootprint: 200, recyclability: 80 },
      'steel_standard': { carbonFootprint: 1500, recyclability: 90 },
      'steel_recycled': { carbonFootprint: 800, recyclability: 95 },
      'wood_sustainable': { carbonFootprint: 50, recyclability: 100 },
      'glass_standard': { carbonFootprint: 100, recyclability: 100 },
      'insulation_fiberglass': { carbonFootprint: 200, recyclability: 20 }
    };
    return environmentalMap[material.id] || { carbonFootprint: 500, recyclability: 50 };
  }

  private calculateOverallScore(material: MaterialCostData, cost: number, lifecycleCost: number): number {
    const environmentalScore = this.getEnvironmentalImpact(material);
    const durabilityScore = this.getDurabilityScore(material);
    const energyScore = this.getEnergyEfficiency(material);

    // Weighted score calculation
    const score = (
      environmentalScore * 0.3 +
      durabilityScore * 0.3 +
      energyScore * 0.2 +
      (100 - Math.min(cost / 1000, 100)) * 0.2 // Cost efficiency (inverse relationship)
    );

    return Math.min(100, Math.max(0, score));
  }

  private getOverallRecommendation(scoreImprovement: number, costDifference: number): string {
    if (scoreImprovement > 20 && costDifference <= 0) {
      return 'Strong recommendation: Significant performance improvement with cost savings';
    } else if (scoreImprovement > 10) {
      return 'Good alternative: Moderate performance improvement';
    } else if (scoreImprovement > 0 && costDifference <= 0) {
      return 'Consider: Minor improvement with cost savings';
    } else if (scoreImprovement > 0) {
      return 'Evaluate: Performance improvement may justify additional cost';
    } else if (costDifference < 0) {
      return 'Consider for cost savings despite performance trade-offs';
    } else {
      return 'Not recommended: Performance degradation with higher cost';
    }
  }

  private generateSwapRecommendations(
    originalMaterial: MaterialCostData,
    newMaterial: MaterialCostData,
    impact: PerformanceImpactData
  ): string[] {
    const recommendations: string[] = [];

    if (impact.energyEfficiency.savings > 0) {
      recommendations.push(`Energy savings of ${impact.energyEfficiency.savings.toFixed(1)} kWh/m²/year`);
    }

    if (impact.environmental.carbonFootprint.reduction > 0) {
      recommendations.push(`Carbon footprint reduction of ${impact.environmental.carbonFootprint.reduction.toFixed(0)} kg CO2/m²`);
    }

    if (impact.cost.lifecycle.paybackPeriod > 0 && impact.cost.lifecycle.paybackPeriod < 10) {
      recommendations.push(`Payback period: ${impact.cost.lifecycle.paybackPeriod.toFixed(1)} years`);
    }

    if (impact.insulation.rValue.improvement > 0) {
      recommendations.push(`Improved insulation: R-${impact.insulation.rValue.projected.toFixed(1)}`);
    }

    if (impact.overallScore.improvement > 15) {
      recommendations.push('High overall performance improvement');
    }

    return recommendations;
  }

  private generateSwapWarnings(
    originalMaterial: MaterialCostData,
    newMaterial: MaterialCostData,
    impact: PerformanceImpactData
  ): string[] {
    const warnings: string[] = [];

    if (impact.structural.strength.change < -10) {
      warnings.push('Significant reduction in structural strength');
    }

    if (impact.structural.durability.change < -5) {
      warnings.push('Reduced durability compared to original material');
    }

    if (impact.cost.immediate.difference > 1000) {
      warnings.push(`Higher upfront cost: $${impact.cost.immediate.difference.toFixed(0)}`);
    }

    if (impact.energyEfficiency.savings < -10) {
      warnings.push('Potential increase in energy consumption');
    }

    if (impact.overallScore.improvement < -10) {
      warnings.push('Overall performance degradation');
    }

    return warnings;
  }
}
