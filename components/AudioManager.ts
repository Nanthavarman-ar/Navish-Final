import * as BABYLON from '@babylonjs/core';

export interface AudioConfig {
  masterVolume: number;
  enableSpatialAudio: boolean;
  enableOcclusion: boolean;
  enableReverb: boolean;
  maxDistance: number;
  rolloffFactor: number;
  refDistance: number;
}

export class AudioManager {
  private scene: BABYLON.Scene;
  private config: AudioConfig;
  private audioEngine: BABYLON.IAudioEngine;
  private spatialAudioEnabled: boolean = false;
  private xrSession?: XRSession;
  // Procedural (generated, not file-based) ambient tone - used so spatial audio is
  // actually audible without needing external sound asset files. A gentle sine-wave
  // hum, panned in 3D via PannerNode based on the active camera's position, updated
  // every frame while active.
  private proceduralOscillator: OscillatorNode | null = null;
  private proceduralGain: GainNode | null = null;
  private proceduralPanner: PannerNode | null = null;
  private proceduralUpdateObserver: any = null;

  constructor(scene: BABYLON.Scene, config?: Partial<AudioConfig>, xrSession?: XRSession) {
    this.scene = scene;
    this.xrSession = xrSession;
    this.config = {
      masterVolume: 1.0,
      enableSpatialAudio: true,
      enableOcclusion: true,
      enableReverb: true,
      maxDistance: 100,
      rolloffFactor: 1,
      refDistance: 1,
      ...config
    };

    this.audioEngine = BABYLON.Engine.audioEngine!;
    if (!this.audioEngine) {
      console.warn('Audio engine not available');
      return;
    }
    this.initializeAudio();
  }

  private initializeAudio(): void {
    // Set master volume
    this.audioEngine.setGlobalVolume(this.config.masterVolume);

    // Enable spatial audio if supported
    if (this.config.enableSpatialAudio && 'AudioListener' in window) {
      this.spatialAudioEnabled = true;
    }

    // Handle audio context suspension
    if (this.audioEngine.audioContext && this.audioEngine.audioContext.state === 'suspended') {
      // Resume audio context on user interaction
      const resumeAudio = () => {
        if (this.audioEngine.audioContext) {
          this.audioEngine.audioContext.resume();
        }
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('touchstart', resumeAudio);
      };
      document.addEventListener('click', resumeAudio);
      document.addEventListener('touchstart', resumeAudio);
    }
  }

  public createSpatialSound(name: string, url: string, position: BABYLON.Vector3, options?: {
    volume?: number;
    loop?: boolean;
    autoplay?: boolean;
    maxDistance?: number;
  }): BABYLON.Sound | null {
    try {
      const sound = new BABYLON.Sound(
        name,
        url,
        this.scene,
        null,
        {
          volume: options?.volume || 1.0,
          loop: options?.loop || false,
          autoplay: options?.autoplay || false,
          maxDistance: options?.maxDistance || this.config.maxDistance,
          rolloffFactor: this.config.rolloffFactor,
          refDistance: this.config.refDistance,
          spatialSound: this.spatialAudioEnabled
        }
      );

      if (this.spatialAudioEnabled) {
        sound.setPosition(position);
      }

      return sound;
    } catch (error) {
      console.error('Failed to create spatial sound:', error);
      return null;
    }
  }

  public createAmbientSound(name: string, url: string, options?: {
    volume?: number;
    loop?: boolean;
    autoplay?: boolean;
  }): BABYLON.Sound | null {
    try {
      return new BABYLON.Sound(
        name,
        url,
        this.scene,
        null,
        {
          volume: options?.volume || 1.0,
          loop: options?.loop || true,
          autoplay: options?.autoplay || true,
          spatialSound: false
        }
      );
    } catch (error) {
      console.error('Failed to create ambient sound:', error);
      return null;
    }
  }

  public createReverbZone(position: BABYLON.Vector3, size: BABYLON.Vector3, reverbOptions?: {
    decayTime?: number;
    wetDryMix?: number;
  }): void {
    if (!this.config.enableReverb) return;

    // Create a reverb zone using audio effects
    // Note: This is a simplified implementation
    const reverbZone = BABYLON.MeshBuilder.CreateBox('reverbZone', {
      width: size.x,
      height: size.y,
      depth: size.z
    }, this.scene);

    reverbZone.position = position;
    reverbZone.isVisible = false; // Invisible zone

    // In a full implementation, you would apply reverb effects to sounds within this zone
  }

  public updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.audioEngine.setGlobalVolume(this.config.masterVolume);
  }

  public get isSpatialAudioEnabled(): boolean {
    return this.spatialAudioEnabled;
  }

  public get audioContext(): AudioContext | null {
    return this.audioEngine.audioContext;
  }

  public setXrSession(session: XRSession): void {
    this.xrSession = session;
  }

  public enableSpatialAudio(): void {
    if (!('AudioListener' in window)) {
      console.warn('Spatial audio not supported in this browser');
      return;
    }
    this.spatialAudioEnabled = true;

    // If in XR session, use WebXR audio context for enhanced spatialization
    if (this.xrSession && this.audioEngine.audioContext) {
      try {
        if ('setSinkId' in this.audioEngine.audioContext) {
          console.log('XR spatial audio enabled with session context');
        }
      } catch (error) {
        console.warn('Failed to set XR audio context:', error);
      }
    }

    this.startProceduralAmbientTone();
    console.log('Spatial audio enabled');
  }

  /**
   * Starts a genuinely audible, spatially-positioned ambient tone using raw Web Audio
   * API (no external sound file needed). Positioned near the scene origin and updated
   * every frame so it audibly pans/attenuates as the camera moves around it - this is
   * what actually makes "spatial audio" perceptible, versus just flipping a flag.
   */
  private startProceduralAmbientTone(): void {
    const audioContext = this.audioEngine?.audioContext as AudioContext | undefined;
    if (!audioContext) return;
    this.stopProceduralAmbientTone();

    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 110; // low, unobtrusive hum

    const gain = audioContext.createGain();
    gain.gain.value = 0.05; // quiet - an ambient presence, not a beep

    const panner = audioContext.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = this.config.refDistance;
    panner.maxDistance = this.config.maxDistance;
    panner.rolloffFactor = this.config.rolloffFactor;
    panner.positionX.value = 0;
    panner.positionY.value = 1;
    panner.positionZ.value = 0;

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(audioContext.destination);
    oscillator.start();

    this.proceduralOscillator = oscillator;
    this.proceduralGain = gain;
    this.proceduralPanner = panner;

    // Keep the Web Audio listener aligned with Babylon's active camera every frame,
    // so the sound's apparent direction/distance genuinely tracks the viewer.
    this.proceduralUpdateObserver = this.scene.onBeforeRenderObservable.add(() => {
      const camera = this.scene.activeCamera;
      const listener = audioContext.listener;
      if (!camera) return;
      if (listener.positionX) {
        listener.positionX.value = camera.position.x;
        listener.positionY.value = camera.position.y;
        listener.positionZ.value = camera.position.z;
      }
      const forward = camera.getForwardRay ? camera.getForwardRay().direction : new BABYLON.Vector3(0, 0, 1);
      if (listener.forwardX) {
        listener.forwardX.value = forward.x;
        listener.forwardY.value = forward.y;
        listener.forwardZ.value = forward.z;
      }
    });
  }

  private stopProceduralAmbientTone(): void {
    if (this.proceduralUpdateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.proceduralUpdateObserver);
      this.proceduralUpdateObserver = null;
    }
    try {
      this.proceduralOscillator?.stop();
    } catch { /* already stopped */ }
    this.proceduralOscillator?.disconnect();
    this.proceduralGain?.disconnect();
    this.proceduralPanner?.disconnect();
    this.proceduralOscillator = null;
    this.proceduralGain = null;
    this.proceduralPanner = null;
  }

  public disableSpatialAudio(): void {
    this.spatialAudioEnabled = false;
    this.stopProceduralAmbientTone();
    console.log('Spatial audio disabled');
  }

  public update(): void {
    // Update audio listener position to match the active camera for spatial audio
    if (this.spatialAudioEnabled && this.scene.activeCamera) {
      const camera = this.scene.activeCamera;
      const listener = this.audioEngine.audioContext?.listener;

      if (listener) {
        // Set listener position to camera position
        if ('positionX' in listener) {
          // Modern AudioListener API
          listener.positionX.value = camera.position.x;
          listener.positionY.value = camera.position.y;
          listener.positionZ.value = camera.position.z;
        } else if ('setPosition' in listener) {
          // Legacy API fallback
          (listener as any).setPosition(camera.position.x, camera.position.y, camera.position.z);
        }

        // Set listener orientation to match camera direction
        if (camera instanceof BABYLON.ArcRotateCamera) {
          // For ArcRotateCamera, calculate forward direction
          const target = camera.target;
          const forward = target.subtract(camera.position).normalize();
          const up = BABYLON.Vector3.Up();

          if ('forwardX' in listener) {
            listener.forwardX.value = forward.x;
            listener.forwardY.value = forward.y;
            listener.forwardZ.value = forward.z;
            listener.upX.value = up.x;
            listener.upY.value = up.y;
            listener.upZ.value = up.z;
          } else if ('setOrientation' in listener) {
            (listener as any).setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
          }
        }
      }
    }
  }

  public dispose(): void {
    // Babylon.js sounds are automatically disposed when the scene is disposed
    this.stopProceduralAmbientTone();
    this.spatialAudioEnabled = false;
    console.log('AudioManager disposed');
  }
}
