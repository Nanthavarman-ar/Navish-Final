import { useEffect, useRef, useState } from 'react';
import type { Scene } from '@babylonjs/core';
import type { PresentNaming } from '../data/presentConfig';
import { PRESENT_PREFIX, buildingSignature, detectBuilding, type Building } from './sceneModel';

/**
 * Waits for the workspace scene, then (re)detects floors/homes whenever the loaded model
 * changes. Detection is debounced because a model arrives as many mesh-added events and the
 * workspace post-processes (merges/freezes) them right after loading.
 */
export function useBuilding(
  sceneRef: React.MutableRefObject<Scene | null>,
  naming: PresentNaming,
  homeFloors: Record<string, number | undefined>,
): { scene: Scene | null; building: Building | null } {
  const [scene, setScene] = useState<Scene | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const floorsRef = useRef(homeFloors);
  floorsRef.current = homeFloors;
  const sigRef = useRef('');

  useEffect(() => {
    if (scene) return;
    const timer = window.setInterval(() => {
      if (sceneRef.current) { setScene(sceneRef.current); window.clearInterval(timer); }
    }, 300);
    return () => window.clearInterval(timer);
  }, [scene, sceneRef]);

  useEffect(() => {
    if (!scene) return;
    let timer: number | undefined;
    const run = () => {
      if (scene.isDisposed) return;
      const next = detectBuilding(scene, naming, floorsRef.current);
      const sig = buildingSignature(next);
      if (sig !== sigRef.current || !building) {
        sigRef.current = sig;
        setBuilding(next);
      }
    };
    const schedule = (mesh?: { name: string }) => {
      if (mesh?.name?.startsWith(PRESENT_PREFIX)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 1200);
    };
    const added = scene.onNewMeshAddedObservable.add(schedule);
    const removed = scene.onMeshRemovedObservable.add(schedule);
    schedule();
    return () => {
      window.clearTimeout(timer);
      scene.onNewMeshAddedObservable.remove(added);
      scene.onMeshRemovedObservable.remove(removed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, naming]);

  return { scene, building };
}
