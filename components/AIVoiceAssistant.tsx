import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { featureCategoriesArray } from '../config/featureCategories';
import { showToast } from './utils/toast';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Brain,
  Zap,
  Loader2,
  Search,
  MapPin,
  Ruler,
  Palette,
  Sun,
  Layers,
  Droplet
} from 'lucide-react';
import { Scene, Mesh, Vector3, Material, PBRMaterial, StandardMaterial, Color3, HighlightLayer } from '@babylonjs/core';

// Type declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

interface VoiceCommand {
  id: string;
  command: string;
  action: string;
  parameters?: Record<string, any>;
  confidence: number;
  timestamp: Date;
}

interface VoiceSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  sensitivity: number;
}

interface AIVoiceAssistantProps {
  scene: Scene;
  isActive: boolean;
  onClose: () => void;
  onCommandExecute?: (command: VoiceCommand) => void;
  onSceneUpdate?: (action: string, parameters?: any) => void;
}

// The Web Speech API's SpeechSynthesisVoice has no gender field, so picking a female
// voice means matching against known voice names. This covers the common female voices
// shipped by Chrome/Edge (Google/Microsoft voices), Safari/macOS/iOS, and Android TTS.
const FEMALE_VOICE_NAME_PATTERNS = [
  /female/i,
  /\bzira\b/i, /\baria\b/i, /\bjenny\b/i, /\bmichelle\b/i, /\bsara\b/i,
  /\bsamantha\b/i, /\bvictoria\b/i, /\bkaren\b/i, /\bmoira\b/i, /\btessa\b/i,
  /\bkate\b/i, /\bserena\b/i, /\bsusan\b/i, /\bfiona\b/i, /\bveena\b/i,
  /\ballison\b/i, /\bava\b/i, /\bnicky\b/i,
  /google .* female/i, /google us english/i, /google uk english female/i,
];

// The difference between "sounds robotic" and "sounds natural" on the SAME OS is
// almost entirely which underlying voice gets picked - legacy SAPI voices (e.g.
// Windows' "Microsoft Zira Desktop") are flat/monotone, while the modern neural
// voices most browsers now also ship (Edge's "Microsoft ... Online (Natural)",
// Chrome's Google voices) sound dramatically more natural. Without this, name-based
// matching alone could land on whichever female-sounding voice happened to come
// first, which was very often the worse-sounding legacy one.
const PREMIUM_VOICE_HINTS = [/online/i, /natural/i, /neural/i, /premium/i, /enhanced/i, /^google/i];

function pickFemaleVoice(voices: SpeechSynthesisVoice[], preferredLang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const matchesLang = (v: SpeechSynthesisVoice) => v.lang?.toLowerCase().startsWith(preferredLang.slice(0, 2).toLowerCase());
  const isFemaleByName = (v: SpeechSynthesisVoice) => FEMALE_VOICE_NAME_PATTERNS.some((re) => re.test(v.name));
  const isPremium = (v: SpeechSynthesisVoice) => PREMIUM_VOICE_HINTS.some((re) => re.test(v.name));

  const femaleVoices = voices.filter(isFemaleByName);
  const langFemaleVoices = femaleVoices.filter(matchesLang);
  const pool = langFemaleVoices.length ? langFemaleVoices : femaleVoices;
  if (pool.length) {
    return pool.find(isPremium) || pool[0];
  }

  // Fallback: at least keep the preferred language so it doesn't sound out of place.
  const langOnly = voices.find(matchesLang);
  return langOnly || voices[0] || null;
}

const AIVoiceAssistant: React.FC<AIVoiceAssistantProps> = ({
  scene,
  isActive,
  onClose,
  onCommandExecute,
  onSceneUpdate
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [coreToolsSearch, setCoreToolsSearch] = useState('');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settings, setSettings] = useState<VoiceSettings>({
    language: 'en-US',
    continuous: true,
    interimResults: true,
    sensitivity: 0.5
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const userStoppedRef = useRef(false);
  const networkErrorRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const femaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  isMutedRef.current = isMuted;

  // Initialize speech recognition once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionAPI = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setRecognitionAvailable(false);
      return;
    }
    setRecognitionAvailable(true);

    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      startingRef.current = false;
      networkErrorRef.current = false;
      setIsListening(true);
      setIsProcessing(false);
      setListenError(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalT = '';
      let interimT = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalT += t;
        else interimT += t;
      }
      setTranscript(prev => prev + finalT);
      setInterimTranscript(interimT);
      if (finalT && processVoiceCommandRef.current) processVoiceCommandRef.current(finalT.trim());
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      startingRef.current = false;
      setIsListening(false);
      setIsProcessing(false);
      // "aborted" is normal when stopping - ignore silently
      if (event.error === 'aborted') return;
      // "network" = cannot reach speech servers - stop auto-restart loop
      if (event.error === 'network') {
        networkErrorRef.current = true;
        userStoppedRef.current = true;
        setListenError('Network error. Check internet connection and try again.');
        return;
      }
      if (event.error === 'not-allowed') {
        setListenError('Microphone access denied. Allow mic in browser settings.');
      } else if (event.error === 'no-speech') {
        setListenError(null);
      } else {
        setListenError(`Error: ${event.error}`);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      setIsProcessing(false);
      // Do NOT auto-restart if user stopped, muted, or had network error
      if (userStoppedRef.current || isMutedRef.current || networkErrorRef.current) return;
      // Chrome/Edge's continuous mode still ends the recognizer on its own every so
      // often (silence timeout, ~60s cap, etc), so this restart isn't rare - it's a
      // normal part of "continuous" listening. The 500ms gap here was long enough
      // that a word spoken right as it restarted was routinely missed entirely,
      // which is a real part of what made this feel like it wasn't listening in
      // real time. 150ms is still enough for the browser to fully release the
      // previous session (an immediate restart can throw InvalidStateError) without
      // leaving a gap big enough to matter.
      setTimeout(() => {
        if (!recognitionRef.current || userStoppedRef.current || isMutedRef.current || networkErrorRef.current) return;
        try {
          recognitionRef.current.start();
        } catch (_e) {
          userStoppedRef.current = true;
        }
      }, 150);
    };

    recognitionRef.current = rec;
    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        femaleVoiceRef.current = pickFemaleVoice(voices, settings.language);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      userStoppedRef.current = true;
      try {
        rec.abort();
      } catch (_e) {
        // ignore abort errors during cleanup
      }
      recognitionRef.current = null;
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const processVoiceCommandRef = useRef<(cmd: string) => void>(() => {});
  const processVoiceCommand = useCallback(async (command: string) => {
    setIsProcessing(true);

    try {
      // Parse and execute the voice command
      const parsedCommand = await parseVoiceCommand(command);
      if (parsedCommand) {
        setCommands(prev => [parsedCommand, ...prev.slice(0, 9)]); // Keep last 10 commands

        if (onCommandExecute) {
          onCommandExecute(parsedCommand);
        }

        // Execute the command
        await executeVoiceCommand(parsedCommand);

        // Provide audio feedback
        if (!isMuted && synthRef.current) {
          speakResponse(`Command executed: ${parsedCommand.action}`);
        }
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onCommandExecute, isMuted]);
  processVoiceCommandRef.current = processVoiceCommand;

  const parseVoiceCommand = useCallback(async (command: string): Promise<VoiceCommand | null> => {
    const lowerCommand = command.toLowerCase();

    // Define command patterns and their corresponding actions
    const commandPatterns = [
      {
        patterns: ['select', 'choose', 'pick'],
        action: 'select_mesh',
        parse: (cmd: string) => {
          const meshMatch = cmd.match(/(?:select|choose|pick)\s+(.+)/);
          if (meshMatch) {
            const meshName = meshMatch[1].trim();
            return { meshName };
          }
          return null;
        }
      },
      {
        patterns: ['highlight', 'show', 'focus'],
        action: 'highlight_mesh',
        parse: (cmd: string) => {
          const meshMatch = cmd.match(/(?:highlight|show|focus)\s+(.+)/);
          if (meshMatch) {
            const meshName = meshMatch[1].trim();
            return { meshName };
          }
          return null;
        }
      },
      {
        patterns: ['move', 'translate', 'position'],
        action: 'move_mesh',
        parse: (cmd: string) => {
          const moveMatch = cmd.match(/(?:move|translate|position)\s+(.+)\s+(?:to|by)\s+(.+)/);
          if (moveMatch) {
            const meshName = moveMatch[1].trim();
            const position = moveMatch[2].trim();
            return { meshName, position };
          }
          return null;
        }
      },
      {
        patterns: ['rotate', 'turn', 'spin'],
        action: 'rotate_mesh',
        parse: (cmd: string) => {
          const rotateMatch = cmd.match(/(?:rotate|turn|spin)\s+(.+)\s+(?:by|to)\s+(.+)/);
          if (rotateMatch) {
            const meshName = rotateMatch[1].trim();
            const rotation = rotateMatch[2].trim();
            return { meshName, rotation };
          }
          return null;
        }
      },
      {
        patterns: ['scale', 'resize', 'size'],
        action: 'scale_mesh',
        parse: (cmd: string) => {
          const scaleMatch = cmd.match(/(?:scale|resize|size)\s+(.+)\s+(?:to|by)\s+(.+)/);
          if (scaleMatch) {
            const meshName = scaleMatch[1].trim();
            const scale = scaleMatch[2].trim();
            return { meshName, scale };
          }
          return null;
        }
      },
      {
        patterns: ['create', 'add', 'new'],
        action: 'create_primitive',
        parse: (cmd: string) => {
          const createMatch = cmd.match(/(?:create|add|new)\s+(box|cylinder|sphere|plane|ground)\s*(?:called|named)?\s*(.+)?/);
          if (createMatch) {
            const shape = createMatch[1];
            const name = createMatch[2]?.trim() || `${shape}_${Date.now()}`;
            return { shape, name };
          }
          return null;
        }
      },
      {
        patterns: ['delete', 'remove', 'destroy'],
        action: 'delete_mesh',
        parse: (cmd: string) => {
          const deleteMatch = cmd.match(/(?:delete|remove|destroy)\s+(.+)/);
          if (deleteMatch) {
            const meshName = deleteMatch[1].trim();
            return { meshName };
          }
          return null;
        }
      },
      {
        patterns: ['camera', 'view', 'look'],
        action: 'camera_control',
        parse: (cmd: string) => {
          const cameraMatch = cmd.match(/(?:camera|view|look)\s+(?:to|at)\s+(.+)/);
          if (cameraMatch) {
            const target = cameraMatch[1].trim();
            return { target };
          }
          return null;
        }
      },
      {
        patterns: ['material', 'texture', 'color'],
        action: 'change_material',
        parse: (cmd: string) => {
          const materialMatch = cmd.match(/(?:material|texture|color)\s+(.+)\s+(?:to|set)\s+(.+)/);
          if (materialMatch) {
            const meshName = materialMatch[1].trim();
            const material = materialMatch[2].trim();
            return { meshName, material };
          }
          return null;
        }
      },
      {
        patterns: ['analysis', 'analyze', 'check'],
        action: 'run_analysis',
        parse: () => ({})
      },
      {
        patterns: ['what does', 'what is', 'explain', 'tell me about', 'how do i use', 'how does'],
        action: 'explain_tool',
        parse: (cmd: string) => {
          const m = cmd.match(/(?:what does|what is|explain|tell me about|how do i use|how does)\s+(?:the\s+)?(.+?)(?:\s+do)?\??$/i);
          if (m && m[1]) return { target: m[1].trim() };
          return null;
        }
      },
      {
        patterns: ['help', 'commands', 'what can you do'],
        action: 'show_help',
        parse: () => ({})
      },
      // Off patterns first so "measurement off" matches before "measurement"
      {
        patterns: ['measurement off', 'measure off', 'stop measurement', 'deactivate measurement'],
        action: 'measurement_off',
        parse: () => ({ on: false })
      },
      {
        patterns: ['measurement', 'measure', 'measurement on', 'activate measurement', 'measure on', 'start measurement'],
        action: 'measurement_on',
        parse: () => ({ on: true })
      },
      {
        patterns: ['lighting off', 'lights off', 'light off', 'turn off lights', 'deactivate lighting'],
        action: 'lighting_off',
        parse: () => ({ on: false })
      },
      {
        patterns: ['lighting', 'lights', 'lighting on', 'lights on', 'light on', 'activate lighting', 'turn on lights'],
        action: 'lighting_on',
        parse: () => ({ on: true })
      },
      {
        patterns: ['simulation off', 'stop simulation', 'deactivate simulation'],
        action: 'simulation_off',
        parse: () => ({ on: false })
      },
      {
        patterns: ['simulation', 'simulate', 'simulation on', 'run simulation', 'start simulation', 'activate simulation'],
        action: 'simulation_on',
        parse: () => ({ on: true })
      },
      {
        patterns: ['activate', 'turn on', 'enable'],
        action: 'activate',
        parse: (cmd: string) => {
          const rest = cmd.replace(/^(activate|turn on|enable)\s*/i, '').trim();
          if (rest) return { target: rest };
          return {};
        }
      },
      {
        patterns: ['deactivate', 'turn off', 'disable'],
        action: 'deactivate',
        parse: (cmd: string) => {
          const rest = cmd.replace(/^(deactivate|turn off|disable)\s*/i, '').trim();
          if (rest) return { target: rest };
          return {};
        }
      }
    ];

    // Find matching command pattern
    for (const commandPattern of commandPatterns) {
      for (const pattern of commandPattern.patterns) {
        if (lowerCommand.includes(pattern)) {
          const parameters = commandPattern.parse(command);
          if (parameters) {
            return {
              id: `cmd_${Date.now()}`,
              command: command,
              action: commandPattern.action,
              parameters,
              confidence: 0.9,
              timestamp: new Date()
            };
          }
        }
      }
    }

    // If no pattern matches, try AI interpretation
    return await interpretWithAI(command);
  }, []);

  const interpretWithAI = useCallback(async (command: string): Promise<VoiceCommand | null> => {
    // Simple AI interpretation based on keywords
    const lowerCommand = command.toLowerCase();

    // Simple on/off
    if (lowerCommand === 'on' || lowerCommand === 'activate') {
      return {
        id: `cmd_${Date.now()}`,
        command: command,
        action: 'activate',
        parameters: { target: 'last' },
        confidence: 0.7,
        timestamp: new Date()
      };
    }
    if (lowerCommand === 'off' || lowerCommand === 'deactivate') {
      return {
        id: `cmd_${Date.now()}`,
        command: command,
        action: 'deactivate',
        parameters: { target: 'last' },
        confidence: 0.7,
        timestamp: new Date()
      };
    }

    // Basic interpretations
    if (lowerCommand.includes('hello') || lowerCommand.includes('hi')) {
      return {
        id: `cmd_${Date.now()}`,
        command: command,
        action: 'greet',
        parameters: {},
        confidence: 0.8,
        timestamp: new Date()
      };
    }

    if (lowerCommand.includes('status') || lowerCommand.includes('info')) {
      return {
        id: `cmd_${Date.now()}`,
        command: command,
        action: 'show_status',
        parameters: {},
        confidence: 0.7,
        timestamp: new Date()
      };
    }

    // If still no match, return null
    return null;
  }, []);

  const executeVoiceCommand = useCallback(async (command: VoiceCommand) => {
    if (!scene) return;

    switch (command.action) {
      case 'select_mesh':
        if (command.parameters?.meshName) {
          const mesh = scene.getMeshByName(command.parameters.meshName);
          if (mesh && mesh instanceof Mesh) {
            // Create highlight layer if it doesn't exist
            let highlightLayer = scene.getHighlightLayerByName('voice-highlight');
            if (!highlightLayer) {
              highlightLayer = new HighlightLayer('voice-highlight', scene);
            }

            highlightLayer.addMesh(mesh, new Color3(0, 1, 0)); // Green highlight
            setTimeout(() => {
              highlightLayer.removeMesh(mesh);
            }, 5000);

            if (onSceneUpdate) {
              onSceneUpdate('select_mesh', { meshName: command.parameters.meshName });
            }
          }
        }
        break;

      case 'highlight_mesh':
        if (command.parameters?.meshName) {
          const mesh = scene.getMeshByName(command.parameters.meshName);
          if (mesh && mesh instanceof Mesh) {
            let highlightLayer = scene.getHighlightLayerByName('voice-highlight');
            if (!highlightLayer) {
              highlightLayer = new HighlightLayer('voice-highlight', scene);
            }

            highlightLayer.addMesh(mesh, new Color3(1, 1, 0)); // Yellow highlight
            setTimeout(() => {
              highlightLayer.removeMesh(mesh);
            }, 5000);

            if (onSceneUpdate) {
              onSceneUpdate('highlight_mesh', { meshName: command.parameters.meshName });
            }
          }
        }
        break;

      case 'create_primitive':
        if (command.parameters?.shape && command.parameters?.name) {
          await createPrimitive(command.parameters.shape, command.parameters.name);
          if (onSceneUpdate) {
            onSceneUpdate('create_primitive', command.parameters);
          }
        }
        break;

      case 'delete_mesh':
        if (command.parameters?.meshName) {
          const mesh = scene.getMeshByName(command.parameters.meshName);
          if (mesh) {
            mesh.dispose();
            if (onSceneUpdate) {
              onSceneUpdate('delete_mesh', { meshName: command.parameters.meshName });
            }
          }
        }
        break;

      case 'run_analysis':
        // Previously this only spoke "Running analysis" and called the (unwired,
        // optional) onSceneUpdate prop - no analysis of any kind actually ran. Opening
        // the real Clash Detection panel, the same way Measurement/Lighting/Simulation
        // already do, makes this an actual analysis instead of a scripted line.
        if (onSceneUpdate) onSceneUpdate('run_analysis', {});
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'run_analysis', featureId: 'showClashDetection', on: true } }));
        speakResponse('Running clash detection analysis.');
        break;

      case 'measurement_on':
        if (onSceneUpdate) onSceneUpdate('measurement_on', { on: true });
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'measurement_on', featureId: 'showMeasurementTool', on: true } }));
        speakResponse('Measurement tool activated.');
        break;

      case 'measurement_off':
        if (onSceneUpdate) onSceneUpdate('measurement_off', { on: false });
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'measurement_off', featureId: 'showMeasurementTool', on: false } }));
        speakResponse('Measurement tool deactivated.');
        break;

      case 'lighting_on':
        if (onSceneUpdate) onSceneUpdate('lighting_on', { on: true });
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'lighting_on', featureId: 'showLighting', on: true } }));
        speakResponse('Lighting activated.');
        break;

      case 'lighting_off':
        if (onSceneUpdate) onSceneUpdate('lighting_off', { on: false });
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'lighting_off', featureId: 'showLighting', on: false } }));
        speakResponse('Lighting deactivated.');
        break;

      case 'simulation_on':
        if (onSceneUpdate) onSceneUpdate('simulation_on', { on: true });
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'simulation_on', featureId: 'showFloodSimulation', on: true } }));
        speakResponse('Simulation started.');
        break;

      case 'simulation_off':
        if (onSceneUpdate) onSceneUpdate('simulation_off', { on: false });
        window.dispatchEvent(new CustomEvent('naviz:voiceCommand', { detail: { action: 'simulation_off', featureId: 'showFloodSimulation', on: false } }));
        speakResponse('Simulation stopped.');
        break;

      case 'activate':
      case 'deactivate': {
        // Matched against the same live feature list every toolbar button
        // comes from, instead of a small hand-maintained map - so voice
        // control covers every real feature (and never goes stale when
        // features are added/removed), giving genuine full on/off control.
        const target = (command.parameters?.target || '').toLowerCase().trim();
        const match = target
          ? featureCategoriesArray.find(f =>
              f.name.toLowerCase() === target ||
              f.name.toLowerCase().includes(target) ||
              target.includes(f.name.toLowerCase())
            )
          : undefined;
        const turningOn = command.action === 'activate';
        if (match) {
          window.dispatchEvent(new CustomEvent('naviz:voiceCommand', {
            detail: { action: command.action, featureId: match.id, on: turningOn }
          }));
          speakResponse(`${turningOn ? 'Activating' : 'Deactivating'} ${match.name}.`);
        } else {
          speakResponse(`I couldn't find a tool called "${command.parameters?.target || target}". Try "help" to hear what's available.`);
        }
        if (onSceneUpdate) onSceneUpdate(command.action, { target: command.parameters?.target });
        break;
      }

      case 'explain_tool': {
        const target = (command.parameters?.target || '').toLowerCase().trim();
        const match = featureCategoriesArray.find(f =>
          f.name.toLowerCase() === target ||
          f.name.toLowerCase().includes(target) ||
          target.includes(f.name.toLowerCase())
        );
        if (match) {
          speakResponse(`${match.name}: ${match.description}${match.hotkey ? `. Shortcut: ${match.hotkey}` : ''}`);
        } else {
          speakResponse(`I don't know a tool called "${command.parameters?.target}". Try asking "help" to hear what I can do.`);
        }
        break;
      }

      case 'show_help':
        showHelp();
        break;

      case 'greet':
        speakResponse("Hello! I'm your AI voice assistant. How can I help you with your 3D scene today?");
        break;

      case 'show_status': {
        const meshCount = scene.meshes.length;
        const cameraPos = scene.activeCamera?.position;
        speakResponse(`Current scene status: ${meshCount} meshes loaded. Camera position: ${cameraPos ? `x:${cameraPos.x.toFixed(1)}, y:${cameraPos.y.toFixed(1)}, z:${cameraPos.z.toFixed(1)}` : 'unknown'}`);
        break;
      }
    }
  }, [scene, onSceneUpdate]);

  const createPrimitive = useCallback(async (shape: string, name: string) => {
    if (!scene) return;

    try {
      let mesh: Mesh;

      switch (shape.toLowerCase()) {
        case 'box':
          mesh = Mesh.CreateBox(name, 1, scene);
          break;
        case 'sphere':
          mesh = Mesh.CreateSphere(name, 16, 1, scene);
          break;
        case 'cylinder':
          mesh = Mesh.CreateCylinder(name, 2, 1, 1, 12, 1, scene);
          break;
        case 'plane':
          mesh = Mesh.CreatePlane(name, 2, scene);
          break;
        case 'ground':
          mesh = Mesh.CreateGround(name, 10, 10, 2, scene);
          break;
        default:
          throw new Error(`Unknown shape: ${shape}`);
      }

      // Position the mesh randomly
      mesh.position = new Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 5,
        (Math.random() - 0.5) * 10
      );

      // Add a basic material
      const material = new StandardMaterial(`${name}_material`, scene);
      material.diffuseColor = new Color3(
        Math.random(),
        Math.random(),
        Math.random()
      );
      mesh.material = material;

      speakResponse(`Created ${shape} named ${name}`);
    } catch (error) {
      console.error('Error creating primitive:', error);
      speakResponse(`Sorry, I couldn't create the ${shape}`);
    }
  }, [scene]);

  const showHelp = useCallback(() => {
    const helpText = `
      Available voice commands:
      • What does [tool name] do - Explains any tool
      • Measurement on/off, Activate measurement - Toggle measurement tool
      • Lighting on/off, Turn on lights - Toggle lighting panel
      • Simulation on/off, Run simulation - Toggle flood simulation
      • Activate [measurement, lighting, simulation, minimap] - Turn on feature
      • Deactivate [feature] or Off - Turn off feature
      • Create box/sphere/cylinder - Create 3D shapes
      • Run analysis, Status, Help - Other actions
    `;

    speakResponse(helpText);
  }, []);

  const speakResponse = useCallback((text: string) => {
    // Speech was the ONLY confirmation any command gave - if the browser can't speak,
    // the tab is muted, or the user just isn't listening for audio, every single action
    // (including ones that genuinely worked, like toggling Measurement) looked like it
    // silently did nothing. A toast makes success/failure visible regardless of audio.
    showToast.info(text.length > 120 ? text.slice(0, 117) + '...' : text);
    if (!isMuted && synthRef.current) {
      // Without this, a second command spoken before the first reply finished
      // playing just queued behind it instead of interrupting - the spoken
      // response fell further and further behind what was actually happening in
      // the scene, which is a big part of what made this feel laggy rather than
      // real-time. Newest reply always wins and plays immediately.
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (femaleVoiceRef.current) {
        utterance.voice = femaleVoiceRef.current;
      }
      utterance.lang = settings.language;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      synthRef.current.speak(utterance);
    }
  }, [isMuted, settings.language]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !recognitionAvailable) return;
    userStoppedRef.current = false;
    networkErrorRef.current = false;
    setListenError(null);
    if (startingRef.current || isListening) return;
    try {
      startingRef.current = true;
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      startingRef.current = false;
      setIsListening(false);
      setListenError('Could not start. Allow microphone access and try again.');
    }
  }, [recognitionAvailable, isListening]);

  const stopListening = useCallback(() => {
    userStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_e) {
        // ignore stop errors
      }
    }
    setIsListening(false);
    startingRef.current = false;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed top-4 right-4 w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 pointer-events-auto">
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 min-w-0 shrink-0">
              <MessageSquare className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="truncate">AI Voice Features</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isMuted ? "destructive" : "outline"}
                onClick={toggleMute}
                className="text-xs"
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-md shrink-0"
                title="Close AI Voice Assistant"
                aria-label="Close AI Voice Assistant"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Voice Controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing || !recognitionAvailable}
              className="flex-1"
              size="sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isListening ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Listening
                </>
              )}
            </Button>
          </div>

          {!recognitionAvailable && (
            <p className="text-amber-400 text-xs">Speech recognition not supported. Use Chrome or Edge.</p>
          )}
          {listenError && (
            <p className="text-red-400 text-xs">{listenError}</p>
          )}

          {/* Core Tools */}
          <div className="space-y-2 pt-2 border-t border-slate-700">
            <span className="text-sm font-medium">Core Tools</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search features..."
                value={coreToolsSearch}
                onChange={(e) => setCoreToolsSearch(e.target.value)}
                className="pl-8 h-8 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'showMeasurementTool', name: 'Measure', icon: Ruler, cmd: 'measurement on' },
                { id: 'showLighting', name: 'Lighting', icon: Sun, cmd: 'lighting on' },
                { id: 'showMinimap', name: 'Minimap', icon: MapPin, cmd: 'activate minimap' },
                { id: 'showMaterialEditor', name: 'Material', icon: Palette, cmd: 'activate material' },
                { id: 'showSceneBrowser', name: 'Scene', icon: Layers, cmd: 'activate scene' },
                { id: 'showFloodSimulation', name: 'Simulation', icon: Droplet, cmd: 'simulation on' }
              ]
                .filter((t) => !coreToolsSearch || t.name.toLowerCase().includes(coreToolsSearch.toLowerCase()))
                .map(({ id, name, icon: Icon, cmd }) => (
                  <Button
                    key={id}
                    size="sm"
                    variant="outline"
                    onClick={() => processVoiceCommand(cmd)}
                    className="text-xs justify-start"
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    {name}
                  </Button>
                ))}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-slate-400">
              {isListening ? 'Listening...' : recognitionAvailable ? 'Ready' : 'Unavailable'}
            </span>
            {isProcessing && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-yellow-400">Processing...</span>
              </>
            )}
          </div>

          {/* Transcript Display */}
          {(transcript || interimTranscript) && (
            <div className="p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Transcript:</span>
                <Button size="sm" variant="ghost" onClick={clearTranscript} className="text-xs h-6">
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-20">
                <p className="text-sm">
                  {transcript}
                  {interimTranscript && (
                    <span className="text-slate-400 italic">{interimTranscript}</span>
                  )}
                </p>
              </ScrollArea>
            </div>
          )}

          {/* Command History */}
          {commands.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recent Commands</span>
                <Badge variant="outline" className="text-xs">
                  {commands.length}
                </Badge>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {commands.map((cmd) => (
                    <Alert key={cmd.id} className="p-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {cmd.action}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {Math.round(cmd.confidence * 100)}%
                            </span>
                          </div>
                          <AlertDescription className="text-xs">
                            "{cmd.command}"
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Quick Commands */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Quick Commands:</span>
            <div className="grid grid-cols-2 gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => processVoiceCommand("create box test_box")}
                className="text-xs"
              >
                Create Box
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => processVoiceCommand("run analysis")}
                className="text-xs"
              >
                Run Analysis
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => processVoiceCommand("status")}
                className="text-xs"
              >
                Show Status
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => processVoiceCommand("help")}
                className="text-xs"
              >
                Help
              </Button>
            </div>
          </div>

          {/* Settings - this used to be an empty onClick with a "TODO: Open settings
              modal" comment, so clicking it visibly did nothing at all. */}
          <div className="pt-2 border-t border-slate-700">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSettingsPanel(v => !v)}
              className="text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </Button>
            {showSettingsPanel && (
              <div className="mt-2 p-2 bg-slate-800 rounded-lg space-y-2">
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="flex items-center gap-1.5">
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    Mute voice replies
                  </span>
                  <input type="checkbox" checked={isMuted} onChange={toggleMute} />
                </label>
                <p className="text-[10px] text-slate-500">
                  Replies always show as a notification too, so this only affects whether they're also spoken aloud.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIVoiceAssistant;
