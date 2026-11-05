// The only place that talks to the Claude Code CLI (SPEC §6 "Claude CLI"). Subscription only: API-key env vars are stripped.
// One run at a time (lock), 300s timeout, cancel = tree kill, every run logged to workspace/logs/runs.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { ROOT, WORKSPACE, norm, insideRoot, makeLock, logRun, err } from './lib.mjs';

export const lock = makeLock('claude');
const TIMEOUT_MS = Number(process.env.SAHBA_CLAUDE_TIMEOUT_MS) || 300_000;
let active = null; // the running child process

// ---- locate the CLI (no shell: .cmd shims are resolved to the real binary) ----
function resolveExe() {
  if (process.env.CLAUDE_EXE) return { cmd: process.env.CLAUDE_EXE, pre: /\.m?js$/i.test(process.env.CLAUDE_EXE) ? 'node' : null };
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const home = os.homedir();
  if (process.platform === 'win32') {
    for (const d of [...dirs, path.join(home, '.local', 'bin')]) if (fs.existsSync(path.join(d, 'claude.exe'))) return { cmd: path.join(d, 'claude.exe') };
    for (const d of [...dirs, path.join(process.env.APPDATA || '', 'npm')]) {
      if (!fs.existsSync(path.join(d, 'claude.cmd'))) continue;
      const pkg = path.join(d, 'node_modules', '@anthropic-ai', 'claude-code');
      if (fs.existsSync(path.join(pkg, 'bin', 'claude.exe'))) return { cmd: path.join(pkg, 'bin', 'claude.exe') };
      if (fs.existsSync(path.join(pkg, 'cli.js'))) return { cmd: path.join(pkg, 'cli.js'), pre: 'node' };
    }
    return null;
  }
  for (const d of [...dirs, path.join(home, '.local', 'bin'), path.join(home, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin'])
    if (fs.existsSync(path.join(d, 'claude'))) return { cmd: path.join(d, 'claude') };
  return null;
}
function spawnClaude(args, opts) {
  const exe = resolveExe();
  if (!exe) throw err('claude_missing', 'Claude Code CLI not found', 503);
  const env = { ...process.env }; delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN;
  const o = { cwd: ROOT, env, windowsHide: true, detached: process.platform !== 'win32', ...opts };
  return exe.pre ? spawn(process.execPath, [exe.cmd, ...args], o) : spawn(exe.cmd, args, o);
}
export function killTree(p) {
  if (!p || p.exitCode !== null || p.signalCode) return;
  if (process.platform === 'win32') { try { spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); return; } catch {} }
  try { process.kill(-p.pid, 'SIGTERM'); } catch { try { p.kill('SIGTERM'); } catch {} }
}

/** Permission-rule path for an absolute file: relative to cwd (ROOT) when inside it, else `//abs/posix`. */
export function rulePath(abs) {
  if (insideRoot(abs)) return norm(path.relative(ROOT, abs));
  return '//' + norm(path.resolve(abs)).replace(/^([A-Za-z]):\/?/, (m, d) => d.toLowerCase() + '/').replace(/^\/+/, '');
}
/** `Read` plus Write/Edit limited to the given absolute files. */
export const toolsFor = (writable = []) => ['Read', ...writable.flatMap(f => [`Write(${rulePath(f)})`, `Edit(${rulePath(f)})`])].join(',');

// ---- workspace change guard: what did the run touch outside its allowed files? ----
const SKIP = new Set(['logs', 'preview', 'exports']);
function snapshot() {
  const out = new Map();
  const walk = (dir, depth) => {
    let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth === 0 && SKIP.has(e.name)) continue; if (!e.name.endsWith('.history') && depth < 4) walk(f, depth + 1); }
      else if (!e.name.endsWith('.tmp')) { try { const s = fs.statSync(f); out.set(f, `${s.mtimeMs}:${s.size}`); } catch {} }
    }
  };
  walk(WORKSPACE, 0);
  return out;
}
const key = f => process.platform === 'win32' ? path.resolve(f).toLowerCase() : path.resolve(f);
function unexpected(before, after, writable) {
  const ok = new Set(writable.map(key)); const bad = [];
  for (const [f, v] of after) if (before.get(f) !== v && !ok.has(key(f))) bad.push(f);
  for (const f of before.keys()) if (!after.has(f) && !ok.has(key(f))) bad.push(f);
  return bad.map(f => norm(path.relative(WORKSPACE, f)));
}

const short = (s, n = 240) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Run one Claude task. Caller must hold `lock` (flows do several runs under one lock).
 * Resolves (never rejects) with { ok, sessionId, text, ms, code?, error?, warnings }.
 */
export function run({ task, prompt, system = '', writable = [], allowedTools, resume, onEvent = () => {}, signal, meta = {} }) {
  const t0 = Date.now();
  const tools = allowedTools || toolsFor(writable);
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default',
    '--allowedTools', tools, '--disallowedTools', 'Bash,PowerShell,WebFetch,WebSearch,NotebookEdit,Task'];
  if (system) args.push('--append-system-prompt', system);
  if (!insideRoot(WORKSPACE)) args.push('--add-dir', WORKSPACE);
  if (resume) args.push('--resume', resume);

  return new Promise(resolve => {
    const done = r => {
      const out = { ok: false, sessionId: null, text: '', ms: Date.now() - t0, warnings: [], ...r };
      logRun({ kind: 'claude', task, ...meta, ok: out.ok, ms: out.ms, code: out.code, error: out.error, sessionId: out.sessionId,
        resumed: !!resume, tools: used.slice(0, 40), warnings: out.warnings.length ? out.warnings : undefined });
      resolve(out);
    };
    const used = [];
    if (active) return done({ code: 'busy', error: 'another Claude run is active' });
    if (signal?.aborted) return done({ code: 'cancelled', error: 'cancelled' });
    const before = snapshot();
    let p;
    try { p = spawnClaude(args); } catch (e) { return done({ code: e.code || 'claude_missing', error: e.message }); }
    active = p;
    let buf = '', stderr = '', sessionId = resume || null, result = null, texts = [], why = null, finished = false;
    const timer = setTimeout(() => { why = 'timeout'; killTree(p); }, TIMEOUT_MS);
    const onAbort = () => { why = why || 'cancelled'; killTree(p); };
    signal?.addEventListener('abort', onAbort, { once: true });

    const finish = code => {
      if (finished) return; finished = true;
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort); if (active === p) active = null;
      const warnings = unexpected(before, snapshot(), writable).map(f => `unexpected change: ${f}`);
      if (warnings.length) console.warn(`[claude:${task}]`, warnings.join('; '));
      const text = (result?.result ?? texts.join('\n\n')) || '';
      if (why === 'timeout') return done({ code: 'timeout', error: `Claude did not finish within ${TIMEOUT_MS / 1000}s`, sessionId, text, warnings });
      if (why) return done({ code: 'cancelled', error: 'cancelled', sessionId, text, warnings });
      if (result && !result.is_error) return done({ ok: true, sessionId, text, warnings, ms: Date.now() - t0 });
      const msg = result?.is_error ? short(result.result || result.subtype, 600) : (stderr.trim().slice(-600) || `claude exited with code ${code}`);
      done({ code: /log ?in|auth|credential|401/i.test(msg) ? 'claude_login' : 'claude_failed', error: msg, sessionId, text, warnings });
    };

    p.on('error', e => { stderr += e.message; finish(1); });
    p.stdin.on('error', () => {}); p.stdin.end(prompt);
    p.stdout.on('data', ch => {
      buf += ch; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.session_id) sessionId = ev.session_id;
        if (ev.type === 'assistant') for (const b of ev.message?.content || []) {
          if (b.type === 'text' && b.text) { texts.push(b.text); onEvent({ type: 'text', delta: b.text }); }
          else if (b.type === 'tool_use') {
            const fp = b.input?.file_path || b.input?.path || b.input?.pattern;
            used.push(`${b.name}${fp ? ' ' + norm(fp) : ''}`);
            onEvent({ type: 'tool', name: b.name, ...(fp ? { path: norm(fp) } : {}) });
          }
        } else if (ev.type === 'result') result = ev;
      }
    });
    p.stderr.on('data', d => { stderr += d; if (stderr.length > 20_000) stderr = stderr.slice(-10_000); });
    p.on('close', finish);
  });
}

export const cancel = () => lock.cancel();
export const busy = () => lock.busy() || !!active;

// ---- status probe: installed / version / loggedIn (cached 10 min) ----
const CACHE_MS = 10 * 60_000;
let probe = { at: 0, installed: null, version: null, loggedIn: null, detail: '' }, probing = null;

function exec(args, timeout, input = '') {
  return new Promise(resolve => {
    let p; try { p = spawnClaude(args, { detached: false }); } catch (e) { return resolve({ code: -1, out: '', errText: e.message, missing: true }); }
    let out = '', errText = '';
    const t = setTimeout(() => { killTree(p); resolve({ code: -2, out, errText: 'timeout' }); }, timeout);
    p.on('error', e => { clearTimeout(t); resolve({ code: -1, out, errText: e.message, missing: e.code === 'ENOENT' }); });
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { errText += d; });
    p.stdin.on('error', () => {}); p.stdin.end(input);
    p.on('close', code => { clearTimeout(t); resolve({ code, out, errText }); });
  });
}

/** Cheap and non-blocking for /api/state: returns the cached status and refreshes it in the background when stale. */
export function status({ wait = false, force = false } = {}) {
  const stale = force || Date.now() - probe.at > CACHE_MS;
  if (stale && !probing && !lock.busy()) probing = refresh().finally(() => { probing = null; });
  const view = () => ({ installed: probe.installed, loggedIn: probe.loggedIn, version: probe.version, detail: probe.detail, checkedAt: probe.at ? new Date(probe.at).toISOString() : null });
  return wait && probing ? probing.then(view) : (wait ? Promise.resolve(view()) : view());
}
async function refresh() {
  const v = await exec(['--version'], 15_000);
  if (v.missing || v.code !== 0) { probe = { at: Date.now(), installed: false, version: null, loggedIn: false, detail: short(v.errText) }; return; }
  const version = (v.out.match(/\d+\.\d+\.\d+/) || [v.out.trim()])[0];
  const r = await exec(['-p', '--output-format', 'json', '--max-turns', '1', '--disallowedTools', 'Bash,PowerShell,Write,Edit,WebFetch,WebSearch'], 30_000, 'Reply with exactly: OK');
  let j = null; try { j = JSON.parse(r.out.trim().split('\n').pop()); } catch {}
  const loggedIn = !!j && !j.is_error;
  probe = { at: Date.now(), installed: true, version, loggedIn, detail: loggedIn ? '' : short(j?.result || r.errText || r.out, 300) };
}

/** run() onEvent → SSE: {type:'text',delta} → `text {delta}`, {type:'tool',name,path} → `tool {name,path}`. */
export const forward = send => ({ type, ...data }) => send(type, data);
