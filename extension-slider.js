(function () {
  'use strict';
  if (window.CollectionBlocksSlider) return;
  var instances = new WeakMap();
  var defaults = {
    cardSelector: '.cb-card, .qb-card, .rb-card, .lb-card',
    autoplay: 0, arrows: true, dots: false, drag: true, dragThreshold: 48,
    step: 100, cssPrefix: '--cb-slider', introDuration: 0,
    label: 'Sélection', previousLabel: 'Contenu précédent', nextLabel: 'Contenu suivant',
    dotLabel: 'Afficher le contenu ', previousIcon: '‹', nextIcon: '›',
    controlsInGrid: false,
    classes: {
      root: 'cb-slider', track: 'cb-slider__track', slide: 'cb-slider__slide',
      controls: 'cb-slider__controls', button: 'cb-slider__button',
      previous: 'cb-slider__previous', next: 'cb-slider__next', dot: 'cb-slider__dot',
      icon: '', ready: 'cb-slider--ready', introReady: 'cb-slider--intro-ready',
      introComplete: 'cb-slider--intro-complete', dragging: 'cb-slider--dragging'
    }
  };
  function mount(grid, options) {
    if (!grid) return null;
    if (instances.has(grid)) { instances.get(grid).refresh(); return instances.get(grid); }
    options = options || {};
    var cfg = Object.assign({}, defaults, options);
    cfg.classes = Object.assign({}, defaults.classes, options.classes || {});
    var root = options.root || grid.closest('.cb-block, .qb-block, .rb-block, .lb-block') || grid;
    var classes = cfg.classes, prefix = cfg.cssPrefix;
    var cards = [], dots = [], index = 0, timer = null, frame = null, introTimer = null;
    var controls = null, destroyed = false, drag = null, suppressClick = false;
    var hovering = false, focused = root.contains(document.activeElement), paused = false;
    var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var listeners = [], originals = new Map();
    function remember(node) {
      if (!originals.has(node)) originals.set(node, { attrs: new Map(), styles: new Map(), classes: new Map() });
      return originals.get(node);
    }
    function attr(node, name, value) {
      var saved = remember(node).attrs;
      if (!saved.has(name)) saved.set(name, node.getAttribute(name));
      if (value == null) node.removeAttribute(name); else node.setAttribute(name, String(value));
    }
    function css(node, name, value) {
      var saved = remember(node).styles;
      if (!saved.has(name)) saved.set(name, [node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]);
      node.style.setProperty(name, String(value));
    }
    function toggle(node, names, active) {
      String(names || '').split(/\s+/).filter(Boolean).forEach(function(name) {
        var saved = remember(node).classes;
        if (!saved.has(name)) saved.set(name, node.classList.contains(name));
        node.classList.toggle(name, active);
      });
    }
    function restore(node) {
      var saved = originals.get(node);
      if (!saved) return;
      saved.attrs.forEach(function(value, name) {
        if (value == null) node.removeAttribute(name); else node.setAttribute(name, value);
      });
      saved.styles.forEach(function(value, name) {
        if (value[0]) node.style.setProperty(name, value[0], value[1]); else node.style.removeProperty(name);
      });
      saved.classes.forEach(function(value, name) { node.classList.toggle(name, value); });
      originals.delete(node);
    }
    function on(node, type, callback, capture) {
      node.addEventListener(type, callback, capture);
      listeners.push(function() { node.removeEventListener(type, callback, capture); });
    }
    function stop() { if (timer != null) window.clearInterval(timer); timer = null; }
    function start() {
      stop();
      if (destroyed || !grid.isConnected || cards.length < 2 || hovering || focused || paused ||
          document.hidden || (motion && motion.matches) || !(Number(cfg.autoplay) > 0)) return;
      timer = window.setInterval(function() {
        if (!grid.isConnected) { stop(); return; }
        show(index + 1, false);
      }, Math.max(1000, Number(cfg.autoplay)));
    }
    function show(next, user) {
      if (destroyed || !cards.length) return;
      var previous = index, length = cards.length;
      index = ((Number(next) % length) + length) % length;
      if (!Number.isFinite(index)) return;
      index = Math.floor(index);
      css(root, prefix + '-active-index', index);
      cards.forEach(function(card, i) {
        var offset = i - index;
        if (offset > length / 2) offset -= length;
        if (offset < -length / 2) offset += length;
        toggle(card, 'is-active', i === index);
        toggle(card, 'is-previous', previous !== index && i === previous);
        toggle(card, 'is-before', offset < 0);
        toggle(card, 'is-after', offset > 0);
        toggle(card, 'is-adjacent', Math.abs(offset) === 1);
        toggle(card, 'is-distant', Math.abs(offset) > 1);
        css(card, prefix + '-offset', offset);
        css(card, prefix + '-offset-x', offset * cfg.step + '%');
        attr(card, 'aria-hidden', i !== index);
        [card].concat(Array.from(card.querySelectorAll('a, button, input, select, textarea, [tabindex]')))
          .forEach(function(node) {
            var original = remember(node).attrs;
            if (!original.has('tabindex')) original.set('tabindex', node.getAttribute('tabindex'));
            attr(node, 'tabindex', i === index ? original.get('tabindex') : '-1');
          });
      });
      dots.forEach(function(dot, i) {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
      if (typeof cfg.onChange === 'function') cfg.onChange({ index: index, card: cards[index], grid: grid, user: !!user });
      if (user) start();
    }
    function button(className, label, icon, action) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = className; btn.setAttribute('aria-label', label);
      if (icon) {
        var span = document.createElement('span');
        span.className = classes.icon; span.setAttribute('aria-hidden', 'true'); span.textContent = icon;
        btn.appendChild(span);
      }
      btn.addEventListener('click', action);
      return btn;
    }
    function rebuildControls() {
      if (controls) controls.remove();
      controls = null; dots = [];
      if (cards.length < 2 || (!cfg.arrows && !cfg.dots)) return;
      controls = document.createElement('div'); controls.className = classes.controls;
      if (cfg.arrows) controls.appendChild(button(classes.button + ' ' + classes.previous,
        cfg.previousLabel, cfg.previousIcon, function() { show(index - 1, true); }));
      if (cfg.dots) cards.forEach(function(card, i) {
        var dot = button(classes.dot, cfg.dotLabel + (i + 1), '', function() { show(i, true); });
        controls.appendChild(dot); dots.push(dot);
      });
      if (cfg.arrows) controls.appendChild(button(classes.button + ' ' + classes.next,
        cfg.nextLabel, cfg.nextIcon, function() { show(index + 1, true); }));
      (cfg.controlsInGrid ? grid : root).appendChild(controls);
    }
    function refresh() {
      if (destroyed) return;
      var next = Array.from(grid.children).filter(function(node) { return node.matches(cfg.cardSelector); });
      if (next.length === cards.length && next.every(function(card, i) { return card === cards[i]; })) return;
      var active = cards[index];
      cards.filter(function(card) { return next.indexOf(card) < 0; }).forEach(function(card) {
        Array.from(card.querySelectorAll('*')).forEach(restore); restore(card);
      });
      cards = next;
      var nextIndex = cards.indexOf(active);
      index = nextIndex >= 0 ? nextIndex : Math.min(index, Math.max(0, cards.length - 1));
      cards.forEach(function(card, i) {
        toggle(card, classes.slide, true);
        css(card, prefix + '-slide-index', i);
        attr(card, 'aria-label', 'Slide ' + (i + 1) + ' sur ' + cards.length);
      });
      rebuildControls(); show(index, false); start();
    }
    function schedule() {
      if (frame != null || destroyed) return;
      frame = window.requestAnimationFrame(function() { frame = null; refresh(); });
    }
    toggle(root, classes.root, true); toggle(root, classes.ready, true);
    toggle(grid, classes.track, true);
    attr(root, 'role', 'region'); attr(root, 'aria-roledescription', 'carousel'); attr(root, 'aria-label', cfg.label);
    on(root, 'mouseenter', function() { hovering = true; start(); });
    on(root, 'mouseleave', function() { hovering = false; start(); });
    on(root, 'focusin', function() { focused = true; start(); });
    on(root, 'focusout', function(event) { focused = root.contains(event.relatedTarget); start(); });
    on(document, 'visibilitychange', start);
    if (motion && motion.addEventListener) on(motion, 'change', start);
    on(root, 'keydown', function(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); show(index + (event.key === 'ArrowRight' ? 1 : -1), true);
      }
    });
    if (cfg.drag) {
      on(root, 'pointerdown', function(event) {
        if ((event.button && event.button !== 0) || event.target.closest('button,input,textarea,select')) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
        suppressClick = false; stop();
      });
      on(window, 'pointermove', function(event) {
        if (!drag || drag.id !== event.pointerId) return;
        var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.35) toggle(root, classes.dragging, true);
      });
      on(window, 'pointerup', function(event) {
        if (!drag || drag.id !== event.pointerId) return;
        var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        suppressClick = Math.abs(dx) >= cfg.dragThreshold && Math.abs(dx) > Math.abs(dy) * 1.35;
        drag = null; toggle(root, classes.dragging, false);
        if (suppressClick) show(index + (dx < 0 ? 1 : -1), true); else start();
      });
      on(window, 'pointercancel', function() { drag = null; toggle(root, classes.dragging, false); start(); });
      on(root, 'dragstart', function(event) { event.preventDefault(); });
      on(root, 'click', function(event) {
        if (!suppressClick) return;
        suppressClick = false; event.preventDefault(); event.stopPropagation();
      }, true);
    }
    var observer = new MutationObserver(schedule);
    observer.observe(grid, { childList: true });
    var introFrame = window.requestAnimationFrame(function() {
      if (destroyed) return;
      toggle(root, classes.introReady, true);
      introTimer = window.setTimeout(function() {
        toggle(root, classes.introComplete, true);
      }, motion && motion.matches ? 0 : cfg.introDuration);
    });
    var api = {
      refresh: refresh,
      goTo: function(next) { show(next, true); },
      pause: function() { paused = true; stop(); },
      resume: function() { paused = false; start(); },
      destroy: function() {
        if (destroyed) return;
        destroyed = true; stop(); observer.disconnect();
        window.cancelAnimationFrame(frame); window.cancelAnimationFrame(introFrame);
        window.clearTimeout(introTimer);
        listeners.forEach(function(remove) { remove(); });
        if (controls) controls.remove();
        Array.from(originals.keys()).forEach(restore);
        instances.delete(grid);
      }
    };
    instances.set(grid, api); refresh();
    return api;
  }
  window.CollectionBlocksSlider = { version: '1.0.0', mount: mount };
})();
