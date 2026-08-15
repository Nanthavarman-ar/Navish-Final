import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import '@babylonjs/materials';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface MaterialPreset {
  id: string;
  name: string;
  category: string;
  properties: {
    diffuseColor?: BABYLON.Color3;
    specularColor?: BABYLON.Color3;
    emissiveColor?: BABYLON.Color3;
    alpha?: number;
    specularPower?: number;
    metallic?: number;
    roughness?: number;
  };
  preview: string; // Base64 image or color
}

interface MaterialPresetSelectorProps {
  material: BABYLON.Material | null;
  onPresetApply: (preset: MaterialPreset) => void;
}

export const MaterialPresetSelector: React.FC<MaterialPresetSelectorProps> = ({
  material,
  onPresetApply
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCreatePreset, setShowCreatePreset] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [customPresets, setCustomPresets] = useState<MaterialPreset[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const materialPresets: MaterialPreset[] = [
    // Metals
    {
      id: 'gold',
      name: 'Gold',
      category: 'metal',
      properties: {
        diffuseColor: new BABYLON.Color3(1, 0.8, 0),
        specularColor: new BABYLON.Color3(1, 1, 0.8),
        emissiveColor: new BABYLON.Color3(0.1, 0.05, 0),
        alpha: 1.0,
        specularPower: 64,
        metallic: 1.0,
        roughness: 0.1
      },
      preview: '#FFD700'
    },
    {
      id: 'silver',
      name: 'Silver',
      category: 'metal',
      properties: {
        diffuseColor: new BABYLON.Color3(0.8, 0.8, 0.9),
        specularColor: new BABYLON.Color3(1, 1, 1),
        emissiveColor: new BABYLON.Color3(0.05, 0.05, 0.05),
        alpha: 1.0,
        specularPower: 128,
        metallic: 1.0,
        roughness: 0.05
      },
      preview: '#C0C0C0'
    },
    {
      id: 'copper',
      name: 'Copper',
      category: 'metal',
      properties: {
        diffuseColor: new BABYLON.Color3(0.8, 0.5, 0.2),
        specularColor: new BABYLON.Color3(1, 0.7, 0.4),
        emissiveColor: new BABYLON.Color3(0.1, 0.02, 0),
        alpha: 1.0,
        specularPower: 32,
        metallic: 1.0,
        roughness: 0.2
      },
      preview: '#B87333'
    },

    // Plastics
    {
      id: 'red_plastic',
      name: 'Red Plastic',
      category: 'plastic',
      properties: {
        diffuseColor: new BABYLON.Color3(0.8, 0.1, 0.1),
        specularColor: new BABYLON.Color3(0.3, 0.3, 0.3),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 1.0,
        specularPower: 32,
        metallic: 0.0,
        roughness: 0.3
      },
      preview: '#CC0000'
    },
    {
      id: 'blue_plastic',
      name: 'Blue Plastic',
      category: 'plastic',
      properties: {
        diffuseColor: new BABYLON.Color3(0.1, 0.3, 0.8),
        specularColor: new BABYLON.Color3(0.4, 0.4, 0.4),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 1.0,
        specularPower: 32,
        metallic: 0.0,
        roughness: 0.3
      },
      preview: '#0066CC'
    },

    // Woods
    {
      id: 'oak',
      name: 'Oak Wood',
      category: 'wood',
      properties: {
        diffuseColor: new BABYLON.Color3(0.6, 0.4, 0.2),
        specularColor: new BABYLON.Color3(0.2, 0.2, 0.2),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 1.0,
        specularPower: 16,
        metallic: 0.0,
        roughness: 0.8
      },
      preview: '#8B4513'
    },
    {
      id: 'pine',
      name: 'Pine Wood',
      category: 'wood',
      properties: {
        diffuseColor: new BABYLON.Color3(0.7, 0.6, 0.4),
        specularColor: new BABYLON.Color3(0.3, 0.3, 0.3),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 1.0,
        specularPower: 16,
        metallic: 0.0,
        roughness: 0.7
      },
      preview: '#DEB887'
    },

    // Fabrics
    {
      id: 'cotton_white',
      name: 'White Cotton',
      category: 'fabric',
      properties: {
        diffuseColor: new BABYLON.Color3(0.95, 0.95, 0.95),
        specularColor: new BABYLON.Color3(0.1, 0.1, 0.1),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 1.0,
        specularPower: 8,
        metallic: 0.0,
        roughness: 0.9
      },
      preview: '#F5F5F5'
    },
    {
      id: 'wool_gray',
      name: 'Gray Wool',
      category: 'fabric',
      properties: {
        diffuseColor: new BABYLON.Color3(0.5, 0.5, 0.5),
        specularColor: new BABYLON.Color3(0.2, 0.2, 0.2),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 1.0,
        specularPower: 8,
        metallic: 0.0,
        roughness: 0.95
      },
      preview: '#808080'
    },

    // Glass
    {
      id: 'clear_glass',
      name: 'Clear Glass',
      category: 'glass',
      properties: {
        diffuseColor: new BABYLON.Color3(0.9, 0.9, 1.0),
        specularColor: new BABYLON.Color3(1, 1, 1),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 0.2,
        specularPower: 256,
        metallic: 0.0,
        roughness: 0.0
      },
      preview: '#E0F7FF'
    },
    {
      id: 'tinted_glass',
      name: 'Tinted Glass',
      category: 'glass',
      properties: {
        diffuseColor: new BABYLON.Color3(0.3, 0.5, 0.7),
        specularColor: new BABYLON.Color3(0.8, 0.9, 1.0),
        emissiveColor: new BABYLON.Color3(0, 0, 0),
        alpha: 0.4,
        specularPower: 256,
        metallic: 0.0,
        roughness: 0.0
      },
      preview: '#4A90E2'
    }
  ];

  const categories = ['all', ...Array.from(new Set(materialPresets.map(p => p.category)))];

  const filteredPresets = materialPresets.filter(preset => {
    const matchesCategory = selectedCategory === 'all' || preset.category === selectedCategory;
    const matchesSearch = preset.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const applyPreset = (preset: MaterialPreset) => {
    if (!material) return;
    onPresetApply(preset);
  };

  if (!material) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Material Preset Selector</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Select a material to apply presets</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Material Preset Selector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search presets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm"
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <Button
              key={category}
              onClick={() => setSelectedCategory(category)}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              className="capitalize"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Preset Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {filteredPresets.map(preset => (
            <div
              key={preset.id}
              className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => applyPreset(preset)}
            >
              <div
                className="w-full h-16 rounded mb-2 border"
                style={{ backgroundColor: preset.preview }}
              />
              <h4 className="text-sm font-semibold mb-1">{preset.name}</h4>
              <Badge variant="secondary" className="text-xs capitalize">
                {preset.category}
              </Badge>
            </div>
          ))}
        </div>

        {filteredPresets.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No presets found matching your criteria
          </div>
        )}
      </CardContent>
    </Card>
  );
};
