/**
 * Home data (homes.json). One file per client project:
 *   /projects/<projectId>/homes.json  ->  /homes.json  ->  placeholders built from mesh names
 */
import { fetchJsonIfPresent, projectBase } from './presentConfig';

export type HomeStatus = 'available' | 'reserved' | 'sold';
export type RoomKey = string; // 'living' | 'dining' | 'bedroom' | 'balcony' ... (free text, lower-case)
export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';
export const TIMES_OF_DAY: TimeOfDay[] = ['morning', 'day', 'sunset', 'night'];

export interface Hotspot {
  label: string;
  /** Degrees, 0 = straight ahead when the room opens, positive = right. */
  yaw: number;
  /** Degrees, positive = up. */
  pitch?: number;
  /** Room key to jump to when tapped. */
  target?: RoomKey;
}

export interface Home {
  /** Must equal the mesh name, e.g. "Home_101". */
  id: string;
  name: string;
  /** Level number. Optional: derived from the id (Home_101 -> 1) when missing. */
  floor?: number;
  areaM2: number;
  status: HomeStatus;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  description?: string;
  photos?: string[];
  floorPlan?: string;
  /** Rooms with 360 images, in tab order. */
  rooms?: RoomKey[];
  hotspots?: Record<RoomKey, Hotspot[]>;
}

export interface HomesFile {
  homes: Home[];
}

export const M2_TO_FT2 = 10.76391041671;

export function formatArea(areaM2: number, unit: 'm2' | 'ft2'): string {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return '—';
  return unit === 'm2'
    ? `${Math.round(areaM2 * 10) / 10} m²`
    : `${Math.round(areaM2 * M2_TO_FT2).toLocaleString()} ft²`;
}

export function statusLabel(status: HomeStatus): string {
  return status === 'sold' ? 'Sold' : status === 'reserved' ? 'Reserved' : 'Available';
}

/** Home_101 -> level 1, Home_1204 -> level 12, Home_5 -> level 5. Returns null if no digits. */
export function levelFromHomeNumber(num: string): number | null {
  const n = parseInt(num, 10);
  if (!Number.isFinite(n)) return null;
  return n >= 100 ? Math.floor(n / 100) : n;
}

export function placeholderHome(id: string, level?: number): Home {
  return {
    id,
    name: id.replace(/[_-]+/g, ' ').trim(),
    floor: level,
    areaM2: 0,
    status: 'available',
    description: '',
    photos: [],
    floorPlan: '',
    rooms: ['living', 'dining', 'bedroom', 'balcony'],
    hotspots: {},
  };
}

export async function loadHomes(projectId?: string): Promise<{ homes: Home[]; fromFile: boolean }> {
  for (const base of projectBase(projectId)) {
    const raw = await fetchJsonIfPresent<HomesFile | Home[]>(`${base}/homes.json`);
    const list = Array.isArray(raw) ? raw : raw?.homes;
    if (Array.isArray(list) && list.length) {
      return { homes: list.filter((h) => h && typeof h.id === 'string'), fromFile: true };
    }
  }
  return { homes: [], fromFile: false };
}

/** Where a project's panoramas live: <base>/panoramas/<homeId>_<room>_<time>.jpg */
export function panoramaUrl(projectId: string | undefined, homeId: string, room: string, time: TimeOfDay, suffix = ''): string {
  const base = projectBase(projectId)[0];
  return `${base}/panoramas/${encodeURIComponent(homeId)}_${encodeURIComponent(room)}_${time}${suffix}.jpg`;
}
