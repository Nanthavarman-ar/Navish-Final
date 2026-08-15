import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

interface PrefabModule {
  id: string;
  name: string;
  type: 'wall' | 'floor' | 'ceiling' | 'roof' | 'foundation';
  dimensions: { width: number; height: number; depth: number };
  materials: string[];
  connections: string[]; // Compatible connection points
  weight: number;
  assemblyTime: number; // minutes
  cost: number;
  ecoRating: number;
}

interface AssemblyStep {
  step: number;
  description: string;
  duration: number;
  tools: string[];
  safetyNotes: string[];
}

interface PrefabModulePreviewProps {
  scene: BABYLON.Scene;
  onModuleSelect?: (module: PrefabModule) => void;
  onAssemblyComplete?: (modules: PrefabModule[]) => void;
}

const PrefabModulePreview: React.FC<PrefabModulePreviewProps> = ({
  scene,
  onModuleSelect,
  onAssemblyComplete
}) => {
  const [modules, setModules] = useState<PrefabModule[]>([]);
  const [selectedModules, setSelectedModules] = useState<PrefabModule[]>([]);
  const [assemblySteps, setAssemblySteps] = useState<AssemblyStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'single' | 'assembly' | 'sequence'>('single');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock prefab modules database
  const mockModules: PrefabModule[] = [
    {
      id: 'wall_standard',
      name: 'Standard Wall Panel',
      type: 'wall',
      dimensions: { width: 4, height: 2.4, depth: 0.15 },
      materials: ['gypsum', 'wood_frame', 'insulation'],
      connections: ['top_rail', 'bottom_rail', 'side_studs'],
      weight: 45,
      assemblyTime: 15,
      cost: 280,
      ecoRating: 3
    },
    {
      id: 'wall_glass',
      name: 'Glass Wall Panel',
      type: 'wall',
      dimensions: { width: 2.4, height: 2.4, depth: 0.08 },
      materials: ['tempered_glass', 'aluminum_frame'],
      connections: ['top_track', 'bottom_track', 'side_clips'],
      weight: 35,
      assemblyTime: 10,
      cost: 450,
      ecoRating: 4
    },
    {
      id: 'floor_wood',
      name: 'Engineered Wood Floor',
      type: 'floor',
      dimensions: { width: 1.2, height: 0.02, depth: 0.8 },
      materials: ['oak_veneer', 'plywood_core'],
      connections: ['tongue_groove', 'click_system'],
      weight: 18,
      assemblyTime: 5,
      cost: 8,
      ecoRating: 4
    },
    {
      id: 'ceiling_acoustic',
      name: 'Acoustic Ceiling Panel',
      type: 'ceiling',
      dimensions: { width: 0.6, height: 0.025, depth: 0.6 },
      materials: ['mineral_fiber', 'aluminum_grid'],
      connections: ['grid_clips', 'suspension_wires'],
      weight: 2.5,
      assemblyTime: 3,
      cost: 12,
      ecoRating: 3
    },
    {
      id: 'roof_truss',
      name: 'Roof Truss System',
      type: 'roof',
      dimensions: { width: 8, height: 0.3, depth: 0.15 },
      materials: ['spruce_lumber', 'steel_connectors'],
      connections: ['ridge_connection', 'wall_plates', 'bracing_points'],
      weight: 85,
      assemblyTime: 25,
      cost: 320,
      ecoRating: 3
    },
    {
      id: 'foundation_block',
      name: 'Concrete Foundation Block',
      type: 'foundation',
      dimensions: { width: 0.4, height: 0.2, depth: 0.2 },
      materials: ['concrete', 'reinforcement'],
      connections: ['mortar_joints', 'rebar_ties'],
      weight: 25,
      assemblyTime: 8,
      cost: 15,
      ecoRating: 2
    }
  ];

  const mockAssemblySteps: AssemblyStep[] = [
    {
      step: 1,
      description: 'Prepare foundation and layout wall positions',
      duration: 30,
      tools: ['measuring_tape', 'chalk_line', 'level'],
      safetyNotes: ['Wear safety glasses', 'Check for underground utilities']
    },
    {
      step: 2,
      description: 'Install bottom wall plates and anchor bolts',
      duration: 45,
      tools: ['drill', 'hammer', 'wrench'],
      safetyNotes: ['Use proper lifting techniques', 'Secure work area']
    },
    {
      step: 3,
      description: 'Assemble and erect wall panels',
      duration: 60,
      tools: ['circular_saw', 'nail_gun', 'ladder'],
      safetyNotes: ['Work with a partner for large panels', 'Secure panels before releasing']
    },
    {
      step: 4,
      description: 'Install top plates and temporary bracing',
      duration: 30,
      tools: ['nail_gun', 'bracing_material'],
      safetyNotes: ['Ensure proper alignment', 'Check plumb frequently']
    },
    {
      step: 5,
      description: 'Install roof trusses and secure connections',
      duration: 90,
      tools: ['ladder', 'drill', 'ratchet_set'],
      safetyNotes: ['Work from stable platforms', 'Secure trusses before climbing']
    }
  ];

  useEffect(() => {
    setModules(mockModules);
    setAssemblySteps(mockAssemblySteps);
  }, []);

  const handleModuleSelect = (module: PrefabModule) => {
    if (onModuleSelect) {
      onModuleSelect(module);
    }

    if (previewMode === 'single') {
      // Create 3D preview of single module
      createModulePreview(module);
    } else if (previewMode === 'assembly') {
      setSelectedModules(prev => [...prev, module]);
    }
  };

  const createModulePreview = (module: PrefabModule) => {
    // Clear existing previews
    scene.meshes.forEach(mesh => {
      if (mesh.name.startsWith('preview_')) {
        mesh.dispose();
      }
    });

    // Create 3D representation based on module type
    let mesh: BABYLON.Mesh;

    switch (module.type) {
      case 'wall':
        mesh = BABYLON.MeshBuilder.CreateBox(`preview_${module.id}`, {
          width: module.dimensions.width,
          height: module.dimensions.height,
          depth: module.dimensions.depth
        }, scene);
        break;
      case 'floor':
        mesh = BABYLON.MeshBuilder.CreateBox(`preview_${module.id}`, {
          width: module.dimensions.width,
          height: module.dimensions.height,
          depth: module.dimensions.depth
        }, scene);
        mesh.rotation.x = Math.PI / 2;
        break;
      case 'ceiling':
        mesh = BABYLON.MeshBuilder.CreateBox(`preview_${module.id}`, {
          width: module.dimensions.width,
          height: module.dimensions.height,
          depth: module.dimensions.depth
        }, scene);
        mesh.position.y = 3;
        break;
      default:
        mesh = BABYLON.MeshBuilder.CreateBox(`preview_${module.id}`, {
          width: module.dimensions.width,
          height: module.dimensions.height,
          depth: module.dimensions.depth
        }, scene);
    }

    // Apply material based on module
    const material = new BABYLON.PBRMaterial(`material_${module.id}`, scene);
    material.albedoColor = getMaterialColor(module.materials[0]);
    mesh.material = material;

    // Position in scene
    mesh.position = new BABYLON.Vector3(0, module.dimensions.height / 2, 0);
  };

  const getMaterialColor = (material: string): BABYLON.Color3 => {
    const colors: Record<string, BABYLON.Color3> = {
      gypsum: new BABYLON.Color3(0.9, 0.9, 0.8),
      wood_frame: new BABYLON.Color3(0.6, 0.4, 0.2),
      insulation: new BABYLON.Color3(0.8, 0.8, 0.8),
      tempered_glass: new BABYLON.Color3(0.7, 0.9, 1.0),
      aluminum_frame: new BABYLON.Color3(0.8, 0.8, 0.9),
      oak_veneer: new BABYLON.Color3(0.5, 0.3, 0.1),
      plywood_core: new BABYLON.Color3(0.7, 0.6, 0.4),
      mineral_fiber: new BABYLON.Color3(0.8, 0.8, 0.7),
      aluminum_grid: new BABYLON.Color3(0.9, 0.9, 0.9),
      spruce_lumber: new BABYLON.Color3(0.8, 0.7, 0.5),
      steel_connectors: new BABYLON.Color3(0.6, 0.6, 0.7),
      concrete: new BABYLON.Color3(0.7, 0.7, 0.7),
      reinforcement: new BABYLON.Color3(0.5, 0.5, 0.5)
    };
    return colors[material] || new BABYLON.Color3(0.8, 0.8, 0.8);
  };

  const startAssemblySequence = () => {
    setIsAssembling(true);
    setCurrentStep(0);
  };

  const nextAssemblyStep = () => {
    if (currentStep < assemblySteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsAssembling(false);
      if (onAssemblyComplete) {
        onAssemblyComplete(selectedModules);
      }
    }
  };

  const getFilteredModules = () => {
    if (selectedCategory === 'all') return modules;
    return modules.filter(module => module.type === selectedCategory);
  };

  const getTotalAssemblyTime = () => {
    return selectedModules.reduce((total, module) => total + module.assemblyTime, 0);
  };

  const getTotalCost = () => {
    return selectedModules.reduce((total, module) => total + module.cost, 0);
  };

  const getEcoScore = () => {
    if (selectedModules.length === 0) return 0;
    const avgEco = selectedModules.reduce((sum, module) => sum + module.ecoRating, 0) / selectedModules.length;
    return Math.round(avgEco * 10) / 10;
  };

  return (
    <div className="absolute top-15 left-2.5 w-80 bg-black bg-opacity-90 rounded-lg p-4 text-white text-xs z-[1000] max-h-[80vh] overflow-y-auto">
      <h3 className="m-0 mb-4 text-orange-500">🏗️ Prefab Module Preview</h3>

      {/* Preview Mode Selector */}
      <div className="mb-4">
        <div className="flex gap-1 mb-2">
          {['single', 'assembly', 'sequence'].map(mode => (
            <button
              key={mode}
              onClick={() => setPreviewMode(mode as any)}
              className={`flex-1 px-1.5 py-1.5 text-white border-0 rounded cursor-pointer text-xs ${
                previewMode === mode ? 'bg-orange-500' : 'bg-gray-700'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-4">
        <label htmlFor="category-filter" className="sr-only">Category Filter</label>
        <select
          id="category-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-1 bg-gray-700 text-white border border-gray-600 rounded"
        >
          <option value="all">All Categories</option>
          <option value="wall">Walls</option>
          <option value="floor">Floors</option>
          <option value="ceiling">Ceilings</option>
          <option value="roof">Roof</option>
          <option value="foundation">Foundation</option>
        </select>
      </div>

      {/* Module List */}
      <div className="mb-4">
        <h4 className="m-0 mb-2 text-orange-500">Available Modules</h4>
        <div className="max-h-72 overflow-y-auto">
          {getFilteredModules().map(module => (
            <div
              key={module.id}
              onClick={() => handleModuleSelect(module)}
              className={`p-2 mb-2 rounded-md cursor-pointer border border-gray-600 transition-all duration-200 ${
                selectedModules.includes(module) ? 'bg-orange-500' : 'bg-gray-700'
              }`}
            >
              <div className="font-bold mb-1">{module.name}</div>
              <div className="text-xs text-gray-300 mb-1">
                {module.dimensions.width}m × {module.dimensions.height}m × {module.dimensions.depth}m
              </div>
              <div className="flex justify-between items-center">
                <div className="text-xs text-green-500">
                  ${module.cost} • {module.assemblyTime}min
                </div>
                <div className={`text-xs ${
                  module.ecoRating >= 4 ? 'text-green-500' : 
                  module.ecoRating >= 3 ? 'text-orange-500' : 'text-red-500'
                }`}>
                  🌱 {module.ecoRating}/5
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assembly Summary */}
      {selectedModules.length > 0 && (
        <div className="mb-4 p-2 bg-gray-700 rounded-md">
          <h4 className="m-0 mb-2 text-orange-500">Assembly Summary</h4>
          <div className="text-xs mb-1">
            Modules: {selectedModules.length}
          </div>
          <div className="text-xs mb-1">
            Total Time: {getTotalAssemblyTime()} minutes
          </div>
          <div className="text-xs mb-1">
            Total Cost: ${getTotalCost()}
          </div>
          <div className="text-xs mb-2">
            Eco Score: {getEcoScore()}/5
          </div>

          {!isAssembling && (
            <button
              onClick={startAssemblySequence}
              className="w-full p-2 bg-green-500 text-white border-0 rounded cursor-pointer"
            >
              Start Assembly Sequence
            </button>
          )}
        </div>
      )}

      {/* Assembly Steps */}
      {isAssembling && (
        <div className="p-2 bg-gray-700 rounded-md">
          <h4 className="m-0 mb-2 text-orange-500">
            Step {currentStep + 1} of {assemblySteps.length}
          </h4>

          {assemblySteps[currentStep] && (
            <div>
              <div className="mb-2 text-xs">
                {assemblySteps[currentStep].description}
              </div>
              <div className="mb-2 text-xs text-gray-300">
                Duration: {assemblySteps[currentStep].duration} minutes
              </div>

              <div className="mb-2">
                <div className="text-xs font-bold mb-1">Tools Needed:</div>
                <div className="text-xs text-gray-300">
                  {assemblySteps[currentStep].tools.join(', ')}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs font-bold mb-1 text-red-500">
                  Safety Notes:
                </div>
                <ul className="text-xs text-gray-300 m-0 pl-4">
                  {assemblySteps[currentStep].safetyNotes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={nextAssemblyStep}
                className="w-full p-2 bg-orange-500 text-white border-0 rounded cursor-pointer"
              >
                {currentStep === assemblySteps.length - 1 ? 'Complete Assembly' : 'Next Step'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrefabModulePreview;
