import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

interface FurnitureClearanceCheckerProps {
  scene: BABYLON.Scene;
  onClearanceUpdate?: (clearanceData: ClearanceData) => void;
}

interface ClearanceData {
  conflicts: ClearanceConflict[];
  totalConflicts: number;
  clearanceZones: ClearanceZone[];
  recommendations: string[];
}

interface ClearanceConflict {
  id: string;
  type: 'circulation' | 'accessibility' | 'safety' | 'functionality';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position: BABYLON.Vector3;
  affectedObjects: string[];
  requiredClearance: number;
  actualClearance: number;
}

interface ClearanceZone {
  id: string;
  type: 'doorway' | 'corridor' | 'workspace' | 'accessibility';
  position: BABYLON.Vector3;
  dimensions: BABYLON.Vector3;
  requiredClearance: number;
}

const FurnitureClearanceChecker: React.FC<FurnitureClearanceCheckerProps> = ({ scene, onClearanceUpdate }) => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [selectedStandard, setSelectedStandard] = useState<string>('ADA');
  const [showClearanceZones, setShowClearanceZones] = useState<boolean>(true);
  const [showConflicts, setShowConflicts] = useState<boolean>(true);
  const [autoDetect, setAutoDetect] = useState<boolean>(true);

  const clearanceZonesRef = useRef<BABYLON.Mesh[]>([]);
  const conflictMeshesRef = useRef<BABYLON.Mesh[]>([]);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Accessibility standards
  const standards = {
    ADA: {
      doorway: 0.81, // 32 inches
      corridor: 0.91, // 36 inches
      workspace: 0.71, // 28 inches
      wheelchair: 1.52 // 60 inches turning radius
    },
    UBC: {
      doorway: 0.81,
      corridor: 0.91,
      workspace: 0.71,
      wheelchair: 1.52
    },
    International: {
      doorway: 0.80,
      corridor: 0.90,
      workspace: 0.70,
      wheelchair: 1.50
    }
  };

  // Auto-detect furniture and architectural elements
  const detectFurniture = (): BABYLON.Mesh[] => {
    const furniture: BABYLON.Mesh[] = [];

    scene.meshes.forEach(mesh => {
      // Ensure it's a Mesh instance
      if (!(mesh instanceof BABYLON.Mesh)) return;

      // Skip system meshes
      if (mesh.name.includes('system') || mesh.name.includes('camera') ||
          mesh.name.includes('light') || mesh.name.includes('sky')) {
        return;
      }

      // Check if mesh could be furniture based on size and name
      const boundingInfo = mesh.getBoundingInfo();
      const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

      // Furniture typically has reasonable dimensions
      if (size.x > 0.3 && size.x < 5 &&
          size.y > 0.3 && size.y < 3 &&
          size.z > 0.3 && size.z < 5) {
        furniture.push(mesh);
      }
    });

    return furniture;
  };

  // Create clearance zones
  const createClearanceZones = () => {
    const zones: ClearanceZone[] = [];
    const standard = standards[selectedStandard as keyof typeof standards];

    // Find doorways (large vertical openings)
    scene.meshes.forEach(mesh => {
      if (mesh.name.toLowerCase().includes('door') ||
          (mesh.name.toLowerCase().includes('wall') && mesh.scaling.x > 2)) {

        const boundingInfo = mesh.getBoundingInfo();
        const center = boundingInfo.boundingBox.centerWorld;

        zones.push({
          id: `doorway_${zones.length}`,
          type: 'doorway',
          position: center,
          dimensions: new BABYLON.Vector3(standard.doorway, 2.1, 0.1),
          requiredClearance: standard.doorway
        });
      }
    });

    // Create corridor zones (long narrow spaces)
    const corridors = detectCorridors();
    corridors.forEach((corridor, index) => {
      zones.push({
        id: `corridor_${index}`,
        type: 'corridor',
        position: corridor.center,
        dimensions: corridor.dimensions,
        requiredClearance: standard.corridor
      });
    });

    // Create workspace zones (around desks or work surfaces)
    const furniture = detectFurniture();
    furniture.forEach((item, index) => {
      if (item.name.toLowerCase().includes('desk') || item.name.toLowerCase().includes('table')) {
        const boundingInfo = item.getBoundingInfo();
        const center = boundingInfo.boundingBox.centerWorld;
        const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

        zones.push({
          id: `workspace_${index}`,
          type: 'workspace',
          position: center,
          dimensions: new BABYLON.Vector3(
            Math.max(size.x, standard.workspace),
            size.y,
            Math.max(size.z, standard.workspace)
          ),
          requiredClearance: standard.workspace
        });
      }
    });

    return zones;
  };

  // Detect corridors
  const detectCorridors = (): { center: BABYLON.Vector3; dimensions: BABYLON.Vector3 }[] => {
    const corridors: { center: BABYLON.Vector3; dimensions: BABYLON.Vector3 }[] = [];

    // Simple corridor detection based on mesh arrangement
    const floorMeshes = scene.meshes.filter(mesh =>
      mesh.name.toLowerCase().includes('floor') ||
      (mesh.position.y < 0.1 && mesh.position.y > -0.1)
    );

    floorMeshes.forEach(floor => {
      const boundingInfo = floor.getBoundingInfo();
      const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

      // If floor is long and narrow, consider it a corridor
      if ((size.x > size.z * 2 || size.z > size.x * 2) &&
          Math.min(size.x, size.z) < 2) {
        corridors.push({
          center: boundingInfo.boundingBox.centerWorld,
          dimensions: size
        });
      }
    });

    return corridors;
  };

  // Analyze clearance conflicts
  const analyzeClearance = (furniture: BABYLON.Mesh[], zones: ClearanceZone[]): ClearanceConflict[] => {
    const conflicts: ClearanceConflict[] = [];

    zones.forEach(zone => {
      furniture.forEach(item => {
        const distance = BABYLON.Vector3.Distance(zone.position, item.position);

        // Check if furniture is too close to clearance zone
        if (distance < zone.requiredClearance + 0.5) { // 0.5m buffer
          const boundingInfo = item.getBoundingInfo();
          const itemSize = boundingInfo.maximum.subtract(boundingInfo.minimum);
          const maxDimension = Math.max(itemSize.x, itemSize.y, itemSize.z);

          conflicts.push({
            id: `conflict_${conflicts.length}`,
            type: zone.type === 'doorway' ? 'accessibility' :
                  zone.type === 'corridor' ? 'circulation' : 'functionality',
            severity: distance < zone.requiredClearance * 0.5 ? 'critical' :
                     distance < zone.requiredClearance * 0.8 ? 'high' : 'medium',
            description: `${item.name} is too close to ${zone.type} clearance zone`,
            position: item.position,
            affectedObjects: [item.name, zone.id],
            requiredClearance: zone.requiredClearance,
            actualClearance: distance
          });
        }
      });
    });

    // Check furniture-to-furniture clearance
    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        const item1 = furniture[i];
        const item2 = furniture[j];
        const distance = BABYLON.Vector3.Distance(item1.position, item2.position);

        const boundingInfo1 = item1.getBoundingInfo();
        const boundingInfo2 = item2.getBoundingInfo();
        const size1 = boundingInfo1.maximum.subtract(boundingInfo1.minimum);
        const size2 = boundingInfo2.maximum.subtract(boundingInfo2.minimum);

        const minRequiredDistance = Math.max(
          Math.max(size1.x, size1.z),
          Math.max(size2.x, size2.z)
        ) * 0.6; // 60% of larger dimension

        if (distance < minRequiredDistance) {
          conflicts.push({
            id: `furniture_conflict_${conflicts.length}`,
            type: 'circulation',
            severity: distance < minRequiredDistance * 0.5 ? 'high' : 'medium',
            description: `${item1.name} and ${item2.name} are too close together`,
            position: item1.position.add(item2.position).scale(0.5),
            affectedObjects: [item1.name, item2.name],
            requiredClearance: minRequiredDistance,
            actualClearance: distance
          });
        }
      }
    }

    return conflicts;
  };

  // Visualize clearance zones
  const visualizeClearanceZones = (zones: ClearanceZone[]) => {
    // Clear existing zones
    clearanceZonesRef.current.forEach(mesh => mesh.dispose());
    clearanceZonesRef.current = [];

    zones.forEach(zone => {
      const zoneMesh = BABYLON.MeshBuilder.CreateBox(`clearance_${zone.id}`, {
        width: zone.dimensions.x,
        height: zone.dimensions.y,
        depth: zone.dimensions.z
      }, scene);

      zoneMesh.position = zone.position;
      zoneMesh.material = new BABYLON.StandardMaterial(`zoneMat_${zone.id}`, scene);
      const material = zoneMesh.material as BABYLON.StandardMaterial;

      switch (zone.type) {
        case 'doorway':
          material.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
          break;
        case 'corridor':
          material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.2);
          break;
        case 'workspace':
          material.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.8);
          break;
        case 'accessibility':
          material.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.8);
          break;
      }

      material.alpha = 0.3;
      material.wireframe = true;

      clearanceZonesRef.current.push(zoneMesh);
    });
  };

  // Visualize conflicts
  const visualizeConflicts = (conflicts: ClearanceConflict[]) => {
    // Clear existing conflicts
    conflictMeshesRef.current.forEach(mesh => mesh.dispose());
    conflictMeshesRef.current = [];

    conflicts.forEach(conflict => {
      const conflictMesh = BABYLON.MeshBuilder.CreateSphere(`conflict_${conflict.id}`, {
        diameter: 0.3
      }, scene);

      conflictMesh.position = conflict.position;
      conflictMesh.material = new BABYLON.StandardMaterial(`conflictMat_${conflict.id}`, scene);
      const material = conflictMesh.material as BABYLON.StandardMaterial;

      switch (conflict.severity) {
        case 'critical':
          material.diffuseColor = new BABYLON.Color3(1.0, 0.0, 0.0);
          material.emissiveColor = new BABYLON.Color3(0.5, 0.0, 0.0);
          break;
        case 'high':
          material.diffuseColor = new BABYLON.Color3(1.0, 0.5, 0.0);
          material.emissiveColor = new BABYLON.Color3(0.5, 0.25, 0.0);
          break;
        case 'medium':
          material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 0.0);
          material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.0);
          break;
        case 'low':
          material.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.0);
          material.emissiveColor = new BABYLON.Color3(0.0, 0.5, 0.0);
          break;
      }

      conflictMeshesRef.current.push(conflictMesh);
    });
  };

  // Generate recommendations
  const generateRecommendations = (conflicts: ClearanceConflict[]): string[] => {
    const recommendations: string[] = [];

    const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
    const highCount = conflicts.filter(c => c.severity === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(`${criticalCount} critical clearance violations detected. Immediate action required.`);
    }

    if (highCount > 0) {
      recommendations.push(`${highCount} high-priority clearance issues found. Review and adjust furniture placement.`);
    }

    if (conflicts.some(c => c.type === 'accessibility')) {
      recommendations.push('Ensure ADA compliance for accessibility clearance zones.');
    }

    if (conflicts.some(c => c.type === 'circulation')) {
      recommendations.push('Optimize furniture arrangement to improve circulation flow.');
    }

    if (recommendations.length === 0) {
      recommendations.push('No clearance conflicts detected. Good job!');
    }

    return recommendations;
  };

  // Run analysis
  const runAnalysis = () => {
    if (!isActive) return;

    const furniture = detectFurniture();
    const zones = createClearanceZones();
    const conflicts = analyzeClearance(furniture, zones);
    const recommendations = generateRecommendations(conflicts);

    if (showClearanceZones) {
      visualizeClearanceZones(zones);
    } else {
      clearanceZonesRef.current.forEach(mesh => mesh.dispose());
      clearanceZonesRef.current = [];
    }

    if (showConflicts) {
      visualizeConflicts(conflicts);
    } else {
      conflictMeshesRef.current.forEach(mesh => mesh.dispose());
      conflictMeshesRef.current = [];
    }

    const clearanceData: ClearanceData = {
      conflicts,
      totalConflicts: conflicts.length,
      clearanceZones: zones,
      recommendations
    };

    onClearanceUpdate?.(clearanceData);
  };

  // Auto-analysis loop
  useEffect(() => {
    if (isActive && autoDetect) {
      analysisIntervalRef.current = setInterval(runAnalysis, 2000); // Analyze every 2 seconds
    } else {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    }

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [isActive, autoDetect, selectedStandard, showClearanceZones, showConflicts]);

  // Initial analysis
  useEffect(() => {
    if (isActive) {
      runAnalysis();
    }
  }, [isActive, selectedStandard]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearanceZonesRef.current.forEach(mesh => mesh.dispose());
      conflictMeshesRef.current.forEach(mesh => mesh.dispose());
    };
  }, []);

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Furniture Clearance Checker</h3>

      {/* Simulation Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => setIsActive(!isActive)}
          style={{
            padding: '8px 16px',
            background: isActive ? '#dc2626' : '#10b981',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {isActive ? 'Stop Analysis' : 'Start Analysis'}
        </button>
      </div>

      {/* Standard Selection */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Accessibility Standard</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {Object.keys(standards).map((standard) => (
            <button
              key={standard}
              onClick={() => setSelectedStandard(standard)}
              style={{
                padding: '6px',
                background: selectedStandard === standard ? '#3b82f6' : '#334155',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {standard}
            </button>
          ))}
        </div>
      </div>

      {/* Visualization Options */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Visualization</h4>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showClearanceZones}
              onChange={(e) => setShowClearanceZones(e.target.checked)}
            />
            Show Clearance Zones
          </label>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showConflicts}
              onChange={(e) => setShowConflicts(e.target.checked)}
            />
            Show Conflict Indicators
          </label>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => setAutoDetect(e.target.checked)}
            />
            Auto-Detect Changes
          </label>
        </div>
      </div>

      {/* Standards Info */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Clearance Requirements ({selectedStandard})</h4>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          <div>Doorways: {(standards[selectedStandard as keyof typeof standards].doorway * 100).toFixed(0)}cm</div>
          <div>Corridors: {(standards[selectedStandard as keyof typeof standards].corridor * 100).toFixed(0)}cm</div>
          <div>Workspaces: {(standards[selectedStandard as keyof typeof standards].workspace * 100).toFixed(0)}cm</div>
          <div>Wheelchair: {(standards[selectedStandard as keyof typeof standards].wheelchair * 100).toFixed(0)}cm radius</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Legend</h4>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ff0000', marginRight: '8px', borderRadius: '2px' }}></div>
            Critical Conflict
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ff8000', marginRight: '8px', borderRadius: '2px' }}></div>
            High Priority
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ffff00', marginRight: '8px', borderRadius: '2px' }}></div>
            Medium Priority
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '12px', height: '12px', background: '#00ff00', marginRight: '8px', borderRadius: '2px' }}></div>
            Low Priority
          </div>
        </div>
      </div>
    </div>
  );
};

export default FurnitureClearanceChecker;
