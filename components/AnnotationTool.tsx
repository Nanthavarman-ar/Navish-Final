import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, MeshBuilder, StandardMaterial, DynamicTexture, Color3, Vector3, PointerEventTypes, ArcRotateCamera, Animation } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, TextBlock } from '@babylonjs/gui';
import { X, MapPin, Trash2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { supabase, projectId } from '../supabase/client';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';

interface AnnotationToolProps {
  scene: Scene;
  roomId: string;
  onClose: () => void;
  // Whether the panel itself is showing - the pin markers below stay in the 3D scene and
  // keep loading/syncing regardless (see the root element's visibility toggle at the bottom
  // of this file), so closing the panel no longer makes every note marker vanish from the
  // model. Defaults true so callers that don't pass this (tests, older call sites) keep the
  // previous always-visible-while-mounted behavior.
  visible?: boolean;
}

interface Annotation {
  id: string;
  text: string;
  position: { x: number; y: number; z: number };
  authorName?: string;
  createdAt: string;
}

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

const AnnotationTool: React.FC<AnnotationToolProps> = ({ scene, roomId, onClose, visible = true }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-left');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<Vector3 | null>(null);
  const [draftText, setDraftText] = useState('');
  const pinMeshesRef = useRef<Map<string, Mesh>>(new Map());
  // Which note's text popup is currently shown in the 3D scene (click its pin to open,
  // click again/click elsewhere to close) - separate from the side panel list.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const guiTextureRef = useRef<AdvancedDynamicTexture | null>(null);
  const popupControlRef = useRef<Rectangle | null>(null);

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

    // Add pins for new annotations - a billboarded "note" card (not an abstract cone/pin)
    // so it actually reads as a note at a glance, always facing the camera regardless of
    // view angle. renderingGroupId 1 (after the default opaque group 0) makes it draw on
    // top of nearby glass/transparent surfaces instead of getting lost behind them. Pickable
    // (clicking one opens its text popup, see the click-to-toggle effect below) - the
    // placement click handler explicitly excludes annotation_pin_* meshes from its own pick
    // so placing a new note right next to an existing one still hits the model, not the pin.
    annotations.forEach((annotation) => {
      if (pinMeshesRef.current.has(annotation.id)) return;
      // 0.4 world units (was) is a genuinely small click target at typical architectural
      // scale and camera distance - easy to miss, which read as "clicking the note does
      // nothing" even though the handler itself was working correctly.
      const pin = MeshBuilder.CreatePlane(`annotation_pin_${annotation.id}`, { size: 0.55 }, scene);
      pin.position = new Vector3(annotation.position.x, annotation.position.y + 0.28, annotation.position.z);
      pin.billboardMode = Mesh.BILLBOARDMODE_ALL;
      pin.renderingGroupId = 1;

      const texture = new DynamicTexture(`annotation_tex_${annotation.id}`, { width: 128, height: 128 }, scene, true);
      texture.hasAlpha = true;
      const ctx = texture.getContext() as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 128, 128);
      // Note card with a folded corner
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(12, 8, 104, 112);
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(92, 8);
      ctx.lineTo(116, 32);
      ctx.lineTo(92, 32);
      ctx.closePath();
      ctx.fill();
      // Text lines
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.85)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      [[28, 50, 100, 50], [28, 68, 100, 68], [28, 86, 72, 86]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
      texture.update();

      const mat = new StandardMaterial(`annotation_mat_${annotation.id}`, scene);
      mat.diffuseTexture = texture;
      mat.useAlphaFromDiffuseTexture = true;
      mat.emissiveColor = new Color3(1, 1, 1); // unlit - stays clearly visible/readable regardless of scene lighting
      mat.backFaceCulling = false;
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

  // Click-to-place: when placing mode is active, the next click on a mesh drops a pin there.
  // Excludes annotation_pin_* meshes from the pick so placing a note right next to an
  // existing one still lands on the model surface behind it, not the pin.
  useEffect(() => {
    if (!isPlacing) return;

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => !m.name.startsWith('annotation_pin_'));
      if (pickResult?.hit && pickResult.pickedPoint) {
        setPendingPosition(pickResult.pickedPoint.clone());
        setIsPlacing(false);
      } else {
        showToast.info('Click directly on the model to place a note');
      }
    });

    return () => { scene.onPointerObservable.remove(observer); };
  }, [isPlacing, scene]);

  // Click a pin to open a small readable popup with its text right there in the scene;
  // click it again (or click elsewhere) to close it. Skipped while placing a new note so the
  // same click doesn't both toggle a nearby pin's popup and register as a placement miss.
  useEffect(() => {
    if (isPlacing) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      if (mesh?.name.startsWith('annotation_pin_')) {
        const id = mesh.name.slice('annotation_pin_'.length);
        setOpenNoteId((prev) => (prev === id ? null : id));
      } else {
        setOpenNoteId(null);
      }
    });
    return () => { scene.onPointerObservable.remove(observer); };
  }, [isPlacing, scene]);

  // Creates the shared GUI layer the popup card renders into, once.
  useEffect(() => {
    const texture = AdvancedDynamicTexture.CreateFullscreenUI('annotation_gui', true, scene);
    guiTextureRef.current = texture;
    return () => {
      texture.dispose();
      guiTextureRef.current = null;
    };
  }, [scene]);

  // Shows/hides the actual popup card for whichever note is currently open, linked to its
  // pin mesh so it stays positioned above it in screen space as the camera moves.
  useEffect(() => {
    const texture = guiTextureRef.current;
    if (popupControlRef.current) {
      texture?.removeControl(popupControlRef.current);
      popupControlRef.current.dispose();
      popupControlRef.current = null;
    }
    if (!openNoteId || !texture) return;
    const pin = pinMeshesRef.current.get(openNoteId);
    const annotation = annotations.find((a) => a.id === openNoteId);
    if (!pin || !annotation) return;

    // Dark card + light text, not the pin's bright amber - a near-white/pale-yellow GUI
    // background blooms very strongly under this scene's post-processing (reads as an
    // overexposed glowing pill instead of a readable note), and a dark card is consistent
    // with the rest of this app's panel chrome (gray-900/slate-800) anyway.
    const card = new Rectangle(`annotation_popup_${openNoteId}`);
    card.widthInPixels = 190;
    card.adaptHeightToChildren = true;
    card.cornerRadius = 8;
    card.color = '#d97706';
    card.thickness = 2;
    card.background = '#1c1917';
    card.alpha = 0.96;
    card.paddingTopInPixels = 10;
    card.paddingBottomInPixels = 10;
    card.paddingLeftInPixels = 12;
    card.paddingRightInPixels = 12;
    card.isPointerBlocker = true;
    // Clicking the card itself (not just its pin) also closes it - a natural "tap to
    // dismiss" affordance once you're already looking right at the note.
    card.onPointerClickObservable.add(() => setOpenNoteId(null));

    const text = new TextBlock(`annotation_popup_text_${openNoteId}`, annotation.text);
    text.color = '#fde68a';
    text.fontSize = 14;
    text.textWrapping = true;
    text.resizeToFit = true;
    card.addControl(text);

    card.linkWithMesh(pin);
    card.linkOffsetYInPixels = -70;

    texture.addControl(card);
    popupControlRef.current = card;
  }, [openNoteId, annotations]);

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
      if (!response.ok) {
        // Surface the server's actual reason (e.g. "Access denied" - the backend only lets
        // the original author or an admin delete a note) instead of a generic failure with
        // no explanation of why it didn't work.
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Failed to delete (${response.status})`);
      }
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to delete annotation:', message);
      showToast.error('Failed to delete note', message);
    }
  };

  // Moves the camera to the note's exact saved position, not just repointing target from
  // wherever the camera already happened to be - previously target-only meant a far-zoomed-
  // out camera barely appeared to move at all, reading as "clicking a note does nothing".
  const focusAnnotation = (annotation: Annotation) => {
    const camera = scene.activeCamera;
    if (camera instanceof ArcRotateCamera) {
      const target = new Vector3(annotation.position.x, annotation.position.y, annotation.position.z);
      const targetRadius = Math.min(camera.radius, 6);
      Animation.CreateAndStartAnimation('annotationFocusTarget', camera, 'target', 30, 20, camera.target.clone(), target, Animation.ANIMATIONLOOPMODE_CONSTANT);
      Animation.CreateAndStartAnimation('annotationFocusRadius', camera, 'radius', 30, 20, camera.radius, targetRadius, Animation.ANIMATIONLOOPMODE_CONSTANT);
    }
    // Also opens the note's popup, same as clicking its pin directly - jumping to a note
    // from the list should let you actually read it, not just point the camera near it.
    setOpenNoteId(annotation.id);
  };

  return (
    <div ref={panelRef} style={panelStyle} className={`fixed left-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex-col max-h-[70vh] ${visible ? 'flex' : 'hidden'}`}>
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
