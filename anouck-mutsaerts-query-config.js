window.QUERY_BLOCK_CONFIGS = (window.QUERY_BLOCK_CONFIGS || []).concat([
  {
    key: 'qb-am-work-index-creative-direction',
    target: '#qb-am-work-index-creative-direction',
    label: 'Work Index – Creative direction',
    heading: false,
    preFilter: { categories: ['Creative direction'] },
    filters: false,
    display: {
      counter: false,
      layout: 'grid',
      cardClasses: { categories: true },
      groups: [
        { role: 'media', children: [{ type: 'media', ratio: 'var(--am-work-index-ratio, 4 / 5)' }] },
        { role: 'body', children: ['title'] }
      ]
    },
    sort: { type: 'random' },
    pagination: { mode: 'none' },
    performance: { maxPages: 'all', lazyInit: false },
    sourceCollection: { path: '/work-index' },
    classes: {
      block: 'am-work-index-block am-work-index-block--creative-direction',
      card: 'am-work-index-card'
    },
    i18n: { noResults: 'No creative direction projects available' }
  },
  {
    key: 'qb-am-work-index-styling',
    target: '#qb-am-work-index-styling',
    label: 'Work Index – Styling',
    heading: false,
    preFilter: { categories: ['Styling'] },
    filters: false,
    display: {
      counter: false,
      layout: 'grid',
      cardClasses: { categories: true },
      groups: [
        { role: 'media', children: [{ type: 'media', ratio: 'var(--am-work-index-ratio, 4 / 5)' }] },
        { role: 'body', children: ['title'] }
      ]
    },
    sort: { type: 'random' },
    pagination: { mode: 'none' },
    performance: { maxPages: 'all', lazyInit: false },
    sourceCollection: { path: '/work-index' },
    classes: {
      block: 'am-work-index-block am-work-index-block--styling',
      card: 'am-work-index-card'
    },
    i18n: { noResults: 'No styling projects available' }
  }
]);
