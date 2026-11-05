#!/usr/bin/env node
// Claude CLI stand-in for tests (CLAUDE_EXE=<this file>). Reads the prompt from stdin, acts on its TASK:/…_FILE: markers,
// and prints stream-json lines like `claude -p --output-format stream-json --verbose`.
// STUB_MODE = ok | invalid-then-ok | invalid | hang | rogue · STUB_QA = ok | fix · STUB_ARGS_LOG = file to append argv JSON to.
// STUB_CONFIG = JSON file {mode, qa} that overrides the env (lets one server instance switch modes between requests).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(process.env.STUB_CONFIG, 'utf8')); } catch {}
const mode = cfg.mode || process.env.STUB_MODE || 'ok';
const qaMode = cfg.qa || process.env.STUB_QA || 'ok';
if (process.env.STUB_ARGS_LOG) fs.appendFileSync(process.env.STUB_ARGS_LOG, JSON.stringify(args) + '\n');
if (args.includes('--version')) { console.log('9.9.9 (Claude Code stub)'); process.exit(0); }

const stdin = await new Promise(r => { let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => { s += d; }); process.stdin.on('end', () => r(s)); });
const resume = args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null;
const sid = resume || crypto.randomUUID();

if (args.includes('json') && !args.includes('stream-json')) { // login probe
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'OK', session_id: sid }));
  process.exit(0);
}

const out = o => process.stdout.write(JSON.stringify({ ...o, session_id: sid }) + '\n');
const marker = k => { const m = stdin.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')); return m ? path.resolve(process.cwd(), m[1].trim()) : null; };
const task = (stdin.match(/^TASK:\s*(\w+)/m) || [])[1];
const tool = (name, file_path) => out({ type: 'assistant', message: { content: [{ type: 'tool_use', id: crypto.randomUUID(), name, input: { file_path } }] } });
const say = text => out({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const finish = (result, is_error = false) => { out({ type: 'result', subtype: is_error ? 'error' : 'success', is_error, result, duration_ms: 5 }); process.exit(0); };

export const validDeck = () => ({
  slug: '2026-11-03_stub-topic', category: 'test', template: 'editorial',
  caption: 'Hook\n\nسطر\n\nاحفظ البوست\n\n#a #b #c #d #e',
  slides: [
    { kind: 'cover', headline: '3 أخطاء {b}بتقتل{/b} شغلك', sub: 'ولا تنتبه إلها', icons: ['Code', 'Rocket'], labels: ['كود', 'إطلاق'] },
    { kind: 'point', number: 1, kicker: 'أول', title: 'ابدأ صغير', body: 'خطوة وحدة كل يوم', icon: 'Zap' },
    { kind: 'cta', headline: 'احفظها لبعدين', prompt: 'شو أكثر غلطة؟' },
  ],
});
const invalidDeck = () => ({ ...validDeck(), slides: [{ kind: 'bogus', title: 'x' }, ...validDeck().slides.slice(1)] });
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

out({ type: 'system', subtype: 'init', tools: [] });
if (mode === 'hang') { say('thinking…'); setInterval(() => {}, 1e6); }
else {
  const deckFile = marker('DECK_FILE');
  if (mode === 'rogue') write(path.join(path.dirname(path.dirname(deckFile || marker('ANALYSIS_FILE'))), 'brand', 'identity.json'), '{"name":"rogue"}');
  if (task === 'draft' || task === 'retry') {
    const good = mode === 'ok' || mode === 'rogue' || (mode === 'invalid-then-ok' && resume);
    tool('Write', deckFile); write(deckFile, JSON.stringify(good ? validDeck() : invalidDeck(), null, 2));
    say('كتبت الديك'); finish('done');
  } else if (task === 'revise') {
    const d = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
    if (mode === 'invalid') d.slides[0].kind = 'bogus'; else d.slides[1] = { ...d.slides[1], title: 'معدّل' };
    tool('Edit', deckFile); write(deckFile, JSON.stringify(d, null, 2)); finish('عدّلت السلايد 2');
  } else if (task === 'qa') {
    tool('Read', marker('SHEET_FILE'));
    if (qaMode === 'fix') {
      const d = JSON.parse(fs.readFileSync(deckFile, 'utf8')); d.slides[1] = { ...d.slides[1], body: 'أقصر' };
      finish('```json\n' + JSON.stringify(d) + '\n```');
    } else finish('OK');
  } else if (task === 'analyze') {
    const a = marker('ANALYSIS_FILE'), v = marker('VOICE_FILE');
    tool('Write', a); write(a, '# التحليل\n\nجمهور: مطورين\n'); tool('Write', v); write(v, '# الصوت\n\nعامية شامية\n');
    finish('كتبت الملفين');
  } else if (task === 'suggest') {
    say('هاي اقتراحاتي');
    finish('```json\n' + JSON.stringify({ ideas: [{ title: 'فكرة أولى', note: 'زاوية', pillar: 'تقنية' }, { title: 'فكرة ثانية', note: '', pillar: 'فريلانس' }, { title: 'فكرة أولى', note: 'dup' }] }) + '\n```');
  } else if (task === 'polish') {
    finish('```json\n' + JSON.stringify({ hook: '5 أدوات وفّرت علي 10 ساعات', angle: 'توفير وقت', outline: ['أ', 'ب', 'ج', 'د', 'هـ'] }) + '\n```');
  } else finish('unknown task', true);
}
