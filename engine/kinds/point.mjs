import { rich, block, reqStr, optStr, icon, tile, esc } from './_shared.mjs';
import { placeArt } from '../art/index.mjs';
import { frame } from '../chrome.mjs';
import { pad2 } from '../util.mjs';

export const kind = 'point';
export const fields = ['icon', 'number', 'kicker', 'title', 'body', 'icons', 'labels', 'art', 'artAt', 'arrow'];
export const art = true;
export const titleFields = ['title'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'kicker', add); optStr(s, 'body', add); icon(s, 'icon', add);
  if (s.number !== undefined && typeof s.number !== 'string' && typeof s.number !== 'number') add('error', 'number', 'bad_type', '"number" must be a string or number.');
}
// without icon/icons the numbered tile is drawn, so a point always has a graphic
export const graphic = () => true;

export function render(s, ctx) {
  const num = String(s.number ?? pad2(ctx.n - 1));
  const hasArt = Array.isArray(s.icons) && s.icons.length > 0;
  return frame(ctx, `${hasArt ? '' : `<div class="ghost-num" dir="ltr">${esc(num)}</div>`}
${placeArt(s, { left: 90, top: 190, scale: 0.85 }, ctx)}
<div class="content${hasArt ? ' below-art' : ''}" data-fit>
  <div class="point-head">${s.icon ? tile(s.icon, 118, -6, false, 'point-tile') : `<div class="num-tile" dir="ltr">${esc(num)}</div>`}${s.kicker ? `<span class="kicker-t" data-fit>${rich(s.kicker)}</span>` : ''}</div>
  ${block('title point-title', rich(s.title))}
  <div class="accent-line"></div>
  ${block('body point-body', rich(s.body))}
</div>`);
}
