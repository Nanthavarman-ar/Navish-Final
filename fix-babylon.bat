@echo off
echo Fixing Babylon.js dependencies...
echo.

echo Removing node_modules...
rmdir /s /q node_modules 2>nul
if %errorlevel% neq 0 (
    echo Warning: Could not remove node_modules completely. Some files may be in use.
)

echo Removing package-lock.json...
del package-lock.json 2>nul

echo Clearing npm cache...
npm cache clean --force
if %errorlevel% neq 0 (
    echo Error: Failed to clear npm cache.
    pause
    exit /b 1
)

echo Installing Babylon.js version 7.24.0...
npm install @babylonjs/core@7.24.0 @babylonjs/gui@7.24.0 @babylonjs/loaders@7.24.0 @babylonjs/materials@7.24.0 @babylonjs/post-processes@7.24.0 @babylonjs/procedural-textures@7.24.0 @babylonjs/serializers@7.24.0 @babylonjs/inspector@7.24.0 @babylonjs/node-editor@7.24.0
if %errorlevel% neq 0 (
    echo Error: Failed to install Babylon.js packages.
    pause
    exit /b 1
)

echo Installing other dependencies...
npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install other dependencies.
    pause
    exit /b 1
)

echo.
echo Babylon.js fix complete!
echo Please restart the development server with: npm run dev
echo.
pause
