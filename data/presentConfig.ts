/**
 * Per-client branding + presentation settings (config.json).
 *
 * Lookup order, first hit wins (so every client project can have its own folder):
 *   /projects/<projectId>/config.json  ->  /config.json  ->  built-in defaults
 */

export interface PresentNaming {
  /** RegExp source. Group 1 must capture the level number, e.g. Floor_01 -> 1. */
  floor: string;
  /** RegExp source. Group 1 must capture the home number, e.g. Home_101 -> 101. */
  home: string;
  /** RegExp source for roof meshes (hidden whenever a floor is sliced). */
  roof: string;
  /** RegExp source for facade / site meshes hidden in "Interior" view. */
  exterior: string;
}

export interface PresentConfig {
  clientName: string;
  clientLogo: string;
  tagline: string;
  accentColor: string;
  /** https://..., mailto:..., tel:... ({home} is replaced with the home's name). */
  contactLink: string;
  /** If set, a PIN is asked before workspace mode opens. Empty = no PIN. */
  pinCode: string;
  /** Default unit shown first. */
  units: 'm2' | 'ft2';
  /** Where in a level the cut happens: 0 = floor slab, 1 = top of the level. */
  cutHeightRatio: number;
  /** Draw white section caps on the cut face. */
  cutCaps: boolean;
  naming: PresentNaming;
}

export const DEFAULT_CONFIG: PresentConfig = {
  clientName: '',
  clientLogo: '',
  tagline: '',
  accentColor: '#ff4d4f',
  contactLink: '',
  pinCode: '',
  units: 'm2',
  cutHeightRatio: 0.6,
  cutCaps: true,
  naming: {
    floor: '^Floor[_\\-\\s]?(\\d+)',
    home: '^Home[_\\-\\s]?(\\d+)',
    roof: '^Roof',
    exterior: '^(Exterior|Facade|Shell|Site)',
  },
};

/** Fetches JSON, but ignores SPA fallbacks (dev servers/Vercel answer 200 + index.html for unknown files). */
export async function fetchJsonIfPresent<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('json')) {
      // Some static hosts serve .json as text/plain - fall back to trying to parse it.
      const text = await res.text();
      if (text.trimStart().startsWith('<')) return null;
      return JSON.parse(text) as T;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function projectBase(projectId?: string): string[] {
  const safe = projectId ? encodeURIComponent(projectId) : '';
  return safe ? [`/projects/${safe}`, ''] : [''];
}

export async function loadPresentConfig(projectId?: string): Promise<PresentConfig> {
  for (const base of projectBase(projectId)) {
    const raw = await fetchJsonIfPresent<Partial<PresentConfig>>(`${base}/config.json`);
    if (raw && typeof raw === 'object') {
      return {
        ...DEFAULT_CONFIG,
        ...raw,
        naming: { ...DEFAULT_CONFIG.naming, ...(raw.naming || {}) },
      };
    }
  }
  return DEFAULT_CONFIG;
}

/** Only allow safe link schemes for the "Book a call" button. */
export function safeContactHref(link: string, homeName: string): string | null {
  const filled = (link || '').replace(/\{home\}/g, encodeURIComponent(homeName));
  return /^(https?:|mailto:|tel:)/i.test(filled) ? filled : null;
}
