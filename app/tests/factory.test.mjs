// Factory flows end-to-end with the Claude stub: draft (+retry, +QA), revise, rerender, caption, history, export,
// gallery, busy/cancel/timeout, startup recovery, write guard, engine missing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempWorkspace, startServer, api, sse, stubMode, runs, renderLog, readJson, lastArgs, streamArgs, sleep, useReal } from './helpers.mjs';

const t = tempWorkspace({ 'settings.json': { uiLang: 'ar', slidesDefault: 3, hashtags: 5, category: '', visualQA: true, onboarded: true } });
let S, base, idea;
before(async () => {
  S = await startServer(t); base = S.base;
  idea = (await api(base, 'POST', '/api/ideas', { title: 'أخطاء الكاروسيل', pillar: 'محتوى' })).body;
  await api(base, 'PATCH', `/api/ideas/${idea.id}`, { status: 'ready', hook: '3 أخطاء', outline: ['أ', 'ب'] });
});
after(async () => { await S.stop(); fs.rmSync(t.dir, { recursive: true, force: true }); });
const deckFile = () => path.join(t.ws, 'decks', `${idea.id}.json`);
const factory = async () => (await api(base, 'GET', `/api/factory/${idea.id}`)).body;
const onlyLog = () => renderLog(t).map(r => r.only);

test('draft: claude → validate → render → qa → preview', async () => {
  stubMode(t, { mode: 'ok', qa: 'ok' });
  const r = await sse(base, `/api/factory/${idea.id}/draft`, { notes: 'خليه قصير' });
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.deepEqual(r.phases, ['claude', 'validate', 'render', 'qa', 'done']);
  assert.ok(r.events.some(e => e.event === 'tool' && e.data.name === 'Write' && /decks\/.+\.json$/.test(e.data.path)));
  assert.ok(r.events.filter(e => e.event === 'progress').length >= 3);
  assert.equal(r.done.result.idea.status, 'preview');
  assert.equal(r.done.result.qa, 'ok');
  const f = await factory();
  assert.equal(f.idea.deck, `decks/${idea.id}.json`);
  assert.equal(f.deck.slides[0].kind, 'cover');
  assert.equal(f.preview.files.length, 3); assert.ok(f.preview.sheet); assert.equal(f.preview.stale, false);
  assert.equal(f.history.length, 1);
  const args = streamArgs(t).at(-2); // draft run (the last one is QA)
  const tools = args[args.indexOf('--allowedTools') + 1];
  assert.match(tools, new RegExp(`^Read,Write\\(.+/decks/${idea.id}\\.json\\),Edit\\(.+/decks/${idea.id}\\.json\\)$`));
  assert.equal(tools.split(',').length, 3);
  assert.ok(args.includes('--append-system-prompt'));
  const qaArgs = fs.readFileSync(t.argsLog, 'utf8').trim().split('\n').map(JSON.parse).filter(a => a.includes('stream-json')).at(-1);
  assert.equal(qaArgs[qaArgs.indexOf('--allowedTools') + 1], 'Read');
});

test('draft with an invalid deck → resumed retry with the error list → ok', async () => {
  stubMode(t, { mode: 'invalid-then-ok', qa: 'ok' });
  const before = fs.readFileSync(t.argsLog, 'utf8').trim().split('\n').length;
  const r = await sse(base, `/api/factory/${idea.id}/draft`);
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.deepEqual(r.phases.slice(0, 4), ['claude', 'validate', 'retry', 'validate']);
  const retry = r.events.find(e => e.event === 'phase' && e.data.phase === 'retry').data;
  assert.ok(retry.errors.length >= 1);
  const calls = fs.readFileSync(t.argsLog, 'utf8').trim().split('\n').slice(before).map(JSON.parse).filter(a => a.includes('stream-json'));
  assert.ok(!calls[0].includes('--resume'));
  assert.ok(calls[1].includes('--resume'), 'retry resumes the same session');
  assert.equal(r.done.result.idea.status, 'preview');
});

test('draft still invalid after retry → error, previous deck + status restored', async () => {
  const good = fs.readFileSync(deckFile(), 'utf8');
  await api(base, 'PATCH', `/api/ideas/${idea.id}`, { status: 'approved' });
  stubMode(t, { mode: 'invalid' });
  const r = await sse(base, `/api/factory/${idea.id}/draft`);
  assert.equal(r.error.code, 'invalid_deck');
  assert.ok(Array.isArray(r.error.errors) && r.error.errors.length);
  assert.equal(r.done, undefined);
  assert.equal(fs.readFileSync(deckFile(), 'utf8'), good, 'bad write rolled back');
  const f = await factory();
  assert.equal(f.idea.status, 'approved'); assert.equal(f.idea.prevStatus, null);
});

test('visual QA returns a corrected deck → validate → re-render only the changed slide', async () => {
  stubMode(t, { mode: 'ok', qa: 'fix' });
  const n = renderLog(t).length;
  const r = await sse(base, `/api/factory/${idea.id}/draft`);
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.equal(r.done.result.qa, 'fixed');
  assert.deepEqual(r.done.result.deck.slides[1].body, 'أقصر');
  assert.equal(readJson(deckFile()).slides[1].body, 'أقصر');
  if (!useReal) assert.deepEqual(onlyLog().slice(n), [null, [2]]);
});

test('revise: comments → claude edit → render only changed slides', async () => {
  stubMode(t, { mode: 'ok' });
  const n = renderLog(t).length, h = (await factory()).history.length;
  const r = await sse(base, `/api/factory/${idea.id}/revise`, { comments: [{ slide: 2, text: 'غيّر العنوان' }] });
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.deepEqual(r.done.result.changed, [2]);
  assert.equal(r.done.result.deck.slides[1].title, 'معدّل');
  if (!useReal) assert.deepEqual(onlyLog().slice(n), [[2]]);
  assert.equal((await factory()).history.length, h + 1);
  assert.equal((await sse(base, `/api/factory/${idea.id}/revise`, {})).status, 400);
});

test('rerender: switch template without Claude', async () => {
  const runsBefore = runs(t).filter(x => x.kind === 'claude').length;
  const tpl = (await api(base, 'GET', '/api/templates')).body.at(-1).id; // mock: midnight · real engine: whatever exists
  const r = await sse(base, `/api/factory/${idea.id}/rerender`, { template: tpl });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.deepEqual(r.phases, ['render', 'done']);
  assert.equal(r.done.result.deck.template, tpl);
  assert.equal((await factory()).idea.template, tpl);
  assert.equal(runs(t).filter(x => x.kind === 'claude').length, runsBefore);
  if (!useReal) assert.equal(renderLog(t).at(-1).template, 'midnight');
  assert.equal((await sse(base, `/api/factory/${idea.id}/rerender`, { template: 'nope' })).status, 400);
});

test('caption edit + history + restore', async () => {
  const r = await api(base, 'PUT', `/api/factory/${idea.id}/deck`, { caption: 'كابشن جديد' });
  assert.equal(r.body.caption, 'كابشن جديد');
  const f = await factory();
  assert.ok(f.history.length >= 5); assert.match(f.history[0].date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const oldest = f.history.at(-1).version;
  const back = await api(base, 'POST', `/api/factory/${idea.id}/restore`, { version: oldest });
  assert.equal(back.status, 200); assert.notEqual(back.body.caption, 'كابشن جديد');
  assert.equal((await factory()).preview.stale, true);
  assert.equal((await api(base, 'POST', `/api/factory/${idea.id}/restore`, { version: '../x' })).status, 400);
  assert.equal((await api(base, 'POST', `/api/factory/${idea.id}/restore`, { version: 'nope' })).status, 404);
});

test('export → exports/<date>_<slug>/ + caption.txt, gallery, open', async () => {
  const r = await sse(base, `/api/factory/${idea.id}/export`);
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.deepEqual(r.phases, ['export', 'done']);
  const { dir } = r.done.result;
  assert.match(dir, /^exports\/\d{4}-\d{2}-\d{2}_stub-topic$/);
  const abs = path.join(t.ws, dir);
  assert.deepEqual(fs.readdirSync(abs).filter(f => f.endsWith('.png')).sort(), ['01.png', '02.png', '03.png']);
  assert.match(fs.readFileSync(path.join(abs, 'caption.txt'), 'utf8'), /#a #b/);
  assert.equal(r.done.result.idea.status, 'exported');
  const g = (await api(base, 'GET', '/api/gallery')).body;
  assert.equal(g[0].id, idea.id); assert.equal(g[0].count, 3); assert.equal(g[0].cover, `/files/${dir}/01.png`);
  assert.deepEqual((await api(base, 'POST', `/api/factory/${idea.id}/open`)).body, { ok: true, dir });
  assert.equal((await fetch(base + g[0].cover)).status, 200);
});

test('deck-slide preview html', async () => {
  const r = await api(base, 'GET', `/api/preview/deck-slide?id=${idea.id}&index=1`);
  assert.equal(r.status, 200); assert.match(r.ct, /text\/html/);
});

test('busy → 409, cancel stops Claude and restores the status', async () => {
  stubMode(t, { mode: 'hang' });
  const i2 = (await api(base, 'POST', '/api/ideas', { title: 'تعليق' })).body;
  const running = sse(base, `/api/factory/${i2.id}/draft`);
  await sleep(400);
  assert.equal((await api(base, 'GET', '/api/state')).body.busy.claude, true);
  assert.equal((await api(base, 'GET', '/api/ideas')).body.ideas.find(i => i.id === i2.id).status, 'drafting');
  const busy = await sse(base, `/api/factory/${idea.id}/draft`);
  assert.equal(busy.status, 409); assert.equal(busy.body.error, 'busy');
  assert.equal((await sse(base, '/api/ideas/suggest')).status, 409);
  assert.equal((await api(base, 'PATCH', `/api/ideas/${i2.id}`, { note: 'x' })).status, 409);
  assert.deepEqual((await api(base, 'POST', '/api/cancel', { kind: 'claude' })).body, { ok: true });
  const r = await running;
  assert.equal(r.error.code, 'cancelled');
  const after = (await api(base, 'GET', '/api/ideas')).body.ideas.find(i => i.id === i2.id);
  assert.equal(after.status, 'raw'); assert.equal(fs.existsSync(path.join(t.ws, 'decks', `${i2.id}.json`)), false);
  assert.equal((await api(base, 'GET', '/api/state')).body.busy.claude, false);
});

test('a Claude run that writes outside its allowed file is flagged', async () => {
  stubMode(t, { mode: 'rogue', qa: 'ok' });
  const r = await sse(base, `/api/factory/${idea.id}/draft`);
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.ok(r.done.result.warnings.some(w => w === 'unexpected change: brand/identity.json'), JSON.stringify(r.done.result.warnings));
  assert.ok(runs(t).some(x => x.task === 'draft' && x.warnings?.length));
});

test('runs.jsonl records every Claude run and render', () => {
  const rs = runs(t);
  assert.ok(rs.some(x => x.kind === 'claude' && x.task === 'retry' && x.resumed));
  assert.ok(rs.some(x => x.kind === 'claude' && x.code === 'cancelled'));
  assert.ok(rs.some(x => x.kind === 'render' && x.target === 'export'));
});

test('second server: timeout, render cancel, startup recovery, engine missing', async () => {
  const t2 = tempWorkspace({
    'ideas/ideas.json': { ideas: [{ id: 'i_20261103_aaaa', title: 'x', status: 'drafting', prevStatus: 'ready', outline: [] },
      { id: 'i_20261103_bbbb', title: 'y', status: 'drafting', prevStatus: null }] },
  });
  stubMode(t2, { mode: 'hang' });
  const S2 = await startServer(t2, { SAHBA_CLAUDE_TIMEOUT_MS: '1500', MOCK_RENDER_DELAY_MS: '400' });
  try {
    const list = (await api(S2.base, 'GET', '/api/ideas')).body.ideas;
    assert.deepEqual(list.map(i => i.status), ['ready', 'ready']); // recovered on start
    const r = await sse(S2.base, '/api/factory/i_20261103_aaaa/draft');
    assert.equal(r.error.code, 'timeout');
    if (!useReal) {
      stubMode(t2, { mode: 'ok', qa: 'ok' });
      await api(S2.base, 'PUT', '/api/settings', { visualQA: false });
      const ok = await sse(S2.base, '/api/factory/i_20261103_aaaa/draft');
      assert.equal(ok.error, undefined, JSON.stringify(ok.error));
      assert.ok(!ok.phases.includes('qa'), 'visualQA off → no qa phase');
      const rr = sse(S2.base, '/api/factory/i_20261103_aaaa/rerender');
      await sleep(300);
      assert.equal((await api(S2.base, 'GET', '/api/state')).body.busy.render, true);
      assert.equal((await sse(S2.base, '/api/factory/i_20261103_aaaa/export')).status, 409);
      await api(S2.base, 'POST', '/api/cancel', { kind: 'render' });
      assert.equal((await rr).error.code, 'cancelled');
    }
  } finally { await S2.stop(); fs.rmSync(t2.dir, { recursive: true, force: true }); }

  const t3 = tempWorkspace();
  const S3 = await startServer(t3, { SAHBA_ENGINE: path.join(t3.dir, 'missing.mjs') });
  try {
    const r = await api(S3.base, 'GET', '/api/templates');
    assert.equal(r.status, 503); assert.equal(r.body.error, 'engine_missing');
    assert.equal((await api(S3.base, 'GET', '/api/state')).body.engine, false);
  } finally { await S3.stop(); fs.rmSync(t3.dir, { recursive: true, force: true }); }
});
