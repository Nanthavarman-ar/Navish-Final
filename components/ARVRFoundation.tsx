import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Camera,
  Eye,
  Scan,
  RotateCcw,
  Maximize2,
  Smartphone,
  Glasses,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import * as THREE from 'three';

interface ARVRFoundationProps {
  isActive: boolean;
  onClose: () => void;
  mode: 'ar' | 'vr';
}

const ARVRFoundation: React.FC<ARVRFoundationProps> = ({
  isActive,
  onClose,
  mode
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Check device capabilities
  useEffect(() => {
    if (isActive) {
      checkCapabilities();
      initializeThreeJS();
    }
  }, [isActive, mode]);

  const checkCapabilities = async () => {
    // Check VR support
    if ('xr' in navigator) {
      const isSupported = await navigator.xr?.isSessionSupported('immersive-vr');
      setVrSupported(!!isSupported);
    }

    // Check AR support (basic camera check)
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      setArSupported(true);
    }

    // Request camera permission for AR
    if (mode === 'ar') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setCameraPermission('granted');
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        setCameraPermission('denied');
      }
    }
  };

  const initializeThreeJS = () => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue for AR/VR
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 3); // Eye level height
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    // Add basic environment
    createBasicEnvironment(scene);

    // Start render loop
    const animate = () => {
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });
    };
    animate();

    setIsInitialized(true);
  };

  const createBasicEnvironment = (scene: THREE.Scene) => {
    // Create a simple room/floor for VR context
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    scene.add(floor);

    // Add some basic furniture outlines
    const tableGeometry = new THREE.BoxGeometry(2, 0.1, 1);
    const tableMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(0, 0.4, 0);
    scene.add(table);

    // Add food item placeholder spheres
    for (let i = 0; i < 5; i++) {
      const foodGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const foodMaterial = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
      });
      const foodItem = new THREE.Mesh(foodGeometry, foodMaterial);
      foodItem.position.set(
        (Math.random() - 0.5) * 4,
        0.5,
        (Math.random() - 0.5) * 4
      );
      scene.add(foodItem);
    }
  };

  const startARSession = async () => {
    if (!rendererRef.current || cameraPermission !== 'granted') return;

    try {
      setIsScanning(true);
      const sessionInit = {
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      };

      const session = await navigator.xr?.requestSession('immersive-ar', sessionInit);
      if (session) {
        await rendererRef.current.xr.setSession(session);
      }
    } catch (error) {
      console.error('Failed to start AR session:', error);
      setIsScanning(false);
    }
  };

  const startVRSession = async () => {
    if (!rendererRef.current || !vrSupported) return;

    try {
      const session = await navigator.xr?.requestSession('immersive-vr');
      if (session) {
        await rendererRef.current.xr.setSession(session);
      }
    } catch (error) {
      console.error('Failed to start VR session:', error);
    }
  };

  const stopSession = async () => {
    if (rendererRef.current?.xr.getSession()) {
      await rendererRef.current.xr.getSession()?.end();
    }
    setIsScanning(false);
  };

  const resetView = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 1.6, 3);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              {mode === 'ar' ? (
                <Camera className="w-6 h-6 text-blue-500" />
              ) : (
                <Glasses className="w-6 h-6 text-purple-500" />
              )}
              {mode === 'ar' ? 'AR Food Scanner' : 'VR Inventory View'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={resetView}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset View
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <AlertCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant={isInitialized ? 'default' : 'destructive'} className="flex items-center gap-1">
              {isInitialized ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              3D Engine
            </Badge>

            <Badge variant={arSupported ? 'default' : 'destructive'} className="flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              AR Support
            </Badge>

            <Badge variant={vrSupported ? 'default' : 'destructive'} className="flex items-center gap-1">
              <Glasses className="w-3 h-3" />
              VR Support
            </Badge>

            <Badge variant={cameraPermission === 'granted' ? 'default' : 'destructive'} className="flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Camera
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 3D Scene Container */}
          <div
            ref={mountRef}
            className="w-full h-96 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative"
            style={{ minHeight: '400px' }}
          >
            {!isInitialized && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-slate-600 dark:text-slate-400">Initializing {mode.toUpperCase()}...</p>
                </div>
              </div>
            )}

            {isInitialized && mode === 'ar' && cameraPermission === 'denied' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <Alert className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Camera permission is required for AR features. Please enable camera access and refresh.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Session Controls</h4>
              <div className="flex gap-2">
                {mode === 'ar' ? (
                  <Button
                    onClick={isScanning ? stopSession : startARSession}
                    disabled={!arSupported || cameraPermission !== 'granted'}
                    className="flex-1"
                  >
                    {isScanning ? (
                      <>
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Stop AR
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Start AR
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={startVRSession}
                    disabled={!vrSupported}
                    className="flex-1"
                  >
                    <Glasses className="w-4 h-4 mr-2" />
                    Enter VR
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Food Detection</h4>
              <Button variant="outline" className="w-full" disabled={!isScanning}>
                <Scan className="w-4 h-4 mr-2" />
                Scan for Food Items
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">View Options</h4>
              <Button variant="outline" className="w-full">
                <Maximize2 className="w-4 h-4 mr-2" />
                Fullscreen
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{mode === 'ar' ? 'AR Mode:' : 'VR Mode:'}</strong>{' '}
              {mode === 'ar'
                ? 'Point your camera at food items to scan them. Move slowly for best results.'
                : 'Use VR controllers to navigate and interact with your 3D food inventory.'
              }
            </AlertDescription>
          </Alert>

          {/* Feature Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Camera className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-sm font-medium">Food Recognition</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">AI-powered scanning</div>
            </div>

            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Scan className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-sm font-medium">Barcode Reader</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Quick item entry</div>
            </div>

            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Eye className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-sm font-medium">3D Visualization</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Immersive inventory</div>
            </div>

            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-sm font-medium">Smart Labels</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">AR expiry info</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ARVRFoundation;
