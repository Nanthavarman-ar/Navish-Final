import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import AppLayout from './layout/AppLayout';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SubscriptionProvider>
      <AppProvider>
        <Router>
          <AppLayout />
        </Router>
      </AppProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
};

export default App;
