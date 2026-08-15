import * as BABYLON from "@babylonjs/core";

export interface QuantumState {
  id: string;
  position: BABYLON.Vector3;
  amplitude: number;
  phase: number;
  probability: number;
}

export interface EntanglementPair {
  particle1: QuantumState;
  particle2: QuantumState;
  correlation: number;
  distance: number;
}

export interface QuantumSuperposition {
  states: QuantumState[];
  position: BABYLON.Vector3;
  coherenceTime: number;
  decoherenceRate: number;
}

export interface QuantumTunnel {
  startPosition: BABYLON.Vector3;
  endPosition: BABYLON.Vector3;
  barrierHeight: number;
  tunnelingProbability: number;
  energy: number;
}

export class QuantumSimulationInterface {
  private scene: BABYLON.Scene;
  private quantumStates: Map<string, BABYLON.Mesh> = new Map();
  private entanglementLines: BABYLON.LinesMesh[] = [];
  private superpositionGroups: Map<string, BABYLON.Mesh[]> = new Map();
  private tunnelEffects: Map<string, BABYLON.Mesh> = new Map();
  private animationGroups: Map<string, BABYLON.AnimationGroup> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.initializeQuantumMaterials();
  }

  private quantumMaterials: Map<string, BABYLON.Material> = new Map();

  private initializeQuantumMaterials(): void {
    // Quantum state material - translucent with glow
    const quantumStateMaterial = new BABYLON.StandardMaterial("quantumStateMaterial", this.scene);
    quantumStateMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.8, 1.0);
    quantumStateMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.5);
    quantumStateMaterial.alpha = 0.7;
    quantumStateMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 1.0);
    this.quantumMaterials.set("quantumState", quantumStateMaterial);

    // Entanglement material - connecting lines
    const entanglementMaterial = new BABYLON.StandardMaterial("entanglementMaterial", this.scene);
    entanglementMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.2, 0.8);
    entanglementMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0.4);
    entanglementMaterial.alpha = 0.8;
    this.quantumMaterials.set("entanglement", entanglementMaterial);

    // Superposition material - multiple states
    const superpositionMaterial = new BABYLON.StandardMaterial("superpositionMaterial", this.scene);
    superpositionMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 1.0);
    superpositionMaterial.emissiveColor = new BABYLON.Color3(0.4, 0.1, 0.5);
    superpositionMaterial.alpha = 0.6;
    this.quantumMaterials.set("superposition", superpositionMaterial);

    // Tunneling material - energy barrier effect
    const tunnelingMaterial = new BABYLON.StandardMaterial("tunnelingMaterial", this.scene);
    tunnelingMaterial.diffuseColor = new BABYLON.Color3(0.2, 1.0, 0.2);
    tunnelingMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.5, 0.1);
    tunnelingMaterial.alpha = 0.5;
    this.quantumMaterials.set("tunneling", tunnelingMaterial);
  }

  // Create quantum state visualization
  createQuantumState(state: QuantumState): BABYLON.Mesh {
    const sphere = BABYLON.MeshBuilder.CreateSphere(`quantum_state_${state.id}`, {
      diameter: 0.3 + state.probability * 0.4
    }, this.scene);

    sphere.position = state.position.clone();

    const baseMaterial = this.quantumMaterials.get("quantumState");
    if (!baseMaterial) return sphere;

    const material = baseMaterial.clone(`quantum_material_${state.id}`) as BABYLON.StandardMaterial;
    material.alpha = 0.5 + state.probability * 0.5;
    sphere.material = material;

    // Add pulsing animation based on probability
    this.createQuantumStateAnimation(sphere, state);

    this.quantumStates.set(state.id, sphere);
    return sphere;
  }

  private createQuantumStateAnimation(mesh: BABYLON.Mesh, state: QuantumState): void {
    const animationGroup = new BABYLON.AnimationGroup(`quantum_anim_${state.id}`);

    // Scale animation
    const scaleAnimation = new BABYLON.Animation(
      "scale",
      "scaling",
      30,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );
    const scaleKeys = [
      { frame: 0, value: new BABYLON.Vector3(1, 1, 1) },
      { frame: 60, value: new BABYLON.Vector3(1.2 + state.probability * 0.5, 1.2 + state.probability * 0.5, 1.2 + state.probability * 0.5) },
      { frame: 120, value: new BABYLON.Vector3(1, 1, 1) }
    ];
    scaleAnimation.setKeys(scaleKeys);

    // Color animation based on phase
    if (mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
      const colorAnimation = new BABYLON.Animation(
        "color",
        "emissiveColor",
        30,
        BABYLON.Animation.ANIMATIONTYPE_COLOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
      );
      const colorKeys = [
        { frame: 0, value: mesh.material.emissiveColor.clone() },
        { frame: 60, value: new BABYLON.Color3(
          0.1 + Math.sin(state.phase) * 0.1,
          0.4 + Math.cos(state.phase) * 0.1,
          0.5 + Math.sin(state.phase + Math.PI/2) * 0.1
        ) },
        { frame: 120, value: mesh.material.emissiveColor.clone() }
      ];
      colorAnimation.setKeys(colorKeys);

      animationGroup.addTargetedAnimation(scaleAnimation, mesh);
      animationGroup.addTargetedAnimation(colorAnimation, mesh.material);
    } else {
      animationGroup.addTargetedAnimation(scaleAnimation, mesh);
    }

    animationGroup.play(true);

    this.animationGroups.set(state.id, animationGroup);
  }

  // Create entanglement visualization
  createEntanglementVisualization(pairs: EntanglementPair[]): BABYLON.LinesMesh[] {
    const lines: BABYLON.LinesMesh[] = [];

    pairs.forEach((pair, index) => {
      const points = [pair.particle1.position, pair.particle2.position];

      const line = BABYLON.MeshBuilder.CreateLines(`entanglement_${index}`, {
        points,
        updatable: true
      }, this.scene);

      const baseMaterial = this.quantumMaterials.get("entanglement");
      if (baseMaterial) {
        const material = baseMaterial.clone(`entanglement_mat_${index}`) as BABYLON.StandardMaterial;
        material.alpha = 0.6 + pair.correlation * 0.4;
        line.material = material;
      }

      // Add wavy animation for entanglement
      this.createEntanglementAnimation(line, pair);

      lines.push(line);
      this.entanglementLines.push(line);
    });

    return lines;
  }

  private createEntanglementAnimation(line: BABYLON.LinesMesh, pair: EntanglementPair): void {
    const animationGroup = new BABYLON.AnimationGroup(`entanglement_anim_${line.name}`);

    // Create wavy path animation
    const points = line.getVerticesData(BABYLON.VertexBuffer.PositionKind)!;
    const originalPoints = [...points];

    // Create a position animation for wavy effect
    const waveAnimation = new BABYLON.Animation(
      "wave",
      "position",
      30,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // Define keys for wave animation (simple up and down)
    const keys = [
      { frame: 0, value: line.position.clone() },
      { frame: 30, value: line.position.add(new BABYLON.Vector3(0, 0.1, 0)) },
      { frame: 60, value: line.position.clone() }
    ];
    waveAnimation.setKeys(keys);

    animationGroup.addTargetedAnimation(waveAnimation, line);
    animationGroup.play(true);

    this.animationGroups.set(line.name, animationGroup);
  }

  // Create quantum superposition visualization
  createQuantumSuperposition(superposition: QuantumSuperposition): BABYLON.Mesh[] {
    const meshes: BABYLON.Mesh[] = [];

    superposition.states.forEach((state, index) => {
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `superposition_state_${superposition.position.x}_${index}`,
        { diameter: 0.2 + state.probability * 0.3 },
        this.scene
      );

      // Position states in a circular pattern around the superposition center
      const angle = (index / superposition.states.length) * Math.PI * 2;
      const radius = 1.0;
      sphere.position = superposition.position.clone();
      sphere.position.x += Math.cos(angle) * radius;
      sphere.position.z += Math.sin(angle) * radius;

      const baseMaterial = this.quantumMaterials.get("superposition");
      if (baseMaterial) {
        const material = baseMaterial.clone(`superposition_mat_${index}`) as BABYLON.StandardMaterial;
        material.alpha = 0.4 + state.probability * 0.4;
        sphere.material = material;
      }

      // Add orbital animation
      this.createSuperpositionAnimation(sphere, superposition, angle);

      meshes.push(sphere);
    });

    this.superpositionGroups.set(`superposition_${superposition.position.x}`, meshes);
    return meshes;
  }

  private createSuperpositionAnimation(mesh: BABYLON.Mesh, superposition: QuantumSuperposition, angle: number): void {
    const animationGroup = new BABYLON.AnimationGroup(`superposition_anim_${mesh.name}`);

    // Orbital motion
    const orbitAnimation = new BABYLON.Animation(
      "orbit",
      "position",
      30,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // Add rotation around center
    const radius = BABYLON.Vector3.Distance(mesh.position, superposition.position);
    const keys = [
      { frame: 0, value: mesh.position.clone() },
      { frame: 60, value: new BABYLON.Vector3(
        superposition.position.x + Math.cos(angle + Math.PI/2) * radius,
        superposition.position.y,
        superposition.position.z + Math.sin(angle + Math.PI/2) * radius
      )},
      { frame: 120, value: new BABYLON.Vector3(
        superposition.position.x + Math.cos(angle + Math.PI) * radius,
        superposition.position.y,
        superposition.position.z + Math.sin(angle + Math.PI) * radius
      )},
      { frame: 180, value: new BABYLON.Vector3(
        superposition.position.x + Math.cos(angle + 3*Math.PI/2) * radius,
        superposition.position.y,
        superposition.position.z + Math.sin(angle + 3*Math.PI/2) * radius
      )},
      { frame: 240, value: mesh.position.clone() }
    ];

    animationGroup.addTargetedAnimation(orbitAnimation, mesh);
    animationGroup.play(true);

    this.animationGroups.set(mesh.name, animationGroup);
  }

  // Create quantum tunneling effect
  createQuantumTunnelingEffect(tunnel: QuantumTunnel): BABYLON.Mesh {
    const distance = BABYLON.Vector3.Distance(tunnel.startPosition, tunnel.endPosition);

    // Create tunnel tube
    const tube = BABYLON.MeshBuilder.CreateTube(`quantum_tunnel_${tunnel.startPosition.x}`, {
      path: [tunnel.startPosition, tunnel.endPosition],
      radius: 0.1 + tunnel.tunnelingProbability * 0.2,
      cap: BABYLON.Mesh.CAP_ALL,
      tessellation: 16
    }, this.scene);

    const baseMaterial = this.quantumMaterials.get("tunneling");
    if (baseMaterial) {
      const material = baseMaterial.clone(`tunnel_mat_${tunnel.startPosition.x}`) as BABYLON.StandardMaterial;
      material.alpha = 0.3 + tunnel.tunnelingProbability * 0.5;
      material.emissiveColor = new BABYLON.Color3(
        0.1 + tunnel.tunnelingProbability * 0.2,
        0.5 + tunnel.tunnelingProbability * 0.3,
        0.1
      );
      tube.material = material;
    }

    // Add particle effect for tunneling
    this.createTunnelingParticleEffect(tube, tunnel);

    this.tunnelEffects.set(`tunnel_${tunnel.startPosition.x}`, tube);
    return tube;
  }

  private createTunnelingParticleEffect(tube: BABYLON.Mesh, tunnel: QuantumTunnel): void {
    // Create particle system for tunneling effect
    const particleSystem = new BABYLON.ParticleSystem(`tunnel_particles_${tube.name}`, 100, this.scene);

    particleSystem.particleTexture = new BABYLON.Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", this.scene);
    particleSystem.emitter = tube;
    particleSystem.minEmitBox = tunnel.startPosition.clone();
    particleSystem.maxEmitBox = tunnel.endPosition.clone();

    particleSystem.color1 = new BABYLON.Color4(0.2, 1.0, 0.2, 1.0);
    particleSystem.color2 = new BABYLON.Color4(0.1, 0.8, 0.1, 0.5);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);

    particleSystem.minSize = 0.01;
    particleSystem.maxSize = 0.05;
    particleSystem.minLifeTime = 1.0;
    particleSystem.maxLifeTime = 3.0;
    particleSystem.emitRate = 50 * tunnel.tunnelingProbability;

    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);
    particleSystem.direction1 = new BABYLON.Vector3(0, 0, 0);
    particleSystem.direction2 = new BABYLON.Vector3(0, 0, 0);

    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.5;
    particleSystem.updateSpeed = 0.01;

    particleSystem.start();
  }

  // Create quantum interference pattern
  createQuantumInterference(center: BABYLON.Vector3, sources: BABYLON.Vector3[], wavelength: number = 0.5): BABYLON.Mesh {
    // Create a plane to show interference pattern
    const plane = BABYLON.MeshBuilder.CreateGround(`interference_plane`, {
      width: 10,
      height: 10
    }, this.scene);

    plane.position = center.clone();

    // Create custom shader material for interference pattern
    const interferenceMaterial = new BABYLON.ShaderMaterial("interferenceMaterial", this.scene, {
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 worldViewProjection;
        varying vec2 vUV;
        varying vec3 vPosition;

        void main() {
          vec4 p = vec4(position, 1.0);
          gl_Position = worldViewProjection * p;
          vUV = uv;
          vPosition = position;
        }
      `,
      fragment: `
        precision highp float;
        varying vec2 vUV;
        varying vec3 vPosition;
        uniform vec3 sources[${sources.length}];
        uniform float wavelength;
        uniform float time;

        void main() {
          float intensity = 0.0;

          for (int i = 0; i < ${sources.length}; i++) {
            vec3 sourcePos = sources[i];
            float distance = length(vPosition - sourcePos);
            float phase = distance / wavelength * 2.0 * 3.14159 + time;
            intensity += sin(phase) / distance;
          }

          intensity = (intensity + ${sources.length}.0) / (2.0 * ${sources.length}.0);
          gl_FragColor = vec4(intensity * 0.5, intensity * 0.8, intensity, 0.7);
        }
      `
    }, {
      attributes: ["position", "uv"],
      uniforms: ["worldViewProjection", "sources", "wavelength", "time"]
    });

    // Set shader uniforms
    interferenceMaterial.setArray3("sources", sources.map(s => [s.x, s.y, s.z]).flat());
    interferenceMaterial.setFloat("wavelength", wavelength);
    interferenceMaterial.setFloat("time", 0);

    plane.material = interferenceMaterial;

    // Animate the interference pattern
    this.scene.registerBeforeRender(() => {
      interferenceMaterial.setFloat("time", Date.now() * 0.001);
    });

    return plane;
  }

  // Create quantum wave function visualization
  createWaveFunctionVisualization(waveFunction: (x: number, y: number, z: number) => number,
                                  bounds: { min: BABYLON.Vector3, max: BABYLON.Vector3 },
                                  resolution: number = 32): BABYLON.Mesh {

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.z - bounds.min.z;
    const dx = width / resolution;
    const dz = height / resolution;

    // Generate vertices
    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const x = bounds.min.x + i * dx;
        const z = bounds.min.z + j * dz;
        const y = waveFunction(x, 0, z);

        positions.push(x, y, z);

        // Color based on wave function value
        const intensity = Math.abs(y) * 2;
        colors.push(intensity, 0.5, 1 - intensity, 0.8);
      }
    }

    // Generate indices for triangles
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const topLeft = i * (resolution + 1) + j;
        const topRight = topLeft + 1;
        const bottomLeft = (i + 1) * (resolution + 1) + j;
        const bottomRight = bottomLeft + 1;

        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    const waveMesh = new BABYLON.Mesh("wave_function", this.scene);
    const vertexData = new BABYLON.VertexData();

    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;

    vertexData.applyToMesh(waveMesh);

    const material = new BABYLON.StandardMaterial("waveMaterial", this.scene);
    material.alpha = 0.7;
    material.backFaceCulling = false;
    waveMesh.material = material;

    return waveMesh;
  }

  // Update quantum state
  updateQuantumState(id: string, newState: Partial<QuantumState>): void {
    const mesh = this.quantumStates.get(id);
    if (!mesh) return;

    if (newState.position) {
      mesh.position = newState.position.clone();
    }

    if (newState.probability !== undefined) {
      const scale = 0.3 + newState.probability * 0.4;
      mesh.scaling = new BABYLON.Vector3(scale, scale, scale);

      if (mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
        mesh.material.alpha = 0.5 + newState.probability * 0.5;
      }
    }

    if (newState.phase !== undefined && mesh.material && mesh.material instanceof BABYLON.StandardMaterial) {
      (mesh.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(
        0.1 + Math.sin(newState.phase) * 0.1,
        0.4 + Math.cos(newState.phase) * 0.1,
        0.5 + Math.sin(newState.phase + Math.PI / 2) * 0.1
      );
    }
  }

  // Remove quantum visualization
  removeQuantumState(id: string): void {
    const mesh = this.quantumStates.get(id);
    if (mesh) {
      const animationGroup = this.animationGroups.get(id);
      if (animationGroup) {
        animationGroup.dispose();
        this.animationGroups.delete(id);
      }
      mesh.dispose();
      this.quantumStates.delete(id);
    }
  }

  removeEntanglementVisualization(): void {
    this.entanglementLines.forEach(line => {
      const animationGroup = this.animationGroups.get(line.name);
      if (animationGroup) {
        animationGroup.dispose();
        this.animationGroups.delete(line.name);
      }
      line.dispose();
    });
    this.entanglementLines = [];
  }

  removeSuperpositionVisualization(id: string): void {
    const meshes = this.superpositionGroups.get(id);
    if (meshes) {
      meshes.forEach(mesh => {
        const animationGroup = this.animationGroups.get(mesh.name);
        if (animationGroup) {
          animationGroup.dispose();
          this.animationGroups.delete(mesh.name);
        }
        mesh.dispose();
      });
      this.superpositionGroups.delete(id);
    }
  }

  removeTunnelingEffect(id: string): void {
    const mesh = this.tunnelEffects.get(id);
    if (mesh) {
      mesh.dispose();
      this.tunnelEffects.delete(id);
    }
  }

  // Get visualization statistics
  getVisualizationStats(): any {
    return {
      quantumStates: this.quantumStates.size,
      entanglementLines: this.entanglementLines.length,
      superpositionGroups: this.superpositionGroups.size,
      tunnelEffects: this.tunnelEffects.size,
      activeAnimations: this.animationGroups.size
    };
  }

  // Dispose all quantum visualizations
  dispose(): void {
    // Dispose quantum states
    this.quantumStates.forEach((mesh, id) => {
      const animationGroup = this.animationGroups.get(id);
      if (animationGroup) {
        animationGroup.dispose();
      }
      mesh.dispose();
    });
    this.quantumStates.clear();

    // Dispose entanglement lines
    this.entanglementLines.forEach(line => {
      const animationGroup = this.animationGroups.get(line.name);
      if (animationGroup) {
        animationGroup.dispose();
      }
      line.dispose();
    });
    this.entanglementLines = [];

    // Dispose superposition groups
    this.superpositionGroups.forEach(meshes => {
      meshes.forEach(mesh => {
        const animationGroup = this.animationGroups.get(mesh.name);
        if (animationGroup) {
          animationGroup.dispose();
        }
        mesh.dispose();
      });
    });
    this.superpositionGroups.clear();

    // Dispose tunnel effects
    this.tunnelEffects.forEach(mesh => mesh.dispose());
    this.tunnelEffects.clear();

    // Dispose materials
    this.quantumMaterials.forEach(material => material.dispose());
    this.quantumMaterials.clear();

    this.animationGroups.clear();

    console.log('QuantumSimulationInterface disposed');
  }
}
