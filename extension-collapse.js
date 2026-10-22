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
  function mount(scope, cfg) {
    if (!scope || !cfg || !cfg.listSelector || !cfg.itemSelector) return null;
    if (controllers.has(scope)) return controllers.get(scope);
    var prefix = cfg.classPrefix || 'cb-collapse';
    var threshold = positive(cfg.threshold, 8);
    var step = positive(cfg.step, threshold);
    var visibleCount = threshold, items = [], controls, more, less, list;
    var originals = new Map(), generatedList = null, generatedId = '';
    function restore(item) {
      if (!originals.has(item)) return;
      var original = originals.get(item);
      item.hidden = original.hidden;
      item.classList.toggle(prefix + '__item--hidden', original.classHidden);
      originals.delete(item);
    }
    function removeControls() {
      if (controls) controls.remove();
      controls = more = less = null;
      scope.classList.remove(prefix, prefix + '--collapsed', prefix + '--expanded');
    }
    function apply() {
      items.forEach(function (item, index) {
        var hidden = index >= visibleCount;
        item.hidden = hidden;
        item.classList.toggle(prefix + '__item--hidden', hidden);
      });
      if (controls) {
        var complete = visibleCount >= items.length;
        more.hidden = complete;
        less.hidden = !complete;
        more.setAttribute('aria-expanded', String(complete));
        less.setAttribute('aria-expanded', String(complete));
        scope.classList.toggle(prefix + '--expanded', complete);
        scope.classList.toggle(prefix + '--collapsed', !complete);
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
      list = scope.querySelector(cfg.listSelector);
      var previous = items;
      items = list ? Array.from(scope.querySelectorAll(cfg.itemSelector)).filter(function (item) {
        return list.contains(item) && (!cfg.excludeSelector || !item.matches(cfg.excludeSelector));
      }) : [];
      previous.forEach(function (item) { if (items.indexOf(item) < 0) restore(item); });
      items.forEach(function (item) {
        if (!originals.has(item)) originals.set(item, {
          hidden: item.hidden, classHidden: item.classList.contains(prefix + '__item--hidden')
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
        controls.className = prefix + '__controls';
        more = document.createElement('button'); less = document.createElement('button');
        more.type = less.type = 'button';
        more.className = 'cb-load-more ' + prefix + '__more';
        less.className = 'cb-load-more ' + prefix + '__less';
        more.textContent = (cfg.labels && cfg.labels.showMore) || 'View more';
        less.textContent = (cfg.labels && cfg.labels.showLess) || 'View less';
        if (!list.id) { generatedList = list; generatedId = 'cb-collapse-list-' + (++nextId); list.id = generatedId; }
        more.setAttribute('aria-controls', list.id); less.setAttribute('aria-controls', list.id);
        more.addEventListener('click', showMore); less.addEventListener('click', collapse);
        controls.append(more, less);
        var footer = cfg.footerSelector ? scope.querySelector(cfg.footerSelector) : null;
        if (footer) footer.appendChild(controls); else list.insertAdjacentElement('afterend', controls);
        scope.classList.add(prefix);
      }
      visibleCount = Math.max(threshold, Math.min(visibleCount, items.length));
      apply();
    }
    var controller = {
      refresh: refresh, showMore: showMore, collapse: collapse,
      destroy: function () {
        originals.forEach(function (_value, item) { restore(item); });
        removeControls();
        if (generatedList && generatedList.id === generatedId) generatedList.removeAttribute('id');
        controllers.delete(scope);
      }
    };
    controllers.set(scope, controller);
    refresh();
    return controller;
  }
  function refresh() {
    controllers.forEach(function (controller, scope) {
      if (!scope.isConnected) controller.destroy(); else controller.refresh();
    });
    array(window.CB_COLLAPSE_CONFIGS).forEach(function (cfg) {
      array(cfg.targets).forEach(function (selector) {
        document.querySelectorAll(selector).forEach(function (scope) { mount(scope, cfg); });
      });
    });
  }
  window.CollectionBlocksCollapse = { version: '1.0.0', mount: mount, refresh: refresh };
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
  schedule();
})();
