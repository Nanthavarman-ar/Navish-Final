import React, { useEffect, useRef, useState } from 'react';
import './present.css';

/**
 * Invisible 44px hot-spot in the bottom-left corner. Holding it for 3 seconds toggles
 * present <-> workspace mode. Works with mouse, touch and pen. Moving away cancels it.
 */
export function CornerLongPress({ onTrigger, holdMs = 3000 }: { onTrigger: () => void; holdMs?: number }) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  useEffect(() => cancel, []);

  return (
    <div
      className="pr-corner"
      aria-hidden
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          start.current = null;
          try { navigator.vibrate?.(35); } catch { /* not supported */ }
          onTrigger();
        }, holdMs);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 14) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

/**
 * Optional PIN gate in front of workspace mode. NOTE: the PIN lives in the public
 * config.json, so this keeps casual visitors out; it is not real security. Real protection
 * is the server: every upload/edit/delete route stays admin-only.
 */
export function PinDialog({ pin, onSuccess, onCancel }: { pin: string; onSuccess: () => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  return (
    <div className="pr-pin-dialog pr-root" style={{ pointerEvents: 'auto' }} role="dialog" aria-modal="true" aria-label="Enter PIN">
      <form
        className="pr-glass"
        onSubmit={(e) => {
          e.preventDefault();
          if (value === pin) onSuccess();
          else { setError(true); setValue(''); }
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500 }}>Workspace PIN</div>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          aria-invalid={error}
        />
        {error && <div style={{ fontSize: 12, color: '#ff9d9e' }}>Wrong PIN</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="pr-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>Cancel</button>
          <button type="submit" className="pr-btn is-on" style={{ flex: 1, justifyContent: 'center' }}>Open</button>
        </div>
      </form>
    </div>
  );
}
