import { Scene, Camera, ArcRotateCamera, FreeCamera, WebXRDefaultExperience, WebXRState, WebXRCamera, WebXRFeaturesManager, WebXRFeatureName, WebXRControllerComponent, WebXRInputSource, Vector3, Quaternion, AbstractMesh, TransformNode, Mesh, LinesMesh, MeshBuilder, StandardMaterial, Color3, Color4, Ray } from '@babylonjs/core';

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

  // Raw native hit-test bound to the right controller's own pointer direction, instead
  // of hitTestFeature above (Babylon's WebXRHitTest, which is always head/gaze-locked)
  // - see setupControllerAnchoredHitTest for why this exists.
  private controllerHitTestSource: XRHitTestSource | null = null;
  private controllerHitTestFrameCallback: ((frame: XRFrame) => void) | null = null;
  private controllerHitTestControllerObserver: ((controller: WebXRInputSource) => void) | null = null;

  // Pending hold-squeeze-to-exit timers, keyed by controller uniqueId - see
  // setupControllerEvents for why this gesture exists.
  private exitHoldTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Custom point-and-teleport (right controller) - see setupCustomTeleportation for why
  // this is a full reimplementation instead of Babylon's own teleportation feature.
  private teleportReticle: Mesh | null = null;
  private teleportArcLine: LinesMesh | null = null;
  private teleportFloorMeshes: AbstractMesh[] = [];
  private teleportFrameCallback: (() => void) | null = null;
  private teleportAiming: boolean = false;
  private teleportTargetPoint: Vector3 | null = null;
  private teleportRotationArmed: boolean = true;
  private static readonly TELEPORT_FORWARD_THRESHOLD = -0.7;
  private static readonly TELEPORT_RELEASE_THRESHOLD = -0.3;
  private static readonly SNAP_TURN_THRESHOLD = 0.7;
  private static readonly SNAP_TURN_REARM_THRESHOLD = 0.3;
  private static readonly SNAP_TURN_RADIANS = Math.PI / 8; // 22.5 degrees

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

  // Invisible fallback ground created lazily if the loaded model has nothing
  // getFloorMeshes() can confidently call a floor - see getOrCreateFallbackFloor.
  private fallbackFloorMesh: Mesh | null = null;

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
    const heuristic = this.scene.meshes.filter((m) => {
      if (!m.isEnabled() || !m.isPickable || !m.isVisible || m.getTotalVertices() === 0) return false;
      const bounds = m.getBoundingInfo().boundingBox;
      const size = bounds.maximumWorld.subtract(bounds.minimumWorld);
      const footprint = Math.max(size.x, size.z);
      return footprint > 0 && size.y < footprint * 0.3;
    });
    if (heuristic.length > 0) return heuristic;

    // Neither search found anything floor-shaped (e.g. a model with no single flat
    // mesh - floors split per-room, everything merged into one non-flat mesh, etc).
    // WebXRDefaultExperience only creates the teleportation feature at all when
    // floorMeshes is non-empty (see webXRDefaultExperience.js:
    // `if (!options.disableTeleportation)`, which enterVR/enterAR set based on this
    // array's length) - so an empty result here doesn't mean "no teleport arc shows up
    // for this spot", it means the ENTIRE teleport feature silently never gets created,
    // no matter how the controller is configured. A guaranteed invisible fallback floor
    // is what makes the arc actually always work, the way it does in every other VR app.
    return [this.getOrCreateFallbackFloor()];
  }

  // Builds (or refreshes) a large, invisible ground plane positioned at the lowest
  // point of the real loaded geometry (or y=0 if the scene is otherwise empty), sized
  // to comfortably cover the model's footprint. Exists purely as a teleport/collision
  // target - never meant to be seen - see getFloorMeshes for why this needs to always
  // succeed.
  //
  // Bounds are recomputed on every call rather than only the first time:
  // getFloorMeshes() (and so this) runs synchronously the moment VR/AR is entered,
  // which can easily happen before the model finishes its own async load - a floor
  // sized/positioned from whatever was in the scene at that first call (an empty
  // scene, or just the small placeholder box/ground) would otherwise never be
  // recalculated once the real model actually loaded, silently going right back to
  // "the arc has nothing valid to land on". The mesh OBJECT itself is still reused
  // (via scaling, not dispose+recreate) rather than replaced, since an active
  // teleportation feature holds a direct reference to it in its own floorMeshes array
  // - swapping in a new mesh instance wouldn't reach that already-created feature.
  private getOrCreateFallbackFloor(): Mesh {
    let minY = 0;
    let sizeXZ = 40;
    const realMeshes = this.scene.meshes.filter((m) =>
      m.isEnabled() && m.isVisible && m.getTotalVertices() > 0 &&
      !/^(ar_reticle|ar_placement_root|__root__|xr_fallback_floor)/i.test(m.name || '')
    );
    if (realMeshes.length > 0) {
      let minYFound = Infinity;
      let maxX = -Infinity, minX = Infinity, maxZ = -Infinity, minZ = Infinity;
      realMeshes.forEach((m) => {
        const bounds = m.getBoundingInfo().boundingBox;
        minYFound = Math.min(minYFound, bounds.minimumWorld.y);
        maxX = Math.max(maxX, bounds.maximumWorld.x);
        minX = Math.min(minX, bounds.minimumWorld.x);
        maxZ = Math.max(maxZ, bounds.maximumWorld.z);
        minZ = Math.min(minZ, bounds.minimumWorld.z);
      });
      if (isFinite(minYFound)) minY = minYFound;
      sizeXZ = Math.max(20, (maxX - minX) * 1.5, (maxZ - minZ) * 1.5);
    }

    if (this.fallbackFloorMesh && !this.fallbackFloorMesh.isDisposed()) {
      this.fallbackFloorMesh.position.y = minY;
      this.fallbackFloorMesh.scaling.setAll(sizeXZ); // built at a fixed 1x1 base size below
      return this.fallbackFloorMesh;
    }

    const floor = MeshBuilder.CreateGround('xr_fallback_floor', { width: 1, height: 1 }, this.scene);
    floor.position.y = minY;
    floor.scaling.setAll(sizeXZ);
    floor.isPickable = true;
    floor.checkCollisions = true;
    // Fully transparent rather than isVisible=false - some picking paths (including
    // this feature's own teleportation raycast) treat isVisible=false meshes as
    // unpickable, which would silently reintroduce the exact "arc never shows up" bug
    // this fallback exists to fix.
    const material = new StandardMaterial('xr_fallback_floor_material', this.scene);
    material.alpha = 0;
    floor.material = material;
    this.fallbackFloorMesh = floor;
    return floor;
  }

  // Controllers not responding at all (no movement, no teleport, no laser pointer -
  // every controller-driven feature dead at once) is the classic symptom of Babylon's
  // motionController never finishing initialization, which normally happens over a
  // network fetch to the online WebXR input-profile repository
  // (immersive-web.github.io) to look up which buttons/axes map to which named
  // component (squeeze/thumbstick/trigger) for this specific controller model. If that
  // request is slow, blocked (corporate network, ad blocker) or the CDN is briefly down,
  // motionController - and everything gated behind onMotionControllerInitObservable,
  // which is all of movement/teleportation/pointer-selection/the exit gesture - just
  // never fires, with no visible error. disableOnlineControllerRepository skips that
  // network request entirely and uses Babylon's own bundled generic controller
  // profiles instead, which still fully support standard trigger/squeeze/thumbstick
  // input - only the fancy branded 3D controller model is lost, which is a fine trade
  // for input actually working.
  //
  // forceInputProfile: 'oculus-touch' additionally sidesteps a second failure mode seen
  // after the above fix - squeeze (the exit gesture) working while BOTH thumbstick-
  // driven features (smooth movement and the teleport arc) stayed completely dead.
  // Without this, which exact profile gets resolved locally depends on matching the
  // browser's own reported profile ID string(s) against Babylon's small locally-
  // registered set (see webXRMotionControllerManager.js's _AvailableControllers) - if
  // that match landed on "generic-trigger" (trigger only, no squeeze/thumbstick at all)
  // rather than "oculus-touch" (trigger+squeeze+thumbstick, Babylon's dedicated Quest
  // Touch class), squeeze wouldn't work either, which contradicts what was actually
  // observed - but there's no way to be certain which resolution path this device
  // actually took without a live device log, so forcing the profile directly removes
  // that ambiguity rather than requiring another guess. Only affects gamepad/controller
  // input - hand-tracking (Vision Pro etc) goes through a separate feature entirely, so
  // this is safe there too, but SHOULD be revisited (made conditional, or dropped) if
  // this app ever needs to support a non-Quest controller-based headset (Vive, WMR,
  // Index) with its own distinct button layout.
  private getInputOptions(): { disableOnlineControllerRepository: boolean; forceInputProfile: string } {
    return { disableOnlineControllerRepository: true, forceInputProfile: 'oculus-touch' };
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
      //
      // disableTeleportation: true unconditionally - Babylon's own stock teleportation
      // feature is replaced entirely by setupCustomTeleportation() below (see its comment
      // for why: a real-hardware bug in Babylon's own snap-turn logic that permanently
      // wedges the whole feature dead after the first turn).
      this.xrExperience = await WebXRDefaultExperience.CreateAsync(this.scene, {
        floorMeshes,
        disableTeleportation: true,
        disableDefaultUI: true,
        inputOptions: this.getInputOptions()
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
      this.configureXRFeatures(floorMeshes);

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

      // Create XR experience for AR with audio support (see enterVR for why
      // disableDefaultUI, disableTeleportation and inputOptions)
      this.xrExperience = await WebXRDefaultExperience.CreateAsync(this.scene, {
        uiOptions: {
          sessionMode: 'immersive-ar'
        },
        floorMeshes,
        disableTeleportation: true,
        disableDefaultUI: true,
        inputOptions: this.getInputOptions()
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
      this.configureXRFeatures(floorMeshes);

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

    // AR sessions (especially phone-based ones, the common case for AR - there's no
    // squeeze/grip controller to hold for the VR hold-to-exit gesture) had NO way to
    // exit at all: the desktop toolbar button/'X' hotkey this.exitXR() is normally
    // wired to are unreachable once the camera feed takes over the screen, and neither
    // the OS back gesture nor the browser chrome reliably ends a WebXR session on every
    // device. A single tap always exits (no hold/confirm) since it's placed away from
    // the scale controls at the bottom, where an accidental tap is unlikely.
    const exitBtn = document.createElement('button');
    exitBtn.textContent = '✕';
    exitBtn.title = 'Exit AR';
    exitBtn.setAttribute('aria-label', 'Exit AR');
    exitBtn.style.cssText = 'position:fixed;top:max(20px,env(safe-area-inset-top));right:20px;pointer-events:auto;width:52px;height:52px;border-radius:9999px;border:2px solid rgba(255,255,255,0.85);background:rgba(15,23,42,0.75);color:#fff;font-size:22px;font-weight:600;display:flex;align-items:center;justify-content:center;touch-action:manipulation;user-select:none;';
    const onExit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.exitXR();
    };
    exitBtn.addEventListener('touchstart', onExit, { passive: false });
    exitBtn.addEventListener('mousedown', onExit);
    container.appendChild(exitBtn);

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

    // A hit-test tap gets the model CLOSE to the real site's actual reference point but
    // rarely exactly on it, and re-tapping to correct it re-rolls rotation too from
    // whatever surface the new tap happened to land on - reading as the model jumping
    // to a totally different orientation rather than settling into place. These nudge it
    // in small, slow steps instead (~0.25 m/s move, ~25 deg/s rotate while held) so it
    // can be walked into an accurate final position/heading without re-tapping at all.
    // Smaller (56px) than the scale buttons above since there are more of them to fit in
    // one row.
    const smallButton = (label: string, title: string, onStep: () => void) => {
      const btn = makeButton(label, title, onStep);
      btn.style.width = '56px';
      btn.style.height = '56px';
      btn.style.fontSize = '20px';
      return btn;
    };

    const moveRow = document.createElement('div');
    moveRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const MOVE_STEP = 0.03; // meters per repeat tick
    moveRow.appendChild(smallButton('◀', 'Move left (hold)', () => this.nudgePlacedModel(0, -MOVE_STEP)));
    moveRow.appendChild(smallButton('▲', 'Move forward (hold)', () => this.nudgePlacedModel(MOVE_STEP, 0)));
    moveRow.appendChild(smallButton('▼', 'Move backward (hold)', () => this.nudgePlacedModel(-MOVE_STEP, 0)));
    moveRow.appendChild(smallButton('▶', 'Move right (hold)', () => this.nudgePlacedModel(0, MOVE_STEP)));

    const rotateRow = document.createElement('div');
    rotateRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const ROTATE_STEP = (3 * Math.PI) / 180; // 3 degrees per repeat tick
    rotateRow.appendChild(smallButton('⟲', 'Rotate left (hold)', () => this.rotatePlacedModel(-ROTATE_STEP)));
    rotateRow.appendChild(smallButton('⟳', 'Rotate right (hold)', () => this.rotatePlacedModel(ROTATE_STEP)));

    container.appendChild(readout);
    container.appendChild(moveRow);
    container.appendChild(rotateRow);
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
        // Once the controller-anchored hit test (below) is live, it's authoritative -
        // this gaze-locked result is only a placeholder for the brief window before a
        // controller connects (or on devices/sessions with no controller at all, e.g.
        // hand-tracking-only or phone AR).
        if (this.controllerHitTestSource) return;
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

    this.setupControllerAnchoredHitTest();

    const session = this.xrExperience.baseExperience.sessionManager.session;
    this.arSelectListener = () => {
      if (!this.lastHitPose) return;
      const root = this.getOrCreatePlacementRoot();
      root.position.copyFrom(this.lastHitPose.position);
      root.rotationQuaternion = this.lastHitPose.rotationQuaternion.clone();
    };
    session?.addEventListener('select', this.arSelectListener);
  }

  // Babylon's own WebXRHitTest feature (this.hitTestFeature, used above) only ever
  // binds its ray to the VIEWER's pose - Babylon's typed options for it don't expose
  // binding to a specific input source at all (only viewer-locked or world-locked, see
  // WebXRHitTest.js's _initHitTestSource). For a headset+controller AR session that
  // means the placement reticle always follows head/gaze direction no matter where the
  // controller is actually pointed - which is exactly why placement landed in the
  // "wrong spot and rotation": users naturally aim with the controller, not their head,
  // so the two rarely agreed.
  //
  // This requests a second, raw native WebXR hit test source bound directly to the
  // right controller's own targetRaySpace (the same ray Babylon draws its laser pointer
  // along), and the callback above defers to whatever this produces once it's live.
  private setupControllerAnchoredHitTest(): void {
    if (!this.xrExperience) return;
    const sessionManager = this.xrExperience.baseExperience.sessionManager;
    const session = sessionManager.session;
    if (!session?.requestHitTestSource) return;

    const bindController = (controller: WebXRInputSource) => {
      if (this.controllerHitTestSource || controller.inputSource.handedness !== 'right') return;
      const targetRaySpace = controller.inputSource.targetRaySpace;
      if (!targetRaySpace) return;
      const request = session.requestHitTestSource?.({ space: targetRaySpace });
      if (!request) return;
      request.then((source) => {
        if (source) this.controllerHitTestSource = source;
      }).catch((error) => {
        console.warn('Controller-anchored AR hit-test unavailable, falling back to gaze-based placement:', error);
      });
    };

    this.xrExperience.input.controllers.forEach(bindController);
    this.controllerHitTestControllerObserver = bindController;
    this.xrExperience.input.onControllerAddedObservable.add(bindController);

    this.controllerHitTestFrameCallback = (frame: XRFrame) => {
      const source = this.controllerHitTestSource;
      const reticle = this.reticle;
      if (!source || !reticle || reticle.isDisposed()) return;
      const results = frame.getHitTestResults(source);
      if (results.length === 0) {
        reticle.isVisible = false;
        this.lastHitPose = null;
        return;
      }
      const pose = results[0].getPose(sessionManager.referenceSpace);
      if (!pose) return;
      const p = pose.transform.position;
      const q = pose.transform.orientation;
      const position = new Vector3(p.x, p.y, p.z).scale(sessionManager.worldScalingFactor);
      const rotationQuaternion = new Quaternion(q.x, q.y, q.z, q.w);
      if (!this.scene.useRightHandedSystem) {
        position.z *= -1;
        rotationQuaternion.z *= -1;
        rotationQuaternion.w *= -1;
      }
      reticle.isVisible = true;
      reticle.position.copyFrom(position);
      reticle.rotationQuaternion = rotationQuaternion.clone();
      this.lastHitPose = { position, rotationQuaternion };
    };
    sessionManager.onXRFrameObservable.add(this.controllerHitTestFrameCallback);
  }

  private teardownControllerAnchoredHitTest(): void {
    if (this.controllerHitTestSource) {
      this.controllerHitTestSource.cancel();
      this.controllerHitTestSource = null;
    }
    const sessionManager = this.xrExperience?.baseExperience?.sessionManager;
    if (sessionManager && this.controllerHitTestFrameCallback) {
      sessionManager.onXRFrameObservable.removeCallback(this.controllerHitTestFrameCallback);
    }
    if (this.xrExperience && this.controllerHitTestControllerObserver) {
      this.xrExperience.input.onControllerAddedObservable.removeCallback(this.controllerHitTestControllerObserver);
    }
    this.controllerHitTestFrameCallback = null;
    this.controllerHitTestControllerObserver = null;
  }

  private teardownARPlacement(): void {
    const session = this.xrExperience?.baseExperience?.sessionManager?.session;
    if (session && this.arSelectListener) {
      session.removeEventListener('select', this.arSelectListener);
    }
    this.arSelectListener = null;
    this.hitTestFeature = null;
    this.teardownControllerAnchoredHitTest();
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

  // Fine manual position adjustment after the initial tap-to-place - a hit-test-driven
  // tap can land close but not exactly on the real site's actual reference point, and
  // re-tapping to try again re-rolls rotation too (from whatever surface/plane the new
  // tap happened to hit), which reads as the model "jumping" rather than correcting.
  // This nudges the already-placed model in place instead, relative to the CAMERA's
  // current horizontal facing (so "forward" on the on-screen button always means
  // "further into the scene from here", regardless of which way the model itself is
  // rotated) - forwardDelta/rightDelta are in meters, small values so a press-and-hold
  // button repeatedly calling this reads as smooth, controllable creep rather than a
  // jump.
  nudgePlacedModel(forwardDelta: number, rightDelta: number): void {
    const root = this.placementRoot;
    const camera = this.xrCamera;
    if (!root) {
      console.warn('Tap the screen to place the model before adjusting its position');
      return;
    }
    if (!camera) return;
    const forward = camera.getDirection(Vector3.Forward());
    forward.y = 0;
    if (forward.lengthSquared() < 1e-6) return; // looking straight up/down - no stable horizontal forward
    forward.normalize();
    const right = camera.getDirection(Vector3.Right());
    right.y = 0;
    right.normalize();
    root.position.addInPlace(forward.scale(forwardDelta)).addInPlace(right.scale(rightDelta));
  }

  // Fine manual rotation (around the vertical/up axis only - architectural placement
  // only ever needs to correct heading, not tilt) after the initial tap-to-place.
  // deltaRadians is small (driven by a press-and-hold button ticking this repeatedly,
  // like nudgePlacedModel) rather than the abrupt ~90 degree jump re-tapping caused
  // before, since each tap fully replaced rotation from whatever the hit-test surface's
  // detected orientation happened to be at that exact point.
  rotatePlacedModel(deltaRadians: number): void {
    const root = this.placementRoot;
    if (!root) {
      console.warn('Tap the screen to place the model before rotating it');
      return;
    }
    if (!root.rotationQuaternion) {
      root.rotationQuaternion = Quaternion.FromEulerVector(root.rotation);
    }
    root.rotationQuaternion = root.rotationQuaternion.multiply(Quaternion.RotationAxis(Vector3.Up(), deltaRadians));
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

    // Cancel any in-progress hold-squeeze-to-exit timers so a still-held squeeze from
    // just now doesn't fire a second exitXR() call after the session has already ended.
    this.exitHoldTimers.forEach((timer) => clearTimeout(timer));
    this.exitHoldTimers.clear();

    try {
      // Disable spatial audio if audio manager is available
      if (this.audioManager && typeof this.audioManager.disableSpatialAudio === 'function') {
        this.audioManager.disableSpatialAudio();
      }

      // Remove the AR reticle/overlay/select-listener while the session is still live -
      // a no-op if AR placement was never set up (e.g. exiting a VR session).
      this.teardownARPlacement();
      this.teardownCustomTeleportation();

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
  private configureXRFeatures(floorMeshes: AbstractMesh[]): void {
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

    // Smooth thumbstick locomotion - the "hold thumbstick to walk" movement most
    // headset users (Quest included) expect. Point-and-teleport is handled entirely
    // separately by setupCustomTeleportation() below, on the right controller only, so
    // this stays dedicated to the LEFT thumbstick (walk/strafe) with no overlap.
    //
    // movementSpeed was previously 1.0 - Babylon's own default for this feature, tuned
    // for a generic scene rather than this app's architectural walkthrough scale -
    // which read as running rather than walking. Halved for a more natural walking pace;
    // still easy to tune further from here if it needs to move again.
    try {
      featuresManager.enableFeature(WebXRFeatureName.MOVEMENT, 'latest', {
        xrInput: this.xrExperience.input,
        movementSpeed: 0.5,
        rotationSpeed: 1.0,
        customRegistrationConfigurations: [
          {
            allowedComponentTypes: [WebXRControllerComponent.THUMBSTICK_TYPE, WebXRControllerComponent.TOUCHPAD_TYPE],
            forceHandedness: 'left',
            axisChangedHandler: (axes: { x: number; y: number }, movementState: { moveX: number; moveY: number; rotateX: number; rotateY: number }, featureContext: { movementThreshold: number }) => {
              movementState.moveX = Math.abs(axes.x) > featureContext.movementThreshold ? axes.x : 0;
              movementState.moveY = Math.abs(axes.y) > featureContext.movementThreshold ? axes.y : 0;
            }
          }
        ]
      }, true, false);
    } catch (error) {
      console.warn('Smooth movement feature not available on this device/browser:', error);
    }

    if (this.teleportationEnabled) {
      this.setupCustomTeleportation(floorMeshes);
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

  // Point-and-teleport arc + right-stick snap-turn, entirely reimplemented rather than
  // using Babylon's own WebXRFeatureName.TELEPORTATION.
  //
  // Reported symptom on real Quest hardware: snap-turn (right stick left/right) worked
  // exactly ONCE, and after that, absolutely nothing else - not the arc, not another
  // turn - ever responded again for the rest of the session. Traced this to a genuine
  // bug in Babylon's own feature (WebXRControllerTeleportation.js): its snap-turn state
  // machine only resets its internal "rotating" latch when the stick's X axis reads
  // EXACTLY 0 (`axesData.x === 0`), and the arc's own forward-trigger explicitly
  // requires that latch to be false (`!controllerData.teleportationState.rotating`).
  // Real analog thumbsticks - Quest Touch included - essentially never report a
  // mathematically perfect 0.0 at rest (hall-sensor/potentiometer noise keeps them a
  // hair off centre), so after the first turn the latch never clears and the arc is
  // permanently locked out. This isn't a version-specific regression to wait out; the
  // exact-equality check is fundamental to how that feature is written.
  //
  // This polls the right controller's thumbstick directly every XR frame (not an
  // axis-CHANGE event, sidestepping any equivalent stuck-latch risk entirely) and uses
  // a proper hysteresis band for both gestures - trigger past 0.7, only re-arm once
  // back under 0.3 - which real hardware noise near zero can never accidentally trip.
  private setupCustomTeleportation(floorMeshes: AbstractMesh[]): void {
    if (!this.xrExperience) return;
    this.teardownCustomTeleportation();
    this.teleportFloorMeshes = floorMeshes;

    const reticle = MeshBuilder.CreateTorus('xr_teleport_reticle', { diameter: 0.6, thickness: 0.05, tessellation: 32 }, this.scene);
    const reticleMaterial = new StandardMaterial('xr_teleport_reticle_material', this.scene);
    reticleMaterial.emissiveColor = new Color3(0.3, 0.9, 1);
    reticleMaterial.disableLighting = true;
    reticle.material = reticleMaterial;
    reticle.isPickable = false;
    reticle.isVisible = false;
    this.teleportReticle = reticle;

    const arcLine = MeshBuilder.CreateLines('xr_teleport_arc', { points: [Vector3.Zero(), Vector3.One()], updatable: true }, this.scene);
    arcLine.color = new Color3(0.3, 0.9, 1);
    arcLine.isPickable = false;
    arcLine.isVisible = false;
    this.teleportArcLine = arcLine;

    const ray = new Ray(Vector3.Zero(), Vector3.Forward());
    const sessionManager = this.xrExperience.baseExperience.sessionManager;

    this.teleportFrameCallback = () => {
      if (!this.xrExperience) return;
      const controller = this.xrExperience.input.controllers.find((c) => c.inputSource.handedness === 'right');
      const thumbstick = controller?.motionController?.getComponentOfType(WebXRControllerComponent.THUMBSTICK_TYPE)
        ?? controller?.motionController?.getComponentOfType(WebXRControllerComponent.TOUCHPAD_TYPE);
      if (!controller || !thumbstick) {
        this.hideTeleportVisuals();
        return;
      }
      const { x, y } = thumbstick.axes;

      // Snap-turn, only while not actively aiming a teleport with the same stick.
      if (!this.teleportAiming) {
        if (this.teleportRotationArmed && Math.abs(x) > XRManager.SNAP_TURN_THRESHOLD) {
          const camera = this.xrCamera;
          if (camera) {
            camera.rotationQuaternion = camera.rotationQuaternion || Quaternion.Identity();
            const turn = XRManager.SNAP_TURN_RADIANS * (x > 0 ? 1 : -1) * (this.scene.useRightHandedSystem ? -1 : 1);
            camera.rotationQuaternion = Quaternion.FromEulerAngles(0, turn, 0).multiply(camera.rotationQuaternion);
          }
          this.teleportRotationArmed = false;
        } else if (Math.abs(x) < XRManager.SNAP_TURN_REARM_THRESHOLD) {
          this.teleportRotationArmed = true;
        }
      }

      if (y < XRManager.TELEPORT_FORWARD_THRESHOLD) {
        if (!this.teleportAiming) {
          // Starting a fresh aim - clear out whatever target was left over from the
          // previous one rather than carrying it forward.
          this.teleportTargetPoint = null;
        }
        this.teleportAiming = true;
        controller.getWorldPointerRayToRef(ray);
        const pick = this.scene.pickWithRay(ray, (m) => this.teleportFloorMeshes.indexOf(m) !== -1);
        if (pick?.hit && pick.pickedPoint) {
          this.teleportTargetPoint = pick.pickedPoint.clone();
          this.showTeleportVisuals(ray.origin, this.teleportTargetPoint, true);
        } else {
          // Deliberately NOT clearing teleportTargetPoint here - a real hand naturally
          // wobbles the controller off-target for a frame or two while easing off the
          // stick to release, and clearing the target on that single missed frame meant
          // a perfectly good aim (reticle shown cyan a moment earlier) silently taught
          // nothing on release - reported as "red/blue shows but doesn't teleport". The
          // last confirmed-valid target stays live until either a new hit updates it or
          // a fresh aim (above) explicitly resets it.
          this.showTeleportVisuals(ray.origin, ray.origin.add(ray.direction.scale(8)), false);
        }
      } else if (this.teleportAiming && y > XRManager.TELEPORT_RELEASE_THRESHOLD) {
        this.teleportAiming = false;
        this.hideTeleportVisuals();
        const camera = this.xrCamera;
        if (this.teleportTargetPoint && camera) {
          const height = camera.realWorldHeight;
          camera.position.x = this.teleportTargetPoint.x;
          camera.position.z = this.teleportTargetPoint.z;
          camera.position.y = this.teleportTargetPoint.y + height;
        }
        this.teleportTargetPoint = null;
      }
    };
    sessionManager.onXRFrameObservable.add(this.teleportFrameCallback);
  }

  private showTeleportVisuals(from: Vector3, to: Vector3, valid: boolean): void {
    if (this.teleportReticle) {
      this.teleportReticle.isVisible = valid;
      if (valid) this.teleportReticle.position.copyFrom(to);
    }
    if (this.teleportArcLine && !this.teleportArcLine.isDisposed()) {
      this.teleportArcLine = MeshBuilder.CreateLines('xr_teleport_arc', {
        points: [from, to],
        instance: this.teleportArcLine,
        updatable: true
      }, this.scene);
      this.teleportArcLine.color = valid ? new Color3(0.3, 0.9, 1) : new Color3(1, 0.3, 0.3);
      this.teleportArcLine.isVisible = true;
    }
  }

  private hideTeleportVisuals(): void {
    if (this.teleportReticle) this.teleportReticle.isVisible = false;
    if (this.teleportArcLine) this.teleportArcLine.isVisible = false;
  }

  private teardownCustomTeleportation(): void {
    const sessionManager = this.xrExperience?.baseExperience?.sessionManager;
    if (sessionManager && this.teleportFrameCallback) {
      sessionManager.onXRFrameObservable.removeCallback(this.teleportFrameCallback);
    }
    this.teleportFrameCallback = null;
    if (this.teleportReticle && !this.teleportReticle.isDisposed()) this.teleportReticle.dispose();
    this.teleportReticle = null;
    if (this.teleportArcLine && !this.teleportArcLine.isDisposed()) this.teleportArcLine.dispose();
    this.teleportArcLine = null;
    this.teleportAiming = false;
    this.teleportTargetPoint = null;
    this.teleportRotationArmed = true;
    this.teleportFloorMeshes = [];
  }

  // Set up controller events - primarily the hold-squeeze-to-exit-VR gesture below.
  // This app has no in-headset way to exit otherwise: the toolbar button and 'X' hotkey
  // this.exitXR() is normally wired to (see enterVR's disableDefaultUI comment) are both
  // on the flat desktop page, invisible and unreachable once actually wearing the
  // headset, and Babylon's own floating exit button is disabled for the same reason. The
  // squeeze/grip button is present on essentially every XR controller (Quest Touch,
  // Vision Pro's pinch-and-hold maps to the equivalent transient-pointer input) and isn't
  // used by anything else in this app, so it's a safe, always-available way to get back
  // out without depending on any menu, laser pointer, or picking working correctly.
  private setupControllerEvents(): void {
    if (!this.xrExperience) return;

    const EXIT_HOLD_MS = 1200;

    const wireExitGesture = (controller: WebXRInputSource) => {
      const attach = () => {
        const squeeze = controller.motionController?.getComponentOfType(WebXRControllerComponent.SQUEEZE_TYPE);
        if (!squeeze) return;
        squeeze.onButtonStateChangedObservable.add((component) => {
          if (component.pressed) {
            if (this.exitHoldTimers.has(controller.uniqueId)) return;
            this.exitHoldTimers.set(controller.uniqueId, setTimeout(() => {
              this.exitHoldTimers.delete(controller.uniqueId);
              console.log('Squeeze held - exiting XR');
              controller.inputSource.gamepad?.hapticActuators?.[0]?.pulse(1.0, 150);
              this.exitXR();
            }, EXIT_HOLD_MS));
          } else {
            const timer = this.exitHoldTimers.get(controller.uniqueId);
            if (timer !== undefined) {
              clearTimeout(timer);
              this.exitHoldTimers.delete(controller.uniqueId);
            }
          }
        });
      };
      if (controller.motionController) attach();
      else controller.onMotionControllerInitObservable.addOnce(attach);
    };

    this.xrExperience.input.onControllerAddedObservable.add((controller) => {
      console.log('XR controller added');
      wireExitGesture(controller);
    });

    this.xrExperience.input.onControllerRemovedObservable.add((controller) => {
      console.log('XR controller removed');
      const timer = this.exitHoldTimers.get(controller.uniqueId);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.exitHoldTimers.delete(controller.uniqueId);
      }
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
      if (this.teleportationEnabled) {
        this.setupCustomTeleportation(this.getFloorMeshes());
      } else {
        this.teardownCustomTeleportation();
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
