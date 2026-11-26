/* Ordered references resolved through the existing Collection Blocks data cache. */
(function () {
  'use strict';
  if (window.CollectionBlocksSelection) return;
  function validate(value, sources, maxItems) {
    if (!value || value.version !== 1 || !Array.isArray(value.items)) {
      throw new Error('Invalid selection document');
    }
    if (value.items.length > (maxItems || 25)) throw new Error('Selection is too long');
    var seen = new Set();
    return value.items.map(function(ref) {
      if (!ref || !Object.hasOwn(sources, ref.source) ||
          typeof ref.id !== 'string' || !ref.id || ref.id.length > 200) {
        throw new Error('Invalid selection reference');
      }
      return { source: ref.source, id: ref.id };
    }).filter(function(ref) {
      var key = ref.source + ':' + ref.id;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function read(element, options) {
    if (!element) return null;
    return validate(JSON.parse(element.textContent), options.sources || {}, options.maxItems);
  }
  async function catalog(sources) {
    var data = window.CollectionBlocks && window.CollectionBlocks.data;
    if (!data) throw new Error('Collection Blocks data unavailable');
    var groups = await Promise.all(Object.keys(sources).map(async function(source) {
      var settings = sources[source];
      var state = await data.getState(settings.path, { maxPages: 'all' });
      if (state.fetchError || !state.complete) throw new Error('Incomplete source: ' + source);
      return (state.items || []).filter(function(item) {
        return item.id && (item.workflowState === undefined || item.workflowState === 1);
      }).map(function(item) { return Object.assign({}, item, { selectionSource: source }); });
    }));
    return groups.flat();
  }
  async function resolve(refs, options) {
    refs = validate({ version: 1, items: refs }, options.sources || {}, options.maxItems);
    var used = {};
    refs.forEach(function(ref) { used[ref.source] = options.sources[ref.source]; });
    var items = await catalog(used), missing = [];
    var index = new Map(items.map(function(item) {
      return [item.selectionSource + ':' + item.id, item];
    }));
    var ordered = refs.map(function(ref) {
      var item = index.get(ref.source + ':' + ref.id);
      if (!item) missing.push(ref);
      return item;
    }).filter(Boolean);
    return { items: ordered, missing: missing };
  }
  function serialize(refs, options) {
    var items = validate({ version: 1, items: refs }, options.sources || {}, options.maxItems);
    return JSON.stringify({ version: 1, items: items }, null, 2).replace(/</g, '\\u003c');
  }
  window.CollectionBlocksSelection = { version: '1.0.0', read: read,
    validate: validate, catalog: catalog, resolve: resolve, serialize: serialize };
})();
