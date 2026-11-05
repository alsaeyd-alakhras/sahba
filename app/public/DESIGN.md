# Sahba UI — Design system

"Warm planner": the same look and font as the author's second-brain dashboard. Warm cream paper,
white boxes with 2px borders, dashed dividers, pill buttons, a coral accent, and soft pastel tints
that each mean something. Arabic-first, fully mirrored for English.

## Visual rules
1. **One primary (coral) button per screen**: the next step. Everything else is secondary (white pill),
   ghost, or ink (dark pill, for a strong-but-not-main action).
2. **Three type levels:** display (page title 34 / section + modal 22 / card title 18, Baloo 700),
   body (15.5 / 14.5, weight 500–700), small (13.5 / 12.5). Nothing else.
3. **Colour means something.** Pastels are never decoration: sun = active / in progress / attention,
   rose = error, mint = done / approved, sky = info / ready, lilac = waiting on you (preview).
   Text on a pastel uses its `--c-on-*` partner (all ≥ 4.5:1, light and dark).
4. **White boxes get a 2px border and no shadow** (`--c-line`); hover → border `--c-ink`.
   Dividers inside boxes (card head/foot, tabs, modal head/foot, toolbar, nav foot) are **2px dashed**.
5. **Touch targets ≥ 44px:** buttons, inputs, tabs (`--control-h`); small buttons 36px.
6. **Pills:** buttons, selects, chips, segmented controls, status line. Toasts are dark rounded pills.
7. **Focus ring:** 2px coral outline, 2px offset (`:focus-visible`); inputs show focus with an ink border.

### Idea status chips (`statusChip` also sets `data-status`)
| raw | ready | drafting | preview | approved | exported | published |
|---|---|---|---|---|---|---|
| bg-2 | sky | sun | lilac | mint | deep mint (`--c-mint-strong`) | ink |

### Side nav
Paper background (`--c-nav`), dashed inline-end border. The active item is a pastel block, one per section:
Ideas sun · Factory rose · Gallery lilac · Me mint · Settings sky · Log bg-2. Brand mark = coral tile tilted `--tilt`.

## The one rule
**No raw values outside `css/tokens.css`.** `app.css` uses `var(--token)` only — no hex, no `px`,
no `rgba()`. Exceptions: `@media` widths (CSS can't read variables there), unitless multipliers
inside `calc()`, `0`, `100%`, angles in keyframes. Need a new value? Add a token first.

## Tokens (`css/tokens.css`)
| Group | Tokens |
|---|---|
| Spacing | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 |
| Type | `--font-sans` = `--font-display` (Baloo Bhaijaan 2 → Cairo → system-ui), `--font-mono`; sizes `--fs-xs` 12.5 · `sm` 13.5 · `md` 14.5 · `base` 15.5 · `lg` 18 · `xl` 22 · `2xl` 30 · `3xl` 34; `--lh-tight/snug/lh`; `--fw-regular…black` |
| Radii | `--r-xs` 6 · `sm` 10 · `md` 14 (inputs, nav items, slides) · `lg` 22 (cards) · `xl` 26 (modals, toasts) · `pill` |
| Borders | `--border` 1 (table rows) · `--border-strong` 2 (boxes, controls, dashed dividers) · `--border-active` 3 (selected tab) · `--focus-outline` 2 |
| Shadows | cards have none; `--shadow-md` (rare), `--shadow-lg` (modals, toasts), `--shadow-press(-down)` (primary button's coral bottom edge) |
| Sizes | `--control-h` 44 (`-sm` 36, `-lg` 48), `--nav-item-h`, `--chip-h`, `--icon(-sm/-lg/-xl)`, `--nav-w` 252, `--content-max`, `--narrow-max`, `--modal-w(-lg)`, `--thumb-min`, `--card-min`, `--slide-w/-h/-ratio`, `--slide-view-max`, `--photo-frame`, `--tilt`, `--press` … |
| Motion | `--dur-fast` 120 · `--dur` 200 · `--dur-slow` 400 · `--ease` |
| Color | surfaces `--c-bg` #FFFAF1, `--c-surface` #FFF, `--c-surface-2` #FBF4E8, `--c-surface-3` (bg-2) #F6EEDF, `--c-nav` (paper) #FFF1DE; text `--c-ink(-2/-3)`; `--c-line(-strong)`; accent `--c-accent` #C73E1D (`-hover`, `-ink` = text on it, `-text` = links/eyebrows, `-press`, `-soft`, `-line`); `--c-ink-bg` / `--c-on-ink-bg` (dark pills: toast, published, pressed segment); pastels `--c-sun/rose/mint/mint-strong/sky/lilac`, each with `--c-on-*`; status `--c-success/-warn/-danger/-info/-violet` (`-soft` = the matching pastel); `--c-overlay`, `--c-code-bg/-ink` |

**Themes.** Light ("warm planner") is the default; dark uses the brain dashboard's dark values under the same token names. Dark applies via `prefers-color-scheme: dark` unless
`<html data-theme="light">`; `data-theme="dark"` forces dark. The theme toggle cycles
system → light → dark and remembers the choice per browser (`localStorage: sahba.theme`).

**Font.** UI = **Baloo Bhaijaan 2** (OFL, weights 400–800, Arabic + Latin subsets), declared in
`css/fonts.css` (generated from `engine/fonts/fonts.json`; files under `/engine/fonts/baloo-bhaijaan-2/`)
and linked before `tokens.css`. Cairo (`@font-face` in `tokens.css`, `/engine/fonts/cairo/`) is the
fallback, then system UI fonts. All local, no network fonts.

## Direction & language
- `<html dir lang>` follows `settings.uiLang` and flips live (`js/i18n.js → setLang`).
- **Logical properties only** (`margin-inline-start`, `inset-inline-end`, `border-block-end`,
  `text-align: start`…). Never `left/right`.
- Directional icons (`chevron*`) auto-mirror in RTL (`.icon--flip`).
- User content (titles, notes, captions, comments, markdown, inputs) gets `dir="auto"` so Arabic
  stays RTL inside the English UI and vice-versa.
- Elements with physical geometry (face-position editor, scaled slide iframe) set `dir="ltr"`
  locally because their coordinates are physical.
- **No UI strings in JS/HTML.** Everything is `t('dotted.key', {vars})` from `i18n/ar.json` and
  `i18n/en.json` (identical key sets; no plural keys). Numbers/dates via `fmtNumber`, `fmtDate`,
  `fmtDateTime`, `fmtDuration` (Arabic uses Latin digits + Gregorian calendar).

## Components (`js/ui.js`, styles in `css/app.css`)
| Component | API | Notes |
|---|---|---|
| `h(tag, props, ...kids)` | DOM builder | `testid` → `data-testid`, `on: {click}`, `style: {'--var': v}`; text is always a text node (no innerHTML) |
| Button | `button({label, iconName, variant, size, onClick})` | pill, 2px border. Variants `primary` (coral + press edge, one per screen) · `secondary` (white) · `ghost · ink · danger · danger-solid`; sizes `sm` 36 · default 44 · `lg` 48; icon-only when no label (pass `ariaLabel`). Async `onClick` disables the button until it settles |
| Claude button | `claudeButton(opts)` | auto-disabled + tooltip when Claude is missing/logged-out/busy |
| Claude gate | `claudeGate()` | warn notice + link to `#/settings/claude`; hidden when connected |
| Field | `field({label, hint, control})` + `input`, `textarea`, `select`, `toggle`, `segmented` | labels always visible above controls |
| Card | `card({title, sub, iconName, actions, body, foot, flush})` | `.card--accent` for the current step, `.card--interactive` for clickable |
| Chip | `chip({label, tone})`, `statusChip(status)` | pastel pills: `info` sky · `success` mint · `warn` sun · `danger` rose · `violet` lilac · `ink` · `outline`; status chips also carry `data-status` |
| Notice | `notice({tone, title, body, action})` | `info · warn · error · success` |
| Empty / loading / error | `emptyState`, `loading`, `errorBox(err, retry)` | `errorBox` shows the server's `msg`; 409 → "busy" |
| Toast | `toast(msg, tone)`, `toastError(err)` | dark pill (`--c-ink-bg`), error = danger; bottom inline-end, auto-dismiss |
| Modal | `modal({title, body, actions, size})`, `confirmDialog(...)` | native `<dialog>`, radius 26, dashed head/foot dividers, Esc/backdrop close |
| Tabs | `tabs({items, value, onChange})` | 44px, dashed bottom rule, selected = 3px coral underline |
| Empty state | `emptyState(...)` | dashed 2px box on `--c-surface-2` |
| Slide frame | `slideFrame({src})` | 1080×1350 iframe scaled to the container with a ResizeObserver |
| Run panel | `createRun({title, phases, cancelKind}).run(path, body)` | SSE-over-POST: phase chips (claude · validate · retry · render · qa · export), progress bar n/total, tool lines, Claude's streamed text in a disclosure, elapsed time, cancel (`POST /api/cancel` + abort) |

## Layout
- Shell: side nav (`--nav-w`, inline-start: right in Arabic) + main column (`--content-max`).
  Onboarding uses the bare layout (`--narrow-max`, no nav).
- Page = `pageHeader` + `stack--lg` of cards. Two-column work areas use `.split` (3fr / 2fr).
- Desktop app: designed for ≥ 1024 px wide; no horizontal scroll. Below 1100 px the nav narrows
  and `grid-2` stacks; below 960 px `.split` stacks.

## States (every screen)
loading (`loading()`), empty (`emptyState`), error (`errorBox` with server `msg` + retry),
busy (409 → busy message; Claude buttons disabled while a Claude run is active; nav busy pill),
Claude disconnected (`claudeGate` + disabled Claude buttons with explanation).

## Testing hooks
Every interactive element has a `data-testid` (`kebab-case`, `<area>-<thing>[-<id>]`).
`_dev/mock-server.mjs` (dev only) fakes the whole SPEC API on port 8901.
