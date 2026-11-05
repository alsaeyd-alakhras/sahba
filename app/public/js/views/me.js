// #/me — who I am / audience / pillars / voice cards from profile.md, analysis.md, voice.md. Edit in place + Analyze (SSE).
import { t, fmtDateTime } from '../i18n.js';
import { api } from '../api.js';
import { h, mount, button, claudeButton, claudeGate, card, textarea, field, emptyState, loading, errorBox, toast, toastError, pageHeader, createRun } from '../ui.js';
import { renderMarkdown, splitSections, joinSections } from '../md.js';

const DOCS = ['profile', 'analysis', 'voice'];
const MATCH = {
  audience: /audience|جمهور/i,
  pillars: /pillar|محاور|محور|topics/i,
};

export async function render(root) {
  const docs = {};
  const runSlot = h('div');
  const cardsEl = h('div', { class: 'grid-2', testid: 'me-cards' });
  const extraEl = h('div', { class: 'stack' });
  let analyzing = false;

  const load = async () => {
    mount(cardsEl, loading());
    clear();
    try {
      const res = await Promise.all(DOCS.map((d) => api.get(`/api/brand/doc/${d}`).catch((e) => (e.status === 404 ? { text: '' } : Promise.reject(e)))));
      DOCS.forEach((d, i) => { docs[d] = res[i] || { text: '' }; });
      draw();
    } catch (err) { mount(cardsEl, errorBox(err, load)); }
  };
  const clear = () => mount(extraEl);

  const save = async (name, text) => {
    const r = await api.put(`/api/brand/doc/${name}`, { text });
    docs[name] = r || { text };
    toast(t('me.saved'), 'success');
    draw();
  };

  /** A card bound to a getter/setter over a doc (whole doc or a section of analysis.md). */
  const docCard = ({ key, iconName, get, set, docName, emptyKey }) => {
    const body = h('div');
    let editing = false;
    const show = () => {
      const text = get();
      if (editing) {
        const ta = textarea({ value: text, class: 'doc-editor', testid: `me-${key}-editor`, ariaLabel: t(`me.card.${key}`) });
        mount(body, h('div', { class: 'stack' }, ta,
          h('div', { class: 'row row--end' },
            button({ label: t('common.cancel'), variant: 'ghost', size: 'sm', testid: `me-${key}-cancel`, onClick: () => { editing = false; show(); } }),
            button({ label: t('common.save'), variant: 'secondary', size: 'sm', testid: `me-${key}-save`, onClick: async () => { try { await save(docName, set(ta.value)); } catch (e) { toastError(e); } } }))));
        ta.focus();
      } else if (text.trim()) {
        mount(body, renderMarkdown(text));
      } else {
        mount(body, emptyState({ iconName, body: t(emptyKey || `me.empty.${key}`) }));
      }
    };
    show();
    const updated = docs[docName] && docs[docName].updated;
    return card({
      title: t(`me.card.${key}`), iconName, class: 'doc-card', testid: `me-card-${key}`,
      sub: updated ? t('me.updated', { date: fmtDateTime(updated) }) : t(`me.source.${docName}`),
      actions: button({ label: t('common.edit'), iconName: 'edit', size: 'sm', variant: 'ghost', testid: `me-${key}-edit`, onClick: () => { editing = true; show(); } }),
      body,
    });
  };

  const sectionAccess = (re) => {
    const secs = splitSections(docs.analysis.text);
    const idx = secs.findIndex((s) => s.heading && re.test(s.heading));
    return {
      found: idx >= 0,
      get: () => (idx >= 0 ? secs[idx].body : ''),
      set: (v) => {
        if (idx >= 0) secs[idx] = { ...secs[idx], body: v.trim() };
        else secs.push({ heading: t(re === MATCH.audience ? 'me.card.audience' : 'me.card.pillars'), level: 2, body: v.trim() });
        return joinSections(secs);
      },
    };
  };

  const draw = () => {
    const aud = sectionAccess(MATCH.audience);
    const pil = sectionAccess(MATCH.pillars);
    mount(cardsEl,
      docCard({ key: 'who', iconName: 'user', docName: 'profile', get: () => docs.profile.text || '', set: (v) => v }),
      docCard({ key: 'audience', iconName: 'users', docName: 'analysis', get: aud.get, set: aud.set }),
      docCard({ key: 'pillars', iconName: 'target', docName: 'analysis', get: pil.get, set: pil.set }),
      docCard({ key: 'voice', iconName: 'mic', docName: 'voice', get: () => docs.voice.text || '', set: (v) => v }));
    mount(extraEl,
      docs.analysis.text && docs.analysis.text.trim()
        ? h('details', { class: 'card disclosure', testid: 'me-analysis-full' },
          h('summary', { class: 'card-header', testid: 'me-analysis-toggle' }, h('span', { class: 'card-title' }, t('me.fullAnalysis'))),
          h('div', { class: 'card-body' }, docCard({ key: 'analysis', iconName: 'file', docName: 'analysis', get: () => docs.analysis.text || '', set: (v) => v })))
        : null);
  };

  const extra = textarea({ testid: 'me-analyze-extra', placeholder: t('me.analyzeExtraPh'), ariaLabel: t('me.analyzeExtra') });
  const analyzeBtn = claudeButton({
    label: t('me.analyze'), iconName: 'wand', variant: 'primary', testid: 'me-analyze',
    onClick: async () => {
      if (analyzing) return;
      analyzing = true;
      const run = createRun({ title: t('me.analyzing'), phases: ['claude'], testid: 'me-run', liveText: true, cancelKind: 'claude' });
      mount(runSlot, run.el);
      try {
        await run.run('/api/brand/analyze', extra.value.trim() ? { extra: extra.value.trim() } : {});
        toast(t('me.analyzed'), 'success');
        await load();
      } catch (err) { /* error is shown inside the run panel */ }
      finally { analyzing = false; }
    },
  });

  mount(root,
    pageHeader({ title: t('me.title'), sub: t('me.sub'), actions: [button({ label: t('me.redoWizard'), iconName: 'refresh', variant: 'ghost', testid: 'me-wizard', onClick: () => { location.hash = '#/welcome'; } })] }),
    h('div', { class: 'stack stack--lg' },
      claudeGate(),
      card({
        title: t('me.analyzeTitle'), iconName: 'wand', sub: t('me.analyzeSub'), testid: 'me-analyze-card',
        body: h('div', { class: 'stack' }, field({ label: t('me.analyzeExtra'), hint: t('me.analyzeExtraHint'), control: extra }), h('div', { class: 'row' }, analyzeBtn), runSlot),
      }),
      cardsEl,
      extraEl));
  load();
}
