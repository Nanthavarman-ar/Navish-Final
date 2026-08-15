import React, { useState, useRef, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';

interface ConstructionOverlayProps {
  scene: BABYLON.Scene;
  onOverlayApplied?: (overlay: BABYLON.Mesh) => void;
}

const ConstructionOverlay: React.FC<ConstructionOverlayProps> = ({ scene, onOverlayApplied }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [opacity, setOpacity] = useState<number>(0.5);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<BABYLON.Vector3>(new BABYLON.Vector3(0, 5, 0));
  const [overlayMesh, setOverlayMesh] = useState<BABYLON.Mesh | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleImages = [
    { id: 'site1', name: 'Construction Site 1', url: '/images/construction-site1.jpg' },
    { id: 'site2', name: 'Construction Site 2', url: '/images/construction-site2.jpg' },
    { id: 'aerial', name: 'Aerial View', url: '/images/aerial-view.jpg' },
    { id: 'street', name: 'Street View', url: '/images/street-view.jpg' }
  ];

  const createOverlayMesh = (imageUrl: string) => {
    // Remove existing overlay
    if (overlayMesh) {
      overlayMesh.dispose();
    }

    // Create a plane for the overlay
    const overlay = BABYLON.MeshBuilder.CreatePlane('constructionOverlay', {
      width: 20 * scale,
      height: 15 * scale
    }, scene);

    overlay.position = position;
    overlay.rotation.y = rotation;

    // Create material with the image
    const material = new BABYLON.StandardMaterial('overlayMaterial', scene);

    // Load texture from URL
    const texture = new BABYLON.Texture(imageUrl, scene);
    material.diffuseTexture = texture;
    material.diffuseTexture.hasAlpha = true;
    material.alpha = opacity;
    material.backFaceCulling = false;

    overlay.material = material;
    setOverlayMesh(overlay);
    onOverlayApplied?.(overlay);

    return overlay;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setSelectedImage(imageUrl);
        createOverlayMesh(imageUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSampleImageSelect = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    createOverlayMesh(imageUrl);
  };

  const updateOverlay = () => {
    if (overlayMesh && selectedImage) {
      overlayMesh.scaling = new BABYLON.Vector3(scale, scale, 1);
      overlayMesh.position = position;
      overlayMesh.rotation.y = rotation;

      if (overlayMesh.material) {
        (overlayMesh.material as BABYLON.StandardMaterial).alpha = opacity;
      }
    }
  };

  useEffect(() => {
    updateOverlay();
  }, [scale, position, rotation, opacity]);

  const removeOverlay = () => {
    if (overlayMesh) {
      overlayMesh.dispose();
      setOverlayMesh(null);
      setSelectedImage(null);
    }
  };

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Construction Overlay</h3>

      {/* Image Selection */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Select Image Source</h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {sampleImages.map((image) => (
            <button
              key={image.id}
              onClick={() => handleSampleImageSelect(image.url)}
              style={{
                padding: '8px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#f1f5f9',
                cursor: 'pointer',
                fontSize: '12px',
                textAlign: 'center'
              }}
              title={`Load ${image.name}`}
            >
              {image.name}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          id="imageUpload"
          aria-label="Upload custom construction site image"
        />
        <label
          htmlFor="imageUpload"
          style={{
            display: 'block',
            width: '100%',
            padding: '8px',
            background: '#8b5cf6',
            border: '1px solid #a78bfa',
            borderRadius: '4px',
            color: '#f1f5f9',
            cursor: 'pointer',
            fontSize: '14px',
            textAlign: 'center'
          }}
        >
          Upload Custom Image
        </label>
      </div>

      {/* Overlay Controls */}
      {selectedImage && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Overlay Controls</h4>

          {/* Opacity */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Opacity: {(opacity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
              title="Adjust overlay opacity"
              aria-label="Overlay opacity slider"
            />
          </div>

          {/* Scale */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Scale: {scale.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{ width: '100%' }}
              title="Adjust overlay scale"
              aria-label="Overlay scale slider"
            />
          </div>

          {/* Rotation */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Rotation: {rotation.toFixed(2)} rad
            </label>
            <input
              type="range"
              min="0"
              max={Math.PI * 2}
              step={Math.PI / 16}
              value={rotation}
              onChange={(e) => setRotation(parseFloat(e.target.value))}
              style={{ width: '100%' }}
              title="Adjust overlay rotation"
              aria-label="Overlay rotation slider"
            />
          </div>

          {/* Position Controls */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Position X: {position.x.toFixed(1)}
            </label>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={position.x}
              onChange={(e) => setPosition(new BABYLON.Vector3(parseFloat(e.target.value), position.y, position.z))}
              style={{ width: '100%' }}
              title="Adjust overlay X position"
              aria-label="Overlay X position slider"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Position Y: {position.y.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={position.y}
              onChange={(e) => setPosition(new BABYLON.Vector3(position.x, parseFloat(e.target.value), position.z))}
              style={{ width: '100%' }}
              title="Adjust overlay Y position"
              aria-label="Overlay Y position slider"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
              Position Z: {position.z.toFixed(1)}
            </label>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={position.z}
              onChange={(e) => setPosition(new BABYLON.Vector3(position.x, position.y, parseFloat(e.target.value)))}
              style={{ width: '100%' }}
              title="Adjust overlay Z position"
              aria-label="Overlay Z position slider"
            />
          </div>

          {/* Control Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={removeOverlay}
              style={{
                flex: 1,
                padding: '8px',
                background: '#dc2626',
                border: '1px solid #ef4444',
                borderRadius: '4px',
                color: '#f1f5f9',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Remove Overlay
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
        Blend real construction site photos with your 3D model for accurate visualization
      </div>
    </div>
  );
};

export default ConstructionOverlay;
