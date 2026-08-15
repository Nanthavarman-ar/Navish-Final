import { BIMModel, BIMElement } from './BIMManager';

export interface SetbackRule {
  minDistance: number; // meters
  applicableZones: string[]; // e.g. residential, commercial
  direction?: 'front' | 'rear' | 'side' | 'all'; // setback direction
  buildingHeight?: number; // additional setback for taller buildings
}

export interface FireExitRule {
  maxDistanceToExit: number; // meters
  minExitWidth: number; // meters
  minExitCount: number; // minimum number of exits required
  maxOccupantLoad: number; // maximum occupants per exit
}

export interface VentilationRule {
  minAirChangesPerHour: number;
  applicableRoomTypes: string[];
  minOutdoorAirRate?: number; // CFM per person
  maxCO2Level?: number; // ppm
}

export interface AccessibilityRule {
  minDoorWidth: number; // meters (ADA: 0.81m)
  minRampSlope: number; // ratio (ADA: 1:12)
  minRampWidth: number; // meters (ADA: 0.91m)
  maxRampRise: number; // meters without landing (ADA: 0.15m)
  minClearFloorSpace: number; // square meters (ADA: 1.5m x 1.5m)
  minGrabBarLength: number; // meters
  applicableAreas: string[]; // areas requiring accessibility
}

export interface StructuralRule {
  maxFloorAreaRatio: number; // FAR limit
  maxBuildingHeight: number; // meters
  minFoundationDepth: number; // meters
  seismicZone: 'low' | 'moderate' | 'high';
  windSpeedDesign: number; // km/h
  snowLoad: number; // kN/m²
}

export interface EnergyEfficiencyRule {
  minInsulationRValue: { [key: string]: number }; // R-values by component
  maxUFactor: { [key: string]: number }; // U-factors by component
  minEnergyStarRating?: number;
  renewableEnergyRequirement?: number; // percentage
  maxEnergyUseIntensity: number; // kWh/m²/year
}

export interface ParkingRule {
  minSpacesPerUnit: { [key: string]: number }; // by unit type
  minAccessibleSpaces: number; // percentage
  minSpaceDimensions: { width: number; length: number }; // meters
  maxDistanceToEntrance: number; // meters
}

export interface EnvironmentalRule {
  maxImperviousSurface: number; // percentage of site
  minGreenSpace: number; // percentage of site
  stormwaterRetention: number; // liters per square meter
  noiseLimit: { [key: string]: number }; // dB by time period
  airQualityStandards: { [key: string]: number }; // pollutant limits
}

export interface ComplianceIssue {
  id: string;
  elementId: string;
  issueType: 'setback' | 'fire_exit' | 'ventilation' | 'accessibility' | 'structural' | 'energy' | 'parking' | 'environmental';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: any; // Could be Vector3 or bounding box
  resolved: boolean;
  suggestedFix?: string;
  codeReference?: string; // e.g. "ADA 4.13.5", "IBC 1003.2.13"
}

export interface CityRegulations {
  setbackRules: SetbackRule[];
  fireExitRules: FireExitRule[];
  ventilationRules: VentilationRule[];
  accessibilityRules?: AccessibilityRule[];
  structuralRules?: StructuralRule[];
  energyEfficiencyRules?: EnergyEfficiencyRule[];
  parkingRules?: ParkingRule[];
  environmentalRules?: EnvironmentalRule[];
}

export class LocalCodeValidator {
  private model: BIMModel | null = null;
  private regulations: CityRegulations;
  private issues: ComplianceIssue[] = [];

  constructor(regulations?: CityRegulations) {
    // Default regulations can be overridden by passing custom regulations
    this.regulations = regulations || this.getDefaultRegulations();
  }

  setModel(model: BIMModel) {
    this.model = model;
    this.issues = [];
  }

  validateCompliance(): ComplianceIssue[] {
    if (!this.model) return [];

    this.issues = [];

    this.model.elements.forEach((element: BIMElement) => {
      this.checkSetbackRules(element);
      this.checkFireExitCompliance(element);
      this.checkVentilationCompliance(element);
    });

    return this.issues;
  }

  private checkSetbackRules(element: BIMElement) {
    // Placeholder: Check if element respects setback rules
    // For demo, assume all walls must be at least minDistance from property line (0,0)
    if (element.type === 'wall') {
      this.regulations.setbackRules.forEach(rule => {
        // Simplified check: distance from origin
        const distance = Math.sqrt(element.position.x ** 2 + element.position.z ** 2);
        if (distance < rule.minDistance) {
          this.issues.push(this.createIssue(element, 'setback', `Element is too close to property line. Minimum setback is ${rule.minDistance}m.`, 'high'));
        }
      });
    }
  }

  private checkFireExitCompliance(element: BIMElement) {
    // Placeholder: Check fire exit compliance for doors and exits
    if (element.type === 'door') {
      this.regulations.fireExitRules.forEach(rule => {
        // Simplified check: door width
        const width = element.properties?.width || 0;
        if (width < rule.minExitWidth) {
          this.issues.push(this.createIssue(element, 'fire_exit', `Door width ${width}m is less than minimum required ${rule.minExitWidth}m for fire exit.`, 'high'));
        }
      });
    }
  }

  private checkVentilationCompliance(element: BIMElement) {
    // Placeholder: Check ventilation compliance for floors (representing rooms/spaces)
    if (element.type === 'floor') {
      this.regulations.ventilationRules.forEach(rule => {
        if (rule.applicableRoomTypes.includes(element.category)) {
          const airChanges = element.properties?.airChangesPerHour || 0;
          if (airChanges < rule.minAirChangesPerHour) {
            this.issues.push(this.createIssue(element, 'ventilation', `Air changes per hour ${airChanges} is less than minimum required ${rule.minAirChangesPerHour}.`, 'medium'));
          }
        }
      });
    }
  }

  private createIssue(element: BIMElement, issueType: ComplianceIssue['issueType'], description: string, severity: ComplianceIssue['severity']): ComplianceIssue {
    return {
      id: `compliance_${element.id}_${issueType}`,
      elementId: element.id,
      issueType,
      description,
      severity,
      location: element.position,
      resolved: false,
    };
  }

  getIssues(): ComplianceIssue[] {
    return this.issues;
  }

  resolveIssue(issueId: string): boolean {
    const issue = this.issues.find(i => i.id === issueId);
    if (issue) {
      issue.resolved = true;
      return true;
    }
    return false;
  }

  private getDefaultRegulations(): CityRegulations {
    return {
      setbackRules: [
        { minDistance: 3, applicableZones: ['residential', 'commercial'], direction: 'all' }
      ],
      fireExitRules: [
        { maxDistanceToExit: 30, minExitWidth: 0.9, minExitCount: 2, maxOccupantLoad: 50 }
      ],
      ventilationRules: [
        { minAirChangesPerHour: 6, applicableRoomTypes: ['residential', 'office'], minOutdoorAirRate: 15, maxCO2Level: 1000 }
      ],
      accessibilityRules: [
        {
          minDoorWidth: 0.81,
          minRampSlope: 12,
          minRampWidth: 0.91,
          maxRampRise: 0.15,
          minClearFloorSpace: 2.25,
          minGrabBarLength: 0.9,
          applicableAreas: ['public', 'commercial', 'multi-family']
        }
      ],
      structuralRules: [
        {
          maxFloorAreaRatio: 2.5,
          maxBuildingHeight: 30,
          minFoundationDepth: 1.5,
          seismicZone: 'moderate',
          windSpeedDesign: 160,
          snowLoad: 1.5
        }
      ],
      energyEfficiencyRules: [
        {
          minInsulationRValue: { walls: 13, roof: 30, floor: 19 },
          maxUFactor: { windows: 0.35, doors: 0.50 },
          minEnergyStarRating: 75,
          renewableEnergyRequirement: 20,
          maxEnergyUseIntensity: 150
        }
      ],
      parkingRules: [
        {
          minSpacesPerUnit: { residential: 1.5, commercial: 3.0, retail: 4.0 },
          minAccessibleSpaces: 2,
          minSpaceDimensions: { width: 2.5, length: 5.5 },
          maxDistanceToEntrance: 100
        }
      ],
      environmentalRules: [
        {
          maxImperviousSurface: 70,
          minGreenSpace: 20,
          stormwaterRetention: 25,
          noiseLimit: { daytime: 55, nighttime: 45 },
          airQualityStandards: { PM25: 12, NO2: 40 }
        }
      ]
    };
  }
}
