/* Optional Locator selection and Google route preview. */
(function () {
  'use strict';
  if (window.CollectionBlocksRoutePlanner) return;
  var mounted = new Map();
  var words = {
    fr: { title: 'Créer votre parcours', add: 'Ajouter au parcours', remove: 'Retirer du parcours',
      up: 'Monter', down: 'Descendre', maps: 'Ouvrir dans Google Maps',
      share: 'Copier le lien du parcours', copied: 'Lien copié', between: 'Temps estimé entre les lieux',
      caution: 'Tracé à pied ou à vélo en bêta : certains trottoirs et chemins peuvent manquer.',
      next: 'Rejoindre la prochaine étape', empty: 'Ajoutez des lieux à votre parcours.',
      limit: 'Le parcours est complet.', saved: 'Parcours mis à jour.',
      added: 'Ajouté au parcours', move: 'Déplacer (flèches haut et bas)',
      transport: 'Mode de transport', walking: 'À pied', bicycling: 'À vélo',
      driving: 'En voiture', transit: 'Transports publics',
      transitNote: 'Transports publics : navigation vers la prochaine étape uniquement.',
      loading: 'Calcul du trajet…',
      routeError: 'Tracé indisponible. Le parcours reste accessible dans Google Maps.',
      unavailable: 'La sélection ne peut pas être enregistrée sur cet appareil.' },
    en: { title: 'Create your route', add: 'Add to route', remove: 'Remove from route',
      up: 'Move up', down: 'Move down', maps: 'Open in Google Maps',
      share: 'Copy route link', copied: 'Link copied', between: 'Estimated travel time between places',
      caution: 'Walking and cycling routes are in beta: some sidewalks and paths may be missing.',
      next: 'Navigate to the next stop', empty: 'Add places to your route.',
      limit: 'The route is full.', saved: 'Route updated.',
      added: 'Added to route', move: 'Reorder (up and down arrow keys)',
      transport: 'Travel mode', walking: 'Walking', bicycling: 'Cycling',
      driving: 'Driving', transit: 'Public transport',
      transitNote: 'Public transport: navigation to the next stop only.',
      loading: 'Calculating route…',
      routeError: 'Route preview unavailable. You can still open the route in Google Maps.',
      unavailable: 'This device cannot save your selection.' }
  };
  function coordinates(item) {
    return item && item.lat !== null && item.lng !== null &&
      String(item.lat).trim() !== '' && String(item.lng).trim() !== '' &&
      Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)) &&
      Math.abs(Number(item.lat)) <= 90 && Math.abs(Number(item.lng)) <= 180;
  }
  var travelModes = {walking: 'WALKING', bicycling: 'BICYCLING', driving: 'DRIVING', transit: 'TRANSIT'};
  function validMode(value) { return Object.hasOwn(travelModes, value) ? value : 'walking'; }
  function directions(items, next, mode) {
    mode = validMode(mode);
    // Google transit directions do not accept intermediate waypoints.
    if (mode === 'transit' && !next) return '';
    var stops = items.filter(coordinates).slice(0, 4);
    if (!stops.length) return '';
    if (next) stops = stops.slice(0, 1);
    var point = function(item) { return item.navigationQuery ||
      Number(item.lat) + ',' + Number(item.lng); };
    var url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('travelmode', mode);
    url.searchParams.set('destination', point(stops[stops.length - 1]));
    if (stops.length > 1) url.searchParams.set('waypoints', stops.slice(0, -1).map(point).join('|'));
    var last = stops[stops.length - 1];
    if (last.placeId) url.searchParams.set('destination_place_id', last.placeId);
    if (stops.length > 1 && stops.slice(0, -1).every(function(item) { return !!item.placeId; })) {
      url.searchParams.set('waypoint_place_ids', stops.slice(0, -1).map(function(item) {
        return item.placeId;
      }).join('|'));
    }
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
      replace: function(next) {
        ids = Array.from(new Set(next)).filter(function(id) {
          return items.some(function(item) { return item.id === id && eligible(item); });
        }).slice(0, max); save();
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
      },
      moveTo: function(id, next) {
        var index = ids.indexOf(id);
        if (index < 0 || !Number.isInteger(next) || next < 0 || next >= ids.length || index === next) return false;
        ids.splice(index, 1); ids.splice(next, 0, id); save(); return true;
      }
    };
  }
  function shortDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return '';
    var minutes = Math.max(1, Math.round(milliseconds / 60000));
    return minutes < 60 ? minutes + ' min.' : Math.floor(minutes / 60) + 'h' +
      String(minutes % 60).padStart(2, '0');
  }
  function node(tag, part, text) {
    var element = document.createElement(tag);
    element.className = 'cb-route-planner' + part + ' lb-route-planner' + part;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  // Optional preview: compute only when the ordered resolved stops change.
  function createPreview(instance, options, report) {
    var signature = '', generation = 0, timer, disposed = false;
    var polylines = [], markers = [], cache = new Map();
    function clear() {
      polylines.concat(markers).forEach(function(overlay) { overlay.setMap(null); });
      polylines = []; markers = [];
    }
    async function draw(stops, mode, key, ticket) {
      try {
        var maps = window.google && window.google.maps;
        var map = instance.getMap && instance.getMap();
        if (!maps || !map) throw new Error('Map unavailable');
        var route = cache.get(key);
        if (!route) {
          var library = await maps.importLibrary('routes');
          if (disposed || ticket !== generation) return;
          var point = function(item) { return item.placeId ? 'places/' + item.placeId :
            {lat: Number(item.lat), lng: Number(item.lng)}; };
          var result = await library.Route.computeRoutes({
            origin: point(stops[0]), destination: point(stops[stops.length - 1]),
            intermediates: stops.slice(1, -1).map(function(item) {
              return {location: point(item)};
            }),
            travelMode: travelModes[mode],
            fields: ['path', 'warnings', 'durationMillis']
          });
          route = result.routes && result.routes[0];
          if (!route) throw new Error('No route');
          cache.set(key, route);
          if (cache.size > 10) cache.delete(cache.keys().next().value);
        }
        if (disposed || ticket !== generation) return;
        clear();
        var color = options.color;
        if (!color && options.colorVariable && window.getComputedStyle) {
          color = window.getComputedStyle(instance.root).getPropertyValue(options.colorVariable).trim();
        }
        // No override means Google's own light/dark-aware route styling.
        polylines = color ? route.createPolylines({polylineOptions: {strokeColor: color}})
          : route.createPolylines();
        polylines.forEach(function(line) { line.setMap(map); });
        var markerColor = color || (polylines[0] && polylines[0].get &&
          polylines[0].get('strokeColor')) || '#1a73e8';
        markers = stops.map(function(item, index) {
          return new maps.Marker({map: map, position: pointCoordinates(item),
            title: (index + 1) + '. ' + item.title, zIndex: 1000 + index,
            label: {text: String(index + 1), color: '#ffffff'},
            icon: {path: maps.SymbolPath.CIRCLE, scale: 13, fillColor: markerColor,
              fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2}
          });
        });
        var bounds = new maps.LatLngBounds();
        (route.path || stops.map(pointCoordinates)).forEach(function(point) { bounds.extend(point); });
        map.fitBounds(bounds, 60);
        report('ready', route);
      } catch (error) {
        if (disposed || ticket !== generation) return;
        clear(); report('error');
        console.warn('[Route Planner] Preview unavailable:', error.message);
      }
    }
    function pointCoordinates(item) { return {lat: Number(item.lat), lng: Number(item.lng)}; }
    return {
      update: function(stops, mode) {
        mode = validMode(mode);
        var key = mode + ':' + JSON.stringify(stops.map(function(item) {
          return [item.id, item.lat, item.lng, item.placeId || ''];
        }));
        if (key === signature || disposed) return;
        signature = key; generation++; clearTimeout(timer); clear();
        if (stops.length < 2 || mode === 'transit') { report('empty'); return; }
        report('loading');
        var ticket = generation;
        timer = setTimeout(function() { draw(stops.slice(), mode, key, ticket); },
          options.debounceMs === undefined ? 400 : options.debounceMs);
      },
      destroy: function() { disposed = true; generation++; clearTimeout(timer); clear(); cache.clear(); }
    };
  }
  function mount(instance) {
    var root = instance.root, options = instance.config.routePlanner;
    if (!options || options.enabled === false || mounted.has(root)) return mounted.get(root);
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
    var model = createModel(options, storage), iconCards = options.cardControl === 'icon';
    var routeParam = options.urlState && (options.urlState.param || 'parcours');
    var modeParam = routeParam && options.urlState.mode;
    var modes = Array.isArray(options.travelModes) ? options.travelModes.filter(function(value) {
      return Object.hasOwn(travelModes, value);
    }) : ['walking'];
    if (!modes.length) modes = ['walking'];
    var modeKey = 'cb-route-mode:v1:' + options.storageKey;
    var mode = modes.includes(options.travelMode) ? options.travelMode : modes[0];
    try { var storedMode = storage && storage.getItem(modeKey);
      if (modes.includes(storedMode)) mode = storedMode;
    } catch (_) {}
    function readModeURL(resetMissing) {
      var value = modeParam && new URL(window.location.href).searchParams.get(modeParam);
      if (value !== null && value !== false && value !== undefined) {
        mode = modes.includes(value) ? value : modes[0];
      } else if (resetMissing) mode = modes[0];
    }
    readModeURL();
    var listMedia = options.listMediaQuery && window.matchMedia
      ? window.matchMedia(options.listMediaQuery) : null;
    function readRouteURL() {
      var params = new URL(window.location.href).searchParams;
      return routeParam && params.has(routeParam)
        ? params.get(routeParam).split('|').filter(Boolean).slice(0, model.max) : null;
    }
    var pendingRoute = readRouteURL(), urlDirty = true;
    function writeRouteURL() {
      if (!routeParam || pendingRoute !== null || !instance.isComplete()) return;
      var url = new URL(window.location.href);
      // An explicit empty route overrides a previously saved selection on shared URLs.
      url.searchParams.set(routeParam, model.selected().map(function(item) {
        return item.venueKey || item.id;
      }).join('|'));
      if (modeParam) url.searchParams.set(modeParam, mode);
      if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.href);
    }
    var panel = node('details', ''), summary = node('summary', '__summary');
    var summaryLabel = node('span', '__title');
    function glyph(name, part) {
      var el = node('span', part || '__icon', name); el.setAttribute('aria-hidden', 'true');
      return el;
    }
    summary.append(summaryLabel, glyph('expand_more', '__expand'), glyph('expand_less', '__collapse'));
    var list = node('ol', '__list'), empty = node('p', '__empty', labels.empty);
    var actions = node('div', '__actions'), maps = node('a', '__maps');
    maps.append(glyph('navigation'), node('span', '__action-label', labels.maps));
    var next = node('a', '__next', labels.next), status = node('p', '__status');
    var previewStatus = node('p', '__preview'), warnings = node('span', '__warnings');
    var modeControls = node('div', '__modes'), duration = node('span', '__duration');
    duration.title = labels.between; duration.setAttribute('aria-live', 'polite');
    var peek = node('span', '__peek'); peek.setAttribute('aria-hidden', 'true');
    modeControls.setAttribute('role', 'group');
    modeControls.setAttribute('aria-label', labels.transport);
    var modeIcons = {walking: 'directions_walk', bicycling: 'directions_bike',
      driving: 'directions_car', transit: 'directions_transit'};
    modes.forEach(function(value) {
      var control = node('button', '__mode'); control.type = 'button';
      control.dataset.routeMode = value; control.setAttribute('aria-label', labels[value]);
      control.title = labels[value]; control.append(glyph(modeIcons[value]));
      modeControls.append(control);
      var hint = node('span', '__peek-mode'); hint.append(glyph(modeIcons[value]));
      peek.append(hint);
    });
    modeControls.append(duration);
    summary.append(peek, warnings);
    summary.setAttribute('aria-label', labels.title);
    // Keep required route cautions inside the planner and visible when collapsed.
    function placeWarnings() { (panel.open ? panel : summary).append(warnings); }
    panel.addEventListener('toggle', placeWarnings);
    var modeNote = node('p', '__mode-note', labels.transitNote);
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    previewStatus.setAttribute('role', 'status');
    [maps, next].forEach(function(link) { link.target = '_blank'; link.rel = 'noopener'; });
    var share = node('button', '__share'); share.type = 'button';
    share.setAttribute('aria-label', labels.share); share.title = labels.share;
    share.append(glyph('share'));
    var shareField = node('input', '__share-url'); shareField.readOnly = true;
    shareField.setAttribute('aria-label', labels.share); shareField.hidden = true;
    var shareTimer;
    actions.append(maps);
    if (options.showNextStop !== false) actions.append(next);
    if (routeParam && options.share !== false) actions.append(share, shareField);
    panel.append(summary, modeControls, empty, list, previewStatus, actions, status);
    if (modes.includes('transit')) list.after(modeNote);
    var grid = root.querySelector('.lb-grid');
    if (grid) grid.before(panel); else sidebar.append(panel);
    var preview = options.mapRoute && options.mapRoute.enabled !== false
      ? createPreview(instance, options.mapRoute, function(state, route) {
        panel.dataset.routePreview = state;
        var notes = route && route.warnings ? route.warnings.slice() : [];
        if (state === 'ready' && (mode === 'walking' || mode === 'bicycling')) notes.push(labels.caution);
        warnings.textContent = notes.join(' ');
        duration.textContent = state === 'ready' ? shortDuration(route.durationMillis) : '';
        duration.setAttribute('aria-label', labels.between + ' : ' + duration.textContent);
        previewStatus.textContent = state === 'error' ? labels.routeError : '';
      }) : null;
    function button(action, id, title, icon) {
      var control = node('button', '__button'); control.type = 'button';
      control.dataset.routeAction = action; control.dataset.routeId = id;
      control.setAttribute('aria-label', title); control.title = title;
      control.append(glyph(icon)); return control;
    }
    function refresh() {
      placeWarnings();
      var items = instance.getItems();
      var byId = new Map(items.map(function(item) { return [item.id, item]; }));
      model.setItems(items, instance.isComplete());
      if (pendingRoute !== null && instance.isComplete()) {
        model.replace(pendingRoute.map(function(token) {
          var item = items.find(function(item) { return (item.venueKey || item.id) === token; });
          return item && item.id;
        }).filter(Boolean));
        pendingRoute = null;
      }
      var selected = model.selected(), ids = model.ids();
      summaryLabel.textContent = labels.title;
      list.replaceChildren();
      selected.forEach(function(item, index) {
        var row = node('li', '__stop'); row.dataset.routeId = item.id;
        var number = node('span', '__number', String(index + 1));
        number.setAttribute('aria-hidden', 'true');
        var name = node('span', '__name', item.title); name.title = item.title;
        row.append(number, name);
        var controls = node('span', '__controls');
        var up = button('up', item.id, labels.up + ' : ' + item.title, 'arrow_upward');
        var down = button('down', item.id, labels.down + ' : ' + item.title, 'arrow_downward');
        up.disabled = index === 0; down.disabled = index === selected.length - 1;
        controls.append(up, down, button('remove', item.id, labels.remove + ' : ' + item.title, 'close'));
        row.append(controls); list.append(row);
      });
      empty.hidden = selected.length > 0; actions.hidden = !selected.length;
      maps.hidden = mode === 'transit';
      next.hidden = mode !== 'transit' && selected.length < 2;
      modeNote.hidden = mode !== 'transit';
      modeControls.querySelectorAll('[data-route-mode]').forEach(function(control) {
        control.setAttribute('aria-pressed', String(control.dataset.routeMode === mode));
      });
      maps.href = directions(selected, false, mode); next.href = directions(selected, true, mode);
      root.querySelectorAll('.lb-card[data-item-id]').forEach(function(card) {
        var item = byId.get(card.dataset.itemId);
        var control = card.querySelector('.cb-route-planner__add');
        if (!item || !model.eligible(item)) { if (control) control.remove(); return; }
        if (!control) {
          control = node('button', '__add'); control.type = 'button';
          control.dataset.routeAction = iconCards ? 'add' : 'toggle';
          control.dataset.routeId = item.id;
          if (iconCards) control.classList.add('cb-route-planner__add--icon', 'lb-route-planner__add--icon');
        }
        var inList = iconCards && (instance.config.layout === 'list' || listMedia && listMedia.matches);
        var media = iconCards && !inList && card.querySelector('.cb-card__media');
        var host = inList ? card : media || card.querySelector('.cb-card__body') || card;
        control.classList.toggle('cb-route-planner__add--list', !!inList);
        control.classList.toggle('lb-route-planner__add--list', !!inList);
        if (media) media.classList.add('cb-route-planner__media', 'lb-route-planner__media');
        if (control.parentNode !== host) host.append(control);
        var chosen = ids.includes(item.id);
        var label = chosen ? (iconCards ? labels.added : labels.remove) : labels.add;
        if (iconCards) control.replaceChildren(glyph(chosen ? 'check' : 'add_location'));
        else control.textContent = label;
        control.setAttribute('aria-pressed', String(chosen));
        control.setAttribute('aria-label', label + ' : ' + item.title);
        control.title = label;
        control.disabled = chosen && iconCards || !chosen && ids.length >= model.max;
      });
      if (urlDirty && instance.isComplete()) { writeRouteURL(); urlDirty = false; }
      if (preview && instance.isComplete()) preview.update(selected, mode);
    }
    function onClick(event) {
      var modeControl = event.target.closest('[data-route-mode]');
      if (modeControl && modeControls.contains(modeControl)) {
        event.preventDefault(); event.stopPropagation();
        mode = modeControl.dataset.routeMode; urlDirty = true;
        try { if (storage) storage.setItem(modeKey, mode); } catch (_) {}
        refresh(); return;
      }
      var control = event.target.closest('[data-route-action]');
      if (!control || !root.contains(control)) return;
      event.preventDefault(); event.stopPropagation();
      if (control.disabled) return;
      var action = control.dataset.routeAction, id = control.dataset.routeId;
      if (!['add', 'toggle', 'remove', 'up', 'down'].includes(action)) return;
      if (action === 'add' && model.ids().includes(id)) return;
      pendingRoute = null; urlDirty = true;
      var changed = action === 'up' || action === 'down'
        ? model.move(id, action === 'up' ? -1 : 1) : model.toggle(id);
      if (!changed) { status.textContent = labels.limit; return; }
      panel.open = true; refresh();
      status.textContent = model.persistent() ? labels.saved : labels.unavailable;
      if (action !== 'toggle' && action !== 'add') {
        var row = Array.from(list.children).find(function(el) { return el.dataset.routeId === id; });
        var focus = row && row.querySelector('[data-route-action="' + action + '"]:not(:disabled)');
        (focus || summary).focus();
      }
    }
    function onHistory() {
      if (!root.isConnected) { controller.destroy(); return; }
      pendingRoute = readRouteURL(); urlDirty = true;
      readModeURL(true);
      if (pendingRoute === null) pendingRoute = [];
      refresh();
    }
    root.addEventListener('click', onClick);
    async function copyRoute() {
      writeRouteURL();
      var value = window.location.href;
      try {
        if (!window.navigator || !window.navigator.clipboard) throw new Error('Clipboard unavailable');
        await window.navigator.clipboard.writeText(value);
        share.replaceChildren(glyph('check')); share.title = labels.copied;
        status.textContent = labels.copied;
        clearTimeout(shareTimer);
        shareTimer = setTimeout(function() {
          share.replaceChildren(glyph('share')); share.title = labels.share;
        }, 2500);
      } catch (_) {
        shareField.value = value; shareField.hidden = false;
        shareField.focus(); shareField.select();
      }
    }
    share.addEventListener('click', copyRoute);
    if (listMedia) listMedia.addEventListener('change', refresh);
    if (routeParam) window.addEventListener('popstate', onHistory);
    var controller = { refresh: refresh, destroy: function() {
      root.removeEventListener('click', onClick);
      share.removeEventListener('click', copyRoute); clearTimeout(shareTimer);
      if (listMedia) listMedia.removeEventListener('change', refresh);
      window.removeEventListener('popstate', onHistory);
      if (preview) preview.destroy();
      panel.removeEventListener('toggle', placeWarnings);
      panel.remove();
      root.querySelectorAll('.cb-route-planner__add').forEach(function(el) { el.remove(); });
      root.querySelectorAll('.cb-route-planner__media').forEach(function(el) {
        el.classList.remove('cb-route-planner__media', 'lb-route-planner__media');
      });
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
  window.CollectionBlocksRoutePlanner = { mount: mount, createModel: createModel, directions: directions, createPreview: createPreview, shortDuration: shortDuration };
  document.addEventListener('cb:locator-ready', function(event) { mount(event.detail.instance); });
  document.addEventListener('cb:locator-render', function(event) {
    var controller = mounted.get(event.detail.root); if (controller) controller.refresh();
  });
  window.addEventListener('pageshow', discover);
  discover();
})();
