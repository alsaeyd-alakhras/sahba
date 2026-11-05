// #/settings[/tab] — identity (+live preview), templates, accounts, factory defaults, Claude + device (doctor), language.
import { t, has, getLang, supportedLangs } from '../i18n.js';
import { api } from '../api.js';
import { store, refreshState, patchState, claudeStatus } from '../store.js';
import { replace } from '../router.js';
import { h, mount, icon, button, card, field, input, textarea, select, toggle, segmented, tabs, pageHeader, loading, errorBox, toast, toastError, slideFrame, debounce, notice } from '../ui.js';
import { photoEditor, accentPicker, templateGrid, previewUrl } from '../brand.js';

const TABS = ['identity', 'templates', 'accounts', 'factory', 'claude', 'language'];
const ACCOUNTS = ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'];

export async function render(root, { route, changeLang }) {
  let tab = TABS.includes(route.params[0]) ? route.params[0] : 'identity';
  const panel = h('div', { testid: `settings-panel` });
  let cleanup = null;

  const show = (name) => {
    tab = name;
    replace('settings', name);
    if (cleanup) { cleanup(); cleanup = null; }
    panel.dataset.tab = name;
    const r = SECTIONS[name](panel, { changeLang });
    if (typeof r === 'function') cleanup = r;
  };

  mount(root,
    pageHeader({ title: t('settings.title'), sub: t('settings.sub') }),
    tabs({ items: TABS.map((v) => ({ value: v, label: t(`settings.tab.${v}`) })), value: tab, onChange: show, testid: 'settings-tabs' }),
    panel);
  show(tab);
  return () => cleanup && cleanup();
}

/* ---------------- identity ---------------- */
async function identitySection(panel) {
  mount(panel, loading());
  let id;
  let fonts = [];
  try {
    [id, fonts] = await Promise.all([api.get('/api/brand/identity'), api.get('/api/fonts').catch(() => [])]);
  } catch (err) { mount(panel, errorBox(err, () => identitySection(panel))); return; }
  id = id || {};
  fonts = Array.isArray(fonts) ? fonts : (fonts && fonts.fonts) || [];

  let previewIndex = 0;
  const frame = slideFrame({ src: previewUrl({ template: id.template, index: previewIndex }), testid: 'identity-preview' });
  const saveState = h('span', { class: 'counter', testid: 'identity-save-state' }, '');
  const reloadPreview = () => frame.set(previewUrl({ template: id.template, index: previewIndex }));

  const persist = async () => {
    saveState.textContent = t('common.saving');
    try {
      const saved = await api.put('/api/brand/identity', id);
      if (saved) Object.assign(id, saved);
      patchState({ identity: { ...id } });
      saveState.textContent = t('common.saved');
      reloadPreview();
    } catch (err) { saveState.textContent = ''; toastError(err); }
  };
  const save = debounce(persist, 600);
  const setField = (k) => (v) => { id[k] = v; saveState.textContent = t('common.unsaved'); save(); };

  const photo = photoEditor({ identity: id, testid: 'identity-photo', onPhoto: (p) => { id.photo = p; persist(); }, onFacePos: (p) => { id.facePos = p; persist(); } });
  const fontSel = select({
    testid: 'identity-font', value: id.font || (fonts[0] && fonts[0].id), ariaLabel: t('identity.font'),
    options: fonts.length ? fonts.map((f) => ({ value: f.id, label: f.name || f.family || f.id })) : [{ value: id.font || 'cairo', label: id.font || 'cairo' }],
    onChange: (v) => { id.font = v; persist(); },
  });

  const left = h('div', { class: 'stack stack--lg' },
    card({
      title: t('identity.title'), iconName: 'user', testid: 'identity-card',
      actions: saveState,
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid-2' },
          field({ label: t('identity.name'), control: input({ value: id.name || '', testid: 'identity-name', onInput: setField('name') }) }),
          field({ label: t('identity.handle'), control: input({ value: id.handle || '', testid: 'identity-handle', dir: 'ltr', placeholder: t('identity.handlePh'), onInput: setField('handle') }) })),
        field({ label: t('identity.role'), hint: t('identity.roleHint'), control: input({ value: id.role || '', testid: 'identity-role', onInput: setField('role') }) })),
    }),
    card({ title: t('identity.photo'), iconName: 'images', testid: 'identity-photo-card', body: photo.el }),
    card({
      title: t('identity.look'), iconName: 'palette', testid: 'identity-look-card',
      body: h('div', { class: 'stack' },
        h('div', { class: 'field' }, h('div', { class: 'field-label' }, t('identity.accent')),
          accentPicker({ value: id.accent, testid: 'identity-accent', onChange: (c) => { id.accent = c; saveState.textContent = t('common.unsaved'); save(); } }),
          h('div', { class: 'row' }, button({ label: t('identity.accentReset'), size: 'sm', variant: 'ghost', testid: 'identity-accent-reset', onClick: () => { delete id.accent; id.accent = null; persist(); } }))),
        field({ label: t('identity.font'), hint: t('identity.fontHint'), control: fontSel })),
    }));

  const right = h('div', { class: 'stack sticky-preview' },
    card({
      title: t('identity.preview'), iconName: 'eye', sub: t('identity.previewSub'), testid: 'identity-preview-card',
      actions: segmented({ testid: 'identity-preview-index', value: 0, options: [0, 1, 2].map((i) => ({ value: i, label: String(i + 1) })), onChange: (v) => { previewIndex = v; reloadPreview(); } }),
      body: frame.el,
    }));

  mount(panel, h('div', { class: 'split' }, left, right));
  return () => { save.cancel(); };
}

/* ---------------- templates ---------------- */
function templatesSection(panel) {
  const id = { ...((store.state && store.state.identity) || {}) };
  const grid = templateGrid({
    selected: id.template, defaultId: id.template, testid: 'settings-templates',
    onMakeDefault: async (tid) => {
      try {
        const cur = await api.get('/api/brand/identity');
        const saved = await api.put('/api/brand/identity', { ...cur, template: tid });
        patchState({ identity: saved || { ...cur, template: tid } });
        toast(t('templates.madeDefault'), 'success');
      } catch (err) { toastError(err); throw err; }
    },
  });
  mount(panel, card({ title: t('templates.title'), sub: t('templates.sub'), iconName: 'layers', testid: 'templates-card', body: grid.el }));
}

/* ---------------- accounts ---------------- */
async function accountsSection(panel) {
  mount(panel, loading());
  let acc;
  try { acc = (await api.get('/api/brand/accounts')) || {}; }
  catch (err) { mount(panel, errorBox(err, () => accountsSection(panel))); return; }
  for (const k of ACCOUNTS) acc[k] = { url: '', bio: '', ...(acc[k] || {}) };
  const rows = ACCOUNTS.map((k) => h('div', { class: 'stack stack--sm', testid: `account-${k}` },
    h('div', { class: 'section-title' }, t(`accounts.${k}`)),
    h('div', { class: 'grid-2' },
      field({ label: t('accounts.url'), control: input({ value: acc[k].url, dir: 'ltr', placeholder: t(`accounts.urlPh.${k}`), testid: `account-${k}-url`, onInput: (v) => { acc[k].url = v; } }) }),
      field({ label: t('accounts.bio'), control: textarea({ value: acc[k].bio, rows: 2, testid: `account-${k}-bio`, onInput: (v) => { acc[k].bio = v; } }) }))));
  mount(panel, card({
    title: t('accounts.title'), sub: t('accounts.sub'), iconName: 'at', testid: 'accounts-card',
    body: h('div', { class: 'stack stack--lg' }, rows),
    foot: button({ label: t('common.save'), variant: 'primary', testid: 'accounts-save', onClick: async () => {
      try { await api.put('/api/brand/accounts', acc); toast(t('common.saved'), 'success'); } catch (err) { toastError(err); }
    } }),
  }));
}

/* ---------------- factory defaults ---------------- */
function factorySection(panel) {
  const s = { slidesDefault: 8, hashtags: 5, category: '', visualQA: true, ...((store.state && store.state.settings) || {}) };
  const persist = async () => {
    try {
      const saved = await api.put('/api/settings', s);
      patchState({ settings: saved || { ...s } });
      toast(t('common.saved'), 'success');
    } catch (err) { toastError(err); }
  };
  const saveSoon = debounce(persist, 700);
  mount(panel, card({
    title: t('factorySettings.title'), sub: t('factorySettings.sub'), iconName: 'factory', testid: 'factory-settings-card',
    body: h('div', { class: 'stack' },
      h('div', { class: 'grid-2' },
        field({ label: t('factorySettings.slides'), hint: t('factorySettings.slidesHint'), control: select({ testid: 'settings-slides', value: String(s.slidesDefault), options: [7, 8, 9].map((n) => ({ value: String(n), label: String(n) })), onChange: (v) => { s.slidesDefault = Number(v); persist(); } }) }),
        field({ label: t('factorySettings.hashtags'), hint: t('factorySettings.hashtagsHint'), control: input({ type: 'number', min: '0', max: '30', value: String(s.hashtags), testid: 'settings-hashtags', onInput: (v) => { s.hashtags = Math.max(0, Math.min(30, Number(v) || 0)); saveSoon(); } }) })),
      field({ label: t('factorySettings.category'), hint: t('factorySettings.categoryHint'), control: input({ value: s.category || '', testid: 'settings-category', onInput: (v) => { s.category = v; saveSoon(); } }) }),
      toggle({ label: t('factorySettings.visualQA'), checked: !!s.visualQA, testid: 'settings-visualqa', onChange: (v) => { s.visualQA = v; persist(); } }),
      h('p', { class: 'field-hint' }, t('factorySettings.visualQAHint'))),
  }));
}

/* ---------------- Claude + device ---------------- */
function claudeSection(panel) {
  const statusEl = h('div');
  const doctorEl = h('div', { testid: 'doctor' }, loading());

  const drawStatus = () => {
    const st = claudeStatus();
    const c = (store.state && store.state.claude) || {};
    const tone = st === 'ok' ? 'success' : st === 'loggedOut' ? 'warn' : 'error';
    mount(statusEl, notice({
      tone, testid: 'claude-connection',
      title: t(`claude.status.${st}`),
      body: h('div', { class: 'stack stack--sm' },
        h('span', {}, t(`claude.explain.${st}`)),
        c.version ? h('span', { class: 'mono ltr' }, t('claude.version', { version: c.version })) : null),
    }));
  };

  const loadDoctor = async () => {
    mount(doctorEl, loading(t('doctor.running')));
    try {
      const r = await api.get('/api/doctor');
      const checks = (r && r.checks) || [];
      mount(doctorEl, h('ul', { class: 'check-list' }, checks.map((c) => h('li', { class: 'check-item', testid: `doctor-${c.id}`, 'data-ok': String(!!c.ok) },
        h('span', { class: c.ok ? 'check-ok' : 'check-bad' }, icon(c.ok ? 'checkCircle' : 'xCircle')),
        h('div', { class: 'check-body' },
          h('div', { class: 'check-name' }, has(`doctor.${c.id}`) ? t(`doctor.${c.id}`) : c.id),
          c.detail ? h('div', { class: 'small muted' }, c.detail) : null,
          !c.ok && c.fix ? h('div', { class: 'fix', testid: `doctor-${c.id}-fix` }, h('strong', {}, t('doctor.fix')), ' ', c.fix) : null)))));
    } catch (err) { mount(doctorEl, errorBox(err, loadDoctor)); }
  };

  const recheck = async () => { await Promise.all([refreshState(), loadDoctor()]); drawStatus(); toast(t('claude.rechecked'), 'info'); };

  drawStatus();
  loadDoctor();
  mount(panel, h('div', { class: 'stack stack--lg' },
    card({
      title: t('claude.title'), sub: t('claude.sub'), iconName: 'factory', testid: 'claude-card',
      actions: button({ label: t('claude.recheck'), iconName: 'refresh', size: 'sm', testid: 'claude-recheck', onClick: recheck }),
      body: statusEl,
    }),
    card({
      title: t('doctor.title'), sub: t('doctor.sub'), iconName: 'stethoscope', testid: 'doctor-card',
      actions: button({ label: t('doctor.rerun'), iconName: 'refresh', size: 'sm', variant: 'ghost', testid: 'doctor-rerun', onClick: loadDoctor }),
      body: doctorEl,
    })));
}

/* ---------------- language ---------------- */
function languageSection(panel, { changeLang }) {
  mount(panel, card({
    title: t('settings.tab.language'), sub: t('lang.sub'), iconName: 'globe', testid: 'language-card',
    body: segmented({
      testid: 'settings-lang', value: getLang(),
      options: supportedLangs().map((l) => ({ value: l, label: t(`lang.name.${l}`) })),
      onChange: (l) => changeLang(l),
    }),
  }));
}

const SECTIONS = {
  identity: identitySection,
  templates: templatesSection,
  accounts: accountsSection,
  factory: factorySection,
  claude: claudeSection,
  language: languageSection,
};
