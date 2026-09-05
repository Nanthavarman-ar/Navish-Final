import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Mesh, AbstractMesh, TransformNode, MeshBuilder, StandardMaterial, VideoTexture, DynamicTexture, Texture, ParticleSystem, Color3, Color4, Vector3, Scalar, VertexBuffer, PointerEventTypes, PointLight, ArcRotateCamera } from '@babylonjs/core';
import { X, Fan, Lightbulb, Tv, Trash2, Upload, DoorOpen, Flame, Droplets, FlipHorizontal, Wind, CloudRain, User, PawPrint, ArrowUpDown, Warehouse } from 'lucide-react';
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
  { id: 'curtain', label: 'Curtain Flutter', icon: Wind, color: new Color3(0.85, 0.85, 0.9), instruction: 'Click directly on the curtain mesh' },
  { id: 'wind', label: 'Wind Sway', icon: Wind, color: new Color3(0.4, 0.7, 0.35), instruction: 'Click directly on the tree/plant mesh' },
  { id: 'rain', label: 'Window Rain', icon: CloudRain, color: new Color3(0.5, 0.6, 0.75), instruction: 'Click directly on the window glass mesh' },
  { id: 'person', label: 'Person Prop', icon: User, color: new Color3(0.8, 0.7, 0.55), instruction: 'Click the floor spot to stand the figure on' },
  { id: 'pet', label: 'Pet Prop', icon: PawPrint, color: new Color3(0.75, 0.55, 0.35), instruction: 'Click the floor spot to lay the figure on' },
  { id: 'elevator', label: 'Elevator', icon: ArrowUpDown, color: new Color3(0.6, 0.6, 0.65), instruction: 'Click directly on the elevator cabin mesh' },
  { id: 'shutter', label: 'Garage Shutter / Gate', icon: Warehouse, color: new Color3(0.55, 0.55, 0.6), instruction: 'Click directly on the shutter/gate panel mesh' },
];

// A door/cabinet has no reliable way to detect its true hinge edge or which way it should
// swing from geometry alone - this is a reasonable-looking default that the admin corrects
// with the Flip hinge/Reverse swing list controls if it opens from the wrong side.
const DOOR_SWING_DEGREES = 100;
const DOOR_SWING_SPEED = 4; // lerp rate - reaches target in well under a second
const MOVER_SPEED = 1.5; // elevator/shutter lerp rate - a slower, heavier feel than a door
const DEFAULT_ELEVATOR_TRAVEL = 3; // metres - one typical storey height

// A real architectural export that's been merged/optimized for fewer draw calls (e.g.
// gltf-transform's default --join) can leave no separate mesh for a single door/tap/
// curtain at all - everything sharing a material gets combined into one big mesh. Clicking
// what looks like a door then actually picks that whole merged wall/facade, and animating
// it moves/rotates the entire building instead of the small object intended. These caps
// reject a pick whose mesh is implausibly large for what the fixture is meant to be,
// rather than silently corrupting the model - the size a real one could plausibly be,
// generous enough not to reject genuinely large fixtures (a big garage door, a tall
// curtain) while still catching "that's obviously the whole wall".
const MAX_FIXTURE_MESH_SIZE: Partial<Record<FixtureType, number>> = {
  door: 3,
  water: 1.5,
  curtain: 4,
  rain: 5,
  elevator: 5,
  shutter: 10,
  wind: 20,
};

// Curtain/wind sway - a cheap CPU vertex wave (no shader authoring, no per-frame normal
// recompute for performance) rather than true cloth/foliage simulation: displaces each
// vertex sideways by a sine wave whose PHASE depends on height and whose AMPLITUDE is
// scaled by howFar from the anchored end (curtain: anchored at the top rail, sways more
// toward the bottom hem; tree: anchored at the trunk base, sways more toward the crown).
interface VertexWaveState {
  mesh: AbstractMesh;
  originalPositions: Float32Array;
  minY: number;
  maxY: number;
  anchorAtTop: boolean; // true for curtain (anchored at top), false for wind/tree (anchored at base)
}

function setupVertexWave(mesh: AbstractMesh, anchorAtTop: boolean): VertexWaveState | null {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return null;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < minY) minY = positions[i];
    if (positions[i] > maxY) maxY = positions[i];
  }
  return { mesh, originalPositions: Float32Array.from(positions), minY, maxY, anchorAtTop };
}

function applyVertexWave(state: VertexWaveState, time: number, amplitude: number, frequency: number, speed: number): void {
  const { mesh, originalPositions, minY, maxY, anchorAtTop } = state;
  const range = Math.max(0.001, maxY - minY);
  const positions = new Float32Array(originalPositions.length);
  for (let i = 0; i < originalPositions.length; i += 3) {
    const x = originalPositions[i];
    const y = originalPositions[i + 1];
    const z = originalPositions[i + 2];
    const t = (y - minY) / range; // 0 at bottom, 1 at top
    const distFromAnchor = anchorAtTop ? 1 - t : t;
    const wave = Math.sin(time * speed + y * frequency) * amplitude * distFromAnchor * distFromAnchor;
    positions[i] = x + wave;
    positions[i + 1] = y;
    positions[i + 2] = z;
  }
  mesh.updateVerticesData(VertexBuffer.PositionKind, positions, true);
}

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

// There's no real rigged character asset available to place (this isn't something code
// can generate - an actual person/pet model needs real 3D art and rigging), so these are
// honest stylized placeholder figures built from primitives, not a photorealistic person.
// Still real geometry with a real idle animation though (head bob + a "mouth" that opens/
// closes while "talking", see the render loop), not a flat cutout - good enough to convey
// the human/pet scale of a room the way the feature is actually meant to.
interface PersonPropParts { root: TransformNode; head: Mesh; mouth: Mesh; }

function createPersonProp(scene: Scene, id: string, position: Vector3, variant: 'standing' | 'sitting'): PersonPropParts {
  const root = new TransformNode(`fixture_person_root_${id}`, scene);
  root.position = position.clone();

  const skin = new StandardMaterial(`fixture_person_skin_${id}`, scene);
  skin.diffuseColor = new Color3(0.85, 0.68, 0.55);
  const clothes = new StandardMaterial(`fixture_person_clothes_${id}`, scene);
  clothes.diffuseColor = new Color3(0.25, 0.35, 0.55);
  const mouthMat = new StandardMaterial(`fixture_person_mouth_${id}`, scene);
  mouthMat.diffuseColor = new Color3(0.35, 0.12, 0.12);

  // Sitting drops the whole figure onto a lower "seat height" and bends the legs forward
  // instead of hanging straight down, roughly like sitting on a sofa/chair placed at that
  // spot - the fixture doesn't know the sofa's own seat height, so this is a reasonable
  // generic approximation the admin can nudge into place afterward if needed.
  const sitting = variant === 'sitting';
  const seatY = sitting ? 0.45 : 0;
  const headY = (sitting ? 1.05 : 1.58);

  const head = MeshBuilder.CreateSphere(`fixture_person_head_${id}`, { diameter: 0.22 }, scene);
  head.position.y = headY;
  head.material = skin;
  head.parent = root;

  // Small dark box near the chin - the "mouth" the render loop pulses open/closed while
  // this fixture is "on" (talking), rather than a static idle figure.
  const mouth = MeshBuilder.CreateBox(`fixture_person_mouth_${id}`, { width: 0.06, height: 0.02, depth: 0.03 }, scene);
  mouth.position.set(0, headY - 0.08, 0.1);
  mouth.material = mouthMat;
  mouth.parent = root;

  const torso = MeshBuilder.CreateCapsule(`fixture_person_torso_${id}`, { height: 0.55, radius: 0.16 }, scene);
  torso.position.y = (sitting ? 0.75 : 1.18);
  torso.material = clothes;
  torso.parent = root;

  const legPositions: [number, number][] = [[-0.09, 0.5], [0.09, 0.5]];
  const armPositions: [number, number][] = [[-0.24, 1.02], [0.24, 1.02]];
  legPositions.forEach(([x], i) => {
    const leg = MeshBuilder.CreateCylinder(`fixture_person_leg_${id}_${i}`, { height: 0.5, diameterTop: 0.13, diameterBottom: 0.1 }, scene);
    if (sitting) {
      // Bent forward from the hip (seat height) rather than hanging straight down.
      leg.rotation.x = Math.PI / 2;
      leg.position.set(x, seatY, 0.25);
    } else {
      leg.position.set(x, 0.25, 0);
    }
    leg.material = clothes;
    leg.parent = root;
  });
  armPositions.forEach(([x, y], i) => {
    const arm = MeshBuilder.CreateCylinder(`fixture_person_arm_${id}_${i}`, { height: 0.45, diameter: 0.08 }, scene);
    arm.position.set(x, (sitting ? y - 0.55 : y - 0.225), 0);
    arm.material = skin;
    arm.parent = root;
  });

  return { root, head, mouth };
}

interface PetPropParts { root: TransformNode; body: Mesh; }

function createPetProp(scene: Scene, id: string, position: Vector3, variant: 'dog' | 'cat' | 'bird'): PetPropParts {
  const root = new TransformNode(`fixture_pet_root_${id}`, scene);
  root.position = position.clone();

  const fur = new StandardMaterial(`fixture_pet_fur_${id}`, scene);
  fur.diffuseColor = variant === 'cat' ? new Color3(0.3, 0.3, 0.32) : variant === 'bird' ? new Color3(0.5, 0.35, 0.2) : new Color3(0.55, 0.4, 0.25);

  if (variant === 'bird') {
    // Perched/standing pose, much smaller than the dog/cat - a round body, a small head
    // with a beak, two flat wing shapes folded at its sides, thin legs.
    const body = MeshBuilder.CreateSphere(`fixture_pet_body_${id}`, { diameterX: 0.14, diameterY: 0.12, diameterZ: 0.2 }, scene);
    body.position.y = 0.14;
    body.material = fur;
    body.parent = root;

    const head = MeshBuilder.CreateSphere(`fixture_pet_head_${id}`, { diameter: 0.08 }, scene);
    head.position.set(0, 0.2, 0.11);
    head.material = fur;
    head.parent = root;

    const beakMat = new StandardMaterial(`fixture_pet_beak_${id}`, scene);
    beakMat.diffuseColor = new Color3(0.9, 0.7, 0.1);
    const beak = MeshBuilder.CreateCylinder(`fixture_pet_beak_${id}`, { height: 0.05, diameterTop: 0, diameterBottom: 0.03 }, scene);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.2, 0.16);
    beak.material = beakMat;
    beak.parent = root;

    [-1, 1].forEach((side, i) => {
      const wing = MeshBuilder.CreatePlane(`fixture_pet_wing_${id}_${i}`, { width: 0.14, height: 0.08 }, scene);
      wing.position.set(side * 0.08, 0.15, 0);
      wing.rotation.y = side * 0.3;
      wing.material = fur;
      wing.parent = root;
    });

    [-1, 1].forEach((side, i) => {
      const leg = MeshBuilder.CreateCylinder(`fixture_pet_leg_${id}_${i}`, { height: 0.08, diameter: 0.012 }, scene);
      leg.position.set(side * 0.03, 0.04, 0);
      leg.material = beakMat;
      leg.parent = root;
    });

    return { root, body };
  }

  // Dog/cat share the same lying-down construction - a squashed body capsule close to the
  // floor, head resting forward - just sized and colored differently.
  const scale = variant === 'cat' ? 0.75 : 1;
  const body = MeshBuilder.CreateCapsule(`fixture_pet_body_${id}`, { height: 0.5 * scale, radius: 0.13 * scale }, scene);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.13 * scale;
  body.material = fur;
  body.parent = root;

  const head = MeshBuilder.CreateSphere(`fixture_pet_head_${id}`, { diameter: 0.18 * scale }, scene);
  head.position.set(0.32 * scale, 0.12 * scale, 0);
  head.material = fur;
  head.parent = root;

  // A cat's ears are proportionally larger/more pointed than a dog's - approximated here
  // with a taller, narrower cone rather than a real ear shape.
  const earHeight = variant === 'cat' ? 0.1 : 0.07;
  const ear1 = MeshBuilder.CreateCylinder(`fixture_pet_ear_${id}_0`, { height: earHeight, diameterTop: 0, diameterBottom: 0.05 * scale }, scene);
  ear1.position.set(0.34 * scale, (0.2 + earHeight / 2) * scale, 0.06 * scale);
  ear1.material = fur;
  ear1.parent = root;
  const ear2 = ear1.clone(`fixture_pet_ear_${id}_1`);
  ear2.position.z = -0.06 * scale;
  ear2.parent = root;

  if (variant === 'cat') {
    // A curled tail is one of the clearest cat-vs-dog silhouette cues even at this level
    // of abstraction.
    const tail = MeshBuilder.CreateTorus(`fixture_pet_tail_${id}`, { diameter: 0.18, thickness: 0.025, tessellation: 12 }, scene);
    tail.position.set(-0.28, 0.2, 0);
    tail.rotation.x = Math.PI / 2;
    tail.material = fur;
    tail.parent = root;
  }

  return { root, body };
}

// A scrolling procedural rain-streak texture on a thin transparent plane placed just in
// front of the window mesh (same "toward camera" offset technique already used for swatch
// popups, so it never clips into the glass) - not a real fluid simulation, just vertical
// translucent streaks whose V-offset scrolls down every frame to read as water sliding
// down glass.
function createRainTexture(scene: Scene, id: string): DynamicTexture {
  const width = 128, height = 128;
  const texture = new DynamicTexture(`fixture_rain_tex_${id}`, { width, height }, scene, false);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, width, height);
  const streakCount = 26;
  for (let i = 0; i < streakCount; i++) {
    const x = Math.random() * width;
    const streakHeight = 20 + Math.random() * 60;
    const y = Math.random() * height;
    const alpha = 0.15 + Math.random() * 0.25;
    ctx.strokeStyle = `rgba(200,220,235,${alpha})`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y + streakHeight);
    ctx.stroke();
  }
  texture.update();
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
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
  // 'elevator'/'shutter' - wraps the cabin/panel mesh in a TransformNode (same reason as
  // hingeNodesRef: avoids touching the mesh's own pivot) and translates that node up/down.
  // baseY is the node's Y at setup time (its resting/closed position), captured once and
  // never re-derived from the mesh afterward - once the mesh is parented under this node,
  // ITS OWN world Y keeps changing as the node moves, so re-reading it each frame would
  // make "resting position" a moving target.
  const moverNodesRef = useRef<Map<string, { node: TransformNode; baseY: number }>>(new Map());
  const vertexWavesRef = useRef<Map<string, VertexWaveState>>(new Map());
  const rainOverlaysRef = useRef<Map<string, { plane: Mesh; texture: DynamicTexture }>>(new Map());
  const propNodesRef = useRef<Map<string, (PersonPropParts | PetPropParts) & { variant: string }>>(new Map());
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
      const needsLiveTransform = fixture.type === 'fan' || fixture.type === 'door'
        || fixture.type === 'elevator' || fixture.type === 'shutter'
        || fixture.type === 'curtain' || fixture.type === 'wind';
      if (needsLiveTransform) {
        // The load-time performance optimization freezes every static mesh's world
        // matrix (see BabylonWorkspace.tsx's model-load effect) since real architectural
        // imports have thousands of meshes that never move - every fixture type that
        // actually animates its mesh's transform or vertices (spin, swing, slide, sway)
        // is a deliberate, permanent exception to that, since a frozen world matrix would
        // make the animation happen exactly nowhere.
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

  // Wraps the cabin/panel mesh for each 'elevator'/'shutter' fixture in its own
  // TransformNode (setParent preserves current world transform, same reasoning as the
  // door hinge above) so the render loop can translate that node up/down without ever
  // touching the mesh's own pivot/position directly.
  useEffect(() => {
    const currentIds = new Set(fixtures.filter((f) => f.type === 'elevator' || f.type === 'shutter').map((f) => f.id));
    moverNodesRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        const child = entry.node.getChildren()[0];
        if (child && 'setParent' in child) (child as Mesh).setParent(null);
        entry.node.dispose();
        moverNodesRef.current.delete(id);
      }
    });

    fixtures.forEach((fixture) => {
      if ((fixture.type !== 'elevator' && fixture.type !== 'shutter') || moverNodesRef.current.has(fixture.id)) return;
      const mesh = resolveFixtureMesh(fixture);
      if (!mesh) return;
      const node = new TransformNode(`fixture_mover_${fixture.id}`, scene);
      node.position = mesh.getBoundingInfo().boundingBox.centerWorld.clone();
      mesh.setParent(node);
      moverNodesRef.current.set(fixture.id, { node, baseY: node.position.y });
    });
  }, [fixtures, scene, resolveFixtureMesh]);

  // Caches each 'curtain'/'wind' fixture's original vertex positions once, so the render
  // loop below can displace them from a stable baseline every frame rather than drifting
  // (re-reading already-displaced positions as the new "original" would compound).
  useEffect(() => {
    const currentIds = new Set(fixtures.filter((f) => f.type === 'curtain' || f.type === 'wind').map((f) => f.id));
    vertexWavesRef.current.forEach((_, id) => {
      if (!currentIds.has(id)) vertexWavesRef.current.delete(id);
    });

    fixtures.forEach((fixture) => {
      if ((fixture.type !== 'curtain' && fixture.type !== 'wind') || vertexWavesRef.current.has(fixture.id)) return;
      const mesh = resolveFixtureMesh(fixture);
      if (!mesh) return;
      const state = setupVertexWave(mesh, fixture.type === 'curtain');
      if (state) vertexWavesRef.current.set(fixture.id, state);
    });
  }, [fixtures, resolveFixtureMesh]);

  // Creates/removes the scrolling rain-streak overlay plane for each 'rain' fixture,
  // positioned a real distance toward wherever it was placed's mesh normal-ish direction
  // (approximated as "toward the room center from the window", since a window mesh's own
  // face normal isn't reliably known without inspecting its geometry) - shown/hidden with
  // isOn rather than removed, so toggling doesn't repeatedly recreate the texture.
  useEffect(() => {
    const currentIds = new Set(fixtures.filter((f) => f.type === 'rain').map((f) => f.id));
    rainOverlaysRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        entry.plane.dispose(false, true);
        rainOverlaysRef.current.delete(id);
      }
    });

    fixtures.forEach((fixture) => {
      if (fixture.type !== 'rain') return;
      let entry = rainOverlaysRef.current.get(fixture.id);
      if (!entry) {
        const mesh = resolveFixtureMesh(fixture);
        const bb = mesh?.getBoundingInfo().boundingBox;
        const width = bb ? Math.max(0.4, bb.maximumWorld.x - bb.minimumWorld.x) : 1.2;
        const height = bb ? Math.max(0.4, bb.maximumWorld.y - bb.minimumWorld.y) : 1.2;
        const plane = MeshBuilder.CreatePlane(`fixture_rain_plane_${fixture.id}`, { width, height }, scene);
        plane.position = new Vector3(fixture.position.x, fixture.position.y, fixture.position.z + 0.02);
        const texture = createRainTexture(scene, fixture.id);
        const mat = new StandardMaterial(`fixture_rain_mat_${fixture.id}`, scene);
        // Same "unlit, self-shown" approach as the TV screen material - emissiveTexture
        // (not diffuseTexture) is what makes the streaks show at a consistent brightness
        // regardless of the room's actual lighting.
        mat.emissiveTexture = texture;
        mat.emissiveColor = new Color3(1, 1, 1);
        mat.opacityTexture = texture;
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        plane.material = mat;
        entry = { plane, texture };
        rainOverlaysRef.current.set(fixture.id, entry);
      }
      entry.plane.setEnabled(fixture.isOn);
    });
  }, [fixtures, scene, resolveFixtureMesh]);

  // Creates/removes the procedural person/pet prop for each fixture - built from
  // primitives (see createPersonProp/createPetProp) rather than a real character asset,
  // which isn't something code can produce. Visible/hidden with isOn like the rain
  // overlay, not recreated on every toggle.
  useEffect(() => {
    const currentIds = new Set(fixtures.filter((f) => f.type === 'person' || f.type === 'pet').map((f) => f.id));
    propNodesRef.current.forEach((entry, id) => {
      if (!currentIds.has(id)) {
        // true: also dispose the skin/clothes/fur materials created just for this prop
        // (see createPersonProp/createPetProp) - they're never shared with anything else.
        entry.root.dispose(false, true);
        propNodesRef.current.delete(id);
      }
    });

    fixtures.forEach((fixture) => {
      if (fixture.type !== 'person' && fixture.type !== 'pet') return;
      const wantedVariant = fixture.type === 'person' ? (fixture.personVariant ?? 'standing') : (fixture.petVariant ?? 'dog');
      const existing = propNodesRef.current.get(fixture.id);
      // Switching pose/variant (the list controls below) rebuilds the prop rather than
      // trying to reshape the existing one in place.
      if (existing && existing.variant !== wantedVariant) {
        existing.root.dispose(false, true);
        propNodesRef.current.delete(fixture.id);
      }
      if (!propNodesRef.current.has(fixture.id)) {
        const position = new Vector3(fixture.position.x, fixture.position.y, fixture.position.z);
        const parts = fixture.type === 'person'
          ? createPersonProp(scene, fixture.id, position, wantedVariant as 'standing' | 'sitting')
          : createPetProp(scene, fixture.id, position, wantedVariant as 'dog' | 'cat' | 'bird');
        propNodesRef.current.set(fixture.id, { ...parts, variant: wantedVariant });
      }
      propNodesRef.current.get(fixture.id)!.root.setEnabled(fixture.isOn);
    });
  }, [fixtures, scene]);

  // Fan spin, TV flicker, door/elevator/shutter movement lerp, fire flicker, curtain/wind
  // sway (fan/TV/fire only while "on"; door/elevator/shutter run regardless so they can
  // smoothly move back to their CLOSED/resting position once switched off, not just freeze
  // wherever they were; curtain/wind only sway while "on", holding still at rest otherwise)
  // - one shared render loop rather than one observer per fixture.
  const waveTimeRef = useRef(0);
  useEffect(() => {
    const observer = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      waveTimeRef.current += dt;
      fixturesRef.current.forEach((fixture) => {
        if (fixture.type === 'door') {
          const hingeEntry = hingeNodesRef.current.get(fixture.id);
          if (!hingeEntry) return;
          const targetDeg = fixture.isOn ? DOOR_SWING_DEGREES * (fixture.swingReversed ? -1 : 1) : 0;
          const targetRad = (targetDeg * Math.PI) / 180;
          hingeEntry.node.rotation.y = Scalar.Lerp(hingeEntry.node.rotation.y, targetRad, Math.min(1, dt * DOOR_SWING_SPEED));
          return;
        }
        if (fixture.type === 'elevator' || fixture.type === 'shutter') {
          const entry = moverNodesRef.current.get(fixture.id);
          if (!entry) return;
          let travel = fixture.travelHeight ?? DEFAULT_ELEVATOR_TRAVEL;
          if (fixture.type === 'shutter') {
            // Rolls up out of the way over its own height, rather than a fixed distance -
            // extendSizeWorld (half-size) doesn't change as the node translates, only its
            // position does, so this stays correct every frame.
            const mesh = resolveFixtureMesh(fixture);
            travel = mesh ? mesh.getBoundingInfo().boundingBox.extendSizeWorld.y * 2 : DEFAULT_ELEVATOR_TRAVEL;
          }
          const targetY = fixture.isOn ? entry.baseY + travel : entry.baseY;
          const prevY = entry.node.position.y;
          entry.node.position.y = Scalar.Lerp(prevY, targetY, Math.min(1, dt * MOVER_SPEED));
          // An elevator that visually rises while the viewer just floats in place looks
          // broken - carries the camera along by the same delta this frame, but only when
          // it's actually standing in/on the cabin (checked against the cabin mesh's own
          // horizontal footprint each frame, not just once at placement, since the viewer
          // walks in and out of it). Works the same way for the WebXR camera in VR - it IS
          // scene.activeCamera during an XR session in Babylon, so this needs no special
          // casing for headset use.
          if (fixture.type === 'elevator') {
            const deltaY = entry.node.position.y - prevY;
            const camera = scene.activeCamera;
            const mesh = resolveFixtureMesh(fixture);
            if (camera && mesh && Math.abs(deltaY) > 1e-6) {
              const bb = mesh.getBoundingInfo().boundingBox;
              const margin = 0.3;
              const withinX = camera.position.x >= bb.minimumWorld.x - margin && camera.position.x <= bb.maximumWorld.x + margin;
              const withinZ = camera.position.z >= bb.minimumWorld.z - margin && camera.position.z <= bb.maximumWorld.z + margin;
              const withinY = camera.position.y >= bb.minimumWorld.y - 0.5 && camera.position.y <= bb.maximumWorld.y + 2.5;
              if (withinX && withinZ && withinY) {
                // ArcRotateCamera's own .position is recomputed every frame from
                // alpha/beta/radius/target - setting it directly would just get
                // overwritten; moving its target instead is what actually carries the
                // orbit pivot (and so the camera) up with the cabin.
                if (camera instanceof ArcRotateCamera) camera.target.y += deltaY;
                else camera.position.y += deltaY;
              }
            }
          }
          return;
        }
        if (fixture.type === 'curtain' || fixture.type === 'wind') {
          if (!fixture.isOn) return;
          const state = vertexWavesRef.current.get(fixture.id);
          if (!state) return;
          // Curtains flutter faster/smaller (a light breeze through a window); trees/
          // plants sway slower/wider (whole branches, not just fabric).
          if (fixture.type === 'curtain') applyVertexWave(state, waveTimeRef.current, 0.04, 3, 2.2);
          else applyVertexWave(state, waveTimeRef.current, 0.12, 0.6, 0.8);
          return;
        }
        if (fixture.type === 'rain') {
          if (!fixture.isOn) return;
          const entry = rainOverlaysRef.current.get(fixture.id);
          // Scrolling the texture's V-offset (rather than moving the plane) is what
          // actually reads as streaks sliding down the glass, not just a static overlay.
          if (entry) entry.texture.vOffset = (entry.texture.vOffset + dt * 0.4) % 1;
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
        } else if (fixture.type === 'person') {
          // "Talking": a small head bob plus the mouth box pulsing open/closed - about the
          // only way to read as "speaking" from a primitive figure with no real face rig.
          const entry = propNodesRef.current.get(fixture.id);
          if (entry && 'mouth' in entry) {
            const t = waveTimeRef.current;
            entry.head.rotation.x = Math.sin(t * 2.4) * 0.05;
            const mouthOpen = Math.max(0, Math.sin(t * 9));
            entry.mouth.scaling.y = 0.4 + mouthOpen * 1.6;
          }
        } else if (fixture.type === 'pet') {
          // Idle breathing - a small, slow scale pulse on the body rather than a static prop.
          const entry = propNodesRef.current.get(fixture.id);
          if (entry && 'body' in entry) {
            const breathe = 1 + Math.sin(waveTimeRef.current * 1.6) * 0.03;
            entry.body.scaling.set(breathe, 1, breathe);
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
      videoTexturesRef.current.forEach((entry) => entry.texture.dispose());
      videoTexturesRef.current.clear();
      hingeNodesRef.current.forEach((entry) => detachHinge(entry));
      hingeNodesRef.current.clear();
      particleSystemsRef.current.forEach((ps) => ps.dispose());
      particleSystemsRef.current.clear();
      dotTextureRef.current?.dispose();
      dotTextureRef.current = null;
      moverNodesRef.current.forEach((entry) => {
        const child = entry.node.getChildren()[0];
        if (child && 'setParent' in child) (child as Mesh).setParent(null);
        entry.node.dispose();
      });
      moverNodesRef.current.clear();
      vertexWavesRef.current.clear();
      rainOverlaysRef.current.forEach((entry) => entry.plane.dispose(false, true));
      rainOverlaysRef.current.clear();
      propNodesRef.current.forEach((entry) => entry.root.dispose(false, true));
      propNodesRef.current.clear();
    };
  }, []);

  const toggleFixture = useCallback((id: string) => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, isOn: !f.isOn } : f));
      persist(next);
      return next;
    });
  }, [persist]);

  // Click-to-place: arm "Add Fan/Light/TV/..." then click a spot on the model. Fan/TV/Door/
  // Curtain/Wind/Rain/Elevator/Shutter need an actual mesh hit - there's nothing to spin/
  // light up/swing/sway/travel otherwise; Light/Fire/Water/Person/Pet can be placed on bare
  // space too, since they create a real light/particle/prop there with no mesh needed.
  useEffect(() => {
    if (!placingType) return;
    const typeInfo = FIXTURE_TYPES.find((t) => t.id === placingType)!;
    const MESH_REQUIRED_TYPES: FixtureType[] = ['fan', 'tv', 'door', 'curtain', 'wind', 'rain', 'elevator', 'shutter'];
    const requiresMesh = MESH_REQUIRED_TYPES.includes(placingType);
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
      if (pickResult.pickedMesh) {
        const maxSize = MAX_FIXTURE_MESH_SIZE[placingType];
        if (maxSize) {
          const bb = pickResult.pickedMesh.getBoundingInfo().boundingBox;
          const size = bb.maximumWorld.subtract(bb.minimumWorld);
          const largest = Math.max(size.x, size.y, size.z);
          if (largest > maxSize) {
            showToast.error(
              `That looks like part of the building, not a separate ${typeInfo.label.toLowerCase()}`,
              `It's ${largest.toFixed(1)}m across. If this model doesn't have the ${typeInfo.label.toLowerCase()} as its own separate piece (common if it was merged/optimized for fewer draw calls), this feature can't isolate just it - try a model where it's a distinct mesh.`
            );
            return;
          }
        }
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

  // A real floor-to-floor height varies by building and can't be measured from the cabin
  // mesh alone, so this is a manual input rather than a guess like the door's hinge side.
  const updateElevatorTravel = (id: string, meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return;
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, travelHeight: meters } : f));
      persist(next);
      return next;
    });
  };

  const setPersonVariant = (id: string, variant: 'standing' | 'sitting') => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, personVariant: variant } : f));
      persist(next);
      return next;
    });
  };

  const setPetVariant = (id: string, variant: 'dog' | 'cat' | 'bird') => {
    setFixtures((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, petVariant: variant } : f));
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
              {fixture.type === 'elevator' && (
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  Travel height (m):
                  <input
                    type="number"
                    min={0.5}
                    step={0.1}
                    defaultValue={fixture.travelHeight ?? DEFAULT_ELEVATOR_TRAVEL}
                    onBlur={(e) => updateElevatorTravel(fixture.id, parseFloat(e.target.value))}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-100"
                  />
                </label>
              )}
              {fixture.type === 'person' && (
                <div className="flex items-center gap-3 text-[11px]">
                  {(['standing', 'sitting'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setPersonVariant(fixture.id, v)}
                      className={(fixture.personVariant ?? 'standing') === v ? 'text-cyan-300 font-medium' : 'text-slate-400 hover:text-cyan-300'}
                    >
                      {v === 'standing' ? 'Standing' : 'Sitting'}
                    </button>
                  ))}
                  <span className="text-slate-500">- On = talking</span>
                </div>
              )}
              {fixture.type === 'pet' && (
                <div className="flex items-center gap-3 text-[11px]">
                  {(['dog', 'cat', 'bird'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setPetVariant(fixture.id, v)}
                      className={(fixture.petVariant ?? 'dog') === v ? 'text-cyan-300 font-medium capitalize' : 'text-slate-400 hover:text-cyan-300 capitalize'}
                    >
                      {v}
                    </button>
                  ))}
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
