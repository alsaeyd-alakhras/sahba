import { rich, block, kicker, reqStr, optStr, icon, items, tile, itxt, iico } from './_shared.mjs';
import { frame } from '../chrome.mjs';

export const kind = 'list';
export const fields = ['icon', 'kicker', 'title', 'items', 'big'];
export const titleFields = ['title'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'kicker', add); icon(s, 'icon', add);
  items(s, 'items', add, { min: 2, max: 5 });
}
export const graphic = (s) => !!s.icon || (Array.isArray(s.items) && s.items.some((it) => iico(it)));

export function render(s, ctx) {
  const big = !!s.big;
  const list = (s.items || []).map((it) => {
    const ic = iico(it);
    return `<div class="li${ic ? ' has-ico' : ''}" data-fit>${ic ? tile(ic, big ? 110 : 78, 0, true) : '<span class="li-dot">◆</span>'}<span class="li-t">${rich(itxt(it))}</span></div>`;
  }).join('');
  return frame(ctx, `<div class="content${big ? ' big' : ''}" data-fit>
  ${kicker(s)}
  ${block('title list-title', rich(s.title))}
  <div class="list">${list}</div>
</div>`);
}
