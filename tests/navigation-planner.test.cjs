const fs = require('node:fs'), vm = require('node:vm');
const {test} = require('node:test'), assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const read = name => fs.readFileSync(require('node:path').join(__dirname, '..', name), 'utf8');
function environment(html = '') {
  const dom = parseHTML('<html lang="fr-CH"><body>' + html + '</body></html>');
  const events = new dom.window.EventTarget();
  const window = {document:dom.document,CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,
    addEventListener:events.addEventListener.bind(events),
    removeEventListener:events.removeEventListener.bind(events),
    dispatchEvent:events.dispatchEvent.bind(events)};
  window.location = new URL('https://example.com/membres?categorie=Galerie&recherche=Villa');
  const data = new Map();
  window.sessionStorage = window.localStorage = {
    getItem: k => data.get(k), setItem: (k, v) => data.set(k, v)
  };
  const context = vm.createContext({window, document: window.document, location: window.location,
    console, URL, URLSearchParams, setTimeout, clearTimeout, CustomEvent: window.CustomEvent});
  vm.runInContext(read('collection-blocks.js'), context);
  vm.runInContext(read('extension-route-planner.js'), context);
  return {window, context, document: window.document, data,
    utils: window.CollectionBlocks.utils, api: window.CollectionBlocksRoutePlanner};
}
test('empty defaults use explicit then page locale and a neutral fallback', () => {
  const p = environment();
  assert.equal(p.utils.emptyMessage(), 'Aucun résultat.');
  assert.equal(p.utils.emptyMessage('en-GB'), 'No results.');
  assert.equal(p.utils.emptyMessage('de-CH'), 'Keine Ergebnisse.');
  assert.equal(p.utils.emptyMessage('it'), 'Nessun risultato.');
  assert.equal(p.utils.emptyMessage('xx'), 'No results.');
});
test('overview return retains filters only for the clicked item and expected same-origin page', () => {
  const p = environment();
  p.utils.rememberOverviewURL('/membre/villa');
  p.window.location = new URL('https://example.com/membre/villa');
  assert.equal(p.utils.getOverviewURL('/membres', true),
    'https://example.com/membres?categorie=Galerie&recherche=Villa');
  assert.equal(p.utils.getOverviewURL('/journal', true), 'https://example.com/journal');
  assert.equal(p.utils.getOverviewURL('/membres', false), 'https://example.com/membres');
  assert.equal(p.utils.getOverviewURL('javascript:alert(1)', true), null);
  p.data.set('cb-overview:/membres:/membre/villa', JSON.stringify({url:'https://evil.test/membres',time:Date.now()}));
  assert.equal(p.utils.getOverviewURL('/membres', true), 'https://example.com/membres');
  p.window.sessionStorage = {getItem(){throw new Error('blocked')}};
  assert.equal(p.utils.getOverviewURL('/membres', true), 'https://example.com/membres');
});
const galleries = Array.from({length:5}, (_, i) => ({id:'g'+i,title:'Gallery '+i,
  lat:46+i/1000,lng:6+i/1000,categories:['Galerie']}));
test('route model enforces eligibility, four stops, ordering, persistence and complete-source pruning', () => {
  const p = environment(), options = {storageKey:'test',categories:['Galerie'],maxStops:20};
  const model = p.api.createModel(options, p.window.localStorage);
  model.setItems(galleries.concat({id:'museum',categories:['Museum'],lat:46,lng:6}), true);
  assert.equal(model.toggle('museum'), false);
  for (let i=0;i<4;i++) assert.equal(model.toggle('g'+i), true);
  assert.equal(model.toggle('g4'), false);
  assert.equal(model.move('g0', -1), false);
  assert.equal(model.move('g1', -1), true);
  assert.equal(model.ids().join(','), 'g1,g0,g2,g3');
  const restored = p.api.createModel(options, p.window.localStorage);
  restored.setItems(galleries.slice(0,1), false);
  assert.equal(restored.ids().length,4);
  restored.setItems(galleries.slice(0,2), true);
  assert.equal(restored.ids().join(','),'g1,g0');
  assert.equal(restored.toggle('g1'),true);
  assert.equal(restored.ids().join(','),'g0');
  const blocked = p.api.createModel(options,{getItem(){return null},setItem(){throw Error('blocked')}});
  blocked.setItems(galleries,true); assert.equal(blocked.toggle('g0'),true);
  assert.equal(blocked.persistent(),false);
});
test('Google links preserve the chosen order with at most three waypoints and a single next stop', () => {
  const p = environment();
  const url = new URL(p.api.directions(galleries));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('api'),'1');
  assert.equal(url.searchParams.get('travelmode'),'walking');
  assert.equal(url.searchParams.has('origin'),false);
  assert.equal(url.searchParams.get('waypoints').split('|').length,3);
  assert.equal(url.searchParams.get('destination'),'46.003,6.003');
  const next = new URL(p.api.directions(galleries,true));
  assert.equal(next.searchParams.get('destination'),'46,6');
  assert.equal(next.searchParams.get('dir_action'),'navigate');
  assert.equal(next.searchParams.has('waypoints'),false);
  assert.equal(p.api.directions([{lat:null,lng:6}]),'');
});
test('planner stays unique through card rerenders and restores all controls on teardown', () => {
  const p = environment('<div class="lb-block"><div class="lb-sidebar"><div class="lb-grid">'+
    galleries.slice(0,2).map(i=>'<div class="lb-card" data-item-id="'+i.id+'">'+
      '<div class="cb-card__media lb-card__body"></div><div class="cb-card__body lb-card__body"></div></div>').join('')+
    '</div></div></div>');
  const root=p.document.querySelector('.lb-block');
  const instance={root,config:{key:'demo',display:{},routePlanner:{categories:['Galerie']}},
    getItems:()=>galleries,isComplete:()=>true};
  const c=p.api.mount(instance); assert.equal(p.api.mount(instance),c);
  root.querySelector('[data-route-id="g0"]').click();
  assert.equal(root.querySelector('.cb-route-planner__title').textContent,'Mon parcours (1/4)');
  c.refresh(); assert.equal(root.querySelectorAll('details').length,1);
  assert.equal(root.querySelectorAll('.cb-route-planner__add').length,2);
  assert.equal(root.querySelectorAll('.cb-card__media button').length,0);
  assert.equal(root.querySelector('[aria-pressed="true"]').dataset.routeId,'g0');
  c.destroy(); assert.equal(root.querySelectorAll('button,details').length,0);
});
test('navigation retains business identity with full addresses and optional Place IDs', () => {
  const p=environment();
  const selected=galleries.slice(0,2).map((g,i)=>({...g,
    navigationQuery:['Art Resonance Gallery, Rue Rodolphe-Toepffer 11, 1206 Genève, Suisse',
      'BAART, Rue du Nant 6, 1207 Genève, Suisse'][i],placeId:'place'+i}));
  const url=new URL(p.api.directions(selected));
  assert.equal(url.searchParams.get('destination'),selected[1].navigationQuery);
  assert.equal(url.searchParams.get('waypoints'),selected[0].navigationQuery);
  assert.equal(url.searchParams.get('destination_place_id'),'place1');
  assert.equal(url.searchParams.get('waypoint_place_ids'),'place0');
});
test('shared route URL overrides local selection, preserves filters, and icon cards only add', () => {
  const p=environment('<div class="lb-block"><div class="lb-sidebar"><div class="lb-grid">'+
    galleries.slice(0,3).map(i=>'<div class="lb-card" data-item-id="'+i.id+'">'+
      '<div class="cb-card__media"></div><div class="cb-card__body"></div></div>').join('')+
    '</div></div></div>');
  p.window.location=new URL('https://example.com/map?categorie=Galerie&parcours=g2%7Cg0&unrelated=1');
  p.window.history={state:null,replaceState(_s,_t,url){p.window.location=new URL(url)}};
  p.data.set('cb-route:v1:demo',JSON.stringify(['g1']));
  const root=p.document.querySelector('.lb-block');
  const instance={root,config:{key:'demo',display:{},routePlanner:{categories:['Galerie'],
    cardControl:'icon',urlState:{param:'parcours'}}},getItems:()=>galleries,isComplete:()=>true};
  const c=p.api.mount(instance);
  const names=()=>Array.from(root.querySelectorAll('.cb-route-planner__name')).map(n=>n.textContent);
  assert.deepEqual(names(),['Gallery 2','Gallery 0']);
  assert.equal(root.querySelectorAll('.cb-card__media button').length,3);
  root.querySelector('.lb-card [data-route-id="g0"]').click();
  assert.deepEqual(names(),['Gallery 2','Gallery 0']);
  root.querySelector('.lb-card [data-route-id="g1"]').click();
  assert.deepEqual(names(),['Gallery 2','Gallery 0','Gallery 1']);
  assert.equal(p.window.location.searchParams.get('parcours'),'g2|g0|g1');
  assert.equal(p.window.location.searchParams.get('categorie'),'Galerie');
  assert.equal(p.window.location.searchParams.get('unrelated'),'1');
  p.window.location=new URL('https://example.com/map?parcours=');
  // Locator can render its restored filters before the planner receives popstate.
  c.refresh();
  assert.equal(p.window.location.searchParams.get('parcours'),'');
  p.window.dispatchEvent(new p.window.Event('popstate'));
  assert.deepEqual(names(),[]);
  c.destroy();
});
test('walking preview ignores stale responses, caches ordered routes and cleans up overlays', async () => {
  const p=environment(); let calls=[], fits=0, attached=0, detached=0;
  const overlay=()=>({setMap(m){if(m)attached++;else detached++;}});
  p.window.google={maps:{importLibrary:async()=>({Route:{computeRoutes(req){
    return new Promise(resolve=>calls.push({req,resolve}));
  }}}),SymbolPath:{CIRCLE:0},Marker:function(o){attached++;return overlay()},
  LatLngBounds:function(){this.extend=()=>{}}}};
  const reports=[]; const instance={getMap:()=>({fitBounds(){fits++}})};
  const c=p.api.createPreview(instance,{debounceMs:0},(state)=>reports.push(state));
  const tick=()=>new Promise(r=>setTimeout(r,10));
  const response=()=>({routes:[{path:[{lat:46,lng:6}],warnings:[],createPolylines:()=>[overlay()]}]});
  c.update(galleries.slice(0,2));await tick();assert.equal(calls.length,1);
  c.update(galleries.slice(0,3));await tick();assert.equal(calls.length,2);
  calls[0].resolve(response());await tick();assert.equal(fits,0);
  calls[1].resolve(response());await tick();assert.equal(fits,1);
  assert.equal(calls[1].req.intermediates.length,1);
  assert.equal(calls[1].req.travelMode,'WALKING');
  c.update(galleries.slice(0,3));await tick();assert.equal(calls.length,2);
  c.update(galleries.slice(0,1));await tick();assert.equal(reports.at(-1),'empty');
  c.update(galleries.slice(0,3));await tick();assert.equal(calls.length,2);assert.equal(fits,2);
  c.destroy();assert.equal(attached,detached);
});
