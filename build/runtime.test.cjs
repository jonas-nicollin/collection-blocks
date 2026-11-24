const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const manifest = require('../dist/manifest.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) await pause(20);
  assert(predicate(), 'Rendered condition did not become true');
}
test('all generated scripts parse', () => {
  for (const asset of manifest.assets.filter(a => a.output.endsWith('.js'))) {
    new vm.Script(readFileSync(path.join(root, asset.output), 'utf8'));
  }
});
for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: filters, mixed related order and metadata`, async () => {
    const dom = new JSDOM('<body class="view-item"><div id="query"></div>' +
      '<div id="related"></div><div id="metadata"></div></body>', {
      url: 'https://example.com/routes/person?keep=yes', runScripts: 'outside-only',
      pretendToBeVisual: true
    });
    const w = dom.window;
    const load = name => w.eval(readFileSync(path.join(root, minified ?
      'dist/' + name.replace('.js', '.min.js') : name), 'utf8'));
    try {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.ResizeObserver = class { observe() {} disconnect() {} };
      const rows = [
        { id: 'a', title: 'Alpha', fullUrl: '/a', categories: ['Exposition'],
          tags: ['Route: Person', 'Order: 20'], workflowState: 1 },
        { id: 'b', title: 'Beta', fullUrl: '/b', categories: ['Talk'],
          tags: ['Route: Person', 'Order: 10'], workflowState: 1 }
      ];
      const current = { id: 'person', title: 'Person', fullUrl: '/routes/person',
        tags: ['Route: Person', 'Role: Curator'], categories: [] };
      load('collection-blocks.js');
      assert.equal(w.CollectionBlocks.selection.filter(rows, { category: 'Talk' }).length, 1);
      w.CollectionBlocks.data.getState = async source => ({
        items: source === '/routes' ? [current] : rows, complete: true, pagesLoaded: 1
      });
      w.CollectionBlocks.data.get = async source => source === '/routes' ? [current] : rows;
      w.fetch = async () => ({ ok: true, json: async () => ({ item: current }) });
      w.QUERY_BLOCK_CONFIGS = [{ key: 'query', target: '#query',
        sourceCollection: { path: '/items' },
        filters: { search: true, categories: false, urlState: { search: 'q' } },
        display: { showTitle: true, groups: [{ role: 'body', children: ['title'] }] },
        pagination: { mode: 'none' }, performance: { lazyInit: false, maxPages: 'all' }
      }];
      w.RELATED_BLOCK_CONFIGS = [{ key: 'related', target: '#related',
        sourceCollection: { path: '/items' },
        currentItem: { matchBy: 'pathname', sourceCollection: { path: '/routes' } },
        selection: { constraints: { requireImage: false, requirePublished: true },
          match: { groups: [{ logic: 'and', rules: [
            { type: 'sharedTagPrefix', prefixes: ['Route'] }
          ] }] }, sort: [{ type: 'tagPrefix', prefix: 'Order', valueType: 'number' }],
          limit: 10 },
        display: { showTitle: true, groups: [{ role: 'body', children: ['title'] }] },
        cardVariants: [
          { filter: { categories: ['Exposition'] }, classes: { card: 'exhibition' } },
          { filter: { excludeCategories: ['Exposition'] }, classes: { card: 'event' } }
        ], performance: { lazyInit: false }
      }];
      w.METADATA_BLOCK_CONFIGS = [{ key: 'role', buildAutomatically: true,
        moveToDestination: '#metadata', blocksOrder: ['role'],
        blocks: [{ name: 'role', source: 'tags', allowedPrefixSuffix: 'Role:',
          showTitle: false }] }];
      load('query-block.js'); load('related-block.js'); load('metadata-block.js');
      await waitFor(() => w.document.querySelectorAll('#query .qb-card').length === 2 &&
        w.document.querySelectorAll('.rb-card').length === 2 &&
        w.document.querySelector('#metadata .mb-value'));
      assert.deepEqual(Array.from(w.document.querySelectorAll('.rb-card')).map(e => e.textContent),
        ['Beta', 'Alpha']);
      assert(w.document.querySelector('.rb-card.event'));
      assert(w.document.querySelector('.rb-card.exhibition'));
      assert.equal(w.document.querySelector('#metadata .mb-value').textContent, 'Curator');
      const search = w.document.querySelector('#query input[type="search"]');
      search.value = 'Beta'; search.dispatchEvent(new w.Event('input', { bubbles: true }));
      await waitFor(() => w.document.querySelectorAll('#query .qb-card').length === 1);
      assert.equal(w.document.querySelector('#query .qb-card').textContent, 'Beta');
      assert.equal(new URL(w.location.href).searchParams.get('keep'), 'yes');
      assert.equal(new URL(w.location.href).searchParams.get('q'), 'Beta');
      w.history.pushState({}, '', '/routes/person?q=Alpha');
      w.dispatchEvent(new w.PopStateEvent('popstate'));
      await waitFor(() => w.document.querySelector('#query .qb-card')?.textContent === 'Alpha');
    } finally { dom.window.close(); }
  });
}
