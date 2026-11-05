// Brand: identity, accounts, profile/analysis/voice docs, photo upload, «حلّل» (analyze via Claude).
import fs from 'node:fs';
import { router, load, save, ws, readText, writeText, writeBytes, mtime, sseFlow, err } from '../lib.mjs';
import * as claude from '../claude.mjs';
import * as P from '../prompts.mjs';

const str = (v, n) => String(v ?? '').slice(0, n);
export function cleanIdentity(cur, b) {
  const n = { ...cur };
  for (const [k, len] of [['name', 80], ['handle', 60], ['role', 120]]) if (k in b) n[k] = str(b[k], len).trim();
  if ('facePos' in b) { if (!/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(b.facePos || '')) throw err('bad_request', 'facePos must look like "50% 28%"'); n.facePos = b.facePos; }
  if ('accent' in b) { if (b.accent && !/^#[0-9a-f]{6}$/i.test(b.accent)) throw err('bad_request', 'accent must be #rrggbb'); n.accent = b.accent || ''; }
  for (const k of ['template', 'font']) if (k in b) { if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(b[k] || '')) throw err('bad_request', `invalid ${k}`); n[k] = b[k]; }
  if ('photo' in b && (b.photo === null || b.photo === '')) n.photo = null; // photo file names are set by the upload route only
  return n;
}
const PLATFORMS = ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'];
export function cleanAccounts(cur, b) {
  const n = { ...cur };
  for (const k of PLATFORMS) if (b[k] && typeof b[k] === 'object') n[k] = { url: str(b[k].url ?? cur[k]?.url, 300).trim(), bio: str(b[k].bio ?? cur[k]?.bio, 3000) };
  return n;
}

const DOCS = ['profile', 'analysis', 'voice'];
const docFile = name => { if (!DOCS.includes(name)) throw err('not_found', 'doc must be profile, analysis or voice', 404); return ws('brand', `${name}.md`); };
const docOut = f => ({ text: readText(f), updated: mtime(f) ? new Date(mtime(f)).toISOString() : null });

const isJpeg = b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = b => b.length > 8 && b.readUInt32BE(0) === 0x89504e47;

export default router([
  ['GET', '/api/brand/identity', () => load('identity')],
  ['PUT', '/api/brand/identity', ({ body }) => { const n = cleanIdentity(load('identity'), body); save('identity', n); return n; }],
  ['GET', '/api/brand/accounts', () => load('accounts')],
  ['PUT', '/api/brand/accounts', ({ body }) => { const n = cleanAccounts(load('accounts'), body); save('accounts', n); return n; }],
  ['GET', '/api/brand/doc/:name', ({ params }) => docOut(docFile(params.name))],
  ['PUT', '/api/brand/doc/:name', ({ params, body }) => {
    const f = docFile(params.name);
    if (typeof body.text !== 'string') throw err('bad_request', 'text required');
    writeText(f, body.text.slice(0, 200_000)); return docOut(f);
  }],
  ['POST', '/api/brand/photo', ({ req, raw }) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    const ext = type === 'image/jpeg' && isJpeg(raw) ? 'jpg' : type === 'image/png' && isPng(raw) ? 'png' : null;
    if (!ext) throw err('bad_request', 'send raw JPEG or PNG bytes with a matching Content-Type', 415);
    writeBytes(ws('brand', `photo.${ext}`), raw);
    fs.rmSync(ws('brand', `photo.${ext === 'jpg' ? 'png' : 'jpg'}`), { force: true });
    const id = load('identity'); id.photo = `photo.${ext}`; save('identity', id);
    return { photo: id.photo, url: `/files/brand/${id.photo}?v=${Math.round(mtime(ws('brand', id.photo)))}` };
  }],
  ['POST', '/api/brand/analyze', ({ res, body }) => {
    const l = claude.lock.acquire();
    return sseFlow(res, async send => {
      try {
        send('phase', { phase: 'claude', msg: 'analyzing profile' });
        const t = P.analyze({ extra: str(body.extra, 20_000) });
        const files = ['analysis', 'voice'].map(n => ws('brand', `${n}.md`)), before = files.map(mtime);
        const r = await claude.run({ ...t, signal: l.signal, onEvent: claude.forward(send), meta: { route: 'analyze' } });
        if (!r.ok) throw err(r.code, r.error);
        if (files.some((f, i) => mtime(f) === before[i] || !readText(f).trim())) throw err('claude_failed', 'Claude did not write both analysis.md and voice.md');
        const out = { analysis: docOut(files[0]), voice: docOut(files[1]) };
        return { ...out, warnings: r.warnings };
      } finally { l.release(); }
    });
  }],
]);
