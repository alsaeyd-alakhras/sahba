# Slide kinds — field reference

> Reconciled with `engine/KINDS.md` (the engine's contract). If they ever disagree, **the engine wins** — read `engine/KINDS.md`.
> Validator levels: unknown kind / missing required field / bad type / unknown icon / repeated kind or art / emoji in headline·title·kicker / no graphic = **error**; >6-word titles, item counts, long code lines, unknown fields = **warning** (fix them anyway).
> All text fields accept markup (`references/markup.md`) unless marked *plain*. `?` = optional. Canvas = 1080×1350, RTL.

Common to most kinds: `icon?` (Lucide name → blue icon tile beside the kicker) · `kicker?` (small blue line above the title, 1–4 words).
The category badge, page number, progress bar and handle are drawn by the engine — never write them.

---

## `cover` — always slide 1
| field | type | notes |
|---|---|---|
| `headline` | string | The hook. ≤ 6 words, 2 lines with `<br>`. Use `{b}` on the number and `{c}` on one key word. |
| `sub` | string? | One short line under the headline (supporting angle). |
| `size` | number? | Headline font size 96–104 (default 104). Use 96 if a line is long. |
| `swipe` | string? | *plain* — the small "swipe" hint text (default from the template; omit it). |
| `icons` | string[] | **Required** — the cover always has a composition. Count per `art` (see art.md). |
| `labels` | string[]? | Composition labels. |
| `art` | `window`·`orbit`·`stack`? | Default `window`. |
| `artAt` | `{left, top, scale}`? | Move/scale the composition. Default ≈ `{left: 270, top: 625, scale: 1.15}`. |
| `arrow` | boolean? | `false` hides the hand arrow (cover default: no arrow). |
```json
{"kind":"cover","headline":"{b}٧{/b} برومبتات بتوفّر<br>{c}ساعات{/c} بكل مشروع","sub":"مش برومبتات كود — برومبتات شغل",
 "size":96,"icons":["Sparkles","Clock","FileText"],"labels":["١٢ ساعة أقل","عرض جاهز"]}
```

## `point` — one tip of a listicle
| field | type | notes |
|---|---|---|
| `icon` | string? | Icon tile. Without `icon`, a number tile is shown (still counts as the graphic). |
| `number` | string? | Override the auto number (default = slide index − 1, two digits). |
| `kicker` | string | e.g. «نصيحة ٢», «السبب ١». |
| `title` | string | ≤ 6 words. |
| `body` | string | ≤ 2 lines. |
| `icons` `labels` `art` `artAt` `arrow` | ? | Optional composition above the text (then the text moves down). Default `artAt` ≈ `{left: 90, top: 190, scale: 0.85}`; typical `{left: 300, top: 130, scale: 0.85}`. |
Without a composition, a giant faded number fills the background.
```json
{"kind":"point","icon":"FilePenLine","kicker":"برومبت ١","title":"العرض بدقيقة",
 "body":"خد ملاحظات المكالمة، وطلّع عرض فيه {l}المشكلة والنتيجة{/l}",
 "art":"stack","icons":["NotebookPen","FilePenLine","Send"],"labels":["ملاحظات","العرض","ابعت"],"artAt":{"left":320,"top":150,"scale":0.8}}
```

## `list` — 3–4 short items
| field | type | notes |
|---|---|---|
| `icon` `kicker` | ? | |
| `title` | string | |
| `items` | (string \| `{icon, t}`)[] | 3–4 items (2–5 allowed). Prefer `{icon, t}` objects. Start `t` with `{l}Label:{/l}`. A `list` needs `icon` **or** item icons (graphic rule). |
| `big` | boolean? | Bigger text and icons — use with 3 short items. |
```json
{"kind":"list","icon":"ListChecks","kicker":"برومبت ٢ و٣","title":"التسعير والمتابعة",
 "items":[{"icon":"Calculator","t":"{l}التسعير:{/l} ساعات كل مخرج + ٣ باقات"},{"icon":"Send","t":"{l}المتابعة:{/l} رسالة قصيرة بتعطيه سبب يرد"}]}
```

## `quote` — a strong sentence / the pain
| field | type | notes |
|---|---|---|
| `quote` | string | 2–4 short lines with `<br>`. `{m}` on the key phrase. |
| `source` | string? | Small line under it (who said it / what it is: «المشكلة الحقيقية»). |
| `icons` `labels` `art` `artAt` | ? | Optional small composition (the big quotation mark already counts as the graphic). Recommended when `art` is still unused in the deck. Default `artAt` ≈ `{left: 70, top: 900, scale: 0.6}`. |
```json
{"kind":"quote","quote":"الشغل التقني مش اللي بيرهقك.<br>اللي بيرهقك: العرض والتسعير<br>كل مرة من {m}الصفر{/m}.","source":"المشكلة الحقيقية",
 "art":"orbit","icons":["Frown","FileText","Calculator","Mail"],"artAt":{"left":330,"top":1040,"scale":0.5}}
```

## `stat` — one big number
| field | type | notes |
|---|---|---|
| `icon` `kicker` | ? | |
| `value` | number | **A JSON number**, not a string (12, 3.5). |
| `unit` | string? | *plain* — small unit drawn before the number on the LTR line (`h`, `%`, «د»). Omit if it reads oddly. |
| `prefix` | string? | Before the number (`+`, `$`). |
| `fill` | number? | 0–100: the progress bar under the number (default 100). |
| `size` | number? | Number font size (default 340). Lower it for 4+ digits. |
| `title` | string | What the number means. |
| `body` | string? | |
```json
{"kind":"stat","icon":"Hourglass","kicker":"الأرقام","value":12,"unit":"h","fill":70,"title":"ساعة بتضيّعها بالأسبوع<br>على {b}الكتابة{/b}","body":"بدل ما تشتغل على اللي بيتدفعلك عليه"}
```

## `bars` — numbers compared
| field | type | notes |
|---|---|---|
| `icon` `kicker` | ? | |
| `title` | string | |
| `items` | `{label, value, hot?}`[] | 2–4 bars (max 5). `value` = **number**. `hot: true` on the winner (one). |
| `suffix` | string? | *plain* — after each value (`" د"`, `"%"`). |
| `body` | string? | |
```json
{"kind":"bars","icon":"Timer","kicker":"قبل وبعد","title":"وقت كتابة العرض","suffix":" د",
 "items":[{"label":"من الصفر","value":90},{"label":"ببرومبت جاهز","value":12,"hot":true}],"body":"نفس الجودة — {m}أسرع بـ٧ مرات{/m}"}
```

## `compare` — before / after
| field | type | notes |
|---|---|---|
| `title` | string | |
| `right` | `{title, items[]}` | The **loser** (shown first in RTL, marked ✕). 2–4 items (3 is best), ≤ 4 words each. |
| `left` | `{title, items[]}` | The **winner** (blue card, marked ✓). |
| `body` | string? | |
```json
{"kind":"compare","title":"الفرق بينهم","right":{"title":"قبل","items":["كتابة من الصفر","رد متأخر","تسعير بالتخمين"]},
 "left":{"title":"بعد","items":["قالب جاهز","رد بنفس اليوم","تسعير بالأرقام"]}}
```

## `sites` — two mini websites: ordinary (grey) vs. distinctive (accent)
| field | type | notes |
|---|---|---|
| `title` | string | |
| `plain` | string[] | *plain* — 3 short lines (2–4) inside the grey site. |
| `plainTag` | string | *plain* — tag under the grey site («موقع عادي»). Required. |
| `brand` | string[] | *plain* — 3 short lines (2–4) inside the accent site. |
| `brandIcons` | string[]? | One icon per `brand` line (default `Sparkles`). |
| `heroIcon` | string? | Big icon in the accent site's hero (default `Coffee` — always set it). |
| `brandTag` | string | *plain* — tag under the accent site («موقع بهوية»). Required. |
| `body` | string? | |
```json
{"kind":"sites","title":"حلو… بس ناقص {b}الروح{/b}","plain":["منيو","عنوان","صور"],"plainTag":"موقع عادي",
 "brand":["إحساس المكان","قصة واضحة","تجربة بتتذكّرها"],"brandIcons":["Wind","BookOpen","Heart"],"heroIcon":"Coffee","brandTag":"موقع بهوية",
 "body":"نفس المعلومات — بس {m}الإحساس{/m} هو اللي بيفرّق"}
```

## `pick` — many faded options, one chosen
| field | type | notes |
|---|---|---|
| `icon` `kicker` | ? | |
| `title` | string | |
| `others` | string[] | *plain* — 3–5 rejected options (2–6 allowed), 1–2 words — shown faded and struck through. |
| `hot` | string | The chosen one, ≤ 3 short words (drawn very large). Required. |
| `hotIcon` | string? | Icon in the chosen pill (default `Sparkles` — set a meaningful one). |
| `body` | string? | |
```json
{"kind":"pick","icon":"Target","kicker":"الخطوة ٢","title":"اختار {b}إحساس{/b} واحد","others":["فخامة","مرح","جرأة","حماس"],
 "hot":"هدوء وبساطة","hotIcon":"Wind","body":"مش خمسة. واحد بس"}
```

## `rule` — the rule sentence + a cause → effect flow
| field | type | notes |
|---|---|---|
| `icon` | string? | Icon beside the kicker (default `BadgeCheck`). |
| `kicker` | string? | Default «القاعدة». |
| `quote` | string | The rule, 1–2 lines. |
| `flow` | `{icon, t}`[] | **2 steps** (1–3 allowed; 3 only if each `t` is one short word), joined by arrows. Both `icon` and `t` required. The first is highlighted. |
| `source` | string? | Line under the flow. |
```json
{"kind":"rule","icon":"Frown","kicker":"المشكلة","quote":"الهوية موجودة… بس كيف بتصير {b}لون وحركة{/b} على شاشة؟",
 "flow":[{"icon":"Coffee","t":"الهوية"},{"icon":"Globe","t":"الشاشة"}],"source":"إذا ما ترجمتها قرار قرار، {m}بتضيع بالطريق{/m}"}
```

## `steps` — a method, numbered on a vertical line
| field | type | notes |
|---|---|---|
| `icon` `kicker` | ? | |
| `title` | string | |
| `items` | (string \| `{icon, t}`)[] | 3–5 steps (2–5 allowed), one line each. |
| `big` | boolean? | Bigger text — for 3 steps. |
| `gap` | number? | Vertical distance between steps (default 150; ~210 with `big`). |
| `R` | number? | Step circle radius (default 56; ~66 with `big`). |
```json
{"kind":"steps","icon":"Wind","kicker":"القرار ٣","title":"الحركة","big":true,"gap":210,"R":66,
 "items":[{"icon":"MoveHorizontal","t":"كل العناصر بسكرول {l}أفقي{/l}"},{"icon":"Layers","t":"عناصر {l}بتتقابل{/l}"},{"icon":"Wind","t":"تنقّل {l}ناعم{/l} بين الأقسام"}]}
```

## `code` — a terminal / code window
| field | type | notes |
|---|---|---|
| `icon` `kicker` | ? | |
| `title` | string | |
| `lines` | `{t, k?}`[] | *plain* — 3–6 lines (max 7), **≤ 38 characters each** (LTR monospace; longer = cut). `k`: `cmd` (prompt `$`) · `out` (grey) · `ok` (green) · `err` (red). |
| `body` | string? | |
```json
{"kind":"code","icon":"Terminal","kicker":"الأداة","title":"سطر واحد بيكفي",
 "lines":[{"t":"npx create-vite my-app","k":"cmd"},{"t":"Scaffolding project...","k":"out"},{"t":"Done in 2.1s","k":"ok"}]}
```

## `cta` — always the last slide
| field | type | notes |
|---|---|---|
| `headline` | string | ≤ 6 words, 2 lines, one `{c}`. |
| `prompt` | string? | The single ask (comment a specific word / answer a question). Emoji allowed here. |
| `save` | string \| boolean? | Text beside the bookmark icon. Omit/`true` = template default («احفظ البوست…»), `false` = hide it. |
The creator's photo, handle, name and role are drawn automatically from `identity.json`.
```json
{"kind":"cta","headline":"احفظ {c}البوست{/c}<br>ورجعله مع أول عميل","prompt":"أي برومبت بتحتاجه أكثر؟ علّق بالرقم 👇"}
```
