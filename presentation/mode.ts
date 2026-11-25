import { useCallback, useEffect, useState } from 'react';

export type AppMode = 'present' | 'workspace';

function readMode(): AppMode {
  try {
    return new URLSearchParams(window.location.search).get('workspace') === '1' ? 'workspace' : 'present';
  } catch {
    return 'present';
  }
}

/**
 * PRESENT is the default (no login, opens straight from a link/QR).
 * Workspace opens with ?workspace=1 or a 3-second long-press on the screen corner
 * (see ui/CornerLongPress.tsx). Another long-press goes back to present.
 */
export function usePresentMode(): { mode: AppMode; setMode: (m: AppMode) => void } {
  const [mode, setModeState] = useState<AppMode>(readMode);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      const url = new URL(window.location.href);
      if (next === 'workspace') url.searchParams.set('workspace', '1');
      else url.searchParams.delete('workspace');
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onPop = () => setModeState(readMode());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return { mode, setMode };
}
