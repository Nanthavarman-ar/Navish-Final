import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UndoAction {
  type: string;
  payload?: any;
  timestamp: number;
}

interface UndoManagerContextType {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  addAction: (action: UndoAction) => void;
  clear: () => void;
}

const UndoManagerContext = createContext<UndoManagerContextType | undefined>(undefined);

export const useUndoManager = () => {
  const context = useContext(UndoManagerContext);
  if (!context) {
    throw new Error('useUndoManager must be used within an UndoManagerProvider');
  }
  return context;
};

interface UndoManagerProviderProps {
  children: ReactNode;
}

export const UndoManagerProvider: React.FC<UndoManagerProviderProps> = ({ children }) => {
  const [actions, setActions] = useState<UndoAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addAction = (action: UndoAction) => {
    const newActions = actions.slice(0, currentIndex + 1);
    newActions.push(action);
    setActions(newActions);
    setCurrentIndex(newActions.length - 1);
  };

  const undo = () => {
    if (currentIndex >= 0) {
      const action = actions[currentIndex];
      // Perform undo logic based on action.type
      console.log('Undoing action:', action);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const redo = () => {
    if (currentIndex < actions.length - 1) {
      const action = actions[currentIndex + 1];
      // Perform redo logic based on action.type
      console.log('Redoing action:', action);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const clear = () => {
    setActions([]);
    setCurrentIndex(-1);
  };

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < actions.length - 1;

  return (
    <UndoManagerContext.Provider value={{ undo, redo, canUndo, canRedo, addAction, clear }}>
      {children}
    </UndoManagerContext.Provider>
  );
};

export default UndoManagerProvider;
