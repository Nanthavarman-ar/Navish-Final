import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Scene } from '@babylonjs/core';
import { PointerEventTypes } from '@babylonjs/core';
import { PRESENT_PREFIX } from '../presentation/sceneModel';
import { useBuilding } from '../presentation/useBuilding';
import { FloorSlice } from '../presentation/floorSlice';
import { flyTo, getOrbitCamera, overviewFor } from '../presentation/cameraFly';
import { XRPins } from '../presentation/xrPins';
import { loadHomes, placeholderHome, type Home } from '../data/homesData';
import { loadPresentConfig, DEFAULT_CONFIG, type PresentConfig } from '../data/presentConfig';
import { GlassControls } from './GlassControls';
import { FloorHUD, FloorPicker } from './FloorUI';
import { PinLayer } from './PinLayer';
import { HomePanel } from './HomePanel';
import { PanoramaUI } from './PanoramaUI';
import './present.css';

const normId = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '');
const safeAccent = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : DEFAULT_CONFIG.accentColor);
const safeUrl = (u: string) => (/^(https:\/\/|http:\/\/|\/)/i.test(u) ? u : '');

interface Props {
  sceneRef: React.MutableRefObject<Scene | null>;
  /** Per-client folder name under /projects/ (the demo share id). */
  projectId?: string;
  config?: PresentConfig;
}

/**
 * The whole client-facing presentation: branding, glass controls, floor slice, pins, hover
 * card, side panel, 360 rooms and VR pins. It sits on top of the unchanged workspace canvas
 * and only talks to it through the Babylon scene (plus the naviz:present-xr event for VR/AR).
 */
export function PresentationLayer({ sceneRef, projectId, config: configProp }: Props) {
  const [config, setConfig] = useState<PresentConfig>(configProp || DEFAULT_CONFIG);
  const [fileHomes, setFileHomes] = useState<Home[]>([]);
  const [unit, setUnit] = useState<'m2' | 'ft2'>(config.units);
  const [level, setLevel] = useState<number | null>(null);
  const [floorsOpen, setFloorsOpen] = useState(false);
  const [interior, setInterior] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panoId, setPanoId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cfg = configProp || (await loadPresentConfig(projectId));
      const { homes } = await loadHomes(projectId);
      if (!alive) return;
      setConfig(cfg);
      setUnit(cfg.units);
      setFileHomes(homes);
    })();
    return () => { alive = false; };
  }, [projectId, configProp]);

  const homeFloors = useMemo(() => {
    const out: Record<string, number | undefined> = {};
    fileHomes.forEach((h) => { out[h.id] = h.floor; });
    return out;
  }, [fileHomes]);

  const { scene, building } = useBuilding(sceneRef, config.naming, homeFloors);

  // homes.json entry for a mesh-named home (id match ignores case, spaces, _ and -);
  // homes missing from the file still get a placeholder so every home has a pin.
  const homeFor = useCallback((id: string): Home => {
    const hit = fileHomes.find((h) => normId(h.id) === normId(id));
    if (hit) return { ...hit, id };
    const entry = building?.homes.find((h) => h.id === id);
    return placeholderHome(id, entry?.level);
  }, [fileHomes, building]);

  // ---- slice controller ---------------------------------------------------
  const buildingRef = useRef(building);
  buildingRef.current = building;
  const configRef = useRef(config);
  configRef.current = config;
  const slice = useRef<FloorSlice | null>(null);

  useEffect(() => {
    if (!scene) return;
    const s = new FloorSlice(
      scene,
      () => buildingRef.current!,
      () => ({ cutHeightRatio: configRef.current.cutHeightRatio, cutCaps: configRef.current.cutCaps }),
    );
    s.onChange = setLevel;
    slice.current = s;
    return () => { s.dispose(); slice.current = null; setLevel(null); };
  }, [scene, building?.levels.length]);

  const selectLevel = useCallback((l: number) => { setActiveId(null); void slice.current?.sliceTo(l); }, []);
  const fullBuilding = useCallback(() => { void slice.current?.restore(); }, []);

  // Tap a floor in the 3D view to slice there.
  useEffect(() => {
    if (!scene || !building?.hasFloors || panoId) return;
    const obs = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return;
      const mesh = info.pickInfo?.pickedMesh;
      if (!mesh || mesh.name.startsWith(PRESENT_PREFIX)) return;
      const lvl = building.levelOf.get(mesh);
      if (lvl !== undefined && lvl !== slice.current?.level) selectLevel(lvl);
    });
    return () => { scene.onPointerObservable.remove(obs); };
  }, [scene, building, panoId, selectLevel]);

  // ---- VR pins --------------------------------------------------------------
  const xrPins = useRef<XRPins | null>(null);
  const homeForRef = useRef(homeFor); homeForRef.current = homeFor;
  const unitRef = useRef(unit); unitRef.current = unit;
  useEffect(() => {
    if (!scene || !building || !building.homes.length) return;
    const pins = new XRPins(scene, building, (id) => homeForRef.current(id), () => unitRef.current, safeAccent(config.accentColor));
    xrPins.current = pins;
    return () => { pins.dispose(); xrPins.current = null; };
  }, [scene, building, config.accentColor]);
  useEffect(() => { xrPins.current?.setVisibleLevel(level); }, [level]);

  // Handy for the person preparing the project: window.__presentExportHomes() in the console.
  useEffect(() => {
    if (!building) return;
    (window as unknown as Record<string, unknown>).__presentExportHomes = () =>
      JSON.stringify({ homes: building.homes.map((h) => homeFor(h.id)) }, null, 2);
    return () => { delete (window as unknown as Record<string, unknown>).__presentExportHomes; };
  }, [building, homeFor]);

  // ---- control handlers -----------------------------------------------------
  const resetView = useCallback(() => {
    setActiveId(null); setFloorsOpen(false);
    if (slice.current?.level != null) { fullBuilding(); return; }
    if (scene && building) void flyTo(scene, overviewFor(building.center, building.size, getOrbitCamera(scene)));
  }, [scene, building, fullBuilding]);

  const toggleInterior = useCallback(() => {
    const next = !interior;
    setInterior(next);
    slice.current?.setExteriorHidden(next);
    if (scene && building && slice.current?.level == null) {
      const v = overviewFor(building.center, building.size, getOrbitCamera(scene));
      void flyTo(scene, next ? { ...v, radius: v.radius * 0.55, beta: Math.PI / 3 } : v);
    }
  }, [interior, scene, building]);

  const xr = (mode: 'vr' | 'ar') => window.dispatchEvent(new CustomEvent('naviz:present-xr', { detail: mode }));

  const accent = safeAccent(config.accentColor);
  const logo = safeUrl(config.clientLogo);
  const activeHome = activeId ? homeFor(activeId) : null;
  const panoHome = panoId ? homeFor(panoId) : null;
  const levels = building?.levels.map((l) => l.level) ?? [];
  const homesOn = (l: number) => building?.homes.filter((h) => h.level === l).length ?? 0;
  const inPano = !!panoHome;

  return (
    <div className="pr-root" style={{ ['--pr-accent' as string]: accent }}>
      {(logo || config.clientName) && (
        <div className="pr-brand pr-glass">
          {logo && <img src={logo} alt="" />}
          <div>
            <b>{config.clientName}</b>
            {config.tagline && <small>{config.tagline}</small>}
          </div>
        </div>
      )}

      {scene && building && !inPano && (
        <PinLayer
          scene={scene}
          building={building}
          homeFor={homeFor}
          unit={unit}
          maxLevel={level}
          hidden={false}
          hoveredId={hovered}
          activeId={activeId}
          onHover={setHovered}
          onOpen={(id) => { setActiveId(id); setHovered(null); }}
        />
      )}

      {!inPano && (
        <>
          <FloorHUD level={level} levels={levels} homes={level === null ? 0 : homesOn(level)} onSelect={selectLevel} onBack={fullBuilding} />
          <FloorPicker
            open={floorsOpen && level === null && !activeHome}
            levels={levels}
            level={level}
            homesOn={homesOn}
            onSelect={(l) => { setFloorsOpen(false); selectLevel(l); }}
            onFull={fullBuilding}
          />
          <GlassControls
            hasFloors={levels.length > 0}
            interior={interior}
            unit={unit}
            floorsOpen={floorsOpen}
            pinned={floorsOpen}
            onFloors={() => setFloorsOpen((v) => !v)}
            onToggleInterior={toggleInterior}
            onReset={resetView}
            onVR={() => xr('vr')}
            onAR={() => xr('ar')}
            onToggleUnit={() => setUnit((u) => (u === 'm2' ? 'ft2' : 'm2'))}
          />
        </>
      )}

      {activeHome && !inPano && (
        <HomePanel
          home={activeHome}
          level={building?.homes.find((h) => h.id === activeId)?.level}
          unit={unit}
          contactLink={config.contactLink}
          onClose={() => setActiveId(null)}
          onEnter={() => { setPanoId(activeId); setActiveId(null); }}
        />
      )}

      {scene && panoHome && (
        <PanoramaUI scene={scene} projectId={projectId} home={panoHome} onClose={() => setPanoId(null)} />
      )}
    </div>
  );
}
