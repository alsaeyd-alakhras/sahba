// "stack": 3 fanned cards (middle one hot), each = icon + one-word label.
import { esc } from '../util.mjs';
import { tile } from './parts.mjs';

export const name = 'stack';
export const icons = { min: 1, max: 3, ideal: 3 };
const POSE = [{ x: -205, r: -9, y: 30 }, { x: 0, r: 0, y: 0 }, { x: 205, r: 9, y: 30 }];
export function render({ icons = [], labels = [] }) {
  const cards = icons.slice(0, 3);
  return cards.map((ic, i) => {
    const P = POSE[cards.length === 1 ? 1 : i], hot = i === 1 || cards.length === 1;
    return `<div class="as-card${hot ? ' hot' : ''}" data-art style="transform:translate(${P.x}px,${P.y}px) rotate(${P.r}deg)">${tile(ic, 92, 0, hot)}${labels[i] ? `<span class="as-t" data-fit>${esc(labels[i])}</span>` : ''}<div class="as-bar"></div></div>`;
  }).join('');
}
