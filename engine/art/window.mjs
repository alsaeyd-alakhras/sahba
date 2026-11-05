// "window": big tilted icon + app window + two floating chips + sparkles (+ hand arrow).
// icons[0] main tile · icons[1..2] chips · labels[0..1] chip texts. LTR decks get a mirrored layout.
import { tile, chip, appWindow, skeleton, sparkle, handArrow } from './parts.mjs';

export const name = 'window';
export const icons = { min: 1, max: 3, ideal: 3 };
const BOX = 460;
export function render({ icons = [], labels = [], arrow = true, dir = 'rtl' }) {
  const m = dir === 'ltr';
  // x of an element of known width, mirrored for LTR
  const x = (left, w) => (m ? BOX - left - w : left);
  // chips have text-dependent width: anchor them on the mirrored side instead
  const anchor = (left, top) => (m ? `right:${left}px;top:${top}px` : `left:${left}px;top:${top}px`);
  return [
    `<div class="aw-win" data-art style="left:${x(120, 300)}px;top:40px">${appWindow(300, 200, skeleton(4, 1), { rot: m ? 6 : -6 })}</div>`,
    `<div class="aw-main" data-art style="left:${x(10, 150)}px;top:0">${tile(icons[0], 150, m ? 10 : -10)}</div>`,
    icons[1] ? `<div class="aw-chip1" data-art style="${anchor(270, 196)}">${chip(icons[1], labels[0], m ? -5 : 5)}</div>` : '',
    icons[2] ? `<div class="aw-chip2" data-art style="${anchor(-20, 276)}">${chip(icons[2], labels[1], m ? 4 : -4)}</div>` : '',
    sparkle(x(400, 33.6), 0, 1.2), sparkle(x(170, 22.4), -30, 0.8),
    arrow ? handArrow(130, m ? -150 : 150, m, `position:absolute;left:${x(330, 130)}px;top:-80px`) : '',
  ].join('');
}
