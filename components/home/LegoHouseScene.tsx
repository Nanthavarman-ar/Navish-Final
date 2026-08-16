import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

// Real-time 3D LEGO house build animation (Babylon.js - the engine already used everywhere
// else in this app, so this adds no extra 3D-engine weight to the bundle beyond what the
// workspace already pulls in). This file itself is only loaded via React.lazy() from
// HeroSection.tsx, so none of this - including the @babylonjs/core import - is in the
// initial page bundle; the SVG LegoBuildAnimation is shown as an instant fallback while this
// chunk streams in.
//
// Bricks are procedural BoxGeometry/CylinderGeometry (studs) using Mesh.createInstance() per
// color, not external model files - no .glb assets, matching the "fast loading" requirement.

// Classic LEGO palette
const LEGO_RED = new BABYLON.Color3(0.788, 0.102, 0.035);   // #C91A09
const LEGO_YELLOW = new BABYLON.Color3(0.961, 0.776, 0.094); // #F5C618
const LEGO_BLUE = new BABYLON.Color3(0, 0.337, 0.749);       // #0055BF
const LEGO_GREEN = new BABYLON.Color3(0.137, 0.471, 0.255);  // #237841
const LEGO_ORANGE = new BABYLON.Color3(0.996, 0.541, 0.094); // #FE8A18

interface BrickSpec {
  id: string;
  position: BABYLON.Vector3; // final resting position
  size: { w: number; h: number; d: number };
  color: BABYLON.Color3;
  studPositions: BABYLON.Vector3[]; // local offsets from brick center, on the top face
  buildOrder: number; // lower = lands earlier
  rotationZ?: number; // resting tilt, e.g. for angled roof slabs
}

// Lays out a simple gable-roofed house as a grid of body bricks + two roof slabs + two
// windows + a door, in LEGO plate units (1 unit = 1 brick width). Mirrors the layout of the
// existing SVG LegoBuildAnimation (same house silhouette) so the upgrade reads as "the same
// house, now real 3D" rather than a different design.
function buildHouseBricks(): BrickSpec[] {
  const bricks: BrickSpec[] = [];
  const cols = 4;
  const rows = 3;
  const brickW = 1.0;
  const brickH = 0.6;
  const brickD = 0.8;
  const bodyOriginX = -(cols * brickW) / 2;
  const bodyBaseY = 0;
  const palette = [LEGO_RED, LEGO_BLUE, LEGO_YELLOW, LEGO_GREEN];

  // Body: grid of wall bricks, built bottom row first
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = bodyOriginX + col * brickW + brickW / 2;
      const y = bodyBaseY + row * brickH + brickH / 2;
      bricks.push({
        id: `wall-${row}-${col}`,
        position: new BABYLON.Vector3(x, y, 0),
        size: { w: brickW * 0.94, h: brickH * 0.94, d: brickD },
        color: palette[(row + col) % palette.length],
        studPositions: row === rows - 1 ? [new BABYLON.Vector3(0, brickH / 2, 0)] : [],
        buildOrder: row,
      });
    }
  }

  // Roof: two angled slabs meeting at a ridge, built after the walls
  const roofY = bodyBaseY + rows * brickH;
  const roofSpan = (cols * brickW) / 2 + 0.3;
  const roofSlabLength = Math.sqrt(roofSpan * roofSpan + 1) + 0.2;
  const roofAngle = Math.atan2(1, roofSpan);
  [-1, 1].forEach((side) => {
    bricks.push({
      id: `roof-${side}`,
      position: new BABYLON.Vector3((side * roofSpan) / 2, roofY + 0.5, 0),
      size: { w: roofSlabLength, h: 0.18, d: brickD + 0.3 },
      color: LEGO_ORANGE,
      studPositions: [
        new BABYLON.Vector3(-roofSlabLength / 3, 0.1, 0),
        new BABYLON.Vector3(roofSlabLength / 3, 0.1, 0),
      ],
      buildOrder: rows + 1,
      rotationZ: -side * roofAngle,
    });
  });

  // Windows: flattened, slightly emissive-looking yellow panes on the front face
  [-1, 1].forEach((side) => {
    bricks.push({
      id: `window-${side}`,
      position: new BABYLON.Vector3(side * brickW * 1.2, brickH * 1.5, brickD / 2 + 0.02),
      size: { w: 0.55, h: 0.55, d: 0.05 },
      color: LEGO_YELLOW,
      studPositions: [],
      buildOrder: rows + 2,
    });
  });

  // Door: placed last, dropping straight down into the center
  bricks.push({
    id: 'door',
    position: new BABYLON.Vector3(0, brickH * 0.9, brickD / 2 + 0.02),
    size: { w: 0.7, h: 1.15, d: 0.06 },
    color: LEGO_BLUE,
    studPositions: [],
    buildOrder: rows + 3,
  });

  return bricks;
}

// Classic easeOutElastic - the "snaps into place with a bounce" curve the brief asks for.
function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

const FALL_HEIGHT = 9;
const SETTLE_DURATION = 1.1; // seconds per brick's fall+bounce
const STAGGER_PER_ORDER = 0.22; // seconds between build-order groups
const HOLD_DURATION = 2.2; // seconds the finished house is shown before looping
const JITTER_SEED_SCALE = 12.9898;

// Deterministic pseudo-random per-brick jitter (stable across renders, no Math.random() in
// render so the layout doesn't reshuffle every re-mount).
function hashJitter(seed: number): number {
  const x = Math.sin(seed * JITTER_SEED_SCALE) * 43758.5453;
  return x - Math.floor(x);
}

export function LegoHouseScene({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent - blends with the hero's own gradient/ambient-glow background

    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2 - 0.5,
      Math.PI / 2.6,
      9,
      new BABYLON.Vector3(0, 1.3, 0),
      scene
    );
    camera.fov = 0.55;

    // Studio lighting: soft hemispheric fill + a directional key light casting the contact
    // shadows, plus a warm point light for a bit of colored rim/vibrancy on the plastic.
    const fill = new BABYLON.HemisphericLight('fill', new BABYLON.Vector3(0, 1, 0), scene);
    fill.intensity = 0.55;
    fill.groundColor = new BABYLON.Color3(0.15, 0.18, 0.3);

    const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(-0.6, -1, 0.4), scene);
    key.position = new BABYLON.Vector3(6, 10, -4);
    key.intensity = 1.4;

    const rim = new BABYLON.PointLight('rim', new BABYLON.Vector3(-5, 3, -5), scene);
    rim.diffuse = new BABYLON.Color3(0.4, 0.8, 1);
    rim.intensity = 0.4;

    const shadowGenerator = new BABYLON.ShadowGenerator(1024, key);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 24;

    // Baseplate - a simple dark, faintly glowing ground disc standing in for a LEGO plate.
    const ground = BABYLON.MeshBuilder.CreateGround('baseplate', { width: 10, height: 8 }, scene);
    ground.position.y = -0.02;
    ground.receiveShadows = true;
    const groundMat = new BABYLON.StandardMaterial('baseplateMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.06, 0.1, 0.16);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.15, 0.2);
    ground.material = groundMat;

    // Shared glossy-plastic material per color (one draw call per color across all instances).
    const materialForColor = new Map<string, BABYLON.StandardMaterial>();
    const getMaterial = (color: BABYLON.Color3) => {
      const key = color.toHexString();
      let mat = materialForColor.get(key);
      if (!mat) {
        mat = new BABYLON.StandardMaterial(`mat-${key}`, scene);
        mat.diffuseColor = color;
        mat.specularColor = new BABYLON.Color3(1, 1, 1);
        mat.specularPower = 96; // tight, bright highlight - the "glossy plastic" look, no env map needed
        materialForColor.set(key, mat);
      }
      return mat;
    };

    // Base (template) meshes per color, reused via createInstance() for every brick/stud of
    // that color - real GPU instancing rather than one unique mesh per brick.
    const brickBaseByColor = new Map<string, BABYLON.Mesh>();
    const studBaseByColor = new Map<string, BABYLON.Mesh>();
    const getBrickBase = (color: BABYLON.Color3) => {
      const key = color.toHexString();
      let base = brickBaseByColor.get(key);
      if (!base) {
        base = BABYLON.MeshBuilder.CreateBox(`brickBase-${key}`, { size: 1 }, scene);
        base.material = getMaterial(color);
        base.isVisible = false; // template only - real bricks are instances of this
        brickBaseByColor.set(key, base);
      }
      return base;
    };
    const getStudBase = (color: BABYLON.Color3) => {
      const key = color.toHexString();
      let base = studBaseByColor.get(key);
      if (!base) {
        base = BABYLON.MeshBuilder.CreateCylinder(`studBase-${key}`, { diameter: 0.28, height: 0.14, tessellation: 16 }, scene);
        base.material = getMaterial(color);
        base.isVisible = false;
        studBaseByColor.set(key, base);
      }
      return base;
    };

    const specs = buildHouseBricks();
    interface AnimatedBrick {
      instance: BABYLON.InstancedMesh;
      restPosition: BABYLON.Vector3;
      restRotationZ: number;
      startTime: number;
      fallJitter: BABYLON.Vector3;
    }
    const animated: AnimatedBrick[] = [];
    const maxBuildOrder = Math.max(...specs.map((s) => s.buildOrder));
    const totalCycleDuration = maxBuildOrder * STAGGER_PER_ORDER + SETTLE_DURATION + HOLD_DURATION;

    specs.forEach((spec, i) => {
      const base = getBrickBase(spec.color);
      const instance = base.createInstance(spec.id);
      instance.scaling.set(spec.size.w, spec.size.h, spec.size.d);
      instance.receiveShadows = true;
      shadowGenerator.addShadowCaster(instance);

      const restRotationZ = spec.rotationZ ?? 0;
      const jitterX = (hashJitter(i * 2.1) - 0.5) * 1.6;
      const jitterZ = (hashJitter(i * 3.7) - 0.5) * 1.6;
      instance.position = spec.position.clone();

      // Studs ride along with their parent brick instance automatically (no separate
      // animation entry needed) since they're parented to it. Their scale is counter-scaled
      // against the parent's non-uniform brick scaling, otherwise a wide flat roof slab would
      // squash its studs into ovals instead of round cylinders.
      spec.studPositions.forEach((offset, si) => {
        const studBase = getStudBase(spec.color);
        const stud = studBase.createInstance(`${spec.id}-stud-${si}`);
        stud.parent = instance;
        stud.position = offset.divide(new BABYLON.Vector3(spec.size.w, spec.size.h, spec.size.d));
        stud.scaling.set(1 / spec.size.w, 1 / spec.size.h, 1 / spec.size.d);
        shadowGenerator.addShadowCaster(stud);
      });

      animated.push({
        instance,
        restPosition: spec.position.clone(),
        restRotationZ,
        startTime: spec.buildOrder * STAGGER_PER_ORDER + jitterX * 0.05,
        fallJitter: new BABYLON.Vector3(jitterX, FALL_HEIGHT, jitterZ),
      });
    });

    let elapsed = 0;
    let cameraAngle = camera.alpha;
    scene.onBeforeRenderObservable.add(() => {
      const dt = engine.getDeltaTime() / 1000;
      elapsed += dt;

      // Slow idle turntable rotation, like a product-shot pedestal.
      cameraAngle += dt * 0.08;
      camera.alpha = cameraAngle;

      const cycleTime = elapsed % (totalCycleDuration + 1.2);
      animated.forEach(({ instance, restPosition, restRotationZ, startTime, fallJitter }) => {
        const localT = (cycleTime - startTime) / SETTLE_DURATION;
        const t = Math.min(Math.max(localT, 0), 1);
        // Before startTime, t stays clamped to 0 - the brick just holds at its full
        // fall-start offset (still above the house) rather than starting to move early.
        const eased = localT <= 0 ? 0 : easeOutElastic(t);
        const remaining = 1 - eased;
        instance.position.set(
          restPosition.x + fallJitter.x * remaining,
          restPosition.y + fallJitter.y * remaining,
          restPosition.z + fallJitter.z * remaining
        );
        instance.rotation.z = restRotationZ + 0.6 * remaining;
      });
    });

    engine.runRenderLoop(() => scene.render());

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none', outline: 'none' }} />
    </div>
  );
}
