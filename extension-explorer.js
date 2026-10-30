/* Collection Blocks — Explorer 1.0.0
 * Remote Query forms and links, using Query's own metadata/filter services.
 * Requires collection-blocks.js and query-block.js. Does not render result cards.
 */
(function() {
  'use strict';
  if (window.CBExplorer) return;
  var mounted = new WeakMap(), active = new Set(), observer;
  function node(tag, part, text) {
    var el = document.createElement(tag);
    el.className = 'cb-explorer' + part + ' qb-explorer' + part;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function services() {
    var api = window.QueryBlock && window.QueryBlock.filters;
    if (!api || !window.CollectionBlocks || !window.CollectionBlocks.selection) {
      throw new Error('Explorer requires the shared Query filter services');
    }
    return api;
  }
  function resolveQuery(options) {
    var cfg = options.query;
    if (typeof cfg === 'string') cfg = (window.QUERY_BLOCK_CONFIGS || []).find(function(c) {
      return c.key === options.query;
    });
    if (!cfg || !cfg.filters || !cfg.filters.urlState) {
      throw new Error('Explorer requires a Query definition with filters.urlState');
    }
    return cfg;
  }
  function hasCriteria(state) {
    return !!(state.category || state.search || Object.values(state.tags || {}).some(function(v) {
      return [].concat(v || []).some(Boolean);
    }));
  }
  function safeAddress(address) {
    var url = new URL(address, location.href);
    if (!/^https?:$/.test(url.protocol)) throw new Error('Unsupported Explorer destination');
    return url.href;
  }
  function valuesFor(items, query, state, definition) {
    var cb = window.CollectionBlocks, field = definition.prefix;
    var values = definition.values || Array.from(new Set(items.flatMap(function(item) {
      item = cb.selection.project(item, state, query.filters);
      return field ? cb.utils.getTagValuesByPrefix(item, field) : item.categories || [];
    })));
    values = values.filter(function(value) {
      return (!definition.include || definition.include.includes(value)) &&
        (!definition.exclude || !definition.exclude.includes(value));
    });
    var explicit = Array.isArray(definition.order) ? definition.order : null;
    return values.slice().sort(function(a, b) {
      if (explicit) {
        var ai = explicit.indexOf(a), bi = explicit.indexOf(b);
        ai = ai < 0 ? explicit.length : ai; bi = bi < 0 ? explicit.length : bi;
        if (ai !== bi) return ai - bi;
      }
      if (definition.values && !explicit && !definition.order) return 0;
      var comparison = String(a).localeCompare(String(b), definition.locale, {
        numeric: definition.order === 'numeric'
      });
      return definition.direction === 'desc' ? -comparison : comparison;
    });
  }

  function mount(target, options) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) throw new Error('Explorer target not found');
    if (mounted.has(target)) return mounted.get(target);
    var api = services(), query = resolveQuery(options);
    var destination = safeAddress(options.destination);
    // Validate the URL contract before inserting UI or requesting any source.
    api.validate(query);
    api.href(destination, query, {}, false, []);
    if (options.links && options.links.prefix) {
      var probe = { tags: {} }; probe.tags[options.links.prefix] = 'probe';
      api.href(destination, query, probe, false, []);
    }
    var labels = Object.assign({ loading: 'Chargement des critères…',
      results: 'Voir les résultats', empty: 'Aucun résultat',
      unavailable: 'Les compteurs sont indisponibles.', fallback: 'Consulter le programme',
      form: 'Explorer le programme', links: 'Explorer le programme'
    }, options.i18n || {});
    var shell = node('div', ''), status = node('p', '__status', labels.loading);
    shell.classList.add('cb-explorer--' + (options.layout === 'links' ? 'links' : 'form'),
      'qb-explorer--' + (options.layout === 'links' ? 'links' : 'form'));
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    var action = node('a', '__submit', labels.fallback);
    action.href = destination; action.hidden = true;
    shell.append(status, action); target.append(shell);
    var state = api.cloneState(options.state), data, controls, destroyed = false;
    var nav, form, listeners = new Set();
    function href(next) {
      return api.href(destination, query, next || state, data && data.complete,
        data ? data.items : []);
    }
    function snapshot() {
      return { state: api.cloneState(state),
        summary: api.summary(data ? data.items : [], query, state, data && data.complete),
        href: href() };
    }
    function notify() {
      var value = snapshot();
      listeners.forEach(function(fn) { fn(value); });
      if (typeof options.onChange === 'function') options.onChange(value);
    }
    function entries() {
      var def = options.links || {};
      if (Array.isArray(def.items)) return def.items;
      return valuesFor(data.items, query, state, def).map(function(value) {
        var selection = api.cloneState(state);
        if (def.prefix) selection.tags[def.prefix] = value;
        else selection.category = value;
        return { label: typeof def.formatLabel === 'function' ? def.formatLabel(value) : value,
          state: selection };
      });
    }
    function renderLinks() {
      nav.replaceChildren();
      entries().forEach(function(entry) {
        var next = api.cloneState(entry.state), count = api.summary(data.items, query, next, data.complete);
        if (options.hideEmpty === true && count.complete && !count.total) return;
        var link = node('a', '__link'); link.href = href(next);
        link.append(node('span', '__label', entry.label));
        if (entry.description) link.append(node('span', '__description', entry.description));
        if (options.counts !== false) link.append(node('span', '__count',
          String(count.total) + (count.complete ? '' : '+')));
        nav.append(link);
      });
    }
    function render() {
      if (destroyed || !data) return;
      var result = snapshot().summary;
      shell.dataset.cbExplorerStatus = result.complete ? 'ready' : 'partial';
      status.textContent = result.complete && !result.total ? labels.empty :
        labels.results + ' (' + result.total + (result.complete ? '' : '+') + ')';
      status.classList.add('cb-explorer__status--quiet', 'qb-explorer__status--quiet');
      action.textContent = status.textContent; action.href = href();
      action.hidden = options.layout === 'links' ||
        (options.hideSubmitWhenEmpty === true && !hasCriteria(state));
      action.setAttribute('aria-disabled', String(result.complete && result.total === 0));
      if (nav) renderLinks();
      notify();
    }
    function navigate(event) {
      if (controls) controls.flush();
      if (!data || !data.complete || snapshot().summary.total > 0) return;
      event.preventDefault();
      var first = shell.querySelector('select, input');
      if (first) first.focus();
    }
    action.addEventListener('click', navigate);
    var controller = {
      element: shell,
      getState: function() { return api.cloneState(state); },
      getSummary: function() { return snapshot().summary; },
      href: href,
      setState: function(next) {
        if (destroyed) return;
        state = api.cloneState(next);
        if (controls) controls.setState(state); else render();
      },
      subscribe: function(fn) { listeners.add(fn); return function() { listeners.delete(fn); }; },
      destroy: function() {
        if (destroyed) return;
        destroyed = true;
        if (controls) controls.destroy();
        shell.remove(); listeners.clear(); mounted.delete(target); active.delete(controller);
        if (!active.size && observer) { observer.disconnect(); observer = null; }
      },
      connected: function() { return target.isConnected; }
    };
    mounted.set(target, controller); active.add(controller);
    if (!observer) {
      observer = new MutationObserver(function() {
        active.forEach(function(instance) { if (!instance.connected()) instance.destroy(); });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    controller.ready = Promise.resolve(options.data || api.load(query)).then(function(result) {
      if (destroyed) return controller;
      data = { items: result.items || [], complete: result.complete === true };
      if (options.layout === 'links') {
        nav = node('nav', '__links'); nav.setAttribute('aria-label', labels.links);
        shell.prepend(nav);
      } else {
        form = node('form', '__form'); form.setAttribute('aria-label', labels.form);
        form.action = destination; shell.prepend(form);
        controls = api.mount(form, { config: query, items: data.items, complete: data.complete,
          state: state, mobilePanel: options.mobilePanel === true,
          onChange: function(next) {
            next.tabIndex = state.tabIndex; state = next; render();
          } });
        form.addEventListener('submit', function(event) {
          event.preventDefault(); controls.flush();
          if (!action.hidden && action.getAttribute('aria-disabled') !== 'true') action.click();
        });
      }
      render(); return controller;
    }).catch(function(error) {
      if (destroyed) return controller;
      shell.dataset.cbExplorerStatus = 'unavailable'; status.textContent = labels.unavailable;
      status.classList.remove('cb-explorer__status--quiet', 'qb-explorer__status--quiet');
      action.hidden = false; action.textContent = labels.fallback; action.href = destination;
      if (options.debug) console.warn('[Explorer]', error);
      return controller;
    });
    return controller;
  }
  function init() {
    (window.CB_EXPLORER_CONFIGS || []).forEach(function(config) {
      if (config.enabled === false) return;
      var target = document.querySelector(config.target);
      if (target) mount(target, config);
    });
  }
  window.CBExplorer = { version: '1.0.0', mount: mount, init: init };
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('mercury:load', init);
  if (document.readyState !== 'loading') init();
})();
