/**
 * TOC Block — 2.0.0 (2026-11-26)
 * Configure window.TOC_BLOCK_CONFIGS before loading this file.
 * One TOC per page; the first matching configuration wins.
 * Common cb-* classes and tocb-* aliases; style: "underline-wipe" is optional.
 * layout: auto/contained/full-width/custom; insertAfterSelector is optional.
 * scrollOffset: auto or a minimum CSS/numeric offset; scrollGap defaults to .75rem.
 * headerSelector defaults to #header; scrollHandler may integrate a scroll engine.
 * minItems defaults to 1; fewer section links leave only Back (if enabled).
 * sectionSelector defaults to section; section ends also respect following heading levels.
 * customClassPrefix adds <prefix>--<component-class> to every TOC element.
 * backLink.mobileMode: "compact" (default) or "stacked".
 * Generic options: contentSelector, selectors, targetContainerSelector,
 * observeChanges (default true), anchorKeyAttribute (optional), ariaLabel.
 * API: window.CollectionBlocksTOC.refresh() / destroy().
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (window.CollectionBlocksTOC) {
    (window.CollectionBlocksTOC).refresh();
    return;
  }

  const TOC = ".tocb-block";
  let instance = null;
  let frame = 0;
  let stopped = false;
  let lifecycleObserver;
  let bodyObserver;

  function matchingConfig() {
    if (!document.body || document.querySelector(".sqs-edit-mode-active, .squarespace-edit-mode-active")) return null;
    const raw = window.TOC_BLOCK_CONFIGS;
    return (Array.isArray(raw) ? raw : [raw]).find(cfg =>
      cfg && cfg.enabled !== false &&
      (cfg.requiredBodyClasses || []).every(cls => document.body.classList.contains(cls))
    ) || null;
  }

  function query(root, selector, all) {
    try {
      return all ? Array.from(root.querySelectorAll(selector)) : root.querySelector(selector);
    } catch (error) {
      console.warn("[TOC Block] Invalid selector:", selector);
      return all ? [] : null;
    }
  }

  function schedule() {
    if (stopped || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }

  function refresh() {
    if (stopped || !document.body) return;
    const config = matchingConfig();
    const content = config && query(document, config.contentSelector || ".blog-item-content");
    const target = config && query(document, config.targetContainerSelector || ".blog-item-top-wrapper");
    if (instance && (instance.config !== config || instance.content !== content ||
        instance.target !== target || !instance.nav.isConnected)) {
      instance.destroy();
      instance = null;
    }
    if (!config || !content || !target) return;
    // Never take over a TOC produced by another script version.
    if (!instance && document.querySelector(TOC)) return;
    if (!instance) instance = createTOC(config, content, target);
    instance.sync();
  }

  function createTOC(config, content, target) {
    const requestedPrefix = typeof config.customClassPrefix === "string" ? config.customClassPrefix.trim() : "";
    const prefix = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(requestedPrefix) ? requestedPrefix : "";
    if (requestedPrefix && !prefix) console.warn("[TOC Block] Ignoring invalid customClassPrefix; use a single CSS identifier.");
    function element(tag, part) {
      const node = document.createElement(tag);
      const common = 'cb-toc' + (part ? '__' + part : '');
      const alias = 'tocb-toc' + (part ? '__' + part : '');
      node.className = [common, alias, !part ? 'cb-block tocb-block' : '',
        prefix ? prefix + '--' + alias : ''].filter(Boolean).join(' ');
      return node;
    }
    function state(node, legacy, active) {
      const base = Array.from(node.classList).find(name =>
        name.startsWith('cb-toc') && !name.includes('--'));
      const suffix = legacy.replace(/^(is-|has-)/, '');
      [base + '--' + suffix, base.replace(/^cb-/, 'tocb-') + '--' + suffix]
        .forEach(name => {
          if (node.classList.contains(name) !== active) node.classList.toggle(name, active);
        });
    }
    const nav = element("nav", "");
    nav.dataset.tocbVersion = "2.0.0";
    if (config.style === "underline-wipe") nav.dataset.tocStyle = config.style;
    if (config.key) nav.dataset.cbKey = config.key;
    nav.setAttribute("aria-label", config.ariaLabel || "Table of contents");
    state(nav, "is-sticky", !!config.sticky);
    nav.hidden = true;
    const layout = config.layout || "auto";
    nav.dataset.tocLayout = layout === "auto"
      ? (target.matches(".entry") ? "contained" : target.matches(".blog-item-wrapper") ? "full-width" : "custom")
      : layout;
    const inner = element("div", "inner");
    const viewport = element("div", "viewport");
    const list = element("div", "list");
    viewport.appendChild(list);
    inner.appendChild(viewport);
    nav.appendChild(inner);

    let back = null;
    if (config.backLink?.enabled && config.backLink.url) {
      back = element("a", "back");
      back.href = config.backLink.url;
      const labelText = config.backLink.label || "Back";
      back.setAttribute("aria-label", config.backLink.ariaLabel || labelText);
      back.title = labelText;
      const icon = element("span", "back-icon");
      icon.setAttribute("aria-hidden", "true");
      // Draw the default chevron in CSS: no icon font is required.
      const chevron = !config.backLink.icon || config.backLink.icon === "chevron_backward";
      state(icon, "is-chevron", chevron);
      if (!chevron) icon.textContent = config.backLink.icon;
      const label = element("span", "back-label");
      label.textContent = labelText;
      back.append(icon, label);
      inner.prepend(back);
      state(nav, "has-back-link", true);
      state(nav, "is-back-stacked", config.backLink.mobileMode === "stacked");
    }

    function placeNav(initial = false) {
      if (!initial && !config.insertAfterSelector) return;
      const anchor = config.insertAfterSelector && query(target, config.insertAfterSelector);
      // A placement anchor must be a direct child; never move Squarespace content.
      if (anchor && anchor.parentElement === target && anchor !== nav) {
        if (anchor.nextElementSibling !== nav) anchor.after(nav);
        return;
      }
      const pos = config.insertPosition;
      const children = Array.from(target.children).filter(child => child !== nav);
      const index = pos === "prepend" ? 0 : typeof pos === "number" && Number.isFinite(pos)
        ? Math.max(0, Math.min(Math.trunc(pos), children.length)) : children.length;
      const before = children[index] || null;
      if (nav.parentElement !== target || nav.nextElementSibling !== before) target.insertBefore(nav, before);
    }
    placeNav(true);

    const sharedNames = ["--toc-height", "--toc-bottom", "--toc-scroll-offset", "--toc-header-bottom"];
    const sharedStyle = document.documentElement.style;
    const previousVariables = new Map(sharedNames.map(name => [name, [sharedStyle.getPropertyValue(name), sharedStyle.getPropertyPriority(name)]]));
    const probe = element("span", "offset-probe");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;";
    nav.appendChild(probe);
    const rememberedIds = new Map();
    let records = [];
    let boundaryHeadings = [];
    let contentObserver;
    let resizeObserver;
    let activeFrame = 0;
    let destroyed = false;
    let hashHandled = false;
    let header = null;
    let targetObserver;
    let effectiveOffset = 0;
    let safeOffset = 0;
    let lastActiveLink = null;
    let lastViewportWidth = -1;

    function publish(name, value) {
      const css = Math.round(value * 100) / 100 + "px";
      if (sharedStyle.getPropertyValue(name) !== css) sharedStyle.setProperty(name, css);
    }

    function cssPixels(value) {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      if (!value || value === "auto") return 0;
      const cssValue = /^-?\d+(\.\d+)?$/.test(String(value).trim()) ? value + "px" : String(value);
      probe.style.scrollMarginTop = "0px";
      probe.style.scrollMarginTop = cssValue;
      return parseFloat(getComputedStyle(probe).scrollMarginTop) || 0;
    }

    function updateGeometry() {
      const currentHeader = config.headerSelector === false ? null : query(document, config.headerSelector || "#header");
      if (currentHeader !== header) {
        if (header) resizeObserver?.unobserve(header);
        header = currentHeader;
        if (header) resizeObserver?.observe(header);
      }
      let headerBottom = !header && config.headerSelector !== false && config.sticky ? cssPixels("var(--header-height, 0px)") : 0;
      if (header && isVisible(header)) {
        const style = getComputedStyle(header);
        if (style.position === "fixed" || style.position === "sticky") headerBottom = Math.max(0, header.getBoundingClientRect().bottom);
      }
      publish("--toc-header-bottom", headerBottom);
      const height = nav.hidden ? 0 : nav.getBoundingClientRect().height;
      const style = getComputedStyle(nav);
      // Predict the pinned position even when the TOC is still below the fold.
      const bottom = nav.hidden ? 0 : style.position === "sticky"
        ? Math.max(0, parseFloat(style.top) || 0) + height
        : style.position === "fixed" ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
      const obstruction = Math.max(headerBottom, bottom);
      safeOffset = obstruction ? obstruction + cssPixels(config.scrollGap ?? ".75rem") : 0;
      effectiveOffset = Math.max(0, cssPixels(config.scrollOffset), safeOffset);
      publish("--toc-height", height);
      publish("--toc-bottom", bottom);
      publish("--toc-scroll-offset", effectiveOffset);
    }

    function updateLayout() {
      const side = back ? back.getBoundingClientRect().width : 0;
      const sideValue = Math.ceil(side) + "px";
      if (inner.style.getPropertyValue("--toc-side-space") !== sideValue) inner.style.setProperty("--toc-side-space", sideValue);
      const style = getComputedStyle(inner);
      const available = inner.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      const listStyle = getComputedStyle(list);
      const count = list.children.length;
      const naturalWidth = Array.from(list.children).reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
        + Math.max(0, count - 1) * (parseFloat(listStyle.columnGap) || 0)
        + (parseFloat(listStyle.paddingLeft) || 0) + (parseFloat(listStyle.paddingRight) || 0);
      const overflow = naturalWidth > available - 2 * (side + (parseFloat(style.columnGap) || 0)) + 1;
      state(nav, "is-overflowing", overflow);
    }

    function isVisible(heading) {
      return heading.getClientRects().length > 0 &&
        getComputedStyle(heading).visibility !== "hidden" &&
        !heading.closest('[hidden], [aria-hidden="true"]');
    }

    function revealLink(link) {
      if (!link || viewport.clientWidth === 0) return;
      const bounds = viewport.getBoundingClientRect();
      const item = link.getBoundingClientRect();
      const inset = 4; // Also leaves room for the keyboard focus outline.
      const left = bounds.left + viewport.clientLeft + inset;
      const right = bounds.left + viewport.clientLeft + viewport.clientWidth - inset;
      const rtl = getComputedStyle(viewport).direction === "rtl";
      let delta = 0;
      if (item.width > right - left) delta = rtl ? item.right - right : item.left - left;
      else if (item.left < left) delta = item.left - left;
      else if (item.right > right) delta = item.right - right;
      // Only the horizontal viewport moves; never scrollIntoView on the page.
      if (Math.abs(delta) > 1) viewport.scrollBy({ left: delta, behavior: "instant" });
    }

    function onFocus(event) {
      const link = event.target.closest("a");
      if (link && list.contains(link)) revealLink(link);
    }

    function updateActive() {
      if (destroyed) return;
      updateLayout();
      updateGeometry();
      const value = Number(config.activeZoneTop ?? 0.3);
      const zone = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.3;
      const threshold = Math.max(window.innerHeight * zone, safeOffset);
      let active = null;
      if (!viewport.hidden) records.forEach(record => {
        if (isVisible(record.heading) && record.heading.getBoundingClientRect().top <= threshold) active = record;
      });
      if (active) {
        let end = active.section.getBoundingClientRect().bottom;
        // display:contents and zero-height wrappers cannot define a visual boundary.
        if (!active.section.getClientRects().length || active.section.getBoundingClientRect().height <= 0) end = content.getBoundingClientRect().bottom;
        for (const heading of active.endHeadings) {
          if (isVisible(heading)) { end = Math.min(end, heading.getBoundingClientRect().top); break; }
        }
        if (end <= threshold) active = null;
      }
      records.forEach(record => {
        const selected = record === active;
        state(record.link, "is-active", selected);
        if (selected) {
          if (record.link.getAttribute("aria-current") !== "location") record.link.setAttribute("aria-current", "location");
        } else if (record.link.hasAttribute("aria-current")) record.link.removeAttribute("aria-current");
      });
      const activeLink = active?.link || null;
      const width = viewport.clientWidth;
      if (activeLink !== lastActiveLink || width !== lastViewportWidth) revealLink(activeLink);
      lastActiveLink = activeLink;
      lastViewportWidth = width;
    }

    function scheduleActive() {
      if (destroyed || activeFrame) return;
      activeFrame = requestAnimationFrame(() => { activeFrame = 0; updateActive(); });
    }

    function scrollToHeading(heading, behavior) {
      if (!heading.isConnected) return;
      updateGeometry();
      const top = Math.max(0, heading.getBoundingClientRect().top + window.scrollY - effectiveOffset);
      if (typeof config.scrollHandler === "function") config.scrollHandler({ top, behavior, heading });
      else window.scrollTo({ top, behavior });
    }

    function onClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest("a");
      const record = records.find(item => item.link === link);
      if (!record) return;
      event.preventDefault();
      // Some delegated scroll engines ignore defaultPrevented (e.g. Lenis anchors).
      // This component owns its links; modified clicks and the back link remain native.
      event.stopPropagation();
      scrollToHeading(record.heading, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth");
    }

    function identity(heading, text, counts) {
      const attribute = config.anchorKeyAttribute;
      const explicit = attribute && heading.getAttribute(attribute);
      let owner = heading.parentElement;
      while (owner && owner !== content && !owner.id) owner = owner.parentElement;
      // Stable enclosing IDs also survive replacement of a generated heading.
      // With no such ID, use its text. An optional explicit key resolves ambiguity.
      const base = JSON.stringify(explicit ? ["key", explicit] :
        owner && owner !== content && owner.id ? ["owner", owner.id, heading.tagName] :
          ["text", heading.tagName, text]);
      const occurrence = counts.get(base) || 0;
      counts.set(base, occurrence + 1);
      return base + ":" + occurrence;
    }

    function ensureId(heading, text, index, key) {
      if (heading.id) {
        rememberedIds.set(key, heading.id);
        return heading.id;
      }
      // Keep the historical shape (About_0 etc.) on the initial scan.
      const base = rememberedIds.get(key) ||
        (text.replace(/\s+/g, "_").replace(/[^\w-]/g, "") || "toc-heading") + "_" + index;
      let id = base;
      let suffix = 2;
      while (document.getElementById(id)) id = base + "-" + suffix++;
      heading.id = id;
      rememberedIds.set(key, id);
      return id;
    }

    function sync() {
      if (destroyed) return;
      placeNav();
      const candidates = query(content, config.selectors || ".blog-anchor-title, .html-block h3", true)
        .filter(h => !h.closest(TOC) && h.textContent.trim());
      // Include unlisted headings as boundaries without adding them to the menu.
      boundaryHeadings = Array.from(new Set([...query(content, "h1, h2, h3, h4, h5, h6", true), ...candidates]))
        .filter(heading => !heading.closest(TOC))
        .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      const selectedHeadings = new Set(candidates);
      const counts = new Map();
      const oldByHeading = new Map(records.map(record => [record.heading, record]));
      // querySelectorAll supplies document order and deduplicates overlapping selectors.
      const next = candidates.map((heading, index) => {
        const text = heading.textContent.trim();
        const key = identity(heading, text, counts);
        const id = ensureId(heading, text, index, key);
        const old = oldByHeading.get(heading);
        const link = old?.link || element("a", "link");
        const label = old?.label || element("span", "label");
        if (!old) link.appendChild(label);
        const href = "#" + encodeURIComponent(id);
        if (link.getAttribute("href") !== href) link.setAttribute("href", href);
        if (label.textContent !== text) label.textContent = text;
        let section = content;
        if (config.sectionSelector !== false) {
          try {
            const closest = heading.parentElement?.closest(config.sectionSelector || "section");
            if (closest && content.contains(closest)) section = closest;
          } catch (_) { /* Invalid optional boundary: use the content root. */ }
        }
        const level = /^H[1-6]$/.test(heading.tagName) ? Number(heading.tagName[1]) : 6;
        const endHeadings = boundaryHeadings.slice(boundaryHeadings.indexOf(heading) + 1)
          .filter(next => selectedHeadings.has(next) || Number(next.tagName[1]) <= level);
        return { heading, link, label, id, section, endHeadings };
      });
      const keep = new Set(next.map(record => record.link));
      records.forEach(record => { if (!keep.has(record.link)) record.link.remove(); });
      let cursor = list.firstChild;
      next.forEach(({ link }) => {
        if (link !== cursor) list.insertBefore(link, cursor);
        cursor = link.nextSibling;
      });
      records = next;
      const requestedMinimum = Number(config.minItems ?? 1);
      const minimum = Number.isFinite(requestedMinimum) ? Math.max(1, Math.floor(requestedMinimum)) : 1;
      const hideSections = records.length < minimum;
      if (viewport.hidden !== hideSections) viewport.hidden = hideSections;
      state(nav, "is-back-only", !!back && hideSections);
      const hidden = !back && hideSections;
      if (nav.hidden !== hidden) nav.hidden = hidden;
      updateActive();
      if (!hashHandled && location.hash) {
        let hash;
        try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) { hash = ""; }
        const match = records.find(record => record.id === hash);
        if (match) {
          hashHandled = true;
          scrollToHeading(match.heading, "instant");
          scheduleActive();
        }
      }
    }

    function outsideTOC(node) {
      const element = node.nodeType === 1 ? node : node.parentElement;
      return element && !element.closest(TOC);
    }

    if (config.observeChanges !== false && "MutationObserver" in window) {
      contentObserver = new MutationObserver(mutations => {
        if (mutations.some(mutation => outsideTOC(mutation.target))) schedule();
      });
      contentObserver.observe(content, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["id", "class", "hidden", "aria-hidden"].concat(config.anchorKeyAttribute ? [config.anchorKeyAttribute] : [])
      });
    }
    if (config.insertAfterSelector && "MutationObserver" in window) {
      targetObserver = new MutationObserver(schedule);
      targetObserver.observe(target, { childList: true });
    }
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(scheduleActive);
      resizeObserver.observe(content);
      resizeObserver.observe(nav);
      resizeObserver.observe(viewport);
      resizeObserver.observe(inner);
      resizeObserver.observe(list);
      if (back) resizeObserver.observe(back);
    }
    list.addEventListener("click", onClick);
    list.addEventListener("focusin", onFocus);
    window.addEventListener("scroll", scheduleActive, { passive: true });
    window.addEventListener("resize", schedule);
    // Image loads and collapsible content can change positions without scrolling.
    content.addEventListener("load", scheduleActive, true);
    content.addEventListener("transitionend", scheduleActive);
    document.fonts?.ready.then(scheduleActive);
    document.addEventListener("blogBannerReady", schedule);

    return {
      config, content, target, nav, sync,
      destroy() {
        destroyed = true;
        contentObserver?.disconnect();
        targetObserver?.disconnect();
        resizeObserver?.disconnect();
        cancelAnimationFrame(activeFrame);
        list.removeEventListener("click", onClick);
        list.removeEventListener("focusin", onFocus);
        window.removeEventListener("scroll", scheduleActive);
        window.removeEventListener("resize", schedule);
        content.removeEventListener("load", scheduleActive, true);
        content.removeEventListener("transitionend", scheduleActive);
        document.removeEventListener("blogBannerReady", schedule);
        nav.remove();
            previousVariables.forEach(([value, priority], name) => {
          if (value) sharedStyle.setProperty(name, value, priority);
          else sharedStyle.removeProperty(name);
        });
        // Heading IDs intentionally remain: existing URLs must keep working.
      }
    };
  }

  function start() {
    if (stopped || !document.body) return;
    refresh();
    if ("MutationObserver" in window && !lifecycleObserver) {
      // This lightweight guard only checks connectivity. Heading scans stay scoped.
      lifecycleObserver = new MutationObserver(() => {
        if (!instance || !instance.content.isConnected || !instance.target.isConnected || !instance.nav.isConnected) schedule();
      });
      lifecycleObserver.observe(document.body, { childList: true, subtree: true });
      bodyObserver = new MutationObserver(schedule);
      bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }

  window.CollectionBlocksTOC = {
    version: "2.0.0",
    refresh,
    destroy() {
      stopped = true;
      cancelAnimationFrame(frame);
      lifecycleObserver?.disconnect();
      bodyObserver?.disconnect();
      instance?.destroy();
      instance = null;
      document.removeEventListener("DOMContentLoaded", start);
      document.removeEventListener("mercury:load", schedule);
      window.removeEventListener("pageshow", schedule);
      delete window.CollectionBlocksTOC;
    }
  };
  document.addEventListener("mercury:load", schedule);
  window.addEventListener("pageshow", schedule);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
