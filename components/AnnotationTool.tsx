import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, PointerEventTypes, ArcRotateCamera } from '@babylonjs/core';
import { X, MapPin, Trash2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { supabase, projectId } from '../supabase/client';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';

interface AnnotationToolProps {
  scene: Scene;
  roomId: string;
  onClose: () => void;
}

interface Annotation {
  id: string;
  text: string;
  position: { x: number; y: number; z: number };
  authorName?: string;
  createdAt: string;
}

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

const AnnotationTool: React.FC<AnnotationToolProps> = ({ scene, roomId, onClose }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<Vector3 | null>(null);
  const [draftText, setDraftText] = useState('');
  const pinMeshesRef = useRef<Map<string, Mesh>>(new Map());

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  // Load existing annotations for this workspace
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${functionsBaseUrl}/api/annotations/${encodeURIComponent(roomId)}`, { headers });
        if (!response.ok) throw new Error(`Failed to load annotations (${response.status})`);
        const data = await response.json();
        if (!cancelled) setAnnotations(data.annotations || []);
      } catch (error) {
        console.error('Failed to load annotations:', error);
        if (!cancelled) showToast.error('Could not load annotations');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [roomId, getAuthHeaders]);

  // Render/sync pin meshes in the 3D scene whenever the annotation list changes
  useEffect(() => {
    const currentIds = new Set(annotations.map(a => a.id));

    // Remove pins for annotations that no longer exist
    pinMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        mesh.dispose();
        pinMeshesRef.current.delete(id);
      }
    });

    // Add pins for new annotations
    annotations.forEach((annotation) => {
      if (pinMeshesRef.current.has(annotation.id)) return;
      const pin = MeshBuilder.CreateCylinder(`annotation_pin_${annotation.id}`, {
        height: 0.3, diameterTop: 0, diameterBottom: 0.12
      }, scene);
      pin.position = new Vector3(annotation.position.x, annotation.position.y + 0.15, annotation.position.z);
      pin.rotation.x = Math.PI; // point downward at the surface
      const mat = new StandardMaterial(`annotation_mat_${annotation.id}`, scene);
      mat.diffuseColor = new Color3(0.96, 0.62, 0.04); // amber - matches the app's signal accent
      mat.emissiveColor = new Color3(0.4, 0.25, 0);
      pin.material = mat;
      pinMeshesRef.current.set(annotation.id, pin);
    });

    return () => {
      // Full cleanup only on unmount (handled by the dedicated unmount effect below)
    };
  }, [annotations, scene]);

  // Dispose all pins on unmount
  useEffect(() => {
    return () => {
      pinMeshesRef.current.forEach((mesh) => mesh.dispose());
      pinMeshesRef.current.clear();
    };
  }, []);

  // Click-to-place: when placing mode is active, the next click on a mesh drops a pin there
  useEffect(() => {
    if (!isPlacing) return;

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (pickResult?.hit && pickResult.pickedPoint) {
        setPendingPosition(pickResult.pickedPoint.clone());
        setIsPlacing(false);
      } else {
        showToast.info('Click directly on the model to place a note');
      }
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [isPlacing, scene]);

  const handleSaveAnnotation = async () => {
    if (!pendingPosition || !draftText.trim()) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${functionsBaseUrl}/api/annotations/${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: draftText.trim(),
          position: { x: pendingPosition.x, y: pendingPosition.y, z: pendingPosition.z },
        }),
      });
      if (!response.ok) throw new Error(`Failed to save annotation (${response.status})`);
      const data = await response.json();
      setAnnotations((prev) => [...prev, data.annotation]);
      showToast.success('Note added');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to save annotation:', message);
      showToast.error('Failed to save note', message);
    } finally {
      setPendingPosition(null);
      setDraftText('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${functionsBaseUrl}/api/annotations/${encodeURIComponent(roomId)}/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error(`Failed to delete (${response.status})`);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      showToast.error('Failed to delete note');
    }
  };

  const focusAnnotation = (annotation: Annotation) => {
    const camera = scene.activeCamera;
    if (camera instanceof ArcRotateCamera) {
      camera.setTarget(new Vector3(annotation.position.x, annotation.position.y, annotation.position.z));
    }
  };

  return (
    <div ref={panelRef} style={panelStyle} className="fixed left-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400" />
          <h3 className="font-display font-semibold">Annotations</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close annotations">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-gray-700 shrink-0">
        {!isPlacing && !pendingPosition && (
          <Button size="sm" className="w-full" onClick={() => setIsPlacing(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add note
          </Button>
        )}
        {isPlacing && (
          <div className="text-xs text-amber-300 text-center py-1.5 bg-amber-500/10 border border-amber-500/30 rounded">
            Click anywhere on the model to place your note...
          </div>
        )}
        {pendingPosition && (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="What do you want to note here?"
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={!draftText.trim()} onClick={handleSaveAnnotation}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setPendingPosition(null); setDraftText(''); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full" />
            Loading notes...
          </div>
        )}
        {!isLoading && annotations.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">
            No notes yet. Click "Add note" and pick a spot on the model.
          </div>
        )}
        {!isLoading && annotations.map((a) => (
          <div key={a.id} className="p-2.5 bg-slate-800/50 border border-slate-700/80 rounded-lg group">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => focusAnnotation(a)} className="text-left flex-1 text-sm text-gray-100 hover:text-cyan-300 transition-colors">
                {a.text}
              </button>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                aria-label="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {a.authorName && (
              <div className="text-[10px] text-gray-500 mt-1 font-technical">{a.authorName}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnotationTool;
