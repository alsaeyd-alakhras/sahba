// Shared helpers: paths, safe joins, atomic writes, JSON responses, SSE, locks, workspace skeleton.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // <root>/app
export const ROOT = path.resolve(APP, '..');                                           // product root
export const WORKSPACE = path.resolve(process.env.SAHBA_WORKSPACE || path.join(ROOT, 'workspace'));
export const PUBLIC = path.join(APP, 'public');
export const norm = p => String(p).replace(/\\/g, '/');

/** Join `rel` under `base`; null if it escapes (.., absolute, NUL). */
export function safeJoin(base, rel) {
  if (typeof rel !== 'string' || rel.includes('\0')) return null;
  const abs = path.resolve(base, rel.replace(/^[/\\]+/, ''));
  const r = path.relative(base, abs);
  if (r === '' || r.startsWith('..') || path.isAbsolute(r)) return r === '' ? base : null;
  return abs;
}
export const ws = (...p) => path.join(WORKSPACE, ...p);
/** Path as Claude should see it: relative to ROOT (its cwd) when inside, else absolute posix. */
export const ref = abs => { const r = path.relative(ROOT, abs); return r && !r.startsWith('..') && !path.isAbsolute(r) ? norm(r) : norm(abs); };
export const insideRoot = abs => { const r = path.relative(ROOT, abs); return !r.startsWith('..') && !path.isAbsolute(r); };

export const readText = (f, def = '') => { try { return fs.readFileSync(f, 'utf8'); } catch { return def; } };
export function readJson(f, def = null) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def === null ? null : structuredClone(def); }
}
function atomic(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  fs.writeFileSync(tmp, data);
  for (let i = 0; ; i++) { // Windows: a reader holding the file open makes rename fail briefly
    try { fs.renameSync(tmp, f); return; } catch (e) { if (i >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { try { fs.rmSync(tmp, { force: true }); } catch {} throw e; } }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30 * (i + 1)); // brief sync sleep
  }
}
export const writeText = (f, s) => atomic(f, String(s));
export const writeJson = (f, o) => atomic(f, JSON.stringify(o, null, 2) + '\n');
export const writeBytes = (f, b) => atomic(f, b);

const pad = n => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // device-local
export const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };

// ---- responses ----
export const json = (res, code, obj) => {
  if (res.headersSent) return res.end();
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
export const fail = (res, code, error, msg = '') => json(res, code, { error, msg });
/** Coded error for flows: thrown and turned into `error {code,msg}` SSE events or JSON. */
export const err = (code, msg = code, status = 400) => Object.assign(new Error(msg), { code, status });

/** Open an SSE stream. send() is a no-op once the client went away (flows keep running). */
export function sse(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(': open\n\n');
  const send = (type, data) => { if (!res.writableEnded && !res.destroyed) res.write(`event: ${type}\ndata: ${JSON.stringify(data ?? {})}\n\n`); };
  return { send, end: () => { if (!res.writableEnded) res.end(); } };
}
/** Run `fn(send)` as an SSE flow: result → `done {result}`, thrown coded error → `error {code,msg}`. */
export async function sseFlow(res, fn) {
  const s = sse(res);
  try { const result = await fn(s.send); s.send('phase', { phase: 'done', msg: 'done' }); s.send('done', { result }); }
  catch (e) { s.send('error', { code: e.code || 'internal', msg: String(e.message || e).slice(0, 2000), ...(e.errors ? { errors: e.errors } : {}) }); if (!e.code) console.error(e); }
  finally { s.end(); }
}

// ---- one-at-a-time locks (claude, render) ----
export function makeLock(name) {
  let cur = null;
  return {
    busy: () => !!cur,
    acquire() {
      if (cur) throw err('busy', `${name} is busy`, 409);
      const ac = new AbortController(); const me = { ac }; cur = me;
      return { signal: ac.signal, release() { if (cur === me) cur = null; } };
    },
    cancel() { if (!cur) return false; cur.ac.abort(); return true; },
  };
}

// ---- logging ----
export function logRun(entry) {
  try {
    fs.mkdirSync(ws('logs'), { recursive: true });
    fs.appendFileSync(ws('logs', 'runs.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch (e) { console.error('runs.jsonl:', e.message); }
}

// ---- workspace skeleton + defaults (SPEC §2–§3) ----
export const DEFAULTS = {
  settings: { uiLang: 'ar', slidesDefault: 8, hashtags: 5, category: '', visualQA: true, onboarded: false },
  identity: { name: '', handle: '', role: '', photo: null, facePos: '50% 28%', template: 'editorial', accent: '', font: 'cairo' },
  accounts: Object.fromEntries(['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'].map(k => [k, { url: '', bio: '' }])),
  ideas: { ideas: [] },
};
export const FILES = {
  settings: () => ws('settings.json'),
  identity: () => ws('brand', 'identity.json'),
  accounts: () => ws('brand', 'accounts.json'),
  ideas: () => ws('ideas', 'ideas.json'),
};
export function ensureWorkspace() {
  for (const d of ['brand', 'ideas', 'decks', 'preview', 'exports', 'logs']) fs.mkdirSync(ws(d), { recursive: true });
  for (const k of Object.keys(FILES)) if (!fs.existsSync(FILES[k]())) writeJson(FILES[k](), DEFAULTS[k]);
  if (!fs.existsSync(ws('logs', 'hot.md'))) writeText(ws('logs', 'hot.md'), '');
  return WORKSPACE;
}
export const load = k => ({ ...structuredClone(DEFAULTS[k]), ...(readJson(FILES[k](), DEFAULTS[k]) || {}) });
export const save = (k, v) => writeJson(FILES[k](), v);

/**
 * Route table → module handler. `['GET', '/api/ideas/:id', fn]`; fn({req,res,url,body,params}) may return a value
 * (sent as 200 JSON) or handle `res` itself. Thrown coded errors become `{error,msg}` with their status.
 */
export function router(table) {
  const rs = table.map(([m, p, fn]) => {
    const names = [];
    const re = new RegExp('^' + p.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    return { m, re, names, fn };
  });
  return async ctx => {
    for (const r of rs) {
      const hit = ctx.url.pathname.match(r.re);
      if (!hit) continue;
      if (r.m !== ctx.req.method && !(r.m === 'GET' && ctx.req.method === 'HEAD')) continue;
      ctx.params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(hit[i + 1])]));
      try { const out = await r.fn(ctx); if (out !== undefined && !ctx.res.headersSent) json(ctx.res, 200, out); }
      catch (e) { if (!ctx.res.headersSent) fail(ctx.res, e.status || 500, e.code || 'internal', String(e.message || e)); else ctx.res.end(); if (!e.code) console.error(e); }
      return true;
    }
    return false;
  };
}

/** Read the whole request body (Buffer) with a byte cap; null when over the cap. */
export async function readBody(req, cap) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > cap) return null; chunks.push(c); }
  return Buffer.concat(chunks);
}
