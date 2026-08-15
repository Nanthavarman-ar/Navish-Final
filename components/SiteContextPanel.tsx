import React, { useState } from 'react';
import { X, Globe2, Mountain, Building2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import type { SiteContextManager } from './SiteContextManager';
import type { GeoSyncManager } from './GeoSyncManager';

interface SiteContextPanelProps {
  siteContextManager: SiteContextManager | null;
  geoSyncManager: GeoSyncManager | null;
  onClose: () => void;
}

const SiteContextPanel: React.FC<SiteContextPanelProps> = ({ siteContextManager, geoSyncManager, onClose }) => {
  const [radius, setRadius] = useState(500);
  const [isGeneratingTerrain, setIsGeneratingTerrain] = useState(false);
  const [isGeneratingBuildings, setIsGeneratingBuildings] = useState(false);

  const getLocationOrPrompt = (): { latitude: number; longitude: number; timestamp: Date } | null => {
    const location = geoSyncManager?.getCurrentLocation();
    if (location) return location;
    showToast.warning('No location set yet', 'Enable Geo Sync first so we know where this site is');
    return null;
  };

  const handleGenerateTerrain = async () => {
    if (!siteContextManager) return;
    const location = getLocationOrPrompt();
    if (!location) return;

    setIsGeneratingTerrain(true);
    try {
      await siteContextManager.generateTerrain(location, radius);
      showToast.success('Surrounding terrain generated');
    } catch (error) {
      console.error('Failed to generate terrain:', error);
      showToast.error('Failed to generate terrain');
    } finally {
      setIsGeneratingTerrain(false);
    }
  };

  const handleGenerateBuildings = async () => {
    if (!siteContextManager) return;
    const location = getLocationOrPrompt();
    if (!location) return;

    setIsGeneratingBuildings(true);
    try {
      await siteContextManager.generateSurroundingBuildings(location, Math.min(radius, 500));
      showToast.success('Surrounding buildings generated');
    } catch (error) {
      console.error('Failed to generate buildings:', error);
      showToast.error('Failed to generate buildings');
    } finally {
      setIsGeneratingBuildings(false);
    }
  };

  return (
    <div className="fixed top-20 left-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Site Context</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400">
          Generate real surrounding terrain and neighboring buildings around this site's real-world location.
        </p>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Radius: <span className="font-technical text-cyan-300">{radius}m</span></label>
          <input
            type="range"
            min={100}
            max={1000}
            step={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <Button size="sm" className="w-full" disabled={isGeneratingTerrain || !siteContextManager} onClick={handleGenerateTerrain}>
          {isGeneratingTerrain ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mountain className="w-3.5 h-3.5 mr-1" />}
          Generate Terrain
        </Button>

        <Button size="sm" variant="outline" className="w-full" disabled={isGeneratingBuildings || !siteContextManager} onClick={handleGenerateBuildings}>
          {isGeneratingBuildings ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Building2 className="w-3.5 h-3.5 mr-1" />}
          Generate Surrounding Buildings
        </Button>

        {!geoSyncManager?.getCurrentLocation() && (
          <p className="text-xs text-amber-400 text-center pt-1">
            Turn on "Geo Sync" first so this site has a real-world location to build around.
          </p>
        )}
      </div>
    </div>
  );
};

export default SiteContextPanel;
