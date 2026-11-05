// Brand widgets shared by welcome + settings: photo/face editor, accent picker, template grid.
import { t, pick, getLang } from './i18n.js';
import { api, fileUrl } from './api.js';
import { h, icon, button, emptyState, toast, toastError, modal, slideFrame, loading, errorBox, mount } from './ui.js';

export const ACCENTS = ['#2f6bed', '#161b29', '#e4572e', '#0f9d75', '#8a4fff', '#d6336c', '#f2a516'];

function parsePos(pos) {
  const m = /(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/.exec(pos || '');
  return m ? [Number(m[1]), Number(m[2])] : [50, 30];
}

/**
 * Photo upload + face position editor. Drag on the photo to set object-position.
 * opts: { identity, onPhoto(photo), onFacePos(pos) }
 */
export function photoEditor({ identity, onPhoto, onFacePos, testid = 'photo' }) {
  let pos = parsePos(identity.facePos);
  let bust = Date.now();
  const frame = h('div', { class: 'photo-frame', testid: `${testid}-frame`, dir: 'ltr', role: 'slider', tabindex: '0', 'aria-label': t('identity.facePos') });
  const mark = h('div', { class: 'face-mark' });
  const posLabel = h('div', { class: 'counter', testid: `${testid}-pos` });
  const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png', hidden: true, testid: `${testid}-file` });

  const paint = () => {
    frame.style.setProperty('--fx', `${pos[0]}%`);
    frame.style.setProperty('--fy', `${pos[1]}%`);
    const img = frame.querySelector('img');
    if (img) img.style.objectPosition = `${pos[0]}% ${pos[1]}%`;
    posLabel.textContent = t('identity.facePosValue', { x: Math.round(pos[0]), y: Math.round(pos[1]) });
  };
  const draw = () => {
    if (identity.photo) {
      const img = h('img', { src: fileUrl(`brand/${identity.photo}`, bust), alt: t('identity.photo'), draggable: false });
      img.addEventListener('error', () => { mount(frame, emptyState({ iconName: 'user', body: t('identity.noPhoto') })); });
      mount(frame, img, mark);
    } else {
      mount(frame, emptyState({ iconName: 'user', body: t('identity.noPhoto') }));
    }
    paint();
  };

  let dragging = false;
  const setFromEvent = (e) => {
    const r = frame.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    pos = [Math.round(x), Math.round(y)];
    paint();
  };
  const commit = () => onFacePos && onFacePos(`${pos[0]}% ${pos[1]}%`);
  frame.addEventListener('pointerdown', (e) => {
    if (!identity.photo) return;
    dragging = true; frame.setPointerCapture(e.pointerId); setFromEvent(e);
  });
  frame.addEventListener('pointermove', (e) => { if (dragging) setFromEvent(e); });
  frame.addEventListener('pointerup', () => { if (dragging) { dragging = false; commit(); } });
  frame.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 2;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!k) return;
    e.preventDefault();
    pos = [Math.min(100, Math.max(0, pos[0] + k[0])), Math.min(100, Math.max(0, pos[1] + k[1]))];
    paint(); commit();
  });

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) { toast(t('identity.photoType'), 'error'); return; }
    if (f.size > 8 * 1024 * 1024) { toast(t('identity.photoTooBig'), 'error'); return; }
    mount(frame, loading(t('identity.uploading')));
    try {
      const r = await api.upload('/api/brand/photo', f);
      identity.photo = (r && r.photo) || identity.photo;
      bust = Date.now();
      onPhoto && onPhoto(identity.photo);
      uploadBtn.querySelector('span').textContent = t('identity.changePhoto');
      toast(t('identity.photoSaved'), 'success');
    } catch (err) { toastError(err); }
    draw();
  });

  draw();
  const uploadBtn = button({ label: identity.photo ? t('identity.changePhoto') : t('identity.uploadPhoto'), iconName: 'upload', testid: `${testid}-upload`, onClick: () => fileInput.click() });
  const el = h('div', { class: 'photo-editor', testid },
    frame,
    h('div', { class: 'stack stack--sm grow' },
      uploadBtn,
      h('p', { class: 'field-hint' }, t('identity.photoHint')),
      h('p', { class: 'field-hint' }, t('identity.faceHint')),
      posLabel,
      fileInput));
  return { el, refresh: () => { bust = Date.now(); draw(); } };
}

export function accentPicker({ value, onChange, testid = 'accent' }) {
  const color = h('input', { type: 'color', class: 'input', value: value || ACCENTS[0], testid: `${testid}-input`, 'aria-label': t('identity.accent') });
  const hex = h('input', { class: 'input input--sm ltr mono', value: value || '', placeholder: '#2f6bed', maxlength: '7', testid: `${testid}-hex`, dir: 'ltr', 'aria-label': t('identity.accentHex') });
  const sw = ACCENTS.map((c) => {
    const b = h('button', { type: 'button', class: 'swatch', style: { '--sw': c }, 'aria-pressed': String(c === value), 'aria-label': c, testid: `${testid}-swatch-${c.slice(1)}` });
    b.addEventListener('click', () => set(c));
    return b;
  });
  const set = (c) => {
    color.value = c; hex.value = c;
    sw.forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('aria-label') === c)));
    onChange && onChange(c);
  };
  color.addEventListener('input', () => set(color.value));
  hex.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) set(hex.value.toLowerCase()); else hex.value = color.value; });
  return h('div', { class: 'stack stack--sm', testid }, h('div', { class: 'swatches' }, sw), h('div', { class: 'input-group' }, color, hex));
}

export function previewUrl({ template, index = 0, lang = getLang(), bust = Date.now() } = {}) {
  const q = new URLSearchParams({ index: String(index), lang, v: String(bust) });
  if (template) q.set('template', template);
  return `/api/preview/slide?${q}`;
}

/** Show 3 sample slides of a template with the user's identity in a modal. */
export function previewTemplateModal(tpl) {
  const frames = [0, 1, 2].map((i) => slideFrame({ src: previewUrl({ template: tpl.id, index: i }), testid: `tpl-preview-${i}` }).el);
  modal({
    title: t('templates.previewTitle', { name: pick(tpl.name) }),
    size: 'lg', testid: 'tpl-preview',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, pick(tpl.desc)),
      h('div', { class: 'tpl-grid' }, frames)),
    actions: [{ label: t('common.close'), value: null, testid: 'tpl-preview-done' }],
  });
}

/**
 * Template grid. opts: { selected, onSelect(id), defaultId, onMakeDefault(id), testid }
 * Returns { el, load() }.
 */
export function templateGrid({ selected, onSelect, defaultId, onMakeDefault, testid = 'templates' }) {
  const el = h('div', { testid }, loading());
  let list = [];
  let sel = selected;
  const render = () => {
    if (!list.length) { mount(el, emptyState({ iconName: 'layers', title: t('templates.empty') })); return; }
    mount(el, h('div', { class: 'tpl-grid' }, list.map((tp) => {
      const thumb = h('div', { class: 'tpl-thumb' });
      const img = h('img', { src: tp.preview ? `/${String(tp.preview).replace(/^\/+/, '')}` : '', alt: pick(tp.name), loading: 'lazy' });
      img.addEventListener('error', () => { mount(thumb, slideFrame({ src: previewUrl({ template: tp.id }), testid: `${testid}-frame-${tp.id}` }).el); });
      if (tp.preview) thumb.append(img); else thumb.append(slideFrame({ src: previewUrl({ template: tp.id }) }).el);
      const isDefault = tp.id === defaultId;
      const card = h('div', { class: 'tpl-card', role: 'button', tabindex: '0', 'aria-pressed': String(tp.id === sel), testid: `${testid}-card-${tp.id}` },
        thumb,
        h('div', { class: 'tpl-meta' },
          h('div', { class: 'tpl-name' }, h('span', {}, pick(tp.name)), isDefault ? h('span', { class: 'chip chip--info', testid: `${testid}-default-${tp.id}` }, t('templates.default')) : null),
          h('div', { class: 'tpl-desc' }, pick(tp.desc)),
          tp.fits ? h('div', { class: 'tpl-desc' }, t('templates.fits', { fits: pick(tp.fits) })) : null,
          h('div', { class: 'row' },
            button({ label: t('templates.preview'), iconName: 'eye', size: 'sm', variant: 'ghost', testid: `${testid}-preview-${tp.id}`, onClick: (e) => { e.stopPropagation(); previewTemplateModal(tp); } }),
            onMakeDefault && !isDefault ? button({ label: t('templates.makeDefault'), size: 'sm', testid: `${testid}-make-default-${tp.id}`, onClick: async (e) => { e.stopPropagation(); await onMakeDefault(tp.id); defaultId = tp.id; sel = tp.id; render(); } }) : null)));
      const choose = () => { sel = tp.id; onSelect && onSelect(tp.id); el.querySelectorAll('.tpl-card').forEach((c) => c.setAttribute('aria-pressed', String(c === card))); };
      card.addEventListener('click', choose);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      return card;
    })));
  };
  const load = async () => {
    mount(el, loading());
    try { list = (await api.get('/api/templates')) || []; render(); }
    catch (err) { mount(el, errorBox(err, load)); }
  };
  load();
  return { el, load, get list() { return list; } };
}

export { icon };
