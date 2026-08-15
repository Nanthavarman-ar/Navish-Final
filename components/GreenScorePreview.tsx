import React, { useState, useEffect } from 'react';
import { BIMModel, BIMManager } from './BIMManager';
import { SustainabilityManager, SustainabilityReport } from './SustainabilityManager';

interface GreenScorePreviewProps {
  bimManager: BIMManager;
  sustainabilityManager: SustainabilityManager;
  modelId: string | null;
}

const GreenScorePreview: React.FC<GreenScorePreviewProps> = ({
  bimManager,
  sustainabilityManager,
  modelId
}) => {
  const [report, setReport] = useState<SustainabilityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCertification, setSelectedCertification] = useState<'LEED' | 'BREEAM'>('LEED');

  useEffect(() => {
    if (modelId) {
      generateReport();
    }
  }, [modelId, selectedCertification]);

  const generateReport = async () => {
    if (!modelId) return;

    setLoading(true);
    try {
      const sustainabilityReport = sustainabilityManager.generateReport(modelId);
      setReport(sustainabilityReport);
    } catch (error) {
      console.error('Failed to generate sustainability report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    if (score >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getCertificationLevel = (score: number, type: 'LEED' | 'BREEAM') => {
    if (type === 'LEED') {
      if (score >= 80) return 'Platinum';
      if (score >= 60) return 'Gold';
      if (score >= 50) return 'Silver';
      if (score >= 40) return 'Certified';
      return 'Not Certified';
    } else {
      if (score >= 85) return 'Outstanding';
      if (score >= 70) return 'Excellent';
      if (score >= 55) return 'Very Good';
      if (score >= 45) return 'Good';
      if (score >= 30) return 'Pass';
      return 'Unclassified';
    }
  };

  if (!modelId) {
    return (
      <div style={{
        padding: '16px',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        color: '#f1f5f9'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Green Score Preview</h3>
        <p style={{ color: '#94a3b8' }}>Load a BIM model to see sustainability analysis</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      color: '#f1f5f9'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Green Score Preview</h3>

      {/* Certification Type Selector */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
          Certification Type:
        </label>
        <select
          value={selectedCertification}
          onChange={(e) => setSelectedCertification(e.target.value as 'LEED' | 'BREEAM')}
          title="Select certification type"
          style={{
            width: '100%',
            padding: '8px',
            background: '#334155',
            border: '1px solid #475569',
            borderRadius: '4px',
            color: '#f1f5f9',
            fontSize: '14px'
          }}
        >
          <option value="LEED">LEED</option>
          <option value="BREEAM">BREEAM</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div>Analyzing sustainability...</div>
        </div>
      ) : report ? (
        <>
          {/* Overall Score */}
          <div style={{
            textAlign: 'center',
            marginBottom: '20px',
            padding: '20px',
            background: '#334155',
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: getScoreColor(report.greenScore * 100),
              marginBottom: '8px'
            }}>
              {(report.greenScore * 100).toFixed(1)}
            </div>
            <div style={{ fontSize: '18px', color: '#94a3b8' }}>
              {getCertificationLevel(report.greenScore * 100, selectedCertification)}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              {selectedCertification} Score
            </div>
          </div>

          {/* Score Breakdown */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Score Breakdown</h4>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px' }}>Energy Efficiency</span>
                <span style={{ fontSize: '12px', color: getScoreColor(report.energyEfficiency * 100) }}>
                  {(report.energyEfficiency * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#334155',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${report.energyEfficiency * 100}%`,
                  height: '100%',
                  background: getScoreColor(report.energyEfficiency * 100),
                  borderRadius: '3px'
                }} />
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px' }}>Water Efficiency</span>
                <span style={{ fontSize: '12px', color: getScoreColor(report.waterEfficiency * 100) }}>
                  {(report.waterEfficiency * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#334155',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${report.waterEfficiency * 100}%`,
                  height: '100%',
                  background: getScoreColor(report.waterEfficiency * 100),
                  borderRadius: '3px'
                }} />
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px' }}>Renewable Energy</span>
                <span style={{ fontSize: '12px', color: getScoreColor(report.renewableEnergyUsage * 100) }}>
                  {(report.renewableEnergyUsage * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#334155',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${report.renewableEnergyUsage * 100}%`,
                  height: '100%',
                  background: getScoreColor(report.renewableEnergyUsage * 100),
                  borderRadius: '3px'
                }} />
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Key Metrics</h4>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              <div>Carbon Footprint: {report.carbonFootprint.toFixed(1)} kg CO₂/year</div>
              <div>Energy Usage: {report.energyUsage.toFixed(1)} kWh/year</div>
              <div>Water Footprint: {report.waterFootprint.toFixed(1)} m³/year</div>
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Top Recommendations</h4>
            <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
              {report.recommendations.slice(0, 5).map((rec, index) => (
                <div key={index} style={{
                  padding: '8px',
                  marginBottom: '4px',
                  background: '#334155',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#cbd5e1'
                }}>
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
          No sustainability data available
        </div>
      )}
    </div>
  );
};

export default GreenScorePreview;
