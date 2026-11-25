/**
 * Finds floors, homes, roof and exterior meshes in whatever model a client project loaded.
 * Everything is driven by the naming patterns in config.json, so no mesh name is hard-coded.
 * Matching also looks at parent nodes, because glTF exports often put the real name on a
 * TransformNode and give the mesh child a name like "Home_101_primitive0".
 */
import type { AbstractMesh, Node, Scene } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import type { PresentNaming } from '../data/presentConfig';
import { levelFromHomeNumber } from '../data/homesData';

export const PRESENT_PREFIX = '__present_';

export interface HomeEntry {
  id: string;
  meshes: AbstractMesh[];
  level: number;
  /** World-space point just above the home, used for pins. */
  top: Vector3;
}

export interface LevelEntry {
  level: number;
  /** Meshes cut and shown when this level is the top. */
  meshes: AbstractMesh[];
  minY: number;
  maxY: number;
  center: Vector3;
  size: Vector3;
}

export interface Building {
  levels: LevelEntry[];
  homes: HomeEntry[];
  roof: AbstractMesh[];
  exterior: AbstractMesh[];
  /** mesh -> level, for tap-to-slice and for fading everything above a level. */
  levelOf: Map<AbstractMesh, number>;
  center: Vector3;
  size: Vector3;
  /** True when the model follows the Floor_NN / Home_NNN convention. */
  hasFloors: boolean;
}

function safeRegExp(source: string): RegExp | null {
  try {
    return new RegExp(source, 'i');
  } catch {
    return null;
  }
}

function firstMatch(node: Node | null, re: RegExp): { name: string; match: RegExpMatchArray } | null {
  let cur: Node | null = node;
  while (cur) {
    const m = re.exec(cur.name || '');
    if (m) return { name: cur.name, match: m };
    cur = cur.parent;
  }
  return null;
}

function worldBounds(meshes: AbstractMesh[]): { min: Vector3; max: Vector3 } | null {
  if (!meshes.length) return null;
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    const b = m.getBoundingInfo().boundingBox;
    min.minimizeInPlace(b.minimumWorld);
    max.maximizeInPlace(b.maximumWorld);
  }
  return Number.isFinite(min.x) ? { min, max } : null;
}

export function detectBuilding(scene: Scene, naming: PresentNaming, homeFloors: Record<string, number | undefined> = {}): Building {
  const floorRe = safeRegExp(naming.floor);
  const homeRe = safeRegExp(naming.home);
  const roofRe = safeRegExp(naming.roof);
  const extRe = safeRegExp(naming.exterior);

  const floorMeshes = new Map<number, AbstractMesh[]>();
  const homeMeshes = new Map<string, { meshes: AbstractMesh[]; num: string }>();
  const roof: AbstractMesh[] = [];
  const exterior: AbstractMesh[] = [];

  for (const mesh of scene.meshes) {
    if (mesh.name.startsWith(PRESENT_PREFIX)) continue;
    if (mesh.getTotalVertices() === 0 && mesh.getChildMeshes().length === 0) continue;
    const home = homeRe && firstMatch(mesh, homeRe);
    if (home) {
      const entry = homeMeshes.get(home.name) || { meshes: [], num: home.match[1] || '' };
      entry.meshes.push(mesh);
      homeMeshes.set(home.name, entry);
      continue;
    }
    const floor = floorRe && firstMatch(mesh, floorRe);
    if (floor) {
      const level = parseInt(floor.match[1], 10);
      if (Number.isFinite(level)) {
        floorMeshes.set(level, [...(floorMeshes.get(level) || []), mesh]);
        continue;
      }
    }
    if (roofRe && firstMatch(mesh, roofRe)) roof.push(mesh);
    else if (extRe && firstMatch(mesh, extRe)) exterior.push(mesh);
  }

  // Level of each home: homes.json "floor" > digits of the id > nearest floor by height.
  const levelCenters = new Map<number, number>();
  floorMeshes.forEach((ms, level) => {
    const b = worldBounds(ms);
    if (b) levelCenters.set(level, (b.min.y + b.max.y) / 2);
  });
  const nearestLevel = (y: number): number | null => {
    let best: number | null = null;
    let bestD = Infinity;
    levelCenters.forEach((cy, level) => {
      const d = Math.abs(cy - y);
      if (d < bestD) { bestD = d; best = level; }
    });
    return best;
  };

  const homes: HomeEntry[] = [];
  const levelMeshes = new Map<number, AbstractMesh[]>();
  floorMeshes.forEach((ms, level) => levelMeshes.set(level, [...ms]));

  homeMeshes.forEach((entry, id) => {
    const b = worldBounds(entry.meshes);
    if (!b) return;
    let level = homeFloors[id] ?? levelFromHomeNumber(entry.num);
    if (level == null || (levelCenters.size && !levelCenters.has(level))) {
      level = nearestLevel((b.min.y + b.max.y) / 2) ?? level ?? 1;
    }
    homes.push({
      id,
      meshes: entry.meshes,
      level,
      top: new Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2),
    });
    levelMeshes.set(level, [...(levelMeshes.get(level) || []), ...entry.meshes]);
  });
  homes.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id, undefined, { numeric: true }));

  const levelOf = new Map<AbstractMesh, number>();
  const levels: LevelEntry[] = [...levelMeshes.keys()]
    .sort((a, b) => a - b)
    .map((level) => {
      const meshes = levelMeshes.get(level)!;
      meshes.forEach((m) => levelOf.set(m, level));
      const b = worldBounds(meshes) || { min: Vector3.Zero(), max: Vector3.Zero() };
      return {
        level,
        meshes,
        minY: b.min.y,
        maxY: b.max.y,
        center: b.min.add(b.max).scale(0.5),
        size: b.max.subtract(b.min),
      };
    });

  const whole = scene.getWorldExtends((m) => m.isEnabled() && m.isVisible && !m.name.startsWith(PRESENT_PREFIX) && m.getTotalVertices() > 0);
  const center = whole.min.add(whole.max).scale(0.5);
  const size = whole.max.subtract(whole.min);

  return { levels, homes, roof, exterior, levelOf, center, size, hasFloors: levels.length > 0, };
}

export function buildingSignature(b: Building): string {
  return `${b.levels.length}|${b.homes.map((h) => h.id).join(',')}`;
}
