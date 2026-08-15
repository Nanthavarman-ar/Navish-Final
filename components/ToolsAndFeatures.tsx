import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useApp } from '../contexts/AppContext';
import {
  Activity,
  Calculator,
  Brain,
  MapPin,
  Construction,
  Smartphone,
  Settings,
  Droplet,
  Car,
  Wind,
  Volume2,
  Ruler,
  Zap,
  Sun,
  Eye,
  Sofa,
  Mic,
  Mountain,
  Network,
  Users,
  MessageSquare,
  Search,
  Palette,
  Layers,
  Download
} from 'lucide-react';

interface ToolCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tools: Tool[];
}

interface Tool {
  id: string;
  name: string;
  description: string;
  page: string;
  available: boolean;
}

const ToolsAndFeatures: React.FC = () => {
  const { setCurrentPage } = useApp();

  const categories: ToolCategory[] = [
    {
      id: 'simulations',
      title: 'Simulations',
      description: 'Run various environmental and traffic simulations',
      icon: <Activity className="w-6 h-6" />,
      tools: [
        { id: 'flood', name: 'Flood Simulation', description: 'Analyze flood impact and water flow', page: 'flood-simulation', available: true },
        { id: 'traffic', name: 'Traffic & Parking', description: 'Simulate traffic flow and parking efficiency', page: 'traffic-parking-simulation', available: true },
        { id: 'wind', name: 'Wind Tunnel', description: 'Test wind effects on structures', page: 'wind-tunnel-simulation', available: true },
        { id: 'noise', name: 'Noise Simulation', description: 'Analyze sound propagation and privacy', page: 'noise-simulation', available: true },
        { id: 'circulation', name: 'Circulation Flow', description: 'Model people movement patterns', page: 'circulation-flow-simulation', available: true }
      ]
    },
    {
      id: 'analysis',
      title: 'Analysis Tools',
      description: 'Professional analysis and measurement tools',
      icon: <Calculator className="w-6 h-6" />,
      tools: [
        { id: 'cost', name: 'Cost Estimator', description: 'Calculate material and labor costs', page: 'cost-estimator', available: true },
        { id: 'measure', name: 'Measure Tool', description: 'Precise measurement and dimensioning', page: 'measure-tool', available: true },
        { id: 'energy', name: 'Energy Analysis', description: 'Analyze energy efficiency and consumption', page: 'energy-analysis', available: true },
        { id: 'sunlight', name: 'Sunlight Analysis', description: 'Study natural lighting and shadows', page: 'sunlight-analysis', available: true },
        { id: 'shadow', name: 'Shadow Impact', description: 'Analyze shadow casting and light blocking', page: 'shadow-impact-analysis', available: true },
        { id: 'ergonomic', name: 'Ergonomic Testing', description: 'Test workspace ergonomics and comfort', page: 'ergonomic-testing', available: true }
      ]
    },
    {
      id: 'ai',
      title: 'AI Features',
      description: 'Artificial intelligence powered tools',
      icon: <Brain className="w-6 h-6" />,
      tools: [
        { id: 'structural', name: 'AI Structural Advisor', description: 'Get AI recommendations for structural design', page: 'ai-structural-advisor', available: true },
        { id: 'codesigner', name: 'AI Co-Designer', description: 'Collaborate with AI for design decisions', page: 'ai-co-designer', available: true },
        { id: 'voice', name: 'AI Voice Assistant', description: 'Voice-controlled design assistance', page: 'ai-voice-assistant', available: true },
        { id: 'autofurnish', name: 'Auto-Furnish', description: 'AI-powered furniture placement', page: 'auto-furnish', available: true }
      ]
    },
    {
      id: 'environment',
      title: 'Environment',
      description: 'Environmental context and terrain tools',
      icon: <MapPin className="w-6 h-6" />,
      tools: [
        { id: 'weather', name: 'Weather System', description: 'Simulate weather conditions and effects', page: 'weather-system', available: true },
        { id: 'site-context', name: 'Site Context', description: 'Generate and analyze site surroundings', page: 'site-context-generator', available: true },
        { id: 'topography', name: 'Topography', description: 'Create and modify terrain features', page: 'topography-generator', available: true },
        { id: 'geolocation', name: 'Geo Location', description: 'GPS-based location and mapping', page: 'geo-location-context', available: true }
      ]
    },
    {
      id: 'construction',
      title: 'Construction',
      description: 'Construction planning and BIM tools',
      icon: <Construction className="w-6 h-6" />,
      tools: [
        { id: 'overlay', name: 'Construction Overlay', description: 'Visualize construction phases', page: 'construction-overlay', available: true },
        { id: 'bim', name: 'BIM Integration', description: 'Building Information Modeling', page: 'bim-integration', available: true },
        { id: 'materials', name: 'Material Manager', description: 'Manage construction materials', page: 'material-manager', available: true }
      ]
    },
    {
      id: 'interaction',
      title: 'Interaction',
      description: 'Advanced interaction and collaboration tools',
      icon: <Smartphone className="w-6 h-6" />,
      tools: [
        { id: 'vrar', name: 'VR/AR Mode', description: 'Virtual and Augmented Reality experience', page: 'vr-ar-mode', available: true },
        { id: 'hand-tracking', name: 'Hand Tracking', description: 'Gesture-based interaction', page: 'hand-tracking', available: true },
        { id: 'multi-user', name: 'Multi-User', description: 'Collaborative design sessions', page: 'multi-user', available: true },
        { id: 'voice-chat', name: 'Voice Chat', description: 'Real-time voice communication', page: 'voice-chat', available: true },
        { id: 'presenter', name: 'Presenter Mode', description: 'Professional presentation tools', page: 'presenter-mode', available: true },
        { id: 'annotations', name: 'Annotations', description: 'Add notes and markup to designs', page: 'annotations', available: true }
      ]
    },
    {
      id: 'utilities',
      title: 'Utilities',
      description: 'Essential design and inspection tools',
      icon: <Settings className="w-6 h-6" />,
      tools: [
        { id: 'inspector', name: 'Property Inspector', description: 'Detailed object property analysis', page: 'property-inspector', available: true },
        { id: 'browser', name: 'Scene Browser', description: 'Navigate and manage scene objects', page: 'scene-browser', available: true },
        { id: 'minimap', name: 'Minimap', description: 'Overview navigation aid', page: 'minimap', available: true },
        { id: 'material-editor', name: 'Material Editor', description: 'Edit material properties', page: 'material-editor', available: true },
        { id: 'lighting', name: 'Lighting Controls', description: 'Manage lighting presets', page: 'lighting-presets', available: true },
        { id: 'export', name: 'Export Tool', description: 'Export designs and reports', page: 'export-tool', available: true }
      ]
    }
  ];

  const handleToolClick = (page: string) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Tools & Features</h1>
              <p className="text-gray-400 mt-1">Explore all available design and analysis tools</p>
            </div>
            <Button
              onClick={() => setCurrentPage('home')}
              variant="outline"
              className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black"
            >
              ← Back to Home
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-cyan-400">{category.icon}</div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{category.title}</h2>
                  <p className="text-gray-400">{category.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.tools.map((tool) => (
                  <Card
                    key={tool.id}
                    className={`bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-all duration-300 ${
                      !tool.available ? 'opacity-50' : 'cursor-pointer hover:scale-105'
                    }`}
                    onClick={() => tool.available && handleToolClick(tool.page)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-lg">{tool.name}</CardTitle>
                      <CardDescription className="text-gray-400">
                        {tool.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className={`w-full ${
                          tool.available
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400'
                            : 'bg-gray-600 cursor-not-allowed'
                        }`}
                        disabled={!tool.available}
                        onClick={(e) => {
                          e.stopPropagation();
                          tool.available && handleToolClick(tool.page);
                        }}
                      >
                        {tool.available ? 'Open Tool' : 'Coming Soon'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ToolsAndFeatures;
