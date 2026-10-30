# Collection Blocks

Collection Blocks is a small set of Squarespace scripts for rendering collection JSON as query lists, related content, maps, and local metadata blocks.

## Files

Load the files in this order when several blocks are used on the same page.

| File | Required for | Role |
| --- | --- | --- |
| `collection-blocks.js` | Query, Related, Locator | Shared fetch/cache helpers, formatting helpers, images, card helpers. |
| `collection-blocks.css` | Query, Related, Locator | Shared and block-specific CSS for `cb-*`, `qb-*`, `rb-*`, `lb-*`. |
| `query-block.js` | Query Block | Filters, tabs, search, pagination, infinite scroll, grouped rendering. |
| `related-block.js` | Related Block | Current item detection, matching, scoring, fallback, next item rules. |
| `locator-block.js` | Locator Block | Google Maps, markers, map/list interaction, zone filters. |
| `location-block.js` | Location Block | Current-item location card rendering. |
| `metadata-block.js` | Metadata Block | Independent page/item metadata from the current Squarespace JSON. |

The repository contains only shared stable runtimes. Site-specific
configuration, targets, styles, and helper scripts belong in Squarespace Code
Injection or Squarespace Custom CSS. Collection Data source manifests belong
in the Collection Data project.

## Repository Layout

The stable files remain at the repository root so their jsDelivr URLs do not
change:

```txt
collection-blocks.js
collection-blocks.css
query-block.js
related-block.js
locator-block.js
location-block.js
metadata-block.js
README.md
```

## Configuration Globals

| Script | Global |
| --- | --- |
| Query Block | `window.QUERY_BLOCK_CONFIGS = []` |
| Related Block | `window.RELATED_BLOCK_CONFIGS = []` |
| Locator Block | `window.LOCATOR_BLOCK_CONFIGS = []` |
| Metadata Block | `window.metadataBlocksSettingsList = []` |

## Shared exclusions

Query, Related and Locator accept the same optional `preFilter` exclusions:

```js
preFilter: {
  excludeCategories: ["Interview"],
  excludeTagPrefixes: ["Selection"],
  excludeTagValues: [{ prefix: "Selection", value: "Hero" }]
}
```

Each exclusion is independent: any match rejects the item. Prefixes match the
part before the first colon; values match the complete label, not a substring.
Matching normalizes case, accents, whitespace and apostrophes. A trailing colon
is optional on a configured prefix. Empty lists do not exclude anything.
Exclusions apply before sorting, limiting and pagination, and also to Related
fallback filling. Query tab filters and card variant filters accept the same
fields. Load the matching current core and block runtimes together.

## Optional extensions: one configuration entry

Query, Related and Locator accept an optional top-level `extensions` object.
It activates features on their existing **card grid**. Omit it to retain the
existing behavior; no optional engine is downloaded or activated automatically.
The core coordinates lifecycle only: it does not fetch extra content or build
another set of cards.

```js
// Inside an existing Query, Related or Locator configuration:
extensions: {
  scroller: { label: 'Discover the programme' },
  fancybox: { mediaAttribute: 'cbMedia' }
}
```

Each key accepts `true` for defaults, an options object, or `false` to disable
that feature. The options are those of the corresponding module documented
below. Do not activate the same feature both here and through an old render
hook/global target configuration on the same grid.

| Key | Optional files | Purpose |
| --- | --- | --- |
| `masonry` | `extension-masonry.js` | Position cards in columns of unequal heights. |
| `slider` | `extension-slider.js` | Navigate between featured cards. The site supplies the slider CSS. |
| `scroller` | `extension-scroller.js`, `extension-scroller.css` | Native horizontal scrolling, optionally with date dividers. |
| `fancybox` | `extension-fancybox.js` and the separately installed Fancybox library/CSS | Open a media dialog; one card can contain alternate views. |
| `collapse` | `extension-collapse.js` | Reveal cards already rendered, without fetching another page. |

### Installation

1. Load `collection-blocks.css` and the CSS required by the chosen extensions.
2. Load `collection-blocks.js`.
3. Load only the required `extension-[feature].js` files.
4. Define the site's block configurations before the block runtimes execute.
5. Load `query-block.js`, `related-block.js` and/or `locator-block.js` as needed.

Classic external scripts can use `defer` in this order. Keep matching core,
block and extension files from the same release. The new declaration requires
core 0.20 or later and matching block runtimes. With an older core, continue
using the legacy hooks and explicit `mount()` calls. Files stay at the repository
root, preserving installed URLs. This is not an `extensions/` folder migration.
Fancybox's third-party files remain separate dependencies, installed once per
site; do not copy them into this repository.

A missing extension file produces a console warning and leaves ordinary cards
usable. It does not trigger a network download. Correct script ordering is
required; after loading a missing module manually, call `sync()` again.

### Compatible combinations

- Choose **one** of Masonry, Slider or Scroller for a flat card grid. Grouped
  Query output and the Query list layout are not flat grids.
- Fancybox can accompany one of these layouts. Disable the block's built-in
  lightbox first; otherwise the new activation refuses the duplicate dialog.
- Collapse requires a complete flat list: Query/Related `pagination.mode: 'none'`
  or Locator `display.pageSize: 0`. It cannot accompany Slider or Scroller.
  It can accompany Masonry, which observes hidden cards.
- A paginated Scroller contains the cards currently rendered. It does not fetch
  all records or change pagination. The block's load-more control stays available.
- No styling, targets, taxonomy, selection rotation or site-specific colors
  are supplied by this activation layer.

Invalid combinations are skipped with a console warning; ordinary rendering
and compatible features remain available. Existing direct APIs and global
registries remain supported. When using the new core, direct layout mounts
also refuse a second, different layout on the same grid.

### Lifecycle and custom rendering

The block runtimes destroy their managed extensions before replacing cards,
and refresh them after pagination. Unchanged settings retain the current slide,
scroll position or expanded count. A filter replacement starts with the new
cards. Settings changes destroy and remount the affected module. Removing a
managed grid from the document releases its controllers at the next frame.

Custom renderers can use the same optional service:

```js
const controller = CollectionBlocks.extensions.mount(gridElement, {
  masonry: { columns: { default: 3, tablet: 2, mobile: 1 } }
}, { blockPrefix: 'qb' });

controller.refresh();
controller.update({ scroller: { label: 'Discover' } });
controller.destroy();
```

`mount()` and `sync()` are equivalent and idempotent on one grid. They return
`null` if no module can be activated. `CollectionBlocks.extensions.destroy(grid)`
is also available. A custom renderer should supply `grouped`, `paginated` and
`lightbox` booleans in the third argument when applicable, so the same guards
can apply. `blockPrefix` is normally inferred from the closest block/grid or a wrapper
containing one block;
pass `qb`, `rb` or `lb` explicitly only when the owner cannot be inferred.
Individual controllers keep their existing methods such as Slider `goTo()`;
the common controller provides only `refresh()`, `update()` and `destroy()`.

## Optional masonry extension

Load `extension-masonry.js` before the block runtimes (external classic scripts
may use `defer` in dependency order). The engine works on a flat grid of direct
`.cb-card`, `.qb-card`, `.rb-card` or `.lb-card` children; `cardSelector` can
replace that selector. It does not fetch content or change filtering/sorting.
Do not mount it on a container with group headings, controls or map elements.

Query exposes a render hook, including progressive rendering and pagination:

```js
window.CB_MASONRY_OPTIONS = {
  columns: { default: 3, tablet: 2, mobile: 1 },
  breakpoints: { tablet: 768, mobile: 480 }
};
window.QUERY_BLOCK_HOOKS = window.QUERY_BLOCK_HOOKS || {};
window.QUERY_BLOCK_HOOKS['my-query'] = function (grid, items, config, options) {
  window.CollectionBlocksMasonry(grid, items, config, options);
};
```

For a custom rendering lifecycle, or to retain an existing installation,
explicitly mount the **card grid** once it exists. Query, Related and Locator
can instead use the common `extensions` configuration above:

```js
const masonry = window.CollectionBlocksMasonry.mount(gridElement, {
  columns: { default: 4 },
  gap: 24 // optional pixel value; zero is supported
});
masonry.refresh(); // optional; content/image/container changes are observed
masonry.destroy(); // disconnect observers and restore original inline styles
```

Options merge defaults, legacy `QUERY_MASONRY_OPTIONS`, `CB_MASONRY_OPTIONS`,
then per-grid options (`config.masonry` through the Query adapter). Nested column
and breakpoint settings merge independently. Breakpoints use viewport width.
Gaps and column offsets may also use `--cb-masonry-gap` and
`--cb-masonry-offset-0`, etc.; legacy `--qb-` / `--sqb-` names remain supported.
CSS lengths for these properties accept px or rem. `snapRatios: true` optionally
snaps loaded image wrappers to familiar ratios; it does not crop by default.

The extension lays out available cards at the next animation frame, without
waiting for all lazy images. Image load/error, progressive DOM changes and
ResizeObserver size changes schedule one shared pass per frame per grid.
Measurements are batched before position writes. Until source dimensions are
known, image loading may still change card heights: this is not a CLS guarantee.
Repeated mounting is idempotent. Destroy before deliberately reusing a grid for
a different layout. Load only `extension-masonry.js`; the unused development
alias `query-masonry.js` was removed. Older release tags remain immutable.

## Shared Collection Source

These options are used by Query, Related, and Locator.

| Option | Default | Description |
| --- | --- | --- |
| `sourceCollection.path` | `''` | Squarespace collection path, for example `/programme-2026`. |
| `sourceCollection.url` | none | Accepted alias that is normalized to `path`. Prefer `path`. |
| `sourceCollection.jsonFormatSuffix` | `'?format=json'` in Related | JSON suffix used by Related when fetching collections. Query and Locator add `?format=json` automatically. |

## Collection Blocks Core

These options are passed internally to `CollectionBlocks.data.get()` / `getState()`.

| Option | Default | Description |
| --- | --- | --- |
| `maxPages` | `10` | Maximum number of Squarespace JSON pages to fetch. Can be `'all'`. |
| `ttl` | `900` | Session cache lifetime, in seconds. |
| `sessionCache` | `true` | Stores JSON state in `sessionStorage`. |
| `memoryCache` | `true` | Stores JSON state in memory for the current page session. |
| `credentials` | `'same-origin'` | Fetch credential mode. |
| `keepFields` | default field list | Keeps only useful fields when set. |
| `stripFields` | `[]` | Removes fields from fetched items. |
| `noCache`, `cache: false`, `forceRefresh`, `refresh`, `bypassCache`, `bustCache` | `false` | Any of these bypasses memory and session cache. |
| `bypassMemoryCache` | `false` | Bypasses memory cache only. |
| `bypassSessionCache` | `false` | Bypasses session cache only. |

Default kept fields:

```js
[
  'id',
  'title',
  'fullUrl',
  'urlId',
  'assetUrl',
  'mediaFocalPoint',
  'categories',
  'tags',
  'excerpt',
  'location',
  'displayIndex',
  'workflowState',
  'startDate',
  'publishOn',
  'addedOn',
  'updatedOn'
]
```

## Query Block

Each config is an object inside `window.QUERY_BLOCK_CONFIGS`.

### Top-Level Options

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | enabled unless `false` | Disables this config when set to `false`. |
| `key` | `'query'` | Unique block key; creates `cb--{key}`, `qb--{key}`, `data-cb-key`, `data-qb-key`. |
| `target` | required | CSS selector of the mount element. |
| `sourceCollection` | required | One source object or an array of source objects. |
| `classes` | `''` | Custom block classes. Supports string or `{ block: '...' }`. |
| `label` | none | Editor label shown in Squarespace edit mode. |
| `preFilter` | none | Filters source items before UI filtering. |
| `sort` | none | Initial sort rule. |
| `heading` | `null` | Optional block heading and CTA. |
| `filters` | `{}` | Filter/search/tabs configuration. Set to `false` to hide filters. |
| `display` | `{}` | Rendering options. |
| `pagination` | `{ mode: 'load-more', perPage: 12 }` | Pagination mode and page size. |
| `performance` | see below | Loading/cache/rendering options. |
| `i18n` | see below | Text labels. |
| `openInNewTab` | inherited by `display.openInNewTab` | Convenience alias. Prefer `display.openInNewTab`. |

### Query `performance`

| Option | Default | Description |
| --- | --- | --- |
| `lazyInit` | `true` | Initializes only when the target approaches the viewport. |
| `maxPages` | `1` | Initial collection pages to fetch. |
| `progressiveMaxPages` | `'all'` | Max pages allowed during progressive loading. |
| `sessionCache` | `true` | Enables shared session cache. |
| `sessionCacheTTL` | `300` | Session cache lifetime in seconds. |
| `domBatchSize` | `6` | Number of cards rendered per DOM batch. |
| `idlePreload` | `false` | Idle preload of more pages through Collection Blocks. |
| `idleComplete` | `false` | Alias-like behavior for idle completion. |
| `idlePreloadMaxPages` | `progressiveMaxPages` | Max pages for idle preload. |
| `idlePreloadTimeout` | `2500` | Idle preload timeout in milliseconds. |
| `stripFields` | `[]` | Fields removed from fetched items. |

### Query `pagination`

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `'load-more'` | Supports `'none'`, `'load-more'`, and `'infinite'`. |
| `perPage` | `12` | Number of visible items per page. Ignored when `mode: 'none'`. |
| `loadMoreLabel` | i18n default | Custom load-more button label. |
| `endLabel` | `''` | Label shown when no more items are available. |

### Query `filters`

| Option | Default | Description |
| --- | --- | --- |
| `layout` | `'pills'` | Default layout for tag filters. |
| `tagPrefixes` | `[]` | Tag prefix filters. |
| `labelPosition` | `'inside'` | Dropdown labels: `'outside'` adds a persistent native label beside the select and uses the All text alone for its empty option. Each category, publication-year or tag-prefix filter can override it with `labelPosition`. Pills and `showLabel` behavior are unchanged. |
| `publicationYear` | `false` | Year filter derived from `publishOn`, without tags. Accepts `true` or `{ layout, label, showLabel, direction, timeZone }`. Defaults: pills, Year, visible label, descending, UTC. |
| `datePrefix` | `null` | Prefix treated as ISO date values for sorting/display. |
| `search` | enabled unless `false` | Full-text search across title, excerpt, location, categories, tags. |
| `tabs` | `[]` | Tab definitions. |
| `defaultTab` | `0` | Initial tab index. |
| `defaultCategory` | none | Initial category filter. |
| `defaultTags` | `{}` | Initial tag-prefix filters. |
| `mobilePanel` | `false` | Moves secondary filters into a mobile panel. |
| `mobilePanelBreakpoint` | `768` | Pixel breakpoint, or `'always'`. |
| `sticky` | `false` | `true` makes the filter wrapper sticky; `'tabs'` in `all-tabs` mode keeps only the tabs/mobile filter button sticky. |
| `stickyTop` | `'0px'` | Sticky offset. |
| `clearAll` | `false` | Adds a reset control. Can be a custom label string. |

### Query Tag Prefix Definition

Outside-label Query and Locator dropdowns share a compact control width of
`10rem`, independent of their longest option. Override
`--cb-filter-control-width` on the block to change it. The labels keep their
natural width; legacy inside-label dropdowns retain their existing sizing.

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | required | Tag prefix, for example `'Date'`. |
| `label` | prefix | Visible label. |
| `showLabel` | `true` | Hides label when `false`. |
| `hidden` | `false` | Omits the tag filter control while preserving URL/default filtering and reset. Useful for curated selection links without an extra dropdown. |
| `layout` | inherited from filters | `'pills'` or `'dropdown'`. |
| `filterFormat` | none | Format displayed in filter controls. |
| `displayFormat` | none | Format displayed on cards. |
| `locale` | document language or `'fr-CH'` | Locale for date formatting. |
| `sort` | automatic | Sorts values. Date prefixes sort chronologically. |

### Query Tab Definition

| Option | Default | Description |
| --- | --- | --- |
| `label` | required | Visible tab text. |
| `labelIcon` | none | Optional Material Symbol/text icon. |
| `filter` | none | Tab-level filter. |
| `sort` | config sort | Sort override while tab is active. |
| `layout` | display layout | Layout override while tab is active. |
| `groups` | display groups | Card group override while tab is active. |
| `groupBy` | display groupBy | Grouping override while tab is active. |
| `groupOrder` | display groupOrder | Group order override. |
| `tagPrefixes` | global filters | Controls visible for this tab in legacy mode. Ignored in `all-tabs` mode, which uses `filters.tagPrefixes`. |

### Query `display`

| Option | Default | Description |
| --- | --- | --- |
| `layout` | `'grid'` | `'grid'` or `'list'`. |
| `counter` | `false` | Shows visible count when `true`. |
| `cardLink` | `true` | Whole card links to item when enabled. |
| `openInNewTab` | `false` | Opens card links in a new tab. |
| `groups` | `null` | Custom card structure. |
| `tagPrefixFields` | `[]` | Tag prefix fields displayed on cards. |
| `excerpt` | enabled unless `false` | Shows excerpt in the default card structure. |
| `location` | `false` | Shows location in the default card structure. |
| `groupBy` | `null` | Groups cards by category or tag prefix. |
| `groupOrder` | `'collection'` | Supports `'collection'`, `'alpha'`, or an explicit array. |
| `cardClasses.categories` | `false` | Adds category-derived card classes. |
| `cardClasses.tagPrefixes` | `[]` | Adds tag-derived card classes. |

### Query Card Child Definition

| Option | Default | Description |
| --- | --- | --- |
| `type` | required | `'image'`, `'title'`, `'excerpt'`, `'location'`, `'categories'`, or `'tagPrefix'`. |
| `prefix` | required for `tagPrefix` | Tag prefix to render. |
| `label` | `''` | Text label for tag prefix fields. |
| `labelIcon` | none | Material Symbol/text icon. |
| `joinWith` | `', '` | Separator between multiple values. |
| `displayInline` | `false` | Uses inline display behavior. |
| `displayFormat` | none | Date/tag display formatting. |
| `locale` | document language or `'fr-CH'` | Locale for date formatting. |
| `className` | none | Extra class added to the child. |
| `richHTML`, `excerptMode: 'rich'`, `htmlMode: 'rich'` | `false` | Preserves allowed Squarespace excerpt HTML. |
| `lineTag` | `'span'` | Tag used for generated excerpt lines. |
| `lineClassName` | none | Extra class added to each generated excerpt line. |

### Query `i18n`

| Option | Default | Description |
| --- | --- | --- |
| `loading` | `false` | Loading label; hidden when `false`. |
| `all` | `'Tout'` | All-option label. |
| `noResults` | `'Aucun résultat'` | Empty state text. |
| `loadMoreLabel` | `'Voir plus'` | Load-more button text. |
| `endLabel` | `''` | End-of-list text. |
| `filterToggle` | `'Filtrer'` | Mobile filter button text. |
| `filterClose` | `'close'` | Mobile panel close icon/text. |
| `searchPlaceholder` | `'Rechercher…'` | Search input placeholder. |

## Related Block

Each config is an object inside `window.RELATED_BLOCK_CONFIGS`.

### Top-Level Options

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Disables the block when `false`. |
| `key` | `'rb-block'` | Unique block key. |
| `debug` | `false` | Logs debug information. |
| `devGuard.enabled` | `false` | Enables body-id guard. |
| `devGuard.bodyId` | none | Required `body.id` when guard is enabled. |
| `requiredBodyClasses` | `[]` | Body classes required before the block runs. |
| `sourceCollection.path` | `''` | Collection used for related candidates. |
| `currentItem.matchBy` | `'pathname'` | Current item matching strategy. |
| `currentItem.sourceCollection` | `null` | Optional source used to find current item. |
| `currentItem.overrideForDev` | `null` | Manual current-item data for development. |
| `target` | `''` | CSS selector where the block is inserted. |
| `insertion.mode` | `'append'` | `'append'` or `'prepend'`. |
| `heading` | `''` | Heading when multiple items. |
| `headingSingular` | `''` | Heading when one item. |
| `headingTag` | `'h3'` | Heading tag. |
| `headingCta` | see below | Optional heading CTA. |
| `classes.block` | `''` | Custom block class. |
| `display` | see below | Rendering options. |
| `selection` | see below | Matching/scoring/fallback rules. |
| `performance` | see below | Loading/cache/rendering options. |
| `loading.hideLoader` | `false` | Hides the loading placeholder. |
| `emptyState.message` | `''` | Empty state message. |
| `preload` | disabled | Optional idle preload config. |
| `openInNewTab` | inherited by `display.openInNewTab` | Convenience alias. Prefer `display.openInNewTab`. |

### Related `headingCta`

| Option | Default | Description |
| --- | --- | --- |
| `text` | `''` | CTA text. |
| `href` | `''` | CTA URL. |
| `icon` | `''` | Optional icon/text. |
| `iconType` | `'text'` | Icon rendering mode. |
| `newTab` | `false` | Opens CTA in a new tab. |

### Related `display`

| Option | Default | Description |
| --- | --- | --- |
| `maxItems` | `4` | Maximum rendered items. |
| `showImage` | `true` | Shows images. |
| `showTitle` | `true` | Shows titles. |
| `showCategories` | `true` | Shows categories/meta. |
| `showExcerpt` | `false` | Shows excerpt. |
| `showLocation` | `false` | Shows location. |
| `order` | `['meta', 'title', 'excerpt', 'location']` | Default content order. |
| `tagPrefixFields` | `[]` | Tag prefix fields shown on cards. |
| `groups` | `[]` | Custom card groups. |
| `srcsetWidths` | `[100, 300, 500, 750, 1000, 1500, 2500]` | Image srcset widths. |
| `imageSizes` | `'(max-width: 768px) 100vw, 50vw'` | Image sizes attribute. |
| `excerptMaxLength` | `180` | Excerpt length. Use `0` or `false` for no truncation. |
| `excerptMode` | none | Use `'rich'` to preserve allowed HTML. |
| `excerptRichHTML` | `false` | Boolean equivalent for rich excerpt HTML. |
| `openInNewTab` | `false` | Opens card links in a new tab. |

### Related `selection`

| Option | Default | Description |
| --- | --- | --- |
| `constraints.requirePublished` | `true` | Excludes unpublished/non-public items. |
| `constraints.requireImage` | `true` | Requires an image. |
| `constraints.excludeCurrentItem` | `false` | Excludes the current item. |
| `match.groups` | `[]` | Matching groups. |
| `score.enabled` | `false` | Enables scoring. |
| `score.rules` | `[]` | Scoring rules. |
| `score.minScore` | `0` | Minimum score. |
| `sort` | `[{ type: 'date', direction: 'desc' }]` | Sort rules. |
| `limit` | `4` | Result limit. |
| `fallback.enabled` | `false` | Enables fallback selection. |
| `fallback.fillToLimit` | `false` | Fills missing results up to limit. |
| `fallback.sort` | `[{ type: 'random' }]` | Fallback sort. |
| `fallback.matchGroups` | `null` | Optional fallback match groups. |

Supported match/scoring rule types include:

| Type | Purpose |
| --- | --- |
| `sharedCategory` | Candidate shares a category with the current item. |
| `sharedTagPrefix` | Candidate shares tag values from selected prefixes. |
| `exactTags` | Candidate has exact tags. |
| `excludeCategories` | Candidate must not have listed categories. |
| `excludeExactTags` | Candidate must not have listed tags. |
| `titleMatchesCurrentTagValue` | Candidate title matches a current item tag value. |
| `nextCollectionItemOfCategory` | Selects the next item by display index in a category. |
| `nextCollectionItemWithTag` | Selects the next item by display index with a tag. |
| `nextByTagValue` | Selects next item using an integer tag-prefix value. |

### Related `performance`

| Option | Default | Description |
| --- | --- | --- |
| `lazyInit` | `true` | Initializes when the target approaches viewport. |
| `useSessionStorage` | `true` | Legacy flag kept internally. |
| `maxPages` | `1` | Initial pages to fetch. |
| `progressiveMaxPages` | `'all'` | Max pages allowed during progressive matching. |
| `memoryCache` | `true` | Enables shared memory cache. |
| `sessionCache` | `true` | Enables shared session cache. |
| `sessionCacheTTL` | `300` | Session cache lifetime in seconds. |
| `domBatchSize` | `6` | Render batch size. |

### Related `preload`

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Enables idle preload. |
| `includeSourceCollection` | `true` | Preloads source collection. |
| `includeCurrentItemSource` | `false` | Preloads current-item source collection. |
| `collections` | `[]` | Additional collections to preload. |
| `maxPages` | `null` | Pages to preload; falls back to performance max pages. |

## Locator Block

Each config is an object inside `window.LOCATOR_BLOCK_CONFIGS`.

### Top-Level Options

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | enabled unless `false` | Disables the block when `false`. |
| `key` | `'locator'` | Unique block key. |
| `target` | `'.locator-block'` | CSS selector of the mount element. |
| `sourceCollection.path` | `''` | Collection used for markers/list items. |
| `category` | `''` | Optional category filter. |
| `tagNumero` | `'Numéro'` | Tag prefix used for marker number. |
| `tagLieu` | `'Lieu'` | Tag prefix used for location text. |
| `tagZone` | `'Zone'` | Tag prefix used for zones. |
| `layout` | `'list'` | `'list'` or `'grid'`. |
| `apiKey` | `''` | Google Maps API key. |
| `mapCenter` | `null` | Manual map center. |
| `mapZoom` | `null` | Manual map zoom. |
| `mapZoomOnSelect` | `16` | Zoom level when selecting an item. |
| `mapStyle` | `null` | Google Maps style. |
| `mapOptions` | `{}` | Extra Google Maps options. |
| `filterMode` | `'dropdown'` | Zone filter UI mode. |
| `filterLabelPosition` | `'inside'` | Set to `'outside'` for a persistent native label beside the zone dropdown, using `filterLabel`. Buttons are unchanged. |
| `filterMultiple` | `false` | Multiple zone selection. |
| `showZoneFilter` | `true` | Shows zone filter. |
| `sort` | `{ type: 'numero', direction: 'asc' }` | List/marker item sort. |
| `classes.block` | `''` | Custom block class. |
| `i18n` | locale defaults | Text labels. |
| `debug` | `false` | Logs debug information. |

### Locator `performance`

| Option | Default | Description |
| --- | --- | --- |
| `lazyInit` | `true` | Initializes when target approaches viewport. |
| `lazyRootMargin` | `'1200px 0px'` | Lazy init root margin. |
| `priorityImages` | `true` | Prioritizes early images. |
| `maxPages` | `1` | Initial collection pages to fetch. |
| `progressiveMaxPages` | `'all'` | Max pages allowed progressively. |
| `domBatchSize` | `6` | Render batch size. |
| `sessionCache` | `true` | Enables shared session cache. |
| `sessionCacheTTL` | `300` | Session cache lifetime in seconds. |
| `idleComplete` | `false` | Completes loading during idle time. |
| `idlePreload` | `false` | Alias-like trigger for idle completion. |
| `keepFields` | default core field list | Fields kept in collection items. |

### Locator `display`

| Option | Default | Description |
| --- | --- | --- |
| `showImage` | `true` | Shows card images. |
| `showTitle` | `true` | Shows card titles. |
| `showNumero` | `true` | Shows number tag. |
| `showLieu` | `true` | Shows location tag. |
| `showZones` | `false` | Shows zones/categories. |
| `lieuIcon` | `'location_on'` | Material Symbol for location. |
| `showCount` | `true` | Shows item count. |
| `pageSize` | `0` | Visible list items; `0` means all. |
| `cardClickable` | `false` | Makes whole card clickable. |
| `cardLink` | `true` | Shows card link arrow when relevant. |
| `openInNewTab` | `false` | Opens card/popup links in new tab. |
| `groups` | `null` | Custom card groups. |

### Locator `map`

| Option | Default | Description |
| --- | --- | --- |
| `markerLabel` | `'numero'` | Marker label source. |
| `markerStyle` | `'pill'` | Marker style. |
| `markerFontSize` | `13` | Marker label font size in pixels. |
| `markerShadow` | `true` | Adds marker shadow. |
| `popup` | `true` | Enables map popups. |
| `popupShowImage` | `true` | Shows image in popup. |
| `clustering` | `false` | Enables marker clustering. |
| `clusterMinCount` | `2` | Minimum marker count for clustering. |
| `updateListOnMapMove` | `false` | Filters list based on visible map bounds. |
| `overlapStrategy` | `'spread'` | Spreads markers with identical coordinates. |
| `overlapRadiusMeters` | `18` | Spread radius for overlapping markers. |

### Locator `i18n`

French defaults:

| Option | Default |
| --- | --- |
| `noResults` | `'Aucun résultat dans cette zone'` |
| `allZones` | `'Toutes les zones'` |
| `itemCount` | `n + ' exposition(s)'` |
| `loading` | `'Chargement…'` |
| `error` | `'Impossible de charger les données.'` |

English defaults:

| Option | Default |
| --- | --- |
| `noResults` | `'No results in this area'` |
| `allZones` | `'All areas'` |
| `itemCount` | `n + ' exhibition(s)'` |
| `loading` | `'Loading…'` |
| `error` | `'Unable to load data.'` |

## Metadata Block

Metadata Block is independent from Collection Blocks when it reads the current page JSON. If `jsonUrl` points to a collection, the historical implementation expects `window.CollectionData`; this should be migrated later if Metadata needs to use Collection Blocks.

Configuration global:

```js
window.metadataBlocksSettingsList = []
```

### Metadata Settings

| Option | Default | Description |
| --- | --- | --- |
| `jsonUrl` | current pathname | JSON URL to read. Omit for current page/item JSON. |
| `maxPages` | `1` | Initial pages when `jsonUrl` points to a collection. |
| `cacheTTL` | `900` | Collection cache TTL in seconds. |
| `sessionCache` | `true` | Collection session cache. |
| `performance.maxPages` | `1` | Initial pages for collection lookup. |
| `performance.progressiveMaxPages` | `'all'` | Max pages while looking for current item. |
| `performance.keepFields` | metadata field list | Fields kept when using a collection JSON URL. |
| `buildAutomatically` | `true` | Builds and inserts the wrapper automatically. |
| `moveToDestination` | `.blog-item-top-wrapper` fallback | Optional selector for insertion target. |
| `moveToDestinationPosition` | `999` | Insertion position inside target. |
| `customClass` | none | Extra classes on `.metadata-blocks`. |
| `bodyClassConfiguration` | none | Required body class before running. |
| `blocksOrder` | `[]` | Explicit visual order by block name. |
| `blockSeparator` | none | Separator between metadata blocks. |
| `blocks` | `[]` | Metadata block definitions. |
| `excerpt` | `[]` | Excerpt block definitions. |
| `location` | none | Location block definition. |

### Metadata Block Definition

| Option | Default | Description |
| --- | --- | --- |
| `name` | required | Block name; creates `metadata-block--{name}`. |
| `source` | `'tags'` | Source field, usually `tags` or `categories`. |
| `title` | `''` | Singular title. |
| `titlePlural` | `title` | Plural title. |
| `titleSuffix` | `''` | Suffix added to title. |
| `iconTitle` | none | Replaces text title with icon/title value. |
| `showTitle` | `true` | Hides title when `false`. |
| `displayInline` | `false` | Displays values inline. |
| `inlineSeparator` | `', '` | Separator between inline values. |
| `group` | none | Appends this block into another block. |
| `groupSeparator` | `', '` | Separator before grouped values. |
| `groupPosition` | append | Supports `prepend`. |
| `allowedCategories` | none | Keeps only matching values. |
| `allowedTags` | none | Keeps only matching values. |
| `allowedCaracter` | none | Keeps values containing this string. |
| `allowedPrefixSuffix` | none | Keeps values starting or ending with this prefix/suffix. |
| `sortOrder` | none | Supports `'asc'`, `'desc'`, `'customOrder'`. |
| `customOrder` | `[]` | Manual order when `sortOrder: 'customOrder'`. |
| `formatDates` | `false` | Formats ISO-like values as dates. |
| `dateFormat` | `'datetime'` | Date format when `formatDates` is enabled. |
| `dateLocale` | document language or `'fr-CH'` | Locale for date formatting. |
| `maxValues` | unlimited | Maximum values rendered. |
| `fetchExcerpt` | `false` | Reads excerpt content. |
| `isLocation` | internal | Location block flag. |
| `useGoogleMapsLink` | `false` | Converts location to Google Maps link. |
| `googleMapsLabel` | `'Voir sur la carte'` | Label for Google Maps link. |
| `googleMapsTarget` | none | Link target, for example `_blank`. |
| `hideIfEmpty` | `true` | Empty blocks are hidden unless set to `false`. |
| `order` | block order map or `99` | Manual visual order. |

## Date Formats

Date-like tag values can be formatted with these values:

| Format | Output |
| --- | --- |
| `'time'` | Time only. |
| `'day'` | Weekday + day + month. |
| `'short'` | Short day/date. |
| `'numeric'` | Numeric date. |
| `'date'` | Long date. |
| `'datetime'` | Date + time. |
| `'short-time'` | Short date + time when available. |
| custom object | Passed to `toLocaleDateString()`. |

Publication dates (`publishDate` in Query and Related) support a reusable month/year
format through the existing `displayFormat` object:

```js
{ type: 'publishDate', locale: 'en-GB',
  displayFormat: { month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' } }
```

This displays `October 2026` and preserves the full timestamp in the `time`
element. Date-like tag descriptors also accept `{ month: 'long', year: 'numeric' }`
for individual dates. Exhibition period formatting remains independent.

`filters.publicationYear` combines with category, tag and search filters. With
`filters.urlState`, it uses the `year` URL parameter (override with
`urlState.publicationYear`). `filters.controlOrder` identifies it as
`publicationYear`. Invalid/missing dates offer no year; these items remain in the
unfiltered results. Keep `performance.filterIndex: 'complete'` when all years must
be discoverable before pagination.

## CSS Class Model

Common classes start with `cb-*`. Block-specific classes are added alongside them.

New reusable UI must preserve these paired classes for elements and modifiers.
Update this section when adding a public class contract; site identifiers and
editorial taxonomies must remain outside the shared naming contract.

| Block | Card class | Block-specific prefix |
| --- | --- | --- |
| Query | `cb-card qb-card` | `qb-*` |
| Related | `cb-card rb-card` | `rb-*` |
| Locator | `cb-card lb-card` | `lb-*` |

Generated block attributes:

| Attribute | Used by |
| --- | --- |
| `data-cb-key` | Query, Related, Locator |
| `data-qb-key` | Query |
| `data-rb-key` | Related |
| `data-lb-key` | Locator |
| `data-cb-classes` | Custom block classes |
| `data-cb-tab`, `data-qb-tab` | Active Query tab |

### Shared Query filter classes

Each name below also has its `qb-*` alias. Existing filter and mobile panel
classes remain unchanged. These controls currently belong to Query; no `rb-*`
or `lb-*` UI is generated for this feature.

| Common class | Role |
| --- | --- |
| `cb-filters-wrapper--shared` | Shared control/chip wrapper. |
| `cb-filters-wrapper--tabs-only` | Separate wrapper when only tabs are sticky. |
| `cb-tab-btn__count` | Visible filtered count within a tab button. |
| `cb-tab-btn--empty` | Inactive tab with an exact zero count; also natively disabled. |
| `cb-filters-active` | Group of active criteria, hidden when empty. |
| `cb-filter-chip` | Button removing one criterion. |
| `cb-filter-chip__label` | Visible criterion value. |
| `cb-filter-chip__remove` | Decorative removal icon; accessible name is on the button. |
| `cb-filter-return` | Optional button returning to the shared filter controls. |
| `cb-mobile-panel__apply` | Optional result-count button closing the mobile panel. |

### Extension class contract

With matching core/extension versions, every extension-owned element and state
receives its `cb-*` class and the owner's `qb-*`, `rb-*` or `lb-*` companion.
For example, a Query slider next button has `cb-slider__next qb-slider__next`.
A native gallery outside a block has the common classes only. Fancybox retains
its origin's prefix even though the dialog is rendered outside that block.
The third-party library's own internal elements keep its own class contract.

| Feature | Common roots/elements and state families |
| --- | --- |
| Masonry | `cb-masonry` on the existing grid; cards retain their block classes. |
| Slider | `cb-slider`, `cb-slider__track`, `__slide`, `__controls`, `__button`, `__previous`, `__next`, `__dot`, `__icon`; root `--ready`, `--intro-ready`, `--intro-complete`, `--dragging`; slide `--active`, `--previous`, `--before`, `--after`, `--adjacent`, `--distant`; dot `--active`. |
| Scroller | Existing `cb-scroller`, `cb-scroller-track`, `cb-scroller-controls`, `cb-scroller-prev`, `cb-scroller-next`, `cb-scroller-refresh`, `cb-scroller-dragging`, `cb-scroller-day`, `cb-scroller-day__context`; new `cb-scroller-day__title`. |
| Collapse | `cb-collapse`, `cb-collapse--collapsed`, `--expanded`, `cb-collapse__controls`, `__more`, `__less`, `__item--hidden`; buttons also retain `cb-load-more` and its block alias. |
| Explorer | `cb-explorer`, root `--form` / `--links`, `__form`, `__status` / `__status--quiet`, `__submit`, `__links`, `__link`, `__label`, `__count`, `__description`; Query-backed elements also have `qb-*` aliases. |
| Fancybox | `cb-fancybox`, `cb-fancybox__carousel`, `__slide`, `__image`, `__caption`, `__category`, `__title`, `__details`, `__year`, `__line`, `__enquire`, `__enquire-link`, `__views`, `__views-group`, `__view`, `__view-image`; view `--primary`, `--alternate`, `--active`; views-group `--primary`, `--alternates`; slide/views `--loading`. |

The Scroller's existing hyphenated names remain supported without a disruptive
rename. This pass adds their block aliases; generalizing date dividers into
arbitrary group headings is a separate change. Legacy Slider `is-*` states,
Fancybox `cap-*`/configured prefixes, Collapse prefixes and custom Slider class
names remain **alongside** the common classes. A custom prefix no longer removes
the generic styling hooks. Destroy restores original classes and semantics.

### Tests

`tests/` contains development checks, not scripts to install on a site.
Run the Node checks with `node --test tests/*.test.cjs`. Serve browser fixtures
from an isolated local copy containing only shared assets and those fixtures;
do not expose deployment records or site credentials through a local server.

`tests/browser-extension-lifecycle.html` tests common activation, class aliases,
option changes, incompatible combinations, removal cleanup, and the real
Query/Related/Locator rendering paths with local data. It stubs Google Maps and
Fancybox to test the integration contract, not the third-party services.
The existing Slider, Scroller, Fancybox/Collapse and filter fixtures cover
legacy entry points. Site visual checks remain necessary before a rollout.

## Release Notes Workflow

Use `CHANGELOG.md` to record human-readable changes between releases.

Suggested entry format:

```txt
## v0.1.0
- Added ...
- Fixed ...
- Changed ...
```

Use `LICENSE` to define legal reuse terms. For private/internal code, it can be omitted. For public GitHub code, add one intentionally.

## Optional slider extension

Load `extension-slider.js` before the block runtimes. Mount on a flat card grid
through `extensions.slider` or a render hook; Query, Related and Locator card
selectors are supported.
The extension provides behavior; the site supplies its slider layout/CSS.

```js
window.QUERY_BLOCK_HOOKS = window.QUERY_BLOCK_HOOKS || {};
window.QUERY_BLOCK_HOOKS['featured'] = function (grid) {
  window.CollectionBlocksSlider.mount(grid, {
    autoplay: 6000, arrows: true, dots: true, drag: true,
    label: 'Featured stories',
    onChange: function (state) { /* state.index, state.card, state.grid, state.user */ }
  });
};
```

`mount(grid, options)` is idempotent. Direct child insertion/removal is observed;
active cards survive progressive rendering. The returned controller exposes
`refresh()`, `goTo(index)`, `pause()`, `resume()` and `destroy()`. Destroy restores
modified attributes, classes and CSS properties and removes timers/listeners.
Destroy before remounting with different options or replacing a grid.

Options include `root` (element), `cardSelector`, `autoplay` (milliseconds, 0 by
default), `arrows`, `dots`, `drag`, `dragThreshold` (48px), `controlsInGrid`,
`label`, `previousLabel`, `nextLabel`, `dotLabel`, `previousIcon`, `nextIcon`,
`step` (offset percentage, default 100), `cssPrefix` (default `--cb-slider`),
`introDuration`, `onChange` and additive `classes` aliases. Class keys are `root`,
`track`, `slide`, `controls`, `button`, `previous`, `next`, `dot`, `icon`, `ready`,
`introReady`, `introComplete`, `dragging`; defaults use `cb-slider` names.

State classes are `is-active`, `is-previous`, `is-before`, `is-after`,
`is-adjacent`, `is-distant`. CSS properties append `-active-index` to the root
prefix and `-slide-index`, `-offset`, `-offset-x` to cards. Navigation supports
arrows and horizontal dragging; inactive cards and descendants leave the tab
order. Autoplay pauses for hover, focus, document visibility and reduced motion.
A manual navigation never cancels another pause condition.

## Intrinsic image dimensions

The core and Query/Related/Locator renderers use optional
`imageDimensions: { width, height }` from Collection Data to write native image
`width`/`height` attributes. Direct Squarespace `originalSize: "1500x2262"` is
also accepted. Invalid/missing dimensions are omitted. Fixed CSS ratios and
`object-fit` remain in control of deliberate crops; natural-height layouts can
reserve their image space before lazy loading. No additional image request is
made. Custom `keepFields` lists must retain `imageDimensions` / `originalSize`.

### Optional Fancybox and Collapse extensions

`extension-fancybox.js` adapts rendered cards to **Fancybox 6.x** (verified with
6.1.3). Load the Fancybox library/CSS separately; the extension does not bundle,
upgrade or license that dependency. Targets and presentation remain site-owned.

Use `extensions.fancybox` on a block, register
`window.CB_FANCYBOX_CONFIGS = [...]` before the deferred extension,
or call `CollectionBlocksFancybox.mount(element, options)` explicitly. Each
configuration supplies `targets`, `itemSelector`, `triggerSelector`, and
`selectors: { image, category, title, excerpt }`. Optional `mediaAttribute`
is the dataset key holding an array of `{ assetUrl, title }`, e.g. `cbMedia`.
Each card remains one gallery slide; its alternate media are view buttons
inside that slide. `artworkViews` supplies enabled/groupLabel/primaryLabel/
alternateLabel. `classPrefixes`, `button: { enabled, label, href }`,
`thumbnailWidth`, and `fancybox` retain site styling and controls. Supported
Fancybox settings: theme, hash, preload, dragToClose, closeButton, infinite,
thumbsType, showThumbsOnStart, toolbar.

Hooks: `getMedia(card)` returns normalized `{ src, thumb, alt }` entries;
`getCaption(card)` returns trusted site-authored HTML; `onOpen(instance, card)`
can subscribe to Fancybox events. The controller exposes `open(card)` and
`destroy()`. `CollectionBlocksFancybox.refresh()` discovers registered targets.
Delegation handles cards inserted later and a library that becomes available
later. Without Fancybox, normal card links remain usable. No site selector or
enquiry destination is built into the engine.

`extension-collapse.js` progressively reveals **already-rendered cards**;
it does not fetch pages and must not be applied on top of native Query/Related
pagination. Use `extensions.collapse` on a block, register
`window.CB_COLLAPSE_CONFIGS = [...]`, or call
`CollectionBlocksCollapse.mount(element, options)`. Supply `targets`,
`listSelector`, `itemSelector`, optionally `footerSelector`, `excludeSelector`,
`threshold` (default 8), `step` (defaults to threshold),
`labels: { showMore, showLess }`, and `scrollToSectionOnCollapse` (default true).
`classPrefix` defaults to `cb-collapse`; an existing prefix is retained alongside
the common and block-specific classes.
Styles must honor `[hidden]` on cards/buttons if local display rules override
it. The extension itself sets the native hidden attribute.

The controller exposes `refresh()`, `showMore()`, `collapse()`, and `destroy()`;
`onChange({ scope, visibleCount, total })` is optional. Global `refresh()`
reconciles mounted scopes and discovers registered targets. Progressive DOM
updates preserve the current count; a small replacement result removes the
controls. Destroy restores original item visibility. Both modules are guarded
against duplicate loading, batch mutation discovery per frame, and support
DOMContentLoaded, mercury:load, page:loaded and site:refresh. View-all cards and
text disclosure remain separate integrations.

Browser regression checks: serve `tests/browser-fancybox-collapse.html` with
these two files from an isolated local folder. The fixture tests lifecycle,
thresholds, progressive changes, captions and media mapping; an actual Fancybox
installation still needs its own visual/interaction verification.

### Native selection scrollers

`extension-scroller.js` and `extension-scroller.css` provide an optional horizontal
rail for existing cards. Load the stylesheet and deferred script, then use
`extensions.scroller` or call `CollectionBlocksScroller.mount(track, options)`
from a custom render lifecycle.
The engine has no site selectors, content source, image ratio, or autoplay.
Options include `itemSelector`, `label`, `labels`, `locale`, `timeZone`, `now`,
`refreshInterval` (default 60 seconds), and optional `getSchedule(card)`.
Schedules accept one ISO start/range or an array of occurrences. Naive ISO
values are local to `timeZone`; explicit offsets are converted. The next
available occurrence represents a multi-occurrence card. Date-only schedules
and start-only schedules last through the end of their local calendar day. An
explicit end takes precedence. This is a display convention for missing end
times, not a claim about the actual event duration.

Dated rails put ongoing and upcoming items first, then earlier starts and
undated items, with day markers. All-past selections become an archive.
Automatic clock updates do not reorder a focused card or a scrolled rail;
a visible update button applies pending changes. Native touch/trackpad scroll,
mouse drag, arrow buttons and keyboard arrows are supported. There is no loop.
The controller exposes `update(options)`, `refresh()` and `destroy()`.
`refresh({ preservePosition: true })` reconciles without forcing pending date
reordering; the common activation layer uses this mode.
CSS hooks: `--scroller-card-width`, `--scroller-day-width`, `--scroller-gap`,
`--scroller-align` (default flex-start), `--scroller-day-justify` (default center),
and `--scroller-inset` (default 0px, matching track padding and snap inset).
Add `cb-scroller--side-controls` to the track's parent to overlap navigation at
the sides of the track, with no reserved controls row. This variant expects the
common heading / track / footer structure and reveals arrows on hover or focus
for fine pointers. `--scroller-control-offset` defaults to -1rem. Button design,
mobile visibility, content widths and host-system gutters belong to site CSS.
The caller owns site targets, rendering, filtering, image presentation and clocks
used for development previews. Browser checks: `tests/browser-scroller.html`.

### Native gallery links in Fancybox

Fancybox extension 1.1 adds opt-in `linkMedia: true` for image anchors lacking a
usable destination, such as native Squarespace grid galleries. It prepares the
primary media URL, accessible name (`openLabel` fallback) and dialog semantics.
Mount one controller per gallery to keep gallery groups independent. Late items
are prepared by `refresh()` and original link attributes are restored on destroy.
Existing artwork configs and alternate artwork views keep their prior behavior.

### Shareable Query filters

`filters.urlState` is opt-in. Use stable `id` values on tabs. For example:

```js
urlState: {
  tab: 'type', category: 'categorie', search: 'recherche',
  tags: { Date: 'date', Membre: 'membre', 'Thématique': 'theme' }
}
```

The initial URL restores the active tab, category, tag values and search. User
filter changes push a browser history entry; debounced search edits replace the
current entry. Back/forward restore the UI and results. Unmapped parameters and
the hash are retained. Only one block should own a given set of parameter names
on a page; use distinct names for independent blocks. `urlState: true` defaults
to `tab`, `category`, `search` and `tag.<prefix>` for configured prefixes.
Tab IDs fall back to label slugs. Unknown tabs fall back to the configured tab.
In legacy mode, only prefixes declared for the active tab can be restored.
In `all-tabs` mode, the global `filters.tagPrefixes` apply, including hidden ones.

A tag-prefix filter can opt into `includeAny: true` and `anyLabel` to offer an
“any value” selection, encoded as `*`. `filterGranularity: 'day'` allows a dated
prefix such as Vernissage to filter by calendar day independently of Date.
Existing blocks without URL state retain their existing behavior.
Browser checks: `tests/browser-query-url.html`.


### Filter presentation and scroller date labels

`filters.categories.layout: 'dropdown'` opts categories into a select control;
the default remains pills. `filters.controlOrder` optionally orders secondary
controls in the DOM, using `'categories'`, exact tag prefixes, and `'search'`.
Unlisted controls follow in their original order. Tabs remain separate.
For example: `controlOrder: ['Date', 'categories', 'Membre', 'search']`.

Scroller `formatDay(day)` can return a site-specific day label for an ISO
`YYYY-MM-DD` value. Omitting it preserves the standard localized label.
For exhibition selections spanning multiple days, omit `getSchedule` to keep
the supplied card order and dates without generating day separators.


### One filter state above all Query tabs

This is built into Query, not an optional extension. Install matching
`collection-blocks.js` (core 0.21 or later), `query-block.js` and
`collection-blocks.css`. No extra script is required. In an existing config:

```js
filters: {
  scope: 'all-tabs',
  layout: 'dropdown',
  labelPosition: 'outside',
  categories: { layout: 'dropdown', label: 'Category' },
  tagPrefixes: ['Theme', 'Area', { prefix: 'Selection', hidden: true }],
  tabs: [
    { id: 'exhibitions', label: 'Exhibitions', filter: { categories: ['Exhibition'] } },
    { id: 'events', label: 'Events', filter: { excludeCategories: ['Exhibition'] } }
  ],
  sticky: 'tabs',
  mobilePanel: true,
  clearAll: 'Reset',
  urlState: {
    tab: 'type', category: 'category', search: 'q',
    tags: { Theme: 'theme', Area: 'area', Selection: 'selection' }
  }
}
```

- Global controls use the union of items admitted by the tabs, after `preFilter`.
  Each tab keeps its own selection rule, sorting, card layout and grouping.
- Changing a tab preserves category, tag, year and search criteria. Initial
  defaults apply once; removing a chip or resetting does not reapply them.
- Counts apply the same active criteria to every tab, before pagination. Tabs
  may overlap by configuration: adding their counts need not give a unique total.
- An inactive tab with an exact zero is disabled. When filtering empties the
  current tab but another has results, Query switches to the first nonempty
  tab. If all tabs are empty, the active tab stays usable and chips explain
  the selection. `tabCounts: false` opts out of counts and this automatic switch.
- Controls, chips and tabs are in that DOM order. With `sticky: 'tabs'`, only
  the tabs and mobile toggle stick; existing sticky-state background rules
  apply. Group headings keep their normal block behavior.
- With `mobilePanel: true`, the same controls move into the existing panel.
  They are not duplicated. Closing restores their values and keyboard focus;
  Escape closes the panel and Tab stays within its controls while open.
- Hidden prefix criteria still filter, appear as chips, and can be removed.
  Each chip announces the criterion it removes. `i18n.removeFilter` and
  `i18n.activeFilters` translate their accessible labels. Removal/reset icons
  use `close` by default in this mode (`i18n.filterRemoveIcon` and
  `i18n.filterResetIcon` override it); install that Material Symbol through
  the site's `--ui-font-font-family` convention.

#### Data, counts and performance

Exact counts require the complete **data index**, not all rendered cards.
Query's existing filter-index loader is reused. In shared mode the loaded
index also supplies the current page of results, avoiding a second traversal
of collection pages. Only the active tab and requested pagination slice are
rendered; inactive tabs have no hidden card tree. Images are not loaded merely
for counting.

`performance.filterIndex: false` / `'progressive'` and
`filterIndexMaxPages` remain available to bound data loading. When the index
is incomplete or a source fails, counts use a lower bound such as `4+` or `0+`.
These are not exact totals, so Query neither disables nor automatically chooses
a tab on their basis. As additional data arrives, counts are refreshed.
For very large collections, measure index size and latency before enabling
exact counts; shared filters do not make unbounded data loading free.

Criteria across category, tag prefixes and search combine with AND. Within one
prefix, an array of selected values combines with OR and counts each item once.
Repeated mapped URL parameters preserve those values; chips remove them individually.
A configured tab's `tagValuesAny` also combines with OR.
A date-prefix value matches the tagged calendar day, not an exhibition's
opening hours or a date interval. Domain-specific mappings such as an opening
reception represented by an exhibition tag remain site integration work.

#### Common selection service

Query delegates its predicates to `CollectionBlocks.selection`:

```js
const state = { category: null, tags: { Theme: 'Photography' }, search: '' };
const matches = CollectionBlocks.selection.filter(items, state, filters);
const admitted = CollectionBlocks.selection.matchesConfigured(item, tab.filter, {
  timeZone: 'Europe/Zurich', now: new Date()
});
```

`matches(item, state, filters)` is the boolean UI predicate; `filter` returns
matching items in the supplied order without modifying them.
`matchesConfigured(item, rule, context)` applies prefilter/tab-style rules;
`publicationYear(item, options)` returns a year or null. Items use the existing
normalized Collection Blocks fields (`categories`, `tags`, `publishOn`, etc.).
The service is pure: no DOM, fetch, URL navigation or extra card renderer.
Query retains a fallback for older core versions, but use matching assets when
activating the new shared mode. Related and Locator keep their current filters;
this release does not create a cross-block controller.

The optional remote Explorer below uses the same predicates and Query controls.
It is not installed or activated by `scope: 'all-tabs'`. There is still no public
controller for synchronizing several result blocks on the same page.

Verification: `tests/selection.test.cjs` checks predicate parity and timezone
rules; `tests/browser-shared-filters.html` checks counts, DOM limits, pagination,
URL/history, empty results, hidden criteria, defaults, rapid changes and mobile
control identity. These fixtures are development checks, not site installs.


### Optional filter adaptation and presentation (v0.7.0)

These options extend Query and the common selection service; they do not add
another card renderer. Install matching core 0.22, Query and CSS from v0.7.0.
Existing configurations keep their previous behavior when these options are absent.

| Filter option | Default | Purpose |
| --- | --- | --- |
| `projectItem(item, state)` | absent | Pure metadata projection for matching and filter choices. Return an item-shaped object; never mutate the source. Cards retain their original fields. |
| `searchMode` | phrase | `'words'` requires each word, in any order, and strips HTML from the searchable text. Search uses the original item. |
| `optionCounts` | false | Recalculate dropdown option counts with the other current criteria. Exact empty choices are disabled; incomplete counts retain `+`. |
| `controlSizing` | fixed | `'content'` measures the selected label with its actual typeface and sets `--cb-filter-control-width` on its wrapper. CSS controls minimum and maximum widths. |
| `mobilePanelApply` | false | Add a result-count button to the shared mobile panel. Pending search text is applied before closing. |
| `returnToFilters` | false | With shared sticky tabs, add a button that scrolls/focuses the filters. The existing mobile toggle is used on mobile. |
| `resolveView(state, tab)` | absent | Pure choice of `sort`, `groups`, `groupBy`, `groupOrder` for the current criteria. Returning null restores the configured tab presentation. |

`categories.values` and each prefix descriptor's `values` can explicitly set the
available choices. Prefix descriptors also accept `label` and `allLabel`.
Data-derived choices and existing `order` remain the default. Explicit choices
are configuration, not a claim that every value has results.

`projectItem` is a narrow integration boundary: for example, a site can expose
an opening reception stored as a tag as a virtual filter category, or map a
published date interval to configured edition days. The common predicate still
combines all criteria and supplies both results and counts. It does not infer
opening hours. The callback must be synchronous, deterministic, inexpensive and
free of DOM/network operations. Use an immutable/cached projection for larger
indexes. `CollectionBlocks.selection.project(item, state, filters)` exposes the
same projection to future controllers.

Dropdown counts cost a metadata pass per option. They are opt-in: measure them
before using large indexes or hundreds of choices. This work does not create
hidden cards, request images or fetch an independent collection index.

For date-tag grouping, `groupBy.filterPrefix` can identify a different selected
prefix that limits visible day groups. `groupBy.scopeDates: true` limits the
rendered card's grouping-prefix dates to its day and sorts occurrences within
that group; it leaves the source unchanged. `sort.filterPrefix` similarly limits
the tag dates used for sorting to selected days. Multiple days use OR. Other
grouping modes keep their existing behavior. `groupBy.headingLevel` sets the
accessible heading level (default 3).

The shared mobile panel moves both the original controls and their active chips;
no duplicate input IDs are introduced. Labels are configurable through
`i18n.returnToFilters`, `filterReturnIcon` (default `tune`) and `filterApply`
(default `Voir les résultats`). Install the needed icon glyphs on the site.

`tests/browser-filter-projection.html` covers virtual metadata, combined links,
facet counts, date groups, responsive controls and pending mobile search. Domain
rules and client configurations remain outside this public repository.


## Remote Explorer (optional, v0.8.0)

Explorer prepares a selection here and opens its results on another page.
It uses **Query's source loading, selection rules, controls and URL mapping**;
it never builds result cards or a hidden grid. Internal filters above Query tabs
remain part of Query itself. Explorer is optional for pages with remote forms
or links, and currently targets Query destinations only.

Install matching shared core, CSS and Query first, then load
`extension-explorer.js` and `extension-explorer.css` on pages that need Explorer.
Use immutable release URLs in production. No third-party library is required.
Unlike layout modules in `extensions`, this component has its own target:

```html
<div id="programme-explorer"></div>
```

```js
/* ==================================================
   QB — Homepage — Remote programme filters
   ================================================== */
window.CB_EXPLORER_CONFIGS = [{
  target: '#programme-explorer',
  destination: '/programme',
  query: 'programme',
  layout: 'form',
  hideSubmitWhenEmpty: true
}];
```

`query` is either a Query configuration object or its key in
`QUERY_BLOCK_CONFIGS`. That definition must be available on both pages, with the
same source, prefilter, tab membership, projection and `filters.urlState`
mapping. Its result target need not exist on the homepage. Do not duplicate or
change its selection rules in Explorer. Set `performance.maxPages: 'all'` for
exact complete counts when collection size permits; a bounded source keeps `+`
counts and never disables a choice based on an incomplete zero.

Form presentation reuses `filters.categories`, `tagPrefixes`, `controlOrder`,
`labelPosition`, `optionCounts`, `controlSizing`, `clearAll`, `activeChips`,
`search` and Query's `i18n`. Sticky tabs and card settings do not apply here.
`mobilePanel: true` on the Explorer opts into the existing panel; the default
keeps its compact form visible. Styles inherit common filters; site decoration
belongs in the site's Custom CSS.

| Explorer option | Meaning |
| --- | --- |
| `target`, `destination`, `query` | Required mounting point, results URL and shared Query definition. |
| `layout` | `form` (default) or `links`. |
| `state` | Initial `{ category, tags, search, tabIndex }`; defaults to no criteria. |
| `hideSubmitWhenEmpty` | Hide the form action until a criterion is selected. |
| `mobilePanel` | Opt into the common mobile panel. |
| `counts` | Show link counts by default; `false` omits them. |
| `hideEmpty` | Hide a link only when its complete count is zero. |
| `i18n` | Optional `loading`, `results`, `empty`, `unavailable`, `fallback`, `form`, `links` labels. |
| `onChange` | Receives copied `state`, `summary` and destination `href`. |
| `data` | Advanced reuse: a snapshot or Promise of `{items, complete}` from `QueryBlock.filters.load(query)`. |

The submit control is a real link, so opening in a new tab works. Changing
criteria does not modify the homepage URL. It preserves unrelated destination
parameters and anchors, encodes repeated values, and chooses a nonempty result
tab when complete counts allow it. Partial counts are marked `+`; load failures
leave a plain link to the destination. Hidden criteria can remain as removable
chips. For overlapping tabs, the total counts each record once, so it need not
equal the sum of tab counts.

### Automatic and editorial links

To build a row from every `Year:` tag, without typing its values manually:

```js
/* ==================================================
   QB — Homepage — Programme by year
   ================================================== */
window.CB_EXPLORER_CONFIGS.push({
  target: '#programme-years',
  destination: '/programme',
  query: 'programme',
  layout: 'links',
  links: { prefix: 'Year', order: 'numeric', direction: 'desc' }
});
```

The destination must map that prefix in `filters.urlState.tags`. Omit `prefix`
to enumerate categories. `values` supplies a controlled list instead of automatic
values; `include` / `exclude` restrict it. `order` accepts an explicit list,
`'numeric'` or alphabetical ordering; `direction: 'desc'` reverses the latter two.
`formatLabel(value)` changes display only. `state` supplies shared base criteria.

For explicit selections, use `links.items`:

```js
links: {
  items: [{
    label: 'Partner selection',
    description: 'Thursday evening',
    state: { tags: { Selection: 'Partner name' } }
  }]
}
```

Each explicit item supplies its full selection, including combined tags or
categories. Dates can be explicit values or items; Explorer does not invent an
edition calendar or opening hours. Illustrated editorial cards should continue
using Query/Related's existing media and `sourceUrl` features. This module does
not add another card or video renderer.

### Programmatic use and lifecycle

`CBExplorer.mount(target, options)` returns an idempotent controller with
`ready`, `getState()`, `getSummary()`, `setState(next)`, `href(next)`,
`subscribe(listener)` and `destroy()`. Setters replace the whole selection;
state reads are copied. Removing its target releases controls, panel, timers,
listeners and observer. `CBExplorer.init()` mounts `CB_EXPLORER_CONFIGS` on
DOMContentLoaded and Squarespace navigation. There is no automatic refresh of
an already loaded source snapshot during a visit.

`QueryBlock.filters` exposes `load(config)`, `cloneState(state)`,
`summary(items, config, state, complete)`,
`href(address, config, state, complete, items)`,
`readURL(filters, fallbackTabIndex, address)` and `mount(target, options)` for
this integration. `mount` receives `{config, items, complete, state, mobilePanel,
onChange}` and returns control lifecycle methods; it does not control a live
result grid. Metadata must use Query's normalized fields; prefer `load` over
supplying raw CMS records, particularly for text search and date handling.

`tests/browser-explorer.html` verifies metadata-only rendering, source/destination
count parity, combined URLs, hidden chips, incomplete counts, automatic links,
remounts and panel cleanup. Browser and site checks still accompany deployment.
