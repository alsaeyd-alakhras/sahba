import { rich, block, kicker, reqStr, optStr, optNum, icon, esc } from './_shared.mjs';
import { frame } from '../chrome.mjs';

export const kind = 'stat';
export const fields = ['icon', 'kicker', 'value', 'unit', 'prefix', 'fill', 'size', 'title', 'body'];
export const titleFields = ['title'];
export function check(s, add) {
  if (typeof s.value !== 'number' || !Number.isFinite(s.value)) add('error', 'value', 'missing_field', '"value" is required and must be a number (e.g. 12). Put symbols in "unit" or "prefix".');
  reqStr(s, 'title', add); optStr(s, 'kicker', add); optStr(s, 'unit', add); optStr(s, 'prefix', add); optStr(s, 'body', add);
  optNum(s, 'fill', add); optNum(s, 'size', add); icon(s, 'icon', add);
  if (typeof s.fill === 'number' && (s.fill < 0 || s.fill > 100)) add('warning', 'fill', 'range', '"fill" is a percentage 0–100.');
}
export const graphic = () => true;

export function render(s, ctx) {
  const v = Number(s.value) || 0;
  const txt = Number.isInteger(v) ? String(v) : v.toFixed(1);
  const fill = Math.max(0, Math.min(100, typeof s.fill === 'number' ? s.fill : 100));
  return frame(ctx, `<div class="content" data-fit>
  ${kicker(s)}
  <div class="stat-row" dir="ltr">${s.unit ? `<span class="stat-unit">${esc(s.unit)}</span>` : ''}<span class="stat-val" style="--fs:${typeof s.size === 'number' ? s.size : 340}px">${esc(s.prefix ?? '')}${esc(txt)}</span></div>
  <div class="meter"><div class="meter-fill" style="width:${fill}%"></div></div>
  ${block('title stat-title', rich(s.title))}
  ${block('body stat-body', rich(s.body))}
</div>`);
}
