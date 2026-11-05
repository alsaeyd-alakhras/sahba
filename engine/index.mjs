// Sahba engine — public API (SPEC §5).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KINDS } from './kinds/index.mjs';
import { buildSlideHtml } from './build.mjs';
import { validateDeck } from './validate.mjs';
import { sampleDeck } from './sample.mjs';
import { launch, READY_JS, CHECK_JS } from './shoot.mjs';
import { ENGINE_DIR, TEMPLATES_DIR, templateIds, iconNames, fonts, fileUrl, writeAtomic, pad2, esc } from './util.mjs';

export { buildSlideHtml, validateDeck, sampleDeck };

export function listKinds() { return Object.keys(KINDS); }
export function listIcons() { return iconNames(); }
export function listFonts() { return fonts().map(({ id, name, family }) => ({ id, name, family })); }

/** Template = { id, name:{ar,en}, desc:{ar,en}, fits:{ar,en}, preview: "templates/<id>/preview.png" } */
export async function listTemplates() {
  const out = [];
  for (const id of templateIds()) {
    try {
      const j = JSON.parse(await fs.promises.readFile(path.join(TEMPLATES_DIR, id, 'template.json'), 'utf8'));
      out.push({ id: j.id || id, name: j.name, desc: j.desc, fits: j.fits, preview: `templates/${id}/preview.png` });
    } catch { /* skip broken template */ }
  }
  return out;
}

function readIdentity(workspaceDir) {
  if (!workspaceDir) return {};
  try { return JSON.parse(fs.readFileSync(path.join(workspaceDir, 'brand', 'identity.json'), 'utf8')); } catch { return {}; }
}
function findPhoto(workspaceDir, identity) {
  if (!workspaceDir) return null;
  const brand = path.join(workspaceDir, 'brand');
  const names = [identity.photo, 'photo.jpg', 'photo.jpeg', 'photo.png', 'photo.webp'].filter((x) => typeof x === 'string' && x);
  for (const n of names) {
    const p = path.resolve(brand, n);
    if (p.startsWith(path.resolve(brand)) && fs.existsSync(p)) return p;
  }
  return null;
}

/** sheet page: grid of slide PNGs (4 per row, 40% size) */
function sheetHtml(files) {
  const cols = Math.min(4, files.length);
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{background:#e9e7e1}
.g{display:grid;grid-template-columns:repeat(${cols},432px);width:${cols * 432}px}img{width:432px;height:540px;display:block}</style></head>
<body><div class="g">${files.map((f) => `<img src="${esc(fileUrl(f))}">`).join('')}</div></body></html>`;
}

/**
 * Render a deck to PNGs.  Writes outDir/01.png … NN.png + _sheet.jpg (atomic writes).
 * @returns {Promise<{files:string[], sheet:string, overflow:{slide:number,text:string,reason:string}[], rendered:number[], ms:number}>}
 *   files = every slide PNG present in outDir for this deck (absolute paths, in order);
 *   rendered = 1-based slide numbers drawn in this call; overflow = layout problems found in those slides.
 */
export async function renderDeck({ deck, workspaceDir, outDir, only, template, onProgress, signal, identity: identityOverride, skipValidation = false } = {}) {
  const t0 = Date.now();
  if (!outDir) throw new Error('renderDeck: outDir is required');
  if (!skipValidation) {
    const v = validateDeck(deck);
    if (!v.ok) throw Object.assign(new Error('deck is invalid:\n' + v.errors.map((e) => `- ${e.slide ? 'slide ' + e.slide + ': ' : ''}${e.msg}`).join('\n')), { code: 'invalid_deck', issues: v });
  }
  const identity = identityOverride || readIdentity(workspaceDir);
  const photoPath = findPhoto(workspaceDir, identity);
  const photoUrl = photoPath ? fileUrl(photoPath) : null;
  const total = deck.slides.length;
  const list = (Array.isArray(only) && only.length ? [...new Set(only.map(Number))].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b) : Array.from({ length: total }, (_, i) => i + 1));
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sahba-html-'));
  const assetBase = fileUrl(ENGINE_DIR) + '/';
  const overflow = [];
  let browser = null;
  try {
    browser = await launch({ signal });
    const page = await browser.newPage();
    for (let k = 0; k < list.length; k++) {
      if (signal?.aborted) throw Object.assign(new Error('render aborted'), { name: 'AbortError', code: 'aborted' });
      const n = list[k];
      const html = buildSlideHtml({ deck, index: n - 1, identity, template, assetBase, photoUrl });
      const htmlFile = path.join(tmp, pad2(n) + '.html');
      fs.writeFileSync(htmlFile, html);
      await page.goto(fileUrl(htmlFile));
      await page.eval(READY_JS);
      for (const o of await page.eval(CHECK_JS)) overflow.push({ slide: n, text: o.text, reason: o.reason });
      const png = await page.shot({ format: 'png' });
      const file = path.join(outDir, pad2(n) + '.png');
      writeAtomic(file, png);
      onProgress?.({ n: k + 1, total: list.length, file, slide: n });
    }
    // full render: drop stale slides from a longer previous version
    if (!only?.length) for (const f of fs.readdirSync(outDir)) {
      const m = f.match(/^(\d{2,3})\.png$/);
      if (m && Number(m[1]) > total) fs.rmSync(path.join(outDir, f), { force: true });
    }
    const files = Array.from({ length: total }, (_, i) => path.join(outDir, pad2(i + 1) + '.png')).filter((f) => fs.existsSync(f));
    // contact sheet
    const sheet = path.join(outDir, '_sheet.jpg');
    if (files.length) {
      const cols = Math.min(4, files.length), rows = Math.ceil(files.length / 4);
      const sheetFile = path.join(tmp, '_sheet.html');
      fs.writeFileSync(sheetFile, sheetHtml(files));
      await page.size(cols * 432, rows * 540);
      await page.goto(fileUrl(sheetFile));
      await page.eval(READY_JS);
      writeAtomic(sheet, await page.shot({ format: 'jpeg', quality: 84, width: cols * 432, height: rows * 540 }));
    }
    return { files, sheet, overflow, rendered: list, ms: Date.now() - t0 };
  } finally {
    if (browser) await browser.close();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
