import React, { useState, useRef, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';

interface ARCameraViewProps {
  scene: BABYLON.Scene;
  onModelPlace?: (position: { x: number; y: number; z: number }) => void;
}

const ARCameraView: React.FC<ARCameraViewProps> = ({ scene, onModelPlace }) => {
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsActive(true);
    } catch (error) {
      console.error('Camera access denied:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setStream(null);
    }
    setIsActive(false);
  };

  const placeModel = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current) return;
    const rect = videoRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
    const z = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
    
    if (onModelPlace) {
      onModelPlace({ x, y: 0, z });
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-white">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">AR Camera</h3>
        <button
          onClick={isActive ? stopCamera : startCamera}
          className={`px-3 py-1 rounded text-xs ${isActive ? 'bg-red-600' : 'bg-green-600'}`}
        >
          {isActive ? 'Stop' : 'Start'} Camera
        </button>
      </div>

      {isActive && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            onClick={placeModel}
            className="w-full h-48 bg-black rounded cursor-crosshair"
          />
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 p-2 rounded text-xs">
            Click to place model
          </div>
        </div>
      )}

      {!isActive && (
        <div className="w-full h-48 bg-gray-700 rounded flex items-center justify-center text-gray-400">
          Camera not active
        </div>
      )}
    </div>
  );
};

export default ARCameraView;