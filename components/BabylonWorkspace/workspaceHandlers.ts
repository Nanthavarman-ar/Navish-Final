import { useCallback } from "react";
import { Mesh, Material } from "@babylonjs/core";
import { AnimationGroup } from "../interfaces/AnimationInterfaces";
import { MaterialState } from "../interfaces/MaterialInterfaces";

interface WorkspaceHandlersProps {
  onMeshSelect?: (mesh: Mesh) => void;
  updateState: (updates: Partial<any>) => void;
  onAnimationCreate?: (animation: AnimationGroup) => void;
  onMaterialChange?: (material: MaterialState) => void;
  workspaceState: any;
}

export function useWorkspaceHandlers({
  onMeshSelect,
  updateState,
  onAnimationCreate,
  onMaterialChange,
  workspaceState,
}: WorkspaceHandlersProps) {
  // Handler for mesh selection
  const handleMeshSelect = useCallback((mesh: Mesh) => {
    updateState({ selectedMesh: mesh });
    if (onMeshSelect) {
      onMeshSelect(mesh);
    }
  }, [onMeshSelect, updateState]);

  // Animation handlers
  const handleAnimationCreate = useCallback((sequence: any) => {
    const animationGroup: AnimationGroup = {
      id: sequence.id,
      name: sequence.name,
      animations: [],
      targetMeshes: [],
      speedRatio: 1.0,
      weight: 1.0,
      isPlaying: false,
      isLooping: sequence.loop,
      from: 0,
      to: sequence.duration || 100
    };
    if (onAnimationCreate) {
      onAnimationCreate(animationGroup);
    }
  }, [onAnimationCreate]);

  // Material handlers
  const handleMaterialChange = useCallback((materialState: MaterialState) => {
    if (onMaterialChange) {
      onMaterialChange(materialState);
    }
  }, [onMaterialChange]);

  const handleMaterialApplied = useCallback((mesh: Mesh, material: Material) => {
    mesh.material = material;
    if (workspaceState.selectedMesh === mesh) {
      updateState({ selectedMesh: mesh });
    }
    if (onMaterialChange) {
      onMaterialChange({
        id: material.id,
        name: material.name || `Material ${material.id}`,
        type: material instanceof Material ? 'pbr' : 'standard',
        properties: material,
        isActive: true,
        lastModified: Date.now()
      });
    }
  }, [workspaceState.selectedMesh, onMaterialChange, updateState]);

  return {
    handleMeshSelect,
    handleAnimationCreate,
    handleMaterialChange,
    handleMaterialApplied,
  };
}
