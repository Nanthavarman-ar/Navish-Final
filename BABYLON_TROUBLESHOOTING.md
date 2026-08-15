# Babylon.js Troubleshooting Guide

## Current Issue
The error `Cannot read properties of undefined (reading 'trackUbosInFrame')` indicates a Babylon.js engine initialization problem.

## Quick Fixes

### 1. Restart Development Server
```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

### 2. Clear Cache and Reinstall
```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json
# Or on Windows:
rmdir /s node_modules
del package-lock.json

# Reinstall dependencies
npm install

# Restart server
npm run dev
```

### 3. Use the Fix Script
```bash
# Run the provided fix script
fix-babylon.bat
```

## Browser Compatibility

### Supported Browsers
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### WebGL Requirements
- WebGL 2.0 support (preferred)
- WebGL 1.0 support (minimum)
- Hardware acceleration enabled

### Check WebGL Support
1. Visit: https://get.webgl.org/
2. Ensure both WebGL 1 and 2 are working

## Common Solutions

### 1. Enable Hardware Acceleration
**Chrome:**
- Go to Settings > Advanced > System
- Enable "Use hardware acceleration when available"
- Restart browser

**Firefox:**
- Go to about:config
- Set `webgl.force-enabled` to `true`
- Restart browser

### 2. Update Graphics Drivers
- NVIDIA: GeForce Experience or nvidia.com
- AMD: AMD Software or amd.com
- Intel: Intel Driver & Support Assistant

### 3. Browser Flags (Chrome)
Add these flags to Chrome shortcut:
```
--enable-webgl2-compute-context
--enable-unsafe-webgl
--ignore-gpu-blacklist
```

## Development Environment

### Node.js Version
- Recommended: Node.js 18+ or 20+
- Check: `node --version`

### Dependencies Status
Current Babylon.js version: 8.26.1
- If issues persist, we can downgrade to 7.24.0

## Testing

### 1. Basic WebGL Test
The home page now includes a simple Babylon.js test. Check if it shows "Ready!" status.

### 2. Console Errors
Open browser DevTools (F12) and check for:
- WebGL context errors
- Babylon.js initialization errors
- Memory/GPU errors

## Alternative Solutions

### 1. Use Different Browser
Try the application in:
- Chrome (recommended)
- Firefox
- Edge

### 2. Disable Extensions
Temporarily disable browser extensions that might interfere with WebGL.

### 3. Incognito/Private Mode
Test in incognito mode to rule out cache/extension issues.

## System Requirements

### Minimum
- 4GB RAM
- DirectX 11 compatible GPU
- WebGL 1.0 support

### Recommended
- 8GB+ RAM
- Dedicated GPU (NVIDIA/AMD)
- WebGL 2.0 support

## Getting Help

If the issue persists:
1. Check the browser console for specific error messages
2. Note your system specifications
3. Try the simple Babylon.js test on the home page
4. Report which browsers you've tested

## Files Modified
- `components/BabylonWorkspace.tsx` - Improved error handling
- `components/BabylonErrorBoundary.tsx` - Added error boundary
- `components/SimpleBabylonTest.tsx` - Basic functionality test
- `vite.config.ts` - Optimized Babylon.js bundling
- `App.tsx` - Added error boundary wrapper