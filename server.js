/**
 * ECHOSPHERE 2.0 — server.js
 * Minimal static file server for Windows (Node.js built-in only)
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html' : 'text/html; charset=UTF-8',
  '.css'  : 'text/css; charset=UTF-8',
  '.js'   : 'application/javascript; charset=UTF-8',
  '.json' : 'application/json',
  '.webp' : 'image/webp',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.png'  : 'image/png',
  '.gif'  : 'image/gif',
  '.svg'  : 'image/svg+xml',
  '.mp4'  : 'video/mp4',
  '.mp3'  : 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff' : 'font/woff',
  '.ico'  : 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // strip leading slashes (Windows path.join fix)
  const cleanRel = reqPath.replace(/^[/\\]+/, '') || 'index.html';
  let filePath   = path.join(ROOT, cleanRel);

  // Security: must stay inside ROOT
  if (!filePath.toLowerCase().startsWith(ROOT.toLowerCase())) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // directory → index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + reqPath);
    return;
  }

  const ext     = path.extname(filePath).toLowerCase();
  const mime    = MIME[ext] || 'application/octet-stream';
  const stat    = fs.statSync(filePath);
  const total   = stat.size;

  // Range support (needed for video)
  const rangeHeader = req.headers.range;
  if (rangeHeader && (ext === '.mp4' || ext === '.mp3')) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : Math.min(start + 1024 * 1024 - 1, total - 1);
    res.writeHead(206, {
      'Content-Range' : `bytes ${start}-${end}/${total}`,
      'Accept-Ranges' : 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type'  : mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  // Cache headers: no-cache for code files, long cache for media assets
  const isCode = ext === '.html' || ext === '.css' || ext === '.js';
  const cacheControl = isCode
    ? 'no-cache, no-store, must-revalidate'
    : 'public, max-age=86400';

  res.writeHead(200, {
    'Content-Type'   : mime,
    'Content-Length' : total,
    'Cache-Control'  : cacheControl,
    'Accept-Ranges'  : 'bytes',
    'Access-Control-Allow-Origin': '*',
  });

  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     ECHOSPHERE 2.0 — Server ready    ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log('  ║   Ctrl + C to stop                   ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗  Port ${PORT} is already in use. Stop other servers and retry.\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
