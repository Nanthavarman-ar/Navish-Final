import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

interface ErgonomicTestingProps {
  scene: BABYLON.Scene;
  onAvatarChange?: (avatarData: AvatarData) => void;
}

interface AvatarData {
  type: 'child' | 'adult' | 'elderly' | 'wheelchair';
  height: number;
  reach: number;
  position: BABYLON.Vector3;
  conflicts: Conflict[];
}

interface Conflict {
  type: 'reach' | 'clearance' | 'visibility';
  severity: 'low' | 'medium' | 'high';
  description: string;
  position: BABYLON.Vector3;
}

const ErgonomicTesting: React.FC<ErgonomicTestingProps> = ({ scene, onAvatarChange }) => {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarData['type']>('adult');
  const [avatarPosition, setAvatarPosition] = useState<BABYLON.Vector3>(new BABYLON.Vector3(0, 0, 0));
  const [showReachZone, setShowReachZone] = useState<boolean>(true);
  const [showClearanceZone, setShowClearanceZone] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(false);

  const avatarMeshRef = useRef<BABYLON.Mesh | null>(null);
  const reachZoneRef = useRef<BABYLON.Mesh | null>(null);
  const clearanceZoneRef = useRef<BABYLON.Mesh | null>(null);
  const conflictMeshesRef = useRef<BABYLON.Mesh[]>([]);

  // Avatar specifications
  const avatarSpecs = {
    child: {
      height: 1.2, // meters
      reach: 0.8,
      eyeHeight: 1.0,
      shoulderWidth: 0.3,
      color: new BABYLON.Color3(0.8, 0.6, 0.4)
    },
    adult: {
      height: 1.75,
      reach: 1.2,
      eyeHeight: 1.6,
      shoulderWidth: 0.4,
      color: new BABYLON.Color3(0.9, 0.7, 0.5)
    },
    elderly: {
      height: 1.65,
      reach: 1.0,
      eyeHeight: 1.5,
      shoulderWidth: 0.4,
      color: new BABYLON.Color3(0.7, 0.6, 0.5)
    },
    wheelchair: {
      height: 1.3,
      reach: 0.9,
      eyeHeight: 1.2,
      shoulderWidth: 0.6,
      color: new BABYLON.Color3(0.5, 0.5, 0.8)
    }
  };

  // Create avatar mesh
  const createAvatarMesh = (type: AvatarData['type']): BABYLON.Mesh => {
    const spec = avatarSpecs[type];
    const avatar = new BABYLON.Mesh(`avatar_${type}`, scene);

    // Body (cylinder)
    const body = BABYLON.MeshBuilder.CreateCylinder('body', {
      height: spec.height * 0.6,
      diameter: spec.shoulderWidth
    }, scene);
    body.position.y = spec.height * 0.3;
    body.material = new BABYLON.StandardMaterial('bodyMat', scene);
    (body.material as BABYLON.StandardMaterial).diffuseColor = spec.color;

    // Head (sphere)
    const head = BABYLON.MeshBuilder.CreateSphere('head', {
      diameter: spec.shoulderWidth * 0.8
    }, scene);
    head.position.y = spec.height * 0.75;
    head.material = new BABYLON.StandardMaterial('headMat', scene);
    (head.material as BABYLON.StandardMaterial).diffuseColor = spec.color;

    // Arms (for reach visualization)
    const leftArm = BABYLON.MeshBuilder.CreateCylinder('leftArm', {
      height: spec.reach,
      diameter: 0.05
    }, scene);
    leftArm.position = new BABYLON.Vector3(-spec.shoulderWidth * 0.4, spec.height * 0.5, 0);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.material = new BABYLON.StandardMaterial('armMat', scene);
    (leftArm.material as BABYLON.StandardMaterial).diffuseColor = spec.color;

    const rightArm = BABYLON.MeshBuilder.CreateCylinder('rightArm', {
      height: spec.reach,
      diameter: 0.05
    }, scene);
    rightArm.position = new BABYLON.Vector3(spec.shoulderWidth * 0.4, spec.height * 0.5, 0);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.material = new BABYLON.StandardMaterial('armMat', scene);
    (rightArm.material as BABYLON.StandardMaterial).diffuseColor = spec.color;

    // For wheelchair, add wheelchair base
    if (type === 'wheelchair') {
      const wheelchairBase = BABYLON.MeshBuilder.CreateCylinder('wheelchairBase', {
        height: 0.1,
        diameter: spec.shoulderWidth * 1.5
      }, scene);
      wheelchairBase.position.y = spec.height * 0.1;
      wheelchairBase.material = new BABYLON.StandardMaterial('wheelchairMat', scene);
      (wheelchairBase.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);

      // Wheels
      const wheel1 = BABYLON.MeshBuilder.CreateCylinder('wheel1', {
        height: 0.05,
        diameter: 0.3
      }, scene);
      wheel1.position = new BABYLON.Vector3(-spec.shoulderWidth * 0.6, spec.height * 0.1, 0);
      wheel1.rotation.z = Math.PI / 2;
      wheel1.material = new BABYLON.StandardMaterial('wheelMat', scene);
      (wheel1.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

      const wheel2 = BABYLON.MeshBuilder.CreateCylinder('wheel2', {
        height: 0.05,
        diameter: 0.3
      }, scene);
      wheel2.position = new BABYLON.Vector3(spec.shoulderWidth * 0.6, spec.height * 0.1, 0);
      wheel2.rotation.z = Math.PI / 2;
      wheel2.material = new BABYLON.StandardMaterial('wheelMat', scene);
      (wheel2.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

      body.parent = avatar;
      head.parent = avatar;
      wheelchairBase.parent = avatar;
      wheel1.parent = avatar;
      wheel2.parent = avatar;
    } else {
      body.parent = avatar;
      head.parent = avatar;
      leftArm.parent = avatar;
      rightArm.parent = avatar;
    }

    return avatar;
  };

  // Create reach zone visualization
  const createReachZone = (avatar: BABYLON.Mesh, spec: typeof avatarSpecs.adult): BABYLON.Mesh => {
    const reachZone = BABYLON.MeshBuilder.CreateSphere('reachZone', {
      diameter: spec.reach * 2
    }, scene);

    reachZone.position = avatar.position.add(new BABYLON.Vector3(0, spec.height * 0.5, 0));
    reachZone.material = new BABYLON.StandardMaterial('reachMat', scene);
    (reachZone.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
    (reachZone.material as BABYLON.StandardMaterial).alpha = 0.3;
    (reachZone.material as BABYLON.StandardMaterial).wireframe = true;

    return reachZone;
  };

  // Create clearance zone
  const createClearanceZone = (avatar: BABYLON.Mesh, spec: typeof avatarSpecs.adult): BABYLON.Mesh => {
    const clearanceZone = BABYLON.MeshBuilder.CreateCylinder('clearanceZone', {
      height: spec.height,
      diameter: spec.shoulderWidth * 2
    }, scene);

    clearanceZone.position = avatar.position;
    clearanceZone.material = new BABYLON.StandardMaterial('clearanceMat', scene);
    (clearanceZone.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2);
    (clearanceZone.material as BABYLON.StandardMaterial).alpha = 0.2;
    (clearanceZone.material as BABYLON.StandardMaterial).wireframe = true;

    return clearanceZone;
  };

  // Analyze conflicts
  const analyzeConflicts = (avatar: BABYLON.Mesh, spec: typeof avatarSpecs.adult): Conflict[] => {
    const conflicts: Conflict[] = [];

    // Check for objects within reach zone
    if (reachZoneRef.current) {
      const reachBoundingInfo = reachZoneRef.current.getBoundingInfo();
      scene.meshes.forEach(mesh => {
        if (mesh !== avatar && mesh !== reachZoneRef.current && mesh !== clearanceZoneRef.current &&
            !mesh.name.includes('avatar') && !mesh.name.includes('reach') && !mesh.name.includes('clearance')) {
          const meshBoundingInfo = mesh.getBoundingInfo();

          if (reachBoundingInfo.intersects(meshBoundingInfo, false)) {
            conflicts.push({
              type: 'reach',
              severity: 'medium',
              description: `Object "${mesh.name}" is within reach zone`,
              position: mesh.position
            });
          }
        }
      });
    }

    // Check clearance conflicts
    if (clearanceZoneRef.current) {
      const clearanceBoundingInfo = clearanceZoneRef.current.getBoundingInfo();
      scene.meshes.forEach(mesh => {
        if (mesh !== avatar && mesh !== reachZoneRef.current && mesh !== clearanceZoneRef.current &&
            !mesh.name.includes('avatar') && !mesh.name.includes('reach') && !mesh.name.includes('clearance')) {
          const meshBoundingInfo = mesh.getBoundingInfo();

          if (clearanceBoundingInfo.intersects(meshBoundingInfo, false)) {
            conflicts.push({
              type: 'clearance',
              severity: 'high',
              description: `Object "${mesh.name}" conflicts with clearance zone`,
              position: mesh.position
            });
          }
        }
      });
    }

    return conflicts;
  };

  // Create conflict visualization
  const createConflictVisualization = (conflicts: Conflict[]) => {
    // Clear existing conflict meshes
    conflictMeshesRef.current.forEach(mesh => mesh.dispose());
    conflictMeshesRef.current = [];

    conflicts.forEach((conflict, index) => {
      const conflictMesh = BABYLON.MeshBuilder.CreateSphere(`conflict_${index}`, {
        diameter: 0.2
      }, scene);

      conflictMesh.position = conflict.position;
      conflictMesh.material = new BABYLON.StandardMaterial(`conflictMat_${index}`, scene);

      const material = conflictMesh.material as BABYLON.StandardMaterial;
      if (conflict.severity === 'high') {
        material.diffuseColor = new BABYLON.Color3(1.0, 0.0, 0.0);
        material.emissiveColor = new BABYLON.Color3(0.5, 0.0, 0.0);
      } else if (conflict.severity === 'medium') {
        material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 0.0);
        material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.0);
      } else {
        material.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.0);
        material.emissiveColor = new BABYLON.Color3(0.0, 0.5, 0.0);
      }

      conflictMeshesRef.current.push(conflictMesh);
    });
  };

  // Update avatar
  const updateAvatar = () => {
    if (!isActive) return;

    // Clear existing meshes
    if (avatarMeshRef.current) avatarMeshRef.current.dispose();
    if (reachZoneRef.current) reachZoneRef.current.dispose();
    if (clearanceZoneRef.current) clearanceZoneRef.current.dispose();

    // Create new avatar
    const avatar = createAvatarMesh(selectedAvatar);
    avatar.position = avatarPosition;
    avatarMeshRef.current = avatar;

    const spec = avatarSpecs[selectedAvatar];

    // Create zones if enabled
    if (showReachZone) {
      reachZoneRef.current = createReachZone(avatar, spec);
    }

    if (showClearanceZone) {
      clearanceZoneRef.current = createClearanceZone(avatar, spec);
    }

    // Analyze conflicts
    const conflicts = analyzeConflicts(avatar, spec);
    createConflictVisualization(conflicts);

    // Notify parent
    const avatarData: AvatarData = {
      type: selectedAvatar,
      height: spec.height,
      reach: spec.reach,
      position: avatarPosition,
      conflicts
    };

    onAvatarChange?.(avatarData);
  };

  // Handle pointer events for avatar placement
  useEffect(() => {
    if (!isActive) return;

    const handlePointerDown = (event: BABYLON.PointerInfo) => {
      if (event.type === BABYLON.PointerEventTypes.POINTERDOWN && event.pickInfo?.hit) {
        const pickedPoint = event.pickInfo.pickedPoint;
        if (pickedPoint) {
          setAvatarPosition(pickedPoint);
        }
      }
    };

    scene.onPointerObservable.add(handlePointerDown);

    return () => {
      scene.onPointerObservable.removeCallback(handlePointerDown);
    };
  }, [isActive]);

  // Update avatar when parameters change
  useEffect(() => {
    updateAvatar();
  }, [selectedAvatar, avatarPosition, showReachZone, showClearanceZone, isActive]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (avatarMeshRef.current) avatarMeshRef.current.dispose();
      if (reachZoneRef.current) reachZoneRef.current.dispose();
      if (clearanceZoneRef.current) clearanceZoneRef.current.dispose();
      conflictMeshesRef.current.forEach(mesh => mesh.dispose());
    };
  }, []);

  const spec = avatarSpecs[selectedAvatar];
  const avatarData: AvatarData = {
    type: selectedAvatar,
    height: spec.height,
    reach: spec.reach,
    position: avatarPosition,
    conflicts: []
  };

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Ergonomic Testing</h3>

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
          {isActive ? 'Stop Testing' : 'Start Testing'}
        </button>
      </div>

      {/* Avatar Selection */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Avatar Type</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
          {Object.keys(avatarSpecs).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedAvatar(type as AvatarData['type'])}
              style={{
                padding: '6px',
                background: selectedAvatar === type ? '#3b82f6' : '#334155',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#f1f5f9',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
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
              checked={showReachZone}
              onChange={(e) => setShowReachZone(e.target.checked)}
            />
            Show Reach Zone (Green)
          </label>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showClearanceZone}
              onChange={(e) => setShowClearanceZone(e.target.checked)}
            />
            Show Clearance Zone (Red)
          </label>
        </div>
      </div>

      {/* Avatar Specifications */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Specifications</h4>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          <div>Height: {spec.height.toFixed(2)}m</div>
          <div>Reach: {spec.reach.toFixed(2)}m</div>
          <div>Eye Height: {spec.eyeHeight.toFixed(2)}m</div>
          <div>Shoulder Width: {spec.shoulderWidth.toFixed(2)}m</div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Instructions</h4>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
          {isActive ? 'Click on the floor to position the avatar.' : 'Start testing to place avatars.'}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          Red spheres indicate conflicts, yellow for warnings, green for optimal conditions.
        </div>
      </div>
    </div>
  );
};

export default ErgonomicTesting;
