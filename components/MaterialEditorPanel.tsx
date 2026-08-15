import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { MaterialPropertyEditor } from './MaterialPropertyEditor';
import { MaterialPresetSelector } from './MaterialPresetSelector';

interface MaterialInfo {
  id: string;
  name: string;
  material: BABYLON.Material;
  meshNames: string[];
}

interface MaterialEditorPanelProps {
  scene: BABYLON.Scene | null;
  selectedMesh: BABYLON.Mesh | null;
  onMaterialChange: (material: BABYLON.Material) => void;
}

export const MaterialEditorPanel: React.FC<MaterialEditorPanelProps> = ({
  scene,
  selectedMesh,
  onMaterialChange
}) => {
  const [materials, setMaterials] = useState<MaterialInfo[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [currentMaterial, setCurrentMaterial] = useState<BABYLON.Material | null>(null);

  // Update materials list when scene changes
  useEffect(() => {
    if (!scene) return;

    const updateMaterials = () => {
      const materialMap = new Map<string, MaterialInfo>();

      // Collect all materials from meshes
      scene.meshes.forEach(mesh => {
        if (mesh.material) {
          const materialId = mesh.material.id;
          if (!materialMap.has(materialId)) {
            materialMap.set(materialId, {
              id: materialId,
              name: mesh.material.name || `Material ${materialId}`,
              material: mesh.material,
              meshNames: []
            });
          }
          materialMap.get(materialId)!.meshNames.push(mesh.name);
        }
      });

      const materialList = Array.from(materialMap.values());
      setMaterials(materialList);

      // Auto-select material from selected mesh
      if (selectedMesh?.material) {
        const meshMaterialId = selectedMesh.material.id;
        setSelectedMaterialId(meshMaterialId);
        setCurrentMaterial(selectedMesh.material);
      } else if (materialList.length > 0 && !selectedMaterialId) {
        // Select first material if none selected
        setSelectedMaterialId(materialList[0].id);
        setCurrentMaterial(materialList[0].material);
      }
    };

    updateMaterials();

    // Listen for material changes
    const materialObserver = scene.onNewMaterialAddedObservable.add(() => updateMaterials());
    const meshObserver = scene.onNewMeshAddedObservable.add(() => updateMaterials());

    return () => {
      scene.onNewMaterialAddedObservable.remove(materialObserver);
      scene.onNewMeshAddedObservable.remove(meshObserver);
    };
  }, [scene, selectedMesh]);

  // Update current material when selection changes
  useEffect(() => {
    if (selectedMaterialId) {
      const materialInfo = materials.find(m => m.id === selectedMaterialId);
      setCurrentMaterial(materialInfo?.material || null);
    }
  }, [selectedMaterialId, materials]);

  const handleMaterialSelect = (materialId: string) => {
    setSelectedMaterialId(materialId);
  };

  const handlePropertyChange = (property: string, value: number) => {
    if (!currentMaterial) return;

    try {
      if (currentMaterial instanceof BABYLON.StandardMaterial) {
        switch (property) {
          case 'diffuseR':
            currentMaterial.diffuseColor.r = value;
            break;
          case 'diffuseG':
            currentMaterial.diffuseColor.g = value;
            break;
          case 'diffuseB':
            currentMaterial.diffuseColor.b = value;
            break;
          case 'specularR':
            currentMaterial.specularColor.r = value;
            break;
          case 'specularG':
            currentMaterial.specularColor.g = value;
            break;
          case 'specularB':
            currentMaterial.specularColor.b = value;
            break;
          case 'emissiveR':
            currentMaterial.emissiveColor.r = value;
            break;
          case 'emissiveG':
            currentMaterial.emissiveColor.g = value;
            break;
          case 'emissiveB':
            currentMaterial.emissiveColor.b = value;
            break;
          case 'alpha':
            currentMaterial.alpha = value;
            break;
          case 'specularPower':
            currentMaterial.specularPower = value;
            break;
        }
      } else if (currentMaterial instanceof BABYLON.PBRMaterial) {
        switch (property) {
          case 'metallic':
            currentMaterial.metallic = value;
            break;
          case 'roughness':
            currentMaterial.roughness = value;
            break;
          case 'alpha':
            currentMaterial.alpha = value;
            break;
          case 'emissiveIntensity':
            currentMaterial.emissiveIntensity = value;
            break;
        }
      }

      onMaterialChange(currentMaterial);
    } catch (error) {
      console.error('Error updating material property:', error);
    }
  };

  const handlePresetApply = (preset: any) => {
    if (!currentMaterial) return;

    try {
      if (currentMaterial instanceof BABYLON.StandardMaterial) {
        if (preset.properties.diffuseColor) {
          currentMaterial.diffuseColor = preset.properties.diffuseColor;
        }
        if (preset.properties.specularColor) {
          currentMaterial.specularColor = preset.properties.specularColor;
        }
        if (preset.properties.emissiveColor) {
          currentMaterial.emissiveColor = preset.properties.emissiveColor;
        }
        if (preset.properties.alpha !== undefined) {
          currentMaterial.alpha = preset.properties.alpha;
        }
        if (preset.properties.specularPower !== undefined) {
          currentMaterial.specularPower = preset.properties.specularPower;
        }
      } else if (currentMaterial instanceof BABYLON.PBRMaterial) {
        if (preset.properties.metallic !== undefined) {
          currentMaterial.metallic = preset.properties.metallic;
        }
        if (preset.properties.roughness !== undefined) {
          currentMaterial.roughness = preset.properties.roughness;
        }
        if (preset.properties.alpha !== undefined) {
          currentMaterial.alpha = preset.properties.alpha;
        }
      }

      onMaterialChange(currentMaterial);
    } catch (error) {
      console.error('Error applying material preset:', error);
    }
  };

  if (!scene) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">No 3D scene available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Material Editor
          <Badge variant="secondary">
            {materials.length} materials
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Material Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Material</label>
          <Select value={selectedMaterialId} onValueChange={handleMaterialSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a material..." />
            </SelectTrigger>
            <SelectContent>
              {materials.map(material => (
                <SelectItem key={material.id} value={material.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{material.name}</span>
                    <span className="text-xs text-gray-500">
                      Used by: {material.meshNames.join(', ')}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Material Editor Tabs */}
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="mt-4">
            <MaterialPropertyEditor
              material={currentMaterial}
              onPropertyChange={handlePropertyChange}
            />
          </TabsContent>

          <TabsContent value="presets" className="mt-4">
            <MaterialPresetSelector
              material={currentMaterial}
              onPresetApply={handlePresetApply}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
