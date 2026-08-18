import React, { createContext, useContext, useState } from 'react';

interface AppContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  selectedModel: any;
  setSelectedModel: (model: any) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Remembers which model was open so it can be reloaded from the backend after a refresh
// or app reopen - selectedModel itself is in-memory only and resets to null on remount.
export const LAST_MODEL_ID_KEY = 'naviz:lastSelectedModelId';

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedModel, setSelectedModelState] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const setSelectedModel = (model: any) => {
    setSelectedModelState(model);
    // Only ever SET this, never clear it here. BabylonWorkspace calls
    // setSelectedModel(null) right after a model finishes loading (it's also the
    // trigger for the load effect, so it resets itself once the load is handled) -
    // that used to also wipe this localStorage entry via the same setter, erasing the
    // "remember the last model" memory moments after the model had actually loaded, so
    // any refresh after that point had nothing to restore. There's no real "forget my
    // last model" action anywhere in the app - selecting a *different* model already
    // overwrites this key naturally, which is the only case that should ever change it.
    try {
      if (model?.id) {
        localStorage.setItem(LAST_MODEL_ID_KEY, String(model.id));
      }
    } catch {
      // localStorage unavailable (private browsing, etc) - selectedModel still works in-memory
    }
  };

  const value = { currentPage, setCurrentPage, selectedModel, setSelectedModel, isLoggedIn, setIsLoggedIn };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
