/* Collection Blocks — Shared Google Maps loader and presentation (optional). */
(function () {
  'use strict';
  if (window.CollectionBlocksMap) return;
  var pending;
  var clean = [
    {featureType: 'poi', stylers: [{visibility: 'off'}]},
    {featureType: 'poi.park', elementType: 'geometry', stylers: [{visibility: 'on'}]},
    {featureType: 'poi.park', elementType: 'labels', stylers: [{visibility: 'off'}]},
    {featureType: 'transit', elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
    {featureType: 'transit.station', elementType: 'labels.text', stylers: [{visibility: 'off'}]},
    {featureType: 'road', elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
    {featureType: 'administrative.neighborhood', stylers: [{visibility: 'off'}]},
    {featureType: 'administrative.land_parcel', stylers: [{visibility: 'off'}]}
  ];
  function config(local) {
    var result = Object.assign({}, window.COLLECTION_BLOCKS_MAP_CONFIG || {});
    Object.keys(local || {}).forEach(function (key) {
      if (local[key] !== undefined) result[key] = local[key];
    });
    return result;
  }
  function load(local) {
    if (window.google && window.google.maps && window.google.maps.Map) {
      return Promise.resolve(window.google.maps);
    }
    if (pending) return pending;
    var settings = config(local);
    if (!settings.apiKey) return Promise.reject(new Error('Google Maps API key missing'));
    pending = new Promise(function (resolve, reject) {
      var script = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      var timer, poll, ownScript = false;
      var callback = '__cbGoogleMapsReady';
      function ready() {
        if (window.google && window.google.maps && window.google.maps.Map) {
          clearTimeout(timer);
          clearTimeout(poll);
          resolve(window.google.maps);
          return true;
        }
        return false;
      }
      function fail() {
        clearTimeout(timer);
        clearTimeout(poll);
        if (ownScript) { script.remove(); delete window[callback]; }
        pending = null;
        reject(new Error('Google Maps unavailable'));
      }
      timer = setTimeout(fail, 20000);
      if (script) {
        // Reuse an existing loader instead of inserting a second API script.
        var checks = 0;
        (function check() {
          if (!ready() && ++checks < 200) poll = setTimeout(check, 100);
        })();
        return;
      }
      ownScript = true;
      window[callback] = function () { delete window[callback]; ready(); };
      script = document.createElement('script');
      script.async = true;
      script.src = 'https://maps.googleapis.com/maps/api/js?loading=async&callback='
        + callback + '&key=' + encodeURIComponent(settings.apiKey)
        + (settings.language ? '&language=' + encodeURIComponent(settings.language) : '');
      script.onerror = function () { script.remove(); delete window[callback]; fail(); };
      document.head.appendChild(script);
    });
    return pending;
  }
  function options(local, defaults) {
    var settings = config(local);
    var result = Object.assign({mapTypeControl: false, streetViewControl: false,
      clickableIcons: false, gestureHandling: 'cooperative'}, defaults || {},
      settings.options || {});
    if (settings.mapId) {
      result.mapId = settings.mapId;
      delete result.styles;
    } else if (settings.style === 'clean' || Array.isArray(settings.style)) {
      result.styles = settings.style === 'clean' ? clean : settings.style;
    }
    return result;
  }
  window.CollectionBlocksMap = {load: load, options: options};
})();
