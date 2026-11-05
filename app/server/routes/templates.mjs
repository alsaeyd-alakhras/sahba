// Templates, fonts and live single-slide HTML previews (engine.buildSlideHtml).
import { router, load, ws, mtime, err } from '../lib.mjs';
import { engine } from '../engine.mjs';
import { mustIdea, readDeck } from '../store.mjs';

export const photoUrl = identity => identity.photo ? `/files/brand/${identity.photo}?v=${Math.round(mtime(ws('brand', identity.photo)))}` : null;
export const deckTemplate = (deck, idea) => deck?.template || idea?.template || load('identity').template || 'editorial';

function html(res, s) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(s);
}
const idx = (v, n) => Math.min(Math.max(0, parseInt(v, 10) || 0), Math.max(0, n - 1));
// Live preview while the creator edits identity: these query params override the saved identity (not persisted).
const OVERRIDES = ['name', 'handle', 'role', 'accent', 'font', 'facePos'];

export default router([
  ['GET', '/api/templates', async () => (await (await engine()).listTemplates()).map(t => ({ ...t, previewUrl: t.preview ? `/${String(t.preview).replace(/^\/+/, '')}` : null }))],
  ['GET', '/api/fonts', async () => (await engine()).listFonts()],
  ['GET', '/api/preview/slide', async ({ res, url }) => {
    const E = await engine(), q = url.searchParams;
    const identity = load('identity');
    for (const k of OVERRIDES) if (q.has(k)) identity[k] = q.get(k);
    const deck = E.sampleDeck(q.get('lang') === 'en' ? 'en' : 'ar');
    const template = q.get('template') || identity.template || 'editorial';
    html(res, E.buildSlideHtml({ deck, index: idx(q.get('index'), deck.slides.length), identity, template, assetBase: '/engine/', photoUrl: photoUrl(identity) }));
  }],
  ['GET', '/api/preview/deck-slide', async ({ res, url }) => {
    const E = await engine(), q = url.searchParams;
    const idea = mustIdea(q.get('id')), deck = readDeck(idea.id);
    if (!deck?.slides?.length) throw err('no_deck', 'this idea has no deck yet', 404);
    const identity = load('identity');
    html(res, E.buildSlideHtml({ deck, index: idx(q.get('index'), deck.slides.length), identity, template: q.get('template') || deckTemplate(deck, idea), assetBase: '/engine/', photoUrl: photoUrl(identity) }));
  }],
]);
