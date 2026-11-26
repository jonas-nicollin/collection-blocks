const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const manifest = require('../dist/manifest.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
// JSDOM does not disconnect MutationObservers when closing its Window. Explicit
// fixture teardown prevents queued lifecycle work from accessing a closed URL.
function manageObservers(window) {
  const NativeObserver = window.MutationObserver, observers = [];
  window.MutationObserver = class extends NativeObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  return () => observers.forEach(observer => observer.disconnect());
}

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
    const disconnectObservers = manageObservers(w);
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
    } finally { disconnectObservers(); dom.window.close(); }
  });
}

for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: page classes, TOC lifecycle and paragraph disclosure`, async () => {
    const dom = new JSDOM('<body class="view-item keep-user-class"><header id="header"></header>' +
      '<a class="blog-item-category">Événement & Art</a><a class="blog-item-tag">Fonction: Curatrice</a>' +
      '<div class="entry"></div><main class="content"><h2>About</h2><h2>Works</h2>' +
      '<div id="reading"><p>' + 'A'.repeat(350) + '</p><p>' + 'B'.repeat(370) + '</p><p>' +
      'C'.repeat(500) + '</p></div></main>', {
      url: 'https://example.com/item/test', runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w = dom.window, d = w.document;
    const disconnectObservers = manageObservers(w);
    const load = name => w.eval(readFileSync(path.join(root, minified ?
      'dist/' + name.replace('.js', '.min.js') : name), 'utf8'));
    try {
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.scrollTo = () => {};
      load('collection-blocks.js');
      assert(d.body.classList.contains('category-evenement-art'));
      assert(d.body.classList.contains('tag-fonction-curatrice'));
      // Standard pages receive the same presence classes, without item taxonomy.
      d.body.classList.remove('view-item');
      const q = d.createElement('section');
      q.className = 'cb-block qb-block'; q.dataset.cbKey = 'ordinary-page'; d.body.append(q);
      await waitFor(() => d.body.classList.contains('has-qb-block--ordinary-page'));
      assert(!d.body.classList.contains('tag-fonction-curatrice'));
      const foreign = d.createElement('div'); foreign.className = 'cb-card';
      foreign.innerHTML = '<a class="blog-item-tag">Not page metadata</a>'; d.body.append(foreign);
      d.body.classList.add('view-item');
      await pause(50);
      assert(!d.body.classList.contains('tag-not-page-metadata'));
      w.TOC_BLOCK_CONFIGS = [{ key: 'contents', contentSelector: '.content', selectors: 'h2',
        targetContainerSelector: '.entry', sticky: true }];
      load('toc-block.js');
      await waitFor(() => d.querySelectorAll('.cb-toc__link.tocb-toc__link').length === 2);
      assert.equal(d.querySelectorAll('.automatic-toc').length, 0);
      assert(d.querySelector('.cb-toc--sticky.tocb-toc--sticky'));
      const ids = Array.from(d.querySelectorAll('.content h2')).map(e => e.id);
      assert.equal(new Set(ids).size, 2);
      load('toc-block.js');
      assert.equal(d.querySelectorAll('.tocb-block').length, 1);
      d.querySelector('.content h2').remove(); w.CollectionBlocksTOC.refresh();
      assert.equal(d.querySelectorAll('.tocb-toc__link').length, 1);
      w.CB_COLLAPSE_CONFIGS = [{ targets: '#reading', listSelector: ':scope',
        itemSelector: ':scope > p', characterLimit: 800, step: 1000,
        disableInEditMode: true, scrollToSectionOnCollapse: false,
        labels: { showMore: 'Lire la suite', showLess: 'Réduire' } }];
      load('extension-collapse.js');
      await waitFor(() => d.querySelector('.cb-collapse__more'));
      const paragraphs = Array.from(d.querySelectorAll('#reading p'));
      assert.deepEqual(paragraphs.map(p => p.hidden), [false, false, true]);
      d.querySelector('.cb-collapse__more').click();
      assert(paragraphs.every(p => !p.hidden));
      d.querySelector('.cb-collapse__less').click();
      assert(paragraphs[2].hidden);
      d.body.classList.add('sqs-edit-mode-active');
      await waitFor(() => !d.querySelector('.cb-collapse__more'));
      assert(paragraphs.every(p => !p.hidden));
      d.body.classList.remove('sqs-edit-mode-active');
      await waitFor(() => d.querySelector('.cb-collapse__more'));
      q.classList.remove('qb-block'); w.CollectionBlocksTOC.destroy();
      await waitFor(() => !d.body.classList.contains('has-qb-blocks') &&
        !d.body.classList.contains('has-tocb-blocks'));
      assert(d.body.classList.contains('keep-user-class'));
    } finally { disconnectObservers(); dom.window.close(); }
  });
}

for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: ID selection updates, mixed rendering and complete route export`, async () => {
    const dom = new JSDOM('<body><div id="target"><script type="application/json" class="refs"></script></div>' +
      '<div id="locator"><div class="lb-sidebar"><div class="lb-grid"></div></div></div></body>', {
      url: 'https://example.com/membres/carte?parcours=one|external:two',
      runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w = dom.window, d = w.document, disconnect = manageObservers(w);
    const load = name => w.eval(readFileSync(path.join(root, minified ?
      'dist/' + name.replace('.js', '.min.js') : name), 'utf8'));
    try {
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      load('collection-blocks.js'); load('extension-selection.js');
      let title = 'Current exhibition title';
      const sources = { members: { path: '/membre' }, programme: { path: '/programme' } };
      w.CollectionBlocks.data.getState = async source => ({ complete: true, items: source === '/membre'
        ? [{ id: 'm', title: 'Member', fullUrl: '/member-new-slug', workflowState: 1 }]
        : [{ id: 'e', title, fullUrl: '/exhibition-new-slug', workflowState: 1, categories: ['Exposition'] }] });
      const refs = [{ source: 'programme', id: 'e' }, { source: 'members', id: 'm' },
        { source: 'programme', id: 'e' }, { source: 'programme', id: 'deleted' }];
      let result = await w.CollectionBlocksSelection.resolve(refs, { sources });
      assert.deepEqual(Array.from(result.items, x => x.id), ['e','m']);
      assert.equal(result.missing.length, 1);
      title = 'Renamed without changing the selection';
      result = await w.CollectionBlocksSelection.resolve(refs, { sources });
      assert.equal(result.items[0].title, title);
      assert.throws(() => w.CollectionBlocksSelection.validate({version:1,items:[{source:'https://foreign',id:'e'}]},sources));
      d.querySelector('.refs').textContent = JSON.stringify({version:1,items:refs});
      w.RELATED_BLOCK_CONFIGS = [{ key:'ordered',target:'#target',
        selection:{ references:{selector:'.refs',sources} },
        display:{showTitle:true,groups:[{role:'body',children:['title']}]},
        cardVariants:[{filter:{selectionSource:'members'},classes:{card:'member'}}],
        performance:{lazyInit:false} }];
      let rendered;
      d.addEventListener('cb:related-render', e => { rendered = e.detail.items; });
      load('related-block.js');
      await waitFor(() => d.querySelectorAll('.rb-card').length === 2);
      assert.equal(d.querySelector('.rb-card').textContent, title);
      assert.equal(d.querySelector('.member').dataset.itemId, 'm');
      assert.equal(rendered[1].selectionSource, 'members');
      load('extension-route-planner.js');
      const route = w.CollectionBlocksRoutePlanner;
      const stops = Array.from({length:8},(_,i)=>({id:String(i),title:'Place '+i,lat:46+i/1000,lng:6}));
      const model=route.createModel({maxStops:25,storageKey:'test'},null);
      model.setItems(stops,true); model.replace(stops.map(x=>x.id)); assert.equal(model.selected().length,8);
      assert.equal(route.directions(stops,false,'walking'),''); // Never silently truncate.
      assert.equal(new URL(route.directions(stops.slice(0,4),false,'walking')).searchParams.get('waypoints').split('|').length,3);
      let items=[{...stops[0],id:'one'}];
      const cfg={ key:'route',display:{cardClickable:false},routePlanner:{maxStops:25,
        urlState:{param:'parcours'},resolveItems:async()=>[{...stops[1],id:'external:two'}]}};
      const controller=route.mount({root:d.querySelector('#locator'),config:cfg,getItems:()=>items,isComplete:()=>true});
      await waitFor(()=>d.querySelectorAll('.cb-route-planner__stop').length===2);
      assert(d.querySelector('.cb-route-planner').open);
      w.history.pushState({},'', '?parcours='+stops.map(x=>x.id).join('|'));
      items=stops; w.dispatchEvent(new w.PopStateEvent('popstate'));
      await waitFor(()=>d.querySelectorAll('.cb-route-planner__stop').length===8);
      const links=Array.from(d.querySelectorAll('.cb-route-planner__segment'));
      assert.equal(links.length,3);
      const destinations=links.map(a=>new URL(a.href).searchParams.get('destination'));
      assert.equal(destinations.at(-1),'46.007,6');
      assert(links.every(a=>new URL(a.href).searchParams.get('waypoints').split('|').length<=3));
      controller.destroy();
    } finally { disconnect(); dom.window.close(); }
  });
}
