const repository = 'jonas-nicollin/collection-blocks';
const branch = 'main';
const defaultFiles = [
  'collection-blocks.css',
  'collection-blocks.js',
  'query-block.js',
  'metadata-block.js',
  'related-block.js',
  'locator-block.js'
];

const files = process.argv.slice(2).filter(Boolean);
const targets = files.length ? files : defaultFiles;

for (const file of targets) {
  const cleanFile = String(file).replace(/^\/+/, '');
  const url = `https://purge.jsdelivr.net/gh/${repository}@${branch}/${cleanFile}`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Purge failed for ${cleanFile}: HTTP ${response.status} ${body}`);
  }

  console.log(`Purged ${cleanFile}`);
}
