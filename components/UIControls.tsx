import React, { useState, useEffect, useRef } from 'react';
import { Engine, Scene, Vector3, Color3, StandardMaterial, Mesh, DynamicTexture } from '@babylonjs/core';
import { FeatureManager } from './FeatureManager';
import { AnalyticsManager } from './AnalyticsManager';
import { MarketManager } from './MarketManager';
import { ExternalAPIManager } from './ExternalAPIManager';
import { SessionManager } from './SessionManager';
import './UIControls.css';

interface UIControlsProps {
  engine: Engine;
  scene: Scene;
  featureManager: FeatureManager;
  analyticsManager: AnalyticsManager;
  marketManager: MarketManager;
  externalAPIManager: ExternalAPIManager;
  sessionManager: SessionManager;
}

interface ControlPanel {
  id: string;
  title: string;
  icon: string;
  isOpen: boolean;
  position: { x: number; y: number };
}

export const UIControls: React.FC<UIControlsProps> = ({
  engine,
  scene,
  featureManager,
  analyticsManager,
  marketManager,
  externalAPIManager,
  sessionManager
}) => {
  const [activePanels, setActivePanels] = useState<ControlPanel[]>([
    { id: 'analytics', title: 'Analytics', icon: '📊', isOpen: false, position: { x: 10, y: 10 } },
    { id: 'market', title: 'Market', icon: '🛒', isOpen: false, position: { x: 10, y: 120 } },
    { id: 'external', title: 'External APIs', icon: '🌐', isOpen: false, position: { x: 10, y: 230 } },
    { id: 'session', title: 'Session', icon: '🎮', isOpen: false, position: { x: 10, y: 340 } },
    { id: 'features', title: 'Features', icon: '⚙️', isOpen: false, position: { x: 10, y: 450 } }
  ]);

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [isVRMode, setIsVRMode] = useState<boolean>(false);
  const [isARMode, setIsARMode] = useState<boolean>(false);
  const [showroomActive, setShowroomActive] = useState<boolean>(false);
  const [mapVisible, setMapVisible] = useState<boolean>(false);

  const analyticsRef = useRef<HTMLDivElement>(null);
  const marketRef = useRef<HTMLDivElement>(null);
  const externalRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize UI controls
    initializeUIControls();
  }, []);

  const initializeUIControls = () => {
    // Create floating UI panels in 3D space
    createFloatingPanels();
  };

  const createFloatingPanels = () => {
    activePanels.forEach(panel => {
      const panelMesh = Mesh.CreatePlane(`ui_panel_${panel.id}`, 2, scene);
      panelMesh.position = new Vector3(panel.position.x, panel.position.y, 0);

      const material = new StandardMaterial(`ui_panel_material_${panel.id}`, scene);
      const texture = new DynamicTexture(`ui_panel_texture_${panel.id}`, { width: 512, height: 256 }, scene, false);

      material.diffuseTexture = texture;
      material.disableLighting = true;
      panelMesh.material = material;

      // Initially hide panels
      panelMesh.setEnabled(false);
    });
  };

  const togglePanel = (panelId: string) => {
    setActivePanels(prev => prev.map(panel =>
      panel.id === panelId
        ? { ...panel, isOpen: !panel.isOpen }
        : panel
    ));

    // Update 3D panel visibility
    const panelMesh = scene.getMeshByName(`ui_panel_${panelId}`);
    if (panelMesh) {
      panelMesh.setEnabled(!panelMesh.isEnabled());
    }
  };

  const handleStartVRSession = async () => {
    const success = await sessionManager.startVRSession();
    if (success) {
      setIsVRMode(true);
      console.log('VR session started');
    }
  };

  const handleStartARSession = async () => {
    const success = await sessionManager.startARSession();
    if (success) {
      setIsARMode(true);
      console.log('AR session started');
    }
  };

  const handleEndSession = async () => {
    await sessionManager.endSession();
    setIsVRMode(false);
    setIsARMode(false);
    console.log('Session ended');
  };

  const handleToggleShowroom = () => {
    marketManager.toggleShowroom();
    setShowroomActive(!showroomActive);
  };

  const handleToggleMap = () => {
    externalAPIManager.toggleMapVisualization();
    setMapVisible(!mapVisible);
  };

  const handleSearchLocation = async () => {
    if (!searchLocation.trim()) return;

    const location = await externalAPIManager.geocodeAddress(searchLocation);
    if (location) {
      // Load map for the location
      await externalAPIManager.loadOpenStreetMap(location);

      // Create a marker
      externalAPIManager.createLocationMarker(location, searchLocation);

      console.log('Location found and marked:', location);
    }
  };

  const handleAddToCart = (productId: string) => {
    const success = marketManager.addToCart('user_123', productId);
    if (success) {
      console.log('Product added to cart:', productId);
    }
  };

  const handleVirtualTryOn = (productId: string) => {
    const userPosition = new Vector3(0, 1.6, 0); // Eye level
    const success = marketManager.enableVirtualTryOn(productId, userPosition);
    if (success) {
      console.log('Virtual try-on enabled for:', productId);
    }
  };

  const renderAnalyticsPanel = () => (
    <div
      ref={analyticsRef}
      className={`ui-panel analytics-panel ${activePanels.find(p => p.id === 'analytics')?.isOpen ? '' : 'hidden'}`}
    >
      <h3>📊 Analytics Dashboard</h3>

      <div className="analytics-controls">
        <button className="ui-button" onClick={() => {
          const userId = 'user_123';
          const location = new Vector3(0, 0, 0);
          analyticsManager.trackEmotion(userId, 'happy', 0.8, location, 'ui_start');
        }}>
          Start Emotion Tracking
        </button>
        <button className="ui-button" onClick={() => {
          const userId = 'user_123';
          const location = new Vector3(0, 0, 0);
          analyticsManager.trackEmotion(userId, 'neutral', 0.5, location, 'ui_stop');
        }}>
          Stop Emotion Tracking
        </button>
        <button className="ui-button" onClick={() => analyticsManager.toggleHeatmapVisualization()}>
          Toggle Heatmap
        </button>
      </div>

      <div className="analytics-metrics">
        <h4>Current Metrics:</h4>
        <div>Active Users: {analyticsManager.getClientEngagement().length}</div>
        <div>Tracked Emotions: {analyticsManager.getEmotionData().length}</div>
        <div>Heatmap Points: {analyticsManager.getUsageHeatmap().length}</div>
      </div>

      <div className="analytics-export">
        <button className="ui-button" onClick={() => console.log(analyticsManager.exportAnalytics())}>
          Export Data
        </button>
      </div>
    </div>
  );

  const renderMarketPanel = () => (
    <div
      ref={marketRef}
      className={`ui-panel market-panel ${activePanels.find(p => p.id === 'market')?.isOpen ? '' : 'hidden'}`}
    >
      <h3>🛒 Virtual Marketplace</h3>

      <div className="market-controls">
        <button
          onClick={handleToggleShowroom}
          className={`ui-button ${showroomActive ? 'active' : ''}`}
        >
          {showroomActive ? 'Hide' : 'Show'} Virtual Showroom
        </button>

        <div className="product-list">
          <h4>Available Products:</h4>
          {marketManager.getProducts().map(product => (
            <div key={product.id} className="product-item">
              <span>{product.name} - ${product.price}</span>
              <button className="ui-button" onClick={() => handleAddToCart(product.id)}>Add to Cart</button>
              <button className="ui-button" onClick={() => handleVirtualTryOn(product.id)}>Try On</button>
            </div>
          ))}
        </div>

        <div className="cart-info">
          <h4>Shopping Cart:</h4>
          <div>Items: {marketManager.getCart('user_123')?.items.length || 0}</div>
          <div>Total: ${marketManager.getCart('user_123')?.total.toFixed(2) || '0.00'}</div>
        </div>
      </div>
    </div>
  );

  const renderExternalPanel = () => (
    <div
      ref={externalRef}
      className={`ui-panel external-panel ${activePanels.find(p => p.id === 'external')?.isOpen ? '' : 'hidden'}`}
    >
      <h3>🌐 External APIs</h3>

      <div className="external-controls">
        <button
          onClick={handleToggleMap}
          className={`ui-button ${mapVisible ? 'active' : ''}`}
        >
          {mapVisible ? 'Hide' : 'Show'} Map
        </button>

        <div className="location-search">
          <input
            type="text"
            placeholder="Search location..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            className="ui-input"
          />
          <button className="ui-button" onClick={handleSearchLocation}>Search</button>
        </div>

        <div className="api-status">
          <h4>API Status:</h4>
          <div>OpenStreetMap: ✅ Enabled</div>
          <div>Weather API: {externalAPIManager.getConfig().weatherApiEnabled ? '✅' : '❌'} Disabled</div>
          <div>Traffic API: {externalAPIManager.getConfig().trafficApiEnabled ? '✅' : '❌'} Disabled</div>
        </div>
      </div>
    </div>
  );

  const renderSessionPanel = () => (
    <div
      ref={sessionRef}
      className={`ui-panel session-panel ${activePanels.find(p => p.id === 'session')?.isOpen ? '' : 'hidden'}`}
    >
      <h3>🎮 Session Management</h3>

      <div className="session-controls">
        <div className="session-buttons">
          <button
            onClick={handleStartVRSession}
            disabled={isVRMode || isARMode}
            className={`ui-button ${isVRMode ? 'active' : ''}`}
          >
            Start VR Session
          </button>
          <button
            onClick={handleStartARSession}
            disabled={isVRMode || isARMode}
            className={`ui-button ${isARMode ? 'active' : ''}`}
          >
            Start AR Session
          </button>
          <button
            onClick={handleEndSession}
            disabled={!isVRMode && !isARMode}
            className="ui-button"
          >
            End Session
          </button>
        </div>

        <div className="quality-controls">
          <h4>Quality Settings:</h4>
          <select
            onChange={(e) => sessionManager.setQualitySettings(e.target.value as any)}
            className="ui-select"
            title="Select quality settings for the session"
            aria-label="Quality settings selector"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ultra">Ultra</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderFeaturesPanel = () => (
    <div
      ref={featuresRef}
      className={`ui-panel features-panel ${activePanels.find(p => p.id === 'features')?.isOpen ? '' : 'hidden'}`}
    >
      <h3>⚙️ Feature Controls</h3>

      <div className="feature-toggles">
        <h4>Available Features:</h4>
        {featureManager.getAllFeatures().map(feature => (
          <div key={feature.id} className="feature-item">
            <span>{feature.name}</span>
            <button
              onClick={() => {
                const isEnabled = featureManager.isFeatureEnabled(feature.id);
                featureManager.setFeatureEnabled(feature.id, !isEnabled);
              }}
              className={`ui-button ${featureManager.isFeatureEnabled(feature.id) ? 'active' : ''}`}
            >
              {featureManager.isFeatureEnabled(feature.id) ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      <div className="feature-stats">
        <h4>Feature Usage:</h4>
        <div>Active Features: {featureManager.getAllFeatures().filter(f => featureManager.isFeatureEnabled(f.id)).length}</div>
        <div>Total Features: {featureManager.getAllFeatures().length}</div>
      </div>
    </div>
  );

  return (
    <div className="ui-controls-container">
      {/* Control Panel Toggle Buttons */}
      <div className="control-buttons">
        {activePanels.map(panel => (
          <button
            key={panel.id}
            onClick={() => togglePanel(panel.id)}
            className={`control-button ${panel.isOpen ? 'active' : ''}`}
          >
            {panel.icon} {panel.title}
          </button>
        ))}
      </div>

      {/* Individual Panels */}
      {renderAnalyticsPanel()}
      {renderMarketPanel()}
      {renderExternalPanel()}
      {renderSessionPanel()}
      {renderFeaturesPanel()}

      {/* Global Status Bar */}
      <div className="status-bar">
        <div className="status-bar-content">
          <div>
        FPS: {engine.getFps().toFixed(1)} |
        Session: {sessionManager.getSessionType() || 'Desktop'} |
        Features: {featureManager.getAllFeatures().filter(f => featureManager.isFeatureEnabled(f.id)).length}
      </div>
      <div>
        VR: {isVRMode ? '🟢' : '🔴'} |
        AR: {isARMode ? '🟢' : '🔴'} |
        Map: {mapVisible ? '🟢' : '🔴'}
      </div>
        </div>
      </div>
    </div>
  );
};

export default UIControls;
