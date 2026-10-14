(function() {
  'use strict';

  var ROOT_SELECTOR = '[data-am-split-navigation]';

  function normalizedPath(value) {
    var path = String(value || '/').replace(/\/+$/, '');
    return path || '/';
  }

  function isAllowedPath() {
    var options = window.AM_SPLIT_NAVIGATION_OPTIONS || {};
    var paths = Array.isArray(options.paths) && options.paths.length
      ? options.paths
      : ['/'];
    var current = normalizedPath(window.location.pathname);

    return paths.some(function(path) {
      return normalizedPath(path) === current;
    });
  }

  function buildLane(className, label, targetId) {
    var lane = document.createElement('section');
    lane.className = 'am-split-navigation__lane ' + className;
    lane.setAttribute('aria-label', label);

    var target = document.createElement('div');
    target.id = targetId;
    lane.appendChild(target);
    return lane;
  }

  function ensureSplitNavigationTarget() {
    if (document.querySelector(ROOT_SELECTOR) || !isAllowedPath()) return;

    var options = window.AM_SPLIT_NAVIGATION_OPTIONS || {};
    var host = document.querySelector(options.host || '#page-regions') ||
      document.querySelector('main') ||
      document.body;
    if (!host) return;

    var root = document.createElement('div');
    root.className = 'am-split-navigation';
    root.setAttribute('data-am-split-navigation', '');
    root.setAttribute('aria-label', options.label || 'Works');
    root.appendChild(buildLane(
      'am-split-navigation__lane--creative-direction',
      'Works, left column',
      'qb-am-work-index-creative-direction'
    ));
    root.appendChild(buildLane(
      'am-split-navigation__lane--styling',
      'Works, right column',
      'qb-am-work-index-styling'
    ));

    host.appendChild(root);
  }

  ensureSplitNavigationTarget();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSplitNavigationTarget, { once: true });
  }
})();

window.QUERY_BLOCK_CONFIGS = (window.QUERY_BLOCK_CONFIGS || []).concat([
  {
    key: 'qb-am-work-index-creative-direction',
    target: '#qb-am-work-index-creative-direction',
    label: 'Work Index – Creative direction',
    heading: false,
    preFilter: { categories: ['Creative direction'] },
    filters: false,
    display: {
      counter: false,
      layout: 'grid',
      cardClasses: { categories: true },
      groups: [
        { role: 'media', children: [{ type: 'media', ratio: 'var(--am-work-index-ratio, 4 / 5)' }] },
        { role: 'body', children: ['title'] }
      ]
    },
    sort: { type: 'random' },
    pagination: { mode: 'none' },
    performance: { maxPages: 'all', lazyInit: false },
    sourceCollection: { path: '/work-index' },
    classes: {
      block: 'am-work-index-block am-work-index-block--creative-direction',
      card: 'am-work-index-card'
    },
    i18n: { noResults: 'No creative direction projects available' }
  },
  {
    key: 'qb-am-work-index-styling',
    target: '#qb-am-work-index-styling',
    label: 'Work Index – Styling',
    heading: false,
    preFilter: { categories: ['Styling'] },
    filters: false,
    display: {
      counter: false,
      layout: 'grid',
      cardClasses: { categories: true },
      groups: [
        { role: 'media', children: [{ type: 'media', ratio: 'var(--am-work-index-ratio, 4 / 5)' }] },
        { role: 'body', children: ['title'] }
      ]
    },
    sort: { type: 'random' },
    pagination: { mode: 'none' },
    performance: { maxPages: 'all', lazyInit: false },
    sourceCollection: { path: '/work-index' },
    classes: {
      block: 'am-work-index-block am-work-index-block--styling',
      card: 'am-work-index-card'
    },
    i18n: { noResults: 'No styling projects available' }
  }
]);
