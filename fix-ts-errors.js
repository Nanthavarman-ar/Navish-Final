#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing TypeScript errors...\n');

const fixes = [
  {
    file: 'components/BabylonWorkspace.old.tsx',
    action: 'rename',
    newName: 'components/BabylonWorkspace.old.tsx.bak',
    reason: 'Old backup file causing errors - renaming to .bak'
  },
  {
    file: 'components/BabylonWorkspace/features/CameraControls.tsx',
    action: 'patch',
    patches: [
      {
        search: /import React/,
        replace: "import { Vector3 } from '@babylonjs/core';\nimport React",
        reason: 'Add Vector3 import'
      }
    ]
  },
  {
    file: 'components/BabylonWorkspace/features/CameraControlsFixed.tsx',
    action: 'patch',
    patches: [
      {
        search: /import React/,
        replace: "import { Vector3 } from '@babylonjs/core';\nimport React",
        reason: 'Add Vector3 import'
      }
    ]
  }
];

let successCount = 0;
let errorCount = 0;

fixes.forEach(fix => {
  const filePath = path.join(__dirname, fix.file);
  
  try {
    if (fix.action === 'rename') {
      if (fs.existsSync(filePath)) {
        const newPath = path.join(__dirname, fix.newName);
        fs.renameSync(filePath, newPath);
        console.log(`✅ ${fix.file} - ${fix.reason}`);
        successCount++;
      } else {
        console.log(`⚠️  ${fix.file} - File not found, skipping`);
      }
    } else if (fix.action === 'patch') {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        fix.patches.forEach(patch => {
          if (!content.match(patch.search)) {
            console.log(`⚠️  ${fix.file} - Pattern not found: ${patch.reason}`);
          } else if (!content.includes(patch.replace.split('\n')[0])) {
            content = content.replace(patch.search, patch.replace);
            modified = true;
            console.log(`✅ ${fix.file} - ${patch.reason}`);
          } else {
            console.log(`ℹ️  ${fix.file} - Already fixed: ${patch.reason}`);
          }
        });
        
        if (modified) {
          fs.writeFileSync(filePath, content, 'utf8');
          successCount++;
        }
      } else {
        console.log(`⚠️  ${fix.file} - File not found, skipping`);
      }
    }
  } catch (error) {
    console.error(`❌ ${fix.file} - Error: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Successful fixes: ${successCount}`);
console.log(`   ❌ Errors: ${errorCount}`);
console.log(`\n🔍 Run 'npm run typecheck' to verify remaining errors\n`);
