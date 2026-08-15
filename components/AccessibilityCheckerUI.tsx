import React, { useState, useEffect } from 'react';
import { BIMManager, BIMModel } from './BIMManager';
import { SimulationManager } from './SimulationManager';
import { AccessibilityChecker, AccessibilityIssue } from './AccessibilityChecker';

interface AccessibilityCheckerUIProps {
  bimManager: BIMManager;
  simulationManager: SimulationManager;
  modelId: string | null;
}

const AccessibilityCheckerUI: React.FC<AccessibilityCheckerUIProps> = ({
  bimManager,
  simulationManager,
  modelId
}) => {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<AccessibilityIssue | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const accessibilityChecker = new AccessibilityChecker();

  useEffect(() => {
    if (modelId) {
      runAccessibilityCheck();
    }
  }, [modelId]);

  const runAccessibilityCheck = async () => {
    if (!modelId) return;

    const model = bimManager.getModelById(modelId);
    if (!model) return;

    setLoading(true);
    try {
      accessibilityChecker.setModel(model);
      const foundIssues = accessibilityChecker.analyzeAccessibility();
      setIssues(foundIssues);
    } catch (error) {
      console.error('Failed to run accessibility check:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#f97316';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (issueType: string) => {
    switch (issueType) {
      case 'wheelchair_path': return '♿';
      case 'door_width': return '🚪';
      case 'stairs': return '🪜';
      case 'ramp': return '♿';
      case 'elevator_access': return '🛗';
      default: return '⚠️';
    }
  };

  const filteredIssues = issues.filter(issue => {
    const typeMatch = filterType === 'all' || issue.issueType === filterType;
    const severityMatch = filterSeverity === 'all' || issue.severity === filterSeverity;
    return typeMatch && severityMatch;
  });

  if (!modelId) {
    return (
      <div className="accessibility-checker-container">
        <h3 className="accessibility-checker-title">Accessibility Checker</h3>
        <p className="accessibility-checker-subtitle">Load a BIM model to check accessibility compliance</p>
      </div>
    );
  }

  return (
    <div className="accessibility-checker-container">
      <div className="accessibility-checker-header">
        <h3 className="accessibility-checker-title">Accessibility Checker</h3>
        <button
          onClick={runAccessibilityCheck}
          disabled={loading}
          className={`accessibility-checker-run-button ${loading ? 'disabled' : ''}`}
        >
          {loading ? 'Checking...' : 'Run Check'}
        </button>
      </div>

      {loading ? (
        <div className="accessibility-checker-loading">
          <div>Running accessibility analysis...</div>
        </div>
      ) : issues.length === 0 ? (
        <div className="accessibility-checker-empty">
          Click "Run Check" to analyze accessibility
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="accessibility-checker-summary-cards">
            <div className="summary-card">
              <div className="summary-card-value total-issues">
                {issues.length}
              </div>
              <div className="summary-card-label">Total Issues</div>
            </div>

            <div className="summary-card">
              <div className="summary-card-value compliance-score">
                {Math.max(0, 100 - (issues.length * 10)).toFixed(1)}%
              </div>
              <div className="summary-card-label">Compliance</div>
            </div>
          </div>

          {/* Filters */}
          <div className="accessibility-checker-filters">
            <div className="filters-row">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                title="Filter by accessibility type"
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="mobility">Mobility</option>
                <option value="visual">Visual</option>
                <option value="hearing">Hearing</option>
                <option value="cognitive">Cognitive</option>
              </select>

              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                title="Filter by severity"
                className="filter-select"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Issues List */}
          <div className="accessibility-checker-issues-section">
            <h4 className="issues-section-title">
              Issues ({filteredIssues.length})
            </h4>
            <div className="issues-list-container">
              {filteredIssues.length === 0 ? (
                <div className="no-issues-message">
                  No issues found with current filters
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className={`issue-item ${selectedIssue?.id === issue.id ? 'selected' : ''}`}
                  >
                    <div className="issue-header">
                      <span className="issue-icon">{getTypeIcon(issue.issueType)}</span>
                      <span className={`issue-severity severity-${issue.severity}`}>
                        {issue.severity}
                      </span>
                      <span className="issue-type">
                        {issue.issueType}
                      </span>
                    </div>
                    <div className="issue-description">
                      {issue.description}
                    </div>
                    <div className="issue-location">
                      Location: ({issue.location.center.x.toFixed(1)}, {issue.location.center.y.toFixed(1)}, {issue.location.center.z.toFixed(1)})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected Issue Details */}
          {selectedIssue && (
            <div className={`selected-issue-details severity-border-${selectedIssue.severity}`}>
              <h4 className="selected-issue-title">
                {getTypeIcon(selectedIssue.issueType)} {selectedIssue.description}
              </h4>

              <div className="selected-issue-info">
                <div className="issue-info-item">
                  <strong>Type:</strong> {selectedIssue.issueType}
                </div>
                <div className="issue-info-item">
                  <strong>Severity:</strong>
                  <span className={`severity-text severity-${selectedIssue.severity}`}>
                    {selectedIssue.severity.toUpperCase()}
                  </span>
                </div>
                <div className="issue-info-item">
                <strong>Location:</strong> ({selectedIssue.location.center.x.toFixed(1)}, {selectedIssue.location.center.y.toFixed(1)}, {selectedIssue.location.center.z.toFixed(1)})
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AccessibilityCheckerUI;
