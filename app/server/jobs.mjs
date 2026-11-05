// Render queue: one engine.renderDeck at a time, progress callbacks, AbortController-based cancel, logged to runs.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE, makeLock, logRun, readJson, err } from './lib.mjs';
import { engine } from './engine.mjs';
import { writeReport, prunePngs } from './store.mjs';

export const lock = makeLock('render');
export const busy = () => lock.busy();
export const cancel = () => lock.cancel();

/**
 * Render `deck` into `outDir` (caller holds `lock`). `signal` = the lock's signal (+ optionally a flow's signal).
 * Returns the engine result { files, sheet, overflow }.
 */
export async function render({ deck, outDir, only, template, onProgress = () => {}, signal, meta = {} }) {
  const t0 = Date.now();
  const E = await engine();
  fs.mkdirSync(outDir, { recursive: true });
  try {
    if (signal?.aborted) throw err('cancelled', 'cancelled');
    const r = await E.renderDeck({ deck, workspaceDir: WORKSPACE, outDir, only: only?.length ? only : undefined, template, onProgress, signal });
    if (signal?.aborted) throw err('cancelled', 'cancelled');
    prunePngs(outDir, deck.slides.length);
    // a partial render only re-checks its own slides: keep earlier overflow findings for the untouched ones
    const kept = only?.length ? (readJson(path.join(outDir, '_report.json'), {}).overflow || []).filter(o => !only.includes(o.slide) && o.slide <= deck.slides.length) : [];
    r.overflow = [...kept, ...(r.overflow || [])].sort((a, b) => a.slide - b.slide);
    writeReport(outDir, { overflow: r.overflow, template });
    logRun({ kind: 'render', ...meta, ok: true, ms: Date.now() - t0, only: only || undefined, files: r.files?.length || 0, overflow: r.overflow?.length || 0 });
    return { files: r.files || [], sheet: r.sheet || null, overflow: r.overflow || [] };
  } catch (e) {
    const code = signal?.aborted || e.name === 'AbortError' ? 'cancelled' : (e.code && typeof e.code === 'string' && !e.code.startsWith('E') ? e.code : 'render_failed');
    logRun({ kind: 'render', ...meta, ok: false, ms: Date.now() - t0, code, error: String(e.message || e).slice(0, 600) });
    throw err(code, code === 'cancelled' ? 'cancelled' : `render failed: ${e.message || e}`, 500);
  }
}
