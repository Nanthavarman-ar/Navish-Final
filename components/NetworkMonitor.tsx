import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkMonitorProps {
  children: ReactNode;
  onNetworkChange?: (isOnline: boolean) => void;
}

export const NetworkMonitor: React.FC<NetworkMonitorProps> = ({
  children,
  onNetworkChange
}) => {
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0
  });

  useEffect(() => {
    const updateNetworkState = () => {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;

      const newState: NetworkContextType = {
        isOnline: navigator.onLine,
        connectionType: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 0,
        rtt: connection?.rtt || 0
      };

      setNetworkState(newState);
      onNetworkChange?.(navigator.onLine);
    };

    // Initial state
    updateNetworkState();

    // Event listeners
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);

    // Connection change listener (if supported)
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateNetworkState);
    }

    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);

      if (connection) {
        connection.removeEventListener('change', updateNetworkState);
      }
    };
  }, [onNetworkChange]);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkMonitor');
  }
  return context;
};
