const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname, '..', 'extension-masonry.js'), 'utf8');

function fixture() {
  const frames = new Map(); let frameId = 0;
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
  }
  function element(className, height = 100) {
    return {
      className, style: { position: '', display: '', height: '', width: '', left: '', top: '', margin: '' },
      children: [], isConnected: true, clientWidth: 620, hidden: false, offsetHeight: height,
      listeners: {}, matches(selector) { return selector.split(',').some(s => s.trim() === '.' + this.className); },
      querySelectorAll() { return []; },
      addEventListener(type, cb) { this.listeners[type] = cb; },
      removeEventListener(type) { delete this.listeners[type]; }
    };
  }
  const window = { innerWidth: 1200, addEventListener() {}, ResizeObserver: Observer };
  const context = { window, document: { documentElement: {}, addEventListener() {} },
    ResizeObserver: Observer, MutationObserver: Observer,
    getComputedStyle: el => ({ display: el.hidden ? 'none' : 'block', fontSize: '16px', getPropertyValue: () => '' }),
    requestAnimationFrame: cb => { frames.set(++frameId, cb); return frameId; },
    cancelAnimationFrame: id => frames.delete(id)
  };
  vm.runInNewContext(code, context);
  function flush() { const current = [...frames.values()]; frames.clear(); current.forEach(cb => cb()); }
  return { api: window.CollectionBlocksMasonry, window, element, frames, flush, observers, context };
}

test('Query, Related and Locator cards lay out before any image finishes', () => {
  const f = fixture(); const grid = f.element('grid');
  grid.children = [f.element('qb-card', 200), f.element('rb-card', 100), f.element('lb-card', 150)];
  f.api.mount(grid, { columns: { default: 2 }, gap: 20 });
  assert.equal(f.frames.size, 1); f.flush();
  assert.deepEqual(grid.children.map(c => [c.style.left,c.style.top,c.style.width]),
    [['0px','0px','300px'],['320px','0px','300px'],['320px','120px','300px']]);
  assert.equal(grid.style.height, '270px');
});

test('late lazy image height changes reflow following cards, coalesced into one frame', () => {
  const f = fixture(); const grid = f.element('grid');
  grid.children = Array.from({length:4},()=>f.element('cb-card',100));
  f.api.mount(grid,{columns:{default:2},gap:20}); f.flush();
  grid.children[0].offsetHeight = 300;
  grid.listeners.load(); grid.listeners.load(); grid.listeners.error();
  assert.equal(f.frames.size,1); f.flush();
  assert.equal(grid.children[2].style.top,'120px');
  assert.equal(grid.children[2].style.left,'320px');
  assert.equal(grid.children[3].style.top,'240px');
  assert.equal(grid.style.height,'340px');
});

test('progressive append, hidden cards and empty results remain in flow', () => {
  const f=fixture();const grid=f.element('grid');
  grid.children=[f.element('cb-card',80)];
  f.api.mount(grid,{gap:0});f.flush();
  grid.children.push(f.element('cb-card',130)); f.observers[1].callback(); f.flush();
  assert.equal(grid.children[1].style.top,'0px');
  grid.children[1].hidden=true; f.observers[1].callback(); f.flush();
  assert.equal(grid.style.height,'80px');
  grid.children=[f.element('cb-empty')]; f.observers[1].callback();f.flush();
  assert.equal(grid.style.height,'');
});

test('partial per-grid options retain mobile settings and zero gap', () => {
  const f=fixture();f.window.innerWidth=400;
  f.window.CB_MASONRY_OPTIONS={columns:{mobile:2}};
  const grid=f.element('grid');grid.children=[f.element('cb-card'),f.element('cb-card')];
  f.api.mount(grid,{columns:{default:4},gap:0});f.flush();
  assert.equal(grid.children[0].style.width,'310px');
  assert.equal(grid.children[1].style.left,'310px');
});

test('repeated mount and both delivery names do not duplicate observers; destroy restores styles', () => {
  const f=fixture();const grid=f.element('grid');const card=f.element('cb-card');grid.children=[card];
  card.style.width='80%'; grid.style.display='grid';
  const controller=f.api.mount(grid);f.api.mount(grid);f.flush();
  vm.runInNewContext(code, f.context);
  assert.equal(f.window.CollectionBlocksMasonry,f.api);
  assert.equal(f.observers.length,2);
  controller.destroy();
  assert.equal(grid.style.display,'grid');assert.equal(card.style.width,'80%');
  assert.ok(f.observers.every(o=>o.disconnected));
  assert.deepEqual(Object.keys(grid.listeners),[]);
});

test('ResizeObserver handles a hidden container becoming visible without a viewport resize', () => {
  const f=fixture();const grid=f.element('grid');grid.clientWidth=0;grid.children=[f.element('cb-card')];
  f.api.mount(grid);f.flush();assert.equal(grid.style.height,'');
  grid.clientWidth=620;f.observers[0].callback([{target:grid}]);f.flush();
  assert.equal(grid.style.height,'100px');
  f.observers[0].callback([{target:grid},{target:grid.children[0]}]);
  assert.equal(f.frames.size,0);
});
