// Test harness: temp workspace + server child process (PORT=0) + Claude stub + engine (real if present, else mock).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TESTS = path.dirname(fileURLToPath(import.meta.url));
export const APP = path.resolve(TESTS, '..');
export const ROOT = path.resolve(APP, '..');
export const STUB = path.join(TESTS, 'stubs', 'claude-stub.mjs');
export const REAL_ENGINE = path.join(ROOT, 'engine', 'index.mjs');
// SAHBA_TEST_ENGINE=real forces the real engine; default = real when it exists and SAHBA_TEST_ENGINE != mock
export const useReal = process.env.SAHBA_TEST_ENGINE === 'real' || (process.env.SAHBA_TEST_ENGINE !== 'mock' && fs.existsSync(REAL_ENGINE));
export const ENGINE = useReal ? REAL_ENGINE : path.join(TESTS, 'stubs', 'engine-mock.mjs');

export function tempWorkspace(seed = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sahba-test-'));
  const wsDir = path.join(dir, 'workspace');
  for (const [rel, content] of Object.entries(seed)) {
    const f = path.join(wsDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  fs.mkdirSync(wsDir, { recursive: true });
  return { dir, ws: wsDir, stubConfig: path.join(dir, 'stub.json'), argsLog: path.join(dir, 'args.jsonl') };
}

export async function startServer(t, env = {}) {
  const p = spawn(process.execPath, [path.join(APP, 'server.mjs')], {
    cwd: APP, windowsHide: true,
    env: { ...process.env, PORT: '0', SAHBA_WORKSPACE: t.ws, SAHBA_ENGINE: ENGINE, CLAUDE_EXE: STUB, STUB_CONFIG: t.stubConfig,
      STUB_ARGS_LOG: t.argsLog, SAHBA_NO_OPEN: '1', ...env },
  });
  let out = '';
  const base = await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('server did not start: ' + out)), 15_000);
    p.stdout.on('data', d => { out += d; const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (m) { clearTimeout(to); resolve(`http://127.0.0.1:${m[1]}`); } });
    p.stderr.on('data', d => { out += d; });
    p.on('exit', c => { clearTimeout(to); reject(new Error(`server exited ${c}: ${out}`)); });
  });
  p.removeAllListeners('exit');
  const stop = () => new Promise(r => { if (p.exitCode !== null) return r(); p.on('exit', r); p.kill(); });
  return { base, stop, output: () => out };
}

export const stubMode = (t, cfg) => fs.writeFileSync(t.stubConfig, JSON.stringify(cfg));

export async function api(base, method, p, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const r = await fetch(base + p, { method, headers: { ...(body && !isBuf ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : isBuf ? body : JSON.stringify(body) });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, ct, body: ct.includes('json') ? await r.json() : await r.text() };
}

/** POST an SSE endpoint and collect all events → [{event, data}]. Non-SSE replies come back as {status, body}. */
export async function sse(base, p, body = {}) {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!(r.headers.get('content-type') || '').includes('event-stream')) return { status: r.status, body: await r.json() };
  const text = await r.text();
  const events = text.split('\n\n').map(b => {
    const ev = (b.match(/^event: (.+)$/m) || [])[1], data = (b.match(/^data: (.+)$/m) || [])[1];
    return ev ? { event: ev, data: JSON.parse(data) } : null;
  }).filter(Boolean);
  const last = events.at(-1);
  return { status: r.status, events, done: events.find(e => e.event === 'done')?.data, error: events.find(e => e.event === 'error')?.data, last,
    phases: events.filter(e => e.event === 'phase').map(e => e.data.phase) };
}

export const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export const renderLog = t => { try { return fs.readFileSync(path.join(t.ws, 'logs', 'mock-render.log'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } };
export const runs = t => { try { return fs.readFileSync(path.join(t.ws, 'logs', 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
/** argv of the last stream-json Claude run the stub saw (ignores status probes). */
export const lastArgs = t => fs.readFileSync(t.argsLog, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('stream-json')).at(-1);
export const streamArgs = t => fs.readFileSync(t.argsLog, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('stream-json'));
