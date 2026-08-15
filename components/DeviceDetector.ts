import { DeviceCapabilities } from './FeatureManager';

export interface HardwareInfo {
  gpu: {
    vendor: string;
    renderer: string;
    maxTextureSize: number;
    maxViewportDims: [number, number];
    extensions: string[];
  };
  cpu: {
    cores: number;
    platform: string;
  };
  memory: {
    ram: number; // MB
    gpuMemory?: number; // MB
  };
  display: {
    width: number;
    height: number;
    pixelRatio: number;
    colorDepth: number;
    refreshRate?: number;
  };
}

export interface NetworkInfo {
  type: 'slow' | 'fast' | 'unknown';
  downlink?: number; // Mbps
  effectiveType?: string;
  rtt?: number; // ms
}

export class DeviceDetector {
  private static instance: DeviceDetector;
  private capabilities: DeviceCapabilities | null = null;
  private hardwareInfo: HardwareInfo | null = null;
  private networkInfo: NetworkInfo | null = null;
  private lastUpdate: number = 0;
  private updateInterval: number = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): DeviceDetector {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector();
    }
    return DeviceDetector.instance;
  }

  // Detect all device capabilities
  async detectCapabilities(): Promise<DeviceCapabilities> {
    if (this.capabilities && Date.now() - this.lastUpdate < this.updateInterval) {
      return this.capabilities;
    }

    const [webCapabilities, hardwareInfo, networkInfo] = await Promise.all([
      this.detectWebCapabilities(),
      this.detectHardwareInfo(),
      this.detectNetworkInfo()
    ]);

    this.capabilities = {
      ...webCapabilities,
      gpuMemory: hardwareInfo.memory.gpuMemory || 512, // Default fallback
      cpuCores: hardwareInfo.cpu.cores,
      ram: hardwareInfo.memory.ram,
      networkType: networkInfo.type,
      batteryLevel: await this.getBatteryLevel(),
      touchEnabled: this.isTouchEnabled(),
      mobile: this.isMobileDevice()
    };

    this.hardwareInfo = hardwareInfo;
    this.networkInfo = networkInfo;
    this.lastUpdate = Date.now();

    return this.capabilities;
  }

  // Detect web platform capabilities
  private async detectWebCapabilities(): Promise<Omit<DeviceCapabilities, 'gpuMemory' | 'cpuCores' | 'ram' | 'networkType' | 'batteryLevel' | 'touchEnabled' | 'mobile'>> {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext;

    // Check for WebGPU support
    const webgpu = !!(navigator as any).gpu;

    // Enhanced WebXR detection with feature support
    const webxr = !!(navigator as any).xr;
    const webxrFeatures: string[] = [];
    if (webxr) {
      try {
        const xr = (navigator as any).xr;
        const vrSupported = await xr.isSessionSupported('immersive-vr');
        if (vrSupported) webxrFeatures.push('immersive-vr');
        const arSupported = await xr.isSessionSupported('immersive-ar');
        if (arSupported) webxrFeatures.push('immersive-ar');
        const inlineSupported = await xr.isSessionSupported('inline');
        if (inlineSupported) webxrFeatures.push('inline');
      } catch (e) {
        // WebXR not fully supported
      }
    }

    // WebRTC and WebAssembly checks
    const webrtc = !!(window.RTCPeerConnection || (window as any).webkitRTCPeerConnection);
    const webassembly = !!(window.WebAssembly);

    return {
      webgl: !!gl,
      webgl2: !!gl2,
      webxr,
      webrtc,
      webassembly
    };
  }

  // Detect hardware information
  private async detectHardwareInfo(): Promise<HardwareInfo> {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;

    const gpuInfo = {
      vendor: 'Unknown',
      renderer: 'Unknown',
      maxTextureSize: 2048,
      maxViewportDims: [2048, 2048] as [number, number],
      extensions: [] as string[]
    };

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuInfo.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
        gpuInfo.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
      }

      gpuInfo.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      gpuInfo.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      gpuInfo.extensions = gl.getSupportedExtensions() || [];
    }

    // CPU information
    const cpuInfo = {
      cores: navigator.hardwareConcurrency || 4,
      platform: navigator.platform
    };

    // Memory information
    const memoryInfo = (navigator as any).deviceMemory ?
      { ram: (navigator as any).deviceMemory * 1024 } : // GB to MB
      { ram: this.estimateMemorySize() };

    // GPU memory estimation based on renderer
    const gpuMemory = this.estimateGPUMemory(gpuInfo.renderer);

    return {
      gpu: gpuInfo,
      cpu: cpuInfo,
      memory: { ...memoryInfo, gpuMemory },
      display: {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth,
        refreshRate: this.detectRefreshRate()
      }
    };
  }

  // Detect network information
  private async detectNetworkInfo(): Promise<NetworkInfo> {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection;

    let networkType: 'slow' | 'fast' | 'unknown' = 'unknown';
    let downlink: number | undefined;
    let effectiveType: string | undefined;
    let rtt: number | undefined;

    if (connection) {
      downlink = connection.downlink;
      effectiveType = connection.effectiveType;
      rtt = connection.rtt;

      // Determine network type
      if (effectiveType) {
        if (['slow-2g', '2g'].includes(effectiveType)) {
          networkType = 'slow';
        } else if (['3g'].includes(effectiveType)) {
          networkType = 'slow';
        } else if (['4g', '5g'].includes(effectiveType)) {
          networkType = 'fast';
        }
      } else if (downlink) {
        networkType = downlink < 1 ? 'slow' : 'fast';
      }
    } else {
      // Fallback: measure connection speed
      networkType = await this.measureConnectionSpeed();
    }

    return {
      type: networkType,
      downlink,
      effectiveType,
      rtt
    };
  }

  // Estimate system memory size
  private estimateMemorySize(): number {
    // Rough estimation based on device type
    if (this.isMobileDevice()) {
      return 2048; // 2GB for mobile
    }

    // Desktop estimation
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 8) return 16384; // 16GB for high-end
    if (cores >= 4) return 8192;  // 8GB for mid-range
    return 4096; // 4GB for low-end
  }

  // Estimate GPU memory based on renderer string
  private estimateGPUMemory(renderer: string): number {
    const rendererLower = renderer.toLowerCase();

    // High-end GPUs
    if (rendererLower.includes('rtx') || rendererLower.includes('2080') ||
        rendererLower.includes('3080') || rendererLower.includes('3090') ||
        rendererLower.includes('radeon rx') || rendererLower.includes('vega')) {
      return 8192; // 8GB
    }

    // Mid-range GPUs
    if (rendererLower.includes('gtx') || rendererLower.includes('1060') ||
        rendererLower.includes('1070') || rendererLower.includes('1660') ||
        rendererLower.includes('2060') || rendererLower.includes('3060') ||
        rendererLower.includes('radeon') || rendererLower.includes('rx 5')) {
      return 4096; // 4GB
    }

    // Low-end GPUs
    if (rendererLower.includes('intel') || rendererLower.includes('uhd') ||
        rendererLower.includes('hd graphics') || rendererLower.includes('gt 1030')) {
      return 1024; // 1GB
    }

    // Mobile GPUs
    if (rendererLower.includes('mali') || rendererLower.includes('adreno') ||
        rendererLower.includes('powervr')) {
      return 512; // 512MB
    }

    return 2048; // Default 2GB
  }

  // Measure connection speed with a small test
  private async measureConnectionSpeed(): Promise<'slow' | 'fast' | 'unknown'> {
    try {
      const startTime = Date.now();
      const response = await fetch(window.location.origin + '/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = Date.now();

      if (response.ok) {
        const rtt = endTime - startTime;
        return rtt > 500 ? 'slow' : 'fast';
      }
    } catch (error) {
      console.warn('Connection speed test failed:', error);
    }

    return 'unknown';
  }

  // Detect display refresh rate
  private detectRefreshRate(): number | undefined {
    // This is approximate and may not be accurate
    if (window.screen && (window.screen as any).refreshRate) {
      return (window.screen as any).refreshRate;
    }

    // Fallback based on common refresh rates
    return 60; // Default assumption
  }

  // Get battery level if available
  private async getBatteryLevel(): Promise<number | undefined> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      }
    } catch (error) {
      console.warn('Battery detection failed:', error);
    }
    return undefined;
  }

  // Check if touch is enabled
  private isTouchEnabled(): boolean {
    return 'ontouchstart' in window ||
           navigator.maxTouchPoints > 0 ||
           (navigator as any).msMaxTouchPoints > 0;
  }

  // Check if device is mobile
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  // Get detailed hardware information
  getHardwareInfo(): HardwareInfo | null {
    return this.hardwareInfo;
  }

  // Get network information
  getNetworkInfo(): NetworkInfo | null {
    return this.networkInfo;
  }

  // Force refresh of capabilities
  async refreshCapabilities(): Promise<DeviceCapabilities> {
    this.lastUpdate = 0;
    return this.detectCapabilities();
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    if (!this.capabilities) return 50;

    let score = 0;

    // WebGL support (20 points)
    if (this.capabilities.webgl) score += 15;
    if (this.capabilities.webgl2) score += 5;

    // CPU cores (20 points)
    const cores = this.capabilities.cpuCores;
    if (cores >= 8) score += 20;
    else if (cores >= 4) score += 15;
    else if (cores >= 2) score += 10;
    else score += 5;

    // RAM (20 points)
    const ram = this.capabilities.ram;
    if (ram >= 8192) score += 20;
    else if (ram >= 4096) score += 15;
    else if (ram >= 2048) score += 10;
    else score += 5;

    // GPU memory (20 points)
    const gpuMem = this.capabilities.gpuMemory;
    if (gpuMem >= 4096) score += 20;
    else if (gpuMem >= 2048) score += 15;
    else if (gpuMem >= 1024) score += 10;
    else score += 5;

    // Network (10 points)
    if (this.capabilities.networkType === 'fast') score += 10;
    else if (this.capabilities.networkType === 'slow') score += 5;

    // Mobile penalty (10 points deduction)
    if (this.capabilities.mobile) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // Get recommended quality settings
  getRecommendedQuality(): 'low' | 'medium' | 'high' | 'ultra' {
    const score = this.getPerformanceScore();

    if (score >= 80) return 'ultra';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  // Check if device supports a specific feature
  supportsFeature(feature: keyof DeviceCapabilities): boolean {
    if (!this.capabilities) return false;

    const value = this.capabilities[feature];
    return typeof value === 'boolean' ? value : false;
  }

  // Get device fingerprint for analytics
  getDeviceFingerprint(): string {
    if (!this.hardwareInfo) return 'unknown';

    const { gpu, cpu, memory, display } = this.hardwareInfo;
    const fingerprint = [
      gpu.vendor,
      gpu.renderer,
      cpu.cores.toString(),
      memory.ram.toString(),
      display.width.toString(),
      display.height.toString(),
      this.capabilities?.mobile ? 'mobile' : 'desktop'
    ].join('|');

    // Simple hash for privacy
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  // Export capabilities as JSON
  exportCapabilities(): string {
    return JSON.stringify({
      capabilities: this.capabilities,
      hardwareInfo: this.hardwareInfo,
      networkInfo: this.networkInfo,
      performanceScore: this.getPerformanceScore(),
      recommendedQuality: this.getRecommendedQuality(),
      fingerprint: this.getDeviceFingerprint()
    }, null, 2);
  }

  // Dispose method to clean up resources
  dispose(): void {
    this.capabilities = null;
    this.hardwareInfo = null;
    this.networkInfo = null;
    this.lastUpdate = 0;

    // Clear the singleton instance
    DeviceDetector.instance = null as any;
  }
}
