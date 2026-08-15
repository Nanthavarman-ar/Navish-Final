import React from 'react';
import { Button } from './ui/button';
import { Layers } from 'lucide-react';

interface FloorPlanOverlayProps {
  visible: boolean;
  onToggle: () => void;
  floorIndex?: number;
  floorCount?: number;
  onFloorChange?: (index: number) => void;
}

export function FloorPlanOverlay({
  visible,
  onToggle,
  floorIndex = 0,
  floorCount = 1,
  onFloorChange,
}: FloorPlanOverlayProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant={visible ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggle}
        className={visible ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-slate-400 hover:text-white'}
        title="Toggle floor plan overlay"
      >
        <Layers className="w-4 h-4 mr-1" />
        Floor plan
      </Button>
      {visible && floorCount > 1 && onFloorChange && (
        <div className="flex items-center gap-1">
          {Array.from({ length: floorCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => onFloorChange(i)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                floorIndex === i
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
