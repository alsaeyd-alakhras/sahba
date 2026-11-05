// HTTP surface: guards, workspace bootstrap, settings/brand, static files, ideas, suggest/polish, doctor, log, previews.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { tempWorkspace, startServer, api, sse, stubMode, runs, readJson, lastArgs } from './helpers.mjs';

const t = tempWorkspace({ 'brand/profile.md': '# أنا\nمطور' });
let S, base;
before(async () => { S = await startServer(t); base = S.base; });
after(async () => { await S.stop(); fs.rmSync(t.dir, { recursive: true, force: true }); });

const raw = (p, headers) => new Promise((res, rej) => {
  const u = new URL(base + p);
  http.get({ host: u.hostname, port: u.port, path: u.pathname, headers }, r => { r.resume(); res(r.statusCode); }).on('error', rej);
});

test('first run creates the workspace skeleton with defaults', () => {
  for (const d of ['brand', 'ideas', 'decks', 'preview', 'exports', 'logs']) assert.ok(fs.existsSync(path.join(t.ws, d)), d);
  assert.equal(readJson(path.join(t.ws, 'settings.json')).slidesDefault, 8);
  assert.deepEqual(readJson(path.join(t.ws, 'ideas', 'ideas.json')), { ideas: [] });
  assert.equal(readJson(path.join(t.ws, 'brand', 'identity.json')).template, 'editorial');
  assert.ok(readJson(path.join(t.ws, 'brand', 'accounts.json')).tiktok);
});

test('Host and Origin guards', async () => {
  assert.equal(await raw('/api/state', { Host: 'evil.com' }), 403);
  assert.equal(await raw('/api/state', { Host: `localhost:${new URL(base).port}` }), 200);
  const r = await api(base, 'PUT', '/api/settings', { hashtags: 3 }, { Origin: 'http://evil.com' });
  assert.equal(r.status, 403);
  const ok = await api(base, 'PUT', '/api/settings', { hashtags: 3 }, { Origin: base });
  assert.equal(ok.status, 200);
});

test('GET /api/state', async () => {
  const r = await api(base, 'GET', '/api/state');
  assert.equal(r.status, 200);
  for (const k of ['settings', 'identity', 'claude', 'ideasCount', 'busy']) assert.ok(k in r.body, k);
  assert.deepEqual(r.body.busy, { claude: false, render: false });
  assert.ok('installed' in r.body.claude && 'loggedIn' in r.body.claude && 'version' in r.body.claude);
});

test('settings / identity / accounts round-trip with validation', async () => {
  let r = await api(base, 'PUT', '/api/settings', { slidesDefault: 7, visualQA: false, onboarded: true });
  assert.equal(r.body.slidesDefault, 7); assert.equal(r.body.visualQA, false);
  assert.equal((await api(base, 'GET', '/api/settings')).body.onboarded, true);
  r = await api(base, 'PUT', '/api/brand/identity', { name: 'سارة', handle: '@sara.dev', accent: '#2f6bed', facePos: '40% 30%' });
  assert.equal(r.body.name, 'سارة'); assert.equal(r.body.font, 'cairo');
  r = await api(base, 'PUT', '/api/brand/identity', { accent: 'blue' });
  assert.equal(r.status, 400); assert.equal(r.body.error, 'bad_request');
  r = await api(base, 'PUT', '/api/brand/accounts', { instagram: { url: 'https://instagram.com/x', bio: 'bio' } });
  assert.equal(r.body.instagram.bio, 'bio'); assert.equal(r.body.youtube.url, '');
  await api(base, 'PUT', '/api/settings', { visualQA: true });
});

test('brand docs', async () => {
  let r = await api(base, 'GET', '/api/brand/doc/profile');
  assert.match(r.body.text, /مطور/); assert.ok(r.body.updated);
  r = await api(base, 'PUT', '/api/brand/doc/voice', { text: 'قواعد' });
  assert.equal(r.body.text, 'قواعد');
  assert.equal((await api(base, 'GET', '/api/brand/doc/secrets')).status, 404);
  assert.equal((await api(base, 'GET', '/api/brand/doc/analysis')).body.updated, null);
});

test('photo upload: type + magic + size checks', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  let r = await api(base, 'POST', '/api/brand/photo', png, { 'Content-Type': 'image/png' });
  assert.equal(r.status, 200); assert.equal(r.body.photo, 'photo.png');
  assert.equal(readJson(path.join(t.ws, 'brand', 'identity.json')).photo, 'photo.png');
  r = await api(base, 'POST', '/api/brand/photo', Buffer.from('not an image'), { 'Content-Type': 'image/jpeg' });
  assert.equal(r.status, 415);
  r = await api(base, 'POST', '/api/brand/photo', Buffer.alloc(9 * 1024 * 1024), { 'Content-Type': 'image/jpeg' });
  assert.equal(r.status, 413);
  const f = await fetch(base + '/files/brand/photo.png');
  assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'image/png');
});

test('static: /files is path-safe, /engine serves assets only, SPA 404s cleanly', async () => {
  assert.equal(await raw('/files/..%2f..%2fetc%2fpasswd'), 404);
  assert.equal(await raw('/files/../package.json'), 404);
  assert.equal((await fetch(base + '/engine/index.mjs')).status, 404);
  assert.equal((await fetch(base + '/api/nope')).status, 404);
});

test('ideas CRUD + reorder + patch rules', async () => {
  const a = (await api(base, 'POST', '/api/ideas', { title: 'أول فكرة', pillar: 'تقنية' })).body;
  const b = (await api(base, 'POST', '/api/ideas', { title: 'ثاني فكرة' })).body;
  assert.match(a.id, /^i_\d{8}_[a-z0-9]{4}$/); assert.equal(a.status, 'raw'); assert.equal(a.source, 'me');
  assert.equal((await api(base, 'POST', '/api/ideas', { title: '  ' })).status, 400);
  let list = (await api(base, 'GET', '/api/ideas')).body.ideas;
  assert.deepEqual(list.map(i => i.id).slice(0, 2), [b.id, a.id]); // newest first
  await api(base, 'POST', '/api/ideas/reorder', { ids: [a.id, b.id] });
  list = (await api(base, 'GET', '/api/ideas')).body.ideas;
  assert.deepEqual(list.map(i => i.id).slice(0, 2), [a.id, b.id]);
  let r = await api(base, 'PATCH', `/api/ideas/${a.id}`, { note: 'ملاحظة', status: 'drafting' });
  assert.equal(r.status, 400);
  r = await api(base, 'PATCH', `/api/ideas/${a.id}`, { note: 'ملاحظة', published: { date: '2026-11-03', url: 'https://x' }, id: 'hack' });
  assert.equal(r.body.id, a.id); assert.equal(r.body.status, 'published'); assert.equal(r.body.note, 'ملاحظة');
  assert.equal((await api(base, 'PATCH', '/api/ideas/i_20260101_zzzz', { note: 'x' })).status, 404);
  assert.deepEqual((await api(base, 'DELETE', `/api/ideas/${b.id}`)).body, { ok: true });
  assert.equal((await api(base, 'GET', '/api/ideas')).body.ideas.some(i => i.id === b.id), false);
});

test('suggest adds de-duplicated claude ideas (Read-only tools)', async () => {
  stubMode(t, { mode: 'ok' });
  const r = await sse(base, '/api/ideas/suggest', { count: 5 });
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.equal(r.done.result.added.length, 2);
  assert.ok(r.done.result.added.every(i => i.source === 'claude' && i.status === 'raw'));
  assert.ok(r.events.some(e => e.event === 'text'));
  const args = lastArgs(t);
  assert.equal(args[args.indexOf('--allowedTools') + 1], 'Read');
  assert.ok(!args.includes('--resume'));
});

test('polish sets hook + outline and raw → ready', async () => {
  const idea = (await api(base, 'POST', '/api/ideas', { title: 'أدوات' })).body;
  const r = await sse(base, `/api/ideas/${idea.id}/polish`);
  assert.equal(r.done.result.status, 'ready');
  assert.equal(r.done.result.outline.length, 5);
  assert.match(r.done.result.hook, /10/);
});

test('analyze writes analysis.md + voice.md, Write limited to those two files', async () => {
  const r = await sse(base, '/api/brand/analyze', { extra: 'بوستاتي' });
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  assert.match(r.done.result.analysis.text, /التحليل/);
  assert.match(fs.readFileSync(path.join(t.ws, 'brand', 'voice.md'), 'utf8'), /الصوت/);
  const args = lastArgs(t);
  const tools = args[args.indexOf('--allowedTools') + 1];
  assert.match(tools, /^Read,Write\(.+analysis\.md\),Edit\(.+analysis\.md\),Write\(.+voice\.md\),Edit\(.+voice\.md\)$/);
  assert.ok(args.includes('--add-dir'), 'workspace outside ROOT → --add-dir');
  assert.ok(runs(t).some(x => x.kind === 'claude' && x.task === 'analyze' && x.ok));
});

test('templates, fonts, preview slide html', async () => {
  const tpl = (await api(base, 'GET', '/api/templates')).body;
  assert.ok(Array.isArray(tpl) && tpl.length && tpl[0].id);
  assert.ok(Array.isArray((await api(base, 'GET', '/api/fonts')).body));
  const r = await api(base, 'GET', '/api/preview/slide?template=editorial&index=0&lang=ar');
  assert.equal(r.status, 200); assert.match(r.ct, /text\/html/); assert.match(r.body, /<html/i);
  assert.equal((await api(base, 'GET', '/api/preview/deck-slide?id=i_20260101_zzzz&index=0')).status, 404);
});

test('doctor + log', async () => {
  const d = (await api(base, 'GET', '/api/doctor')).body.checks;
  assert.deepEqual(d.map(c => c.id), ['node', 'chrome', 'claude', 'claudeLogin', 'disk', 'workspace']);
  const byId = Object.fromEntries(d.map(c => [c.id, c]));
  assert.equal(byId.node.ok, true); assert.equal(byId.claude.ok, true); assert.equal(byId.claude.detail, '9.9.9');
  assert.equal(byId.claudeLogin.ok, true); assert.equal(byId.workspace.ok, true);
  const st = (await api(base, 'GET', '/api/state')).body.claude;
  assert.equal(st.installed, true); assert.equal(st.loggedIn, true);
  const log = (await api(base, 'GET', '/api/log?limit=2')).body.entries;
  assert.equal(log.length, 2);
});

test('cancel with nothing running', async () => {
  assert.deepEqual((await api(base, 'POST', '/api/cancel', { kind: 'claude' })).body, { ok: false });
  assert.equal((await api(base, 'POST', '/api/cancel', { kind: 'x' })).status, 400);
});
