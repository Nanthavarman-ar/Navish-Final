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
  // Directional ambience zones (balcony traffic/birds, living room TV/fountain, etc) -
  // each is its own real Web Audio graph (noise/oscillator -> filter -> gain -> PannerNode
  // positioned at the marker) rather than a BABYLON.Sound, since there's no actual sound
  // asset file to point one at - these are synthesized so the feature works with zero
  // external audio files to source/host/license. All share the single global
  // AudioListener (kept aligned with the active camera in update()), so as the viewer
  // walks toward a zone's marker, that zone's own distance falloff makes it audibly
  // louder/closer while every other zone fades relatively - genuine directional ambience.
  private ambientZones: Map<string, { nodes: AudioNode[]; intervalId: number | null }> = new Map();

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

  public static readonly AMBIENT_ZONE_PRESETS = ['traffic', 'birds', 'tv', 'fountain'] as const;

  private createNoiseBuffer(audioContext: AudioContext, durationSeconds: number): AudioBuffer {
    const length = Math.floor(audioContext.sampleRate * durationSeconds);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Places a real, positioned, looping ambience source at a spot in the scene - e.g. a
  // marker near the balcony playing traffic/birds, one in the living room playing TV
  // chatter/a fountain. Replaces any existing zone with the same id (so moving/re-editing
  // a marker doesn't leave the old audio graph still playing underneath the new one).
  public addAmbientZone(
    id: string,
    preset: typeof AudioManager.AMBIENT_ZONE_PRESETS[number],
    position: BABYLON.Vector3,
    options?: { volume?: number; maxDistance?: number }
  ): void {
    const audioContext = this.audioEngine?.audioContext as AudioContext | undefined;
    if (!audioContext) return;
    this.removeAmbientZone(id);

    const volume = options?.volume ?? 0.4;
    const maxDistance = options?.maxDistance ?? this.config.maxDistance;

    const panner = audioContext.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = this.config.rolloffFactor;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    panner.connect(audioContext.destination);

    const nodes: AudioNode[] = [panner];
    let intervalId: number | null = null;

    // Presets are synthesized (noise/oscillators through filters), not sample playback -
    // there's no bundled/hosted sound asset for "traffic" or "birds" to load, so this is
    // what makes each preset audibly distinct with zero external audio files.
    if (preset === 'traffic' || preset === 'fountain' || preset === 'tv') {
      const noise = audioContext.createBufferSource();
      noise.buffer = this.createNoiseBuffer(audioContext, 4);
      noise.loop = true;
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();

      if (preset === 'traffic') {
        // Low rumble with a slow swell/fade, like distant vehicles passing.
        filter.type = 'lowpass';
        filter.frequency.value = 350;
        gain.gain.value = volume * 0.6;
        lfo.frequency.value = 0.15;
        lfoGain.gain.value = volume * 0.15;
      } else if (preset === 'fountain') {
        // Wider-band filtered noise, steadier, brighter - reads as flowing water.
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 0.6;
        gain.gain.value = volume * 0.5;
        lfo.frequency.value = 0.6;
        lfoGain.gain.value = volume * 0.1;
      } else {
        // Mid-band noise wobbling faster than traffic/fountain - reads as indistinct
        // speech/chatter from another room, without the feature depending on real
        // dialogue audio.
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 0.8;
        gain.gain.value = volume * 0.35;
        lfo.frequency.value = 3.2;
        lfoGain.gain.value = volume * 0.2;
      }

      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      noise.start();
      lfo.start();
      nodes.push(noise, filter, gain, lfo, lfoGain);
    } else if (preset === 'birds') {
      // Intermittent short chirps rather than a continuous tone - scheduled in small
      // clusters (1-3 chirps) at random intervals so it reads as occasional birdsong
      // instead of a metronome.
      const scheduleChirp = () => {
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        osc.type = 'sine';
        const startFreq = 2200 + Math.random() * 1200;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(startFreq * (1.2 + Math.random() * 0.4), now + 0.12);
        const chirpGain = audioContext.createGain();
        chirpGain.gain.setValueAtTime(0.0001, now);
        chirpGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.02);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(chirpGain);
        chirpGain.connect(panner);
        osc.start(now);
        osc.stop(now + 0.2);
        osc.onended = () => { osc.disconnect(); chirpGain.disconnect(); };
      };
      intervalId = window.setInterval(() => {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          setTimeout(scheduleChirp, i * (80 + Math.random() * 120));
        }
      }, 1800 + Math.random() * 1800);
    }

    this.ambientZones.set(id, { nodes, intervalId });
  }

  public removeAmbientZone(id: string): void {
    const zone = this.ambientZones.get(id);
    if (!zone) return;
    if (zone.intervalId !== null) window.clearInterval(zone.intervalId);
    zone.nodes.forEach((n) => {
      try { if (typeof (n as OscillatorNode | AudioBufferSourceNode).stop === 'function') (n as OscillatorNode | AudioBufferSourceNode).stop(); } catch { /* already stopped */ }
      try { n.disconnect(); } catch { /* already disconnected */ }
    });
    this.ambientZones.delete(id);
  }

  public clearAmbientZones(): void {
    Array.from(this.ambientZones.keys()).forEach((id) => this.removeAmbientZone(id));
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
    this.clearAmbientZones();
    this.spatialAudioEnabled = false;
    console.log('AudioManager disposed');
  }
}
