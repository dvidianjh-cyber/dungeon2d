/** Last Modified: 2026-10-17. Build a portable .dungeon archive from JSON packs. */
import { readFileSync, writeFileSync } from 'node:fs';
import { encodeBundle } from '../src/game/PackManager.js';
const [output, entry, ...files] = process.argv.slice(2);
if (!output?.endsWith('.dungeon') || !entry || !files.length) {
  console.error('Usage: node scripts/pack.mjs output.dungeon entry-id pack.json [linked-pack.json ...]'); process.exitCode = 1;
} else {
  try { const packs = files.map(file => JSON.parse(readFileSync(file, 'utf8'))); writeFileSync(output, encodeBundle(packs, entry)); console.log(`Created ${output} with ${packs.length} pack(s).`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
