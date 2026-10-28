// Isolated local browser acceptance against the release candidate, not the live site.
// Playwright runs a clean Chromium profile in the GitHub Actions runner.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:8765/';
const results=[];
async function test(name,fn){
 let page;
 try{
  const context=await browser.newContext({viewport:{width:1280,height:860}});
  page=await context.newPage();
  await fn(page,context);
  results.push({name,ok:true});console.log('PASS',name);
 }catch(e){results.push({name,ok:false});console.error('FAIL',name,e?.stack||String(e))}
 finally{if(page){await page.context().close().catch(()=>{})}}
}
function url(mode,hash='#/'){return base+'?openingQA=1&mode='+encodeURIComponent(mode)+hash}
const overlay='.gt-draw-entry-overlay';
async function isUnlocked(page){
 const state=await page.evaluate(()=>({
  exists:!!document.querySelector('.gt-draw-entry-overlay'),
  locked:document.documentElement.classList.contains('gt-draw-entry-active'),
  scroll:window.getComputedStyle(document.documentElement).overflow
 }));
 assert.equal(state.exists,false,'overlay not removed');
 assert.equal(state.locked,false,'document scroll lock not cleared');
}
await test('OFF bypasses opening',async(page)=>{
 await page.goto(url('none'),{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(300);
 assert.equal(await page.locator(overlay).count(),0);
});
await test('Existing V30 draw loads and SKIP safely returns to home',async(page)=>{
 await page.goto(url('draw'),{waitUntil:'domcontentloaded'});
 await page.waitForSelector(overlay,{timeout:15000});
 await page.locator('.gt-draw-entry-skip').click();
 await page.waitForSelector(overlay,{state:'detached',timeout:7000});
 await isUnlocked(page);
});
await test('Editorial V29 resolves back to homepage automatically',async(page)=>{
 await page.goto(url('editorial29'),{waitUntil:'domcontentloaded'});
 await page.waitForSelector(overlay,{timeout:15000});
 await page.locator('.gt-draw-entry-frame').waitFor({state:'attached'});
 await page.waitForSelector(overlay,{state:'detached',timeout:22000});
 await isUnlocked(page);
});
await test('V21 physics iframe enables embed and exit on SKIP',async(page)=>{
 await page.goto(url('physics21'),{waitUntil:'domcontentloaded'});
 await page.waitForSelector(overlay,{timeout:15000});
 const src=await page.locator('.gt-draw-entry-frame').getAttribute('src');
 assert.ok(src.includes('embed=1'),'physics embed mode missing');
 await page.locator('.gt-draw-entry-skip').click();
 await page.waitForSelector(overlay,{state:'detached',timeout:7000});
 await isUnlocked(page);
});
await test('Direct brand deep link bypasses overlay',async(page)=>{
 await page.goto(url('draw','#/brands'),{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(500);
 assert.equal(await page.locator(overlay).count(),0);
});
await test('Reduced-motion visitor bypasses animation',async(page)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(url('magnetic'),{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(500);
 assert.equal(await page.locator(overlay).count(),0);
});
await test('Mobile viewport touch-usable and scroll unlocked after skip',async(page)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(url('draw'),{waitUntil:'domcontentloaded'});
 await page.waitForSelector(overlay,{timeout:15000});
 const skip=page.locator('.gt-draw-entry-skip');
 assert.equal(await skip.isVisible(),true,'skip inaccessible on phone');
 await skip.click();
 await page.waitForSelector(overlay,{state:'detached',timeout:7000});
 await isUnlocked(page);
});
await browser.close();
const failed=results.filter(x=>!x.ok);
console.log('\nBROWSER TESTS',results.length,'total',failed.length,'failed');
if(failed.length)process.exitCode=1;
