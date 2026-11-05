import { rich, block, reqStr, optStr } from './_shared.mjs';
import { placeArt } from '../art/index.mjs';
import { frame } from '../chrome.mjs';

export const kind = 'quote';
export const fields = ['quote', 'source', 'icons', 'labels', 'art', 'artAt', 'arrow'];
export const art = true;
export const titleFields = [];
export function check(s, add) { reqStr(s, 'quote', add); optStr(s, 'source', add); }
// the big quotation mark is the graphic
export const graphic = () => true;

export function render(s, ctx) {
  return frame(ctx, `<div class="quote-mark" dir="ltr">&#8220;</div>
${placeArt(s, { center: true, left: 70, top: 860, scale: 0.85, arrow: false }, ctx)}
<div class="content${s.icons?.length && !s.artAt ? ' above-art' : ''}" data-fit>
  ${block('quote-t', rich(s.quote))}
  ${s.source ? `<div class="quote-src"><div class="src-line"></div><div class="src-t" data-fit>${rich(s.source)}</div></div>` : ''}
</div>`);
}
