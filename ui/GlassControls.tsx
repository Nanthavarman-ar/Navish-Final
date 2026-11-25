import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, DoorOpen, Glasses, Layers, RotateCcw, Ruler, Smartphone } from 'lucide-react';

export interface GlassControlsProps {
  hasFloors: boolean;
  interior: boolean;
  unit: 'm2' | 'ft2';
  floorsOpen: boolean;
  onFloors: () => void;
  onToggleInterior: () => void;
  onReset: () => void;
  onVR: () => void;
  onAR: () => void;
  onToggleUnit: () => void;
  /** Keep the dock open (e.g. while a panel or the 360 viewer is open). */
  pinned?: boolean;
}

const AUTO_HIDE_MS = 3000;

/**
 * Transparent glass control dock. Slides in from the right edge (tap the edge tab or swipe
 * in from the edge) and tucks itself away after 3 seconds without use.
 */
export function GlassControls(p: GlassControlsProps) {
  const [open, setOpen] = useState(false);
  const [xr, setXr] = useState<{ vr: boolean; ar: boolean }>({ vr: false, ar: false });
  const timer = useRef<number | undefined>(undefined);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  }, []);
  const show = useCallback(() => { setOpen(true); arm(); }, [arm]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (p.pinned) window.clearTimeout(timer.current); else if (open) arm(); }, [p.pinned, open, arm]);

  useEffect(() => {
    const nav = navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } };
    if (!nav.xr) return;
    let alive = true;
    const check = (m: string) => nav.xr!.isSessionSupported(m).catch(() => false);
    Promise.all([check('immersive-vr'), check('immersive-ar')]).then(([vr, ar]) => alive && setXr({ vr, ar }));
    return () => { alive = false; };
  }, []);

  const act = (fn: () => void) => () => { fn(); arm(); };

  return (
    <>
      {/* Invisible strip on the right edge: swipe left from it to open. */}
      <div
        className="pr-edge-zone"
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => {
          const s = swipe.current;
          if (s && s.x - e.clientX > 28 && Math.abs(e.clientY - s.y) < 60) { swipe.current = null; show(); }
        }}
        onPointerUp={() => { swipe.current = null; }}
        onPointerCancel={() => { swipe.current = null; }}
      />
      <button type="button" className={`pr-edge pr-glass ${open ? 'is-hidden' : ''}`} onClick={show} aria-label="Show controls" />

      <div
        className={`pr-dock pr-glass ${open || p.pinned ? 'is-open' : ''}`}
        role="toolbar"
        aria-label="Presentation controls"
        onPointerMove={arm}
        onPointerDown={arm}
        onTouchMove={arm}
      >
        {p.hasFloors && (
          <button type="button" className={`pr-btn ${p.floorsOpen ? 'is-on' : ''}`} onClick={act(p.onFloors)} aria-pressed={p.floorsOpen} title="Floors">
            <Layers /><span className="pr-label">Floors</span>
          </button>
        )}
        <button type="button" className={`pr-btn ${p.interior ? 'is-on' : ''}`} onClick={act(p.onToggleInterior)} aria-pressed={p.interior} title={p.interior ? 'Interior' : 'Exterior'}>
          {p.interior ? <DoorOpen /> : <Building2 />}<span className="pr-label">{p.interior ? 'Interior' : 'Exterior'}</span>
        </button>
        <button type="button" className="pr-btn" onClick={act(p.onReset)} title="Reset view">
          <RotateCcw /><span className="pr-label">Reset view</span>
        </button>
        <button type="button" className="pr-btn" onClick={act(p.onVR)} disabled={!xr.vr} title={xr.vr ? 'Enter VR' : 'VR is not available on this device'}>
          <Glasses /><span className="pr-label">VR</span>
        </button>
        <button type="button" className="pr-btn" onClick={act(p.onAR)} disabled={!xr.ar} title={xr.ar ? 'View in AR' : 'AR is not available on this device'}>
          <Smartphone /><span className="pr-label">AR</span>
        </button>
        <button type="button" className="pr-btn" onClick={act(p.onToggleUnit)} title="Switch units">
          <Ruler /><span className="pr-label">{p.unit === 'm2' ? 'm² → ft²' : 'ft² → m²'}</span>
        </button>
      </div>
    </>
  );
}
