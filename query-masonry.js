
(function () {
  'use strict';

  var SNAP_RATIOS = [1/1, 2/3, 3/2, 3/4, 4/3, 4/5, 5/4, 16/9, 9/16];
  var DEFAULT_MASONRY_OPTIONS = {
    columns: { default: 3, tablet: 2, mobile: 1 },
    breakpoints: { tablet: 768, mobile: 480 },
    snapRatios: false
  };

  function getMasonryOptions() {
    return Object.assign({}, DEFAULT_MASONRY_OPTIONS, window.QUERY_MASONRY_OPTIONS || {});
  }

  function getCSSValue(el, varName, fallbackPx) {
    var raw = getComputedStyle(el).getPropertyValue(varName).trim();
    if (!raw && varName.indexOf('--qb-') === 0) {
      raw = getComputedStyle(el).getPropertyValue(varName.replace('--qb-', '--sqb-')).trim();
    }
    if (!raw) return fallbackPx;
    if (raw.endsWith('rem')) return parseFloat(raw) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    return parseFloat(raw) || fallbackPx;
  }

  function getColumnCount(options) {
    var width = window.innerWidth;
    if (width <= options.breakpoints.mobile) return options.columns.mobile;
    if (width <= options.breakpoints.tablet) return options.columns.tablet;
    return options.columns.default;
  }

  function applySnapToImg(img) {
    if (!getMasonryOptions().snapRatios) return;

    var wrap = img.closest ? img.closest('.qb-card__img-wrap') : img.parentNode;
    if (!wrap || !img.naturalWidth || !img.naturalHeight) return;

    var ratio = img.naturalWidth / img.naturalHeight;
    var best = SNAP_RATIOS[0];
    var minDiff = Infinity;

    SNAP_RATIOS.forEach(function(snapRatio) {
      var diff = Math.abs(ratio - snapRatio);
      if (diff < minDiff) {
        minDiff = diff;
        best = snapRatio;
      }
    });

    wrap.style.aspectRatio = best.toFixed(6);
  }

  function computeMasonryLayout(grid, startFrom) {
    var options = getMasonryOptions();
    var columns = getColumnCount(options);
    var gap = getCSSValue(grid, '--qb-masonry-gap', 48);
    var cards = Array.from(grid.querySelectorAll(':scope > .qb-card'));
    if (!cards.length) return;

    grid.style.position = 'relative';

    var gridWidth = grid.offsetWidth;
    var columnWidth = (gridWidth - gap * (columns - 1)) / columns;

    cards.forEach(function(card) {
      card.style.width = columnWidth + 'px';
    });

    var offsets = [];
    for (var i = 0; i < columns; i++) {
      offsets[i] = getCSSValue(grid, '--qb-masonry-offset-' + i, 0);
    }

    var heights = offsets.slice(0, columns).map(Number);

    if (startFrom > 0) {
      for (var j = 0; j < startFrom && j < cards.length; j++) {
        var previousCard = cards[j];
        var top = parseFloat(previousCard.style.top) || 0;
        var left = parseFloat(previousCard.style.left) || 0;
        var columnIndex = Math.round(left / (columnWidth + gap));
        if (columnIndex >= 0 && columnIndex < columns) {
          heights[columnIndex] = Math.max(heights[columnIndex], top + previousCard.offsetHeight + gap);
        }
      }
    }

    var cardsToPlace = startFrom > 0 ? cards.slice(startFrom) : cards;
    var forceSequentialFirstRow = startFrom === 0 && cards.length <= columns;

    cardsToPlace.forEach(function(card, placeIndex) {
      var columnIndex;

      if (forceSequentialFirstRow) {
        columnIndex = placeIndex;
      } else {
        var minHeight = Math.min.apply(null, heights);
        columnIndex = heights.indexOf(minHeight);
      }

      card.style.position = 'absolute';
      card.style.left = (columnIndex * (columnWidth + gap)) + 'px';
      card.style.top = (forceSequentialFirstRow ? 0 : heights[columnIndex]) + 'px';
      card.style.margin = '0';

      heights[columnIndex] = (forceSequentialFirstRow ? 0 : heights[columnIndex]) + card.offsetHeight + gap;
    });

    var maxHeight = Math.max.apply(null, heights);
    grid.style.height = (maxHeight > 0 ? maxHeight - gap : 0) + 'px';
  }

  function waitForImages(cards, callback) {
    var imgs = [];

    cards.forEach(function(card) {
      imgs = imgs.concat(Array.from(card.querySelectorAll('img')));
    });

    function ready() {
      requestAnimationFrame(function() {
        requestAnimationFrame(callback);
      });
    }

    if (!imgs.length) {
      ready();
      return;
    }

    var done = 0;
    var timeout = setTimeout(ready, 3000);

    function finish() {
      done++;
      if (done >= imgs.length) {
        clearTimeout(timeout);
        ready();
      }
    }

    imgs.forEach(function(img) {
      if (img.complete && img.naturalHeight > 0) {
        applySnapToImg(img);
        finish();
        return;
      }

      img.addEventListener('load', function() {
        applySnapToImg(img);
        finish();
      }, { once: true });

      img.addEventListener('error', finish, { once: true });
    });
  }

  window.CollectionBlocksMasonry = function(grid, items, cfg, hookOptions) {
    if (!items.length) return;

    var fromPagination = hookOptions && hookOptions.fromPagination;
    var previousCount = fromPagination && hookOptions && hookOptions.prevCount ? hookOptions.prevCount : 0;
    var allCards = Array.from(grid.querySelectorAll(':scope > .qb-card'));

    if (allCards.length < items.length) {
      grid.__cbMasonryWaitCount = (grid.__cbMasonryWaitCount || 0) + 1;
      if (grid.__cbMasonryWaitCount < 40) {
        window.setTimeout(function() {
          window.CollectionBlocksMasonry(grid, items, cfg, hookOptions);
        }, 50);
        return;
      }
    }

    grid.__cbMasonryWaitCount = 0;

    var newCards = previousCount > 0 ? allCards.slice(previousCount) : allCards;
    var cardsToWait = newCards.length ? newCards : allCards;

    var options = getMasonryOptions();
    var columns = getColumnCount(options);
    var gap = getCSSValue(grid, '--qb-masonry-gap', 48);
    var columnWidth = (grid.offsetWidth - gap * (columns - 1)) / columns;

    grid.style.position = 'relative';

    if (!fromPagination) {
      allCards.forEach(function(card) {
        card.style.width = columnWidth + 'px';
        card.style.position = 'absolute';
        card.style.top = '0';
        card.style.left = '0';
      });
    } else {
      newCards.forEach(function(card) {
        card.style.width = columnWidth + 'px';
      });
    }

    computeMasonryLayout(grid, previousCount);

    waitForImages(cardsToWait, function() {
      computeMasonryLayout(grid, previousCount);
    });
  };

  window.addEventListener('resize', function() {
    cancelAnimationFrame(window.__cbQueryMasonryRaf);
    window.__cbQueryMasonryRaf = requestAnimationFrame(function() {
      document.querySelectorAll('.qb-masonry-block .qb-grid').forEach(function(grid) {
        computeMasonryLayout(grid, 0);
      });
    });
  });

})();
