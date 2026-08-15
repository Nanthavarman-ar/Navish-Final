import React from 'react';
import { Grid3X3, Eye, EyeOff, Activity, Play, Pause } from 'lucide-react';
import styles from './TopToolbar.module.css';

interface TopToolbarProps {
  cameraMode: 'orbit' | 'free' | 'first-person';
  onCameraModeChange: (mode: 'orbit' | 'free' | 'first-person') => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
  wireframeEnabled: boolean;
  onToggleWireframe: () => void;
  statsVisible: boolean;
  onToggleStats: () => void;
  realTimeEnabled: boolean;
  onToggleRealTime: () => void;
  fps: number;
  activeFeatures: number;
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  cameraMode,
  onCameraModeChange,
  gridVisible,
  onToggleGrid,
  wireframeEnabled,
  onToggleWireframe,
  statsVisible,
  onToggleStats,
  realTimeEnabled,
  onToggleRealTime,
  fps,
  activeFeatures
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.leftGroup}>
        <span>Camera Mode:</span>
        <select
          value={cameraMode}
          onChange={(e) => onCameraModeChange(e.target.value as 'orbit' | 'free' | 'first-person')}
          className={styles.select}
          title="Select camera mode"
          aria-label="Camera Mode"
        >
          <option value="orbit">Orbit</option>
          <option value="free">Free</option>
          <option value="first-person">First Person</option>
        </select>
        <button
          onClick={onToggleGrid}
          className={`${styles.button} ${gridVisible ? styles.buttonActive : ''}`}
          title="Toggle grid visibility"
          aria-label="Toggle grid visibility"
        >
          <Grid3X3 size={16} />
        </button>
        <button
          onClick={onToggleWireframe}
          className={`${styles.button} ${wireframeEnabled ? styles.buttonActive : ''}`}
          title="Toggle wireframe mode"
          aria-label="Toggle wireframe mode"
        >
          <Eye size={16} />
        </button>
        <button
          onClick={onToggleStats}
          className={`${styles.button} ${statsVisible ? styles.buttonActive : ''}`}
          title="Toggle stats display"
          aria-label="Toggle stats display"
        >
          <Activity size={16} />
        </button>
        <button
          onClick={onToggleRealTime}
          className={`${styles.button} ${realTimeEnabled ? styles.buttonActive : ''}`}
          title={realTimeEnabled ? "Pause real-time" : "Play real-time"}
          aria-label={realTimeEnabled ? "Pause real-time" : "Play real-time"}
        >
          {realTimeEnabled ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
      <div className={styles.rightGroup}>
        <span>FPS: {fps}</span>
        <span>Active Features: {activeFeatures}</span>
      </div>
    </div>
  );
};

export default TopToolbar;
