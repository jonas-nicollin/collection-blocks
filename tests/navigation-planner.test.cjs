const fs = require('node:fs'), vm = require('node:vm');
const {test} = require('node:test'), assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const read = name => fs.readFileSync(require('node:path').join(__dirname, '..', name), 'utf8');
function environment(html = '') {
  const {window} = parseHTML('<html lang="fr-CH"><body>' + html + '</body></html>');
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
  assert.equal(root.querySelector('summary').textContent,'Mon parcours (1/4)');
  c.refresh(); assert.equal(root.querySelectorAll('details').length,1);
  assert.equal(root.querySelectorAll('.cb-route-planner__add').length,2);
  assert.equal(root.querySelectorAll('.cb-card__media button').length,0);
  assert.equal(root.querySelector('[aria-pressed="true"]').dataset.routeId,'g0');
  c.destroy(); assert.equal(root.querySelectorAll('button,details').length,0);
});
