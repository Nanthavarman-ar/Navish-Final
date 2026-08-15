import React from 'react';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Footprints,
  MousePointer,
  LayoutGrid,
  Headset,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';

export function HeroSection() {
  const navigate = useNavigate();

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
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
        <p className="font-technical text-cyan-400 text-sm font-medium uppercase tracking-widest mb-4">
          Photorealistic XR on any device
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
          Bring your designs to life
          <br />
          <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            in immersive XR
          </span>
        </h1>
        <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
          Create VR spaces from your 3D models or floor plans. The multi-device platform for experiencing unbuilt property.
        </p>
        <Button
          size="lg"
          onClick={() => navigate('/workspace')}
          className="mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-cyan-500/25"
        >
          Create a Space
        </Button>

        {/* Device support - Enviz style */}
        <div className="flex items-center justify-center gap-6 mt-16 text-slate-400">
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

        {/* Explore modes - Enviz style */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Footprints, label: 'Walkable', desc: 'Walk through your space as if it was already built' },
            { icon: MousePointer, label: 'Clickable', desc: 'Intuitively navigate with ease and freedom' },
            { icon: LayoutGrid, label: 'Dollhouse', desc: 'Explore every angle at any scale' },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="blueprint-corners p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50 transition-colors"
            >
              <Icon className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
              <h3 className="font-display text-white font-semibold mb-2">{label}</h3>
              <p className="text-slate-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
