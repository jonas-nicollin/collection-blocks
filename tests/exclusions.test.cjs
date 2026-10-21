const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const window = { RELATED_BLOCK_CONFIGS: [{ _shared: true }] };
const context = vm.createContext({ window, document: { readyState: 'loading', addEventListener() {} }, console, URLSearchParams, URL, setTimeout, clearTimeout });
vm.runInContext(read('collection-blocks.js'), context);
vm.runInContext(read('query-block.js').replace(/\}\)\(\);\s*$/, 'window.queryTest = { matchesConfiguredFilter, applyPreFilter, applyTabFilter };})();'), context);
vm.runInContext(read('related-block.js').replace(/\}\)\(\);\s*$/, 'window.relatedTest = { matchesConfiguredItemFilter, applyFallbackFill };})();'), context);
const excluded = window.CollectionBlocks.utils.isItemExcluded;
const featured = { title: 'Louise', fullUrl: '/louise', categories: ['L’Entretien'], tags: ['Sélection: Hero', 'Sujet: Louise Bonnet'] };
const ordinary = { title: 'Other', fullUrl: '/other', categories: ['Art Public'], tags: ['Sélection: Homepage'] };
const filters = [
  { excludeCategories: ["L'Entretien"] },
  { excludeTagPrefixes: [' Sélection: '] },
  { excludeTagValues: [{ prefix: 'selection', value: 'HERO' }] }
];

test('exclusions normalize accents, apostrophes and optional colon', () => {
  for (const filter of filters) assert.equal(excluded(featured, filter), true);
});
test('exact values do not exclude neighboring labels or unprefixed tags', () => {
  const filter = { excludeTagValues: [{ prefix: 'Sélection', value: 'Hero' }] };
  for (const tag of ['Sélection: Hero homepage', 'Autre Sélection: Hero', 'Hero']) {
    assert.equal(excluded({ tags: [tag] }, filter), false);
  }
  assert.equal(excluded(ordinary, filter), false);
});
test('no settings, empty lists and missing metadata preserve items', () => {
  for (const filter of [undefined, {}, { excludeCategories: [], excludeTagPrefixes: [], excludeTagValues: [] }]) {
    assert.equal(excluded(featured, filter), false);
    assert.equal(window.queryTest.matchesConfiguredFilter(featured, filter), true);
    assert.equal(window.relatedTest.matchesConfiguredItemFilter(featured, filter), true);
  }
  for (const filter of filters) assert.equal(excluded({}, filter), false);
});
test('Query prefilters and tab filters apply exclusions before pagination', () => {
  for (const filter of [filters[0], filters[2]]) {
    assert.equal(window.queryTest.applyPreFilter([featured, ordinary], filter).length, 1);
    assert.equal(window.queryTest.applyTabFilter([featured, ordinary], filter)[0].title, 'Other');
  }
});
test('Related prefilter and fallback both reject featured content', () => {
  for (const preFilter of [filters[0], filters[2]]) {
    assert.equal(window.relatedTest.matchesConfiguredItemFilter(featured, preFilter), false);
    const result = window.relatedTest.applyFallbackFill([], [featured, ordinary], {}, {
      limit: 2, fallback: { enabled: true, fillToLimit: true, sort: [{ type: 'title', direction: 'asc' }] }
    }, { preFilter });
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Other');
  }
});
test('Locator applies the common exclusions alongside its existing categories', () => {
  // Execute the actual local prefilter without starting Maps or the DOM renderer.
  const code = read('locator-block.js').split('  function passesPreFilter(item){')[1].split('\n  var filtered =')[0];
  for (const preFilter of filters) {
    const locatorContext = vm.createContext({ cfg: { preFilter }, getCollectionUtils: () => window.CollectionBlocks.utils,
      asArray: value => Array.isArray(value) ? value : value ? [value] : [],
      hasAnyCategory: (item, cats) => cats.some(c => item.categories.includes(c)) });
    const fn = vm.runInContext('(function passesPreFilter(item){' + code + ')', locatorContext);
    assert.equal(fn(featured), false);
  }
});
