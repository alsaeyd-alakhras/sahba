// App shell: side nav, language + theme toggles, Claude status dot (polled), busy indicator, view mounting.
import { t, setLang, getLang, supportedLangs } from './i18n.js';
import { api } from './api.js';
import { store, subscribe, refreshState, patchState, claudeStatus, busyKind } from './store.js';
import * as router from './router.js';
import { h, icon, mount, clear, button, spinner, errorBox, toast, toastError, loading } from './ui.js';

const NAV = [
  { name: 'ideas', icon: 'lightbulb' },
  { name: 'factory', icon: 'factory' },
  { name: 'gallery', icon: 'images' },
  { name: 'me', icon: 'user' },
  { name: 'settings', icon: 'settings' },
  { name: 'log', icon: 'list' },
];
const THEMES = ['auto', 'light', 'dark'];
const POLL_MS = 30000;

const appEl = document.getElementById('app');
const viewEl = document.getElementById('view');
let navEl = null;
let current = null;    // { name, cleanup }
let lastRoute = null;
let renderSeq = 0;

/* ---------------- theme ---------------- */
function getTheme() { try { return localStorage.getItem('sahba.theme') || 'auto'; } catch { return 'auto'; } }
function applyTheme(th) {
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('sahba.theme', th); } catch { /* ignore */ }
}

/* ---------------- language ---------------- */
export async function changeLang(lang) {
  if (lang === getLang()) return;
  if (store.localRuns) { toast(t('lang.waitRun'), 'warn'); return; }
  try {
    const s = { ...(store.state && store.state.settings), uiLang: lang };
    await setLang(lang);
    patchState({ settings: s });
    renderNav();
    rerender();
    api.put('/api/settings', s).catch(toastError);
  } catch (err) { toastError(err); }
}

/* ---------------- nav ---------------- */
function statusInfo() {
  const st = claudeStatus();
  const map = {
    ok: ['dot--ok', 'claude.status.ok'],
    missing: ['dot--bad', 'claude.status.missing'],
    loggedOut: ['dot--warn', 'claude.status.loggedOut'],
    offline: ['dot--bad', 'claude.status.offline'],
    unknown: ['', 'claude.status.unknown'],
  };
  return map[st] || map.unknown;
}

function renderNav() {
  if (!navEl) {
    navEl = h('nav', { class: 'nav', 'aria-label': t('nav.label'), testid: 'nav' });
    appEl.prepend(navEl);
  }
  navEl.setAttribute('aria-label', t('nav.label'));
  const active = lastRoute && lastRoute.name;
  const [dotCls, statusKey] = statusInfo();
  const version = store.state && store.state.claude && store.state.claude.version;
  const bk = busyKind();
  const theme = getTheme();
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const themeIcon = { auto: 'monitor', light: 'sun', dark: 'moon' }[theme];
  const otherLang = supportedLangs().find((l) => l !== getLang());

  mount(navEl,
    h('a', { class: 'brand', href: router.href('ideas'), testid: 'nav-brand' },
      h('span', { class: 'brand-mark' }, icon('layers')),
      h('span', { class: 'stack stack--sm' }, h('span', { class: 'brand-name' }, t('app.name')), h('span', { class: 'brand-tag' }, t('app.tagline')))),
    h('ul', { class: 'nav-list' }, NAV.map((n) => h('li', {},
      h('a', { class: 'nav-link', href: router.href(n.name), 'aria-current': n.name === active ? 'page' : null, testid: `nav-${n.name}` },
        icon(n.icon), h('span', { class: 'grow' }, t(`nav.${n.name}`)),
        n.name === 'ideas' && store.state && store.state.ideasCount ? h('span', { class: 'counter' }, String(store.state.ideasCount)) : null)))),
    h('div', { class: 'nav-foot' },
      bk ? h('div', { class: 'busy-pill', testid: 'busy-indicator', role: 'status' }, spinner(true), t(`busy.${bk}`)) : null,
      h('a', { class: 'status-line', href: '#/settings/claude', testid: 'claude-status', title: version ? t('claude.version', { version }) : null },
        h('span', { class: ['dot', dotCls], testid: 'claude-dot', 'data-status': claudeStatus() }),
        h('span', { class: 'grow' }, t(statusKey))),
      h('div', { class: 'nav-tools' },
        button({ label: t(`lang.switchTo.${otherLang}`), iconName: 'globe', size: 'sm', variant: 'ghost', testid: 'lang-toggle', onClick: () => changeLang(otherLang) }),
        button({ iconName: themeIcon, size: 'sm', variant: 'ghost', ariaLabel: t('theme.toggle', { mode: t(`theme.${nextTheme}`) }), testid: 'theme-toggle',
          onClick: () => { applyTheme(nextTheme); renderNav(); } })),
      h('a', { class: 'credit', href: AUTHOR_URL, target: '_blank', rel: 'noopener', testid: 'author-credit' }, t('app.madeBy'))));
}

// product credit (MIT, © the author) — not user data
const AUTHOR_URL = 'https://github.com/alsaeyd-alakhras/sahba';

/* ---------------- routing ---------------- */
const loaders = {
  welcome: () => import('./views/welcome.js'),
  me: () => import('./views/me.js'),
  settings: () => import('./views/settings.js'),
  ideas: () => import('./views/ideas.js'),
  factory: () => import('./views/factory.js'),
  gallery: () => import('./views/gallery.js'),
  log: () => import('./views/log.js'),
};

async function onRoute(route) {
  const onboarded = !!(store.state && store.state.settings && store.state.settings.onboarded);
  if (!route.name || !loaders[route.name]) { router.go(onboarded ? router.DEFAULT_ROUTE : 'welcome'); return; }
  if (!onboarded && route.name !== 'welcome') { router.go('welcome'); return; }
  lastRoute = route;
  refreshState();
  await renderRoute(route);
}

function rerender() { if (lastRoute) renderRoute(lastRoute); }

async function renderRoute(route) {
  const seq = ++renderSeq;
  if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  current = null;
  appEl.dataset.layout = route.name === 'welcome' ? 'bare' : 'full';
  if (route.name !== 'welcome') renderNav();
  mount(viewEl, loading());
  try {
    const mod = await loaders[route.name]();
    if (seq !== renderSeq) return;
    clear(viewEl);
    viewEl.dataset.view = route.name;
    const cleanup = await mod.render(viewEl, { route, rerender, changeLang });
    if (seq !== renderSeq) { if (typeof cleanup === 'function') cleanup(); return; }
    current = { name: route.name, cleanup: typeof cleanup === 'function' ? cleanup : null };
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    if (seq === renderSeq) mount(viewEl, errorBox(err, () => renderRoute(route)));
  }
}

/* ---------------- boot ---------------- */
async function boot() {
  applyTheme(getTheme());
  await refreshState();
  const lang = (store.state && store.state.settings && store.state.settings.uiLang) || (navigator.language || 'ar').slice(0, 2);
  await setLang(supportedLangs().includes(lang) ? lang : 'ar');
  if (!store.state) {
    appEl.dataset.layout = 'bare';
    mount(viewEl, h('div', { class: 'stack', testid: 'boot-error' },
      h('h1', { class: 'page-title' }, t('app.name')),
      errorBox(store.error, () => location.reload())));
    return;
  }
  subscribe(() => { if (navEl && appEl.dataset.layout !== 'bare') renderNav(); });
  router.start(onRoute);
  setInterval(() => { if (!document.hidden) refreshState(); }, POLL_MS);
  // first Claude probe takes a few seconds: poll fast until it settles
  const settle = setInterval(() => { if (claudeStatus() !== 'unknown') clearInterval(settle); else refreshState(); }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshState(); });
}

boot();
