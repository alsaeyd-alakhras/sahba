// #/factory[/<id>] — brief → Make (SSE) → slide grid → comments → revise / switch template → caption → history → approve & export.
import { t, pick, fmtDate, fmtDateTime, fmtNumber } from '../i18n.js';
import { api, fileUrl } from '../api.js';
import { store, settings, identity, refreshState } from '../store.js';
import { go, href } from '../router.js';
import { h, mount, clear, icon, button, claudeButton, claudeGate, card, chip, statusChip, field, input, textarea, select, emptyState, loading, errorBox, notice, toast, toastError, modal, confirmDialog, pageHeader, createRun, copyText } from '../ui.js';

// Comments per idea survive re-render (language switch, reload of data).
const COMMENTS = new Map(); // id -> { list: [{slide, text}], general: '' }
const comments = (id) => { if (!COMMENTS.has(id)) COMMENTS.set(id, { list: [], general: '' }); return COMMENTS.get(id); };

export async function render(root, ctx) {
  const id = ctx.route.params[0];
  if (!id) return renderPicker(root);
  return renderFactory(root, id);
}

/* ---------------- picker (no id) ---------------- */
async function renderPicker(root) {
  const slot = h('div', {}, loading());
  mount(root, pageHeader({ title: t('factory.title'), sub: t('factory.pickSub') }), slot);
  try {
    const r = await api.get('/api/ideas');
    const ideas = ((r && r.ideas) || []).filter((i) => i.status !== 'published');
    if (!ideas.length) {
      mount(slot, emptyState({ iconName: 'lightbulb', title: t('factory.pickEmpty'), body: t('factory.pickEmptyBody'), testid: 'factory-pick-empty',
        action: h('a', { class: 'btn btn--primary', href: href('ideas'), testid: 'factory-goto-ideas' }, t('nav.ideas')) }));
      return;
    }
    mount(slot, h('div', { class: 'grid-auto', testid: 'factory-pick' }, ideas.map((i) => {
      const c = card({
        class: 'card--interactive', testid: `factory-pick-${i.id}`,
        title: i.title, sub: i.pillar || null,
        body: h('div', { class: 'stack stack--sm' }, h('div', { class: 'row' }, statusChip(i.status)), i.hook ? h('p', { class: 'small muted clamp-2' }, i.hook) : null),
      });
      c.tabIndex = 0;
      c.addEventListener('click', () => go('factory', i.id));
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter') go('factory', i.id); });
      return c;
    })));
  } catch (err) { mount(slot, errorBox(err, () => renderPicker(root))); }
}

/* ---------------- factory ---------------- */
async function renderFactory(root, id) {
  let data = null;           // { idea, deck, preview, history }
  let templates = [];
  let bust = Date.now();
  let running = false;
  let exportResult = null;
  let captionDraft = null;
  const C = comments(id);
  const lockable = new Set();
  const lock = (b) => { lockable.add(b); b.disabled = b.disabled || running; return b; };
  const setRunning = (v) => {
    running = v;
    for (const b of lockable) {
      if (!b.isConnected) { lockable.delete(b); continue; }
      if (v) { b.dataset.forceDisabled = '1'; b.disabled = true; } else { delete b.dataset.forceDisabled; b.disabled = !!b.dataset.gated; }
    }
  };

  const enc = encodeURIComponent(id);
  const runSlot = h('div', { testid: 'factory-run-slot' });
  const body = h('div', { class: 'stack stack--lg' }, loading());
  mount(root, body);

  const load = async () => {
    try {
      const [d, tp] = await Promise.all([api.get(`/api/factory/${enc}`), templates.length ? templates : api.get('/api/templates').catch(() => [])]);
      data = d; templates = tp || [];
      draw();
    } catch (err) {
      if (err.status === 404) mount(body, emptyState({ iconName: 'alert', title: t('factory.notFound'), testid: 'factory-not-found', action: h('a', { class: 'btn btn--secondary', href: href('ideas'), testid: 'factory-back-ideas' }, t('nav.ideas')) }));
      else mount(body, errorBox(err, load));
    }
  };

  /* ---- runs ---- */
  const doRun = async ({ title, path, payload, phases, cancelKind, okMsg, onDone }) => {
    if (running) { toast(t('errors.busy'), 'warn'); return; }
    setRunning(true);
    const run = createRun({
      title, phases, cancelKind, testid: 'factory-run',
      onEvent: ({ event, data: d }) => {
        if (event === 'progress' && d && d.file) refreshThumb(d.file, d.n);
      },
    });
    mount(runSlot, run.el);
    run.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const result = await run.run(path, payload);
      bust = Date.now();
      if (okMsg) toast(okMsg, 'success');
      if (onDone) onDone(result);
    } catch (err) {
      /* error is shown inside the run panel */
    } finally {
      setRunning(false);
      await load();
      refreshState();
    }
  };

  const refreshThumb = (file, n) => {
    const img = body.querySelector(`[data-slide="${Number(n)}"] img`);
    if (img) img.src = slideSrc(file, Date.now());
  };

  const slideSrc = (file, b = bust) => (String(file).includes('/') ? fileUrl(file, b) : fileUrl(`preview/${id}/${file}`, b));
  const files = () => ((data && data.preview && data.preview.files) || []);
  const overflow = () => ((data && data.preview && data.preview.overflow) || []);
  const qaEnabled = () => settings().visualQA !== false;

  const make = () => {
    const notes = briefNotes ? briefNotes.value.trim() : '';
    return doRun({
      title: t('factory.making'), path: `/api/factory/${enc}/draft`, payload: notes ? { notes } : {},
      phases: ['claude', 'validate', 'render', ...(qaEnabled() ? ['qa'] : [])],
      okMsg: t('factory.made'),
    });
  };
  const revise = () => {
    if (!C.list.length && !C.general.trim()) { toast(t('factory.noComments'), 'warn'); return; }
    return doRun({
      title: t('factory.revising'), path: `/api/factory/${enc}/revise`,
      payload: { comments: C.list.map((c) => ({ slide: c.slide, text: c.text })), ...(C.general.trim() ? { general: C.general.trim() } : {}) },
      phases: ['claude', 'validate', 'render'],
      okMsg: t('factory.revised'),
      onDone: () => { C.list = []; C.general = ''; },
    });
  };
  const rerender = (template) => doRun({
    title: t('factory.rerendering'), path: `/api/factory/${enc}/rerender`, payload: template ? { template } : {},
    phases: ['render'], cancelKind: 'render', okMsg: t('factory.rerendered'),
  });
  const doExport = () => doRun({
    title: t('factory.exporting'), path: `/api/factory/${enc}/export`, payload: {},
    phases: ['render', 'export'], cancelKind: 'render', okMsg: t('factory.exported'),
    onDone: (r) => { exportResult = r || {}; },
  });

  /* ---- brief ---- */
  let briefNotes = null;
  const briefCard = () => {
    const idea = data.idea;
    const save = async (part) => {
      try { const upd = await api.patch(`/api/ideas/${enc}`, part); Object.assign(idea, upd || part); toast(t('common.saved'), 'success'); }
      catch (err) { toastError(err); }
    };
    const hook = textarea({ value: idea.hook || '', rows: 2, testid: 'factory-hook', placeholder: t('factory.hookPh'), onChange: (v) => save({ hook: v }) });
    const outline = textarea({ value: (idea.outline || []).join('\n'), testid: 'factory-outline', placeholder: t('factory.outlinePh'), onChange: (v) => save({ outline: v.split('\n').map((s) => s.trim()).filter(Boolean) }) });
    const defTpl = identity().template;
    const defName = pick((templates.find((x) => x.id === defTpl) || {}).name) || defTpl || '';
    const tplSel = select({
      testid: 'factory-template', value: idea.template || '', ariaLabel: t('factory.template'),
      options: [{ value: '', label: t('factory.templateDefault', { name: defName }) }, ...templates.map((x) => ({ value: x.id, label: pick(x.name) }))],
      onChange: (v) => save({ template: v || null }),
    });
    briefNotes = textarea({ rows: 2, testid: 'factory-notes', placeholder: t('factory.notesPh') });
    const hasDeck = !!data.deck;
    const makeBtn = lock(claudeButton({ label: hasDeck ? t('factory.remake') : t('factory.make'), iconName: 'factory', variant: hasDeck ? 'secondary' : 'primary', size: 'lg', testid: 'factory-make',
      onClick: async () => {
        if (hasDeck && !(await confirmDialog({ title: t('factory.remakeTitle'), message: t('factory.remakeBody'), confirmLabel: t('factory.remake'), testid: 'remake-confirm' }))) return;
        return make();
      } }));
    const content = h('div', { class: 'stack' },
      field({ label: t('factory.idea'), control: h('div', { class: 'stack stack--sm' }, h('strong', {}, idea.title), idea.note ? h('span', { class: 'small muted' }, idea.note) : null) }),
      field({ label: t('factory.hook'), hint: t('factory.hookHint'), control: hook }),
      field({ label: t('factory.outline'), hint: t('factory.outlineHint'), control: outline }),
      h('div', { class: 'grid-2' },
        field({ label: t('factory.template'), control: tplSel }),
        field({ label: t('factory.notes'), hint: t('factory.notesHint'), control: briefNotes })),
      h('div', { class: 'row' }, makeBtn, h('span', { class: 'field-hint' }, t('factory.makeHint', { n: settings().slidesDefault || 8 }))));
    if (!hasDeck) return card({ title: t('factory.brief'), iconName: 'lightbulb', testid: 'factory-brief', body: content });
    return h('details', { class: 'card disclosure', testid: 'factory-brief' },
      h('summary', { class: 'card-header', testid: 'factory-brief-toggle' },
        h('span', { class: 'card-title' }, icon('chevron', 'icon--sm'), t('factory.brief')),
        h('span', { class: 'card-sub' }, t('factory.briefCollapsed'))),
      h('div', { class: 'card-body' }, content));
  };

  /* ---- slides ---- */
  const commentCount = (n) => C.list.filter((c) => c.slide === n).length;
  const slidesCard = () => {
    const fs = files();
    const ov = overflow();
    const tplSwitch = select({ testid: 'factory-switch-template', size: 'sm', value: (data.deck && data.deck.template) || data.idea.template || identity().template || '', ariaLabel: t('factory.switchTemplate'),
      options: templates.map((x) => ({ value: x.id, label: pick(x.name) })) });
    const actions = [
      tplSwitch,
      lock(button({ label: t('factory.switchTemplate'), iconName: 'layers', size: 'sm', testid: 'factory-rerender-template', onClick: () => rerender(tplSwitch.value) })),
      lock(button({ iconName: 'refresh', size: 'sm', variant: 'ghost', ariaLabel: t('factory.rerender'), testid: 'factory-rerender', onClick: () => rerender() })),
    ];
    let content;
    if (!fs.length) {
      content = emptyState({ iconName: 'images', title: t('factory.noPreview'), body: t('factory.noPreviewBody'), testid: 'factory-no-preview',
        action: lock(button({ label: t('factory.renderNow'), iconName: 'images', testid: 'factory-render-now', onClick: () => rerender() })) });
    } else {
      content = h('div', { class: 'stack' },
        ov.length ? notice({ tone: 'warn', title: t('factory.overflowTitle'), body: h('ul', { class: 'small' }, ov.map((o) => h('li', {}, t('factory.overflowItem', { n: o.slide, text: o.text || '' })))), testid: 'factory-overflow' }) : null,
        h('div', { class: 'slide-grid', testid: 'factory-slides' }, fs.map((f, i) => {
          const n = i + 1;
          const cc = commentCount(n);
          const isOv = ov.some((o) => Number(o.slide) === n);
          const b = h('button', { type: 'button', class: ['slide-thumb', cc && 'has-comment'], dataset: { slide: String(n) }, testid: `slide-${n}`, 'aria-label': t('factory.openSlide', { n }) },
            h('img', { src: slideSrc(f), alt: t('factory.slideAlt', { n }), loading: 'lazy' }),
            h('span', { class: 'slide-num' }, fmtNumber(n)),
            h('span', { class: 'slide-badges' },
              cc ? chip({ label: String(cc), iconName: 'message', tone: 'info', title: t('factory.commentsOnSlide', { n: cc }) }) : null,
              isOv ? chip({ label: t('factory.overflow'), iconName: 'alert', tone: 'warn' }) : null));
          b.addEventListener('click', () => openSlide(i));
          return b;
        })),
        h('p', { class: 'field-hint' }, t('factory.slidesHint')));
    }
    return card({ title: t('factory.slides'), sub: fs.length ? t('factory.slidesCount', { n: fs.length }) : null, iconName: 'images', testid: 'factory-slides-card', actions, body: content });
  };

  const openSlide = (index) => {
    const fs = files();
    let i = index;
    const img = h('img', { alt: '' });
    const numEl = h('span', { class: 'chip chip--ink' });
    const listEl = h('ul', { class: 'comment-list', testid: 'slide-comments' });
    const ta = textarea({ rows: 3, testid: 'slide-comment-input', placeholder: t('factory.commentPh'), ariaLabel: t('factory.comment') });
    const paint = () => {
      const n = i + 1;
      img.src = slideSrc(fs[i]);
      img.alt = t('factory.slideAlt', { n });
      numEl.textContent = t('factory.slideOf', { n, total: fs.length });
      prev.disabled = i === 0; next.disabled = i === fs.length - 1;
      const mine = C.list.filter((c) => c.slide === n);
      mount(listEl, mine.length ? mine.map((c) => h('li', { class: 'comment-item' }, h('span', { class: 'comment-text', dir: 'auto' }, c.text),
        button({ iconName: 'x', size: 'sm', variant: 'ghost', ariaLabel: t('common.remove'), testid: 'slide-comment-remove', onClick: () => { C.list.splice(C.list.indexOf(c), 1); paint(); } }))) : h('li', { class: 'small muted' }, t('factory.noSlideComments')));
    };
    const addComment = (text) => {
      text = (text || '').trim();
      if (!text) return;
      C.list.push({ slide: i + 1, text });
      ta.value = '';
      paint();
      toast(t('factory.commentAdded'), 'success', 1800);
    };
    const prev = button({ iconName: 'chevronBack', ariaLabel: t('common.prev'), testid: 'slide-prev', onClick: () => { if (i > 0) { i -= 1; paint(); } } });
    const next = button({ iconName: 'chevron', ariaLabel: t('common.next'), testid: 'slide-next', onClick: () => { if (i < fs.length - 1) { i += 1; paint(); } } });
    const m = modal({
      title: t('factory.slideView'), size: 'lg', testid: 'slide-modal',
      body: h('div', { class: 'slide-large' },
        h('div', { class: 'slide-large-img', testid: 'slide-large' }, img),
        h('div', { class: 'stack' },
          h('div', { class: 'row row--between' }, numEl, h('div', { class: 'row' }, prev, next)),
          field({ label: t('factory.comment'), hint: t('factory.commentHint'), control: ta }),
          h('div', { class: 'row' },
            button({ label: t('factory.addComment'), iconName: 'message', variant: 'primary', size: 'sm', testid: 'slide-comment-add', onClick: () => addComment(ta.value) }),
            button({ label: t('factory.redoSlide'), iconName: 'refresh', size: 'sm', testid: 'slide-redo', onClick: () => addComment(t('factory.redoComment')) })),
          h('div', { class: 'field-label' }, t('factory.commentsHere')),
          listEl)),
      actions: [{ label: t('common.done'), variant: 'secondary', testid: 'slide-modal-done' }],
      onClose: () => draw(),
    });
    const onKey = (e) => {
      if (e.target === ta) return;
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) prev.click();
      if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next.click();
    };
    m.el.addEventListener('keydown', onKey);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment(ta.value); });
    paint();
    ta.focus();
  };

  /* ---- comments ---- */
  const commentsCard = () => {
    const general = textarea({ rows: 2, value: C.general, testid: 'factory-general-comment', placeholder: t('factory.generalPh'), onInput: (v) => { C.general = v; } });
    const list = C.list.length
      ? h('ul', { class: 'comment-list', testid: 'factory-comment-list' }, [...C.list].sort((a, b) => a.slide - b.slide).map((c) => h('li', { class: 'comment-item' },
        chip({ label: t('factory.slideN', { n: c.slide }), tone: 'info' }),
        h('span', { class: 'comment-text', dir: 'auto' }, c.text),
        button({ iconName: 'x', size: 'sm', variant: 'ghost', ariaLabel: t('common.remove'), testid: `factory-comment-remove-${c.slide}`, onClick: () => { C.list.splice(C.list.indexOf(c), 1); draw(); } }))))
      : h('p', { class: 'small muted', testid: 'factory-no-comments' }, t('factory.commentsEmpty'));
    return card({
      title: t('factory.comments'), iconName: 'message', testid: 'factory-comments-card',
      sub: C.list.length ? t('factory.commentsCount', { n: C.list.length }) : null,
      body: h('div', { class: 'stack' }, list, field({ label: t('factory.general'), control: general }),
        h('div', { class: 'row' }, lock(claudeButton({ label: t('factory.apply'), iconName: 'send', variant: 'primary', testid: 'factory-apply', onClick: revise })))),
    });
  };

  /* ---- caption ---- */
  const captionCard = () => {
    const cap = (data.deck && data.deck.caption) || '';
    const counter = h('span', { class: 'counter', testid: 'caption-count' });
    const ta = textarea({ value: captionDraft ?? cap, tall: true, testid: 'factory-caption', onInput: (v) => { captionDraft = v; counter.textContent = t('factory.chars', { n: fmtNumber(v.length) }); } });
    counter.textContent = t('factory.chars', { n: fmtNumber(ta.value.length) });
    return card({
      title: t('factory.caption'), iconName: 'edit', testid: 'factory-caption-card', actions: counter,
      body: ta,
      foot: [
        button({ label: t('factory.copyCaption'), iconName: 'copy', size: 'sm', variant: 'ghost', testid: 'factory-caption-copy', onClick: () => copyText(ta.value) }),
        lock(button({ label: t('common.save'), size: 'sm', variant: 'secondary', testid: 'factory-caption-save', onClick: async () => {
          try { const deck = await api.put(`/api/factory/${enc}/deck`, { caption: ta.value }); if (deck) data.deck = deck; else data.deck.caption = ta.value; captionDraft = null; toast(t('factory.captionSaved'), 'success'); }
          catch (err) { toastError(err); }
        } })),
      ],
    });
  };

  /* ---- history ---- */
  const historyCard = () => {
    const hist = (data.history || []).slice().sort((a, b) => String(b.date || b.version).localeCompare(String(a.date || a.version)));
    return card({
      title: t('factory.history'), iconName: 'history', testid: 'factory-history-card',
      body: hist.length ? h('ul', { class: 'history-list' }, hist.map((v, i) => h('li', { class: 'history-item', testid: `history-${i}` },
        h('span', {}, fmtDateTime(v.date || v.version)),
        lock(button({ label: t('factory.restore'), size: 'sm', variant: 'ghost', testid: `history-restore-${i}`, onClick: async () => {
          const ok = await confirmDialog({ title: t('factory.restoreTitle'), message: t('factory.restoreBody', { date: fmtDateTime(v.date || v.version) }), confirmLabel: t('factory.restore'), testid: 'restore-confirm' });
          if (!ok) return;
          try {
            await api.post(`/api/factory/${enc}/restore`, { version: v.version });
            toast(t('factory.restored'), 'success');
            await rerender();
          } catch (err) { toastError(err); }
        } })))))
        : h('p', { class: 'small muted', testid: 'factory-history-empty' }, t('factory.historyEmpty')),
    });
  };

  /* ---- export ---- */
  const exportCard = () => {
    const idea = data.idea;
    const dir = (exportResult && (exportResult.dir || exportResult.exported || exportResult.path)) || idea.exported;
    const caption = () => (data.deck && data.deck.caption) || '';
    const done = !!dir && (idea.status === 'exported' || idea.status === 'published' || exportResult);
    const exportBtn = lock(button({ label: done ? t('factory.reexport') : t('factory.approveExport'), iconName: 'check', variant: done ? 'secondary' : 'primary', size: 'lg', block: true, testid: 'factory-export',
      onClick: async () => {
        if (!(await confirmDialog({ title: t('factory.exportTitle'), message: t('factory.exportBody'), confirmLabel: t('factory.approveExport'), testid: 'export-confirm' }))) return;
        return doExport();
      } }));
    return card({
      title: t('factory.export'), iconName: 'folder', testid: 'factory-export-card', class: done ? 'card--accent' : null,
      body: h('div', { class: 'stack' },
        done ? h('div', { class: 'stack stack--sm', testid: 'factory-export-done' },
          notice({ tone: 'success', title: t('factory.exportedTitle'), body: t('factory.exportedBody') }),
          h('div', { class: 'field-label' }, t('factory.exportFolder')),
          h('div', { class: 'path-box', testid: 'factory-export-path' }, icon('folder', 'icon--sm'), h('span', {}, `workspace/${String(dir).replace(/^workspace[\\/]/, '')}`)),
          h('div', { class: 'row' },
            button({ label: t('factory.openFolder'), iconName: 'external', size: 'sm', testid: 'factory-open-folder', onClick: async () => { try { await api.post(`/api/factory/${enc}/open`, {}); } catch (err) { toastError(err); } } }),
            button({ label: t('factory.copyCaption'), iconName: 'copy', size: 'sm', testid: 'factory-copy-caption', onClick: () => copyText(caption()) })))
          : h('p', { class: 'small muted' }, t('factory.exportHint')),
        exportBtn),
    });
  };

  /* ---- draw ---- */
  const draw = () => {
    if (!data) return;
    const idea = data.idea;
    const hasPreview = files().length > 0;
    const stale = idea.status === 'drafting' && !running;
    mount(body,
      pageHeader({
        eyebrow: t('factory.title'), title: idea.title,
        sub: h('span', { class: 'row' }, statusChip(idea.status, 'factory-status'), idea.pillar ? chip({ label: idea.pillar, tone: 'outline' }) : null,
          h('span', { class: 'small muted' }, t('factory.updated', { date: fmtDate(idea.updated || idea.created) }))),
        actions: [h('a', { class: 'btn btn--ghost', href: href('ideas'), testid: 'factory-back' }, icon('chevronBack', 'icon--flip'), t('factory.backToIdeas'))],
      }),
      claudeGate(),
      stale ? notice({ tone: 'info', title: t('factory.draftingElsewhere'), body: t('factory.draftingElsewhereBody'), testid: 'factory-drafting',
        action: button({ label: t('common.refresh'), size: 'sm', iconName: 'refresh', testid: 'factory-refresh', onClick: load }) }) : null,
      briefCard(),
      runSlot,
      data.deck || hasPreview
        ? h('div', { class: 'split' },
          h('div', { class: 'stack stack--lg' }, slidesCard(), commentsCard()),
          h('div', { class: 'stack stack--lg' }, exportCard(), captionCard(), historyCard()))
        : null);
    if (running) setRunning(true);
  };

  load();
}
