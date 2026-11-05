import { rich, block, reqStr, optStr, icon, arr, esc, isStr, iconList } from './_shared.mjs';
import { frame } from '../chrome.mjs';
import { appWindow, ico } from '../art/parts.mjs';

export const kind = 'sites';
export const fields = ['title', 'plain', 'plainTag', 'brand', 'brandTag', 'brandIcons', 'heroIcon', 'body'];
export const titleFields = ['title'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'body', add);
  reqStr(s, 'plainTag', add, 'tag under the plain site, e.g. "موقع عادي"');
  reqStr(s, 'brandTag', add, 'tag under the branded site');
  for (const f of ['plain', 'brand']) if (arr(s, f, add, { min: 2, max: 4 })) s[f].forEach((t, i) => { if (!isStr(t)) add('error', `${f}[${i}]`, 'bad_item', `"${f}[${i}]" must be a short string.`); });
  icon(s, 'heroIcon', add);
  if (s.brandIcons !== undefined) { if (Array.isArray(s.brandIcons)) iconList(s.brandIcons, 'brandIcons', add); else add('error', 'brandIcons', 'bad_type', '"brandIcons" must be an array of icon names.'); }
}
export const graphic = () => true;

export function render(s, ctx) {
  const plainRows = (s.plain || []).map((t) => `<div class="site-row"><div class="site-ph"></div><div class="site-t" data-fit>${esc(t)}</div></div>`).join('');
  const plainBody = `<div class="site-nav"><i style="width:70px"></i><i style="width:60px"></i><i style="width:60px"></i></div><div class="site-hero"></div>${plainRows}`;
  const brandRows = (s.brand || []).map((t, i) => `<div class="site-row b">${ico(s.brandIcons?.[i] ?? 'Sparkles', 34, 'site-ico')}<div class="site-t" data-fit>${esc(t)}</div></div>`).join('');
  const brandBody = `<div class="site-hero b"><i class="o1"></i><i class="o2"></i>${ico(s.heroIcon ?? 'Sparkles', 92, 'hero-ico')}</div><div class="site-swatches"><i class="sw1"></i><i class="sw2"></i><i class="sw3"></i><i class="sw4"></i></div>${brandRows}`;
  return frame(ctx, `<div class="content sites-content" data-fit>
  ${block('title sites-title', rich(s.title))}
  <div class="sites">
    <div class="site plain">${appWindow(440, 560, plainBody)}<div class="site-tag"><span data-fit>${esc(s.plainTag)}</span></div></div>
    <div class="site brand">${appWindow(440, 560, brandBody, { cls: 'brand' })}<div class="site-tag hot"><span data-fit>${esc(s.brandTag)}</span></div></div>
  </div>
  ${block('body sites-body', rich(s.body))}
</div>`);
}
