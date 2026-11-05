// "orbit": main icon in the centre, 3-5 satellites on a dotted ring, optional pill label under it.
import { esc } from '../util.mjs';
import { tile } from './parts.mjs';

export const name = 'orbit';
export const icons = { min: 3, max: 6, ideal: 5 };
const R = 165, CX = 230, CY = 170, SETTLED_SPIN = 21; // degrees the ring had turned at the old still frame
export function render({ icons = [], labels = [] }) {
  const sat = icons.slice(1, 6);
  const sats = sat.map((ic, i) => {
    const a = ((-90 + (360 / sat.length) * i + SETTLED_SPIN) * Math.PI) / 180;
    const x = CX + Math.cos(a) * R - 40, y = CY + Math.sin(a) * R - 40;
    return `<div class="ao-sat" data-art style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">${tile(ic, 80, 0, true)}</div>`;
  }).join('');
  return `<svg class="ao-ring" width="460" height="340" aria-hidden="true"><circle class="ao-dash" cx="${CX}" cy="${CY}" r="${R}" transform="rotate(42 ${CX} ${CY})"/><circle class="ao-fill" cx="${CX}" cy="${CY}" r="${R * 0.62}"/></svg>`
    + `<div class="ao-main" data-art style="left:${CX - 80}px;top:${CY - 80}px">${tile(icons[0], 160, -8)}</div>`
    + sats
    + (labels[0] ? `<div class="ao-label" style="top:${CY + R + 34}px"><span data-art data-fit>${esc(labels[0])}</span></div>` : '');
}
