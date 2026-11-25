import React, { useEffect, useRef } from 'react';
import type { Scene } from '@babylonjs/core';
import { Matrix, Vector3 } from '@babylonjs/core';
import type { Building } from '../presentation/sceneModel';
import { formatArea, statusLabel, type Home } from '../data/homesData';

interface Props {
  scene: Scene;
  building: Building;
  homeFor: (id: string) => Home;
  unit: 'm2' | 'ft2';
  /** Pins on levels above this are hidden (set while a floor is sliced). */
  maxLevel: number | null;
  hidden: boolean;
  hoveredId: string | null;
  activeId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
}

/**
 * Numbered pins as DOM elements, projected from each home's 3D position every frame
 * (transform is written straight to the element, so React does not re-render per frame).
 * Desktop: hover shows the small card, click opens the side panel.
 * Touch: first tap shows the card, the card's button opens the panel.
 */
export function PinLayer({ scene, building, homeFor, unit, maxLevel, hidden, hoveredId, activeId, onHover, onOpen }: Props) {
  const wraps = useRef(new Map<string, HTMLDivElement>());
  const lastPointer = useRef<string>('mouse');
  const live = useRef({ maxLevel, hidden });
  live.current = { maxLevel, hidden };

  useEffect(() => {
    const engine = scene.getEngine();
    const tmp = new Vector3();
    const observer = scene.onAfterRenderObservable.add(() => {
      const cam = scene.activeCamera;
      const canvas = engine.getRenderingCanvas();
      if (!cam || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      const viewport = cam.viewport.toGlobal(w, h);
      const transform = scene.getTransformMatrix();
      const { maxLevel: max, hidden: off } = live.current;
      for (const home of building.homes) {
        const el = wraps.current.get(home.id);
        if (!el) continue;
        Vector3.ProjectToRef(home.top, Matrix.IdentityReadOnly, transform, viewport, tmp);
        const visible = !off && tmp.z > 0 && tmp.z < 1 && (max === null || home.level <= max);
        el.style.visibility = visible ? 'visible' : 'hidden';
        if (visible) el.style.transform = `translate3d(${(tmp.x / w) * rect.width}px, ${(tmp.y / h) * rect.height}px, 0)`;
      }
    });
    return () => { scene.onAfterRenderObservable.remove(observer); };
  }, [scene, building]);

  return (
    <div className="pr-pins">
      {building.homes.map((entry, i) => {
        const home = homeFor(entry.id);
        const showCard = hoveredId === entry.id && activeId !== entry.id;
        return (
          <div key={entry.id} className="pr-pin-wrap" ref={(el) => { if (el) wraps.current.set(entry.id, el); else wraps.current.delete(entry.id); }} style={{ visibility: 'hidden' }}>
            <button
              type="button"
              className={`pr-pin ${home.status !== 'available' ? `is-${home.status}` : ''} ${activeId === entry.id ? 'is-active' : ''}`}
              aria-label={`${home.name}, ${statusLabel(home.status)}`}
              onPointerEnter={(e) => { lastPointer.current = e.pointerType; if (e.pointerType === 'mouse') onHover(entry.id); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') onHover(null); }}
              onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
              onFocus={() => onHover(entry.id)}
              onBlur={() => onHover(null)}
              onClick={() => {
                if (lastPointer.current === 'mouse') onOpen(entry.id);
                else if (hoveredId !== entry.id) onHover(entry.id); // touch: first tap = card
                else onOpen(entry.id);
              }}
            >
              {i + 1}
            </button>
            {showCard && (
              <div className="pr-card pr-glass" role="status">
                <b>{home.name}</b>
                <p>{formatArea(home.areaM2, unit)}</p>
                <p><span className={`pr-status ${home.status}`}>{statusLabel(home.status)}</span></p>
                <button type="button" className="pr-btn" onClick={() => onOpen(entry.id)}>View details</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
