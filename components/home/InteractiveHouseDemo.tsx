import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

// Real interactive 3D demo for the hero section - a small procedural house visitors can
// actually drag-orbit, tilt into a dollhouse overview, or walk around, right on the landing
// page (no signup, no model upload) so the "Walkable / Clickable / Dollhouse" claim below it
// is something they can try immediately rather than just read. Procedural geometry (boxes/
// cylinders via CSG-free box unions), not an external .glb, so it costs no extra network
// weight beyond the @babylonjs/core chunk the rest of the app already loads.

export type DemoMode = 'walk' | 'orbit' | 'dollhouse';

const HOUSE_W = 6; // along X
const HOUSE_D = 5; // along Z
const WALL_H = 2.6;
const ROOF_RISE = 1.7;
const WALL_THICK = 0.15;
const FLOOR_Y = 0.1; // floor slab center height

const WALL_COLOR = new BABYLON.Color3(0.88, 0.85, 0.78);
const ROOF_COLOR = new BABYLON.Color3(0.16, 0.18, 0.22);
const DOOR_COLOR = new BABYLON.Color3(0.42, 0.24, 0.13);
const TRIM_COLOR = new BABYLON.Color3(0.96, 0.96, 0.94);
const GLASS_COLOR = new BABYLON.Color3(0.55, 0.85, 0.95);
const GROUND_COLOR = new BABYLON.Color3(0.07, 0.11, 0.17);
const CHIMNEY_COLOR = new BABYLON.Color3(0.35, 0.16, 0.13);
const FOLIAGE_COLOR = new BABYLON.Color3(0.11, 0.32, 0.24);
const TRUNK_COLOR = new BABYLON.Color3(0.22, 0.15, 0.1);
const SOFA_COLOR = new BABYLON.Color3(0.14, 0.42, 0.48);
const WOOD_COLOR = new BABYLON.Color3(0.36, 0.25, 0.16);
const MATTRESS_COLOR = new BABYLON.Color3(0.93, 0.91, 0.86);
const PILLOW_COLOR = new BABYLON.Color3(0.55, 0.8, 0.85);
const RUG_COLOR = new BABYLON.Color3(0.1, 0.24, 0.29);

interface Props {
  mode: DemoMode;
  className?: string;
}

export function InteractiveHouseDemo({ mode, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const arcCameraRef = useRef<BABYLON.ArcRotateCamera | null>(null);
  const walkCameraRef = useRef<BABYLON.UniversalCamera | null>(null);

  // Builds the house + yard once. Mode switching (the effect below) reuses this same scene
  // and just swaps/animates the camera, so toggling Walk/Orbit/Dollhouse never rebuilds or
  // re-flashes the model.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent - blends with the hero's own gradient/ambient-glow background
    scene.collisionsEnabled = true;
    sceneRef.current = scene;

    const matCache = new Map<string, BABYLON.StandardMaterial>();
    const getMat = (name: string, color: BABYLON.Color3, alpha = 1) => {
      let mat = matCache.get(name);
      if (!mat) {
        mat = new BABYLON.StandardMaterial(name, scene);
        mat.diffuseColor = color;
        mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        mat.alpha = alpha;
        matCache.set(name, mat);
      }
      return mat;
    };

    // Studio lighting: soft fill + a directional key casting the contact shadows, plus a
    // cyan rim light matching the hero's own brand accent color.
    const fill = new BABYLON.HemisphericLight('fill', new BABYLON.Vector3(0, 1, 0), scene);
    fill.intensity = 0.6;
    fill.groundColor = new BABYLON.Color3(0.12, 0.15, 0.22);

    const key = new BABYLON.DirectionalLight('key', new BABYLON.Vector3(-0.5, -1, 0.35), scene);
    key.position = new BABYLON.Vector3(8, 12, -6);
    key.intensity = 1.5;

    const rim = new BABYLON.PointLight('rim', new BABYLON.Vector3(-6, 3, -6), scene);
    rim.diffuse = new BABYLON.Color3(0.35, 0.8, 1);
    rim.intensity = 0.35;

    const shadowGenerator = new BABYLON.ShadowGenerator(1024, key);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 24;

    // Yard - also the walkable collision floor for Walk mode.
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 22, height: 18 }, scene);
    ground.material = getMat('groundMat', GROUND_COLOR);
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    // Foundation slab under the house
    const floor = BABYLON.MeshBuilder.CreateBox('floor', { width: HOUSE_W + 0.4, height: 0.2, depth: HOUSE_D + 0.4 }, scene);
    floor.position.y = FLOOR_Y;
    floor.material = getMat('trimMat', TRIM_COLOR);
    floor.receiveShadows = true;
    floor.checkCollisions = true;

    const addWall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const wall = BABYLON.MeshBuilder.CreateBox('wall', { width: w, height: h, depth: d }, scene);
      wall.position.set(x, y, z);
      wall.material = getMat('wallMat', WALL_COLOR);
      wall.receiveShadows = true;
      wall.checkCollisions = true;
      shadowGenerator.addShadowCaster(wall);
      return wall;
    };

    const wallCenterY = FLOOR_Y + 0.1 + WALL_H / 2;
    const wallTopY = FLOOR_Y + 0.1 + WALL_H;

    // Back + side walls: solid
    addWall(HOUSE_W, WALL_H, WALL_THICK, 0, wallCenterY, HOUSE_D / 2);
    addWall(WALL_THICK, WALL_H, HOUSE_D, -HOUSE_W / 2, wallCenterY, 0);
    addWall(WALL_THICK, WALL_H, HOUSE_D, HOUSE_W / 2, wallCenterY, 0);

    // Front wall: split around a centered door opening, with a lintel above the door
    const doorW = 0.95, doorH = 2.05;
    const frontSideW = (HOUSE_W - doorW) / 2;
    const frontSideX = doorW / 2 + frontSideW / 2;
    addWall(frontSideW, WALL_H, WALL_THICK, -frontSideX, wallCenterY, -HOUSE_D / 2);
    addWall(frontSideW, WALL_H, WALL_THICK, frontSideX, wallCenterY, -HOUSE_D / 2);
    addWall(doorW, WALL_H - doorH, WALL_THICK, 0, FLOOR_Y + 0.1 + doorH + (WALL_H - doorH) / 2, -HOUSE_D / 2);

    // Doorway frame only (no solid door panel) - this is a real walk-through opening for
    // Walk mode, not just a decorative facade, so a closed-looking door here would read as
    // broken once you actually try to walk in.
    const addDoorframe = (x: number, z: number, w: number, h: number, rotY: number) => {
      const trimThick = 0.08;
      [-1, 1].forEach((side) => {
        const post = BABYLON.MeshBuilder.CreateBox('doorframePost', { width: trimThick, height: h, depth: trimThick }, scene);
        const localX = (side * w) / 2;
        post.position.set(x + localX * Math.cos(rotY), FLOOR_Y + 0.1 + h / 2, z + localX * Math.sin(rotY));
        post.material = getMat('doorMat', DOOR_COLOR);
        shadowGenerator.addShadowCaster(post);
      });
      const lintel = BABYLON.MeshBuilder.CreateBox('doorframeLintel', { width: w + trimThick, height: trimThick, depth: trimThick }, scene);
      lintel.position.set(x, FLOOR_Y + 0.1 + h, z);
      lintel.rotation.y = rotY;
      lintel.material = getMat('doorMat', DOOR_COLOR);
      shadowGenerator.addShadowCaster(lintel);
    };
    addDoorframe(0, -HOUSE_D / 2 - 0.02, doorW, doorH, 0);

    // Windows - flat glass panels on the wall faces (front pair flanking the door, one per
    // side wall). Kept frameless/simple: a colored glass rectangle reads clearly as a window
    // on its own without extra trim geometry.
    const addWindow = (x: number, y: number, z: number, w: number, h: number, facing: 'front' | 'side') => {
      const dims = facing === 'front'
        ? { width: w, height: h, depth: 0.05 }
        : { width: 0.05, height: h, depth: w };
      const win = BABYLON.MeshBuilder.CreateBox('window', dims, scene);
      win.position.set(x, y, z);
      win.material = getMat('glassMat', GLASS_COLOR, 0.6);
    };
    const winY = wallCenterY + 0.15;
    addWindow(frontSideX, winY, -HOUSE_D / 2 - 0.02, 0.85, 1.0, 'front');
    addWindow(-frontSideX, winY, -HOUSE_D / 2 - 0.02, 0.85, 1.0, 'front');
    addWindow(HOUSE_W / 2 + 0.02, winY, 0, 1.1, 1.0, 'side');
    addWindow(-HOUSE_W / 2 - 0.02, winY, 0, 1.1, 1.0, 'side');

    // Gable roof - ridge runs along Z (front-to-back), two slabs tilting up from the left/
    // right eaves to meet it, same box+rotate technique as the hero's LEGO build animation.
    const roofOverhang = 0.3;
    const roofSpanX = HOUSE_W / 2 + roofOverhang;
    const roofSlabLength = Math.sqrt(roofSpanX * roofSpanX + ROOF_RISE * ROOF_RISE) + 0.15;
    const roofPitchAngle = Math.atan2(ROOF_RISE, roofSpanX);
    const roofDepth = HOUSE_D + roofOverhang * 2;
    [-1, 1].forEach((side) => {
      const slab = BABYLON.MeshBuilder.CreateBox(`roof-${side}`, { width: roofSlabLength, height: 0.14, depth: roofDepth }, scene);
      slab.position.set((side * roofSpanX) / 2, wallTopY + ROOF_RISE / 2, 0);
      slab.rotation.z = -side * roofPitchAngle;
      slab.material = getMat('roofMat', ROOF_COLOR);
      slab.receiveShadows = true;
      shadowGenerator.addShadowCaster(slab);
    });

    // Chimney - a small character detail, doesn't need to be geometrically perfect against
    // the roof slope for a decorative accent.
    const chimney = BABYLON.MeshBuilder.CreateBox('chimney', { width: 0.4, height: 1.1, depth: 0.4 }, scene);
    chimney.position.set(HOUSE_W / 2 - 1, wallTopY + ROOF_RISE * 0.55 + 0.5, HOUSE_D / 2 - 1);
    chimney.material = getMat('chimneyMat', CHIMNEY_COLOR);
    shadowGenerator.addShadowCaster(chimney);

    // A couple of low-poly trees for yard richness.
    const addTree = (x: number, z: number, scale = 1) => {
      const trunk = BABYLON.MeshBuilder.CreateCylinder('trunk', { diameterTop: 0.12 * scale, diameterBottom: 0.16 * scale, height: 0.9 * scale }, scene);
      trunk.position.set(x, 0.2 + (0.45 * scale), z);
      trunk.material = getMat('trunkMat', TRUNK_COLOR);
      shadowGenerator.addShadowCaster(trunk);
      const foliage = BABYLON.MeshBuilder.CreateCylinder('foliage', { diameterTop: 0, diameterBottom: 1.4 * scale, height: 1.8 * scale, tessellation: 8 }, scene);
      foliage.position.set(x, 0.2 + (0.9 * scale) + (0.9 * scale), z);
      foliage.material = getMat('foliageMat', FOLIAGE_COLOR);
      shadowGenerator.addShadowCaster(foliage);
    };
    addTree(-4.3, 2.6, 1);
    addTree(4.6, -2.1, 0.85);

    // Interior: an open-plan split into a living room (front, by the door) and a bedroom
    // (back), furnished so Walk mode has somewhere to actually walk into rather than an
    // empty shell. Deliberately no ceiling - it keeps the interior lit through the windows/
    // door, and means Dollhouse mode's tilted overview reads as a proper cutaway showing
    // the furniture layout, which a solid roof would otherwise hide completely.
    const partitionDoorW = 0.9;
    const partitionSideW = (HOUSE_W - partitionDoorW) / 2;
    const partitionSideX = partitionDoorW / 2 + partitionSideW / 2;
    addWall(partitionSideW, WALL_H, WALL_THICK, -partitionSideX, wallCenterY, 0);
    addWall(partitionSideW, WALL_H, WALL_THICK, partitionSideX, wallCenterY, 0);
    addDoorframe(0, 0, partitionDoorW, 2.05, 0);

    const addFurnitureBox = (name: string, w: number, h: number, d: number, x: number, yBase: number, z: number, color: BABYLON.Color3, rotY = 0, collide = true) => {
      const box = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      box.position.set(x, yBase + h / 2, z);
      box.rotation.y = rotY;
      box.material = getMat(`${name}Mat`, color);
      box.checkCollisions = collide;
      box.receiveShadows = true;
      shadowGenerator.addShadowCaster(box);
      return box;
    };
    const floorTopY = FLOOR_Y + 0.1;

    // Living room (z < 0): a sofa against the right wall facing the room, a coffee table in
    // front of it, and a rug underneath to ground the seating area.
    const sofaZ = -HOUSE_D / 2 + 1.3;
    addFurnitureBox('sofaSeat', 0.65, 0.38, 1.7, HOUSE_W / 2 - 0.55, floorTopY, sofaZ, SOFA_COLOR);
    addFurnitureBox('sofaBack', 0.15, 0.6, 1.7, HOUSE_W / 2 - 0.25, floorTopY, sofaZ, SOFA_COLOR);
    addFurnitureBox('coffeeTable', 0.7, 0.32, 0.45, HOUSE_W / 2 - 1.35, floorTopY, sofaZ, WOOD_COLOR);
    const rug = BABYLON.MeshBuilder.CreateGround('rug', { width: 1.6, height: 2.1 }, scene);
    rug.position.set(HOUSE_W / 2 - 0.9, floorTopY + 0.005, sofaZ);
    rug.material = getMat('rugMat', RUG_COLOR);
    rug.receiveShadows = true;

    // Bedroom (z > 0): a bed against the back wall with a headboard/pillow, plus a small
    // nightstand.
    const bedZ = HOUSE_D / 2 - 1.15;
    const bedX = -HOUSE_W / 2 + 1.2;
    addFurnitureBox('bedFrame', 1.4, 0.3, 2.0, bedX, floorTopY, bedZ, WOOD_COLOR);
    addFurnitureBox('mattress', 1.3, 0.22, 1.9, bedX, floorTopY + 0.3, bedZ, MATTRESS_COLOR, 0, false);
    addFurnitureBox('pillow', 1.1, 0.14, 0.4, bedX, floorTopY + 0.52, bedZ + 0.7, PILLOW_COLOR, 0, false);
    addFurnitureBox('headboard', 1.4, 0.75, 0.1, bedX, floorTopY, bedZ + 1.0, WOOD_COLOR);
    addFurnitureBox('nightstand', 0.4, 0.4, 0.4, bedX - 0.85, floorTopY, bedZ + 0.7, WOOD_COLOR);

    // Orbit/dollhouse camera - a single ArcRotateCamera reused for both modes (see the
    // mode-switch effect below), draggable, with a slow idle turntable that automatically
    // pauses while the visitor is interacting and resumes after they let go.
    const arcCam = new BABYLON.ArcRotateCamera('orbitCam', -Math.PI / 2 - 0.4, Math.PI / 2.35, 11, new BABYLON.Vector3(0, WALL_H * 0.55, 0), scene);
    arcCam.lowerRadiusLimit = 7;
    arcCam.upperRadiusLimit = 17;
    arcCam.lowerBetaLimit = 0.15;
    arcCam.upperBetaLimit = Math.PI / 2.05;
    arcCam.wheelDeltaPercentage = 0.01;
    arcCam.attachControl(canvas, true);
    arcCam.useAutoRotationBehavior = true;
    if (arcCam.autoRotationBehavior) {
      arcCam.autoRotationBehavior.idleRotationSpeed = 0.15;
      arcCam.autoRotationBehavior.idleRotationWaitTime = 1500;
      arcCam.autoRotationBehavior.idleRotationSpinupTime = 1200;
    }
    scene.activeCamera = arcCam;
    arcCameraRef.current = arcCam;

    engine.runRenderLoop(() => scene.render());
    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
      arcCameraRef.current = null;
      walkCameraRef.current = null;
    };
  }, []);

  // Mode switching - reuses the scene built above. Orbit <-> Dollhouse just animates the
  // existing ArcRotateCamera's angle/distance; Walk swaps in a UniversalCamera (created once,
  // then reused) since it needs gravity/collisions rather than an orbit pivot.
  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    const arcCam = arcCameraRef.current;
    if (!scene || !canvas || !arcCam) return;

    if (mode === 'walk') {
      arcCam.detachControl();
      let walkCam = walkCameraRef.current;
      const startPos = new BABYLON.Vector3(0, FLOOR_Y + 1.7, -(HOUSE_D / 2 + 4));
      if (!walkCam) {
        walkCam = new BABYLON.UniversalCamera('walkCam', startPos, scene);
        walkCam.speed = 0.18;
        walkCam.checkCollisions = true;
        walkCam.applyGravity = true;
        // The collision ellipsoid is centered ON the camera (eye height), so its half-height
        // must reach all the way down to the floor - too small (as this first was) and the
        // capsule's bottom never touches the floor mesh, so gravity keeps pulling the
        // camera down until it settles crouched near the floor instead of standing at
        // normal eye height. 1.6 = eye height (FLOOR_Y + 1.7) minus the floor's top surface
        // (FLOOR_Y + 0.1).
        walkCam.ellipsoid = new BABYLON.Vector3(0.4, 1.6, 0.4);
        walkCam.keysUp = [87, 38];
        walkCam.keysDown = [83, 40];
        walkCam.keysLeft = [65, 37];
        walkCam.keysRight = [68, 39];
        walkCameraRef.current = walkCam;
      } else {
        walkCam.position.copyFrom(startPos);
      }
      walkCam.setTarget(new BABYLON.Vector3(0, FLOOR_Y + 1.4, 0));
      scene.activeCamera = walkCam;
      walkCam.attachControl(canvas, true);
    } else {
      walkCameraRef.current?.detachControl();
      scene.activeCamera = arcCam;
      arcCam.attachControl(canvas, true);
      const targetBeta = mode === 'dollhouse' ? Math.PI / 6.2 : Math.PI / 2.35;
      const targetRadius = mode === 'dollhouse' ? 15.5 : 11;
      BABYLON.Animation.CreateAndStartAnimation('demoBetaAnim', arcCam, 'beta', 30, 20, arcCam.beta, targetBeta, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
      BABYLON.Animation.CreateAndStartAnimation('demoRadiusAnim', arcCam, 'radius', 30, 20, arcCam.radius, targetRadius, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    }
  }, [mode]);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none', outline: 'none' }} />
    </div>
  );
}
