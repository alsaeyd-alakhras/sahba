// Sahba — © 2026 Alsaeyd Al-Akhras (السيد الأخرسي) · MIT · https://github.com/alsaeyd-alakhras/sahba
// Sahba — local server. Zero dependencies, 127.0.0.1 only. API routes: server/routes/*.mjs (auto-loaded).
// Static: app/public/ · /files/* (workspace) · /engine/* + /templates/* (asset files only, no code).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP, ROOT, WORKSPACE, PUBLIC, safeJoin, fail, readBody, ensureWorkspace } from './server/lib.mjs';
import { recoverDrafting } from './server/store.mjs';

const PORT = process.env.PORT === undefined ? 8900 : Number(process.env.PORT); // PORT=0 → random (tests)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };
const ASSET_EXT = new Set(['.woff2', '.woff', '.ttf', '.otf', '.svg', '.css', '.png', '.jpg', '.jpeg', '.webp', '.json']);
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
const JSON_CAP = 2 * 1024 * 1024, PHOTO_CAP = 8 * 1024 * 1024;

ensureWorkspace();
const recovered = recoverDrafting();

const routeDir = path.join(APP, 'server', 'routes');
const routes = [];
for (const f of fs.readdirSync(routeDir).filter(f => f.endsWith('.mjs')).sort())
  try { routes.push((await import(pathToFileURL(path.join(routeDir, f)).href)).default); }
  catch (e) { console.error(`route module ${f} failed to load: ${e.message}`); }

function sendFile(res, f, { cache = 'no-cache', head = false } = {}) {
  let st; try { st = fs.statSync(f); } catch { return false; }
  if (!st.isFile()) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
  if (head) res.end(); else fs.createReadStream(f).pipe(res);
  return true;
}
function serveUnder(res, base, rel, opts, exts) {
  const f = safeJoin(base, rel);
  if (!f || f === base || (exts && !exts.has(path.extname(f).toLowerCase())) || path.basename(f).startsWith('.')) return false;
  return sendFile(res, f, opts);
}

const server = http.createServer(async (req, res) => {
  // localhost only: foreign Host = DNS rebinding; foreign Origin on a write = CSRF from another site
  if (!LOCAL.test(req.headers.host || '')) return fail(res, 403, 'forbidden', 'host');
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(req.headers.origin)) return fail(res, 403, 'forbidden', 'origin');
  if (write && req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return fail(res, 403, 'forbidden', 'cross-site');

  let url; try { url = new URL(req.url, 'http://x'); } catch { return fail(res, 400, 'bad_request', 'url'); }
  try {
    let body = {}, raw = null;
    if (write) {
      const isPhoto = url.pathname === '/api/brand/photo';
      raw = await readBody(req, isPhoto ? PHOTO_CAP : JSON_CAP);
      if (!raw) { res.setHeader('Connection', 'close'); return fail(res, 413, 'too_large', `max ${(isPhoto ? PHOTO_CAP : JSON_CAP) / 1024 / 1024}MB`); }
      if (!isPhoto && raw.length) { try { body = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'bad_json', 'body is not valid JSON'); } }
      if (body === null || typeof body !== 'object') body = {};
    }
    const ctx = { req, res, url, body, raw };
    for (const r of routes) if (await r(ctx)) return;

    const p = decodeURIComponent(url.pathname), head = req.method === 'HEAD';
    if (req.method === 'GET' || head) {
      if (p.startsWith('/files/') && serveUnder(res, WORKSPACE, p.slice(7), { head })) return;
      if (p.startsWith('/engine/') && serveUnder(res, path.join(ROOT, 'engine'), p.slice(8), { cache: 'max-age=3600', head }, ASSET_EXT)) return;
      if (p.startsWith('/templates/') && serveUnder(res, path.join(ROOT, 'templates'), p.slice(11), { head }, ASSET_EXT)) return;
      if (!p.startsWith('/api/') && !p.startsWith('/files/') && serveUnder(res, PUBLIC, p === '/' ? 'index.html' : p.slice(1), { head })) return;
    }
    fail(res, 404, 'not_found', p);
  } catch (e) { console.error(e); if (!res.headersSent) fail(res, 500, 'internal', e.message); else res.end(); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sahba → http://127.0.0.1:${server.address().port}  (workspace: ${WORKSPACE})${recovered ? `  · restored ${recovered} interrupted draft(s)` : ''}`);
});
