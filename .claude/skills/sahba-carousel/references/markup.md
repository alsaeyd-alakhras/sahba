# Inline markup

Works inside text fields (headline, sub, kicker, title, body, quote, source, items `t`, `compare` titles/items, `bars` labels, `hot`, `flow` `t`, prompt, save).
Not inside *plain* fields — there it shows as raw text: composition `labels`, `others`, `plain`, `brand`, `plainTag`, `brandTag`, `unit`, `prefix`, `suffix`, `swipe`, `code` lines.

| Markup | Look | Use for | Limit |
|---|---|---|---|
| `{b}word{/b}` | Accent color | The number in the hook, the key term | 1 per title |
| `{c}word{/c}` | Hand-drawn circle around it | The single most important word | **Once on cover, once on cta** — nowhere else. 1–2 words only. |
| `{l}Label:{/l}` | Bold accent label | Start of a list/steps item, a named concept in a body | 1 per item |
| `{m}phrase{/m}` | Highlighter marker | The punchline inside a body/quote/source | 1 per slide |
| `<br>` | New line | Break titles/quotes at a natural pause | — |

Rules:
- Tags never nest and never cross `<br>`: write `{b}٧{/b} برومبتات<br>{c}ساعات{/c}`, not `{b}٧ برومبتات<br>ساعات{/b}`.
- Every opening tag has its closing tag (`{b}`…`{/b}`).
- Don't mark more than ~30% of a sentence — emphasis on everything = emphasis on nothing.
- No emoji in slide text. Emoji only in `cta.prompt` and `caption`.
- Avoid raw `{` `}` characters in text (they look like markup). Write code inside `code` lines instead.

Examples:
```
"headline": "{b}٣{/b} أخطاء بتخلّي<br>موقعك {c}بطيء{/c}"
"body": "خد ملاحظات المكالمة، وطلّع عرض فيه {l}المشكلة والنتيجة{/l}"
"quote": "المشكلة مش بالأداة.<br>المشكلة إنك بتبدأ {m}من الصفر{/m} كل مرة."
"t": "{l}التسعير:{/l} ساعات كل مخرج + ٣ باقات"
```
