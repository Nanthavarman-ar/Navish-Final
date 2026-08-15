import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useApp } from '../contexts/AppContext';
import TrafficParkingSimulation from './TrafficParkingSimulation';
import { SimulationManager } from './SimulationManager';
import { ArrowLeft, Play, Pause, Square, Download } from 'lucide-react';

const TrafficParkingSimulationPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [simulationManager, setSimulationManager] = useState<SimulationManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize simulation manager with minimal Babylon.js setup
    const initializeSimulation = async () => {
      try {
        // For standalone page, we'll create a minimal Babylon.js scene
        const canvas = document.createElement('canvas');
        canvas.style.display = 'none'; // Hide the canvas since we're not rendering
        document.body.appendChild(canvas);

        const engine = new (await import('@babylonjs/core')).Engine(canvas, true);
        const scene = new (await import('@babylonjs/core')).Scene(engine);

        // Create a minimal FeatureManager mock
        const featureManager = {
          features: [],
          featureStates: new Map(),
          deviceCapabilities: {},
          userPreferences: {},
          registerFeature: () => {},
          unregisterFeature: () => {},
          enableFeature: () => {},
          disableFeature: () => {},
          isFeatureEnabled: () => false,
          getFeatureState: () => null,
          setFeatureState: () => {},
          getDeviceCapabilities: () => ({}),
          setUserPreference: () => {},
          getUserPreference: () => null,
          initialize: () => Promise.resolve(),
          dispose: () => {}
        } as any;

        const manager = new (await import('./SimulationManager')).SimulationManager(engine, scene, featureManager);
        setSimulationManager(manager);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize simulation:', error);
        setIsInitialized(true); // Still set to true to show the UI
      }
    };

    initializeSimulation();
  }, []);

  const handleSimulationComplete = (results: any) => {
    console.log('Simulation completed:', results);
    // Handle results - could show toast or update UI
  };

  if (!isInitialized || !simulationManager) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing Traffic Simulation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setCurrentPage('tools-features')}
              variant="outline"
              className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tools
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Traffic & Parking Simulation</h1>
              <p className="text-gray-400">Analyze traffic flow and parking efficiency</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Info Card */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-cyan-400">About This Tool</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                This simulation tool analyzes traffic patterns and parking efficiency in urban environments.
                Configure simulation parameters, run the analysis, and get detailed reports on congestion,
                parking utilization, and recommendations for improvement.
              </p>
            </CardContent>
          </Card>

          {/* Simulation Component */}
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg border border-slate-700 p-6">
            <TrafficParkingSimulation
              simulationManager={simulationManager}
              onSimulationComplete={handleSimulationComplete}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrafficParkingSimulationPage;
