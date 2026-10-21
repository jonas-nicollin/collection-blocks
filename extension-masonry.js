/* Collection Blocks — optional masonry extension. */
(function () {
  'use strict';
  if (window.CollectionBlocksMasonry && window.CollectionBlocksMasonry.version === '1.0.0') return;

  var instances = new Map();
  var SNAP_RATIOS = [1, 2/3, 3/2, 3/4, 4/3, 4/5, 5/4, 16/9, 9/16];
  var DEFAULTS = {
    columns: { default: 3, tablet: 2, mobile: 1 },
    breakpoints: { tablet: 768, mobile: 480 },
    cardSelector: '.cb-card, .qb-card, .rb-card, .lb-card',
    snapRatios: false
  };

  function optionsFor(local) {
    var sources = [DEFAULTS, window.QUERY_MASONRY_OPTIONS || {}, window.CB_MASONRY_OPTIONS || {}, local || {}];
    var options = Object.assign.apply(Object, [{}].concat(sources));
    ['columns', 'breakpoints'].forEach(function (key) {
      options[key] = Object.assign.apply(Object, [{}].concat(sources.map(function (s) { return s[key] || {}; })));
    });
    return options;
  }

  function cssNumber(style, name, fallback) {
    var raw = style.getPropertyValue('--cb-masonry-' + name).trim() ||
      style.getPropertyValue('--qb-masonry-' + name).trim() ||
      style.getPropertyValue('--sqb-masonry-' + name).trim();
    if (!raw) return fallback;
    var value = parseFloat(raw);
    if (!isFinite(value)) return fallback;
    if (/rem$/.test(raw)) value *= parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return value;
  }

  function cardsFor(state) {
    return Array.from(state.grid.children).filter(function (card) {
      return card.matches(state.options.cardSelector) && !card.hidden && getComputedStyle(card).display !== 'none';
    });
  }

  function remember(state, element, properties) {
    if (state.originals.has(element)) return;
    var saved = {};
    properties.forEach(function (property) { saved[property] = element.style[property]; });
    state.originals.set(element, saved);
  }

  function snapImages(state, cards) {
    if (!state.options.snapRatios) return;
    cards.forEach(function (card) {
      card.querySelectorAll('img').forEach(function (img) {
        if (!img.naturalWidth || !img.naturalHeight) return;
        var wrap = img.closest('.cb-card__img-wrap, .qb-card__img-wrap, .rb-card__img-wrap, .lb-card__img-wrap');
        if (!wrap) return;
        var ratio = img.naturalWidth / img.naturalHeight;
        var best = SNAP_RATIOS.reduce(function (a, b) { return Math.abs(a - ratio) <= Math.abs(b - ratio) ? a : b; });
        remember(state, wrap, ['aspectRatio']);
        wrap.style.aspectRatio = String(best);
      });
    });
  }

  function layout(state) {
    var grid = state.grid;
    if (!grid.isConnected) { destroy(grid); return; }
    var width = grid.clientWidth;
    if (!width) return; // ResizeObserver retries when a hidden container becomes visible.
    var options = state.options;
    var columns = options.columns.default;
    if (window.innerWidth <= options.breakpoints.tablet) columns = options.columns.tablet;
    if (window.innerWidth <= options.breakpoints.mobile) columns = options.columns.mobile;
    columns = Math.max(1, Math.floor(Number(columns) || 1));
    var style = getComputedStyle(grid);
    var gap = options.gap == null ? cssNumber(style, 'gap', 48) : Math.max(0, Number(options.gap) || 0);
    var columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
    var cards = cardsFor(state);
    var heights = Array.from({ length: columns }, function (_, i) { return cssNumber(style, 'offset-' + i, 0); });

    state.cards.forEach(function (card) {
      if (cards.indexOf(card) < 0 && state.resize) state.resize.unobserve(card);
    });
    cards.forEach(function (card) {
      if (state.cards.indexOf(card) < 0 && state.resize) state.resize.observe(card);
      remember(state, card, ['width', 'position', 'top', 'left', 'margin']);
    });
    state.cards = cards;
    state.width = width;
    snapImages(state, cards);

    // Write all widths before measuring. Position writes follow all measurements.
    grid.style.position = 'relative';
    grid.style.display = 'block';
    cards.forEach(function (card) {
      card.style.width = columnWidth + 'px';
      card.style.position = 'absolute';
      card.style.margin = '0';
    });
    var sizes = cards.map(function (card) {
      var height = card.offsetHeight;
      state.sizes.set(card, height);
      return height;
    });
    var sequential = cards.length <= columns;
    var positions = cards.map(function (_, i) {
      var column = sequential ? i : heights.indexOf(Math.min.apply(null, heights));
      var top = sequential ? 0 : heights[column];
      heights[column] = top + sizes[i] + gap;
      return { left: column * (columnWidth + gap), top: top };
    });
    cards.forEach(function (card, i) {
      card.style.left = positions[i].left + 'px';
      card.style.top = positions[i].top + 'px';
    });
    grid.style.height = cards.length ? Math.max(0, Math.max.apply(null, heights) - gap) + 'px' : state.originals.get(grid).height;
  }

  function schedule(state) {
    if (state.raf || state.destroyed) return;
    state.raf = requestAnimationFrame(function () { state.raf = 0; layout(state); });
  }

  function mount(grid, localOptions) {
    if (!grid) return;
    var state = instances.get(grid);
    if (state) {
      if (localOptions) state.localOptions = localOptions;
      state.options = optionsFor(state.localOptions);
      schedule(state);
      return state.controller;
    }
    state = { grid: grid, localOptions: localOptions, options: optionsFor(localOptions), cards: [], sizes: new WeakMap(), originals: new Map(), raf: 0 };
    remember(state, grid, ['position', 'height', 'display']);
    state.schedule = function () { schedule(state); };
    state.controller = { refresh: state.schedule, destroy: function () { destroy(grid); } };
    if (window.ResizeObserver) {
      state.resize = new ResizeObserver(function (entries) {
        if (entries.some(function (entry) {
          return entry.target === grid ? grid.clientWidth !== state.width : entry.target.offsetHeight !== state.sizes.get(entry.target);
        })) schedule(state);
      });
      state.resize.observe(grid);
    }
    // Only this grid is observed; progressive rendering and filters need no polling.
    state.mutations = new MutationObserver(state.schedule);
    state.mutations.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    grid.addEventListener('load', state.schedule, true);
    grid.addEventListener('error', state.schedule, true);
    instances.set(grid, state);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(state.schedule);
    schedule(state);
    return state.controller;
  }

  function destroy(grid) {
    var state = instances.get(grid);
    if (!state) return;
    state.destroyed = true;
    cancelAnimationFrame(state.raf);
    if (state.resize) state.resize.disconnect();
    state.mutations.disconnect();
    grid.removeEventListener('load', state.schedule, true);
    grid.removeEventListener('error', state.schedule, true);
    state.originals.forEach(function (saved, element) {
      Object.keys(saved).forEach(function (property) { element.style[property] = saved[property]; });
    });
    instances.delete(grid);
  }

  // Retains the existing Query hook signature. Other blocks can mount a grid directly.
  function masonry(grid, items, config) { return mount(grid, config && config.masonry); }
  masonry.mount = mount;
  masonry.refresh = function (grid) { var state = instances.get(grid); if (state) schedule(state); };
  masonry.destroy = destroy;
  masonry.version = '1.0.0';
  window.CollectionBlocksMasonry = masonry;

  function refreshAll() {
    instances.forEach(function (state, grid) {
      if (!grid.isConnected) destroy(grid);
      else schedule(state);
    });
  }
  window.addEventListener('resize', refreshAll);
  document.addEventListener('mercury:load', refreshAll);
  window.addEventListener('page:loaded', refreshAll);
})();
