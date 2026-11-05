// Engine seam: the real engine (ROOT/engine/index.mjs, SPEC §5) or a module named by SAHBA_ENGINE (tests use a mock).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, err } from './lib.mjs';

export const ENGINE_PATH = path.resolve(process.env.SAHBA_ENGINE || path.join(ROOT, 'engine', 'index.mjs'));
let mod = null;

/** Loaded engine module; throws `engine_missing` (503) while it does not exist yet. */
export async function engine() {
  if (mod) return mod;
  if (!fs.existsSync(ENGINE_PATH)) throw err('engine_missing', `engine not found at ${ENGINE_PATH}`, 503);
  try { mod = await import(pathToFileURL(ENGINE_PATH).href); }
  catch (e) { throw err('engine_missing', `engine failed to load: ${e.message}`, 503); }
  return mod;
}
export const available = () => fs.existsSync(ENGINE_PATH);
