import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import AppLayout from './layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    // Previously only the /workspace route (BabylonErrorBoundary) had any crash
    // protection at all - an uncaught render error on the landing page, either login
    // screen, or either dashboard (everything a client sees before ever reaching the 3D
    // view) unmounted the whole React tree to a blank white screen with no recovery UI.
    <ErrorBoundary>
      <AuthProvider>
        <SubscriptionProvider>
        <AppProvider>
          <Router>
            <AppLayout />
          </Router>
        </AppProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
