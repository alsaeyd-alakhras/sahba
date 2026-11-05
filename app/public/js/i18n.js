// i18n — flat dotted keys, t(key, vars), per-language number/date formatting.
const LOCALES = { ar: 'ar-u-nu-latn-ca-gregory', en: 'en-GB' };
const SUPPORTED = ['ar', 'en'];

let lang = 'ar';
let dict = {};
const cache = {};
const listeners = new Set();

export function supportedLangs() { return SUPPORTED.slice(); }
export function getLang() { return lang; }
export function getDir(l = lang) { return l === 'ar' ? 'rtl' : 'ltr'; }
export function locale(l = lang) { return LOCALES[l] || l; }

async function fetchDict(l) {
  if (cache[l]) return cache[l];
  const res = await fetch(`/i18n/${l}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`i18n ${l} ${res.status}`);
  cache[l] = await res.json();
  return cache[l];
}

/** Load a language and flip <html dir lang> live. */
export async function setLang(l) {
  if (!SUPPORTED.includes(l)) l = 'ar';
  dict = await fetchDict(l);
  lang = l;
  const root = document.documentElement;
  root.lang = l;
  root.dir = getDir(l);
  document.title = t('app.title');
  for (const fn of listeners) fn(l);
}

export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Translate a key; {name} placeholders are replaced from vars. Missing keys return the key. */
export function t(key, vars) {
  let s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
  return s;
}

export function has(key) { return Object.prototype.hasOwnProperty.call(dict, key); }

/** Pick a localized value from {ar, en} objects (templates etc.). */
export function pick(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? obj.ar ?? Object.values(obj)[0] ?? '';
}

export function fmtNumber(n, opts) {
  if (n == null || Number.isNaN(Number(n))) return '';
  return new Intl.NumberFormat(locale(), opts).format(Number(n));
}

function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(v);
  }
  return new Date(NaN);
}

export function fmtDate(v, opts = { dateStyle: 'medium' }) {
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return v ? String(v) : '';
  return new Intl.DateTimeFormat(locale(), opts).format(d);
}

export function fmtDateTime(v) {
  return fmtDate(v, { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtDuration(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '';
  const s = Math.round(Number(ms) / 1000);
  if (s < 60) return t('time.seconds', { n: fmtNumber(s) });
  return t('time.minutes', { m: fmtNumber(Math.floor(s / 60)), s: fmtNumber(s % 60) });
}

export function todayISO() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
