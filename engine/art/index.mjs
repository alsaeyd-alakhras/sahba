// Art registry + placement wrapper.
import * as windowArt from './window.mjs';
import * as orbit from './orbit.mjs';
import * as stack from './stack.mjs';
import { num } from '../util.mjs';

export const ART = { window: windowArt, orbit, stack };
export const artNames = () => Object.keys(ART);

/** placed composition for a slide (needs s.icons). def = per-kind default {left, top, scale, arrow} */
export function placeArt(s, def, ctx) {
  if (!Array.isArray(s.icons) || !s.icons.length) return '';
  const id = ART[s.art] ? s.art : 'window';
  const A = ART[id];
  const at = s.artAt || {};
  const left = num(at.left, def.left), top = num(at.top, def.top), scale = num(at.scale, def.scale);
  const arrow = s.arrow ?? def.arrow ?? true;
  // def.center (quote): centered under the text unless the deck sets artAt.left
  if (def.center && at.left === undefined)
    return `<div class="art art-${id}" style="left:50%;top:${top}px;transform-origin:top center;transform:translateX(-50%) scale(${scale})">${A.render({ icons: s.icons, labels: s.labels || [], arrow, dir: ctx.dir })}</div>`;
  // RTL decks use the physical `left` from the deck; LTR decks mirror it.
  const pos = ctx.dir === 'ltr' ? `right:${left}px;transform-origin:top right` : `left:${left}px;transform-origin:top left`;
  return `<div class="art art-${id}" style="${pos};top:${top}px;transform:scale(${scale})">${A.render({ icons: s.icons, labels: s.labels || [], arrow, dir: ctx.dir })}</div>`;
}
