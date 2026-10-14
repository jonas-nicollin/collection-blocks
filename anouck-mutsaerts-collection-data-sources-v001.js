window.COLLECTION_DATA = Object.assign({}, window.COLLECTION_DATA || {}, {
  manifest: {
    url: 'https://collection-data.pages.dev/data/manifest.json',
    ttl: 60
  },
  collections: Object.assign(
    {},
    (window.COLLECTION_DATA && window.COLLECTION_DATA.collections) || {},
    {
      '/work-index': 'https://collection-data.pages.dev/data/collections/anouck-mutsaerts/work-index.json'
    }
  )
});
