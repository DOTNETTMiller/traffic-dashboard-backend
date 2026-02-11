/**
 * Fix remaining white text issues and improve PDF formatting
 *
 * This script:
 * 1. Fixes inline style white text (color: 'white')
 * 2. Improves PDF generation formatting
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../frontend/src/components');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const fixes = [];

  // Pattern 1: color: 'white' in inline styles (NOT backgroundColor)
  const pattern1 = /(\bcolor:\s*['"])(white)(['"])/g;
  if (pattern1.test(content)) {
    content = content.replace(/(\bcolor:\s*['"])(white)(['"])/g, "$1#111827$3");
    fixes.push('Changed inline color: white to #111827');
    modified = true;
  }

  // Pattern 2: Improve PDF margins and formatting
  if (filePath.includes('DigitalInfrastructure.jsx') ||
      filePath.includes('DigitalStandardsCrosswalk.jsx') ||
      filePath.includes('APIDocumentationViewer.jsx')) {

    // Fix PDF margins - increase for better formatting
    const oldMargins = /margin:\s*\[10,\s*10,\s*10,\s*10\]/g;
    if (oldMargins.test(content)) {
      content = content.replace(oldMargins, 'margin: [15, 15, 15, 15]');
      fixes.push('Improved PDF margins');
      modified = true;
    }

    // Fix PDF font size in temp div
    const oldFontSize = /tempDiv\.style\.fontSize\s*=\s*['"]12px['"]/g;
    if (oldFontSize.test(content)) {
      content = content.replace(oldFontSize, "tempDiv.style.fontSize = '14px'");
      fixes.push('Increased PDF font size');
      modified = true;
    }

    // Add color to temp div for PDF
    const tempDivStyleLine = /tempDiv\.style\.lineHeight\s*=\s*['"]1\.6['"]/g;
    if (tempDivStyleLine.test(content) && !content.includes('tempDiv.style.color')) {
      content = content.replace(
        /(tempDiv\.style\.lineHeight\s*=\s*['"]1\.6['"];)/,
        "$1\n      tempDiv.style.color = '#111827';"
      );
      fixes.push('Added dark text color for PDF');
      modified = true;
    }

    // Improve PDF width
    const oldWidth = /width:\s*190/g;
    if (oldWidth.test(content)) {
      content = content.replace(oldWidth, 'width: 180');
      fixes.push('Adjusted PDF content width');
      modified = true;
    }
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

console.log('🔍 Fixing remaining white text and improving PDF formatting...\n');

const { totalFixed, fixedFiles } = walkDirectory(FRONTEND_SRC);

console.log(`\n📊 Summary:`);
console.log(`   Files fixed: ${totalFixed}`);
console.log(`   Total fixes: ${fixedFiles.reduce((sum, f) => sum + f.fixes.length, 0)}`);

if (totalFixed > 0) {
  console.log('\n✨ Fixes applied successfully!');
  console.log('   Run "npm run build" in the frontend directory to rebuild.');
} else {
  console.log('\n✓ No issues found!');
}
