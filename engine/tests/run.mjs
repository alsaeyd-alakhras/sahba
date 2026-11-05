// Engine tests — plain node, no framework:  node engine/tests/run.mjs [--no-render]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures');
const OUT = path.join(HERE, 'out');
const WS = path.join(FIX, 'ws');
const noRender = process.argv.includes('--no-render');
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } };
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const codes = (r) => [...r.errors, ...r.warnings].map((i) => i.code);

console.log('API');
const kinds = E.listKinds();
ok(kinds.length === 13 && ['cover', 'point', 'list', 'quote', 'stat', 'bars', 'compare', 'sites', 'pick', 'rule', 'steps', 'code', 'cta'].every((k) => kinds.includes(k)), 'listKinds() = 13 kinds');
const icons = E.listIcons();
ok(icons.length > 1000 && icons.includes('Clock') && icons.includes('FileSignature'), `listIcons() has ${icons.length} names incl. aliases`);
const fontsL = E.listFonts();
ok(fontsL.some((f) => f.id === 'cairo') && fontsL.every((f) => f.id && f.name && f.family), `listFonts() = ${fontsL.map((f) => f.id).join(', ')}`);
const tpls = await E.listTemplates();
ok(tpls.some((t) => t.id === 'editorial' && t.name?.ar && t.name?.en && t.desc?.en && t.fits?.ar && t.preview === 'templates/editorial/preview.png'), 'listTemplates() includes editorial with name/desc/fits/preview');
for (const lang of ['ar', 'en']) {
  const d = E.sampleDeck(lang);
  const v = E.validateDeck(d);
  ok(v.ok && v.warnings.length === 0, `sampleDeck('${lang}') is valid with no warnings`, JSON.stringify([...v.errors, ...v.warnings]));
  ok(new Set(d.slides.map((s) => s.kind)).size >= 9, `sampleDeck('${lang}') uses ${new Set(d.slides.map((s) => s.kind)).size} kinds`);
}
const html = E.buildSlideHtml({ deck: E.sampleDeck('ar'), index: 0, identity: { name: 'Test <b>&', handle: '@t' }, assetBase: '/engine/' });
ok(html.startsWith('<!doctype html>') && html.includes('dir="rtl"') && html.includes("url('/engine/fonts/cairo/"), 'buildSlideHtml returns a full RTL document using assetBase for fonts');
ok(html.includes('Test &lt;b&gt;&amp;') && !html.includes('Test <b>'), 'identity text is HTML-escaped');
ok(E.buildSlideHtml({ deck: E.sampleDeck('en'), index: 2, identity: {}, assetBase: '/engine/' }).includes('dir="ltr"'), 'English deck renders LTR');
ok(E.buildSlideHtml({ deck: { slides: [{ kind: 'quote', quote: '<script>x</script>{b}<img src=x>{/b}' }] }, index: 0, assetBase: './' }).includes('&lt;script&gt;x&lt;/script&gt;<span class="rb">&lt;img src=x&gt;</span>'), 'markup inner text is escaped');
// no personal data in engine code
const leaks = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!['icons', 'fonts', 'tests'].includes(f.name)) walk(p); } else if (/\.(mjs|css|json|md)$/.test(f.name)) { const t = fs.readFileSync(p, 'utf8'); if (/alsaeyd|الأخرسي|السيد/i.test(t)) leaks.push(p); } } };
walk(path.join(HERE, '..'));
ok(leaks.length === 0, 'no personal names in engine code', leaks.join(', '));

console.log('validateDeck');
const good = read(path.join(FIX, 'good-all-kinds.json'));
const gv = E.validateDeck(good);
ok(gv.ok, 'good-all-kinds.json is valid', JSON.stringify(gv.errors));
ok(gv.warnings.every((w) => w.code === 'slide_count'), 'good-all-kinds.json only warns about slide count', JSON.stringify(gv.warnings));
const expect = {
  'bad-order.json': ['first_not_cover', 'last_not_cta', 'extra_cover', 'extra_cta'],
  'bad-motion.json': ['motion_not_supported'],
  'bad-icons-art.json': ['unknown_icon', 'no_graphic', 'unknown_art'],
  'bad-repeat.json': ['repeated_kind', 'repeated_art'],
  'bad-text.json': ['missing_caption', 'bad_slug', 'long_title', 'emoji_in_title', 'missing_field', 'bad_item', 'unknown_kind', 'unknown_field'],
};
for (const [f, want] of Object.entries(expect)) {
  const r = E.validateDeck(read(path.join(FIX, f)));
  const got = codes(r);
  const missing = want.filter((c) => !got.includes(c));
  ok(!r.ok && missing.length === 0, `${f} rejected with ${want.join(', ')}`, `missing ${missing.join(',')} · got ${got.join(',')}`);
  ok([...r.errors, ...r.warnings].every((i) => typeof i.msg === 'string' && i.msg.length > 10 && 'slide' in i && 'field' in i), `${f} issues have {slide, field, code, msg}`);
}
const motionMsgs = E.validateDeck(read(path.join(FIX, 'bad-motion.json'))).errors.filter((e) => e.code === 'motion_not_supported');
ok(motionMsgs.length === 4 && motionMsgs.every((e) => /motion is not supported/.test(e.msg)), 'mode/dur/speed each reported as "motion not supported"');
ok(E.validateDeck(null).ok === false && E.validateDeck({ caption: 'x', slides: [] }).ok === false, 'non-deck input rejected');

if (!noRender) {
  console.log('render');
  fs.mkdirSync(OUT, { recursive: true });
  const identity = read(path.join(WS, 'brand', 'identity.json'));
  const before = new Set(fs.readdirSync(os.tmpdir()).filter((n) => /^sahba-(chrome|html)-/.test(n)));
  const jobs = [
    ['example', read(path.join(FIX, 'decks', 'example.json'))],
    ['2026-11-01_cafe-decisions', read(path.join(FIX, 'decks', '2026-11-01_cafe-decisions.json'))],
    ['2026-10-25_website-identity', read(path.join(FIX, 'decks', '2026-10-25_website-identity.json'))],
    ['good-all-kinds', good],
    ['sample-ar', E.sampleDeck('ar')],
    ['sample-en', E.sampleDeck('en')],
  ];
  for (const [name, deck] of jobs) {
    const v = E.validateDeck(deck);
    const outDir = path.join(OUT, name);
    let n = 0;
    const r = await E.renderDeck({ deck, workspaceDir: WS, outDir, skipValidation: true, onProgress: () => n++ });
    const per = (r.ms / deck.slides.length / 1000).toFixed(2);
    ok(r.files.length === deck.slides.length && n === deck.slides.length && fs.existsSync(r.sheet), `${name}: ${r.files.length} PNGs + sheet in ${(r.ms / 1000).toFixed(1)}s (${per}s/slide)${v.ok ? '' : ' [deck has validation errors: ' + [...new Set(v.errors.map((e) => e.code))].join(',') + ']'}`);
    const png = fs.readFileSync(r.files[0]);
    ok(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350, `${name}: PNG is 1080×1350`);
    if (r.overflow.length) for (const o of r.overflow) console.log(`      overflow slide ${o.slide}: ${o.reason} — "${o.text}"`);
    if (['good-all-kinds', 'sample-ar', 'sample-en', 'example', '2026-11-01_cafe-decisions'].includes(name)) ok(r.overflow.length === 0, `${name}: no overflow/overlap`);
  }
  // --only re-render keeps the full file list
  const r2 = await E.renderDeck({ deck: E.sampleDeck('ar'), workspaceDir: WS, outDir: path.join(OUT, 'sample-ar'), only: [2, 5] });
  ok(r2.rendered.join(',') === '2,5' && r2.files.length === 10, `--only 2,5 re-renders 2 slides in ${(r2.ms / 1000).toFixed(1)}s, files lists all 10`);
  // abort
  const ac = new AbortController();
  let aborted = false;
  try {
    await E.renderDeck({ deck: E.sampleDeck('ar'), workspaceDir: WS, outDir: path.join(OUT, 'abort'), signal: ac.signal, onProgress: ({ n }) => { if (n === 1) ac.abort(); } });
  } catch (e) { aborted = e.name === 'AbortError' || e.code === 'aborted'; }
  ok(aborted, 'abort signal stops the render with AbortError');
  await new Promise((r) => setTimeout(r, 500));
  const left = fs.readdirSync(os.tmpdir()).filter((n) => /^sahba-(chrome|html)-/.test(n) && !before.has(n));
  ok(left.length === 0, 'temp browser profiles and html dirs removed', left.join(', '));
  // template preview image
  const prev = path.join(OUT, 'sample-ar', '01.png');
  ok(fs.existsSync(prev), 'sample cover rendered (used for templates/*/preview.png by tools/build-previews.mjs)');
  console.log(`  identity used: ${identity.name} ${identity.handle}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
