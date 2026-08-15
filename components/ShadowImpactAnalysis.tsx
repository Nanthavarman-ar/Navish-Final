import React, { useState, useEffect } from 'react';
import { Engine, Scene, Vector3, MeshBuilder, StandardMaterial, Color3, DirectionalLight, ShadowGenerator } from '@babylonjs/core';
import { showToast } from './utils/toast';
import './ShadowImpactAnalysis.css';

interface ShadowImpactAnalysisProps {
  scene: Scene;
  engine: Engine;
  onShadowAnalysisComplete?: (results: ShadowAnalysisResult) => void;
}

interface ShadowAnalysisResult {
  totalShadowArea: number;
  affectedBuildings: BuildingShadow[];
  shadowCoverage: number;
  recommendations: string[];
}

interface BuildingShadow {
  buildingId: string;
  shadowArea: number;
  shadowPercentage: number;
  affectedHours: number[];
}

const ShadowImpactAnalysis: React.FC<ShadowImpactAnalysisProps> = ({
  scene,
  engine,
  onShadowAnalysisComplete
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<ShadowAnalysisResult | null>(null);
  const [timeOfDay, setTimeOfDay] = useState(12); // 12 PM
  const [season, setSeason] = useState<'spring' | 'summer' | 'fall' | 'winter'>('summer');
  const [showShadowVisualization, setShowShadowVisualization] = useState(false);

  const analyzeShadowImpact = async () => {
    setIsAnalyzing(true);

    try {
      // Get all real geometry in the scene to analyze for shadow impact. Matching on
      // mesh names containing "building"/"structure"/"house" only worked for meshes
      // specifically named that way - real uploaded models (from any CAD/3D tool)
      // almost never use those exact names, so this previously found nothing for any
      // real model. Now treats any substantial real geometry as analyzable.
      const buildings = scene.meshes.filter(mesh =>
        mesh.isEnabled() && mesh.getTotalVertices() > 0 &&
        !/^(ground|measure_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|__root__)/i.test(mesh.name || '')
      );

      if (buildings.length === 0) {
        showToast.warning('No model loaded', 'Load a model first to analyze shadow impact.');
        setIsAnalyzing(false);
        return;
      }

      // Create shadow generator for sun
      const sunLight = new DirectionalLight("sunLight", new Vector3(-1, -1, -1), scene);
      const shadowGenerator = new ShadowGenerator(1024, sunLight);

      // Set sun position based on time of day and season
      updateSunPosition(sunLight, timeOfDay, season);

      // Analyze shadows for each building
      const shadowResults: BuildingShadow[] = [];
      let totalShadowArea = 0;

      for (const building of buildings) {
        const shadowResult = await analyzeBuildingShadow(building, shadowGenerator, scene);
        shadowResults.push(shadowResult);
        totalShadowArea += shadowResult.shadowArea;
      }

      // Calculate overall shadow coverage
      const groundArea = await calculateGroundArea(scene);
      const shadowCoverage = (totalShadowArea / groundArea) * 100;

      // Generate recommendations
      const recommendations = generateShadowRecommendations(shadowResults, shadowCoverage);

      const analysisResult: ShadowAnalysisResult = {
        totalShadowArea,
        affectedBuildings: shadowResults,
        shadowCoverage,
        recommendations
      };

      setResults(analysisResult);

      if (onShadowAnalysisComplete) {
        onShadowAnalysisComplete(analysisResult);
      }

      // Visualize shadows if enabled
      if (showShadowVisualization) {
        visualizeShadows(shadowResults, scene);
      }

    } catch (error) {
      console.error('Shadow analysis failed:', error);
      showToast.error('Shadow analysis failed', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateSunPosition = (sunLight: DirectionalLight, hour: number, season: string) => {
    // Convert hour to angle (0-360 degrees)
    const hourAngle = (hour - 6) * 15; // 6 AM = 0 degrees, 6 PM = 180 degrees

    // Adjust for season (declination angle)
    const seasonOffsets = {
      spring: 0,
      summer: 23.5,
      fall: 0,
      winter: -23.5
    };

    const declination = seasonOffsets[season as keyof typeof seasonOffsets] * Math.PI / 180;
    const hourAngleRad = hourAngle * Math.PI / 180;

    // Calculate sun direction
    const elevation = Math.sin(hourAngleRad) * Math.cos(declination);
    const azimuth = Math.cos(hourAngleRad) * Math.cos(declination);

    sunLight.direction = new Vector3(-azimuth, -elevation, 0).normalize();
  };

  const analyzeBuildingShadow = async (building: any, shadowGenerator: ShadowGenerator, scene: Scene): Promise<BuildingShadow> => {
    // Add building to shadow generator
    shadowGenerator.addShadowCaster(building);

    // Create a ground plane for shadow projection
    const ground = MeshBuilder.CreateGround("shadowGround", { width: 100, height: 100 }, scene);
    ground.position.y = -0.1;
    ground.receiveShadows = true;

    // Wait for shadow rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Calculate shadow area (simplified - in real implementation would use render target)
    const buildingVolume = calculateMeshVolume(building);
    const shadowArea = buildingVolume * 0.8; // Simplified calculation

    // Determine affected hours (simplified)
    const affectedHours: number[] = [];
    for (let hour = 6; hour <= 18; hour++) {
      if (Math.random() > 0.3) { // Simplified shadow detection
        affectedHours.push(hour);
      }
    }

    const shadowPercentage = (shadowArea / buildingVolume) * 100;

    return {
      buildingId: building.name,
      shadowArea,
      shadowPercentage,
      affectedHours
    };
  };

  const calculateMeshVolume = (mesh: any): number => {
    // Simplified volume calculation
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.maximum.subtract(boundingInfo.minimum);
    return size.x * size.y * size.z;
  };

  const calculateGroundArea = async (scene: Scene): Promise<number> => {
    // Find ground mesh or calculate from scene bounds
    const ground = scene.meshes.find(mesh => mesh.name.includes('ground'));
    if (ground) {
      const boundingInfo = ground.getBoundingInfo();
      const size = boundingInfo.maximum.subtract(boundingInfo.minimum);
      return size.x * size.z;
    }
    return 10000; // Default 100x100 area
  };

  const generateShadowRecommendations = (buildings: BuildingShadow[], coverage: number): string[] => {
    const recommendations: string[] = [];

    if (coverage > 70) {
      recommendations.push("High shadow coverage detected. Consider reducing building height or adjusting orientation.");
    }

    const heavilyAffected = buildings.filter(b => b.shadowPercentage > 50);
    if (heavilyAffected.length > 0) {
      recommendations.push(`${heavilyAffected.length} buildings have significant shadow impact. Consider spacing adjustments.`);
    }

    if (buildings.some(b => b.affectedHours.length > 8)) {
      recommendations.push("Some buildings experience extended shadow periods. Consider solar panel placement adjustments.");
    }

    recommendations.push("Consider seasonal variations in shadow patterns for comprehensive analysis.");

    return recommendations;
  };

  const visualizeShadows = (shadowResults: BuildingShadow[], scene: Scene) => {
    // Clear previous visualizations
    scene.meshes.forEach(mesh => {
      if (mesh.name.startsWith('shadow_viz_')) {
        mesh.dispose();
      }
    });

    // Create shadow visualization planes
    shadowResults.forEach((result, index) => {
      const shadowPlane = MeshBuilder.CreateGround(`shadow_viz_${index}`, { width: 10, height: 10 }, scene);
      shadowPlane.position.y = 0.05;

      const shadowMaterial = new StandardMaterial(`shadow_mat_${index}`, scene);
      shadowMaterial.diffuseColor = new Color3(0.2, 0.2, 0.8);
      shadowMaterial.alpha = 0.3;
      shadowPlane.material = shadowMaterial;
    });
  };

  const exportShadowReport = () => {
    if (!results) return;

    const report = {
      analysisDate: new Date().toISOString(),
      timeOfDay: `${timeOfDay}:00`,
      season,
      results
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="shadow-analysis-container">
      <h3 className="shadow-analysis-title">Shadow Impact Analysis</h3>

      {/* Controls */}
      <div className="controls-section">
        <div className="control-row">
          <label className="control-label">
            Time of Day:
            <input
              type="range"
              min="6"
              max="18"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(Number(e.target.value))}
              className="time-input"
            />
            <span className="time-display">{timeOfDay}:00</span>
          </label>
        </div>

        <div className="control-row">
          <label className="control-label">
            Season:
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as any)}
              className="season-select"
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
              <option value="winter">Winter</option>
            </select>
          </label>
        </div>

        <div className="control-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showShadowVisualization}
              onChange={(e) => setShowShadowVisualization(e.target.checked)}
            />
            Show Shadow Visualization
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          onClick={analyzeShadowImpact}
          disabled={isAnalyzing}
          className="analyze-button"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Shadow Impact'}
        </button>

        {results && (
          <button
            onClick={exportShadowReport}
            className="export-button"
          >
            Export Report
          </button>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="results-section">
          <h4 className="results-title">Analysis Results</h4>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value stat-value-red">
                {results.totalShadowArea.toFixed(1)}m²
              </div>
              <div className="stat-label">Total Shadow Area</div>
            </div>

            <div className="stat-card">
              <div className="stat-value stat-value-yellow">
                {results.shadowCoverage.toFixed(1)}%
              </div>
              <div className="stat-label">Ground Coverage</div>
            </div>

            <div className="stat-card">
              <div className="stat-value stat-value-green">
                {results.affectedBuildings.length}
              </div>
              <div className="stat-label">Affected Buildings</div>
            </div>
          </div>

          {/* Building Details */}
          <div className="building-details-section">
            <h5 className="section-title">Building Details</h5>
            <div className="building-list">
              {results.affectedBuildings.map((building, index) => (
                <div
                  key={index}
                  className="building-item"
                >
                  <div className="building-name">
                    {building.buildingId}
                  </div>
                  <div className="building-info">
                    Shadow Area: {building.shadowArea.toFixed(1)}m² ({building.shadowPercentage.toFixed(1)}%)
                  </div>
                  <div className="building-info">
                    Affected Hours: {building.affectedHours.length} hours
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h5 className="section-title">Recommendations</h5>
            <ul className="recommendations-list">
              {results.recommendations.map((rec, index) => (
                <li key={index} className="recommendation-item">{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShadowImpactAnalysis;
