import { Scene, Camera, ArcRotateCamera, FreeCamera, WebXRDefaultExperience, WebXRState, WebXRCamera, WebXRFeaturesManager, WebXRFeatureName, Vector3, Quaternion, AbstractMesh, TransformNode, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

// Minimal shape of what we actually use from Babylon's WebXRHitTest feature - typed
// locally instead of importing the class directly, since it isn't re-exported from the
// main @babylonjs/core barrel and enableFeature()'s return type is the generic
// IWebXRFeature anyway.
interface XRHitTestResultLike {
  position: Vector3;
  rotationQuaternion?: Quaternion;
}
interface XRHitTestFeatureLike {
  onHitTestResultObservable: { add: (callback: (results: XRHitTestResultLike[]) => void) => void };
}

// WebXR type declarations
interface XRSystem {
  isSessionSupported(sessionMode: string): Promise<boolean>;
  requestSession(sessionMode: string, options?: any): Promise<XRSession>;
}

interface XRSession {
  end(): Promise<void>;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

interface Navigator {
  xr?: XRSystem;
}

export class XRManager {
  private static instance: XRManager | null = null;

  private scene: Scene;
  private originalCamera: Camera | null = null;
  // Hardware scaling level to restore when XR ends. Headsets - especially standalone
  // ones like Quest - have far less GPU power than the desktop this scene may have
  // been authored/tested on, so a fixed quality that looks fine on desktop can tank
  // the frame rate (and cause real VR discomfort) once in a headset.
  private preXRScalingLevel: number | null = null;
  private xrExperience: WebXRDefaultExperience | null = null;
  private xrCamera: WebXRCamera | null = null;
  private isInitialized: boolean = false;
  // Movement/teleportation and hand tracking default to ON: nothing in the app calls
  // toggleTeleportation() or toggleHandTracking() - there is no button anywhere for
  // either - so leaving them off by default meant VR/AR users could never move, and
  // hand tracking would never turn on, on any headset, with no way to enable it short
  // of editing this file. Requesting hand tracking is safe even on a headset the user
  // is holding controllers with - most headsets (Quest included) automatically switch
  // between controller and hand input at the OS level based on what's actually being
  // held/tracked, so this doesn't fight with controller-based input.
  private handTrackingEnabled: boolean = true;
  private teleportationEnabled: boolean = true;
  private currentSessionMode: 'none' | 'immersive-vr' | 'immersive-ar' = 'none';
  private audioManager: any = null; // AudioManager instance

  // AR manual placement/scale (mobile "tap to place near me, then resize" flow) -
  // the model stays wherever the user last placed/scaled it for the rest of this XR
  // session; re-entering AR (or a fresh page load) starts fresh.
  private placementRoot: TransformNode | null = null;
  private hitTestFeature: XRHitTestFeatureLike | null = null;
  private reticle: Mesh | null = null;
  private lastHitPose: { position: Vector3; rotationQuaternion: Quaternion } | null = null;
  private arOverlayElement: HTMLDivElement | null = null;
  private arScaleReadoutElement: HTMLDivElement | null = null;
  private arSelectListener: (() => void) | null = null;
  private placementScale: number = 1;

  private initPromise: Promise<void>;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initPromise = this.initializeXR();
  }

  static getInstance(scene: Scene): XRManager {
    if (!XRManager.instance) {
      XRManager.instance = new XRManager(scene);
    }
    return XRManager.instance;
  }

  // Initialize WebXR
  private async initializeXR(): Promise<void> {
    if (!this.scene) {
      console.error('Scene not available for XR initialization');
      return;
    }

    try {
      // Check if WebXR is supported
      if (!navigator.xr) {
        console.warn('WebXR not supported in this browser');
        return;
      }

      // Check for VR support
      const vrSupported = await navigator.xr!.isSessionSupported('immersive-vr');
      const arSupported = await navigator.xr!.isSessionSupported('immersive-ar');

      if (!vrSupported && !arSupported) {
        console.warn('Neither VR nor AR sessions are supported');
        return;
      }

      console.log('WebXR initialized:', { vrSupported, arSupported });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize WebXR:', error);
    }
  }

  // Set audio manager for spatial audio integration
  setAudioManager(audioManager: any): void {
    this.audioManager = audioManager;
  }

  // Find meshes in the scene that can be teleported/walked onto. Matches common
  // floor/ground naming, and falls back to a shape heuristic so teleportation always
  // has *something* to target even if the loaded model doesn't explicitly name a
  // floor/ground mesh.
  private getFloorMeshes(): AbstractMesh[] {
    const named = this.scene.meshes.filter(
      (m) => m.isEnabled() && m.isPickable && /ground|floor|terrain|site|plot|land/i.test(m.name || '')
    );
    if (named.length > 0) return named;
    // Fallback for unnamed floors: previously treated EVERY pickable/visible mesh as a
    // valid teleport target - walls, roofs, furniture, anything - so the teleport
    // reticle could land on a vertical wall just as easily as the actual floor, which
    // is exactly what "movement kastama" (movement is difficult/broken-feeling) looks
    // like from the user's side. Only meshes whose bounding box is flat and wide
    // (floor-like) rather than tall and thin (wall-like) qualify now.
    return this.scene.meshes.filter((m) => {
      if (!m.isEnabled() || !m.isPickable || !m.isVisible || m.getTotalVertices() === 0) return false;
      const bounds = m.getBoundingInfo().boundingBox;
      const size = bounds.maximumWorld.subtract(bounds.minimumWorld);
      const footprint = Math.max(size.x, size.z);
      return footprint > 0 && size.y < footprint * 0.3;
    });
  }

  // Makes the headset camera actually stop at walls/furniture instead of the thumbstick
  // (WebXRFeatureName.MOVEMENT below) walking straight through solid geometry. WebXR
  // cameras don't move via the normal collision-aware Camera.update() path by default -
  // enabling checkCollisions + a human-sized capsule here is what makes Babylon's own
  // collision system apply to the same cameraDirection nudges the movement feature
  // produces, so it works together with it rather than needing a separate system.
  // scene.collisionsEnabled is also forced on here as a safety net in case this runs
  // against a scene that doesn't set it itself (e.g. embedded outside BabylonWorkspace).
  // scene.gravity already defaults to real-world (0,-9.807,0) - left untouched.
  private applyWalkingCollisions(camera: WebXRCamera): void {
    this.scene.collisionsEnabled = true;
    camera.checkCollisions = true;
    camera.applyGravity = true;
    camera.ellipsoid = new Vector3(0.3, 0.9, 0.3);
    camera.ellipsoidOffset = new Vector3(0, 0, 0);
  }

  // Reduce render resolution for headset use. Standalone headsets (Quest and similar)
  // have much less GPU power than a typical desktop, so keeping the desktop-tuned
  // hardware scaling level in VR risks a low, uncomfortable frame rate. This targets a
  // conservative, broadly-safe render scale; devices with headroom will simply render
  // a bit sharper than strictly necessary, which is the safer failure direction.
  private applyXRPerformanceProfile(): void {
    const engine = this.scene.getEngine();
    this.preXRScalingLevel = engine.getHardwareScalingLevel();
    const XR_SCALING_LEVEL = 1.4; // ~71% render resolution, upscaled to the headset's display
    if (this.preXRScalingLevel < XR_SCALING_LEVEL) {
      engine.setHardwareScalingLevel(XR_SCALING_LEVEL);
    } else {
      this.preXRScalingLevel = null; // already at or below this scale - nothing to restore
    }
  }

  private restorePreXRQuality(): void {
    if (this.preXRScalingLevel !== null) {
      this.scene.getEngine().setHardwareScalingLevel(this.preXRScalingLevel);
      this.preXRScalingLevel = null;
    }
  }

  // Enter VR mode
  async enterVR(): Promise<boolean> {
    await this.initPromise;
    if (!this.isInitialized) {
      console.error('XR not initialized');
      return false;
    }

    try {
      // Store original camera
      this.originalCamera = this.scene.activeCamera;

      const floorMeshes = this.teleportationEnabled ? this.getFloorMeshes() : [];

      // Create XR experience with audio support. disableDefaultUI: true because this app
      // drives entry/exit itself (toolbar button + 'X' hotkey) - Babylon's own floating
      // enter/exit button would otherwise appear unstyled and duplicate that control.
      this.xrExperience = await WebXRDefaultExperience.CreateAsync(this.scene, {
        floorMeshes,
        disableTeleportation: !this.teleportationEnabled || floorMeshes.length === 0,
        disableDefaultUI: true
      });

      if (!this.xrExperience?.baseExperience) {
        throw new Error('Failed to create XR experience');
      }

      // CreateAsync only builds the helper/camera/features - it does not itself start a
      // session. Without this call the app reported "VR mode enabled" while the user
      // stayed on the flat desktop view.
      await this.xrExperience.baseExperience.enterXRAsync('immersive-vr', 'local-floor', this.xrExperience.renderTarget);

      this.xrCamera = this.xrExperience.baseExperience.camera;
      this.applyWalkingCollisions(this.xrCamera);
      this.currentSessionMode = 'immersive-vr';

      // Enable spatial audio if audio manager is available
      if (this.audioManager && typeof this.audioManager.enableSpatialAudio === 'function') {
        // Pass the XR session to the audio manager for enhanced spatialization
        if (this.xrExperience?.baseExperience?.sessionManager?.session) {
          this.audioManager.setXrSession(this.xrExperience.baseExperience.sessionManager.session);
        }
        this.audioManager.enableSpatialAudio();
      }

      // Configure XR features
      this.configureXRFeatures();

      console.log('Entered VR mode', { floorMeshCount: floorMeshes.length });
      return true;
    } catch (error) {
      console.error('Failed to enter VR mode:', error);
      return false;
    }
  }

  // Enter AR mode
  async enterAR(): Promise<boolean> {
    await this.initPromise;
    if (!this.isInitialized) {
      console.error('XR not initialized');
      return false;
    }

    try {
      // Store original camera
      this.originalCamera = this.scene.activeCamera;

      const floorMeshes = this.teleportationEnabled ? this.getFloorMeshes() : [];

      // Create XR experience for AR with audio support (see enterVR for why disableDefaultUI)
      this.xrExperience = await WebXRDefaultExperience.CreateAsync(this.scene, {
        uiOptions: {
          sessionMode: 'immersive-ar'
        },
        floorMeshes,
        disableTeleportation: !this.teleportationEnabled || floorMeshes.length === 0,
        disableDefaultUI: true
      });

      if (!this.xrExperience?.baseExperience) {
        throw new Error('Failed to create AR experience');
      }

      const featuresManager = this.xrExperience.baseExperience.featuresManager;

      // Hit-test (drives the placement reticle below) and the DOM overlay (the on-screen
      // scale buttons) both need to augment the actual XRSessionInit sent to
      // requestSession - enabling them here, before enterXRAsync, is what makes that
      // happen. Enabling them afterwards (like configureXRFeatures() does below for
      // movement/hand-tracking, which don't need session-level negotiation) is too late
      // for the browser to grant them.
      try {
        this.hitTestFeature = featuresManager.enableFeature(WebXRFeatureName.HIT_TEST, 'latest', {}, true, false) as unknown as XRHitTestFeatureLike;
      } catch (error) {
        console.warn('AR hit-test not available on this device/browser - tap-to-place will be disabled:', error);
        this.hitTestFeature = null;
      }

      this.arOverlayElement = this.createAROverlayUI();
      try {
        featuresManager.enableFeature(WebXRFeatureName.DOM_OVERLAY, 'latest', {
          element: this.arOverlayElement
        }, true, false);
      } catch (error) {
        console.warn('AR DOM overlay not available on this device/browser - on-screen scale buttons will be hidden:', error);
      }

      await this.xrExperience.baseExperience.enterXRAsync('immersive-ar', 'local-floor', this.xrExperience.renderTarget, {
        // Belt-and-suspenders alongside the featuresManager calls above - some Babylon/
        // browser combinations only pick up the DOM overlay root from this raw options
        // object rather than the registered feature.
        optionalFeatures: ['hit-test', 'anchors', 'plane-detection', 'dom-overlay'],
        domOverlay: this.arOverlayElement ? { root: this.arOverlayElement } : undefined
      });

      this.xrCamera = this.xrExperience.baseExperience.camera;
      this.applyWalkingCollisions(this.xrCamera);
      this.currentSessionMode = 'immersive-ar';

      // Enable spatial audio if audio manager is available
      if (this.audioManager && typeof this.audioManager.enableSpatialAudio === 'function') {
        // Pass the XR session to the audio manager for enhanced spatialization
        if (this.xrExperience?.baseExperience?.sessionManager?.session) {
          this.audioManager.setXrSession(this.xrExperience.baseExperience.sessionManager.session);
        }
        this.audioManager.enableSpatialAudio();
      }

      // Configure XR features
      this.configureXRFeatures();

      // Manual "tap to place near me" + scale, so the model doesn't just sit wherever
      // the source file's authored origin happens to be relative to the user.
      this.setupARPlacement();

      console.log('Entered AR mode', { floorMeshCount: floorMeshes.length });
      return true;
    } catch (error) {
      console.error('Failed to enter AR mode:', error);
      this.teardownAROverlayUI();
      return false;
    }
  }

  // Real model content only - excludes ground/helper/UI meshes (measurement lines,
  // annotation pins, the reticle/placement root themselves, etc), matching the same
  // exclusion pattern already used for teleport floor detection and the desktop AR
  // Scale panel, so placement/scale only ever moves the actual loaded model.
  private getPlaceableMeshes(): AbstractMesh[] {
    return this.scene.meshes.filter(
      (m) => m.isEnabled() &&
        !/^(ground|measure_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|ar_reticle|ar_placement_root|__root__)/i.test(m.name || '')
    );
  }

  // Lazily creates (or returns the existing) TransformNode that placement/scale acts
  // on, reparenting every real model mesh under it. setParent() (not just assigning
  // .parent) is what keeps each mesh visually exactly where it already is during this
  // reparent - only the *next* placement/scale actually moves anything.
  private getOrCreatePlacementRoot(): TransformNode {
    if (this.placementRoot && !this.placementRoot.isDisposed()) {
      // A model loaded/changed after the root was first created - pick up any meshes
      // that aren't parented yet.
      this.getPlaceableMeshes().forEach((m) => {
        if (m.parent !== this.placementRoot) m.setParent(this.placementRoot);
      });
      return this.placementRoot;
    }
    const root = new TransformNode('ar_placement_root', this.scene);
    this.getPlaceableMeshes().forEach((m) => m.setParent(root));
    this.placementRoot = root;
    return root;
  }

  // A flat ring shown at the current hit-test surface point, so the user can see where
  // tapping will place the model before they tap - the standard mobile-AR placement UX.
  private createReticle(): Mesh {
    if (this.reticle && !this.reticle.isDisposed()) return this.reticle;
    const reticle = MeshBuilder.CreateTorus('ar_reticle', { diameter: 0.2, thickness: 0.02, tessellation: 32 }, this.scene);
    const mat = new StandardMaterial('ar_reticle_material', this.scene);
    mat.emissiveColor = new Color3(0.25, 0.85, 1);
    mat.disableLighting = true;
    reticle.material = mat;
    reticle.isPickable = false;
    reticle.isVisible = false;
    this.reticle = reticle;
    return reticle;
  }

  // Floating +/reset/- buttons shown over the camera feed during the AR session (via
  // the DOM overlay feature - a normal React panel never renders while an immersive
  // session owns the display, so this has to be raw DOM). pointer-events: none on the
  // container (auto only on the buttons themselves) keeps the rest of the screen free
  // to receive the tap-to-place gesture below.
  //
  // Buttons are large (72px, well spaced) since a handheld phone during an AR session
  // is an inherently unsteady target to tap precisely. Press-and-hold repeats the scale
  // change every 120ms at a gentler 4% step instead of only a single 15% jump per tap -
  // a single quick tap still visibly resizes the model, but dialing in a precise size
  // no longer means many separate imprecise taps; holding down gives smooth, controllable
  // continuous scaling instead, the same interaction pattern as a camera zoom rocker.
  private createAROverlayUI(): HTMLDivElement {
    this.teardownAROverlayUI();
    const container = document.createElement('div');
    container.id = 'naviz-ar-overlay';
    container.style.cssText = 'position:fixed;left:0;right:0;bottom:32px;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;z-index:999999;';

    const readout = document.createElement('div');
    readout.id = 'naviz-ar-scale-readout';
    readout.textContent = `${Math.round(this.placementScale * 100)}%`;
    readout.style.cssText = 'pointer-events:none;padding:4px 12px;border-radius:9999px;background:rgba(15,23,42,0.75);color:#fff;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;';
    this.arScaleReadoutElement = readout;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:18px;';

    const makeButton = (label: string, title: string, onStep: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.style.cssText = 'pointer-events:auto;width:72px;height:72px;border-radius:9999px;border:2px solid rgba(255,255,255,0.85);background:rgba(15,23,42,0.75);color:#fff;font-size:28px;font-weight:600;display:flex;align-items:center;justify-content:center;touch-action:manipulation;user-select:none;';

      let holdInterval: ReturnType<typeof setInterval> | null = null;
      const stop = () => { if (holdInterval !== null) { clearInterval(holdInterval); holdInterval = null; } };
      const start = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (holdInterval !== null) return;
        onStep();
        holdInterval = setInterval(onStep, 120);
      };

      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', stop, { passive: false });
      btn.addEventListener('touchcancel', stop, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', stop);
      btn.addEventListener('mouseleave', stop);
      return btn;
    };

    row.appendChild(makeButton('−', 'Scale down (hold to keep shrinking)', () => this.scalePlacedModel(1 / 1.04)));
    const resetBtn = makeButton('⟲', 'Reset scale', () => this.resetPlacedModelScale());
    resetBtn.style.width = '56px';
    resetBtn.style.height = '56px';
    resetBtn.style.fontSize = '22px';
    row.appendChild(resetBtn);
    row.appendChild(makeButton('+', 'Scale up (hold to keep growing)', () => this.scalePlacedModel(1.04)));

    container.appendChild(readout);
    container.appendChild(row);
    document.body.appendChild(container);
    return container;
  }

  private teardownAROverlayUI(): void {
    if (this.arOverlayElement?.parentNode) {
      this.arOverlayElement.parentNode.removeChild(this.arOverlayElement);
    }
    this.arOverlayElement = null;
    this.arScaleReadoutElement = null;
  }

  // Wires the hit-test reticle and tap-to-place. A tap anywhere on screen that isn't
  // one of the overlay buttons fires the WebXR session's native 'select' event, the
  // same gesture Babylon's own transient hit-testing listens for internally.
  private setupARPlacement(): void {
    if (!this.xrExperience) return;

    const reticle = this.createReticle();
    this.lastHitPose = null;

    if (this.hitTestFeature) {
      this.hitTestFeature.onHitTestResultObservable.add((results) => {
        if (results.length > 0) {
          const hit = results[0];
          reticle.isVisible = true;
          reticle.position.copyFrom(hit.position);
          if (hit.rotationQuaternion) {
            reticle.rotationQuaternion = hit.rotationQuaternion.clone();
          }
          this.lastHitPose = {
            position: hit.position.clone(),
            rotationQuaternion: (hit.rotationQuaternion ?? Quaternion.Identity()).clone()
          };
        } else {
          reticle.isVisible = false;
          this.lastHitPose = null;
        }
      });
    } else {
      console.warn('No hit-test feature available - tap-to-place will not work this session');
    }

    const session = this.xrExperience.baseExperience.sessionManager.session;
    this.arSelectListener = () => {
      if (!this.lastHitPose) return;
      const root = this.getOrCreatePlacementRoot();
      root.position.copyFrom(this.lastHitPose.position);
      root.rotationQuaternion = this.lastHitPose.rotationQuaternion.clone();
    };
    session?.addEventListener('select', this.arSelectListener);
  }

  private teardownARPlacement(): void {
    const session = this.xrExperience?.baseExperience?.sessionManager?.session;
    if (session && this.arSelectListener) {
      session.removeEventListener('select', this.arSelectListener);
    }
    this.arSelectListener = null;
    this.hitTestFeature = null;
    this.lastHitPose = null;
    if (this.reticle && !this.reticle.isDisposed()) {
      this.reticle.dispose();
    }
    this.reticle = null;
    this.teardownAROverlayUI();
    // Deliberately NOT disposing placementRoot or resetting placementScale here - if
    // the user re-enters AR in the same session, their last placement/scale is kept
    // rather than snapping back to the model's original authored position.
  }

  // Scales the placed model (clamped to a sane range so it can't be pinched/tapped down
  // to invisible or up to absurdly oversized). factor is relative, e.g. 1.04 = +4%.
  scalePlacedModel(factor: number): void {
    const root = this.placementRoot;
    if (!root) {
      // Scaling before the model has been placed (tapped) at least once - nothing to
      // resize yet. Silently doing nothing here was itself a source of "the buttons
      // don't work" confusion, so tell the user what to do instead.
      console.warn('Tap the screen to place the model before scaling it');
      return;
    }
    this.placementScale = Math.min(5, Math.max(0.1, this.placementScale * factor));
    root.scaling.setAll(this.placementScale);
    this.updateScaleReadout();
  }

  resetPlacedModelScale(): void {
    this.placementScale = 1;
    this.placementRoot?.scaling.setAll(1);
    this.updateScaleReadout();
  }

  // Lets external UI (e.g. the desktop ARScalePanel) drive the SAME live AR placement
  // this class owns, instead of that panel scaling scene.meshes directly - which
  // silently did nothing once in an AR session anyway, because AR placement reparents
  // every real model mesh under placementRoot (see getOrCreatePlacementRoot), so
  // ARScalePanel's own "!m.parent" filter excluded them all without any explanation.
  hasActivePlacement(): boolean {
    return this.placementRoot !== null && !this.placementRoot.isDisposed();
  }

  getPlacementScale(): number {
    return this.placementScale;
  }

  // Absolute variant of scalePlacedModel (which only takes a relative multiplier) -
  // what a slider/preset-button UI naturally wants ("set it to exactly 50%"), not a
  // repeated relative nudge.
  setPlacedModelScale(scale: number): void {
    const root = this.placementRoot;
    if (!root) return;
    this.placementScale = Math.min(5, Math.max(0.1, scale));
    root.scaling.setAll(this.placementScale);
    this.updateScaleReadout();
  }

  private updateScaleReadout(): void {
    if (this.arScaleReadoutElement) {
      this.arScaleReadoutElement.textContent = `${Math.round(this.placementScale * 100)}%`;
    }
  }

  // Exit XR mode
  async exitXR(): Promise<void> {
    if (!this.xrExperience) {
      return;
    }

    try {
      // Disable spatial audio if audio manager is available
      if (this.audioManager && typeof this.audioManager.disableSpatialAudio === 'function') {
        this.audioManager.disableSpatialAudio();
      }

      // Remove the AR reticle/overlay/select-listener while the session is still live -
      // a no-op if AR placement was never set up (e.g. exiting a VR session).
      this.teardownARPlacement();

      // End XR session
      await this.xrExperience.baseExperience.sessionManager.exitXRAsync();
      this.restorePreXRQuality();

      // Restore original camera
      if (this.originalCamera) {
        this.scene.activeCamera = this.originalCamera;
      }

      // Clean up
      this.xrExperience.dispose();
      this.xrExperience = null;
      this.xrCamera = null;
      this.currentSessionMode = 'none';

      console.log('Exited XR mode');
    } catch (error) {
      console.error('Failed to exit XR mode:', error);
    }
  }

  // Configure XR features
  private configureXRFeatures(): void {
    if (!this.xrExperience) return;

    this.applyXRPerformanceProfile();

    // Restore desktop-quality rendering as soon as the session actually ends, even if
    // that happened outside our own exitXR() flow (headset "remove and exit" gesture,
    // OS-level XR exit, browser tab losing the session, etc).
    this.xrExperience.baseExperience.onStateChangedObservable.add((state) => {
      if (state === WebXRState.NOT_IN_XR) {
        this.restorePreXRQuality();
      }
    });

    const featuresManager = this.xrExperience.baseExperience.featuresManager;

    // Enable hand tracking if supported
    if (this.handTrackingEnabled) {
      this.enableHandTracking(featuresManager);
    }

    // Smooth thumbstick locomotion, in addition to point-and-teleport - this is the
    // "hold thumbstick to walk" movement most headset users (Quest included) expect.
    // Teleportation itself is already wired up via floorMeshes passed to CreateAsync.
    //
    // movementSpeed/rotationSpeed were previously 0.15/0.5 - Babylon's own defaults for
    // this feature are 1.0/1.0, so this was running at 15% of normal walking speed and
    // half rotation speed, which reads as barely-responsive/broken movement rather than
    // "smooth". Using Babylon's own tuned defaults instead of an arbitrary fraction of
    // them.
    try {
      featuresManager.enableFeature(WebXRFeatureName.MOVEMENT, 'latest', {
        xrInput: this.xrExperience.input,
        movementSpeed: 1.0,
        rotationSpeed: 1.0
      }, true, false);
    } catch (error) {
      console.warn('Smooth movement feature not available on this device/browser:', error);
    }

    // Set up controller events
    this.setupControllerEvents();
  }

  // Enable hand tracking
  private enableHandTracking(featuresManager: WebXRFeaturesManager): void {
    try {
      featuresManager.enableFeature(WebXRFeatureName.HAND_TRACKING, 'latest', {
        xrInput: this.xrExperience?.input
      }, true, false);
      console.log('Hand tracking enabled');
    } catch (error) {
      console.warn('Hand tracking not supported:', error);
    }
  }

  // Enable teleportation
  private enableTeleportation(featuresManager: WebXRFeaturesManager): void {
    if (!this.xrExperience) return;
    try {
      const floorMeshes = this.getFloorMeshes();
      featuresManager.enableFeature(WebXRFeatureName.TELEPORTATION, 'latest', {
        xrInput: this.xrExperience.input,
        floorMeshes
      }, true, false);
      console.log('Teleportation enabled', { floorMeshCount: floorMeshes.length });
    } catch (error) {
      console.warn('Teleportation not supported:', error);
    }
  }

  // Set up controller events (simplified for now)
  private setupControllerEvents(): void {
    if (!this.xrExperience) return;

    // Basic controller setup - can be expanded later
    this.xrExperience.input.onControllerAddedObservable.add((controller) => {
      console.log('XR controller added');
    });

    this.xrExperience.input.onControllerRemovedObservable.add((controller) => {
      console.log('XR controller removed');
    });
  }

  // Toggle hand tracking
  toggleHandTracking(): void {
    this.handTrackingEnabled = !this.handTrackingEnabled;

    if (this.xrExperience && this.currentSessionMode !== 'none') {
      const featuresManager = this.xrExperience.baseExperience.featuresManager;
      if (this.handTrackingEnabled) {
        this.enableHandTracking(featuresManager);
      } else {
        try {
          featuresManager.disableFeature(WebXRFeatureName.HAND_TRACKING);
        } catch (error) {
          console.warn('Failed to disable hand tracking:', error);
        }
      }
    }

    console.log(`Hand tracking ${this.handTrackingEnabled ? 'enabled' : 'disabled'}`);
  }

  // Toggle teleportation
  toggleTeleportation(): void {
    this.teleportationEnabled = !this.teleportationEnabled;

    if (this.xrExperience && this.currentSessionMode !== 'none') {
      const featuresManager = this.xrExperience.baseExperience.featuresManager;
      if (this.teleportationEnabled) {
        this.enableTeleportation(featuresManager);
      } else {
        try {
          featuresManager.disableFeature(WebXRFeatureName.TELEPORTATION);
        } catch (error) {
          console.warn('Failed to disable teleportation:', error);
        }
      }
    }

    console.log(`Teleportation ${this.teleportationEnabled ? 'enabled' : 'disabled'}`);
  }

  // Switch camera mode for XR
  switchCameraForXR(cameraType: 'arcRotate' | 'free' | 'universal'): void {
    if (!this.scene) return;

    let newCamera: Camera;

    switch (cameraType) {
      case 'arcRotate':
        newCamera = new ArcRotateCamera('xr_arc_camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), this.scene);
        break;
      case 'free':
        newCamera = new FreeCamera('xr_free_camera', new Vector3(0, 5, -10), this.scene);
        break;
      case 'universal':
        // Universal camera combines features of both
        newCamera = new FreeCamera('xr_universal_camera', new Vector3(0, 5, -10), this.scene);
        break;
      default:
        return;
    }

    // If not in XR mode, set as active camera
    if (this.currentSessionMode === 'none') {
      this.scene.activeCamera = newCamera;
      newCamera.attachControl();
    } else {
      // In XR mode, the XR camera is active, but we can store the preference
      console.log(`Camera mode set to ${cameraType} for next XR session`);
    }
  }

  // Get XR session state
  getXRState(): {
    isInitialized: boolean;
    currentMode: string;
    handTrackingEnabled: boolean;
    teleportationEnabled: boolean;
    isInSession: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      currentMode: this.currentSessionMode,
      handTrackingEnabled: this.handTrackingEnabled,
      teleportationEnabled: this.teleportationEnabled,
      isInSession: this.xrExperience !== null
    };
  }

  // Check if VR is supported
  async isVRSupported(): Promise<boolean> {
    if (!navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported('immersive-vr');
    } catch {
      return false;
    }
  }

  // Check if AR is supported
  async isARSupported(): Promise<boolean> {
    if (!navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported('immersive-ar');
    } catch {
      return false;
    }
  }

  // Update method for per-frame updates
  update(): void {
    // Handle any per-frame XR updates here
    // For now, this is mainly a placeholder for future XR-specific updates
  }

  // Dispose resources
  dispose(): void {
    this.exitXR().then(() => {
      // Dispose audio manager if available
      if (this.audioManager && typeof this.audioManager.dispose === 'function') {
        this.audioManager.dispose();
      }

      this.xrExperience = null;
      this.xrCamera = null;
      this.originalCamera = null;
      this.currentSessionMode = 'none';
      this.isInitialized = false;
    });
  }

  // Enable haptic feedback. Returns whether it actually could be enabled -
  // haptics only exist on real VR controller hardware, so callers need this
  // to avoid telling the user it's "on" when there's no session/controller
  // to vibrate at all (e.g. testing in a normal desktop browser).
  enableHapticFeedback(): boolean {
    if (!this.xrExperience) {
      console.warn('Cannot enable haptic feedback: not in XR session');
      return false;
    }
    const hasHapticController = this.xrExperience.input.controllers.some(
      (c) => c.inputSource.gamepad?.hapticActuators?.length
    );
    if (!hasHapticController) {
      console.warn('Cannot enable haptic feedback: no connected controller supports it');
      return false;
    }

    try {
      // Haptic feedback is enabled by default when controllers are available
      // This method can be used to ensure haptic actuators are ready
      console.log('Haptic feedback enabled');
      return true;
    } catch (error) {
      console.error('Failed to enable haptic feedback:', error);
      return false;
    }
  }

  // Disable haptic feedback
  disableHapticFeedback(): void {
    if (!this.xrExperience) {
      console.warn('Cannot disable haptic feedback: not in XR session');
      return;
    }

    try {
      // Note: Disabling haptic feedback may not be directly supported
      // This could involve setting vibration intensity to 0 for all actuators
      console.log('Haptic feedback disabled');
    } catch (error) {
      console.error('Failed to disable haptic feedback:', error);
    }
  }

  // Trigger haptic feedback on a specific controller
  triggerHapticFeedback(controllerIndex: number = 0, intensity: number = 1.0, duration: number = 100): void {
    if (!this.xrExperience) {
      console.warn('Cannot trigger haptic feedback: not in XR session');
      return;
    }

    try {
      const controllers = this.xrExperience.input.controllers;
      if (controllerIndex >= controllers.length) {
        console.warn(`Controller ${controllerIndex} not available`);
        return;
      }

      const controller = controllers[controllerIndex];
      if (controller.inputSource.gamepad && controller.inputSource.gamepad.hapticActuators) {
        const actuator = controller.inputSource.gamepad.hapticActuators[0];
        if (actuator) {
          actuator.pulse(intensity, duration);
        }
      }
    } catch (error) {
      console.error('Failed to trigger haptic feedback:', error);
    }
  }
}
