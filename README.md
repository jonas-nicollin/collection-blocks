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
| `metadata-block.js` | Metadata Block | Independent page/item metadata from the current Squarespace JSON. |

Development files can keep the `dev_*` prefix. Public/release files should use the stable names above.

## Recommended Repository Layout

`dist/` is the folder that contains the files meant to be loaded by Squarespace or jsDelivr.

```txt
dist/
  collection-blocks.js
  collection-blocks.css
  query-block.js
  related-block.js
  locator-block.js
  metadata-block.js

dev/
  dev_collection-blocks-v008.js
  dev_collection-blocks-v005.css
  dev_query-block-v066.js
  dev_related-block-v088.js
  dev_locator-block-v047.js

README.md
CHANGELOG.md
LICENSE
```

Keeping development versions and stable release files in the same repository is fine. The important rule is to load only the stable files from `dist/` on production sites, or to load a clearly versioned development file while testing.

## Configuration Globals

| Script | Global |
| --- | --- |
| Query Block | `window.QUERY_BLOCK_CONFIGS = []` |
| Related Block | `window.RELATED_BLOCK_CONFIGS = []` |
| Locator Block | `window.LOCATOR_BLOCK_CONFIGS = []` |
| Metadata Block | `window.metadataBlocksSettingsList = []` |

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
| `datePrefix` | `null` | Prefix treated as ISO date values for sorting/display. |
| `search` | enabled unless `false` | Full-text search across title, excerpt, location, categories, tags. |
| `tabs` | `[]` | Tab definitions. |
| `defaultTab` | `0` | Initial tab index. |
| `defaultCategory` | none | Initial category filter. |
| `defaultTags` | `{}` | Initial tag-prefix filters. |
| `mobilePanel` | `false` | Moves secondary filters into a mobile panel. |
| `mobilePanelBreakpoint` | `768` | Pixel breakpoint, or `'always'`. |
| `sticky` | `false` | Makes the filter wrapper sticky. |
| `stickyTop` | `'0px'` | Sticky offset. |
| `clearAll` | `false` | Adds a reset control. Can be a custom label string. |

### Query Tag Prefix Definition

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | required | Tag prefix, for example `'Date'`. |
| `label` | prefix | Visible label. |
| `showLabel` | `true` | Hides label when `false`. |
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
| `tagPrefixes` | global filters | Filter controls visible for this tab. |

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

## CSS Class Model

Common classes start with `cb-*`. Block-specific classes are added alongside them.

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
