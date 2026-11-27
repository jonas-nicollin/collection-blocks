/* Collection Blocks — progressive disclosure of already-rendered cards. */
(function () {
  'use strict';
  if (window.CollectionBlocksCollapse) return;
  var controllers = new Map();
  var nextId = 0;
  function array(value) { return !value ? [] : Array.isArray(value) ? value : [value]; }
  function positive(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) || 1 : fallback;
  }
  function mountPanel(scope, cfg) {
    if (controllers.has(scope)) return controllers.get(scope);
    var content = scope.querySelector(cfg.contentSelector || ':scope > article');
    if (!content) return null;
    var extensions = window.CollectionBlocks && window.CollectionBlocks.extensions;
    function classes(name) {
      var alias = cfg.blockPrefix ? name.replace(/^cb-/, cfg.blockPrefix + '-') : '';
      return extensions ? extensions.classes(scope, name, alias, cfg.blockPrefix) :
        [name, alias].filter(Boolean).join(' ');
    }
    var original = { hidden: content.hidden, id: content.id };
    var originalPreviewClass = content.classList.contains('cb-collapse__content--collapsed');
    var expanded = cfg.expanded === true, destroyed = false;
    var media = cfg.mediaQuery ? window.matchMedia(cfg.mediaQuery) : null;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = classes('cb-collapse__toggle');
    if (!content.id) content.id = 'cb-collapse-panel-' + (++nextId);
    button.setAttribute('aria-controls', content.id);
    content.insertAdjacentElement(cfg.preview ? 'afterend' : 'beforebegin', button);
    function apply() {
      if (destroyed) return;
      var enabled = !media || media.matches;
      var open = !enabled || expanded;
      button.hidden = !enabled;
      if (cfg.preview) content.classList.toggle('cb-collapse__content--collapsed', !open);
      else content.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      var labels = cfg.labels || {};
      var label = open ? labels.showLess || 'Hide details' : labels.showMore || 'Show details';
      if (button.textContent !== label) button.textContent = label;
      if (typeof cfg.onChange === 'function') cfg.onChange({
        scope: scope, expanded: open, enabled: enabled, visibleCount: open ? 1 : 0, total: 1
      });
    }
    function toggle() {
      var top = button.getBoundingClientRect().top, closing = expanded;
      expanded = !expanded; apply();
      if (closing && cfg.preservePosition) requestAnimationFrame(function() {
        window.scrollBy(0, button.getBoundingClientRect().top - top);
      });
    }
    button.addEventListener('click', toggle);
    if (media) media.addEventListener('change', apply);
    var controller = {
      refresh: function () {
        if (!scope.contains(content)) controller.destroy();
      },
      showMore: function () { expanded = true; apply(); },
      collapse: function () { expanded = false; apply(); },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        button.removeEventListener('click', toggle);
        if (media) media.removeEventListener('change', apply);
        button.remove();
        content.hidden = original.hidden;
        content.classList.toggle('cb-collapse__content--collapsed', originalPreviewClass);
        if (!original.id) content.removeAttribute('id');
        controllers.delete(scope);
      }
    };
    controllers.set(scope, controller);
    apply();
    return controller;
  }
  function mountText(scope, cfg) {
    if (controllers.has(scope)) return controllers.get(scope);
    var host = !cfg.contentSelector || cfg.contentSelector === ':scope'
      ? scope : scope.querySelector(cfg.contentSelector);
    if (!host) return null;
    var children = Array.from(host.children), start = children.findIndex(function(el) {
      return el.matches(cfg.startSelector || 'p');
    });
    if (start < 0) return null;
    var paragraphs = [];
    for (var i = start; i < children.length && children[i].matches(cfg.itemSelector || 'p'); i++) {
      paragraphs.push(children[i]);
    }
    if (paragraphs.map(function(el) { return el.textContent.trim(); }).join(' ').length <
        positive(cfg.minCharacters, 550)) return null;
    var region = document.createElement('div');
    region.className = 'cb-collapse__content' + (cfg.contentClass ? ' ' + cfg.contentClass : '');
    host.insertBefore(region, paragraphs[0]); paragraphs.forEach(function(el) { region.append(el); });
    var controller = mountPanel(scope, Object.assign({}, cfg, {
      contentSelector: '.cb-collapse__content', preview: true
    }));
    var destroy = controller.destroy;
    controller.destroy = function() {
      destroy(); region.replaceWith.apply(region, Array.from(region.childNodes));
    };
    return controller;
  }
  function mount(scope, cfg) {
    if (scope && cfg && cfg.mode === 'text') return mountText(scope, cfg);
    if (scope && cfg && cfg.mode === 'panel') return mountPanel(scope, cfg);
    if (!scope || !cfg || !cfg.listSelector || !cfg.itemSelector) return null;
    if (controllers.has(scope)) return controllers.get(scope);
    var prefix = cfg.classPrefix || 'cb-collapse';
    var extensions = window.CollectionBlocks && window.CollectionBlocks.extensions;
    function classes(suffix) {
      var common = 'cb-collapse' + suffix, extra = prefix + suffix;
      return extensions ? extensions.classes(scope, common, extra, cfg.blockPrefix) :
        Array.from(new Set([common, extra])).join(' ');
    }
    var originalScopeClasses = new Map(), destroyed = false;
    var media = cfg.mediaQuery ? window.matchMedia(cfg.mediaQuery) : null;
    function toggle(node, names, active) {
      names.split(/\s+/).forEach(function (name) {
        if (node === scope && !originalScopeClasses.has(name)) {
          originalScopeClasses.set(name, node.classList.contains(name));
        }
        node.classList.toggle(name, active);
      });
    }
    ['', '--collapsed', '--expanded'].forEach(function (suffix) {
      classes(suffix).split(/\s+/).forEach(function (name) {
        originalScopeClasses.set(name, scope.classList.contains(name));
      });
    });
    var threshold = positive(cfg.threshold, 8);
    var step = positive(cfg.step, threshold);
    var visibleCount = threshold, items = [], controls, more, less, list;
    var initialBudget = true;
    var originals = new Map(), generatedList = null, generatedId = '';
    function restore(item) {
      if (!originals.has(item)) return;
      var original = originals.get(item);
      item.hidden = original.hidden;
      original.classes.forEach(function (present, name) {
        item.classList.toggle(name, present);
      });
      originals.delete(item);
    }
    function removeControls() {
      if (controls) controls.remove();
      controls = more = less = null;
      originalScopeClasses.forEach(function (present, name) {
        scope.classList.toggle(name, present);
      });
    }
    function apply() {
      items.forEach(function (item, index) {
        var hidden = index >= visibleCount;
        item.hidden = hidden;
        toggle(item, classes('__item--hidden'), hidden);
      });
      if (controls) {
        var complete = visibleCount >= items.length;
        more.hidden = complete;
        less.hidden = !complete;
        more.setAttribute('aria-expanded', String(complete));
        less.setAttribute('aria-expanded', String(complete));
        toggle(scope, classes('--expanded'), complete);
        toggle(scope, classes('--collapsed'), !complete);
      }
      if (typeof cfg.onChange === 'function') cfg.onChange({
        scope: scope, visibleCount: Math.min(visibleCount, items.length), total: items.length
      });
    }
    function showMore() { visibleCount = Math.min(items.length, visibleCount + step); apply(); }
    function collapse() {
      visibleCount = threshold;
      apply();
      if (cfg.scrollToSectionOnCollapse !== false) {
        scope.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    function refresh() {
      if (destroyed) return;
      if (media && !media.matches) {
        originals.forEach(function (_value, item) { restore(item); });
        removeControls();
        visibleCount = threshold; initialBudget = true;
        return;
      }
      list = cfg.listSelector === ':scope' ? scope : scope.querySelector(cfg.listSelector);
      var previous = items;
      items = list ? Array.from(scope.querySelectorAll(cfg.itemSelector)).filter(function (item) {
        return list.contains(item) && (!cfg.excludeSelector || !item.matches(cfg.excludeSelector));
      }) : [];
      // A character budget keeps whole paragraphs/items and always shows the first.
      if (cfg.characterLimit) {
        var budget = positive(cfg.characterLimit, 800), total = 0;
        threshold = 0;
        items.some(function (item) {
          var length = item.textContent.trim().length;
          if (threshold && total + length > budget) return true;
          total += length; threshold++; return false;
        });
        threshold = Math.max(1, threshold);
      }
      previous.forEach(function (item) { if (items.indexOf(item) < 0) restore(item); });
      items.forEach(function (item) {
        if (!originals.has(item)) originals.set(item, {
          hidden: item.hidden, classes: new Map(classes('__item--hidden').split(/\s+/)
            .map(function (name) { return [name, item.classList.contains(name)]; }))
        });
      });
      if (!list || items.length <= threshold) {
        items.forEach(restore);
        visibleCount = threshold;
        removeControls();
        return;
      }
      if (controls && !controls.isConnected) { removeControls(); visibleCount = threshold; }
      if (!controls) {
        controls = document.createElement('div');
        controls.className = classes('__controls');
        more = document.createElement('button'); less = document.createElement('button');
        more.type = less.type = 'button';
        var loadMore = extensions
          ? extensions.classes(scope, 'cb-load-more', '', cfg.blockPrefix) : 'cb-load-more';
        more.className = loadMore + ' ' + classes('__more');
        less.className = loadMore + ' ' + classes('__less');
        more.textContent = (cfg.labels && cfg.labels.showMore) || 'View more';
        less.textContent = (cfg.labels && cfg.labels.showLess) || 'View less';
        if (!list.id) { generatedList = list; generatedId = 'cb-collapse-list-' + (++nextId); list.id = generatedId; }
        more.setAttribute('aria-controls', list.id); less.setAttribute('aria-controls', list.id);
        more.addEventListener('click', showMore); less.addEventListener('click', collapse);
        controls.append(more, less);
        var footer = cfg.footerSelector ? scope.querySelector(cfg.footerSelector) : null;
        if (footer) footer.appendChild(controls); else list.insertAdjacentElement('afterend', controls);
        toggle(scope, classes(''), true);
      }
      if (initialBudget && cfg.characterLimit) visibleCount = threshold;
      initialBudget = false;
      visibleCount = Math.max(threshold, Math.min(visibleCount, items.length));
      apply();
    }
    var controller = {
      refresh: refresh, showMore: showMore, collapse: collapse,
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (media) media.removeEventListener('change', refresh);
        originals.forEach(function (_value, item) { restore(item); });
        removeControls();
        if (generatedList && generatedList.id === generatedId) generatedList.removeAttribute('id');
        controllers.delete(scope);
      }
    };
    controllers.set(scope, controller);
    if (media) media.addEventListener('change', refresh);
    refresh();
    return controller;
  }
  function refresh() {
    controllers.forEach(function (controller, scope) {
      if (!scope.isConnected) controller.destroy(); else controller.refresh();
    });
    array(window.CB_COLLAPSE_CONFIGS).forEach(function (cfg) {
      array(cfg.targets).forEach(function (selector) {
        document.querySelectorAll(selector).forEach(function (scope) {
          var editing = cfg.disableInEditMode && document.querySelector(
            '.sqs-edit-mode-active, .squarespace-edit-mode-active');
          if (editing) {
            if (controllers.has(scope)) controllers.get(scope).destroy();
          } else mount(scope, cfg);
        });
      });
    });
  }
  window.CollectionBlocksCollapse = { version: '1.5.0', mount: mount, refresh: refresh };
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; refresh(); });
  }
  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('mercury:load', schedule);
  window.addEventListener('page:loaded', schedule);
  window.addEventListener('site:refresh', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true, attributeFilter: ['class']
  });
  function watchBody() {
    if (document.body) new MutationObserver(schedule).observe(document.body, {
      attributes: true, attributeFilter: ['class']
    });
  }
  if (document.body) watchBody();
  else document.addEventListener('DOMContentLoaded', watchBody, { once: true });
  schedule();
})();
