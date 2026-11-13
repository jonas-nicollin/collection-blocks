const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {test}=require('node:test');const assert=require('node:assert/strict');
for(const file of ['banner-block.js','gallery-block.js']) {
 test(file+' leaves editing content untouched and observes only edit-state classes',()=>{
  const watches=[];let queries=0;const cls={contains:n=>n==='squarespace-edit-mode-active'};
  const window={addEventListener(){}};
  const document={readyState:'complete',body:{classList:cls},documentElement:{classList:cls},
    addEventListener(){},querySelectorAll(){queries++;return []}};
  class MutationObserver {constructor(cb){this.cb=cb}observe(node,opts){watches.push(opts);this.cb()}}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),
   {window,document,MutationObserver,console});
  assert.equal(queries,0);assert.equal(watches.length,2);
  for(const opts of watches){assert.equal(opts.subtree,undefined);assert.equal(opts.attributeFilter[0],'class');}
 });
}
test('Shared map options preserve cloud mapId and allow local overrides',()=>{
 const window={COLLECTION_BLOCKS_MAP_CONFIG:{style:'clean',options:{zoomControl:false}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension-map.js'),'utf8'),{window});
 const api=window.CollectionBlocksMap;
 assert(api.options({},{}).styles.length>0);
 assert.equal(api.options({},{}).zoomControl,false);
 const cloud=api.options({mapId:'test-map'},{});
 assert.equal(cloud.mapId,'test-map');assert.equal(cloud.styles,undefined);
});
