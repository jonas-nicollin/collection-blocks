const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
function fixture(mobile=true){
 const content={hidden:false,id:'',removeAttribute(k){delete this[k]},insertAdjacentElement(_,b){this.button=b}};
 const media={matches:mobile,addEventListener(_,fn){this.change=fn},removeEventListener(){this.change=null}};
 const scope={querySelector(){return content},contains(){return true}};
 const document={documentElement:{},addEventListener(){},createElement(){return {hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(_,fn){this.click=fn},removeEventListener(){this.click=null},remove(){this.removed=true}}}};
 const context={window:{matchMedia:()=>media,addEventListener(){}},document,
 requestAnimationFrame(){},MutationObserver:class{observe(){}}};
 vm.runInNewContext(fs.readFileSync('extension-collapse.js','utf8'),context);
 return {content,media,scope,api:context.window.CollectionBlocksCollapse};
}
test('Panel is closed on mobile, exposed to accessibility, and opens once',()=>{
 const {api,scope,content}=fixture();const cfg={mode:'panel',mediaQuery:'mobile',blockPrefix:'locb'};
 const c=api.mount(scope,cfg),b=content.button;
 assert(content.hidden);assert.equal(b.attrs['aria-expanded'],'false');
 assert.equal(b.attrs['aria-controls'],content.id);assert(b.className.includes('locb-collapse__toggle'));
 assert.equal(api.mount(scope,cfg),c);b.click();assert(!content.hidden);
 assert.equal(b.attrs['aria-expanded'],'true');c.destroy();assert(!content.hidden);assert(!content.id);
});
test('Desktop is always open and breakpoint changes preserve mobile choice',()=>{
 const {api,scope,content,media}=fixture(false);api.mount(scope,{mode:'panel',mediaQuery:'mobile'});
 assert(!content.hidden);assert(content.button.hidden);
 media.matches=true;media.change();assert(content.hidden);content.button.click();
 media.matches=false;media.change();media.matches=true;media.change();assert(!content.hidden);
});
test('Removed content destroys listeners and permits a clean remount',()=>{
 const {api,scope,content,media}=fixture();const cfg={mode:'panel',mediaQuery:'mobile'};
 const first=api.mount(scope,cfg);scope.contains=()=>false;first.refresh();
 assert(content.button.removed);assert.equal(media.change,null);assert.notEqual(api.mount(scope,cfg),first);
});
