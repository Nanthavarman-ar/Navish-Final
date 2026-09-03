import React, { Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Footprints,
  MousePointer,
  LayoutGrid,
  Headset,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';
import { LegoButton } from './LegoButton';
import { LegoBuildAnimation } from './LegoBuildAnimation';
import type { DemoMode } from './InteractiveHouseDemo';
// Real interactive 3D demo (Babylon.js), lazy-loaded so the ~1MB+ engine isn't in the initial
// page bundle - the SVG LegoBuildAnimation above renders instantly as the Suspense fallback
// and is what most users briefly see before this chunk finishes streaming in.
const InteractiveHouseDemo = React.lazy(() => import('./InteractiveHouseDemo').then((m) => ({ default: m.InteractiveHouseDemo })));

const EXPLORE_MODES: { id: DemoMode; icon: React.ElementType; label: string; desc: string; hint: string }[] = [
  { id: 'walk', icon: Footprints, label: 'Walkable', desc: 'Walk through your space as if it was already built', hint: 'WASD to walk, drag to look around' },
  { id: 'orbit', icon: MousePointer, label: 'Clickable', desc: 'Intuitively navigate with ease and freedom', hint: 'Drag to orbit around the model' },
  { id: 'dollhouse', icon: LayoutGrid, label: 'Dollhouse', desc: 'Explore every angle at any scale', hint: 'Tilted overview - drag to spin' },
];

// Fixed (not re-randomized per render) star positions/timings so the twinkle field doesn't
// jump around on every re-render - each star gets its own size/delay/min-max opacity so the
// field doesn't pulse in visible unison.
const STAR_FIELD = Array.from({ length: 40 }, (_, i) => {
  const seed = i * 137.5; // golden-angle spacing for a natural, non-grid scatter
  return {
    left: `${(seed * 1.9) % 100}%`,
    top: `${(seed * 2.7) % 100}%`,
    size: 2 + (i % 3),
    delay: (i % 10) * 0.4,
    duration: 2.8 + (i % 5) * 0.6,
    maxOpacity: 0.5 + (i % 4) * 0.15,
  };
});

// Splits a headline into words that each drop in and "snap" into place with a spring
// bounce, staggered left to right - the LEGO-brick assembly feel applied to text
// without turning the actual letters into illustrated bricks, which would hurt
// readability of the product's main value proposition.
function LegoHeadline({ text, startDelay = 0 }: { text: string; startDelay?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block"
          initial={{ y: -36, opacity: 0, rotate: -6 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: startDelay + i * 0.07 }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </>
  );
}

export function HeroSection() {
  const navigate = useNavigate();
  const [demoMode, setDemoMode] = useState<DemoMode>('orbit');
  const activeExploreMode = EXPLORE_MODES.find((m) => m.id === demoMode) ?? EXPLORE_MODES[1];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-blue-900/20" />
      {/* Blueprint grid texture - technical drafting-paper feel, fitting a BIM/architecture tool */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #22D3EE 1px, transparent 1px), linear-gradient(to bottom, #22D3EE 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Animated color + motion layer - the grid/gradient above were static, which read as
          flat/one-color. This adds real drifting color and a twinkling star field. */}
      <div className="ambient-glow" aria-hidden><span className="ambient-glow-blob" /></div>
      <div className="starfield" aria-hidden>
        {STAR_FIELD.map((star, i) => (
          <span
            key={i}
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
              ['--star-max' as string]: star.maxOpacity,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
          <div className="text-center lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-technical text-cyan-400 text-sm font-medium uppercase tracking-widest mb-4"
            >
              Photorealistic XR on any device
            </motion.p>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
              <LegoHeadline text="Bring your designs to life" startDelay={0.1} />
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                <LegoHeadline text="in immersive XR" startDelay={0.65} />
              </span>
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto lg:mx-0"
            >
              Create VR spaces from your 3D models or floor plans. The multi-device platform for experiencing unbuilt property.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.3 }}
            >
              <LegoButton size="lg" onClick={() => navigate('/workspace')} className="mt-6">
                Create a Space
              </LegoButton>
            </motion.div>

            {/* Device support */}
            <div className="flex items-center justify-center lg:justify-start gap-6 mt-16 text-slate-400">
              <div className="flex items-center gap-2" title="Headset">
                <Headset className="w-6 h-6" />
                <span className="font-technical text-sm">Headset</span>
              </div>
              <div className="flex items-center gap-2" title="Tablet">
                <Tablet className="w-6 h-6" />
                <span className="font-technical text-sm">Tablet</span>
              </div>
              <div className="flex items-center gap-2" title="Browser">
                <Monitor className="w-6 h-6" />
                <span className="font-technical text-sm">Browser</span>
              </div>
              <div className="flex items-center gap-2" title="Mobile">
                <Smartphone className="w-6 h-6" />
                <span className="font-technical text-sm">Mobile</span>
              </div>
            </div>
          </div>

          {/* Signature visual: a real, live 3D demo house visitors can drag-orbit, tilt into
              a dollhouse overview, or walk around - lazy-loaded behind the instant SVG
              version so first paint isn't blocked on the 3D engine downloading. The Explore
              Modes cards below double as its controls (see activeExploreMode). */}
          <div className="flex flex-col items-center lg:items-end gap-3">
            <div className="relative w-full max-w-md">
              <Suspense fallback={<LegoBuildAnimation className="w-full aspect-[8/7] drop-shadow-[0_20px_40px_rgba(34,211,238,0.15)]" />}>
                <InteractiveHouseDemo mode={demoMode} className="w-full aspect-[8/7] drop-shadow-[0_20px_40px_rgba(34,211,238,0.15)]" />
              </Suspense>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeExploreMode.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="font-technical text-xs text-slate-400 uppercase tracking-wider"
              >
                {activeExploreMode.hint}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Explore modes - also the live demo's own controls (click one to switch the model
            above into that mode) so the claim is something visitors try, not just read. */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {EXPLORE_MODES.map(({ id, icon: Icon, label, desc }, i) => {
            const isActive = demoMode === id;
            return (
              <motion.button
                key={id}
                type="button"
                onClick={() => setDemoMode(id)}
                aria-pressed={isActive}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`blueprint-corners p-6 rounded-xl text-center transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 border border-cyan-500/60'
                    : 'bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50'
                }`}
              >
                <Icon className={`w-10 h-10 mx-auto mb-3 ${isActive ? 'text-cyan-300' : 'text-cyan-400'}`} />
                <h3 className="font-display text-white font-semibold mb-2">{label}</h3>
                <p className="text-slate-400 text-sm">{desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
