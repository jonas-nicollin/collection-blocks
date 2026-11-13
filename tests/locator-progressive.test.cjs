const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','locator-block.js'),'utf8');
const fn=source.slice(source.indexOf('function renderCardsProgressive('),source.indexOf('function buildSkeleton('));
for (const shared of [false,true]) test('Replacing a pending Locator list cancels stale cards ('+shared+')',()=>{
 const queue=[],list={html:'',appendChild(f){this.html+=f.html;},insertAdjacentHTML(_,h){this.html+=h;},set innerHTML(h){this.html=h;}};
 let completed=[];
 const utils=shared?{appendProgressiveDOM(items,target,render,options){let i=0;function batch(){if(!options.isCurrent())return;target.html+=render(items[i++]).html;if(i<items.length)queue.push(batch);else options.done();}batch();}}:null;
 const context={cfg:{display:{pageSize:0},performance:{domBatchSize:1}},getCollectionUtils:()=>utils,getCollectionBlocks:()=>null,
  document:{createElement(){return{set innerHTML(v){this.firstElementChild={html:v};}};}},buildCardHTML:i=>String(i),requestAnimationFrame:f=>queue.push(f),LOCATOR_RENDER_IMAGE_INDEX:0};
 vm.createContext(context);vm.runInContext(fn,context);
 context.renderCardsProgressive(list,[1,2,3],3,()=>completed.push('old'));
 context.renderCardsProgressive(list,['venue'],1,()=>completed.push('new'));
 while(queue.length)queue.shift()();
 assert.equal(list.html,'venue');assert.deepEqual(completed,['new']);
});
