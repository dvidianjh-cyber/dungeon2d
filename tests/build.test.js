/** Last Modified: 2026-10-18. Verify the artifact served by static hosts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

test('production build loads from a project subpath with bundled imports and public assets', async () => {
  const cache = resolve(root, '.cache');
  await mkdir(cache, { recursive: true });
  const outDir = await mkdtemp(join(cache, 'build-test-'));
  try {
    const result = await build({ root, logLevel: 'silent', build: { outDir } });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
    const chunks = outputs.filter(output => output.type === 'chunk');
    assert.ok(chunks.some(chunk => chunk.isEntry), 'A bundled entry point must be emitted');
    const chunkNames = new Set(chunks.map(chunk => chunk.fileName));
    for (const chunk of chunks) {
      for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) {
        const target = posix.normalize(posix.join(posix.dirname(chunk.fileName), dependency));
        assert.ok(chunkNames.has(dependency) || chunkNames.has(target), `Unbundled browser import: ${dependency}`);
      }
      assert.ok(!chunk.code.includes('import.meta.env'), 'Vite environment values must be replaced');
    }

    const site = new URL('https://example.test/dungeon2d/');
    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    assert.ok(!html.includes('./src/main.js'), 'The deployed page must not load the source entry point');
    const references = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
    assert.ok(references.some(ref => ref.endsWith('.js')), 'The page must load its JavaScript bundle');
    assert.ok(references.includes('./favicon.svg'), 'The page must reference its favicon');
    for (const ref of references) {
      const asset = new URL(ref, site);
      assert.equal(asset.origin, site.origin);
      assert.ok(asset.pathname.startsWith(site.pathname), `Asset escapes the project subpath: ${ref}`);
      const bytes = await readFile(join(outDir, asset.pathname.slice(site.pathname.length)));
      assert.ok(bytes.length > 0, `Missing or empty published asset: ${ref}`);
    }
    for (const id of ['littleton', 'golden-hour']) {
      const pack = JSON.parse(await readFile(join(outDir, 'packs', `${id}.json`), 'utf8'));
      assert.equal(pack.id, id);
      assert.ok(pack.maps.length > 0, `The ${id} adventure must be included in the published build`);
    }
  } finally {
    // Remove only the temporary build directory created inside this workspace's cache.
    assert.equal(dirname(outDir), cache);
    assert.ok(relative(cache, outDir).startsWith('build-test-'));
    await rm(outDir, { recursive: true, force: true });
  }
});
