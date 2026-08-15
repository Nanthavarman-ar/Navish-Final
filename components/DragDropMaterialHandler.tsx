import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { MaterialVariant } from './MaterialVariantManager';
import { showToast } from './utils/toast';

interface DragDropMaterialHandlerProps {
  scene: BABYLON.Scene;
  canvas: HTMLCanvasElement;
  onMaterialApplied: (mesh: BABYLON.Mesh, material: BABYLON.Material) => void;
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|bmp|gif|tga|hdr|env|ktx2?)$/i;

export const DragDropMaterialHandler: React.FC<DragDropMaterialHandlerProps> = ({
  scene,
  canvas,
  onMaterialApplied
}) => {
  const draggedMaterialRef = useRef<BABYLON.Material | null>(null);
  const highlightLayerRef = useRef<BABYLON.HighlightLayer | null>(null);
  // Blob URLs created from externally-dropped texture files, revoked on unmount.
  const createdBlobUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!scene || !canvas) return;

    // Create highlight layer for visual feedback
    const highlightLayer = new BABYLON.HighlightLayer("dragDropHighlight", scene);
    highlightLayer.innerGlow = false;
    highlightLayer.outerGlow = true;
    highlightLayerRef.current = highlightLayer;

    // Build a material from an externally-dropped image file and apply it to a mesh.
    const applyExternalTextureFile = (file: File, targetMesh: BABYLON.Mesh) => {
      if (!file.type.startsWith('image/') && !IMAGE_EXTENSIONS.test(file.name)) {
        showToast.error(`Can't use ${file.name} as a material`, 'Drop an image file (PNG, JPG, WEBP, etc.)');
        return;
      }
      const url = URL.createObjectURL(file);
      createdBlobUrlsRef.current.add(url);
      const material = new BABYLON.StandardMaterial(`${file.name.replace(/\.[^.]+$/, '')}_material`, scene);
      const texture = new BABYLON.Texture(url, scene, undefined, undefined, undefined, undefined, (message) => {
        showToast.error(`Failed to load texture: ${file.name}`, message);
      });
      material.diffuseTexture = texture;
      targetMesh.material = material;
      onMaterialApplied(targetMesh, material);
      showToast.success(`Material created from ${file.name}`, `Applied to ${targetMesh.name}`);
    };

    // Handle drag over canvas
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
    };

    // Handle drop on canvas
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      canvas.style.border = '';

      const externalFiles = event.dataTransfer?.files;
      const hasExternalFiles = externalFiles && externalFiles.length > 0;

      if (!hasExternalFiles && !draggedMaterialRef.current) return;

      // Get pick info at drop location
      const pickInfo = scene.pick(
        event.offsetX,
        event.offsetY,
        (mesh) => mesh instanceof BABYLON.Mesh && mesh.isPickable
      );

      if (!pickInfo.hit || !pickInfo.pickedMesh) {
        if (hasExternalFiles) {
          showToast.info('Drop the image directly onto a model', 'No mesh found at that position');
        }
        draggedMaterialRef.current = null;
        return;
      }

      const targetMesh = pickInfo.pickedMesh as BABYLON.Mesh;

      if (hasExternalFiles) {
        // A real file from the user's desktop/file manager - build a new material from it.
        applyExternalTextureFile(externalFiles[0], targetMesh);
      } else if (draggedMaterialRef.current) {
        // An existing in-app material (dragged from the material library panel).
        targetMesh.material = draggedMaterialRef.current;
        onMaterialApplied(targetMesh, draggedMaterialRef.current);
        console.log(`Material applied to ${targetMesh.name}`);
      }

      highlightLayer.removeAllMeshes();
      draggedMaterialRef.current = null;
    };

    // Handle drag enter/leave for visual feedback
    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      canvas.style.border = '2px solid #3b82f6';
    };

    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault();
      canvas.style.border = '';
    };

    // Add event listeners
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    canvas.addEventListener('dragenter', handleDragEnter);
    canvas.addEventListener('dragleave', handleDragLeave);

    // Listen for custom drag start events from MaterialVariantManager
    const handleMaterialDragStart = (event: CustomEvent) => {
      draggedMaterialRef.current = event.detail.material;
    };

    window.addEventListener('materialDragStart', handleMaterialDragStart as EventListener);

    // Mouse move for highlight feedback
    const handleMouseMove = (event: MouseEvent) => {
      if (!draggedMaterialRef.current) return;

      const pickInfo = scene.pick(
        event.offsetX,
        event.offsetY,
        (mesh) => mesh instanceof BABYLON.Mesh && mesh.isPickable
      );

      // Clear previous highlights
      highlightLayer.removeAllMeshes();

      if (pickInfo.hit && pickInfo.pickedMesh) {
        // Highlight the mesh under cursor
        highlightLayer.addMesh(pickInfo.pickedMesh as BABYLON.Mesh, BABYLON.Color3.Blue());
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
      canvas.removeEventListener('dragenter', handleDragEnter);
      canvas.removeEventListener('dragleave', handleDragLeave);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('materialDragStart', handleMaterialDragStart as EventListener);

      if (highlightLayerRef.current) {
        highlightLayerRef.current.dispose();
      }
      createdBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      createdBlobUrlsRef.current.clear();
    };
  }, [scene, canvas, onMaterialApplied]);

  return null; // This component doesn't render anything
};
