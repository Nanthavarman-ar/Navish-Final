import React, { useState, useEffect } from 'react';
import { Engine, Scene, Mesh, TransformNode } from '@babylonjs/core';
import './SceneBrowser.css';

interface SceneBrowserProps {
  scene: Scene;
  engine: Engine;
  onObjectSelect?: (object: Mesh | TransformNode) => void;
  onObjectVisibilityChange?: (object: Mesh | TransformNode, visible: boolean) => void;
  onObjectLockChange?: (object: Mesh | TransformNode, locked: boolean) => void;
}

interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'transformNode' | 'light' | 'camera';
  parent?: string;
  children: string[];
  visible: boolean;
  locked: boolean;
  level: number;
}

const SceneBrowser: React.FC<SceneBrowserProps> = ({
  scene,
  engine,
  onObjectSelect,
  onObjectVisibilityChange,
  onObjectLockChange
}) => {
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    updateSceneObjects();
    const observer = scene.onNewMeshAddedObservable.add(() => updateSceneObjects());
    const observer2 = scene.onMeshRemovedObservable.add(() => updateSceneObjects());

    return () => {
      scene.onNewMeshAddedObservable.remove(observer);
      scene.onMeshRemovedObservable.remove(observer2);
    };
  }, [scene]);

  const updateSceneObjects = () => {
    const objects: SceneObject[] = [];

    // Add all meshes
    scene.meshes.forEach(mesh => {
      if (!mesh.name.startsWith('__') && !mesh.name.includes('shadow') && !mesh.name.includes('traffic_viz')) {
        objects.push({
          id: mesh.id,
          name: mesh.name,
          type: 'mesh',
          parent: mesh.parent?.id,
          children: mesh.getChildMeshes().map(child => child.id),
          visible: mesh.isVisible,
          locked: mesh.isPickable === false,
          level: getObjectLevel(mesh)
        });
      }
    });

    // Add transform nodes
    scene.transformNodes.forEach(node => {
      if (!node.name.startsWith('__')) {
        objects.push({
          id: node.id,
          name: node.name,
          type: 'transformNode',
          parent: node.parent?.id,
          children: node.getChildTransformNodes().map(child => child.id),
          visible: node.isEnabled(),
          locked: false,
          level: getObjectLevel(node)
        });
      }
    });

    // Sort by hierarchy level and name
    objects.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });

    setSceneObjects(objects);
  };

  const getObjectLevel = (obj: Mesh | TransformNode): number => {
    let level = 0;
    let current = obj.parent;
    while (current) {
      level++;
      current = current.parent;
    }
    return level;
  };

  const toggleExpanded = (objectId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(objectId)) {
      newExpanded.delete(objectId);
    } else {
      newExpanded.add(objectId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleObjectSelect = (object: SceneObject) => {
    setSelectedObject(object.id);
    const sceneObj = scene.getMeshById(object.id) || scene.getTransformNodeById(object.id);
    if (sceneObj && onObjectSelect) {
      onObjectSelect(sceneObj);
    }
  };

  const toggleVisibility = (object: SceneObject) => {
    const sceneObj = scene.getMeshById(object.id) || scene.getTransformNodeById(object.id);
    if (sceneObj) {
      const newVisible = !object.visible;
      sceneObj.setEnabled(newVisible);
      if (onObjectVisibilityChange) {
        onObjectVisibilityChange(sceneObj, newVisible);
      }
      updateSceneObjects();
    }
  };

  const toggleLock = (object: SceneObject) => {
    const sceneObj = scene.getMeshById(object.id);
    if (sceneObj) {
      const newLocked = !object.locked;
      sceneObj.isPickable = !newLocked;
      if (onObjectLockChange) {
        onObjectLockChange(sceneObj, newLocked);
      }
      updateSceneObjects();
    }
  };

  const renameObject = (objectId: string, newName: string) => {
    const sceneObj = scene.getMeshById(objectId) || scene.getTransformNodeById(objectId);
    if (sceneObj) {
      sceneObj.name = newName;
      updateSceneObjects();
    }
  };

  const filteredObjects = sceneObjects.filter(obj =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'mesh': return '📦';
      case 'transformNode': return '📁';
      case 'light': return '💡';
      case 'camera': return '📷';
      default: return '❓';
    }
  };

  const getIndentation = (level: number) => {
    return '  '.repeat(level);
  };

  return (
    <div className="scene-browser-container">
      <h3 className="scene-browser-title">Scene Browser</h3>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search objects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Object List */}
      <div className="object-list-container">
        {filteredObjects.map((object) => {
          const hasChildren = object.children.length > 0;
          const isExpanded = expandedNodes.has(object.id);
          const isSelected = selectedObject === object.id;

          return (
            <div key={object.id}>
              <div
                className={`object-item ${isSelected ? 'object-item-selected' : ''}`}
                onClick={() => handleObjectSelect(object)}
              >
                {/* Expand/Collapse */}
                <div
                  className={`expand-button ${hasChildren ? '' : 'no-children'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren) toggleExpanded(object.id);
                  }}
                >
                  {hasChildren ? (isExpanded ? '▼' : '▶') : '  '}
                </div>

                {/* Visibility Toggle */}
                <div
                  className={`visibility-toggle ${object.visible ? '' : 'hidden'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(object);
                  }}
                  title={object.visible ? 'Hide object' : 'Show object'}
                >
                  👁
                </div>

                {/* Lock Toggle */}
                <div
                  className={`lock-toggle ${object.locked ? 'locked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(object);
                  }}
                  title={object.locked ? 'Unlock object' : 'Lock object'}
                >
                  {object.locked ? '🔒' : '🔓'}
                </div>

                {/* Object Icon */}
                <span className="object-icon">
                  {getObjectIcon(object.type)}
                </span>

                {/* Object Name */}
                <span className="object-name">
                  {getIndentation(object.level)}{object.name}
                </span>
              </div>

              {/* Children (when expanded) */}
              {isExpanded && hasChildren && (
                <div>
                  {object.children.map(childId => {
                    const childObj = filteredObjects.find(obj => obj.id === childId);
                    if (!childObj) return null;

                    return (
                      <div
                        key={childId}
                        className={`child-item ${selectedObject === childId ? 'child-item-selected' : ''}`}
                        onClick={() => handleObjectSelect(childObj)}
                      >
                        <span className="object-icon">
                          {getObjectIcon(childObj.type)}
                        </span>
                        <span>{childObj.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Statistics */}
      <div className="statistics-container">
        <div>Total Objects: {sceneObjects.length}</div>
        <div>Visible: {sceneObjects.filter(obj => obj.visible).length}</div>
        <div>Locked: {sceneObjects.filter(obj => obj.locked).length}</div>
      </div>
    </div>
  );
};

export default SceneBrowser;
