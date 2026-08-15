

;(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.FeatureManager = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {

  class TinyEmitter {
    constructor(){ this._l = {}; }
    on(k, f){ (this._l[k] = this._l[k] || []).push(f); return this; }
    off(k, f){ if(!this._l[k]) return this; this._l[k] = this._l[k].filter(fn=>fn!==f); return this; }
    emit(k, data){ (this._l[k]||[]).forEach(fn=>{ try{ fn(data); }catch(e){ console.warn(e); } }); return this; }
  }

  // Helper: lazy load script by url; resolves once loaded (or rejects)
  function loadScript(url, globalNameCheck){
    return new Promise((resolve, reject)=>{
      // already available?
      if(globalNameCheck && (typeof window !== 'undefined') && window[globalNameCheck]) return resolve(window[globalNameCheck]);
      // check existing script tags
      const existing = Array.from(document.getElementsByTagName('script')).find(s=> s.src && s.src.indexOf(url) !== -1);
      if(existing){ existing.addEventListener('load', ()=> resolve(window[globalNameCheck] || true)); return; }
      const s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = ()=> resolve(window[globalNameCheck] || true);
      s.onerror = (e)=> reject(new Error('Failed loading script: ' + url));
      document.head.appendChild(s);
    });
  }

  // Default CDN paths (change for internal CDN in production)
  const CDN = {
    oimo: 'https://cdn.babylonjs.com/oimo.js',
    ammo: 'https://cdn.babylonjs.com/ammo.js',
    draco: 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/draco_decoder.js'
  };

  class FeatureManager extends TinyEmitter {
    /**
     * options: { canvas: string|Element, persistKey: string|null, envUrl: string|null }
     */
    constructor(options = {}){
      super();
      this.options = Object.assign({ canvas: 'renderCanvas', persistKey: 'fm_toggles', envUrl: 'https://playground.babylonjs.com/textures/environment.dds' }, options);

      // Canvas resolution
      this.canvas = typeof this.options.canvas === 'string' ? document.getElementById(this.options.canvas) : this.options.canvas;
      if(!this.canvas){
        // lazy create canvas if not found
        this.canvas = document.createElement('canvas');
        this.canvas.id = (typeof this.options.canvas === 'string') ? this.options.canvas : 'renderCanvas_auto';
        this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
        document.body.appendChild(this.canvas);
      }

      // Babylon engine & scene placeholders
      this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
      this.scene = null;
      this._initPromise = this._createScene();

      // persistent state + refs
      this.state = {
        env: !!this.options.envDefault,
        shadows: false, bloom: false, physics: false, ssao: false,
        pbrAlt: false, particles: false, gizmo: false, grid: false
      };
      this.refs = {};

      // load persisted state if present
      this._persistKey = this.options.persistKey || null;
      if(this._persistKey){
        try{ const raw = localStorage.getItem(this._persistKey); if(raw) Object.assign(this.state, JSON.parse(raw)); }catch(e){ /*ignore*/ }
      }

      // safely bind
      this.ready = this.ready.bind(this);
    }

    async _createScene(){
      const scene = new BABYLON.Scene(this.engine);
      this.scene = scene;

      // basic cameras
      this._cameras = [];
      const arc = new BABYLON.ArcRotateCamera('fm_arc', Math.PI/2, Math.PI/3, 10, BABYLON.Vector3.Zero(), scene);
      arc.attachControl(this.canvas, true);
      this._cameras.push(arc);

      const free = new BABYLON.UniversalCamera('fm_free', new BABYLON.Vector3(0,2,-8), scene);
      this._cameras.push(free);
      scene.activeCamera = this._cameras[0];

      // lighting & demo geometry
      const dir = new BABYLON.DirectionalLight('fm_dir', new BABYLON.Vector3(-1,-2,1), scene);
      dir.position = new BABYLON.Vector3(20,40,20);
      const ground = BABYLON.MeshBuilder.CreateGround('fm_ground', { width: 40, height: 40 }, scene);
      const box = BABYLON.MeshBuilder.CreateBox('fm_box', { size: 2 }, scene); box.position.y = 1.1;
      const std = new BABYLON.StandardMaterial('fm_std', scene); std.diffuseColor = new BABYLON.Color3(0.4,0.6,0.9); box.material = std;

      // auto apply environment if persisted or options
      if(this.state.env || this.options.envDefault){
        try{ this.refs.envTex = new BABYLON.CubeTexture(this.options.envUrl, scene); scene.environmentTexture = this.refs.envTex; scene.createDefaultSkybox(this.refs.envTex, true, 1000, 0.3); }catch(e){ console.warn('env load failed', e); }
      }

      // start render
      this.engine.runRenderLoop(()=> { try{ if(this.scene) this.scene.render(); }catch(e){ console.warn(e); } });
      window.addEventListener('resize', ()=> this.engine.resize());

      // apply persisted toggles after creation
      await this._applyPersistedState();
      return scene;
    }

    ready(){ return this._initPromise; }

    // persistence
    _save(){ if(!this._persistKey) return; try{ localStorage.setItem(this._persistKey, JSON.stringify(this.state)); }catch(e){ console.warn('persist save failed', e); } }

    async _applyPersistedState(){
      // Called after scene creation to apply toggles saved earlier. Uses idempotent API.
      const mapping = [
        ['env', this.state.env ? this.enableEnv : this.disableEnv],
        ['shadows', this.state.shadows ? this.enableShadows : this.disableShadows],
        ['bloom', this.state.bloom ? this.enableBloom : this.disableBloom],
        ['physics', this.state.physics ? this.enablePhysics : this.disablePhysics],
        ['ssao', this.state.ssao ? this.enableSSAO : this.disableSSAO],
        ['pbrAlt', this.state.pbrAlt ? this.swapToPBR : this.revertPBR],
        ['particles', this.state.particles ? this.enableParticles : this.disableParticles],
        ['gizmo', this.state.gizmo ? this.enableGizmo : this.disableGizmo],
        ['grid', this.state.grid ? this.enableGrid : this.disableGrid]
      ];
      for(const [k, fn] of mapping){
        try{ if(typeof fn === 'function') await fn.call(this); }catch(e){ console.warn('apply persisted', k, e); }
      }
      this.emit('applied', this.state);
    }

    // ---------------- Feature implementations ----------------
    // ENV
    async enableEnv(){ await this.ready(); if(this.state.env) return; this.state.env = true;
      try{ this.refs.envTex = this.refs.envTex || new BABYLON.CubeTexture(this.options.envUrl, this.scene); this.scene.environmentTexture = this.refs.envTex; if(!this.scene.getMeshByName('defaultSkybox')) this.scene.createDefaultSkybox(this.refs.envTex, true, 1000, 0.3); }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'env', value: true });
    }
    async disableEnv(){ await this.ready(); if(!this.state.env) return; this.state.env = false;
      try{ this.scene.environmentTexture = null; const s = this.scene.getMeshByName('defaultSkybox'); if(s) s.dispose(); }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'env', value: false });
    }

    // SHADOWS
    async enableShadows(){ await this.ready(); if(this.state.shadows) return; this.state.shadows = true;
      try{
        const light = this.scene.lights.find(l=> l instanceof BABYLON.DirectionalLight) || this.scene.lights[0];
        if(!this.refs.shadowGen) this.refs.shadowGen = new BABYLON.ShadowGenerator(2048, light);
        this.refs.shadowGen.usePoissonSampling = true;
        this.refs.shadowGen.getShadowMap().renderList = this.scene.meshes.filter(m=> m.name !== 'fm_ground');
        const g = this.scene.getMeshByName('fm_ground'); if(g) g.receiveShadows = true;
      }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'shadows', value: true });
    }
    async disableShadows(){ await this.ready(); if(!this.state.shadows) return; this.state.shadows = false;
      try{ if(this.refs.shadowGen) this.refs.shadowGen.getShadowMap().renderList = []; const g = this.scene.getMeshByName('fm_ground'); if(g) g.receiveShadows = false; }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'shadows', value: false });
    }

    // BLOOM
    async enableBloom(){ await this.ready(); if(this.state.bloom) return; this.state.bloom = true;
      try{ if(!this.refs.bloom){ const pipe = new BABYLON.DefaultRenderingPipeline('fm_pipe', true, this.scene, this.scene.cameras); pipe.bloomEnabled = true; pipe.bloomThreshold = 0.8; pipe.bloomWeight = 0.6; this.refs.bloom = pipe; } else this.refs.bloom.bloomEnabled = true; }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'bloom', value: true });
    }
    async disableBloom(){ await this.ready(); if(!this.state.bloom) return; this.state.bloom = false; try{ if(this.refs.bloom) this.refs.bloom.bloomEnabled = false; }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'bloom', value: false }); }

    // PHYSICS (lazy-load plugin if not present)
    async enablePhysics(opts = { engine: 'oimo' }){ await this.ready(); if(this.state.physics) return; this.state.physics = true;
      try{
        if(!this.refs.physics){
          if(opts.engine === 'ammo'){
            await loadScript(CDN.ammo, 'Ammo');
            this.refs.physics = new BABYLON.AmmoJSPlugin(true);
          } else {
            // default oimo
            await loadScript(CDN.oimo, 'OIMO');
            this.refs.physics = new BABYLON.OimoJSPlugin();
          }
          this.scene.enablePhysics(new BABYLON.Vector3(0,-9.81,0), this.refs.physics);
          // demo impostors for meshes with names 'fm_box'/'fm_ground'
          this.scene.meshes.forEach(m=>{
            if(m.name === 'fm_box') m.physicsImpostor = new BABYLON.PhysicsImpostor(m, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 1 }, this.scene);
            if(m.name === 'fm_ground') m.physicsImpostor = new BABYLON.PhysicsImpostor(m, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0 }, this.scene);
          });
        } else {
          this.scene.enablePhysics(new BABYLON.Vector3(0,-9.81,0), this.refs.physics);
        }
      }catch(e){ console.warn('enablePhysics error', e); }
      this._save(); this.emit('change', { feature: 'physics', value: true });
    }
    async disablePhysics(){ await this.ready(); if(!this.state.physics) return; this.state.physics = false;
      try{ this.scene.meshes.forEach(m=>{ if(m.physicsImpostor){ m.physicsImpostor.dispose(); m.physicsImpostor = null; } }); try{ this.scene.disablePhysicsEngine(); }catch(e){} }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'physics', value: false });
    }

    // SSAO
    async enableSSAO(){ await this.ready(); if(this.state.ssao) return; this.state.ssao = true;
      try{ if(!this.refs.ssao){ const ss = new BABYLON.SSAORenderingPipeline('fm_ssao', this.scene, { ssaoRatio: 0.5, combineRatio: 1.0 }); ss.fallOff = 0.000001; ss.radius = 3; ss.totalStrength = 1.0; this.refs.ssao = ss; } else this.refs.ssao.enabled = true; }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'ssao', value: true });
    }
    async disableSSAO(){ await this.ready(); if(!this.state.ssao) return; this.state.ssao = false; try{ if(this.refs.ssao) this.refs.ssao.enabled = false; }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'ssao', value: false }); }

    // PBR swap
    async swapToPBR(){ await this.ready(); if(this.state.pbrAlt) return; this.state.pbrAlt = true;
      try{ const mesh = this.scene.getMeshByName('fm_box'); if(!mesh) return; if(!this.refs.pbr) this.refs.pbr = new BABYLON.PBRMetallicRoughnessMaterial('fm_pbr', this.scene); this.refs.pbr.baseColor = new BABYLON.Color3(0.9,0.5,0.2); this.refs.pbr.metallic = 0.3; this.refs.pbr.roughness = 0.4; mesh.material = this.refs.pbr; }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'pbrAlt', value: true });
    }
    async revertPBR(){ await this.ready(); if(!this.state.pbrAlt) return; this.state.pbrAlt = false; try{ const mesh = this.scene.getMeshByName('fm_box'); if(mesh) mesh.material = this.scene.getMaterialByID('fm_std') || new BABYLON.StandardMaterial('fm_std', this.scene); }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'pbrAlt', value: false }); }

    // PARTICLES
    async enableParticles(){ await this.ready(); if(this.state.particles) return; this.state.particles = true;
      try{ if(!this.refs.particles){ const ps = new BABYLON.ParticleSystem('fm_ps', 1000, this.scene); ps.particleTexture = new BABYLON.Texture('https://playground.babylonjs.com/textures/flare.png', this.scene); ps.emitter = this.scene.getMeshByName('fm_box') || BABYLON.Vector3.Zero(); ps.minEmitBox = new BABYLON.Vector3(-0.5,0,0); ps.maxEmitBox = new BABYLON.Vector3(0.5,0,0); ps.start(); this.refs.particles = ps; } else this.refs.particles.start(); }catch(e){ console.warn(e); }
      this._save(); this.emit('change', { feature: 'particles', value: true });
    }
    async disableParticles(){ await this.ready(); if(!this.state.particles) return; this.state.particles = false; try{ if(this.refs.particles) this.refs.particles.stop(); }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'particles', value: false }); }

    // GIZMO
    async enableGizmo(){ await this.ready(); if(this.state.gizmo) return; this.state.gizmo = true; try{ if(!this.refs.gizmo) this.refs.gizmo = new BABYLON.GizmoManager(this.scene); this.refs.gizmo.attachableMeshes = this.scene.meshes; this.refs.gizmo.positionGizmoEnabled = true; }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'gizmo', value: true }); }
    async disableGizmo(){ await this.ready(); if(!this.state.gizmo) return; this.state.gizmo = false; try{ if(this.refs.gizmo){ this.refs.gizmo.positionGizmoEnabled = false; this.refs.gizmo.rotationGizmoEnabled = false; this.refs.gizmo.scaleGizmoEnabled = false; } }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'gizmo', value: false }); }

    // GRID
    async enableGrid(){ await this.ready(); if(this.state.grid) return; this.state.grid = true; try{ if(!this.refs.grid){ const gm = new BABYLON.GridMaterial('fm_grid_mat', this.scene); gm.majorUnitFrequency = 5; gm.gridRatio = 1; const plane = BABYLON.MeshBuilder.CreateGround('fm_grid_plane', { width: 50, height: 50 }, this.scene); plane.material = gm; this.refs.grid = plane; } else this.refs.grid.setEnabled(true); }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'grid', value: true }); }
    async disableGrid(){ await this.ready(); if(!this.state.grid) return; this.state.grid = false; try{ if(this.refs.grid) this.refs.grid.setEnabled(false); }catch(e){ console.warn(e); } this._save(); this.emit('change', { feature: 'grid', value: false }); }

    // LOAD GLTF helper (supports root + url)
    async loadGLTF(url, root = ''){
      await this.ready();
      return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.Append(root, url, this.scene, () => resolve(true), null, err => reject(err));
      });
    }

    // DISPOSE ALL (clean up resources)
    async disposeAll(){ await this.ready(); try{
      if(this.refs.particles){ try{ this.refs.particles.stop(); this.refs.particles.dispose(); }catch(e){} }
      if(this.refs.bloom){ try{ this.refs.bloom.dispose(); }catch(e){} }
      if(this.refs.shadowGen){ try{ this.refs.shadowGen.dispose(); }catch(e){} }
      if(this.refs.ssao){ try{ this.refs.ssao.dispose(); }catch(e){} }
      if(this.scene){ this.scene.dispose(); this.scene = null; }
      if(this.engine){ this.engine.stopRenderLoop(); this.engine.dispose(); this.engine = null; }
    }catch(e){ console.warn('dispose error', e); }
      this.emit('disposed');
    }

  }

  // return class constructor for UMD and CommonJS
  return FeatureManager;
});
