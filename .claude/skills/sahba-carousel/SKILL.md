---
name: sahba-carousel
description: Write a professional Arabic Instagram carousel deck (deck.json) for the Sahba product — PNG slides 1080x1350 with real graphics (Lucide icons, app window, orbit, fanned cards, hand-drawn circle, marker). Use it whenever a carousel deck is created or revised — from the Sahba dashboard ("draft", "revise", "visual QA") or directly in Claude Code: "make a carousel about X", "اعمل كاروسيل عن X", "حوّل الفكرة لكاروسيل", "عدّل السلايد ٣". Images only — no video, motion or audio.
---

# Sahba — Carousel Deck Writer

**Your only output is a deck JSON file.** The engine draws the images, the server validates, renders and exports.
You think; the product executes. You never edit product code (`app/` `engine/` `templates/` `.claude/`).

Goal: a clean "wow" carousel in the creator's own voice, where **every graphic explains the idea** — never decoration.

## 0) Read first (in this order, only these)
| File | Why |
|---|---|
| `workspace/brand/voice.md` | Dialect, tone, words to use/avoid. **All slide text follows it.** |
| `workspace/brand/analysis.md` | Audience, pillars, hook angles, mistakes to avoid. |
| `workspace/brand/identity.json` | Name, handle, role, template. The engine prints them on cover/CTA automatically — never write them into slide text. |
| `workspace/settings.json` | `slidesDefault` (slide count), `hashtags` (caption hashtag count), `category` (default badge). |
| `workspace/ideas/ideas.json` | The idea: `title`, `note`, `pillar`, `hook`, `outline`, `template`. |
| `references/kinds.md` | Every slide kind and its exact fields. **Field names must match exactly.** (Engine contract: `engine/KINDS.md` — wins on conflict.) |
| `references/art.md` | Icons, compositions (`window` `orbit` `stack`), placement. |
| `references/markup.md` | Inline markup `{b}` `{c}` `{l}` `{m}` `<br>`. |
| `references/copywriting.md` | The writing rules (80% of the result). |
| `references/examples/*.json` | Complete valid decks — copy their shape. |

When the dashboard runs you, the task prompt gives the exact paths (the workspace may live outside this folder). Use the paths it gives.
If `voice.md` or `analysis.md` is missing or empty: write in clear, friendly Levantine-neutral dialect and keep going — do not stop to ask.

## 1) The deck file
```json
{ "slug": "2026-11-02_short-latin-slug", "category": "تعليمي", "template": "editorial",
  "caption": "Hook\n\nline 1\nline 2\n\nCTA\n\n#tag1 #tag2 #tag3 #tag4 #tag5",
  "slides": [ { "kind": "cover", ... }, ..., { "kind": "cta", ... } ] }
```
- `slug` = `YYYY-MM-DD_<kebab-latin>` (today's date). Used for the export folder name.
- `category` = short badge text shown on each slide: idea `pillar` → else `settings.category` → else a 1–2 word topic label.
- `template` = optional. Set it only if the idea has `template`; otherwise omit (identity's template is used).
- `lang` = optional: `"ar"` (default, RTL) or `"en"` (LTR, for an English carousel). Omit for Arabic.
- **Forbidden fields:** `mode`, `dur`, `speed` (motion = validation error), anything about video/export/render. Unknown fields are ignored with a warning. No `name`/`handle` in text.
- Write the file as UTF-8 JSON, 2-space indent. Arabic digits (١٢٣) or Latin digits — pick one style per deck (follow voice.md).

## 2) Structure
- Slide count = `settings.slidesDefault` (7–9; default 8). **First slide `cover`, last slide `cta`.** Content in between.
- **One idea per slide.** A slide that carries two ideas → split it.
- The order tells a story with rising tension: problem → why → fix → proof → action. Each slide makes the next one wanted.
- If the idea has `hook` and `outline` (after "polish"), use the hook for the cover and the outline as the slide spine.

## 3) Pick the kind from the content (not for variety's sake)
| The content is… | Kind |
|---|---|
| The promise / hook | `cover` (always has a composition) |
| One tip / one point of a listicle | `point` |
| 3–4 short items | `list` |
| A strong sentence, the pain, a belief | `quote` (a small composition makes it stronger) |
| One big number | `stat` |
| Numbers compared | `bars` |
| Before / after, wrong / right | `compare` (`left` = the winner) |
| Ordinary vs. distinctive (two mini websites/apps) | `sites` |
| Many options → choose one | `pick` |
| A rule + its cause→effect flow | `rule` |
| A method / sequence | `steps` (3–5) |
| A tool, command, snippet | `code` |
| The ask | `cta` (always last) |

Full fields: `references/kinds.md`.

## 4) Hard rules (the server validator checks these — breaking one = rejected deck)
1. Valid JSON; first `cover`, last `cta`; every `kind` is known; required fields present with the right types.
2. **Titles ≤ 6 words** (`headline`, `title`, the visible title text after removing markup). Body ≤ 2 short lines.
3. **No same kind twice in a row.**
4. **No `art` composition repeated inside one deck** (`window`, `orbit`, `stack` — each at most once).
5. **Every slide has a graphic.** `cover` must have `icons` (a composition). `list` must have `icon` or icons on its items. The other kinds are visual by themselves (number tile, quotation mark, bars, cards, code window, photo) — but still prefer a meaningful `icon` / composition over the bare default.
6. **Icons = Lucide names in PascalCase** (`Clock`, `FileText`, `Rocket`). Only names that exist in `engine/icons/icons.json` — **check every icon there** (search the file for the name). A wrong name = empty box = rejected.
7. **No emoji in slide text** (titles, bodies, labels, items). Icons replace emoji. Emoji are allowed only in `prompt` (cta) and `caption`.
8. `caption` present and in the format of §6.
9. Composition labels are short (`window` ≤ 3 words each, `stack` ≈ 1 word each) and come from the idea itself ("١٢ ساعة أقل"), not filler ("ميزة").

Layout sense (prevents overflow — the server also measures it):
- A title line holds ~14 Arabic characters at full size; longer lines wrap by themselves. Break long titles yourself with `<br>` at a natural pause.
- Cover `headline`: 2 lines max. `cta` `headline`: 2 lines max.
- List/steps items: one line each, ~6–8 words.
- `pick` `hot`: ≤ 2–3 short words. `sites` lines: ≤ 3 words. `compare` items: ≤ 4 words. `code` lines: ≤ 38 characters.
- `{c}` (hand circle): once on the cover, once on the cta, around **one or two words** only.

## 5) Graphics — what makes the "wow"
Read `references/art.md`. In short:
- `icon` on most kinds → blue icon tile next to the kicker.
- `icons` + `labels` + `art` on `cover` / `point` / `quote` → a composition: `window` (result, tool, "ready"), `orbit` (system, tools, integration), `stack` (stages, options, types).
- `items: [{ "icon", "t" }]` on `list` / `steps` → one icon per item.
- Icons must mean the idea (a clock for time saved, a wallet for money) — never random.

## 6) Caption
```
<hook line — the promise, may end with one emoji>

<line 2–3 lines of value: why it matters, what they'll get>

<ONE CTA: save / comment a specific word / follow>

#tag1 #tag2 … (exactly settings.hashtags tags, default 5)
```
Hashtags: mix 2 broad + the rest niche, from the audience/pillars in `analysis.md`. Arabic tags use `_` between words (`#ذكاء_اصطناعي`).

## 7) Self-check before you finish
Run through the deck slide by slide:
- [ ] Every title ≤ 6 words, in the creator's dialect (voice.md), no emoji.
- [ ] No back-to-back kind, no repeated `art`, every slide has a graphic.
- [ ] Every icon name found in `engine/icons/icons.json`.
- [ ] Field names exactly as in `references/kinds.md` (e.g. `quote` not `text`, `items` not `points`).
- [ ] Hook has a concrete number or result; CTA asks for one action.
- [ ] Caption: hook + 2–3 lines + one CTA + N hashtags.
- [ ] JSON parses (no trailing commas, straight quotes `"` around keys, inner quotes in Arabic use « »).

## 8) Modes

### A) From the dashboard (the server runs you)
The task prompt says which job and gives the deck path. Do exactly that job and nothing else — no rendering, no other files.
- **draft** → write the full deck to the given path.
- **validation errors** → the server sends a list like `slide 4 · field icon · unknown_icon · "Rocketship" is not a Lucide icon`.
  Fix **only** those problems with minimal edits (keep all other text identical), save, done. Slide numbers are 1-based.
- **revise** → you get comments per slide (`{slide, text}`) and maybe a general note. Change only the commented slides
  (and the caption if asked). Keep every other slide byte-for-byte the same so only changed slides re-render.
  If a comment asks for something impossible (video, a new kind), do the closest valid thing.
- **visual QA** → you get `_sheet.jpg` (all slides) and an overflow report. Look for: text cut or overflowing, a graphic covering text,
  a single orphan word on its own line, a big empty area, an empty icon box. Fix by shortening text, adding `<br>`, moving the composition
  with `artAt`, or swapping the icon. If everything is clean, change nothing.

### B) Standalone (the user talks to you in this folder)
"make a carousel about X" / «اعمل كاروسيل عن X»:
1. Read §0 files. If X matches an idea in `workspace/ideas/ideas.json`, use its `id`. Otherwise create a new idea entry
   (`id` = `i_YYYYMMDD_xxxx` with 4 random lowercase letters/digits, `source: "me"`, `status: "preview"`, `deck: "decks/<id>.json"`, dates = today).
2. Write the deck to `workspace/decks/<id>.json`.
3. Render a preview:
   `node engine/render.mjs workspace/decks/<id>.json --workspace workspace --out workspace/preview/<id>`
   If it prints validation errors or overflow, fix the deck and run again with `--only 2,5` (the changed slides).
4. Read `workspace/preview/<id>/_sheet.jpg` yourself and do the visual QA of mode A. Then tell the user: the path, and one line per
   slide on what the graphic shows and why.
5. **Export happens from the dashboard** («اعتمد وصدّر»). Do not create export folders yourself.
Do not run the render command while the dashboard is drafting the same idea.

### C) Idea jobs (dashboard, read-only — answer with JSON at the end of your reply)
- **suggest** → N ideas from `analysis.md` pillars and hook angles, not already in `ideas.json`:
  `{"ideas":[{"title":"…","note":"…","pillar":"…"}]}`. Titles in the creator's dialect, ≤ 8 words, each a specific promise.
- **polish** → one idea → `{"hook":"…","outline":["…", "…"]}`: a hook with a concrete number or result + the angle, and 5–7 outline points
  (one idea each, in story order) that map naturally to slides.
