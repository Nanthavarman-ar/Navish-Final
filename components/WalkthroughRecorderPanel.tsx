import React, { useState, useRef, useCallback } from 'react';
import { Engine } from '@babylonjs/core';
import { X, Circle, Square, Download, Video } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';

interface WalkthroughRecorderPanelProps {
  engine: Engine;
  onClose: () => void;
}

// Records the actual rendered 3D canvas output using native browser APIs
// (canvas.captureStream + MediaRecorder) - no extra video-encoding library needed,
// and it captures exactly what's on screen, camera moves, effects, lighting and all.
const WalkthroughRecorderPanel: React.FC<WalkthroughRecorderPanelProps> = ({ engine, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isSupported] = useState(() => typeof MediaRecorder !== 'undefined');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(() => {
    const canvas = engine.getRenderingCanvas();
    if (!canvas || !isSupported) {
      showToast.error('Recording is not supported in this browser');
      return;
    }

    try {
      const stream = (canvas as any).captureStream(30); // 30fps
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setElapsedSec(0);
      setDownloadUrl(null);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
      showToast.success('Recording started', 'Move around the scene to capture your walkthrough');
    } catch (error) {
      console.error('Failed to start recording:', error);
      showToast.error('Failed to start recording');
    }
  }, [engine, isSupported]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    showToast.success('Recording stopped');
  }, []);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `naviz-walkthrough-${Date.now()}.webm`;
    a.click();
  };

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-4 left-4 z-40 w-72 max-w-[90vw] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-red-400" />
          <h3 className="font-display font-semibold">Record Walkthrough</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {!isSupported && (
          <p className="text-xs text-amber-400">Video recording isn't supported in this browser.</p>
        )}

        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording · <span className="font-technical">{formatTime(elapsedSec)}</span>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Captures exactly what's on screen as you navigate - move the camera, toggle lighting, walk through the space.
        </p>

        {!isRecording ? (
          <Button size="sm" className="w-full" disabled={!isSupported} onClick={startRecording}>
            <Circle className="w-3.5 h-3.5 mr-1 fill-current" /> Start Recording
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={stopRecording}>
            <Square className="w-3.5 h-3.5 mr-1 fill-current" /> Stop Recording
          </Button>
        )}

        {downloadUrl && (
          <Button size="sm" variant="outline" className="w-full" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5 mr-1" /> Download Video
          </Button>
        )}
      </div>
    </div>
  );
};

export default WalkthroughRecorderPanel;
