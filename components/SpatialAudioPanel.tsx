import React, { useState, useRef, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { X, Volume2, VolumeX, Play, Pause, Music, Upload } from 'lucide-react';
import { Button } from './ui/button';
import type { AudioManager } from './AudioManager';

interface SpatialAudioPanelProps {
  audioManager: AudioManager | null;
  onClose: () => void;
}

// Lets whoever is viewing the workspace (admin or client) upload their own
// music/audio track and play it back with real volume/mute control, instead
// of the panel just saying "Spatial audio active" with nothing to actually
// do. Uses AudioManager.createAmbientSound(), which was already fully built
// but never wired to any UI.
const SpatialAudioPanel: React.FC<SpatialAudioPanelProps> = ({ audioManager, onClose }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const soundRef = useRef<BABYLON.Sound | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const volumeBeforeMuteRef = useRef(0.7);

  const cleanup = () => {
    soundRef.current?.stop();
    soundRef.current?.dispose();
    soundRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => cleanup, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioManager) return;

    cleanup();
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    const sound = audioManager.createAmbientSound(`user-track-${Date.now()}`, url, {
      volume,
      loop: true,
      autoplay: true,
    });
    soundRef.current = sound;
    setFileName(file.name);
    setIsPlaying(!!sound);
    setIsMuted(false);
    e.target.value = '';
  };

  const togglePlay = () => {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) {
      sound.pause();
    } else {
      sound.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    volumeBeforeMuteRef.current = v;
    if (isMuted) setIsMuted(false);
    soundRef.current?.setVolume(v);
  };

  const toggleMute = () => {
    const sound = soundRef.current;
    if (!sound) return;
    if (isMuted) {
      sound.setVolume(volumeBeforeMuteRef.current);
      setIsMuted(false);
    } else {
      volumeBeforeMuteRef.current = volume;
      sound.setVolume(0);
      setIsMuted(true);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 bg-slate-800 border border-slate-600 rounded-lg text-white shadow-xl">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm">Spatial Audio</h3>
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose} aria-label="Close Spatial Audio">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 space-y-3">
        {!audioManager && (
          <p className="text-xs text-amber-400">Audio system isn't ready yet - try again in a moment.</p>
        )}

        <label className="flex items-center justify-center gap-2 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded cursor-pointer text-sm transition-colors">
          <Upload className="w-3.5 h-3.5" />
          {fileName ? 'Change track' : 'Upload music/audio'}
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={!audioManager} />
        </label>

        {fileName && (
          <>
            <p className="text-xs text-slate-400 truncate" title={fileName}>Now playing: {fileName}</p>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={togglePlay} className="h-8 w-8 p-0">
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
              <Button size="sm" variant="outline" onClick={toggleMute} className="h-8 w-8 p-0">
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1 accent-cyan-500"
                aria-label="Volume"
              />
              <span className="text-xs text-slate-400 w-8 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SpatialAudioPanel;
