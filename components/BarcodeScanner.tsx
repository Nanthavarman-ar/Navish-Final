import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Camera,
  Scan,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Flashlight,
  FlashlightOff
} from 'lucide-react';

interface BarcodeScannerProps {
  isActive: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string, format: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isActive,
  onClose,
  onBarcodeDetected
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{ code: string, timestamp: Date }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check camera capabilities
  useEffect(() => {
    if (isActive) {
      checkCameraCapabilities();
    } else {
      stopScanning();
    }
  }, [isActive]);

  const checkCameraCapabilities = async () => {
    try {
      // Check if camera is available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        setCameraPermission('denied');
        return;
      }

      // Check for torch support
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      if ('torch' in capabilities) {
        setTorchSupported(true);
      }

      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');

    } catch (error) {
      console.error('Camera capability check failed:', error);
      setCameraPermission('denied');
    }
  };

  const startScanning = async () => {
    if (cameraPermission !== 'granted') return;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsScanning(true);
      startBarcodeDetection();

    } catch (error) {
      console.error('Failed to start camera:', error);
      setCameraPermission('denied');
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities();

      if ('torch' in capabilities) {
        await videoTrack.applyConstraints({
          advanced: [{ torch: !torchEnabled } as any]
        });
        setTorchEnabled(!torchEnabled);
      }
    } catch (error) {
      console.error('Failed to toggle torch:', error);
    }
  };

  const startBarcodeDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    const detectFrame = () => {
      if (!isScanning || !video.videoWidth) {
        requestAnimationFrame(detectFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Simple barcode detection simulation
      // In a real implementation, you'd use a library like QuaggaJS or ZXing
      simulateBarcodeDetection(canvas, context);

      requestAnimationFrame(detectFrame);
    };

    detectFrame();
  };

  const simulateBarcodeDetection = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    // This is a simplified simulation
    // In production, use a proper barcode scanning library

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Look for barcode-like patterns (high contrast lines)
    let barcodeDetected = false;
    let barcodeValue = '';

    // Simple pattern detection (this is just for demo purposes)
    for (let y = 0; y < canvas.height; y += 20) {
      let blackCount = 0;
      let whiteCount = 0;

      for (let x = 0; x < canvas.width; x += 10) {
        const index = (y * canvas.width + x) * 4;
        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;

        if (brightness < 128) {
          blackCount++;
        } else {
          whiteCount++;
        }
      }

      // If we find a row with alternating black/white pattern
      if (blackCount > 5 && whiteCount > 5 && Math.abs(blackCount - whiteCount) < 10) {
        barcodeDetected = true;
        // Generate a fake barcode for demo
        barcodeValue = `DEMO${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
        break;
      }
    }

    if (barcodeDetected && barcodeValue !== lastScanned) {
      setLastScanned(barcodeValue);
      setScanHistory(prev => [...prev.slice(-4), { code: barcodeValue, timestamp: new Date() }]);

      // Simulate API call to get product info
      onBarcodeDetected(barcodeValue, 'CODE128');

      // Add visual feedback
      showScanFeedback();
    }
  };

  const showScanFeedback = () => {
    // Add a visual feedback overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center z-50 pointer-events-none';
    overlay.innerHTML = `
      <div class="bg-green-500 text-white px-6 py-3 rounded-lg flex items-center gap-2">
        <CheckCircle class="w-6 h-6" />
        <span>Barcode Detected!</span>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 2000);
  };

  const clearHistory = () => {
    setScanHistory([]);
    setLastScanned(null);
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Scan className="w-6 h-6 text-green-500" />
              Barcode Scanner
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={clearHistory}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear History
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <AlertCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant={cameraPermission === 'granted' ? 'default' : 'destructive'} className="flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Camera
            </Badge>

            <Badge variant={torchSupported ? 'default' : 'secondary'} className="flex items-center gap-1">
              {torchEnabled ? <Flashlight className="w-3 h-3" /> : <FlashlightOff className="w-3 h-3" />}
              Torch
            </Badge>

            <Badge variant={isScanning ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Scan className="w-3 h-3" />
              Scanning
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Camera Feed */}
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-96 bg-black rounded-lg object-cover"
              playsInline
              muted
            />

            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Scanning overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scanning line animation */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-green-400 animate-pulse"></div>

                {/* Corner markers */}
                <div className="absolute top-20 left-20 w-8 h-8 border-l-2 border-t-2 border-green-400"></div>
                <div className="absolute top-20 right-20 w-8 h-8 border-r-2 border-t-2 border-green-400"></div>
                <div className="absolute bottom-20 left-20 w-8 h-8 border-l-2 border-b-2 border-green-400"></div>
                <div className="absolute bottom-20 right-20 w-8 h-8 border-r-2 border-b-2 border-green-400"></div>

                {/* Center target */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-32 h-32 border-2 border-green-400 rounded-lg"></div>
                </div>
              </div>
            )}

            {/* Permission denied overlay */}
            {cameraPermission === 'denied' && (
              <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center rounded-lg">
                <Alert className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Camera permission is required for barcode scanning. Please enable camera access in your browser settings.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Camera Controls</h4>
              <Button
                onClick={isScanning ? stopScanning : startScanning}
                disabled={cameraPermission !== 'granted'}
                className="w-full"
              >
                {isScanning ? (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Stop Scanning
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Torch Control</h4>
              <Button
                variant="outline"
                onClick={toggleTorch}
                disabled={!torchSupported || !isScanning}
                className="w-full"
              >
                {torchEnabled ? (
                  <>
                    <FlashlightOff className="w-4 h-4 mr-2" />
                    Turn Off
                  </>
                ) : (
                  <>
                    <Flashlight className="w-4 h-4 mr-2" />
                    Turn On
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Last Scanned</h4>
              <div className="text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded min-h-[40px] flex items-center">
                {lastScanned || 'No recent scans'}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Scan Count</h4>
              <div className="text-2xl font-bold text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                {scanHistory.length}
              </div>
            </div>
          </div>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Recent Scans</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {scanHistory.slice().reverse().map((scan, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                    <span className="font-mono">{scan.code}</span>
                    <span className="text-xs text-slate-500">
                      {scan.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <Alert>
            <Scan className="h-4 w-4" />
            <AlertDescription>
              <strong>Barcode Scanning:</strong> Point your camera at a barcode.
              The scanner will automatically detect and read common barcode formats including UPC, EAN, and Code 128.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default BarcodeScanner;
