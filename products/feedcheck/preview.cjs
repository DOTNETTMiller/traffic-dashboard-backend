'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const html = path.join(__dirname, 'dist', 'feedcheck.html');
const server = http.createServer((req, res) => {
  const routes = { '/': html, '/feedcheck.html': html, '/site/': path.join(__dirname, 'dist/site/index.html'), '/site/demo.html': path.join(__dirname, 'dist/site/demo.html') };
  if (!(req.url in routes) || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(routes[req.url]).pipe(res);
});
server.listen(Number(process.env.FEEDCHECK_PORT || 4317), '127.0.0.1', () => console.log('FeedCheck preview: http://127.0.0.1:' + server.address().port));
