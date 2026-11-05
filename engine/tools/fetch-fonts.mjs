// One-off: download OFL Arabic fonts (woff2, arabic + latin subsets) from the Fontsource npm mirror of Google Fonts
// into engine/fonts/<id>/ and write engine/fonts/fonts.json. Run once by the maintainer; the product never downloads.
// Usage: node engine/tools/fetch-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const CDN = 'https://cdn.jsdelivr.net/npm/';
const GH = 'https://raw.githubusercontent.com/google/fonts/main/ofl/';
const FONTS = [
  { id: 'cairo', name: 'Cairo', pkg: '@fontsource-variable/cairo@5.1.0', css: 'index.css', gh: 'cairo' },
  { id: 'tajawal', name: 'Tajawal', pkg: '@fontsource/tajawal@5.1.0', css: ['400', '500', '700', '800', '900'].map((w) => w + '.css'), gh: 'tajawal' },
  { id: 'baloo-bhaijaan-2', name: 'Baloo Bhaijaan 2', pkg: '@fontsource/baloo-bhaijaan-2@5.1.0', css: ['400', '500', '600', '700', '800'].map((w) => w + '.css'), gh: 'baloobhaijaan2' },
  { id: 'ibm-plex-arabic', name: 'IBM Plex Sans Arabic', pkg: '@fontsource/ibm-plex-sans-arabic@5.1.0', css: ['400', '500', '600', '700'].map((w) => w + '.css'), gh: 'ibmplexsansarabic' },
];
const SUBSETS = ['arabic', 'latin', 'latin-ext'];

const get = async (u, bin) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + ' ' + u); return bin ? Buffer.from(await r.arrayBuffer()) : r.text(); };
const list = [];
for (const f of FONTS) {
  const dir = path.join(out, f.id); fs.mkdirSync(dir, { recursive: true });
  const faces = [];
  for (const css of [].concat(f.css)) {
    const txt = await get(CDN + f.pkg + '/' + css);
    for (const block of txt.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
      const b = block[1];
      const url = b.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      if (!url || !SUBSETS.some((s) => url.includes('-' + s + '-'))) continue;
      if (/italic|cyrillic|greek|vietnamese|hebrew/.test(url)) continue;
      const weight = b.match(/font-weight:\s*([^;]+);/)[1].trim();
      const range = b.match(/unicode-range:\s*([^;]+);/)?.[1].trim() || null;
      fs.writeFileSync(path.join(dir, url), await get(CDN + f.pkg + '/files/' + url, true));
      faces.push({ file: url, weight, range });
    }
  }
  fs.writeFileSync(path.join(dir, 'OFL.txt'), await get(GH + f.gh + '/OFL.txt'));
  list.push({ id: f.id, name: f.name, family: 'Sahba ' + f.name, license: 'OFL-1.1', faces });
  console.log(f.id, faces.length, 'files');
}
fs.writeFileSync(path.join(out, 'fonts.json'), JSON.stringify(list, null, 1) + '\n');
