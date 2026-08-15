import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class BabylonErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Babylon.js Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
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