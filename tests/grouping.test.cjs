const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const window={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../collection-blocks.js'),'utf8'),{window,console,URL,URLSearchParams,Date});
const api=window.CollectionBlocks.grouping,plain=v=>JSON.parse(JSON.stringify(v));
const item={id:'stable-id',categories:['Talk','Other'],tags:['Theme: Clay','Year: 2026','Date: 2026-09-16T12:00','Date: 2026-09-16T18:00','Date: 2026-09-17T12:00']};
test('Group keys preserve first category/tag and all distinct occurrence days',()=>{
 assert.deepEqual(plain(api.keys(item,'category')),['Talk']);
 assert.deepEqual(plain(api.keys(item,{tagPrefix:'Theme'})),['Clay']);
 assert.deepEqual(plain(api.keys(item,{tagPrefix:'Date',groupByDay:true})),['2026-09-16','2026-09-17']);
 assert.deepEqual(plain(api.keys(item,{tagPrefix:'Date',groupByYear:true})),['2026']);
 assert.deepEqual(plain(api.keys({}, {tagPrefix:'Theme'})),['—']);
});
test('Combined group is one tuple without duplicating cards or modifying metadata',()=>{
 const before=JSON.stringify(item);
 assert.deepEqual(plain(api.keys(item,['category',{tagPrefix:'Theme'}])),['Talk · Clay']);
 assert.equal(JSON.stringify(item),before);
 assert.deepEqual(plain(api.order(['Talk','Work','Other'],['Work','Talk'])),['Work','Talk','Other']);
});
test('Explicit editorial IDs are opt-in, exact and combined with other conditions',()=>{
 const s=window.CollectionBlocks.selection;
 assert.equal(s.matchesConfigured(item,{}),true);
 assert.equal(s.matchesConfigured(item,{includeIds:[]}),false);
 assert.equal(s.matchesConfigured(item,{includeIds:['stable-id']}),true);
 assert.equal(s.matchesConfigured(item,{includeIds:['stable-id'],categories:['Work']}),false);
 assert.equal(s.matchesConfigured(item,{includeIds:['STABLE-ID']}),false);
});
