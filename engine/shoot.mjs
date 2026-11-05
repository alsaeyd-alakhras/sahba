// Headless Chrome/Edge over the DevTools Protocol using Node's built-in WebSocket. No puppeteer.
// One browser per deck: launch() -> page.shoot(htmlFile) ... -> close().
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { W, H } from './util.mjs';

/* ── locate a browser ─────────────────────────────── */
export function findBrowser() {
  const env = process.env.CHROME;
  if (env && fs.existsSync(env)) return env;
  const c = [];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    for (const r of roots) c.push(
      path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(r, 'Chromium', 'Application', 'chrome.exe'),
      path.join(r, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'));
  } else if (process.platform === 'darwin') {
    for (const base of ['/Applications', path.join(os.homedir(), 'Applications')]) c.push(
      path.join(base, 'Google Chrome.app/Contents/MacOS/Google Chrome'),
      path.join(base, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
      path.join(base, 'Chromium.app/Contents/MacOS/Chromium'),
      path.join(base, 'Brave Browser.app/Contents/MacOS/Brave Browser'));
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable']) {
      try { const p = execFileSync('which', [n], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); if (p) c.push(p); } catch { /* not found */ }
    }
  }
  return c.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

export const NO_BROWSER_MSG = 'No Chrome or Edge browser found. Install Google Chrome (or Microsoft Edge), or set the CHROME environment variable to the browser executable path.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms).unref());
const abortError = () => Object.assign(new Error('render aborted'), { name: 'AbortError', code: 'aborted' });

/* ── browser session ──────────────────────────────── */
export async function launch({ signal, timeoutMs = 20000 } = {}) {
  const exe = findBrowser();
  if (!exe) throw Object.assign(new Error(NO_BROWSER_MSG), { code: 'no_browser' });
  if (signal?.aborted) throw abortError();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sahba-chrome-'));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-default-apps', '--disable-component-update',
    '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--allow-file-access-from-files', '--disable-features=Translate,MediaRouter',
    'about:blank'];
  const proc = spawn(exe, args, { stdio: 'ignore', windowsHide: true });
  let exited = false;
  const exitP = new Promise((r) => proc.once('exit', () => { exited = true; r(); }));
  proc.once('error', () => { exited = true; });
  // if this Node process dies mid-render, don't leave a headless browser behind
  const killOnExit = () => { if (!exited) { try { proc.kill('SIGKILL'); } catch { /* ignore */ } } };
  process.once('exit', killOnExit);

  let ws = null, closed = false;
  const pending = new Map();
  const listeners = new Set();
  let seq = 0;

  let closing = null;
  function close() { if (!closing) closing = doClose(); return closing; }
  async function doClose() {
    closed = true;
    try { if (ws && ws.readyState === 1) { ws.send(JSON.stringify({ id: ++seq, method: 'Browser.close' })); } } catch { /* ignore */ }
    await Promise.race([exitP, sleep(3000)]);
    if (!exited) { try { proc.kill('SIGKILL'); } catch { /* ignore */ } await Promise.race([exitP, sleep(2000)]); }
    if (!exited && process.platform === 'win32' && proc.pid) { try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ignore */ } }
    try { ws?.close(); } catch { /* ignore */ }
    for (const [, p] of pending) p.reject(abortError());
    pending.clear();
    process.removeListener('exit', killOnExit);
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); }
    }
  }
  const onAbort = () => { close(); };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    // wait for DevToolsActivePort
    const portFile = path.join(profile, 'DevToolsActivePort');
    const t0 = Date.now();
    let port, wsPath;
    while (true) {
      if (signal?.aborted) throw abortError();
      if (exited) throw Object.assign(new Error(`Browser exited during start-up (${exe}).`), { code: 'browser_failed' });
      let txt = '';
      try { txt = fs.readFileSync(portFile, 'utf8'); } catch { /* not written yet, or locked while the browser writes it */ }
      const [p, wp] = txt.split(/\r?\n/);
      if (p && wp) { port = p.trim(); wsPath = wp.trim(); break; }
      if (Date.now() - t0 > timeoutMs) throw Object.assign(new Error('Timed out waiting for the browser DevTools port.'), { code: 'browser_timeout' });
      await sleep(50);
    }
    ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('Could not connect to the browser DevTools socket.')); });
    ws.onmessage = (ev) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.reject(new Error(`${p.method}: ${m.error.message}`)) : p.resolve(m.result);
      } else if (m.method) for (const l of listeners) l(m);
    };
    ws.onclose = () => { for (const [, p] of pending) p.reject(new Error('browser connection closed')); pending.clear(); };
  } catch (e) {
    await close();
    signal?.removeEventListener('abort', onAbort);
    throw e;
  }

  const send = (method, params = {}, sessionId, ms = 30000) => new Promise((resolve, reject) => {
    if (closed) return reject(signal?.aborted ? abortError() : new Error('browser closed'));
    const id = ++seq;
    const timer = setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`${method}: timed out`)); } }, ms);
    pending.set(id, { method, resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const waitEvent = (method, sessionId, ms = 30000) => new Promise((resolve, reject) => {
    const l = (m) => { if (m.method === method && m.sessionId === sessionId) { listeners.delete(l); clearTimeout(t); resolve(m.params); } };
    const t = setTimeout(() => { listeners.delete(l); reject(new Error(`${method}: timed out`)); }, ms);
    listeners.add(l);
  });

  async function newPage() {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    const page = {
      async size(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId); },
      async goto(url) {
        const loaded = waitEvent('Page.loadEventFired', sessionId);
        const r = await send('Page.navigate', { url }, sessionId);
        if (r.errorText) throw new Error(`navigate failed: ${r.errorText}`);
        await loaded;
      },
      async eval(expression) {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error('page script failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
        return r.result.value;
      },
      async shot({ format = 'png', quality, width = W, height = H } = {}) {
        const r = await send('Page.captureScreenshot', { format, ...(quality ? { quality } : {}), clip: { x: 0, y: 0, width, height, scale: 1 }, captureBeyondViewport: false, fromSurface: true }, sessionId, 60000);
        return Buffer.from(r.data, 'base64');
      },
    };
    await page.size(W, H);
    return page;
  }

  return {
    exe, newPage, send,
    async close() { signal?.removeEventListener('abort', onAbort); await close(); },
    get closed() { return closed; },
  };
}

/* ── in-page checks ───────────────────────────────── */
export const READY_JS = `(async () => {
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { fonts: [...document.fonts].filter(f => f.status === 'loaded').length, brokenImages: [...document.images].filter(i => !i.naturalWidth).length };
})()`;

/** returns [{text, reason}] — clipped boxes, text outside the slide, art covering text */
export const CHECK_JS = `(() => {
  const W = ${W}, H = ${H}, out = [], seen = new Set();
  const hide = document.createElement('style');
  hide.textContent = '.rc-svg{display:none!important}';
  document.head.appendChild(hide);
  const snip = (s) => String(s || '').replace(/\\s+/g, ' ').trim().slice(0, 90);
  const push = (text, reason) => { const k = reason + '|' + text; if (!seen.has(k)) { seen.add(k); out.push({ text, reason }); } };
  // horizontal: a text box whose content is wider than the box (nowrap labels, long words)
  for (const el of document.querySelectorAll('[data-fit]')) {
    if (el.matches('.content') || getComputedStyle(el).display === 'inline') continue;
    if (el.scrollWidth > el.clientWidth + 2) push(snip(el.innerText), 'overflow-x: text is wider than its box');
  }
  // vertical: fixed layout areas whose children spill past the area (too much text for the slide)
  // (measured against the safe zone between the top badge and the bottom page number, not the nominal box)
  const SAFE_TOP = 118, SAFE_BOTTOM = H - 92;
  for (const box of document.querySelectorAll('.content, .cover-wrap, .cta-wrap, [data-box]')) {
    for (const ch of box.children) {
      const r = ch.getBoundingClientRect();
      if (r.height < 1) continue;
      if (r.top < SAFE_TOP || r.bottom > SAFE_BOTTOM) push(snip(ch.innerText) || '(block)', 'overflow-y: too much content for the slide (runs into the badge/page-number area) — shorten text or drop an item');
    }
  }
  // pick: pills must not run into the chosen option
  const hot = document.querySelector('.pick-hot');
  if (hot) { const h = hot.getBoundingClientRect(); for (const p of document.querySelectorAll('.pill')) { const r = p.getBoundingClientRect(); if (r.bottom > h.top - 4 && r.top < h.bottom) push(snip(p.innerText), 'overlap: option pills run into the chosen option — use fewer/shorter "others"'); } }
  // fixed-height boxes (steps rows) — text spilling out of the row
  for (const el of document.querySelectorAll('.step')) {
    const t = el.querySelector('.step-t'); if (!t) continue;
    if (t.getBoundingClientRect().height > el.getBoundingClientRect().height + 2) push(snip(t.innerText), 'overflow-y: step text wraps taller than its circle row (shorten it or raise "gap"/"R")');
  }
  const walker = document.createTreeWalker(document.querySelector('.slide') || document.body, NodeFilter.SHOW_TEXT);
  const textRects = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    if (n.parentElement.closest('.ghost-num')) continue; // decorative watermark number, meant to bleed
    const r = document.createRange(); r.selectNodeContents(n);
    const inArt = !!n.parentElement.closest('.art');
    const owner = n.parentElement.closest('[data-fit]') || n.parentElement;
    for (const b of r.getClientRects()) {
      if (b.width < 1 || b.height < 1) continue;
      if (b.left < -2 || b.top < -2 || b.right > W + 2 || b.bottom > H + 2) push(snip(owner.innerText), 'outside: text runs off the slide');
      if (!inArt) textRects.push({ b, owner });
    }
  }
  const arts = [...document.querySelectorAll('[data-art]')].map(e => e.getBoundingClientRect());
  for (const a of arts) {
    if (a.left < -2 || a.right > W + 2 || a.top < -2 || a.bottom > H + 2) push('(art)', 'outside: art composition runs off the slide — adjust "artAt"');
  }
  for (const { b, owner } of textRects) for (const a of arts) {
    const ix = Math.min(b.right, a.right) - Math.max(b.left, a.left), iy = Math.min(b.bottom, a.bottom) - Math.max(b.top, a.top);
    if (ix > 8 && iy > 8 && ix * iy > 300) { push(snip(owner.innerText), 'overlap: art composition covers this text — move "artAt" or shorten the text'); break; }
  }
  hide.remove();
  return out;
})()`;
