// DEV ONLY — fake Sahba server for UI work. Not shipped logic.
// node app/public/_dev/mock-server.mjs  → http://127.0.0.1:8901
// Mock controls: GET /_mock/claude?state=ok|missing|loggedOut · /_mock/fail?next=draft|revise|suggest|polish|analyze|export|rerender
//                GET /_mock/busy?kind=claude|render&on=1 · /_mock/reset · /_mock/onboarded?v=1
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(PUBLIC, '..', '..');
const PORT = Number(process.env.PORT || 8901);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };

const today = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TEMPLATES = [
  { id: 'editorial', name: { ar: 'تحريري', en: 'Editorial' }, desc: { ar: 'سكري منقّط + أزرق + Cairo + صورتك', en: 'Dotted cream, blue, Cairo and your photo' }, fits: { ar: 'تعليمي، قوائم، أي موضوع', en: 'Educational, listicles, anything' }, preview: 'templates/editorial/preview.png', bg: '#f4f1ea', ink: '#161b29', accent: '#2f6bed' },
  { id: 'midnight', name: { ar: 'منتصف الليل', en: 'Midnight' }, desc: { ar: 'أسود + كروت + أزرق فاتح', en: 'Black, cards and light blue' }, fits: { ar: 'مقارنات، أدوات، تقني', en: 'Comparisons, tools, tech' }, preview: 'templates/midnight/preview.png', bg: '#0d1018', ink: '#eef1f8', accent: '#6aa8ff' },
  { id: 'gradient', name: { ar: 'تدرّج', en: 'Gradient' }, desc: { ar: 'تدرّج بنفسجي-أزرق + أرقام ضخمة', en: 'Violet-blue gradient, huge numbers' }, fits: { ar: 'أرقام، حقائق', en: 'Numbers, facts' }, preview: 'templates/gradient/preview.png', bg: '#2a1b5e', ink: '#ffffff', accent: '#9b8cff' },
  { id: 'mono', name: { ar: 'أحادي', en: 'Mono' }, desc: { ar: 'أبيض وأسود حاد + لون واحد', en: 'Sharp black & white, one accent' }, fits: { ar: 'آراء، اقتباسات', en: 'Opinions, quotes' }, preview: null, bg: '#ffffff', ink: '#000000', accent: '#e4572e' },
];

let db;
function reset() {
  db = {
    claude: { installed: true, loggedIn: true, version: '2.1.0' },
    busy: { claude: false, render: false },
    forceBusy: { claude: false, render: false },
    failNext: new Set(),
    settings: { uiLang: 'ar', slidesDefault: 8, hashtags: 5, category: '', visualQA: true, onboarded: process.env.MOCK_ONBOARDED === '1' },
    identity: { name: 'سارة المطورة', handle: '@sara.dev', role: 'Frontend Developer · React', photo: null, facePos: '50% 28%', template: 'editorial', accent: '#2f6bed', font: 'cairo' },
    accounts: { instagram: { url: 'https://instagram.com/sara.dev', bio: 'أعلّمك React بالعربي' }, facebook: { url: '', bio: '' }, youtube: { url: '', bio: '' }, linkedin: { url: '', bio: '' }, tiktok: { url: '', bio: '' } },
    photo: null,
    docs: {
      profile: { text: '# عنّي\n\n## شو بتشتغل؟\n\nمطوّرة واجهات بـ React من 5 سنين، بشتغل فريلانس مع شركات ناشئة.\n\n## لمين بتحكي؟\n\nمطورين مبتدئين بالعالم العربي.\n', updated: '2026-11-01T10:00:00Z' },
      analysis: { text: '## الجمهور\n\n- مطورين مبتدئين (18–28)\n- بيدوروا على **أول وظيفة** أو أول عميل\n\n## المحاور\n\n1. React عملي\n2. فريلانس\n3. أدوات وإنتاجية\n4. أخطاء المبتدئين\n\n## نقاط القوة\n\nشرح بسيط بأمثلة من الشغل الحقيقي.\n', updated: '2026-11-02T09:00:00Z' },
      voice: { text: '## قواعد الصوت\n\n- شامي خفيف، جمل قصيرة\n- رقم ملموس بالافتتاحية\n- بدون إيموجي بالعناوين\n\n> اكتبي كأنك بتحكي مع صاحبك المطوّر.\n', updated: '2026-11-02T09:00:00Z' },
    },
    ideas: [
      mkIdea('i_20261101_ab12', '5 أخطاء بتخلّي كود React بطيء', 'preview', { pillar: 'React عملي', hook: '5 أخطاء بتبطّئ تطبيقك بدون ما تحس', outline: ['re-render زيادة', 'مفاتيح القوائم', 'useEffect بلا داعي', 'state بالمكان الغلط', 'صور ثقيلة'], deck: true }),
      mkIdea('i_20261030_cd34', 'كيف جبت أول عميل فريلانس', 'exported', { pillar: 'فريلانس', hook: 'أول عميل جاني من بوست واحد', deck: true, exported: 'exports/2026-10-30_first-client' }),
      mkIdea('i_20261102_ef56', 'أدوات بتوفّر عليك ساعة يومياً', 'ready', { pillar: 'أدوات وإنتاجية', hook: '7 أدوات بتوفّر ساعة كل يوم', outline: ['Raycast', 'Warp', 'Arc'] }),
      mkIdea('i_20261102_gh78', 'الفرق بين props و state ببساطة', 'raw', { pillar: 'React عملي', note: 'مثال من مشروع حقيقي' }),
      mkIdea('i_20261020_ij90', 'ليش ما لازم تتعلم كل framework', 'published', { pillar: 'أخطاء المبتدئين', deck: true, exported: 'exports/2026-10-20_frameworks', published: { date: '2026-10-21', url: 'https://instagram.com/p/xyz' } }),
      mkIdea('i_20261103_kl11', 'Very long idea title to test wrapping in the table: how to price your first freelance project without underselling yourself', 'raw', { source: 'claude' }),
    ],
    decks: {},
    preview: {},
    history: {},
    log: [],
    exportsV: Date.now(),
  };
  for (const i of db.ideas) if (i.deck) { db.decks[i.id] = sampleDeck(i); db.preview[i.id] = { n: 8, v: Date.now(), template: null }; db.history[i.id] = [{ version: '2026-11-01T10-00-00Z', date: '2026-11-01T10:00:00Z' }, { version: '2026-11-02T12-30-00Z', date: '2026-11-02T12:30:00Z' }]; }
  for (let k = 0; k < 6; k++) db.log.push({ ts: new Date(Date.now() - k * 3600e3).toISOString(), task: ['draft', 'render', 'polish', 'export', 'suggest', 'analyze'][k], id: db.ideas[k % db.ideas.length].id, ms: 12000 + k * 7000, ok: k !== 2, error: k === 2 ? 'Claude timed out after 300s' : undefined });
}
function mkIdea(id, title, status, extra = {}) {
  const deck = extra.deck; delete extra.deck;
  return { id, title, note: '', pillar: '', status, source: 'me', outline: [], hook: '', template: null, created: '2026-11-01', updated: '2026-11-02', deck: deck ? `decks/${id}.json` : null, exported: null, published: null, prevStatus: null, ...extra };
}
function sampleDeck(idea) {
  return { slug: `${today()}_topic`, category: idea.pillar || 'React', template: idea.template || db?.identity?.template || 'editorial', caption: `${idea.hook || idea.title}\n\nهاد ملخص سريع للي بالكاروسيل.\n\nاحفظ البوست وارجعله لما تحتاجه.\n\n#react #frontend #javascript #webdev #برمجة`, slides: Array.from({ length: 8 }, (_, i) => ({ kind: i === 0 ? 'cover' : i === 7 ? 'cta' : 'point', title: i === 0 ? idea.hook || idea.title : `النقطة ${i}` })) };
}
reset();

/* ---------------- svg slides ---------------- */
function tplOf(id) { return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]; }
function slideSvg({ n = 1, total = 8, title = '', template, accent, name, handle, v = '' }) {
  const tp = tplOf(template);
  const ac = accent || tp.accent;
  const bg = tp.id === 'gradient' ? 'url(#g)' : tp.bg;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<defs><pattern id="d" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="${tp.ink}" opacity=".12"/></pattern>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1b5e"/><stop offset="1" stop-color="#1b3f9e"/></linearGradient></defs>
<rect width="1080" height="1350" fill="${bg}"/>${tp.id === 'editorial' ? '<rect width="1080" height="1350" fill="url(#d)"/>' : ''}
<rect x="80" y="80" width="160" height="56" rx="28" fill="${ac}"/><text x="160" y="118" font-family="Cairo,Tahoma,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#fff">${n}/${total}</text>
<text x="1000" y="560" font-family="Cairo,Tahoma,sans-serif" font-size="${n === 1 ? 96 : 76}" font-weight="800" text-anchor="end" direction="rtl" fill="${tp.ink}">${esc(String(title).slice(0, 22))}</text>
<text x="1000" y="680" font-family="Cairo,Tahoma,sans-serif" font-size="44" text-anchor="end" direction="rtl" fill="${ac}">${esc(String(title).slice(22, 50))}</text>
<rect x="80" y="${760 + (n % 3) * 30}" width="${520 + (n % 4) * 90}" height="260" rx="32" fill="${ac}" opacity=".14"/>
<circle cx="${300 + (n % 5) * 110}" cy="${900 + (n % 3) * 30}" r="90" fill="none" stroke="${ac}" stroke-width="10"/>
<text x="1000" y="1260" font-family="Cairo,Tahoma,sans-serif" font-size="34" font-weight="700" text-anchor="end" fill="${tp.ink}">${esc(name || '')}</text>
<text x="80" y="1260" font-family="Cairo,Tahoma,sans-serif" font-size="30" fill="${tp.ink}" opacity=".6">${esc(handle || '')} ${esc(tp.id)} ${esc(v)}</text></svg>`;
}
function avatarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#c9d6f2"/><circle cx="400" cy="330" r="150" fill="#e8c4a0"/><rect x="190" y="520" width="420" height="480" rx="200" fill="#2f6bed"/><circle cx="345" cy="320" r="14" fill="#161b29"/><circle cx="455" cy="320" r="14" fill="#161b29"/><path d="M350 390 q50 40 100 0" stroke="#161b29" stroke-width="10" fill="none"/></svg>`;
}
function previewHtml({ template, index, lang }) {
  const id = db.identity;
  const tp = tplOf(template || id.template);
  const titles = lang === 'en' ? ['5 mistakes that slow React', 'Point one', 'Save this post'] : ['5 أخطاء بتبطّئ React', 'النقطة الأولى', 'احفظ البوست'];
  const photo = db.photo ? `<img src="/files/brand/${id.photo}?v=${db.photo.v}" style="position:absolute;inset-block-end:0;inset-inline-start:80px;width:420px;height:560px;object-fit:cover;object-position:${id.facePos};border-radius:40px 40px 0 0">` : '';
  return `<!doctype html><html dir="${lang === 'en' ? 'ltr' : 'rtl'}"><head><meta charset="utf-8"><style>
@font-face{font-family:Cairo;src:url(/engine/fonts/cairo/Cairo-Variable.woff2)}
html,body{margin:0;width:1080px;height:1350px;overflow:hidden}
body{background:${tp.id === 'gradient' ? 'linear-gradient(135deg,#2a1b5e,#1b3f9e)' : tp.bg};${tp.id === 'editorial' ? `background-image:radial-gradient(${tp.ink}22 2px,transparent 2px);background-size:36px 36px;` : ''}color:${tp.ink};font-family:Cairo,Tahoma,sans-serif;position:relative}
.n{position:absolute;inset-block-start:80px;inset-inline-start:80px;background:${id.accent || tp.accent};color:#fff;border-radius:40px;padding:6px 28px;font-size:30px;font-weight:700}
h1{position:absolute;inset-block-start:340px;inset-inline:80px;margin:0;font-size:${index ? 84 : 110}px;line-height:1.2;font-weight:800}
h1 b{color:${id.accent || tp.accent}}
.who{position:absolute;inset-block-end:80px;inset-inline-end:80px;text-align:end;font-size:34px;font-weight:700}
.who small{display:block;font-size:26px;font-weight:400;opacity:.7}
</style></head><body><div class="n">${Number(index) + 1}/8</div><h1>${esc(titles[index] || titles[0]).replace(/(React|البوست)/, '<b>$1</b>')}</h1>${index == 0 ? photo : ''}<div class="who">${esc(id.name)}<small>${esc(id.handle)} · ${esc(id.role)}</small></div></body></html>`;
}

/* ---------------- helpers ---------------- */
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const json = (res, body, status = 200) => send(res, status, body);
const err = (res, status, error, msg) => json(res, { error, msg }, status);
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
async function readJson(req) { const b = await readBody(req); if (!b.length) return {}; try { return JSON.parse(b.toString('utf8')); } catch { return {}; } }
const findIdea = (id) => db.ideas.find((i) => i.id === id);
const touch = (i) => { i.updated = today(); };

let current = null; // { kind, cancelled }
async function sse(req, res, kind, name, steps) {
  if (db.busy[kind] || db.forceBusy[kind]) return err(res, 409, 'busy', kind === 'claude' ? 'Claude is busy with another task.' : 'Renderer is busy.');
  if (kind === 'claude' && !(db.claude.installed && db.claude.loggedIn)) return err(res, 503, 'claude_unavailable', 'Claude is not connected.');
  db.busy[kind] = true;
  const run = { kind, cancelled: false };
  current = run;
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const emit = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  req.on('close', () => { run.cancelled = true; });
  const started = Date.now();
  let ok = true; let errorMsg;
  try {
    const fail = db.failNext.has(name); db.failNext.delete(name);
    for (const step of steps) {
      if (run.cancelled) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
      if (fail && step.failHere) throw Object.assign(new Error('Validation failed twice: slide 3 "title" has 9 words (max 6).'), { code: 'validate_failed' });
      if (step.fn) await step.fn(emit, run);
      else { emit(step.event, step.data); await sleep(step.wait ?? 250); }
    }
  } catch (e) {
    ok = false; errorMsg = e.message;
    emit('error', { code: e.code || 'failed', msg: e.message });
  } finally {
    db.busy[kind] = false;
    if (current === run) current = null;
    db.log.push({ ts: new Date().toISOString(), task: name, ms: Date.now() - started, ok, error: errorMsg });
    res.end();
  }
}
const streamText = (text, chunk = 6, wait = 40) => async (emit, run) => {
  for (let i = 0; i < text.length && !run.cancelled; i += chunk) { emit('text', { delta: text.slice(i, i + chunk) }); await sleep(wait); }
};
const renderSteps = (id, total, only) => async (emit, run) => {
  emit('phase', { phase: 'render', msg: '' });
  const list = only || Array.from({ length: total }, (_, i) => i + 1);
  for (let k = 0; k < list.length && !run.cancelled; k++) {
    await sleep(350);
    db.preview[id] = { ...(db.preview[id] || {}), n: total, v: Date.now() };
    emit('progress', { n: list[k], total, file: `preview/${id}/${String(list[k]).padStart(2, '0')}.png` });
  }
};

/* ---------------- routes ---------------- */
async function api(req, res, url) {
  const p = url.pathname;
  const m = (re) => re.exec(p);
  const method = req.method;
  let r;

  if (p === '/api/state' && method === 'GET') return json(res, { settings: db.settings, identity: db.identity, claude: db.claude, ideasCount: db.ideas.length, busy: { claude: db.busy.claude || db.forceBusy.claude, render: db.busy.render || db.forceBusy.render } });
  if (p === '/api/settings') { if (method === 'PUT') db.settings = { ...db.settings, ...(await readJson(req)) }; return json(res, db.settings); }
  if (p === '/api/brand/identity') { if (method === 'PUT') db.identity = { ...db.identity, ...(await readJson(req)) }; return json(res, db.identity); }
  if (p === '/api/brand/accounts') { if (method === 'PUT') db.accounts = await readJson(req); return json(res, db.accounts); }
  if ((r = m(/^\/api\/brand\/doc\/(profile|analysis|voice)$/))) {
    if (method === 'PUT') { const b = await readJson(req); db.docs[r[1]] = { text: String(b.text || ''), updated: new Date().toISOString() }; }
    return json(res, db.docs[r[1]] || { text: '', updated: null });
  }
  if (p === '/api/brand/photo' && method === 'POST') {
    const buf = await readBody(req);
    if (buf.length > 8 * 1024 * 1024) return err(res, 413, 'too_large', 'Image is larger than 8 MB.');
    const ct = req.headers['content-type'] || '';
    if (!/image\/(jpeg|png)/.test(ct)) return err(res, 415, 'bad_type', 'Only JPG or PNG.');
    db.photo = { buf, ct, v: Date.now() };
    db.identity.photo = ct.includes('png') ? 'photo.png' : 'photo.jpg';
    return json(res, { photo: db.identity.photo });
  }
  if (p === '/api/brand/analyze' && method === 'POST') {
    const body = await readJson(req);
    const txt = '## الجمهور\n\n- مطورين مبتدئين (18–28) بالعالم العربي\n- بيدوروا على أول وظيفة أو أول عميل\n\n## المحاور\n\n1. React عملي\n2. فريلانس\n3. أدوات وإنتاجية\n4. أخطاء المبتدئين\n5. قصص من الشغل\n\n## نقاط القوة\n\nشرح بسيط بأمثلة حقيقية.' + (body.extra ? `\n\n## من المواد الإضافية\n\n${body.extra.slice(0, 200)}` : '');
    return sse(req, res, 'claude', 'analyze', [
      { event: 'phase', data: { phase: 'claude', msg: '' }, wait: 150 },
      { event: 'tool', data: { name: 'Read', path: 'brand/profile.md' }, wait: 200 },
      { event: 'tool', data: { name: 'Read', path: 'brand/accounts.json' }, wait: 200 },
      { failHere: true, fn: streamText(txt) },
      { event: 'tool', data: { name: 'Write', path: 'brand/analysis.md' }, wait: 150, },
      { fn: async () => { db.docs.analysis = { text: txt, updated: new Date().toISOString() }; db.docs.voice = { text: '## قواعد الصوت\n\n- شامي خفيف\n- جمل قصيرة\n- رقم بالافتتاحية\n- لا إيموجي بالعناوين', updated: new Date().toISOString() }; } },
      { event: 'done', data: { result: { ok: true } }, wait: 0 },
    ]);
  }
  if (p === '/api/templates') return json(res, TEMPLATES.map(({ bg, ink, accent, ...t }) => t));
  if (p === '/api/fonts') return json(res, [{ id: 'cairo', name: 'Cairo', family: 'Cairo' }, { id: 'tajawal', name: 'Tajawal', family: 'Tajawal' }, { id: 'readex', name: 'Readex Pro', family: 'Readex Pro' }]);
  if (p === '/api/preview/slide') return send(res, 200, previewHtml({ template: url.searchParams.get('template'), index: Number(url.searchParams.get('index') || 0), lang: url.searchParams.get('lang') || 'ar' }), 'text/html; charset=utf-8');
  if (p === '/api/preview/deck-slide') return send(res, 200, previewHtml({ template: null, index: Number(url.searchParams.get('index') || 0), lang: 'ar' }), 'text/html; charset=utf-8');

  if (p === '/api/ideas' && method === 'GET') return json(res, { ideas: db.ideas });
  if (p === '/api/ideas' && method === 'POST') {
    const b = await readJson(req);
    if (!b.title || !String(b.title).trim()) return err(res, 400, 'bad_request', 'title is required');
    const idea = mkIdea(`i_${today().replace(/-/g, '')}_${Math.random().toString(36).slice(2, 6)}`, String(b.title).trim(), 'raw', { note: b.note || '', pillar: b.pillar || '', created: today(), updated: today() });
    db.ideas.unshift(idea);
    return json(res, idea);
  }
  if (p === '/api/ideas/reorder' && method === 'POST') {
    const { ids = [] } = await readJson(req);
    db.ideas.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return json(res, { ok: true });
  }
  if (p === '/api/ideas/suggest' && method === 'POST') {
    const add = ['3 علامات إنك جاهز لأول وظيفة', 'كيف تكتب README بيبيع مشروعك', 'أسئلة مقابلات React الأشهر'];
    return sse(req, res, 'claude', 'suggest', [
      { event: 'phase', data: { phase: 'claude', msg: '' }, wait: 150 },
      { event: 'tool', data: { name: 'Read', path: 'brand/analysis.md' }, wait: 200 },
      { failHere: true, fn: streamText(JSON.stringify(add.map((t) => ({ title: t })), null, 1), 8, 30) },
      { fn: async () => { for (const t of add) db.ideas.push(mkIdea(`i_${today().replace(/-/g, '')}_${Math.random().toString(36).slice(2, 6)}`, t, 'raw', { source: 'claude', pillar: 'React عملي' })); } },
      { event: 'done', data: { result: { added: add.length } }, wait: 0 },
    ]);
  }
  if ((r = m(/^\/api\/ideas\/([^/]+)\/polish$/)) && method === 'POST') {
    const idea = findIdea(r[1]); if (!idea) return err(res, 404, 'not_found', 'Idea not found');
    return sse(req, res, 'claude', 'polish', [
      { event: 'phase', data: { phase: 'claude', msg: '' }, wait: 150 },
      { failHere: true, fn: streamText('{"hook":"3 أرقام بتغيّر طريقة تفكيرك","outline":["الفكرة","المثال","الخطأ الشائع","الحل","الخلاصة"]}') },
      { fn: async () => { Object.assign(idea, { hook: `3 أرقام عن: ${idea.title.slice(0, 30)}`, outline: ['الفكرة', 'المثال', 'الخطأ الشائع', 'الحل', 'الخلاصة'], status: 'ready' }); touch(idea); } },
      { event: 'done', data: { result: { idea } }, wait: 0 },
    ]);
  }
  if ((r = m(/^\/api\/ideas\/([^/]+)$/))) {
    const idea = findIdea(r[1]); if (!idea) return err(res, 404, 'not_found', 'Idea not found');
    if (method === 'PATCH') { Object.assign(idea, await readJson(req)); touch(idea); return json(res, idea); }
    if (method === 'DELETE') { db.ideas = db.ideas.filter((i) => i !== idea); return json(res, { ok: true }); }
  }

  if ((r = m(/^\/api\/factory\/([^/]+)(?:\/(\w+))?$/))) {
    const idea = findIdea(r[1]); if (!idea) return err(res, 404, 'not_found', 'Idea not found');
    const id = idea.id; const action = r[2];
    const pv = db.preview[id];
    if (!action && method === 'GET') {
      return json(res, { idea, deck: db.decks[id] || null, preview: { files: pv ? Array.from({ length: pv.n }, (_, i) => `preview/${id}/${String(i + 1).padStart(2, '0')}.png`) : [], sheet: pv ? `preview/${id}/_sheet.jpg` : null, overflow: pv && pv.overflow ? [{ slide: 3, text: 'العنوان طويل وطالع برا الكرت' }] : [] }, history: db.history[id] || [] });
    }
    const snap = () => { (db.history[id] ||= []).push({ version: new Date().toISOString().replace(/[:.]/g, '-'), date: new Date().toISOString() }); };
    if (action === 'draft' && method === 'POST') {
      const prev = idea.status;
      const deckText = JSON.stringify(sampleDeck(idea), null, 2);
      return sse(req, res, 'claude', 'draft', [
        { fn: async () => { idea.prevStatus = prev; idea.status = 'drafting'; } },
        { event: 'phase', data: { phase: 'claude', msg: '' }, wait: 150 },
        { event: 'tool', data: { name: 'Read', path: 'brand/voice.md' }, wait: 200 },
        { event: 'tool', data: { name: 'Read', path: '.claude/skills/sahba-carousel/SKILL.md' }, wait: 200 },
        { fn: streamText(deckText, 24, 25) },
        { event: 'tool', data: { name: 'Write', path: `decks/${id}.json` }, wait: 150 },
        { event: 'phase', data: { phase: 'validate', msg: '' }, wait: 400 },
        { failHere: true, event: 'phase', data: { phase: 'retry', msg: 'Slide 4: title too long — sending back to Claude' }, wait: 300 },
        { fn: streamText('Fixed slide 4 title.', 4, 40) },
        { event: 'phase', data: { phase: 'validate', msg: '' }, wait: 300 },
        { fn: async () => { db.decks[id] = sampleDeck(idea); idea.deck = `decks/${id}.json`; snap(); } },
        { fn: renderSteps(id, 8) },
        ...(db.settings.visualQA ? [{ event: 'phase', data: { phase: 'qa', msg: '' }, wait: 600 }] : []),
        { fn: async () => { db.preview[id] = { n: 8, v: Date.now(), overflow: true }; idea.status = 'preview'; touch(idea); } },
        { event: 'phase', data: { phase: 'done', msg: '' }, wait: 50 },
        { event: 'done', data: { result: { files: 8 } }, wait: 0 },
      ]).finally(() => { if (idea.status === 'drafting') idea.status = idea.prevStatus || 'ready'; });
    }
    if (action === 'revise' && method === 'POST') {
      const b = await readJson(req);
      const only = [...new Set((b.comments || []).map((c) => Number(c.slide)).filter(Boolean))];
      return sse(req, res, 'claude', 'revise', [
        { event: 'phase', data: { phase: 'claude', msg: '' }, wait: 150 },
        { failHere: true, fn: streamText(`Applying ${b.comments?.length || 0} comments${b.general ? ' + general note' : ''}…`, 5, 40) },
        { event: 'phase', data: { phase: 'validate', msg: '' }, wait: 300 },
        { fn: async () => { snap(); } },
        { fn: renderSteps(id, 8, only.length ? only : null) },
        { fn: async () => { db.preview[id] = { ...db.preview[id], overflow: false }; } },
        { event: 'done', data: { result: { changed: only } }, wait: 0 },
      ]);
    }
    if (action === 'rerender' && method === 'POST') {
      const b = await readJson(req);
      return sse(req, res, 'render', 'rerender', [
        { fn: async () => { if (b.template && db.decks[id]) db.decks[id].template = b.template; } },
        { failHere: true, fn: renderSteps(id, 8) },
        { event: 'done', data: { result: { ok: true } }, wait: 0 },
      ]);
    }
    if (action === 'deck' && method === 'PUT') { const b = await readJson(req); if (!db.decks[id]) return err(res, 404, 'not_found', 'No deck yet'); db.decks[id].caption = String(b.caption ?? ''); snap(); return json(res, db.decks[id]); }
    if (action === 'restore' && method === 'POST') { const b = await readJson(req); if (!(db.history[id] || []).some((h) => h.version === b.version)) return err(res, 404, 'not_found', 'Version not found'); return json(res, db.decks[id]); }
    if (action === 'export' && method === 'POST') {
      const dir = `exports/${today()}_${id.slice(-4)}`;
      return sse(req, res, 'render', 'export', [
        { fn: renderSteps(id, 8) },
        { event: 'phase', data: { phase: 'export', msg: '' }, wait: 500 },
        { failHere: true, fn: async () => { idea.exported = dir; idea.status = 'exported'; touch(idea); } },
        { event: 'phase', data: { phase: 'done', msg: '' }, wait: 50 },
        { event: 'done', data: { result: { dir, files: 8 } }, wait: 0 },
      ]);
    }
    if (action === 'open' && method === 'POST') return idea.exported ? json(res, { ok: true }) : err(res, 400, 'not_exported', 'Nothing exported yet.');
  }
  if (p === '/api/cancel' && method === 'POST') { const b = await readJson(req); if (current && (!b.kind || current.kind === b.kind)) current.cancelled = true; return json(res, { ok: true }); }
  if (p === '/api/gallery') return json(res, db.ideas.filter((i) => i.exported).map((i) => ({ id: i.id, title: i.title, dir: i.exported, cover: `${i.exported}/01.png`, date: i.updated, count: 8, published: i.published })));
  if (p === '/api/doctor') {
    await sleep(400);
    return json(res, { checks: [
      { id: 'node', ok: true, detail: 'v22.11.0', fix: '' },
      { id: 'chrome', ok: true, detail: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', fix: '' },
      { id: 'claude', ok: db.claude.installed, detail: db.claude.installed ? `claude ${db.claude.version}` : 'not found on PATH', fix: 'npm install -g @anthropic-ai/claude-code' },
      { id: 'claudeLogin', ok: db.claude.loggedIn, detail: db.claude.loggedIn ? 'subscription' : 'not logged in', fix: 'Run `claude` in a terminal and sign in.' },
      { id: 'disk', ok: true, detail: '120 GB free', fix: '' },
      { id: 'workspace', ok: true, detail: 'D:\\Sahba\\workspace', fix: '' },
    ] });
  }
  if (p === '/api/log') return json(res, db.log.slice(-Number(url.searchParams.get('limit') || 100)));
  return err(res, 404, 'not_found', `No route ${method} ${p}`);
}

function mock(req, res, url) {
  const q = url.searchParams;
  if (url.pathname === '/_mock/reset') { reset(); return json(res, { ok: true }); }
  if (url.pathname === '/_mock/claude') { const s = q.get('state'); db.claude = { installed: s !== 'missing', loggedIn: s === 'ok', version: s === 'missing' ? null : '2.1.0' }; return json(res, db.claude); }
  if (url.pathname === '/_mock/fail') { db.failNext.add(q.get('next')); return json(res, { fail: [...db.failNext] }); }
  if (url.pathname === '/_mock/busy') { db.forceBusy[q.get('kind') || 'claude'] = q.get('on') === '1'; return json(res, db.forceBusy); }
  if (url.pathname === '/_mock/onboarded') { db.settings.onboarded = q.get('v') === '1'; return json(res, db.settings); }
  if (url.pathname === '/_mock/empty') { db.ideas = []; return json(res, { ok: true }); }
  return err(res, 404, 'not_found', 'mock');
}

function files(req, res, url) {
  const rel = decodeURIComponent(url.pathname.slice('/files/'.length));
  if (rel.startsWith('brand/photo')) {
    if (db.photo) return send(res, 200, db.photo.buf, db.photo.ct);
    return send(res, 200, avatarSvg(), 'image/svg+xml');
  }
  let m2 = /^preview\/([^/]+)\/(\d+)\.png$/.exec(rel);
  if (m2) {
    const idea = findIdea(m2[1]); const deck = db.decks[m2[1]];
    const n = Number(m2[2]);
    const title = n === 1 ? (idea?.hook || idea?.title) : `${deck?.slides?.[n - 1]?.title || 'النقطة'} — شرح قصير`;
    return send(res, 200, slideSvg({ n, total: 8, title, template: deck?.template || db.identity.template, accent: db.identity.accent, name: db.identity.name, handle: db.identity.handle, v: String(db.preview[m2[1]]?.v || '').slice(-4) }), 'image/svg+xml');
  }
  m2 = /^exports\/[^/]+\/(\d+)\.png$/.exec(rel);
  if (m2) {
    const idea = db.ideas.find((i) => i.exported && rel.startsWith(i.exported));
    return send(res, 200, slideSvg({ n: 1, total: 8, title: idea?.hook || idea?.title || 'كاروسيل', template: db.decks[idea?.id]?.template || 'editorial', accent: db.identity.accent, name: db.identity.name, handle: db.identity.handle }), 'image/svg+xml');
  }
  return err(res, 404, 'not_found', 'file');
}

function staticFile(res, base, rel) {
  const fp = path.resolve(base, '.' + path.sep + rel);
  if (!fp.startsWith(base)) return err(res, 403, 'forbidden', '');
  fs.stat(fp, (e, st) => {
    if (e || !st.isFile()) return err(res, 404, 'not_found', rel);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/_mock/')) return mock(req, res, url);
    if (url.pathname.startsWith('/files/')) return files(req, res, url);
    if (url.pathname.startsWith('/engine/')) return staticFile(res, ROOT, decodeURIComponent(url.pathname));
    if (url.pathname.startsWith('/templates/')) {
      const tm = /^\/templates\/([^/]+)\/preview\.png$/.exec(url.pathname);
      if (tm && TEMPLATES.find((t) => t.id === tm[1] && t.preview)) return send(res, 200, slideSvg({ n: 1, total: 8, title: tplOf(tm[1]).name.ar, template: tm[1], name: db.identity.name, handle: db.identity.handle }), 'image/svg+xml');
      return err(res, 404, 'not_found', 'template preview');
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname);
    if (rel.includes('_dev')) return err(res, 404, 'not_found', '');
    return staticFile(res, PUBLIC, rel);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) err(res, 500, 'internal', e.message);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`mock sahba on http://127.0.0.1:${PORT}`));
