import { BIMElement, BIMModel, BIMManager } from './BIMManager';
import { SimulationManager } from './SimulationManager';

export interface SustainabilityConfig {
  enableGreenScore: boolean;
  energyEfficiencyThreshold: number;
  waterEfficiencyThreshold: number;
  renewableEnergyTarget: number; // percentage
  carbonFootprintLimit: number; // kg CO2 equivalent
}

export interface SustainabilityReport {
  greenScore: number;
  energyEfficiency: number;
  waterEfficiency: number;
  waterFootprint: number; // New detailed water footprint metric
  renewableEnergyUsage: number;
  carbonFootprint: number;
  energyUsage: number; // New energy usage metric
  complianceStatus: boolean;
  recommendations: string[];
}

export class SustainabilityManager {
  private bimManager: BIMManager;
  private simulationManager: SimulationManager;
  private config: SustainabilityConfig;

  constructor(bimManager: BIMManager, simulationManager: SimulationManager) {
    this.bimManager = bimManager;
    this.simulationManager = simulationManager;
    this.config = {
      enableGreenScore: true,
      energyEfficiencyThreshold: 0.75,
      waterEfficiencyThreshold: 0.75,
      renewableEnergyTarget: 30,
      carbonFootprintLimit: 10000,
    };
  }

  updateConfig(newConfig: Partial<SustainabilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  generateReport(modelId: string): SustainabilityReport | null {
    const model = this.bimManager.getModelById(modelId);
    if (!model) return null;

    // Calculate energy efficiency from simulation data
    const energyEfficiency = this.simulationManager.calculateEnergyEfficiency(modelId);

    // Calculate water efficiency (placeholder, to be implemented)
    const waterEfficiency = this.simulationManager.calculateWaterEfficiency
      ? this.simulationManager.calculateWaterEfficiency(modelId)
      : 0.8;

    // Calculate detailed water footprint based on materials and usage
    const waterFootprint = this.calculateWaterFootprint(model);

    // Calculate renewable energy usage (placeholder)
    const renewableEnergyUsage = this.simulationManager.getRenewableEnergyUsage
      ? this.simulationManager.getRenewableEnergyUsage(modelId)
      : 0.25;

    // Calculate carbon footprint from BIM materials and simulation
    const carbonFootprint = this.calculateCarbonFootprint(model);

    // Calculate energy usage from simulation
    const energyUsage = this.simulationManager.calculateEnergyUsage
      ? this.simulationManager.calculateEnergyUsage(modelId)
      : 0;

    // Calculate green score based on weighted factors
    const greenScore = this.calculateGreenScore(energyEfficiency, waterEfficiency, renewableEnergyUsage, carbonFootprint);

    // Determine compliance status
    const complianceStatus =
      energyEfficiency >= this.config.energyEfficiencyThreshold &&
      waterEfficiency >= this.config.waterEfficiencyThreshold &&
      renewableEnergyUsage >= this.config.renewableEnergyTarget / 100 &&
      carbonFootprint <= this.config.carbonFootprintLimit;

    // Generate recommendations
    const recommendations = this.generateRecommendations(energyEfficiency, waterEfficiency, renewableEnergyUsage, carbonFootprint);

    return {
      greenScore,
      energyEfficiency,
      waterEfficiency,
      waterFootprint,
      renewableEnergyUsage,
      carbonFootprint,
      energyUsage,
      complianceStatus,
      recommendations,
    };
  }

  private calculateCarbonFootprint(model: BIMModel): number {
    let totalCarbon = 0;
    model.elements.forEach((element: BIMElement) => {
      if (element.properties && element.properties.carbonFootprint) {
        totalCarbon += element.properties.carbonFootprint;
      }
    });

    // Add energy-related carbon footprint from simulation if available
    if (this.simulationManager.calculateEnergyCarbonFootprint) {
      totalCarbon += this.simulationManager.calculateEnergyCarbonFootprint(model.id);
    }

    return totalCarbon;
  }

  private calculateGreenScore(
    energyEfficiency: number,
    waterEfficiency: number,
    renewableEnergyUsage: number,
    carbonFootprint: number
  ): number {
    // Simple weighted average scoring
    const energyWeight = 0.35;
    const waterWeight = 0.25;
    const renewableWeight = 0.2;
    const carbonWeight = 0.2;

    // Normalize carbon footprint inversely (lower is better)
    const carbonScore = 1 - Math.min(carbonFootprint / this.config.carbonFootprintLimit, 1);

    return (
      energyEfficiency * energyWeight +
      waterEfficiency * waterWeight +
      renewableEnergyUsage * renewableWeight +
      carbonScore * carbonWeight
    );
  }

  private generateRecommendations(
    energyEfficiency: number,
    waterEfficiency: number,
    renewableEnergyUsage: number,
    carbonFootprint: number
  ): string[] {
    const recs: string[] = [];

    if (energyEfficiency < this.config.energyEfficiencyThreshold) {
      recs.push('Improve energy efficiency by upgrading insulation and HVAC systems.');
    }
    if (waterEfficiency < this.config.waterEfficiencyThreshold) {
      recs.push('Implement water-saving fixtures and rainwater harvesting.');
    }
    if (renewableEnergyUsage < this.config.renewableEnergyTarget / 100) {
      recs.push('Increase renewable energy sources such as solar panels.');
    }
    if (carbonFootprint > this.config.carbonFootprintLimit) {
      recs.push('Reduce carbon footprint by using low-carbon materials and optimizing design.');
    }

    // New recommendation for energy usage
    if (this.simulationManager.calculateEnergyUsage) {
      const energyUsage = this.simulationManager.calculateEnergyUsage(this.bimManager.getAllModels()[0].id);
      if (energyUsage > 10000) {
        recs.push('Reduce energy usage by optimizing building systems and renewable integration.');
      }
    }

    return recs;
  }

  private calculateWaterFootprint(model: BIMModel): number {
    let totalWater = 0;
    model.elements.forEach((element: BIMElement) => {
      if (element.properties && element.properties.waterFootprint) {
        totalWater += element.properties.waterFootprint;
      }
    });

    // Add water usage from simulation if available
    if (this.simulationManager.calculateWaterUsage) {
      totalWater += this.simulationManager.calculateWaterUsage(model.id);
    }

    return totalWater;
  }
}
