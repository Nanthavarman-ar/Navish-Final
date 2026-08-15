import { BIMModel, BIMElement } from './BIMManager';
import { Vector3, BoundingBox } from '@babylonjs/core';

export interface AccessibilityIssue {
  id: string;
  elementId: string;
  issueType: 'wheelchair_path' | 'door_width' | 'door_clearance' | 'stairs' | 'ramp' | 'ramp_landing' | 'elevator_access' | 'turning_space' | 'workspace_access';
  description: string;
  severity: 'low' | 'medium' | 'high';
  location: BoundingBox;
  violationAmount?: number; // How much it violates the standard (e.g., inches too narrow)
  resolved: boolean;
}

export class AccessibilityChecker {
  private model: BIMModel | null = null;
  private issues: AccessibilityIssue[] = [];

  constructor() {}

  setModel(model: BIMModel) {
    this.model = model;
    this.issues = [];
  }

  analyzeAccessibility(): AccessibilityIssue[] {
    if (!this.model) return [];

    this.issues = [];

    this.model.elements.forEach((element: BIMElement) => {
      // Check door width for accessibility (ADA: 32" minimum clear width)
      const doorCheck = this.checkDoorWidth(element);
      if (doorCheck.issue) {
        this.issues.push(doorCheck.issue);
      }

      // Check wheelchair path width (ADA: 36" minimum)
      const pathCheck = this.checkWheelchairPath(element);
      if (pathCheck.issue) {
        this.issues.push(pathCheck.issue);
      }

      // Check stairs compliance (ADA: 7" max riser, 11" min tread)
      const stairsCheck = this.checkStairsCompliance(element);
      if (stairsCheck.issue) {
        this.issues.push(stairsCheck.issue);
      }

      // Check ramp compliance (ADA: 1:12 max slope)
      const rampCheck = this.checkRampCompliance(element);
      if (rampCheck.issue) {
        this.issues.push(rampCheck.issue);
      }

      // Check elevator accessibility (ADA: 54" x 80" minimum)
      const elevatorCheck = this.checkElevatorAccessibility(element);
      if (elevatorCheck.issue) {
        this.issues.push(elevatorCheck.issue);
      }

      // Check turning spaces (ADA: 60" diameter circle)
      const turningCheck = this.checkTurningSpace(element);
      if (turningCheck.issue) {
        this.issues.push(turningCheck.issue);
      }

      // Check workspace accessibility (ADA: work surface height, knee clearance)
      const workspaceCheck = this.checkWorkspaceAccessibility(element);
      if (workspaceCheck.issue) {
        this.issues.push(workspaceCheck.issue);
      }
    });

    return this.issues;
  }

  private createIssue(element: BIMElement, issueType: AccessibilityIssue['issueType'], description: string, violationAmount?: number): AccessibilityIssue {
    const severity = this.calculateSeverity(issueType, violationAmount);
    const boundingBox = this.calculateElementBoundingBox(element);

    return {
      id: `accessibility_${element.id}_${issueType}`,
      elementId: element.id,
      issueType,
      description,
      severity,
      location: boundingBox,
      violationAmount,
      resolved: false,
    };
  }

  private calculateElementBoundingBox(element: BIMElement): BoundingBox {
    // Calculate bounding box from element position and scale
    const halfWidth = (element.scale.x * (element.properties?.width || 1)) / 2;
    const halfHeight = (element.scale.y * (element.properties?.height || 1)) / 2;
    const halfDepth = (element.scale.z * (element.properties?.depth || 1)) / 2;

    const min = new Vector3(
      element.position.x - halfWidth,
      element.position.y - halfHeight,
      element.position.z - halfDepth
    );

    const max = new Vector3(
      element.position.x + halfWidth,
      element.position.y + halfHeight,
      element.position.z + halfDepth
    );

    return new BoundingBox(min, max);
  }

  private calculateSeverity(issueType: AccessibilityIssue['issueType'], violationAmount?: number): 'low' | 'medium' | 'high' {
    if (!violationAmount) {
      // Default severities for issues without measurable violations
      const defaultSeverities: Record<string, 'low' | 'medium' | 'high'> = {
        'wheelchair_path': 'medium',
        'door_clearance': 'medium',
        'turning_space': 'high',
        'ramp_landing': 'high',
        'workspace_access': 'medium'
      };
      return defaultSeverities[issueType] || 'medium';
    }

    // Calculate severity based on violation amount (assuming inches)
    const violationRatio = violationAmount / this.getStandardValue(issueType);

    if (violationRatio <= 0.1) return 'low';      // ≤10% violation
    if (violationRatio <= 0.25) return 'medium';  // 10-25% violation
    return 'high';                                // >25% violation
  }

  private getStandardValue(issueType: AccessibilityIssue['issueType']): number {
    // Return standard values in inches for severity calculation
    const standards: Record<string, number> = {
      'door_width': 32,        // 32 inches minimum clear width
      'wheelchair_path': 36,   // 36 inches minimum path width
      'stairs': 7,             // 7 inches max riser height
      'ramp': 8.33,            // 8.33% max slope (1:12 ratio)
      'elevator_access': 54,   // 54 inches minimum width
      'turning_space': 30,     // 30 sq ft minimum area
      'workspace_access': 27   // 27 inches minimum work surface height
    };
    return standards[issueType] || 36; // Default to 36 inches
  }

  // Enhanced accessibility check methods with ADA standards

  private checkDoorWidth(element: BIMElement): { issue: AccessibilityIssue | null } {
    if (element.type !== 'door') return { issue: null };

    const widthInches = (element.properties?.width ?? 0) * 39.37; // Convert meters to inches
    const minWidth = 32; // ADA minimum clear width for doors

    if (widthInches >= minWidth) return { issue: null };

    const violationAmount = minWidth - widthInches;
    const description = `Door width ${widthInches.toFixed(1)}" is below ADA minimum of 32". Needs ${violationAmount.toFixed(1)}" more clearance.`;

    return {
      issue: this.createIssue(element, 'door_width', description, violationAmount)
    };
  }

  private checkWheelchairPath(element: BIMElement): { issue: AccessibilityIssue | null } {
    // Check corridors, hallways, and accessible routes
    if (!['floor', 'wall'].includes(element.type)) return { issue: null };

    const widthInches = (element.properties?.width ?? 0) * 39.37; // Convert meters to inches
    const minWidth = 36; // ADA minimum wheelchair path width

    if (widthInches >= minWidth) return { issue: null };

    const violationAmount = minWidth - widthInches;
    const description = `Path width ${widthInches.toFixed(1)}" is below ADA minimum of 36" for wheelchair access. Needs ${violationAmount.toFixed(1)}" more width.`;

    return {
      issue: this.createIssue(element, 'wheelchair_path', description, violationAmount)
    };
  }

  private checkStairsCompliance(element: BIMElement): { issue: AccessibilityIssue | null } {
    if (element.type !== 'floor' || !element.properties?.hasStairs) return { issue: null };

    const riserInches = (element.properties?.riserHeight ?? 0) * 39.37;
    const treadInches = (element.properties?.treadDepth ?? 0) * 39.37;

    const maxRiser = 7; // ADA maximum riser height
    const minTread = 11; // ADA minimum tread depth

    let violationAmount = 0;
    let description = '';

    if (riserInches > maxRiser) {
      violationAmount = riserInches - maxRiser;
      description = `Stair riser height ${riserInches.toFixed(1)}" exceeds ADA maximum of 7". Reduce by ${violationAmount.toFixed(1)}".`;
    } else if (treadInches < minTread) {
      violationAmount = minTread - treadInches;
      description = `Stair tread depth ${treadInches.toFixed(1)}" is below ADA minimum of 11". Increase by ${violationAmount.toFixed(1)}".`;
    } else {
      return { issue: null };
    }

    return {
      issue: this.createIssue(element, 'stairs', description, violationAmount)
    };
  }

  private checkRampCompliance(element: BIMElement): { issue: AccessibilityIssue | null } {
    if (element.type !== 'floor' || !element.properties?.isRamp) return { issue: null };

    const slopeRatio = element.properties?.slope ?? 0;
    const maxSlope = 1/12; // ADA maximum 1:12 slope (8.33%)

    if (slopeRatio <= maxSlope) return { issue: null };

    // Calculate violation as percentage over the limit
    const violationPercent = ((slopeRatio - maxSlope) / maxSlope) * 100;
    const description = `Ramp slope ${(slopeRatio * 100).toFixed(1)}% exceeds ADA maximum of 8.3% (1:12). ${violationPercent.toFixed(1)}% too steep.`;

    return {
      issue: this.createIssue(element, 'ramp', description, violationPercent)
    };
  }

  private checkElevatorAccessibility(element: BIMElement): { issue: AccessibilityIssue | null } {
    if (element.type !== 'fixture' || !element.properties?.isElevator) return { issue: null };

    const widthInches = (element.properties?.width ?? 0) * 39.37;
    const depthInches = (element.properties?.depth ?? 0) * 39.37;

    const minWidth = 54; // ADA minimum elevator width
    const minDepth = 80; // ADA minimum elevator depth

    if (widthInches >= minWidth && depthInches >= minDepth) return { issue: null };

    let violationAmount = 0;
    let description = '';

    if (widthInches < minWidth) {
      violationAmount = minWidth - widthInches;
      description = `Elevator width ${widthInches.toFixed(1)}" is below ADA minimum of 54". Needs ${violationAmount.toFixed(1)}" more width.`;
    } else if (depthInches < minDepth) {
      violationAmount = minDepth - depthInches;
      description = `Elevator depth ${depthInches.toFixed(1)}" is below ADA minimum of 80". Needs ${violationAmount.toFixed(1)}" more depth.`;
    }

    return {
      issue: this.createIssue(element, 'elevator_access', description, violationAmount)
    };
  }

  private checkTurningSpace(element: BIMElement): { issue: AccessibilityIssue | null } {
    // Check for adequate turning spaces in rooms (60" diameter circle)
    if (element.type !== 'floor') return { issue: null };

    const areaSqMeters = element.properties?.area ?? 0;
    const areaSqFeet = areaSqMeters * 10.764; // Convert to square feet

    // Minimum 60" diameter circle requires about 28.27 sq ft
    const minTurningArea = 30; // sq ft for 60" diameter circle

    if (areaSqFeet >= minTurningArea) return { issue: null };

    const description = `Room area ${areaSqFeet.toFixed(1)} sq ft is insufficient for ADA 60" diameter wheelchair turning space (requires 30 sq ft minimum).`;

    return {
      issue: this.createIssue(element, 'turning_space', description)
    };
  }

  private checkWorkspaceAccessibility(element: BIMElement): { issue: AccessibilityIssue | null } {
    // Check workspace accessibility for desks, tables, and work surfaces
    if (!['furniture', 'fixture'].includes(element.type) || !element.properties?.isWorkspace) return { issue: null };

    const surfaceHeightInches = (element.properties?.surfaceHeight ?? 0) * 39.37;
    const kneeClearanceHeight = (element.properties?.kneeClearanceHeight ?? 0) * 39.37;
    const kneeClearanceDepth = (element.properties?.kneeClearanceDepth ?? 0) * 39.37;
    const kneeClearanceWidth = (element.properties?.kneeClearanceWidth ?? 0) * 39.37;

    const minSurfaceHeight = 27; // ADA minimum work surface height for wheelchair users
    const maxSurfaceHeight = 34; // ADA maximum work surface height for wheelchair users
    const minKneeClearanceHeight = 27; // ADA minimum knee clearance height
    const minKneeClearanceDepth = 19; // ADA minimum knee clearance depth
    const minKneeClearanceWidth = 30; // ADA minimum knee clearance width

    let violationAmount = 0;
    let description = '';

    if (surfaceHeightInches < minSurfaceHeight) {
      violationAmount = minSurfaceHeight - surfaceHeightInches;
      description = `Work surface height ${surfaceHeightInches.toFixed(1)}" is below ADA minimum of 27" for wheelchair accessibility. Raise by ${violationAmount.toFixed(1)}".`;
    } else if (surfaceHeightInches > maxSurfaceHeight) {
      violationAmount = surfaceHeightInches - maxSurfaceHeight;
      description = `Work surface height ${surfaceHeightInches.toFixed(1)}" exceeds ADA maximum of 34" for wheelchair accessibility. Lower by ${violationAmount.toFixed(1)}".`;
    } else if (kneeClearanceHeight < minKneeClearanceHeight) {
      violationAmount = minKneeClearanceHeight - kneeClearanceHeight;
      description = `Knee clearance height ${kneeClearanceHeight.toFixed(1)}" is below ADA minimum of 27". Increase clearance by ${violationAmount.toFixed(1)}".`;
    } else if (kneeClearanceDepth < minKneeClearanceDepth) {
      violationAmount = minKneeClearanceDepth - kneeClearanceDepth;
      description = `Knee clearance depth ${kneeClearanceDepth.toFixed(1)}" is below ADA minimum of 19". Increase depth by ${violationAmount.toFixed(1)}".`;
    } else if (kneeClearanceWidth < minKneeClearanceWidth) {
      violationAmount = minKneeClearanceWidth - kneeClearanceWidth;
      description = `Knee clearance width ${kneeClearanceWidth.toFixed(1)}" is below ADA minimum of 30". Increase width by ${violationAmount.toFixed(1)}".`;
    } else {
      return { issue: null };
    }

    return {
      issue: this.createIssue(element, 'workspace_access', description, violationAmount)
    };
  }

  getIssues(): AccessibilityIssue[] {
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
}
