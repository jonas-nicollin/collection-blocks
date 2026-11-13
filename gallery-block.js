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
    var controller = {
      destroy: function () {
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
