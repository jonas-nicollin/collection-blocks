/* Collection Blocks — Fancybox adapter. Requires Fancybox 6.x; no bundled library. */
(function () {
  'use strict';
  if (window.CollectionBlocksFancybox) return;
  var controllers = new Map();

  var DEFAULT_FANCYBOX = {
    theme: 'light',
    hash: true,
    preload: 1,
    dragToClose: true,
    closeButton: false,
    infinite: false,
    thumbsType: 'modern',
    showThumbsOnStart: false,
    toolbar: {
      left: ['counter'],
      middle: [],
      right: ['zoomIn', 'thumbs', 'close']
    }
  };


  function array(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function scopesFor(targets) {
    var seen = new Set();
    return array(targets).flatMap(function (selector) {
      return Array.from(document.querySelectorAll(selector));
    }).filter(function (scope) {
      if (seen.has(scope)) return false;
      seen.add(scope);
      return true;
    });
  }

  function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function cleanImageUrl(url) {
    if (!url) return '';
    try {
      var parsed = new URL(url, location.href);
      parsed.searchParams.delete('format');
      return parsed.toString();
    } catch (_) {
      return String(url).replace(/([?&])format=\d+w(?:&|$)/i, '$1').replace(/[?&]$/, '');
    }
  }

  function thumbnailImageUrl(url, width) {
    var clean = cleanImageUrl(url);
    if (!clean) return '';
    try {
      var parsed = new URL(clean, location.href);
      if (/\.squarespace-cdn\.com$/i.test(parsed.hostname)) {
        parsed.searchParams.set('format', Math.max(40, Number(width) || 160) + 'w');
      }
      return parsed.toString();
    } catch (_) {
      return clean;
    }
  }

  function text(root, selector) {
    return selector && root.querySelector(selector)
      ? (root.querySelector(selector).textContent || '').trim()
      : '';
  }

  function excerptLines(root, selector) {
    var element = selector ? root.querySelector(selector) : null;
    if (!element) return [];

    /* Related Block already renders one semantic element per excerpt line.
       Read those nodes before innerText: their card CSS may make them inline,
       in which case innerText collapses every line into one string. */
    var explicitLines = Array.from(element.querySelectorAll(
      '.cb-card__excerpt-line, .rb-card__excerpt-line'
    ));

    if (explicitLines.length) {
      return explicitLines
        .map(function (line) {
          return (line.textContent || '').replace(/\u00a0/g, ' ').trim();
        })
        .filter(Boolean);
    }

    /* Summary Blocks keep their editorial breaks as <br> or block elements.
       Work from a clone so the source card remains untouched. */
    var clone = element.cloneNode(true);
    clone.querySelectorAll('br').forEach(function (br) {
      br.replaceWith(document.createTextNode('\n'));
    });
    clone.querySelectorAll('p, li').forEach(function (block) {
      block.appendChild(document.createTextNode('\n'));
    });

    return (clone.textContent || '')
      .split(/\n+/)
      .map(function (line) { return line.replace(/\u00a0/g, ' ').trim(); })
      .filter(Boolean);
  }

  function parseCardMedia(card, cfg) {
    if (typeof cfg.getMedia === 'function') return cfg.getMedia(card) || [];
    var attributeName = cfg.mediaAttribute;
    if (attributeName && card.dataset && card.dataset[attributeName]) {
      try {
        var media = JSON.parse(card.dataset[attributeName]);
        if (Array.isArray(media)) {
          return media.map(function (entry, index) {
            var src = cleanImageUrl(entry && entry.assetUrl);
            return {
              src: src,
              thumb: thumbnailImageUrl(src, cfg.thumbnailWidth),
              alt: (entry && entry.title) || '',
              mediaIndex: index
            };
          }).filter(function (entry) { return !!entry.src; });
        }
      } catch (_) {}
    }

    var image = cfg.selectors && cfg.selectors.image
      ? card.querySelector(cfg.selectors.image)
      : null;
    var src = cleanImageUrl(
      image && (
        image.getAttribute('data-image') ||
        image.getAttribute('data-src') ||
        image.currentSrc ||
        image.getAttribute('src')
      )
    );
    return src ? [{
      src: src,
      thumb: thumbnailImageUrl(src, cfg.thumbnailWidth),
      alt: image.alt || '',
      mediaIndex: 0
    }] : [];
  }

  function buildCaption(card, cfg) {
    if (typeof cfg.getCaption === 'function') return cfg.getCaption(card) || '';
    var generic = (cfg.classPrefixes && cfg.classPrefixes.generic) || 'custom-fancybox';
    var specific = (cfg.classPrefixes && cfg.classPrefixes.specific) || 'collection-items';
    var selectors = cfg.selectors || {};
    var parts = [];
    var category = text(card, selectors.category);
    var title = text(card, selectors.title);
    var lines = excerptLines(card, selectors.excerpt);

    if (category) {
      parts.push('<div class="cap-category ' + generic + '-artist ' + specific + '-artist">' + escapeHTML(category) + '</div>');
    }
    if (title) {
      parts.push('<div class="cap-title ' + generic + '-title ' + specific + '-title">' + escapeHTML(title) + '</div>');
    }
    if (lines.length) {
      parts.push('<div class="cap-excerpt ' + generic + '-details ' + specific + '-details">' + lines.map(function (line) {
        var type = /^(19\d{2}|20\d{2}|2100)$/.test(line) ? 'year' : 'line';
        return '<div class="' + generic + '-' + type + ' ' + specific + '-' + type + '">' + escapeHTML(line) + '</div>';
      }).join('') + '</div>');
    }

    if (cfg.button && cfg.button.enabled && cfg.button.href && cfg.button.label) {
      parts.push(
        '<div class="' + generic + '-enquire ' + specific + '-enquire">' +
          '<a class="' + generic + '-enquire-link ' + specific + '-enquire-link" href="' + escapeHTML(cfg.button.href) + '">' +
            escapeHTML(cfg.button.label) +
          '</a>' +
        '</div>'
      );
    }

    return parts.length
      ? '<div class="cap-wrap ' + generic + '-caption ' + specific + '-caption">' + parts.join('') + '</div>'
      : '';
  }

  function collectFancyboxSlides(scope, cfg) {
    var slides = [];
    var starts = new Map();
    var cards = Array.from(scope.querySelectorAll(cfg.itemSelector));

    cards.forEach(function (card, cardIndex) {
      var media = parseCardMedia(card, cfg);
      if (!media.length) return;
      starts.set(card, slides.length);
      var caption = buildCaption(card, cfg);
      var fallbackAlt = text(card, cfg.selectors && cfg.selectors.title);
      var artworkMedia = media.map(function (entry, mediaIndex) {
        return {
          src: entry.src,
          thumb: entry.thumb || entry.src,
          alt: entry.alt || fallbackAlt,
          mediaIndex: mediaIndex
        };
      });
      var primary = artworkMedia[0];

      slides.push({
        type: 'image',
        src: primary.src,
        thumb: primary.thumb,
        thumbSrc: primary.thumb,
        thumbAlt: primary.alt,
        caption: caption,
        alt: primary.alt,
        cbArtworkIndex: cardIndex,
        cbActiveMediaIndex: 0,
        cbMedia: artworkMedia
      });
    });

    return { slides: slides, starts: starts };
  }

  function artworkViewOptions(cfg) {
    var options = cfg.artworkViews || {};
    return {
      enabled: options.enabled !== false,
      groupLabel: options.groupLabel || 'Artwork views',
      primaryLabel: options.primaryLabel || 'Main view',
      alternateLabel: options.alternateLabel || 'Alternative view'
    };
  }

  function setArtworkViewSelection(nav, activeIndex) {
    if (!nav) return;
    Array.from(nav.querySelectorAll('[data-cb-artwork-view]')).forEach(function (button) {
      var selected = Number(button.dataset.cbArtworkView) === activeIndex;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-current', selected ? 'true' : 'false');
    });
  }

  function setArtworkViewLoading(slide, nav, loading) {
    if (slide && slide.el) {
      slide.el.classList.toggle('is-changing-artwork-view', loading);
      if (loading) slide.el.setAttribute('aria-busy', 'true');
      else slide.el.removeAttribute('aria-busy');
    }
    if (nav) {
      nav.classList.toggle('is-loading', loading);
      nav.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
  }

  function syncArtworkImageDimensions(fancybox, slide, image) {
    var panzoom = slide && slide.panzoomRef;
    var width = image && image.naturalWidth;
    var height = image && image.naturalHeight;

    if (width && height) {
      image.setAttribute('width', String(width));
      image.setAttribute('height', String(height));

      var wrapper = panzoom && panzoom.getWrapper ? panzoom.getWrapper() : null;
      if (wrapper) {
        wrapper.setAttribute('width', String(width));
        wrapper.setAttribute('height', String(height));
        wrapper.style.aspectRatio = width + ' / ' + height;
      }
    }

    if (panzoom && panzoom.execute) {
      panzoom.execute('reset', { velocity: 0 });
    }
    if (panzoom && panzoom.updateControls) {
      var container = fancybox && fancybox.getContainer ? fancybox.getContainer() : null;
      panzoom.updateControls(container || undefined);
    }
  }

  function switchArtworkView(fancybox, slide, mediaIndex, nav) {
    var media = slide && Array.isArray(slide.cbMedia) ? slide.cbMedia : [];
    var entry = media[mediaIndex];
    if (!entry || !entry.src) return;

    var previousIndex = Number.isFinite(slide.cbActiveMediaIndex)
      ? slide.cbActiveMediaIndex
      : 0;
    if (mediaIndex === previousIndex) return;

    var panzoom = slide.panzoomRef;
    var content = panzoom && panzoom.getContent ? panzoom.getContent() : null;
    var image = content && content.tagName === 'IMG'
      ? content
      : (slide.el && slide.el.querySelector('img.f-panzoom__content, .f-panzoom__content img, img'));
    if (!image || image.tagName !== 'IMG') return;

    var requestId = (slide.__cbArtworkViewRequestId || 0) + 1;
    slide.__cbArtworkViewRequestId = requestId;
    slide.cbActiveMediaIndex = mediaIndex;
    setArtworkViewSelection(nav, mediaIndex);
    setArtworkViewLoading(slide, nav, true);

    var preload = new Image();
    preload.decoding = 'async';

    preload.onload = function () {
      if (slide.__cbArtworkViewRequestId !== requestId) return;

      var applied = false;
      var finish = function () {
        if (applied || slide.__cbArtworkViewRequestId !== requestId) return;
        if (!image.naturalWidth || !image.naturalHeight) return;
        applied = true;
        slide.src = entry.src;
        slide.alt = entry.alt || slide.alt || '';
        image.alt = slide.alt;
        syncArtworkImageDimensions(fancybox, slide, image);
        setArtworkViewLoading(slide, nav, false);
      };
      var fail = function () {
        if (slide.__cbArtworkViewRequestId !== requestId) return;
        slide.cbActiveMediaIndex = previousIndex;
        setArtworkViewSelection(nav, previousIndex);
        setArtworkViewLoading(slide, nav, false);
      };

      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', fail, { once: true });
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = entry.src;

      if (image.complete && image.naturalWidth && image.naturalHeight) {
        requestAnimationFrame(finish);
      }
    };

    preload.onerror = function () {
      if (slide.__cbArtworkViewRequestId !== requestId) return;
      slide.cbActiveMediaIndex = previousIndex;
      setArtworkViewSelection(nav, previousIndex);
      setArtworkViewLoading(slide, nav, false);
    };

    preload.src = entry.src;
  }

  function artworkViewButton(fancybox, slide, entry, mediaIndex, cfg, type) {
    var specific = (cfg.classPrefixes && cfg.classPrefixes.specific) || 'collection-items';
    var labels = artworkViewOptions(cfg);
    var button = document.createElement('button');
    button.type = 'button';
    button.className = specific + '-view ' + specific + '-view--' + type;
    button.dataset.cbArtworkView = String(mediaIndex);
    button.setAttribute(
      'aria-label',
      (type === 'primary' ? labels.primaryLabel : labels.alternateLabel + ' ' + mediaIndex) +
        ' (' + (mediaIndex + 1) + '/' + slide.cbMedia.length + ')'
    );
    button.title = type === 'primary'
      ? labels.primaryLabel
      : labels.alternateLabel + ' ' + mediaIndex;

    var image = document.createElement('img');
    image.src = entry.thumb || entry.src;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    button.appendChild(image);

    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      switchArtworkView(fancybox, slide, mediaIndex, button.closest('[data-cb-artwork-views]'));
    });

    return button;
  }

  function renderArtworkViews(fancybox, cfg) {
    var options = artworkViewOptions(cfg);
    if (!options.enabled || !fancybox || !fancybox.getSlide) return;

    var slide = fancybox.getSlide();
    var media = slide && Array.isArray(slide.cbMedia) ? slide.cbMedia : [];
    if (!slide || !slide.captionEl || media.length < 2) return;

    var generic = (cfg.classPrefixes && cfg.classPrefixes.generic) || 'custom-fancybox';
    var specific = (cfg.classPrefixes && cfg.classPrefixes.specific) || 'collection-items';
    var caption = slide.captionEl.querySelector('.' + specific + '-caption') || slide.captionEl;
    var existing = caption.querySelector('[data-cb-artwork-views]');

    if (existing) {
      setArtworkViewSelection(existing, slide.cbActiveMediaIndex || 0);
      return;
    }

    var nav = document.createElement('nav');
    nav.className = generic + '-views ' + specific + '-views';
    nav.dataset.cbArtworkViews = 'true';
    nav.setAttribute('aria-label', options.groupLabel);

    var primaryGroup = document.createElement('div');
    primaryGroup.className = specific + '-views__group ' + specific + '-views__group--primary';
    primaryGroup.appendChild(artworkViewButton(fancybox, slide, media[0], 0, cfg, 'primary'));
    nav.appendChild(primaryGroup);

    var alternateGroup = document.createElement('div');
    alternateGroup.className = specific + '-views__group ' + specific + '-views__group--alternates';
    media.slice(1).forEach(function (entry, index) {
      alternateGroup.appendChild(
        artworkViewButton(fancybox, slide, entry, index + 1, cfg, 'alternate')
      );
    });
    nav.appendChild(alternateGroup);

    caption.appendChild(nav);
    setArtworkViewSelection(nav, slide.cbActiveMediaIndex || 0);
  }

  function scheduleArtworkViews(fancybox, cfg) {
    requestAnimationFrame(function () {
      renderArtworkViews(fancybox, cfg);
    });
  }

  function fancyboxOptions(startIndex, cfg) {
    var options = Object.assign({}, DEFAULT_FANCYBOX, cfg.fancybox || {});
    var generic = (cfg.classPrefixes && cfg.classPrefixes.generic) || 'custom-fancybox';
    var specific = (cfg.classPrefixes && cfg.classPrefixes.specific) || 'collection-items';

    return {
      theme: options.theme,
      mainClass: generic + '-container ' + specific + '-container',
      Hash: !!options.hash,
      compact: false,
      dragToClose: !!options.dragToClose,
      closeButton: !!options.closeButton,
      preload: options.preload,
      startIndex: startIndex,
      Carousel: {
        Navigation: true,
        infinite: !!options.infinite,
        Thumbs: {
          type: options.thumbsType,
          showOnStart: !!options.showThumbsOnStart
        },
        Toolbar: {
          display: options.toolbar
        }
      },
      on: {
        ready: function (fancybox) {
          var container = fancybox && fancybox.getContainer
            ? fancybox.getContainer()
            : fancybox && fancybox.container;
          if (!container) return;
          var carousel = container.querySelector('.fancybox__carousel');
          if (carousel) carousel.classList.add(generic + '-carousel', specific + '-carousel');
          scheduleArtworkViews(fancybox, cfg);
        },
        'Carousel.createSlide': function (_fancybox, _carousel, slide) {
          if (!slide || !slide.el) return;
          slide.el.classList.add(generic + '-slide', specific + '-slide');
        },
        'Carousel.contentReady': function (fancybox, _carousel, slide) {
          if (!slide || !slide.el) return;
          var image = slide.el.querySelector('img');
          if (image) image.classList.add(generic + '-image', specific + '-image');
          if (!fancybox.isCurrentSlide || fancybox.isCurrentSlide(slide)) {
            scheduleArtworkViews(fancybox, cfg);
          }
        },
        'Carousel.change': function (fancybox) {
          scheduleArtworkViews(fancybox, cfg);
        }
      }
    };
  }

  function mount(scope, cfg) {
    if (!scope || !cfg || !cfg.itemSelector) return null;
    if (controllers.has(scope)) {
      controllers.get(scope).refresh();
      return controllers.get(scope);
    }
    var originalLinks = new Map();
    function prepareLinks() {
      if (!cfg.linkMedia) return;
      scope.querySelectorAll(cfg.itemSelector).forEach(function (card) {
        var link = card.querySelector(cfg.triggerSelector || 'a');
        var media = parseCardMedia(card, cfg);
        if (!link || link.tagName !== 'A' || !media.length) return;
        if (!originalLinks.has(link)) originalLinks.set(link, {
          href: link.getAttribute('href'), role: link.getAttribute('role'),
          label: link.getAttribute('aria-label'), popup: link.getAttribute('aria-haspopup')
        });
        link.href = media[0].src;
        if (link.getAttribute('role') === 'presentation') link.removeAttribute('role');
        link.setAttribute('aria-haspopup', 'dialog');
        if (!link.getAttribute('aria-label')) {
          link.setAttribute('aria-label', media[0].alt || cfg.openLabel || 'Open image');
        }
      });
    }
    function open(card) {
      if (!window.Fancybox) return null;
      var collection = collectFancyboxSlides(scope, cfg);
      var index = collection.starts.get(card);
      if (!collection.slides.length || index === undefined) return null;
      var options = fancyboxOptions(index, cfg);
      options.triggerEl = card.querySelector(cfg.triggerSelector || 'a') || card;
      var instance = window.Fancybox.show(collection.slides, options);
      if (typeof cfg.onOpen === 'function') cfg.onOpen(instance, card);
      return instance;
    }
    function click(event) {
      if (!window.Fancybox || event.metaKey || event.ctrlKey || event.shiftKey ||
          event.altKey || event.button > 0) return;
      var target = event.target.closest && event.target.closest(cfg.triggerSelector || cfg.itemSelector);
      if (!target || !scope.contains(target)) return;
      var card = target.closest(cfg.itemSelector);
      if (!card || !scope.contains(card) || !parseCardMedia(card, cfg).length) return;
      event.preventDefault();
      event.stopPropagation();
      open(card);
    }
    scope.addEventListener('click', click, true);
    var controller = {
      open: open,
      refresh: prepareLinks,
      destroy: function () {
        scope.removeEventListener('click', click, true);
        originalLinks.forEach(function (values, link) {
          [['href', values.href], ['role', values.role],
            ['aria-label', values.label], ['aria-haspopup', values.popup]].forEach(function (pair) {
            if (pair[1] === null) link.removeAttribute(pair[0]);
            else link.setAttribute(pair[0], pair[1]);
          });
        });
        originalLinks.clear();
        controllers.delete(scope);
      }
    };
    controllers.set(scope, controller);
    prepareLinks();
    return controller;
  }
  function refresh() {
    controllers.forEach(function (controller, scope) {
      if (!scope.isConnected) controller.destroy();
    });
    array(window.CB_FANCYBOX_CONFIGS).forEach(function (cfg) {
      scopesFor(cfg.targets).forEach(function (scope) { mount(scope, cfg); });
    });
  }
  window.CollectionBlocksFancybox = { version: '1.1.0', mount: mount, refresh: refresh };
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
