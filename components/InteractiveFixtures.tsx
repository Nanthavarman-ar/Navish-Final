import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, TransformNode, MeshBuilder, StandardMaterial, VideoTexture, DynamicTexture, ParticleSystem, Color3, Color4, Vector3, Scalar, PointerEventTypes, PointLight } from '@babylonjs/core';
import { X, Fan, Lightbulb, Tv, Trash2, Upload, DoorOpen, Flame, Droplets, FlipHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import { usePanelStack } from '../hooks/usePanelStack';
import { loadSceneEdits, savePartialFeatureState, SavedFixture } from './utils/sceneEditsPersistence';
import { resolveMeshRef, isSelectableMesh } from './BabylonWorkspace/meshSceneHandlers';
import { uploadFileToR2 } from './utils/r2ModelUpload';
import { projectId } from '../supabase/client';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;
// A TV screen is only ever seen from across a room, so there's no reason to accept a huge
// source file - kept generous enough for a genuinely short, reasonably compressed clip
// (the pasted-in reference's own advice: 720p H.264, not 4K) while still bounding upload
// time/R2 storage use per fixture.
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

interface InteractiveFixturesProps {
  scene: Scene;
  roomId: string;
  onClose: () => void;
  // Same "stays mounted, visibility toggled via this prop" pattern as AnnotationTool/
  // HotspotNavigation/MeshMaterialSwatches - fixtures (a spinning fan, a lit switch, a
  // glowing TV, a swinging door, a flickering fireplace, a running tap) must keep working
  // for any viewer regardless of whether the admin's own panel is open.
  visible?: boolean;
}

type FixtureType = SavedFixture['type'];

const FIXTURE_TYPES: { id: FixtureType; label: string; icon: typeof Fan; color: Color3; instruction: string }[] = [
  { id: 'fan', label: 'Ceiling Fan', icon: Fan, color: new Color3(0.35, 0.75, 0.95), instruction: 'Click directly on the fan blades mesh' },
  { id: 'light', label: 'Light Switch', icon: Lightbulb, color: new Color3(0.98, 0.8, 0.25), instruction: 'Click the bulb/fixture (or any spot to place a light there)' },
  { id: 'tv', label: 'TV', icon: Tv, color: new Color3(0.65, 0.4, 0.9), instruction: 'Click directly on the TV screen mesh' },
  { id: 'door', label: 'Door / Cabinet', icon: DoorOpen, color: new Color3(0.75, 0.55, 0.3), instruction: 'Click directly on the door/cabinet panel mesh' },
  { id: 'fire', label: 'Fireplace / Candle', icon: Flame, color: new Color3(1, 0.5, 0.15), instruction: 'Click the fireplace/candle (or any spot to place the flame there)' },
  { id: 'water', label: 'Running Water', icon: Droplets, color: new Color3(0.35, 0.65, 0.95), instruction: 'Click the tap/sink (or any spot to place the stream there)' },
];

// A door/cabinet has no reliable way to detect its true hinge edge or which way it should
// swing from geometry alone - this is a reasonable-looking default that the admin corrects
// with the Flip hinge/Reverse swing list controls if it opens from the wrong side.
const DOOR_SWING_DEGREES = 100;
const DOOR_SWING_SPEED = 4; // lerp rate - reaches target in well under a second

// Both particle effects share one small soft-dot sprite (generated once, not shipped as an
// asset file) rather than each fixture creating its own copy of the same texture.
function createDotTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const texture = new DynamicTexture('fixture_particle_dot', { width: size, height: size }, scene, false);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.update();
  return texture;
}

function createFireParticles(scene: Scene, id: string, position: Vector3, texture: DynamicTexture): ParticleSystem {
  const ps = new ParticleSystem(`fixture_fire_particles_${id}`, 60, scene);
  ps.particleTexture = texture;
  ps.emitter = position.clone();
  ps.minEmitBox = new Vector3(-0.05, 0, -0.05);
  ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
  ps.color1 = new Color4(1, 0.6, 0.2, 0.9);
  ps.color2 = new Color4(1, 0.3, 0.05, 0.7);
  ps.colorDead = new Color4(0.3, 0.1, 0.05, 0);
  ps.minSize = 0.04;
  ps.maxSize = 0.12;
  ps.minLifeTime = 0.4;
  ps.maxLifeTime = 0.9;
  ps.emitRate = 25;
  ps.direction1 = new Vector3(-0.2, 1, -0.2);
  ps.direction2 = new Vector3(0.2, 1, 0.2);
  ps.minEmitPower = 0.3;
  ps.maxEmitPower = 0.7;
  ps.gravity = new Vector3(0, 0.5, 0); // slight buoyancy - embers/smoke drift up, not fall
  ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  return ps;
}

function createWaterParticles(scene: Scene, id: string, position: Vector3, texture: DynamicTexture): ParticleSystem {
  const ps = new ParticleSystem(`fixture_water_particles_${id}`, 80, scene);
  ps.particleTexture = texture;
  ps.emitter = position.clone();
  ps.minEmitBox = new Vector3(-0.02, 0, -0.02);
  ps.maxEmitBox = new Vector3(0.02, 0, 0.02);
  ps.color1 = new Color4(0.7, 0.85, 1, 0.9);
  ps.color2 = new Color4(0.5, 0.7, 0.95, 0.7);
  ps.colorDead = new Color4(0.4, 0.6, 0.9, 0);
  ps.minSize = 0.015;
  ps.maxSize = 0.04;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.6;
  ps.emitRate = 60;
  ps.direction1 = new Vector3(-0.05, -1, -0.05);
  ps.direction2 = new Vector3(0.05, -1, 0.05);
  ps.minEmitPower = 1;
  ps.maxEmitPower = 1.6;
  ps.gravity = new Vector3(0, -3, 0);
  return ps;
}

// "Living details" - a ceiling fan that actually spins, a light switch that actually turns
// a real light (and the fixture's own glow) on/off, a TV screen that actually lights up, a
// door/cabinet that swings open on a real hinge, a fireplace/candle that flickers, a tap/
// sink that actually runs water - placed directly on whichever mesh in THIS specific model
// is the fan/bulb/screen/panel (there's no reliable fixed mesh name like "Fan_Blades" to
// assume across arbitrary uploaded Revit/SketchUp/Blender exports), then saved so every
// viewer sees the same fixtures in the same place and state, not just whoever placed them.
const InteractiveFixtures: React.FC<InteractiveFixturesProps> = ({ scene, roomId, onClose, visible = true }) => {
  const { ref: panelRef, style: panelStyle } = usePanelStack('top-right');
  const [fixtures, setFixtures] = useState<SavedFixture[]>([]);
  const [placingType, setPlacingType] = useState<FixtureType | null>(null);
  const markerMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const lightsRef = useRef<Map<string, PointLight>>(new Map());
  const resolvedMeshCacheRef = useRef<Map<string, ReturnType<typeof resolveMeshRef>>>(new Map());
  const videoTexturesRef = useRef<Map<string, { texture: VideoTexture; url: string }>>(new Map());
  const hingeNodesRef = useRef<Map<string, { node: TransformNode; hingeSide: 'min' | 'max' }>>(new Map());
  const particleSystemsRef = useRef<Map<string, ParticleSystem>>(new Map());
  const dotTextureRef = useRef<DynamicTexture | null>(null);
  const fixturesRef = useRef<SavedFixture[]>([]);
  fixturesRef.current = fixtures;
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

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
      if (fixture.type === 'fan' || fixture.type === 'door') {
        // The load-time performance optimization freezes every static mesh's world
        // matrix (see BabylonWorkspace.tsx's model-load effect) since real architectural
        // imports have thousands of meshes that never move - a fan's blades and a door
        // panel are deliberate, permanent exceptions to that: both need their transform
        // to keep updating for as long as the fixture exists, so a frozen world matrix
        // would make a fan spin (or a door swing) exactly nowhere.
        resolved.unfreezeWorldMatrix();
        resolved.doNotSyncBoundingInfo = false;
      }
      resolvedMeshCacheRef.current.set(fixture.id, resolved);
    }
    return resolved;
  }, [scene]);

  // Creates/removes the real PointLight for each 'light'/'fire' fixture, and applies each
  // fixture's current on/off state (light enabled, bulb/screen glow) - runs on every
  // fixtures change, so both placing a new one and toggling an existing one are covered.
  // 'fire' gets a warmer, dimmer base light than 'light' - the flicker itself (render loop
  // below) is what actually reads as a flame/candle rather than a steady room light.
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
      if ((fixture.type === 'light' || fixture.type === 'fire') && !lightsRef.current.has(fixture.id)) {
        const light = new PointLight(`fixture_light_${fixture.id}`, new Vector3(fixture.position.x, fixture.position.y, fixture.position.z), scene);
        if (fixture.type === 'fire') {
          light.diffuse = new Color3(1, 0.45, 0.15);
          light.intensity = 0.6;
          light.range = 4;
        } else {
          light.diffuse = new Color3(1, 0.85, 0.55);
          light.intensity = 0.9;
          light.range = 6;
        }
        lightsRef.current.set(fixture.id, light);
      }
      // 'fire' is enabled/disabled the same way, but its intensity is continuously
      // overwritten by the flicker in the render loop below while on - setEnabled still
      // needs to happen here so it actually goes dark when switched off.
      if (fixture.type === 'light' || fixture.type === 'fire') {
        lightsRef.current.get(fixture.id)?.setEnabled(fixture.isOn);
      }
      // A TV with a real uploaded video is handled entirely by the video-texture effect
      // below (its own material, its own emissive drive from the video frames) - applying
      // a flat emissiveColor here too would fight it every render.
      if (fixture.type === 'light' || (fixture.type === 'tv' && !fixture.videoUrl)) {
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

  // Creates/replaces the VideoTexture for each TV fixture that has a real uploaded video
  // (see the Upload button in the fixture list), and plays/pauses it to match isOn. Muted
  // so play() is never blocked by the browser's autoplay policy regardless of exactly how
  // the click that triggers it propagates through React state - a silently-never-playing
  // "TV" would be a worse regression than losing audio.
  useEffect(() => {
    const currentVideoIds = new Set(fixtures.filter((f) => f.type === 'tv' && f.videoUrl).map((f) => f.id));
    videoTexturesRef.current.forEach((entry, id) => {
      if (!currentVideoIds.has(id)) {
        entry.texture.dispose();
        videoTexturesRef.current.delete(id);
      }
    });

    fixtures.forEach((fixture) => {
      if (fixture.type !== 'tv' || !fixture.videoUrl) return;
      const mesh = resolveFixtureMesh(fixture);
      if (!mesh) return;
      const existing = videoTexturesRef.current.get(fixture.id);
      if (!existing || existing.url !== fixture.videoUrl) {
        existing?.texture.dispose();
        const texture = new VideoTexture(`fixture_tv_video_${fixture.id}`, fixture.videoUrl, scene, true, false, undefined, {
          autoPlay: false,
          loop: true,
          muted: true,
        });
        const mat = new StandardMaterial(`fixture_tv_mat_${fixture.id}`, scene);
        // Preserves whatever the original screen mesh's material had for double-sidedness -
        // common for a thin TV screen panel - the same fix already applied to swatch
        // material swaps (see MeshMaterialSwatches) for the same reason.
        mat.backFaceCulling = mesh.material?.backFaceCulling ?? true;
        mat.diffuseTexture = texture;
        mat.emissiveTexture = texture;
        mat.emissiveColor = new Color3(1, 1, 1);
        mat.disableLighting = true;
        mesh.material = mat;
        videoTexturesRef.current.set(fixture.id, { texture, url: fixture.videoUrl });
      }
      const video = videoTexturesRef.current.get(fixture.id)?.texture.video;
      if (video) {
        if (fixture.isOn) video.play().catch(() => {});
        else video.pause();
      }
    });
  }, [fixtures, scene, resolveFixtureMesh]);

  // Sets up the hinge for each 'door' fixture - a TransformNode positioned at the door
  // mesh's own bounding-box edge (not the mesh's own pivot), with the door mesh reparented
  // onto it via setParent (preserves its current world position/rotation exactly, per
  // Babylon's own semantics). Deliberately NOT using mesh.setPivotPoint() here - that's the
  // same mechanism BabylonWorkspace.tsx's gizmo-select effect uses (re-anchoring the pivot
  // to the bounding-box CENTER whenever this same mesh gets selected for editing elsewhere)
  // - sharing it would have the door's own hinge silently get clobbered back to center the
  // moment an admin selects that door mesh in the Property Inspector.
  const detachHinge = (entry: { node: TransformNode; hingeSide: 'min' | 'max' }) => {
    // Detach the door mesh back out from under the hinge node before disposing it -
    // otherwise the mesh would lose its parent transform contribution and visibly jump
    // the instant the (about to be disposed) hinge node's transform stops applying to it.
    const child = entry.node.getChildren()[0];
    if (child && 'setParent' in child) (child as Mesh).setParent(null);
    entry.node.dispose();
  };

  useEffect(() => {
    const currentIds = new Set(fixtures.filter((f) => f.type === 'door').map((f) => f.id));
    hingeNodesRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        detachHinge(entry);
        hingeNodesRef.current.delete(id);
      }
    });

    fixtures.forEach((fixture) => {
      if (fixture.type !== 'door') return;
      const wantedSide = fixture.hingeSide ?? 'min';
      const existing = hingeNodesRef.current.get(fixture.id);
      // "Flip hinge" (the list control below) changes hingeSide on an already-set-up door -
      // rebuild the hinge at the new edge rather than leaving the old one in place.
      if (existing && existing.hingeSide !== wantedSide) {
        detachHinge(existing);
        hingeNodesRef.current.delete(fixture.id);
      }
      if (hingeNodesRef.current.has(fixture.id)) return;
      const mesh = resolveFixtureMesh(fixture);
      if (!mesh) return;
      const bb = mesh.getBoundingInfo().boundingBox;
      const sizeX = bb.maximumWorld.x - bb.minimumWorld.x;
      const sizeZ = bb.maximumWorld.z - bb.minimumWorld.z;
      // A door/cabinet panel is thin along its depth and wide along its width - whichever
      // horizontal axis is LARGER is the width (and so the axis the hinge sits at one end
      // of); the other is the thin depth axis, along which the hinge sits at the middle.
      const widthIsX = sizeX >= sizeZ;
      const hingeX = widthIsX ? (wantedSide === 'max' ? bb.maximumWorld.x : bb.minimumWorld.x) : (bb.minimumWorld.x + bb.maximumWorld.x) / 2;
      const hingeZ = widthIsX ? (bb.minimumWorld.z + bb.maximumWorld.z) / 2 : (wantedSide === 'max' ? bb.maximumWorld.z : bb.minimumWorld.z);
      const hingeNode = new TransformNode(`fixture_door_hinge_${fixture.id}`, scene);
      hingeNode.position = new Vector3(hingeX, bb.centerWorld.y, hingeZ);
      mesh.setParent(hingeNode);
      hingeNodesRef.current.set(fixture.id, { node: hingeNode, hingeSide: wantedSide });
    });
  }, [fixtures, scene, resolveFixtureMesh]);

  // Creates/removes the ember/smoke particles for 'fire' and the droplet stream for
  // 'water', and starts/stops them to match isOn - Babylon particle systems don't need
  // per-frame manual work beyond start()/stop() and (for fire) the flicker-linked emit
  // rate in the render loop below.
  useEffect(() => {
    const currentIds = new Set(fixtures.filter((f) => f.type === 'fire' || f.type === 'water').map((f) => f.id));
    particleSystemsRef.current.forEach((ps, id) => {
      if (!currentIds.has(id)) {
        ps.dispose();
        particleSystemsRef.current.delete(id);
      }
    });

    if ((fixtures.some((f) => f.type === 'fire' || f.type === 'water')) && !dotTextureRef.current) {
      dotTextureRef.current = createDotTexture(scene);
    }

    fixtures.forEach((fixture) => {
      if (fixture.type !== 'fire' && fixture.type !== 'water') return;
      if (!particleSystemsRef.current.has(fixture.id) && dotTextureRef.current) {
        const position = new Vector3(fixture.position.x, fixture.position.y, fixture.position.z);
        const ps = fixture.type === 'fire'
          ? createFireParticles(scene, fixture.id, position, dotTextureRef.current)
          : createWaterParticles(scene, fixture.id, position, dotTextureRef.current);
        particleSystemsRef.current.set(fixture.id, ps);
      }
      const ps = particleSystemsRef.current.get(fixture.id);
      if (!ps) return;
      if (fixture.isOn && !ps.isStarted()) ps.start();
      else if (!fixture.isOn && ps.isStarted()) ps.stop();
    });
  }, [fixtures, scene]);

  // Fan spin, TV flicker, door swing lerp, fire flicker (fan/TV/fire only while "on"; door
  // runs regardless so it can smoothly swing back CLOSED once switched off, not just freeze
  // wherever it was) - one shared render loop rather than one observer per fixture.
  useEffect(() => {
    const observer = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      fixturesRef.current.forEach((fixture) => {
        if (fixture.type === 'door') {
          const hingeEntry = hingeNodesRef.current.get(fixture.id);
          if (!hingeEntry) return;
          const targetDeg = fixture.isOn ? DOOR_SWING_DEGREES * (fixture.swingReversed ? -1 : 1) : 0;
          const targetRad = (targetDeg * Math.PI) / 180;
          hingeEntry.node.rotation.y = Scalar.Lerp(hingeEntry.node.rotation.y, targetRad, Math.min(1, dt * DOOR_SWING_SPEED));
          return;
        }
        if (!fixture.isOn) return;
        if (fixture.type === 'fan') {
          const mesh = resolveFixtureMesh(fixture);
          if (mesh) mesh.rotation.y += 6 * dt; // roughly one full turn per second at "on" speed
        } else if (fixture.type === 'tv' && !fixture.videoUrl) {
          // A TV with a real uploaded video is driven by its own video frames instead
          // (see the video-texture effect) - flickering its emissiveColor on top would
          // just tint a real video with a fake "bad signal" wobble.
          const mesh = resolveFixtureMesh(fixture);
          const mat = mesh?.material as (StandardMaterial & { emissiveColor?: Color3 }) | null;
          if (mat && 'emissiveColor' in mat) {
            const flicker = 0.85 + Math.random() * 0.15;
            mat.emissiveColor = new Color3(0.55 * flicker, 0.7 * flicker, 0.95 * flicker);
          }
        } else if (fixture.type === 'fire') {
          const light = lightsRef.current.get(fixture.id);
          if (light) light.intensity = 0.6 * (0.7 + Math.random() * 0.6);
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
      videoTexturesRef.current.forEach((entry) => entry.texture.dispose());
      videoTexturesRef.current.clear();
      hingeNodesRef.current.forEach((entry) => detachHinge(entry));
      hingeNodesRef.current.clear();
      particleSystemsRef.current.forEach((ps) => ps.dispose());
      particleSystemsRef.current.clear();
      dotTextureRef.current?.dispose();
      dotTextureRef.current = null;
    };
  }, []);

  const toggleFixture = useCallback((id: string) => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, isOn: !f.isOn } : f));
      persist(next);
      return next;
    });
  }, [persist]);

  // Click-to-place: arm "Add Fan/Light/TV/..." then click a spot on the model. Fan/TV/Door
  // need an actual mesh hit - there's nothing to spin/light up/swing otherwise; Light/Fire/
  // Water can be placed on bare space too, since they still create a real light/particle
  // effect there with no mesh to glow/attach to.
  useEffect(() => {
    if (!placingType) return;
    const typeInfo = FIXTURE_TYPES.find((t) => t.id === placingType)!;
    const requiresMesh = placingType === 'fan' || placingType === 'tv' || placingType === 'door';
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pickResult = scene.pick(scene.pointerX, scene.pointerY, (m) => isSelectableMesh(m));
      if (!pickResult?.hit || !pickResult.pickedPoint) {
        showToast.info('Click directly on the model to place it');
        return;
      }
      if (requiresMesh && !pickResult.pickedMesh) {
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

  // No reliable way to detect a door's real hinge edge or swing direction from geometry
  // alone - these correct it after the fact once the admin sees which way it actually opens.
  const flipDoorHinge = (id: string) => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, hingeSide: (f.hingeSide ?? 'min') === 'min' ? 'max' as const : 'min' as const } : f));
      persist(next);
      return next;
    });
  };

  const reverseDoorSwing = (id: string) => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, swingReversed: !f.swingReversed } : f));
      persist(next);
      return next;
    });
  };

  const uploadFixtureVideo = async (fixtureId: string, file: File) => {
    if (file.size > MAX_VIDEO_BYTES) {
      showToast.error('Video too large', `Please use a file under ${(MAX_VIDEO_BYTES / (1024 * 1024)).toFixed(0)} MB - a short, compressed 720p clip is plenty for a TV screen.`);
      return;
    }
    setUploadingVideoId(fixtureId);
    setVideoUploadProgress(0);
    try {
      const { url } = await uploadFileToR2(functionsBaseUrl, file, 'fixture-videos', ({ bytesUploaded, bytesTotal }) => {
        setVideoUploadProgress(bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      });
      setFixtures((prev) => {
        const next = prev.map((f) => (f.id === fixtureId ? { ...f, videoUrl: url } : f));
        persist(next);
        return next;
      });
      showToast.success('Video uploaded', 'Visible on every device that opens this model');
    } catch (error) {
      showToast.error('Could not upload video', error instanceof Error ? error.message : undefined);
    } finally {
      setUploadingVideoId(null);
    }
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
          const isUploading = uploadingVideoId === fixture.id;
          return (
            <div key={fixture.id} className="p-2.5 bg-slate-800/50 border border-slate-700/80 rounded-lg group space-y-1.5">
              <div className="flex items-center gap-2">
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
              {fixture.type === 'tv' && (
                isUploading ? (
                  <div className="text-[11px] text-cyan-300">Uploading video... {videoUploadProgress}%</div>
                ) : (
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer w-fit">
                    <Upload className="w-3 h-3" />
                    {fixture.videoUrl ? 'Replace video' : 'Upload video (plays while On)'}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) uploadFixtureVideo(fixture.id, file);
                      }}
                    />
                  </label>
                )
              )}
              {fixture.type === 'door' && (
                <div className="flex items-center gap-3">
                  <button onClick={() => flipDoorHinge(fixture.id)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300">
                    <FlipHorizontal className="w-3 h-3" /> Flip hinge
                  </button>
                  <button onClick={() => reverseDoorSwing(fixture.id)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300">
                    <FlipHorizontal className="w-3 h-3 rotate-90" /> Reverse swing
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InteractiveFixtures;
