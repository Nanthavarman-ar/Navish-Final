import React, { Suspense, useEffect, useRef, useState } from 'react';
import type { Scene } from '@babylonjs/core';
import { useParams } from 'react-router-dom';
import { projectId } from '../supabase/client';
import { useApp, LAST_MODEL_ID_KEY } from '../contexts/AppContext';
import BabylonErrorBoundary from './BabylonErrorBoundary';
import { loadPresentConfig, DEFAULT_CONFIG, type PresentConfig } from '../data/presentConfig';
import { setProtectedMeshPatterns } from './utils/meshMerging';

// Client-facing presentation layer (floors, pins, 360 rooms...).
const PresentationLayer = React.lazy(() => import('../ui/PresentationLayer').then((m) => ({ default: m.PresentationLayer })));

// Lazy for the same reason as everywhere else: the Babylon engine is ~1.25MB gzip.
const BabylonWorkspace = React.lazy(() => import('./BabylonWorkspace'));

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

type DemoState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; name: string };

/**
 * Public demo viewer at /demo/:shareId - no login. An admin creates the link from the
 * Models page; anyone who has it can open that one model in the presentation UI (look
 * around, floors, homes, 360 rooms, VR/AR) but can't upload or edit anything: the workspace
 * runs with isAdmin={false} and presentMode, so no editor UI is rendered, and every
 * upload/assign route on the server is admin-only anyway.
 *
 * There is deliberately NO way to switch this view into the workspace UI. The workspace
 * is only reachable through the admin login at /workspace.
 */
export function DemoViewer() {
  const { shareId = '' } = useParams<{ shareId: string }>();
  const { setSelectedModel } = useApp();
  const [state, setState] = useState<DemoState>({ status: 'loading' });

  const [config, setConfig] = useState<PresentConfig>(DEFAULT_CONFIG);
  const sceneRef = useRef<Scene | null>(null);
  useEffect(() => {
    loadPresentConfig(shareId).then((cfg) => {
      // The client's own Floor/Home/Roof/Exterior naming must survive merge + freeze too.
      setProtectedMeshPatterns([cfg.naming.floor, cfg.naming.home, cfg.naming.roof, cfg.naming.exterior]);
      setConfig(cfg);
    });
  }, [shareId]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const res = await fetch(`${functionsBaseUrl}/public/demo/${encodeURIComponent(shareId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.model) {
          setState({
            status: 'error',
            message: res.status === 404
              ? 'This demo link is no longer active. Ask the person who shared it for a new link.'
              : 'The demo could not be loaded right now. Please try again in a moment.',
          });
          return;
        }
        const model = data.model;
        const modelUrl = (model.ktx2Status === 'ready' && model.ktx2Url) || model.signedUrl;

        // Opening a demo must not replace a signed-in admin's own "last opened model"
        // (setSelectedModel remembers it for restore-on-refresh).
        let previousLastModel: string | null = null;
        try { previousLastModel = localStorage.getItem(LAST_MODEL_ID_KEY); } catch { /* ignore */ }
        setSelectedModel({ ...model, modelUrl });
        try {
          if (previousLastModel === null) localStorage.removeItem(LAST_MODEL_ID_KEY);
          else localStorage.setItem(LAST_MODEL_ID_KEY, previousLastModel);
        } catch { /* ignore */ }

        setState({ status: 'ready', name: model.name || 'Demo model' });
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'The demo could not be loaded. Check your connection and try again.' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  if (state.status !== 'ready') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a] text-[#eceaea] p-6">
        <div className="max-w-md text-center space-y-4">
          {state.status === 'loading' ? (
            <>
              <div className="animate-spin w-8 h-8 border-2 border-[#ff4d4f] border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-[#c4c2c2]">Opening the demo...</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">Demo unavailable</p>
              <p className="text-sm text-[#c4c2c2]">{state.message}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#111]">
      <BabylonErrorBoundary>
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#ff4d4f] border-t-transparent rounded-full" />
            </div>
          }
        >
          <BabylonWorkspace
            workspaceId={`demo-${shareId}`}
            isAdmin={false}
            enablePhysics={false}
            enableXR={true}
            enableSpatialAudio={false}
            presentMode
            sceneRef={sceneRef}
          />
        </Suspense>
      </BabylonErrorBoundary>
      <Suspense fallback={null}>
        <PresentationLayer sceneRef={sceneRef} projectId={shareId} config={config} />
      </Suspense>
    </div>
  );
}
