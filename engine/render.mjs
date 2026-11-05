#!/usr/bin/env node
// CLI: node engine/render.mjs <deck.json> --workspace <dir> --out <dir> [--only 2,5] [--template id] [--force]
// --force renders even when validation reports errors (errors are still printed).
// Progress + warnings go to stderr; the final result is one JSON line on stdout.
// Exit codes: 0 ok · 1 failure · 2 invalid deck · 3 no browser · 130 aborted
import fs from 'node:fs';
import path from 'node:path';
import { renderDeck, validateDeck } from './index.mjs';
import { ROOT_DIR } from './util.mjs';

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); o[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); } else o._.push(a);
  }
  return o;
}
const a = args(process.argv.slice(2));
const deckPath = a._[0];
if (!deckPath || a.help) {
  console.error('usage: node engine/render.mjs <deck.json> --workspace <dir> --out <dir> [--only 2,5] [--template id]');
  process.exit(deckPath ? 0 : 1);
}
const workspace = path.resolve(typeof a.workspace === 'string' ? a.workspace : process.env.SAHBA_WORKSPACE || path.join(ROOT_DIR, 'workspace'));
let deck;
try { deck = JSON.parse(fs.readFileSync(deckPath, 'utf8')); } catch (e) {
  console.error(`cannot read deck: ${e.message}`);
  console.log(JSON.stringify({ ok: false, error: 'bad_deck_file', msg: e.message }));
  process.exit(2);
}
const out = path.resolve(typeof a.out === 'string' ? a.out : path.join(workspace, 'preview', path.basename(deckPath, '.json')));
const only = typeof a.only === 'string' ? a.only.split(',').map((x) => parseInt(x, 10)).filter(Number.isFinite) : undefined;
const template = typeof a.template === 'string' ? a.template : undefined;

const v = validateDeck(deck);
for (const w of v.warnings) console.error(`warning ${w.slide ? 'slide ' + w.slide : 'deck'}${w.field ? ' [' + w.field + ']' : ''}: ${w.msg}`);
for (const e of v.errors) console.error(`error ${e.slide ? 'slide ' + e.slide : 'deck'}${e.field ? ' [' + e.field + ']' : ''}: ${e.msg}`);
if (!v.ok && !a.force) {
  console.log(JSON.stringify({ ok: false, error: 'invalid_deck', errors: v.errors, warnings: v.warnings }));
  process.exit(2);
}

const ac = new AbortController();
process.on('SIGINT', () => ac.abort());
process.on('SIGTERM', () => ac.abort());
try {
  const r = await renderDeck({ deck, workspaceDir: workspace, outDir: out, only, template, signal: ac.signal, skipValidation: true,
    onProgress: ({ n, total, file }) => console.error(`render ${n}/${total} ${path.basename(file)}`) });
  for (const o of r.overflow) console.error(`overflow slide ${o.slide}: ${o.reason} — "${o.text}"`);
  console.error(`done in ${(r.ms / 1000).toFixed(1)}s → ${out}`);
  console.log(JSON.stringify({ ok: true, ...r, warnings: v.warnings }));
} catch (e) {
  console.error(e.message);
  console.log(JSON.stringify({ ok: false, error: e.code || 'render_failed', msg: e.message }));
  process.exit(e.code === 'no_browser' ? 3 : e.code === 'aborted' ? 130 : 1);
}
