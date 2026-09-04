import { useEffect, useCallback } from 'react';
import { Scene, ArcRotateCamera, AbstractMesh, Mesh, Vector3, PointerEventTypes, PointerInfo, Color3, Quaternion } from '@babylonjs/core';

// Exported so BabylonWorkspace.tsx's OWN separate selection listener (its "click-to-
// select" effect, further down the file) uses this exact same definition rather than
// its own copy - two independent scene.onPointerObservable listeners both used to write
// to the same workspaceState.selectedMesh, one correctly excluding helper/marker meshes
// and one (this hook, previously) not excluding anything at all. Clicking a swatch/
// hotspot/annotation marker still got it selected (and shown in the Move/Rotate/Delete
// toolbar) via THIS hook even after the other listener was fixed, since they'd drifted
// out of sync - a single shared predicate can't drift again.
export const isSelectableMesh = (mesh: AbstractMesh): boolean =>
  mesh.isEnabled() && mesh.isVisible && mesh.isPickable &&
  !/^(ground|ceiling_light|measure_|annotation_pin_|annotation_popup_panel_|hotspot_marker_|swatch_marker_|swatch_popup_panel_|cursor_|collab_|sound_privacy_marker_|__root__)/i.test(mesh.name || '');

export interface UseMeshSceneHandlersProps {
  sceneRef: React.RefObject<Scene | null>;
  cameraRef: React.RefObject<ArcRotateCamera | null>;
  selectedMesh: Mesh | null;
  cameraActive: boolean;
  perspectiveActive: boolean;
  highlightLayerRef: React.RefObject<any | null>;
  onMeshSelect?: (mesh: Mesh) => void;
  updateState: (updates: any) => void;
  handleMeshSelect?: (mesh: Mesh) => void;
  collabManagerRef?: React.RefObject<any>;
  cloudAnchorManagerRef?: React.RefObject<any>;
  featureStates?: Record<string, boolean>;
}

export const useMeshSceneHandlers = ({
  sceneRef,
  cameraRef,
  selectedMesh,
  cameraActive,
  perspectiveActive,
  highlightLayerRef,
  onMeshSelect,
  updateState,
  handleMeshSelect: externalHandleMeshSelect,
  collabManagerRef,
  cloudAnchorManagerRef,
  featureStates = {}
}: UseMeshSceneHandlersProps) => {
  const internalHandleMeshSelect = useCallback(async (mesh: Mesh) => {
    if (externalHandleMeshSelect) {
      externalHandleMeshSelect(mesh);
    }
    if (onMeshSelect) {
      onMeshSelect(mesh);
    }
    updateState({ selectedMesh: mesh });
    // Highlight selected mesh (skip ground/large planes to avoid glow overlay).
    // The previous mesh's highlight must always be cleared regardless of
    // whether the newly-picked mesh itself gets highlighted - otherwise
    // clicking the ground/floor (very reachable by "clicking outside" a
    // model, since it usually sits right behind/around it) left the old
    // highlight glowing forever with no way back to "nothing selected".
    const skipHighlight = mesh.name && (
      /^ground$/i.test(mesh.name) ||
      /^groundMaterial$/i.test(mesh.name) ||
      mesh.name.toLowerCase().includes('floor') ||
      mesh.name.toLowerCase().includes('floorplan')
    );
    if (highlightLayerRef.current) {
      if (selectedMesh) highlightLayerRef.current.removeMesh(selectedMesh);
      if (!skipHighlight) highlightLayerRef.current.addMesh(mesh, Color3.FromHexString("#4488ff"));
    }

    // Integration: Share selection with CollabManager if enabled
    if (featureStates.showCollabManager && collabManagerRef?.current) {
      try {
        const objectData = {
          id: `selection_${Date.now()}`,
          name: `Selected: ${mesh.name}`,
          type: 'annotation' as const,
          position: mesh.position.clone(),
          rotation: mesh.rotationQuaternion || Quaternion.Identity(),
          scale: mesh.scaling.clone(),
          ownerId: collabManagerRef.current.getCurrentUser()?.id || 'local-user',
          isShared: true,
          metadata: { meshId: mesh.id, action: 'selected' }
        };
        collabManagerRef.current.createObject(objectData);
      } catch (error) {
        console.error('Failed to share selection via collab:', error);
      }
    }

    // Integration: Attach cloud anchor if geo features active
    if (featureStates.showGeoLocation && cloudAnchorManagerRef?.current && !mesh.metadata?.cloudAnchorId) {
      try {
        const anchorData = {
          id: `anchor_${mesh.id}_${Date.now()}`,
          name: `Anchor for ${mesh.name}`,
          position: mesh.position.clone(),
          rotation: mesh.rotationQuaternion || Quaternion.Identity(),
          scale: Vector3.One(),
          isPersistent: true,
          gpsCoordinates: { lat: 0, lng: 0, alt: 0 }, // Placeholder; integrate real GPS
          modelUrl: undefined,
          userId: 'local-user'
        };
        const anchor = await cloudAnchorManagerRef.current.createAnchor(anchorData);
        if (anchor) {
          mesh.metadata = { ...mesh.metadata, cloudAnchorId: anchor.id };
          cloudAnchorManagerRef.current.updateAnchorPosition(anchor.id, mesh.position);
        }
      } catch (error) {
        console.error('Failed to attach cloud anchor:', error);
      }
    }
  }, [externalHandleMeshSelect, onMeshSelect, updateState, highlightLayerRef, featureStates, collabManagerRef, cloudAnchorManagerRef, selectedMesh]);

  // Clicking empty space (no mesh under the cursor) previously did nothing -
  // there was no path back to "nothing selected", so the highlight stayed on
  // the last-picked mesh forever no matter where else you clicked.
  const internalHandleMeshDeselect = useCallback(() => {
    if (!selectedMesh) return;
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeMesh(selectedMesh);
    }
    updateState({ selectedMesh: null });
  }, [selectedMesh, highlightLayerRef, updateState]);

  // Mesh selection via pointer observable
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const pointerObservable = scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
      // Also skip while teleport navigation owns clicks (see the second selection handler in
      // BabylonWorkspace.tsx, which has the mirror-image guard for showMeasurementTool).
      if (featureStates.showMeasurementTool || featureStates.showTeleportManager) return;
      if (pointerInfo.type === PointerEventTypes.POINTERPICK || pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh) {
          const mesh = pointerInfo.pickInfo.pickedMesh as Mesh;
          // Previously selected ANY picked mesh with no filtering at all, so clicking a
          // marker/pin (meant to open its own popup, not become "the selected model
          // object") also populated the Move/Rotate/Delete toolbar with it.
          if (isSelectableMesh(mesh)) {
            internalHandleMeshSelect(mesh);
          }
        } else {
          internalHandleMeshDeselect();
        }
      }
    }, PointerEventTypes.POINTERPICK | PointerEventTypes.POINTERDOWN);

    return () => {
      scene.onPointerObservable.remove(pointerObservable);
    };
  }, [sceneRef, internalHandleMeshSelect, internalHandleMeshDeselect, featureStates.showMeasurementTool, featureStates.showTeleportManager]);

  // Tool activation effects
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    // Move/Rotate/Scale used to be handled here via PointerDragBehavior (move: horizontal-
    // plane-only drag, rotate: single-axis inferred from horizontal mouse delta, scale:
    // uniform scale from vertical mouse delta, no visual handles). That system has been
    // replaced by the real GizmoManager (transformMode state, BabylonWorkspace.tsx) which
    // every UI entry point (Core Workspace panel, FloatingToolbar, bottom selection toolbar,
    // g/r/s hotkeys) now drives - the two systems used to be able to run simultaneously on
    // the same mesh, producing compounding/conflicting transforms.

    // Camera reset
    // cameraRef is typed as ArcRotateCamera, but switchCamera() (BabylonWorkspace.tsx)
    // force-casts FreeCamera/UniversalCamera into it for walk/dollhouse modes -
    // those classes don't have setPosition (it's ArcRotateCamera-only in Babylon),
    // so calling it unconditionally crashed the whole workspace whenever this ran
    // while a walk/dollhouse camera was active.
    if (cameraActive) {
      if (typeof (camera as any).setPosition === 'function') {
        camera.setPosition(new Vector3(0, 5, -10));
      } else {
        camera.position.copyFromFloats(0, 5, -10);
      }
      camera.setTarget(Vector3.Zero());
      updateState({ cameraActive: false }); // Reset toggle
    }

    // Perspective toggle
    if (perspectiveActive) {
      if (camera.mode === 0) {
        camera.mode = 1;
        (camera as any).orthoLeft = -10;
        (camera as any).orthoRight = 10;
        (camera as any).orthoTop = 10;
        (camera as any).orthoBottom = -10;
      } else {
        camera.mode = 0;
      }
      updateState({ perspectiveActive: false }); // Reset toggle
    }

  }, [cameraActive, perspectiveActive, selectedMesh, sceneRef, cameraRef, updateState]);

  return { handleMeshSelect: internalHandleMeshSelect };
};
