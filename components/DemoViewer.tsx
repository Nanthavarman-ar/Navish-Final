import React, { Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectId } from '../supabase/client';
import { useApp, LAST_MODEL_ID_KEY } from '../contexts/AppContext';
import BabylonErrorBoundary from './BabylonErrorBoundary';

// Lazy for the same reason as everywhere else: the Babylon engine is ~1.25MB gzip.
const BabylonWorkspace = React.lazy(() => import('./BabylonWorkspace'));

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

type DemoState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; name: string };

/**
 * Public demo viewer at /demo/:shareId - no login. An admin creates the link from the
 * Models page; anyone who has it can open that one model in the 3D viewer (look around,
 * walk through it, VR/AR) but can't upload anything: the workspace runs with
 * isAdmin={false}, and every upload/assign route on the server is admin-only anyway.
 */
export function DemoViewer() {
  const { shareId = '' } = useParams<{ shareId: string }>();
  const { setSelectedModel } = useApp();
  const [state, setState] = useState<DemoState>({ status: 'loading' });

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
          <img src="/brand/navish-mark.svg" alt="Navish" className="w-14 mx-auto" />
          {state.status === 'loading' ? (
            <>
              <div className="animate-spin w-8 h-8 border-2 border-[#ff4d4f] border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-[#c4c2c2]">Opening the demo...</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">Demo unavailable</p>
              <p className="text-sm text-[#c4c2c2]">{state.message}</p>
              <Link to="/" className="inline-block mt-2 px-4 py-2 rounded bg-[#ff4d4f] text-[#1a1a1a] text-sm font-semibold">
                Go to Navish
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const demoBadge = (
    <div className="flex items-center gap-2 px-2">
      <img src="/brand/navish-mark.svg" alt="" className="w-6" aria-hidden />
      <span className="text-sm font-semibold text-white truncate max-w-[40vw]">{state.name}</span>
      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ff4d4f]/20 text-[#ff9d9e] border border-[#ff4d4f]/40">Demo</span>
    </div>
  );

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
            topBarExtraLeft={demoBadge}
          />
        </Suspense>
      </BabylonErrorBoundary>
    </div>
  );
}
