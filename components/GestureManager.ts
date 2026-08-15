import { Engine, Scene, Vector3, Color3, StandardMaterial, Mesh } from '@babylonjs/core';
import { DeviceDetector } from './DeviceDetector';

export interface GestureData {
  gesture: string;
  confidence: number;
  timestamp: number;
  handPosition?: Vector3;
  handOrientation?: Vector3;
}

export interface GestureConfig {
  enableCamera: boolean;
  enableHandTracking: boolean;
  gestureSensitivity: number;
  recognitionInterval: number;
}

export interface GestureCallback {
  (gesture: GestureData): void;
}

export class GestureManager {
  private engine: Engine;
  private scene: Scene;
  private deviceDetector: DeviceDetector;
  private config: GestureConfig;
  private isActive: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private recognitionInterval: number | null = null;
  private gestureCallbacks: GestureCallback[] = [];
  private lastGesture: GestureData | null = null;
  private gestureHistory: GestureData[] = [];

  constructor(engine: Engine, scene: Scene, deviceDetector: DeviceDetector) {
    this.engine = engine;
    this.scene = scene;
    this.deviceDetector = deviceDetector;

    this.config = {
      enableCamera: true,
      enableHandTracking: true,
      gestureSensitivity: 0.7,
      recognitionInterval: 100 // ms
    };

    this.initializeGestureRecognition();
  }

  // Initialize gesture recognition system
  private async initializeGestureRecognition(): Promise<void> {
    if (!this.config.enableCamera) return;

    try {
      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Camera not supported for gesture recognition');
        return;
      }

      // Create video and canvas elements for gesture processing
      this.videoElement = document.createElement('video');
      this.videoElement.style.display = 'none';
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.style.display = 'none';
      this.canvasElement.width = 320;
      this.canvasElement.height = 240;

      document.body.appendChild(this.videoElement);
      document.body.appendChild(this.canvasElement);

      console.log('Gesture recognition initialized');
    } catch (error) {
      console.error('Failed to initialize gesture recognition:', error);
    }
  }

  // Start gesture recognition
  async startGestureRecognition(): Promise<boolean> {
    if (this.isActive) return true;

    try {
      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 320,
          height: 240,
          facingMode: 'user'
        }
      });

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
      }

      this.isActive = true;

      // Start recognition loop
      this.startRecognitionLoop();

      console.log('Gesture recognition started');
      return true;
    } catch (error) {
      console.error('Failed to start gesture recognition:', error);
      this.isActive = false;
      return false;
    }
  }

  // Stop gesture recognition
  stopGestureRecognition(): void {
    if (!this.isActive) return;

    this.isActive = false;

    // Stop recognition loop
    if (this.recognitionInterval) {
      clearInterval(this.recognitionInterval);
      this.recognitionInterval = null;
    }

    // Stop camera stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Clear video source
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    console.log('Gesture recognition stopped');
  }

  // Start recognition loop
  private startRecognitionLoop(): void {
    this.recognitionInterval = window.setInterval(() => {
      if (this.isActive) {
        this.processFrame();
      }
    }, this.config.recognitionInterval);
  }

  // Process video frame for gesture recognition
  private async processFrame(): Promise<void> {
    if (!this.videoElement || !this.canvasElement || !this.isActive) return;

    const canvas = this.canvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

    // Process the frame for gesture recognition
    const gesture = await this.recognizeGesture(canvas);

    if (gesture && gesture.confidence >= this.config.gestureSensitivity) {
      // Check if this is a new gesture (not a repeat)
      if (!this.lastGesture ||
          gesture.gesture !== this.lastGesture.gesture ||
          gesture.timestamp - this.lastGesture.timestamp > 1000) {

        this.lastGesture = gesture;
        this.gestureHistory.push(gesture);

        // Keep only recent history
        if (this.gestureHistory.length > 50) {
          this.gestureHistory.shift();
        }

        // Notify callbacks
        this.notifyGestureCallbacks(gesture);
      }
    }
  }

  // Recognize gesture from canvas frame
  private async recognizeGesture(canvas: HTMLCanvasElement): Promise<GestureData | null> {
    // This is a simplified gesture recognition implementation
    // In a real implementation, you would use a machine learning model or computer vision library

    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
    if (!imageData) return null;

    // Simple gesture detection based on image analysis
    const gesture = this.analyzeImageForGestures(imageData);

    if (gesture) {
      return {
        gesture: gesture.type,
        confidence: gesture.confidence,
        timestamp: Date.now(),
        handPosition: gesture.position,
        handOrientation: gesture.orientation
      };
    }

    return null;
  }

  // Analyze image data for gestures
  private analyzeImageForGestures(imageData: ImageData): any {
    const { data, width, height } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;

    // Simple skin tone detection (rough approximation)
    let skinPixels = 0;
    let handCenterX = 0;
    let handCenterY = 0;

    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // Simple skin detection: check if pixel is in skin tone range
        if (r > 60 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15) {
          skinPixels++;
          handCenterX += x;
          handCenterY += y;
        }
      }
    }

    if (skinPixels > 100) { // Threshold for hand detection
      handCenterX /= skinPixels;
      handCenterY /= skinPixels;

      // Determine gesture based on hand position and shape
      const relativeX = (handCenterX - centerX) / centerX;
      const relativeY = (handCenterY - centerY) / centerY;

      // Simple gesture classification
      let gestureType = 'unknown';
      let confidence = 0.5;

      if (Math.abs(relativeX) < 0.3 && Math.abs(relativeY) < 0.3) {
        gestureType = 'hand_open';
        confidence = 0.8;
      } else if (relativeY < -0.2) {
        gestureType = 'thumbs_up';
        confidence = 0.7;
      } else if (relativeY > 0.2) {
        gestureType = 'thumbs_down';
        confidence = 0.7;
      } else if (relativeX < -0.3) {
        gestureType = 'swipe_left';
        confidence = 0.6;
      } else if (relativeX > 0.3) {
        gestureType = 'swipe_right';
        confidence = 0.6;
      }

      return {
        type: gestureType,
        confidence,
        position: new Vector3(handCenterX / width, handCenterY / height, 0),
        orientation: new Vector3(0, 0, 0)
      };
    }

    return null;
  }

  // Register gesture callback
  onGestureRecognized(callback: GestureCallback): void {
    this.gestureCallbacks.push(callback);
  }

  // Remove gesture callback
  removeGestureCallback(callback: GestureCallback): void {
    const index = this.gestureCallbacks.indexOf(callback);
    if (index > -1) {
      this.gestureCallbacks.splice(index, 1);
    }
  }

  // Notify all registered callbacks
  private notifyGestureCallbacks(gesture: GestureData): void {
    this.gestureCallbacks.forEach(callback => {
      try {
        callback(gesture);
      } catch (error) {
        console.error('Gesture callback error:', error);
      }
    });
  }

  // Get gesture history
  getGestureHistory(limit: number = 10): GestureData[] {
    return this.gestureHistory.slice(-limit);
  }

  // Clear gesture history
  clearGestureHistory(): void {
    this.gestureHistory = [];
    this.lastGesture = null;
  }

  // Update gesture configuration
  updateConfig(newConfig: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): GestureConfig {
    return { ...this.config };
  }

  // Check if gesture recognition is active
  isGestureRecognitionActive(): boolean {
    return this.isActive;
  }

  // Simulate gesture for testing (development only)
  simulateGesture(gestureType: string, confidence: number = 0.8): void {
    const gesture: GestureData = {
      gesture: gestureType,
      confidence,
      timestamp: Date.now(),
      handPosition: new Vector3(Math.random(), Math.random(), 0),
      handOrientation: new Vector3(0, 0, 0)
    };

    this.gestureHistory.push(gesture);
    this.notifyGestureCallbacks(gesture);
  }

  // Create visual feedback for gestures
  createGestureFeedback(gesture: GestureData): Mesh {
    // Create a visual indicator for the recognized gesture
    const feedbackMesh = Mesh.CreatePlane(`gesture_${gesture.gesture}`, 1, this.scene);
    feedbackMesh.position = new Vector3(0, 2, -3); // Position in front of camera

    const material = new StandardMaterial(`gesture_mat_${gesture.gesture}`, this.scene);
    material.diffuseColor = new Color3(0, 1, 0);
    material.alpha = 0.7;
    feedbackMesh.material = material;

    // Auto-remove after 2 seconds
    setTimeout(() => {
      feedbackMesh.dispose();
    }, 2000);

    return feedbackMesh;
  }

  // Get supported gestures
  getSupportedGestures(): string[] {
    return [
      'thumbs_up',
      'thumbs_down',
      'hand_open',
      'hand_closed',
      'swipe_left',
      'swipe_right',
      'swipe_up',
      'swipe_down',
      'pinch',
      'spread'
    ];
  }

  // Dispose resources
  dispose(): void {
    this.stopGestureRecognition();

    // Remove DOM elements
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
    if (this.canvasElement && this.canvasElement.parentNode) {
      this.canvasElement.parentNode.removeChild(this.canvasElement);
    }

    this.gestureCallbacks = [];
    this.gestureHistory = [];
    this.lastGesture = null;
  }
}
