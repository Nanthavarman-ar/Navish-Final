import React, { useState, useEffect } from 'react';
import styles from './TopBar.module.css';
import { Play, Pause, Settings, Activity, Zap, Eye, EyeOff, Camera, Layers, Navigation, Sun, Palette, Download, Users, Share, Grid3X3, RotateCcw, Move, Scale, Ruler, Wand2, Brain, BarChart3, MapPin, Smartphone } from 'lucide-react';

interface TopBarProps {
  isGenerating?: boolean;
  generationProgress?: number;
  onToggleRealTime?: () => void;
  realTimeEnabled?: boolean;
  fps?: string;
  activeFeatures?: string;
  cameraMode?: 'orbit' | 'fly' | 'walk';
  onCameraModeChange?: (mode: 'orbit' | 'fly' | 'walk') => void;
  onToggleGrid?: () => void;
  gridVisible?: boolean;
  onToggleWireframe?: () => void;
  wireframeEnabled?: boolean;
  onToggleStats?: () => void;
  statsVisible?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  isGenerating = false,
  generationProgress = 0,
  onToggleRealTime,
  realTimeEnabled = false,
  fps = '60',
  activeFeatures = '0',
  cameraMode = 'orbit',
  onCameraModeChange,
  onToggleGrid,
  gridVisible = false,
  onToggleWireframe,
  wireframeEnabled = false,
  onToggleStats,
  statsVisible = false
}) => {
  const [progress, setProgress] = useState(generationProgress);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setProgress(generationProgress);
  }, [generationProgress]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getFpsColor = (fps: string) => {
    const fpsNum = parseInt(fps) || 0;
    if (fpsNum >= 50) return 'text-green-400';
    if (fpsNum >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-3 border-b border-gray-700 bg-gray-800 text-white flex items-center justify-between shadow-lg">
      {/* Left Section - Real-time Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleRealTime}
          className={`px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            realTimeEnabled
              ? 'bg-green-600 hover:bg-green-700 shadow-green-500/25 shadow-lg'
              : 'bg-gray-600 hover:bg-gray-700'
          }`}
          aria-label={realTimeEnabled ? "Disable Real-Time Updates" : "Enable Real-Time Updates"}
        >
          {realTimeEnabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {realTimeEnabled ? 'Real-Time ON' : 'Real-Time OFF'}
        </button>

        {/* Camera Mode Selector */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => onCameraModeChange?.('orbit')}
            className={`px-3 py-1 rounded text-sm transition-all ${
              cameraMode === 'orbit' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
            title="Orbit Camera"
          >
            <Camera className="w-4 h-4 inline mr-1" />
            Orbit
          </button>
          <button
            onClick={() => onCameraModeChange?.('fly')}
            className={`px-3 py-1 rounded text-sm transition-all ${
              cameraMode === 'fly' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
            title="Fly Camera"
          >
            <Eye className="w-4 h-4 inline mr-1" />
            Fly
          </button>
          <button
            onClick={() => onCameraModeChange?.('walk')}
            className={`px-3 py-1 rounded text-sm transition-all ${
              cameraMode === 'walk' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
            title="Walk Camera"
          >
            <EyeOff className="w-4 h-4 inline mr-1" />
            Walk
          </button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleGrid}
            className={`p-2 rounded transition-all ${
              gridVisible ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle Grid"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleWireframe}
            className={`p-2 rounded transition-all ${
              wireframeEnabled ? 'bg-orange-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle Wireframe"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleStats}
            className={`p-2 rounded transition-all ${
              statsVisible ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle Performance Stats"
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>

        {/* Enscape-like Categorized Toolbar */}
        <div className="flex items-center gap-2 ml-4">
          {/* Navigation Category */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button className="p-2 rounded hover:bg-gray-600" title="Navigation Tools">
              <Navigation className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Move">
              <Move className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Rotate">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Scale">
              <Scale className="w-4 h-4" />
            </button>
          </div>

          {/* Visual Settings Category */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button className="p-2 rounded hover:bg-gray-600" title="Visual Settings">
              <Palette className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Lighting">
              <Sun className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Materials">
              <Palette className="w-4 h-4" />
            </button>
          </div>

          {/* Analysis Category */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button className="p-2 rounded hover:bg-gray-600" title="Analysis Tools">
              <BarChart3 className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Measure">
              <Ruler className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="AI Advisor">
              <Brain className="w-4 h-4" />
            </button>
          </div>

          {/* Export Category */}
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button className="p-2 rounded hover:bg-gray-600" title="Export">
              <Download className="w-4 h-4" />
            </button>
            <button className="p-2 rounded hover:bg-gray-600" title="Share">
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Center Section - Status Indicators */}
      <div className="flex items-center gap-6">
        {/* Generation Progress */}
        {isGenerating && (
          <div className="flex items-center gap-3 bg-gray-700 px-4 py-2 rounded-lg">
            <div className="text-sm font-medium">Generating Terrain</div>
            <div className="text-sm text-blue-400">{progress.toFixed(0)}%</div>
            <div
              className={styles.progressBarContainer}
              style={{ '--progress-width': `${progress}%` } as React.CSSProperties}
            >
              <div className={styles.progressBarFill} />
            </div>
          </div>
        )}

        {/* Performance Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className={getFpsColor(fps)}>FPS: {fps}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-400" />
            <span>Features: {activeFeatures}</span>
          </div>
          <div className="text-gray-400">
            {currentTime.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Right Section - Quick Actions */}
      <div className="flex items-center gap-2">
        <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
          v2.1.0
        </div>
      </div>
    </div>
  );
};

export default TopBar;
