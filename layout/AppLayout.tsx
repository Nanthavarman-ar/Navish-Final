import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ToolsAndFeatures from '../components/ToolsAndFeatures';
import ToolPage from '../components/ToolPage';
import { toolPageDefinitions, ToolPageId } from '../components/toolPageDefinitions';
import { Home } from '../components/Home';
import { Login } from '../components/Login';
import { AdminLogin } from '../components/AdminLogin';
import { ClientLogin } from '../components/ClientLogin';
import { AdminDashboard } from '../components/AdminDashboard';
import { ClientDashboard } from '../components/ClientDashboard';
import { UserUploadPage } from '../components/UserUploadPage';
import BabylonErrorBoundary from '../components/BabylonErrorBoundary';
import { Toaster } from '../components/ui/sonner';
import { useAuth, useApp } from '../contexts';
import { LAST_MODEL_ID_KEY } from '../contexts/AppContext';
import { apiCall } from '../hooks/useApi';
import { showToast } from '../components/utils/toast';
import type { Scene } from '@babylonjs/core';

// Lazy-loaded: pulls in the full Babylon.js engine (~1.25MB gzip). Previously this was a
// static import at the top of this app-wide router, so every page load - Home, Login,
// Admin dashboard, etc - downloaded the entire 3D engine even for visitors who never open
// the workspace. Lazy-loading defers the fetch until the /workspace route actually renders.
const BabylonWorkspace = React.lazy(() => import('../components/BabylonWorkspace'));
// Also imports @babylonjs/core at its top level and is only ever rendered once the
// workspace scene is ready, so it gets the same lazy treatment.
const AIVoiceAssistant = React.lazy(() => import('../components/AIVoiceAssistant'));
// Pulls in ~50 feature modules transitively (BIMManager, XRManager, VRARMode, MultiUser,
// VoiceChat, CostEstimator, and most of the rest of the feature set) - by far the biggest
// single contributor to a bloated initial bundle before this fix.
const TrafficParkingSimulationPage = React.lazy(() => import('../components/TrafficParkingSimulationPage'));
// QA/debug tooling routes - no reason for normal visitors to ever download these.
const ButtonTestRunner = React.lazy(() => import('../components/ButtonTestRunner'));
const ComprehensiveButtonTest = React.lazy(() => import('../components/ComprehensiveButtonTest'));
const ButtonFunctionTest = React.lazy(() => import('../components/ButtonFunctionTest'));

const RouteLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
  </div>
);

// The workspace viewer (BabylonWorkspace) reads selectedModel.modelUrl, but the /models
// API returns the file location as signedUrl - passing the raw record through without this
// mapping leaves modelUrl undefined and the workspace has nothing to load.
const withModelUrl = (model: any) => ({
  ...model,
  modelUrl: model?.modelUrl || model?.signedUrl || model?.url || model?.fileUrl || null,
});

const toolPageSlugs = Object.keys(toolPageDefinitions) as ToolPageId[];

const normalizePath = (path: string) => {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

const getToolSlugFromPath = (path: string): ToolPageId | undefined => {
  const normalized = normalizePath(path).toLowerCase();
  const prefix = '/tool/';
  if (!normalized.startsWith(prefix)) return undefined;
  const slug = normalized.replace(prefix, '').split('/')[0] as ToolPageId;
  return toolPageSlugs.includes(slug) ? slug : undefined;
};

const mapPathToPage = (path: string): string => {
  const normalized = normalizePath(path).toLowerCase();
  if (normalized === '/' || normalized === '/home') return 'home';
  if (normalized === '/login') return 'login';
  if (normalized.startsWith('/admin/login')) return 'admin-login';
  if (normalized.startsWith('/client/login')) return 'client-login';
  if (normalized.startsWith('/admin/clients')) return 'admin-clients';
  if (normalized.startsWith('/admin/models')) return 'admin-models';
  if (normalized.startsWith('/admin/audit')) return 'admin-audit';
  if (normalized.startsWith('/admin/settings')) return 'admin-settings';
  if (normalized.startsWith('/admin/upload')) return 'admin-upload';
  if (normalized.startsWith('/client/models')) return 'client-models';
  if (normalized.startsWith('/client/upload')) return 'client-upload';
  if (normalized.startsWith('/admin')) return 'admin-dashboard';
  if (normalized.startsWith('/client')) return 'client-dashboard';
  if (normalized === '/workspace') return 'workspace';
  if (normalized === '/babylon-workspace') return 'babylon-workspace';
  if (normalized === '/integrated-workspace') return 'integrated-workspace';
  if (normalized === '/button-test-runner') return 'button-test-runner';
  if (normalized === '/comprehensive-button-test') return 'comprehensive-button-test';
  if (normalized === '/button-function-test') return 'button-function-test';
  if (normalized === '/tools-features') return 'tools-features';
  if (normalized === '/traffic-parking-simulation') return 'traffic-parking-simulation';
  const toolSlug = getToolSlugFromPath(normalized);
  if (toolSlug) return toolSlug;
  return 'home';
};

const mapPageToPath = (page: string): string => {
  if (page === 'home') return '/';
  if (page === 'login') return '/login';
  if (page === 'admin-login') return '/admin/login';
  if (page === 'client-login') return '/client/login';
  if (page === 'admin-clients') return '/admin/clients';
  if (page === 'admin-models') return '/admin/models';
  if (page === 'admin-audit') return '/admin/audit';
  if (page === 'admin-settings') return '/admin/settings';
  if (page === 'admin-upload') return '/admin/upload';
  if (page === 'admin-dashboard') return '/admin/dashboard';
  if (page === 'client-models') return '/client/models';
  if (page === 'client-upload') return '/client/upload';
  if (page === 'client-dashboard') return '/client/dashboard';
  if (page === 'workspace') return '/workspace';
  if (page === 'babylon-workspace') return '/babylon-workspace';
  if (page === 'integrated-workspace') return '/integrated-workspace';
  if (page === 'button-test-runner') return '/button-test-runner';
  if (page === 'comprehensive-button-test') return '/comprehensive-button-test';
  if (page === 'button-function-test') return '/button-function-test';
  if (page === 'tools-features') return '/tools-features';
  if (page === 'traffic-parking-simulation') return '/traffic-parking-simulation';
  if (toolPageSlugs.includes(page as ToolPageId)) {
    return `/tool/${page}`;
  }
  return '/';
};

const ToolPageRoute: React.FC = () => {
  const { toolId } = useParams<{ toolId: string }>();
  if (!toolId) return <Home />;
  const normalized = toolId.toLowerCase() as ToolPageId;
  if (!toolPageSlugs.includes(normalized)) return <Home />;
  return <ToolPage page={normalized} />;
};

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { currentPage, setCurrentPage, selectedModel, setSelectedModel } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentPath = normalizePath(location.pathname).toLowerCase();
  const showMyModelsShortcut = user?.role === 'client' && currentPath === '/workspace';
  const sceneRef = useRef<Scene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // A shared workspace link includes ?model=<id> (see SharingPanelContent) so the
  // recipient opens the same model the sharer had loaded, instead of always landing
  // on a blank/default workspace regardless of what was actually shared.
  useEffect(() => {
    const sharedModelId = searchParams.get('model');
    if (!sharedModelId || currentPath !== '/workspace' || !user) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiCall('/models');
        const model = (data.models || []).find((m: any) => String(m.id) === sharedModelId);
        if (cancelled) return;
        if (model) {
          setSelectedModel(withModelUrl(model));
        } else {
          showToast.error('Shared model not found', 'It may have been removed or you may not have access to it.');
        }
      } catch (error) {
        console.error('Failed to load shared model:', error);
        showToast.error('Failed to load the shared model');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentPath, user]);

  // Restores the last model that was open when the app is refreshed/reopened.
  // selectedModel lives only in memory (see AppContext), so it resets to null on every
  // remount; without this the workspace always came back empty even though the model was
  // still sitting in storage. Skips when a shared-link ?model= id is present (handled above)
  // or a model is already loaded.
  //
  // hasRestoredLastModelRef makes this run at most ONCE per mount instead of every time
  // selectedModel happens to be falsy. Without it, this was re-armed by its own
  // `selectedModel` dependency every single time BabylonWorkspace's load effect finished
  // loading a model and reset selectedModel back to null (an intentional, unrelated
  // cleanup step there) - which re-triggered THIS effect to re-fetch and re-select the
  // same last-opened model, which re-triggered BabylonWorkspace to reload it into the
  // scene again, resetting selectedModel to null again, and so on: an infinite
  // load-reset-reload cycle that looked like the model repeatedly reloading/flickering.
  const hasRestoredLastModelRef = useRef(false);
  useEffect(() => {
    if (hasRestoredLastModelRef.current) return;
    if (currentPath !== '/workspace' || !user || selectedModel || searchParams.get('model')) return;

    let lastModelId: string | null = null;
    try {
      lastModelId = localStorage.getItem(LAST_MODEL_ID_KEY);
    } catch {
      return;
    }
    if (!lastModelId) return;

    hasRestoredLastModelRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiCall('/models');
        const model = (data.models || []).find((m: any) => String(m.id) === lastModelId);
        if (cancelled) return;
        if (model) {
          setSelectedModel(withModelUrl(model));
        }
      } catch (error) {
        console.error('Failed to restore last opened model:', error);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, user, selectedModel, searchParams]);
  // Was defaulted to true, so the panel auto-opened on every load with no user action -
  // the actual "open" button (bottom of this section) only renders once it's closed,
  // meaning it looked like there was no dedicated button to open it at all. Every other
  // panel in the app requires a deliberate click to open; this now matches that.
  const [showAIVoiceAssistant, setShowAIVoiceAssistant] = useState(false);

  // The workspace's own "Voice Assistant" tool-panel button (BabylonWorkspace.tsx,
  // hotkey V) lives in a completely separate state system from this panel - it used to
  // only start a silent background listener with no way to actually see/use it.
  // Bridging the two via events so that toggle opens this real panel instead.
  useEffect(() => {
    const openHandler = () => setShowAIVoiceAssistant(true);
    const closeHandler = () => setShowAIVoiceAssistant(false);
    window.addEventListener('naviz:openVoiceAssistant', openHandler);
    window.addEventListener('naviz:closeVoiceAssistant', closeHandler);
    return () => {
      window.removeEventListener('naviz:openVoiceAssistant', openHandler);
      window.removeEventListener('naviz:closeVoiceAssistant', closeHandler);
    };
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 50 }).map(() => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 3,
      })),
    []
  );

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(location.search);
      const pageParam = urlParams.get('page');
      const hashPage = location.hash.replace('#', '');

      if (pageParam && pageParam !== currentPage) {
        setCurrentPage(pageParam);
        return;
      }

      if (hashPage && hashPage !== currentPage) {
        setCurrentPage(hashPage);
        return;
      }

      const resolved = mapPathToPage(location.pathname);
      if (resolved !== currentPage) {
        setCurrentPage(resolved);
      }
    } catch (error) {
      console.error('Navigation check error:', error);
    }
  }, [location, setCurrentPage, currentPage]);

  useEffect(() => {
    const currentPath = normalizePath(location.pathname);
    const targetPath = mapPageToPath(currentPage);
    if (!targetPath || currentPath === targetPath) return;
    const resolvedFromUrl = mapPathToPage(currentPath);
    // Don't overwrite URL when it's a valid route - let Effect 1 sync currentPage
    if (resolvedFromUrl !== currentPage) {
      return;
    }
    navigate(targetPath);
  }, [currentPage, location.pathname, navigate]);

  // Reset sceneReady when navigating away from workspace routes
  useEffect(() => {
    const path = normalizePath(location.pathname).toLowerCase();
    const isWorkspaceRoute = path === '/workspace' || path === '/babylon-workspace' || path === '/integrated-workspace';
    if (!isWorkspaceRoute) {
      setSceneReady(false);
    }
  }, [location.pathname]);

  // Role-based route protection
  useEffect(() => {
    if (loading || !user) return;
    const path = normalizePath(location.pathname).toLowerCase();
    if (path.startsWith('/admin') && user.role !== 'admin') {
      navigate(user.role === 'client' ? '/client' : '/');
    } else if (path.startsWith('/client') && user.role !== 'client') {
      navigate(user.role === 'admin' ? '/admin/clients' : '/');
    }
  }, [user, loading, location.pathname, navigate]);

  const mainContent = loading ? (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading NAVIZ...</p>
      </div>
    </div>
  ) : (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/upload" element={user?.role === 'client' ? <UserUploadPage /> : <Home />} />
      <Route path="/admin/*" element={user?.role === 'admin' ? <AdminDashboard /> : <Home />} />
      <Route path="/client/models" element={user?.role === 'client' ? <ClientDashboard /> : <Home />} />
      <Route path="/client/*" element={user?.role === 'client' ? <ClientDashboard /> : <Home />} />
      <Route path="/babylon-workspace" element={<Navigate to="/workspace" replace />} />
      <Route path="/integrated-workspace" element={<Navigate to="/workspace" replace />} />
      <Route
        path="/workspace"
        element={user ? (
          <BabylonErrorBoundary>
            <Suspense fallback={
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
              </div>
            }>
              <BabylonWorkspace
                workspaceId="workspace"
                isAdmin={user?.role === 'admin'}
                sceneRef={sceneRef}
                onSceneReady={() => setSceneReady(true)}
              />
            </Suspense>
          </BabylonErrorBoundary>
        ) : (
          <Navigate to="/login" replace />
        )}
      />
      <Route path="/tools-features" element={<ToolsAndFeatures />} />
      <Route path="/traffic-parking-simulation" element={<Suspense fallback={<RouteLoadingFallback />}><TrafficParkingSimulationPage /></Suspense>} />
      <Route path="/button-test-runner" element={<Suspense fallback={<RouteLoadingFallback />}><ButtonTestRunner /></Suspense>} />
      <Route path="/comprehensive-button-test" element={<Suspense fallback={<RouteLoadingFallback />}><ComprehensiveButtonTest /></Suspense>} />
      <Route path="/button-function-test" element={<Suspense fallback={<RouteLoadingFallback />}><ButtonFunctionTest /></Suspense>} />
      <Route path="/tool/:toolId" element={<ToolPageRoute />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-slate-900 text-white relative overflow-hidden">
        {/* Cyberpunk background particles */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-blue-900/20" />
          <div className="absolute inset-0 opacity-30">
            {particles.map((particle, i) => (
              <div
                key={`particle-${i}`}
                className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse particle"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10">
          {mainContent}
        </div>

        {showMyModelsShortcut && (
          <button
            type="button"
            onClick={() => navigate('/client/models')}
            className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm shadow-lg transition-colors pointer-events-auto cursor-pointer"
            title="Go to My Models"
            aria-label="Go to My Models"
          >
            My Models
          </button>
        )}

        {/* AI Voice Assistant - has fixed position and z-50 for visibility and clickability */}
        {user && sceneReady && sceneRef.current && (
          <>
            <Suspense fallback={null}>
              <AIVoiceAssistant
                scene={sceneRef.current}
                isActive={showAIVoiceAssistant}
                onClose={() => {
                  setShowAIVoiceAssistant(false);
                  // Keeps the workspace's own "Voice Assistant" tool-panel button in
                  // sync so it doesn't keep showing "on" after this panel is closed.
                  window.dispatchEvent(new CustomEvent('naviz:voiceAssistantClosed'));
                }}
              />
            </Suspense>
            {!showAIVoiceAssistant && (
              <button
                type="button"
                onClick={() => setShowAIVoiceAssistant(true)}
                className={`fixed ${currentPath === '/workspace' ? 'top-16' : 'top-4'} right-4 z-50 flex items-center gap-2 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm shadow-lg transition-colors pointer-events-auto cursor-pointer`}
                title="Open AI Voice Assistant"
                aria-label="Open AI Voice Assistant"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                AI Voice
              </button>
            )}
          </>
        )}
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
