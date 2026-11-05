import { rich, block, kicker, reqStr, optStr, optNum, icon, items, tile, itxt, iico } from './_shared.mjs';
import { frame } from '../chrome.mjs';
import { num } from '../util.mjs';

export const kind = 'steps';
export const fields = ['icon', 'kicker', 'title', 'items', 'big', 'gap', 'R'];
export const titleFields = ['title'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'kicker', add); icon(s, 'icon', add);
  items(s, 'items', add, { min: 2, max: 5 }); optNum(s, 'gap', add); optNum(s, 'R', add);
}
export const graphic = () => true;

export function render(s, ctx) {
  const list = Array.isArray(s.items) ? s.items : [];
  const gap = num(s.gap, 150), R = num(s.R, 56), n = list.length;
  const rows = list.map((it, i) => {
    const ic = iico(it);
    return `<div class="step" data-fit style="top:${i * gap}px;height:${2 * R}px"><div class="step-dot">${ic ? tile(ic, 2 * R - 30, 0, false, 'bare') : '<span class="step-check">✓</span>'}</div><div class="step-t">${rich(itxt(it))}</div></div>`;
  }).join('');
  return frame(ctx, `<div class="content${s.big ? ' big' : ''}" data-fit>
  ${kicker(s)}
  ${block('title steps-title', rich(s.title))}
  <div class="steps" style="--R:${R}px;height:${gap * (n - 1) + 2 * R}px"><div class="steps-line" style="height:${gap * (n - 1)}px"></div>${rows}</div>
</div>`);
}
