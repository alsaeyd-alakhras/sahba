import { rich, block, kicker, reqStr, optStr, icon, arr, esc, isStr } from './_shared.mjs';
import { frame } from '../chrome.mjs';
import { ico } from '../art/parts.mjs';

export const kind = 'pick';
export const fields = ['icon', 'kicker', 'title', 'others', 'hot', 'hotIcon', 'body'];
export const titleFields = ['title'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'kicker', add); optStr(s, 'body', add); icon(s, 'icon', add); icon(s, 'hotIcon', add);
  reqStr(s, 'hot', add, 'the one chosen option, 1–3 words');
  if (arr(s, 'others', add, { min: 2, max: 6 })) s.others.forEach((t, i) => { if (!isStr(t)) add('error', `others[${i}]`, 'bad_item', `"others[${i}]" must be a short string.`); });
}
export const graphic = () => true;

const ROT = [-4, 3, -2, 5, -3];
export function render(s, ctx) {
  const pills = (s.others || []).map((t, i) => `<div class="pill" style="--r:${ROT[i % 5]}deg" data-fit>${esc(t)}</div>`).join('');
  return frame(ctx, `<div class="content" data-fit>
  ${kicker(s)}
  ${block('title pick-title', rich(s.title))}
  <div class="pick">
    <div class="pills">${pills}</div>
    <div class="pick-hot-wrap"><div class="pick-hot">${ico(s.hotIcon ?? 'Sparkles', 96, 'hot-ico')}<span data-fit>${rich(s.hot)}</span></div></div>
  </div>
  ${block('body pick-body', rich(s.body))}
</div>`);
}
