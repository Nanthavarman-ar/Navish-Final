import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Copy, Trash2, Save, RotateCcw } from 'lucide-react';

export interface MaterialVariant {
  id: string;
  name: string;
  baseMaterial: BABYLON.Material;
  properties: Record<string, any>;
  createdAt: Date;
  lastModified: Date;
}

interface MaterialVariantManagerProps {
  scene: BABYLON.Scene | null;
  selectedMaterial: BABYLON.Material | null;
  onVariantApply: (variant: MaterialVariant) => void;
}

export const MaterialVariantManager: React.FC<MaterialVariantManagerProps> = ({
  scene,
  selectedMaterial,
  onVariantApply
}) => {
  const [variants, setVariants] = useState<MaterialVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [newVariantName, setNewVariantName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Load variants from localStorage on mount
  useEffect(() => {
    const savedVariants = localStorage.getItem('materialVariants');
    if (savedVariants) {
      try {
        const parsedVariants = JSON.parse(savedVariants).map((v: any) => ({
          ...v,
          createdAt: new Date(v.createdAt),
          lastModified: new Date(v.lastModified)
        }));
        setVariants(parsedVariants);
      } catch (error) {
        console.error('Error loading material variants:', error);
      }
    }
  }, []);

  // Save variants to localStorage whenever variants change
  useEffect(() => {
    localStorage.setItem('materialVariants', JSON.stringify(variants));
  }, [variants]);

  // Drag and Drop state
  const [draggedVariantId, setDraggedVariantId] = useState<string | null>(null);

  const createVariant = () => {
    if (!selectedMaterial || !newVariantName.trim()) return;

    const variant: MaterialVariant = {
      id: `variant_${Date.now()}`,
      name: newVariantName.trim(),
      baseMaterial: selectedMaterial,
      properties: extractMaterialProperties(selectedMaterial),
      createdAt: new Date(),
      lastModified: new Date()
    };

    setVariants(prev => [...prev, variant]);
    setNewVariantName('');
    setIsCreateDialogOpen(false);
  };

  const duplicateVariant = (variantId: string) => {
    const originalVariant = variants.find(v => v.id === variantId);
    if (!originalVariant) return;

    const duplicatedVariant: MaterialVariant = {
      ...originalVariant,
      id: `variant_${Date.now()}`,
      name: `${originalVariant.name} Copy`,
      createdAt: new Date(),
      lastModified: new Date()
    };

    setVariants(prev => [...prev, duplicatedVariant]);
  };

  const deleteVariant = (variantId: string) => {
    setVariants(prev => prev.filter(v => v.id !== variantId));
    if (selectedVariantId === variantId) {
      setSelectedVariantId('');
    }
  };

  const applyVariant = (variant: MaterialVariant) => {
    if (!selectedMaterial) return;

    applyMaterialProperties(selectedMaterial, variant.properties);
    onVariantApply(variant);
  };

  const updateVariant = (variantId: string) => {
    if (!selectedMaterial) return;

    setVariants(prev => prev.map(v =>
      v.id === variantId
        ? {
            ...v,
            properties: extractMaterialProperties(selectedMaterial),
            lastModified: new Date()
          }
        : v
    ));
  };

  const extractMaterialProperties = (material: BABYLON.Material): Record<string, any> => {
    const properties: Record<string, any> = {};

    if (material instanceof BABYLON.StandardMaterial) {
      properties.type = 'standard';
      properties.diffuseColor = material.diffuseColor.asArray();
      properties.specularColor = material.specularColor.asArray();
      properties.emissiveColor = material.emissiveColor.asArray();
      properties.ambientColor = material.ambientColor.asArray();
      properties.alpha = material.alpha;
      properties.specularPower = material.specularPower;
    } else if (material instanceof BABYLON.PBRMaterial) {
      properties.type = 'pbr';
      properties.albedoColor = material.albedoColor?.asArray();
      properties.metallic = material.metallic;
      properties.roughness = material.roughness;
      properties.emissiveColor = material.emissiveColor?.asArray();
      properties.alpha = material.alpha;
      properties.emissiveIntensity = material.emissiveIntensity;
    }

    return properties;
  };

  const applyMaterialProperties = (material: BABYLON.Material, properties: Record<string, any>) => {
    if (material instanceof BABYLON.StandardMaterial && properties.type === 'standard') {
      if (properties.diffuseColor) {
        material.diffuseColor = BABYLON.Color3.FromArray(properties.diffuseColor);
      }
      if (properties.specularColor) {
        material.specularColor = BABYLON.Color3.FromArray(properties.specularColor);
      }
      if (properties.emissiveColor) {
        material.emissiveColor = BABYLON.Color3.FromArray(properties.emissiveColor);
      }
      if (properties.ambientColor) {
        material.ambientColor = BABYLON.Color3.FromArray(properties.ambientColor);
      }
      if (properties.alpha !== undefined) {
        material.alpha = properties.alpha;
      }
      if (properties.specularPower !== undefined) {
        material.specularPower = properties.specularPower;
      }
    } else if (material instanceof BABYLON.PBRMaterial && properties.type === 'pbr') {
      if (properties.albedoColor) {
        material.albedoColor = BABYLON.Color3.FromArray(properties.albedoColor);
      }
      if (properties.metallic !== undefined) {
        material.metallic = properties.metallic;
      }
      if (properties.roughness !== undefined) {
        material.roughness = properties.roughness;
      }
      if (properties.emissiveColor) {
        material.emissiveColor = BABYLON.Color3.FromArray(properties.emissiveColor);
      }
      if (properties.alpha !== undefined) {
        material.alpha = properties.alpha;
      }
      if (properties.emissiveIntensity !== undefined) {
        material.emissiveIntensity = properties.emissiveIntensity;
      }
    }
  };

  // Drag and Drop Handlers
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, variantId: string) => {
    setDraggedVariantId(variantId);
    event.dataTransfer.effectAllowed = 'move';

    // Dispatch custom event for scene drag-drop handler
    const variant = variants.find(v => v.id === variantId);
    if (variant) {
      const customEvent = new CustomEvent('materialDragStart', {
        detail: { material: variant.baseMaterial, variantId }
      });
      window.dispatchEvent(customEvent);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>, targetVariantId: string) => {
    event.preventDefault();
    if (!draggedVariantId || draggedVariantId === targetVariantId) return;

    const draggedVariant = variants.find(v => v.id === draggedVariantId);
    const targetVariant = variants.find(v => v.id === targetVariantId);
    if (!draggedVariant || !targetVariant) return;

    // Swap properties of the two variants
    setVariants(prevVariants => prevVariants.map(v => {
      if (v.id === draggedVariantId) {
        return { ...v, properties: targetVariant.properties, lastModified: new Date() };
      } else if (v.id === targetVariantId) {
        return { ...v, properties: draggedVariant.properties, lastModified: new Date() };
      }
      return v;
    }));

    // If the dragged or target variant is selected, apply the updated variant
    if (selectedVariantId === draggedVariantId) {
      applyVariant({ ...draggedVariant, properties: targetVariant.properties });
    } else if (selectedVariantId === targetVariantId) {
      applyVariant({ ...targetVariant, properties: draggedVariant.properties });
    }

    setDraggedVariantId(null);
  };

  if (!scene || !selectedMaterial) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">Select a material to manage variants</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Material Variants
          <Badge variant="secondary">{variants.length} variants</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Create New Variant */}
        <div className="mb-4">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create Variant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Material Variant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Variant Name</label>
                  <Input
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    placeholder="Enter variant name..."
                    onKeyDown={(e) => e.key === 'Enter' && createVariant()}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createVariant} disabled={!newVariantName.trim()}>
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Variants List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {variants.map(variant => (
            <div
              key={variant.id}
              draggable
              onDragStart={(e) => onDragStart(e, variant.id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, variant.id)}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-move transition-colors ${
                draggedVariantId === variant.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex-1">
                <div className="font-medium">{variant.name}</div>
                <div className="text-xs text-gray-500">
                  Modified: {variant.lastModified.toLocaleDateString()}
                </div>
              </div>
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyVariant(variant)}
                  title="Apply variant"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateVariant(variant.id)}
                  title="Update variant"
                >
                  <Save className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => duplicateVariant(variant.id)}
                  title="Duplicate variant"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteVariant(variant.id)}
                  title="Delete variant"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          {variants.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No variants created yet. Create your first variant to get started.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
