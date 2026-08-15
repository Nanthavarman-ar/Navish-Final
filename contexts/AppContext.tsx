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

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedModel, setSelectedModel] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const value = { currentPage, setCurrentPage, selectedModel, setSelectedModel, isLoggedIn, setIsLoggedIn };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
