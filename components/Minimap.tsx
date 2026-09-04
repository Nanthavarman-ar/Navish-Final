import React, { useState, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GeoWorkspaceArea } from './types';
import { showToast } from './utils/toast';

interface SavedPdf {
  id: string;
  name: string;
  previewImage: string; // rendered PNG data URL of the PDF's first page
}

interface MinimapProps {
  scene: BABYLON.Scene;
  camera: BABYLON.Camera;
  workspaces?: GeoWorkspaceArea[];
  selectedWorkspaceId?: string;
  onWorkspaceSelect?: (workspaceId: string) => void;
  onCameraMove?: (position: BABYLON.Vector3) => void;
  // Floor plan PDFs - controlled by the parent (BabylonWorkspace.tsx), which persists them
  // to the per-model backend record alongside mesh edits/Home view. Previously this
  // component owned the list itself via localStorage, which meant plans didn't follow the
  // model to another device and weren't scoped to which model they were uploaded for.
  floorPlans?: SavedPdf[];
  onFloorPlansChange?: (next: SavedPdf[]) => void;
}

// This panel used to also render a live top-down minimap (camera/object/light dots,
// zoom/hide controls, a legend) and a "Teleporter" saved-camera-position list. Both were
// removed at the user's request - only the Floor Plans (PDF) feature stays. scene/camera/
// workspaces/onWorkspaceSelect/onCameraMove are kept in the prop signature so the parent
// (BabylonWorkspace.tsx) doesn't need to change how it renders this component, even
// though nothing in this simplified version reads them anymore.
const Minimap: React.FC<MinimapProps> = ({
  floorPlans = [],
  onFloorPlansChange
}) => {
  // Saved PDFs (floor plans): the list itself is controlled by the parent
  // (floorPlans/onFloorPlansChange props - see MinimapProps) so it persists per-model on
  // the backend and follows the model to any device, not just this browser. Only which
  // one is currently open (showing its preview thumbnail below) is local UI state.
  const savedPdfs = floorPlans;
  const [openPdfId, setOpenPdfId] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showToast.error('Not a PDF file', 'Please choose a .pdf file.');
      return;
    }
    try {
      const [pdfjsLib, workerUrlModule] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.mjs?url')
      ]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise;
      const page = await pdfDocument.getPage(1);
      // Rendered as a small thumbnail, not full resolution - this only ever needs to be
      // legible as a small preview image, not as a readable document.
      const rawViewport = page.getViewport({ scale: 1 });
      const scale = 480 / Math.max(rawViewport.width, rawViewport.height);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create a 2D canvas context to render the PDF page');
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const id = `pdf-${Date.now()}`;
      onFloorPlansChange?.([...savedPdfs, { id, name: file.name, previewImage: canvas.toDataURL('image/png') }]);
      setOpenPdfId(id);
    } catch (error) {
      showToast.error('Could not read PDF file', error instanceof Error ? error.message : undefined);
    }
  };

  const removePdf = (id: string) => {
    onFloorPlansChange?.(savedPdfs.filter(p => p.id !== id));
    setOpenPdfId(prev => (prev === id ? null : prev));
  };

  const openPdf = openPdfId ? savedPdfs.find((p) => p.id === openPdfId) : null;

  return (
    <div className="minimap-container">
      <div className="minimap-header">
        <h3 className="minimap-title">Floor Plans</h3>
      </div>

      <div style={{
        marginTop: '8px',
        padding: '8px',
        background: '#0f172a',
        borderRadius: '6px',
        color: '#f1f5f9'
      }}>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={e => {
            handlePdfUpload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="minimap-button"
          onClick={() => pdfInputRef.current?.click()}
          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginBottom: '8px' }}
        >
          Upload PDF
        </button>
        <div>
          <span style={{ fontSize: '12px' }}>Saved: {savedPdfs.length}</span>
          <ul style={{ maxHeight: '120px', overflowY: 'auto', margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
            {savedPdfs.map((pdf) => (
              <li key={pdf.id} style={{
                background: '#1e293b',
                color: '#f1f5f9',
                padding: '6px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.name}</span>
                <button
                  type="button"
                  style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', borderRadius: '4px', border: 'none', padding: '4px 10px', cursor: 'pointer' }}
                  onClick={() => setOpenPdfId(openPdfId === pdf.id ? null : pdf.id)}
                >
                  {openPdfId === pdf.id ? 'Hide' : 'Open'}
                </button>
                <button
                  type="button"
                  style={{ fontSize: '11px', background: '#64748b', color: '#fff', borderRadius: '4px', border: 'none', padding: '4px 8px', cursor: 'pointer' }}
                  onClick={() => removePdf(pdf.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          {openPdf && (
            <img
              src={openPdf.previewImage}
              alt={openPdf.name}
              style={{ marginTop: '8px', width: '100%', borderRadius: '4px', border: '1px solid #334155' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Minimap;
