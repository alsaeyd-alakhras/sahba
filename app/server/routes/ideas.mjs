// Idea bank: CRUD, reorder, «اقترح أفكار» (suggest) and «صقّل» (polish) through Claude.
import { router, sseFlow, err } from '../lib.mjs';
import * as claude from '../claude.mjs';
import * as P from '../prompts.mjs';
import * as S from '../store.mjs';

const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const strList = (v, max, n) => Array.isArray(v) ? v.map(x => str(x, n)).filter(Boolean).slice(0, max) : [];

/** Fields a client may PATCH (status `drafting` is server-only; deck/exported/source are derived). */
export function cleanPatch(idea, b) {
  const n = {};
  if ('title' in b) { n.title = str(b.title, 200); if (!n.title) throw err('bad_request', 'title required'); }
  if ('note' in b) n.note = String(b.note ?? '').slice(0, 4000);
  if ('pillar' in b) n.pillar = str(b.pillar, 80);
  if ('hook' in b) n.hook = str(b.hook, 400);
  if ('outline' in b) n.outline = strList(b.outline, 12, 400);
  if ('template' in b) { if (b.template !== null && !/^[a-z0-9][a-z0-9-]{0,40}$/.test(b.template)) throw err('bad_request', 'invalid template'); n.template = b.template || null; }
  if ('published' in b) {
    n.published = b.published && typeof b.published === 'object' ? { date: str(b.published.date, 10), url: str(b.published.url, 500) } : null;
    if (n.published && !('status' in b)) n.status = 'published';
  }
  if ('status' in b) {
    if (!S.statusOk(b.status) || b.status === 'drafting') throw err('bad_request', 'invalid status');
    n.status = b.status;
  }
  if (idea.status === 'drafting' && Object.keys(n).length) throw err('busy', 'idea is being drafted', 409);
  return n;
}

const PARSE_FAIL = 'Claude did not return the expected JSON block';

export default router([
  ['GET', '/api/ideas', () => ({ ideas: S.ideas() })],
  ['POST', '/api/ideas', ({ body }) => {
    const title = str(body.title, 200); if (!title) throw err('bad_request', 'title required');
    return S.addIdeas([{ title, note: String(body.note ?? '').slice(0, 4000), pillar: str(body.pillar, 80) }])[0];
  }],
  ['POST', '/api/ideas/reorder', ({ body }) => {
    if (!Array.isArray(body.ids)) throw err('bad_request', 'ids must be an array');
    S.reorder(body.ids.filter(S.idOk)); return { ok: true };
  }],
  ['PATCH', '/api/ideas/:id', ({ params, body }) => { const i = S.mustIdea(params.id); return S.patchIdea(i.id, cleanPatch(i, body)); }],
  ['DELETE', '/api/ideas/:id', ({ params }) => {
    const i = S.mustIdea(params.id); if (i.status === 'drafting') throw err('busy', 'idea is being drafted', 409);
    S.removeIdea(i.id); return { ok: true };
  }],

  ['POST', '/api/ideas/suggest', ({ res, body }) => {
    const count = Math.min(20, Math.max(1, parseInt(body.count, 10) || 10));
    const l = claude.lock.acquire();
    return sseFlow(res, async send => {
      try {
        send('phase', { phase: 'claude', msg: `suggesting ${count} ideas` });
        const existing = S.ideas().map(i => i.title);
        const r = await claude.run({ ...P.suggest({ count, existing }), signal: l.signal, onEvent: claude.forward(send), meta: { route: 'suggest' } });
        if (!r.ok) throw err(r.code, r.error);
        const j = P.extractJson(r.text);
        if (!Array.isArray(j?.ideas)) throw err('parse', PARSE_FAIL);
        const seen = new Set(existing.map(t => t.toLowerCase()));
        const fresh = j.ideas.map(x => ({ title: str(x?.title, 200), note: String(x?.note ?? '').slice(0, 4000), pillar: str(x?.pillar, 80), source: 'claude' }))
          .filter(x => x.title && !seen.has(x.title.toLowerCase()) && seen.add(x.title.toLowerCase())).slice(0, count);
        if (!fresh.length) throw err('parse', PARSE_FAIL);
        return { added: S.addIdeas(fresh) };
      } finally { l.release(); }
    });
  }],

  ['POST', '/api/ideas/:id/polish', ({ res, params }) => {
    const idea = S.mustIdea(params.id);
    if (idea.status === 'drafting') throw err('busy', 'idea is being drafted', 409);
    const l = claude.lock.acquire();
    return sseFlow(res, async send => {
      try {
        send('phase', { phase: 'claude', msg: 'polishing idea' });
        const r = await claude.run({ ...P.polish({ idea }), signal: l.signal, onEvent: claude.forward(send), meta: { route: 'polish', ideaId: idea.id } });
        if (!r.ok) throw err(r.code, r.error);
        const j = P.extractJson(r.text);
        const hook = str(j?.hook, 400), outline = strList(j?.outline, 12, 400);
        if (!hook || outline.length < 2) throw err('parse', PARSE_FAIL);
        const cur = S.getIdea(idea.id); if (!cur) throw err('not_found', 'idea was deleted', 404);
        const patch = { hook, outline };
        if (j.angle) patch.note = cur.note ? cur.note : str(j.angle, 400); // keep the creator's own note; fill it only when empty
        if (cur.status === 'raw') patch.status = 'ready';
        return S.patchIdea(idea.id, patch);
      } finally { l.release(); }
    });
  }],
]);
