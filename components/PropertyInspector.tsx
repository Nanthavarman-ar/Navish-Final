import React, { useState, useEffect } from 'react';
import { Engine, Scene, Mesh, TransformNode, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';
import './PropertyInspector.css';

interface PropertyInspectorProps {
  scene: Scene;
  engine: Engine;
  selectedObject: Mesh | TransformNode | null;
  onPropertyChange?: (object: Mesh | TransformNode, property: string, value: any) => void;
}

interface ObjectProperties {
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scaling: { x: number; y: number; z: number };
  dimensions?: { width: number; height: number; depth: number };
  material?: MaterialProperties;
  metadata?: Record<string, any>;
  visible: boolean;
  pickable: boolean;
}

interface MaterialProperties {
  name: string;
  diffuseColor: { r: number; g: number; b: number };
  specularColor: { r: number; g: number; b: number };
  emissiveColor: { r: number; g: number; b: number };
  alpha: number;
  wireframe: boolean;
}

const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  scene,
  engine,
  selectedObject,
  onPropertyChange
}) => {
  const [properties, setProperties] = useState<ObjectProperties | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);

  useEffect(() => {
    if (selectedObject) {
      updateProperties(selectedObject);
    } else {
      setProperties(null);
    }
  }, [selectedObject]);

  const updateProperties = (object: Mesh | TransformNode) => {
    const props: ObjectProperties = {
      name: object.name,
      type: object instanceof Mesh ? 'Mesh' : 'TransformNode',
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
      },
      rotation: {
        x: object.rotation.x * 180 / Math.PI,
        y: object.rotation.y * 180 / Math.PI,
        z: object.rotation.z * 180 / Math.PI
      },
      scaling: {
        x: object.scaling.x,
        y: object.scaling.y,
        z: object.scaling.z
      },
      visible: object.isEnabled(),
      pickable: object instanceof Mesh ? object.isPickable : true
    };

    // Add mesh-specific properties
    if (object instanceof Mesh) {
      const boundingInfo = object.getBoundingInfo();
      const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

      props.dimensions = {
        width: size.x,
        height: size.y,
        depth: size.z
      };

      // Material properties
      if (object.material instanceof StandardMaterial) {
        const material = object.material;
        props.material = {
          name: material.name,
          diffuseColor: {
            r: material.diffuseColor.r,
            g: material.diffuseColor.g,
            b: material.diffuseColor.b
          },
          specularColor: {
            r: material.specularColor.r,
            g: material.specularColor.g,
            b: material.specularColor.b
          },
          emissiveColor: {
            r: material.emissiveColor.r,
            g: material.emissiveColor.g,
            b: material.emissiveColor.b
          },
          alpha: material.alpha,
          wireframe: material.wireframe
        };
      }
    }

    setProperties(props);
  };

  const handlePropertyChange = (property: string, value: any, subProperty?: string) => {
    if (!selectedObject || !properties) return;

    let newValue = value;

    // Convert degrees to radians for rotation
    if (property === 'rotation') {
      newValue = value * Math.PI / 180;
    }

    // Update the object
    if (subProperty) {
      (selectedObject as any)[property][subProperty] = newValue;
    } else {
      (selectedObject as any)[property] = newValue;
    }

    // Update properties state
    const updatedProps = { ...properties };
    if (subProperty) {
      (updatedProps as any)[property][subProperty] = value;
    } else {
      (updatedProps as any)[property] = value;
    }
    setProperties(updatedProps);

    // Notify parent
    if (onPropertyChange) {
      onPropertyChange(selectedObject, property, newValue);
    }
  };

  const handleMaterialChange = (property: string, value: any) => {
    if (!selectedObject || !(selectedObject instanceof Mesh) || !selectedObject.material) return;

    const material = selectedObject.material as StandardMaterial;

    if (property.includes('Color')) {
      const colorValue = new Color3(value.r, value.g, value.b);
      (material as any)[property] = colorValue;
    } else {
      (material as any)[property] = value;
    }

    updateProperties(selectedObject);
  };

  const renderVector3Input = (label: string, property: string, values: { x: number; y: number; z: number }) => (
    <div className="vector3-container">
      <label className="label">
        {label}
      </label>
      <div className="vector3-inputs">
        {(['x', 'y', 'z'] as const).map(axis => (
          <input
            key={axis}
            type="number"
            step="0.01"
            value={values[axis].toFixed(3)}
            onChange={(e) => handlePropertyChange(property, parseFloat(e.target.value), axis)}
            className="input-number vector3-input"
            aria-label={`${label} ${axis.toUpperCase()}`}
          />
        ))}
      </div>
    </div>
  );

  const renderColorInput = (label: string, color: { r: number; g: number; b: number }, onChange: (color: any) => void) => (
    <div className="color-input-container">
      <label className="label">
        {label}
      </label>
      <div className="color-input-container">
        <input
          type="color"
          value={`#${Math.round(color.r * 255).toString(16).padStart(2, '0')}${Math.round(color.g * 255).toString(16).padStart(2, '0')}${Math.round(color.b * 255).toString(16).padStart(2, '0')}`}
          onChange={(e) => {
            const hex = e.target.value;
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            onChange({ r, g, b });
          }}
          className="color-picker"
          aria-label={`${label} picker`}
        />
        <div className="color-components">
          {(['r', 'g', 'b'] as const).map(component => (
            <input
              key={component}
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={color[component].toFixed(3)}
              onChange={(e) => {
                const newColor = { ...color, [component]: parseFloat(e.target.value) };
                onChange(newColor);
              }}
              className="color-component-input"
              aria-label={`${component.toUpperCase()} component`}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (!properties) {
    return (
      <div className="p-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 h-full">
        <h3 className="m-0 mb-4 text-base">Property Inspector</h3>
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          Select an object to view its properties
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 h-full overflow-y-auto">
      <h3 className="m-0 mb-4 text-base">Property Inspector</h3>

      {/* Basic Properties */}
      <div className="mb-4">
        <h4 className="m-0 mb-2 text-xs text-blue-500">Basic Properties</h4>

        <div className="mb-2">
          <label htmlFor="object-name" className="block text-xs text-slate-400 mb-1">
            Name
          </label>
          <input
            id="object-name"
            type="text"
            value={properties.name}
            onChange={(e) => handlePropertyChange('name', e.target.value)}
            className="w-full p-1 bg-slate-700 border border-slate-600 rounded text-slate-100 text-xs"
          />
        </div>

        <div className="mb-2">
          <label className="block text-xs text-slate-400 mb-1">
            Type
          </label>
          <div className="p-1 bg-slate-700 rounded text-xs text-slate-100">
            {properties.type}
          </div>
        </div>

        <div className="flex gap-2 mb-2">
          <label className="flex items-center text-xs text-slate-400">
            <input
              type="checkbox"
              checked={properties.visible}
              onChange={(e) => handlePropertyChange('isEnabled', e.target.checked)}
              className="mr-1"
            />
            Visible
          </label>

          <label className="flex items-center text-xs text-slate-400">
            <input
              type="checkbox"
              checked={properties.pickable}
              onChange={(e) => handlePropertyChange('isPickable', e.target.checked)}
              className="mr-1"
            />
            Pickable
          </label>
        </div>
      </div>

      {/* Transform Properties */}
      <div className="mb-4">
        <h4 className="m-0 mb-2 text-xs text-blue-500">Transform</h4>

        {renderVector3Input('Position', 'position', properties.position)}
        {renderVector3Input('Rotation (°)', 'rotation', properties.rotation)}
        {renderVector3Input('Scale', 'scaling', properties.scaling)}
      </div>

      {/* Dimensions (Mesh only) */}
      {properties.dimensions && (
        <div className="mb-4">
          <h4 className="m-0 mb-2 text-xs text-blue-500">Dimensions</h4>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-1 bg-slate-700 rounded text-center">
              <div className="text-xs text-slate-400">Width</div>
              <div className="text-xs">{properties.dimensions.width.toFixed(3)}</div>
            </div>

            <div className="p-1 bg-slate-700 rounded text-center">
              <div className="text-xs text-slate-400">Height</div>
              <div className="text-xs">{properties.dimensions.height.toFixed(3)}</div>
            </div>

            <div className="p-1 bg-slate-700 rounded text-center">
              <div className="text-xs text-slate-400">Depth</div>
              <div className="text-xs">{properties.dimensions.depth.toFixed(3)}</div>
            </div>

            <div className="p-1 bg-slate-700 rounded text-center">
              <div className="text-xs text-slate-400">Volume</div>
              <div className="text-xs">
                {(properties.dimensions.width * properties.dimensions.height * properties.dimensions.depth).toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Material Properties */}
      {properties.material && (
        <div className="mb-4">
          <h4 className="m-0 mb-2 text-xs text-blue-500">Material</h4>

          <div className="mb-2">
            <label className="block text-xs text-slate-400 mb-1">
              Material Name
            </label>
            <div className="p-1 bg-slate-700 rounded text-xs text-slate-100">
              {properties.material.name}
            </div>
          </div>

          {renderColorInput('Diffuse Color', properties.material.diffuseColor,
            (color) => handleMaterialChange('diffuseColor', color))}

          {renderColorInput('Specular Color', properties.material.specularColor,
            (color) => handleMaterialChange('specularColor', color))}

          {renderColorInput('Emissive Color', properties.material.emissiveColor,
            (color) => handleMaterialChange('emissiveColor', color))}

          <div className="alpha-container">
            <label className="label">
              Alpha (Transparency)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={properties.material.alpha}
              onChange={(e) => handleMaterialChange('alpha', parseFloat(e.target.value))}
              className="alpha-range"
              aria-label="Alpha transparency"
            />
            <div className="alpha-value">
              {properties.material.alpha.toFixed(2)}
            </div>
          </div>

          <div className="mb-2">
            <label className="flex items-center text-xs text-slate-400">
              <input
                type="checkbox"
                checked={properties.material.wireframe}
                onChange={(e) => handleMaterialChange('wireframe', e.target.checked)}
                className="mr-1"
              />
              Wireframe
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyInspector;
