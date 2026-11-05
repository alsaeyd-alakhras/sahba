// Regenerates templates/<id>/preview.png (sample cover at 540×675) for every template — or only the ids given.
// Usage: node engine/tools/build-previews.mjs [editorial ...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderDeck, sampleDeck } from '../index.mjs';
import { launch, READY_JS } from '../shoot.mjs';
import { TEMPLATES_DIR, templateIds, fileUrl, writeAtomic } from '../util.mjs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : templateIds();
// neutral demo identity (no photo -> initial avatar)
const identity = { name: 'اسمك هنا', handle: '@your.handle', role: 'Content Creator' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sahba-html-preview-'));
try {
  for (const id of ids) {
    const out = path.join(tmp, id);
    const deck = sampleDeck('ar');
    await renderDeck({ deck, outDir: out, only: [1], template: id, identity });
    const page = path.join(tmp, id + '.html');
    fs.writeFileSync(page, `<!doctype html><html><body style="margin:0"><img src="${fileUrl(path.join(out, '01.png'))}" style="width:540px;height:675px;display:block"></body></html>`);
    const b = await launch();
    try {
      const p = await b.newPage();
      await p.size(540, 675);
      await p.goto(fileUrl(page));
      await p.eval(READY_JS);
      writeAtomic(path.join(TEMPLATES_DIR, id, 'preview.png'), await p.shot({ width: 540, height: 675 }));
    } finally { await b.close(); }
    console.log('preview', id);
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
