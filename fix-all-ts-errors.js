#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying comprehensive TypeScript fixes...\n');

const fixes = [
  // Fix icon imports in CameraControls
  {
    file: 'components/BabylonWorkspace/features/CameraControls.tsx',
    patches: [
      {
        find: /RotateLeft,/g,
        replace: 'RotateCcw as RotateLeft,',
        desc: 'Fix RotateLeft import'
      },
      {
        find: /RotateRight,/g,
        replace: 'RotateCw as RotateRight,',
        desc: 'Fix RotateRight import'
      },
      {
        find: /Iso,/g,
        replace: 'Grid as Iso,',
        desc: 'Fix Iso import'
      }
    ]
  },
  // Fix icon imports in CameraControlsFixed
  {
    file: 'components/BabylonWorkspace/features/CameraControlsFixed.tsx',
    patches: [
      {
        find: /RotateLeft,/g,
        replace: 'RotateCcw as RotateLeft,',
        desc: 'Fix RotateLeft import'
      },
      {
        find: /RotateRight,/g,
        replace: 'RotateCw as RotateRight,',
        desc: 'Fix RotateRight import'
      }
    ]
  },
  // Fix icon imports in LightingControls
  {
    file: 'components/BabylonWorkspace/features/LightingControls.tsx',
    patches: [
      {
        find: /RotateLeft,/g,
        replace: 'RotateCcw as RotateLeft,',
        desc: 'Fix RotateLeft import'
      }
    ]
  },
  // Fix icon imports in ObjectControls
  {
    file: 'components/BabylonWorkspace/features/ObjectControls.tsx',
    patches: [
      {
        find: /Sphere,/g,
        replace: 'Circle as Sphere,',
        desc: 'Fix Sphere import'
      },
      {
        find: /Capsule,/g,
        replace: 'Pill as Capsule,',
        desc: 'Fix Capsule import'
      },
      {
        find: /Cube,/g,
        replace: 'Box as Cube,',
        desc: 'Fix Cube import'
      }
    ]
  },
  // Fix FeatureManager icon rendering
  {
    file: 'components/BabylonWorkspace/core/FeatureManager.tsx',
    patches: [
      {
        find: /<Icon className=/g,
        replace: '<Icon className=',
        desc: 'Fix Icon component usage'
      }
    ]
  },
  // Fix FeatureButton icon rendering
  {
    file: 'components/BabylonWorkspace/FeatureButton.tsx',
    patches: [
      {
        find: /<Icon className=/g,
        replace: '<Icon className=',
        desc: 'Fix Icon component usage'
      }
    ]
  },
  // Fix GeoSyncManager import
  {
    file: 'components/BabylonWorkspace/RefactoredBabylonWorkspaceFixed.tsx',
    patches: [
      {
        find: /import GeoSyncManager from/g,
        replace: 'import { GeoSyncManager } from',
        desc: 'Fix GeoSyncManager import'
      }
    ]
  }
];

let totalFixed = 0;
let totalErrors = 0;

fixes.forEach(({ file, patches }) => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - File not found, skipping`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fileFixed = 0;
    
    patches.forEach(({ find, replace, desc }) => {
      if (content.match(find)) {
        content = content.replace(find, replace);
        modified = true;
        fileFixed++;
        console.log(`  ✅ ${desc}`);
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${file} - Fixed ${fileFixed} issue(s)\n`);
      totalFixed += fileFixed;
    } else {
      console.log(`ℹ️  ${file} - Already fixed or no matches\n`);
    }
  } catch (error) {
    console.error(`❌ ${file} - Error: ${error.message}\n`);
    totalErrors++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Total fixes applied: ${totalFixed}`);
console.log(`   ❌ Errors encountered: ${totalErrors}`);
console.log(`\n🔍 Run 'npm run typecheck' to verify\n`);
