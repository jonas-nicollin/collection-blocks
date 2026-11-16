/* Optional Locator route selection. Google Maps owns routing and navigation. */
(function () {
  'use strict';
  if (window.CollectionBlocksRoutePlanner) return;
  var mounted = new Map();
  var words = {
    fr: { title: 'Mon parcours', add: 'Ajouter au parcours', remove: 'Retirer du parcours',
      up: 'Monter', down: 'Descendre', maps: 'Ouvrir dans Google Maps',
      next: 'Rejoindre la prochaine étape', empty: 'Ajoutez des lieux à votre parcours.',
      limit: 'Le parcours est complet.', saved: 'Parcours mis à jour.',
      unavailable: 'La sélection ne peut pas être enregistrée sur cet appareil.' },
    en: { title: 'My route', add: 'Add to route', remove: 'Remove from route',
      up: 'Move up', down: 'Move down', maps: 'Open in Google Maps',
      next: 'Navigate to the next stop', empty: 'Add places to your route.',
      limit: 'The route is full.', saved: 'Route updated.',
      unavailable: 'This device cannot save your selection.' }
  };
  function coordinates(item) {
    return item && item.lat !== null && item.lng !== null &&
      String(item.lat).trim() !== '' && String(item.lng).trim() !== '' &&
      Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) &&
      Math.abs(Number(item.lat)) <= 90 && Math.abs(Number(item.lng)) <= 180;
  }
  function directions(items, next) {
    var stops = items.filter(coordinates).slice(0, 4);
    if (!stops.length) return '';
    if (next) stops = stops.slice(0, 1);
    var point = function(item) { return Number(item.lat) + ',' + Number(item.lng); };
    var url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('travelmode', 'walking');
    url.searchParams.set('destination', point(stops[stops.length - 1]));
    if (stops.length > 1) url.searchParams.set('waypoints', stops.slice(0, -1).map(point).join('|'));
    if (next) url.searchParams.set('dir_action', 'navigate');
    return url.href;
  }
  function createModel(options, storage) {
    var max = Math.min(4, Math.max(1, Math.floor(Number(options.maxStops) || 4)));
    var key = 'cb-route:v1:' + options.storageKey;
    var ids = [], items = [], persistent = !!storage;
    try {
      var saved = JSON.parse(storage && storage.getItem(key) || '[]');
      if (Array.isArray(saved)) ids = Array.from(new Set(saved.filter(function(id) {
        return typeof id === 'string' && id.length > 0 && id.length < 300;
      }))).slice(0, max);
    } catch (_) { persistent = false; }
    function eligible(item) {
      return !!item.id && coordinates(item) && (!options.categories ||
        options.categories.some(function(category) { return (item.categories || []).includes(category); }));
    }
    function save() {
      try { if (storage) storage.setItem(key, JSON.stringify(ids)); }
      catch (_) { persistent = false; }
    }
    return {
      max: max, eligible: eligible,
      persistent: function() { return persistent; },
      ids: function() { return ids.slice(); },
      selected: function() { return ids.map(function(id) {
        return items.find(function(item) { return item.id === id && eligible(item); });
      }).filter(Boolean); },
      setItems: function(next, complete) {
        items = next;
        if (complete) {
          var valid = ids.filter(function(id) { return items.some(function(item) {
            return item.id === id && eligible(item);
          }); });
          if (valid.length !== ids.length) { ids = valid; save(); }
        }
      },
      toggle: function(id) {
        var index = ids.indexOf(id);
        if (index >= 0) ids.splice(index, 1);
        else {
          if (ids.length >= max || !items.some(function(item) {
            return item.id === id && eligible(item);
          })) return false;
          ids.push(id);
        }
        save(); return true;
      },
      move: function(id, delta) {
        var index = ids.indexOf(id), next = index + delta;
        if (index < 0 || next < 0 || next >= ids.length || Math.abs(delta) !== 1) return false;
        ids.splice(index, 1); ids.splice(next, 0, id); save(); return true;
      }
    };
  }
  function node(tag, part, text) {
    var element = document.createElement(tag);
    element.className = 'cb-route-planner' + part + ' lb-route-planner' + part;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function mount(instance) {
    var root = instance.root, options = instance.config.routePlanner;
    if (!options || options.enabled === false || mounted.has(root)) return mounted.get(root);
    // A linked card cannot contain interactive controls. This contract is explicit.
    if (instance.config.display.cardClickable) {
      console.warn('[Route Planner] Use display.cardClickable: false.'); return;
    }
    var sidebar = root.querySelector('.lb-sidebar');
    if (!sidebar) return;
    options = Object.assign({ storageKey: instance.config.key }, options === true ? {} : options);
    var utils = window.CollectionBlocks && window.CollectionBlocks.utils;
    var locale = utils && utils.resolveLocale ? utils.resolveLocale(options.locale || instance.config.locale) : 'fr';
    var labels = Object.assign({}, words[locale] || words.en, options.i18n || {});
    var storage;
    try { storage = window.localStorage; } catch (_) { storage = null; }
    var model = createModel(options, storage);
    var panel = node('details', ''), summary = node('summary', '__summary');
    var list = node('ol', '__list'), empty = node('p', '__empty', labels.empty);
    var actions = node('div', '__actions'), maps = node('a', '__maps', labels.maps);
    var next = node('a', '__next', labels.next), status = node('p', '__status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    [maps, next].forEach(function(link) { link.target = '_blank'; link.rel = 'noopener'; });
    actions.append(maps, next); panel.append(summary, empty, list, actions, status);
    var grid = root.querySelector('.lb-grid');
    if (grid) grid.before(panel); else sidebar.append(panel);
    function button(action, id, title, icon) {
      var control = node('button', '__button'); control.type = 'button';
      control.dataset.routeAction = action; control.dataset.routeId = id;
      control.setAttribute('aria-label', title); control.title = title;
      var glyph = node('span', '__icon', icon); glyph.setAttribute('aria-hidden', 'true');
      control.append(glyph); return control;
    }
    function refresh() {
      var items = instance.getItems();
      var byId = new Map(items.map(function(item) { return [item.id, item]; }));
      model.setItems(items, instance.isComplete());
      var selected = model.selected(), ids = model.ids();
      summary.textContent = labels.title + ' (' + selected.length + '/' + model.max + ')';
      list.replaceChildren();
      selected.forEach(function(item, index) {
        var row = node('li', '__stop'); row.dataset.routeId = item.id;
        row.append(node('span', '__name', item.title));
        var controls = node('span', '__controls');
        var up = button('up', item.id, labels.up + ' : ' + item.title, 'arrow_upward');
        var down = button('down', item.id, labels.down + ' : ' + item.title, 'arrow_downward');
        up.disabled = index === 0; down.disabled = index === selected.length - 1;
        controls.append(up, down, button('remove', item.id, labels.remove + ' : ' + item.title, 'close'));
        row.append(controls); list.append(row);
      });
      empty.hidden = selected.length > 0; actions.hidden = !selected.length;
      next.hidden = selected.length < 2;
      maps.href = directions(selected); next.href = directions(selected, true);
      root.querySelectorAll('.lb-card[data-item-id]').forEach(function(card) {
        var item = byId.get(card.dataset.itemId);
        var control = card.querySelector('.cb-route-planner__add');
        if (!item || !model.eligible(item)) { if (control) control.remove(); return; }
        if (!control) {
          control = node('button', '__add'); control.type = 'button';
          control.dataset.routeAction = 'toggle'; control.dataset.routeId = item.id;
          var host = card.querySelector('.cb-card__body') || card;
          host.append(control);
        }
        var chosen = ids.includes(item.id);
        control.textContent = chosen ? labels.remove : labels.add;
        control.setAttribute('aria-pressed', String(chosen));
        control.setAttribute('aria-label', control.textContent + ' : ' + item.title);
        control.disabled = !chosen && ids.length >= model.max;
      });
    }
    function onClick(event) {
      var control = event.target.closest('[data-route-action]');
      if (!control || !root.contains(control)) return;
      event.preventDefault(); event.stopPropagation();
      var action = control.dataset.routeAction, id = control.dataset.routeId;
      var changed = action === 'up' || action === 'down'
        ? model.move(id, action === 'up' ? -1 : 1) : model.toggle(id);
      if (!changed) { status.textContent = labels.limit; return; }
      panel.open = true; refresh();
      status.textContent = model.persistent() ? labels.saved : labels.unavailable;
      if (action !== 'toggle') {
        var row = Array.from(list.children).find(function(el) { return el.dataset.routeId === id; });
        var focus = row && row.querySelector('[data-route-action="' + action + '"]:not(:disabled)');
        (focus || summary).focus();
      }
    }
    root.addEventListener('click', onClick);
    var controller = { refresh: refresh, destroy: function() {
      root.removeEventListener('click', onClick); panel.remove();
      root.querySelectorAll('.cb-route-planner__add').forEach(function(el) { el.remove(); });
      mounted.delete(root);
    }};
    mounted.set(root, controller); refresh(); return controller;
  }
  function discover() {
    mounted.forEach(function(controller, root) { if (!root.isConnected) controller.destroy(); });
    if (window.LocatorBlock && window.LocatorBlock.getInstances) {
      window.LocatorBlock.getInstances().forEach(mount);
    }
  }
  window.CollectionBlocksRoutePlanner = { mount: mount, createModel: createModel, directions: directions };
  document.addEventListener('cb:locator-ready', function(event) { mount(event.detail.instance); });
  document.addEventListener('cb:locator-render', function(event) {
    var controller = mounted.get(event.detail.root); if (controller) controller.refresh();
  });
  window.addEventListener('pageshow', discover);
  discover();
})();
