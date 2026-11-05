# Graphics — icons and compositions

The graphic is what stops the scroll. It must **explain** the slide's idea at a glance. If you removed the text, the graphic alone
should still hint at the point.

## Icons (Lucide)
- Names are **PascalCase**: `Clock` `FileText` `Rocket` `Code` `Database` `Bot` `Brain` `Zap` `Shield` `Wallet` `TrendingUp` `Users`
  `Mail` `MessageSquare` `Send` `Calculator` `Timer` `Hourglass` `Route` `ListChecks` `BadgeCheck` `Sparkles` `Github` `Figma`
  `Terminal` `Bug` `Lightbulb` `Target` `NotebookPen` `FilePenLine` `Frown` `Coffee` `Palette` `Globe` `Heart` `Eye` `Store`…
- **The only valid list is `engine/icons/icons.json`.** Before you use a name, search that file for it. Lucide renames icons between
  versions (e.g. `ChartColumn` not `BarChart3`, `CodeXml` not `Code2`, `TriangleAlert` not `AlertTriangle`, `FilePenLine` not `FileSignature`) — old alias names are NOT in the file — trust the file, not memory.
- Lucide's file names are kebab-case (`file-text`) → the deck uses PascalCase (`FileText`). Digits stay attached (`Trash2`, `Link2Off`).
- Choose by meaning: time → `Clock`/`Timer`/`Hourglass`; money → `Wallet`/`Coins`/`Banknote`; growth → `TrendingUp`; problem →
  `Frown`/`TriangleAlert`/`Bug`; result → `BadgeCheck`/`Trophy`; AI → `Bot`/`Sparkles`/`Brain`; people → `Users`/`UserRound`.
- Brand logos are limited in Lucide (`Github`, `Figma`, `Chrome`, `Instagram`, `Youtube`, `Linkedin`…) — check the file; if a brand
  is missing, use a generic icon (`AppWindow`, `Package`) and put the brand name in the text.

## Where graphics come from
| Field | Result | Kinds |
|---|---|---|
| `icon` | Blue icon tile beside the kicker (in `point` it replaces the number) | most kinds |
| `icons` + `labels` + `art` | A **composition** | `cover` · `point` · `quote` |
| `items: [{icon, t}]` | One icon per item | `list` · `steps` |
| `flow: [{icon, t}]` | Icon tiles with arrows | `rule` |
| `brandIcons` `heroIcon` / `hotIcon` | Icons inside the visual | `sites` / `pick` |
| The kind itself | Number + bar, bars, two cards, code window, photo | `stat` `bars` `compare` `code` `cta` |

## Compositions (`art`)
| `art` | Shape | `icons` | `labels` | Best for |
|---|---|---|---|---|
| `window` (default) | Big tilted icon + app window + two floating cards | 3: [main, card 1, card 2] | 2 (≤ 3 words each) — the card texts | a result, a tool, "it's ready" |
| `orbit` | Main icon in the center, 3–5 icons on a dotted ring | 4–6: [center, …ring] | 1 optional pill under the ring | a system, a toolset, integration |
| `stack` | 3 fanned cards, the middle one in accent | 3 | 3 (≈ 1 word each) | stages, options, types |

**Labels carry meaning from the idea**: «١٢ ساعة أقل», «عرض جاهز», «ملاحظات → العرض → ابعت». Never «ميزة ١».

**Rule: each `art` value at most once per deck** (so a deck shows at most 3 compositions). Vary them: e.g. cover `window`,
a `point` with `stack`, a `quote` with an `orbit` centered under it.

## Placement — `artAt: {left, top, scale}` and `arrow`
- The composition box is about 460×340 px before `scale`. `left`/`top` are px from the canvas's top-left (1080×1350).
- Typical values:
  - `cover`: `{left: 270, top: 625, scale: 1.15}` (under the headline). `stack` on the cover is taller: `{left: 290, top: 560, scale: 1.0}` keeps it off the swipe hint.
  - `point` with composition: `{left: 300–320, top: 110–150, scale: 0.8–0.95}` (above the text; the text moves down).
  - `quote`: leave `artAt` out — the engine centers it under the text and lifts the text to make room.
- `arrow: false` hides the hand-drawn arrow of `window`.
- If visual QA shows the composition touching text: lower `scale` by 0.1 or move `top` away from the text, then re-check.
