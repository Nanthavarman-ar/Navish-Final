import { Scene, Vector3, Color3, StandardMaterial, Mesh, MeshBuilder, DynamicTexture, AbstractMesh } from '@babylonjs/core';
import { BIMManager } from '../BIMManager';

export interface ROICalculation {
  id: string;
  propertyValue: number;
  downPayment: number;
  loanAmount: number;
  interestRate: number; // Annual percentage
  loanTerm: number; // Years
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  netMonthlyCashFlow?: number;
  capRate?: number;
  cashOnCashReturn?: number;
  breakEvenRatio?: number;
}

export interface MortgageScenario {
  id: string;
  name: string;
  description: string;
  calculations: ROICalculation[];
  assumptions: {
    appreciationRate: number;
    vacancyRate: number;
    maintenanceRate: number;
    propertyTaxRate: number;
    insuranceRate: number;
  };
}

/**
 * Manages ROI and mortgage calculations for real estate analysis
 */
export class ROICalculatorManager {
  private scene: Scene;
  private bimManager: BIMManager;

  private scenarios: Map<string, MortgageScenario> = new Map();
  private currentScenario: MortgageScenario | null = null;
  private calculationMeshes: Map<string, Mesh> = new Map();
  private isActive: boolean = false;

  constructor(scene: Scene, bimManager: BIMManager) {
    this.scene = scene;
    this.bimManager = bimManager;
    this.initializeDefaultScenarios();
  }

  /**
   * Initializes default mortgage scenarios
   */
  private initializeDefaultScenarios(): void {
    // Conservative scenario
    this.createScenario('conservative', 'Conservative Investment', 'Low-risk investment strategy', {
      appreciationRate: 0.03, // 3% annual appreciation
      vacancyRate: 0.05, // 5% vacancy
      maintenanceRate: 0.01, // 1% maintenance
      propertyTaxRate: 0.012, // 1.2% property tax
      insuranceRate: 0.0035 // 0.35% insurance
    });

    // Aggressive scenario
    this.createScenario('aggressive', 'Aggressive Investment', 'High-growth investment strategy', {
      appreciationRate: 0.08, // 8% annual appreciation
      vacancyRate: 0.03, // 3% vacancy
      maintenanceRate: 0.008, // 0.8% maintenance
      propertyTaxRate: 0.01, // 1% property tax
      insuranceRate: 0.003 // 0.3% insurance
    });

    // Balanced scenario
    this.createScenario('balanced', 'Balanced Investment', 'Moderate risk-reward strategy', {
      appreciationRate: 0.05, // 5% annual appreciation
      vacancyRate: 0.04, // 4% vacancy
      maintenanceRate: 0.009, // 0.9% maintenance
      propertyTaxRate: 0.011, // 1.1% property tax
      insuranceRate: 0.0032 // 0.32% insurance
    });
  }

  /**
   * Creates a new mortgage scenario
   * @param id - Unique identifier
   * @param name - Display name
   * @param description - Scenario description
   * @param assumptions - Investment assumptions
   */
  createScenario(
    id: string,
    name: string,
    description: string,
    assumptions: {
      appreciationRate: number;
      vacancyRate: number;
      maintenanceRate: number;
      propertyTaxRate: number;
      insuranceRate: number;
    }
  ): void {
    try {
      if (this.scenarios.has(id)) {
        throw new Error(`Scenario with id '${id}' already exists`);
      }

      const scenario: MortgageScenario = {
        id,
        name,
        description,
        calculations: [],
        assumptions
      };

      this.scenarios.set(id, scenario);
      console.log(`Created scenario: ${name}`);
    } catch (error) {
      console.error('Failed to create scenario:', error);
      throw error;
    }
  }

  /**
   * Applies a mortgage scenario
   * @param scenarioId - ID of the scenario to apply
   */
  applyScenario(scenarioId: string): void {
    try {
      const scenario = this.scenarios.get(scenarioId);
      if (!scenario) {
        throw new Error(`Scenario '${scenarioId}' not found`);
      }

      // Stop current scenario
      this.stopCurrentScenario();

      this.currentScenario = scenario;
      this.isActive = true;

      // Create visual representations
      this.createCalculationVisuals();

      console.log(`Applied scenario: ${scenario.name}`);
    } catch (error) {
      console.error('Failed to apply scenario:', error);
      throw error;
    }
  }

  /**
   * Stops the current scenario
   */
  stopCurrentScenario(): void {
    try {
      if (!this.isActive) return;

      // Clear calculation meshes
      this.clearCalculationMeshes();

      this.currentScenario = null;
      this.isActive = false;

      console.log('Stopped current scenario');
    } catch (error) {
      console.error('Failed to stop scenario:', error);
      throw error;
    }
  }

  /**
   * Calculates mortgage payment using standard formula
   * @param principal - Loan amount
   * @param annualRate - Annual interest rate (decimal)
   * @param years - Loan term in years
   * @returns Monthly payment amount
   */
  calculateMonthlyPayment(principal: number, annualRate: number, years: number): number {
    const monthlyRate = annualRate / 12;
    const numPayments = years * 12;

    if (monthlyRate === 0) {
      return principal / numPayments;
    }

    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                   (Math.pow(1 + monthlyRate, numPayments) - 1);

    return payment;
  }

  /**
   * Performs comprehensive ROI calculation
   * @param propertyValue - Property purchase price
   * @param downPaymentPercent - Down payment percentage (0-1)
   * @param interestRate - Annual interest rate (decimal)
   * @param loanTerm - Loan term in years
   * @param monthlyIncome - Monthly rental income
   * @param monthlyExpenses - Monthly operating expenses
   * @returns Complete ROI calculation
   */
  calculateROI(
    propertyValue: number,
    downPaymentPercent: number,
    interestRate: number,
    loanTerm: number,
    monthlyIncome?: number,
    monthlyExpenses?: number
  ): ROICalculation {
    try {
      const downPayment = propertyValue * downPaymentPercent;
      const loanAmount = propertyValue - downPayment;

      const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, loanTerm);
      const totalPayments = monthlyPayment * loanTerm * 12;
      const totalInterest = totalPayments - loanAmount;

      let netMonthlyCashFlow: number | undefined;
      let capRate: number | undefined;
      let cashOnCashReturn: number | undefined;
      let breakEvenRatio: number | undefined;

      if (monthlyIncome && monthlyExpenses !== undefined) {
        const monthlyDebtService = monthlyPayment;
        netMonthlyCashFlow = monthlyIncome - monthlyExpenses - monthlyDebtService;

        // Cap rate = NOI / Property Value
        const annualNOI = (monthlyIncome - monthlyExpenses) * 12;
        capRate = annualNOI / propertyValue;

        // Cash on Cash Return = Annual Cash Flow / Initial Cash Invested
        const annualCashFlow = netMonthlyCashFlow * 12;
        cashOnCashReturn = annualCashFlow / downPayment;

        // Break-even ratio = Operating Expenses / Gross Income
        breakEvenRatio = monthlyExpenses / monthlyIncome;
      }

      const calculation: ROICalculation = {
        id: `calc_${Date.now()}`,
        propertyValue,
        downPayment,
        loanAmount,
        interestRate,
        loanTerm,
        monthlyPayment,
        totalPayments,
        totalInterest,
        monthlyIncome,
        monthlyExpenses,
        netMonthlyCashFlow,
        capRate,
        cashOnCashReturn,
        breakEvenRatio
      };

      // Add to current scenario if active
      if (this.currentScenario) {
        this.currentScenario.calculations.push(calculation);
        this.updateCalculationVisual(calculation);
      }

      return calculation;
    } catch (error) {
      console.error('Failed to calculate ROI:', error);
      throw error;
    }
  }

  /**
   * Creates visual representations of calculations
   */
  private createCalculationVisuals(): void {
    try {
      if (!this.currentScenario) return;

      // Create visual elements for each calculation
      this.currentScenario.calculations.forEach(calculation => {
        this.createCalculationVisual(calculation);
      });
    } catch (error) {
      console.error('Failed to create calculation visuals:', error);
    }
  }

  /**
   * Creates a visual representation for a calculation
   * @param calculation - ROI calculation to visualize
   */
  private createCalculationVisual(calculation: ROICalculation): void {
    try {
      // Create a floating panel with calculation results
      const panel = this.createCalculationPanel(calculation);
      this.calculationMeshes.set(calculation.id, panel);

      // Position near relevant property elements
      panel.position = new Vector3(
        Math.random() * 10 - 5,
        3 + Math.random() * 2,
        Math.random() * 10 - 5
      );
    } catch (error) {
      console.error('Failed to create calculation visual:', error);
    }
  }

  /**
   * Creates a panel mesh displaying calculation results
   * @param calculation - ROI calculation data
   * @returns Panel mesh
   */
  private createCalculationPanel(calculation: ROICalculation): Mesh {
    // Create a plane for the panel
    const panel = MeshBuilder.CreatePlane(`roi_panel_${calculation.id}`, { width: 3, height: 2 }, this.scene);

    // Create dynamic texture for text
    const texture = new DynamicTexture(`roi_texture_${calculation.id}`, { width: 512, height: 256 }, this.scene, false);

    // Draw background
    const ctx = texture.getContext();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 512, 256);

    // Draw text
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Property Value: $${calculation.propertyValue.toLocaleString()}`, 20, 30);
    ctx.fillText(`Monthly Payment: $${calculation.monthlyPayment.toFixed(2)}`, 20, 60);
    ctx.fillText(`Total Interest: $${calculation.totalInterest.toLocaleString()}`, 20, 90);

    if (calculation.capRate !== undefined) {
      ctx.fillText(`Cap Rate: ${(calculation.capRate * 100).toFixed(2)}%`, 20, 120);
    }

    if (calculation.cashOnCashReturn !== undefined) {
      ctx.fillText(`Cash-on-Cash: ${(calculation.cashOnCashReturn * 100).toFixed(2)}%`, 20, 150);
    }

    if (calculation.netMonthlyCashFlow !== undefined) {
      ctx.fillText(`Monthly Cash Flow: $${calculation.netMonthlyCashFlow.toFixed(2)}`, 20, 180);
    }

    texture.update();

    // Create material
    const material = new StandardMaterial(`roi_material_${calculation.id}`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.2, 0.2, 0.2);
    material.backFaceCulling = false;

    panel.material = material;

    return panel;
  }

  /**
   * Updates the visual representation of a calculation
   * @param calculation - Updated calculation
   */
  private updateCalculationVisual(calculation: ROICalculation): void {
    try {
      const existingPanel = this.calculationMeshes.get(calculation.id);
      if (existingPanel) {
        // Update existing panel
        this.createCalculationPanel(calculation);
      } else {
        // Create new panel
        this.createCalculationVisual(calculation);
      }
    } catch (error) {
      console.error('Failed to update calculation visual:', error);
    }
  }

  /**
   * Clears all calculation meshes
   */
  private clearCalculationMeshes(): void {
    try {
      this.calculationMeshes.forEach(mesh => mesh.dispose());
      this.calculationMeshes.clear();
    } catch (error) {
      console.error('Failed to clear calculation meshes:', error);
    }
  }

  /**
   * Gets all available scenarios
   * @returns Array of scenario IDs
   */
  getAvailableScenarios(): string[] {
    return Array.from(this.scenarios.keys());
  }

  /**
   * Gets the current scenario
   * @returns Current scenario or null
   */
  getCurrentScenario(): MortgageScenario | null {
    return this.currentScenario;
  }

  /**
   * Checks if a scenario is currently active
   * @returns True if scenario is active
   */
  isScenarioActive(): boolean {
    return this.isActive;
  }

  /**
   * Gets calculations for the current scenario
   * @returns Array of calculations
   */
  getCurrentCalculations(): ROICalculation[] {
    return this.currentScenario?.calculations ?? [];
  }

  /**
   * Exports calculations to JSON
   * @param scenarioId - Optional scenario ID, uses current if not provided
   * @returns JSON string of calculations
   */
  exportCalculations(scenarioId?: string): string {
    try {
      const scenario = scenarioId ? this.scenarios.get(scenarioId) : this.currentScenario;
      if (!scenario) {
        throw new Error('No scenario found');
      }

      return JSON.stringify({
        scenario: scenario.name,
        calculations: scenario.calculations,
        assumptions: scenario.assumptions,
        exportDate: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      console.error('Failed to export calculations:', error);
      throw error;
    }
  }

  /**
   * Disposes of the ROI calculator manager
   */
  dispose(): void {
    this.stopCurrentScenario();
    this.scenarios.clear();
  }
}
