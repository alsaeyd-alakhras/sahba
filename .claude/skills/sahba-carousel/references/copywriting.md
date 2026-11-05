# Copywriting — 80% of the result

The text is most of the carousel's value. These rules apply to every slide. The **voice** (dialect, pronouns, favourite words,
words to avoid, digit style) comes from `workspace/brand/voice.md` and overrides any example here.
The **audience and pillars** come from `workspace/brand/analysis.md` — write for that reader, about what they care about.

| Principle | In practice |
|---|---|
| **Specific hook** | The cover promises a result and opens curiosity. A concrete number ("٥ أدوات", "بـ٣٠ ثانية", "١٢ ساعة") beats vague talk. |
| **The creator's dialect** | Talk directly to one person (إنت/إنتِ per voice.md), imperative verbs, a creator's tone — not stiff formal Arabic (فصحى) unless voice.md says so. |
| **One idea per slide** | Title ≤ 6 words, body ≤ 2 lines. A slide with two ideas → split it. |
| **Concrete, not fluffy** | Numbers, examples, tools by name, a clear result. Cut intros, filler and throat-clearing. |
| **Rising tension** | Each slide opens curiosity for the next (cause → fix, problem → step). The order tells a story. |
| **CTA = one action** | Ask for one thing: save / comment a specific word / follow. A question that triggers a real comment. |

## Ready headline formulas
- «N أشياء…» — «٥ أخطاء بتخلّي موقعك بطيء»
- «ليش … ما بيشتغل» — «ليش بورتفوليوك ما بيجيب مقابلات»
- «الفرق بين X و Y»
- «متى تستخدم …»
- «وقّف تعمل X»
- «السر اللي محدا بيحكيلك ياه»
- «من X لـ Y بـ N» — «من ٩٠ دقيقة لـ ١٢»
Pick the strongest for the audience in `analysis.md`. Adapt the wording to the dialect in `voice.md`.

## Story skeletons (8 slides)
- **Listicle:** cover (N things) → quote (the pain) → stat (the cost) → point/list/steps (the things) → compare (before/after) → cta.
- **Case study:** cover (result) → rule/quote (the problem) → sites/compare (ordinary vs. better) → pick (the key decision) → steps (how) → bars/stat (proof) → cta.
- **Mistakes:** cover («وقّف…») → stat (how common/costly) → point ×N mixed with code/compare (each mistake + fix) → list (checklist) → cta.

## Avoid
- Formal/dry Arabic when the voice is dialect; long sentences; more than one idea per slide.
- Vague promises («رح تتغيّر حياتك»), hype words without proof.
- Invented statistics presented as facts. If you use a number, it comes from the idea/notes, is a clear example
  («مثال: ٩٠ دقيقة») or is the creator's own experience as stated in their notes.
- Repeating the same kind on two consecutive slides; repeating a composition.
- Writing the creator's name/handle into slides (the engine adds them).
- Emoji in slide text.

## Caption
```
Hook (the promise in one line; one emoji allowed at the end)

2–3 short lines of value: why it matters, what's inside.

ONE CTA (save / comment «كلمة» / follow)

#tag1 #tag2 #tag3 #tag4 #tag5   ← exactly settings.hashtags tags
```

## Mixed Arabic + English (bidi)
- Inside an Arabic sentence, avoid joining several English words with «و» or «،» (`React و API و Tests`) — the order flips on screen.
  Use one English term per phrase, or an Arabic word between them («React مع API»).
- Don't end a `{l}Label:{/l}` with an English word — the colon jumps to the wrong side. Prefer an Arabic label («{l}قائمة مهام:{/l}»).
