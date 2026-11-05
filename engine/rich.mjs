// Mini markup -> HTML.  {b}x{/b} accent text · {c}x{/c} hand-drawn circle · {l}x{/l} bold accent label ·
// {m}x{/m} highlighter marker · <br> line break.  Everything else is HTML-escaped.
import { esc } from './util.mjs';

export const CIRCLE_PATH = 'M 292 68 C 293 104 228 127 150 126 C 71 125 7 103 8 69 C 9 35 72 13 150 14 C 214 15 271 29 287 51';
const RE = /(\{b\}[\s\S]*?\{\/b\}|\{c\}[\s\S]*?\{\/c\}|\{l\}[\s\S]*?\{\/l\}|\{m\}[\s\S]*?\{\/m\}|<br\s*\/?>)/gi;

export function circled(innerHtml) {
  return `<span class="rc">${innerHtml}<svg class="rc-svg" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true"><path d="${CIRCLE_PATH}"/></svg></span>`;
}

export function rich(text) {
  if (text === undefined || text === null || text === false || text === true) return '';
  const out = [];
  for (const part of String(text).split(RE)) {
    if (!part) continue;
    const tag = part.slice(0, 3);
    const inner = () => rich(part.slice(3, -4));
    if (tag === '{b}' && part.endsWith('{/b}')) out.push(`<span class="rb">${inner()}</span>`);
    else if (tag === '{c}' && part.endsWith('{/c}')) out.push(circled(inner()));
    else if (tag === '{l}' && part.endsWith('{/l}')) out.push(`<b class="rl">${inner()}</b>`);
    else if (tag === '{m}' && part.endsWith('{/m}')) out.push(`<span class="rm">${inner()}</span>`);
    else if (/^<br/i.test(part)) out.push('<br>');
    else out.push(esc(part));
  }
  return out.join('');
}

/** plain text (markup removed) — for word counts and messages */
export const plain = (text) => String(text ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/\{\/?[bclm]\}/g, '').replace(/\s+/g, ' ').trim();
