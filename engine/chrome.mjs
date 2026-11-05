// Slide chrome: background (dots + glows), corner spark, category badge, progress bar,
// page number, handle, and identity pieces (photo, name, handle, role).
import { esc, pad2, W } from './util.mjs';
import { STAR } from './art/parts.mjs';

export const spark = (size = 44) => `<svg class="spark" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/></svg>`;
export const bookmark = (h = 58) => `<svg class="bookmark" width="${(h * 24) / 31}" height="${h}" viewBox="0 0 24 31" aria-hidden="true"><path d="M3 1h18a1 1 0 0 1 1 1v28l-10-6.5L2 30V2a1 1 0 0 1 1-1z"/></svg>`;
export const swipeArrow = () => `<svg class="swipe-arrow" width="52" height="34" viewBox="0 0 52 34" aria-hidden="true"><path d="M50 17H4M16 5L4 17l12 12"/></svg>`;

/** round photo; without a photo URL a neutral initial avatar is drawn */
export function photo(ctx, size, ring = 3) {
  const st = `--s:${size}px;--ring:${ring}px`;
  const id = ctx.identity || {};
  if (ctx.photoUrl) return `<img class="photo" src="${esc(ctx.photoUrl)}" alt="" style="${st};object-position:${esc(id.facePos || '50% 28%')}">`;
  // neutral silhouette placeholder until the user adds a photo
  return `<div class="photo photo-empty" style="${st}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="40" r="18"/><path d="M14 100c2-22 17-35 36-35s34 13 36 35z"/></svg></div>`;
}

/** frame around a slide body. opts: {handle, number} */
export function frame(ctx, body, { handle = true, number = true, cls = '' } = {}) {
  const { n, total, category, identity = {} } = ctx;
  const fill = ((n / total) * W).toFixed(1);
  return `<div class="slide k-${esc(ctx.kind)}${cls ? ' ' + cls : ''}" data-n="${n}">
<div class="bg-dots"></div><div class="bg-glow g1"></div><div class="bg-glow g2"></div>
<div class="corner-spark">${spark()}</div>
${category ? `<div class="badge"><span>${esc(category)}</span></div>` : ''}
${body}
<div class="progress"><div class="progress-fill" style="width:${fill}px"></div></div>
${number ? `<div class="pageno" dir="ltr"><span class="pn-n">${pad2(n)}</span><span class="pn-t"> / ${pad2(total)}</span></div>` : ''}
${handle && identity.handle ? `<div class="handle" dir="ltr">${esc(identity.handle)}</div>` : ''}
</div>`;
}
