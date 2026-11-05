// #/ideas — idea bank: quick add, filters, drag reorder, status chips, Suggest (SSE), Polish (SSE), publish, delete.
import { t, fmtDate, todayISO } from '../i18n.js';
import { api } from '../api.js';
import { refreshState } from '../store.js';
import { go } from '../router.js';
import { h, mount, icon, button, claudeButton, claudeGate, card, chip, statusChip, field, input, textarea, select, emptyState, loading, errorBox, toast, toastError, modal, confirmDialog, pageHeader, createRun } from '../ui.js';

const STATUSES = ['raw', 'ready', 'drafting', 'preview', 'approved', 'exported', 'published'];

// Filters survive re-render (e.g. language switch).
const F = { status: '', pillar: '' };

export async function render(root) {
  let ideas = [];
  let dragId = null;
  const runSlot = h('div');
  const tableSlot = h('div', { testid: 'ideas-table-slot' }, loading());
  const filtersSlot = h('div', { class: 'toolbar', testid: 'ideas-filters' });

  const load = async () => {
    try {
      const r = await api.get('/api/ideas');
      ideas = (r && r.ideas) || [];
      draw();
    } catch (err) { mount(tableSlot, errorBox(err, load)); }
  };

  const filtered = () => ideas.filter((i) => (!F.status || i.status === F.status) && (!F.pillar || (i.pillar || '') === F.pillar));
  const pillars = () => [...new Set(ideas.map((i) => i.pillar).filter(Boolean))].sort();

  /* ---- runs ---- */
  let running = false;
  const runSse = async (title, path, body, okMsg) => {
    if (running) { toast(t('errors.busy'), 'warn'); return; }
    running = true;
    const run = createRun({ title, phases: ['claude'], testid: 'ideas-run', cancelKind: 'claude' });
    mount(runSlot, run.el);
    try {
      await run.run(path, body);
      toast(okMsg, 'success');
      await load();
      refreshState();
    } catch (err) { /* error is shown inside the run panel */ await load(); }
    finally { running = false; }
  };

  /* ---- actions ---- */
  const add = async (title, el) => {
    title = title.trim();
    if (!title) return;
    try {
      const idea = await api.post('/api/ideas', { title, ...(F.pillar ? { pillar: F.pillar } : {}) });
      el.value = '';
      if (idea && idea.id) ideas.unshift(idea); else await load();
      draw();
      refreshState();
      toast(t('ideas.added'), 'success');
    } catch (err) { toastError(err); }
  };

  const patch = async (idea, part) => {
    const upd = await api.patch(`/api/ideas/${encodeURIComponent(idea.id)}`, part);
    Object.assign(idea, upd || part);
    draw();
  };

  const edit = (idea) => {
    const ti = input({ value: idea.title, testid: 'idea-edit-title' });
    const no = textarea({ value: idea.note || '', testid: 'idea-edit-note' });
    const pi = input({ value: idea.pillar || '', testid: 'idea-edit-pillar', placeholder: t('ideas.pillarPh') });
    const list = h('datalist', { id: 'pillar-list' }, pillars().map((p) => h('option', { value: p })));
    pi.setAttribute('list', 'pillar-list');
    modal({
      title: t('ideas.editTitle'), testid: 'idea-edit',
      body: [field({ label: t('ideas.col.title'), control: ti }), field({ label: t('ideas.note'), control: no }), field({ label: t('ideas.col.pillar'), control: pi }), list],
      actions: [
        { label: t('common.cancel'), variant: 'ghost', testid: 'idea-edit-cancel' },
        { label: t('common.save'), variant: 'primary', testid: 'idea-edit-save', onClick: async () => {
          if (!ti.value.trim()) { toast(t('ideas.titleRequired'), 'warn'); return false; }
          try { await patch(idea, { title: ti.value.trim(), note: no.value, pillar: pi.value.trim() }); toast(t('common.saved'), 'success'); }
          catch (err) { toastError(err); return false; }
        } },
      ],
    });
  };

  const publish = (idea) => {
    const url = input({ type: 'url', dir: 'ltr', placeholder: t('ideas.publishUrlPh'), testid: 'publish-url', value: (idea.published && idea.published.url) || '' });
    const date = input({ type: 'date', value: (idea.published && idea.published.date) || todayISO(), testid: 'publish-date' });
    modal({
      title: t('ideas.publishTitle'), testid: 'publish',
      body: [h('p', { class: 'muted' }, t('ideas.publishBody')), field({ label: t('ideas.publishUrl'), control: url }), field({ label: t('ideas.publishDate'), control: date })],
      actions: [
        { label: t('common.cancel'), variant: 'ghost', testid: 'publish-cancel' },
        { label: t('ideas.markPublished'), variant: 'primary', testid: 'publish-save', onClick: async () => {
          try { await patch(idea, { status: 'published', published: { date: date.value || todayISO(), url: url.value.trim() } }); toast(t('ideas.published'), 'success'); }
          catch (err) { toastError(err); return false; }
        } },
      ],
    });
  };

  const remove = async (idea) => {
    const ok = await confirmDialog({ title: t('ideas.deleteTitle'), message: t('ideas.deleteBody', { title: idea.title }), confirmLabel: t('common.delete'), danger: true, testid: 'idea-delete-confirm' });
    if (!ok) return;
    try {
      await api.del(`/api/ideas/${encodeURIComponent(idea.id)}`);
      ideas = ideas.filter((i) => i.id !== idea.id);
      draw(); refreshState();
      toast(t('ideas.deleted'), 'success');
    } catch (err) { toastError(err); }
  };

  const reorder = async (fromId, toId, after) => {
    const ids = ideas.map((i) => i.id);
    const from = ids.indexOf(fromId);
    if (from < 0 || fromId === toId) return;
    ids.splice(from, 1);
    let to = ids.indexOf(toId);
    if (after) to += 1;
    ids.splice(to, 0, fromId);
    const prev = ideas;
    ideas = ids.map((id) => prev.find((i) => i.id === id));
    draw();
    try { await api.post('/api/ideas/reorder', { ids }); }
    catch (err) { ideas = prev; draw(); toastError(err); }
  };

  /* ---- render ---- */
  const drawFilters = () => {
    const statusChips = ['', ...STATUSES].map((s) => {
      const count = s ? ideas.filter((i) => i.status === s).length : ideas.length;
      const b = h('button', { type: 'button', class: 'chip chip--outline', 'aria-pressed': String(F.status === s), testid: `filter-status-${s || 'all'}` },
        s ? t(`status.${s}`) : t('ideas.filterAll'), h('span', { class: 'counter' }, String(count)));
      b.addEventListener('click', () => { F.status = s; draw(); });
      return b;
    });
    const ps = pillars();
    if (F.pillar && !ps.includes(F.pillar)) F.pillar = '';
    mount(filtersSlot,
      h('div', { class: 'row grow', role: 'group', 'aria-label': t('ideas.filterStatus') }, statusChips),
      ps.length ? select({ testid: 'filter-pillar', size: 'sm', value: F.pillar, ariaLabel: t('ideas.filterPillar'),
        options: [{ value: '', label: t('ideas.allPillars') }, ...ps.map((p) => ({ value: p, label: p }))],
        onChange: (v) => { F.pillar = v; draw(); } }) : null);
  };

  const row = (idea, canDrag) => {
    const handle = h('span', { class: 'drag-handle', 'aria-disabled': String(!canDrag), title: canDrag ? t('ideas.dragHint') : t('ideas.dragDisabled'), testid: `idea-drag-${idea.id}` }, icon('grip'));
    const tr = h('tr', { testid: `idea-row-${idea.id}`, dataset: { id: idea.id } },
      h('td', { class: 'col-handle' }, handle),
      h('td', {},
        h('div', { class: 'stack stack--sm' },
          h('a', { class: 'idea-title', dir: 'auto', href: `#/factory/${encodeURIComponent(idea.id)}`, testid: `idea-open-title-${idea.id}` }, idea.title),
          idea.hook ? h('div', { class: 'idea-note clamp-2', dir: 'auto' }, h('strong', {}, t('ideas.hook')), ' ', idea.hook) : idea.note ? h('div', { class: 'idea-note clamp-2', dir: 'auto' }, idea.note) : null)),
      h('td', {}, idea.pillar ? chip({ label: idea.pillar, tone: 'outline' }) : h('span', { class: 'muted' }, t('common.dash'))),
      h('td', {}, h('div', { class: 'row' }, statusChip(idea.status, `idea-status-${idea.id}`),
        idea.source === 'claude' ? chip({ label: t('ideas.fromClaude'), iconName: 'wand', tone: 'violet' }) : null)),
      h('td', { class: 'nowrap small muted' }, fmtDate(idea.updated || idea.created)),
      h('td', { class: 'col-actions' }, h('div', { class: 'row row--end' },
        claudeButton({ iconName: 'wand', size: 'sm', variant: 'ghost', ariaLabel: t('ideas.polish'), testid: `idea-polish-${idea.id}`,
          onClick: () => runSse(t('ideas.polishing', { title: idea.title }), `/api/ideas/${encodeURIComponent(idea.id)}/polish`, {}, t('ideas.polished')) }),
        button({ iconName: 'factory', size: 'sm', variant: 'ghost', ariaLabel: t('ideas.openFactory'), testid: `idea-open-${idea.id}`, onClick: () => go('factory', idea.id) }),
        button({ iconName: 'edit', size: 'sm', variant: 'ghost', ariaLabel: t('common.edit'), testid: `idea-edit-${idea.id}`, onClick: () => edit(idea) }),
        idea.status === 'exported' || idea.status === 'published'
          ? button({ iconName: 'link', size: 'sm', variant: 'ghost', ariaLabel: t('ideas.markPublished'), testid: `idea-publish-${idea.id}`, onClick: () => publish(idea) })
          : null,
        idea.published && idea.published.url ? h('a', { class: 'btn btn--ghost btn--sm btn--icon', href: idea.published.url, target: '_blank', rel: 'noopener noreferrer', title: t('ideas.viewPost'), 'aria-label': t('ideas.viewPost'), testid: `idea-post-${idea.id}` }, icon('external')) : null,
        button({ iconName: 'trash', size: 'sm', variant: 'ghost', ariaLabel: t('common.delete'), testid: `idea-delete-${idea.id}`, onClick: () => remove(idea) }))));

    if (canDrag) {
      handle.addEventListener('pointerdown', () => { tr.draggable = true; });
      tr.addEventListener('dragstart', (e) => { dragId = idea.id; tr.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', idea.id); });
      tr.addEventListener('dragend', () => { tr.draggable = false; tr.classList.remove('is-dragging'); dragId = null; tableSlot.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); });
      tr.addEventListener('dragover', (e) => {
        if (!dragId || dragId === idea.id) return;
        e.preventDefault();
        const r = tr.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        tr.classList.toggle('drop-after', after); tr.classList.toggle('drop-before', !after);
      });
      tr.addEventListener('dragleave', () => tr.classList.remove('drop-before', 'drop-after'));
      tr.addEventListener('drop', (e) => {
        e.preventDefault();
        const after = tr.classList.contains('drop-after');
        tr.classList.remove('drop-before', 'drop-after');
        if (dragId) reorder(dragId, idea.id, after);
      });
    }
    return tr;
  };

  const draw = () => {
    drawFilters();
    if (!ideas.length) {
      mount(tableSlot, emptyState({ iconName: 'lightbulb', title: t('ideas.emptyTitle'), body: t('ideas.emptyBody'), testid: 'ideas-empty' }));
      return;
    }
    const list = filtered();
    if (!list.length) {
      mount(tableSlot, emptyState({ iconName: 'lightbulb', title: t('ideas.noMatch'), testid: 'ideas-no-match',
        action: button({ label: t('ideas.clearFilters'), size: 'sm', testid: 'ideas-clear-filters', onClick: () => { F.status = ''; F.pillar = ''; draw(); } }) }));
      return;
    }
    const canDrag = !F.status && !F.pillar;
    mount(tableSlot, h('div', { class: 'table-wrap' }, h('table', { class: 'table', testid: 'ideas-table' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'col-handle' }, h('span', { class: 'sr-only' }, t('ideas.col.order'))),
        h('th', {}, t('ideas.col.title')), h('th', {}, t('ideas.col.pillar')), h('th', {}, t('ideas.col.status')),
        h('th', {}, t('ideas.col.updated')), h('th', { class: 'col-actions' }, t('ideas.col.actions')))),
      h('tbody', {}, list.map((i) => row(i, canDrag))))),
    !canDrag ? h('p', { class: 'field-hint' }, t('ideas.dragDisabled')) : null);
  };

  const quick = input({ testid: 'idea-quick-add', size: 'lg', placeholder: t('ideas.quickPh'), ariaLabel: t('ideas.add'), onEnter: (v, el) => add(v, el) });
  const suggestBtn = claudeButton({ label: t('ideas.suggest'), iconName: 'wand', variant: 'primary', testid: 'ideas-suggest',
    onClick: () => runSse(t('ideas.suggesting'), '/api/ideas/suggest', { count: 10 }, t('ideas.suggested')) });

  mount(root,
    pageHeader({ title: t('ideas.title'), sub: t('ideas.sub'), actions: [suggestBtn] }),
    h('div', { class: 'stack stack--lg' },
      claudeGate(),
      runSlot,
      h('div', { class: 'input-group' }, quick, button({ label: t('ideas.add'), iconName: 'plus', variant: 'ink', size: 'lg', testid: 'idea-add', onClick: () => add(quick.value, quick) })),
      card({ testid: 'ideas-card', flush: true, title: t('ideas.bank'), body: [filtersSlot, tableSlot] })));
  load();
}
