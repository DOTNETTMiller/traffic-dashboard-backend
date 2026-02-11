/**
 * Comprehensive fix for all white text visibility issues
 *
 * This script replaces ALL instances of white text with dark text
 * to ensure readability on Windows light themes.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../frontend/src/components');

function fixWhiteText(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const fixes = [];

  // Pattern 1: color: 'white' or color: "white"
  const pattern1 = /color:\s*['"]white['"]/g;
  if (pattern1.test(content)) {
    content = content.replace(/color:\s*['"]white['"]/g, "color: '#111827'");
    fixes.push('Changed color: white to #111827');
    modified = true;
  }

  // Pattern 2: color: '#fff' or color: '#ffffff'
  const pattern2 = /color:\s*['"]#fff(?:fff)?['"]/gi;
  if (pattern2.test(content)) {
    content = content.replace(/color:\s*['"]#fff(?:fff)?['"]/gi, "color: '#111827'");
    fixes.push('Changed color: #fff to #111827');
    modified = true;
  }

  // Pattern 3: Light gray text (f0-ff range)
  const pattern3 = /color:\s*['"]#[f][0-9a-f]{5}['"]/gi;
  if (pattern3.test(content)) {
    content = content.replace(/color:\s*['"]#[f][0-9a-f]{5}['"]/gi, "color: '#6b7280'");
    fixes.push('Changed light gray to #6b7280');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { modified, fixes };
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalFixed = 0;
  const fixedFiles = [];

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      return; // Skip subdirectories
    }

    if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const { modified, fixes } = fixWhiteText(filePath);
      if (modified) {
        totalFixed++;
        fixedFiles.push({ file, fixes });
        console.log(`✅ Fixed: ${file}`);
        fixes.forEach(fix => console.log(`   - ${fix}`));
      }
    }
  });

  return { totalFixed, fixedFiles };
}

console.log('🔍 Scanning all frontend components for white text issues...\n');

const { totalFixed, fixedFiles } = walkDirectory(FRONTEND_SRC);

console.log(`\n📊 Summary:`);
console.log(`   Files fixed: ${totalFixed}`);
console.log(`   Total fixes: ${fixedFiles.reduce((sum, f) => sum + f.fixes.length, 0)}`);

if (totalFixed > 0) {
  console.log('\n✨ All white text issues have been fixed!');
  console.log('   Run "npm run build" in the frontend directory to rebuild.');
} else {
  console.log('\n✓ No white text issues found!');
}
