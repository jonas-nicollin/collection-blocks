/* Collection Blocks — Gallery Block. Optional native collection gallery adapter. */
(function () {
  'use strict';
  if (window.GalleryBlock) return;
  var controllers = new Map();
  function editing() {
    return [document.documentElement, document.body].some(function (node) {
      return node && ['sqs-edit-mode-active', 'squarespace-edit-mode-active']
        .some(function (name) { return node.classList.contains(name); });
    });
  }
  function mount(root, cfg) {
    if (controllers.has(root)) return controllers.get(root);
    var classes = ['cb-block', 'glb-block', 'cb-gallery', 'glb-gallery'];
    var itemSelector = cfg.itemSelector || '.slide';
    var items = Array.from(root.querySelectorAll(itemSelector));
    if (!items.length) return null;
    if (cfg.layout && cfg.layout !== 'native') {
      classes.push('cb-gallery--' + cfg.layout, 'glb-gallery--' + cfg.layout);
    }
    if (cfg.layout === 'rows') {
      var columns = Array.from(root.querySelectorAll(':scope > .col'));
      if (!columns.length || items.length > (cfg.maxImages || 12) ||
          !columns.every(function (col) {
            var blocks = Array.from(col.querySelectorAll('.sqs-block'));
            return blocks.length && blocks.every(function (block) {
              return block.matches('.image-block, .spacer-block');
            });
          })) return null;
      classes.push('images-row', 'images-row-count-' + items.length);
    }
    root.classList.add.apply(root.classList, classes);
    root.style.setProperty('--gallery-count', items.length);
    items.forEach(function (item, index) {
      item.classList.add('cb-gallery__item', 'glb-gallery__item');
      if (index === items.length - 1) {
        item.classList.add('cb-gallery__item--last', 'glb-gallery__item--last');
        if (cfg.legacyLastSlide) item.classList.add('last-slide');
      }
    });
    var viewer = null;
    if (cfg.fancybox && window.CollectionBlocksFancybox) {
      viewer = window.CollectionBlocksFancybox.mount(root, Object.assign({
        itemSelector: itemSelector, triggerSelector: 'a', linkMedia: true,
        selectors: {image: 'img'}, blockPrefix: 'glb'
      }, cfg.fancybox === true ? {} : cfg.fancybox));
    }
    var compact = null;
    if (cfg.layout === 'compact') compact = mountCompact(root, items, cfg,
      !!viewer && !!window.Fancybox && typeof window.Fancybox.show === 'function');
    var controller = {
      destroy: function () {
        if (compact) compact();
        if (viewer) viewer.destroy();
        root.classList.remove.apply(root.classList, classes);
        root.style.removeProperty('--gallery-count');
        items.forEach(function (item) {
          item.classList.remove('cb-gallery__item', 'glb-gallery__item',
            'cb-gallery__item--last', 'glb-gallery__item--last');
          if (cfg.legacyLastSlide) item.classList.remove('last-slide');
        });
        controllers.delete(root);
      }
    };
    controllers.set(root, controller);
    return controller;
  }
  function mountCompact(root, items, cfg, canExpand) {
    const grid = items[0].parentElement;
    // Adapt only one flat native gallery; leave other structures untouched.
    if (!items.every(item => item.parentElement === grid)) return null;
    const limit = Math.max(1, Math.floor(Number(cfg.visibleItems) || 8));
    // The image viewer must cover every item before any previews are concealed.
    canExpand = canExpand && items.every(item => item.querySelector('a.image-slide-anchor'));
    grid.classList.add('cb-gallery__grid', 'glb-gallery__grid');
    const managed = [];
    function mark(node, name) {
      if (!node) return;
      node.classList.add('cb-gallery__' + name, 'glb-gallery__' + name);
      managed.push([node, name]);
    }
    items.forEach(function (item, index) {
      mark(item.querySelector('.margin-wrapper'), 'frame');
      mark(item.querySelector('a.image-slide-anchor'), 'link');
      mark(item.querySelector('.content-wrapper'), 'media');
      mark(item.querySelector('.content-wrapper.content-fill .sqs-video-wrapper'), 'media');
      // Never conceal media when there is no working viewer to reveal it.
      if (canExpand && index >= limit) mark(item, 'item--overflow');
    });
    var more = null, lastLink = null, oldLabel = null;
    if (canExpand && items.length > limit) {
      lastLink = items[limit - 1].querySelector('a.image-slide-anchor');
      if (lastLink) {
        more = document.createElement('span');
        more.className = 'cb-gallery__more glb-gallery__more';
        more.setAttribute('aria-hidden', 'true');
        more.textContent = cfg.moreIcon || 'open_in_full';
        oldLabel = lastLink.getAttribute('aria-label');
        lastLink.setAttribute('aria-label', (cfg.moreLabel || 'View all images') +
          ' (' + items.length + ')');
        lastLink.append(more);
      }
    }
    return function () {
      grid.classList.remove('cb-gallery__grid', 'glb-gallery__grid');
      managed.forEach(function (entry) {
        entry[0].classList.remove('cb-gallery__' + entry[1], 'glb-gallery__' + entry[1]);
      });
      if (more) more.remove();
      if (lastLink) {
        if (oldLabel === null) lastLink.removeAttribute('aria-label');
        else lastLink.setAttribute('aria-label', oldLabel);
      }
    };
  }
  function refresh() {
    controllers.forEach(function (controller, root) {
      if (!root.isConnected || editing()) controller.destroy();
    });
    if (editing()) return;
    (window.GALLERY_BLOCK_CONFIGS || []).forEach(function (cfg) {
      if (!(cfg.bodyClassConditions || []).every(function (name) {
        return document.body.classList.contains(name);
      })) return;
      document.querySelectorAll(cfg.target).forEach(function (root) { mount(root, cfg); });
    });
  }
  var wasEditing = editing();
  var observer = new MutationObserver(function () {
    var value = editing();
    if (value === wasEditing) return;
    wasEditing = value;
    refresh();
  });
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  if (document.body) observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
  document.addEventListener('DOMContentLoaded', refresh);
  document.addEventListener('mercury:load', refresh);
  document.addEventListener('blogBannerReady', refresh);
  window.addEventListener('page:loaded', refresh);
  window.addEventListener('site:refresh', refresh);
  window.addEventListener('load', refresh);
  window.GalleryBlock = {mount: mount, refresh: refresh};
  if (document.readyState !== 'loading') refresh();
})();
