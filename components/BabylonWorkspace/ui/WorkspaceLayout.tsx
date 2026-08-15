import React from 'react';
import { useWorkspace } from '../core/WorkspaceContext';
import './WorkspaceLayout.css';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  layoutMode?: 'standard' | 'compact' | 'immersive' | 'split';
  onLayoutChange?: (mode: 'standard' | 'compact' | 'immersive' | 'split') => void;
}

export function WorkspaceLayout({
  children,
  layoutMode = 'standard',
  onLayoutChange
}: WorkspaceLayoutProps) {
  const { state, dispatch } = useWorkspace();

  // Handle layout mode changes
  const handleLayoutChange = (mode: 'standard' | 'compact' | 'immersive' | 'split') => {
    dispatch({ type: 'SET_LAYOUT_MODE', payload: mode });
    if (onLayoutChange) {
      onLayoutChange(mode);
    }
  };

  // Get layout classes based on mode
  const getLayoutClasses = () => {
    const baseClasses = ['workspace-layout'];

    switch (layoutMode) {
      case 'compact':
        baseClasses.push('workspace-layout--compact');
        break;
      case 'immersive':
        baseClasses.push('workspace-layout--immersive');
        break;
      case 'split':
        baseClasses.push('workspace-layout--split');
        break;
      default:
        baseClasses.push('workspace-layout--standard');
    }

    return baseClasses.join(' ');
  };

  // Get panel visibility classes
  const getPanelClasses = () => {
    const classes = [];

    if (state.leftPanelVisible) classes.push('left-panel-visible');
    if (state.rightPanelVisible) classes.push('right-panel-visible');
    if (state.bottomPanelVisible) classes.push('bottom-panel-visible');

    return classes.join(' ');
  };

  return (
    <div className={`${getLayoutClasses()} ${getPanelClasses()}`}>
      {/* Layout mode selector */}
      <div className="layout-mode-selector">
        <div className="layout-buttons">
          <button
            className={`layout-button ${layoutMode === 'standard' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('standard')}
            title="Standard Layout"
          >
            📐 Standard
          </button>
          <button
            className={`layout-button ${layoutMode === 'compact' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('compact')}
            title="Compact Layout"
          >
            🗜️ Compact
          </button>
          <button
            className={`layout-button ${layoutMode === 'split' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('split')}
            title="Split Layout"
          >
            ⧉ Split
          </button>
          <button
            className={`layout-button ${layoutMode === 'immersive' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('immersive')}
            title="Immersive Layout"
          >
            🕶️ Immersive
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="workspace-content">
        {children}
      </div>

      {/* Panel toggle buttons */}
      <div className="panel-toggles">
        <button
          className={`panel-toggle ${state.leftPanelVisible ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'leftPanelVisible' })}
          title="Toggle Left Panel"
        >
          🎛️
        </button>
        <button
          className={`panel-toggle ${state.rightPanelVisible ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'rightPanelVisible' })}
          title="Toggle Right Panel"
        >
          ⚙️
        </button>
        <button
          className={`panel-toggle ${state.bottomPanelVisible ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'bottomPanelVisible' })}
          title="Toggle Bottom Panel"
        >
          📊
        </button>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="keyboard-shortcuts">
        <button
          className="shortcuts-button"
          title="Keyboard Shortcuts"
        >
          ?
        </button>
        <div className="shortcuts-panel">
          <div className="shortcuts-title">Keyboard Shortcuts</div>
          <div className="shortcuts-list">
            <div><kbd>Ctrl+1</kbd> Standard Layout</div>
            <div><kbd>Ctrl+2</kbd> Compact Layout</div>
            <div><kbd>Ctrl+3</kbd> Split Layout</div>
            <div><kbd>Ctrl+4</kbd> Immersive Layout</div>
            <div><kbd>Ctrl+H</kbd> Toggle Left Panel</div>
            <div><kbd>Ctrl+J</kbd> Toggle Right Panel</div>
            <div><kbd>Ctrl+K</kbd> Toggle Bottom Panel</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Panel container component for managing panel positioning
interface PanelContainerProps {
  position: 'left' | 'right' | 'bottom';
  isVisible: boolean;
  children: React.ReactNode;
  width?: number;
  height?: number;
}

export function PanelContainer({
  position,
  isVisible,
  children,
  width = 320,
  height = 200
}: PanelContainerProps) {
  const getPanelClasses = () => {
    const classes = ['panel-container', `panel-container--${position}`];

    if (isVisible) {
      classes.push('panel-container--visible');
    } else {
      classes.push('panel-container--hidden');
    }

    return classes.join(' ');
  };

  const getPanelStyle = () => {
    const style: React.CSSProperties = {};

    if (position === 'left' || position === 'right') {
      style.width = `${width}px`;
    } else {
      style.height = `${height}px`;
    }

    return style;
  };

  return (
    <div
      className={getPanelClasses()}
      style={getPanelStyle()}
    >
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}

// Responsive design hook
export function useResponsiveLayout() {
  const [windowSize, setWindowSize] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  React.useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width < 1024 && windowSize.width >= 768;
  const isDesktop = windowSize.width >= 1024;

  return {
    windowSize,
    isMobile,
    isTablet,
    isDesktop,
    shouldShowPanels: isDesktop || (isTablet && windowSize.width >= 900),
    panelWidth: isMobile ? windowSize.width : Math.min(400, windowSize.width * 0.3),
  };
}
