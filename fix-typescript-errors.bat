@echo off
echo Fixing TypeScript errors...

REM Fix 1: Export missing exports from featureCategories
echo Fixing featureCategories exports...
node -e "const fs=require('fs');let c=fs.readFileSync('config/featureCategories.tsx','utf8');c=c.replace('export const featureCategories','export const featureCategoriesArray=Object.values(featureCategories).flat();\nexport const FEATURE_CATEGORIES=Object.keys(featureCategories);\nexport interface FeatureCategory{id:string;name:string;}\nexport const featureCategories');fs.writeFileSync('config/featureCategories.tsx',c);"

REM Fix 2: Add missing lucide-react icons
echo Adding missing icon exports...
node -e "const fs=require('fs');let c=fs.readFileSync('config/featureCategories.tsx','utf8');c=c.replace('Anchor,','Anchor,RotateCcw as RotateLeft,RotateCw as RotateRight,Box as Cube,Circle as Sphere,Pill as Capsule,Grid as Iso,');fs.writeFileSync('config/featureCategories.tsx',c);"

REM Fix 3: Add Vector3 import to CameraControls
echo Fixing CameraControls imports...
node -e "const fs=require('fs');let c=fs.readFileSync('components/BabylonWorkspace/features/CameraControls.tsx','utf8');if(!c.includes('import{Vector3}')){c=c.replace(\"import React\",\"import{Vector3}from'@babylonjs/core';\nimport React\");}fs.writeFileSync('components/BabylonWorkspace/features/CameraControls.tsx',c);"

REM Fix 4: Add status to toolPageDefinitions
echo Fixing toolPageDefinitions...
node -e "const fs=require('fs');let c=fs.readFileSync('components/toolPageDefinitions.ts','utf8');c=c.replace(/readonly status:/g,'status:');fs.writeFileSync('components/toolPageDefinitions.ts',c);"

echo TypeScript error fixes applied!
echo Run 'npm run typecheck' to verify fixes.
pause
