const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../banner-block.js'),'utf8');
const image='https://images.squarespace-cdn.com/portrait.jpg';
const block=(url=image,layout='stack')=>`<div class="sqs-block"><div class="design-layout-${layout}"><img data-src="${url}"></div></div>`;
async function setup({config={},content='',reply={item:{assetUrl:image,title:'Person',fullUrl:'/routes/person',mediaFocalPoint:{x:.2,y:.3},originalSize:'600x800'}},fetcher}={}){
  const dom=new JSDOM(`<body class="view-item"><article class="blog-item-wrapper"><div class="blog-item-top-wrapper"><div class="blog-item-title"><h1>Person</h1></div></div><div class="blog-item-content-wrapper">${content}</div></article></body>`,{url:'https://example.com/routes/person',runScripts:'outside-only'});
  let calls=0;const w=dom.window;
  w.fetch=async()=>{calls++;return fetcher?fetcher():{ok:true,json:async()=>reply};};
  w.BANNER_BLOCK_CONFIGS=[{bodyClassConditions:['view-item'],imageSource:'thumbnail',
    thumbnailOverrideSelector:'.design-layout-poster',bannerSelectors:'.design-layout-stack',
    destinationSelector:'.blog-item-wrapper',heading:{hideSourceSelector:'.blog-item-top-wrapper'},
    backLink:{href:'/routes',label:'Routes'},...config}];
  w.eval(source);await new Promise(r=>setTimeout(r,15));
  return {w,doc:w.document,calls:()=>calls,close:()=>w.close()};
}
test('thumbnail uses post image and focal point without requiring a content image',async()=>{
 const p=await setup();const b=p.doc.querySelector('.cb-banner');
 assert(b);assert.match(b.querySelector('img').src,/portrait\.jpg/);
 assert.equal(b.style.getPropertyValue('--image-focal-point'),'20% 30%');
 assert.equal(b.querySelector('img').width,600);assert.equal(p.doc.querySelectorAll('h1').length,1);
 assert.equal(b.querySelector('a').pathname,'/routes');p.close();
});
test('explicit poster overrides thumbnail without requesting post JSON',async()=>{
 const p=await setup({content:block('https://example.com/override.jpg','poster')});
 assert.equal(p.calls(),0);assert.match(p.doc.querySelector('.cb-banner img').src,/override/);p.close();
});
test('missing thumbnail falls back to configured content and failed media preserves title',async()=>{
 for(const content of ['',block()]){
  const p=await setup({content,reply:{item:{title:'No image'}}});
  assert.equal(!!p.doc.querySelector('.cb-banner'),!!content);
  if(!content)assert.equal(p.doc.querySelector('.blog-item-top-wrapper').hidden,false);
  p.close();
 }
});
test('duplicate hiding is exact and native content returns in edit mode',async()=>{
 const p=await setup({content:block()+block('https://example.com/other.jpg'),config:{hideMatchingContentImage:true}});
 assert.equal(p.doc.querySelectorAll('.bnb-banner__source').length,1);
 p.doc.body.classList.add('sqs-edit-mode-active');await new Promise(r=>setTimeout(r,5));
 assert.equal(p.doc.querySelectorAll('.bnb-banner,.bnb-banner__source').length,0);
 assert(p.doc.querySelector('.blog-item-title h1'));p.close();
});
test('a slow thumbnail cannot mount after editor entry or multiply on refresh',async()=>{
 let resolve;const deferred=new Promise(r=>resolve=r);
 const p=await setup({fetcher:()=>deferred});p.w.BannerBlock.refresh();p.w.BannerBlock.refresh();
 assert.equal(p.calls(),1);p.doc.body.classList.add('sqs-edit-mode-active');
 await new Promise(r=>setTimeout(r,5));
 resolve({ok:true,json:async()=>({item:{assetUrl:image}})});
 await new Promise(r=>setTimeout(r,5));assert.equal(p.doc.querySelector('.cb-banner'),null);p.close();
});
test('legacy content-only banners never request post JSON',async()=>{
 const p=await setup({content:block(),config:{imageSource:undefined}});
 assert(p.doc.querySelector('.cb-banner'));assert.equal(p.calls(),0);p.close();
});
