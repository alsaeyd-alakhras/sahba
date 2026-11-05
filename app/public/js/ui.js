// Shared UI components. All text comes from i18n; every interactive element gets a data-testid.
import { t, fmtDuration } from './i18n.js';
import { icon } from './icons.js';
import { api, ApiError } from './api.js';
import { store, subscribe, claudeReady, claudeStatus, runStarted, runEnded, refreshState } from './store.js';

/* ---------------- DOM helper ---------------- */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'testid') el.dataset.testid = v;
    else if (k === 'on') { for (const [ev, fn] of Object.entries(v)) if (fn) el.addEventListener(ev, fn); }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') { for (const [p, val] of Object.entries(v)) if (val != null) el.style.setProperty(p, val); }
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open' || k === 'multiple' || k === 'draggable') el[k] = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}

export function append(el, ...kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }
export function mount(el, ...kids) { clear(el); return append(el, kids); }

export { icon };

/* ---------------- button ---------------- */
export function button({ label, iconName, variant = 'secondary', size, testid, onClick, disabled, title, type = 'button', block, iconAfter, ariaLabel } = {}) {
  const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, !label && 'btn--icon', block && 'btn--block'];
  const b = h('button', { class: cls, type, testid, disabled, title: title || (!label ? ariaLabel : null), 'aria-label': ariaLabel || null },
    iconName && !iconAfter ? icon(iconName) : null,
    label ? h('span', {}, label) : null,
    iconName && iconAfter ? icon(iconName, 'icon--flip') : null);
  if (onClick) {
    b.addEventListener('click', async (e) => {
      if (b.dataset.pending) return;
      const r = onClick(e);
      if (r && typeof r.then === 'function') {
        b.dataset.pending = '1';
        const wasDisabled = b.disabled;
        b.disabled = true;
        try { await r; } finally { delete b.dataset.pending; if (b.isConnected) b.disabled = wasDisabled || !!b.dataset.gated; }
      }
    });
  }
  return b;
}

/** Button that requires a connected Claude. Disabled with explanation when Claude is unavailable or busy. */
const gated = new Set();
export function claudeButton(opts) {
  const b = button(opts);
  b.dataset.claude = '1';
  gated.add(b);
  updateGate(b);
  return b;
}
function updateGate(b) {
  const ready = claudeReady();
  const busy = !!(store.state && store.state.busy && store.state.busy.claude) || store.localKind === 'claude';
  const off = !ready || busy;
  if (off) b.dataset.gated = '1'; else delete b.dataset.gated;
  if (!b.dataset.pending) b.disabled = off || b.dataset.forceDisabled === '1';
  b.title = !ready ? t('claude.disabledHint') : busy ? t('errors.busy') : (b.getAttribute('aria-label') || '');
}
subscribe(() => { for (const b of gated) { if (!b.isConnected) { gated.delete(b); continue; } updateGate(b); } });

/** Banner explaining that Claude is not connected, with a link to settings. Returns null when ready. */
export function claudeGate() {
  const box = h('div', { testid: 'claude-gate' });
  const render = () => {
    const st = claudeStatus();
    if (st === 'ok' || st === 'unknown') { clear(box); box.hidden = true; return; }
    box.hidden = false;
    mount(box, notice({
      tone: 'warn',
      title: t(`claude.gate.${st}`),
      body: t('claude.gate.body'),
      action: h('a', { href: '#/settings/claude', class: 'btn btn--sm btn--secondary', testid: 'claude-gate-link' }, t('claude.gate.link')),
    }));
  };
  render();
  const off = subscribe(() => { if (!box.isConnected) { off(); return; } render(); });
  return box;
}

/* ---------------- fields ---------------- */
let fieldSeq = 0;
export function field({ label, hint, control, testid, class: cls }) {
  const id = control.id || `f${++fieldSeq}`;
  control.id = id;
  return h('div', { class: ['field', cls], testid },
    label ? h('label', { class: 'field-label', for: id }, label) : null,
    control,
    hint ? h('div', { class: 'field-hint' }, hint) : null);
}

export function input({ testid, value = '', placeholder, type = 'text', onInput, onChange, onEnter, size, dir, maxlength, min, max, step, ariaLabel } = {}) {
  const el = h('input', { class: ['input', size && `input--${size}`], type, testid, placeholder, dir: dir || 'auto', maxlength, min, max, step, value, 'aria-label': ariaLabel });
  if (onInput) el.addEventListener('input', () => onInput(el.value, el));
  if (onChange) el.addEventListener('change', () => onChange(el.value, el));
  if (onEnter) el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); onEnter(el.value, el); } });
  return el;
}

export function textarea({ testid, value = '', placeholder, rows, onInput, onChange, tall, dir, ariaLabel, class: cls } = {}) {
  const el = h('textarea', { class: ['textarea', tall && 'textarea--tall', cls], testid, placeholder, rows, dir: dir || 'auto', value, 'aria-label': ariaLabel });
  if (onInput) el.addEventListener('input', () => onInput(el.value, el));
  if (onChange) el.addEventListener('change', () => onChange(el.value, el));
  return el;
}

export function select({ testid, options = [], value, onChange, size, ariaLabel } = {}) {
  const el = h('select', { class: ['select', size && `select--${size}`], testid, 'aria-label': ariaLabel },
    options.map((o) => h('option', { value: o.value }, o.label)));
  if (value != null) el.value = value;
  if (onChange) el.addEventListener('change', () => onChange(el.value, el));
  return el;
}

export function toggle({ testid, checked, label, onChange }) {
  const cb = h('input', { type: 'checkbox', checked, testid, role: 'switch' });
  cb.addEventListener('change', () => onChange && onChange(cb.checked));
  return h('label', { class: 'switch' }, cb, h('span', {}, label));
}

export function segmented({ testid, options, value, onChange }) {
  const wrap = h('div', { class: 'seg', role: 'group', testid });
  const btns = options.map((o) => {
    const b = h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': String(o.value === value), testid: `${testid}-${o.value}` }, o.label);
    b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange && onChange(o.value);
    });
    return b;
  });
  append(wrap, btns);
  return wrap;
}

/* ---------------- card / chip / notice / empty / spinner ---------------- */
export function card({ title, sub, iconName, actions, body, foot, testid, class: cls, flush }) {
  return h('section', { class: ['card', cls], testid },
    title || actions ? h('header', { class: 'card-header' },
      h('div', { class: 'stack stack--sm grow' },
        title ? h('h2', { class: 'card-title', dir: 'auto' }, iconName ? icon(iconName) : null, title) : null,
        sub ? h('div', { class: 'card-sub' }, sub) : null),
      actions ? h('div', { class: 'row' }, actions) : null) : null,
    h('div', { class: ['card-body', flush && 'card-body--flush'] }, body),
    foot ? h('footer', { class: 'card-foot' }, foot) : null);
}

export function chip({ label, tone, testid, iconName, title }) {
  return h('span', { class: ['chip', tone && `chip--${tone}`], testid, title, dir: 'auto' }, iconName ? icon(iconName, 'icon--sm') : null, label);
}

export const STATUS_TONES = { raw: '', ready: 'info', drafting: 'warn', preview: 'violet', approved: 'success', exported: 'success', published: 'ink' };
export function statusChip(status, testid) {
  const el = chip({ label: t(`status.${status || 'raw'}`), tone: STATUS_TONES[status] || '', testid });
  el.dataset.status = status || 'raw';
  return el;
}

const NOTICE_ICONS = { info: 'info', warn: 'alert', error: 'xCircle', success: 'checkCircle' };
export function notice({ tone = 'info', title, body, action, testid }) {
  return h('div', { class: ['notice', `notice--${tone}`], role: tone === 'error' ? 'alert' : 'status', testid },
    icon(NOTICE_ICONS[tone] || 'info'),
    h('div', { class: 'notice-body' }, title ? h('div', { class: 'notice-title' }, title) : null, body ? h('div', { dir: 'auto' }, body) : null),
    action || null);
}

export function emptyState({ iconName = 'info', title, body, action, testid }) {
  return h('div', { class: 'empty', testid }, icon(iconName, 'icon--xl'),
    title ? h('div', { class: 'empty-title' }, title) : null,
    body ? h('div', { class: 'empty-body' }, body) : null,
    action || null);
}

export function spinner(small) { return h('span', { class: ['spinner', small && 'spinner--sm'], role: 'status', 'aria-label': t('common.loading') }); }

export function loading(label) { return h('div', { class: 'loading', testid: 'loading' }, spinner(), h('span', {}, label || t('common.loading'))); }

export function errorText(err) {
  if (!err) return t('errors.generic');
  if (err.name === 'AbortError') return t('errors.cancelled');
  if (err instanceof ApiError) {
    if (err.code === 'busy' || err.status === 409) return err.msg || t('errors.busy');
    if (err.code === 'network') return t('errors.network');
    return err.msg || t('errors.generic');
  }
  return err.message || t('errors.generic');
}

export function errorBox(err, onRetry) {
  return notice({
    tone: 'error',
    title: err && (err.code === 'busy' || err.status === 409) ? t('errors.busyTitle') : t('errors.title'),
    body: errorText(err),
    testid: 'error-box',
    action: onRetry ? button({ label: t('common.retry'), size: 'sm', iconName: 'refresh', testid: 'error-retry', onClick: onRetry }) : null,
  });
}

/* ---------------- toast ---------------- */
let region;
export function toast(msg, tone = 'info', timeout = 3800) {
  if (!region || !region.isConnected) {
    region = h('div', { class: 'toast-region', 'aria-live': 'polite', testid: 'toasts' });
    document.body.append(region);
  }
  const iconFor = { success: 'checkCircle', error: 'xCircle', info: 'info', warn: 'alert' };
  const close = button({ iconName: 'x', variant: 'ghost', size: 'sm', ariaLabel: t('common.close'), testid: 'toast-close', onClick: () => el.remove() });
  const el = h('div', { class: ['toast', `toast--${tone}`], role: tone === 'error' ? 'alert' : 'status', testid: `toast-${tone}` },
    icon(iconFor[tone] || 'info'), h('div', { class: 'toast-msg' }, msg), close);
  region.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

export function toastError(err) { return toast(errorText(err), 'error', 6000); }

/* ---------------- modal / confirm ---------------- */
export function modal({ title, body, actions = [], size, testid = 'modal', onClose }) {
  let resolve;
  const result = new Promise((r) => { resolve = r; });
  const dlg = h('dialog', { class: ['modal', size && `modal--${size}`], testid, 'aria-label': title });
  const close = (value) => { if (dlg.open) dlg.close(); dlg.remove(); resolve(value); onClose && onClose(value); };
  const footBtns = actions.map((a) => button({
    label: a.label, variant: a.variant || 'secondary', testid: a.testid, iconName: a.iconName, disabled: a.disabled,
    onClick: async () => {
      if (a.onClick) {
        const r = await a.onClick();
        if (r === false) return;
        close(r === undefined ? a.value : r);
      } else close(a.value);
    },
  }));
  append(dlg, h('div', { class: 'modal-inner' },
    h('header', { class: 'modal-head' },
      h('h2', { class: 'modal-title' }, title),
      button({ iconName: 'x', variant: 'ghost', size: 'sm', ariaLabel: t('common.close'), testid: `${testid}-close`, onClick: () => close(undefined) })),
    h('div', { class: 'modal-body' }, body),
    footBtns.length ? h('footer', { class: 'modal-foot' }, footBtns) : null));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(undefined); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(undefined); });
  document.body.append(dlg);
  dlg.showModal();
  return { el: dlg, close, result, buttons: footBtns };
}

export function confirmDialog({ title, message, confirmLabel, danger, testid = 'confirm' }) {
  return modal({
    title, testid,
    body: h('p', {}, message),
    actions: [
      { label: t('common.cancel'), variant: 'ghost', value: false, testid: `${testid}-cancel` },
      { label: confirmLabel || t('common.confirm'), variant: danger ? 'danger-solid' : 'primary', value: true, testid: `${testid}-ok` },
    ],
  }).result.then((v) => v === true);
}

/* ---------------- tabs ---------------- */
export function tabs({ items, value, onChange, testid = 'tabs' }) {
  const bar = h('div', { class: 'tabs', role: 'tablist', testid });
  const btns = items.map((it) => {
    const b = h('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(it.value === value), testid: `${testid}-${it.value}` }, it.label);
    b.addEventListener('click', () => { btns.forEach((x) => x.setAttribute('aria-selected', String(x === b))); onChange(it.value); });
    return b;
  });
  append(bar, btns);
  return bar;
}

/* ---------------- page header ---------------- */
export function pageHeader({ title, sub, actions, eyebrow }) {
  return h('header', { class: 'page-header' },
    h('div', { class: 'stack stack--sm' },
      eyebrow ? h('div', { class: 'eyebrow' }, eyebrow) : null,
      h('h1', { class: 'page-title', dir: 'auto' }, title),
      sub ? h('p', { class: 'page-sub' }, sub) : null),
    actions ? h('div', { class: 'page-actions' }, actions) : null);
}

/* ---------------- copy ---------------- */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(t('common.copied'), 'success');
}

/* ---------------- scaled slide iframe ---------------- */
export function slideFrame({ src, testid = 'slide-frame', title }) {
  const frame = h('div', { class: 'slide-frame', testid, dir: 'ltr' });
  const ifr = h('iframe', { title: title || t('common.preview'), loading: 'lazy', sandbox: 'allow-same-origin', tabindex: '-1' });
  const spin = loading();
  ifr.addEventListener('load', () => spin.remove());
  frame.append(spin, ifr);
  const ro = new ResizeObserver(() => {
    const w = frame.clientWidth;
    if (w) frame.style.setProperty('--preview-scale', String(w / 1080));
  });
  ro.observe(frame);
  const set = (url) => { if (!frame.contains(spin)) frame.prepend(spin); ifr.src = url; };
  if (src) set(src);
  return { el: frame, set, reload: () => set(ifr.src) };
}

/* ---------------- SSE run panel ---------------- */
const PHASE_ICONS = { claude: 'factory', validate: 'check', retry: 'refresh', render: 'images', qa: 'eye', export: 'folder', done: 'checkCircle' };

/**
 * createRun({ title, phases, testid, cancelKind, showText })
 * → { el, run(path, body) → Promise<result>, cancel() }
 */
export function createRun({ title, phases = [], testid = 'run', cancelKind, showText = true, liveText = false, onEvent } = {}) {
  const el = h('section', { class: 'run', testid, 'data-state': 'idle', 'aria-live': 'polite' });
  const stateIcon = h('span', { class: 'run-state' }, spinner(true));
  const elapsed = h('span', { class: 'run-elapsed', testid: `${testid}-elapsed` });
  const cancelBtn = button({ label: t('common.cancel'), iconName: 'stop', size: 'sm', variant: 'danger', testid: `${testid}-cancel`, onClick: () => cancel() });
  const phaseList = h('ol', { class: 'phases', testid: `${testid}-phases` });
  const msg = h('div', { class: 'run-msg', testid: `${testid}-msg` });
  const progWrap = h('div', { class: 'stack stack--sm', hidden: true });
  const progBar = h('div', { class: 'progress-bar' });
  const progLabel = h('div', { class: 'counter', testid: `${testid}-progress` });
  append(progWrap, h('div', { class: 'progress' }, progBar), progLabel);
  const tools = h('div', { class: 'run-tools', testid: `${testid}-tools`, hidden: true });
  const pre = h('pre', { class: liveText ? 'live-text' : 'stream-text', testid: `${testid}-text` });
  const details = liveText ? h('div', { class: 'stack stack--sm', hidden: true }, pre)
    : h('details', { class: 'disclosure', testid: `${testid}-details`, hidden: true },
      h('summary', { testid: `${testid}-details-toggle` }, icon('chevron', 'icon--sm'), t('run.claudeText')), pre);
  const errSlot = h('div');
  append(el,
    h('header', { class: 'run-head' }, stateIcon, h('div', { class: 'run-title' }, title), elapsed, cancelBtn),
    h('div', { class: 'run-body' }, phaseList, msg, progWrap, tools, showText ? details : null, errSlot));

  const seen = [];
  let current = null;
  let controller = null;
  let timer = null;
  let started = 0;
  let curKind = cancelKind || 'claude';
  let cancelRequested = false;

  const phaseEl = (p) => {
    let li = phaseList.querySelector(`[data-phase="${p}"]`);
    if (!li) {
      if (phaseList.children.length) phaseList.append(h('li', { class: 'phase-sep', 'aria-hidden': 'true' }, icon('chevron', 'icon--sm icon--flip')));
      li = h('li', { class: 'phase', dataset: { phase: p }, 'data-state': 'pending', testid: `${testid}-phase-${p}` }, icon(PHASE_ICONS[p] || 'info', 'icon--sm'), t(`phase.${p}`));
      phaseList.append(li);
    }
    return li;
  };
  const resetPhases = () => { clear(phaseList); phases.forEach(phaseEl); };
  resetPhases();

  const setPhase = (p, text) => {
    if (p === 'done') { finishPhases('done'); }
    else {
      if (p === 'retry' && !phaseList.querySelector('[data-phase="retry"]')) {
        // insert retry right after validate
        const v = phaseList.querySelector('[data-phase="validate"]');
        const li = h('li', { class: 'phase', dataset: { phase: 'retry' }, 'data-state': 'pending', testid: `${testid}-phase-retry` }, icon('refresh', 'icon--sm'), t('phase.retry'));
        if (v) { v.after(h('li', { class: 'phase-sep', 'aria-hidden': 'true' }, icon('chevron', 'icon--sm icon--flip')), li); } else phaseEl('retry');
      }
      for (const s of seen) if (s !== p) phaseEl(s).dataset.state = 'done';
      const li = phaseEl(p);
      li.dataset.state = 'active';
      if (!seen.includes(p)) seen.push(p);
      current = p;
      if (!cancelKind) curKind = (p === 'render' || p === 'export') ? 'render' : 'claude';
    }
    msg.textContent = text || t(`phase.${p}.msg`);
  };
  const finishPhases = (state) => {
    phaseList.querySelectorAll('.phase').forEach((li) => {
      if (state === 'done') li.dataset.state = 'done';
      else if (li.dataset.phase === current) li.dataset.state = 'error';
    });
  };
  const tick = () => { elapsed.textContent = fmtDuration(Date.now() - started); };

  const handle = ({ event, data }) => {
    const d = data || {};
    switch (event) {
      case 'phase': setPhase(d.phase, d.msg); break;
      case 'text':
        if (d.delta) { details.hidden = false; pre.textContent += d.delta; pre.scrollTop = pre.scrollHeight; }
        break;
      case 'tool': {
        tools.hidden = false;
        tools.append(h('div', { class: 'row' }, icon('file', 'icon--sm'), t('run.tool', { name: d.name || '', path: d.path || '' })));
        while (tools.children.length > 5) tools.firstChild.remove();
        break;
      }
      case 'progress': {
        progWrap.hidden = false;
        const n = Number(d.n) || 0; const total = Number(d.total) || 0;
        progBar.style.setProperty('--progress', total ? `${Math.round((n / total) * 100)}%` : '0%');
        progLabel.textContent = t('run.progress', { n, total });
        break;
      }
      default: break;
    }
    if (onEvent) { try { onEvent({ event, data }); } catch (e) { console.error(e); } }
  };

  async function run(path, body) {
    controller = new AbortController();
    cancelRequested = false;
    el.dataset.state = 'running';
    mount(stateIcon, spinner(true));
    clear(errSlot); clear(tools); tools.hidden = true; pre.textContent = ''; details.hidden = true; progWrap.hidden = true;
    seen.length = 0; current = null; resetPhases();
    msg.textContent = t('run.starting');
    cancelBtn.hidden = false;
    started = Date.now(); tick(); timer = setInterval(tick, 1000);
    runStarted(curKind);
    try {
      const result = await api.stream(path, body, { onEvent: handle, signal: controller.signal });
      el.dataset.state = 'done';
      finishPhases('done');
      mount(stateIcon, icon('checkCircle'));
      msg.textContent = t('run.done');
      return result;
    } catch (err) {
      const aborted = cancelRequested || (err && (err.name === 'AbortError' || err.code === 'cancelled'));
      el.dataset.state = aborted ? 'cancelled' : 'error';
      finishPhases('error');
      mount(stateIcon, icon('xCircle'));
      msg.textContent = aborted ? t('run.cancelled') : t('run.failed');
      if (!aborted) mount(errSlot, errorBox(err));
      throw aborted && err.name !== 'AbortError' ? new DOMException('Aborted', 'AbortError') : err;
    } finally {
      clearInterval(timer); tick();
      cancelBtn.hidden = true;
      controller = null;
      runEnded();
      refreshState();
    }
  }

  async function cancel() {
    if (!controller) return;
    const kind = curKind;
    cancelRequested = true;
    try { await api.post('/api/cancel', { kind }); } catch { /* ignore */ }
    if (controller) controller.abort();
  }

  cancelBtn.hidden = true;
  return { el, run, cancel, get running() { return !!controller; } };
}

/* ---------------- debounce ---------------- */
export function debounce(fn, ms) {
  let tmr;
  const d = (...a) => { clearTimeout(tmr); tmr = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(tmr); return fn(...a); };
  d.cancel = () => clearTimeout(tmr);
  return d;
}
