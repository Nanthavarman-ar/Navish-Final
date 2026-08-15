#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Applying final TypeScript fixes...\n');

// Fix 1: Add enabled property to Feature interface
const featureCategoriesPath = path.join(__dirname, 'config/featureCategories.tsx');
if (fs.existsSync(featureCategoriesPath)) {
  let content = fs.readFileSync(featureCategoriesPath, 'utf8');
  
  if (!content.includes('enabled?:')) {
    content = content.replace(
      /category: string;/,
      `category: string;\n  enabled?: boolean;`
    );
    fs.writeFileSync(featureCategoriesPath, content);
    console.log('✅ Added enabled property to Feature interface');
  } else {
    console.log('ℹ️  Feature interface already has enabled property');
  }
}

// Fix 2: Update FeatureManagerClass to handle enabled property
const featureManagerClassPath = path.join(__dirname, 'components/BabylonWorkspace/core/FeatureManagerClass.tsx');
if (fs.existsSync(featureManagerClassPath)) {
  let content = fs.readFileSync(featureManagerClassPath, 'utf8');
  
  // Fix enabled property access
  content = content.replace(
    /feature\.enabled/g,
    '(feature.enabled ?? feature.enabledByDefault ?? false)'
  );
  
  // Fix FeatureCategory comparison
  content = content.replace(
    /feature\.category === FeatureCategory/g,
    'feature.category === category'
  );
  
  fs.writeFileSync(featureManagerClassPath, content);
  console.log('✅ Fixed FeatureManagerClass enabled property access');
}

// Fix 3: Fix Icon component rendering in FeatureManager
const featureManagerPath = path.join(__dirname, 'components/BabylonWorkspace/core/FeatureManager.tsx');
if (fs.existsSync(featureManagerPath)) {
  let content = fs.readFileSync(featureManagerPath, 'utf8');
  
  // Replace Icon component with proper JSX
  content = content.replace(
    /const Icon = feature\.icon;/g,
    'const IconComponent = feature.icon;'
  );
  content = content.replace(
    /<Icon className=/g,
    '<IconComponent className='
  );
  content = content.replace(
    /<\/Icon>/g,
    '</IconComponent>'
  );
  
  fs.writeFileSync(featureManagerPath, content);
  console.log('✅ Fixed Icon component rendering in FeatureManager');
}

// Fix 4: Fix Icon component rendering in FeatureButton
const featureButtonPath = path.join(__dirname, 'components/BabylonWorkspace/FeatureButton.tsx');
if (fs.existsSync(featureButtonPath)) {
  let content = fs.readFileSync(featureButtonPath, 'utf8');
  
  // Replace Icon component with proper JSX
  content = content.replace(
    /const Icon = icon;/g,
    'const IconComponent = icon;'
  );
  content = content.replace(
    /<Icon className=/g,
    '<IconComponent className='
  );
  content = content.replace(
    /<\/Icon>/g,
    '</IconComponent>'
  );
  
  fs.writeFileSync(featureButtonPath, content);
  console.log('✅ Fixed Icon component rendering in FeatureButton');
}

// Fix 5: Fix button size variant in BabylonWorkspace
const babylonWorkspacePath = path.join(__dirname, 'components/BabylonWorkspace.tsx');
if (fs.existsSync(babylonWorkspacePath)) {
  let content = fs.readFileSync(babylonWorkspacePath, 'utf8');
  
  // Remove icon variant
  content = content.replace(
    /size=\{["']icon["']\}/g,
    'size="sm"'
  );
  
  // Remove currentLayoutMode prop
  content = content.replace(
    /currentLayoutMode=\{[^}]+\}\s*/g,
    ''
  );
  
  fs.writeFileSync(babylonWorkspacePath, content);
  console.log('✅ Fixed button variants and props in BabylonWorkspace');
}

// Fix 6: Fix duplicate selectedMesh in RefactoredBabylonWorkspaceFixed
const refactoredPath = path.join(__dirname, 'components/BabylonWorkspace/RefactoredBabylonWorkspaceFixed.tsx');
if (fs.existsSync(refactoredPath)) {
  let content = fs.readFileSync(refactoredPath, 'utf8');
  
  // Find and remove duplicate selectedMesh (keep first occurrence)
  const lines = content.split('\n');
  let firstSelectedMeshIndex = -1;
  let duplicateIndices = [];
  
  lines.forEach((line, index) => {
    if (line.includes('selectedMesh:') && !line.includes('//')) {
      if (firstSelectedMeshIndex === -1) {
        firstSelectedMeshIndex = index;
      } else {
        duplicateIndices.push(index);
      }
    }
  });
  
  // Remove duplicate lines
  duplicateIndices.reverse().forEach(index => {
    lines.splice(index, 1);
  });
  
  content = lines.join('\n');
  fs.writeFileSync(refactoredPath, content);
  
  if (duplicateIndices.length > 0) {
    console.log(`✅ Removed ${duplicateIndices.length} duplicate selectedMesh property`);
  } else {
    console.log('ℹ️  No duplicate selectedMesh found');
  }
}

// Fix 7: Fix onFeatureToggle signature in uiSegments
const uiSegmentsPath = path.join(__dirname, 'components/BabylonWorkspace/uiSegments.tsx');
if (fs.existsSync(uiSegmentsPath)) {
  let content = fs.readFileSync(uiSegmentsPath, 'utf8');
  
  // Fix function signature
  content = content.replace(
    /onFeatureToggle=\{[^}]*\(featureId: string \| number, enabled: boolean\)[^}]*\}/g,
    'onFeatureToggle={(featureId: string) => handleFeatureToggle(featureId)}'
  );
  
  fs.writeFileSync(uiSegmentsPath, content);
  console.log('✅ Fixed onFeatureToggle signature in uiSegments');
}

console.log('\n📊 All automated fixes applied!');
console.log('🔍 Run "npm run typecheck" to verify remaining errors\n');
console.log('📝 See TYPESCRIPT_FIX_SUMMARY.md for manual fixes needed\n');
