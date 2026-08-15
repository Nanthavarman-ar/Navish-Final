import React, { useState, useRef, useCallback } from 'react';
import { Engine, Scene, Tools } from '@babylonjs/core';
// Tools.CreateScreenshotUsingRenderTargetAsync is a stub that always throws
// until this side-effect module patches the real implementation onto it -
// without this import, every capture below failed immediately and silently
// (caught by the try/catch, so it just looked like the button did nothing).
import '@babylonjs/core/Misc/screenshotTools';
import { X, Activity, Camera as CameraIcon, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';

interface BeforeAfterPanelProps {
  scene: Scene;
  engine: Engine;
  onClose: () => void;
}

const BeforeAfterPanel: React.FC<BeforeAfterPanelProps> = ({ scene, engine, onClose }) => {
  const [beforeImage, setBeforeImage] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<'before' | 'after' | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const capture = useCallback(async (which: 'before' | 'after') => {
    const camera = scene.activeCamera;
    if (!camera) {
      showToast.error('No active camera to capture from');
      return;
    }
    setIsCapturing(which);
    try {
      const dataUrl = await Tools.CreateScreenshotUsingRenderTargetAsync(
        engine, camera, { width: 640, height: 480 }
      );
      if (which === 'before') setBeforeImage(dataUrl);
      else setAfterImage(dataUrl);
      showToast.success(`${which === 'before' ? 'Before' : 'After'} snapshot captured`);
    } catch (error) {
      console.error(`Failed to capture ${which} screenshot:`, error);
      showToast.error('Failed to capture screenshot');
    } finally {
      setIsCapturing(null);
    }
  }, [scene, engine]);

  const handlePointerMove = useCallback((clientX: number) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, pct)));
  }, []);

  const reset = () => {
    setBeforeImage(null);
    setAfterImage(null);
    setSliderPos(50);
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 w-96 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold">Before / After</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={isCapturing !== null} onClick={() => capture('before')}>
            <CameraIcon className="w-3.5 h-3.5 mr-1" /> Capture "Before"
          </Button>
          <Button size="sm" variant="outline" className="flex-1" disabled={isCapturing !== null} onClick={() => capture('after')}>
            <CameraIcon className="w-3.5 h-3.5 mr-1" /> Capture "After"
          </Button>
        </div>

        {beforeImage && afterImage ? (
          <>
            <div
              ref={containerRef}
              className="relative w-full aspect-[4/3] rounded overflow-hidden select-none cursor-ew-resize border border-slate-700"
              onMouseDown={() => { draggingRef.current = true; }}
              onMouseUp={() => { draggingRef.current = false; }}
              onMouseLeave={() => { draggingRef.current = false; }}
              onMouseMove={(e) => handlePointerMove(e.clientX)}
              onTouchStart={() => { draggingRef.current = true; }}
              onTouchEnd={() => { draggingRef.current = false; }}
              onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
            >
              <img src={afterImage} alt="After" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img src={beforeImage} alt="Before" className="w-full h-full object-cover" draggable={false} />
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-lg"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center text-gray-900 text-xs font-bold">
                  ⇔
                </div>
              </div>
              <span className="absolute top-2 left-2 text-[10px] font-technical bg-black/60 px-1.5 py-0.5 rounded">BEFORE</span>
              <span className="absolute top-2 right-2 text-[10px] font-technical bg-black/60 px-1.5 py-0.5 rounded">AFTER</span>
            </div>
            <Button size="sm" variant="ghost" className="w-full" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Start over
            </Button>
          </>
        ) : beforeImage ? (
          <div className="space-y-2">
            <div className="relative w-full aspect-[4/3] rounded overflow-hidden border border-slate-700">
              <img src={beforeImage} alt="Before" className="w-full h-full object-cover" draggable={false} />
              <span className="absolute top-2 left-2 text-[10px] font-technical bg-black/60 px-1.5 py-0.5 rounded">BEFORE (captured)</span>
            </div>
            <p className="text-xs text-gray-500 text-center">Now make your changes, then capture "After" to compare.</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 text-center py-4">
            Capture a "Before" snapshot, make your changes, then capture "After" to compare.
          </p>
        )}
      </div>
    </div>
  );
};

export default BeforeAfterPanel;
