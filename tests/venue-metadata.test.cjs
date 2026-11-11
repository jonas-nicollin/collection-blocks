const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('optional venue survives collection fetching and Query filter projection', async () => {
  const rows = [{ id: 'closed', title: 'Exhibition', categories: ['Exposition'],
    location: { addressTitle: 'Gallery' },
    venue: { key: 'gallery', openingHours: { dates: { '2026-09-20': 'Fermé' } } }
  }, { id: 'unknown', title: 'Another exhibition', categories: ['Exposition'] }];
  const original = JSON.stringify(rows);
  const window = {};
  const context = vm.createContext({ window, console, URL, URLSearchParams,
    document: { readyState: 'loading', addEventListener() {} },
    setTimeout, clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({ items: rows }) })
  });
  vm.runInContext(read('collection-blocks.js'), context);
  vm.runInContext(read('query-block.js').replace(/\}\)\(\);\s*$/,
    'window.queryTest = { mapItem };})();'), context);
  const items = await window.CollectionBlocks.data.get('/programme', {
    sessionCache: false, memoryCache: false
  });
  const mapped = items.map(raw => window.queryTest.mapItem(raw, '/programme'));
  assert.equal(mapped[0].venue.key, 'gallery');
  assert.equal(mapped[0].location, 'Gallery');
  assert.equal(Object.hasOwn(mapped[1], 'venue'), false);
  const filtered = window.CollectionBlocks.selection.filter(mapped,
    { tags: { Available: '2026-09-20' } }, {
      projectItem(item) {
        const closed = item.venue?.openingHours.dates['2026-09-20'] === 'Fermé';
        return { ...item, tags: closed ? [] : ['Available: 2026-09-20'] };
      }
    });
  assert.deepEqual(Array.from(filtered, item => item.id), ['unknown']);
  assert.equal(JSON.stringify(rows), original);
});
