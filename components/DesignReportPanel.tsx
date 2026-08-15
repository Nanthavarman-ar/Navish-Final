import React, { useState } from 'react';
import { Engine, Scene, Tools } from '@babylonjs/core';
// Side-effect import: patches the real implementation onto Tools.CreateScreenshotUsingRenderTargetAsync,
// which is otherwise a stub that always throws (see BeforeAfterPanel.tsx for the same fix).
import '@babylonjs/core/Misc/screenshotTools';
import { X, FileDown, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import type { CostEstimator } from './CostEstimator';
import type { SustainabilityManager } from './SustainabilityManager';
import type { BIMManager } from './BIMManager';

interface DesignReportPanelProps {
  scene: Scene;
  engine: Engine;
  costEstimator: CostEstimator | null;
  sustainabilityManager: SustainabilityManager | null;
  bimManager: BIMManager | null;
  modelId: string;
  projectName?: string;
  onClose: () => void;
}

const DesignReportPanel: React.FC<DesignReportPanelProps> = ({
  scene, engine, costEstimator, sustainabilityManager, bimManager, modelId, projectName = 'Untitled Project', onClose
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeCost, setIncludeCost] = useState(true);
  const [includeSustainability, setIncludeSustainability] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = margin;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 30);
      doc.text('Design Summary Report', margin, y);
      y += 26;
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(projectName, margin, y);
      y += 16;
      doc.text(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), margin, y);
      y += 24;
      doc.setDrawColor(6, 182, 212); // cyan accent
      doc.setLineWidth(2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 24;

      // Screenshot
      if (includeScreenshot && scene.activeCamera) {
        try {
          const dataUrl = await Tools.CreateScreenshotUsingRenderTargetAsync(
            engine, scene.activeCamera, { width: 960, height: 540 }
          );
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = imgWidth * (540 / 960);
          doc.addImage(dataUrl, 'PNG', margin, y, imgWidth, imgHeight);
          y += imgHeight + 24;
        } catch (err) {
          console.error('Failed to capture screenshot for report:', err);
        }
      }

      // Cost breakdown
      if (includeCost && costEstimator) {
        try {
          const cost = costEstimator.calculateProjectCost(modelId);
          if (cost) {
            doc.setFontSize(16);
            doc.setTextColor(20, 20, 30);
            doc.text('Cost Estimate', margin, y);
            y += 20;
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);
            const rows: [string, string][] = [
              ['Materials', `$${cost.materials.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
              ['Labor', `$${cost.labor.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
              ['Overhead', `$${cost.overhead.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
              ['Disposal', `$${cost.disposal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
              ['Total', `$${cost.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
            ];
            rows.forEach(([label, value]) => {
              doc.text(label, margin, y);
              doc.text(value, pageWidth - margin - doc.getTextWidth(value), y);
              y += 16;
            });
            y += 16;
          }
        } catch (err) {
          console.error('Failed to include cost data in report:', err);
        }
      }

      // Sustainability
      if (includeSustainability && sustainabilityManager) {
        try {
          const report = sustainabilityManager.generateReport(modelId);
          if (report) {
            doc.setFontSize(16);
            doc.setTextColor(20, 20, 30);
            doc.text('Sustainability', margin, y);
            y += 20;
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);
            const rows: [string, string][] = [
              ['Green Score', `${report.greenScore.toFixed(0)}/100`],
              ['Compliance', report.complianceStatus ? 'Compliant' : 'Non-compliant'],
              ['Carbon Footprint', `${report.carbonFootprint.toFixed(1)} kg CO2`],
              ['Water Footprint', `${report.waterFootprint.toFixed(1)} L`],
              ['Energy Efficiency', `${report.energyEfficiency.toFixed(0)}%`],
            ];
            rows.forEach(([label, value]) => {
              doc.text(label, margin, y);
              doc.text(value, pageWidth - margin - doc.getTextWidth(value), y);
              y += 16;
            });
            y += 8;
            if (report.recommendations.length > 0) {
              doc.setFontSize(11);
              doc.setTextColor(20, 20, 30);
              doc.text('Recommendations:', margin, y);
              y += 16;
              doc.setTextColor(80, 80, 80);
              report.recommendations.slice(0, 5).forEach((rec) => {
                const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - margin * 2);
                doc.text(lines, margin, y);
                y += lines.length * 14;
              });
            }
          }
        } catch (err) {
          console.error('Failed to include sustainability data in report:', err);
        }
      }

      // Model summary
      const model = bimManager?.getModelById(modelId);
      if (model) {
        y += 12;
        doc.setFontSize(9);
        doc.setTextColor(140, 140, 140);
        doc.text(`Model: ${model.name} · ${model.elements.length} elements · Generated by Naviz`, margin, doc.internal.pageSize.getHeight() - 24);
      }

      doc.save(`${projectName.replace(/[^a-z0-9]+/gi, '-')}-design-report.pdf`);
      showToast.success('Report downloaded');
    } catch (error) {
      console.error('Failed to generate report:', error);
      showToast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FileDown className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Design Report</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400">
          Generate a shareable PDF with a snapshot, cost estimate, and sustainability summary.
        </p>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={includeScreenshot} onChange={(e) => setIncludeScreenshot(e.target.checked)} className="accent-cyan-500" />
            Current view snapshot
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={includeCost} onChange={(e) => setIncludeCost(e.target.checked)} className="accent-cyan-500" />
            Cost estimate
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={includeSustainability} onChange={(e) => setIncludeSustainability(e.target.checked)} className="accent-cyan-500" />
            Sustainability report
          </label>
        </div>

        <Button size="sm" className="w-full" disabled={isGenerating} onClick={generateReport}>
          {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1" />}
          {isGenerating ? 'Generating...' : 'Download PDF Report'}
        </Button>
      </div>
    </div>
  );
};

export default DesignReportPanel;
