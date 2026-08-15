import React, { useState, useEffect } from 'react';
import { Camera, Scene } from '@babylonjs/core';

interface ControlsState {
  wasd: boolean;
  mouse: boolean;
  touch: boolean;
  joystick: boolean;
  mobile: boolean;
  tablet: boolean;
  ios: boolean;
}

interface MovementControlCheckerProps {
  camera: Camera | null;
  scene: Scene | null;
}

const MovementControlChecker: React.FC<MovementControlCheckerProps> = ({ camera, scene }) => {
  const [controls, setControls] = useState<ControlsState>({
    wasd: false,
    mouse: false,
    touch: false,
    joystick: false,
    mobile: false,
    tablet: false,
    ios: false
  });
  const [activeInputs, setActiveInputs] = useState<string[]>([]);

  useEffect(() => {
    if (!camera || !scene) return;

    const checkControls = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth > 768;
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      setControls({
        wasd: true, // Always available
        mouse: !isMobile,
        touch: isMobile || isTablet,
        joystick: !!navigator.getGamepads,
        mobile: isMobile,
        tablet: isTablet,
        ios: isIOS
      });
    };

    // WASD Controls
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setActiveInputs(prev => [...prev.filter(i => i !== key), key]);
        
        const speed = 0.1;
        switch(key) {
          case 'w': camera.position.z += speed; break;
          case 's': camera.position.z -= speed; break;
          case 'a': camera.position.x -= speed; break;
          case 'd': camera.position.x += speed; break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveInputs(prev => prev.filter(i => i !== key));
    };

    // Touch Controls
    const handleTouchStart = (e: TouchEvent) => {
      setActiveInputs(prev => [...prev, 'touch']);
    };

    const handleTouchEnd = () => {
      setActiveInputs(prev => prev.filter(i => i !== 'touch'));
    };

    // Gamepad Check
    const checkGamepad = () => {
      const gamepads = navigator.getGamepads();
      const hasActiveGamepad = Array.from(gamepads).some(gp => gp?.connected);
      if (hasActiveGamepad) {
        setActiveInputs(prev => prev.includes('gamepad') ? prev : [...prev, 'gamepad']);
      } else {
        setActiveInputs(prev => prev.filter(i => i !== 'gamepad'));
      }
    };

    checkControls();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    
    const gamepadInterval = setInterval(checkGamepad, 1000);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      clearInterval(gamepadInterval);
    };
  }, [camera, scene]);

  const getStatus = (available: boolean, active = false) => {
    if (active) return '🟢';
    return available ? '✅' : '❌';
  };

  return (
    <div className="fixed bottom-20 left-4 bg-slate-800 border border-slate-600 rounded-lg p-3 z-50 text-xs text-white">
      <div className="font-bold mb-2">Movement Controls</div>
      <div className="space-y-1">
        <div>WASD: {getStatus(controls.wasd, activeInputs.some(i => ['w','a','s','d'].includes(i)))}</div>
        <div>Mouse: {getStatus(controls.mouse)}</div>
        <div>Touch: {getStatus(controls.touch, activeInputs.includes('touch'))}</div>
        <div>Joystick: {getStatus(controls.joystick, activeInputs.includes('gamepad'))}</div>
        <div>Mobile: {getStatus(controls.mobile)}</div>
        <div>Tablet: {getStatus(controls.tablet)}</div>
        <div>iOS: {getStatus(controls.ios)}</div>
      </div>
      {activeInputs.length > 0 && (
        <div className="mt-2 text-green-400">
          Active: {activeInputs.join(', ')}
        </div>
      )}
    </div>
  );
};

export default MovementControlChecker;