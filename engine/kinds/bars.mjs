import { rich, block, kicker, reqStr, optStr, icon, arr, esc, isStr } from './_shared.mjs';
import { frame } from '../chrome.mjs';

export const kind = 'bars';
export const fields = ['icon', 'kicker', 'title', 'items', 'suffix', 'body'];
export const titleFields = ['title'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'kicker', add); optStr(s, 'suffix', add); optStr(s, 'body', add); icon(s, 'icon', add);
  if (arr(s, 'items', add, { min: 2, max: 5 })) s.items.forEach((it, i) => {
    if (!it || typeof it !== 'object' || !isStr(it.label) || typeof it.value !== 'number') add('error', `items[${i}]`, 'bad_item', `"items[${i}]" must be {"label": "text", "value": number, "hot"?: true}.`);
  });
}
export const graphic = () => true;

export function render(s, ctx) {
  const list = Array.isArray(s.items) ? s.items : [];
  const max = Math.max(1e-9, ...list.map((i) => Number(i.value) || 0));
  const rows = list.map((it) => `<div class="bar${it.hot ? ' hot' : ''}"><div class="bar-head"><span class="bar-l" data-fit>${rich(it.label)}</span><span class="bar-v" dir="ltr">${esc(it.value)}${esc(s.suffix ?? '')}</span></div><div class="bar-track"><div class="bar-fill" style="width:${(((Number(it.value) || 0) / max) * 100).toFixed(2)}%"></div></div></div>`).join('');
  return frame(ctx, `<div class="content" data-fit>
  ${kicker(s)}
  ${block('title bars-title', rich(s.title))}
  <div class="bars">${rows}</div>
  ${block('body bars-body', rich(s.body))}
</div>`);
}
