// deck + identity + template -> one self-contained HTML document per slide (1080×1350).
import { KINDS } from './kinds/index.mjs';
import { baseCss, loadTemplate, fontById, fonts, fontFaceCss, esc, str } from './util.mjs';

const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** CSS for template tokens: { bg: "#..", accentDark: ".." } -> --bg, --accent-dark */
function tokenCss(tokens = {}) {
  const out = [];
  for (const [k, v] of Object.entries(tokens)) {
    if (k === 'font' || v === null || typeof v === 'object') continue;
    out.push(`--${kebab(k)}:${String(v).replace(/[;{}<>]/g, '')}`);
  }
  return out.length ? `:root{${out.join(';')}}` : '';
}

function identityCss(identity = {}) {
  const a = typeof identity.accent === 'string' && HEX.test(identity.accent.trim()) ? identity.accent.trim() : null;
  if (!a) return '';
  return `:root{--accent:${a};--accent-dark:color-mix(in srgb, ${a} 80%, #000);--accent-light:color-mix(in srgb, ${a} 72%, #fff)}`;
}

export function resolveFont(identity = {}, tpl = {}) {
  return fontById(identity.font) || fontById(tpl.tokens?.font) || fontById('cairo') || fonts()[0];
}

/**
 * @param {{deck:object, index:number, identity?:object, template?:string|object, assetBase:string, photoUrl?:string}} p
 * index 0-based · assetBase = URL of engine/ ending with "/" · returns a full HTML document
 */
export function buildSlideHtml({ deck, index, identity = {}, template, assetBase = './', photoUrl = null }) {
  if (!deck || !Array.isArray(deck.slides)) throw new Error('buildSlideHtml: deck.slides missing');
  const s = deck.slides[index];
  if (!s) throw new Error(`buildSlideHtml: no slide at index ${index}`);
  const K = KINDS[s.kind];
  if (!K) throw new Error(`buildSlideHtml: unknown kind "${s.kind}" at slide ${index + 1}`);
  if (!assetBase.endsWith('/')) assetBase += '/';
  const tpl = loadTemplate(template || deck.template || identity.template || 'editorial');
  const font = resolveFont(identity, tpl);
  const lang = deck.lang === 'en' ? 'en' : 'ar';
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const ctx = { n: index + 1, total: deck.slides.length, category: deck.category || '', identity, photoUrl, dir, lang, str: str(lang), kind: s.kind, template: tpl.id };
  const body = K.render(s, ctx);
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1080">
<title>${esc(deck.slug || 'slide')} ${index + 1}</title>
<style>
${fontFaceCss(font, assetBase)}
${baseCss()}
${tokenCss(tpl.tokens)}
:root{--font:'${font.family}',system-ui,sans-serif}
</style>
<style data-template="${esc(tpl.id)}">
${tpl.css || ''}
</style>
<style>${identityCss(identity)}</style>
</head>
<body class="tpl-${esc(tpl.id)}">
${body}
</body>
</html>`;
}
