import { rich, block, reqStr, optStr, esc } from './_shared.mjs';
import { frame, photo, bookmark } from '../chrome.mjs';

export const kind = 'cta';
export const fields = ['headline', 'prompt', 'save'];
export const titleFields = ['headline'];
export function check(s, add) {
  reqStr(s, 'headline', add, 'one clear action'); optStr(s, 'prompt', add);
  if (s.save !== undefined && typeof s.save !== 'string' && typeof s.save !== 'boolean') add('error', 'save', 'bad_type', '"save" must be a string (custom save line), true (default line) or false (hide it).');
}
// the profile photo is the graphic
export const graphic = () => true;

export function render(s, ctx) {
  const id = ctx.identity || {};
  const save = s.save === false ? null : typeof s.save === 'string' && s.save.trim() ? s.save : ctx.str.save;
  return frame(ctx, `<div class="cta-wrap">
  <div class="cta-top">
    ${block('title cta-title', rich(s.headline))}
    ${block('sub cta-prompt', rich(s.prompt))}
  </div>
  <div class="cta-id">
    <div class="cta-photo"><div class="cta-ring"></div>${photo(ctx, 256, 6)}</div>
    ${id.handle ? `<div class="cta-handle" dir="ltr" data-fit>${esc(id.handle)}</div>` : ''}
    ${id.name ? `<div class="cta-name" data-fit>${esc(id.name)}</div>` : ''}
    ${id.role ? `<div class="cta-role" data-fit>${esc(id.role)}</div>` : ''}
  </div>
  <div class="cta-save">${bookmark(40)}${save ? `<span class="cta-save-t" data-fit>${rich(save)}</span>` : ''}</div>
</div>`, { handle: false });
}
