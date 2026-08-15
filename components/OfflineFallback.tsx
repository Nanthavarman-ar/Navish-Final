import React, { useState, useEffect } from 'react';

interface OfflineFallbackProps {
  message?: string;
  onRetry?: () => void;
  showRefreshButton?: boolean;
  customActions?: React.ReactNode;
}

export const OfflineFallback: React.FC<OfflineFallbackProps> = ({
  message = "You're currently offline. Please check your internet connection.",
  onRetry,
  showRefreshButton = true,
  customActions
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    // Wait a bit before checking connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (navigator.onLine) {
      onRetry?.();
    } else {
      setIsRetrying(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center">
        {/* Offline Icon */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 2.83L3 21m9-13.5a9.963 9.963 0 00-4.255 1.725M12 3v6m0 0l3-3m-3 3l-3-3"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Offline</h1>
          <p className="text-gray-300">{message}</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span>Connection Status:</span>
            <span className="text-red-400 font-medium">Disconnected</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span>Retry Attempts:</span>
            <span className="text-yellow-400 font-medium">{retryCount}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRetrying ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking Connection...
              </div>
            ) : (
              'Try Again'
            )}
          </button>

          {showRefreshButton && (
            <button
              onClick={handleRefresh}
              className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Refresh Page
            </button>
          )}

          {customActions && (
            <div className="pt-2">
              {customActions}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-900/30 rounded-lg">
          <h3 className="text-sm font-medium text-blue-300 mb-2">Troubleshooting Tips:</h3>
          <ul className="text-xs text-blue-200 space-y-1 text-left">
            <li>• Check your internet connection</li>
            <li>• Try refreshing the page</li>
            <li>• Disable VPN if you're using one</li>
            <li>• Check if other websites are loading</li>
          </ul>
        </div>

        {/* Auto-retry indicator */}
        {retryCount > 0 && (
          <div className="mt-4 text-xs text-gray-400">
            Auto-retrying in 5 seconds... (Attempt {retryCount + 1})
          </div>
        )}
      </div>
    </div>
  );
};
