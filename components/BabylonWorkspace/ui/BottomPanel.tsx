import React from 'react';
import { useWorkspace } from '../core/WorkspaceContext';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Separator } from '../../ui/separator';
import {
  Activity,
  Zap,
  Monitor,
  HardDrive,
  Cpu,
  MemoryStick,
  Thermometer,
  Wifi,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  Download,
  Upload,
  Save,
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Grid3X3,
  Layers,
  Camera,
  Lightbulb,
  Palette,
  Move3D,
  Scale,
  RotateCw,
  Ruler,
  Target,
  Navigation,
  MapPin,
  Globe,
  Satellite,
  Maximize,
  Minimize,
  Trash2
} from 'lucide-react';
import './BottomPanel.css';

interface BottomPanelProps {
  onToggleStats?: () => void;
  onToggleConsole?: () => void;
  onToggleTimeline?: () => void;
  onExportStats?: () => void;
  onClearStats?: () => void;
}

export function BottomPanel({
  onToggleStats,
  onToggleConsole,
  onToggleTimeline,
  onExportStats,
  onClearStats
}: BottomPanelProps) {
  const { state } = useWorkspace();

  // Get real-time performance data
  const performanceData = {
    fps: 60, // Would get from Babylon.js engine
    frameTime: 16.67,
    drawCalls: 150,
    triangles: 50000,
    memoryUsage: '256 MB',
    gpuMemory: '128 MB',
    cpuUsage: 45,
    gpuTemp: 65,
  };

  // Get system information
  const systemInfo = {
    platform: 'Windows 11',
    browser: 'Chrome 120',
    webgl: 'WebGL 2.0',
    babylonVersion: '8.28.1',
    renderMode: 'Forward',
    antialiasing: 'FXAA',
  };

  // Get scene statistics
  const sceneStats = {
    meshes: state.scene?.meshes?.length || 0,
    materials: state.materials?.length || 0,
    lights: state.scene?.lights?.length || 0,
    cameras: state.scene?.cameras?.length || 0,
    textures: state.scene?.textures?.length || 0,
    particleSystems: state.scene?.particleSystems?.length || 0,
    skeletons: state.scene?.skeletons?.length || 0,
    animations: state.scene?.animations?.length || 0,
  };

  // Get tool states
  const toolStates = {
    move: state.moveActive,
    rotate: state.rotateActive,
    scale: state.scaleActive,
    camera: state.cameraActive,
    measure: state.perspectiveActive,
  };

  return (
    <div className="bottom-panel">
      <div className="bottom-panel-header">
        <h3 className="bottom-panel-title">Performance & Stats</h3>
        <div className="bottom-panel-controls">
          <Button variant="ghost" size="sm" onClick={onToggleStats}>
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleConsole}>
            <FileText className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleTimeline}>
            <Clock className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onExportStats}>
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearStats}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bottom-panel-content">
        {/* Performance Metrics */}
        <Card className="performance-card">
          <CardHeader className="performance-header">
            <CardTitle className="text-sm flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Real-time Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="performance-content">
            <div className="metrics-grid">
              {/* FPS */}
              <div className="metric-item">
                <div className="metric-label">FPS</div>
                <div className="metric-value fps-value" data-quality={performanceData.fps >= 50 ? 'good' : performanceData.fps >= 30 ? 'medium' : 'poor'}>
                  {performanceData.fps}
                </div>
                <Progress value={(performanceData.fps / 60) * 100} className="metric-progress" />
              </div>

              {/* Frame Time */}
              <div className="metric-item">
                <div className="metric-label">Frame Time</div>
                <div className="metric-value">
                  {performanceData.frameTime.toFixed(1)}ms
                </div>
                <Progress value={Math.min((performanceData.frameTime / 33.33) * 100, 100)} className="metric-progress" />
              </div>

              {/* Draw Calls */}
              <div className="metric-item">
                <div className="metric-label">Draw Calls</div>
                <div className="metric-value">{performanceData.drawCalls}</div>
                <Progress value={Math.min((performanceData.drawCalls / 1000) * 100, 100)} className="metric-progress" />
              </div>

              {/* Triangles */}
              <div className="metric-item">
                <div className="metric-label">Triangles</div>
                <div className="metric-value">{performanceData.triangles.toLocaleString()}</div>
                <Progress value={Math.min((performanceData.triangles / 100000) * 100, 100)} className="metric-progress" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="system-card">
          <CardHeader className="system-header">
            <CardTitle className="text-sm flex items-center">
              <Monitor className="w-4 h-4 mr-2" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent className="system-content">
            <div className="system-grid">
              <div className="system-item">
                <div className="system-label">Platform</div>
                <div className="system-value">{systemInfo.platform}</div>
              </div>
              <div className="system-item">
                <div className="system-label">Browser</div>
                <div className="system-value">{systemInfo.browser}</div>
              </div>
              <div className="system-item">
                <div className="system-label">WebGL</div>
                <div className="system-value">{systemInfo.webgl}</div>
              </div>
              <div className="system-item">
                <div className="system-label">Babylon.js</div>
                <div className="system-value">{systemInfo.babylonVersion}</div>
              </div>
              <div className="system-item">
                <div className="system-label">Render Mode</div>
                <div className="system-value">{systemInfo.renderMode}</div>
              </div>
              <div className="system-item">
                <div className="system-label">Antialiasing</div>
                <div className="system-value">{systemInfo.antialiasing}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scene Statistics */}
        <Card className="scene-card">
          <CardHeader className="scene-header">
            <CardTitle className="text-sm flex items-center">
              <Layers className="w-4 h-4 mr-2" />
              Scene Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="scene-content">
            <div className="scene-stats">
              <div className="stat-item">
                <div className="stat-label">Meshes</div>
                <Badge variant="secondary">{sceneStats.meshes}</Badge>
              </div>
              <div className="stat-item">
                <div className="stat-label">Materials</div>
                <Badge variant="secondary">{sceneStats.materials}</Badge>
              </div>
              <div className="stat-item">
                <div className="stat-label">Lights</div>
                <Badge variant="secondary">{sceneStats.lights}</Badge>
              </div>
              <div className="stat-item">
                <div className="stat-label">Cameras</div>
                <Badge variant="secondary">{sceneStats.cameras}</Badge>
              </div>
              <div className="stat-item">
                <div className="stat-label">Textures</div>
                <Badge variant="secondary">{sceneStats.textures}</Badge>
              </div>
              <div className="stat-item">
                <div className="stat-label">Particles</div>
                <Badge variant="secondary">{sceneStats.particleSystems}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tool Status */}
        <Card className="tools-card">
          <CardHeader className="tools-header">
            <CardTitle className="text-sm flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Active Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="tools-content">
            <div className="tools-status">
              <div className={`tool-item ${toolStates.move ? 'active' : ''}`}>
                <Move3D className="w-4 h-4" />
                <span>Move</span>
                {toolStates.move && <CheckCircle className="w-3 h-3 text-green-500" />}
              </div>
              <div className={`tool-item ${toolStates.rotate ? 'active' : ''}`}>
                <RotateCw className="w-4 h-4" />
                <span>Rotate</span>
                {toolStates.rotate && <CheckCircle className="w-3 h-3 text-green-500" />}
              </div>
              <div className={`tool-item ${toolStates.scale ? 'active' : ''}`}>
                <Scale className="w-4 h-4" />
                <span>Scale</span>
                {toolStates.scale && <CheckCircle className="w-3 h-3 text-green-500" />}
              </div>
              <div className={`tool-item ${toolStates.camera ? 'active' : ''}`}>
                <Camera className="w-4 h-4" />
                <span>Camera</span>
                {toolStates.camera && <CheckCircle className="w-3 h-3 text-green-500" />}
              </div>
              <div className={`tool-item ${toolStates.measure ? 'active' : ''}`}>
                <Ruler className="w-4 h-4" />
                <span>Measure</span>
                {toolStates.measure && <CheckCircle className="w-3 h-3 text-green-500" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="actions-card">
          <CardHeader className="actions-header">
            <CardTitle className="text-sm flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="actions-content">
            <div className="quick-actions">
              <Button variant="outline" size="sm" className="quick-action">
                <Save className="w-4 h-4 mr-2" />
                Save Scene
              </Button>
              <Button variant="outline" size="sm" className="quick-action">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm" className="quick-action">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="quick-action">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset View
              </Button>
              <Button variant="outline" size="sm" className="quick-action">
                <Grid3X3 className="w-4 h-4 mr-2" />
                Toggle Grid
              </Button>
              <Button variant="outline" size="sm" className="quick-action">
                <Lightbulb className="w-4 h-4 mr-2" />
                Toggle Lights
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <div className="status-item">
            <div className="status-label">Memory:</div>
            <div className="status-value">{performanceData.memoryUsage}</div>
          </div>
          <div className="status-item">
            <div className="status-label">GPU:</div>
            <div className="status-value">{performanceData.gpuMemory}</div>
          </div>
          <div className="status-item">
            <div className="status-label">CPU:</div>
            <div className="status-value">{performanceData.cpuUsage}%</div>
          </div>
        </div>

        <div className="status-center">
          <div className="status-item">
            <div className="status-label">Performance:</div>
            <Badge variant={performanceData.fps >= 50 ? 'default' : performanceData.fps >= 30 ? 'secondary' : 'destructive'}>
              {performanceData.fps >= 50 ? 'Good' : performanceData.fps >= 30 ? 'Medium' : 'Poor'}
            </Badge>
          </div>
        </div>

        <div className="status-right">
          <div className="status-item">
            <div className="status-label">Mode:</div>
            <div className="status-value">{state.performanceMode}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Quality:</div>
            <div className="status-value">{state.renderingQuality}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Performance Monitor Component
interface PerformanceMonitorProps {
  isVisible: boolean;
  onClose?: () => void;
}

export function PerformanceMonitor({ isVisible, onClose }: PerformanceMonitorProps) {
  const [history, setHistory] = React.useState<Array<{ fps: number; frameTime: number; timestamp: number }>>([]);

  React.useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      // Simulate performance data collection
      const fps = 60 + Math.random() * 10 - 5; // 55-65 FPS
      const frameTime = 1000 / fps;

      setHistory(prev => {
        const newHistory = [...prev, { fps, frameTime, timestamp: Date.now() }];
        return newHistory.slice(-100); // Keep last 100 entries
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const avgFps = history.length > 0 ? history.reduce((sum, h) => sum + h.fps, 0) / history.length : 0;
  const avgFrameTime = history.length > 0 ? history.reduce((sum, h) => sum + h.frameTime, 0) / history.length : 0;

  return (
    <div className="performance-monitor">
      <div className="monitor-header">
        <h3>Performance Monitor</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XCircle className="w-4 h-4" />
        </Button>
      </div>

      <div className="monitor-content">
        <div className="monitor-stats">
          <div className="stat">
            <div className="stat-label">Average FPS</div>
            <div className="stat-value">{avgFps.toFixed(1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Average Frame Time</div>
            <div className="stat-value">{avgFrameTime.toFixed(1)}ms</div>
          </div>
          <div className="stat">
            <div className="stat-label">Samples</div>
            <div className="stat-value">{history.length}</div>
          </div>
        </div>

        <div className="monitor-chart">
          <div className="chart-title">FPS History</div>
          <div className="chart-container">
            {history.slice(-50).map((entry, index) => (
              <div
                key={index}
                className="chart-bar"
                style={{
                  height: `${(entry.fps / 70) * 100}%`,
                  backgroundColor: entry.fps >= 50 ? '#10b981' : entry.fps >= 30 ? '#f59e0b' : '#ef4444'
                }}
                title={`FPS: ${entry.fps.toFixed(1)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Console Component
interface ConsoleProps {
  isVisible: boolean;
  onClose?: () => void;
}

export function Console({ isVisible, onClose }: ConsoleProps) {
  const [logs, setLogs] = React.useState<Array<{ level: 'info' | 'warn' | 'error'; message: string; timestamp: number }>>([]);
  const [filter, setFilter] = React.useState<'all' | 'info' | 'warn' | 'error'>('all');

  React.useEffect(() => {
    if (!isVisible) return;

    // Simulate console logging
    const interval = setInterval(() => {
      const messages = [
        'Scene loaded successfully',
        'Material compiled',
        'Texture loaded',
        'Animation started',
        'Camera updated',
        'Light enabled',
        'Mesh rendered',
        'Physics calculated',
      ];

      const levels: Array<'info' | 'warn' | 'error'> = ['info', 'info', 'info', 'warn', 'error'];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      const randomLevel = levels[Math.floor(Math.random() * levels.length)];

      setLogs(prev => {
        const newLogs = [...prev, {
          level: randomLevel,
          message: randomMessage,
          timestamp: Date.now()
        }];
        return newLogs.slice(-100); // Keep last 100 logs
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const filteredLogs = logs.filter(log => filter === 'all' || log.level === filter);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogClass = (level: string) => {
    switch (level) {
      case 'error': return 'log-error';
      case 'warn': return 'log-warn';
      default: return 'log-info';
    }
  };

  return (
    <div className="console-panel">
      <div className="console-header">
        <h3>Console</h3>
        <div className="console-controls">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="console-filter" title="Filter logs by level">
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="console-content">
        <div className="console-logs">
          {filteredLogs.map((log, index) => (
            <div key={index} className={`console-log ${getLogClass(log.level)}`}>
              <div className="log-icon">
                {getLogIcon(log.level)}
              </div>
              <div className="log-content">
                <div className="log-message">{log.message}</div>
                <div className="log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
