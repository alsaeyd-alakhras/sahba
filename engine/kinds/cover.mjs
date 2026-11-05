import { rich, block, reqStr, optStr, optNum, esc } from './_shared.mjs';
import { placeArt } from '../art/index.mjs';
import { frame, photo, bookmark, swipeArrow } from '../chrome.mjs';

export const kind = 'cover';
export const fields = ['headline', 'sub', 'size', 'swipe', 'icons', 'labels', 'art', 'artAt', 'arrow'];
export const art = true;
export const titleFields = ['headline'];
export function check(s, add) {
  reqStr(s, 'headline', add, 'the hook, ≤ 6 words, use <br> to break lines');
  optStr(s, 'sub', add); optNum(s, 'size', add); optStr(s, 'swipe', add);
  if (!Array.isArray(s.icons) || !s.icons.length) add('error', 'icons', 'missing_field', 'cover always needs an art composition: give "icons" (3 names for window/stack, 4–6 for orbit) and optional "labels".');
}
export const graphic = (s) => Array.isArray(s.icons) && s.icons.length > 0;

export function render(s, ctx) {
  const id = ctx.identity || {};
  const size = typeof s.size === 'number' ? s.size : 104;
  const who = (id.name || id.handle)
    ? `<div class="cover-id">${photo(ctx, 92)}<div class="cover-who">${id.name ? `<div class="cover-name" data-fit>${esc(id.name)}</div>` : ''}${id.handle ? `<div class="cover-handle" dir="ltr" data-fit>${esc(id.handle)}</div>` : ''}</div></div>`
    : '<div></div>';
  return frame(ctx, `${placeArt(s, { left: 270, top: 625, scale: 1.15, arrow: false }, ctx)}
<div class="cover-wrap">
  <div class="cover-top">
    ${block('title cover-title', rich(s.headline), `--fs:${size}px`)}
    ${block('sub cover-sub', rich(s.sub))}
  </div>
  <div class="cover-bottom">
    <div class="swipe"><span class="swipe-t">${esc(s.swipe ?? ctx.str.swipe)}</span>${swipeArrow()}</div>
    <div class="cover-row">${who}${bookmark(58)}</div>
  </div>
</div>`, { handle: false, number: false });
}
