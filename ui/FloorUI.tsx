import React from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

interface PickerProps {
  open: boolean;
  levels: number[];
  /** Currently sliced level, or null for the full building. */
  level: number | null;
  homesOn: (level: number) => number;
  onSelect: (level: number) => void;
  onFull: () => void;
}

/** "Choose your floor": level number with up/down arrows plus quick chips. */
export function FloorPicker({ open, levels, level, homesOn, onSelect, onFull }: PickerProps) {
  const current = level ?? levels[0];
  const idx = Math.max(0, levels.indexOf(current));
  const go = (delta: number) => {
    const next = levels[Math.min(levels.length - 1, Math.max(0, idx + delta))];
    if (next !== undefined) onSelect(next);
  };
  return (
    <div className={`pr-floors pr-glass ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <h3>Choose your floor</h3>
      <div className="pr-floor-stepper">
        <button type="button" className="pr-btn pr-icon-btn" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Lower floor"><ChevronDown /></button>
        <div className="pr-floor-num">
          <strong>{level === null ? '–' : current}</strong>
          <span>{level === null ? 'Whole building' : `${homesOn(current)} homes`}</span>
        </div>
        <button type="button" className="pr-btn pr-icon-btn" onClick={() => go(1)} disabled={idx >= levels.length - 1 && level !== null} aria-label="Higher floor"><ChevronUp /></button>
      </div>
      <div className="pr-chips">
        {levels.map((l) => (
          <button key={l} type="button" className={`pr-btn pr-chip ${l === level ? 'is-on' : ''}`} onClick={() => onSelect(l)}>{l}</button>
        ))}
        <button type="button" className={`pr-btn pr-chip ${level === null ? 'is-on' : ''}`} onClick={onFull}>All</button>
      </div>
    </div>
  );
}

/** Shown after a slice: "Level N · X homes" with up/down and Back. */
export function FloorHUD({ level, levels, homes, onSelect, onBack }: {
  level: number | null; levels: number[]; homes: number; onSelect: (l: number) => void; onBack: () => void;
}) {
  const open = level !== null;
  const idx = level === null ? -1 : levels.indexOf(level);
  return (
    <div className={`pr-hud pr-glass ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <button type="button" className="pr-btn pr-icon-btn" onClick={onBack} aria-label="Back to full building" title="Back"><ArrowLeft /></button>
      <div className="pr-hud-title" aria-live="polite">Level {level ?? ''} · {homes} {homes === 1 ? 'home' : 'homes'}</div>
      <button type="button" className="pr-btn pr-icon-btn" onClick={() => onSelect(levels[idx - 1])} disabled={idx <= 0} aria-label="Previous floor"><ChevronDown /></button>
      <button type="button" className="pr-btn pr-icon-btn" onClick={() => onSelect(levels[idx + 1])} disabled={idx < 0 || idx >= levels.length - 1} aria-label="Next floor"><ChevronUp /></button>
    </div>
  );
}
