import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';

interface CameraView {
  id: string;
  name: string;
  icon: string;
  description: string;
  position: BABYLON.Vector3;
  target: BABYLON.Vector3;
  alpha?: number; // For ArcRotateCamera
  beta?: number;  // For ArcRotateCamera
  radius?: number; // For ArcRotateCamera
}

interface CameraViewsProps {
  camera: BABYLON.Camera;
  scene: BABYLON.Scene;
  onViewChange?: (view: CameraView) => void;
}

const CameraViews: React.FC<CameraViewsProps> = ({ camera, scene, onViewChange }) => {
  const [selectedView, setSelectedView] = useState<string>('top');
  const [customPosition, setCustomPosition] = useState<BABYLON.Vector3>(new BABYLON.Vector3(0, 5, -10));
  const [customTarget, setCustomTarget] = useState<BABYLON.Vector3>(new BABYLON.Vector3(0, 0, 0));

  // Compute the real bounds of whatever is actually loaded (excluding helper/tool
  // geometry), so the preset views frame the real model regardless of its scale or
  // position - a fixed radius/target only ever worked for one specific model size.
  const getModelBounds = (): { center: BABYLON.Vector3; radius: number; height: number } => {
    const realMeshes = scene.meshes.filter((m) =>
      m.isEnabled() && m.getTotalVertices() > 0 &&
      !/^(ground|measure_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|__root__)/i.test(m.name || '')
    );
    if (realMeshes.length === 0) {
      return { center: new BABYLON.Vector3(0, 0, 0), radius: 15, height: 10 };
    }
    let min = realMeshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = realMeshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
    realMeshes.forEach((m) => {
      const bb = m.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
    });
    const center = min.add(max).scale(0.5);
    const size = max.subtract(min);
    const radius = Math.max(size.x, size.y, size.z, 2) * 1.4; // comfortable framing distance
    return { center, radius, height: Math.max(size.y, 2) };
  };

  const { center, radius, height } = getModelBounds();
  const midY = center.y + height / 2;

  const views: CameraView[] = [
    {
      id: 'top',
      name: 'Top',
      icon: '⬆️',
      description: 'Top-down view',
      position: new BABYLON.Vector3(center.x, center.y + radius * 1.5, center.z),
      target: center,
      alpha: 0,
      beta: 0.01,
      radius: radius * 1.5
    },
    {
      id: 'front',
      name: 'Front',
      icon: '⬜',
      description: 'Front elevation view',
      position: new BABYLON.Vector3(center.x, midY, center.z - radius),
      target: new BABYLON.Vector3(center.x, midY, center.z),
      alpha: 0,
      beta: Math.PI / 2,
      radius
    },
    {
      id: 'side',
      name: 'Side',
      icon: '➡️',
      description: 'Side elevation view',
      position: new BABYLON.Vector3(center.x + radius, midY, center.z),
      target: new BABYLON.Vector3(center.x, midY, center.z),
      alpha: Math.PI / 2,
      beta: Math.PI / 2,
      radius
    },
    {
      id: 'isometric',
      name: 'Isometric',
      icon: '🔲',
      description: '3D isometric view',
      position: new BABYLON.Vector3(center.x + radius * 0.7, center.y + radius * 0.7, center.z - radius * 0.7),
      target: center,
      alpha: Math.PI / 4,
      beta: Math.PI / 3,
      radius
    },
    {
      id: 'perspective',
      name: 'Perspective',
      icon: '👁️',
      description: 'Natural perspective view',
      position: new BABYLON.Vector3(center.x + radius * 0.4, midY, center.z - radius * 0.9),
      target: new BABYLON.Vector3(center.x, midY, center.z),
      alpha: Math.PI / 6,
      beta: Math.PI / 3,
      radius: radius * 0.9
    },
    {
      id: 'aerial',
      name: 'Aerial',
      icon: '🚁',
      description: 'Bird\'s eye view',
      position: new BABYLON.Vector3(center.x, center.y + radius * 2, center.z + radius * 0.3),
      target: center,
      alpha: 0,
      beta: Math.PI / 6,
      radius: radius * 2
    }
  ];

  const applyView = (view: CameraView) => {
    setSelectedView(view.id);

    if (camera instanceof BABYLON.ArcRotateCamera) {
      // For ArcRotateCamera
      camera.alpha = view.alpha || 0;
      camera.beta = view.beta || Math.PI / 2;
      camera.radius = view.radius || 10;
      camera.target = view.target;
    } else if (camera instanceof BABYLON.FreeCamera) {
      // For FreeCamera
      camera.position = view.position;
      camera.setTarget(view.target);
    } else {
      // Generic camera
      camera.position = view.position;
      // For other camera types, we can't directly set target
      // This would need to be handled based on the specific camera type
    }

    onViewChange?.(view);
  };

  const applyCustomView = () => {
    if (camera instanceof BABYLON.ArcRotateCamera) {
      camera.target = customTarget;
      camera.alpha = Math.atan2(customPosition.z - customTarget.z, customPosition.x - customTarget.x);
      camera.beta = Math.acos((customPosition.y - customTarget.y) / BABYLON.Vector3.Distance(customPosition, customTarget));
      camera.radius = BABYLON.Vector3.Distance(customPosition, customTarget);
    } else {
      camera.position = customPosition;
      // For other camera types, target setting would need to be handled differently
      // This is primarily designed for ArcRotateCamera
    }
  };

  const saveCurrentView = () => {
    const viewId = `custom_${Date.now()}`;
    const currentView: CameraView = {
      id: viewId,
      name: 'Saved View',
      icon: '💾',
      description: 'Custom saved view',
      position: camera.position.clone(),
      target: camera instanceof BABYLON.ArcRotateCamera ? camera.target.clone() : new BABYLON.Vector3(0, 0, 0),
      alpha: camera instanceof BABYLON.ArcRotateCamera ? camera.alpha : undefined,
      beta: camera instanceof BABYLON.ArcRotateCamera ? camera.beta : undefined,
      radius: camera instanceof BABYLON.ArcRotateCamera ? camera.radius : undefined
    };

    // Add to views array (in a real app, this would be saved to localStorage or a database)
    views.push(currentView);
    setSelectedView(viewId);
  };

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Camera Views</h3>

      {/* Preset Views */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => applyView(view)}
            style={{
              padding: '12px',
              background: selectedView === view.id ? '#3b82f6' : '#334155',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#f1f5f9',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              fontSize: '14px'
            }}
            title={view.description}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{view.icon}</div>
            <div style={{ fontWeight: 'bold' }}>{view.name}</div>
          </button>
        ))}
      </div>

      {/* Custom Controls */}
      <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Custom Position</h4>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            Camera X: {customPosition.x.toFixed(1)}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={customPosition.x}
            onChange={(e) => setCustomPosition(new BABYLON.Vector3(parseFloat(e.target.value), customPosition.y, customPosition.z))}
            style={{ width: '100%' }}
            title="Camera X position"
            aria-label="Camera X position slider"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            Camera Y: {customPosition.y.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={customPosition.y}
            onChange={(e) => setCustomPosition(new BABYLON.Vector3(customPosition.x, parseFloat(e.target.value), customPosition.z))}
            style={{ width: '100%' }}
            title="Camera Y position"
            aria-label="Camera Y position slider"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            Camera Z: {customPosition.z.toFixed(1)}
          </label>
          <input
            type="range"
            min="-50"
            max="50"
            step="1"
            value={customPosition.z}
            onChange={(e) => setCustomPosition(new BABYLON.Vector3(customPosition.x, customPosition.y, parseFloat(e.target.value)))}
            style={{ width: '100%' }}
            title="Camera Z position"
            aria-label="Camera Z position slider"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            Target X: {customTarget.x.toFixed(1)}
          </label>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            value={customTarget.x}
            onChange={(e) => setCustomTarget(new BABYLON.Vector3(parseFloat(e.target.value), customTarget.y, customTarget.z))}
            style={{ width: '100%' }}
            title="Target X position"
            aria-label="Target X position slider"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            Target Y: {customTarget.y.toFixed(1)}
          </label>
          <input
            type="range"
            min="-10"
            max="20"
            step="0.5"
            value={customTarget.y}
            onChange={(e) => setCustomTarget(new BABYLON.Vector3(customTarget.x, parseFloat(e.target.value), customTarget.z))}
            style={{ width: '100%' }}
            title="Target Y position"
            aria-label="Target Y position slider"
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
            Target Z: {customTarget.z.toFixed(1)}
          </label>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            value={customTarget.z}
            onChange={(e) => setCustomTarget(new BABYLON.Vector3(customTarget.x, customTarget.y, parseFloat(e.target.value)))}
            style={{ width: '100%' }}
            title="Target Z position"
            aria-label="Target Z position slider"
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={applyCustomView}
            style={{
              flex: 1,
              padding: '8px',
              background: '#10b981',
              border: '1px solid #34d399',
              borderRadius: '4px',
              color: '#f1f5f9',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Apply Custom
          </button>
          <button
            onClick={saveCurrentView}
            style={{
              flex: 1,
              padding: '8px',
              background: '#8b5cf6',
              border: '1px solid #a78bfa',
              borderRadius: '4px',
              color: '#f1f5f9',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Save Current
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraViews;
