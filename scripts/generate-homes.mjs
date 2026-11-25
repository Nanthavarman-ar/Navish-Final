#!/usr/bin/env node
/**
 * Builds a placeholder homes.json from the node/mesh names inside a .glb/.gltf, so you only
 * have to fill in areas, status, photos etc.
 *
 *   node scripts/generate-homes.mjs path/to/model.glb [outputDir] [homePattern]
 *
 * Needs @gltf-transform/core (already a dependency of this project).
 */
import { NodeIO } from '@gltf-transform/core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , modelPath, outDir = 'public', pattern = '^Home[_\\-\\s]?(\\d+)'] = process.argv;
if (!modelPath) {
  console.error('Usage: node scripts/generate-homes.mjs <model.glb> [outputDir] [homeRegex]');
  process.exit(1);
}

const re = new RegExp(pattern, 'i');
const doc = await new NodeIO().read(modelPath);
const names = new Set();
for (const node of doc.getRoot().listNodes()) {
  const m = re.exec(node.getName() || '');
  if (m) names.add(`${node.getName()}\u0000${m[1]}`);
}

const homes = [...names]
  .map((s) => s.split('\u0000'))
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  .map(([id, num]) => {
    const n = parseInt(num, 10);
    return {
      id,
      name: id.replace(/[_-]+/g, ' ').trim(),
      floor: n >= 100 ? Math.floor(n / 100) : n,
      areaM2: 0,
      status: 'available',
      bedrooms: 0,
      description: '',
      photos: [],
      floorPlan: '',
      rooms: ['living', 'dining', 'bedroom', 'balcony'],
      hotspots: {},
    };
  });

if (!homes.length) {
  console.error(`No nodes matched ${re}. Check the names in Blender (Home_101, Home_102 ...).`);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'homes.json');
writeFileSync(out, JSON.stringify({ homes }, null, 2));
console.log(`Wrote ${homes.length} homes to ${out}`);
