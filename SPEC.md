# Sahba — Shared Contracts (SPEC)

> مصدر الحقيقة للعقود بين أجزاء المنتج. أي جزء يتكلم مع جزء ثاني يلتزم بهالملف حرفياً.
> PLAN.md = الشرح والقرارات. SPEC.md = الواجهات والصيغ. لو تعارضوا، SPEC يغلب.

## 0) قواعد عامة
- Node ≥ 22، ES modules (`.mjs`)، **صفر npm dependencies** بكل المنتج.
- Windows + macOS. لا مسارات مثبّتة، لا أسماء أشخاص بالكود.
- ROOT = مجلد المنتج. WORKSPACE = `process.env.SAHBA_WORKSPACE` أو `ROOT/workspace`. داتا تجريبية: `ROOT/demo/workspace`.
- كل الكتابات على الملفات ذرّية (اكتب `.tmp` ثم rename).
- التواريخ `YYYY-MM-DD` بتوقيت الجهاز المحلي.

## 1) ملكية الملفات
| المالك | الملفات |
|---|---|
| engine | `engine/**`, `templates/**` |
| server | `app/server.mjs`, `app/server/**`, `app/tests/**` |
| ui | `app/public/**` |
| content | `.claude/**`, `CLAUDE.md`, `README.md`, `README.en.md`, `demo/**`, `start.bat`, `start.command`, `.gitignore` |

## 2) Workspace
```
workspace/
├── settings.json          ← إعدادات المستخدم (§3)
├── brand/
│   ├── identity.json      ← §3
│   ├── accounts.json      ← §3
│   ├── profile.md         ← إجابات التعريف (markdown حر)
│   ├── analysis.md        ← تحليل Claude
│   ├── voice.md           ← قواعد الصوت
│   └── photo.jpg          ← (أو .png) الصورة الشخصية
├── ideas/ideas.json       ← { "ideas": [Idea...] }
├── decks/<ideaId>.json    ← Deck (§4)
├── decks/<ideaId>.history/<ISO-timestamp>.json
├── preview/<ideaId>/      ← 01.png … NN.png + _sheet.jpg
├── exports/<YYYY-MM-DD_slug>/  ← 01.png … NN.png + caption.txt + _sheet.jpg
└── logs/hot.md · logs/runs.jsonl
```

## 3) ملفات الإعداد
```jsonc
// brand/identity.json
{ "name": "سارة المطورة", "handle": "@sara.dev", "role": "Frontend Developer · React",
  "photo": "photo.jpg", "facePos": "50% 28%",
  "template": "editorial",                // القالب الأساسي
  "accent": "#2f6bed",                    // اختياري: يطغى على أكسنت القالب
  "font": "cairo" }                       // من engine/fonts (§5.4)

// brand/accounts.json
{ "instagram": {"url":"", "bio":""}, "facebook": {"url":"","bio":""}, "youtube": {"url":"","bio":""},
  "linkedin": {"url":"","bio":""}, "tiktok": {"url":"","bio":""} }

// settings.json
{ "uiLang": "ar", "slidesDefault": 8, "hashtags": 5, "category": "", "visualQA": true, "onboarded": false }
```

## 4) Idea و Deck
```jsonc
// Idea
{ "id": "i_20261102_ab12", "title": "", "note": "", "pillar": "",
  "status": "raw",   // raw | ready | drafting | preview | approved | exported | published
  "source": "me",    // me | claude
  "outline": [],     // نقاط الهيكل بعد «صقّل» (strings)
  "hook": "",        // افتتاحية بعد «صقّل»
  "template": null,  // يطغى على identity.template
  "created": "2026-11-02", "updated": "2026-11-02",
  "deck": null,      // "decks/<id>.json" لما ينكتب
  "exported": null,  // "exports/<dir>" بعد التصدير
  "published": null, // { "date": "", "url": "" }
  "prevStatus": null // تُستخدم للاستعادة بعد انقطاع أثناء drafting
}

// Deck  (بلا أي حقل حركة: mode/dur ممنوعين)
{ "slug": "2026-11-02_topic", "category": "فريلانس", "template": "editorial",
  "caption": "Hook\n\n...\n\nCTA\n\n#a #b #c #d #e",
  "slides": [ { "kind": "cover", ... }, ..., { "kind": "cta", ... } ] }
```
أنواع السلايدات والحقول: `engine/KINDS.md`
(`cover point list quote stat bars compare sites pick rule steps code cta`)، التكوينات `window orbit stack`،
الماركب `{b} {c} {l} {m} <br>`. التفصيل النهائي = `engine/KINDS.md` (يكتبه engine).

## 5) Engine API — `engine/index.mjs`
```js
export function listKinds(): string[]
export function listIcons(): string[]                     // أسماء PascalCase المتاحة
export function listTemplates(): Promise<Template[]>      // من templates/*/template.json
// Template = { id, name:{ar,en}, desc:{ar,en}, fits:{ar,en}, preview: "templates/<id>/preview.png" }
export function listFonts(): {id, name, family}[]

export function validateDeck(deck): { ok: boolean, errors: Issue[], warnings: Issue[] }
// Issue = { slide: number|null (1-based), field: string|null, code: string, msg: string }  (msg إنجليزي واضح لـ Claude)

export function buildSlideHtml({ deck, index, identity, template, assetBase, photoUrl }): string
// index 0-based · assetBase = URL جذر engine/ (file:// للرسم، "/engine/" للمعاينة بالسيرفر)
// photoUrl = رابط الصورة · ترجع وثيقة HTML كاملة 1080×1350

export function sampleDeck(lang = 'ar'): Deck              // ديك تجريبي ثابت لمعاينة القوالب والهوية

export async function renderDeck({ deck, workspaceDir, outDir, only, template, onProgress, signal }):
  Promise<{ files: string[], sheet: string, overflow: {slide:number, text:string}[] }>
// onProgress({ n, total, file }) · signal = AbortSignal · only = [1-based] · يكتب 01.png… + _sheet.jpg
```
- CLI: `node engine/render.mjs <deck.json> --workspace <dir> --out <dir> [--only 2,5] [--template id]`
- المتصفح: Chrome/Edge من الجهاز (`CHROME` env أولاً، ثم مسارات Windows/macOS/Linux المعروفة) عبر CDP و`WebSocket` المدمج. لا puppeteer.
- `engine/fonts/<id>/` خطوط محلية woff2 + `fonts.json`. `engine/icons/*.svg` Lucide (ISC) + `icons.json`.
- `engine/CLASSES.md` = عقد الـDOM والـCSS variables اللي القوالب بتعتمد عليه.

## 6) Server API — `app/server.mjs` على `127.0.0.1:${PORT||8900}`
- حراسة Host/Origin (localhost فقط). JSON = `application/json`. أخطاء = `{ error: "code", msg }`.
- طوابير: Claude تشغيل واحد بالمرة، الرسم تشغيل واحد بالمرة. `409 {error:"busy"}` لو مشغول.

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/api/state` | | `{ settings, identity, claude:{installed,loggedIn,version}, ideasCount, busy:{claude,render} }` |
| GET/PUT | `/api/settings` | settings | settings |
| GET/PUT | `/api/brand/identity` | identity | identity |
| GET/PUT | `/api/brand/accounts` | accounts | accounts |
| GET/PUT | `/api/brand/doc/:name` | name ∈ profile·analysis·voice · body `{text}` | `{text, updated}` |
| POST | `/api/brand/photo` | raw image bytes (Content-Type image/jpeg·png) ≤ 8MB | `{ photo }` |
| POST | `/api/brand/analyze` | `{ extra?: string }` | **SSE** ← يكتب analysis.md + voice.md |
| GET | `/api/templates` | | `Template[]` |
| GET | `/api/fonts` | | fonts |
| GET | `/api/preview/slide` | `?template=&index=&lang=` (sampleDeck + identity) | `text/html` |
| GET | `/api/preview/deck-slide` | `?id=<ideaId>&index=` | `text/html` |
| GET | `/api/ideas` | | `{ ideas }` |
| POST | `/api/ideas` | `{ title, note?, pillar? }` | Idea |
| PATCH | `/api/ideas/:id` | partial Idea | Idea |
| DELETE | `/api/ideas/:id` | | `{ ok }` |
| POST | `/api/ideas/reorder` | `{ ids: [] }` | `{ ok }` |
| POST | `/api/ideas/suggest` | `{ count?: 10 }` | **SSE** ← يضيف أفكار source=claude |
| POST | `/api/ideas/:id/polish` | | **SSE** ← hook + outline، status=ready |
| GET | `/api/factory/:id` | | `{ idea, deck, preview:{files,sheet,overflow}, history:[{version,date}] }` |
| POST | `/api/factory/:id/draft` | `{ notes? }` | **SSE** ← Claude يكتب الديك ← validate (+retry مرة) ← render ← QA ← status=preview |
| POST | `/api/factory/:id/revise` | `{ comments:[{slide,text}], general? }` | **SSE** ← تعديل + render `--only` للمتغيّر |
| POST | `/api/factory/:id/rerender` | `{ template? }` | **SSE** ← رسم بلا Claude |
| PUT | `/api/factory/:id/deck` | `{ caption }` | deck |
| POST | `/api/factory/:id/restore` | `{ version }` | deck |
| POST | `/api/factory/:id/export` | | **SSE** ← exports/…، status=exported |
| POST | `/api/factory/:id/open` | | يفتح مجلد التصدير بمستكشف الملفات |
| POST | `/api/cancel` | `{ kind: "claude"|"render" }` | `{ ok }` |
| GET | `/api/gallery` | | `[{ id, title, dir, cover, date, count, published }]` |
| GET | `/api/doctor` | | `{ checks:[{id, ok, detail, fix}] }` (node, chrome, claude, claudeLogin, disk, workspace) |
| GET | `/api/log` | `?limit=100` | آخر سطور runs.jsonl |
| GET | `/files/*` | مسار نسبي داخل WORKSPACE (safe) | الملف |
| GET | `/engine/*` | أصول engine (fonts/icons) | الملف |
| GET | `/*` | | `app/public/` (index.html للجذر) |

**SSE events** (`text/event-stream`):
`phase {phase, msg}` (phase ∈ claude·validate·retry·render·qa·export·done) ·
`text {delta}` (نص Claude المتدفق) · `tool {name, path?}` · `progress {n, total, file}` ·
`done {result}` · `error {code, msg}`.

### Claude CLI (server/claude.mjs)
```
claude -p --output-format stream-json --verbose --permission-mode default
  --allowedTools "<per-task list>" --append-system-prompt "<task system>"
  [--resume <sessionId>]
```
- cwd = ROOT · `--add-dir WORKSPACE` لو خارج ROOT · env بلا `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`.
- `CLAUDE_EXE` env للتجاوز (`.mjs` = stub يتشغّل بـ node) — للاختبارات.
- مهلة 300 ثانية · إلغاء = taskkill /T (Windows) أو SIGTERM لمجموعة العملية.
- الأدوات حسب المهمة: draft/revise = `Read,Write,Edit` محصورة بمسار الديك؛ analyze = `Read,Write,Edit` على brand/؛ suggest/polish = `Read` فقط والنتيجة JSON بآخر رد؛ qa = `Read` فقط.

## 7) UI (app/public)
- SPA بـ ES modules، hash routing: `#/me` `#/settings` `#/ideas` `#/factory/<id>` `#/gallery` `#/log` · أول تشغيل (`settings.onboarded=false`) ← `#/welcome`.
- `i18n/ar.json` و`en.json`: مفاتيح منقّطة مسطّحة (`"ideas.add": "أضف فكرة"`)، `t(key, vars)`. ولا نص ثابت بالـJS أو HTML.
- `<html dir lang>` حسب `settings.uiLang`. CSS بخصائص منطقية (`margin-inline-start`…) — لا left/right.
- `tokens.css` + `DESIGN.md`: كل القيم من tokens. وضع فاتح + غامق.
- كل عنصر تفاعلي فيه `data-testid`.
