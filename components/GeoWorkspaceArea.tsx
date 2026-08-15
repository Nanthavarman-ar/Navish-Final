import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GeoSyncManager, GeoLocation } from './GeoSyncManager';

interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface GeoWorkspaceArea {
  id: string;
  name: string;
  center: GeoLocation;
  bounds: GeoBounds;
  area: number;
  elevation: number;
}

interface GeoWorkspaceAreaProps {
  scene: BABYLON.Scene;
  geoSyncManager: GeoSyncManager;
  onWorkspaceCreated?: (workspace: GeoWorkspaceArea) => void;
  onWorkspaceSelected?: (workspace: GeoWorkspaceArea | null) => void;
}

const GeoWorkspaceArea: React.FC<GeoWorkspaceAreaProps> = ({
  scene,
  geoSyncManager,
  onWorkspaceCreated,
  onWorkspaceSelected
}) => {
  const [workspaces, setWorkspaces] = useState<GeoWorkspaceArea[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<GeoWorkspaceArea | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<'name' | 'bounds' | 'confirm'>('name');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [boundsInput, setBoundsInput] = useState<GeoBounds>({
    north: 0,
    south: 0,
    east: 0,
    west: 0
  });
  const [elevation, setElevation] = useState(0);
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState('');

  // Update workspaces list when manager changes
  useEffect(() => {
    const updateWorkspaces = () => {
      setWorkspaces(geoSyncManager.getWorkspaces());
    };

    updateWorkspaces();
    // In a real implementation, you'd subscribe to manager changes
  }, [geoSyncManager]);

  const startWorkspaceCreation = () => {
    setIsCreating(true);
    setCreationStep('name');
    setNewWorkspaceName('');
    setBoundsInput({ north: 0, south: 0, east: 0, west: 0 });
    setElevation(0);
  };

  const cancelWorkspaceCreation = () => {
    setIsCreating(false);
    setCreationStep('name');
  };

  const nextCreationStep = () => {
    if (creationStep === 'name' && newWorkspaceName.trim()) {
      setCreationStep('bounds');
    } else if (creationStep === 'bounds') {
      setCreationStep('confirm');
    }
  };

  const previousCreationStep = () => {
    if (creationStep === 'bounds') {
      setCreationStep('name');
    } else if (creationStep === 'confirm') {
      setCreationStep('bounds');
    }
  };

  const createWorkspace = () => {
    if (!newWorkspaceName.trim()) return;

    const workspace = geoSyncManager.createWorkspaceArea(
      newWorkspaceName,
      boundsInput,
      elevation
    );

    setWorkspaces(prev => [...prev, workspace]);
    setIsCreating(false);
    setSelectedWorkspace(workspace);
    onWorkspaceCreated?.(workspace);
    onWorkspaceSelected?.(workspace);
  };

  const selectWorkspace = (workspace: GeoWorkspaceArea | null) => {
    setSelectedWorkspace(workspace);
    onWorkspaceSelected?.(workspace);
  };

  const deleteWorkspace = (workspaceId: string) => {
    geoSyncManager.removeWorkspace(workspaceId);
    setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
    if (selectedWorkspace?.id === workspaceId) {
      setSelectedWorkspace(null);
      onWorkspaceSelected?.(null);
    }
  };

  const addMapOverlay = () => {
    if (selectedWorkspace && mapImageUrl.trim()) {
      geoSyncManager.addMapOverlay(selectedWorkspace.id, mapImageUrl);
      setShowMapOverlay(false);
      setMapImageUrl('');
    }
  };

  const calculateArea = (bounds: GeoBounds): number => {
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    const centerLat = (bounds.north + bounds.south) / 2;
    return latDiff * lngDiff * 111000 * 111000 * Math.cos(centerLat * Math.PI / 180);
  };

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Workspace Areas</h3>

      {/* Workspace List */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: '0', fontSize: '14px' }}>Existing Workspaces</h4>
          <button
            onClick={startWorkspaceCreation}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Create New
          </button>
        </div>

        {workspaces.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>
            No workspaces created yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {workspaces.map(workspace => (
              <div
                key={workspace.id}
                style={{
                  padding: '12px',
                  background: selectedWorkspace?.id === workspace.id ? '#334155' : '#0f172a',
                  border: selectedWorkspace?.id === workspace.id ? '1px solid #3b82f6' : '1px solid #334155',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => selectWorkspace(workspace)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{workspace.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Center: {workspace.center.latitude.toFixed(4)}, {workspace.center.longitude.toFixed(4)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Area: {(workspace.area / 1000000).toFixed(2)} km²
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkspace(workspace.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Creation Modal */}
      {isCreating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              Create New Workspace
            </h3>

            {/* Step 1: Name */}
            {creationStep === 'name' && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name"
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}
                />
              </div>
            )}

            {/* Step 2: Bounds */}
            {creationStep === 'bounds' && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  Geographic Bounds
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>North</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={boundsInput.north}
                      onChange={(e) => setBoundsInput((prev: GeoBounds) => ({ ...prev, north: parseFloat(e.target.value) || 0 }))}
                      placeholder="Latitude"
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: '#334155',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        color: '#f1f5f9',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>South</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={boundsInput.south}
                      onChange={(e) => setBoundsInput((prev: GeoBounds) => ({ ...prev, south: parseFloat(e.target.value) || 0 }))}
                      placeholder="Latitude"
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: '#334155',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        color: '#f1f5f9',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>East</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={boundsInput.east}
                      onChange={(e) => setBoundsInput((prev: GeoBounds) => ({ ...prev, east: parseFloat(e.target.value) || 0 }))}
                      placeholder="Longitude"
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: '#334155',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        color: '#f1f5f9',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>West</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={boundsInput.west}
                      onChange={(e) => setBoundsInput((prev: GeoBounds) => ({ ...prev, west: parseFloat(e.target.value) || 0 }))}
                      placeholder="Longitude"
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: '#334155',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        color: '#f1f5f9',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Elevation (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={elevation}
                    onChange={(e) => setElevation(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: '#334155',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      color: '#f1f5f9',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {creationStep === 'confirm' && (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Confirm Workspace Details</h4>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                  <div><strong>Name:</strong> {newWorkspaceName}</div>
                  <div><strong>Bounds:</strong> {boundsInput.north.toFixed(4)}N, {boundsInput.south.toFixed(4)}S, {boundsInput.east.toFixed(4)}E, {boundsInput.west.toFixed(4)}W</div>
                  <div><strong>Elevation:</strong> {elevation}m</div>
                  <div><strong>Area:</strong> {(calculateArea(boundsInput) / 1000000).toFixed(2)} km²</div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <button
                onClick={cancelWorkspaceCreation}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {creationStep !== 'name' && (
                  <button
                    onClick={previousCreationStep}
                    style={{
                      padding: '8px 16px',
                      background: '#6b7280',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                )}

                {creationStep === 'confirm' ? (
                  <button
                    onClick={createWorkspace}
                    disabled={!newWorkspaceName.trim()}
                    style={{
                      padding: '8px 16px',
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: '12px',
                      cursor: newWorkspaceName.trim() ? 'pointer' : 'not-allowed',
                      opacity: newWorkspaceName.trim() ? 1 : 0.6
                    }}
                  >
                    Create
                  </button>
                ) : (
                  <button
                    onClick={nextCreationStep}
                    disabled={creationStep === 'name' && !newWorkspaceName.trim()}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                      fontSize: '12px',
                      cursor: (creationStep === 'name' && !newWorkspaceName.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (creationStep === 'name' && !newWorkspaceName.trim()) ? 0.6 : 1
                    }}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Workspace Details */}
      {selectedWorkspace && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
            Workspace: {selectedWorkspace.name}
          </h4>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
            <div><strong>Center:</strong> {selectedWorkspace.center.latitude.toFixed(6)}, {selectedWorkspace.center.longitude.toFixed(6)}</div>
            <div><strong>Bounds:</strong> {selectedWorkspace.bounds.north.toFixed(4)}N to {selectedWorkspace.bounds.south.toFixed(4)}S, {selectedWorkspace.bounds.west.toFixed(4)}W to {selectedWorkspace.bounds.east.toFixed(4)}E</div>
            <div><strong>Area:</strong> {(selectedWorkspace.area / 1000000).toFixed(2)} km²</div>
            <div><strong>Elevation:</strong> {selectedWorkspace.elevation}m</div>
          </div>

          {/* Map Overlay */}
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => setShowMapOverlay(!showMapOverlay)}
              style={{
                padding: '6px 12px',
                background: '#6b7280',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {showMapOverlay ? 'Hide Map Overlay' : 'Add Map Overlay'}
            </button>

            {showMapOverlay && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={mapImageUrl}
                  onChange={(e) => setMapImageUrl(e.target.value)}
                  placeholder="Map image URL"
                  style={{
                    width: '100%',
                    padding: '6px',
                    background: '#334155',
                    border: '1px solid #475569',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                    marginBottom: '8px'
                  }}
                />
                <button
                  onClick={addMapOverlay}
                  disabled={!mapImageUrl.trim()}
                  style={{
                    padding: '6px 12px',
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '12px',
                    cursor: mapImageUrl.trim() ? 'pointer' : 'not-allowed',
                    opacity: mapImageUrl.trim() ? 1 : 0.6
                  }}
                >
                  Apply Overlay
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoWorkspaceArea;
