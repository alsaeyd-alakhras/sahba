// #/log — recent runs from runs.jsonl (support / troubleshooting).
import { t, fmtDateTime, fmtDuration } from '../i18n.js';
import { api } from '../api.js';
import { h, mount, button, chip, card, emptyState, loading, errorBox, select, pageHeader, copyText } from '../ui.js';

const pickField = (o, ...keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return null; };

export async function render(root) {
  let limit = 100;
  let rows = [];
  const slot = h('div', {}, loading());
  const load = async () => {
    mount(slot, loading());
    try {
      const r = await api.get(`/api/log?limit=${limit}`);
      rows = Array.isArray(r) ? r : (r && (r.entries || r.lines || r.runs || r.log)) || [];
      rows = rows.map((x) => { if (typeof x === 'string') { try { return JSON.parse(x); } catch { return { raw: x }; } } return x; });
      draw();
    } catch (err) { mount(slot, errorBox(err, load)); }
  };
  const draw = () => {
    if (!rows.length) { mount(slot, emptyState({ iconName: 'list', title: t('log.emptyTitle'), body: t('log.emptyBody'), testid: 'log-empty' })); return; }
    const list = rows.slice().reverse();
    mount(slot, h('div', { class: 'table-wrap' }, h('table', { class: 'table', testid: 'log-table' },
      h('thead', {}, h('tr', {}, ['time', 'task', 'idea', 'duration', 'result', 'details'].map((k) => h('th', {}, t(`log.col.${k}`))))),
      h('tbody', {}, list.map((r, i) => {
        const ok = pickField(r, 'ok', 'success');
        const err = pickField(r, 'error', 'err', 'msg');
        const result = pickField(r, 'result', 'status');
        const tone = ok === true || result === 'ok' || result === 'done' ? 'success' : ok === false || err ? 'danger' : '';
        const label = ok === true ? t('log.ok') : ok === false ? t('log.failed') : (result != null ? String(result) : err ? t('log.failed') : t('common.dash'));
        return h('tr', { testid: `log-row-${i}` },
          h('td', { class: 'nowrap small' }, fmtDateTime(pickField(r, 'ts', 'time', 'date', 'at', 'started')) || t('common.dash')),
          h('td', {}, String(pickField(r, 'task', 'kind', 'type', 'op') || t('common.dash'))),
          h('td', { class: 'mono ltr' }, String(pickField(r, 'id', 'ideaId', 'idea') || t('common.dash'))),
          h('td', { class: 'nowrap small' }, pickField(r, 'ms', 'durationMs', 'duration') != null ? fmtDuration(pickField(r, 'ms', 'durationMs', 'duration')) : t('common.dash')),
          h('td', {}, h('div', { class: 'stack stack--sm' }, chip({ label, tone }), err && typeof err === 'string' ? h('span', { class: 'small muted clamp-2' }, err) : null)),
          h('td', {}, h('details', { class: 'disclosure' },
            h('summary', { testid: `log-details-${i}` }, t('log.json')),
            h('pre', { class: 'stream-text ltr mono' }, JSON.stringify(r, null, 2)))));
      })))));
  };

  mount(root,
    pageHeader({
      title: t('log.title'), sub: t('log.sub'),
      actions: [
        select({ testid: 'log-limit', size: 'sm', value: String(limit), ariaLabel: t('log.limit'), options: [50, 100, 300].map((n) => ({ value: String(n), label: t('log.last', { n }) })), onChange: (v) => { limit = Number(v); load(); } }),
        button({ label: t('common.refresh'), iconName: 'refresh', size: 'sm', testid: 'log-refresh', onClick: load }),
        button({ label: t('log.copy'), iconName: 'copy', size: 'sm', variant: 'ghost', testid: 'log-copy', onClick: () => copyText(rows.map((r) => JSON.stringify(r)).join('\n')) }),
      ],
    }),
    card({ testid: 'log-card', flush: true, body: slot }));
  load();
}
