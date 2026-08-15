import { Scene } from '@babylonjs/core/scene';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

// Type declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: any; // SpeechGrammarList
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export class AIManager {
  private scene: Scene | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private recognition: SpeechRecognition | null = null;
  private currentLanguage: string = 'en-US';
  private isListening: boolean = false;
  private hiddenDetailsEnabled: boolean = false;
  private toggleFeature?: (featureId: string, enabled: boolean) => void;
  private femaleVoice: SpeechSynthesisVoice | null = null;
  private loadVoiceHandler: (() => void) | null = null;

  constructor(scene?: Scene, canvas?: HTMLCanvasElement, toggleFeature?: (featureId: string, enabled: boolean) => void) {
    if (scene) this.scene = scene;
    if (canvas) this.canvas = canvas;
    if (toggleFeature) this.toggleFeature = toggleFeature;

    // Load a female voice for TTS once the browser's voice list is available. Chrome in
    // particular returns an empty list from getVoices() until 'voiceschanged' fires.
    if ('speechSynthesis' in window) {
      const loadVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.femaleVoice = AIManager.pickFemaleVoice(voices, this.currentLanguage);
        }
      };
      this.loadVoiceHandler = loadVoice;
      loadVoice();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    }

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      if (this.recognition) {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.currentLanguage;

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            finalTranscript += event.results[i][0].transcript;
          }
          this.processVoiceCommand(finalTranscript);
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          // 'no-speech' and 'aborted' fire routinely during normal silence/restarts in
          // continuous listening mode - they aren't real problems, so don't nag the user
          // with a spoken alert every time the room goes quiet.
          const isRoutine = event.error === 'no-speech' || event.error === 'aborted';
          if (!isRoutine) {
            this.speak('Voice recognition error occurred.');
          }
          // Don't restart on certain errors to prevent infinite loops
          if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed' && this.isListening) {
            setTimeout(() => {
              if (this.isListening) {
                this.startVoiceListening();
              }
            }, 1000); // Delay restart to avoid rapid retries
          } else {
            this.isListening = false; // Stop listening on permission/service errors
          }
        };

        this.recognition.onend = () => {
          if (this.isListening) {
            // Small delay to prevent rapid restarts
            setTimeout(() => {
              if (this.isListening) {
                this.startVoiceListening();
              }
            }, 100);
          }
        };
      }
    } else {
      console.warn('Speech recognition not supported in this browser.');
    }
  }

  // Voice Commands
  public startVoiceListening(): void {
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    this.recognition!.start();
    this.speak('Voice assistant activated. How can I help?');
  }

  public stopVoiceListening(): void {
    if (!this.recognition || !this.isListening) return;
    this.isListening = false;
    this.recognition!.stop();
    this.speak('Voice assistant deactivated.');
  }

  private processVoiceCommand(command: string): void {
    command = command.toLowerCase();
    console.log('Voice command received:', command);

    // Navigation commands
    if (command.includes('walk')) {
      this.setNavigationMode('walk');
    } else if (command.includes('fly')) {
      this.setNavigationMode('fly');
    } else if (command.includes('teleport')) {
      this.setNavigationMode('teleport');
    }
    // Feature toggle commands
    else if (command.includes('enable bim') || command.includes('show bim')) {
      this.toggleFeature && this.toggleFeature('showBIMIntegration', true);
      this.speak('BIM integration enabled.');
    } else if (command.includes('disable bim') || command.includes('hide bim')) {
      this.toggleFeature && this.toggleFeature('showBIMIntegration', false);
      this.speak('BIM integration disabled.');
    } else if (command.includes('enable vr') || command.includes('enter vr')) {
      this.toggleFeature && this.toggleFeature('showVR', true);
      this.speak('VR mode enabled.');
    } else if (command.includes('disable vr') || command.includes('exit vr')) {
      this.toggleFeature && this.toggleFeature('showVR', false);
      this.speak('VR mode disabled.');
    } else if (command.includes('enable ar') || command.includes('enter ar')) {
      this.toggleFeature && this.toggleFeature('showAR', true);
      this.speak('AR mode enabled.');
    } else if (command.includes('disable ar') || command.includes('exit ar')) {
      this.toggleFeature && this.toggleFeature('showAR', false);
      this.speak('AR mode disabled.');
    } else if (command.includes('enable voice') || command.includes('start voice')) {
      this.toggleFeature && this.toggleFeature('showVoiceAssistant', true);
      this.speak('Voice assistant enabled.');
    } else if (command.includes('disable voice') || command.includes('stop voice')) {
      this.toggleFeature && this.toggleFeature('showVoiceAssistant', false);
      this.speak('Voice assistant disabled.');
    } else if (command.includes('enable gesture') || command.includes('start gesture')) {
      this.toggleGestureDetection();
    } else if (command.includes('disable gesture') || command.includes('stop gesture')) {
      this.toggleGestureDetection();
    }
    // Other commands
    else if (command.includes('show details') || command.includes('hidden details')) {
      this.toggleHiddenDetails();
    } else if (command.includes('help')) {
      this.speak('Available commands: walk, fly, teleport, enable/disable BIM, VR, AR, voice, gesture, show details, help.');
    } else {
      this.speak('Command not recognized. Try walk, fly, teleport, enable BIM, or show details.');
    }
  }

  // Navigation Modes
  public setNavigationMode(mode: 'walk' | 'fly' | 'teleport'): void {
    if (!this.scene) return;
    const scene = this.scene!;
    const camera = scene.activeCamera;
    if (camera) {
      switch (mode) {
        case 'walk':
          // Implement walk mode (e.g., first-person controller)
          console.log('Navigation mode set to walk');
          this.speak('Navigation mode set to walk.');
          break;
        case 'fly':
          // Implement fly mode
          console.log('Navigation mode set to fly');
          this.speak('Navigation mode set to fly.');
          break;
        case 'teleport':
          // Implement teleport mode (raycast from controller)
          console.log('Navigation mode set to teleport');
          this.speak('Navigation mode set to teleport.');
          break;
      }
    }
  }

  // Hidden Details Toggle
  public toggleHiddenDetails(): void {
    this.hiddenDetailsEnabled = !this.hiddenDetailsEnabled;
    if (this.scene) {
      const scene = this.scene!;
      scene.meshes.forEach((mesh: AbstractMesh) => {
        if (mesh.metadata?.isHiddenDetail) {
          mesh.isVisible = this.hiddenDetailsEnabled;
        }
      });
    }
    const status = this.hiddenDetailsEnabled ? 'enabled' : 'disabled';
    console.log(`Hidden details ${status}`);
    this.speak(`Hidden details ${status}.`);
  }

  // Gesture Detection (WebXR check)
  public toggleGestureDetection(): void {
    if ('xr' in navigator) {
      const xr = (navigator as any).xr;
      if (xr) {
        // Check if WebXR is supported
        xr.isSessionSupported('immersive-ar').then((supported: boolean) => {
          if (supported) {
            console.log('Gesture detection enabled with WebXR support');
            this.speak('Gesture detection enabled. WebXR supported.');
          } else {
            console.log('Gesture detection enabled but WebXR not fully supported');
            this.speak('Gesture detection enabled. Limited WebXR support.');
          }
        }).catch(() => {
          console.log('Gesture detection enabled without WebXR');
          this.speak('Gesture detection enabled. WebXR not available.');
        });
      } else {
        console.log('Gesture detection enabled without WebXR');
        this.speak('Gesture detection enabled. WebXR not available.');
      }
    } else {
      console.log('Gesture detection enabled without WebXR');
      this.speak('Gesture detection enabled. WebXR not supported in this browser.');
    }
  }

  // Multi-language Support
  public setLanguage(language: string): void {
    this.currentLanguage = language;
    if (this.recognition) {
      this.recognition!.lang = language;
    }
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        this.femaleVoice = AIManager.pickFemaleVoice(voices, language);
      }
    }
    console.log(`Language set to ${language}`);
    this.speak(`Language changed to ${language}.`);
  }

  private static instance: AIManager | null = null;

  public static getInstance(scene?: Scene): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager(scene);
    }
    return AIManager.instance;
  }

  // TTS Feedback
  public speak(text: string): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.femaleVoice) {
        utterance.voice = this.femaleVoice;
      }
      utterance.lang = this.currentLanguage;
      utterance.rate = 1.2;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    } else {
      console.log('TTS not supported:', text);
    }
  }

  private static FEMALE_VOICE_NAME_PATTERNS = [
    /female/i,
    /\bzira\b/i, /\baria\b/i, /\bjenny\b/i, /\bmichelle\b/i, /\bsara\b/i,
    /\bsamantha\b/i, /\bvictoria\b/i, /\bkaren\b/i, /\bmoira\b/i, /\btessa\b/i,
    /\bkate\b/i, /\bserena\b/i, /\bsusan\b/i, /\bfiona\b/i, /\bveena\b/i,
    /\ballison\b/i, /\bava\b/i, /\bnicky\b/i,
    /google .* female/i, /google us english/i, /google uk english female/i,
  ];

  private static pickFemaleVoice(voices: SpeechSynthesisVoice[], preferredLang: string): SpeechSynthesisVoice | null {
    if (!voices.length) return null;
    const matchesLang = (v: SpeechSynthesisVoice) => v.lang?.toLowerCase().startsWith(preferredLang.slice(0, 2).toLowerCase());
    const isFemaleByName = (v: SpeechSynthesisVoice) => AIManager.FEMALE_VOICE_NAME_PATTERNS.some((re) => re.test(v.name));

    const langAndFemale = voices.find((v) => matchesLang(v) && isFemaleByName(v));
    if (langAndFemale) return langAndFemale;

    const anyFemale = voices.find(isFemaleByName);
    if (anyFemale) return anyFemale;

    const langOnly = voices.find(matchesLang);
    return langOnly || voices[0] || null;
  }

  // Generate future city layout (mock implementation)
  public async generateFutureCity(density: string, type: string): Promise<any> {
    // Mock implementation for generating building layouts
    const buildings = [];
    const numBuildings = density === 'high' ? 20 : density === 'medium' ? 10 : 5;

    for (let i = 0; i < numBuildings; i++) {
      buildings.push({
        id: `building_${i}`,
        type: ['residential', 'commercial', 'industrial', 'public'][Math.floor(Math.random() * 4)],
        height: Math.random() * 50 + 10, // 10-60 meters
        position: {
          x: (Math.random() - 0.5) * 1000, // -500 to 500
          z: (Math.random() - 0.5) * 1000
        },
        rotation: Math.random() * 360
      });
    }

    return {
      buildings,
      density,
      type,
      generatedAt: new Date().toISOString()
    };
  }

  // Dispose
  public dispose(): void {
    this.stopVoiceListening();
    if (this.loadVoiceHandler && 'speechSynthesis' in window) {
      window.speechSynthesis.removeEventListener('voiceschanged', this.loadVoiceHandler);
      this.loadVoiceHandler = null;
    }
    if (this.scene) {
      // Cleanup any AI-related scene elements
    }
  }
}
