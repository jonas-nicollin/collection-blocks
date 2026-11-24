import { readFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('dist/manifest.json', root)));
const sizes = data => ({ raw: data.length, gzip: gzipSync(data).length,
  brotli: brotliCompressSync(data).length });
const assets = [];
for (const asset of manifest.assets) assets.push({ source: asset.source,
  before: sizes(await readFile(new URL(asset.source, root))),
  after: sizes(await readFile(new URL(asset.output, root))) });
console.log(JSON.stringify({ node: process.version, assets }, null, 2));
