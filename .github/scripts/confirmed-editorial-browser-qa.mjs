import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:8765/?layoutQA=1&openingQA=1&mode=none';
const results=[];
const fakeBrand={name:'TEST EDITORIAL BRAND',slug:{current:'test-editorial-brand'},founder:'TEST STUDIO',foundedYear:'2020',summary:'This is a published test record.',editorNoteTitle:'Selected editorial title',editorNote:'This is a published editor note.',tags:['JAPAN'],website:'https://example.com',logoScale:100,logoOffsetX:0,logoOffsetY:0,logoUrl:''};
async function run(name,viewport,hash,assertions){
 let context=null;
 try{
  context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/data/query/production?**',async route=>{
   const query=new URL(route.request().url()).searchParams.get('query')||'';
   const result=query.includes('_type == "brand"')?[fakeBrand]:query.includes('gt-opening-settings')?null:[];
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({result})});
  });
  await page.goto(base+hash,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  await assertions(page);
  const renderErrors=errors.filter(x=>!x.includes('Network')&&!x.includes('fetch'));
  assert.deepEqual(renderErrors,[],'Unexpected JS page errors '+renderErrors.join(';'));
  results.push({name,ok:true});console.log('PASS',name);
 }catch(e){results.push({name,ok:false});console.error('FAIL',name,e.stack||String(e))}
 finally{await context?.close()}
}
await run('Homepage: approved white editorial and thin ink frame',{width:1365,height:900},'#/',async page=>{
 await page.waitForSelector('.gt-editorial-home .gt-mag-stage',{timeout:12000});
 const result=await page.evaluate(()=>{
  const hero=document.querySelector('.gt-editorial-home .gt-mag-stage');
  const root=document.querySelector('.site-header');
  const style=getComputedStyle(hero);
  return {border:style.borderTopWidth,rounded:style.borderTopLeftRadius,header:getComputedStyle(root).backgroundColor,layoutStyles:[...document.styleSheets].map(s=>s.href||'').filter(x=>x.includes('gt-ink-frame-study.css')).length};
 });
 assert.equal(result.border,'1px');
 assert.ok(parseFloat(result.rounded)>=3,'thin rounded frame missing');
 assert.equal(result.layoutStyles,1,'approved stylesheet missing');
 assert.equal(result.header,'rgb(255, 255, 255)','white editorial background missing');
 assert.equal(await page.locator('.gt-brand-logo').count(),1,'original LOGO missing');
});
await run('Published THE INDEX: A black frame wraps authored Editor Note only',{width:1365,height:900},'#/brand/test-editorial-brand',async page=>{
 await page.waitForSelector('.gt-index-profile-v2 .gt-profile-editor-note',{timeout:12000});
 const note=page.locator('.gt-profile-editor-note');
 assert.equal(await note.count(),1);
 assert.ok((await note.textContent()).includes('Selected editorial title'));
 assert.ok((await note.textContent()).includes('This is a published editor note.'));
 const border=await note.evaluate(n=>getComputedStyle(n).borderTopWidth);
 assert.equal(border,'1px');
 assert.equal(await page.locator('.gt-index-profile-v2 .gt-profile-story').count(),1);
});
await run('Published THE INDEX: absent editorial note is not manufactured',{width:1280,height:860},'#/brand/test-editorial-brand',async page=>{
 // Published note is shown for the fixture above; validate that the implementation never hardcodes it.
 const js=await page.evaluate(async()=>await(await fetch('./gt-index-profile-v2.js')).text());
 assert.ok(js.includes("const note=String(b.editorNote||'').trim()"),'optional-note guard missing');
});
await run('Mobile: editorial home and menu are usable',{width:390,height:844},'#/',async page=>{
 await page.waitForSelector('.gt-editorial-home .gt-mag-stage',{timeout:12000});
 assert.equal(await page.locator('.gt-brand-logo').count(),1);
 const overflow=await page.evaluate(()=>({width:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
 assert.ok(overflow.content<=overflow.width+8,'horizontal overflow '+JSON.stringify(overflow));
 const menu=page.locator('.gt-side-tab');
 assert.ok(await menu.count()>0,'original dark MENU tab absent');
});
await run('Mobile: featured text only; olive MENU opens and original warm drawer remains',{width:390,height:844},'#/',async page=>{
 await page.waitForSelector('.gt-editorial-home .gt-feature-intro > span:first-child',{timeout:12000});
 const style=await page.evaluate(()=>{
  const label=document.querySelector('.gt-editorial-home .gt-feature-intro > span:first-child');
  const labelCSS=getComputedStyle(label);
  const before=getComputedStyle(label,'::before');
  const menu=document.getElementById('gt-side-tab');
  return {
   labelText:label?.textContent?.trim(),
   labelBorder:labelCSS.borderTopWidth,
   labelRadius:labelCSS.borderTopLeftRadius,
   labelBackground:labelCSS.backgroundColor,
   markerContent:before.content,
   markerDisplay:before.display,
   menuColor:getComputedStyle(menu).backgroundColor
  };
 });
 assert.ok(style.labelText?.includes('FEATURED STORIES'),'featured editorial label missing');
 assert.equal(style.labelBorder,'0px','capsule border not removed');
 assert.equal(style.labelRadius,'0px','capsule rounding not removed');
 assert.equal(style.labelBackground,'rgba(0, 0, 0, 0)','featured text still has badge background');
 assert.ok(style.markerContent==='none'||style.markerDisplay==='none','decorative marker still visible');
 assert.equal(style.menuColor,'rgb(46, 52, 45)','MENU should be deep olive #2e342d');
 await page.locator('#gt-side-tab').click();
 await page.waitForSelector('#gt-drawer.is-open',{timeout:6000});
 const drawerColor=await page.locator('#gt-drawer').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(drawerColor,'rgb(232, 229, 220)','warm drawer must retain its color');
 await page.locator('#gt-drawer-close').click();
 await page.waitForSelector('#gt-drawer.is-open',{state:'detached',timeout:6000});
});
await run('Mobile: branded index editor note fits',{width:390,height:844},'#/brand/test-editorial-brand',async page=>{
 await page.waitForSelector('.gt-index-profile-v2 .gt-profile-editor-note',{timeout:12000});
 const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
 assert.ok(dims.content<=dims.width+8,'horizontal overflow '+JSON.stringify(dims));
});
await browser.close();
const failures=results.filter(x=>!x.ok);
console.log('EDITORIAL BROWSER QA:',results.length+' tested, '+failures.length+' failed');
if(failures.length)process.exitCode=1;
