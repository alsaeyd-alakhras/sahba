// Minimal engine with the SPEC §5 API, used when engine/index.mjs is absent (SAHBA_ENGINE points here).
// MOCK_RENDER_DELAY_MS slows each slide (cancel tests) · MOCK_OVERFLOW=1 reports an overflow on slide 2.
import fs from 'node:fs';
import path from 'node:path';

const KINDS = ['cover', 'point', 'list', 'quote', 'stat', 'bars', 'compare', 'sites', 'pick', 'rule', 'steps', 'code', 'cta'];
const ICONS = ['Code', 'Rocket', 'Zap', 'Star', 'Heart'];
// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export const listKinds = () => KINDS;
export const listIcons = () => ICONS;
export const listTemplates = async () => ['editorial', 'midnight'].map(id => ({ id, name: { ar: id, en: id }, desc: { ar: '', en: '' }, fits: { ar: '', en: '' }, preview: `templates/${id}/preview.png` }));
export const listFonts = () => [{ id: 'cairo', name: 'Cairo', family: 'Cairo' }];

export function validateDeck(deck) {
  const errors = [], warnings = [];
  const e = (slide, field, code, msg) => errors.push({ slide, field, code, msg });
  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) { e(null, 'slides', 'missing', 'slides array is required'); return { ok: false, errors, warnings }; }
  if (!deck.caption) e(null, 'caption', 'missing', 'caption is required');
  deck.slides.forEach((s, i) => {
    if (!KINDS.includes(s.kind)) e(i + 1, 'kind', 'unknown_kind', `unknown kind "${s.kind}"`);
    if ('mode' in s || 'dur' in s) e(i + 1, 'mode', 'motion_field', 'motion fields are not allowed');
    for (const ic of s.icons || []) if (!ICONS.includes(ic)) e(i + 1, 'icons', 'unknown_icon', `unknown icon "${ic}"`);
  });
  if (deck.slides[0].kind !== 'cover') e(1, 'kind', 'first_not_cover', 'first slide must be "cover"');
  if (deck.slides.at(-1).kind !== 'cta') e(deck.slides.length, 'kind', 'last_not_cta', 'last slide must be "cta"');
  return { ok: !errors.length, errors, warnings };
}

export const buildSlideHtml = ({ deck, index, identity, template, assetBase, photoUrl }) =>
  `<!doctype html><html><body data-template="${template}" data-asset="${assetBase}" data-photo="${photoUrl || ''}"><h1>${deck.slides[index]?.headline || deck.slides[index]?.title || ''}</h1><p>${identity.name || ''}</p></body></html>`;

export const sampleDeck = (lang = 'ar') => ({ slug: 'sample', template: 'editorial', caption: 'x',
  slides: [{ kind: 'cover', headline: lang === 'en' ? 'Sample' : 'عينة', icons: ['Code'] }, { kind: 'point', title: 'p' }, { kind: 'cta', headline: 'cta' }] });

const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
});

export async function renderDeck({ deck, workspaceDir, outDir, only, template, onProgress, signal }) {
  fs.mkdirSync(outDir, { recursive: true });
  const all = deck.slides.map((_, i) => i + 1);
  const todo = only?.length ? only : all;
  const files = [];
  let n = 0;
  for (const s of todo) {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    if (process.env.MOCK_RENDER_DELAY_MS) await sleep(Number(process.env.MOCK_RENDER_DELAY_MS), signal);
    const f = path.join(outDir, `${String(s).padStart(2, '0')}.png`);
    fs.writeFileSync(f, PNG); files.push(f);
    onProgress?.({ n: ++n, total: todo.length, file: f });
  }
  const sheet = path.join(outDir, '_sheet.jpg');
  fs.writeFileSync(sheet, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  fs.appendFileSync(path.join(workspaceDir, 'logs', 'mock-render.log'), JSON.stringify({ outDir: path.basename(outDir), only: only || null, template }) + '\n');
  return { files, sheet, overflow: process.env.MOCK_OVERFLOW ? [{ slide: 2, text: 'too long' }] : [] };
}
