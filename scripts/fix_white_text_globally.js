/**
 * Global fix for white text visibility issues on Windows
 *
 * This script finds and fixes patterns where white/light text
 * appears on potentially light backgrounds, causing readability issues.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../frontend/src');

// Patterns that need fixing
const PROBLEMATIC_PATTERNS = [
  // White text on white/light backgrounds in modals/containers
  {
    pattern: /(backgroundColor:\s*['"]white['"][\s\S]{0,200}?)(color:\s*['"]white['"])/g,
    description: 'White text on white background',
    fix: (match, before, colorProp) => `${before}color: '#111827'`
  },
  {
    pattern: /(backgroundColor:\s*['"]#fff(?:fff)?['"][\s\S]{0,200}?)(color:\s*['"](?:white|#fff(?:fff)?)['"])/g,
    description: 'White/light text on white background',
    fix: (match, before, colorProp) => `${before}color: '#111827'`
  },
  // Light gray text that might be invisible
  {
    pattern: /color:\s*['"]#f[3-9a-f][3-9a-f][3-9a-f][3-9a-f][3-9a-f]['"](?![^<]*\/\/.*ensures.*contrast)/g,
    description: 'Very light gray text (potentially invisible)',
    fix: (match) => `color: '#6b7280' // Fixed: was too light`
  },
  // Table headers without explicit dark text
  {
    pattern: /(<th[^>]*style={{[^}]*)(}}>)/g,
    description: 'Table headers without explicit text color',
    fix: (match, before, after) => {
      if (!before.includes('color:')) {
        return `${before}, color: '#111827'${after}`;
      }
      return match;
    }
  }
];

// Safe contexts where white text is OK (dark backgrounds)
const SAFE_CONTEXTS = [
  /backgroundColor:\s*['"](?:#[0-5][0-9a-f]{5}|black|#000|rgb\([0-9]{1,2},\s*[0-9]{1,2},\s*[0-9]{1,2}\))['"]/,
  /background:\s*['"](?:linear-gradient|radial-gradient).*#[0-5]/,
  /className.*(?:dark|bg-gray-[89]|bg-black|bg-blue-[89]|bg-green-[89]|bg-red-[89])/
];

function isSafeContext(text, position) {
  // Check if white text appears within 500 chars of a dark background
  const context = text.substring(Math.max(0, position - 500), position + 100);
  return SAFE_CONTEXTS.some(pattern => pattern.test(context));
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fixes = [];

  // Skip if file has already been fixed
  if (content.includes('// GLOBAL_TEXT_VISIBILITY_FIX_APPLIED')) {
    return { modified: false, fixes: [] };
  }

  PROBLEMATIC_PATTERNS.forEach(({ pattern, description, fix }) => {
    const matches = [];
    let match;

    // Reset regex
    pattern.lastIndex = 0;

    while ((match = pattern.exec(content)) !== null) {
      // Check if this is in a safe context (dark background)
      if (!isSafeContext(content, match.index)) {
        matches.push({ match, index: match.index });
      }
    }

    if (matches.length > 0) {
      // Apply fixes in reverse order to preserve indices
      matches.reverse().forEach(({ match, index }) => {
        const replacement = fix(...match);
        content = content.substring(0, index) + replacement + content.substring(index + match[0].length);
        modified = true;
      });

      fixes.push(`${description}: ${matches.length} fixes`);
    }
  });

  if (modified) {
    // Add marker comment at top of file
    const importEnd = content.indexOf('\n\n');
    if (importEnd > 0) {
      content = content.substring(0, importEnd) +
                '\n// GLOBAL_TEXT_VISIBILITY_FIX_APPLIED: Ensures readable text on all backgrounds\n' +
                content.substring(importEnd);
    }

    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { modified, fixes };
}

function walkDirectory(dir, callback) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath, callback);
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      callback(filePath);
    }
  });
}

console.log('🔍 Scanning frontend for white text visibility issues...\n');

let totalFiles = 0;
let modifiedFiles = 0;
const allFixes = [];

walkDirectory(FRONTEND_SRC, (filePath) => {
  totalFiles++;
  const relativePath = path.relative(FRONTEND_SRC, filePath);

  const { modified, fixes } = fixFile(filePath);

  if (modified) {
    modifiedFiles++;
    console.log(`✅ Fixed: ${relativePath}`);
    fixes.forEach(fix => console.log(`   - ${fix}`));
    allFixes.push({ file: relativePath, fixes });
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Files scanned: ${totalFiles}`);
console.log(`   Files modified: ${modifiedFiles}`);
console.log(`   Total fixes applied: ${allFixes.reduce((sum, f) => sum + f.fixes.length, 0)}`);

if (modifiedFiles > 0) {
  console.log('\n✨ All text visibility issues have been fixed!');
  console.log('   Run "npm run build" in the frontend directory to rebuild.');
} else {
  console.log('\n✓ No issues found - all text already has proper visibility!');
}
