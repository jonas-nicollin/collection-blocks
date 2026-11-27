const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const manifest = require('../dist/manifest.json');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: editor preserves target badge and confirms current export`, async () => {
    const dom = new JSDOM('<body class="sqs-edit-mode-active"><div id="route" ' +
      'class="cb-target rb-target route" data-rb-label="Parcours &amp; choix">' +
      '<div class="cb-selection" hidden>{"version":1,"items":[{"source":"members","id":"one"}]}</div></div>',
      { url: 'https://example.com/route', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, d = w.document, stop = manageObservers(w);
    let copied = '';
    w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    w.HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new w.Event('close')); };
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
    w.CollectionBlocks = { data: { getState: async () => ({ complete: true,
      items: [{ id: 'one', title: 'A long member title' }, { id: 'two', title: 'Second member' }] }) } };
    w.CB_SELECTION_EDITOR_CONFIGS = [{ target: '.route', targetClass: 'cb-target rb-target route',
      targetLabel: 'Son parcours – Sélection', sources: { members: { path: '/members' } } }];
    const load = name => w.eval(readFileSync(path.join(root, minified ?
      'dist/' + name.replace('.js', '.min.js') : name), 'utf8'));
    try {
      load('extension-selection.js'); load('extension-selection-editor.js');
      d.querySelector('.cb-editor__trigger').click();
      await waitFor(() => d.querySelectorAll('.cb-editor__stop').length === 1);
      d.querySelector('.cb-editor__copy').click();
      await waitFor(() => d.querySelector('.cb-editor__copy').textContent === 'Code copié');
      const exported = new JSDOM(copied).window.document.querySelector('#route');
      assert(copied.includes('\n  <div class="cb-selection"'));
      assert(copied.includes('\n    {\n'));
      assert.equal(d.querySelector('.cb-editor__output').wrap, 'off');
      assert.equal(exported.dataset.cbLabel, 'Son parcours – Sélection');
      assert.equal(exported.dataset.rbLabel, 'Parcours & choix');
      assert(exported.classList.contains('rb-target'));
      assert.deepEqual(JSON.parse(exported.querySelector('.cb-selection').textContent).items,
        [{ source: 'members', id: 'one' }]);
      d.querySelector('[aria-label="Ajouter : Second member"]').click();
      assert.equal(d.querySelector('.cb-editor__copy').textContent, 'Copier le Code Block');
      assert(d.querySelector('.cb-editor__output').hidden);
      const dialog = d.querySelector('dialog');
      dialog.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 500 });
      const pointer = (type, x) => dialog.dispatchEvent(new w.MouseEvent(type,
        { bubbles: true, clientX: x, clientY: 200 }));
      pointer('pointerdown', 200); pointer('click', 200);
      assert(dialog.open, 'Empty space within the dialog must not close it');
      pointer('pointerdown', 200); pointer('click', 50);
      assert(dialog.open, 'A drag from inside to outside must not close it');
      pointer('pointerdown', 50); pointer('click', 50);
      assert(!d.querySelector('dialog'), 'Clicking the backdrop closes the dialog');
      d.body.classList.remove('sqs-edit-mode-active');
      await waitFor(() => !d.querySelector('.cb-editor__trigger'));
    } finally { stop(); w.close(); }
  });
}
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
        mediaQuery: '(max-width: 767px)',
        disableInEditMode: true, scrollToSectionOnCollapse: false,
        labels: { showMore: 'Lire la suite', showLess: 'Réduire' } }];
      const mediaListeners = new Set();
      const media = { matches: false,
        addEventListener: (_type, fn) => mediaListeners.add(fn),
        removeEventListener: (_type, fn) => mediaListeners.delete(fn) };
      w.matchMedia = () => media;
      load('extension-collapse.js');
      w.CollectionBlocksCollapse.refresh();
      assert(!d.querySelector('.cb-collapse__more'));
      media.matches = true; mediaListeners.forEach(fn => fn());
      await waitFor(() => d.querySelector('.cb-collapse__more'));
      const paragraphs = Array.from(d.querySelectorAll('#reading p'));
      assert.deepEqual(paragraphs.map(p => p.hidden), [false, false, true]);
      d.querySelector('.cb-collapse__more').click();
      assert(paragraphs.every(p => !p.hidden));
      d.querySelector('.cb-collapse__less').click();
      assert(paragraphs[2].hidden);
      media.matches = false; mediaListeners.forEach(fn => fn());
      assert(paragraphs.every(p => !p.hidden));
      assert(!d.querySelector('.cb-collapse__controls'));
      media.matches = true; mediaListeners.forEach(fn => fn());
      assert.deepEqual(paragraphs.map(p => p.hidden), [false, false, true]);
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
      const warningHost = d.createElement('div'); warningHost.className = 'map-host';
      d.querySelector('#locator').append(warningHost);
      const cfg={ key:'route',display:{cardClickable:false},routePlanner:{maxStops:25,
        warningsTarget: '.map-host',
        urlState:{param:'parcours'},resolveItems:async()=>[{...stops[1],id:'external:two'}]}};
      const controller=route.mount({root:d.querySelector('#locator'),config:cfg,getItems:()=>items,isComplete:()=>true});
      await waitFor(()=>d.querySelectorAll('.cb-route-planner__stop').length===2);
      assert(d.querySelector('.cb-route-planner').open);
      assert(warningHost.querySelector('.cb-route-planner__warnings'));
      d.querySelector('.cb-route-planner').open = false;
      d.querySelector('.cb-route-planner').dispatchEvent(new w.Event('toggle'));
      assert(warningHost.querySelector('.cb-route-planner__warnings'));
      w.history.pushState({},'', '?parcours='+stops.map(x=>x.id).join('|'));
      items=stops; w.dispatchEvent(new w.PopStateEvent('popstate'));
      await waitFor(()=>d.querySelectorAll('.cb-route-planner__stop').length===8);
      const links=Array.from(d.querySelectorAll('.cb-route-planner__segment'));
      assert.equal(links.length,3);
      const destinations=links.map(a=>new URL(a.href).searchParams.get('destination'));
      assert.equal(destinations.at(-1),'46.007,6');
      assert(links.every(a=>new URL(a.href).searchParams.get('waypoints').split('|').length<=3));
      controller.destroy();
      assert(!warningHost.querySelector('.cb-route-planner__warnings'));
    } finally { disconnect(); dom.window.close(); }
  });
}

for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: enquiry links preserve complete captions and existing URLs`, () => {
    const dom = new JSDOM('<div id="works"><a class="work"><img src="https://example.com/work.jpg">' +
      '<span class="artist">Anne &amp; Bob</span><span class="title">L’œuvre &lt;3&gt;</span>' +
      '<div class="details"><p>2026</p><p>Oil &amp; ink<br>30 × 40 cm</p></div></a></div>',
      { url: 'https://example.com/artists/anne', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, d = w.document, stop = manageObservers(w);
    let slides;
    w.Fancybox = { show: value => { slides = value; return {}; } };
    try {
      w.eval(readFileSync(path.join(root, minified ?
        'dist/extension-fancybox.min.js' : 'extension-fancybox.js'), 'utf8'));
      const cfg = { itemSelector: '.work', selectors: {
        image: 'img', category: '.artist', title: '.title', excerpt: '.details'
      }, button: { enabled: true, label: 'Enquire', href: '/enquire?existing=1#form' } };
      let controller = w.CollectionBlocksFancybox.mount(d.querySelector('#works'), cfg);
      controller.open(d.querySelector('.work'));
      let caption = new JSDOM(slides[0].caption).window.document;
      assert.equal(caption.querySelector('a').getAttribute('href'), '/enquire?existing=1#form');
      controller.destroy();
      cfg.button.prefill = { subjectParam: 'subject', captionParam: 'caption' };
      controller = w.CollectionBlocksFancybox.mount(d.querySelector('#works'), cfg);
      controller.open(d.querySelector('.work'));
      caption = new JSDOM(slides[0].caption).window.document;
      const url = new URL(caption.querySelector('a').href);
      assert.equal(url.searchParams.get('existing'), '1');
      assert.equal(url.hash, '#form');
      assert.equal(url.searchParams.get('subject'), 'Anne & Bob — L’œuvre <3>');
      assert.equal(url.searchParams.get('caption'), 'Anne & Bob\nL’œuvre <3>\n2026\nOil & ink\n30 × 40 cm');
      controller.destroy();
    } finally { stop(); w.close(); }
  });
}

for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: Query resolves explicit references without changing ordinary queries`, async () => {
    const dom = new JSDOM('<div id="picked"><div class="cb-selection" hidden>' +
      JSON.stringify({version:1,items:[{source:'p',id:'b'},{source:'p',id:'missing'},{source:'p',id:'a'}]}) +
      '</div></div><div id="sorted"><div class="cb-selection" hidden>' +
      JSON.stringify({version:1,items:[{source:'p',id:'b'},{source:'p',id:'a'}]}) +
      '</div></div><div id="ordinary"></div><div id="empty"><div class="cb-selection" hidden>' +
      '{"version":1,"items":[]}</div></div>',
      {url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w);
    const load=name=>w.eval(readFileSync(path.join(root,minified?'dist/'+name.replace('.js','.min.js'):name),'utf8'));
    try {
      w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
      w.ResizeObserver=class {observe(){} disconnect(){}};
      load('collection-blocks.js');
      w.CollectionBlocks.data.getState=async()=>({complete:true,items:[
        {id:'a',title:'Alpha',fullUrl:'/a',assetUrl:'https://example.com/a.jpg',workflowState:1},
        {id:'b',title:'Beta',fullUrl:'/b',assetUrl:'https://example.com/b.jpg',workflowState:1}]});
      load('extension-selection.js');
      const refs={references:{sources:{p:{path:'/items'}}}};
      w.QUERY_BLOCK_CONFIGS=['picked','sorted','ordinary','empty'].map(key=>({key,target:'#'+key,
        sourceCollection:{path:'/items'},selection:key==='sorted' ?
          {references:{...refs.references,preserveOrder:false}} : refs,sort:{type:'title',direction:'asc'},
        performance:{lazyInit:false,maxPages:'all',priorityImages:key==='picked'?1:0},filters:false,pagination:{mode:'none'},
        display:{groups:[{role:'body',children:['image','title']}]}}));
      load('query-block.js');
      await waitFor(()=>d.querySelectorAll('#picked .qb-card').length===2 && d.querySelectorAll('#ordinary .qb-card').length===2);
      assert.deepEqual([...d.querySelectorAll('#picked .qb-card')].map(x=>x.getAttribute('href')),['/b','/a']);
      assert.deepEqual([...d.querySelectorAll('#ordinary .qb-card')].map(x=>x.getAttribute('href')),['/a','/b']);
      assert.deepEqual([...d.querySelectorAll('#sorted .qb-card')].map(x=>x.getAttribute('href')),['/a','/b']);
      assert.deepEqual([...d.querySelectorAll('#picked img')].map(x=>x.fetchPriority),['high','low']);
      assert([...d.querySelectorAll('#sorted img,#ordinary img')].every(x=>x.fetchPriority==='low'));
      assert.equal(d.querySelector('#picked').dataset.cbSelectionMissing,'1');
      assert.equal(d.querySelectorAll('#empty .qb-card').length,0);
      assert(d.querySelector('#picked .cb-selection'),'reference document survives rendering for editor');
    } finally {stop();w.close();}
  });
  test(`${minified ? 'distribution' : 'source'}: Fancybox origin and canonical-only classes`,()=>{
    const dom=new JSDOM('<section id="rb-example" class="cb-block rb-block"><a class="rb-card"><img src="https://example.com/a.jpg"><span class="title">Work</span></a></section>',
      {url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w);let options,slides;
    w.Fancybox={show:(s,o)=>{slides=s;options=o;return {};}};
    try {
      const load=name=>w.eval(readFileSync(path.join(root,minified?'dist/'+name.replace('.js','.min.js'):name),'utf8'));
      load('collection-blocks.js');load('extension-fancybox.js');
      const cfg={itemSelector:'.rb-card',legacyClasses:false,selectors:{image:'img',title:'.title'},classPrefixes:{specific:'summary-artworks'}};
      let c=w.CollectionBlocksFancybox.mount(d.querySelector('section'),cfg); c.open(d.querySelector('a'));
      assert(options.mainClass.includes('cb-fancybox--source-rb-example'));
      assert(options.mainClass.includes('rb-fancybox--source-rb-example'));
      assert(!options.mainClass.includes('summary-artworks'));
      assert(!slides[0].caption.includes('summary-artworks'));
      assert(!slides[0].caption.includes('custom-fancybox'));
      c.destroy();c=w.CollectionBlocksFancybox.mount(d.querySelector('section'),{...cfg,libraryVersion:5});c.open(d.querySelector('a'));
      assert(options.mainClass.includes('cb-fancybox--source-rb-example'));
    } finally {stop();w.close();}
  });
}

for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: target launchers open only their own selection`, async () => {
    const dom = new JSDOM('<body class="sqs-edit-mode-active">' + ['one','two'].map(id =>
      `<div id="${id}" class="cb-target"><div class="cb-selection" hidden>${JSON.stringify({version:1,items:[{source:'p',id}]})}</div></div>`).join(''),
      {url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w);
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'));};
    w.CollectionBlocks={data:{getState:async()=>({complete:true,items:[{id:'one',title:'First'},{id:'two',title:'Second'}]})}};
    w.CB_SELECTION_EDITOR_CONFIGS=['one','two'].map(id=>({target:'#'+id,triggerPlacement:'target',title:id,sources:{p:{path:'/items'}}}));
    ['one','two'].forEach((id,i)=>{d.getElementById(id).getBoundingClientRect=()=>({top:100+i*200,bottom:280+i*200,right:500,width:400});});
    try {
      const load=name=>w.eval(readFileSync(path.join(root,minified?'dist/'+name.replace('.js','.min.js'):name),'utf8'));
      load('extension-selection.js');load('extension-selection-editor.js');
      const triggers=[...d.querySelectorAll('.cb-editor__trigger--target')];
      assert.equal(triggers.length,2); assert(!d.querySelector('.cb-editor__toolbar'));
      assert.notEqual(triggers[0].style.top,triggers[1].style.top);
      for(let i=0;i<2;i++){
        triggers[i].click(); await waitFor(()=>d.querySelectorAll('.cb-editor__stop').length===1);
        assert.equal(d.querySelector('dialog').getAttribute('aria-label'),['one','two'][i]);
        assert.equal(d.querySelector('.cb-editor__stop .cb-editor__name').textContent,['First','Second'][i]);
        triggers[1-i].click(); assert.equal(d.querySelectorAll('dialog').length,1);
        d.querySelector('.cb-editor__close').click();
      }
      d.body.classList.remove('sqs-edit-mode-active');w.CollectionBlocksSelectionEditor.refresh();
      assert.equal(d.querySelectorAll('.cb-editor__trigger').length,0);
    } finally {stop();w.close();}
  });
}
for (const minified of [false, true]) {
  test(`${minified ? 'distribution' : 'source'}: dock, categories, continuous catalog and scroll restoration`, async () => {
    const dom = new JSDOM('<body class="sqs-edit-mode-active" style="overflow:scroll">' +
      Array.from({length:6},(_,i)=>`<div id="block${i}"><div class="cb-selection" hidden>{"version":1,"items":[]}</div></div>`).join(''),
      {url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w);
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
    const items=Array.from({length:63},(_,i)=>({id:String(i),title:'Item '+String(i).padStart(2,'0'),categories:i===1?[]:['Studio Visit']}));
    w.CollectionBlocks={data:{getState:async()=>({complete:true,items})}};
    w.CB_SELECTION_EDITOR_CONFIGS=Array.from({length:6},(_,i)=>({target:'#block'+i,triggerPlacement:'dock',
      title:'Selection '+i,icons:'material-symbols',types:[{key:'',label:'Articles'}],sources:{p:{path:'/items'}}}));
    const load=name=>w.eval(readFileSync(path.join(root,minified?'dist/'+name.replace('.js','.min.js'):name),'utf8'));
    try {
      load('extension-selection.js');load('extension-selection-editor.js');
      assert.equal(d.querySelectorAll('.cb-editor__launcher').length,1);
      assert.equal(d.querySelectorAll('.cb-editor__menu .cb-editor__trigger').length,6);
      const launcher=d.querySelector('.cb-editor__launcher');launcher.click();
      assert(!d.querySelector('.cb-editor__menu').hidden);
      d.querySelectorAll('.cb-editor__trigger')[4].click();
      await waitFor(()=>d.querySelectorAll('.cb-editor__row').length===24);
      assert(d.querySelector('.cb-editor__menu').hidden);
      assert.equal(d.querySelector('dialog').getAttribute('aria-label'),'Selection 4');
      assert.equal(d.body.style.overflow,'hidden');
      assert.equal(d.documentElement.style.overflow,'hidden');
      assert.equal(d.querySelector('.cb-editor__kind').textContent,'Studio Visit');
      assert(!d.querySelectorAll('.cb-editor__row')[1].querySelector('.cb-editor__kind'));
      assert(!d.querySelector('.cb-editor__more'));
      const catalog=d.querySelector('.cb-editor__catalog');
      Object.defineProperty(catalog,'clientHeight',{value:200});
      Object.defineProperty(catalog,'scrollHeight',{value:1000});catalog.scrollTop=700;
      catalog.dispatchEvent(new w.Event('scroll'));
      assert.equal(d.querySelectorAll('.cb-editor__row').length,48);
      catalog.scrollTop=0;
      const search=d.querySelector('.cb-editor__search');search.value='Item 62';search.dispatchEvent(new w.Event('input'));
      assert.equal(d.querySelectorAll('.cb-editor__row').length,1);
      d.querySelector('.cb-editor__add').click();
      assert.equal(d.querySelector('.cb-editor__stop .cb-editor__name').textContent,'Item 62');
      d.querySelector('.cb-editor__close').click();
      assert.equal(d.body.style.overflow,'scroll');assert.equal(d.documentElement.style.overflow,'');
    } finally {stop();w.close();}
  });
  test(`${minified ? 'distribution' : 'source'}: native text uses shared collapse and restores edit markup`, async()=>{
    const dom=new JSDOM('<body><section id="text"><h2>Keep heading</h2><p class="intro">Keep intro</p><p>'+ 'Text '.repeat(120) +
      '</p><p>Second paragraph</p><h3>Keep footer</h3></section></body>',{url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w),original=d.querySelector('section').innerHTML;
    try {
      w.CB_COLLAPSE_CONFIGS=[{targets:'#text',mode:'text',startSelector:'p:not(.intro)',disableInEditMode:true}];
      w.eval(readFileSync(path.join(root,minified?'dist/extension-collapse.min.js':'extension-collapse.js'),'utf8'));
      w.CollectionBlocksCollapse.refresh();
      assert.equal(d.querySelectorAll('.cb-collapse__content p').length,2);
      assert(d.querySelector('.cb-collapse__content--collapsed'));
      d.querySelector('.cb-collapse__toggle').click();assert(!d.querySelector('.cb-collapse__content--collapsed'));
      d.body.classList.add('sqs-edit-mode-active');w.CollectionBlocksCollapse.refresh();
      assert.equal(d.querySelector('section').innerHTML,original);
      d.body.classList.remove('sqs-edit-mode-active');w.CollectionBlocksCollapse.refresh();
      assert.equal(d.querySelectorAll('.cb-collapse__toggle').length,1);
    }finally{stop();w.close();}
  });
}
for (const minified of [false,true]) {
  test(`${minified?'distribution':'source'}: Locator route focus preserves markers and restores hover/focus`,async()=>{
    const dom=new JSDOM('<div id="map"></div>',{url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w),markers=[];
    const load=name=>w.eval(readFileSync(path.join(root,minified?'dist/'+name.replace('.js','.min.js'):name),'utf8'));
    try {
      w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
      w.ResizeObserver=class{observe(){}disconnect(){}};
      w.google={maps:{Map:class{addListener(){}fitBounds(){}},LatLngBounds:class{extend(){}},
        Marker:class {constructor(o){Object.assign(this,o);this.events={};markers.push(this);}addListener(n,f){this.events[n]=f;}setOpacity(v){this.opacity=v;}setZIndex(v){this.zIndex=v;}setVisible(v){this.visible=v;}setPosition(){}},
        ControlPosition:{}}};
      load('collection-blocks.js');
      w.CollectionBlocks.data.getState=async()=>({complete:true,items:['a','b','c'].map((id,i)=>({id,title:id,fullUrl:'/'+id,location:{mapLat:46+i/100,mapLng:6},venue:{key:id}}))});
      w.LOCATOR_BLOCK_CONFIGS=[{target:'#map',apiKey:'test',sourceCollection:{path:'/places'},map:{markerStyle:'google',routeFocus:{opacity:.25},popup:false},performance:{lazyInit:false},display:{pageSize:0,cardLink:true}}];
      load('locator-block.js');await waitFor(()=>w.LocatorBlock.getInstances().length===1);
      const instance=w.LocatorBlock.getInstances()[0],items=instance.getItems();
      instance.setRouteSelection(items.slice(0,1));assert(markers.every(m=>m.opacity===1));
      instance.setRouteSelection(items.slice(0,2));assert.deepEqual(markers.map(m=>m.opacity),[1,1,.25]);
      assert(markers.every(m=>m.visible!==false));
      markers[2].events.mouseover();assert.equal(markers[2].opacity,1);markers[2].events.mouseout();assert.equal(markers[2].opacity,.25);
      const card=d.querySelector('[data-item-id="c"]');card.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));assert.equal(markers[2].opacity,1);
      card.dispatchEvent(new w.FocusEvent('focusout',{bubbles:true}));await pause(30);assert.equal(markers[2].opacity,.25);
      instance.setRouteSelection([{id:'external',venueKey:'a',lat:items[0].lat,lng:items[0].lng},items[1]]);assert.equal(markers[0].opacity,1);
      instance.setRouteSelection([]);assert(markers.every(m=>m.opacity===1));assert(!d.querySelector('.cb-block--route-focused'));
    }finally{stop();w.close();}
  });
}
for (const minified of [false,true]) {
  test(`${minified?'distribution':'source'}: Banner consumes early thumbnail request without fetching twice`,async()=>{
    const dom=new JSDOM('<body class="view-item"><main class="blog-item-wrapper"><h1>Portrait</h1><div class="blog-item-content-wrapper"></div></main></body>',{url:'https://example.com/parcours/person',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,stop=manageObservers(w);let fetches=0;
    try {
      w.fetch=()=>{fetches++;throw Error('Unexpected second request');};
      w.BANNER_BLOCK_CONFIGS=[{bodyClassConditions:['view-item'],imageSource:'thumbnail',destinationSelector:'.blog-item-wrapper',insertionMethod:'prepend',thumbnailRequest:Promise.resolve({item:{title:'Person',fullUrl:'/parcours/person',assetUrl:'https://example.com/portrait.jpg',originalSize:'1200x1800',mediaFocalPoint:{x:.3,y:.4}}})}];
      w.eval(readFileSync(path.join(root,minified?'dist/banner-block.min.js':'banner-block.js'),'utf8'));
      await waitFor(()=>d.querySelector('.cb-banner__image'));
      const img=d.querySelector('.cb-banner__image');assert.equal(fetches,0);assert.equal(img.width,1200);assert.equal(img.height,1800);assert.equal(img.style.objectPosition,'30% 40%');assert.equal(img.getAttribute('fetchpriority'),'high');
      w.BannerBlock.refresh();assert.equal(d.querySelectorAll('.cb-banner').length,1);
    }finally{stop();w.close();}
  });
}
