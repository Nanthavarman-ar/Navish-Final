import React, { useEffect, useRef, useState } from 'react';
import type { Scene } from '@babylonjs/core';
import { Matrix, Vector3 } from '@babylonjs/core';
import { X } from 'lucide-react';
import { PanoViewer } from '../presentation/panorama';
import type { Home, Hotspot, TimeOfDay } from '../data/homesData';

const FLOOR_PLAN = '__floorplan__';
const TIME_LABEL: Record<TimeOfDay, string> = { morning: 'Morning', day: 'Day', sunset: 'Sunset', night: 'Night' };
const prettyRoom = (r: string) => r.charAt(0).toUpperCase() + r.slice(1).replace(/[_-]+/g, ' ');

interface Props {
  scene: Scene;
  projectId?: string;
  home: Home;
  onClose: () => void;
}

/** Room tabs, time-of-day slider and hotspot labels on top of the PanoViewer. */
export function PanoramaUI({ scene, projectId, home, onClose }: Props) {
  const viewer = useRef<PanoViewer | null>(null);
  const rooms = home.rooms?.length ? home.rooms : ['living'];
  const [tab, setTab] = useState<string>(rooms[0]);
  const [times, setTimes] = useState<TimeOfDay[]>([]);
  const [timeValue, setTimeValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const hotspotEls = useRef(new Map<number, HTMLDivElement>());

  const hotspots: Hotspot[] = tab === FLOOR_PLAN ? [] : home.hotspots?.[tab] || [];

  useEffect(() => {
    const v = new PanoViewer(scene);
    viewer.current = v;
    v.enter();
    return () => { v.exit(); viewer.current = null; };
  }, [scene]);

  useEffect(() => {
    const v = viewer.current;
    if (!v || tab === FLOOR_PLAN) return;
    let cancelled = false;
    setLoading(true);
    v.showRoom(projectId, home.id, tab).then((found) => {
      if (cancelled) return;
      setTimes(found.times);
      setTimeValue(Math.max(0, found.times.indexOf('day')));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, home.id, projectId]);

  // Keep hotspot labels glued to their direction as the user looks around.
  useEffect(() => {
    if (!hotspots.length) return;
    const engine = scene.getEngine();
    const tmp = new Vector3();
    const obs = scene.onAfterRenderObservable.add(() => {
      const cam = viewer.current?.lookCamera;
      const canvas = engine.getRenderingCanvas();
      if (!cam || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      const viewport = cam.viewport.toGlobal(w, h);
      const transform = cam.getViewMatrix().multiply(cam.getProjectionMatrix());
      hotspots.forEach((hs, i) => {
        const el = hotspotEls.current.get(i);
        if (!el) return;
        const yaw = (hs.yaw * Math.PI) / 180;
        const pitch = ((hs.pitch || 0) * Math.PI) / 180;
        const dir = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).scale(100);
        Vector3.ProjectToRef(dir, Matrix.IdentityReadOnly, transform, viewport, tmp);
        const visible = tmp.z > 0 && tmp.z < 1;
        el.style.visibility = visible ? 'visible' : 'hidden';
        if (visible) el.style.transform = `translate3d(${(tmp.x / w) * rect.width}px, ${(tmp.y / h) * rect.height}px, 0)`;
      });
    });
    return () => { scene.onAfterRenderObservable.remove(obs); };
  }, [scene, hotspots]);

  const planSrc = home.floorPlan && /^(https?:\/\/|\/)/i.test(home.floorPlan) ? home.floorPlan : undefined;

  return (
    <div className="pr-pano">
      <div className="pr-pano-bar pr-glass" role="tablist" aria-label="Rooms">
        {rooms.map((r) => (
          <button key={r} type="button" role="tab" aria-selected={tab === r} className={`pr-btn ${tab === r ? 'is-on' : ''}`} onClick={() => setTab(r)}>{prettyRoom(r)}</button>
        ))}
        {planSrc && (
          <button type="button" role="tab" aria-selected={tab === FLOOR_PLAN} className={`pr-btn ${tab === FLOOR_PLAN ? 'is-on' : ''}`} onClick={() => setTab(FLOOR_PLAN)}>Floor plan</button>
        )}
        <button type="button" className="pr-btn pr-icon-btn" onClick={onClose} aria-label="Exit home"><X /></button>
      </div>

      {tab === FLOOR_PLAN && planSrc && <div className="pr-planview"><img src={planSrc} alt={`${home.name} floor plan`} /></div>}

      {tab !== FLOOR_PLAN && !loading && times.length === 0 && (
        <div className="pr-notice pr-glass">360° images for this room are not available yet.</div>
      )}
      {tab !== FLOOR_PLAN && loading && <div className="pr-notice pr-glass">Loading…</div>}

      {tab !== FLOOR_PLAN && hotspots.map((hs, i) => (
        <div key={`${tab}-${i}`} className="pr-hotspot" ref={(el) => { if (el) hotspotEls.current.set(i, el); else hotspotEls.current.delete(i); }} style={{ visibility: 'hidden' }}>
          <button type="button" className="pr-btn" onClick={() => hs.target && rooms.includes(hs.target) && setTab(hs.target)}>{hs.label}</button>
        </div>
      ))}

      {tab !== FLOOR_PLAN && times.length > 1 && (
        <div className="pr-pano-time pr-glass">
          <input
            type="range"
            min={0}
            max={times.length - 1}
            step={0.01}
            value={timeValue}
            aria-label="Time of day"
            onChange={(e) => { const v = parseFloat(e.target.value); setTimeValue(v); viewer.current?.setTime(v); }}
          />
          <div>{times.map((t) => <span key={t}>{TIME_LABEL[t]}</span>)}</div>
        </div>
      )}
    </div>
  );
}
