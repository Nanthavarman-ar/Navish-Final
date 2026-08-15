import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import CloudAnchorManager from '../utils/CloudAnchorManager';
import { captureGPSCoordinates } from '../utils/GPSTransformUtils';

interface ARCloudAnchorsProps {
  scene: BABYLON.Scene;
  cloudAnchorManager: CloudAnchorManager;
  onClose?: () => void;
}

const ARCloudAnchors: React.FC<ARCloudAnchorsProps> = ({ scene, cloudAnchorManager, onClose }) => {
  const [anchors, setAnchors] = useState<string[]>([]);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    // Load existing anchors from cloud
    cloudAnchorManager.loadAnchors().then(existingAnchors => {
      setAnchors(existingAnchors);
    });

    // Capture GPS coordinates
    captureGPSCoordinates().then(coords => {
      setGpsCoords(coords);
    }).catch(() => {
      setGpsCoords(null);
    });
  }, [cloudAnchorManager]);

  const placeAnchor = () => {
    if (!scene) return;
    // For demo, place anchor at origin or some fixed point
    const position = new BABYLON.Vector3(0, 0, 0);
    cloudAnchorManager.createAnchor(position).then(anchorId => {
      setAnchors(prev => [...prev, anchorId]);
    });
  };

  const removeAnchor = (anchorId: string) => {
    cloudAnchorManager.removeAnchor(anchorId).then(() => {
      setAnchors(prev => prev.filter(id => id !== anchorId));
    });
  };

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-gray-900 text-white p-4 z-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-pink-400">🌐 AR Cloud Anchors</h2>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          ✕
        </button>
      </div>

      <div className="mb-4">
        <button
          onClick={placeAnchor}
          className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded text-sm"
        >
          Place Anchor
        </button>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">Anchors</h3>
        {anchors.length === 0 ? (
          <div className="text-xs text-gray-400">No anchors placed yet.</div>
        ) : (
          <ul className="list-disc list-inside text-xs">
            {anchors.map(anchorId => (
              <li key={anchorId} className="flex justify-between items-center">
                <span>{anchorId}</span>
                <button
                  onClick={() => removeAnchor(anchorId)}
                  className="text-red-400 hover:text-red-600 text-xs px-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">GPS Coordinates</h3>
        {gpsCoords ? (
          <div className="text-xs text-gray-300">
            Latitude: {gpsCoords.latitude.toFixed(6)} <br />
            Longitude: {gpsCoords.longitude.toFixed(6)}
          </div>
        ) : (
          <div className="text-xs text-gray-500">GPS coordinates not available.</div>
        )}
      </div>
    </div>
  );
};

export default ARCloudAnchors;
