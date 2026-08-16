import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// "Failed to fetch dynamically imported module" (Chrome) / "error loading dynamically
// imported module" (Firefox/Safari) happens when a new deploy replaces the hashed JS
// chunk files (e.g. AIAdvisorPanel-<hash>.js) while this tab is still open on the old
// index.html referencing the old hash - the old file simply no longer exists on the
// server. A hard reload fetches the new index.html/chunk map and fixes it immediately,
// so there's no reason to make the user parse a scary crash screen and click a button
// for what is really just "a newer version of the app is available."
const isStaleChunkError = (error?: Error) =>
  !!error && /dynamically imported module|loading chunk|importing a module script failed/i.test(error.message || '');

const RELOAD_GUARD_KEY = 'naviz:workspaceStaleChunkReload';

class BabylonErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  componentDidMount() {
    // A fresh mount means this page load's own modules resolved fine - clear the guard
    // so a *later* stale-chunk error (e.g. a new deploy going out while this tab stays
    // open) still gets one more auto-reload instead of being permanently blocked for
    // the rest of this tab's session.
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Babylon.js Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });

    // Only auto-reload once per tab session - if it happens again right after a reload,
    // this isn't a stale-deploy mismatch (already fixed by the first reload), so fall
    // through to the manual crash screen instead of looping forever.
    if (isStaleChunkError(error) && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center p-8">
            <div className="text-red-600 text-lg font-semibold mb-2">
              3D Workspace Crashed
            </div>
            <div className="text-red-500 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <div className="text-sm text-gray-600 mb-4">
              The 3D workspace encountered a critical error and needs to be restarted.
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined, errorInfo: undefined });
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Restart Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default BabylonErrorBoundary;