// #/welcome — 4-step onboarding: language → about you (profile.md) → identity + photo → template.
import { t, getLang, supportedLangs } from '../i18n.js';
import { api } from '../api.js';
import { store, refreshState, patchState } from '../store.js';
import { go } from '../router.js';
import { h, mount, button, field, input, textarea, toast, toastError, loading, errorBox } from '../ui.js';
import { splitSections } from '../md.js';
import { photoEditor, accentPicker, templateGrid } from '../brand.js';

const QUESTIONS = ['work', 'audience', 'goal', 'topics', 'dialect', 'samples', 'dislikes', 'extra'];
const REQUIRED = ['work', 'audience'];
const STEPS = ['lang', 'about', 'identity', 'template'];

// Module-level wizard state survives language re-renders.
const W = { step: 0, answers: null, identity: null, loaded: false };

async function loadData() {
  if (W.loaded) return;
  const [identity, profile] = await Promise.all([
    api.get('/api/brand/identity').catch(() => ({ ...(store.state && store.state.identity) })),
    api.get('/api/brand/doc/profile').catch(() => ({ text: '' })),
  ]);
  W.identity = identity || {};
  W.answers = {};
  const secs = splitSections(profile && profile.text);
  for (const q of QUESTIONS) {
    const heads = supportedLangs().map(() => t(`welcome.q.${q}`));
    const s = secs.find((x) => heads.includes(x.heading));
    W.answers[q] = s ? s.body : '';
  }
  W.loaded = true;
}

function profileMarkdown() {
  const out = [`# ${t('welcome.profileTitle')}`, ''];
  for (const q of QUESTIONS) {
    const a = (W.answers[q] || '').trim();
    if (!a) continue;
    out.push(`## ${t(`welcome.q.${q}`)}`, '', a, '');
  }
  return out.join('\n');
}

export async function render(root, { changeLang }) {
  mount(root, loading());
  try { await loadData(); } catch (err) { mount(root, errorBox(err, () => render(root, { changeLang }))); return; }

  const stepper = h('ol', { class: 'steps', testid: 'wizard-steps' }, STEPS.map((s, i) =>
    h('li', { class: 'step-dot', 'data-state': i === W.step ? 'active' : i < W.step ? 'done' : 'todo', testid: `wizard-step-${s}` },
      h('span', { class: 'step-num' }, String(i + 1)), h('span', {}, t(`welcome.step.${s}`)))));

  const body = h('div', { class: 'stack stack--lg' });
  const back = button({ label: t('common.back'), iconName: 'chevronBack', variant: 'ghost', testid: 'wizard-back', disabled: W.step === 0, onClick: () => { W.step -= 1; render(root, { changeLang }); } });
  const next = button({ label: W.step === STEPS.length - 1 ? t('welcome.finish') : t('common.next'), iconName: 'chevron', iconAfter: true, variant: 'primary', size: 'lg', testid: 'wizard-next', onClick: () => advance() });

  const advance = async () => {
    try {
      if (STEPS[W.step] === 'about') {
        const missing = REQUIRED.filter((q) => !(W.answers[q] || '').trim());
        if (missing.length) { toast(t('welcome.required'), 'warn'); return; }
        await api.put('/api/brand/doc/profile', { text: profileMarkdown() });
      }
      if (STEPS[W.step] === 'identity') {
        if (!(W.identity.name || '').trim()) { toast(t('welcome.nameRequired'), 'warn'); return; }
        W.identity = await api.put('/api/brand/identity', W.identity) || W.identity;
        patchState({ identity: W.identity });
      }
      if (STEPS[W.step] === 'template') {
        W.identity = await api.put('/api/brand/identity', W.identity) || W.identity;
        const s = { ...(store.state.settings || {}), uiLang: getLang(), onboarded: true };
        const saved = await api.put('/api/settings', s);
        patchState({ settings: saved || s, identity: W.identity });
        await refreshState();
        W.loaded = false; W.step = 0;
        toast(t('welcome.done'), 'success');
        go('me');
        return;
      }
      W.step += 1;
      render(root, { changeLang });
    } catch (err) { toastError(err); }
  };

  const step = STEPS[W.step];
  if (step === 'lang') {
    const cards = supportedLangs().map((l) => {
      const b = h('button', { type: 'button', class: 'lang-card', 'aria-pressed': String(l === getLang()), testid: `wizard-lang-${l}` },
        h('span', { class: 'lang-card-big' }, t(`lang.name.${l}`)),
        h('span', { class: 'muted small' }, t(`lang.desc.${l}`)));
      b.addEventListener('click', () => changeLang(l));
      return b;
    });
    mount(body, h('div', { class: 'lang-cards' }, cards), h('p', { class: 'muted small' }, t('welcome.langHint')));
  } else if (step === 'about') {
    mount(body, h('div', { class: 'stack' }, QUESTIONS.map((q) => field({
      label: t(`welcome.q.${q}`) + (REQUIRED.includes(q) ? ` ${t('common.requiredMark')}` : ''),
      hint: t(`welcome.h.${q}`),
      control: textarea({ value: W.answers[q] || '', testid: `wizard-q-${q}`, tall: q === 'samples', onInput: (v) => { W.answers[q] = v; } }),
    }))));
  } else if (step === 'identity') {
    const id = W.identity;
    const photo = photoEditor({ identity: id, onPhoto: (p) => { id.photo = p; }, onFacePos: (p) => { id.facePos = p; }, testid: 'wizard-photo' });
    mount(body,
      h('div', { class: 'grid-2' },
        field({ label: t('identity.name'), control: input({ value: id.name || '', testid: 'wizard-name', onInput: (v) => { id.name = v; } }) }),
        field({ label: t('identity.handle'), control: input({ value: id.handle || '', placeholder: t('identity.handlePh'), testid: 'wizard-handle', dir: 'ltr', onInput: (v) => { id.handle = v; } }) })),
      field({ label: t('identity.role'), hint: t('identity.roleHint'), control: input({ value: id.role || '', testid: 'wizard-role', onInput: (v) => { id.role = v; } }) }),
      h('div', { class: 'field' }, h('div', { class: 'field-label' }, t('identity.photo')), photo.el),
      h('div', { class: 'field' }, h('div', { class: 'field-label' }, t('identity.accent')), accentPicker({ value: id.accent, testid: 'wizard-accent', onChange: (c) => { id.accent = c; } })));
  } else if (step === 'template') {
    const grid = templateGrid({ selected: W.identity.template, defaultId: W.identity.template, testid: 'wizard-templates', onSelect: (tid) => { W.identity.template = tid; } });
    mount(body, grid.el);
  }

  mount(root, h('div', { class: 'wizard', testid: 'welcome' },
    h('div', { class: 'wizard-top' }, h('div', { class: 'eyebrow' }, t('app.name')), stepper),
    h('div', { class: 'wizard-hero' },
      h('h1', { class: 'wizard-title' }, t(`welcome.title.${step}`)),
      h('p', { class: 'page-sub' }, t(`welcome.sub.${step}`))),
    body,
    h('div', { class: 'wizard-foot' }, back, next)));
}
