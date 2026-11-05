import { rich, block, reqStr, optStr, isStr } from './_shared.mjs';
import { frame } from '../chrome.mjs';

export const kind = 'compare';
export const fields = ['title', 'right', 'left', 'body'];
export const titleFields = ['title'];
function side(s, f, add) {
  const d = s[f];
  if (!d || typeof d !== 'object') { add('error', f, 'missing_field', `"${f}" is required: {"title": "...", "items": ["...", "..."]}. ("right" = the weaker/before side, "left" = the winner, drawn highlighted).`); return; }
  if (!isStr(d.title)) add('error', `${f}.title`, 'missing_field', `"${f}.title" is required.`);
  if (!Array.isArray(d.items) || !d.items.length) add('error', `${f}.items`, 'missing_field', `"${f}.items" must be a non-empty array of strings.`);
  else if (d.items.length > 4) add('warning', `${f}.items`, 'count', `"${f}.items" has ${d.items.length} entries; 2–4 fit best.`);
}
export function check(s, add) { reqStr(s, 'title', add); side(s, 'right', add); side(s, 'left', add); optStr(s, 'body', add); }
export const graphic = () => true;

const card = (d = {}, hot) => `<div class="cmp-card${hot ? ' hot' : ''}" data-fit><div class="cmp-h">${rich(d.title)}</div>${(d.items || []).map((t) => `<div class="cmp-i"><span class="cmp-mark">${hot ? '✓' : '✕'}</span><span>${rich(t)}</span></div>`).join('')}</div>`;
export function render(s, ctx) {
  return frame(ctx, `<div class="content" data-fit>
  ${block('title cmp-title', rich(s.title))}
  <div class="cmp">${card(s.right, false)}${card(s.left, true)}<div class="vs" dir="ltr">${ctx.str.vs}</div></div>
  ${block('body cmp-body', rich(s.body))}
</div>`);
}
