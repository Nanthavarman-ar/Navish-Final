import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3, PointerEventTypes, PointLight } from '@babylonjs/core';
import { X, Fan, Lightbulb, Tv, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';
import { loadSceneEdits, savePartialFeatureState, SavedFixture } from './utils/sceneEditsPersistence';
import { resolveMeshRef, isSelectableMesh } from './BabylonWorkspace/meshSceneHandlers';

interface InteractiveFixturesProps {
  scene: Scene;
  roomId: string;
  onClose: () => void;
  // Same "stays mounted, visibility toggled via this prop" pattern as AnnotationTool/
  // HotspotNavigation/MeshMaterialSwatches - fixtures (a spinning fan, a lit switch, a
  // glowing TV) must keep working for any viewer regardless of whether the admin's own
  // panel is open.
  visible?: boolean;
}

type FixtureType = SavedFixture['type'];

const FIXTURE_TYPES: { id: FixtureType; label: string; icon: typeof Fan; color: Color3; instruction: string }[] = [
  { id: 'fan', label: 'Ceiling Fan', icon: Fan, color: new Color3(0.35, 0.75, 0.95), instruction: 'Click directly on the fan blades mesh' },
  { id: 'light', label: 'Light Switch', icon: Lightbulb, color: new Color3(0.98, 0.8, 0.25), instruction: 'Click the bulb/fixture (or any spot to place a light there)' },
  { id: 'tv', label: 'TV', icon: Tv, color: new Color3(0.65, 0.4, 0.9), instruction: 'Click directly on the TV screen mesh' },
];

// "Living details" - a ceiling fan that actually spins, a light switch that actually turns
// a real light (and the fixture's own glow) on/off, a TV screen that actually lights up -
// placed directly on whichever mesh in THIS specific model is the fan/bulb/screen (there's
// no reliable fixed mesh name like "Fan_Blades" to assume across arbitrary uploaded Revit/
// SketchUp/Blender exports), then saved so every viewer sees the same fixtures in the same
// place and state, not just whoever placed them.
const InteractiveFixtures: React.FC<InteractiveFixturesProps> = ({ scene, roomId, onClose, visible = true }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [fixtures, setFixtures] = useState<SavedFixture[]>([]);
  const [placingType, setPlacingType] = useState<FixtureType | null>(null);
  const markerMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const lightsRef = useRef<Map<string, PointLight>>(new Map());
  const resolvedMeshCacheRef = useRef<Map<string, ReturnType<typeof resolveMeshRef>>>(new Map());
  const fixturesRef = useRef<SavedFixture[]>([]);
  fixturesRef.current = fixtures;

  useEffect(() => {
    let cancelled = false;
    loadSceneEdits(roomId).then((data) => {
      if (cancelled) return;
      setFixtures(data?.features?.fixtures || []);
    });
    return () => { cancelled = true; };
  }, [roomId]);

  const persist = useCallback((next: SavedFixture[]) => {
    savePartialFeatureState(roomId, { fixtures: next }).then((saved) => {
      if (!saved) showToast.error('Could not save fixture', 'It will disappear on reload - try again');
    });
  }, [roomId]);

  // Looks up (and caches) the actual mesh this fixture acts on - the fan's blades, the
  // light/TV's own fixture mesh - using the same disambiguation swatches use for
  // duplicate-named meshes, since resolving it fresh via a plain name lookup could match
  // some OTHER identical fixture placed elsewhere in the same model.
  const resolveFixtureMesh = useCallback((fixture: SavedFixture) => {
    const cached = resolvedMeshCacheRef.current.get(fixture.id);
    if (cached && !cached.isDisposed()) return cached;
    if (!fixture.meshId || !fixture.meshName) return null;
    const resolved = resolveMeshRef(scene, fixture.meshId, fixture.meshName, fixture.position);
    if (resolved) {
      if (fixture.type === 'fan') {
        // The load-time performance optimization freezes every static mesh's world
        // matrix (see BabylonWorkspace.tsx's model-load effect) since real architectural
        // imports have thousands of meshes that never move - a fan's blades are a
        // deliberate, permanent exception to that: this mesh needs its rotation to keep
        // updating for as long as this fixture exists, so a frozen world matrix would
        // make it spin exactly nowhere.
        resolved.unfreezeWorldMatrix();
        resolved.doNotSyncBoundingInfo = false;
      }
      resolvedMeshCacheRef.current.set(fixture.id, resolved);
    }
    return resolved;
  }, [scene]);

  // Creates/removes the real PointLight for each 'light' fixture, and applies each
  // fixture's current on/off state (light enabled, bulb/screen glow) - runs on every
  // fixtures change, so both placing a new one and toggling an existing one are covered.
  useEffect(() => {
    const currentIds = new Set(fixtures.map((f) => f.id));
    lightsRef.current.forEach((light, id) => {
      if (!currentIds.has(id)) {
        light.dispose();
        lightsRef.current.delete(id);
        resolvedMeshCacheRef.current.delete(id);
      }
    });

    fixtures.forEach((fixture) => {
      if (fixture.type === 'light' && !lightsRef.current.has(fixture.id)) {
        const light = new PointLight(`fixture_light_${fixture.id}`, new Vector3(fixture.position.x, fixture.position.y, fixture.position.z), scene);
        light.diffuse = new Color3(1, 0.85, 0.55);
        light.intensity = 0.9;
        light.range = 6;
        lightsRef.current.set(fixture.id, light);
      }
      if (fixture.type === 'light') {
        lightsRef.current.get(fixture.id)?.setEnabled(fixture.isOn);
      }
      if (fixture.type === 'light' || fixture.type === 'tv') {
        const mesh = resolveFixtureMesh(fixture);
        const mat = mesh?.material as (StandardMaterial & { emissiveColor?: Color3 }) | null;
        if (mat && 'emissiveColor' in mat) {
          mat.emissiveColor = fixture.isOn
            ? (fixture.type === 'tv' ? new Color3(0.55, 0.7, 0.95) : new Color3(1, 0.88, 0.6))
            : new Color3(0, 0, 0);
        }
      }
    });
  }, [fixtures, scene, resolveFixtureMesh]);

  // Fan spin + a subtle TV screen flicker (both only while "on") - one shared render
  // loop rather than one observer per fixture.
  useEffect(() => {
    const observer = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      fixturesRef.current.forEach((fixture) => {
        if (!fixture.isOn) return;
        if (fixture.type === 'fan') {
          const mesh = resolveFixtureMesh(fixture);
          if (mesh) mesh.rotation.y += 6 * dt; // roughly one full turn per second at "on" speed
        } else if (fixture.type === 'tv') {
          const mesh = resolveFixtureMesh(fixture);
          const mat = mesh?.material as (StandardMaterial & { emissiveColor?: Color3 }) | null;
          if (mat && 'emissiveColor' in mat) {
            const flicker = 0.85 + Math.random() * 0.15;
            mat.emissiveColor = new Color3(0.55 * flicker, 0.7 * flicker, 0.95 * flicker);
          }
        }
      });
    });
    return () => { scene.onBeforeRenderObservable.remove(observer); };
  }, [scene, resolveFixtureMesh]);

  // Render/sync marker meshes - one small colored sphere per placed fixture, click to
  // toggle on/off (see the toggle-click effect below).
  useEffect(() => {
    const currentIds = new Set(fixtures.map((f) => f.id));
    markerMeshesRef.current.forEach((mesh, id) => {
      if (!currentIds.has(id)) {
        mesh.dispose(false, true);
        markerMeshesRef.current.delete(id);
      }
    });
    fixtures.forEach((fixture) => {
      let marker = markerMeshesRef.current.get(fixture.id);
      const typeInfo = FIXTURE_TYPES.find((t) => t.id === fixture.type)!;
      if (!marker) {
        marker = MeshBuilder.CreateSphere(`fixture_marker_${fixture.id}`, { diameter: 0.16 }, scene);
        marker.position = new Vector3(fixture.position.x, fixture.position.y, fixture.position.z);
        marker.renderingGroupId = 1;
        markerMeshesRef.current.set(fixture.id, marker);
      }
      const mat = (marker.material as StandardMaterial) ?? new StandardMaterial(`fixture_marker_mat_${fixture.id}`, scene);
      mat.diffuseColor = typeInfo.color;
      mat.emissiveColor = fixture.isOn ? typeInfo.color.scale(0.8) : typeInfo.color.scale(0.25);
      marker.material = mat;
    });
  }, [fixtures, scene]);

  useEffect(() => {
    return () => {
      markerMeshesRef.current.forEach((mesh) => mesh.dispose(false, true));
      markerMeshesRef.current.clear();
      lightsRef.current.forEach((light) => light.dispose());
      lightsRef.current.clear();
    };
  }, []);

  const toggleFixture = useCallback((id: string) => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, isOn: !f.isOn } : f));
      persist(next);
      return next;
    });
  }, [persist]);

  // Click-to-place: arm "Add Fan/Light/TV" then click a spot on the model. Fan/TV need
  // an actual mesh hit (there's nothing to spin or light up otherwise); Light can be
  // placed on bare space too, since it still creates a real point light there.
  useEffect(() => {
    if (!placingType) return;
    const typeInfo = FIXTURE_TYPES.find((t) => t.id === placingType)!;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => isSelectableMesh(m));
      if (!pickResult?.hit || !pickResult.pickedPoint) {
        showToast.info('Click directly on the model to place it');
        return;
      }
      if ((placingType === 'fan' || placingType === 'tv') && !pickResult.pickedMesh) {
        showToast.info(typeInfo.instruction);
        return;
      }
      const fixture: SavedFixture = {
        id: `fixture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: placingType,
        label: typeInfo.label,
        position: { x: pickResult.pickedPoint.x, y: pickResult.pickedPoint.y, z: pickResult.pickedPoint.z },
        meshId: pickResult.pickedMesh?.id,
        meshName: pickResult.pickedMesh?.name,
        isOn: false,
      };
      setFixtures((prev) => {
        const next = [...prev, fixture];
        persist(next);
        return next;
      });
      showToast.success(`${typeInfo.label} placed`, 'Click its marker (or the list below) to switch it on/off');
      setPlacingType(null);
    });
    return () => { scene.onPointerObservable.remove(observer); };
  }, [placingType, scene, persist]);

  // Click a marker (outside placing mode) toggles that fixture directly in the 3D view,
  // not just from the list - the whole point of a "light switch" is being able to click it.
  useEffect(() => {
    if (placingType) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      if (!mesh?.name.startsWith('fixture_marker_')) return;
      toggleFixture(mesh.name.slice('fixture_marker_'.length));
    });
    return () => { scene.onPointerObservable.remove(observer); };
  }, [placingType, scene, toggleFixture]);

  const deleteFixture = (id: string) => {
    setFixtures((prev) => {
      const next = prev.filter((f) => f.id !== id);
      persist(next);
      return next;
    });
  };

  return (
    <div ref={panelRef} style={panelStyle} className={`fixed right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex-col max-h-[70vh] ${visible ? 'flex' : 'hidden'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Interactive Fixtures</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close interactive fixtures">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-gray-700 shrink-0 space-y-2">
        {placingType ? (
          <div className="text-xs text-cyan-300 text-center py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded">
            {FIXTURE_TYPES.find((t) => t.id === placingType)?.instruction}...
            <button onClick={() => setPlacingType(null)} className="block mx-auto mt-1 text-slate-400 hover:text-white underline">Cancel</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {FIXTURE_TYPES.map((t) => (
              <Button key={t.id} size="sm" variant="outline" className="text-xs flex-col h-auto py-2" onClick={() => setPlacingType(t.id)}>
                <t.icon className="w-4 h-4 mb-1" style={{ color: `rgb(${t.color.r * 255}, ${t.color.g * 255}, ${t.color.b * 255})` }} />
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {fixtures.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">
            No fixtures yet. Pick a type above and click the right spot on the model.
          </div>
        )}
        {fixtures.map((fixture) => {
          const typeInfo = FIXTURE_TYPES.find((t) => t.id === fixture.type)!;
          return (
            <div key={fixture.id} className="p-2.5 bg-slate-800/50 border border-slate-700/80 rounded-lg group flex items-center gap-2">
              <typeInfo.icon className="w-4 h-4 shrink-0" style={{ color: `rgb(${typeInfo.color.r * 255}, ${typeInfo.color.g * 255}, ${typeInfo.color.b * 255})` }} />
              <span className="flex-1 text-sm text-gray-100 truncate">{fixture.label}</span>
              <Button
                size="sm"
                variant={fixture.isOn ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => toggleFixture(fixture.id)}
              >
                {fixture.isOn ? 'On' : 'Off'}
              </Button>
              <button
                onClick={() => deleteFixture(fixture.id)}
                className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                aria-label="Delete fixture"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InteractiveFixtures;
