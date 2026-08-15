import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { SustainabilityManager, SustainabilityReport } from './SustainabilityManager';
import { AccessibilityChecker, AccessibilityIssue } from './AccessibilityChecker';
import { LocalCodeValidator, ComplianceIssue } from './LocalCodeValidator';
import { BIMManager } from './BIMManager';
import { SimulationManager } from './SimulationManager';
import './SustainabilityCompliancePanel.css';

interface SustainabilityCompliancePanelProps {
  scene: BABYLON.Scene;
  bimManager: BIMManager;
  simulationManager: SimulationManager;
}

const SustainabilityCompliancePanel: React.FC<SustainabilityCompliancePanelProps> = ({
  scene,
  bimManager,
  simulationManager
}) => {
  const [activeTab, setActiveTab] = useState<'sustainability' | 'accessibility' | 'compliance' | 'fire-safety'>('sustainability');
  const [sustainabilityReport, setSustainabilityReport] = useState<SustainabilityReport | null>(null);
  const [accessibilityIssues, setAccessibilityIssues] = useState<AccessibilityIssue[]>([]);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [fireSafetyData, setFireSafetyData] = useState<any>(null);

  // Initialize managers
  const sustainabilityManager = new SustainabilityManager(bimManager, simulationManager);
  const accessibilityChecker = new AccessibilityChecker();
  const localCodeValidator = new LocalCodeValidator();

  useEffect(() => {
    // Initialize with current BIM model if available
    const models = bimManager.getAllModels();
    if (models.length > 0) {
      const currentModel = models[0];
      accessibilityChecker.setModel(currentModel);
      localCodeValidator.setModel(currentModel);

      // Generate initial reports
      updateSustainabilityReport();
      updateAccessibilityIssues();
      updateComplianceIssues();
    }
  }, [bimManager, simulationManager]);

  const updateSustainabilityReport = () => {
    const models = bimManager.getAllModels();
    if (models.length > 0) {
      const report = sustainabilityManager.generateReport(models[0].id);
      setSustainabilityReport(report);
    }
  };

  const updateAccessibilityIssues = () => {
    const issues = accessibilityChecker.analyzeAccessibility();
    setAccessibilityIssues(issues);
  };

  const updateComplianceIssues = () => {
    const issues = localCodeValidator.validateCompliance();
    setComplianceIssues(issues);
  };

  // Enhanced compliance validation with detailed rule checking
  const runDetailedComplianceCheck = () => {
    const models = bimManager.getAllModels();
    if (models.length > 0) {
      const currentModel = models[0];
      localCodeValidator.setModel(currentModel);

      // Run comprehensive validation
      const issues = localCodeValidator.validateCompliance();

      // Group issues by type for better organization
      const groupedIssues = issues.reduce((acc, issue) => {
        if (!acc[issue.issueType]) {
          acc[issue.issueType] = [];
        }
        acc[issue.issueType].push(issue);
        return acc;
      }, {} as Record<string, ComplianceIssue[]>);

      setComplianceIssues(issues);
      return groupedIssues;
    }
    return {};
  };

  // Resolve compliance issue
  const resolveComplianceIssue = (issueId: string) => {
    const success = localCodeValidator.resolveIssue(issueId);
    if (success) {
      updateComplianceIssues();
    }
  };

  // Generate compliance report
  const generateComplianceReport = () => {
    const models = bimManager.getAllModels();
    if (models.length === 0) return null;

    const issues = localCodeValidator.validateCompliance();
    const groupedIssues = issues.reduce((acc, issue) => {
      if (!acc[issue.issueType]) {
        acc[issue.issueType] = [];
      }
      acc[issue.issueType].push(issue);
      return acc;
    }, {} as Record<string, ComplianceIssue[]>);

    return {
      modelName: models[0].name || 'Unnamed Model',
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      issuesByType: groupedIssues,
      complianceScore: Math.max(0, 100 - (issues.length * 5)), // Simple scoring
      generatedAt: new Date().toISOString()
    };
  };

  const getGreenScoreColor = (score: number) => {
    if (score >= 0.8) return '#10b981'; // green
    if (score >= 0.6) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="sustainability-panel">
      <h3>Sustainability & Compliance</h3>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {[
          { id: 'sustainability', label: 'Green Score', icon: '🌱' },
          { id: 'accessibility', label: 'Accessibility', icon: '♿' },
          { id: 'compliance', label: 'Code Compliance', icon: '📋' },
          { id: 'fire-safety', label: 'Fire Safety', icon: '🔥' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`tab-button ${activeTab === tab.id ? 'active' : 'inactive'}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'sustainability' && (
        <div>
          <h4>Green Score Preview</h4>

          {sustainabilityReport ? (
            <div>
              {/* Green Score Display */}
              <div className="green-score-display">
              <div className={`green-score-number ${
                sustainabilityReport.greenScore >= 0.8 ? 'green-score-green' :
                sustainabilityReport.greenScore >= 0.6 ? 'green-score-yellow' : 'green-score-red'
              }`}>
                {Math.round(sustainabilityReport.greenScore * 100)}%
              </div>
                <div className="green-score-label">
                  LEED/BREEAM Certification Score
                </div>
              </div>

              {/* Energy Dashboard */}
              <div className="energy-dashboard">
                <h5>Energy Dashboard</h5>
                <div className="energy-grid">
                  <div className="energy-item">
                    <div className="energy-value energy-efficiency">
                      {sustainabilityReport.energyEfficiency.toFixed(1)}%
                    </div>
                    <div className="energy-label">Energy Efficiency</div>
                  </div>
                  <div className="energy-item">
                    <div className="energy-value renewable-energy">
                      {sustainabilityReport.renewableEnergyUsage.toFixed(1)}%
                    </div>
                    <div className="energy-label">Renewable Energy</div>
                  </div>
                  <div className="energy-item">
                    <div className="energy-value predicted-usage">
                      {Math.round(sustainabilityReport.energyUsage)} kWh
                    </div>
                    <div className="energy-label">Predicted Usage</div>
                  </div>
                  <div className="energy-item">
                    <div className="energy-value carbon-footprint">
                      {Math.round(sustainabilityReport.carbonFootprint)} kg
                    </div>
                    <div className="energy-label">CO2 Footprint</div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {sustainabilityReport.recommendations.length > 0 && (
                <div className="recommendations-container">
                  <h5>Recommendations</h5>
                  <div className="recommendations-list">
                    {sustainabilityReport.recommendations.map((rec, index) => (
                      <div key={index} className="recommendation-item">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-data-message">
              No BIM model loaded
            </div>
          )}
        </div>
      )}

      {activeTab === 'accessibility' && (
        <div>
          <h4>Accessibility Checker</h4>

          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={updateAccessibilityIssues}
              className="scan-button"
            >
              🔍 Scan for Issues
            </button>
          </div>

          <div className="issues-container">
            {accessibilityIssues.length > 0 ? (
              accessibilityIssues.map((issue) => (
                <div key={issue.id} className={`issue-item ${
                  issue.severity === 'high' ? 'severity-border-high' :
                  issue.severity === 'medium' ? 'severity-border-medium' : 'severity-border-low'
                }`}>
                  <div className="issue-type">
                    {issue.issueType.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="issue-description">
                    {issue.description}
                  </div>
                  <div className={`issue-severity ${
                    issue.severity === 'high' ? 'severity-high' :
                    issue.severity === 'medium' ? 'severity-medium' : 'severity-low'
                  }`}>
                    Severity: {issue.severity.toUpperCase()}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data-message">
                No accessibility issues found
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div>
          <h4>Local Code Compliance</h4>

          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={updateComplianceIssues}
              className="scan-button"
            >
              📋 Check Compliance
            </button>
          </div>

          <div className="issues-container">
            {complianceIssues.length > 0 ? (
              complianceIssues.map((issue) => (
                <div key={issue.id} className={`issue-item ${
                  issue.severity === 'high' ? 'severity-border-high' :
                  issue.severity === 'medium' ? 'severity-border-medium' : 'severity-border-low'
                }`}>
                  <div className="issue-type">
                    {issue.issueType.toUpperCase()}
                  </div>
                  <div className="issue-description">
                    {issue.description}
                  </div>
                  <div className={`issue-severity ${
                    issue.severity === 'high' ? 'severity-high' :
                    issue.severity === 'medium' ? 'severity-medium' : 'severity-low'
                  }`}>
                    Severity: {issue.severity.toUpperCase()}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data-message">
                All codes compliant
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fire-safety' && (
        <div>
          <h4>Fire Safety Simulation</h4>

          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => {
                // Placeholder for fire safety simulation
                setFireSafetyData({
                  evacuationPaths: ['Path 1: 2.5m wide', 'Path 2: 1.8m wide'],
                  sprinklerCoverage: '85%',
                  smokeSpread: 'Low risk detected'
                });
              }}
              className="fire-safety-button"
            >
              🔥 Run Fire Simulation
            </button>
          </div>

          {fireSafetyData ? (
            <div className="fire-safety-results">
              <div className="fire-safety-item">
                <div className="fire-safety-label">
                  Evacuation Paths
                </div>
                {fireSafetyData.evacuationPaths.map((path: string, index: number) => (
                  <div key={index} className="fire-safety-value">
                    {path}
                  </div>
                ))}
              </div>

              <div className="fire-safety-item">
                <div className="fire-safety-label">
                  Sprinkler Coverage
                </div>
                <div className="fire-safety-value fire-safety-good">
                  {fireSafetyData.sprinklerCoverage}
                </div>
              </div>

              <div className="fire-safety-item">
                <div className="fire-safety-label">
                  Smoke Spread Analysis
                </div>
                <div className="fire-safety-value fire-safety-warning">
                  {fireSafetyData.smokeSpread}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data-message">
              Click "Run Fire Simulation" to analyze fire safety
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SustainabilityCompliancePanel;
