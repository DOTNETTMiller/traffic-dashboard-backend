#!/usr/bin/env node

/**
 * Patch script for web-ifc-three
 * Fixes the mergeGeometries import to use mergeBufferGeometries
 * This is necessary because web-ifc-three uses the wrong function name
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ifcLoaderPath = path.join(__dirname, 'node_modules', 'web-ifc-three', 'IFCLoader.js');

if (fs.existsSync(ifcLoaderPath)) {
  console.log('Patching web-ifc-three IFCLoader.js...');

  let content = fs.readFileSync(ifcLoaderPath, 'utf8');
  const patched = content.replace(/mergeGeometries/g, 'mergeBufferGeometries');

  fs.writeFileSync(ifcLoaderPath, patched);
  console.log('✅ Successfully patched IFCLoader.js');
} else {
  console.log('⚠️  web-ifc-three not installed, skipping patch');
}
