import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, Sound, Vector3, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

interface VoiceChatProps {
  scene: Scene;
  isActive: boolean;
  xrManager?: any; // XRManager instance for spatial audio
}

interface AudioSource {
  id: string;
  position: Vector3;
  sound: Sound;
  visualizer: any;
  isRecording: boolean;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ scene, isActive, xrManager }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioSources, setAudioSources] = useState<Map<string, AudioSource>>(new Map());
  const [volume, setVolume] = useState(1.0);
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [visualizationEnabled, setVisualizationEnabled] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize audio context
  useEffect(() => {
    if (isActive) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);

  // Real-time audio visualization update
  const updateVisualization = useCallback(() => {
    if (!analyserRef.current || !visualizationEnabled) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Update visualizers for all audio sources
    audioSources.forEach((source) => {
      if (source.visualizer) {
        updateAudioVisualizer(source.visualizer, dataArray);
      }
    });

    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  }, [audioSources, visualizationEnabled]);

  // Update audio visualizer mesh
  const updateAudioVisualizer = (visualizer: any, frequencyData: Uint8Array) => {
    if (!visualizer.mesh) return;

    const average = frequencyData.reduce((a, b) => a + b) / frequencyData.length;
    const scale = Math.max(0.1, average / 255);

    visualizer.mesh.scaling.y = scale;
    visualizer.mesh.material.emissiveColor = new Color3(scale, scale * 0.5, scale * 0.2);
  };

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (audioContextRef.current) {
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        microphoneRef.current.connect(analyserRef.current);

        // Create Babylon sound from microphone
        const sound = new Sound('microphone', null, scene, null, {
          streaming: true,
          spatialSound: spatialAudio,
          volume: volume
        });

        // Create visualizer mesh
        const visualizerMesh = MeshBuilder.CreateCylinder('audioVisualizer', {
          height: 2,
          diameterTop: 0.5,
          diameterBottom: 0.5
        }, scene);

        visualizerMesh.position = new Vector3(0, 1, 0);

        const visualizerMaterial = new StandardMaterial('visualizerMat', scene);
        visualizerMaterial.emissiveColor = new Color3(0, 0.5, 1);
        visualizerMaterial.alpha = 0.7;
        visualizerMesh.material = visualizerMaterial;

        const audioSource: AudioSource = {
          id: 'local',
          position: new Vector3(0, 1, 0),
          sound: sound,
          visualizer: { mesh: visualizerMesh },
          isRecording: true
        };

        setAudioSources(prev => new Map(prev.set('local', audioSource)));
        setIsRecording(true);

        // Start visualization loop
        updateVisualization();
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [scene, spatialAudio, volume, updateVisualization]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    audioSources.forEach((source) => {
      if (source.sound) {
        source.sound.dispose();
      }
      if (source.visualizer?.mesh) {
        source.visualizer.mesh.dispose();
      }
    });

    setAudioSources(new Map());
    setIsRecording(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [audioSources]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Update volume
  const updateVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    audioSources.forEach((source) => {
      if (source.sound) {
        source.sound.setVolume(newVolume);
      }
    });
  }, [audioSources]);

  // Toggle spatial audio
  const toggleSpatialAudio = useCallback(() => {
    setSpatialAudio(prev => !prev);
    audioSources.forEach((source) => {
      if (source.sound) {
        source.sound.spatialSound = !source.sound.spatialSound;
      }
    });
  }, [audioSources]);

  // Toggle visualization
  const toggleVisualization = useCallback(() => {
    setVisualizationEnabled(prev => !prev);
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed top-4 left-4 bg-slate-800 p-4 rounded-lg border border-slate-600 text-white z-50">
      <h3 className="text-lg font-semibold mb-3">Voice Chat</h3>

      {/* Recording Controls */}
      <div className="mb-4">
        <button
          onClick={toggleRecording}
          className={`px-4 py-2 rounded font-medium ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {/* Audio Settings */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Volume: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => updateVolume(parseFloat(e.target.value))}
            className="w-full"
            title="Volume control"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="spatialAudio"
            checked={spatialAudio}
            onChange={toggleSpatialAudio}
          />
          <label htmlFor="spatialAudio" className="text-sm">Spatial Audio</label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="visualization"
            checked={visualizationEnabled}
            onChange={toggleVisualization}
          />
          <label htmlFor="visualization" className="text-sm">Audio Visualization</label>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4 text-sm text-slate-300">
        Status: {isRecording ? 'Recording' : 'Inactive'}
        {audioSources.size > 0 && ` (${audioSources.size} source${audioSources.size > 1 ? 's' : ''})`}
      </div>
    </div>
  );
};

export default VoiceChat;
