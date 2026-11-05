// The factory (PLAN §8): draft → validate (+1 resumed retry) → history → render preview → visual QA → preview;
// revise (render only changed slides) · rerender (no Claude) · caption edit · restore · export · open · gallery.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { router, sseFlow, load, ws, ref, norm, readText, writeText, writeJson, today, err, WORKSPACE } from '../lib.mjs';
import * as claude from '../claude.mjs';
import * as jobs from '../jobs.mjs';
import * as P from '../prompts.mjs';
import * as S from '../store.mjs';
import { engine } from '../engine.mjs';
import { deckTemplate } from './templates.mjs';

const fileUrl = f => { if (!f) return null; const r = path.relative(WORKSPACE, path.resolve(WORKSPACE, f)); return r.startsWith('..') ? null : `/files/${norm(r)}`; };
const issueText = errors => errors.slice(0, 12).map(e => `${e.slide ? `#${e.slide} ` : ''}${e.field ? e.field + ' ' : ''}${e.code}: ${e.msg}`).join(' · ');

/** Read + parse + engine-validate the deck file Claude wrote. Problems come back as Issue[] for the retry prompt. */
function check(E, id) {
  const issue = (code, msg) => ({ ok: false, errors: [{ slide: null, field: null, code, msg }], warnings: [] });
  const txt = readText(S.deckPath(id), null);
  if (txt === null) return issue('missing', `The deck file ${ref(S.deckPath(id))} was not written.`);
  let deck; try { deck = JSON.parse(txt); } catch (e) { return issue('json', `The file is not valid JSON: ${e.message}`); }
  if (!deck || typeof deck !== 'object' || !Array.isArray(deck.slides) || !deck.slides.length) return issue('shape', 'The deck must be a JSON object with a non-empty "slides" array.');
  const v = E.validateDeck(deck);
  return { ok: !!v.ok, errors: v.errors || [], warnings: v.warnings || [], deck };
}

/** Lock both queues for a Claude+render flow; 409 before the SSE stream opens. */
function lockBoth() {
  const c = claude.lock.acquire();
  let r; try { r = jobs.lock.acquire(); } catch (e) { c.release(); throw e; }
  return { signal: AbortSignal.any([c.signal, r.signal]), release() { r.release(); c.release(); } };
}
function notDrafting(idea) { if (idea.status === 'drafting') throw err('busy', 'idea is being drafted', 409); }

async function renderTo({ send, idea, deck, outDir, only, signal, kind = 'preview' }) {
  const template = deckTemplate(deck, idea);
  send('phase', { phase: kind === 'export' ? 'export' : 'render', msg: only?.length ? `rendering slides ${only.join(',')}` : 'rendering all slides', only: only || null });
  return jobs.render({ deck, outDir, only, template, signal, meta: { ideaId: idea.id, target: kind },
    onProgress: p => send('progress', { n: p.n, total: p.total, file: fileUrl(p.file) }) });
}

/**
 * Shared Claude-writes-the-deck step: run → validate → on errors resume once → commit (+history).
 * On failure the previous deck file is put back so a bad write never replaces a good deck.
 */
async function claudeDeck({ send, idea, task, signal, meta }) {
  const E = await engine();
  const prevText = readText(S.deckPath(idea.id), null);
  const fwd = claude.forward(send);
  try {
    send('phase', { phase: 'claude', msg: `${task.task}: Claude is writing the deck` });
    let r = await claude.run({ ...task, signal, onEvent: fwd, meta });
    if (!r.ok) throw err(r.code, r.error);
    const warnings = [...r.warnings];
    send('phase', { phase: 'validate', msg: 'validating deck' });
    let v = check(E, idea.id);
    if (!v.ok) {
      send('phase', { phase: 'retry', msg: `fixing ${v.errors.length} problem(s)`, errors: v.errors });
      const t2 = P.retry({ idea, errors: v.errors });
      r = await claude.run({ ...t2, system: task.system, resume: r.sessionId, signal, onEvent: fwd, meta });
      if (!r.ok) throw err(r.code, r.error);
      warnings.push(...r.warnings);
      send('phase', { phase: 'validate', msg: 'validating deck again' });
      v = check(E, idea.id);
      if (!v.ok) throw Object.assign(err('invalid_deck', `deck still invalid after one retry: ${issueText(v.errors)}`), { errors: v.errors });
    }
    S.writeDeck(idea.id, v.deck);
    return { deck: v.deck, warnings: [...warnings, ...v.warnings.map(w => `${w.code}: ${w.msg}`)] };
  } catch (e) {
    if (prevText === null) fs.rmSync(S.deckPath(idea.id), { force: true }); else writeText(S.deckPath(idea.id), prevText);
    throw e;
  }
}

/** Visual QA: Claude (Read only) looks at _sheet.jpg + overflow; "OK" or a corrected deck → validate → re-render changed slides. */
async function qaPass({ send, idea, deck, out, signal }) {
  const E = await engine();
  send('phase', { phase: 'qa', msg: 'visual check' });
  const sheet = out.sheet ? path.resolve(out.sheet) : path.join(S.previewDir(idea.id), '_sheet.jpg');
  const r = await claude.run({ ...P.qa({ idea, sheet, overflow: out.overflow }), signal, onEvent: claude.forward(send), meta: { ideaId: idea.id } });
  if (r.code === 'cancelled') throw err('cancelled', 'cancelled');
  if (!r.ok) return { deck, warnings: [`qa skipped: ${r.error}`] };
  if (/^\W*OK\W*$/i.test(r.text.trim())) return { deck, warnings: [], qa: 'ok' };
  const fixed = P.extractJson(r.text);
  if (!fixed || !Array.isArray(fixed.slides)) return { deck, warnings: ['qa: reply was neither OK nor a deck — ignored'] };
  const v = E.validateDeck(fixed);
  if (!v.ok) return { deck, warnings: [`qa: corrected deck was invalid — ignored (${issueText(v.errors)})`] };
  const changed = S.changedSlides(deck, fixed);
  if (changed && !changed.length) return { deck, warnings: [], qa: 'ok' };
  S.writeDeck(idea.id, fixed);
  await renderTo({ send, idea, deck: fixed, outDir: S.previewDir(idea.id), only: changed, signal });
  return { deck: fixed, warnings: [], qa: 'fixed', changed };
}

/** drafting + prevStatus while Claude owns the deck; the previous status comes back on any failure; locks always released. */
async function guarded(idea, l, fn) {
  const prevStatus = idea.status;
  try {
    S.patchIdea(idea.id, { status: 'drafting', prevStatus });
    try { return await fn(); }
    catch (e) { if (S.getIdea(idea.id)) S.patchIdea(idea.id, { status: prevStatus, prevStatus: null }); throw e; }
  } finally { l.release(); }
}

function draft({ res, params, body }) {
  const idea = S.mustIdea(params.id); notDrafting(idea);
  const l = lockBoth();
  return sseFlow(res, send => guarded(idea, l, async () => {
    const template = idea.template || load('identity').template || 'editorial';
    const task = P.draft({ idea, template, notes: String(body.notes ?? '').slice(0, 4000) });
    let { deck, warnings } = await claudeDeck({ send, idea, task, signal: l.signal, meta: { ideaId: idea.id, route: 'draft' } });
    S.patchIdea(idea.id, { deck: `decks/${idea.id}.json` });
    const out = await renderTo({ send, idea, deck, outDir: S.previewDir(idea.id), signal: l.signal }); // full render; extra old PNGs pruned
    let qa = null;
    if (load('settings').visualQA) { const q = await qaPass({ send, idea, deck, out, signal: l.signal }); deck = q.deck; warnings.push(...q.warnings); qa = q.qa || null; }
    const done = S.patchIdea(idea.id, { status: 'preview', prevStatus: null });
    return { idea: done, deck, preview: S.previewInfo(idea.id), warnings, qa };
  }));
}

function revise({ res, params, body }) {
  const idea = S.mustIdea(params.id); notDrafting(idea);
  const prev = S.readDeck(idea.id); if (!prev?.slides) throw err('no_deck', 'this idea has no deck yet', 404);
  const comments = (Array.isArray(body.comments) ? body.comments : [])
    .map(c => ({ slide: parseInt(c?.slide, 10) || 0, text: String(c?.text ?? '').trim().slice(0, 2000) })).filter(c => c.text);
  const general = String(body.general ?? '').trim().slice(0, 4000);
  if (!comments.length && !general) throw err('bad_request', 'comments or general required');
  const l = lockBoth();
  return sseFlow(res, send => guarded(idea, l, async () => {
    const { deck, warnings } = await claudeDeck({ send, idea, task: P.revise({ idea, comments, general }), signal: l.signal, meta: { ideaId: idea.id, route: 'revise' } });
    const changed = S.changedSlides(prev, deck);
    if (!changed || changed.length) await renderTo({ send, idea, deck, outDir: S.previewDir(idea.id), only: changed, signal: l.signal });
    const done = S.patchIdea(idea.id, { status: 'preview', prevStatus: null });
    return { idea: done, deck, changed: changed || deck.slides.map((_, i) => i + 1), preview: S.previewInfo(idea.id), warnings };
  }));
}

async function rerender({ res, params, body }) {
  const idea = S.mustIdea(params.id); notDrafting(idea);
  let deck = S.readDeck(idea.id); if (!deck?.slides) throw err('no_deck', 'this idea has no deck yet', 404);
  if (body.template) {
    const ids = (await (await engine()).listTemplates()).map(t => t.id);
    if (!ids.includes(body.template)) throw err('bad_request', `unknown template "${body.template}"`);
  }
  const l = jobs.lock.acquire();
  return sseFlow(res, async send => {
    try {
      if (body.template) { // explicit choice: remembered on the idea and the deck
        S.patchIdea(idea.id, { template: body.template });
        if (body.template !== deck.template) { deck = { ...deck, template: body.template }; S.writeDeck(idea.id, deck); }
      }
      await renderTo({ send, idea: S.getIdea(idea.id), deck, outDir: S.previewDir(idea.id), signal: l.signal });
      const cur = S.getIdea(idea.id);
      const done = ['raw', 'ready'].includes(cur.status) ? S.patchIdea(idea.id, { status: 'preview' }) : cur;
      return { idea: done, deck, preview: S.previewInfo(idea.id) };
    } finally { l.release(); }
  });
}

export const slugPart = s => String(s || '').replace(/^\d{4}-\d{2}-\d{2}_?/, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function exportDeck({ res, params }) {
  const idea = S.mustIdea(params.id); notDrafting(idea);
  const deck = S.readDeck(idea.id); if (!deck?.slides) throw err('no_deck', 'this idea has no deck yet', 404);
  const v = (await engine()).validateDeck(deck);
  if (!v.ok) throw Object.assign(err('invalid_deck', issueText(v.errors)), { errors: v.errors });
  const l = jobs.lock.acquire();
  return sseFlow(res, async send => {
    try {
      const dir = `${today()}_${slugPart(deck.slug) || slugPart(idea.title) || idea.id}`;
      const outDir = ws('exports', dir);
      fs.rmSync(outDir, { recursive: true, force: true }); // same idea re-exported the same day → fresh folder
      const out = await renderTo({ send, idea, deck, outDir, signal: l.signal, kind: 'export' });
      writeText(path.join(outDir, 'caption.txt'), String(deck.caption || '').replace(/\r?\n/g, '\r\n'));
      fs.rmSync(path.join(outDir, '_report.json'), { force: true });
      const done = S.patchIdea(idea.id, { status: 'exported', exported: `exports/${dir}` });
      return { idea: done, dir: `exports/${dir}`, files: out.files.map(fileUrl), sheet: fileUrl(out.sheet), caption: deck.caption || '', overflow: out.overflow };
    } finally { l.release(); }
  });
}

function openFolder({ params }) {
  const idea = S.mustIdea(params.id);
  if (!idea.exported) throw err('not_exported', 'this idea has not been exported yet', 404);
  const dir = ws(idea.exported);
  if (!fs.existsSync(dir)) throw err('not_found', 'export folder is missing', 404);
  if (!process.env.SAHBA_NO_OPEN) {
    const [cmd, args] = process.platform === 'win32' ? ['explorer.exe', [dir]] : process.platform === 'darwin' ? ['open', [dir]] : ['xdg-open', [dir]];
    try { spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false }).on('error', () => {}).unref(); } catch {}
  }
  return { ok: true, dir: idea.exported };
}

function gallery() {
  let dirs = []; try { dirs = fs.readdirSync(ws('exports'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch {}
  const byDir = new Map(S.ideas().filter(i => i.exported).map(i => [i.exported.replace(/^exports\//, ''), i]));
  return dirs.map(d => {
    const i = byDir.get(d) || null, abs = ws('exports', d);
    return { id: i?.id || null, title: i?.title || d, dir: `exports/${d}`, cover: fs.existsSync(path.join(abs, '01.png')) ? `/files/exports/${d}/01.png` : null,
      date: (d.match(/^\d{4}-\d{2}-\d{2}/) || [i?.updated || ''])[0], count: S.countPngs(abs), published: i?.published || null };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.dir.localeCompare(a.dir));
}

export default router([
  ['GET', '/api/factory/:id', ({ params }) => {
    const idea = S.mustIdea(params.id);
    return { idea, deck: S.readDeck(idea.id), preview: S.previewInfo(idea.id), history: S.history(idea.id) };
  }],
  ['POST', '/api/factory/:id/draft', draft],
  ['POST', '/api/factory/:id/revise', revise],
  ['POST', '/api/factory/:id/rerender', rerender],
  ['PUT', '/api/factory/:id/deck', ({ params, body }) => {
    const idea = S.mustIdea(params.id); notDrafting(idea);
    const deck = S.readDeck(idea.id); if (!deck) throw err('no_deck', 'this idea has no deck yet', 404);
    if (typeof body.caption !== 'string') throw err('bad_request', 'caption required');
    deck.caption = body.caption.slice(0, 5000); S.writeDeck(idea.id, deck); S.patchIdea(idea.id, {});
    return deck;
  }],
  ['POST', '/api/factory/:id/restore', ({ params, body }) => {
    const idea = S.mustIdea(params.id); notDrafting(idea);
    const deck = S.readVersion(idea.id, body.version);
    writeJson(S.deckPath(idea.id), deck); S.patchIdea(idea.id, { deck: `decks/${idea.id}.json` });
    return deck; // preview is now stale (GET factory → preview.stale); the UI re-renders with /rerender
  }],
  ['POST', '/api/factory/:id/export', exportDeck],
  ['POST', '/api/factory/:id/open', openFolder],
  ['GET', '/api/gallery', gallery],
]);
