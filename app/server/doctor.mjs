// Device checks for /api/doctor (SPEC §6): node, chrome, claude, claudeLogin, disk, workspace.
// `detail` is data (versions, paths, sizes); `fix` is a language-neutral command or URL the UI shows next to its own i18n text.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { WORKSPACE, ws } from './lib.mjs';
import * as claude from './claude.mjs';

export function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const L = process.env.LOCALAPPDATA || '', P = process.env.PROGRAMFILES || 'C:\\Program Files', P86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const cands = {
    win32: [`${P}\\Google\\Chrome\\Application\\chrome.exe`, `${P86}\\Google\\Chrome\\Application\\chrome.exe`, `${L}\\Google\\Chrome\\Application\\chrome.exe`,
      `${P86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${P}\\Microsoft\\Edge\\Application\\msedge.exe`],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium', path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')],
  }[process.platform] || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
  return cands.find(f => f && fs.existsSync(f)) || null;
}

/** major version of the browser at `exe`, or null. Windows keeps a "<version>" folder next to the exe;
 *  macOS/Linux print it with --version. Templates need ≥ 119 (CSS relative colors). */
export function chromeMajor(exe) {
  try {
    if (process.platform === 'win32') {
      const v = fs.readdirSync(path.dirname(exe)).filter(n => /^\d+\.\d+\./.test(n)).sort((a, b) => parseInt(b) - parseInt(a))[0];
      return v ? parseInt(v) : null;
    }
    const out = execFileSync(exe, ['--version'], { encoding: 'utf8', timeout: 5000 });
    const m = out.match(/(\d+)\.\d+\./); return m ? Number(m[1]) : null;
  } catch { return null; }
}
export const CHROME_MIN = 119;

const MB = 1024 * 1024;
export async function checks({ refresh = false } = {}) {
  const out = [];
  const major = Number(process.versions.node.split('.')[0]);
  out.push({ id: 'node', ok: major >= 22, detail: process.version, fix: major >= 22 ? '' : 'https://nodejs.org' });

  const chrome = findChrome();
  const cv = chrome ? chromeMajor(chrome) : null;
  const chromeOk = !!chrome && (cv === null || cv >= CHROME_MIN); // unknown version: don't block
  out.push({ id: 'chrome', ok: chromeOk, detail: chrome ? `${chrome}${cv ? ` (v${cv})` : ''}` : '', fix: chromeOk ? '' : (chrome ? `update browser to v${CHROME_MIN}+` : 'https://www.google.com/chrome/') });

  const c = await claude.status({ wait: true, force: refresh });
  out.push({ id: 'claude', ok: !!c.installed, detail: c.version || c.detail || '', fix: c.installed ? '' : 'npm install -g @anthropic-ai/claude-code' });
  out.push({ id: 'claudeLogin', ok: !!c.loggedIn, detail: c.loggedIn ? '' : (c.detail || ''), fix: c.loggedIn ? '' : 'claude  →  /login' });

  let free = null; try { const s = fs.statfsSync(WORKSPACE); free = s.bavail * s.bsize; } catch {}
  out.push({ id: 'disk', ok: free === null || free > 500 * MB, detail: free === null ? '' : `${Math.round(free / MB)} MB free`, fix: free !== null && free <= 500 * MB ? 'free disk space (≥ 500 MB)' : '' });

  let wsOk = false, wsDetail = WORKSPACE;
  try { const t = ws('logs', `.doctor-${process.pid}.tmp`); fs.writeFileSync(t, 'ok'); fs.rmSync(t); wsOk = fs.existsSync(ws('brand', 'identity.json')); }
  catch (e) { wsDetail = `${WORKSPACE}: ${e.code || e.message}`; }
  out.push({ id: 'workspace', ok: wsOk, detail: wsDetail, fix: wsOk ? '' : 'SAHBA_WORKSPACE' });
  return out;
}
