import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { MaterialManager } from './MaterialManager';
import { SyncManager } from './SyncManager';

interface MaterialManagerWrapperProps {
  scene: BABYLON.Scene;
  socket: any;
  userId: string;
}

const MaterialManagerWrapper: React.FC<MaterialManagerWrapperProps> = ({ scene, socket, userId }) => {
  const materialManagerRef = useRef<MaterialManager | null>(null);
  const syncManagerRef = useRef<SyncManager | null>(null);

  useEffect(() => {
    try {
      // Initialize sync manager with required parameters
      syncManagerRef.current = new SyncManager(socket, scene, userId);

      // Initialize material manager with scene and sync manager
      materialManagerRef.current = new MaterialManager(scene, syncManagerRef.current);

      console.log('MaterialManager initialized successfully');
    } catch (error) {
      console.error('Error initializing MaterialManager:', error);
    }

    return () => {
      if (materialManagerRef.current) {
        materialManagerRef.current.dispose();
      }
      if (syncManagerRef.current) {
        syncManagerRef.current.dispose();
      }
    };
  }, [scene, socket, userId]);

  return (
    <div className="absolute top-15 right-2.5 w-80 bg-black bg-opacity-90 rounded-lg p-4 text-white text-xs z-[1000]">
      <h3 className="m-0 mb-4 text-blue-500">🧱 Material Manager</h3>
      <p>Advanced material management system initialized.</p>
      <p>Material presets and properties available.</p>
    </div>
  );
};

export default MaterialManagerWrapper;
