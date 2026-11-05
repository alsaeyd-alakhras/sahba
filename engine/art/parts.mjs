// Drawing primitives shared by kinds and art compositions (static, settled state).
import { esc, iconSvg, vars } from '../util.mjs';

/** rounded icon tile (accent gradient, or white when light) — size px, rot deg */
export const tile = (name, size = 120, rot = 0, light = false, extra = '') =>
  `<div class="tile${light ? ' light' : ''}${extra ? ' ' + extra : ''}" style="${vars({ s: size, r: rot + 'deg' })}">${iconSvg(name)}</div>`;

/** bare icon with explicit size, coloured by CSS `color` */
export const ico = (name, size, cls = '') => `<span class="ico-wrap${cls ? ' ' + cls : ''}" style="${vars({ s: size })}">${iconSvg(name)}</span>`;

/** white card chip: icon tile + label */
export const chip = (icon, text, rot = 0) =>
  `<div class="chip${text ? '' : ' bare'}" style="${vars({ r: rot + 'deg' })}">${tile(icon, 64)}${text ? `<span class="chip-t" data-fit>${esc(text)}</span>` : ''}</div>`;

/** mini app window: traffic lights + body */
export const appWindow = (w, h, body, { rot = 0, title = '', cls = '' } = {}) =>
  `<div class="win${cls ? ' ' + cls : ''}" style="${vars({ w, h, r: rot + 'deg' })}"><div class="win-bar" dir="ltr"><i></i><i></i><i></i>${title ? `<span>${esc(title)}</span>` : ''}</div><div class="win-body">${body}</div></div>`;

export const skeleton = (rows = 4, accent = 1) => {
  const widths = [92, 70, 82, 58];
  return `<div class="skel">${Array.from({ length: rows }, (_, i) => `<div class="skel-row${i === accent ? ' hot' : ''}" style="width:${widths[i % 4]}%"></div>`).join('')}</div>`;
};

/** dotted hand-drawn arrow */
export const handArrow = (w = 160, rot = 0, flip = false, style = '') =>
  `<svg class="hand-arrow" width="${w}" height="${w * 0.6}" viewBox="0 0 200 120" style="transform:rotate(${rot}deg) scaleX(${flip ? -1 : 1});${style}" aria-hidden="true"><path d="M10 100 C 50 20, 120 10, 180 40" stroke-dasharray="2 12"/><path d="M160 22 L182 41 L156 54"/></svg>`;

export const STAR = 'M12 0c.6 5.4 2.6 7.4 8 8-5.4.6-7.4 2.6-8 8-.6-5.4-2.6-7.4-8-8 5.4-.6 7.4-2.6 8-8z';
export const sparkle = (x, y, s = 1) =>
  `<svg class="sparkle" width="${28 * s}" height="${28 * s}" viewBox="0 0 24 24" style="left:${x}px;top:${y}px" aria-hidden="true"><path d="${STAR}"/></svg>`;
