// Serves the frontend (the repo root) so the whole demo is one command instead of "start the
// backend, then also remember to serve the static files". Zero dependencies, like everything
// else here — no npx, no http-server install.
//
// Run: node backend/static-server.js   (normally started for you by backend/dev.js)
// Config: STATIC_PORT (5500).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.STATIC_PORT || 5500;
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  // Resolve, then confirm the result is still inside ROOT — otherwise a crafted path like
  // /../../etc/passwd would escape the served directory.
  const filePath = path.resolve(ROOT, '.' + rel);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      // The demo is edited and reloaded constantly; a cached core.js is pure confusion.
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error('Port ' + PORT + ' is already in use. Set STATIC_PORT to something else.');
  else console.error('Static server error: ' + err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('Frontend served on http://localhost:' + PORT + '  (from ' + ROOT + ')');
});
