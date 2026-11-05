# Template contract — DOM classes & CSS variables

A template is **data + CSS only**: `templates/<id>/template.json` + `style.css` (+ `preview.png`). No JS.
Layout lives in `engine/base.css`; templates change the look through variables and may restyle any class below.

## How a slide document is assembled
```html
<html lang="ar|en" dir="rtl|ltr">
<style> @font-face … (engine/fonts)   engine/base.css   :root{ template.json tokens }   :root{--font:…} </style>
<style data-template="<id>"> templates/<id>/style.css </style>
<style> identity overrides: --accent / --accent-dark / --accent-light (only if identity.accent is set) </style>
<body class="tpl-<id>"><div class="slide k-<kind>"> … </div></body>
```
Order = precedence: identity accent beats the template, the template beats base.
- Do **not** set `--font` in `style.css` — the font comes from `identity.font`, else `tokens.font` (a font id from `engine/fonts/fonts.json`), else `cairo`.
- CSS is inlined; a template cannot reference its own files by URL. Use CSS gradients/`data:` URIs for textures.
- Use `:root[dir=rtl] …` / `:root[dir=ltr] …` for direction-specific rules (several elements carry their own `dir="ltr"`).

## template.json
```json
{ "id": "editorial",
  "name": {"ar": "", "en": ""}, "desc": {"ar": "", "en": ""}, "fits": {"ar": "", "en": ""},
  "tokens": { "bg": "#F4F1EA", "ink": "#161b29", "accent": "#2f6bed", "accentDark": "#1d4ed8", "font": "cairo" } }
```
Every token except `font` becomes a CSS variable: camelCase → kebab-case (`accentDark` → `--accent-dark`). Any variable below can be a token.

## CSS variables (defaults in base.css)
| variable | role |
|---|---|
| `--bg` | slide background |
| `--ink` | main text (titles) |
| `--soft` | body text |
| `--mute` | secondary text (sub, prompt, card headers, role) |
| `--accent` | brand colour (tiles, badge, circle, bars, page number) — **identity.accent overrides it** |
| `--accent-dark` | `{b}` text, hot bar label |
| `--accent-light` | gradient end, stat unit, sparkles |
| `--on-accent` | text/icons on accent surfaces |
| `--grad` | accent surfaces (`linear-gradient(120deg, --accent, --accent-light)`) |
| `--card` / `--card-bar` | white cards & window title bars |
| `--term` / `--term-bar` | terminal (code kind) |
| `--dots`, `--glow1`, `--glow2` | background dot grid and the two soft glows |
| `--hair`, `--track`, `--shadow`, `--shadow-accent` | borders, empty bar tracks, shadows |
| `--w-title`, `--w-body` | title / body font weights |
| `--tile-radius` | icon-tile corner radius as a fraction of its size (.28) |
| `--mono` | monospace stack (code kind) |
| per element | `--s` (tile/photo size), `--r` (rotation), `--fs` (title font size), `--R` (steps circle radius), `--w/--h` (window), `--ring` (photo border) are set inline — read them, don't set them |

## Chrome (every slide)
| class | element |
|---|---|
| `.slide.k-<kind>` | 1080×1350 root |
| `.bg-dots`, `.bg-glow.g1`, `.bg-glow.g2` | background layers |
| `.corner-spark` > `svg.spark` | star in the top corner |
| `.badge > span` | category pill |
| `.progress > .progress-fill` | bottom progress bar |
| `.pageno > .pn-n, .pn-t` | "02 / 09" (not on cover) |
| `.handle` | identity handle (not on cover/cta) |
| `.photo` (img) / `.photo.photo-empty` (placeholder svg) | identity photo |
| `svg.bookmark`, `svg.swipe-arrow`, `svg.hand-arrow`, `svg.sparkle` | small drawings (paths styled via `fill`/`stroke`) |

## Shared pieces
| class | |
|---|---|
| `.content` | the main text column (absolute 210px…170px from top/bottom, 80px sides, centred vertically) |
| `.title` | big heading (`--fs`); `.sub`, `.body` |
| `.kicker` > `.tile` + `.kicker-t` | small line above the title |
| `.accent-line` | short bar under point titles |
| `.tile` / `.tile.light` / `.tile.bare` > `svg.ico` | icon tile: gradient / white / transparent |
| `.ico-wrap > svg.ico` | bare icon (colour = `color`) |
| `.chip > .tile + .chip-t` | floating white card |
| `.win > .win-bar(i,i,i) + .win-body` | mini app window; `.skel > .skel-row(.hot)` placeholder lines |
| markup | `.rb` `{b}` · `.rl` `{l}` · `.rm` `{m}` · `.rc > svg.rc-svg > path` `{c}` circle |

## Art compositions — `.art.art-<window|orbit|stack>` (460×340 box, scaled inline)
- window: `.aw-win`, `.aw-main`, `.aw-chip1`, `.aw-chip2` (positions inline)
- orbit: `svg.ao-ring > circle.ao-dash + circle.ao-fill`, `.ao-main`, `.ao-sat`, `.ao-label > span`
- stack: `.as-card(.hot) > .tile + .as-t + .as-bar`
Elements with `data-art` are used by the overlap check; keep them.

## Per kind
| kind | classes |
|---|---|
| cover | `.cover-wrap > .cover-top(.cover-title, .cover-sub) + .cover-bottom(.swipe > .swipe-t, .cover-row > .cover-id(.photo, .cover-who > .cover-name, .cover-handle))` |
| point | `.ghost-num`, `.content(.below-art)`, `.point-head > (.tile.point-tile | .num-tile) + .kicker-t`, `.point-title`, `.point-body` |
| list | `.content(.big)`, `.list-title`, `.list > .li(.has-ico) > (.tile.light | .li-dot) + .li-t` |
| quote | `.quote-mark`, `.quote-t`, `.quote-src > .src-line + .src-t` |
| stat | `.stat-row > .stat-unit + .stat-val`, `.meter > .meter-fill`, `.stat-title`, `.stat-body` |
| bars | `.bars-title`, `.bars > .bar(.hot) > .bar-head(.bar-l, .bar-v) + .bar-track > .bar-fill`, `.bars-body` |
| compare | `.cmp-title`, `.cmp > .cmp-card(.hot) > .cmp-h + .cmp-i(.cmp-mark)`, `.vs`, `.cmp-body` |
| sites | `.sites > .site.plain / .site.brand > .win(.brand) + .site-tag(.hot)`; inside: `.site-nav`, `.site-hero(.b)`, `.site-swatches .sw1-4`, `.site-row(.b) > .site-ph | .site-ico, .site-t` |
| pick | `.pick-title`, `.pick > .pills > .pill` + `.pick-hot-wrap > .pick-hot(.hot-ico + span)`, `.pick-body` |
| rule | `.rule-head > .tile + .rule-k`, `.rule-q`, `.flow > .flow-step(.hot) > .tile + .flow-t`, `svg.flow-arrow`, `.rule-src` |
| steps | `.steps-title`, `.steps > .steps-line + .step > .step-dot(.tile.bare | .step-check) + .step-t` |
| code | `.code-title`, `.term > .term-bar + .term-body > .code-ln.cmd/.out/.ok/.err`, `.cursor`, `.code-body` |
| cta | `.cta-wrap > .cta-top(.cta-title, .cta-prompt) + .cta-id(.cta-photo > .cta-ring + .photo, .cta-handle, .cta-name, .cta-role) + .cta-save(.bookmark, .cta-save-t)` |

## Rules for template authors
1. Restyle, don't re-layout: keep the boxes roughly the same size so decks written for one template fit all of them. If you enlarge type, test with `node engine/tests/run.mjs` (overflow check) on every kind.
2. Keep `[data-fit]`, `[data-art]`, `.content`, `.cover-wrap`, `.cta-wrap` — the overflow/overlap checks rely on them.
3. Extra per-kind styling goes under `.k-<kind>`, e.g. `.k-stat .stat-val { letter-spacing: 0 }`.
4. Regenerate the preview: `node engine/tools/build-previews.mjs <id>`.
