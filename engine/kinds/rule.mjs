import { rich, block, reqStr, optStr, icon, arr, tile, isStr } from './_shared.mjs';
import { frame } from '../chrome.mjs';
import { iconExists } from '../util.mjs';

export const kind = 'rule';
export const fields = ['icon', 'kicker', 'quote', 'flow', 'source'];
export const titleFields = [];
export function check(s, add) {
  reqStr(s, 'quote', add, 'the rule sentence'); optStr(s, 'kicker', add); optStr(s, 'source', add); icon(s, 'icon', add);
  if (arr(s, 'flow', add, { min: 1, max: 3 })) s.flow.forEach((st, i) => {
    if (!st || typeof st !== 'object' || !isStr(st.t) || !isStr(st.icon)) add('error', `flow[${i}]`, 'bad_item', `"flow[${i}]" must be {"icon": "Name", "t": "one word"}.`);
    else if (!iconExists(st.icon)) add('error', `flow[${i}].icon`, 'unknown_icon', `Unknown icon "${st.icon}" in "flow[${i}].icon".`);
  });
}
export const graphic = () => true;

const ARROW = '<svg class="flow-arrow" width="150" height="40" viewBox="0 0 150 40" aria-hidden="true"><path d="M140 20H12M30 6L12 20l18 14"/></svg>';
export function render(s, ctx) {
  const flow = (s.flow || []).map((st, i) => `${i ? ARROW : ''}<div class="flow-step${i === 0 ? ' hot' : ''}">${tile(st.icon, i === 0 ? 200 : 170, i === 0 ? -6 : 5, i !== 0)}<span class="flow-t" data-fit>${rich(st.t)}</span></div>`).join('');
  return frame(ctx, `<div class="content" data-fit>
  <div class="rule-head">${tile(s.icon ?? 'BadgeCheck', 96, -6)}<span class="rule-k" data-fit>${rich(s.kicker ?? ctx.str.rule)}</span></div>
  ${block('rule-q', rich(s.quote))}
  <div class="flow">${flow}</div>
  ${block('body rule-src', rich(s.source))}
</div>`);
}
