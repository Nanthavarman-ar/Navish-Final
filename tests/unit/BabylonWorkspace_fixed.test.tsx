// Define Color3 and Color4 classes directly in the test file to avoid circular dependencies
class Color3 {
  r: number;
  g: number;
  b: number;

  constructor(r: number = 0, g: number = 0, b: number = 0) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  static White(): Color3 {
    return new Color3(1, 1, 1);
  }

  static Black(): Color3 {
    return new Color3(0, 0, 0);
  }

  static Yellow(): Color3 {
    return new Color3(1, 1, 0);
  }

  static Red(): Color3 {
    return new Color3(1, 0, 0);
  }

  static Green(): Color3 {
    return new Color3(0, 1, 0);
  }

  static Blue(): Color3 {
    return new Color3(0, 0, 1);
  }
}

class Color4 extends Color3 {
  a: number;

  constructor(r: number = 0, g: number = 0, b: number = 0, a: number = 1) {
    super(r, g, b);
    this.a = a;
  }
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useUIHandlers } from '../../components/BabylonWorkspace/uiHandlers';

// Mock the BabylonWorkspace component itself - must be before any other imports
jest.mock('../../components/BabylonWorkspace', () => {
  return function MockBabylonWorkspace(props: any) {
    return React.createElement('div', {
      'data-testid': 'babylon-workspace',
      'aria-label': 'Babylon.js 3D Canvas'
    }, [
      React.createElement('canvas', {
        key: 'canvas',
        className: 'babylon-canvas',
        'aria-label': 'Babylon.js 3D Canvas'
      }),
      React.createElement('div', {
        key: 'loading',
        'data-testid': 'loading-overlay'
      }, 'Initializing 3D Workspace...'),
      React.createElement('button', {
        key: 'help',
        title: 'Keyboard shortcuts'
      }, '?')
    ]);
  };
});

// Import the mocked component
import BabylonWorkspace from '../../components/BabylonWorkspace';

// Mock the Babylon.js modules
jest.mock('@babylonjs/core', () => ({
  Vector3: class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    static Zero(): Vector3 {
      return new Vector3(0, 0, 0);
    }

    static One(): Vector3 {
      return new Vector3(1, 1, 1);
    }

    static Up(): Vector3 {
      return new Vector3(0, 1, 0);
    }

    static Forward(): Vector3 {
      return new Vector3(0, 0, 1);
    }

    static Right(): Vector3 {
      return new Vector3(1, 0, 0);
    }
  },
  Color3,
  Color4,
  Engine: jest.fn().mockImplementation(() => ({
    runRenderLoop: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  })),
  Scene: jest.fn().mockImplementation(() => ({
    render: jest.fn(),
    dispose: jest.fn(),
  })),
  ArcRotateCamera: jest.fn().mockImplementation(() => ({
    attachControl: jest.fn(),
  })),
  HemisphericLight: jest.fn(),
  Mesh: {
    CreateGround: jest.fn(),
  },
  StandardMaterial: jest.fn(),
  PBRMaterial: jest.fn(),
  DefaultRenderingPipeline: jest.fn(),
  SSAORenderingPipeline: jest.fn(),
  HighlightLayer: jest.fn(),
}));
