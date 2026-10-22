/* Collection Blocks — Native horizontal selection scroller. */
(function () {
  'use strict';
  if (window.CollectionBlocksScroller) return;
  var controllers = new Map();

  function wallTime(value, zone) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) {
      var check = new Date(value.slice(0, 10) + 'T00:00:00Z');
      if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== value.slice(0, 10) ||
          (value.length > 10 && (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59))) return '';
      return value.length === 10 ? value + 'T00:00' : value;
    }
    var date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    var p = {};
    parts.forEach(function (part) { p[part.type] = part.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }

  function occurrence(value, zone) {
    var range = typeof value === 'string' ? value.split('/') : [value.start, value.end];
    var start = wallTime(range[0], zone);
    if (!start) return null;
    var end = range[1] ? wallTime(range[1], zone) : '';
    if (range[1] && /^\d{4}-\d{2}-\d{2}$/.test(range[1])) end = range[1] + 'T23:59';
    if (!range[1] && /^\d{4}-\d{2}-\d{2}$/.test(range[0])) end = range[0] + 'T23:59';
    return { start: start, end: end >= start ? end : '' };
  }

  function selectOccurrence(values, now, zone) {
    var dates = (Array.isArray(values) ? values : [values]).filter(Boolean)
      .map(function (value) { return occurrence(value, zone); }).filter(Boolean);
    dates.sort(function (a, b) { return a.start.localeCompare(b.start); });
    var chosen = dates.find(function (d) { return (d.end || d.start) >= now; }) ||
      dates[dates.length - 1];
    if (!chosen) return { start: '', end: '', status: 'undated' };
    return Object.assign({}, chosen, {
      status: (chosen.end || chosen.start) < now ? 'past' :
        (chosen.start <= now && chosen.end ? 'current' : 'upcoming')
    });
  }

  function mount(track, config) {
    if (!track) return null;
    if (controllers.has(track)) {
      controllers.get(track).update(config);
      return controllers.get(track);
    }
    var cfg, labels, zone, cards = [], signature = '', pending = false;
    var frame = 0, timer = 0, lastInteraction = 0, pointer = null, dragged = false;
    var root = track.parentElement;
    var original = { role: track.getAttribute('role'), label: track.getAttribute('aria-label'),
      tabindex: track.getAttribute('tabindex') };
    root.classList.add('cb-scroller');
    track.classList.add('cb-scroller-track');
    track.setAttribute('role', 'region');
    track.setAttribute('tabindex', '0');
    var controls = document.createElement('div');
    controls.className = 'cb-scroller-controls';
    function button(className, content) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = className; b.textContent = content;
      controls.appendChild(b); return b;
    }
    var refreshButton = button('cb-scroller-refresh', '');
    refreshButton.hidden = true;
    var previous = button('cb-scroller-prev', '←');
    var next = button('cb-scroller-next', '→');
    root.insertBefore(controls, track);
    var observer = new MutationObserver(schedule);
    function observe() { observer.observe(track, { childList: true }); }
    function now() {
      return wallTime(typeof cfg.now === 'function' ? cfg.now() : (cfg.now || new Date()), zone) ||
        wallTime(new Date(), zone);
    }
    function busy() {
      return !!pointer || Date.now() - lastInteraction < 1800 ||
        (track.contains(document.activeElement) && document.activeElement !== track);
    }
    function syncButtons() {
      var overflow = track.scrollWidth - track.clientWidth;
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= overflow - 2;
      previous.hidden = next.hidden = overflow <= 2;
      refreshButton.hidden = !pending;
    }
    function divider(group, date, status, today, archive) {
      var h = document.createElement('h3');
      h.className = 'cb-scroller-day'; h.dataset.scrollerGroup = group;
      var eyebrow = document.createElement('span');
      eyebrow.className = 'cb-scroller-day__context';
      eyebrow.textContent = status === 'undated' ? labels.undated :
        (archive ? labels.archive : status === 'past' ? labels.past :
          date === today ? labels.today : '');
      var title = document.createElement('span');
      title.textContent = date ? new Intl.DateTimeFormat(cfg.locale || 'en', {
        weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC'
      }).format(new Date(date + 'T12:00Z')) : '';
      h.append(eyebrow, title); return h;
    }
    function refresh(force) {
      if (!track.isConnected) { destroy(); return; }
      cards = Array.from(track.querySelectorAll(cfg.itemSelector || ':scope > .cb-card'));
      var clock = now(), today = clock.slice(0, 10);
      var entries = cards.map(function (card, index) {
        return { card: card, index: Number(card.dataset.cbIndex || index),
          date: cfg.getSchedule ? selectOccurrence(cfg.getSchedule(card), clock, zone) : null };
      });
      var archive = !!cfg.getSchedule && entries.length > 0 &&
        entries.every(function (entry) { return entry.date.status === 'past'; });
      if (cfg.getSchedule) entries.sort(function (a, b) {
        var ranks = { current: 0, upcoming: 1, past: 2, undated: 3 };
        return ranks[a.date.status] - ranks[b.date.status] ||
          a.date.start.localeCompare(b.date.start) || a.index - b.index;
      });
      var newSignature = entries.map(function (e) {
        return e.index + ':' + (e.date ? e.date.status + e.date.start : '');
      }).join('|') + today;
      var sameNodes = entries.length === track.querySelectorAll('[data-scroller-card]').length &&
        entries.every(function (e) { return e.card.hasAttribute('data-scroller-card'); });
      if (newSignature === signature && sameNodes) { syncButtons(); return; }
      if (signature && sameNodes && !force && (busy() || track.scrollLeft > 2)) {
        pending = true; syncButtons(); return;
      }
      observer.disconnect();
      track.querySelectorAll('.cb-scroller-day').forEach(function (h) { h.remove(); });
      var lastGroup = '', fragment = document.createDocumentFragment();
      entries.forEach(function (e) {
        e.card.setAttribute('data-scroller-card', '');
        if (e.date) {
          var day = e.date.start.slice(0, 10);
          var phase = e.date.status === 'past' ? 'past' : 'active';
          var group = phase + day;
          e.card.dataset.scrollerStatus = e.date.status;
          e.card.dataset.scrollerStart = e.date.start;
          if (group !== lastGroup) {
            fragment.appendChild(divider(group, day, e.date.status, today, archive));
            lastGroup = group;
          }
        }
        fragment.appendChild(e.card);
      });
      track.appendChild(fragment); signature = newSignature; pending = false;
      if (force) track.scrollLeft = 0;
      observe(); syncButtons();
    }
    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; refresh(false); });
    }
    function scrollBy(direction) {
      lastInteraction = Date.now();
      track.scrollBy({ left: direction * track.clientWidth * 0.85,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    function goPrevious() { scrollBy(-1); }
    function goNext() { scrollBy(1); }
    function applyUpdate() { refresh(true); }
    function onScroll() { lastInteraction = Date.now(); syncButtons(); }
    function onKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); scrollBy(event.key === 'ArrowRight' ? 1 : -1);
      }
    }
    function onDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointer = { x: event.clientX, left: track.scrollLeft, id: event.pointerId };
      dragged = false;
    }
    function onMove(event) {
      if (!pointer) return;
      var delta = event.clientX - pointer.x;
      if (!dragged && Math.abs(delta) < 6) return;
      dragged = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('cb-scroller-dragging');
      track.scrollLeft = pointer.left - delta;
    }
    function onUp(event) {
      if (!pointer) return;
      if (track.hasPointerCapture(pointer.id)) track.releasePointerCapture(pointer.id);
      pointer = null; lastInteraction = Date.now();
      track.classList.remove('cb-scroller-dragging');
    }
    function onClick(event) {
      if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; }
    }
    function onDrag(event) { event.preventDefault(); }
    previous.addEventListener('click', goPrevious); next.addEventListener('click', goNext);
    refreshButton.addEventListener('click', applyUpdate);
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('keydown', onKey);
    track.addEventListener('pointerdown', onDown); track.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    track.addEventListener('click', onClick, true); track.addEventListener('dragstart', onDrag);
    var resize = new ResizeObserver(syncButtons); resize.observe(track);
    function update(options) {
      cfg = options || {}; zone = cfg.timeZone || 'UTC';
      labels = Object.assign({ previous: 'Previous items', next: 'Next items',
        update: 'Update order', today: 'Today', past: 'Earlier starts',
        archive: 'Archive', undated: 'Date to be confirmed' }, cfg.labels || {});
      track.setAttribute('aria-label', cfg.label || 'Selection');
      previous.setAttribute('aria-label', labels.previous);
      next.setAttribute('aria-label', labels.next);
      refreshButton.textContent = labels.update;
      clearInterval(timer);
      if (cfg.getSchedule) timer = setInterval(schedule, Math.max(1000, cfg.refreshInterval || 60000));
      schedule();
    }
    function destroy() {
      clearInterval(timer); cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      controls.remove();
      track.querySelectorAll('.cb-scroller-day').forEach(function (h) { h.remove(); });
      cards.sort(function (a, b) { return Number(a.dataset.cbIndex || 0) - Number(b.dataset.cbIndex || 0); });
      cards.forEach(function (card) {
        card.removeAttribute('data-scroller-card'); card.removeAttribute('data-scroller-status');
        card.removeAttribute('data-scroller-start'); track.appendChild(card);
      });
      track.classList.remove('cb-scroller-track', 'cb-scroller-dragging');
      root.classList.remove('cb-scroller');
      [['role',original.role],['aria-label',original.label],['tabindex',original.tabindex]]
        .forEach(function (entry) {
          if (entry[1] === null) track.removeAttribute(entry[0]);
          else track.setAttribute(entry[0], entry[1]);
        });
      [['scroll',onScroll],['keydown',onKey],['pointerdown',onDown],['pointermove',onMove],
        ['dragstart',onDrag]].forEach(function (entry) {
        track.removeEventListener(entry[0], entry[1]);
      });
      track.removeEventListener('click',onClick,true); controllers.delete(track);
      window.removeEventListener('pointerup',onUp); window.removeEventListener('pointercancel',onUp);
    }
    var controller = { update: update, refresh: function () { refresh(true); }, destroy: destroy };
    controllers.set(track, controller); observe(); update(config); return controller;
  }
  window.CollectionBlocksScroller = {
    version: '0.1.0', mount: mount, selectOccurrence: selectOccurrence, wallTime: wallTime
  };
})();
