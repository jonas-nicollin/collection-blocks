(function(){
'use strict';
var clean=[
  /* Tous les POI off — restaurants, commerces, loisirs, etc. */
  {featureType:'poi',stylers:[{visibility:'off'}]},
  /* Parcs : garder la géométrie, supprimer les icônes */
  {featureType:'poi.park',elementType:'geometry',stylers:[{visibility:'on'}]},
  {featureType:'poi.park',elementType:'labels',stylers:[{visibility:'off'}]},
  /* Transport : icônes off */
  {featureType:'transit',elementType:'labels.icon',stylers:[{visibility:'off'}]},
  {featureType:'transit.station',elementType:'labels.text',stylers:[{visibility:'off'}]},
  /* Routes : icônes de direction off */
  {featureType:'road',elementType:'labels.icon',stylers:[{visibility:'off'}]},
  /* Quartiers : labels off (trop de bruit) */
  {featureType:'administrative.neighborhood',stylers:[{visibility:'off'}]},
  {featureType:'administrative.land_parcel',stylers:[{visibility:'off'}]},
];

var mapsApiPromise=null;
var clustererPromise=null;

function getCollectionBlocks(){
  return window.CollectionBlocks||null;
}
function getCollectionUtils(){
  var cb=getCollectionBlocks();
  return cb&&(cb.utils||cb);
}
function getCollectionBlocksDataAPI(){
  var cb=getCollectionBlocks();
  if(cb&&cb.data&&typeof cb.data.get==='function')return cb.data;
  if(cb&&typeof cb.get==='function')return cb;
  return null;
}

/* ── Auto-détection de la langue depuis Squarespace ── */
function detectLocale(){
  try{var l=(window.Static&&window.Static.SQUARESPACE_CONTEXT&&window.Static.SQUARESPACE_CONTEXT.website&&window.Static.SQUARESPACE_CONTEXT.website.language)||'fr';return l.slice(0,2).toLowerCase();}catch(_){return'fr';}
}
/* Dictionnaire i18n par défaut — surcharger via cfg.i18n */
var I18N_DEFAULTS={
  fr:{noResults:'Aucun résultat dans cette zone',allZones:'Toutes les zones',itemCount:function(n){return n+' exposition'+(n>1?'s':'');},loading:'Chargement…',error:'Impossible de charger les données.'},
  en:{noResults:'No results in this area',allZones:'All areas',itemCount:function(n){return n+' exhibition'+(n>1?'s':'');},loading:'Loading…',error:'Unable to load data.'},
};
function getI18n(cfg){
  var locale=detectLocale();
  var base=I18N_DEFAULTS[locale]||I18N_DEFAULTS.fr;
  return Object.assign({},base,cfg.i18n||{});
}

function normalizeCollectionRef(ref){
  if(!ref)return null;
  if(typeof ref==='string')return{path:ref};
  if(ref.path)return ref;
  if(ref.url)return Object.assign({},ref,{path:ref.url});
  return null;
}

function normalizeConfig(raw){
  var cfg=Object.assign({},raw||{});
  var source=normalizeCollectionRef(cfg.sourceCollection);
  if(source)cfg.sourceCollection=source;
  if(cfg.pagination){
    cfg.display=Object.assign({},cfg.display||{});
    if(cfg.pagination.mode==='none'&&cfg.display.pageSize==null)cfg.display.pageSize=0;
    if(cfg.pagination.perPage!=null&&cfg.display.pageSize==null)cfg.display.pageSize=Number(cfg.pagination.perPage)||0;
  }
  if(!cfg.classes||typeof cfg.classes!=='object')cfg.classes={block:''};
  if(!cfg.sort||typeof cfg.sort!=='object')cfg.sort={type:cfg.sort||'numero',direction:'asc'};
  return cfg;
}

function setupLocatorBlock(rawConfig){
rawConfig=normalizeConfig(rawConfig);
var cfg=Object.assign({
  key:'locator',
  sourceCollection:{path:''},category:'',tagNumero:'Numéro',tagLieu:'Lieu',tagZone:'Zone',
  layout:'list',display:{},apiKey:'',mapCenter:null,mapZoom:null,
  mapZoomOnSelect:16,mapStyle:null,mapId:null,mapOptions:{},map:{},
  filterMode:'dropdown',
  filterMultiple:false,
  showZoneFilter:true,
  sort:{type:'numero',direction:'asc'},
  classes:{block:''},
  mobileSheet:{},
  i18n:{},
  target:'.locator-block',
  performance:{},
  debug:false,
},rawConfig||{});

cfg.mobileSheet=Object.assign({
  enabled:true,
  breakpoint:1024,
  initial:'mid',
  collapsedHeight:56,
  midHeight:0.4,
  expandedHeight:1
},cfg.mobileSheet||{});

cfg.performance=Object.assign({
  lazyInit:true,
  lazyRootMargin:'1200px 0px',
  priorityImages:true,
  maxPages:1,
  progressiveMaxPages:'all',
  filterIndex:'complete',
  filterIndexMaxPages:'all',
  domBatchSize:6,
  sessionCache:true,
  sessionCacheTTL:300,
  idleComplete:false,
},cfg.performance||{});

/* display — même modèle que Related Block / Query Block.
   groups définit la construction des cards (media + body).
   Chaque group a une className et des children.
   Par défaut : media avec image seule, body avec tous les champs texte.
   Surcharger dans window.LOCATOR_BLOCK_CONFIGS[n].display. */
cfg.display=Object.assign({
  /* Éléments à afficher (utilisés par les groups par défaut) */
  showImage:   true,
  showTitle:   true,
  showNumero:  true,
  showLieu:    true,
  showZones:   false,
  lieuIcon:    'location_on',
  showCount:   true,           /* afficher le compteur d'items */
  pageSize:    0,              /* 0 = tout afficher sans pagination */
  cardClickable:false,
  openInNewTab:false,
  cardLink:true,
  /* groups : définit la construction des cards.
     null = comportement par défaut (media:image, body:numero+title+lieu+zones)
     Voir exemple dans la config PCC pour la construction spécifique. */
  groups: null,
},cfg.display||{});

cfg.map=Object.assign({
  markerLabel:'numero',markerStyle:'pill',
  markerFontSize:13,      /* px — taille du label dans le marqueur SVG */
  markerShadow:true,      /* ombre portée sous les marqueurs */
  markerActiveBackground:'#f3f3f3',
  markerActiveText:'#111',
  markerActiveShadow:false,
  popup:true,popupShowImage:true,
  clustering:false,clusterMinCount:2,updateListOnMapMove:false,
  overlapStrategy:'spread',
  overlapRadiusMeters:18,
},cfg.map||{});

function log(){if(cfg.debug)console.log.apply(console,['[LocatorBlock]'].concat(Array.prototype.slice.call(arguments)));}

var CLS_CARD='cb-card lb-card';
var CLS_CARD_CLICKABLE='cb-card lb-card lb-card--clickable';
var CLS_MEDIA='cb-card__media lb-card__media';
var CLS_IMG_WRAP='cb-card__img-wrap lb-card__img-wrap';
var CLS_IMAGE='cb-card__img lb-card__img';
var CLS_BODY='cb-card__body lb-card__body';
var CLS_BODY_INLINE='cb-card__body--inline lb-card__body--inline';
var CLS_TITLE='cb-card__title lb-card__title';
var CLS_TAG_FIELD='cb-card__tag-field lb-card__tag-field';
var CLS_TAG_VALUE='cb-card__tag-value lb-card__tag-value';
var CLS_TAG_ICON='ui-icon cb-card__tag-icon lb-card__tag-icon';
var CLS_LOCATION='cb-card__location lb-card__location';
var CLS_LINK='cb-card__link lb-card__link';
var CLS_GROUP='cb-card__group lb-card__group';
var CLS_GROUP_INLINE='cb-card__group--inline lb-card__group--inline';
function addClassNames(base, extra){var map={};String(base||'').split(/\s+/).concat(String(extra||'').split(/\s+/)).forEach(function(c){if(c)map[c]=true;});return Object.keys(map).join(' ');}
function addClasses(el, classes){String(classes||'').split(/\s+/).forEach(function(c){if(c)el.classList.add(c);});}
function removeClasses(el, classes){String(classes||'').split(/\s+/).forEach(function(c){if(c)el.classList.remove(c);});}

var CLS_BLOCK='cb-block lb-block';
var CLS_BLOCK_READY='cb-block--ready lb-block--ready';
var CLS_BLOCK_LOADING='cb-block--loading lb-block--loading';
var CLS_INNER='cb-block__inner lb-block__inner';
var CLS_INNER_GRID='cb-block__inner--grid lb-block__inner--grid';
var CLS_INNER_LIST='cb-block__inner--list lb-block__inner--list';
var CLS_SIDEBAR='cb-sidebar lb-sidebar';
var CLS_LIST='cb-grid lb-grid';
var CLS_MAP_WRAP='cb-map-wrap lb-map-wrap';
var CLS_MAP='cb-map lb-map';
var CLS_MAP_LOADING='cb-map--loading lb-map--loading';
var CLS_CONTROLS='cb-controls lb-controls';
var CLS_COUNTER='cb-counter lb-counter';
var CLS_FILTER_GROUP='cb-filter-group lb-filter-group';
var CLS_FILTER_BUTTONS='cb-filter-buttons lb-filter-buttons';
var CLS_FILTER_BTN='cb-filter-btn lb-filter-btn';
var CLS_FILTER_BTN_ACTIVE='cb-filter-btn--active lb-filter-btn--active';
var CLS_FILTER_WRAP='cb-filter-wrap lb-filter-wrap';
var CLS_FILTER_SELECT='cb-filter-select lb-filter-select';
var CLS_FILTER_ICON='cb-filter-icon lb-filter-icon ui-icon';
var CLS_LOAD_MORE_WRAP='cb-footer lb-footer';
var CLS_LOAD_MORE='cb-load-more lb-load-more';
var CLS_ERROR='cb-error lb-error';
var CLS_SKELETON_CARD='cb-card--skeleton lb-card--skeleton';

/* ── Utilitaires ── */
function escHtml(s){var utils=getCollectionUtils();if(utils&&typeof utils.escapeHTML==='function')return utils.escapeHTML(s);return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function slugifyToken(s){var utils=getCollectionUtils();if(utils&&typeof utils.slugify==='function')return utils.slugify(s);return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function tagFieldModifier(name){var utils=getCollectionUtils();if(utils&&typeof utils.tagFieldModifier==='function'){var cls=utils.tagFieldModifier(name,'lb-card');return cls?' '+cls:'';}var slug=slugifyToken(name);return slug?' cb-card__tag-field--'+slug+' lb-card__tag-field--'+slug:'';}
function categoryModifier(name){var utils=getCollectionUtils();if(utils&&typeof utils.categoryModifier==='function'){var cls=utils.categoryModifier(name,'lb-card');return cls?' '+cls:'';}var slug=slugifyToken(name);return slug?' cb-card__category--'+slug+' lb-card__category--'+slug:'';}
function customCardClass(){return cfg.classes&&(cfg.classes.card||cfg.classes.cards||cfg.classes.item)||'';}
function cardClass(clickable){return addClassNames(clickable?CLS_CARD_CLICKABLE:CLS_CARD,customCardClass());}
function tagRe(p){return new RegExp('^'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':\\s*','i');}
function getTag(tags,p){var utils=getCollectionUtils();if(utils&&typeof utils.getTagValuesByPrefix==='function'){var vals=utils.getTagValuesByPrefix({tags:tags||[]},p);return vals[0]||'';}if(!Array.isArray(tags))return'';var re=tagRe(p),t=tags.find(function(x){return re.test(String(x));});return t?String(t).replace(re,'').trim():'';}
function getTags(tags,p){var utils=getCollectionUtils();if(utils&&typeof utils.getTagValuesByPrefix==='function')return utils.getTagValuesByPrefix({tags:tags||[]},p);if(!Array.isArray(tags))return[];var re=tagRe(p);return tags.filter(function(x){return re.test(String(x));}).map(function(x){return String(x).replace(re,'').trim();});}

/* ── Image srcset ── */
var SW=[300,500,750,1000,1500];
var LOCATOR_RENDER_IMAGE_INDEX=0;

function buildSrcset(b){
  var utils=getCollectionUtils();
  if(utils&&typeof utils.buildSrcset==='function')return utils.buildSrcset(b,SW);
  return SW.map(function(w){return b+'?format='+w+'w '+w+'w';}).join(', ');
}

function getImgBase(item){
  var utils=getCollectionUtils();
  if(utils&&typeof utils.getImageBase==='function')return utils.getImageBase(item);
  return(item.assetUrl||item.thumbnailUrl||item.mainImageUrl||(item.media&&item.media[0]&&item.media[0].url)||'').split('?')[0];
}

function getFocalPos(point){
  var utils=getCollectionUtils();
  if(utils&&typeof utils.focalPoint==='function')return utils.focalPoint(point);
  point=point||{x:0.5,y:0.5};
  return Math.round(point.x*100)+'% '+Math.round(point.y*100)+'%';
}

function imgTag(base,alt,cls,sizes,fp,priority){
  if(!base)return'';

  var useIndexPriority = priority == null;
  var idx = useIndexPriority ? LOCATOR_RENDER_IMAGE_INDEX++ : 999;
  var isPriority = priority === true || (
    useIndexPriority &&
    cfg.performance.priorityImages !== false &&
    idx < 3
  );

  var pos=fp||'50% 50%';
  var fallback=base+'?format=750w';
  var utils=getCollectionUtils();
  if(utils&&typeof utils.buildImgHTML==='function'){
    return utils.buildImgHTML(base,pos,alt,{
      imageClass:cls,
      sizes:sizes||'(max-width:768px) 100vw, 400px',
      widths:SW,
      priority:isPriority
    });
  }

  return '<img class="'+escHtml(cls)+'"'
    +' src="'+escHtml(fallback)+'"'
    +' srcset="'+escHtml(buildSrcset(base))+'"'
    +' sizes="'+escHtml(sizes||'(max-width:768px) 100vw, 400px')+'"'
    +' alt="'+escHtml(alt)+'"'
    +' loading="'+(isPriority?'eager':'lazy')+'"'
    +' fetchpriority="'+(isPriority?'high':'low')+'"'
    +' decoding="async"'
    +' style="object-position:'+escHtml(pos)+'">';
}

function imgWrapTag(base,alt,sizes,fp,priority){
  if(!base)return'';
  return '<div class="'+escHtml(CLS_IMG_WRAP)+'">'+imgTag(base,alt,CLS_IMAGE,sizes,fp,priority)+'</div>';
}
   
/* ── Coordonnées ── */
function getCoords(loc){loc=loc||{};return{lat:parseFloat(loc.mapLat||loc.markerLat||''),lng:parseFloat(loc.mapLng||loc.markerLng||'')};}

function spreadOverlappingItems(items){
  if(!Array.isArray(items)||cfg.map.overlapStrategy!=='spread')return items;

  var groups={};
  items.forEach(function(item){
    var key=[Number(item.lat).toFixed(7),Number(item.lng).toFixed(7)].join(',');
    if(!groups[key])groups[key]=[];
    groups[key].push(item);
  });

  Object.keys(groups).forEach(function(key){
    var group=groups[key];
    if(group.length<2){
      group[0].markerLat=group[0].lat;
      group[0].markerLng=group[0].lng;
      return;
    }

    var radius=Number(cfg.map.overlapRadiusMeters||18);
    var latRad=group[0].lat*Math.PI/180;
    var metersPerLat=111320;
    var metersPerLng=Math.max(1,111320*Math.cos(latRad));

    group.forEach(function(item,index){
      var angle=(-Math.PI/2)+(Math.PI*2*index/group.length);
      item.markerLat=item.lat+(Math.sin(angle)*radius/metersPerLat);
      item.markerLng=item.lng+(Math.cos(angle)*radius/metersPerLng);
      item.hasOverlappingLocation=true;
      item.overlapCount=group.length;
    });
  });

  return items;
}

function getCollectionOptions(maxPages){
  return {
    maxPages: maxPages,
    ttl: Number(cfg.performance.sessionCacheTTL || 300),
    memoryCache: true,
    sessionCache: cfg.performance.sessionCache !== false,
    credentials: 'same-origin',
    keepFields: cfg.performance.keepFields || [
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
    ],
    stripFields: []
  };
}

/* ── Fetch SQS + pagination timestamp ── */
   async function fetchItemsState(maxPages){
  var sourcePath = cfg.sourceCollection && cfg.sourceCollection.path;
  if(!sourcePath) throw new Error('sourceCollection.path manquant');

  var dataApi=getCollectionBlocksDataAPI();

  if(!dataApi || typeof dataApi.get !== 'function'){
    throw new Error('CollectionBlocks requis pour Locator Block');
  }

  maxPages = maxPages || cfg.performance.maxPages || 1;

  var options = getCollectionOptions(maxPages);
  var state;

  if(typeof dataApi.getState === 'function'){
    state = await dataApi.getState(sourcePath, options);
  }else{
    state = {
      items: await dataApi.get(sourcePath, options),
      complete: maxPages === 'all',
      fetchError: null,
      pagesLoaded: Number(maxPages || 1)
    };
  }

  var all = state.items || [];

  log('Brut:', all.length);

  var filtered = all.filter(function(item){
    var c = getCoords(item.location);

    if(isNaN(c.lat) || isNaN(c.lng)){
      log('Sans coords:', item.title);
      return false;
    }

    if(cfg.category){
      var cats = (item.categories || []).map(function(c){
        return String(c).toLowerCase();
      });

      if(cats.indexOf(cfg.category.toLowerCase()) === -1){
        log('Hors cat:', item.title);
        return false;
      }
    }

    return true;
  });

  var items = filtered.map(function(item){
    var c = getCoords(item.location);
    var focalPos = getFocalPos(item.mediaFocalPoint);

    return {
      id: item.id || item.urlId || '',
      url: item.fullUrl || item.url || '',
      title: item.title || '',
      numero: getTag(item.tags, cfg.tagNumero),
      lieu: getTag(item.tags, cfg.tagLieu),
      zones: getTags(item.tags, cfg.tagZone),
      imageBase: getImgBase(item),
      focalPos: focalPos,
      lat: c.lat,
      lng: c.lng
    };
  });

  var sortType = cfg.sort && cfg.sort.type;
  var sortDir = cfg.sort && cfg.sort.direction === 'desc' ? -1 : 1;

  if(sortType === 'numero'){
    items.sort(function(a,b){
      return ((parseInt(a.numero, 10) || 999) - (parseInt(b.numero, 10) || 999)) * sortDir;
    });
  } else if(sortType === 'title'){
    items.sort(function(a,b){
      return a.title.localeCompare(b.title, 'fr') * sortDir;
    });
  }

  spreadOverlappingItems(items);

  return {
    items: items,
    complete: !!state.complete,
    fetchError: state.fetchError || null,
    pagesLoaded: state.pagesLoaded || Number(maxPages || 1)
  };
}
/* ── Rendu d'un child dans un group ── */
function renderChild(child,item){
  var d=cfg.display;
  if(child==='image'){
    if(!d.showImage||!item.imageBase)return'';
    return imgWrapTag(item.imageBase,item.title,'(max-width:768px) 100vw,'+(cfg.layout==='grid'?'33vw':'50vw'),item.focalPos);
  }
  if(child==='title'){
    if(!d.showTitle||!item.title)return'';
    return'<div class="'+escHtml(CLS_TITLE)+'">'+escHtml(item.title)+'</div>';
  }
  if(child==='numero'){
    if(!d.showNumero||!item.numero)return'';
    return'<div class="'+escHtml(CLS_TAG_FIELD+tagFieldModifier('numero'))+'" data-prefix="'+escHtml(cfg.tagNumero||'Numéro')+'"><span class="'+escHtml(CLS_TAG_VALUE)+'">'+escHtml(item.numero)+'</span></div>';
  }
  if(child==='lieu'){
    if(!d.showLieu||!item.lieu)return'';
    var icon=d.lieuIcon?'<span class="'+escHtml(CLS_TAG_ICON)+'" aria-hidden="true">'+escHtml(d.lieuIcon)+'</span>':'';
    return'<div class="'+escHtml(CLS_TAG_FIELD+tagFieldModifier('lieu')+' '+CLS_LOCATION)+'" data-prefix="'+escHtml(cfg.tagLieu||'Lieu')+'">'+icon+'<span class="'+escHtml(CLS_TAG_VALUE)+'">'+escHtml(item.lieu)+'</span></div>';
  }
  if(child==='zones'){
    if(!d.showZones||!item.zones.length)return'';
    var utils=getCollectionUtils();
    if(utils&&typeof utils.buildCategoriesHTML==='function')return utils.buildCategoriesHTML(item.zones,{prefix:'lb-card'});
    return'<div class="cb-card__categories lb-card__categories">'+item.zones.map(function(z){return'<span class="'+escHtml('cb-card__category lb-card__category'+categoryModifier(z))+'">'+escHtml(z)+'</span>';}).join('')+'</div>';
  }
  if(child==='cardLink'){
    if(cfg.display.cardLink===false||!item.url)return'';
    var lt=cfg.display.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
    return'<a class="'+escHtml(CLS_LINK)+'" href="'+escHtml(item.url)+'"'+lt+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';
  }
  return'';
}

/* ── HTML card — construit via display.groups (modèle Related Block) ── */
function buildCardHTML(item){
  var d=cfg.display;
  var groups=d.groups;

  /* Si display.groups est défini, on utilise le modèle groups */
  if(groups&&Array.isArray(groups)){
    var html='';
    groups.forEach(function(group){
      var inner='';
      (group.children||[]).forEach(function(child){inner+=renderChild(child,item);});
      if(inner){
        var cls=group.className||'lb-card__body';
        var role=group.role||(group.children&&group.children.indexOf('image')!==-1?'media':(String(cls).indexOf('lb-card__body')!==-1||String(cls).indexOf('cb-card__body')!==-1?'body':'group'));
        var baseCls=role==='media'?CLS_MEDIA:(role==='body'?CLS_BODY:CLS_GROUP);
        var inlineCls=group.inline===true?(role==='body'?CLS_BODY_INLINE:CLS_GROUP_INLINE):'';
        var finalCls=addClassNames(addClassNames(baseCls, cls), inlineCls);
        html+='<div class="'+escHtml(finalCls)+'">'+inner+'</div>';
      }
    });
    /* cardLink toujours en dernier dans le dernier body group */
    var clHtml='';
    if(cfg.display.cardLink!==false&&item.url){var lt=cfg.display.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';clHtml='<a class="'+escHtml(CLS_LINK)+'" href="'+escHtml(item.url)+'"'+lt+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';}
    if(cfg.display.cardClickable&&item.url){
      var lt=cfg.display.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
      return'<a class="'+escHtml(cardClass(true))+'" href="'+escHtml(item.url)+'"'+lt+' data-item-id="'+escHtml(item.id)+'">'+html+'</a>';
    }
    /* cardLink : si true et cardClickable=false, ajouter la flèche
       même si 'cardLink' n'est pas dans les children des groups */
    if(cfg.display.cardLink!==false&&item.url&&!cfg.display.cardClickable){
      var lt2=cfg.display.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
      html+='<a class="'+escHtml(CLS_LINK)+'" href="'+escHtml(item.url)+'"'+lt2+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';
    }
    return'<div class="'+escHtml(cardClass(false))+'" data-item-id="'+escHtml(item.id)+'">'+html+'</div>';
  }

  /* Comportement par défaut : media (image seule) + body (tous les champs texte) */
  var mediaHtml='';
  if(d.showImage&&item.imageBase)mediaHtml='<div class="'+escHtml(CLS_MEDIA)+'">'+imgWrapTag(item.imageBase,item.title,'(max-width:768px) 100vw,'+(cfg.layout==='grid'?'33vw':'50vw'),item.focalPos)+'</div>';

  var bodyHtml='';
  if(d.showNumero&&item.numero)bodyHtml+='<div class="'+escHtml(CLS_TAG_FIELD+tagFieldModifier('numero'))+'" data-prefix="'+escHtml(cfg.tagNumero||'Numéro')+'"><span class="'+escHtml(CLS_TAG_VALUE)+'">'+escHtml(item.numero)+'</span></div>';
  if(d.showTitle&&item.title)bodyHtml+='<div class="'+escHtml(CLS_TITLE)+'">'+escHtml(item.title)+'</div>';
  if(d.showLieu&&item.lieu){var icon=d.lieuIcon?'<span class="'+escHtml(CLS_TAG_ICON)+'" aria-hidden="true">'+escHtml(d.lieuIcon)+'</span>':'';bodyHtml+='<div class="'+escHtml(CLS_TAG_FIELD+tagFieldModifier('lieu')+' '+CLS_LOCATION)+'" data-prefix="'+escHtml(cfg.tagLieu||'Lieu')+'">'+icon+'<span class="'+escHtml(CLS_TAG_VALUE)+'">'+escHtml(item.lieu)+'</span></div>';}
  if(d.showZones&&item.zones.length){var utilsZones=getCollectionUtils();bodyHtml+=utilsZones&&typeof utilsZones.buildCategoriesHTML==='function'?utilsZones.buildCategoriesHTML(item.zones,{prefix:'lb-card'}):'<div class="cb-card__categories lb-card__categories">'+item.zones.map(function(z){return'<span class="'+escHtml('cb-card__category lb-card__category'+categoryModifier(z))+'">'+escHtml(z)+'</span>';}).join('')+'</div>';}

  var clHtml='';
  if(cfg.display.cardLink!==false&&item.url){var lt=cfg.display.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';clHtml='<a class="'+escHtml(CLS_LINK)+'" href="'+escHtml(item.url)+'"'+lt+' aria-label="Voir '+escHtml(item.title)+'"><span class="ui-icon" aria-hidden="true">arrow_forward</span></a>';}

  return'<div class="'+escHtml(cardClass(false))+'" data-item-id="'+escHtml(item.id)+'">'+mediaHtml+(bodyHtml?'<div class="'+escHtml(CLS_BODY)+'">'+bodyHtml+clHtml+'</div>':'')+'</div>';
}

/* ── Popup OverlayView ── */
var CustomPopup=null;
function defineCustomPopup(){
  if(CustomPopup)return;
  CustomPopup=function(pos,item){this.position=pos;this.item=item;this.container=null;};
  CustomPopup.prototype=Object.create(google.maps.OverlayView.prototype);
  CustomPopup.prototype.onAdd=function(){
    var d=cfg.display,item=this.item;
    var im=(cfg.map.popupShowImage&&d.showImage&&item.imageBase)?'<div class="lb-popup-media">'+imgTag(item.imageBase,item.title,'lb-popup-image','240px',item.focalPos,false)+'</div>':'';
    var b='';if(item.numero)b+='<div class="lb-popup-num">'+escHtml(item.numero)+'</div>';if(item.title)b+='<div class="lb-popup-title">'+escHtml(item.title)+'</div>';if(item.lieu)b+='<div class="lb-popup-lieu">'+escHtml(item.lieu)+'</div>';
    this.container=document.createElement('div');this.container.className='cb-popup-wrap lb-popup-wrap cb-popup-wrap--active lb-popup-wrap--active';
    var pt=cfg.display.openInNewTab?' target="_blank" rel="noopener noreferrer"':'';
    this.container.innerHTML='<button class="cb-popup-close lb-popup-close" type="button" aria-label="Fermer"><span class="ui-icon" aria-hidden="true">close</span></button><a class="cb-popup lb-popup cb-popup--active lb-popup--active" href="'+escHtml(item.url)+'"'+pt+'>'+im+(b?'<div class="cb-popup-body lb-popup-body">'+b+'</div>':'')+'</a>';
    var closeBtn=this.container.querySelector('.lb-popup-close');
    var popup=this;
    if(closeBtn)closeBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();popup.setMap(null);});
    this.getPanes().floatPane.appendChild(this.container);
  };
  CustomPopup.prototype.draw=function(){var proj=this.getProjection(),pos=proj.fromLatLngToDivPixel(this.position);if(!pos||!this.container)return;var w=this.container.offsetWidth||220;this.container.style.left=(pos.x-w/2)+'px';this.container.style.top=(pos.y-this.container.offsetHeight-56)+'px';};
  CustomPopup.prototype.onRemove=function(){if(this.container&&this.container.parentNode){this.container.parentNode.removeChild(this.container);this.container=null;}};
}

/* ── Marqueurs SVG ── */
function getMC(a){var p=a?'--locator-marker-active':'--locator-marker-color';return getComputedStyle(document.documentElement).getPropertyValue(p).trim()||(a?'#000':'#333');}
function pillSvg(bg,tc,label,border,active){
  label=label?String(label):'';
  var fs=cfg.map.markerFontSize||13;
  var charW=fs*0.6;
  var pH=label.length>2?10:8,tW=label.length*charW;
  /* Dimensions du pill */
  var pw=Math.max(32,tW+pH*2),ph=Math.max(26,fs+14),rx=ph/2;
  /* Padding autour pour que l'ombre ne soit pas rognée par le viewBox */
  var shadowEnabled=active?cfg.map.markerActiveShadow!==false:cfg.map.markerShadow!==false;
  var pad=shadowEnabled?8:0;
  /* Dimensions totales SVG avec padding */
  var sw=pw+pad*2,sh=ph+pad*2;
  /* Ombre */
  var shadowOp=shadowEnabled?'0.28':'0';
  var sEl='<filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,'+shadowOp+')"/></filter>';
  var fa=' filter="url(#s)"';
  /* Contour (état normal) */
  var bEl=border?'<rect x="'+(pad+.5)+'" y="'+(pad+.5)+'" width="'+(pw-1)+'" height="'+(ph-1)+'" rx="'+(rx-.5)+'" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>':'';
  /* Texte */
  var txt=label?'<text x="'+(sw/2)+'" y="'+(ph/2+pad+1)+'" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="'+fs+'" fill="'+tc+'">'+label+'</text>':'';
  var svgContent='<svg xmlns="http://www.w3.org/2000/svg" width="'+sw+'" height="'+sh+'" viewBox="0 0 '+sw+' '+sh+'">'
    +'<defs>'+sEl+'</defs>'
    +'<rect x="'+pad+'" y="'+pad+'" width="'+pw+'" height="'+ph+'" rx="'+rx+'" fill="'+bg+'"'+fa+'/>'
    +bEl+txt+'</svg>';
  return'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svgContent);
}
function dotSvg(c){var r=8;return'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+(r*2)+'" height="'+(r*2)+'" viewBox="0 0 '+(r*2)+' '+(r*2)+'"><circle cx="'+r+'" cy="'+r+'" r="'+r+'" fill="'+c+'"/></svg>');}
function markerIcon(label,active){
  var style=cfg.map.markerStyle||'pill';
  if(style==='google')return null;
  var c=getMC(active),lbl=cfg.map.markerLabel==='none'?'':(label||'');
  if(style==='dot'){var r=active?10:8;return{url:dotSvg(c),scaledSize:new google.maps.Size(r*2,r*2),anchor:new google.maps.Point(r,r)};}
  var fs=cfg.map.markerFontSize||13;
  var pH=lbl.length>2?10:8,pw=Math.max(32,lbl.length*(fs*0.6)+pH*2),ph=Math.max(26,fs+14);
  var shadowEnabled=active?cfg.map.markerActiveShadow!==false:cfg.map.markerShadow!==false;
  var pad=shadowEnabled?8:0;
  var sw=pw+pad*2,sh=ph+pad*2;
  /* anchor : pointe en bas au centre du pill (pas du SVG total avec padding) */
  return{url:pillSvg(active?(cfg.map.markerActiveBackground||c):'#fff',active?(cfg.map.markerActiveText||'#111'):'#111',lbl,!active,active),scaledSize:new google.maps.Size(sw,sh),anchor:new google.maps.Point(sw/2,ph+pad)};
}

/* ── API Maps + clusterer ── */
function loadMapsAPI(){if(window.google&&window.google.maps)return Promise.resolve();if(mapsApiPromise)return mapsApiPromise;mapsApiPromise=new Promise(function(resolve,reject){var cb='__locatorReady_'+Date.now();window[cb]=function(){delete window[cb];resolve();};var s=document.createElement('script');s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(cfg.apiKey)+'&callback='+cb+'&loading=async';s.async=true;s.onerror=function(){mapsApiPromise=null;reject(new Error('Google Maps inaccessible'));};document.head.appendChild(s);});return mapsApiPromise;}
function loadClusterer(){if(window.markerClusterer)return Promise.resolve();if(clustererPromise)return clustererPromise;clustererPromise=new Promise(function(resolve){var s=document.createElement('script');s.src='https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';s.onload=function(){resolve();};s.onerror=function(){clustererPromise=null;resolve();};document.head.appendChild(s);});return clustererPromise;}

/* ── Contrôles + skeleton ── */
function buildControls(zones,total,activeZone){
  var f='';
  if(cfg.showZoneFilter&&zones.length){
    if(cfg.filterMode==='buttons'){
      /* Boutons pill — même apparence que Query Block (qb-filter-btn) */
      var btns='';
      zones.forEach(function(z){var active=z===activeZone?' '+CLS_FILTER_BTN_ACTIVE:'';btns+='<button class="'+escHtml(CLS_FILTER_BTN+active)+'" data-zone="'+escHtml(z)+'" type="button">'+escHtml(z)+'</button>';});
      f='<div class="'+escHtml(CLS_FILTER_GROUP+' '+CLS_FILTER_BUTTONS)+'">'+btns+'</div>';
    }else{
      /* Dropdown (défaut) */
      var opts=['<option value="">Toutes les zones</option>']
        .concat(zones.map(function(z){return'<option value="'+escHtml(z)+'"'+(z===activeZone?' selected':'')+'>'+escHtml(z)+'</option>';})).join('');
      f='<div class="'+escHtml(CLS_FILTER_GROUP+' '+CLS_FILTER_WRAP)+'">'
        +'<select class="'+escHtml(CLS_FILTER_SELECT)+'" aria-label="Filtrer par zone">'+opts+'</select>'
        +'<span class="'+escHtml(CLS_FILTER_ICON)+'" aria-hidden="true">expand_more</span>'
        +'</div>';
    }
  }
  var countHtml=cfg.display.showCount!==false
    ?'<span class="'+escHtml(CLS_COUNTER)+'">'+getI18n(cfg).itemCount(total)+'</span>':'';
  return'<div class="'+escHtml(CLS_CONTROLS)+'">'+countHtml+f+'</div>';
}
   function renderCardsProgressive(list, items, count, done){
  var n = cfg.display.pageSize > 0 ? Math.min(count, items.length) : items.length;
  var batchSize = Math.max(1, Number(cfg.performance.domBatchSize || 8));
  var utils = getCollectionUtils();
  var index = 0;

  list.innerHTML = '';
  LOCATOR_RENDER_IMAGE_INDEX = 0;

  if(utils&&typeof utils.appendProgressiveDOM==='function'){
    return utils.appendProgressiveDOM(items.slice(0,n),list,function(item){
      var wrap=document.createElement('div');
      wrap.innerHTML=buildCardHTML(item);
      return wrap.firstElementChild;
    },{
      batchSize:batchSize,
      done:function(){if(typeof done==='function')done(n);}
    });
  }

  function appendBatch(){
    var html = '';
    var end = Math.min(index + batchSize, n);

    for (; index < end; index++) {
      html += buildCardHTML(items[index]);
    }

    list.insertAdjacentHTML('beforeend', html);

    if (index < n) {
      requestAnimationFrame(appendBatch);
    } else if (typeof done === 'function') {
      done(n);
    }
  }

  appendBatch();
}
function buildSkeleton(){var s='';for(var i=0;i<4;i++)s+='<div class="'+escHtml(CLS_CARD+' '+CLS_SKELETON_CARD)+'"><div class="'+escHtml(CLS_MEDIA)+'"></div><div class="'+escHtml(CLS_BODY)+'"><div class="lb-skeleton-line" style="width:20%"></div><div class="lb-skeleton-line" style="width:70%"></div><div class="lb-skeleton-line" style="width:45%"></div></div></div>';return s;}

/* ── Instance ── */
function createInstance(root,allItems,fetchMoreItems){
  var map,markers={},clusterer=null,activeId=null,activePopup=null,activeZone='';
  var mapTouched=false;
  var currentItems=allItems,visibleCount=cfg.display.pageSize>0?cfg.display.pageSize:allItems.length;
  var zones=collectZones(allItems);

  function isMobileSheetActive(){
    return root.classList.contains('lb-block--sheet-active');
  }

  function collectZones(items){
    var out=[];
    (items||[]).forEach(function(i){(i.zones||[]).forEach(function(z){if(out.indexOf(z)===-1)out.push(z);});});
    out.sort();
    return out;
  }

  function zonesEqual(a,b){
    if(!a||!b||a.length!==b.length)return false;
    for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;
    return true;
  }

  function syncControls(){
    var controls=root.querySelector('.lb-controls');
    if(!controls)return;
    controls.outerHTML=buildControls(zones,allItems.length,activeZone);
    bindControls();
  }

  function bindControls(){
    var sel=root.querySelector('.lb-filter-select');
    if(sel)sel.addEventListener('change',function(){applyFilter(sel.value);});
    root.querySelectorAll('.lb-filter-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var zone=btn.dataset.zone||'';
        var isAlreadyActive=btn.classList.contains('lb-filter-btn--active');
        root.querySelectorAll('.lb-filter-btn').forEach(function(b){removeClasses(b, CLS_FILTER_BTN_ACTIVE);});
        if(!isAlreadyActive){addClasses(btn, CLS_FILTER_BTN_ACTIVE);}else{zone='';}
        applyFilter(zone);
      });
    });
  }

  function setupMobileSheet(){
    if(!cfg.mobileSheet||cfg.mobileSheet.enabled===false)return;

    var inner=root.querySelector('.lb-block__inner');
    var sidebar=root.querySelector('.lb-sidebar');
    if(!inner||!sidebar)return;

    addClasses(root,'cb-block--sheet lb-block--sheet');
    addClasses(inner,'cb-sheet lb-sheet');

    var breakpoint=Math.max(320,Number(cfg.mobileSheet.breakpoint||1024));
    var mq=window.matchMedia?window.matchMedia('(max-width: '+(breakpoint-1)+'px)'):null;
    if(!sidebar.id)sidebar.id='lb-sheet-'+(cfg.key||'locator')+'-'+Math.random().toString(36).slice(2,8);
    sidebar.setAttribute('role','region');
    sidebar.setAttribute('aria-label',(cfg.i18n&&cfg.i18n.mobileSheetLabel)||'Liste des lieux');

    var handle=sidebar.querySelector('.lb-sheet-handle');
    if(!handle){
      handle=document.createElement('button');
      handle.className='cb-sheet-handle lb-sheet-handle';
      handle.type='button';
      handle.innerHTML='<span class="cb-sheet-handle__bar lb-sheet-handle__bar" aria-hidden="true"></span>';
      sidebar.insertBefore(handle,sidebar.firstChild);
    }
    handle.setAttribute('aria-controls',sidebar.id);

    var states=['collapsed','mid','expanded'];
    var state=states.indexOf(cfg.mobileSheet.initial)!==-1?cfg.mobileSheet.initial:'collapsed';
    var isActive=false;
    var suppressClick=false;

    function getViewportHeight(){
      return (window.visualViewport&&window.visualViewport.height)||window.innerHeight||700;
    }

    function updateViewportVars(){
      var viewportHeight=getViewportHeight();
      root.style.setProperty('--locator-sheet-viewport-height',Math.round(viewportHeight)+'px');
      root.style.setProperty('--locator-sheet-collapsed',Math.round(stateVisible('collapsed'))+'px');
      root.style.setProperty('--locator-sheet-mid',Math.round(stateVisible('mid'))+'px');
      root.style.setProperty('--locator-sheet-expanded',Math.round(stateVisible('expanded'))+'px');
    }

    function getInnerHeight(){
      var rect=inner.getBoundingClientRect();
      return rect.height||getViewportHeight();
    }

    function stateVisible(targetState){
      var h=getInnerHeight();
      if(targetState==='expanded')return Math.max(160,Math.min(h-16,h*Number(cfg.mobileSheet.expandedHeight||1)));
      if(targetState==='mid')return Math.max(140,Math.min(h-16,h*Number(cfg.mobileSheet.midHeight||0.4)));
      return Math.max(44,Number(cfg.mobileSheet.collapsedHeight||56));
    }

    function refreshMap(){
      if(!map||!window.google||!google.maps||!google.maps.event)return;
      window.setTimeout(function(){
        var center=map.getCenter&&map.getCenter();
        google.maps.event.trigger(map,'resize');
        if(center&&map.setCenter)map.setCenter(center);
      },260);
    }

    function setState(nextState){
      if(states.indexOf(nextState)===-1)nextState='collapsed';
      state=nextState;
      updateViewportVars();
      states.forEach(function(s){removeClasses(root,'cb-block--sheet-'+s+' lb-block--sheet-'+s);});
      addClasses(root,'cb-block--sheet-'+state+' lb-block--sheet-'+state);
      root.setAttribute('data-lb-sheet-state',state);
      handle.setAttribute('aria-expanded',state==='collapsed'?'false':'true');
      handle.setAttribute('aria-label',state==='expanded'?'Réduire la liste':'Agrandir la liste');
      sidebar.style.removeProperty('--lb-sheet-visible');
      refreshMap();
    }

    function nextTapState(){
      if(state==='collapsed')return 'mid';
      if(state==='mid')return 'expanded';
      return 'collapsed';
    }

    function toggleSheetFromTap(){
      setState(nextTapState());
    }

    function nearestState(visible){
      var best=states[0],bestDist=Infinity;
      states.forEach(function(s){
        var d=Math.abs(stateVisible(s)-visible);
        if(d<bestDist){best=s;bestDist=d;}
      });
      return best;
    }

    handle.addEventListener('click',function(){
      if(!isActive)return;
      if(suppressClick){
        suppressClick=false;
        return;
      }
      toggleSheetFromTap();
    });

    handle.addEventListener('pointerdown',function(event){
      if(!isActive)return;
      if(event.button!=null&&event.button!==0)return;

      updateViewportVars();
      var startY=event.clientY;
      var startVisible=stateVisible(state);
      var maxVisible=stateVisible('expanded');
      var minVisible=stateVisible('collapsed');
      var moved=false;

      addClasses(root,'cb-block--sheet-dragging lb-block--sheet-dragging');
      handle.setPointerCapture&&handle.setPointerCapture(event.pointerId);

      function move(e){
        if(Math.abs(e.clientY-startY)>6)moved=true;
        var next=Math.max(minVisible,Math.min(maxVisible,startVisible-(e.clientY-startY)));
        sidebar.style.setProperty('--lb-sheet-visible',next+'px');
        e.preventDefault();
      }

      function end(e){
        removeClasses(root,'cb-block--sheet-dragging lb-block--sheet-dragging');
        handle.releasePointerCapture&&handle.releasePointerCapture(event.pointerId);
        var next=Math.max(minVisible,Math.min(maxVisible,startVisible-(e.clientY-startY)));
        window.removeEventListener('pointermove',move);
        window.removeEventListener('pointerup',end);
        window.removeEventListener('pointercancel',end);
        suppressClick=moved;
        setState(nearestState(next));
      }

      window.addEventListener('pointermove',move,{passive:false});
      window.addEventListener('pointerup',end);
      window.addEventListener('pointercancel',end);
    });

    function setActive(nextActive){
      isActive=!!nextActive;
      if(isActive){
        addClasses(root,'cb-block--sheet-active lb-block--sheet-active');
        handle.removeAttribute('aria-hidden');
        handle.removeAttribute('tabindex');
        setState(state);
      }else{
        removeClasses(root,'cb-block--sheet-active lb-block--sheet-active cb-block--sheet-dragging lb-block--sheet-dragging');
        states.forEach(function(s){removeClasses(root,'cb-block--sheet-'+s+' lb-block--sheet-'+s);});
        root.removeAttribute('data-lb-sheet-state');
        handle.setAttribute('aria-hidden','true');
        handle.setAttribute('tabindex','-1');
        handle.setAttribute('aria-expanded','false');
        sidebar.style.removeProperty('--lb-sheet-visible');
        refreshMap();
      }
    }

    function syncActive(){
      updateViewportVars();
      setActive(!mq||mq.matches);
    }

    if(mq){
      if(typeof mq.addEventListener==='function')mq.addEventListener('change',syncActive);
      else if(typeof mq.addListener==='function')mq.addListener(syncActive);
    }
    window.addEventListener('resize',syncActive);
    if(window.visualViewport)window.visualViewport.addEventListener('resize',syncActive);
    syncActive();
  }

  function buildMap(c){
    var controlPosition=google.maps&&google.maps.ControlPosition;
    var topRight=controlPosition&&controlPosition.RIGHT_TOP;
    var configuredMapId=(cfg.map&&cfg.map.mapId)||cfg.mapId||(cfg.mapOptions&&cfg.mapOptions.mapId)||null;
    var o=Object.assign({
      center:cfg.mapCenter||{lat:48.8566,lng:2.3522},
      zoom:cfg.mapZoom||12,
      mapId:configuredMapId||undefined,
      zoomControl:true,
      zoomControlOptions:topRight?{position:topRight}:undefined,
      mapTypeControl:false,
      streetViewControl:false,
      panControl:false,
      rotateControl:false,
      scaleControl:false,
      cameraControl:false,
      fullscreenControl:true,
      fullscreenControlOptions:topRight?{position:topRight}:undefined,
      gestureHandling:'greedy',
      clickableIcons:false
    },cfg.mapOptions||{});
    if(configuredMapId){
      delete o.styles;
      o.mapId=configuredMapId;
    }else if(cfg.mapStyle){
      o.styles=cfg.mapStyle;
    }
    map=new google.maps.Map(c,o);
    map.addListener('click',function(){mapTouched=true;closePopup();});
    map.addListener('dragstart',function(){mapTouched=true;});
    if(c){
      ['wheel','touchstart','pointerdown'].forEach(function(type){
        c.addEventListener(type,function(){mapTouched=true;},{passive:true});
      });
    }
    /* updateListOnMapMove doit être dans map:{} dans la config, pas à la racine */
   if(cfg.map.updateListOnMapMove)map.addListener('idle',function(){
  var b=map.getBounds();
  if(!b)return;

  var v=currentItems.filter(function(i){
    return b.contains(new google.maps.LatLng(i.lat,i.lng));
  });

  var list=root.querySelector('.lb-grid');
  if(!list)return;

  renderCardsProgressive(list, v, v.length, function(){
    bindCards();
  });
});
  }
  function markerPosition(item){return{lat:item.markerLat||item.lat,lng:item.markerLng||item.lng};}
  function fitItemsOnMap(items,force){
    if(!map||!Array.isArray(items)||!items.length)return;
    if(mapTouched&&!force)return;
    if(cfg.mapCenter&&cfg.mapZoom){
      if(force||!mapTouched){
        map.setCenter(cfg.mapCenter);
        map.setZoom(cfg.mapZoom);
      }
      return;
    }
    var bounds=new google.maps.LatLngBounds();
    items.forEach(function(i){bounds.extend({lat:i.lat,lng:i.lng});});
    map.fitBounds(bounds,{padding:60});
  }
  function showPopup(item){if(!cfg.map.popup||!item)return;closePopup();defineCustomPopup();activePopup=new CustomPopup(new google.maps.LatLng(item.markerLat||item.lat,item.markerLng||item.lng),item);activePopup.setMap(map);}
  function closePopup(){if(activePopup){activePopup.setMap(null);activePopup=null;}}
  function createMarker(item){var icon=markerIcon(item.numero,false);var useCluster=cfg.map.clustering&&window.markerClusterer;var o={position:markerPosition(item),map:useCluster?null:map,title:item.title};if(icon!==null)o.icon=icon;var m=new google.maps.Marker(o);m.addListener('click',function(){var sheetActive=isMobileSheetActive();activate(item.id,!sheetActive,{scrollCard:!sheetActive});showPopup(item);});markers[item.id]={marker:m,item:item};return m;}
  function addAllMarkers(){var ml=allItems.map(function(i){return createMarker(i);});if(cfg.map.clustering&&window.markerClusterer)clusterer=new markerClusterer.MarkerClusterer({map:map,markers:ml,algorithm:new markerClusterer.GridAlgorithm({maxDistance:40})});}
  function addMissingMarkers(items){
    var ml=[];
    items.forEach(function(i){if(!markers[i.id])ml.push(createMarker(i));});
    if(cfg.map.clustering&&ml.length){
      if(clusterer&&typeof clusterer.addMarkers==='function')clusterer.addMarkers(ml);
      else ml.forEach(function(m){m.setMap(map);});
    }
  }
  function syncMarkerPositions(items){
    items.forEach(function(i){
      if(markers[i.id]&&typeof markers[i.id].marker.setPosition==='function'){
        markers[i.id].item=i;
        markers[i.id].marker.setPosition(markerPosition(i));
      }
    });
  }
  function updateMarker(id,a){if(!markers[id])return;var icon=markerIcon(markers[id].item.numero,a);if(icon!==null)markers[id].marker.setIcon(icon);markers[id].marker.setZIndex(a?999:0);}
  function activate(id,pan,opts){
    opts=opts||{};
    if(activeId===id)return;
    if(activeId){updateMarker(activeId,false);var prev=root.querySelector('.lb-card[data-item-id="'+activeId+'"]');if(prev){prev.classList.remove('is-active');prev.classList.remove('cb-card--active');prev.classList.remove('lb-card--active');}}
    activeId=id;updateMarker(id,true);
    var card=root.querySelector('.lb-card[data-item-id="'+id+'"]');
    if(card){card.classList.add('is-active');card.classList.add('cb-card--active');card.classList.add('lb-card--active');if(opts.scrollCard!==false)card.scrollIntoView({behavior:'smooth',block:'nearest'});}
    if(pan&&markers[id]){
      mapTouched=true;
      map.panTo(markerPosition(markers[id].item));
      if(map.getZoom()<cfg.mapZoomOnSelect)map.setZoom(cfg.mapZoomOnSelect);
      /* Compenser la hauteur du popup (environ popup + marker + marge) */
      var popupH = cfg.map.popup ? 280 : 0;
      if(popupH > 0) setTimeout(function(){ map.panBy(0, -(popupH/2)); }, 50);
    }
  }
  function bindCards(){root.querySelectorAll('.lb-card:not(.lb-card--skeleton)').forEach(function(card){
    var id=card.dataset.itemId;
    /* Hover : allume le marker correspondant */
    card.addEventListener('mouseenter',function(){if(!markers[id])return;updateMarker(id,true);if(activeId&&activeId!==id)updateMarker(activeId,false);});
    card.addEventListener('mouseleave',function(){if(id!==activeId)updateMarker(id,false);});
    if(!cfg.display.cardClickable){
      /* Mode par défaut : clic → active carte + popup (navigation via card-link) */
      card.addEventListener('click',function(e){
        if(e.target.closest('.lb-card__link'))return;
        activate(id,true);showPopup(markers[id]&&markers[id].item);
      });
    } else {
      /* Mode cardClickable : card = <a>, clic navigue.
         On active quand même le marker au clic pour feedback visuel. */
      card.addEventListener('click',function(){activate(id,false);});
    }
  });}
  function renderList(items,count){
    var list=root.querySelector('.lb-grid');if(!list)return;
    var n=cfg.display.pageSize>0?Math.min(count,items.length):items.length;
    renderCardsProgressive(list, items, count, function(){
  bindCards();
});
    var lw=root.querySelector('.lb-footer');if(lw)lw.remove();
    if(cfg.display.pageSize>0&&items.length>n){var sb=root.querySelector('.lb-sidebar');if(sb){sb.insertAdjacentHTML('beforeend','<div class="'+escHtml(CLS_LOAD_MORE_WRAP)+'"><button class="'+escHtml(CLS_LOAD_MORE)+'" type="button">Voir plus</button></div>');var btn=sb.querySelector('.lb-load-more');if(btn)btn.addEventListener('click',async function(){
  visibleCount = Math.min(visibleCount + cfg.display.pageSize, items.length);

  if(typeof fetchMoreItems === 'function' && visibleCount >= items.length){
    try{
      var result = await fetchMoreItems();
      var nextItems = Array.isArray(result) ? result : (result && result.items);

      if(Array.isArray(nextItems)&&nextItems.length>allItems.length){
        allItems = nextItems;
        addMissingMarkers(allItems);
        syncMarkerPositions(allItems);
        var nextZones=collectZones(allItems);
        if(!zonesEqual(zones,nextZones)){zones=nextZones;syncControls();}
        currentItems = activeZone?allItems.filter(function(i){return i.zones.indexOf(activeZone)!==-1;}):allItems;
        items = currentItems;
      }
    }catch(err){
      log('Fetch more failed:', err);
    }
  }

  renderList(items, visibleCount);
});}}
  }
  function applyFilter(zone){closePopup();activeZone=zone||'';currentItems=activeZone?allItems.filter(function(i){return i.zones.indexOf(activeZone)!==-1;}):allItems;visibleCount=cfg.display.pageSize>0?cfg.display.pageSize:currentItems.length;renderList(currentItems,visibleCount);allItems.forEach(function(i){if(!markers[i.id])return;markers[i.id].marker.setVisible(currentItems.some(function(ci){return ci.id===i.id;}));});if(currentItems.length&&activeZone){var b=new google.maps.LatLngBounds();currentItems.forEach(function(i){b.extend({lat:i.lat,lng:i.lng});});map.fitBounds(b,{padding:60});}}
  function syncVisibleMarkers(){
    var visibleIds={};
    currentItems.forEach(function(i){visibleIds[i.id]=true;});
    Object.keys(markers).forEach(function(id){
      markers[id].marker.setVisible(!!visibleIds[id]);
    });
  }
  function setItems(nextItems){
    if(!Array.isArray(nextItems)||!nextItems.length)return;
    allItems=nextItems;
    addMissingMarkers(allItems);
    syncMarkerPositions(allItems);
    var nextZones=collectZones(allItems);
    if(!zonesEqual(zones,nextZones)){
      zones=nextZones;
      if(activeZone&&zones.indexOf(activeZone)===-1)activeZone='';
      syncControls();
    }else{
      var counter=root.querySelector('.lb-counter');
      if(counter)counter.textContent=getI18n(cfg).itemCount(allItems.length);
    }
    currentItems=activeZone?allItems.filter(function(i){return i.zones.indexOf(activeZone)!==-1;}):allItems;
    visibleCount=cfg.display.pageSize>0?Math.min(Math.max(visibleCount,cfg.display.pageSize),currentItems.length):currentItems.length;
    syncVisibleMarkers();
    renderList(currentItems,visibleCount);
    if(!activeZone)fitItemsOnMap(currentItems,false);
  }

  /* En mode grid, la structure HTML est identique au mode list.
     Le CSS gère l'affichage : liste=grille multi-colonnes, carte=côté droit.
     --locator-grid-list-width contrôle la proportion (défaut: 50%). */
  var lc=cfg.layout==='grid'?' '+CLS_INNER_GRID:' '+CLS_INNER_LIST;
  var blockClass=cfg.classes&&cfg.classes.block?cfg.classes.block:'';
  var cc=blockClass?' '+escHtml(blockClass):'';
  addClasses(root, CLS_BLOCK+' '+CLS_BLOCK_READY);
  removeClasses(root, CLS_BLOCK_LOADING);
  root.innerHTML='<div class="'+escHtml(CLS_INNER+lc)+cc+'"><div class="'+escHtml(CLS_SIDEBAR)+'">'+buildControls(zones,allItems.length,activeZone)+'<div class="'+escHtml(CLS_LIST)+'"></div></div><div class="'+escHtml(CLS_MAP_WRAP)+'"><div class="'+escHtml(CLS_MAP)+'"></div></div></div>';
  setupMobileSheet();
  buildMap(root.querySelector('.lb-map'));addAllMarkers();
  fitItemsOnMap(allItems,true);
  renderList(allItems,visibleCount);
  bindControls();
  log('Instance:',allItems.length,'marqueurs');
  return {setItems:setItems};
}

/* ── Init ── */
async function init(){
  var roots=Array.from(document.querySelectorAll(cfg.target));
  log('Init —',roots.length,'conteneur(s)');if(!roots.length)return;
  roots.forEach(function(r){
    addClasses(r, CLS_BLOCK+' '+CLS_BLOCK_LOADING);
    r.setAttribute('data-cb-key', cfg.key || 'locator');
    r.setAttribute('data-lb-key', cfg.key || 'locator');
    if(cfg.classes&&cfg.classes.block)r.setAttribute('data-cb-classes', cfg.classes.block);
    else r.removeAttribute('data-cb-classes');
  });
  if(!cfg.apiKey){roots.forEach(function(r){removeClasses(r, CLS_BLOCK_LOADING);addClasses(r, CLS_BLOCK_READY);r.innerHTML='<p class="'+escHtml(CLS_ERROR)+'">apiKey manquant</p>';});return;}
  roots.forEach(function(r){r.innerHTML='<div class="'+escHtml(CLS_INNER+' '+CLS_INNER_LIST)+'"><div class="'+escHtml(CLS_SIDEBAR)+'"><div class="'+escHtml(CLS_LIST)+'">'+buildSkeleton()+'</div></div><div class="'+escHtml(CLS_MAP_WRAP)+'"><div class="'+escHtml(CLS_MAP+' '+CLS_MAP_LOADING)+'"></div></div></div>';});
  try{
    var initialMaxPages = cfg.performance.maxPages || 1;
    var loaders=[fetchItemsState(initialMaxPages),loadMapsAPI()];if(cfg.map.clustering)loaders.push(loadClusterer());
    var results=await Promise.all(loaders);var itemState=results[0];var items=itemState.items||[];log('Items:',items.length);
    var loadedMaxPages = initialMaxPages;
    var progressiveMaxPages = cfg.performance.progressiveMaxPages || 'all';
    var sourceComplete = !!(itemState.complete || itemState.fetchError);
    var isFetchingMore = false;

    if(cfg.performance.filterIndex !== false && !sourceComplete){
      try{
        var completeState = await fetchItemsState(cfg.performance.filterIndexMaxPages || progressiveMaxPages || 'all');
        if(completeState && Array.isArray(completeState.items) && completeState.items.length >= items.length){
          items = completeState.items;
          loadedMaxPages = completeState.pagesLoaded || loadedMaxPages;
          sourceComplete = !!(completeState.complete || completeState.fetchError);
        }
      }catch(filterErr){
        log('Filter index failed:', filterErr);
      }
    }

    if(!items.length){roots.forEach(function(r){removeClasses(r, CLS_BLOCK_LOADING);addClasses(r, CLS_BLOCK_READY);r.innerHTML='<p class="'+escHtml(CLS_ERROR)+'">'+getI18n(cfg).noResults+'</p>';});return;}

async function fetchMoreItems(){
  if(sourceComplete || isFetchingMore){
    return {items:items, changed:false, complete:sourceComplete};
  }

  if(progressiveMaxPages !== 'all' && Number(loadedMaxPages) >= Number(progressiveMaxPages)){
    sourceComplete = true;
    return {items:items, changed:false, complete:sourceComplete};
  }

  isFetchingMore = true;

  try{
    loadedMaxPages = progressiveMaxPages === 'all'
      ? Number(loadedMaxPages || 1) + 1
      : Math.min(Number(loadedMaxPages || 1) + 1, Number(progressiveMaxPages));

    var nextState = await fetchItemsState(loadedMaxPages);
    var more = nextState.items || [];
    var changed = more.length > items.length;
    sourceComplete = !!(nextState.complete || nextState.fetchError);

    if(changed){
      items = more;
    }

    return {items:items, changed:changed, complete:sourceComplete};
  }finally{
    isFetchingMore = false;
  }
}

var instances=roots.map(function(r){return createInstance(r,items,fetchMoreItems);});

function completeInIdle(){
  if (typeof fetchMoreItems !== 'function') return;

  fetchMoreItems().then(function(result){
    if (!result) return;

    if (result.changed) {
      items = result.items || items;

      instances.forEach(function(instance){
        if(instance&&typeof instance.setItems==='function')instance.setItems(items);
      });
    }

    if (!result.complete && cfg.performance.progressiveMaxPages === 'all') {
      scheduleIdleCompletion();
    }
  }).catch(function(err){
    log('Idle fetch failed:', err);
  });
}

function scheduleIdleCompletion(){
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(completeInIdle, { timeout: 2000 });
  } else {
    window.setTimeout(completeInIdle, 800);
  }
}

if (cfg.performance.idleComplete === true || cfg.performance.idlePreload === true) {
  scheduleIdleCompletion();
}
  }catch(err){console.error('Locator Block:',err);roots.forEach(function(r){removeClasses(r, CLS_BLOCK_LOADING);addClasses(r, CLS_BLOCK_READY);r.innerHTML='<p class="'+escHtml(CLS_ERROR)+'">Erreur: '+escHtml(err.message)+'</p>';});}
}

function scheduleInit(){
  var roots=Array.from(document.querySelectorAll(cfg.target));
  log('Schedule —',roots.length,'conteneur(s)');
  if(!roots.length){
    var waitObserver=new MutationObserver(function(){
      roots=Array.from(document.querySelectorAll(cfg.target));
      if(!roots.length)return;
      waitObserver.disconnect();
      scheduleInit();
    });
    waitObserver.observe(document.documentElement,{childList:true,subtree:true});
    return;
  }

  if(cfg.performance.lazyInit===false||!('IntersectionObserver'in window)){
    init();
    return;
  }

  var started=false;
  var obs=new IntersectionObserver(function(entries){
    if(started)return;
    var hit=entries.some(function(e){return e.isIntersecting;});
    if(!hit)return;
    started=true;
    obs.disconnect();
    init();
  },{rootMargin:cfg.performance.lazyRootMargin||'1200px 0px'});

  roots.forEach(function(r){obs.observe(r);});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',scheduleInit,{once:true});
}else{
  scheduleInit();
}

}

function getLocatorConfigs(){
  if(Array.isArray(window.LOCATOR_BLOCK_CONFIGS)){
    return window.LOCATOR_BLOCK_CONFIGS;
  }

  return [];
}

getLocatorConfigs().forEach(function(locatorConfig){
  if(locatorConfig && locatorConfig.enabled !== false){
    setupLocatorBlock(locatorConfig);
  }
});

})();
