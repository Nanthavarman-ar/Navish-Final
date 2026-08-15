import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Vector3, Ray, MeshBuilder, StandardMaterial, Color3, Mesh, PointerEventTypes } from '@babylonjs/core';
import { X, Volume2, MapPin, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';

interface SoundPrivacyPanelProps {
  scene: Scene;
  onClose: () => void;
}

interface AnalysisResult {
  distance: number;
  wallsCrossed: number;
  estimatedAttenuationDb: number;
  privacyRating: 'poor' | 'moderate' | 'good' | 'excellent';
}

// Real geometric acoustic estimate: inverse-square law distance attenuation, plus a
// per-obstruction penalty for each wall/solid surface the sound has to pass through
// (a simplified but genuine physical model - typical interior walls attenuate roughly
// 30-45dB depending on construction, we use a conservative 25dB/wall estimate).
function estimatePrivacy(distance: number, wallsCrossed: number): AnalysisResult {
  const distanceAttenuation = distance > 1 ? 20 * Math.log10(distance) : 0; // dB, inverse-square law
  const wallAttenuation = wallsCrossed * 25; // dB per solid obstruction crossed
  const totalDb = distanceAttenuation + wallAttenuation;

  let privacyRating: AnalysisResult['privacyRating'];
  if (totalDb < 15) privacyRating = 'poor';
  else if (totalDb < 35) privacyRating = 'moderate';
  else if (totalDb < 55) privacyRating = 'good';
  else privacyRating = 'excellent';

  return { distance, wallsCrossed, estimatedAttenuationDb: totalDb, privacyRating };
}

const RATING_COLOR: Record<string, string> = {
  poor: 'text-red-400', moderate: 'text-amber-400', good: 'text-cyan-400', excellent: 'text-green-400',
};

const SoundPrivacyPanel: React.FC<SoundPrivacyPanelProps> = ({ scene, onClose }) => {
  const [pointA, setPointA] = useState<Vector3 | null>(null);
  const [pointB, setPointB] = useState<Vector3 | null>(null);
  const [isPlacing, setIsPlacing] = useState<'a' | 'b' | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const markersRef = useRef<Mesh[]>([]);

  const placeMarker = useCallback((point: Vector3, color: Color3) => {
    const marker = MeshBuilder.CreateSphere(`sound_privacy_marker_${Date.now()}`, { diameter: 0.15 }, scene);
    marker.position = point;
    const mat = new StandardMaterial(`sound_privacy_mat_${Date.now()}`, scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.5);
    marker.material = mat;
    markersRef.current.push(marker);
  }, [scene]);

  useEffect(() => {
    if (!isPlacing) return;
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const pick = scene.pick(scene.pointerX, scene.pointerY);
      if (!pick?.hit || !pick.pickedPoint) return;

      if (isPlacing === 'a') {
        setPointA(pick.pickedPoint.clone());
        placeMarker(pick.pickedPoint, new Color3(0.2, 0.8, 1));
      } else {
        setPointB(pick.pickedPoint.clone());
        placeMarker(pick.pickedPoint, new Color3(1, 0.6, 0.2));
      }
      setIsPlacing(null);
    });
    return () => { scene.onPointerObservable.remove(observer); };
  }, [isPlacing, scene, placeMarker]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.dispose());
      markersRef.current = [];
    };
  }, []);

  const runAnalysis = () => {
    if (!pointA || !pointB) return;
    const distance = Vector3.Distance(pointA, pointB);
    const direction = pointB.subtract(pointA).normalize();
    const ray = new Ray(pointA, direction, distance);
    const hits = scene.multiPickWithRay(ray, (mesh) =>
      mesh.isPickable && !mesh.name.startsWith('sound_privacy_marker')
    );
    const wallsCrossed = hits ? hits.length : 0;

    setResult(estimatePrivacy(distance, wallsCrossed));
    showToast.success('Sound privacy analyzed');
  };

  const reset = () => {
    markersRef.current.forEach((m) => m.dispose());
    markersRef.current = [];
    setPointA(null);
    setPointB(null);
    setResult(null);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 w-80 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Sound Privacy</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-400">
          Pick two points to estimate how much sound would carry between them, based on distance and any walls in between.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant={pointA ? 'outline' : 'default'} onClick={() => setIsPlacing('a')} disabled={isPlacing !== null}>
            <MapPin className="w-3.5 h-3.5 mr-1" /> {pointA ? 'Point A set' : 'Set Point A'}
          </Button>
          <Button size="sm" variant={pointB ? 'outline' : 'default'} onClick={() => setIsPlacing('b')} disabled={isPlacing !== null}>
            <MapPin className="w-3.5 h-3.5 mr-1" /> {pointB ? 'Point B set' : 'Set Point B'}
          </Button>
        </div>

        {isPlacing && (
          <p className="text-xs text-amber-300 text-center bg-amber-500/10 border border-amber-500/30 rounded py-1.5">
            Click a point in the scene...
          </p>
        )}

        <Button size="sm" className="w-full" disabled={!pointA || !pointB} onClick={runAnalysis}>
          Analyze
        </Button>

        {result && (
          <div className="pt-2 border-t border-slate-700 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Distance</span>
              <span className="font-technical text-gray-100">{result.distance.toFixed(1)}m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Walls crossed</span>
              <span className="font-technical text-gray-100">{result.wallsCrossed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Est. attenuation</span>
              <span className="font-technical text-gray-100">{result.estimatedAttenuationDb.toFixed(0)}dB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Privacy rating</span>
              <span className={`font-technical uppercase ${RATING_COLOR[result.privacyRating]}`}>{result.privacyRating}</span>
            </div>
          </div>
        )}

        {(pointA || pointB) && (
          <Button size="sm" variant="ghost" className="w-full" onClick={reset}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Reset points
          </Button>
        )}
      </div>
    </div>
  );
};

export default SoundPrivacyPanel;
