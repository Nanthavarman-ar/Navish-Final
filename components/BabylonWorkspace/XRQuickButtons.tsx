import React, { useEffect, useState } from 'react';
import { Glasses, Smartphone } from 'lucide-react';
import { usePanelStack } from '../../hooks/usePanelStack';

// Big, always-visible "View in VR" / "View in AR" buttons in the bottom-right of the
// canvas, so a client never has to hunt for the small VR/AR icons in the top bar or the
// Tools list. Same handlers as those (handleFeatureToggle('showVR'/'showAR')).
// Registered in the bottom-right panel stack first, so bottom-right panels opened later
// (chat, materials, weather...) stack above the buttons instead of covering them.
export function XRQuickButtons({
  vrActive,
  arActive,
  onToggleVR,
  onToggleAR,
}: {
  vrActive: boolean;
  arActive: boolean;
  onToggleVR: () => void;
  onToggleAR: () => void;
}) {
  const stack = usePanelStack('bottom-right');
  const [support, setSupport] = useState<{ vr: boolean | null; ar: boolean | null }>({ vr: null, ar: null });

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
    if (!xr) {
      setSupport({ vr: false, ar: false });
      return;
    }
    let alive = true;
    const check = (mode: string) => xr.isSessionSupported(mode).catch(() => false);
    Promise.all([check('immersive-vr'), check('immersive-ar')]).then(([vr, ar]) => {
      if (alive) setSupport({ vr, ar });
    });
    return () => {
      alive = false;
    };
  }, []);

  const button = (
    label: string,
    active: boolean,
    supported: boolean | null,
    Icon: React.ElementType,
    onClick: () => void,
    help: string,
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={supported === false && !active ? `${help} (needs a VR/AR headset or an AR-capable phone)` : help}
      className={`flex items-center gap-2 h-12 px-5 rounded-full text-sm font-semibold uppercase tracking-[0.08em] shadow-xl border transition-colors ${
        active
          ? 'bg-[#ff4d4f] border-[#ff4d4f] text-white hover:bg-[#e63e40]'
          : 'bg-[#1a1a1a]/90 border-white/15 text-[#ecebeb] hover:bg-[#ff4d4f] hover:border-[#ff4d4f] hover:text-white'
      } ${supported === false && !active ? 'opacity-70' : ''}`}
    >
      <Icon className="w-5 h-5" />
      {active ? `Exit ${label}` : label}
    </button>
  );

  return (
    <div
      ref={stack.ref}
      className="absolute bottom-4 right-4 z-20 flex items-center gap-2 pointer-events-auto"
    >
      {button('VR', vrActive, support.vr, Glasses, onToggleVR, 'View in VR')}
      {button('AR', arActive, support.ar, Smartphone, onToggleAR, 'View in AR - place the model in your room')}
    </div>
  );
}
