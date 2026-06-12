/*!
 * Location Block v4.0.0-dev.6
 * github.com/jonas-nicollin/squarespace-blocks
 *
 * Affiche les informations d'un lieu sur une page Squarespace.
 *
 * Sources: csv | google-sheet-csv | json | sheetbest | inline
 * Matching: par defaut, lit le JSON de la page courante (?format=json)
 *           et cherche un tag prefixe configure, par exemple "Lieu:".
 *
 * Configuration recommandee:
 *   window.LOCATION_BLOCK_CONFIGS = [{
 *     mount: '.location-block',
 *     source: {
 *       type: 'csv',
 *       url: 'https://docs.google.com/spreadsheets/d/e/.../pub?output=csv'
 *     },
 *     match: {
 *       pageSource: 'tags',
 *       prefix: 'Lieu:',
 *       dataField: 'title',
 *       normalize: 'slug'
 *     }
 *   }];
 *
 */
(function(){
'use strict';

var FOUR_HOURS = 4 * 60 * 60 * 1000;
var VERSION = '4.0.0-dev.6';
var DEFAULT_MOUNT = '.location-block';
var DEFAULT_COUNTRY = 'Suisse';
var DATA_CACHE_PREFIX = 'location_block_v4_data_';
var PAGE_JSON_PROMISES = {};

var DAY_KEYS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
var DAY_FULL = {lundi:'Lundi',mardi:'Mardi',mercredi:'Mercredi',jeudi:'Jeudi',vendredi:'Vendredi',samedi:'Samedi',dimanche:'Dimanche'};
var EN_FR = {monday:'lundi',tuesday:'mardi',wednesday:'mercredi',thursday:'jeudi',friday:'vendredi',saturday:'samedi',sunday:'dimanche'};

var DEFAULT_COLUMNS = {
  title: ['Location','Lieu','Title','Name','Nom'],
  zone: ['Zone','Area'],
  address1: ['Address','Adresse','address1'],
  address2: ['Address 2','Adresse 2','address2'],
  postalCode: ['Postal Code','Code postal','Postcode','ZIP','Zip','postalCode'],
  city: ['City','Ville'],
  country: ['Country','Pays','address3'],
  phone: ['Phone','Telephone','Téléphone','Tel','Tel.'],
  website: ['Website','Site internet','URL'],
  email: ['Email','Adresse électronique','Adresse electronique','Adresse email'],
  mapUrl: ['Google Maps URL','Google Maps','Lien: Google Maps','mapUrl'],
  latitude: ['Latitude','Lat'],
  longitude: ['Longitude','Lng','Long'],
  instagram: ['Instagram'],
  monday: ['Monday','Lundi','lundi'],
  tuesday: ['Tuesday','Mardi','mardi'],
  wednesday: ['Wednesday','Mercredi','mercredi'],
  thursday: ['Thursday','Jeudi','jeudi'],
  friday: ['Friday','Vendredi','vendredi'],
  saturday: ['Saturday','Samedi','samedi'],
  sunday: ['Sunday','Dimanche','dimanche'],
  slug: ['Slug','slug','Key','ID','Id'],
  image: ['Image','Image URL','Photo'],
  imagePosition: ['Image Position','Image position','Focal Point']
};

var FIELD_TO_DAY = {
  monday: 'lundi',
  tuesday: 'mardi',
  wednesday: 'mercredi',
  thursday: 'jeudi',
  friday: 'vendredi',
  saturday: 'samedi',
  sunday: 'dimanche'
};

var DEFAULT_CONFIG = {
  id: '',
  mount: DEFAULT_MOUNT,
  source: {type: 'json', url: '', data: null},
  columns: {},
  match: {
    pageSource: 'tags',
    prefix: 'Lieu:',
    dataField: 'title',
    column: '',
    normalize: 'slug'
  },
  timeZone: '',
  noCache: false,
  cacheTTL: FOUR_HOURS,
  cache: {
    ttl: FOUR_HOURS,
    staleWhileRevalidate: true
  },
  showMap: true,
  mapQuery: 'coordinates-first',
  lazyMap: false,
  lazyMapRootMargin: '400px',
  lazyMapPlaceholder: 'Carte',
  showMapLink: true,
  mapLinkUrl: 'auto',
  showStatus: true,
  showSocialLinks: false,
  collapseHours: true,
  useFetchForSlug: true,
  fallbackCountry: DEFAULT_COUNTRY
};

function escHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function toSlug(s){
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function normHeader(s){
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'');
}

function normalizeMatchValue(value, mode){
  if(mode === 'raw') return String(value || '').trim();
  return toSlug(value);
}

function stableHash(s){
  var h = 0, i, chr;
  if(!s) return '0';
  for(i = 0; i < s.length; i++){
    chr = s.charCodeAt(i);
    h = ((h << 5) - h) + chr;
    h |= 0;
  }
  return String(Math.abs(h));
}

function mergeObjects(a, b){
  var out = {};
  Object.keys(a || {}).forEach(function(k){out[k] = a[k];});
  Object.keys(b || {}).forEach(function(k){out[k] = b[k];});
  return out;
}

function mergeColumns(defaults, overrides){
  var out = {};
  Object.keys(defaults || {}).forEach(function(key){
    out[key] = [].concat(defaults[key] || []);
  });
  Object.keys(overrides || {}).forEach(function(key){
    out[key] = [].concat(overrides[key] || [], out[key] || []);
  });
  return out;
}

function normalizeSource(raw){
  if(raw.source && typeof raw.source === 'object'){
    return {
      type: raw.source.type || raw.source.dataSource || raw.dataSource || 'json',
      url: raw.source.url || raw.source.jsonUrl || raw.source.csvUrl || raw.jsonUrl || raw.csvUrl || '',
      data: raw.source.data || raw.source.lieuxData || raw.lieuxData || null
    };
  }
  return {
    type: raw.dataSource || 'json',
    url: raw.csvUrl || raw.jsonUrl || '',
    data: raw.lieuxData || null
  };
}

function normalizeMatch(rawMatch, rawConfig){
  var m = mergeObjects(DEFAULT_CONFIG.match, rawMatch || {});
  if(!m.prefix && m.pagePrefix) m.prefix = m.pagePrefix;
  if(!m.pageSource && m.source) m.pageSource = m.source;
  if(!m.column && (m.columnField || m.dataColumn)){
    m.column = m.columnField || m.dataColumn;
  }
  if(!m.dataField) m.dataField = 'title';
  return m;
}

function normalizeConfig(raw, index){
  raw = raw || {};
  var cfg = mergeObjects(DEFAULT_CONFIG, raw);
  cfg.id = cfg.id || raw.name || ('location-block-' + index);
  cfg.mount = raw.mount || raw.selector || DEFAULT_MOUNT;
  cfg.source = normalizeSource(raw);
  cfg.columns = mergeColumns(DEFAULT_COLUMNS, raw.columns || raw.columnMap || {});
  cfg.match = normalizeMatch(raw.match, raw);
  cfg.cache = mergeObjects(DEFAULT_CONFIG.cache, raw.cache || {});
  if(raw.cacheTTL != null) cfg.cache.ttl = raw.cacheTTL;
  if(raw.noCache != null) cfg.noCache = !!raw.noCache;
  return cfg;
}

function getConfigs(){
  var list = window.LOCATION_BLOCK_CONFIGS || null;
  if(Array.isArray(list)) return list.map(normalizeConfig);
  if(list && typeof list === 'object') return [normalizeConfig(list, 0)];
  return [];
}

function detectTZ(cfg){
  if(cfg.timeZone) return cfg.timeZone;
  try{
    var s = window.Static && window.Static.SQUARESPACE_CONTEXT;
    if(s && s.websiteTimeZone) return s.websiteTimeZone;
  }catch(_){}
  return 'UTC';
}

function normUrl(url){
  var v = String(url || '').trim();
  if(!v || v === '-') return '';
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}

function telHref(p){
  var d = String(p || '').replace(/[^\d+]/g,'');
  if(!d) return '';
  if(d.indexOf('+') === 0) return 'tel:' + d;
  if(d.indexOf('0') === 0 && d.length >= 9) return 'tel:+41' + d.slice(1);
  return 'tel:' + d;
}

var SW = [300,500,750,1000,1500];
function buildImgTag(lieu){
  if(!lieu.image) return '';
  var c = lieu.image.split('?')[0];
  var srcset = SW.map(function(w){return c + '?format=' + w + 'w ' + w + 'w';}).join(', ');
  var pos = lieu.imagePosition || '50% 50%';
  return '<img class="cb-card__img locb-card__img" src="' + escHtml(c) + '?format=750w" srcset="' + escHtml(srcset) + '" sizes="(max-width:768px) 100vw, 380px" loading="lazy" decoding="async" alt="' + escHtml(lieu.title) + '" style="object-position:' + escHtml(pos) + ';">';
}

function getNow(cfg){
  var tz = detectTZ(cfg);
  var fmt = new Intl.DateTimeFormat('en-GB',{timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  var parts = {};
  fmt.formatToParts(new Date()).forEach(function(p){if(p.type !== 'literal') parts[p.type] = p.value;});
  return {
    dayKey: EN_FR[(parts.weekday || '').toLowerCase()] || 'lundi',
    nowMinutes: parseInt(parts.hour || '0',10) * 60 + parseInt(parts.minute || '0',10)
  };
}

function toMin(v){
  var r = String(v || '').trim().toLowerCase().replace(/\s/g,'').replace(/h/g,':');
  var m = r.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if(!m) return null;
  var h = parseInt(m[1],10);
  var mn = parseInt(m[2] || '0',10);
  return (h > 23 || mn > 59) ? null : h * 60 + mn;
}

function parseSched(raw){
  var v = String(raw || '').trim();
  if(!v || /^[-–—]$/.test(v) || /^fermé$/i.test(v)) return {type: 'closed', label: 'Fermé'};
  if(/^sur rendez-vous$/i.test(v)) return {type: 'special', label: v};
  var n = v.replace(/[–—]/g,'-').replace(/\s*à\s*/gi,'-').replace(/\s*,\s*/g,',').trim();
  var ranges = [];
  var parts = n.split(',').map(function(s){return s.trim();}).filter(Boolean);
  for(var i = 0; i < parts.length; i++){
    var m = parts[i].match(/^([^-]+)-(.+)$/);
    if(!m) return {type: 'special', label: v};
    var s = toMin(m[1]);
    var e = toMin(m[2]);
    if(s === null || e === null) return {type: 'special', label: v};
    ranges.push({start: s, end: e});
  }
  return ranges.length ? {type: 'ranges', label: v, ranges: ranges} : {type: 'special', label: v};
}

function isOpen(sched, now){
  if(!sched || sched.type !== 'ranges') return false;
  return sched.ranges.some(function(r){return now >= r.start && now < r.end;});
}

function parseCSVRows(text){
  var rows = [];
  var row = [];
  var cell = '';
  var quoted = false;
  for(var i = 0; i < text.length; i++){
    var ch = text[i];
    if(ch === '"'){
      if(quoted && text[i + 1] === '"'){
        cell += '"';
        i++;
      }else{
        quoted = !quoted;
      }
    }else if(ch === ',' && !quoted){
      row.push(cell);
      cell = '';
    }else if((ch === '\n' || ch === '\r') && !quoted){
      if(ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    }else{
      cell += ch;
    }
  }
  if(cell || row.length){
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(function(r){
    return r.some(function(c){return String(c || '').trim();});
  });
}

function parseCSV(text){
  var rows = parseCSVRows(text);
  if(!rows.length) return [];
  var headers = rows[0].map(function(h){return String(h || '').trim();});
  return rows.slice(1).map(function(values){
    var o = {};
    values.forEach(function(v, i){
      var key = headers[i] != null ? headers[i] : String(i);
      o[key] = String(v || '').trim();
    });
    return o;
  });
}

function getByColumn(row, column){
  if(!column) return '';
  var names = Array.isArray(column) ? column : [column];
  var normalized = {};
  Object.keys(row || {}).forEach(function(k){normalized[normHeader(k)] = k;});
  for(var i = 0; i < names.length; i++){
    var name = names[i];
    if(row[name] != null && String(row[name]).trim() !== '') return String(row[name]).trim();
    var nk = normalized[normHeader(name)];
    if(nk && row[nk] != null && String(row[nk]).trim() !== '') return String(row[nk]).trim();
  }
  return '';
}

function getField(row, cfg, field){
  var column = cfg.columns && cfg.columns[field];
  return getByColumn(row, column);
}

function normLieu(row, cfg){
  var title = getField(row, cfg, 'title');
  var postalCode = getField(row, cfg, 'postalCode');
  var city = getField(row, cfg, 'city');
  var address2 = getField(row, cfg, 'address2') || [postalCode, city].filter(Boolean).join(' ');
  var explicitMatchValue = getByColumn(row, cfg.match.column);
  var canonical = {
    title: title,
    zone: getField(row, cfg, 'zone'),
    address1: getField(row, cfg, 'address1'),
    address2: address2,
    address3: getField(row, cfg, 'country') || cfg.fallbackCountry || '',
    mapUrl: getField(row, cfg, 'mapUrl'),
    latitude: getField(row, cfg, 'latitude'),
    longitude: getField(row, cfg, 'longitude'),
    phone: getField(row, cfg, 'phone'),
    email: getField(row, cfg, 'email'),
    website: getField(row, cfg, 'website'),
    instagram: getField(row, cfg, 'instagram'),
    image: getField(row, cfg, 'image'),
    imagePosition: getField(row, cfg, 'imagePosition')
  };

  Object.keys(FIELD_TO_DAY).forEach(function(field){
    canonical[FIELD_TO_DAY[field]] = getField(row, cfg, field) || '-';
  });

  var dataFieldValue = canonical[cfg.match.dataField] || title;
  var matchValue = explicitMatchValue || dataFieldValue;
  var slugValue = getField(row, cfg, 'slug') || matchValue;
  canonical.slug = normalizeMatchValue(slugValue, cfg.match.normalize);
  canonical.matchKey = normalizeMatchValue(matchValue, cfg.match.normalize);
  canonical.raw = row;
  return canonical;
}

function shouldKeepRow(row, cfg){
  var explicitMatchValue = getByColumn(row, cfg.match.column);
  return !!(explicitMatchValue || getField(row, cfg, 'title'));
}

function cacheKey(cfg){
  var source = cfg.source || {};
  return DATA_CACHE_PREFIX + stableHash([cfg.id, source.type, source.url].join('|'));
}

function cacheRead(cfg, allowStale){
  if(cfg.noCache || (cfg.source && cfg.source.type === 'inline')) return null;
  try{
    var raw = localStorage.getItem(cacheKey(cfg));
    if(!raw) return null;
    var entry = JSON.parse(raw);
    if(!entry || !entry.data) return null;
    if(allowStale || Date.now() <= Number(entry.expiresAt || 0)) return entry.data;
  }catch(_){}
  return null;
}

function cacheWrite(cfg, data){
  if(cfg.noCache || (cfg.source && cfg.source.type === 'inline')) return;
  try{
    localStorage.setItem(cacheKey(cfg), JSON.stringify({
      version: VERSION,
      expiresAt: Date.now() + Number(cfg.cache.ttl || cfg.cacheTTL || FOUR_HOURS),
      data: data
    }));
  }catch(_){}
}

async function fetchJson(url){
  var res = await fetch(url, {cache: 'default'});
  if(!res.ok) throw new Error('JSON inaccessible (' + res.status + ')');
  return res.json();
}

async function fetchText(url){
  var res = await fetch(url, {cache: 'default'});
  if(!res.ok) throw new Error('CSV inaccessible (' + res.status + ')');
  return res.text();
}

async function fetchLocations(cfg){
  var cached = cacheRead(cfg, false);
  if(cached) return cached;

  try{
    var source = cfg.source || {};
    var type = source.type || 'json';
    var rows;

    if(type === 'inline'){
      rows = Array.isArray(source.data) ? source.data : [];
    }else if(type === 'csv' || type === 'google-sheet-csv'){
      if(!source.url) throw new Error('source.url manquant pour la source CSV');
      rows = parseCSV(await fetchText(source.url));
    }else if(type === 'json' || type === 'sheetbest'){
      if(!source.url) throw new Error('source.url manquant pour la source JSON');
      var data = await fetchJson(source.url);
      rows = Array.isArray(data) ? data : (data.items || data.locations || data.lieux || data.result || []);
    }else{
      throw new Error('source.type inconnu: ' + type);
    }

    var lieux = rows.filter(function(row){return shouldKeepRow(row, cfg);}).map(function(row){return normLieu(row, cfg);});
    cacheWrite(cfg, lieux);
    return lieux;
  }catch(err){
    var stale = cfg.cache && cfg.cache.staleWhileRevalidate !== false ? cacheRead(cfg, true) : null;
    if(stale){
      console.warn('Location Block v' + VERSION + ': donnees fraiches indisponibles, cache expire utilise.', err);
      return stale;
    }
    throw err;
  }
}

function buildIndex(lieux){
  var index = {};
  lieux.forEach(function(lieu){
    if(lieu.matchKey) index[lieu.matchKey] = lieu;
    if(lieu.slug) index[lieu.slug] = lieu;
  });
  return index;
}

function getMetaMatch(cfg){
  var meta = document.querySelector('meta[name="location-block-key"]');
  if(!meta) return null;
  var c = (meta.getAttribute('content') || '').trim();
  if(!c) return null;
  var prefix = cfg.match.prefix || '';
  if(prefix && c.toLowerCase().indexOf(prefix.toLowerCase()) === 0){
    c = c.slice(prefix.length).trim();
  }
  return normalizeMatchValue(c, cfg.match.normalize);
}

function getCardMatch(card, cfg){
  var value = card.dataset.locationKey || card.getAttribute('data-location-key') || '';
  if(!value) return null;
  return normalizeMatchValue(value, cfg.match.normalize);
}

function getUrlPath(value){
  try{
    var url = new URL(value, window.location.origin);
    return url.pathname || '/';
  }catch(_){
    return '';
  }
}

function getPageJsonCandidatePaths(){
  var paths = [];
  function add(path){
    if(!path || paths.indexOf(path) !== -1) return;
    paths.push(path);
  }

  add(window.location.pathname || '/');

  var canonical = document.querySelector('link[rel="canonical"]');
  if(canonical) add(getUrlPath(canonical.getAttribute('href') || ''));

  var ogUrl = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
  if(ogUrl) add(getUrlPath(ogUrl.getAttribute('content') || ''));

  if(document.referrer) add(getUrlPath(document.referrer));

  return paths;
}

async function fetchPageJson(path){
  path = path || window.location.pathname || '/';
  if(!PAGE_JSON_PROMISES[path]){
    PAGE_JSON_PROMISES[path] = fetch(path + '?format=json', {cache: 'default'}).then(function(res){
      if(!res.ok) throw new Error('JSON page inaccessible (' + res.status + ')');
      return res.json();
    });
  }
  return PAGE_JSON_PROMISES[path];
}

async function fetchFirstPageJson(){
  var paths = getPageJsonCandidatePaths();
  var lastError = null;
  for(var i = 0; i < paths.length; i++){
    try{
      return await fetchPageJson(paths[i]);
    }catch(err){
      lastError = err;
    }
  }
  if(lastError) throw lastError;
  throw new Error('Aucun chemin JSON de page disponible');
}

function pickPageValues(json, source){
  var item = json && json.item ? json.item : {};
  if(source === 'categories') return item.categories || json.categories || [];
  return item.tags || json.tags || [];
}

function getContextObjects(){
  var ctx;
  try{
    ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
  }catch(_){
    ctx = null;
  }
  if(!ctx) return [];
  return [
    ctx.item,
    ctx.collectionItem,
    ctx.currentItem,
    ctx.page,
    ctx.currentPage,
    ctx
  ].filter(Boolean);
}

function pickContextValues(source){
  var key = source === 'categories' ? 'categories' : 'tags';
  var objects = getContextObjects();
  for(var i = 0; i < objects.length; i++){
    var obj = objects[i];
    if(Array.isArray(obj[key]) && obj[key].length) return obj[key];
    if(obj.item && Array.isArray(obj.item[key]) && obj.item[key].length) return obj.item[key];
  }
  return [];
}

function getValueByPrefix(values, prefix){
  values = Array.isArray(values) ? values : [];
  prefix = String(prefix || '');
  if(!prefix) return values.length ? String(values[0]).trim() : '';
  var lowerPrefix = prefix.toLowerCase();
  for(var i = 0; i < values.length; i++){
    var value = String(values[i] || '').trim();
    if(value.toLowerCase().indexOf(lowerPrefix) === 0){
      return value.slice(prefix.length).trim();
    }
  }
  return '';
}

async function getPageMatch(card, cfg){
  var cardMatch = getCardMatch(card, cfg);
  if(cardMatch) return cardMatch;

  var metaMatch = getMetaMatch(cfg);
  if(metaMatch) return metaMatch;

  if(!cfg.useFetchForSlug) return null;

  var contextValues = pickContextValues(cfg.match.pageSource || 'tags');
  var contextFound = getValueByPrefix(contextValues, cfg.match.prefix);
  if(contextFound) return normalizeMatchValue(contextFound, cfg.match.normalize);

  try{
    var json = await fetchFirstPageJson();
    var values = pickPageValues(json, cfg.match.pageSource || 'tags');
    var found = getValueByPrefix(values, cfg.match.prefix);
    return found ? normalizeMatchValue(found, cfg.match.normalize) : null;
  }catch(err){
    console.warn('Location Block v' + VERSION + ': impossible de lire le JSON de page.', err);
    return null;
  }
}

function buildHours(lieu, now, cfg){
  var dk = now.dayKey;
  var nm = now.nowMinutes;
  var ti = DAY_KEYS.indexOf(dk);
  var ordered = [DAY_KEYS[ti]].concat(DAY_KEYS.slice(0,ti)).concat(DAY_KEYS.slice(ti + 1));
  var rows = ordered.map(function(day){
    var isToday = day === dk;
    var sched = parseSched(lieu[day] || '-');
    var displayValue = sched.type === 'closed' ? 'Fermé' : sched.label;
    var open = isToday && cfg.showStatus ? isOpen(sched, nm) : null;
    var status = (isToday && cfg.showStatus && sched.type !== 'special')
      ? '<span class="locb-card__status ' + (open ? 'is-open' : 'is-closed') + '">' + (open ? 'Ouvert' : 'Fermé') + '</span>'
      : '';
    var hiddenClass = (!isToday && cfg.collapseHours) ? ' is-hidden' : '';
    return '<div class="locb-card__hours-row' + (isToday ? ' is-today' : '') + hiddenClass + '"><span class="locb-card__hours-day">' + escHtml(DAY_FULL[day]) + '</span><span class="locb-card__hours-value">' + escHtml(displayValue) + status + '</span></div>';
  });
  var toggle = cfg.collapseHours
    ? '<button class="locb-card__hours-toggle" type="button" aria-expanded="false"><span class="locb-card__hours-toggle-label">Tous les horaires</span><span class="ui-icon locb-card__icon" aria-hidden="true">expand_more</span></button>'
    : '';
  return '<div class="locb-card__hours-panel">' + rows.join('') + toggle + '</div>';
}

function validCoordinate(value, min, max){
  var n = parseFloat(String(value || '').replace(',', '.'));
  return isFinite(n) && n >= min && n <= max ? n : null;
}

function getMapSrc(lieu, cfg){
  var lat = validCoordinate(lieu.latitude, -90, 90);
  var lng = validCoordinate(lieu.longitude, -180, 180);
  var query;

  if(cfg.mapQuery !== 'address' && lat !== null && lng !== null){
    query = lat + ',' + lng;
  }else{
    query = lieu.title + ', ' + [lieu.address1, lieu.address2, lieu.address3].filter(Boolean).join(', ');
  }

  var q = encodeURIComponent(query);
  return 'https://maps.google.com/maps?q=' + q + '&output=embed&hl=fr&z=14&iwloc=B';
}

function buildMapIframe(src, title){
  return '<iframe class="locb-card__map-iframe" src="' + escHtml(src) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="' + escHtml(title) + '"></iframe>';
}

function buildMap(lieu, cfg){
  var src = getMapSrc(lieu, cfg);
  var title = 'Carte - ' + lieu.title;
  if(cfg.lazyMap){
    return '<div class="locb-card__map locb-card__map--lazy" data-map-src="' + escHtml(src) + '" data-map-title="' + escHtml(title) + '" aria-label="' + escHtml(title) + '"><div class="locb-card__map-placeholder">' + escHtml(cfg.lazyMapPlaceholder || 'Carte') + '</div></div>';
  }
  return '<div class="locb-card__map">' + buildMapIframe(src, title) + '</div>';
}

function buildCard(lieu, cfg){
  var now = getNow(cfg);
  var imgTag = buildImgTag(lieu);
  var titleHtml = lieu.title ? '<div class="cb-card__title locb-card__title">' + escHtml(lieu.title) + '</div>' : '';
  var mediaHtml = imgTag ? '<div class="cb-card__media locb-card__media">' + imgTag + titleHtml + '</div>' : '';
  var addr = [lieu.address1, lieu.address2, lieu.address3].filter(Boolean).map(escHtml).join('<br>');
  var addrHtml = lieu.mapUrl
    ? '<a class="cb-card__link locb-card__address-link" href="' + escHtml(lieu.mapUrl) + '" target="_blank" rel="noopener noreferrer">' + addr + '</a>'
    : '<div class="locb-card__address">' + addr + '</div>';
  var phoneHref = telHref(lieu.phone);
  var phoneHtml = (lieu.phone && phoneHref) ? '<div class="locb-card__contact-line"><a href="' + escHtml(phoneHref) + '">' + escHtml(lieu.phone) + '</a></div>' : '';
  var emailHtml = lieu.email ? '<div class="locb-card__contact-line"><a href="mailto:' + escHtml(lieu.email) + '">' + escHtml(lieu.email) + '</a></div>' : '';
  var websiteUrl = normUrl(lieu.website);
  var websiteHtml = websiteUrl ? '<div class="locb-card__contact-line"><a href="' + escHtml(websiteUrl) + '" target="_blank" rel="noopener noreferrer">' + escHtml(lieu.website) + '</a></div>' : '';
  var instagramUrl = lieu.instagram ? 'https://instagram.com/' + lieu.instagram.replace(/^@/,'') : '';
  var instagramHtml = (cfg.showSocialLinks && instagramUrl) ? '<div class="locb-card__contact-line"><a href="' + escHtml(instagramUrl) + '" target="_blank" rel="noopener noreferrer">@' + escHtml(lieu.instagram.replace(/^@/,'')) + '</a></div>' : '';
  var hasContact = lieu.phone || lieu.email || lieu.website || (cfg.showSocialLinks && lieu.instagram);

  var mapLinkTarget = '';
  var mapLinkHref = '';
  if(cfg.showMapLink){
    if(cfg.mapLinkUrl && cfg.mapLinkUrl !== 'auto'){
      mapLinkHref = escHtml(cfg.mapLinkUrl);
    }else if(lieu.mapUrl){
      mapLinkHref = escHtml(lieu.mapUrl);
      mapLinkTarget = ' target="_blank" rel="noopener noreferrer"';
    }
  }
  var mapLink = (cfg.showMapLink && mapLinkHref)
    ? '<div class="locb-card__maplink-wrap"><a class="cb-card__link locb-card__maplink" href="' + mapLinkHref + '"' + mapLinkTarget + '><span>Voir sur la carte</span><span class="ui-icon locb-card__icon" aria-hidden="true">chevron_right</span></a></div>'
    : '';

  return '<article class="cb-card locb-card">' +
    mediaHtml +
    '<div class="cb-card__body locb-card__body">' +
      '<div class="cb-card__group locb-card__section"><span class="ui-icon locb-card__icon" aria-hidden="true">location_on</span><div class="locb-card__content">' + addrHtml + '</div></div>' +
      '<div class="cb-card__group locb-card__section"><span class="ui-icon locb-card__icon" aria-hidden="true">schedule</span><div class="locb-card__content">' + buildHours(lieu, now, cfg) + '</div></div>' +
      (hasContact ? '<div class="cb-card__group locb-card__section"><span class="ui-icon locb-card__icon" aria-hidden="true">contact_page</span><div class="locb-card__content">' + phoneHtml + emailHtml + websiteHtml + instagramHtml + '</div></div>' : '') +
      mapLink +
    '</div>' +
    (cfg.showMap ? buildMap(lieu, cfg) : '') +
  '</article>';
}

function loadLazyMap(map){
  if(!map || map.dataset.mapLoaded === 'true') return;
  var src = map.getAttribute('data-map-src');
  if(!src) return;
  var title = map.getAttribute('data-map-title') || 'Carte';
  map.innerHTML = buildMapIframe(src, title);
  map.dataset.mapLoaded = 'true';
}

function bindLazyMaps(card, cfg){
  if(!cfg.lazyMap) return;
  var maps = Array.from(card.querySelectorAll('.locb-card__map--lazy'));
  if(!maps.length) return;
  if(!('IntersectionObserver' in window)){
    maps.forEach(loadLazyMap);
    return;
  }
  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting) return;
      loadLazyMap(entry.target);
      observer.unobserve(entry.target);
    });
  }, {rootMargin: cfg.lazyMapRootMargin || '400px'});
  maps.forEach(function(map){observer.observe(map);});
}

function bindToggle(card){
  var t = card.querySelector('.locb-card__hours-toggle');
  if(!t) return;
  var p = card.querySelector('.locb-card__hours-panel');
  if(!p) return;
  t.addEventListener('click', function(){
    var open = t.getAttribute('aria-expanded') !== 'true';
    t.setAttribute('aria-expanded', String(open));
    p.querySelectorAll('.locb-card__hours-row.is-hidden,.locb-card__hours-row.is-visible').forEach(function(r){
      r.classList.toggle('is-hidden', !open);
      r.classList.toggle('is-visible', open);
    });
  });
}

function isEdit(){
  return document.documentElement.classList.contains('squarespace-edit-mode-active') ||
    document.body.classList.contains('squarespace-edit-mode-active');
}

function findImgBlock(card){
  var b = card.closest('.sqs-block');
  if(!b) return null;
  var sel = '.image-block img,.sqs-block-image img';
  for(var p = b.previousElementSibling; p; p = p.previousElementSibling){
    if(p.querySelector(sel)){
      if(!isEdit()) p.style.display = 'none';
      return p;
    }
  }
  return null;
}

function getImgSrc(block){
  if(!block) return '';
  var img = block.querySelector('.image-block img,.sqs-block-image img');
  return img ? (img.currentSrc || img.src || img.dataset.src || '') : '';
}

async function renderCard(card, index, cfg){
  card.classList.add('location-block', 'locb-block');
  var key = await getPageMatch(card, cfg);
  var lieu = key ? index[key] || null : null;
  if(!lieu){
    console.warn('Location Block v' + VERSION + ': lieu introuvable', {key: key, config: cfg.id});
    card.innerHTML = '<p class="locb-card__error">Lieu introuvable.</p>';
    return;
  }
  if(!lieu.image){
    var ib = findImgBlock(card);
    if(ib) lieu.image = getImgSrc(ib);
  }
  card.innerHTML = buildCard(lieu, cfg);
  bindToggle(card);
  bindLazyMaps(card, cfg);
}

async function initConfig(cfg){
  var cards = Array.from(document.querySelectorAll(cfg.mount || DEFAULT_MOUNT));
  if(!cards.length) return;
  var lieux;
  try{
    lieux = await fetchLocations(cfg);
  }catch(err){
    console.error('Location Block v' + VERSION + ':', err);
    cards.forEach(function(c){
      c.classList.add('location-block', 'locb-block');
      c.innerHTML = '<p class="locb-card__error">Impossible de charger les informations du lieu.</p>';
    });
    return;
  }
  var index = buildIndex(lieux);
  await Promise.all(cards.map(function(card){return renderCard(card, index, cfg);}));
}

async function init(){
  var configs = getConfigs();
  if(!configs.length) return;
  await Promise.all(configs.map(initConfig));
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

})();
