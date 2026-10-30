const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const window={},context=vm.createContext({window,document:{readyState:'loading',addEventListener(){}},console,URL,URLSearchParams,setTimeout,clearTimeout,Date});
vm.runInContext(read('collection-blocks.js'),context);
vm.runInContext(read('query-block.js').replace(/\}\)\(\);\s*$/,'window.testQuery={matchesConfiguredFilter,matchesUIFilters};})();'),context);
const selection=window.CollectionBlocks.selection;
const rows=[
 {title:'A clay work',excerpt:'Céramique',location:'Genève',categories:['Exposition'],tags:['Theme: Clay','Selection: Partner','Date: 2026-09-16T18:00'],publishOn:Date.parse('2026-12-31T23:30Z')},
 {title:'A talk',categories:['Talk'],tags:['Theme: Clay','Date: 2026-09-17T12:00']},
 {title:'Another work',categories:['Exposition'],tags:['Theme: Photo']},{}
];
function legacy(fn,args){const current=window.CollectionBlocks.selection;window.CollectionBlocks.selection=null;try{return fn(...args)}finally{window.CollectionBlocks.selection=current}}
test('shared selection preserves existing category, tag, date, wildcard, year and search rules',()=>{
 const cases=[{}, {category:'exposition'}, {tags:{Theme:'CLÁY'}},{tags:{Date:'2026-09-16'}}, {tags:{Date:'*'}},
 {tags:{__publicationYear:'2027'}},{search:'ceramique'}, {category:'Exposition',tags:{Theme:'Clay',Selection:'Partner'}}, {tags:{Theme:'Unknown'}}];
 for(const state of cases)for(const item of rows.slice(0,3)){
  const filters={publicationYear:{timeZone:'Europe/Zurich'}};
  assert.equal(selection.matches(item,state,filters),legacy(window.testQuery.matchesUIFilters,[item,state,filters]));
 }
});
test('configured tab predicates keep exclusions and explicit AND/OR tag rules',()=>{
 const filters=[{categories:['Exposition']},{excludeCategories:['Exposition']},{tagValues:[{prefix:'Theme',value:'Clay'},{prefix:'Selection',value:'Partner'}]},
 {tagValuesAny:[{prefix:'Theme',value:'Photo'},{prefix:'Selection',value:'Partner'}]}, {excludeTagValues:[{prefix:'Theme',value:'Clay'}]}, {excludeTagPrefixes:['Selection']}];
 for(const filter of filters)for(const item of rows.slice(0,3))assert.equal(selection.matchesConfigured(item,filter),legacy(window.testQuery.matchesConfiguredFilter,[item,filter,{}]));
});
test('selection remains pure, preserves order and accepts absent metadata',()=>{
 const before=JSON.stringify(rows);assert.equal(selection.filter(rows,{tags:{Theme:'Clay'}}).length,2);
 assert.equal(selection.filter(rows,{}).length,4);assert.equal(JSON.stringify(rows),before);
 assert.equal(selection.matches({}, {category:'Talk'}),false);assert.equal(selection.matches({}, {tags:{Theme:'Clay'}}),false);
 assert.equal(selection.filter(rows,{category:'Exposition'})[0],rows[0]);
});
test('configured temporal selection uses explicit timezone and reference time',()=>{
 const item={tags:['Date: 2026-09-17T23:00']};
 assert.equal(selection.matchesConfigured(item,{dateStatus:{prefix:'Date',include:['upcoming']}},{timeZone:'Europe/Zurich',now:new Date('2026-09-17T20:00Z')}),true);
 assert.equal(selection.matchesConfigured(item,{dateStatus:{prefix:'Date',include:['past']}},{timeZone:'Europe/Zurich',now:new Date('2026-09-18T00:30Z')}),true);
});
