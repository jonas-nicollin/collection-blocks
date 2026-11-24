import { build, version } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = [
  'banner-block.css', 'banner-block.js', 'collection-blocks.css',
  'collection-blocks.js', 'extension-collapse.js', 'extension-explorer.css',
  'extension-explorer.js', 'extension-fancybox.js', 'extension-map.js',
  'extension-masonry.js', 'extension-route-planner.css', 'extension-route-planner.js',
  'extension-scroller.css', 'extension-scroller.js', 'extension-slider.js',
  'gallery-block.css', 'gallery-block.js', 'location-block.js', 'locator-block.js',
  'metadata-block.js', 'query-block.js', 'related-block.js'
];
const check = process.argv.includes('--check');
const hash = data => createHash('sha256').update(data).digest('hex');
const sizes = data => ({ raw: data.length });
const manifest = { esbuild: version, assets: [] };
if (!check) await mkdir(path.join(root, 'dist'), { recursive: true });
async function output(file, data) {
  if (check) {
    const existing = await readFile(file);
    if (!existing.equals(Buffer.from(data))) throw new Error('Rebuild required: ' + file);
  } else await writeFile(file, data);
}
for (const name of assets) {
  const source = await readFile(path.join(root, name));
  const target = 'dist/' + name.replace(/\.(js|css)$/, '.min.$1');
  const result = await build({
    absWorkingDir: root, entryPoints: [name], outfile: target, bundle: false,
    minify: true, sourcemap: 'linked', sourcesContent: false, legalComments: 'inline',
    charset: 'utf8', write: false, logLevel: 'silent'
    // No property mangling, transpilation target or module bundling.
  });
  if (result.warnings.length) throw new Error(JSON.stringify(result.warnings));
  for (const file of result.outputFiles) await output(file.path, file.contents);
  const generated = result.outputFiles.find(file => file.path.endsWith(target)).contents;
  manifest.assets.push({ source: name, output: target, sourceSHA256: hash(source),
    outputSHA256: hash(generated), before: sizes(source), after: sizes(generated) });
}
await output(path.join(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${check ? 'Verified' : 'Built'} ${assets.length} minified assets and source maps.`);
