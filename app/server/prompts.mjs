// Every Claude task prompt + system prompt, in one place. Prompts carry machine-readable marker lines
// (TASK:, DECK_FILE:, …) so the files involved are unambiguous for Claude and for the test stub.
import { ROOT, ws, ref, load } from './lib.mjs';
import path from 'node:path';

const SKILL = '.claude/skills/sahba-carousel/SKILL.md';
const SKILL_REFS = '.claude/skills/sahba-carousel/references/';
const brand = f => ref(ws('brand', f));
const CONTEXT = () => [
  `- ${SKILL} (the deck-writing rules) and the references it points to under ${SKILL_REFS}`,
  `- ${brand('voice.md')} (voice rules — follow them strictly)`,
  `- ${brand('analysis.md')} (audience, pillars, hook angles)`,
  `- ${brand('profile.md')} (who the creator is)`,
  `- ${brand('identity.json')} and ${ref(ws('settings.json'))}`,
].join('\n');

const BASE = `You are the writing brain inside "Sahba", a local carousel factory for Arabic content creators.
You never run commands and never render images: the app does that. Missing brand files are fine — work with what exists.
Never change product files (app/, engine/, templates/, .claude/) and never touch any workspace file except the ones this task names.`;

const DECK_RULES = `Deck format (JSON, UTF-8, no comments):
{ "slug": "YYYY-MM-DD_<short-latin-kebab-topic>", "category": "<pillar>", "template": "<template id>",
  "caption": "Hook\\n\\n2–3 lines\\n\\nCTA\\n\\n#tag1 #tag2 …", "slides": [ {"kind":"cover",…}, …, {"kind":"cta",…} ] }
- First slide kind "cover", last slide kind "cta". Slide kinds, fields, compositions and inline markup exactly as the skill defines.
- Images only: never add motion fields ("mode", "dur").
- Headlines ≤ 6 words, one idea per slide, no emoji in titles, every slide has a visual, no identical kind twice in a row, no repeated art.`;

const ideaBlock = idea => [
  `Title: ${idea.title}`,
  idea.note && `Note: ${idea.note}`,
  idea.pillar && `Pillar: ${idea.pillar}`,
  idea.hook && `Hook (use it as the cover): ${idea.hook}`,
  idea.outline?.length && `Outline:\n${idea.outline.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`,
].filter(Boolean).join('\n');

const deckFile = id => ws('decks', `${id}.json`);

export function draft({ idea, template, notes }) {
  const s = load('settings'); const f = deckFile(idea.id);
  return {
    task: 'draft', writable: [f],
    system: `${BASE}\nTask: write ONE carousel deck file. The ONLY file you may create or change is ${ref(f)}.`,
    prompt: `TASK: draft
DECK_FILE: ${ref(f)}

Write a carousel deck for this idea and save it as ${ref(f)} (overwrite if it exists). Do not create any other file.

Read first:
${CONTEXT()}

Idea:
${ideaBlock(idea)}
${notes ? `\nCreator notes for this draft: ${notes}\n` : ''}
Settings: ${s.slidesDefault} slides total (cover + content + cta) · exactly ${s.hashtags} hashtags at the end of the caption · category "${idea.pillar || s.category || ''}" · template "${template}".

${DECK_RULES}

When the file is written, reply with one short line. No explanations.`,
  };
}

const issueLine = e => `- ${e.slide ? `slide ${e.slide}` : 'deck'}${e.field ? ` · ${e.field}` : ''} · ${e.code}: ${e.msg}`;

export function retry({ idea, errors }) {
  const f = deckFile(idea.id);
  return {
    task: 'retry', writable: [f],
    prompt: `TASK: retry
DECK_FILE: ${ref(f)}

The deck you wrote failed validation. Fix ONLY these problems in ${ref(f)} (keep everything else as is), then reply with one short line:
${errors.map(issueLine).join('\n')}`,
  };
}

export function revise({ idea, comments = [], general = '' }) {
  const f = deckFile(idea.id);
  const lines = comments.filter(c => c?.text).map(c => `- slide ${c.slide}: ${c.text}`);
  return {
    task: 'revise', writable: [f],
    system: `${BASE}\nTask: revise ONE existing carousel deck. The ONLY file you may change is ${ref(f)}.`,
    prompt: `TASK: revise
DECK_FILE: ${ref(f)}

Revise the existing deck ${ref(f)} according to the creator's comments. Read it first, plus:
${CONTEXT()}

Comments (slide numbers are 1-based):
${lines.join('\n') || '- (none)'}
${general ? `General: ${general}\n` : ''}
Change only what the comments ask for; leave every other slide byte-identical. Keep the caption unless a comment is about it.

${DECK_RULES}

Reply with one short line summarising what you changed.`,
  };
}

export function qa({ idea, sheet, overflow = [] }) {
  const f = deckFile(idea.id);
  return {
    task: 'qa', allowedTools: 'Read',
    system: `${BASE}\nTask: visual QA of rendered slides. You can only read files.`,
    prompt: `TASK: qa
DECK_FILE: ${ref(f)}
SHEET_FILE: ${ref(sheet)}

Look at the contact sheet image ${ref(sheet)} (all slides in order) and the deck ${ref(f)}.
Automatic overflow report (text that does not fit its box):
${overflow.length ? overflow.map(o => `- slide ${o.slide}: ${o.text}`).join('\n') : '- none'}

Check: text cut off or overflowing, cramped or unreadable slides, broken visuals, wrong order.
If everything is fine, reply with exactly: OK
Otherwise reply with the full corrected deck as one fenced \`\`\`json block (same format, only the problem slides changed — shorten text rather than restructure). Nothing else.`,
  };
}

export function analyze({ extra = '' }) {
  const a = ws('brand', 'analysis.md'), v = ws('brand', 'voice.md');
  return {
    task: 'analyze', writable: [a, v],
    system: `${BASE}\nTask: analyse the creator. The ONLY files you may write are ${ref(a)} and ${ref(v)}.`,
    prompt: `TASK: analyze
ANALYSIS_FILE: ${ref(a)}
VOICE_FILE: ${ref(v)}

Read ${brand('profile.md')}, ${brand('accounts.json')}, ${brand('identity.json')}${extra ? ' and the extra material below' : ''}.
Write two markdown files in the creator's content language (Arabic unless the profile says otherwise):
1. ${ref(a)} — sections: audience · 4–6 content pillars · strengths · hook angles that fit them · mistakes to avoid.
2. ${ref(v)} — voice rules: dialect, tone, sentence length, words to use / avoid, 3 short example lines in their voice.
Be concrete; use only what the material supports.
${extra ? `\nExtra material from the creator:\n"""\n${extra}\n"""\n` : ''}
Reply with one short line when both files are written.`,
  };
}

export function suggest({ count = 10, existing = [] }) {
  return {
    task: 'suggest', allowedTools: 'Read',
    system: `${BASE}\nTask: suggest carousel ideas. You can only read files. Your final reply must be one fenced json block.`,
    prompt: `TASK: suggest

Read ${brand('analysis.md')}, ${brand('voice.md')} and ${brand('profile.md')}.
Suggest ${count} new carousel ideas for this creator, spread over their pillars, each with a concrete angle.
Do not repeat these existing ideas:
${existing.slice(0, 80).map(t => `- ${t}`).join('\n') || '- (none)'}

Reply with ONLY this fenced block:
\`\`\`json
{ "ideas": [ { "title": "…", "note": "one-line angle", "pillar": "…" } ] }
\`\`\``,
  };
}

export function polish({ idea }) {
  return {
    task: 'polish', allowedTools: 'Read',
    system: `${BASE}\nTask: sharpen one idea. You can only read files. Your final reply must be one fenced json block.`,
    prompt: `TASK: polish

Read ${brand('voice.md')} and ${brand('analysis.md')}. Sharpen this idea:
${ideaBlock(idea)}

Give: a cover hook with a concrete number, in the creator's voice; and a 5–7 point outline (one point per content slide).
Reply with ONLY this fenced block:
\`\`\`json
{ "hook": "…", "angle": "…", "outline": ["…", "…"] }
\`\`\``,
  };
}

/** Pull the JSON object out of a reply (```json fence preferred, else the outermost braces). */
export function extractJson(text) {
  const t = String(text || '');
  const fences = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  const body = fences.length ? fences[fences.length - 1][1] : t;
  const a = body.indexOf('{'), b = body.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(body.slice(a, b + 1)); } catch { return null; }
}
export const SKILL_PATH = path.join(ROOT, SKILL);
