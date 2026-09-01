import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';

export type PanelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const GAP_PX = 8;
// Matches the base offset every panel already used (top-4/left-4/etc = 1rem) - the first
// panel in a corner keeps exactly the position it had before, only panels after it move.
const BASE_OFFSET_PX = 16;

interface PanelEntry {
  id: string;
  order: number;
  height: number;
}

interface PanelStackContextValue {
  register: (corner: PanelCorner, id: string, order: number) => void;
  unregister: (corner: PanelCorner, id: string) => void;
  setHeight: (corner: PanelCorner, id: string, height: number) => void;
  getOffset: (corner: PanelCorner, id: string) => number;
}

const PanelStackContext = createContext<PanelStackContextValue | null>(null);

// Dozens of floating panels across this app (uiSegments.tsx, ARScalePanel, ChatPanel,
// MoodLightingPanel, etc.) each independently hardcode "fixed top-4 right-4"-style
// classes with zero awareness of any other panel - whichever happen to be open at once
// paint on the exact same pixels (confirmed: 94+ such occurrences across ~38 files).
// This provider is the single shared registry every panel opts into via usePanelStack()
// so panels claiming the same corner stack vertically instead.
export const PanelStackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // A plain mutable registry (not React state) - panels register/unregister and report
  // real heights very frequently (every resize), and only the panels actually sharing an
  // affected corner need to recompute their offset, not the whole provider subtree. Each
  // usePanelStack() consumer holds its own subscription (see the reducer/effect below) so
  // it re-renders only when ITS corner's registry actually changes.
  const registryRef = useRef<Map<PanelCorner, PanelEntry[]>>(new Map());
  const listenersRef = useRef<Map<PanelCorner, Set<() => void>>>(new Map());

  const notify = (corner: PanelCorner) => {
    listenersRef.current.get(corner)?.forEach((listener) => listener());
  };

  const value = useMemo<PanelStackContextValue>(() => ({
    register: (corner, id, order) => {
      const list = registryRef.current.get(corner) ?? [];
      registryRef.current.set(corner, [...list, { id, order, height: 0 }]);
      notify(corner);
    },
    unregister: (corner, id) => {
      const list = registryRef.current.get(corner);
      if (!list) return;
      registryRef.current.set(corner, list.filter((entry) => entry.id !== id));
      notify(corner);
    },
    setHeight: (corner, id, height) => {
      const list = registryRef.current.get(corner);
      if (!list) return;
      const entry = list.find((e) => e.id === id);
      if (!entry || Math.abs(entry.height - height) < 1) return;
      entry.height = height;
      notify(corner);
    },
    getOffset: (corner, id) => {
      const list = registryRef.current.get(corner) ?? [];
      const sorted = [...list].sort((a, b) => a.order - b.order);
      let offset = BASE_OFFSET_PX;
      for (const entry of sorted) {
        if (entry.id === id) break;
        offset += entry.height + GAP_PX;
      }
      return offset;
    },
    // Exposed only for the subscribe mechanism below.
    _subscribe: (corner: PanelCorner, listener: () => void) => {
      const set = listenersRef.current.get(corner) ?? new Set();
      set.add(listener);
      listenersRef.current.set(corner, set);
      return () => set.delete(listener);
    },
  } as PanelStackContextValue & { _subscribe: (corner: PanelCorner, listener: () => void) => () => void }), []);

  return <PanelStackContext.Provider value={value}>{children}</PanelStackContext.Provider>;
};

let nextOrder = 0;
let nextId = 0;

/**
 * Adopts a floating panel into the shared corner-stacking system. Replaces a hardcoded
 * `top-4`/`bottom-4` (or `top-20`/etc) Tailwind class with a dynamic `style.top`/
 * `style.bottom` computed from the real rendered height of every other panel already
 * registered in the same corner - so panels stack instead of overlapping. `left-4`/
 * `right-4` (or whichever horizontal offset the panel already used) stays as-is; only the
 * stacking axis is dynamic. See hooks/usePanelStack.tsx's PanelStackProvider, mounted once
 * in layout/AppLayout.tsx so it covers both AppLayout's own buttons and every panel
 * BabylonWorkspace renders further down the tree.
 */
export function usePanelStack(corner: PanelCorner, active: boolean = true): { ref: (el: HTMLElement | null) => void; style: React.CSSProperties } {
  const ctx = useContext(PanelStackContext) as (PanelStackContextValue & { _subscribe: (corner: PanelCorner, listener: () => void) => () => void }) | null;
  const idRef = useRef<string>(`panel-${nextId++}`);
  const orderRef = useRef<number>(nextOrder++);
  // A ref callback's own identity can't be an effect dependency (it's not reactive
  // state), so the element it captures is mirrored into state here - that's what lets
  // the single effect below re-run exactly when the real DOM node (or `active`) changes,
  // register/unregister exactly once each time, and let React's own cleanup ordering
  // handle every transition (mount, unmount, and the "stays mounted, CSS display
  // toggled" pattern some panels in this app use - LightingPresets keeps its own
  // scene resources alive across visibility toggles, so it's never actually unmounted,
  // only shown/hidden via a class) without a risk of double-registering.
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // Listens for corner-wide changes (a sibling registering/unregistering/resizing) so
  // this panel recomputes its own offset.
  useEffect(() => {
    if (!ctx) return;
    return ctx._subscribe(corner, forceRender);
  }, [ctx, corner]);

  useEffect(() => {
    if (!ctx || !el || !active) return;
    ctx.register(corner, idRef.current, orderRef.current);
    ctx.setHeight(corner, idRef.current, el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? el.getBoundingClientRect().height;
      ctx.setHeight(corner, idRef.current, h);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      ctx.unregister(corner, idRef.current);
    };
  }, [ctx, corner, el, active]);

  if (!ctx) {
    // No provider in the tree (e.g. a panel rendered in isolation/tests) - fall back to
    // the same static offset every panel used before this system existed, rather than
    // throwing.
    const anchor = corner.startsWith('top') ? 'top' : 'bottom';
    return { ref: () => {}, style: { [anchor]: BASE_OFFSET_PX } as React.CSSProperties };
  }

  const anchor = corner.startsWith('top') ? 'top' : 'bottom';
  const offset = ctx.getOffset(corner, idRef.current);
  return { ref: setEl, style: { [anchor]: offset } as React.CSSProperties };
}
