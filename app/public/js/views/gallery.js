// #/gallery — exported carousels as cover cards.
import { t, fmtDate, fmtNumber } from '../i18n.js';
import { api, fileUrl } from '../api.js';
import { go, href } from '../router.js';
import { h, mount, icon, button, chip, emptyState, loading, errorBox, toastError, pageHeader } from '../ui.js';

export async function render(root) {
  const slot = h('div', {}, loading());
  mount(root, pageHeader({ title: t('gallery.title'), sub: t('gallery.sub') }), slot);
  const load = async () => {
    mount(slot, loading());
    try {
      const r = await api.get('/api/gallery');
      const items = Array.isArray(r) ? r : (r && r.items) || [];
      if (!items.length) {
        mount(slot, emptyState({ iconName: 'images', title: t('gallery.emptyTitle'), body: t('gallery.emptyBody'), testid: 'gallery-empty',
          action: h('a', { class: 'btn btn--primary', href: href('ideas'), testid: 'gallery-goto-ideas' }, t('nav.ideas')) }));
        return;
      }
      mount(slot, h('div', { class: 'gallery-grid', testid: 'gallery-grid' }, items.map((it) => {
        const open = () => go('factory', it.id);
        const cover = h('div', { class: 'cover-img' });
        if (it.cover) {
          const img = h('img', { src: fileUrl(it.cover), alt: it.title || '', loading: 'lazy' });
          img.addEventListener('error', () => mount(cover, emptyState({ iconName: 'images' })));
          cover.append(img);
        } else cover.append(emptyState({ iconName: 'images' }));
        const c = h('article', { class: 'card card--interactive cover-card', testid: `gallery-item-${it.id}`, tabindex: '0' },
          cover,
          h('div', { class: 'cover-meta' },
            h('div', { class: 'cover-title', dir: 'auto' }, it.title || it.dir),
            h('div', { class: 'row small muted' },
              h('span', {}, fmtDate(it.date)), h('span', {}, t('common.dot')), h('span', {}, t('gallery.slides', { n: fmtNumber(it.count || 0) })),
              it.published ? chip({ label: t('status.published'), tone: 'ink' }) : chip({ label: t('status.exported'), tone: 'success' })),
            h('div', { class: 'row' },
              button({ label: t('gallery.open'), iconName: 'factory', size: 'sm', testid: `gallery-open-${it.id}`, onClick: (e) => { e.stopPropagation(); open(); } }),
              button({ label: t('factory.openFolder'), iconName: 'folder', size: 'sm', variant: 'ghost', testid: `gallery-folder-${it.id}`,
                onClick: async (e) => { e.stopPropagation(); try { await api.post(`/api/factory/${encodeURIComponent(it.id)}/open`, {}); } catch (err) { toastError(err); } } }),
              it.published && it.published.url ? h('a', { class: 'btn btn--ghost btn--sm', href: it.published.url, target: '_blank', rel: 'noopener noreferrer', testid: `gallery-post-${it.id}` }, icon('external'), t('ideas.viewPost')) : null)));
        c.addEventListener('click', open);
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === c) open(); });
        return c;
      })));
    } catch (err) { mount(slot, errorBox(err, load)); }
  };
  load();
}
