// Helpers shared by slide kinds: blocks, kicker, items, field checks.
import { esc, iconExists, vars } from '../util.mjs';
import { rich } from '../rich.mjs';
import { tile } from '../art/parts.mjs';

export { esc, rich, tile, vars };

/** text block; data-fit marks it for the overflow check */
export const block = (cls, html, style = '') => (html ? `<div class="${cls}" data-fit${style ? ` style="${style}"` : ''}>${html}</div>` : '');

export const kicker = (s) => (s.kicker || s.icon)
  ? `<div class="kicker">${s.icon ? tile(s.icon, 84, -6) : ''}${s.kicker ? `<span class="kicker-t" data-fit>${rich(s.kicker)}</span>` : ''}</div>` : '';

export const itxt = (it) => (typeof it === 'string' ? it : it?.t ?? '');
export const iico = (it) => (typeof it === 'string' ? undefined : it?.icon);

/* ── validation helpers (each returns nothing; they push via add(level, field, code, msg)) ── */
export const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
export function reqStr(s, f, add, hint = '') {
  if (!isStr(s[f])) add('error', f, 'missing_field', `"${f}" is required and must be a non-empty string${hint ? ' — ' + hint : ''}.`);
}
export function optStr(s, f, add) {
  if (s[f] !== undefined && typeof s[f] !== 'string') add('error', f, 'bad_type', `"${f}" must be a string.`);
}
export function optNum(s, f, add) {
  if (s[f] !== undefined && !(typeof s[f] === 'number' && Number.isFinite(s[f]))) add('error', f, 'bad_type', `"${f}" must be a number.`);
}
export function icon(s, f, add, required = false) {
  const v = s[f];
  if (v === undefined) { if (required) add('error', f, 'missing_field', `"${f}" is required (a Lucide icon name in PascalCase, e.g. "Clock").`); return; }
  if (!iconExists(v)) add('error', f, 'unknown_icon', `Unknown icon "${v}" in "${f}". Use a Lucide name in PascalCase (e.g. "FileText", "Rocket"); see listIcons().`);
}
export function iconList(list, f, add) {
  list.forEach((v, i) => { if (!iconExists(v)) add('error', `${f}[${i}]`, 'unknown_icon', `Unknown icon "${v}" in "${f}[${i}]". Use a Lucide PascalCase name (see listIcons()).`); });
}
export function arr(s, f, add, { min = 1, max = 99, required = true } = {}) {
  const v = s[f];
  if (v === undefined) { if (required) add('error', f, 'missing_field', `"${f}" is required (array, ${min}–${max} entries).`); return false; }
  if (!Array.isArray(v)) { add('error', f, 'bad_type', `"${f}" must be an array.`); return false; }
  if (v.length < min || v.length > max) add(v.length < min ? 'error' : 'warning', f, 'count', `"${f}" has ${v.length} entries; use ${min}–${max}.`);
  return true;
}
/** items that may be "text" or {icon, t} */
export function items(s, f, add, opts) {
  if (!arr(s, f, add, opts)) return;
  s[f].forEach((it, i) => {
    if (typeof it === 'string') { if (!it.trim()) add('error', `${f}[${i}]`, 'empty', `"${f}[${i}]" is empty.`); return; }
    if (!it || typeof it !== 'object' || !isStr(it.t)) { add('error', `${f}[${i}]`, 'bad_item', `"${f}[${i}]" must be a string or {"icon": "Name", "t": "text"}.`); return; }
    if (it.icon !== undefined && !iconExists(it.icon)) add('error', `${f}[${i}].icon`, 'unknown_icon', `Unknown icon "${it.icon}" in "${f}[${i}].icon".`);
  });
}
