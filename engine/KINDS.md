# Deck & slide reference (engine contract)

Final field reference for `deck.json`. `validateDeck()` enforces everything marked **error**; **warning** items render but should be fixed.
Images only — **motion fields (`mode`, `dur`, `speed`) are errors.**

## Deck
```json
{ "slug": "2026-11-02_topic", "category": "Freelance", "template": "editorial", "lang": "ar",
  "caption": "Hook\n\n2–3 lines\n\nCTA\n\n#a #b #c #d #e",
  "slides": [ {"kind": "cover", ...}, ..., {"kind": "cta", ...} ] }
```
| field | | notes |
|---|---|---|
| `slides` | required | first = `cover`, last = `cta` (error); 7–9 slides recommended (warning outside 5–10) |
| `caption` | required | the post text; emoji allowed |
| `slug` | recommended | file-safe (`letters digits - _ .`); names the export folder |
| `category` | optional | badge on every slide |
| `template` | optional | template id; overrides `identity.template` |
| `lang` | optional | `"ar"` (default, RTL) or `"en"` (LTR) |

## Global rules
- Known `kind` only; never the same kind on two consecutive slides (error).
- Each art composition (`window`, `orbit`, `stack`) at most **once per deck** (error). A slide with `icons` but no `art` is `window`.
- `headline`/`title` ≤ **6 words** after removing markup (warning). Split lines yourself with `<br>` (~14 Arabic chars per line at title size).
- **No emoji** in `headline`, `title`, `kicker` (error) — use `icon` instead. Emoji are fine in `caption`, `prompt`, `body`.
- Every slide needs a graphic (error `no_graphic`). Most kinds draw one by design; only `list` needs you to add `icon` or item icons. `cover` must have `icons`.
- Icons: Lucide names in PascalCase (`Clock`, `FileText`, `Rocket`, `BadgeCheck` …), checked against `listIcons()` (error on unknown).
- Unknown fields → warning (ignored).

## Markup (any text field)
`{b}word{/b}` accent colour · `{c}word{/c}` hand-drawn circle (use once on cover, once on cta) · `{l}label{/l}` bold accent label ·
`{m}text{/m}` highlighter · `<br>` line break. Everything else is escaped (no HTML).

## Art compositions (`cover`, `point`, `quote` only)
| field | |
|---|---|
| `icons` | icon names (see counts) |
| `labels` | short texts (≤ 3 words each, warning) |
| `art` | `window` (default) · `orbit` · `stack` |
| `artAt` | `{ "left": px, "top": px, "scale": n }` — position of the 460×340 composition box (physical `left` on RTL, mirrored on LTR) |
| `arrow` | `false` hides the hand arrow (`window` only) |

| art | icons | labels | looks like | good for |
|---|---|---|---|---|
| `window` | 1–3 (ideal 3): main tile + 2 chips | 2 chip texts | tilted icon + app window + two floating chips | result, tool, "ready" |
| `orbit` | 3–6 (ideal 5): centre + satellites | 1 optional pill under it | icon on a dotted ring of icons | system, tools, integrations |
| `stack` | 1–3 (ideal 3) | 3 one-word card titles | three fanned cards, middle one highlighted | stages, options, types |

Defaults when `artAt` is absent: cover `{left:270, top:625, scale:1.15, arrow:false}` · point `{left:90, top:190, scale:.85}` · quote: centered under the text `{top:860, scale:.85}` (the quote text moves up to make room; setting `artAt.left` places it manually).
On `point`, `icons` moves the text block down (top 500) and the art sits above it — use `artAt` like `{"left":320,"top":150,"scale":0.8}` (stack) or `{"left":290,"top":110,"scale":0.95}` (orbit).

## Kinds
Required fields in **bold**.

### cover
`**headline**` `sub` `size` (font px, default 104; 96–104) `swipe` (override the swipe hint) + **art** (`icons` required).
Shows the creator's photo, name and handle from identity. No page number / handle footer.
```json
{"kind":"cover","headline":"{b}٧{/b} برومبتات<br>بتوفّرلك {c}ساعات{/c}","sub":"مش برومبتات كود","size":100,
 "icons":["Sparkles","Clock","FileText"],"labels":["١٢ ساعة أقل","عرض جاهز"]}
```

### point
`icon` (tile next to the kicker; without it a numbered tile is drawn) `number` (tile/ghost number, default = slide n−1) `kicker` **`title`** `body` + optional art.
```json
{"kind":"point","icon":"FileSignature","kicker":"برومبت ١","title":"العرض بدقيقة","body":"طلّع عرض فيه {l}المشكلة والنتيجة{/l}",
 "art":"stack","icons":["NotebookPen","FileSignature","Send"],"labels":["ملاحظات","العرض","ابعت"],"artAt":{"left":320,"top":150,"scale":0.8}}
```

### list
`icon` `kicker` **`title`** **`items`** (2–5; each `"text"` or `{"icon":"Name","t":"text"}`) `big` (bigger type/spacing).
Needs `icon` or at least one item icon.
```json
{"kind":"list","icon":"ListChecks","kicker":"برومبت ٢","title":"التسعير والمتابعة",
 "items":[{"icon":"Calculator","t":"{l}التسعير:{/l} ٣ باقات"},{"icon":"Send","t":"{l}المتابعة:{/l} رسالة قصيرة"}]}
```

### quote
**`quote`** `source` + optional art. The big quotation mark is the graphic.
```json
{"kind":"quote","quote":"الشغل التقني مش اللي بيرهقك.<br>اللي بيرهقك {m}الصفر{/m}.","source":"المشكلة الحقيقية"}
```

### stat
`icon` `kicker` **`value`** (number) `unit` (drawn before the number, LTR) `prefix` `fill` (bar %, default 100) `size` (number px, default 340) **`title`** `body`.
```json
{"kind":"stat","icon":"Hourglass","kicker":"الأرقام","value":12,"unit":"h","fill":70,"title":"ساعة بتضيّعها<br>على {b}الكتابة{/b}"}
```

### bars
`icon` `kicker` **`title`** **`items`** (2–5 × `{"label","value":number,"hot":true?}`) `suffix` (e.g. `" د"`, `"%"`) `body`. Bars scale to the max value.
```json
{"kind":"bars","icon":"Timer","kicker":"قبل وبعد","title":"وقت كتابة العرض","suffix":" د",
 "items":[{"label":"من الصفر","value":90},{"label":"ببرومبت جاهز","value":12,"hot":true}]}
```

### compare
**`title`** **`right`** `{title, items[]}` (the weaker/"before" side, white card) **`left`** `{title, items[]}` (the winner, accent card) `body`. 2–4 items per side.
```json
{"kind":"compare","title":"الفرق بينهم","right":{"title":"قبل","items":["كتابة من الصفر","رد متأخر"]},"left":{"title":"بعد","items":["قالب جاهز","رد بنفس اليوم"]}}
```

### sites
Two mini websites: plain (grey) vs branded. **`title`** **`plain`** (2–4 short strings) **`plainTag`** **`brand`** (2–4) **`brandTag`** `brandIcons` (one per brand row, default `Sparkles`) `heroIcon` `body`.
```json
{"kind":"sites","title":"حلو… بس ناقص {b}الروح{/b}","plain":["منيو","عنوان","صور"],"plainTag":"موقع عادي",
 "brand":["إحساس المكان","قصة واضحة"],"brandIcons":["Wind","BookOpen"],"heroIcon":"Coffee","brandTag":"موقع بهوية"}
```

### pick
Many faded, struck-through options and one highlighted choice. `icon` `kicker` **`title`** **`others`** (2–6 short strings) **`hot`** (1–3 words) `hotIcon` (default `Sparkles`) `body`.
```json
{"kind":"pick","icon":"Target","kicker":"الخطوة 2","title":"اختار {b}إحساساً{/b} واحداً","others":["فخامة","مرح","جرأة"],"hot":"هدوء وبساطة","hotIcon":"Wind"}
```

### rule
A rule sentence + a flow of 1–3 icons with arrows. `icon` (default `BadgeCheck`) `kicker` (default "القاعدة"/"The rule") **`quote`** **`flow`** (`[{"icon","t"}]`, first one highlighted) `source`.
```json
{"kind":"rule","kicker":"القاعدة","quote":"الموقع الجيد بيخلّيك<br>{b}تحس{/b} بالمكان","flow":[{"icon":"Heart","t":"تحس"},{"icon":"MapPin","t":"تزور"}]}
```

### steps
Numbered circles on a vertical line. `icon` `kicker` **`title`** **`items`** (2–5; string → ✓ in the circle, `{icon,t}` → icon) `big` `gap` (row distance px, default 150) `R` (circle radius px, default 56).
Keep each item to one line; for `big` use `"gap":210,"R":66`.
```json
{"kind":"steps","icon":"Wind","kicker":"القرار 3","title":"الحركة","big":true,"gap":210,"R":66,
 "items":[{"icon":"MoveHorizontal","t":"سكرول {l}أفقي{/l}"},{"icon":"Layers","t":"عناصر {l}بتتقابل{/l}"}]}
```

### code
Terminal window. `icon` `kicker` **`title`** **`lines`** (1–7 × `{"t":"text","k":"cmd|out|ok|err"}`, ≤ ~38 chars each) `body`. Lines are not markup-parsed.
```json
{"kind":"code","icon":"Terminal","kicker":"أداة","title":"سطر واحد بس","lines":[{"t":"$ npm run build","k":"cmd"},{"t":"✓ done in 1.2s","k":"ok"}]}
```

### cta
Always last. **`headline`** `prompt` `save` (string = custom save line · `true`/absent = default line · `false` = bookmark only).
Shows the large photo, handle, name and role from identity.
```json
{"kind":"cta","headline":"احفظ {c}البوست{/c}<br>ورجعله وقت الحاجة","prompt":"أي برومبت بتحتاجه؟ علّق 👇"}
```

## After rendering
`renderDeck()` returns `overflow: [{slide, text, reason}]`. Reasons start with:
`overflow-x` (a label/line is wider than its box) · `overflow-y` (too much content, runs into the badge/page-number area) ·
`outside` (text or art off the slide) · `overlap` (art composition covers text — move `artAt` or shorten).
