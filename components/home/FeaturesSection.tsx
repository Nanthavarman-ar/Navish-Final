import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileType, Layers, Sparkles, Share2, Shield, Mic } from 'lucide-react';
import { Button } from '../ui/button';

export function FeaturesSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 relative bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            From floor plans to complex CGI models
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            We&apos;ve got you covered with real-time rendering in the browser
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            { icon: FileType, title: "Floor plans", desc: "True-to-scale 2D experiences" },
            { icon: Layers, title: "Architectural models", desc: "Textures, lighting and reflections" },
            { icon: Sparkles, title: "CGI / ArchViz models", desc: "Lifelike property presentations" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-colors">
              <Icon className="w-10 h-10 text-cyan-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
              <p className="text-gray-400">{desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-8">How it works</h3>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { step: 1, title: "Import 3D model", desc: "glTF, OBJ, FBX, SketchUp, Revit" },
              { step: 2, title: "Edit & optimize", desc: "Lighting, materials, points of interest" },
              { step: 3, title: "Share & embed", desc: "Link or embed on any website" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center mx-auto mb-4">
                  {step}
                </div>
                <h4 className="text-white font-semibold mb-2">{title}</h4>
                <p className="text-slate-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>
          <Button
            size="lg"
            onClick={() => navigate('/workspace')}
            className="bg-cyan-600 hover:bg-cyan-500"
          >
            Try NAVIZ
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20 pt-20 border-t border-slate-700">
          {[
            { icon: Share2, title: "Share & Embed", desc: "Public and guided viewing sessions" },
            { icon: Shield, title: "Access Control", desc: "Admin and user roles with audit" },
            { icon: Mic, title: "AI Assistant", desc: "Voice control in multiple languages" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
              <Icon className="w-8 h-8 text-cyan-400 mb-3" />
              <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
              <p className="text-slate-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
