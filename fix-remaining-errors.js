const fs = require('fs');
const path = require('path');

const fixes = [
  // Fix Camera.rotation issues
  {
    file: 'components/BabylonWorkspace/features/CameraControls.tsx',
    find: /camera\.rotation/g,
    replace: 'camera.rotationQuaternion',
    desc: 'Fix Camera.rotation'
  },
  {
    file: 'components/BabylonWorkspace/features/CameraControlsFixed.tsx',
    find: /camera\.rotation/g,
    replace: 'camera.rotationQuaternion',
    desc: 'Fix Camera.rotation'
  },
  // Fix Light type guards
  {
    file: 'components/BabylonWorkspace/features/LightingControls.tsx',
    find: /light\.getTypeName\(\)/g,
    replace: 'light.getClassName()',
    desc: 'Fix Light.getTypeName'
  },
  {
    file: 'components/BabylonWorkspace/features/LightingControls.tsx',
    find: /light\.position/g,
    replace: '(light as any).position',
    desc: 'Fix Light.position'
  },
  {
    file: 'components/BabylonWorkspace/features/LightingControls.tsx',
    find: /light\.direction/g,
    replace: '(light as any).direction',
    desc: 'Fix Light.direction'
  },
  {
    file: 'components/BabylonWorkspace/features/LightingControlsFixed.tsx',
    find: /light\.position/g,
    replace: '(light as any).position',
    desc: 'Fix Light.position'
  },
  // Fix Vector3 issues
  {
    file: 'components/BabylonWorkspace/features/CameraControls.tsx',
    find: /new Vector3\(\s*\{\s*x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+)\s*\}\s*\)/g,
    replace: 'new Vector3($1, $2, $3)',
    desc: 'Fix Vector3 constructor'
  },
  // Fix ObjectControls Cube type
  {
    file: 'components/BabylonWorkspace/features/ObjectControls.tsx',
    find: /: Cube/g,
    replace: ': typeof Cube',
    desc: 'Fix Cube type'
  },
  // Fix uiSegments onFeatureToggle
  {
    file: 'components/BabylonWorkspace/uiSegments.tsx',
    find: /onFeatureToggle:\s*\([^)]+\)\s*=>\s*void/g,
    replace: 'onFeatureToggle: (id: string, enabled: boolean) => void',
    desc: 'Fix onFeatureToggle signature'
  },
  // Fix ToolPage status
  {
    file: 'components/ToolPage.tsx',
    find: /toolPageDefinitions\[id\]\.status/g,
    replace: '(toolPageDefinitions[id] as any).status',
    desc: 'Fix status property access'
  }
];

let fixed = 0;
fixes.forEach(({ file, find, replace, desc }) => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.match(find)) {
    content = content.replace(find, replace);
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${file} - ${desc}`);
    fixed++;
  }
});

console.log(`\n✅ Fixed ${fixed} issues`);
