const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function core(){
 const window={location:{href:'https://example.com/programme/item',origin:'https://example.com'}};
 vm.runInNewContext(read('collection-blocks.js'),{window,URL,URLSearchParams,console,
  document:{readyState:'loading',addEventListener(){}},setTimeout,clearTimeout});
 return window.CollectionBlocks.utils;
}
test('Central link selects venue identity, removes stale focus and retains other URL state',()=>{
 const url=core().buildLocatorUrl('/map?item=old&foo=bar#list',{
  venue:{key:'lovay',location:{addressLine1:'Central',mapLat:46,mapLng:6}},
  location:{addressLine1:'Native',markerLat:50,markerLng:10}
 },{source:'venue'});
 assert.equal(url,'/map?foo=bar&venue=lovay#list');
});
test('Native fallback transports its own coordinates, not the organizer venue',()=>{
 const url=core().buildLocatorUrl('/map',{id:'event',title:'Event',
  location:{addressLine1:'Guest venue',markerLat:46.2,markerLng:6.1}
 },{source:'venue'});
 const p=new URL(url,'https://example.com').searchParams;
 assert.equal(p.get('lat'),'46.2');assert.equal(p.get('lng'),'6.1');
 assert.equal(p.get('place'),'Guest venue');assert.equal(p.get('venue'),null);
});
test('Missing or invalid coordinates never generate a zero-coordinate place',()=>{
 for(const location of [{},{mapLat:null,mapLng:null},{mapLat:'',mapLng:''},
  {mapLat:100,mapLng:6}]) {
  const url=core().buildLocatorUrl('/map',{id:'unknown',location});
  assert.equal(url,'/map?item=unknown');
 }
});
const window={};
vm.runInNewContext(read('location-block.js').replace("if(document.readyState === 'loading'){",
 'window.test={fieldValueHtml};\n'+"if(document.readyState === 'loading'){"),{
 window,URL,document:{readyState:'loading',addEventListener(){}},Intl,Date});
const field=window.test.fieldValueHtml;
test('Compact contacts preserve destinations and never fabricate channel handles',()=>{
 const site=field({type:'url',display:'compact'},'https://www.musee-ariana.ch/');
 assert(site.includes('href="https://www.musee-ariana.ch/"'));
 assert(site.includes('>www.musee-ariana.ch</a>'));
 assert(field({key:'facebook',type:'url',display:'compact'},
  'https://fr-fr.facebook.com/museearianageneve/').includes('>@museearianageneve</a>'));
 assert(field({key:'youtube',type:'url',display:'compact'},
  'https://www.youtube.com/@musee-ariana').includes('>@musee-ariana</a>'));
 assert(field({key:'youtube',type:'url',display:'compact'},
  'https://www.youtube.com/channel/UC123').includes('>www.youtube.com/channel/UC123</a>'));
 assert(field({type:'phone',display:'compact'},'+41223292835').includes('>+41 22 329 28 35</a>'));
});
test('Legacy website rendering remains unchanged without compact option',()=>{
 assert(field({type:'url'},'https://example.com/').includes('>https://example.com/</a>'));
});
