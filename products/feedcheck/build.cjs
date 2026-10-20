'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const html = read('index.html')
  .replace('/* INLINE_STYLE */', () => read('style.css'))
  .replace('/* INLINE_CHECKER */', () => read('checker.js').replace(/<\/script/gi, '<\\/script'))
  .replace('/* INLINE_APP */', () => read('app.js').replace(/<\/script/gi, '<\\/script'));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'feedcheck.html'), html);
fs.mkdirSync(path.join(root, 'dist', 'site'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'site', 'index.html'), read('product.html'));
const demo = html.replace('<body>', '<body data-edition="demo">').replace('</style>', '\nbody[data-edition="demo"] .input-card,body[data-edition="demo"] [data-view="compare"]{display:none!important}\n</style>').replace('LOCAL EDITION <span', 'SAMPLE DEMO <span');
fs.writeFileSync(path.join(root, 'dist', 'site', 'demo.html'), demo);
console.log('Built dist/feedcheck.html (' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB); self-contained, no runtime dependencies.');
console.log('Built dist/site/ with the product page and a sample-only UI demo. Keep the paid application separate from public site files.');
