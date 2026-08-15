import React, { useState, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import '@babylonjs/materials';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface MaterialProperty {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

interface MaterialPropertyEditorProps {
  material: BABYLON.Material | null;
  onPropertyChange: (property: string, value: number) => void;
}

export const MaterialPropertyEditor: React.FC<MaterialPropertyEditorProps> = ({
  material,
  onPropertyChange
}) => {
  const [properties, setProperties] = useState<MaterialProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');

  useEffect(() => {
    if (material) {
      updateProperties(material);
    }
  }, [material]);

  const updateProperties = (mat: BABYLON.Material) => {
    const props: MaterialProperty[] = [];

    if (mat instanceof BABYLON.StandardMaterial) {
      props.push(
        { name: 'diffuseR', value: mat.diffuseColor.r || 0, min: 0, max: 1, step: 0.01 },
        { name: 'diffuseG', value: mat.diffuseColor.g || 0, min: 0, max: 1, step: 0.01 },
        { name: 'diffuseB', value: mat.diffuseColor.b || 0, min: 0, max: 1, step: 0.01 },
        { name: 'specularR', value: mat.specularColor.r || 0, min: 0, max: 1, step: 0.01 },
        { name: 'specularG', value: mat.specularColor.g || 0, min: 0, max: 1, step: 0.01 },
        { name: 'specularB', value: mat.specularColor.b || 0, min: 0, max: 1, step: 0.01 },
        { name: 'emissiveR', value: mat.emissiveColor.r || 0, min: 0, max: 1, step: 0.01 },
        { name: 'emissiveG', value: mat.emissiveColor.g || 0, min: 0, max: 1, step: 0.01 },
        { name: 'emissiveB', value: mat.emissiveColor.b || 0, min: 0, max: 1, step: 0.01 },
        { name: 'alpha', value: mat.alpha || 1, min: 0, max: 1, step: 0.01 },
        { name: 'specularPower', value: mat.specularPower || 64, min: 0, max: 128, step: 1 }
      );
    } else if (mat instanceof BABYLON.PBRMaterial) {
      props.push(
        { name: 'metallic', value: mat.metallic || 0, min: 0, max: 1, step: 0.01 },
        { name: 'roughness', value: mat.roughness || 0.5, min: 0, max: 1, step: 0.01 },
        { name: 'alpha', value: mat.alpha || 1, min: 0, max: 1, step: 0.01 },
        { name: 'emissiveIntensity', value: mat.emissiveIntensity || 1, min: 0, max: 10, step: 0.1 }
      );
    }

    setProperties(props);
  };

  const handlePropertyChange = (propertyName: string, value: number) => {
    setProperties(prev =>
      prev.map(prop =>
        prop.name === propertyName ? { ...prop, value } : prop
      )
    );
    onPropertyChange(propertyName, value);
  };

  const applyPreset = (preset: string) => {
    if (!material) return;

    const presets = {
      metal: { metallic: 1.0, roughness: 0.2, alpha: 1.0 },
      plastic: { metallic: 0.0, roughness: 0.5, alpha: 1.0 },
      glass: { metallic: 0.0, roughness: 0.0, alpha: 0.3 },
      wood: { metallic: 0.0, roughness: 0.8, alpha: 1.0 },
      fabric: { metallic: 0.0, roughness: 0.9, alpha: 1.0 }
    };

    const presetValues = presets[preset as keyof typeof presets];
    if (presetValues) {
      Object.entries(presetValues).forEach(([key, value]) => {
        handlePropertyChange(key, value as number);
      });
    }
  };

  if (!material) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Material Property Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Select a material to edit properties</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Material Property Editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Material Type */}
        <div>
          <Label className="text-sm font-semibold">Material Type</Label>
          <p className="text-sm text-gray-600">{material.constructor.name}</p>
        </div>

        {/* Quick Presets */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Quick Presets</Label>
          <div className="grid grid-cols-3 gap-2">
            {['metal', 'plastic', 'glass', 'wood', 'fabric'].map(preset => (
              <Button
                key={preset}
                onClick={() => applyPreset(preset)}
                variant="outline"
                size="sm"
                className="capitalize"
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>

        {/* Property Controls */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {properties.map(prop => (
            <div key={prop.name} className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-sm capitalize">
                  {prop.name.replace(/([A-Z])/g, ' $1').trim()}
                </Label>
                <Input
                  type="number"
                  value={prop.value.toFixed(2)}
                  onChange={(e) => handlePropertyChange(prop.name, parseFloat(e.target.value) || 0)}
                  className="w-20 h-6 text-xs"
                  min={prop.min}
                  max={prop.max}
                  step={prop.step}
                />
              </div>
              <Slider
                value={[prop.value]}
                onValueChange={(value: number[]) => handlePropertyChange(prop.name, value[0])}
                min={prop.min}
                max={prop.max}
                step={prop.step}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Reset Button */}
        <Button
          onClick={() => material && updateProperties(material)}
          variant="outline"
          className="w-full"
        >
          Reset to Default
        </Button>
      </CardContent>
    </Card>
  );
};
