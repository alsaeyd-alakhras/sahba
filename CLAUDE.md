# Sahba (سَحبة) — Router

Local carousel factory: the creator's ideas → Arabic Instagram carousel **PNG images** (1080×1350). Images only — no video/motion/audio.
This file is a router only. Read only what the task needs.

**Workspace** = `workspace/` (or the path the dashboard gives you). All user data lives there. Everything else is the product.

## Always read
`workspace/logs/hot.md` (where we stopped) + `workspace/brand/identity.json` (who the creator is).

## Task → read
| Task | Read |
|---|---|
| Make / write a carousel ("اعمل كاروسيل عن X") | `.claude/skills/sahba-carousel/SKILL.md` → follow it (it lists brand/voice, analysis, settings, ideas, references) |
| Revise slides / fix validation errors / visual QA | `SKILL.md` §8 + the deck in `workspace/decks/<id>.json` |
| Suggest or polish ideas | `SKILL.md` §8C + `workspace/brand/analysis.md` + `workspace/ideas/ideas.json` |
| Analyze the creator (profile → analysis + voice) | `workspace/brand/profile.md` + `accounts.json` → write `analysis.md` + `voice.md` |
| Which slide kinds / fields exist | `engine/KINDS.md` (wins) + `SKILL.md` references/kinds.md |
| Is an icon name valid | search `engine/icons/icons.json` |
| Something is broken (render, Chrome, Claude login) | Tell the user to open the dashboard's **Doctor** page (`/#/settings` → Device / Claude). Don't patch code. |

## Write rules
- Write only inside `workspace/` (decks, ideas, brand docs, logs). **Never edit** `app/` `engine/` `templates/` `.claude/` `CLAUDE.md`.
- Don't render to or create `workspace/exports/` yourself — export is done from the dashboard after the user approves.
- End of a session → replace `workspace/logs/hot.md` (~150 words): what was made, what's pending, the next step.
- Replies short and to the point, in the user's UI language (`settings.uiLang`). Slide content follows `brand/voice.md`.
