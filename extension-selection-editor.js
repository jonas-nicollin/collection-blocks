/* Optional selection editor. Public data only; exports a Code Block, never writes to the CMS. */
(function () {
  'use strict';
  if (window.CollectionBlocksSelectionEditor) return;
  var active, toolbar, dock, dockMenu, dockToggle, triggers = new Map();
  function node(tag, part, text) {
    var el = document.createElement(tag); el.className = 'cb-editor' + part;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function button(part, text, action) {
    var el = node('button', part, text); el.type = 'button';
    if (action) el.addEventListener('click', action); return el;
  }
  function label(control, text, icon, cfg) {
    control.replaceChildren();
    if (cfg.icons === 'material-symbols' && icon) {
      var glyph = node('span', '__icon', icon); glyph.setAttribute('aria-hidden', 'true');
      control.append(glyph);
    }
    if (text) control.append(node('span', '__label', text));
  }
  function lockScroll() {
    var elements = new Set(), view = window;
    // The site may live inside Squarespace's scrolling preview frame.
    while (view) {
      try {
        elements.add(view.document.documentElement); elements.add(view.document.body);
        var frame = view.frameElement;
        if (!frame) break;
        for (var parent = frame.parentElement; parent; parent = parent.parentElement) {
          if (parent.scrollHeight > parent.clientHeight &&
              /auto|scroll/.test(view.parent.getComputedStyle(parent).overflowY)) elements.add(parent);
        }
        view = view.parent;
      } catch (_) { break; }
    }
    var originals = [];
    elements.forEach(function(el) {
      if (!el) return;
      originals.push([el, el.style.getPropertyValue('overflow'), el.style.getPropertyPriority('overflow')]);
      el.style.setProperty('overflow', 'hidden', 'important');
    });
    return function() { originals.forEach(function(entry) {
      if (entry[1]) entry[0].style.setProperty('overflow', entry[1], entry[2]);
      else entry[0].style.removeProperty('overflow');
    }); };
  }
  function normalize(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function clean(text) {
    var box = document.createElement('textarea'); box.innerHTML = text || ''; return box.value;
  }
  function editing() { return !!document.querySelector('.sqs-edit-mode-active, .squarespace-edit-mode-active'); }
  async function open(target, cfg) {
    if (active || !editing()) return;
    var api = window.CollectionBlocksSelection;
    if (!api) return;
    var dialog = node('dialog', ''), selected, catalog = [], index = new Map();
    var filter = '', limit = 24, drag = null, closed = false, matches = [];
    var restoreScroll = function() {}, returnFocus = document.activeElement;
    var titleCounts = new Map();
    var refsElement = target.querySelector(cfg.selector || '.cb-selection');
    var status = node('p', '__status'); status.setAttribute('role', 'status');
    var close = button('__close', '×', function() { dialog.close(); }); close.setAttribute('aria-label', 'Fermer');
    if (cfg.icons === 'material-symbols') label(close, '', 'close', cfg);
    dialog.setAttribute('aria-label', cfg.title || 'Composer une sélection');
    dialog.addEventListener('close', function() {
      closed = true; restoreScroll(); dialog.remove(); active = null;
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    });
    var outsideStart = false;
    function outside(event) {
      var rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left ||
        event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    }
    dialog.addEventListener('pointerdown', function(event) { outsideStart = outside(event); });
    dialog.addEventListener('click', function(event) {
      if (outsideStart && outside(event)) dialog.close();
      outsideStart = false;
    });
    // Keep the surrounding native block editor from intercepting our controls.
    ['click', 'dblclick', 'pointerdown', 'keydown'].forEach(function(event) {
      dialog.addEventListener(event, function(e) { e.stopPropagation(); });
    });
    var layout = node('div', '__layout'), left = node('section', '__pane'), right = node('section', '__pane');
    var search = node('input', '__search'); search.type = 'search';
    search.placeholder = 'Rechercher un titre ou un lieu…'; search.setAttribute('aria-label', 'Rechercher un contenu');
    var filters = node('div', '__filters'), results = node('div', '__catalog');
    var list = node('div', '__selection'); list.setAttribute('aria-label', 'Contenus sélectionnés');
    results.setAttribute('aria-label', 'Catalogue des contenus'); results.tabIndex = 0;
    var output = node('textarea', '__output'); output.readOnly = true; output.hidden = true;
    output.spellcheck = false; output.wrap = 'off';
    output.setAttribute('aria-label', 'Code à coller dans le Code Block');
    var instruction = node('p', '__instruction'); instruction.hidden = true;
    var copy = button('__copy', 'Copier le Code Block', async function() {
      var exported = document.createElement('div'), data = document.createElement('div');
      exported.className = cfg.targetClass || target.className;
      // Keep the native edit-mode badge and target identity when replacing the block.
      ['id', 'data-cb-label', 'data-qb-label', 'data-rb-label', 'data-lb-label'].forEach(function(name) {
        if (target.hasAttribute(name)) exported.setAttribute(name, target.getAttribute(name));
      });
      if (cfg.targetLabel) exported.setAttribute('data-cb-label', cfg.targetLabel);
      data.className = 'cb-selection'; data.hidden = true;
      data.textContent = '\n' + api.serialize(selected, cfg).split('\n').map(function(line) {
        return '    ' + line;
      }).join('\n') + '\n  ';
      exported.append('\n  ', data, '\n'); output.value = exported.outerHTML;
      output.hidden = false; instruction.hidden = false;
      instruction.textContent = 'Collez ce code dans le Code Block correspondant, puis enregistrez la page.';
      try { await navigator.clipboard.writeText(output.value); label(copy, 'Code copié', 'check', cfg); status.textContent = ''; }
      catch (_) { output.focus(); output.select(); status.textContent = 'Sélectionnez et copiez le code ci-dessous.'; }
    });
    copy.setAttribute('aria-live', 'polite');
    var exportArea = node('div', '__export'); exportArea.append(copy, instruction, output);
    left.append(node('h2', '__title', cfg.catalogLabel || 'Choisir les contenus'), search, filters, results);
    right.classList.add('cb-editor__pane--selection');
    right.append(node('h2', '__title', 'Votre sélection'), list, exportArea);
    layout.append(left, right);
    dialog.append(node('p', '__context', cfg.title || cfg.openLabel || 'Composer une sélection'), close, layout, status);
    document.body.append(dialog);
    active = dialog; dialog.showModal(); restoreScroll = lockScroll();
    status.textContent = 'Chargement…'; copy.disabled = true;
    var kinds = cfg.types || [{ key: '', label: 'Tous' }];
    kinds.forEach(function(type) {
      var b = button('__filter', type.label, function() { filter = type.key; limit = 24; results.scrollTop = 0; renderCatalog(); });
      b.dataset.type = type.key; b.setAttribute('aria-pressed', String(!type.key)); filters.append(b);
    });
    function kind(item) {
      return kinds.find(function(type) { return type.key && type.source === item.selectionSource &&
        (!type.category || (item.categories || []).includes(type.category)) &&
        (!type.excludeCategory || !(item.categories || []).includes(type.excludeCategory)); });
    }
    function key(ref) { return ref.source + ':' + ref.id; }
    function reference(item) { return { source: item.selectionSource, id: item.id }; }
    function thumbnail(item) {
      var img = node('img', '__image'); img.alt = ''; img.loading = 'lazy';
      if (item.assetUrl && /^https?:\/\//.test(item.assetUrl)) {
        var url = new URL(item.assetUrl); url.searchParams.set('format', '150w'); img.src = url.href;
      }
      return img;
    }
    function caption(item) {
      var box = node('div', '__caption');
      var name = node('span', '__name', clean(item.title)); name.title = clean(item.title);
      var categories = (item.categories || []).map(clean).filter(Boolean);
      if (categories.length) box.append(node('span', '__kind', categories.join(' · ')));
      box.append(name);
      var venue = item.venue && item.venue.title;
      if (venue && venue !== item.title) box.append(node('span', '__place', clean(venue)));
      // Dates only disambiguate repeated titles, never every catalog row.
      if ((titleCounts.get(normalize(item.title)) || 0) > 1) {
        var date = (item.tags || []).find(function(tag) { return /^Date:/.test(tag); });
        box.append(node('span', '__place', date ? clean(date) : clean(item.urlId || item.id)));
      }
      return box;
    }
    function renderCatalog() {
      var q = normalize(search.value);
      matches = catalog.filter(function(item) {
        return (!filter || kind(item)?.key === filter) && normalize(clean(item.title) + ' ' +
          (item.venue?.title || item.location?.addressTitle || '')).includes(q);
      });
      results.replaceChildren();
      appendCatalog(0);
      if (!matches.length) results.append(node('p', '__empty', 'Aucun contenu trouvé.'));
      filters.querySelectorAll('button').forEach(function(b) { b.setAttribute('aria-pressed', String(b.dataset.type === filter)); });
    }
    function appendCatalog(start) {
      matches.slice(start, limit).forEach(function(item) {
        var chosen = selected.some(function(ref) { return key(ref) === key(reference(item)); });
        var row = node('div', '__row');
        var add = button('__add', chosen ? '✓' : '+', function() {
          if (selected.length >= (cfg.maxItems || 25)) { status.textContent = 'La sélection est complète.'; return; }
          selected.push(reference(item)); render();
        });
        if (cfg.icons === 'material-symbols') label(add, '', chosen ? 'check' : 'add', cfg);
        add.disabled = chosen; add.setAttribute('aria-label', 'Ajouter : ' + clean(item.title));
        row.append(thumbnail(item), caption(item), add); results.append(row);
      });
      requestAnimationFrame(loadNext);
    }
    function loadNext() {
      if (closed || !results.clientHeight || limit >= matches.length ||
          results.scrollHeight - results.scrollTop - results.clientHeight > 200) return;
      var start = limit; limit += 24; appendCatalog(start);
    }
    results.addEventListener('scroll', loadNext, { passive: true });
    function renderSelection() {
      list.replaceChildren(); copy.disabled = false; label(copy, 'Copier le Code Block', 'content_copy', cfg);
      selected.forEach(function(ref, i) {
        var item = index.get(key(ref));
        var row = node('div', '__stop'); row.dataset.key = key(ref);
        var handle = button('__drag', 'drag_indicator');
        if (cfg.icons === 'material-symbols') label(handle, '', 'drag_indicator', cfg);
        handle.setAttribute('aria-label', 'Déplacer : ' + clean(item ? item.title : ref.id));
        handle.title = 'Glisser ou utiliser les flèches haut et bas';
        handle.addEventListener('keydown', function(e) {
          if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault(); var next = i + (e.key === 'ArrowUp' ? -1 : 1);
          if (next < 0 || next >= selected.length) return;
          selected.splice(next, 0, selected.splice(i, 1)[0]); renderSelection();
          list.children[next].querySelector('button').focus(); status.textContent = 'Ordre modifié.';
        });
        var remove = button('__remove', '×', function() { selected.splice(i, 1); render(); });
        if (cfg.icons === 'material-symbols') label(remove, '', 'close', cfg);
        remove.setAttribute('aria-label', 'Retirer : ' + clean(item ? item.title : ref.id));
        row.append(handle);
        if (item) row.append(thumbnail(item), caption(item));
        else row.append(node('span', '__missing', 'Contenu introuvable : ' + ref.id));
        row.append(remove); list.append(row);
      });
      if (!selected.length) list.append(node('p', '__empty', 'Choisissez un premier contenu.'));
      output.hidden = true; instruction.hidden = true;
    }
    function render() { renderCatalog(); renderSelection(); }
    search.addEventListener('input', function() { limit = 24; results.scrollTop = 0; renderCatalog(); });
    list.addEventListener('pointerdown', function(e) {
      if (e.button !== 0 || !e.target.closest('.cb-editor__drag')) return;
      e.preventDefault(); var row = e.target.closest('.cb-editor__stop');
      drag = { row: row, pointer: e.pointerId }; row.classList.add('cb-editor__stop--dragging');
      list.setPointerCapture(e.pointerId);
    });
    list.addEventListener('pointermove', function(e) {
      if (!drag) return;
      var box = list.getBoundingClientRect();
      if (e.clientY < box.top + 35) list.scrollTop -= 12;
      if (e.clientY > box.bottom - 35) list.scrollTop += 12;
      var next = Array.from(list.children).filter(function(row) { return row !== drag.row; }).find(function(row) {
        return e.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
      });
      list.insertBefore(drag.row, next || null);
    });
    function endDrag(cancel) {
      if (!drag) return;
      var pointer = drag.pointer; drag = null;
      if (list.hasPointerCapture(pointer)) list.releasePointerCapture(pointer);
      if (!cancel) {
        var refs = new Map(selected.map(function(ref) { return [key(ref), ref]; }));
        selected = Array.from(list.children).map(function(row) { return refs.get(row.dataset.key); });
      }
      renderSelection(); status.textContent = 'Ordre modifié.';
    }
    list.addEventListener('pointerup', function() { endDrag(false); });
    list.addEventListener('pointercancel', function() { endDrag(true); });
    try {
      selected = api.read(refsElement, cfg) || [];
      catalog = (await api.catalog(cfg.sources)).sort(function(a, b) { return clean(a.title).localeCompare(clean(b.title), 'fr'); });
      if (closed) return;
      catalog.forEach(function(item) {
        var name = normalize(item.title); titleCounts.set(name, (titleCounts.get(name) || 0) + 1);
      });
      index = new Map(catalog.map(function(item) { return [key(reference(item)), item]; }));
      render(); status.textContent = ''; search.focus();
    } catch (error) { status.textContent = 'Chargement impossible. ' + error.message; }
  }
  function refresh() {
    var enabled = editing();
    triggers.forEach(function(b, target) { if (!enabled || !target.isConnected) { b.remove(); triggers.delete(target); } });
    if (!enabled) {
      if (active) active.close();
      if (toolbar) { toolbar.remove(); toolbar = null; }
      if (dock) { dock.remove(); dock = dockMenu = dockToggle = null; }
      return;
    }
    (window.CB_SELECTION_EDITOR_CONFIGS || []).forEach(function(cfg) {
      document.querySelectorAll(cfg.target).forEach(function(target) {
        if (triggers.has(target)) return;
        var b = button('__trigger', cfg.openLabel || 'Modifier le parcours', function(e) {
          e.preventDefault(); e.stopPropagation();
          if (dockMenu) { dockMenu.hidden = true; dockToggle.setAttribute('aria-expanded', 'false'); }
          open(target, cfg);
        });
        // Native Squarespace block overlays intercept pointer events inside Code Blocks.
        // Keep the launcher outside those editable surfaces.
        if (cfg.triggerPlacement === 'dock') {
          if (!dock) {
            dock = node('div', '__dock'); dockMenu = node('div', '__menu');
            dockMenu.id = 'cb-editor-block-menu'; dockMenu.hidden = true;
            dockToggle = button('__launcher', '', function() {
              dockMenu.hidden = !dockMenu.hidden;
              dockToggle.setAttribute('aria-expanded', String(!dockMenu.hidden));
            });
            dockToggle.setAttribute('aria-controls', dockMenu.id);
            dockToggle.setAttribute('aria-expanded', 'false');
            label(dockToggle, 'Modifier les sélections', 'edit', cfg);
            dock.append(dockMenu, dockToggle); document.body.append(dock);
          }
          b.setAttribute('aria-controls', target.id); dockMenu.append(b);
        } else if (cfg.triggerPlacement === 'target') {
          b.classList.add('cb-editor__trigger--target');
          b.setAttribute('aria-controls', target.id);
          document.body.append(b);
        } else {
          if (!toolbar) { toolbar = node('div', '__toolbar'); document.body.append(toolbar); }
          toolbar.append(b);
        }
        triggers.set(target, b);
      });
    });
    if (toolbar && !triggers.size) { toolbar.remove(); toolbar = null; }
    if (dock && !dockMenu.children.length) { dock.remove(); dock = dockMenu = dockToggle = null; }
    positionTriggers();
  }
  function positionTriggers() {
    triggers.forEach(function(b, target) {
      if (!b.classList.contains('cb-editor__trigger--target')) return;
      var rect = target.getBoundingClientRect();
      b.hidden = rect.bottom <= b.offsetHeight + 16 || rect.top >= window.innerHeight || rect.width <= 0;
      b.style.top = Math.max(8, rect.top + 8) + 'px';
      b.style.left = Math.max(8, Math.min(rect.right - b.offsetWidth - 8,
        window.innerWidth - b.offsetWidth - 8)) + 'px';
    });
  }
  var positioning = false;
  function schedulePosition() {
    if (positioning || !triggers.size) return;
    positioning = true;
    requestAnimationFrame(function() { positioning = false; positionTriggers(); });
  }
  window.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
  window.addEventListener('resize', schedulePosition);
  document.addEventListener('click', function(event) {
    if (dock && !dock.contains(event.target)) {
      dockMenu.hidden = true; dockToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && dockMenu && !dockMenu.hidden) {
      dockMenu.hidden = true; dockToggle.setAttribute('aria-expanded', 'false'); dockToggle.focus();
    }
  });
  window.CollectionBlocksSelectionEditor = { open: open, refresh: refresh };
  var scheduled = false;
  new MutationObserver(function() {
    if (scheduled) return; scheduled = true;
    requestAnimationFrame(function() { scheduled = false; refresh(); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  refresh();
})();
