@echo off
echo Cleaning up duplicate Babylon workspace files...

REM Backup important files first
if not exist "backup" mkdir backup
copy "components\BabylonWorkspace.old.tsx" "backup\" 2>nul
copy "components\NewBabylonWorkspace.tsx" "backup\" 2>nul
copy "src\integrated\BabylonWorkspace.tsx" "backup\" 2>nul

REM Remove duplicate workspace files
del "components\BabylonWorkspace.old.tsx" 2>nul
del "components\NewBabylonWorkspace.tsx" 2>nul
del "src\integrated\BabylonWorkspace.tsx" 2>nul

REM Remove other duplicate/unused files
del "components\EnhancedBabylonWorkspace.tsx" 2>nul
del "components\IntegratedWorkspace.tsx" 2>nul
del "components\PerfectWorkspace.tsx" 2>nul
del "components\OptimizedWorkspaceLayout.tsx" 2>nul

REM Clean up old test files
del "components\BabylonWorkspaceButtonTest.tsx" 2>nul
del "components\ButtonFunctionTest.jsx" 2>nul
del "components\ButtonTestRunner.tsx" 2>nul
del "components\SimpleBabylonTest.tsx" 2>nul
del "components\PropertyInspectorTest.jsx" 2>nul

REM Remove duplicate manager files
del "components\MaterialManager.ts" 2>nul
del "components\MaterialManagerWrapper.tsx" 2>nul

REM Clean up old TODO files
del "TODO_*.md" 2>nul

echo Cleanup completed. Backup files saved in 'backup' folder.
echo.
echo Next steps:
echo 1. Update imports in App.tsx to use UnifiedBabylonWorkspace
echo 2. Update any other files that import the old workspace components
echo 3. Test the unified workspace functionality
echo.
pause