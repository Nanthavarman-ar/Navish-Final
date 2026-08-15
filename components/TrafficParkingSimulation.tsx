import React, { useState, useEffect } from 'react';
import { SimulationManager } from './SimulationManager';
import './TrafficParkingSimulation.css';

interface TrafficParkingSimulationProps {
  simulationManager: SimulationManager;
  onSimulationComplete?: (results: TrafficSimulationResult) => void;
}

interface TrafficSimulationResult {
  totalVehicles: number;
  parkingEfficiency: number;
  trafficFlow: any[];
  congestionPoints: any[];
  recommendations: string[];
  parkingSpaces: any[];
}

const TrafficParkingSimulation: React.FC<TrafficParkingSimulationProps> = ({
  simulationManager,
  onSimulationComplete
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<TrafficSimulationResult | null>(null);
  const [simulationDuration, setSimulationDuration] = useState(60); // seconds
  const [trafficDensity, setTrafficDensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [showTrafficVisualization, setShowTrafficVisualization] = useState(false);
  const [showParkingVisualization, setShowParkingVisualization] = useState(false);
  const [showCongestionVisualization, setShowCongestionVisualization] = useState(false);
  const [parkingSpaces, setParkingSpaces] = useState<any[]>([]);
  const [peopleSimulationEnabled, setPeopleSimulationEnabled] = useState(false);

  useEffect(() => {
    // Sync visualization toggles with SimulationManager
    if (showTrafficVisualization) {
      simulationManager.toggleTrafficVisualization();
    }
    if (showParkingVisualization) {
      simulationManager.toggleParkingVisualization();
    }
    if (showCongestionVisualization) {
      simulationManager.toggleCongestionVisualization();
    }
  }, [simulationManager, showTrafficVisualization, showParkingVisualization, showCongestionVisualization]);

  useEffect(() => {
    // Handle people simulation toggle
    if (simulationManager) {
      if (peopleSimulationEnabled) {
        simulationManager.enablePeopleSimulation();
      } else {
        simulationManager.disablePeopleSimulation();
      }
    }
  }, [simulationManager, peopleSimulationEnabled]);

  const startTrafficSimulation = async () => {
    setIsSimulating(true);

    try {
      // Run simulation through SimulationManager
      await simulationManager.simulateTrafficFlow(simulationDuration, trafficDensity);
      await simulationManager.simulateParkingSpaces();
      await simulationManager.simulateCongestion();

      // Get results from SimulationManager
      const trafficFlow = simulationManager.getTrafficFlowData();
      const parkingSpaces = simulationManager.getParkingSpaceData();
      const congestionPoints = simulationManager.getCongestionData();

      // Analyze results
      const totalVehicles = trafficFlow.reduce((sum, flow) => sum + Math.round(flow.density), 0);
      const parkingEfficiency = calculateParkingEfficiency(parkingSpaces);
      const recommendations = generateRecommendations(trafficFlow, parkingSpaces, congestionPoints);

      const simulationResult: TrafficSimulationResult = {
        totalVehicles,
        parkingEfficiency,
        trafficFlow,
        congestionPoints,
        recommendations,
        parkingSpaces
      };

      setResults(simulationResult);

      if (onSimulationComplete) {
        onSimulationComplete(simulationResult);
      }

    } catch (error) {
      console.error('Traffic simulation failed:', error);
      alert('Traffic simulation failed. Please check the console for details.');
    } finally {
      setIsSimulating(false);
    }
  };

  const calculateParkingEfficiency = (parkingSpaces: any[]): number => {
    if (parkingSpaces.length === 0) return 0;

    const occupiedSpaces = parkingSpaces.filter(space => space.occupied).length;
    const utilization = (occupiedSpaces / parkingSpaces.length) * 100;

    const handicapSpaces = parkingSpaces.filter(space => space.type === 'handicap').length;
    const electricSpaces = parkingSpaces.filter(space => space.type === 'electric').length;

    let efficiency = 80; // Base efficiency

    // Penalize poor handicap access
    if (handicapSpaces < parkingSpaces.length * 0.05) {
      efficiency -= 10;
    }

    // Penalize poor EV charging access
    if (electricSpaces < parkingSpaces.length * 0.1) {
      efficiency -= 5;
    }

    // Penalize over/under utilization
    if (utilization > 95) {
      efficiency -= 15; // Too crowded
    } else if (utilization < 60) {
      efficiency -= 10; // Underutilized
    }

    return Math.max(0, efficiency);
  };

  const generateRecommendations = (trafficFlow: any[], parkingSpaces: any[], congestionPoints: any[]): string[] => {
    const recommendations: string[] = [];

    const highCongestionRoads = trafficFlow.filter(flow => flow.congestionLevel === 'high');
    if (highCongestionRoads.length > 0) {
      recommendations.push(`${highCongestionRoads.length} roads experiencing high congestion. Consider traffic signal optimization or lane additions.`);
    }

    const lowSpeedRoads = trafficFlow.filter(flow => flow.averageSpeed < 30);
    if (lowSpeedRoads.length > 0) {
      recommendations.push(`${lowSpeedRoads.length} roads have low average speeds. Review traffic flow and potential bottlenecks.`);
    }

    if (congestionPoints.length > 3) {
      recommendations.push("Multiple congestion points detected. Consider implementing smart traffic management systems.");
    }

    const occupiedSpaces = parkingSpaces.filter(space => space.occupied).length;
    const utilization = (occupiedSpaces / parkingSpaces.length) * 100;

    if (utilization > 90) {
      recommendations.push("High parking utilization detected. Consider expanding parking facilities.");
    }

    const handicapSpaces = parkingSpaces.filter(space => space.type === 'handicap').length;
    if (handicapSpaces < parkingSpaces.length * 0.05) {
      recommendations.push("Increase handicap parking spaces to meet accessibility requirements.");
    }

    const electricSpaces = parkingSpaces.filter(space => space.type === 'electric').length;
    if (electricSpaces < parkingSpaces.length * 0.1) {
      recommendations.push("Add more electric vehicle charging stations.");
    }

    recommendations.push("Consider peak hour traffic patterns for comprehensive analysis.");

    return recommendations;
  };

  const exportTrafficReport = () => {
    if (!results) return;

    const report = {
      simulationDate: new Date().toISOString(),
      duration: simulationDuration,
      density: trafficDensity,
      results
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-simulation-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="traffic-parking-simulation">
      <h3>Traffic & Parking Simulation</h3>

      {/* Controls */}
      <div className="controls-section">
        <div className="control-row">
          <label className="control-label">
            Simulation Duration:
            <input
              type="range"
              min="30"
              max="300"
              value={simulationDuration}
              onChange={(e) => setSimulationDuration(Number(e.target.value))}
              className="duration-input"
            />
            <span className="duration-value">{simulationDuration}s</span>
          </label>
        </div>

        <div className="control-row">
          <label className="control-label">
            Traffic Density:
            <select
              value={trafficDensity}
              onChange={(e) => setTrafficDensity(e.target.value as any)}
              className="density-select"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div className="control-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showTrafficVisualization}
              onChange={(e) => setShowTrafficVisualization(e.target.checked)}
            />
            Show Traffic Visualization
          </label>
        </div>

        <div className="control-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={peopleSimulationEnabled}
              onChange={(e) => setPeopleSimulationEnabled(e.target.checked)}
            />
            Enable People Simulation
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          onClick={startTrafficSimulation}
          disabled={isSimulating}
          className="start-button"
        >
          {isSimulating ? 'Simulating...' : 'Start Simulation'}
        </button>

        {results && (
          <>
        <button
          onClick={() => setPeopleSimulationEnabled(!peopleSimulationEnabled)}
          className="people-simulation-toggle-button"
        >
          {peopleSimulationEnabled ? 'Disable People Simulation' : 'Enable People Simulation'}
        </button>
            <button
              onClick={exportTrafficReport}
              className="export-button"
            >
              Export Report
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="results-section">
          <h4>Simulation Results</h4>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value total-vehicles">
                {results.totalVehicles}
              </div>
              <div className="stat-label">Total Vehicles</div>
            </div>

            <div className="stat-card">
              <div className="stat-value parking-efficiency">
                {results.parkingEfficiency.toFixed(1)}%
              </div>
              <div className="stat-label">Parking Efficiency</div>
            </div>

            <div className="stat-card">
              <div className="stat-value road-segments">
                {results.trafficFlow.length}
              </div>
              <div className="stat-label">Road Segments</div>
            </div>

            <div className="stat-card">
              <div className="stat-value congestion-points">
                {results.congestionPoints.length}
              </div>
              <div className="stat-label">Congestion Points</div>
            </div>
          </div>

          {/* Traffic Flow Details */}
          <div className="traffic-flow-section">
            <h5>Traffic Flow Analysis</h5>
            <div className="traffic-flow-list">
              {results.trafficFlow.map((flow, index) => {
                const congestionText = flow.congestionLevel < 0.3 ? 'Low' : flow.congestionLevel < 0.7 ? 'Medium' : 'High';
                const congestionClass = flow.congestionLevel < 0.3 ? 'low' : flow.congestionLevel < 0.7 ? 'medium' : 'high';
                return (
                  <div
                    key={index}
                    className="traffic-flow-item"
                  >
                    <div className="road-name">
                      {flow.roadId}
                    </div>
                    <div className="road-details">
                      Vehicles: {Math.round(flow.density)} | Speed: {flow.speed.toFixed(1)} km/h
                    </div>
                    <div className={`congestion-level ${congestionClass}`}>
                      Congestion: {congestionText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parking Analysis */}
          <div className="parking-analysis-section">
            <h5>Parking Analysis</h5>
            <div className="parking-types-grid">
              {results.parkingSpaces && Object.entries(
                results.parkingSpaces.reduce((acc: Record<string, number>, space: any) => {
                  acc[space.type] = (acc[space.type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} className="parking-type-card">
                  <div className="parking-count">{count}</div>
                  <div className="parking-type">{type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="recommendations-section">
            <h5>Recommendations</h5>
            <ul className="recommendations-list">
              {results.recommendations.map((rec, index) => (
                <li key={index} className="recommendation-item">{rec.replace(/<[^>]*>/g, '')}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficParkingSimulation;
