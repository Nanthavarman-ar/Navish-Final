import React from 'react';
import { Button } from './ui/button';
import { Footprints, MousePointer, LayoutGrid, MapPin, Headset } from 'lucide-react';

export type ViewMode = 'walk' | 'orbit' | 'dollhouse' | 'vr' | 'ar';

interface ViewModeSelectorProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  compact?: boolean;
  deviceSupport?: Partial<Record<ViewMode, ('browser' | 'tablet' | 'mobile' | 'headset')[]>>;
}

const MODES: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'walk', label: 'Walkable', icon: Footprints },
  { id: 'orbit', label: 'Clickable', icon: MousePointer },
  { id: 'dollhouse', label: 'Dollhouse', icon: LayoutGrid },
  { id: 'vr', label: 'VR', icon: Headset },
  { id: 'ar', label: 'On Site', icon: MapPin },
];

export function ViewModeSelector({ mode, onModeChange, compact }: ViewModeSelectorProps) {
  return (
    <div className={`flex items-center gap-1 shrink-0 ${compact ? '' : 'p-2 bg-slate-900/90 rounded-lg border border-slate-700'}`}>
      {MODES.map(({ id, label, icon: Icon }) => {
        const isActive = mode === id;
        return (
          <Button
            key={id}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            className={`h-8 w-8 p-0 shrink-0 ${isActive ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-slate-400 hover:text-white'}`}
            onClick={() => onModeChange(id)}
            title={label}
            type="button"
          >
            <Icon className="w-4 h-4" />
          </Button>
        );
      })}
    </div>
  );
}
