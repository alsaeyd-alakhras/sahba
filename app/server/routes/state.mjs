// App state, settings, doctor, run log, cancel.
import { router, load, save, ws, readText, err } from '../lib.mjs';
import * as claude from '../claude.mjs';
import * as jobs from '../jobs.mjs';
import { available } from '../engine.mjs';
import { ideas } from '../store.mjs';
import { checks } from '../doctor.mjs';

const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export function cleanSettings(cur, b) {
  const n = { ...cur };
  if ('uiLang' in b) n.uiLang = b.uiLang === 'en' ? 'en' : 'ar';
  if ('slidesDefault' in b) n.slidesDefault = int(b.slidesDefault, 4, 12, cur.slidesDefault);
  if ('hashtags' in b) n.hashtags = int(b.hashtags, 0, 30, cur.hashtags);
  if ('category' in b) n.category = String(b.category ?? '').slice(0, 80);
  if ('visualQA' in b) n.visualQA = !!b.visualQA;
  if ('onboarded' in b) n.onboarded = !!b.onboarded;
  return n;
}

export default router([
  ['GET', '/api/state', () => ({
    settings: load('settings'), identity: load('identity'), claude: claude.status(),
    ideasCount: ideas().length, busy: { claude: claude.busy(), render: jobs.busy() }, engine: available(),
  })],
  ['GET', '/api/settings', () => load('settings')],
  ['PUT', '/api/settings', ({ body }) => { const s = cleanSettings(load('settings'), body); save('settings', s); return s; }],
  ['GET', '/api/doctor', async ({ url }) => ({ checks: await checks({ refresh: url.searchParams.has('refresh') }) })],
  ['GET', '/api/log', ({ url }) => {
    const limit = int(url.searchParams.get('limit'), 1, 1000, 100);
    const lines = readText(ws('logs', 'runs.jsonl')).split('\n').filter(Boolean).slice(-limit);
    return { entries: lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } }).reverse() };
  }],
  ['POST', '/api/cancel', ({ body }) => {
    if (body.kind === 'claude') return { ok: claude.cancel() };
    if (body.kind === 'render') return { ok: jobs.cancel() };
    throw err('bad_request', 'kind must be "claude" or "render"');
  }],
]);
