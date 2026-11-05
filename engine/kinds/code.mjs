import { rich, block, kicker, reqStr, optStr, icon, arr, esc } from './_shared.mjs';
import { frame } from '../chrome.mjs';

export const kind = 'code';
export const fields = ['icon', 'kicker', 'title', 'lines', 'body'];
export const titleFields = ['title'];
const KINDS = ['cmd', 'out', 'ok', 'err'];
export function check(s, add) {
  reqStr(s, 'title', add); optStr(s, 'kicker', add); optStr(s, 'body', add); icon(s, 'icon', add);
  if (arr(s, 'lines', add, { min: 1, max: 7 })) s.lines.forEach((ln, i) => {
    if (!ln || typeof ln !== 'object' || typeof ln.t !== 'string') add('error', `lines[${i}]`, 'bad_item', `"lines[${i}]" must be {"t": "text", "k": "cmd|out|ok|err"}.`);
    else {
      if (ln.k !== undefined && !KINDS.includes(ln.k)) add('error', `lines[${i}].k`, 'bad_value', `"lines[${i}].k" must be one of cmd, out, ok, err.`);
      if (ln.t.length > 38) add('warning', `lines[${i}].t`, 'long_line', `"lines[${i}].t" is ${ln.t.length} characters; terminal lines over ~38 chars get cut.`);
    }
  });
}
export const graphic = () => true;

export function render(s, ctx) {
  const lines = Array.isArray(s.lines) ? s.lines : [];
  const body = lines.map((ln, i) => `<div class="code-ln ${KINDS.includes(ln.k) ? ln.k : 'cmd'}">${esc(ln.t)}${i === lines.length - 1 ? '<span class="cursor">_</span>' : ''}</div>`).join('');
  return frame(ctx, `<div class="content" data-fit>
  ${kicker(s)}
  ${block('title code-title', rich(s.title))}
  <div class="term"><div class="term-bar" dir="ltr"><i></i><i></i><i></i></div><div class="term-body" dir="ltr" data-fit>${body}</div></div>
  ${block('body code-body', rich(s.body))}
</div>`);
}
