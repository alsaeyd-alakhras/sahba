// One-off converter: lucide-react ESM icon modules -> engine/icons/<PascalName>.svg + icons.json
// Usage: node engine/tools/build-icons.mjs <path-to>/node_modules/lucide-react
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node build-icons.mjs <lucide-react package dir>'); process.exit(1); }
const esm = path.join(src, 'dist', 'esm');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(out, { recursive: true });

const attrName = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** parse `createLucideIcon("Name", [ [tag,{...}], ... ])` without executing the module */
function readNode(file, seen = new Set()) {
  const txt = fs.readFileSync(file, 'utf8');
  const re = txt.match(/export \{ default \} from '\.\/(.+?)'/);
  if (re) { if (seen.has(file)) throw new Error('loop ' + file); seen.add(file); return readNode(path.join(path.dirname(file), re[1]), seen); }
  const m = txt.match(/createLucideIcon\("([^"]+)",\s*(\[[\s\S]*?\])\);/);
  if (!m) throw new Error('no icon node in ' + file);
  // the node array is plain JS object literal syntax with quoted values -> make it JSON
  const json = m[2].replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  return JSON.parse(json);
}

const index = fs.readFileSync(path.join(esm, 'lucide-react.js'), 'utf8');
const canon = new Map();   // file -> canonical Pascal name
const aliases = {};
for (const line of index.split('\n')) {
  const m = line.match(/^export \{ (.+) \} from '\.\/icons\/(.+?)\.js';/);
  if (!m) continue;
  const names = [...m[1].matchAll(/default as (\w+)/g)].map((x) => x[1])
    .filter((n) => !n.endsWith('Icon') && !n.startsWith('Lucide'));
  const file = m[2];
  // canonical = PascalCase of the file name
  const pascal = file.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
  const main = names.includes(pascal) ? pascal : names[0];
  canon.set(file, main);
  for (const n of names) if (n !== main) aliases[n] = main;
}

let count = 0;
for (const [file, name] of canon) {
  const node = readNode(path.join(esm, 'icons', file + '.js'));
  const body = node.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${attrName(k)}="${esc(v)}"`).join(' ');
    return `<${tag} ${a}/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`;
  fs.writeFileSync(path.join(out, name + '.svg'), svg);
  count++;
}
const version = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version;
const icons = [...canon.values()].sort();
fs.writeFileSync(path.join(out, 'icons.json'), JSON.stringify({ source: 'lucide ' + version, license: 'ISC', icons, aliases }, null, 0) + '\n');
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE'));
console.log(`wrote ${count} icons, ${Object.keys(aliases).length} aliases`);
