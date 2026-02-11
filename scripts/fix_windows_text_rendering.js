/**
 * Fix Windows-specific text rendering issues
 *
 * Windows renders color: 'white' differently than Mac in some contexts.
 * This script ensures ALL text uses explicit dark colors or #ffffff format.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../frontend/src/components');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const fixes = [];

  // Pattern 1: Conditional ternary with 'white' (except when on colored backgrounds)
  // Match: condition ? 'white' : something
  const conditionalWhite = /(\?\s*)['"]white['"](\s*:)/g;
  if (conditionalWhite.test(content)) {
    // Check if this is on a colored background (contains background or backgroundColor in same object)
    const lines = content.split('\n');
    let newContent = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Check if this line has conditional white text
      if (line.match(/color:.*\?\s*['"]white['"]\s*:/)) {
        // Look back a few lines to see if there's a colored background
        const contextStart = Math.max(0, i - 10);
        const contextEnd = Math.min(lines.length, i + 5);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        // If background is colored (not white/transparent), keep white but use #ffffff
        if (context.match(/background(?:Color)?:\s*(?:['"](?!white|transparent)|#(?!fff))/i)) {
          line = line.replace(/color:(\s*\S+\s*\?\s*)['"]white['"]/g, 'color:$1\'#ffffff\'');
          fixes.push('Fixed conditional white text on colored background');
          modified = true;
        } else {
          // Otherwise change to dark text
          line = line.replace(/color:(\s*\S+\s*\?\s*)['"]white['"]/g, 'color:$1\'#111827\'');
          fixes.push('Fixed conditional white text on light background');
          modified = true;
        }
      }

      newContent += line + '\n';
    }

    if (modified) {
      content = newContent;
    }
  }

  // Pattern 2: Direct color: 'white' assignments (not backgroundColor)
  // Be very careful - only change text color, not backgrounds
  const directWhiteText = /(\bcolor:\s*)['"]white['"]/g;
  const matches = content.match(directWhiteText);
  if (matches) {
    const lines = content.split('\n');
    let newContent = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.match(/\bcolor:\s*['"]white['"]/)) {
        // Check if this is a button or element with colored background
        const contextStart = Math.max(0, i - 15);
        const contextEnd = Math.min(lines.length, i + 10);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        // If on a colored background, use #ffffff instead
        if (context.match(/background(?:Color)?:\s*(?:['"]#[0-9a-f]{3,6}|['"](?!white|transparent)[a-z])/i)) {
          line = line.replace(/(\bcolor:\s*)['"]white['"]/, '$1\'#ffffff\'');
          fixes.push('Normalized white text to #ffffff on colored background');
          modified = true;
        } else {
          // Otherwise change to dark
          line = line.replace(/(\bcolor:\s*)['"]white['"]/, '$1\'#111827\'');
          fixes.push('Changed white text to dark on light background');
          modified = true;
        }
      }

      newContent += line + '\n';
    }

    if (modified) {
      content = newContent;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return { modified, fixes: [...new Set(fixes)] };
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalFixed = 0;
  const fixedFiles = [];

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      return;
    }

    if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const { modified, fixes } = fixFile(filePath);
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

console.log('🔍 Fixing Windows text rendering issues...\n');

const { totalFixed, fixedFiles } = walkDirectory(FRONTEND_SRC);

console.log(`\n📊 Summary:`);
console.log(`   Files fixed: ${totalFixed}`);
console.log(`   Total fixes: ${fixedFiles.reduce((sum, f) => sum + f.fixes.length, 0)}`);

if (totalFixed > 0) {
  console.log('\n✨ Windows rendering fixes applied!');
  console.log('   Run "npm run build" in the frontend directory to rebuild.');
} else {
  console.log('\n✓ No Windows rendering issues found!');
}
