// Ideas, decks, deck history and preview metadata (all files under WORKSPACE; single process → sync read-modify-write).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ws, load, save, readJson, writeJson, today, mtime, err } from './lib.mjs';

export const STATUSES = ['raw', 'ready', 'drafting', 'preview', 'approved', 'exported', 'published'];
export const idOk = id => /^i_\d{8}_[a-z0-9]{4,8}$/.test(id || '');

// ---- ideas ----
export const ideas = () => { const l = load('ideas').ideas; return Array.isArray(l) ? l : []; };
const saveIdeas = list => save('ideas', { ideas: list });
export const getIdea = id => ideas().find(i => i.id === id) || null;
export function mustIdea(id) { const i = idOk(id) && getIdea(id); if (!i) throw err('not_found', 'idea not found', 404); return i; }

export function newId(list = ideas()) {
  const d = today().replace(/-/g, '');
  for (;;) { const id = `i_${d}_${crypto.randomBytes(3).toString('hex').slice(0, 4)}`; if (!list.some(i => i.id === id)) return id; }
}
export function blankIdea(fields, list) {
  const t = today();
  return { id: newId(list), title: '', note: '', pillar: '', status: 'raw', source: 'me', outline: [], hook: '', template: null,
    created: t, updated: t, deck: null, exported: null, published: null, prevStatus: null, ...fields };
}
export function addIdeas(items, { front = true } = {}) {
  const list = ideas(); const made = [];
  for (const f of items) { const i = blankIdea(f, list); list.push(i); made.push(i); }
  saveIdeas(front ? [...made, ...list.filter(i => !made.includes(i))] : list);
  return made;
}
export function patchIdea(id, patch) {
  const list = ideas(); const i = list.findIndex(x => x.id === id);
  if (i < 0) throw err('not_found', 'idea not found', 404);
  list[i] = { ...list[i], ...patch, id, updated: today() };
  saveIdeas(list);
  return list[i];
}
export function removeIdea(id) {
  const list = ideas(); if (!list.some(i => i.id === id)) throw err('not_found', 'idea not found', 404);
  saveIdeas(list.filter(i => i.id !== id));
  for (const p of [deckPath(id), historyDir(id), previewDir(id)]) fs.rmSync(p, { recursive: true, force: true });
}
export function reorder(ids) {
  const list = ideas(); const pos = new Map(ids.map((id, n) => [id, n]));
  const listed = list.filter(i => pos.has(i.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
  saveIdeas([...listed, ...list.filter(i => !pos.has(i.id))]);
}
/** Server start: a crash/restart mid-draft must not leave ideas stuck in `drafting`. */
export function recoverDrafting() {
  const list = ideas(); let n = 0;
  for (const i of list) if (i.status === 'drafting') { i.status = i.prevStatus && i.prevStatus !== 'drafting' ? i.prevStatus : (fs.existsSync(deckPath(i.id)) ? 'preview' : 'ready'); i.prevStatus = null; n++; }
  if (n) saveIdeas(list);
  return n;
}

// ---- decks + history ----
export const deckPath = id => ws('decks', `${id}.json`);
export const historyDir = id => ws('decks', `${id}.history`);
export const previewDir = id => ws('preview', id);
export const readDeck = id => readJson(deckPath(id));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');           // Windows-safe file name
const unstamp = v => v.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z.*$/, '$1:$2:$3.$4Z');

export function snapshot(id, deck) {
  const dir = historyDir(id); fs.mkdirSync(dir, { recursive: true });
  let v = stamp(), n = 1; while (fs.existsSync(path.join(dir, `${v}.json`))) v = `${stamp()}_${n++}`;
  writeJson(path.join(dir, `${v}.json`), deck);
  return v;
}
/** Write the current deck and keep a copy in history. */
export function writeDeck(id, deck) { writeJson(deckPath(id), deck); return snapshot(id, deck); }
export function history(id) {
  let files = []; try { files = fs.readdirSync(historyDir(id)).filter(f => f.endsWith('.json')); } catch {}
  return files.map(f => f.slice(0, -5)).sort().reverse().map(version => ({ version, date: unstamp(version) }));
}
export function readVersion(id, version) {
  if (!/^[\w-]+$/.test(version || '')) throw err('bad_request', 'invalid version');
  const d = readJson(path.join(historyDir(id), `${version}.json`));
  if (!d) throw err('not_found', 'version not found', 404);
  return d;
}

/** 1-based slide numbers that differ between two decks; null = everything (count or template changed). */
export function changedSlides(prev, next) {
  if (!prev || !Array.isArray(prev.slides) || prev.slides.length !== next.slides.length || prev.template !== next.template) return null;
  const out = [];
  next.slides.forEach((s, i) => { if (JSON.stringify(s) !== JSON.stringify(prev.slides[i])) out.push(i + 1); });
  return out;
}

// ---- preview metadata ----
const pngs = dir => { try { return fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f)).sort(); } catch { return []; } };
export const countPngs = dir => pngs(dir).length;
export function previewInfo(id) {
  const dir = previewDir(id); const v = f => Math.round(mtime(path.join(dir, f)));
  const files = pngs(dir).map(f => `/files/preview/${id}/${f}?v=${v(f)}`);
  const sheet = fs.existsSync(path.join(dir, '_sheet.jpg')) ? `/files/preview/${id}/_sheet.jpg?v=${v('_sheet.jpg')}` : null;
  const rep = readJson(path.join(dir, '_report.json'), {});
  return { files, sheet, overflow: rep.overflow || [], template: rep.template || null, stale: !!files.length && mtime(deckPath(id)) > (rep.atMs || 0) };
}
export function writeReport(dir, { overflow, template }) { writeJson(path.join(dir, '_report.json'), { overflow, template, atMs: Date.now() }); }
/** Drop rendered slides beyond the deck length (deck got shorter). */
export function prunePngs(dir, count) { for (const f of pngs(dir)) if (parseInt(f, 10) > count) fs.rmSync(path.join(dir, f), { force: true }); }

export const statusOk = s => STATUSES.includes(s);
