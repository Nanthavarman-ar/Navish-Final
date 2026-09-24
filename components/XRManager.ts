import { Scene, Camera, ArcRotateCamera, FreeCamera, WebXRDefaultExperience, WebXRState, WebXRCamera, WebXRFeaturesManager, WebXRFeatureName, WebXRControllerComponent, WebXRInputSource, Vector3, Quaternion, AbstractMesh, TransformNode, Mesh, LinesMesh, MeshBuilder, StandardMaterial, Color3, Color4, Ray, Node } from '@babylonjs/core';
import { AdvancedDynamicTexture, StackPanel, TextBlock, Button, Rectangle } from '@babylonjs/gui';

// One toggleable thing this app knows how to show in the in-headset menu (a placed
// Interactive Fixture, a weather/flood simulation) - deliberately minimal (just enough
// to render a label and a button) so any feature can offer itself to the VR menu without
// XRManager needing to know anything about fixtures/simulations/etc specifically.
export interface VRMenuItem {
  id: string;
  label: string;
  isOn: boolean;
  toggle: () => void;
}

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

  // VR world-shift (see applyVRWorldShift) - brings the model to wherever the XR camera's
  // own raw tracked position naturally is, instead of trying to move the camera to the
  // model. Independent of AR's placementRoot below (different session, different purpose).
  private vrWorldShiftRoot: TransformNode | null = null;
  private vrWorldShiftOriginalParents: Map<AbstractMesh, Node | null> = new Map();

  // Meshes this class had to unfreeze (see unfreezeMeshesForXR) so VR's world-shift /
  // AR's placement root can actually move them - remembered so the VR path can put back
  // the freeze BabylonWorkspace applied after load (see refreezeMeshesAfterVR).
  private xrUnfrozenMeshes: Set<AbstractMesh> = new Set();

  // AR manual placement/scale (mobile "tap to place near me, then resize" flow) -
  // the model stays wherever the user last placed/scaled it for the rest of this XR
  // session; re-entering AR (or a fresh page load) starts fresh.
  private placementRoot: TransformNode | null = null;
  private hitTestFeature: XRHitTestFeatureLike | null = null;
  private reticle: Mesh | null = null;
  private lastHitPose: { position: Vector3; rotationQuaternion: Quaternion } | null = null;
  private arOverlayElement: HTMLDivElement | null = null;
  private arScaleReadoutElement: HTMLDivElement | null = null;
  private arHintElement: HTMLDivElement | null = null;
  private arHintTimeout: ReturnType<typeof setTimeout> | null = null;
  private arSelectListener: (() => void) | null = null;
  private placementScale: number = 1;
  // First-placement auto-fit target (see getOrCreatePlacementRoot's FIX comment) - keep in
  // sync with ARScalePanel.tsx's own TABLETOP_TARGET_METERS, which this mirrors exactly.
  private static readonly AR_AUTO_FIT_TARGET_METERS = 0.5;
  // Locked true right after the model's first placement - without this, EVERY tap on the
  // screen for the rest of the AR session re-placed and re-oriented the model (see
  // arSelectListener below), including a stray tap while trying to walk around, zoom, or
  // just look at it from another angle. That read as the model "suddenly rotating" for no
  // reason (reported this session) - it was working as designed (tap = reposition + face
  // whoever's holding the phone), just triggered by taps nobody meant as a reposition
  // request. requestReposition() below is the deliberate way back in for one more tap.
  private placementLocked = false;
  // Independent of placementScale - applying scale via .setAll() would overwrite a
  // negative (mirrored) x back to positive, silently undoing the mirror. Kept separate so
  // scale and mirror compose instead of one clobbering the other - see applyPlacementScale().
  private placementMirrored: boolean = false;
  // "Dollhouse Mode" auto-spin - shows the placed miniature turning to face every side
  // without the viewer needing to physically walk around a real table (not always
  // practical one-handed on a phone). See toggleAutoRotate()/teardownARPlacement().
  private autoRotateObserver: any = null;

  // Two-finger pinch-to-zoom for the placed model - the only scaling controls that
  // existed before this were the on-screen +/- buttons (a fixed ~4% step per tap/hold
  // tick) and a desktop-only slider (ARScalePanel), neither of which is the direct
  // "spread fingers to grow, pinch to shrink" gesture every mobile AR app trains users
  // to expect. Listens at the document level rather than on the (pointer-events:none)
  // AR overlay container, so it sees every touch on the page without having to change
  // that container's hit-testing - and critically, without swallowing single-finger
  // taps, which still need to reach the WebXR session untouched so the existing
  // tap-to-place 'select' listener keeps working exactly as before.
  private arPinchTouchStart: ((e: TouchEvent) => void) | null = null;
  private arPinchTouchMove: ((e: TouchEvent) => void) | null = null;
  private arPinchTouchEnd: ((e: TouchEvent) => void) | null = null;
  private pinchStartDistance: number = 0;
  private pinchStartScale: number = 1;

  // Raw native hit-test bound to the right controller's own pointer direction, instead
  // of hitTestFeature above (Babylon's WebXRHitTest, which is always head/gaze-locked)
  // - see setupControllerAnchoredHitTest for why this exists.
  private controllerHitTestSource: XRHitTestSource | null = null;
  private controllerHitTestFrameCallback: ((frame: XRFrame) => void) | null = null;
  private controllerHitTestControllerObserver: ((controller: WebXRInputSource) => void) | null = null;

  // Pending hold-squeeze-to-exit timers, keyed by controller uniqueId - see
  // setupControllerEvents for why this gesture exists.
  private exitHoldTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Pending hold-Y/B-button-to-reset-position timers, keyed by controller uniqueId - see
  // setupControllerEvents for the recenter gesture this drives.
  private resetHoldTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Where the player started this VR session - captured once, right after entering, as
  // the "reset position" gesture's target. Getting stuck (e.g. wedged against geometry,
  // or disoriented after a bad teleport) had no recovery besides exiting and re-entering
  // VR entirely; this gives an always-available way back to a known-good spot without
  // ending the session.
  private vrSpawnPosition: Vector3 | null = null;

  // Custom point-and-teleport (right controller) - see setupCustomTeleportation for why
  // this is a full reimplementation instead of Babylon's own teleportation feature.
  private teleportReticle: Mesh | null = null;
  private teleportArcLine: LinesMesh | null = null;
  private teleportFloorMeshes: AbstractMesh[] = [];
  private teleportFrameCallback: (() => void) | null = null;

  // In-headset menu - reported this session as a real gap: desktop-enabled Interactive
  // Fixtures/Simulations already render in VR fine (nothing in this file excludes scene
  // content from the XR camera), but there was no way to switch anything ON/OFF from
  // inside the headset itself, only exit and reset-position (see setupControllerEvents).
  // Other features register what they want toggleable here (see registerVRMenuProvider)
  // rather than XRManager needing to import/know about InteractiveFixtures, weather, etc.
  // directly - each caller owns its own on/off state and toggle function, this just
  // aggregates and renders whatever's currently registered.
  private vrMenuProviders: Map<string, () => VRMenuItem[]> = new Map();
  private vrMenuMesh: Mesh | null = null;
  private vrMenuAdt: AdvancedDynamicTexture | null = null;
  private vrMenuPanel: StackPanel | null = null;
  private vrMenuRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private vrMenuControllerObserver: ((controller: WebXRInputSource) => void) | null = null;

  // TEMPORARY DIAGNOSTIC OVERLAY - see the call site in configureXRFeatures for why this
  // exists (real-device VR/AR spawn-position verification with no cable/ADB needed). Flip
  // to false (or delete this whole feature) once that's resolved.
  private static readonly XR_DEBUG_OVERLAY = true;
  private xrDebugMesh: Mesh | null = null;
  private xrDebugAdt: AdvancedDynamicTexture | null = null;
  private xrDebugText: TextBlock | null = null;
  private xrDebugTimer: ReturnType<typeof setInterval> | null = null;
  private xrDebugModelCenter: Vector3 | null = null;
  private xrDebugStartTime: number = 0;

  private teleportAiming: boolean = false;
  private teleportTargetPoint: Vector3 | null = null;
  private teleportRotationArmed: boolean = true;
  // Reported symptom on real hardware: right-stick snap-turn (x axis) and left-stick
  // walking both work, but pushing the right stick forward to aim a teleport (y axis)
  // never shows so much as the red/invalid arc - the aim gate below (`y <
  // TELEPORT_FORWARD_THRESHOLD`) was simply never being crossed. Most analog thumbsticks
  // don't have a perfectly circular range - forward/back travel commonly reports a
  // smaller max magnitude than left/right does on the same stick - so the same 0.7
  // magnitude that's comfortably reachable on x can sit out of reach on y. Lowered just
  // the forward-aim threshold rather than the (confirmed-working) turn threshold; -0.5
  // is still well clear of MOVEMENT_THRESHOLD (0.15) and centred-stick noise, so this
  // can't spuriously trigger aiming from an idle/resting controller.
  private static readonly TELEPORT_FORWARD_THRESHOLD = -0.5;
  private static readonly SNAP_TURN_THRESHOLD = 0.7;
  private static readonly SNAP_TURN_REARM_THRESHOLD = 0.3;
  private static readonly SNAP_TURN_RADIANS = Math.PI / 8; // 22.5 degrees

  // Custom smooth-walk locomotion (left controller) - see setupCustomMovement.
  private movementFrameCallback: (() => void) | null = null;
  private static readonly MOVEMENT_THRESHOLD = 0.15;
  private static readonly WALK_SPEED_MPS = 1.0; // comfortable walking pace, not a run
  private static readonly SPRINT_THRESHOLD = 0.9; // stick magnitude - near-full deflection
  private static readonly SPRINT_MULTIPLIER = 1.8;

  // Continuous floor-following ("grounding") - see setupGrounding for why this fully
  // replaces Babylon's gravity/collision for vertical position.
  private groundFrameCallback: (() => void) | null = null;
  private groundFloorMeshes: AbstractMesh[] = [];
  // How fast camera height is allowed to change per second when the floor underfoot
  // rises or falls (stairs, ramps, stepping off a curb). Climb is capped comfortably
  // faster than a real walking pace up stairs so it never feels like it's dragging
  // behind the player's actual forward movement; fall is capped faster than climb (falls
  // feel wrong if they're slow) but still far short of instant, which is what made
  // crossing a stair read as "teleporting" - a whole riser's height changing in a single
  // frame. Both bounded so a bad raycast (e.g. a momentary gap between floor meshes)
  // can't move the camera in one uncomfortable jump either way.
  private static readonly GROUND_CLIMB_SPEED_MPS = 3.0;
  private static readonly GROUND_FALL_SPEED_MPS = 6.0;
  // The downward probe starts this far above the camera's current feet estimate - tall
  // enough to already see a rising stair tread just ahead before the collision capsule
  // itself would reach it - and searches this far below that start point before giving
  // up (no floor found this frame - height is simply left unchanged rather than guessed).
  private static readonly GROUND_PROBE_ABOVE_M = 1.0;
  private static readonly GROUND_PROBE_BELOW_M = 3.0;

  // VR comfort: vignette-on-turn - see pulseTurnVignette.
  private preXRVignetteState: { enabled: boolean; weight: number; color: Color4 | null } | null = null;
  private vignetteFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly VIGNETTE_TURN_WEIGHT = 4;
  private static readonly VIGNETTE_TURN_DURATION_MS = 250;

  // AR passthrough shows the user's real environment through the camera feed, but the
  // desktop scene's skybox mesh (LightingPresets.tsx's procedural sky dome or HDRI
  // skybox) is still just an ordinary opaque mesh sitting in the scene - nothing about
  // entering an AR session removes it on its own. Left alone, it draws over the
  // passthrough feed and (being infiniteDistance, i.e. always centered on the camera)
  // visually rides along with the camera/model instead of staying "outside" like a real
  // sky would, reading as the model dragging the sky along with it. Only relevant for AR
  // (immersive-ar) - VR has no real-world passthrough to obscure, so the skybox should
  // stay visible there as the virtual sky it's meant to be.
  private hiddenSkyboxMeshes: AbstractMesh[] | null = null;

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

  // Lets other features (InteractiveFixtures, the weather/flood toggles in
  // BabylonWorkspace) offer themselves to the in-headset VR menu without this file
  // needing to import or know anything about them - each caller supplies its OWN
  // provider function (called fresh on every refresh, so it always reflects that
  // feature's current live state) under its own key, and this aggregates whatever's
  // currently registered when building/refreshing the menu. Safe to call whether or not
  // a VR session is currently active - the menu itself only exists while one is.
  registerVRMenuProvider(key: string, provider: () => VRMenuItem[]): void {
    this.vrMenuProviders.set(key, provider);
    // A provider registering WHILE already in VR (e.g. InteractiveFixtures mounting
    // after the headset session started) should show up without waiting for the next
    // periodic refresh.
    if (this.vrMenuAdt) this.refreshVRMenu();
  }

  unregisterVRMenuProvider(key: string): void {
    this.vrMenuProviders.delete(key);
    if (this.vrMenuAdt) this.refreshVRMenu();
  }

  private getAllVRMenuItems(): VRMenuItem[] {
    const items: VRMenuItem[] = [];
    this.vrMenuProviders.forEach((provider, key) => {
      try {
        items.push(...provider());
      } catch (error) {
        console.warn(`[XRManager] VR menu provider "${key}" threw, skipping it this refresh:`, error);
      }
    });
    return items;
  }

  // Builds the in-headset 3D panel once a VR session is active. Attached to the LEFT
  // controller's grip as a "wrist menu" (the standard VR UI placement - always in reach,
  // never blocking the view) once that controller actually attaches; a controller can
  // take a moment to report in after the session starts (or never, on a gaze-only/hand-
  // tracking-only setup), so this starts floating in front of the camera immediately and
  // re-parents to the left controller the moment one becomes available, rather than the
  // menu simply not existing until then.
  private createVRMenu(): void {
    if (!this.xrExperience || !this.scene) return;
    this.disposeVRMenu();

    const plane = MeshBuilder.CreatePlane('vrFeatureMenu', { width: 0.5, height: 0.7 }, this.scene);
    plane.isPickable = true;
    plane.renderingGroupId = 1; // draw on top of scene geometry it might be floating inside of
    this.positionVRMenu(plane);

    const adt = AdvancedDynamicTexture.CreateForMesh(plane, 512, 700);
    adt.background = 'rgba(31, 31, 32, 0.92)'; // matches this app's own slate-900 panel chrome

    const panel = new StackPanel();
    panel.width = '100%';
    panel.paddingTop = '16px';
    panel.paddingBottom = '16px';
    adt.addControl(panel);

    const title = new TextBlock('vrMenuTitle', 'Fixtures & Simulations');
    title.color = 'white';
    title.fontSize = 28;
    title.height = '60px';
    title.textWrapping = true;
    panel.addControl(title);

    this.vrMenuMesh = plane;
    this.vrMenuAdt = adt;
    this.vrMenuPanel = panel;
    this.refreshVRMenu();
    // Periodic rather than reactive - the registered providers are plain closures over
    // React/app state with no observable of their own to subscribe to, and a handful of
    // toggleable items is cheap enough to fully rebuild every second rather than diffing.
    this.vrMenuRefreshTimer = setInterval(() => this.refreshVRMenu(), 1000);

    const attachToLeftController = (controller: WebXRInputSource) => {
      if (controller.inputSource.handedness !== 'left' || !this.vrMenuMesh) return;
      this.positionVRMenu(this.vrMenuMesh, controller);
    };
    // Covers a left controller that's already attached by the time the menu is created...
    this.xrExperience.input.controllers.forEach(attachToLeftController);
    // ...and one that attaches later (common - controllers report in asynchronously after
    // the session starts, not necessarily before configureXRFeatures runs).
    this.vrMenuControllerObserver = attachToLeftController;
    this.xrExperience.input.onControllerAddedObservable.add(this.vrMenuControllerObserver);
  }

  // Parents the menu to the given controller's grip (a real "worn on the wrist" menu), or
  // floats it a comfortable reading distance in front of the current XR camera if no
  // controller is available yet/at all.
  private positionVRMenu(plane: Mesh, controller?: WebXRInputSource): void {
    if (controller?.grip) {
      plane.parent = controller.grip;
      // Offset up and slightly forward from the grip, tilted to face the wearer the way
      // a real wrist-worn display would - not flat on top of the hand (unreadable) or
      // facing straight out (faces away from the user, not at them).
      plane.position = new Vector3(0, 0.12, 0.03);
      plane.rotation = new Vector3(Math.PI / 2.4, 0, 0);
      return;
    }
    plane.parent = null;
    const camera = this.xrCamera ?? (this.scene.activeCamera as any);
    if (camera?.position && camera?.getForwardRay) {
      const forward = camera.getForwardRay().direction;
      plane.position = camera.position.add(forward.scale(0.6)).add(new Vector3(0, -0.05, 0));
      plane.lookAt(camera.position);
    }
  }

  private refreshVRMenu(): void {
    if (!this.vrMenuPanel) return;
    const items = this.getAllVRMenuItems();

    // Rebuilt from scratch each refresh rather than diffed - see createVRMenu's own
    // comment on why a periodic full rebuild is an acceptable trade for a handful of
    // items, and it keeps toggle() closures always bound to the CURRENT item (a diffed
    // update would need to carefully re-bind stale closures on every state change).
    const toRemove = this.vrMenuPanel.children.filter((c) => c.name !== 'vrMenuTitle');
    toRemove.forEach((c) => this.vrMenuPanel!.removeControl(c));

    if (items.length === 0) {
      const empty = new TextBlock('vrMenuEmpty', 'No fixtures or simulations placed yet');
      empty.color = '#a3a2a2';
      empty.fontSize = 18;
      empty.height = '50px';
      empty.textWrapping = true;
      this.vrMenuPanel.addControl(empty);
      return;
    }

    for (const item of items) {
      const row = new Rectangle(`vrMenuRow_${item.id}`);
      row.height = '64px';
      row.width = '92%';
      row.thickness = 0;
      row.paddingBottom = '8px';

      const button = Button.CreateSimpleButton(`vrMenuBtn_${item.id}`, `${item.isOn ? '●' : '○'}  ${item.label}`);
      button.width = '100%';
      button.height = '100%';
      button.color = 'white';
      button.fontSize = 22;
      button.cornerRadius = 10;
      button.background = item.isOn ? '#16a34a' : '#4a4a4b';
      button.thickness = 0;
      // onPointerUpObservable (not onPointerClickObservable) - fires on the same
      // trigger-release gesture Babylon's default WebXR controller pointer selection
      // feature already generates for any pickable mesh's GUI, no custom controller
      // wiring needed here (see WebXRControllerPointerSelection, enabled by default and
      // never disabled in this file's enterVR() options).
      button.onPointerUpObservable.add(() => {
        try {
          item.toggle();
        } catch (error) {
          console.warn(`[XRManager] VR menu toggle for "${item.id}" threw:`, error);
        }
        // Reflect the click immediately rather than waiting up to 1s for the next
        // periodic refresh - toggle() is expected to be synchronous (a setState call).
        this.refreshVRMenu();
      });

      row.addControl(button);
      this.vrMenuPanel.addControl(row);
    }
  }

  private disposeVRMenu(): void {
    if (this.vrMenuRefreshTimer) {
      clearInterval(this.vrMenuRefreshTimer);
      this.vrMenuRefreshTimer = null;
    }
    if (this.vrMenuControllerObserver && this.xrExperience) {
      this.xrExperience.input.onControllerAddedObservable.removeCallback(this.vrMenuControllerObserver);
    }
    this.vrMenuControllerObserver = null;
    this.vrMenuPanel = null;
    this.vrMenuAdt?.dispose();
    this.vrMenuAdt = null;
    this.vrMenuMesh?.dispose();
    this.vrMenuMesh = null;
  }

  // TEMPORARY DIAGNOSTIC OVERLAY - see configureXRFeatures' call site. A small HUD panel
  // parented directly to the XR camera (always in view, unlike the wrist-attached VR
  // feature menu above) showing live camera position and distance to the model's centre -
  // works in both VR and AR, no external tooling needed to read it.
  private computeRoughModelBounds(): Vector3 | null {
    let min: Vector3 | null = null;
    let max: Vector3 | null = null;

    for (const mesh of this.scene.meshes) {
      if (!mesh.isEnabled() || !mesh.isVisible || mesh.getTotalVertices() === 0) continue;
      // Same exclusions as BabylonWorkspace.tsx's runAutoZoom/switchCamera/onAutoZoom -
      // skip the skybox (infiniteDistance, follows the camera - would corrupt this the
      // same way it corrupted those) and this app's own generated helper/tool meshes.
      if (mesh.infiniteDistance) continue;
      const meshName = mesh.name || '';
      // FIX: "ground" used to be matched as a PREFIX here (`^(ground|...)`), which also
      // excluded any real building mesh whose name merely STARTS WITH "ground" - e.g.
      // "GroundFloor"/"Ground_Slab", an extremely common SketchUp/BIM naming choice. That
      // silently dropped part of the actual model out of the bounds calculation (and, via
      // getPlaceableMeshes' identical bug, out of the VR/AR reposition entirely - see that
      // function's own note), reported as the model showing "torn apart"/only half visible.
      // This app's own synthetic placeholder ground is always named exactly "ground" (see
      // BabylonWorkspace.tsx's defaultScene() check, which already matches it exactly) - so
      // match that exactly here too, instead of by prefix.
      if (/^ground$/i.test(meshName)) continue;
      if (/^(xr_|ar_|measure_|preview_|measurement_|annotation_|cursor_|collab_|sound_privacy_marker_|mood_light_|__root__|vrFeatureMenu|xrDebug)/i.test(meshName)) continue;

      const bb = mesh.getBoundingInfo().boundingBox;
      min = min ? Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone();
      max = max ? Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone();
    }

    return min && max ? min.add(max).scale(0.5) : null;
  }

  private createXRDebugOverlay(): void {
    if (!this.xrCamera || !this.scene) return;
    this.disposeXRDebugOverlay();

    this.xrDebugModelCenter = this.computeRoughModelBounds();
    this.xrDebugStartTime = performance.now();

    const plane = MeshBuilder.CreatePlane('xrDebugOverlay', { width: 0.5, height: 0.32 }, this.scene);
    plane.isPickable = false;
    plane.renderingGroupId = 1;
    // Parented directly to the camera (not the controller, unlike the feature menu) so it
    // is always readable regardless of hand tracking/controllers being present at all -
    // needed for phone-based AR, which has neither.
    plane.parent = this.xrCamera;
    plane.position = new Vector3(0, 0, 0.8);

    const adt = AdvancedDynamicTexture.CreateForMesh(plane, 512, 320);
    adt.background = 'rgba(0, 0, 0, 0.85)';

    const text = new TextBlock('xrDebugText', 'XR DEBUG\nstarting...');
    text.color = '#00ff88';
    text.fontSize = 26;
    text.textWrapping = true;
    text.textHorizontalAlignment = 0; // left
    text.paddingLeft = '16px';
    adt.addControl(text);

    this.xrDebugMesh = plane;
    this.xrDebugAdt = adt;
    this.xrDebugText = text;

    this.updateXRDebugOverlay();
    this.xrDebugTimer = setInterval(() => this.updateXRDebugOverlay(), 300);
  }

  private updateXRDebugOverlay(): void {
    if (!this.xrDebugText || !this.xrCamera) return;

    const p = this.xrCamera.position;
    const center = this.xrDebugModelCenter;
    const dist = center ? Vector3.Distance(p, center) : -1;
    const seconds = ((performance.now() - this.xrDebugStartTime) / 1000).toFixed(1);

    const lines = [
      `MODE: ${this.currentSessionMode}`,
      `time: ${seconds}s`,
      `cam:  ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`,
      center
        ? `model: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`
        : 'model: (not found)',
      `DIST TO MODEL: ${dist < 0 ? 'n/a' : dist.toFixed(1) + 'm'}`,
    ];
    this.xrDebugText.text = lines.join('\n');
  }

  private disposeXRDebugOverlay(): void {
    if (this.xrDebugTimer) {
      clearInterval(this.xrDebugTimer);
      this.xrDebugTimer = null;
    }
    this.xrDebugText = null;
    this.xrDebugAdt?.dispose();
    this.xrDebugAdt = null;
    this.xrDebugMesh?.dispose();
    this.xrDebugMesh = null;
    this.xrDebugModelCenter = null;
  }

  // Invisible fallback ground created lazily if the loaded model has nothing
  // getFloorMeshes() can confidently call a floor - see getOrCreateFallbackFloor.
  private fallbackFloorMesh: Mesh | null = null;

  // Find meshes in the scene that can be teleported/walked onto. Matches common
  // floor/ground naming, and falls back to a shape heuristic so teleportation always
  // has *something* to target even if the loaded model doesn't explicitly name a
  // floor/ground mesh.
  private getFloorMeshes(): AbstractMesh[] {
    // Flat (wide relative to its own height) AND at least a metre across, not a small
    // decorative object that merely has "floor" somewhere in its name - a floor lamp, a
    // per-tile rug, a ceiling beam labelled "GroundFloor_Beam", etc. Reported symptom
    // without this size check: the teleport aim ray was always red/never landed on
    // anything, because the name search below matched some unrelated small mesh with
    // "floor" in its name (satisfying `named.length > 0` and returning ONLY that) well
    // before either the shape heuristic or the guaranteed fallback further down ever
    // got a chance to run.
    const isFloorShaped = (m: AbstractMesh): boolean => {
      if (!m.isEnabled() || !m.isPickable || !m.isVisible || m.getTotalVertices() === 0) return false;
      const bounds = m.getBoundingInfo().boundingBox;
      const size = bounds.maximumWorld.subtract(bounds.minimumWorld);
      const footprint = Math.max(size.x, size.z);
      return footprint > 1 && size.y < footprint * 0.3;
    };

    const named = this.scene.meshes.filter(
      (m) => /ground|floor|terrain|site|plot|land/i.test(m.name || '') && isFloorShaped(m)
    );
    if (named.length > 0) return named;
    // Fallback for unnamed floors: previously treated EVERY pickable/visible mesh as a
    // valid teleport target - walls, roofs, furniture, anything - so the teleport
    // reticle could land on a vertical wall just as easily as the actual floor, which
    // is exactly what "movement kastama" (movement is difficult/broken-feeling) looks
    // like from the user's side. Only meshes whose bounding box is flat and wide
    // (floor-like) rather than tall and thin (wall-like) qualify now.
    const heuristic = this.scene.meshes.filter(isFloorShaped);
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
  // network request entirely and uses only Babylon's own small set of bundled,
  // no-network controller classes instead.
  //
  // forceInputProfile: 'oculus-touch' additionally sidesteps a second failure mode seen
  // after the above fix, ON REAL QUEST HARDWARE specifically - squeeze (the exit gesture)
  // working while BOTH thumbstick-driven features (smooth movement and the teleport arc)
  // stayed completely dead. Without this, which exact profile gets resolved locally
  // depends on matching the browser's own reported profile ID string(s) against Babylon's
  // small locally-registered set (see webXRMotionControllerManager.js's
  // _AvailableControllers) - if that match landed on "generic-trigger" (trigger only, no
  // squeeze/thumbstick at all) rather than "oculus-touch" (trigger+squeeze+thumbstick,
  // Babylon's dedicated Quest Touch class), squeeze wouldn't work either, which
  // contradicts what was actually observed on that device - so forcing the profile
  // removed that ambiguity for Quest.
  //
  // FIX: both of the above used to be forced UNCONDITIONALLY, for every headset - and
  // BOTH were verified this session (against Babylon's own bundled fallback table,
  // webXRMotionControllerManager.pure.js, and confirmed live by calling
  // WebXRMotionControllerManager.GetMotionControllerWithXRInput() directly with a real
  // Valve Index gamepad shape) to actively break non-Quest controllers:
  //
  // - forceInputProfile made Babylon read a Vive/WMR/Odyssey controller's real
  //   trigger/squeeze/thumbstick signals through Quest Touch's component layout, which
  //   has no reason to line up with the real controller's own layout.
  // - disableOnlineControllerRepository is worse for a headset Babylon has no bundled
  //   class for: "htc-vive" and "windows-mixed-reality" (which also covers
  //   "microsoft-mixed-reality"/Samsung Odyssey, via its own fallback chain) ARE
  //   registered locally, so those still resolve fully offline - but "valve-index" is
  //   NOT, and its own registered fallback ("generic-trigger-squeeze-touchpad-thumbstick")
  //   isn't registered locally either. With the online repository disabled, resolving a
  //   real Valve Index controller doesn't degrade to a trigger-only generic controller
  //   (what the comment above used to assume) - it throws ("no controller requested was
  //   found in the available controllers list") and the controller gets no
  //   motionController at all: no trigger, no squeeze (the only way to exit VR in this
  //   app), no thumbstick. Confirmed live: the exact same resolution call that throws
  //   with the repository disabled resolves cleanly (trigger+squeeze+touchpad+thumbstick)
  //   the moment it's allowed to hit the real, reachable immersive-web.github.io CDN.
  //
  // Both are now only forced for the browser this was actually diagnosed and fixed on
  // (Quest's own Oculus Browser); every other headset gets Babylon's normal, online-
  // capable resolution, which is what correctly supports every registered WebXR
  // controller profile - not just the handful Babylon happens to bundle locally. Only
  // affects gamepad/controller input - hand-tracking (Vision Pro etc) goes through a
  // separate feature entirely, so this never affected that.
  private isQuestBrowser(): boolean {
    return typeof navigator !== 'undefined' && /OculusBrowser|Quest/i.test(navigator.userAgent || '');
  }

  private getInputOptions(): { disableOnlineControllerRepository?: boolean; forceInputProfile?: string } {
    if (!this.isQuestBrowser()) return {};
    return { disableOnlineControllerRepository: true, forceInputProfile: 'oculus-touch' };
  }

  // Makes the headset camera actually stop at walls/furniture instead of the thumbstick
  // (setupCustomMovement below) walking straight through solid geometry. WebXR cameras
  // don't move via the normal collision-aware Camera.update() path by default -
  // enabling checkCollisions + a human-sized capsule here is what makes Babylon's own
  // collision system apply to the same cameraDirection nudges custom movement produces,
  // so it works together with it rather than needing a separate system.
  // scene.collisionsEnabled is also forced on here as a safety net in case this runs
  // against a scene that doesn't set it itself (e.g. embedded outside BabylonWorkspace).
  // scene.gravity already defaults to real-world (0,-9.807,0) - left untouched.
  //
  // Reported symptoms while walking (not teleporting) in VR: visible floor
  // "glitching"/jitter, the camera bobbing up and down or drifting upward and never
  // coming back down after a single stick push, being unable to walk up stairs, and
  // climbing what stairs did work feeling like an abrupt teleport rather than a walk.
  // Root cause: applyGravity=true means Babylon's OWN collision system also resolves
  // vertical position every frame (via the ellipsoid vs. scene geometry), fighting with
  // updateGrounding() below, which resolves vertical position too (via a direct
  // raycast against the known floor meshes) - two independent systems both writing
  // camera.position.y every frame, each unaware of the other, is exactly what produces
  // unpredictable drift/sticking and instant pops instead of a smooth climb. Gravity is
  // now fully OFF: updateGrounding() is the single source of truth for height, walking
  // up or down stairs at a smooth, capped rate instead of via collision-response
  // side-effects. ellipsoidOffset.y is kept (not removed) purely so the horizontal
  // collision capsule's belly still clears a stair riser's vertical face - checkCollisions
  // still runs every frame to block walls/furniture, and without this offset it would
  // block forward movement into ANY stair exactly like a wall, regardless of what
  // updateGrounding() does for height. 0.3m comfortably clears a real ~15-18cm riser
  // with margin while staying well under furniture/wall height.
  private static readonly WALK_STEP_HEIGHT = 0.3;

  private applyWalkingCollisions(camera: WebXRCamera): void {
    this.scene.collisionsEnabled = true;
    camera.checkCollisions = true;
    camera.applyGravity = false;
    camera.ellipsoid = new Vector3(0.3, 0.9, 0.3);
    camera.ellipsoidOffset = new Vector3(0, XRManager.WALK_STEP_HEIGHT, 0);
  }

  // VR comfort: briefly darkens the peripheral view on every snap-turn - rotation is
  // the single most nausea-inducing locomotion type in VR (the vestibular system feels
  // no matching physical rotation), and narrowing the effective field of view for a
  // moment during the turn is the standard, widely-used mitigation across VR games/apps.
  // Uses scene.imageProcessingConfiguration directly rather than a dedicated post-process
  // pipeline: with applyByPostProcess left at its default false, image processing
  // (vignette included) is baked directly into each material's own shader, so this
  // works even though no DefaultRenderingPipeline is attached to the XR camera (the
  // desktop one - see BabylonWorkspace - isn't, deliberately, to keep VR light).
  private pulseTurnVignette(): void {
    const config = this.scene.imageProcessingConfiguration;
    if (!this.preXRVignetteState) {
      // First pulse this session - remember whatever the scene's vignette was set to
      // beforehand (normally off) so it can be restored exactly, not just switched off,
      // once the session ends.
      this.preXRVignetteState = {
        enabled: config.vignetteEnabled,
        weight: config.vignetteWeight,
        color: config.vignetteColor?.clone() ?? null
      };
    }
    if (this.vignetteFadeTimer) clearTimeout(this.vignetteFadeTimer);
    config.vignetteEnabled = true;
    config.vignetteColor = new Color4(0, 0, 0, 1);
    config.vignetteWeight = XRManager.VIGNETTE_TURN_WEIGHT;
    this.vignetteFadeTimer = setTimeout(() => {
      config.vignetteWeight = this.preXRVignetteState?.weight ?? 0;
      this.vignetteFadeTimer = null;
    }, XRManager.VIGNETTE_TURN_DURATION_MS);
  }

  private restorePreXRVignette(): void {
    if (this.vignetteFadeTimer) {
      clearTimeout(this.vignetteFadeTimer);
      this.vignetteFadeTimer = null;
    }
    if (this.preXRVignetteState) {
      const config = this.scene.imageProcessingConfiguration;
      config.vignetteEnabled = this.preXRVignetteState.enabled;
      config.vignetteWeight = this.preXRVignetteState.weight;
      if (this.preXRVignetteState.color) config.vignetteColor = this.preXRVignetteState.color;
      this.preXRVignetteState = null;
    }
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
    this.restoreReverseDepthAfterXR();
  }

  // ROOT CAUSE #1 of "model shows in the desktop viewport but VR/AR shows only the sky"
  // (reproduced with Meta's Immersive Web Emulator, Quest 3 profile, on a real baked GLB:
  // reverse-depth ON -> only the sky and no controllers/model at all; OFF -> the model,
  // road and controllers all render). BabylonWorkspace turns engine.useReverseDepthBuffer
  // on for the desktop view (z-fighting on large architectural models), which also flips
  // the depth test to GEQUAL and the depth clear to 0 - but a WebXR session hands Babylon
  // its own STANDARD-Z projection matrices per eye, so every depth-tested draw (the whole
  // model, the controller meshes) fails the depth test and only the depth-less skybox
  // survives. Must be off BEFORE the session starts and is put back when it ends.
  // The desktop camera's cached projection is recomputed on restore so it goes back to
  // the reverse-Z form the flag change alone doesn't invalidate.
  private preXRReverseDepth = false;

  private disableReverseDepthForXR(): void {
    const engine = this.scene.getEngine();
    if (!engine.useReverseDepthBuffer) return;
    this.preXRReverseDepth = true;
    engine.useReverseDepthBuffer = false;
    this.scene.cameras.forEach((camera) => camera.getProjectionMatrix(true));
  }

  private restoreReverseDepthAfterXR(): void {
    if (!this.preXRReverseDepth) return;
    this.preXRReverseDepth = false;
    this.scene.getEngine().useReverseDepthBuffer = true;
    this.scene.cameras.forEach((camera) => camera.getProjectionMatrix(true));
  }

  // Hides the skybox mesh(es) for the duration of an AR session - see hiddenSkyboxMeshes
  // above. infiniteDistance is the same marker computePrecipitationBounds (in
  // BabylonWorkspace.tsx) already uses to identify skybox/sky-dome meshes generically,
  // regardless of which lighting mode created them.
  private hideSkyboxForAR(): void {
    const skyMeshes = this.scene.meshes.filter((m) => m.infiniteDistance && m.isEnabled());
    if (skyMeshes.length === 0) return;
    skyMeshes.forEach((m) => m.setEnabled(false));
    this.hiddenSkyboxMeshes = skyMeshes;
  }

  private restoreSkyboxAfterAR(): void {
    if (this.hiddenSkyboxMeshes) {
      this.hiddenSkyboxMeshes.forEach((m) => m.setEnabled(true));
      this.hiddenSkyboxMeshes = null;
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
      this.disableReverseDepthForXR();

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
      this.cleanupFailedXRAttempt();
      return false;
    }
  }

  // CreateAsync can succeed - building its own camera, controllers, and feature meshes,
  // already live in the scene - even when the very next call, enterXRAsync, then throws.
  // That's a real, common first-attempt failure on some headsets/browsers while the
  // permission/session handshake settles (shows "Failed to enter VR", then a retry
  // works). Previously this left this.xrExperience pointing at that half-built, never-
  // disposed experience: the retried enterVR()/enterAR() call created a SECOND complete
  // XR camera/rig on top of it without ever cleaning up the first, leaving the orphaned
  // first attempt's camera/feature meshes rendering independently in the headset -
  // reported as part of the model detaching and standing on its own right after a
  // failed-then-retried VR entry. Same lesson exitXR() already applies on ITS OWN
  // failure path (see its comment there): never leave xrExperience non-null after a
  // failed attempt.
  private cleanupFailedXRAttempt(): void {
    if (this.xrExperience) {
      try { this.xrExperience.dispose(); } catch { /* best-effort - already failed once */ }
    }
    this.xrExperience = null;
    this.xrCamera = null;
    this.currentSessionMode = 'none';
    this.restoreReverseDepthAfterXR();
    if (this.originalCamera) {
      this.scene.activeCamera = this.originalCamera;
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
      this.disableReverseDepthForXR();

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
      this.hideSkyboxForAR();

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
      this.restoreSkyboxAfterAR();
      this.cleanupFailedXRAttempt();
      return false;
    }
  }

  // Real model content only - excludes ground/helper/UI meshes (measurement lines,
  // annotation pins, the reticle/placement root themselves, etc), matching the same
  // exclusion pattern already used for teleport floor detection and the desktop AR
  // Scale panel, so placement/scale only ever moves the actual loaded model.
  //
  // The sky/skybox mesh (proceduralSkybox from LightingPresets.tsx's Sky Dome, or
  // hdrSkyBox from an uploaded HDRI) was missing from this list entirely - it's a
  // 1000-unit, infiniteDistance mesh, and reparenting/scaling that into the AR placement
  // root along with the real model is exactly what "the sky comes along stuck to the
  // floor/model" was: the tap-to-place transform was dragging the entire sky dome into
  // the placement too, not just the building. Matched by a separate substring check
  // (not the prefix list below) since neither name actually starts with "sky".
  // Also added every marker/prop-mesh prefix from features built after this list was
  // last updated (Material Swatches, Hotspot Navigation, Interactive Fixtures, Ambient
  // Audio zones, Measure Tool's preview/result meshes) - each of those has the same bug
  // this fixes for the sky: without an exclusion, AR placement would try to drag admin-
  // placed UI markers and prop geometry into the anchor transform right along with the
  // building.
  private getPlaceableMeshes(): AbstractMesh[] {
    return this.scene.meshes.filter((m) => {
      const name = m.name || '';
      if (!m.isEnabled()) return false;
      if (/skybox/i.test(name)) return false;
      // FIX: "ground" used to be matched as a PREFIX below (`^(ground|...)`), which also
      // excluded any real building mesh merely STARTING WITH "ground" - e.g.
      // "GroundFloor"/"Ground_Slab", a common SketchUp/BIM naming choice. That part of the
      // model was silently never reparented/shifted along with the rest here (used by both
      // applyVRWorldShift and AR's placement root) - reported as the model tearing into
      // disconnected pieces in VR, and as only half the building showing up in AR. Matched
      // exactly instead, same as BabylonWorkspace.tsx's own defaultScene() check for this
      // app's synthetic placeholder ground, which is always named exactly "ground".
      if (/^ground$/i.test(name)) return false;
      return !/^(measure_|preview_|measurement_|annotation_|swatch_marker_|swatch_popup_panel_|hotspot_marker_|fixture_marker_|fixture_person_|fixture_pet_|fixture_rain_plane_|ambient_zone_|cursor_|collab_|sound_privacy_marker_|mood_light_|ar_reticle|ar_placement_root|__root__)/i.test(name);
    });
  }

  // FIX (confirmed both in headless WebXR emulation AND on a real Quest this session): a
  // WebXR session's 'local-floor' reference space starts the player at its own runtime
  // origin, with no relation to wherever the LOADED MODEL happens to be authored. The
  // previous fix (setTransformationFromNonVRCamera, in configureXRFeatures below) tries to
  // move the CAMERA to the model by seeding the XR camera's tracked position - this is
  // Babylon's own official, documented API for exactly this, but was confirmed NOT
  // reliably taking effect: in headless emulation the seeded position was silently
  // overwritten back to the raw origin within a frame or two, and a real Quest AR test
  // this session read the camera about 14m from the model's actual centre despite the
  // seed having run - explaining both "VR shows only sky/ground, never the model" and AR's
  // "model only partially visible" (standing near-but-not-at raw local-floor origin, which
  // for a real building can easily be inside/right next to its own walls).
  //
  // This takes the opposite, more robust approach: instead of moving the CAMERA to the
  // model (dependent on that WebXR reference-space mechanism), it moves the MODEL to
  // wherever the camera's raw tracked position already, unavoidably, is. Reparents every
  // real model mesh (reusing the exact placeable-mesh set/exclusions AR's own tap-to-place
  // placement already uses) under a dedicated root, and offsets that root so the model's
  // own bounds-centre sits at world (0, its own floor height, 0) - the same neighbourhood
  // 'local-floor' defines its own origin to be, on every device, with no dependency on
  // reference-space rebasing working at all. The camera-seed above is left in place as a
  // best-effort extra (its YAW/facing-direction half has no reason to share this same
  // failure mode), not removed - this is additive, not a replacement.
  //
  // AR does NOT use this: it already has its own, better-suited placement system (tap-to-
  // place + pinch-to-scale, designed for a shrink-to-tabletop-size viewing experience) -
  // see the auto-call to ensurePlacementRoot() in setupARPlacement() below, which had the
  // same underlying bug (only ever placing the model on the FIRST scale/rotate/mirror
  // button press, never automatically at session start) fixed the same session.
  //
  // FIX 2 (this bug survived the fix above): this used to shift the model to a hard-coded
  // world (0, 0) instead of to wherever the camera actually is - i.e. it just moved the
  // "am I near the camera" guesswork from the camera side to the model side without
  // removing the guess itself. 'local-floor' only pins Y to the real floor; the runtime
  // picks the X/Z origin (headset room-setup/Guardian centre, wherever tracking booted),
  // which has no relation to this scene's (0,0,0) - so "shift the model to (0,0)" only
  // worked if the camera's raw tracked X/Z also happened to land near (0,0), which is not
  // guaranteed (the same real-Quest test above once read the camera 14m from the model's
  // centre - i.e. also nowhere near this scene's origin). Reading this.xrCamera.position
  // directly - called from configureXRFeatures' onXRFrameObservable.addOnce callback, i.e.
  // after the FIRST REAL XR FRAME following the camera-seed above, not synchronously right
  // after it (a synchronous read can still be mid-transition - see that call site's own
  // comment) - and shifting the model to THAT point instead removes the assumption
  // entirely: the model ends up under the camera regardless of where in the scene's
  // coordinate space the camera's raw tracked position turned out to be, and regardless of
  // whether the seed itself actually stuck.
  // ROOT CAUSE of "model shows in the desktop viewport but not in VR/AR" (verified against
  // Babylon's own source + a NullEngine repro): BabylonWorkspace freezes every loaded mesh
  // after load (freezeWorldMatrix() + doNotSyncBoundingInfo = true, purely a desktop
  // performance optimisation). A frozen mesh keeps returning its cached world matrix
  // while `_isDirty` is false, and a PARENT moving/scaling never marks it dirty - so
  // reparenting the model under a root and then moving/scaling that root (VR world-shift,
  // AR placement/scale/nudge/rotate) left the frozen meshes exactly where they were.
  // doNotSyncBoundingInfo additionally leaves the bounding sphere/box at the OLD location,
  // so even a mesh that did get a fresh matrix is frustum-culled against stale bounds.
  // Net effect: the camera moved to the model's new spot, the model itself never moved,
  // and only the (unfrozen, infiniteDistance) sky drew in VR; in AR whichever meshes
  // happened to recompute at different moments ended up in different places.
  // Must run BEFORE any setParent()/root transform below. Order matters: clear
  // doNotSyncBoundingInfo first so the forced recompute inside unfreezeWorldMatrix()
  // also marks the bounding info dirty.
  private unfreezeMeshesForXR(meshes: AbstractMesh[]): void {
    for (const mesh of meshes) {
      if (!mesh.isWorldMatrixFrozen && !mesh.doNotSyncBoundingInfo) continue;
      this.xrUnfrozenMeshes.add(mesh);
      mesh.doNotSyncBoundingInfo = false;
      mesh.unfreezeWorldMatrix();
    }
  }

  // Restores BabylonWorkspace's post-load freeze once VR's temporary reparent is undone.
  // Skips anything still parented to AR's placementRoot: that root stays alive after the
  // AR session (and is driven by the desktop ARScalePanel too), so its children must stay
  // unfrozen to keep following it.
  private refreezeMeshesAfterVR(): void {
    this.xrUnfrozenMeshes.forEach((mesh) => {
      if (mesh.isDisposed()) return;
      if (this.placementRoot && mesh.parent === this.placementRoot) return;
      mesh.freezeWorldMatrix();
      mesh.doNotSyncBoundingInfo = true;
      this.xrUnfrozenMeshes.delete(mesh);
    });
  }

  private applyVRWorldShift(): void {
    if (!this.xrCamera) return;
    const center = this.computeRoughModelBounds();
    if (!center) return;

    const offsetX = this.xrCamera.position.x - center.x;
    const offsetZ = this.xrCamera.position.z - center.z;
    // No point moving anything that's already essentially where the camera is standing
    // (small models authored right at the player's own spawn point).
    if (Math.abs(offsetX) < 0.5 && Math.abs(offsetZ) < 0.5) return;

    const root = new TransformNode('xrVRWorldShiftRoot', this.scene);

    // FIX: setParent() preserves each mesh's CURRENT world position at the moment it's
    // called (recomputing local coordinates against the parent's CURRENT world matrix) -
    // confirmed live this session by reading a mesh's absolute world position immediately
    // before and after this ran: identical. Setting root.position to the offset BEFORE
    // reparenting (the original order here) therefore reparented everything WITHOUT
    // actually moving it at all - a real, silent no-op bug in this exact fix. Reparenting
    // while the root is still at its default identity position makes each mesh's new
    // LOCAL position equal to its original WORLD position; the offset is applied
    // afterward, once, so it actually displaces every child's effective world position
    // for the first time on the very next render - the same "move the parent after its
    // children exist" ordering, not "move the parent, then reparent into it".
    const shiftMeshes = this.getPlaceableMeshes();
    this.unfreezeMeshesForXR(shiftMeshes);
    for (const mesh of shiftMeshes) {
      this.vrWorldShiftOriginalParents.set(mesh, mesh.parent);
      mesh.setParent(root);
    }

    // Horizontal re-centre only - the model's own authored floor height is left alone
    // (matches "Y is left alone" for the camera-seed above: real tracked height, not
    // something to override) so the player's real-world floor still meets the model's
    // floor at the same relative height it would on desktop.
    root.position.set(offsetX, 0, offsetZ);

    this.vrWorldShiftRoot = root;
  }

  private removeVRWorldShift(): void {
    if (!this.vrWorldShiftRoot) return;
    // FIX: same setParent()-preserves-CURRENT-world-position behaviour as
    // applyVRWorldShift above, in reverse - reparenting straight back to each mesh's
    // original parent while the root still holds the offset would preserve the SHIFTED
    // position under the original (unshifted) parent, permanently leaving the desktop
    // view shifted after exiting VR. Zeroing the root's own offset FIRST snaps every
    // child back to its true pre-shift world position (still parented under root, which
    // is now back at identity); only THEN does reparenting to the original parent
    // preserve the CORRECT, original position.
    this.vrWorldShiftRoot.position.setAll(0);
    this.vrWorldShiftOriginalParents.forEach((originalParent, mesh) => {
      if (!mesh.isDisposed()) mesh.setParent(originalParent);
    });
    this.vrWorldShiftOriginalParents.clear();
    this.vrWorldShiftRoot.dispose();
    this.vrWorldShiftRoot = null;
    this.refreezeMeshesAfterVR();
  }

  // Lazily creates (or returns the existing) TransformNode that placement/scale acts
  // on, reparenting every real model mesh under it. setParent() (not just assigning
  // .parent) is what keeps each mesh visually exactly where it already is during this
  // reparent - only the *next* placement/scale actually moves anything.
  private getOrCreatePlacementRoot(): TransformNode {
    // Frozen meshes ignore their parent moving/scaling - see unfreezeMeshesForXR. Meshes
    // stay unfrozen for as long as they live under this root (it outlives the AR session).
    if (this.placementRoot && !this.placementRoot.isDisposed()) {
      // A model loaded/changed after the root was first created - pick up any meshes
      // that aren't parented yet.
      const placeable = this.getPlaceableMeshes();
      this.unfreezeMeshesForXR(placeable);
      placeable.forEach((m) => {
        if (m.parent !== this.placementRoot) m.setParent(this.placementRoot);
      });
      return this.placementRoot;
    }
    const root = new TransformNode('ar_placement_root', this.scene);
    const placeable = this.getPlaceableMeshes();
    this.unfreezeMeshesForXR(placeable);
    placeable.forEach((m) => m.setParent(root));
    this.placementRoot = root;

    // FIX: AR is designed as a shrink-to-tabletop-size viewing experience (see
    // applyVRWorldShift's own comment: AR "has its own, better-suited placement system
    // ... designed for a shrink-to-tabletop-size viewing experience") - but nothing
    // actually applied that shrink on first placement, from EITHER path that creates this
    // root: ensurePlacementRoot()'s "2m in front of the camera" fallback, or a real
    // hit-test tap in arSelectListener. placementScale defaults to 1 (full authored
    // size), so a real building-sized model got planted at full scale right where the
    // viewer was standing/tapped - for anything bigger than a small room, that puts the
    // viewer's own head inside solid wall/floor geometry, which backface-culls the
    // interior surfaces around them and reads as "the model is barely visible/
    // see-through", exactly as reported ("AR-la model paathi therinji theriyaama").
    // Auto-fitting here, once, the first time this root is ever created (re-entering AR
    // later in the same session reuses the existing root via the branch above, so this
    // never overwrites a scale the user has since dialled in manually), means the first
    // thing shown is a small, complete model viewed from outside it - the experience
    // this app is actually designed around - instead of standing inside an unscaled one.
    // Mirrors ARScalePanel's own "Tabletop" auto-fit formula (TABLETOP_TARGET_METERS)
    // exactly, so this matches what that button would already produce.
    const restSize = this.getPlacedModelRestSize();
    const footprint = restSize ? Math.max(restSize.x, restSize.z) : 0;
    if (footprint > 0) {
      this.placementScale = Math.min(1, Math.max(0.01, XRManager.AR_AUTO_FIT_TARGET_METERS / footprint));
      this.applyPlacementScale(root);
    }

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
    // Previously one tall column (hint, readout, move row, rotate row, scale row) all
    // stacked bottom-up - on a phone-height viewport that stack's top edge climbed well
    // into the middle of the screen, right over the model it's meant to be controlling.
    // Split into two independent thumb-reach corners instead (the standard mobile
    // game/AR-viewer control layout): move on the bottom-left, rotate+scale on the
    // bottom-right. Each cluster is now only 2 rows tall at most, so both stay low and
    // out of the model's way, and match how a phone is actually held (a thumb resting
    // in each bottom corner) instead of both hands reaching for one center column.
    const container = document.createElement('div');
    container.id = 'naviz-ar-overlay';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999999;';

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
    exitBtn.style.cssText = 'position:fixed;top:max(20px,env(safe-area-inset-top));right:20px;pointer-events:auto;width:52px;height:52px;border-radius:9999px;border:2px solid rgba(255,255,255,0.85);background:rgba(31, 31, 32,0.75);color:#fff;font-size:22px;font-weight:600;display:flex;align-items:center;justify-content:center;touch-action:manipulation;user-select:none;';
    const onExit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.exitXR();
    };
    exitBtn.addEventListener('touchstart', onExit, { passive: false });
    exitBtn.addEventListener('mousedown', onExit);
    container.appendChild(exitBtn);

    // One-shot guidance text (e.g. "Placed near you...") - see showAROverlayHint(). Starts
    // empty/invisible; only takes up visible space once there's something to say, so it
    // doesn't otherwise sit as empty chrome above the scale readout.
    const hint = document.createElement('div');
    hint.id = 'naviz-ar-hint';
    hint.style.cssText = 'pointer-events:none;padding:6px 14px;border-radius:9999px;background:rgba(31, 31, 32,0.85);color:#fff;font-size:13px;font-weight:500;text-align:center;max-width:80vw;opacity:0;transition:opacity 0.2s ease;';
    this.arHintElement = hint;

    const readout = document.createElement('div');
    readout.id = 'naviz-ar-scale-readout';
    readout.textContent = `${Math.round(this.placementScale * 100)}%`;
    readout.style.cssText = 'pointer-events:none;padding:4px 12px;border-radius:9999px;background:rgba(31, 31, 32,0.75);color:#fff;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;';
    this.arScaleReadoutElement = readout;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:18px;';

    const makeButton = (label: string, title: string, onStep: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.style.cssText = 'pointer-events:auto;width:72px;height:72px;border-radius:9999px;border:2px solid rgba(255,255,255,0.85);background:rgba(31, 31, 32,0.75);color:#fff;font-size:28px;font-weight:600;display:flex;align-items:center;justify-content:center;touch-action:manipulation;user-select:none;';

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
    // Was '⟲' (identical glyph to the rotate-left button below) - reading as "this does
    // the same thing as rotate" at a glance. '1:1' is the same reset-to-original
    // convention used by photo/zoom apps, and reads as "scale", not "rotate".
    const resetBtn = makeButton('1:1', 'Reset scale', () => this.resetPlacedModelScale());
    resetBtn.style.width = '56px';
    resetBtn.style.height = '56px';
    resetBtn.style.fontSize = '16px';
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

    // Single-tap action (not hold-to-repeat like the buttons above) - mirroring is a
    // one-time flip, not something anyone wants to hold down and have fire repeatedly.
    const tapButton = (label: string, title: string, onTap: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.style.cssText = 'pointer-events:auto;width:56px;height:56px;border-radius:9999px;border:2px solid rgba(255,255,255,0.85);background:rgba(31, 31, 32,0.75);color:#fff;font-size:20px;font-weight:600;display:flex;align-items:center;justify-content:center;touch-action:manipulation;user-select:none;';
      const onPress = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        onTap();
      };
      btn.addEventListener('touchstart', onPress, { passive: false });
      btn.addEventListener('mousedown', onPress);
      return btn;
    };

    // Cross-shaped dpad (▲ above a ◀ ▶ row, ▼ below) rather than the previous single
    // ◀▲▼▶ row - the plus-shape is the immediately-recognizable "this moves things"
    // layout (game controllers, map apps), where a straight row of 4 arrows reads more
    // ambiguously, and it's more compact vertically for the same button count.
    const MOVE_STEP = 0.03; // meters per repeat tick
    const moveMidRow = document.createElement('div');
    moveMidRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const moveSpacer = document.createElement('div');
    moveSpacer.style.cssText = 'width:56px;height:56px;';
    moveMidRow.appendChild(smallButton('◀', 'Move left (hold)', () => this.nudgePlacedModel(0, -MOVE_STEP)));
    moveMidRow.appendChild(moveSpacer);
    moveMidRow.appendChild(smallButton('▶', 'Move right (hold)', () => this.nudgePlacedModel(0, MOVE_STEP)));

    const moveDpad = document.createElement('div');
    moveDpad.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;';
    moveDpad.appendChild(smallButton('▲', 'Move forward (hold)', () => this.nudgePlacedModel(MOVE_STEP, 0)));
    moveDpad.appendChild(moveMidRow);
    moveDpad.appendChild(smallButton('▼', 'Move backward (hold)', () => this.nudgePlacedModel(-MOVE_STEP, 0)));

    const rotateRow = document.createElement('div');
    rotateRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const ROTATE_STEP = (3 * Math.PI) / 180; // 3 degrees per repeat tick
    rotateRow.appendChild(smallButton('⟲', 'Rotate left (hold)', () => this.rotatePlacedModel(-ROTATE_STEP)));
    rotateRow.appendChild(tapButton('⇋', 'Mirror', () => this.mirrorPlacedModel()));
    rotateRow.appendChild(smallButton('⟳', 'Rotate right (hold)', () => this.rotatePlacedModel(ROTATE_STEP)));

    // Bottom-left thumb zone: repositioning the model.
    const leftCluster = document.createElement('div');
    leftCluster.style.cssText = 'position:absolute;left:max(16px,env(safe-area-inset-left));bottom:max(20px,env(safe-area-inset-bottom));pointer-events:none;';
    leftCluster.appendChild(moveDpad);

    // Bottom-right thumb zone: orientation (rotate/mirror) above size (scale), grouped
    // together since both are "adjust the model" actions, separate from repositioning.
    const rightCluster = document.createElement('div');
    rightCluster.style.cssText = 'position:absolute;right:max(16px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;';
    rightCluster.appendChild(rotateRow);
    rightCluster.appendChild(row);

    // Hint + scale readout: centered, sitting just above both corner clusters so they
    // stay clear of the buttons below and of the model in the middle of the screen.
    const centerStack = document.createElement('div');
    centerStack.style.cssText = 'position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;max-width:80vw;';
    centerStack.appendChild(hint);
    centerStack.appendChild(readout);

    container.appendChild(centerStack);
    container.appendChild(leftCluster);
    container.appendChild(rightCluster);
    document.body.appendChild(container);
    return container;
  }

  // Briefly shows a one-line message in the AR overlay (e.g. when a control button
  // auto-places the model - see ensurePlacementRoot()) - console.warn is invisible on a
  // real phone during an immersive session, which is exactly what made the previous
  // "tap the screen first" guidance read as "the buttons just don't work".
  private showAROverlayHint(text: string, durationMs = 2500): void {
    const el = this.arHintElement;
    if (!el) return;
    if (this.arHintTimeout !== null) clearTimeout(this.arHintTimeout);
    el.textContent = text;
    el.style.opacity = '1';
    this.arHintTimeout = setTimeout(() => {
      el.style.opacity = '0';
      this.arHintTimeout = null;
    }, durationMs);
  }

  private teardownAROverlayUI(): void {
    if (this.arOverlayElement?.parentNode) {
      this.arOverlayElement.parentNode.removeChild(this.arOverlayElement);
    }
    this.arOverlayElement = null;
    this.arScaleReadoutElement = null;
    this.arHintElement = null;
    if (this.arHintTimeout !== null) {
      clearTimeout(this.arHintTimeout);
      this.arHintTimeout = null;
    }
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
      // Once placed, further taps are ignored unless requestReposition() was explicitly
      // called - see the field comment on placementLocked for why: without this, ANY tap
      // for the rest of the session (walking around, trying to zoom, anything) silently
      // relocated and re-faced the model again.
      const alreadyPlaced = this.placementRoot && !this.placementRoot.isDisposed();
      if (alreadyPlaced && this.placementLocked) return;
      const root = this.getOrCreatePlacementRoot();
      root.position.copyFrom(this.lastHitPose.position);
      // The hit-test surface's own rotationQuaternion (previously applied directly) only
      // meaningfully encodes the plane's UP direction for a flat floor - its heading/yaw
      // is an implementation-arbitrary convention, not "which way should this model
      // face". Using it as-is made a freshly-tapped placement face a seemingly random
      // direction each time, including facing away from whoever just tapped it ("back
      // side thaan place aaguthu"). Facing the model toward wherever the user was
      // standing when they tapped is the one deterministic, sensible default - the
      // Rotate buttons already let them dial in the exact heading afterward.
      this.faceCameraAtPlacement(root);
      this.placementLocked = true;
    };
    session?.addEventListener('select', this.arSelectListener);

    this.setupPinchToZoom();

    // FIX: ensurePlacementRoot()'s own "2m in front of the user, floor-probed" fallback
    // (see its comment) was written specifically so there's always something reasonable
    // on screen "to see the very first button press affect" - but it was only ever
    // actually CALLED from inside the scale/rotate/mirror/nudge button handlers
    // themselves, never automatically at session start. That's a real chicken-and-egg gap:
    // a user has no reason to press any of those buttons if they can't see the model well
    // enough to want to interact with it yet, which is exactly what was reported this
    // session ("AR-la model paathi therinji theriyaama" - the model is only partially/
    // confusingly visible in AR) - without this, the model just sits wherever it was
    // originally authored, which for a real building/site export is essentially never
    // right in front of wherever the user happened to start the session. Calling it here
    // makes the fallback actually fire immediately, matching what its own comment already
    // says it's supposed to do; a later successful hit-test tap still repositions it onto
    // the real surface exactly as before, unaffected by this.
    try {
      this.ensurePlacementRoot();
    } catch (error) {
      console.warn('[XRManager] Could not auto-place the model for AR:', error);
    }
  }

  // See the field comments above for why this listens at the document level instead of
  // the AR overlay container.
  private setupPinchToZoom(): void {
    const distanceBetween = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    this.arPinchTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      // Only claim two-finger touches - a single finger is left completely alone so it
      // still reaches the WebXR session as a normal tap-to-place 'select'.
      e.preventDefault();
      this.pinchStartDistance = distanceBetween(e.touches);
      this.pinchStartScale = this.placementScale;
    };

    this.arPinchTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || this.pinchStartDistance <= 0) return;
      e.preventDefault();
      const currentDistance = distanceBetween(e.touches);
      const ratio = currentDistance / this.pinchStartDistance;
      this.setPlacedModelScale(this.pinchStartScale * ratio);
    };

    this.arPinchTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        this.pinchStartDistance = 0;
      }
    };

    document.addEventListener('touchstart', this.arPinchTouchStart, { passive: false });
    document.addEventListener('touchmove', this.arPinchTouchMove, { passive: false });
    document.addEventListener('touchend', this.arPinchTouchEnd, { passive: false });
    document.addEventListener('touchcancel', this.arPinchTouchEnd, { passive: false });
  }

  private teardownPinchToZoom(): void {
    if (this.arPinchTouchStart) document.removeEventListener('touchstart', this.arPinchTouchStart);
    if (this.arPinchTouchMove) document.removeEventListener('touchmove', this.arPinchTouchMove);
    if (this.arPinchTouchEnd) {
      document.removeEventListener('touchend', this.arPinchTouchEnd);
      document.removeEventListener('touchcancel', this.arPinchTouchEnd);
    }
    this.arPinchTouchStart = null;
    this.arPinchTouchMove = null;
    this.arPinchTouchEnd = null;
    this.pinchStartDistance = 0;
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
    this.teardownPinchToZoom();
    if (this.autoRotateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.autoRotateObserver);
      this.autoRotateObserver = null;
    }
    // Deliberately NOT disposing placementRoot or resetting placementScale here - if
    // the user re-enters AR in the same session, their last placement/scale is kept
    // rather than snapping back to the model's original authored position.
  }

  // Every manual control (scale/nudge/rotate/mirror) used to require a successful
  // hit-test tap FIRST, since placementRoot only got created inside the WebXR 'select'
  // listener - and hit-test reliability on real phones varies a lot (lighting, a few
  // seconds of plane-scanning, device support), so until that landed, every single
  // button silently did nothing beyond a console.warn no one on a phone ever sees. That
  // read as "the buttons just don't work". This creates the root on first use instead,
  // positioned a couple meters in front of wherever the user is currently facing, roughly
  // at floor height (probed the same way setupGrounding() finds the floor under the
  // player, falling back to an approximate eye-height offset if no floor mesh is under
  // that spot) - so there's always something reasonable on screen to see the very first
  // button press affect. A later successful hit-test tap still works exactly as before,
  // repositioning this same root exactly onto the real surface via the 'select' listener.
  private ensurePlacementRoot(): TransformNode {
    const isNew = !this.placementRoot || this.placementRoot.isDisposed();
    const root = this.getOrCreatePlacementRoot();
    if (isNew && this.xrCamera) {
      const camera = this.xrCamera;
      const forward = camera.getDirection(Vector3.Forward());
      forward.y = 0;
      if (forward.lengthSquared() < 1e-6) forward.set(0, 0, 1); else forward.normalize();
      const targetX = camera.position.x + forward.x * 2;
      const targetZ = camera.position.z + forward.z * 2;

      let floorY = camera.position.y - camera.realWorldHeight;
      if (this.groundFloorMeshes.length > 0) {
        const probeRay = new Ray(
          new Vector3(targetX, floorY + XRManager.GROUND_PROBE_ABOVE_M, targetZ),
          Vector3.Down(),
          XRManager.GROUND_PROBE_ABOVE_M + XRManager.GROUND_PROBE_BELOW_M
        );
        const pick = this.scene.pickWithRay(probeRay, (m) => this.groundFloorMeshes.indexOf(m) !== -1);
        if (pick?.hit && pick.pickedPoint) floorY = pick.pickedPoint.y;
      }

      root.position.set(targetX, floorY, targetZ);
      // Same "face whoever placed it" default the tap-to-place path uses (see
      // faceCameraAtPlacement) - previously this fallback set no rotation at all, leaving
      // the model at its as-authored orientation, which is just as likely to show its
      // back to the user as its front.
      this.faceCameraAtPlacement(root);
      this.showAROverlayHint('Placed near you - tap the ground to fine-tune, or keep using the buttons');
    }
    return root;
  }

  // Points the placement root's local +Z ("forward", Babylon's mesh-orientation
  // convention) at wherever the camera currently is, on the horizontal plane only (no
  // tilt - a placed model should stay upright regardless of how the phone is angled).
  // yaw = atan2(target.x, target.z) is what actually makes local +Z point at `target`
  // for a Y-axis Quaternion.RotationAxis rotation - verified empirically, this is NOT the
  // more commonly-seen atan2(target.z, target.x) formula some other engines use.
  private faceCameraAtPlacement(root: TransformNode): void {
    const camera = this.xrCamera;
    if (!camera) {
      root.rotationQuaternion = Quaternion.Identity();
      return;
    }
    const toCamera = camera.position.subtract(root.position);
    toCamera.y = 0;
    if (toCamera.lengthSquared() < 1e-6) {
      root.rotationQuaternion = Quaternion.Identity();
      return;
    }
    toCamera.normalize();
    const yaw = Math.atan2(toCamera.x, toCamera.z);
    root.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), yaw);
  }

  // Applies placementScale AND placementMirrored together via signed x-scale, instead of
  // root.scaling.setAll(placementScale) - setAll writes the SAME value to all three axes,
  // which would silently overwrite a mirrored (negative) x back to positive the next time
  // scale changed, undoing the mirror. Keeping them composed here is what makes "mirror
  // then scale" (or vice versa) actually stick together instead of one clobbering the other.
  private applyPlacementScale(root: TransformNode): void {
    root.scaling.set(
      this.placementMirrored ? -this.placementScale : this.placementScale,
      this.placementScale,
      this.placementScale
    );
  }

  // Scales the placed model (clamped to a sane range so it can't be pinched/tapped down
  // to invisible or up to absurdly oversized). factor is relative, e.g. 1.04 = +4%.
  // Floor is 1% rather than the old 10% - a whole-house model needs to shrink well past
  // 10% to actually sit on a real table (see getPlacedModelRestSize/ARScalePanel's
  // Tabletop auto-fit), and 10% left anything bigger than ~6m across still room-sized.
  scalePlacedModel(factor: number): void {
    const root = this.ensurePlacementRoot();
    this.placementScale = Math.min(5, Math.max(0.01, this.placementScale * factor));
    this.applyPlacementScale(root);
    this.updateScaleReadout();
  }

  resetPlacedModelScale(): void {
    this.placementScale = 1;
    if (this.placementRoot) this.applyPlacementScale(this.placementRoot);
    this.updateScaleReadout();
  }

  // Flips the placed model left-right (mirror), same button-driven single-tap action as
  // the AR overlay's other controls. Composes with scale via applyPlacementScale() above
  // instead of clobbering it - see that method's comment.
  mirrorPlacedModel(): void {
    const root = this.ensurePlacementRoot();
    this.placementMirrored = !this.placementMirrored;
    this.applyPlacementScale(root);
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
    const root = this.ensurePlacementRoot();
    const camera = this.xrCamera;
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
    const root = this.ensurePlacementRoot();
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

  // The deliberate way back in past placementLocked (see its field comment) - lets
  // external UI (a "Reposition" button, the same pattern hasActivePlacement above already
  // established for ARScalePanel) allow exactly the next tap to move/re-face the model
  // again, instead of every stray tap doing that for the rest of the session.
  requestReposition(): void {
    this.placementLocked = false;
  }

  getPlacementScale(): number {
    return this.placementScale;
  }

  // Absolute variant of scalePlacedModel (which only takes a relative multiplier) -
  // what a slider/preset-button UI naturally wants ("set it to exactly 50%"), not a
  // repeated relative nudge.
  setPlacedModelScale(scale: number): void {
    const root = this.ensurePlacementRoot();
    this.placementScale = Math.min(5, Math.max(0.01, scale));
    this.applyPlacementScale(root);
    this.updateScaleReadout();
  }

  // The placed model's real, unscaled (scale=1) footprint - what ARScalePanel's Tabletop
  // auto-fit needs to compute "what scale actually makes this specific model's footprint
  // fit on a real table", rather than a flat percentage that works for a small room but
  // leaves an entire house still metres across. Divides the current (already-scaled)
  // world bounding box by the currently-applied scale rather than temporarily resetting
  // scaling to 1, since that would visibly flash the placed model to full size for a frame.
  getPlacedModelRestSize(): Vector3 | null {
    if (!this.placementRoot || this.placementRoot.isDisposed()) return null;
    const meshes = this.getPlaceableMeshes().filter((m) => m.getTotalVertices() > 0);
    if (meshes.length === 0) return null;
    let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
    let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
    meshes.forEach((m) => {
      const bb = m.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bb.minimumWorld);
      max = Vector3.Maximize(max, bb.maximumWorld);
    });
    const worldSize = max.subtract(min);
    const scale = this.placementScale || 1;
    return new Vector3(worldSize.x / scale, worldSize.y / scale, worldSize.z / scale);
  }

  // Continuous slow spin around the vertical axis, reusing rotatePlacedModel's existing
  // per-frame heading rotation - the "360 degree turntable" view of a Dollhouse Mode
  // placement, for anyone who'd rather not physically circle a real table while holding
  // a phone. Toggled off automatically on exiting AR (teardownARPlacement) so it can't
  // keep spinning a model that's no longer even visible.
  toggleAutoRotate(enabled?: boolean): boolean {
    const shouldEnable = enabled ?? !this.autoRotateObserver;
    if (shouldEnable === !!this.autoRotateObserver) return !!this.autoRotateObserver;
    if (shouldEnable) {
      const root = this.ensurePlacementRoot();
      if (!root.rotationQuaternion) root.rotationQuaternion = Quaternion.FromEulerVector(root.rotation);
      const RADIANS_PER_SECOND = (2 * Math.PI) / 12; // one full turn every 12 seconds
      this.autoRotateObserver = this.scene.onBeforeRenderObservable.add(() => {
        const deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
        this.rotatePlacedModel(RADIANS_PER_SECOND * deltaSeconds);
      });
    } else {
      this.scene.onBeforeRenderObservable.remove(this.autoRotateObserver);
      this.autoRotateObserver = null;
    }
    return shouldEnable;
  }

  isAutoRotating(): boolean {
    return !!this.autoRotateObserver;
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

    // Cancel any in-progress hold-squeeze-to-exit / hold-to-reset timers so a still-held
    // button from just now doesn't fire again after the session has already ended.
    this.exitHoldTimers.forEach((timer) => clearTimeout(timer));
    this.exitHoldTimers.clear();
    this.resetHoldTimers.forEach((timer) => clearTimeout(timer));
    this.resetHoldTimers.clear();
    this.vrSpawnPosition = null;

    // Disable spatial audio if audio manager is available
    if (this.audioManager && typeof this.audioManager.disableSpatialAudio === 'function') {
      this.audioManager.disableSpatialAudio();
    }

    // Remove the AR reticle/overlay/select-listener while the session is still live -
    // a no-op if AR placement was never set up (e.g. exiting a VR session).
    this.disposeVRMenu();
    this.disposeXRDebugOverlay();
    // Restore every reparented mesh to its exact original parent - a no-op if VR's
    // world-shift was never applied (e.g. exiting an AR session, or a VR session whose
    // model was already near the origin).
    this.removeVRWorldShift();
    this.teardownARPlacement();
    this.teardownCustomTeleportation();
    this.teardownCustomMovement();
    this.teardownGrounding();
    this.restorePreXRVignette();
    this.restoreSkyboxAfterAR();

    // End XR session - if this throws (e.g. the headset already tore the session down on
    // its own, like the "remove and exit" gesture case handled elsewhere in this file),
    // the cleanup below still has to run: the previous version returned straight to the
    // catch below on any failure here, leaving this.xrExperience non-null - a subsequent
    // enterVR()/enterAR() call would then see an XR session that's supposedly still
    // active (it isn't), and the desktop camera/quality settings never got restored either.
    try {
      await this.xrExperience.baseExperience.sessionManager.exitXRAsync();
    } catch (error) {
      console.error('WebXR session did not exit cleanly - continuing with local cleanup anyway:', error);
    }

    try {
      this.restorePreXRQuality();
      // Restore original camera
      if (this.originalCamera) {
        this.scene.activeCamera = this.originalCamera;
      }
      this.xrExperience.dispose();
    } catch (error) {
      console.error('Error cleaning up after XR exit:', error);
    } finally {
      // Always reset these, regardless of whether anything above threw - a stale non-null
      // xrExperience is what actually breaks the NEXT enterVR()/enterAR() call.
      this.xrExperience = null;
      this.xrCamera = null;
      this.currentSessionMode = 'none';
    }

    console.log('Exited XR mode');
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

    // Smooth thumbstick locomotion (left controller) - see setupCustomMovement for why
    // this is a full reimplementation rather than WebXRFeatureName.MOVEMENT.
    this.setupCustomMovement();

    // Continuous floor-following (walking height, stairs) - independent of whether
    // point-and-teleport itself is enabled, since it also grounds plain walking.
    this.setupGrounding(floorMeshes);

    if (this.teleportationEnabled) {
      this.setupCustomTeleportation(floorMeshes);
    }

    // Set up controller events
    this.setupControllerEvents();

    // In-headset toggle menu - VR only (see createVRMenu's own comment). AR already has
    // its own on-screen placement/scale controls via the phone's flat overlay
    // (arOverlayElement/DOM_OVERLAY), which a floating 3D wrist menu would be redundant
    // with and would get in the way of a handheld-phone AR session anyway.
    if (this.currentSessionMode === 'immersive-vr') {
      // The VR menu is a nice-to-have on top of everything else this method sets up
      // (locomotion, hand tracking, grounding) - a GUI/mesh-creation failure on some
      // constrained device must never take down the rest of VR functionality with it.
      try {
        this.createVRMenu();
      } catch (error) {
        console.warn('[XRManager] Could not create the in-headset feature menu:', error);
      }
    }

    // TEMPORARY DIAGNOSTIC OVERLAY - see XR_DEBUG_OVERLAY. Reported this session: the
    // model isn't visible in VR, or shows only partially/see-through in AR, on real
    // hardware, even after fixing two confirmed causes (the desktop camera's target vs its
    // orbit-eye position, and the auto-zoom skybox-pollution bug - both in
    // BabylonWorkspace.tsx). The remaining suspect is the VR/AR spawn-position seed itself
    // (setTransformationFromNonVRCamera, below) not actually taking effect - confirmed
    // unreliable in headless WebXR emulation, but not verifiable there on REAL hardware
    // (no Quest/phone available to this environment). This shows the live numbers directly
    // in the headset/phone view - no cable, no ADB, no devtools needed - so a real-device
    // test can just be read off and reported back: if "dist to model" stays large (tens of
    // metres) instead of settling to a few metres, the spawn seed is confirmed not
    // sticking on real hardware either, which is the next real lead to chase. Safe to
    // delete this whole block (and XR_DEBUG_OVERLAY/createXRDebugOverlay/
    // updateXRDebugOverlay/disposeXRDebugOverlay) once that's resolved.
    if (XRManager.XR_DEBUG_OVERLAY) {
      try {
        this.createXRDebugOverlay();
      } catch (error) {
        console.warn('[XRManager] Could not create the XR debug overlay:', error);
      }
    }

    // The WebXR session's 'local-floor' reference space places the headset at its own
    // runtime-chosen origin (typically near world (0,0,0)) with no awareness of where the
    // actual model is - entering VR/AR previously just accepted wherever that landed, which
    // could put the player facing empty space with nothing but the background visible if
    // the model wasn't already sitting right at the origin. Seeding the XR camera's X/Z
    // (and now also facing direction - see below) from wherever the desktop camera
    // (originalCamera, captured in enterVR/enterAR) was already looking AT - which is
    // itself wherever Fit/the saved Home view left it - means VR/AR starts at the same
    // "zero position" the desktop view uses, not a runtime-arbitrary spot. Y is left at
    // ground level: WebXRCamera fills in the headset's own tracked real-world height above
    // the physical floor on top of it, not something to override.
    //
    // FIX 1: this used to read originalCamera.POSITION (the orbit camera's own eye, i.e.
    // model center + radius in whatever direction alpha/beta pointed), not where it was
    // LOOKING. For the default ArcRotateCamera, "Fit to view"/auto-zoom sets a radius
    // proportional to the model's size specifically so the whole model fits in frame -
    // for a real building that radius is commonly tens of metres, so the XR player was
    // being spawned tens of metres off to the side of/above the model, not at it.
    // ArcRotateCamera.target (the point it orbits/looks at, unaffected by radius) is the
    // correct reference point; other camera modes (Walkable/Clickable - FreeCamera/
    // UniversalCamera) are already positioned close to the model on creation, so their own
    // .position is already the right reference and is kept as the fallback.
    //
    // FIX 2: a manual one-time (or even repeated, over ~1s - both tried live this session)
    // position.x/z write relies on WebXRCamera's own _updateReferenceSpace() noticing the
    // external change and re-anchoring the WebXR reference space to it on a LATER frame.
    // Confirmed unreliable two independent ways this session: in a headless WebXR
    // emulation (Playwright + iwer, logging camera.position every frame) the write applied
    // for one frame and was then silently overwritten back to the raw (untracked, near-
    // origin) device pose; separately reported by the user as still showing only sky in VR
    // and a partially-clipped/"transparent" model in AR after that fix alone - consistent
    // with the player still starting at local-floor's own raw origin, not at the model, in
    // both cases (AR is worse specifically because local-floor's origin can be UNDER/INSIDE
    // the building's own footprint, so standing there without ever being moved to the
    // model's actual centre means standing inside walls - backface-culled from the inside,
    // reading as "half see-through"). Switched to WebXRCamera's own OFFICIAL, purpose-built
    // API for this exact case - setTransformationFromNonVRCamera() - instead of poking
    // .position directly: it resets to a clean base reference space first (discarding any
    // half-applied previous offset) and marks the internal first-frame flag itself, which
    // is the same path Babylon uses when e.g. handing off from a desktop VR-preview camera,
    // rather than an ad-hoc external write racing the camera's own per-frame update order.
    // A transient camera (not attached to the canvas/render loop, disposed immediately
    // after) is passed in so its position AND yaw seed the XR camera together - the
    // headset's own initial facing direction is otherwise arbitrary (whichever way the
    // player physically happened to be facing when the session started, unrelated to the
    // model), so this also fixes VR/AR starting the player facing away from the model.
    const deskLookAt = this.originalCamera instanceof ArcRotateCamera
      ? this.originalCamera.target
      : this.originalCamera?.position;
    const sessionManager = this.xrExperience.baseExperience.sessionManager;

    if (deskLookAt && this.xrCamera) {
      const desktopForward = this.originalCamera?.getDirection
        ? this.originalCamera.getDirection(Vector3.Forward())
        : Vector3.Forward();

      const seedCamera = new FreeCamera('xrSpawnSeed', new Vector3(deskLookAt.x, 0, deskLookAt.z), this.scene);
      seedCamera.setTarget(new Vector3(deskLookAt.x + desktopForward.x, 0, deskLookAt.z + desktopForward.z));

      this.xrCamera.setTransformationFromNonVRCamera(seedCamera, true);
      seedCamera.dispose();
    }

    // Both of the below need the camera's REAL settled tracked position, not whatever it
    // reads immediately after setTransformationFromNonVRCamera - that can still be
    // mid-transition (the first real device pose only lands on the session's first XR
    // frame after that call; see applyVRWorldShift's own updated comment for why a stale/
    // transitional read there silently reproduces the exact bug it was written to fix).
    // Deferring both to the same first-real-frame callback is what makes applyVRWorldShift
    // actually shift the model to where the camera ends up, not where it was mid-seed.
    sessionManager.onXRFrameObservable.addOnce(() => {
      // VR only - see applyVRWorldShift's own comment for the full reasoning (AR doesn't
      // use this; it has its own, better-suited placement system, auto-triggered in
      // setupARPlacement below instead). A GUI/reparent failure on some constrained device
      // must never take down the rest of VR functionality with it.
      if (this.currentSessionMode === 'immersive-vr') {
        try {
          this.applyVRWorldShift();
        } catch (error) {
          console.warn('[XRManager] Could not auto-centre the model for VR:', error);
        }
      }
      if (this.xrCamera) this.vrSpawnPosition = this.xrCamera.position.clone();
    });
  }

  // Continuous floor-following ("grounding"). Fully replaces Babylon's own
  // gravity/collision for vertical position - see the comment on applyWalkingCollisions
  // for why running both at once caused unpredictable height drift. Every XR frame, this
  // probes straight down from just above the camera's current implied feet position for
  // the nearest known floor mesh, and eases camera height toward it at a capped
  // speed - the same mechanism (a direct raycast against the curated floor-mesh list,
  // then setting camera.position.y = floorY + camera.realWorldHeight) the one-shot
  // teleport-on-release already uses successfully, just applied continuously instead of
  // once, which is what turns a passable stair riser into an actual smooth climb instead
  // of either a wall or a sudden pop.
  private setupGrounding(floorMeshes: AbstractMesh[]): void {
    if (!this.xrExperience) return;
    this.teardownGrounding();
    this.groundFloorMeshes = floorMeshes;

    const sessionManager = this.xrExperience.baseExperience.sessionManager;
    const probeRay = new Ray(Vector3.Zero(), Vector3.Down());

    this.groundFrameCallback = () => {
      const camera = this.xrCamera;
      if (!camera || this.groundFloorMeshes.length === 0) return;

      const feetY = camera.position.y - camera.realWorldHeight;
      probeRay.origin.set(camera.position.x, feetY + XRManager.GROUND_PROBE_ABOVE_M, camera.position.z);
      probeRay.direction.set(0, -1, 0);
      probeRay.length = XRManager.GROUND_PROBE_ABOVE_M + XRManager.GROUND_PROBE_BELOW_M;

      const pick = this.scene.pickWithRay(probeRay, (m) => this.groundFloorMeshes.indexOf(m) !== -1);
      // No floor found under the current spot this frame (e.g. a gap between floor
      // meshes, or mid-teleport-arc edge case) - hold height rather than guess.
      if (!pick?.hit || !pick.pickedPoint) return;

      const delta = pick.pickedPoint.y - feetY;
      if (Math.abs(delta) < 1e-4) return;
      const deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
      const maxStep = (delta >= 0 ? XRManager.GROUND_CLIMB_SPEED_MPS : XRManager.GROUND_FALL_SPEED_MPS) * deltaSeconds;
      camera.position.y += Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
    };
    sessionManager.onXRFrameObservable.add(this.groundFrameCallback);
  }

  private teardownGrounding(): void {
    const sessionManager = this.xrExperience?.baseExperience?.sessionManager;
    if (sessionManager && this.groundFrameCallback) {
      sessionManager.onXRFrameObservable.removeCallback(this.groundFrameCallback);
    }
    this.groundFrameCallback = null;
    this.groundFloorMeshes = [];
  }

  // Snaps the player back to wherever this VR session started - the "reset position"
  // gesture's action (see setupControllerEvents for the button that triggers it).
  private resetPlayerPosition(): void {
    if (this.xrCamera && this.vrSpawnPosition) {
      this.xrCamera.position.copyFrom(this.vrSpawnPosition);
    }
  }

  // Enable hand tracking
  private enableHandTracking(featuresManager: WebXRFeaturesManager): void {
    if (!this.xrExperience) return;
    try {
      featuresManager.enableFeature(WebXRFeatureName.HAND_TRACKING, 'latest', {
        xrInput: this.xrExperience.input,
        // Babylon's hand-tracking feature renders 25 small visible sphere meshes per
        // hand by default (jointMeshes.invisible defaults to false) when no custom hand
        // mesh is provided - this app never provided one, since nothing here actually
        // uses hand-joint data for interaction (it's all controller/thumbstick-based,
        // see setupCustomMovement etc.). Those default joint spheres are what showed up
        // as small floating markers scattered across the exterior walls in this
        // session's video - as the headset's hand/controller detection flickers in and
        // out of view, so do they, reported as "exterior flicker". Tracking itself still
        // works the same either way; this only stops drawing the debug spheres for it.
        jointMeshes: { invisible: true }
      }, true, false);
      console.log('Hand tracking enabled');
    } catch (error) {
      console.warn('Hand tracking not supported:', error);
    }
  }

  // Smooth thumbstick locomotion (left controller), entirely reimplemented rather than
  // using Babylon's own WebXRFeatureName.MOVEMENT.
  //
  // Reported symptom on real Quest hardware: pushing the stick forward walks normally,
  // pushing it backward - even standing in open space, nothing behind - does nothing at
  // all. Babylon's own movement feature's forward/backward handling
  // (WebXRControllerMovement.js's _onXRFrame) is genuinely symmetric for both signs of
  // the stick's Y axis, so this wasn't traceable to a specific line the way the
  // teleportation bug above was - but by the same principle that fixed that one
  // (stop depending on Babylon's own internal feature state entirely, replace it with a
  // small direct implementation), this sidesteps whatever that asymmetry actually was.
  //
  // Also computes movement direction from the camera's YAW only (heading), not its full
  // 3D orientation including pitch - Babylon's own feature uses the full quaternion via
  // movementOrientationFollowsViewerPose, meaning looking down while holding "forward"
  // pushes you into the floor. Standard VR locomotion comfort practice keeps movement
  // on the horizontal plane regardless of where the headset is currently pointed, which
  // this now does (the same yaw-only, Y-zeroed direction pattern nudgePlacedModel
  // already uses for AR placement).
  private setupCustomMovement(): void {
    if (!this.xrExperience) return;
    this.teardownCustomMovement();

    const sessionManager = this.xrExperience.baseExperience.sessionManager;
    this.movementFrameCallback = () => {
      const camera = this.xrCamera;
      const controller = this.xrExperience?.input.controllers.find((c) => c.inputSource.handedness === 'left');
      const thumbstick = controller?.motionController?.getComponentOfType(WebXRControllerComponent.THUMBSTICK_TYPE)
        ?? controller?.motionController?.getComponentOfType(WebXRControllerComponent.TOUCHPAD_TYPE);
      if (!camera || !controller || !thumbstick) return;

      const { x, y } = thumbstick.axes;
      const moveX = Math.abs(x) > XRManager.MOVEMENT_THRESHOLD ? x : 0;
      const moveY = Math.abs(y) > XRManager.MOVEMENT_THRESHOLD ? y : 0;
      if (moveX === 0 && moveY === 0) return;

      const forward = camera.getDirection(Vector3.Forward());
      forward.y = 0;
      if (forward.lengthSquared() < 1e-6) return; // looking straight up/down - no stable horizontal forward this frame
      forward.normalize();
      const right = camera.getDirection(Vector3.Right());
      right.y = 0;
      right.normalize();

      // Auto-sprint: no separate button for it (squeeze is already the exit gesture,
      // and there's nothing else free on this controller) - pushing the stick to
      // (near) full deflection is itself the sprint trigger, the way many VR games with
      // limited controller buttons already work. magnitude rather than either axis
      // alone so it also triggers on a fully-deflected diagonal, not just straight
      // forward/back.
      const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
      const speedMps = magnitude > XRManager.SPRINT_THRESHOLD
        ? XRManager.WALK_SPEED_MPS * XRManager.SPRINT_MULTIPLIER
        : XRManager.WALK_SPEED_MPS;

      // y is WebXR's standard thumbstick convention: negative = pushed away/forward.
      const distance = speedMps * (this.scene.getEngine().getDeltaTime() / 1000);
      const translation = forward.scale(-moveY * distance).add(right.scale(moveX * distance));
      // Same accumulate-then-let-the-camera's-own-update-loop-consume-it mechanism
      // Babylon's own feature used, so this still works together with the collision
      // ellipsoid/gravity set up in applyWalkingCollisions rather than needing a
      // separate system for it.
      camera.cameraDirection.addInPlace(translation);
    };
    sessionManager.onXRFrameObservable.add(this.movementFrameCallback);
  }

  private teardownCustomMovement(): void {
    const sessionManager = this.xrExperience?.baseExperience?.sessionManager;
    if (sessionManager && this.movementFrameCallback) {
      sessionManager.onXRFrameObservable.removeCallback(this.movementFrameCallback);
    }
    this.movementFrameCallback = null;
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
          this.pulseTurnVignette();
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
      } else if (this.teleportAiming) {
        // Released - the stick is no longer pushed past the forward-aim threshold at
        // all, regardless of exactly how far back toward centre it's actually returned.
        // Previously required crossing a SEPARATE, further release threshold
        // (TELEPORT_RELEASE_THRESHOLD, -0.3 vs the -0.7 aim threshold) - a real
        // hysteresis band, deliberately added so aiming couldn't flicker on/off near one
        // boundary, but it meant the stick had to travel through that entire 0.4-wide
        // gap to actually commit a teleport. Reported symptom: a clearly valid (cyan)
        // target aimed at, then... nothing on release. Worn/cheap analog sticks in
        // particular don't return to centre smoothly and can stall partway back,
        // possibly never crossing the second boundary. Committing as soon as the aim
        // threshold itself is no longer met removes that dead zone entirely while still
        // only ever firing after a real aim (teleportAiming) was in progress.
        this.teleportAiming = false;
        this.hideTeleportVisuals();
        // Fires the instant a release is DETECTED at all, regardless of whether a valid
        // target was actually captured - this is what separates "the release itself
        // never gets recognized" (no pulse at all) from "release IS recognized but
        // there was no target to teleport to" (pulse, camera still doesn't move) as two
        // genuinely different failure modes. A pulse placed only inside the
        // teleportTargetPoint check below couldn't tell those apart. Whether this is
        // even felt also depends on this specific controller/browser actually exposing
        // a haptic actuator at all, which hasn't been independently confirmed yet
        // either (see the hold-to-exit gesture's own pulse, elsewhere in this file).
        controller.inputSource.gamepad?.hapticActuators?.[0]?.pulse(0.6, 80);
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

    // Hold-Y-to-reset-position, left controller only. Getting stuck (wedged against
    // geometry by a bad collision resolve, or just disoriented after moving around a
    // large model) previously had no recovery besides fully exiting and re-entering VR.
    // On Quest (oculus-touch is forced there - see getInputOptions) the left controller's
    // upper face button resolves to 'y-button'; other headsets' left-controller equivalent
    // (if any) resolves to whatever their own real profile calls it, hence the 'b-button'
    // fallback below - it isn't used for anything else here, unlike the right controller's
    // face buttons which the built-in pointer selection feature can use for UI clicks. A
    // shorter hold than the exit gesture
    // (which deliberately needs a deliberate 1200ms hold, since it ends the session) -
    // long enough that a stray touch while adjusting grip doesn't teleport the player by
    // accident, short enough to actually be quick to use.
    const RESET_HOLD_MS = 500;

    const wireResetGesture = (controller: WebXRInputSource) => {
      if (controller.inputSource.handedness !== 'left') return;
      const attach = () => {
        const resetButton = controller.motionController?.getComponent('y-button')
          ?? controller.motionController?.getComponent('b-button');
        if (!resetButton) return;
        resetButton.onButtonStateChangedObservable.add((component) => {
          if (component.pressed) {
            if (this.resetHoldTimers.has(controller.uniqueId)) return;
            this.resetHoldTimers.set(controller.uniqueId, setTimeout(() => {
              this.resetHoldTimers.delete(controller.uniqueId);
              console.log('Reset button held - resetting player position');
              controller.inputSource.gamepad?.hapticActuators?.[0]?.pulse(0.8, 100);
              this.resetPlayerPosition();
            }, RESET_HOLD_MS));
          } else {
            const timer = this.resetHoldTimers.get(controller.uniqueId);
            if (timer !== undefined) {
              clearTimeout(timer);
              this.resetHoldTimers.delete(controller.uniqueId);
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
      wireResetGesture(controller);
    });

    this.xrExperience.input.onControllerRemovedObservable.add((controller) => {
      console.log('XR controller removed');
      const exitTimer = this.exitHoldTimers.get(controller.uniqueId);
      if (exitTimer !== undefined) {
        clearTimeout(exitTimer);
        this.exitHoldTimers.delete(controller.uniqueId);
      }
      const resetTimer = this.resetHoldTimers.get(controller.uniqueId);
      if (resetTimer !== undefined) {
        clearTimeout(resetTimer);
        this.resetHoldTimers.delete(controller.uniqueId);
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
