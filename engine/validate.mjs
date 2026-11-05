// Deck validation. Issue = { slide: 1-based|null, field: string|null, code, msg }  (msg in plain English for Claude)
import { KINDS } from './kinds/index.mjs';
import { ART } from './art/index.mjs';
import { plain } from './rich.mjs';
import { iconExists } from './util.mjs';

const COMMON = ['kind', 'note'];
const ART_FIELDS = ['icons', 'labels', 'art', 'artAt', 'arrow'];
const MOTION = ['mode', 'dur', 'speed', 'circleAt', 'at'];
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;
const MAX_WORDS = 6;

/** words after stripping markup; punctuation-only tokens (—, …, ؟) don't count */
export const wordCount = (t) => plain(t).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function validateDeck(deck) {
  const errors = [], warnings = [];
  const add = (slide) => (level, field, code, msg) => (level === 'error' ? errors : warnings).push({ slide, field: field ?? null, code, msg });
  const top = add(null);

  if (!deck || typeof deck !== 'object' || Array.isArray(deck)) {
    top('error', null, 'bad_deck', 'The deck must be a JSON object: {"slug", "category", "caption", "slides": [...]}.');
    return { ok: false, errors, warnings };
  }
  for (const f of MOTION) if (f in deck) top('error', f, 'motion_not_supported', `"${f}" is a motion field; motion is not supported (images only). Remove "${f}".`);
  if (typeof deck.caption !== 'string' || !deck.caption.trim()) top('error', 'caption', 'missing_caption', 'Deck "caption" is required: hook line, 2–3 short lines, a call to action, then the hashtags.');
  if (deck.slug !== undefined && (typeof deck.slug !== 'string' || !/^[\p{L}\p{N}._-]+$/u.test(deck.slug))) top('error', 'slug', 'bad_slug', '"slug" must be a short file-safe string like "2026-11-02_topic" (letters, digits, - _ .).');
  if (deck.slug === undefined) top('warning', 'slug', 'missing_slug', 'Deck has no "slug" (e.g. "2026-11-02_topic"); it names the export folder.');
  if (deck.category !== undefined && typeof deck.category !== 'string') top('error', 'category', 'bad_type', '"category" must be a string (shown as the badge on every slide).');
  if (deck.lang !== undefined && !['ar', 'en'].includes(deck.lang)) top('error', 'lang', 'bad_value', '"lang" must be "ar" or "en" (default "ar").');
  if (!Array.isArray(deck.slides) || deck.slides.length === 0) {
    top('error', 'slides', 'missing_slides', '"slides" must be a non-empty array of slide objects.');
    return { ok: false, errors, warnings };
  }
  const S = deck.slides, n = S.length;
  if (n < 5 || n > 10) top('warning', 'slides', 'slide_count', `Deck has ${n} slides; 7–9 works best (cover + content + cta).`);

  const usedArt = new Map();
  S.forEach((s, i) => {
    const a = add(i + 1);
    if (!s || typeof s !== 'object' || Array.isArray(s)) { a('error', null, 'bad_slide', 'Each slide must be an object with a "kind".'); return; }
    const K = KINDS[s.kind];
    if (!K) { a('error', 'kind', 'unknown_kind', `Unknown kind "${s.kind}". Use one of: ${Object.keys(KINDS).join(', ')}.`); return; }

    for (const f of MOTION) if (f in s) a('error', f, 'motion_not_supported', `"${f}" is a motion field; motion is not supported (images only). Remove "${f}".`);
    const known = new Set([...COMMON, ...K.fields, ...MOTION]);
    for (const f of Object.keys(s)) if (!known.has(f)) a('warning', f, 'unknown_field', ART_FIELDS.includes(f) ? `"${f}" is ignored on "${s.kind}" slides (art compositions exist only on cover, point and quote).` : `Field "${f}" is not used by "${s.kind}" slides and will be ignored.`);

    K.check(s, a);

    // art composition
    if (K.art && s.icons !== undefined) {
      if (!Array.isArray(s.icons) || !s.icons.every((x) => typeof x === 'string')) a('error', 'icons', 'bad_type', '"icons" must be an array of icon names.');
      else {
        s.icons.forEach((v, j) => { if (!iconExists(v)) a('error', `icons[${j}]`, 'unknown_icon', `Unknown icon "${v}" in "icons[${j}]". Use a Lucide PascalCase name (see listIcons()).`); });
        const artId = s.art ?? 'window';
        if (!ART[artId]) a('error', 'art', 'unknown_art', `Unknown art "${s.art}". Use one of: ${Object.keys(ART).join(', ')}.`);
        else {
          const lim = ART[artId].icons;
          if (s.icons.length < lim.min || s.icons.length > lim.max) a(s.icons.length < lim.min ? 'error' : 'warning', 'icons', 'icon_count', `art "${artId}" takes ${lim.min}–${lim.max} icons (ideal ${lim.ideal}); got ${s.icons.length}.`);
          if (usedArt.has(artId)) a('error', 'art', 'repeated_art', `art "${artId}" is already used on slide ${usedArt.get(artId)}; each art composition may appear only once per deck (window, orbit, stack).`);
          else usedArt.set(artId, i + 1);
        }
        if (s.labels !== undefined) {
          if (!Array.isArray(s.labels) || !s.labels.every((x) => typeof x === 'string')) a('error', 'labels', 'bad_type', '"labels" must be an array of short strings.');
          else s.labels.forEach((l, j) => { const w = wordCount(l); if (w > 3) a('warning', `labels[${j}]`, 'long_label', `Label "${l}" has ${w} words; art labels should be ≤ 3 words.`); });
        }
        if (s.artAt !== undefined) {
          if (!s.artAt || typeof s.artAt !== 'object' || Object.entries(s.artAt).some(([k, v]) => !['left', 'top', 'scale'].includes(k) || typeof v !== 'number')) a('error', 'artAt', 'bad_type', '"artAt" must be {"left": px, "top": px, "scale": number} (all optional numbers).');
        }
        if (s.arrow !== undefined && typeof s.arrow !== 'boolean') a('error', 'arrow', 'bad_type', '"arrow" must be true or false.');
      }
    } else if (K.art && (s.labels || s.art || s.artAt)) a('warning', 'icons', 'art_without_icons', '"labels"/"art"/"artAt" have no effect without "icons".');

    // titles: ≤ 6 words, no emoji
    for (const f of K.titleFields) if (typeof s[f] === 'string') {
      const w = wordCount(s[f]);
      if (w > MAX_WORDS) a('warning', f, 'long_title', `"${f}" has ${w} words (max ${MAX_WORDS}): "${plain(s[f])}". Shorten it or move detail to the body.`);
    }
    for (const f of [...K.titleFields, 'kicker']) if (typeof s[f] === 'string' && EMOJI.test(s[f])) a('error', f, 'emoji_in_title', `"${f}" contains an emoji. No emoji in headline/title/kicker — use "icon" instead (emoji are fine in caption and prompt).`);

    if (!K.graphic(s)) a('error', null, 'no_graphic', `This "${s.kind}" slide has no graphic. Add "icon", or icons on the items ({"icon": "Name", "t": "..."}).`);

    if (i > 0 && S[i - 1] && S[i - 1].kind === s.kind) a('error', 'kind', 'repeated_kind', `Same kind "${s.kind}" as the previous slide; never put two slides of the same kind back to back.`);
  });

  if (S[0]?.kind !== 'cover') add(1)('error', 'kind', 'first_not_cover', `The first slide must be "cover" (got "${S[0]?.kind}").`);
  if (S[n - 1]?.kind !== 'cta') add(n)('error', 'kind', 'last_not_cta', `The last slide must be "cta" (got "${S[n - 1]?.kind}").`);
  S.forEach((s, i) => {
    if (i > 0 && s?.kind === 'cover') add(i + 1)('error', 'kind', 'extra_cover', '"cover" may only be the first slide.');
    if (i < n - 1 && s?.kind === 'cta') add(i + 1)('error', 'kind', 'extra_cta', '"cta" may only be the last slide.');
  });
  return { ok: errors.length === 0, errors, warnings };
}
