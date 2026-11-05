// Shared helpers: paths, escaping, icons, fonts, templates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.dirname(ENGINE_DIR);
export const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
export const W = 1080, H = 1350;

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const pad2 = (x) => String(x).padStart(2, '0');
export const fileUrl = (p) => pathToFileURL(p).href;
export const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** CSS custom properties -> inline style string (numbers become px) */
export const vars = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `--${k}:${typeof v === 'number' ? v + 'px' : v}`).join(';');

/* ── icons ─────────────────────────────────────────── */
let ICONS = null;
function iconIndex() {
  if (!ICONS) {
    const j = JSON.parse(fs.readFileSync(path.join(ENGINE_DIR, 'icons', 'icons.json'), 'utf8'));
    ICONS = { set: new Set(j.icons), aliases: j.aliases || {}, cache: new Map() };
  }
  return ICONS;
}
export const iconNames = () => { const i = iconIndex(); return [...i.set, ...Object.keys(i.aliases)].sort(); };
export const resolveIcon = (name) => {
  if (typeof name !== 'string') return null;
  const i = iconIndex();
  if (i.set.has(name)) return name;
  if (i.aliases[name]) return i.aliases[name];
  return null;
};
export const iconExists = (name) => resolveIcon(name) !== null;
/** inline SVG markup for a Lucide icon ('' if unknown). Size/colour come from CSS (.ico). */
export function iconSvg(name, cls = 'ico') {
  const real = resolveIcon(name);
  if (!real) return '';
  const i = iconIndex();
  let body = i.cache.get(real);
  if (body === undefined) {
    const raw = fs.readFileSync(path.join(ENGINE_DIR, 'icons', real + '.svg'), 'utf8');
    body = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    i.cache.set(real, body);
  }
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ── fonts ─────────────────────────────────────────── */
let FONTS = null;
export function fonts() {
  if (!FONTS) FONTS = JSON.parse(fs.readFileSync(path.join(ENGINE_DIR, 'fonts', 'fonts.json'), 'utf8'));
  return FONTS;
}
export const fontById = (id) => fonts().find((f) => f.id === id) || null;
export function fontFaceCss(font, assetBase) {
  return font.faces.map((f) => `@font-face{font-family:'${font.family}';font-style:normal;font-display:block;font-weight:${f.weight};src:url('${assetBase}fonts/${font.id}/${f.file}') format('woff2');${f.range ? `unicode-range:${f.range};` : ''}}`).join('\n');
}

/* ── templates ─────────────────────────────────────── */
const TPL_CACHE = new Map();
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
export function templateIds() {
  try { return fs.readdirSync(TEMPLATES_DIR).filter((d) => fs.existsSync(path.join(TEMPLATES_DIR, d, 'template.json'))).sort(); } catch { return []; }
}
/** loads templates/<id>/template.json + style.css (unknown id falls back to 'editorial') */
export function loadTemplate(id) {
  if (id && typeof id === 'object') return id;
  const ids = templateIds();
  const use = ids.includes(id) ? id : ids.includes('editorial') ? 'editorial' : ids[0];
  if (!use) throw new Error('no templates found in ' + TEMPLATES_DIR);
  const dir = path.join(TEMPLATES_DIR, use);
  const stamp = mtime(path.join(dir, 'template.json')) + ':' + mtime(path.join(dir, 'style.css'));
  const c = TPL_CACHE.get(use);
  if (c && c.stamp === stamp) return c.tpl;
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8'));
  const css = fs.existsSync(path.join(dir, 'style.css')) ? fs.readFileSync(path.join(dir, 'style.css'), 'utf8') : '';
  const tpl = { ...meta, id: meta.id || use, css, dir };
  TPL_CACHE.set(use, { stamp, tpl });
  return tpl;
}

let BASE = { css: null, m: 0 };
export function baseCss() {
  const p = path.join(ENGINE_DIR, 'base.css');
  const m = mtime(p);
  if (!BASE.css || m !== BASE.m) BASE = { css: fs.readFileSync(p, 'utf8'), m };
  return BASE.css;
}

/** atomic write: .tmp then rename */
export function writeAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

/** the only built-in words drawn on slides (generic, per deck language) */
export const STR = {
  ar: { swipe: 'اسحب لليمين', save: 'احفظ البوست وشاركه لتنشر الفائدة', rule: 'القاعدة', vs: 'VS' },
  en: { swipe: 'Swipe for more', save: 'Save this post and share it', rule: 'The rule', vs: 'VS' },
};
export const str = (lang) => STR[lang] || STR.ar;
