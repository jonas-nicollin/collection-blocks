(function() {
  'use strict';

  var ROOT_SELECTOR = '[data-am-split-navigation]';
  var CARD_SELECTOR = '.qb-card';

  function waitForCards(target) {
    return new Promise(function(resolve) {
      var timer = 0;
      var observer = null;

      function read() {
        var grid = target.querySelector('.qb-grid');
        var cards = grid ? Array.from(grid.children).filter(function(node) {
          return node.matches && node.matches(CARD_SELECTOR);
        }) : [];
        if (!grid || !cards.length) return;

        window.clearTimeout(timer);
        timer = window.setTimeout(function() {
          if (observer) observer.disconnect();
          resolve({
            grid: grid,
            cards: Array.from(grid.children).filter(function(node) {
              return node.matches && node.matches(CARD_SELECTOR);
            })
          });
        }, 200);
      }

      observer = new MutationObserver(read);
      observer.observe(target, { childList: true, subtree: true });
      read();
    });
  }

  function removeCloneIds(root) {
    if (root.id) root.removeAttribute('id');
    root.querySelectorAll('[id]').forEach(function(node) { node.removeAttribute('id'); });
    root.querySelectorAll('[data-qb-video-observed]').forEach(function(video) {
      video.removeAttribute('data-qb-video-observed');
      video.removeAttribute('data-qb-video-active');
      video.removeAttribute('src');
    });
  }

  function observeCloneImages(root) {
    var images = root.querySelectorAll('img[data-src], img[data-srcset]');
    if (!images.length) return;

    if (!('IntersectionObserver' in window)) {
      images.forEach(function(img) {
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        if (img.dataset.src) img.src = img.dataset.src;
      });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        if (img.dataset.src) img.src = img.dataset.src;
        observer.unobserve(img);
      });
    }, { rootMargin: '400px 0px' });

    images.forEach(function(img) { observer.observe(img); });
  }

  function cloneSet(primary) {
    var clone = primary.cloneNode(true);
    clone.classList.remove('am-split-navigation__set--primary');
    clone.classList.add('am-split-navigation__set--clone');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    removeCloneIds(clone);
    observeCloneImages(clone);
    if (window.QueryBlock && typeof window.QueryBlock.observeMedia === 'function') {
      window.QueryBlock.observeMedia(clone);
    }
    return clone;
  }

  function prepareLane(lane, result) {
    var grid = result.grid;
    var primary = document.createElement('div');
    primary.className = 'am-split-navigation__set am-split-navigation__set--primary';
    result.cards.forEach(function(card) { primary.appendChild(card); });

    var before = cloneSet(primary);
    var after = cloneSet(primary);
    grid.replaceChildren(before, primary, after);

    var state = {
      lane: lane,
      primary: primary,
      interval: 1,
      origin: 0
    };

    function measure(reset) {
      state.origin = primary.offsetTop;
      state.interval = Math.max(1, after.offsetTop - primary.offsetTop);
      if (reset) {
        lane.scrollTop = lane.classList.contains('am-split-navigation__lane--styling')
          ? state.origin + state.interval / 2
          : state.origin;
      }
      normalizeLane(state);
    }

    requestAnimationFrame(function() { measure(true); });

    if ('ResizeObserver' in window) {
      var resizeObserver = new ResizeObserver(function() { measure(false); });
      resizeObserver.observe(primary);
      state.resizeObserver = resizeObserver;
    }

    return state;
  }

  function normalizeLane(state) {
    var min = state.origin;
    var max = min + state.interval;
    var top = state.lane.scrollTop;

    while (top >= max) top -= state.interval;
    while (top < min) top += state.interval;

    if (Math.abs(top - state.lane.scrollTop) > .5) state.lane.scrollTop = top;
  }

  function initRoot(root) {
    if (root.dataset.amSplitInitialized === 'true') return;
    root.dataset.amSplitInitialized = 'true';

    var lanes = Array.from(root.querySelectorAll('.am-split-navigation__lane'));
    var targets = lanes.map(function(lane) { return lane.querySelector('[id^="qb-am-work-index-"]'); });
    if (lanes.length !== 2 || targets.some(function(target) { return !target; })) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('am-split-navigation--reduced-motion');
      return;
    }

    Promise.all(targets.map(waitForCards)).then(function(results) {
      var states = lanes.map(function(lane, index) { return prepareLane(lane, results[index]); });
      var pending = 0;
      var frame = 0;

      function render() {
        frame = 0;
        if (!pending) return;

        states[0].lane.scrollTop += pending;
        states[1].lane.scrollTop -= pending;
        pending = 0;
        states.forEach(normalizeLane);
      }

      function move(delta) {
        pending += delta;
        if (!frame) frame = requestAnimationFrame(render);
      }

      root.addEventListener('wheel', function(event) {
        if (event.ctrlKey) return;
        event.preventDefault();
        move(event.deltaY || event.deltaX);
      }, { passive: false });

      var previousY = null;
      root.addEventListener('touchstart', function(event) {
        previousY = event.touches.length ? event.touches[0].clientY : null;
      }, { passive: true });
      root.addEventListener('touchmove', function(event) {
        if (previousY == null || !event.touches.length) return;
        var nextY = event.touches[0].clientY;
        event.preventDefault();
        move(previousY - nextY);
        previousY = nextY;
      }, { passive: false });
      root.addEventListener('touchend', function() { previousY = null; }, { passive: true });

      root.tabIndex = root.tabIndex >= 0 ? root.tabIndex : 0;
      root.addEventListener('keydown', function(event) {
        var delta = 0;
        if (event.key === 'ArrowDown') delta = 80;
        if (event.key === 'ArrowUp') delta = -80;
        if (event.key === 'PageDown' || event.key === ' ') delta = root.clientHeight * .8;
        if (event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) delta = -root.clientHeight * .8;
        if (!delta) return;
        event.preventDefault();
        move(delta);
      });

      root.classList.add('am-split-navigation--ready');
    });
  }

  function init() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('turbolinks:load', init);
})();
