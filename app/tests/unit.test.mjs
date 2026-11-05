// Pure helpers: path safety, JSON extraction, slide diff, slugs, permission paths, settings coercion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tempWorkspace } from './helpers.mjs';

process.env.SAHBA_WORKSPACE = tempWorkspace().ws;
const L = await import('../server/lib.mjs');
const { extractJson } = await import('../server/prompts.mjs');
const { changedSlides } = await import('../server/store.mjs');
const { slugPart } = await import('../server/routes/factory.mjs');
const { rulePath, toolsFor } = await import('../server/claude.mjs');
const { cleanSettings } = await import('../server/routes/state.mjs');
const { cleanIdentity } = await import('../server/routes/brand.mjs');

test('safeJoin keeps paths inside the base', () => {
  const b = path.resolve('/tmp/base');
  assert.equal(L.safeJoin(b, 'a/b.png'), path.join(b, 'a', 'b.png'));
  assert.equal(L.safeJoin(b, '../x'), null);
  assert.equal(L.safeJoin(b, 'a/../../x'), null);
  assert.equal(L.safeJoin(b, 'a\0b'), null);
  assert.equal(L.safeJoin(b, '/etc/passwd'), path.join(b, 'etc', 'passwd')); // leading slash = relative to base
});

test('extractJson: fenced, bare, last fence wins, garbage', () => {
  assert.deepEqual(extractJson('hi\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('text {"a":2} tail'), { a: 2 });
  assert.deepEqual(extractJson('```json\n{"a":1}\n```\nfixed:\n```json\n{"a":3}\n```'), { a: 3 });
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('```json\n{bad}\n```'), null);
});

test('changedSlides: per-slide diff, null when count/template changes', () => {
  const a = { template: 'x', slides: [{ k: 1 }, { k: 2 }, { k: 3 }] };
  assert.deepEqual(changedSlides(a, { template: 'x', slides: [{ k: 1 }, { k: 9 }, { k: 3 }] }), [2]);
  assert.deepEqual(changedSlides(a, structuredClone(a)), []);
  assert.equal(changedSlides(a, { template: 'x', slides: [{ k: 1 }] }), null);
  assert.equal(changedSlides(a, { template: 'y', slides: a.slides }), null);
  assert.equal(changedSlides(null, a), null);
});

test('slugPart strips the date and unsafe characters, keeps Arabic', () => {
  assert.equal(slugPart('2026-11-02_my-topic'), 'my-topic');
  assert.equal(slugPart('Hello: World/..\\x'), 'hello-world-x');
  assert.equal(slugPart('أدوات الذكاء'), 'أدوات-الذكاء');
});

test('rulePath: relative inside ROOT, //drive/... outside', () => {
  assert.equal(rulePath(path.join(L.ROOT, 'workspace', 'decks', 'a.json')), 'workspace/decks/a.json');
  const out = rulePath(path.resolve('/zz-outside/decks/a.json'));
  assert.match(out, /^\/\/([a-z]\/)?zz-outside\/decks\/a\.json$/);
  assert.equal(toolsFor([path.join(L.ROOT, 'w', 'd.json')]), 'Read,Write(w/d.json),Edit(w/d.json)');
});

test('settings / identity coercion', () => {
  const s = cleanSettings(L.DEFAULTS.settings, { slidesDefault: 99, hashtags: '3', uiLang: 'fr', visualQA: 0, junk: 1 });
  assert.equal(s.slidesDefault, 12); assert.equal(s.hashtags, 3); assert.equal(s.uiLang, 'ar'); assert.equal(s.visualQA, false); assert.equal(s.junk, undefined);
  assert.throws(() => cleanIdentity(L.DEFAULTS.identity, { accent: 'red' }), /accent/);
  assert.throws(() => cleanIdentity(L.DEFAULTS.identity, { template: '../x' }), /template/);
  assert.equal(cleanIdentity(L.DEFAULTS.identity, { accent: '#AABBCC', photo: 'evil.exe' }).photo, null);
});

test('today() is local YYYY-MM-DD', () => {
  assert.equal(L.today(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
