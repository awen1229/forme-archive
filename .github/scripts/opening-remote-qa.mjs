// Remote, read-only release acceptance checks. No secrets, no writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ORIGIN='https://awen1229.github.io';
const candidate='https://release-opening-selector-saf.forme-archive.pages.dev';
const sanityBase='https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production';
const query='*[_id=="gt-opening-settings" && !(_id in path("drafts.**"))][0]{settingsJson}';
const sanity=sanityBase+'?perspective=published&query='+encodeURIComponent(query);
const failures=[];
async function report(label,fun){
 try{const d=await fun();console.log('PASS',label,d||'')}
 catch(e){const msg=e?.message||String(e);failures.push(label+': '+msg);console.error('FAIL',label,msg)}
}
async function fetchResource(url,headers={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{return await fetch(url,{redirect:'follow',headers,signal:controller.signal})}finally{clearTimeout(timer)}
}
await report('Published Sanity Content Lake reachable with official origin',async()=>{
 const r=await fetchResource(sanity,{Origin:ORIGIN});
 assert.equal(r.status,200,'Sanity published-only request HTTP '+r.status);
 const j=await r.json();
 assert.ok(Object.hasOwn(j,'result'),'no Sanity result');
 return j.result?'Published settings document exists':'No opening settings yet: legacy V30 fallback expected';
});
await report('Sanity allows official GitHub Pages origin via CORS',async()=>{
 const r=await fetchResource(sanity,{Origin:ORIGIN});
 assert.equal(r.status,200,'Sanity query HTTP '+r.status);
 const allowed=r.headers.get('access-control-allow-origin');
 assert.ok(allowed===ORIGIN||allowed==='*','Access-Control-Allow-Origin missing/mismatched; got '+String(allowed));
 return 'CORS: '+allowed;
});
let accessProtected=false;
await report('Candidate QA hostname responds (Access protection is expected)',async()=>{
 const r=await fetchResource(candidate+'/opening-release-qa.html');
 const html=await r.text();
 if(!html.includes('RELEASE ACCEPTANCE / NOT LIVE')||!html.includes('id="catalog"')){
  if(html.includes('Cloudflare Access')||html.includes('cloudflareaccess.com')||html.includes('<title>Login</title>')||html.includes('Access to this application')){
   accessProtected=true;
   return 'SKIP browser-level candidate asset check: Cloudflare Access login required';
  }
  throw Error('Unexpected candidate content HTTP '+r.status+'; possible misconfiguration');
 }
 assert.equal(r.status,200);
 return 'Candidate QA catalog found';
});
if(accessProtected)console.log('SKIP remote candidate asset tests: Access-protected preview; local Chromium smoke covers bundled assets');
else for(const path of ['gt-opening-public-controller.js','opening-lab-physics-v21.html','opening-lab-design-v27.html','gt-opening-embed.css']){
 await report('Candidate resource '+path,async()=>{
  const r=await fetchResource(candidate+'/'+path);
  assert.equal(r.status,200,'HTTP '+r.status);
  const body=await r.text();
  assert.ok(body.length>500,'unexpectedly short asset');
  assert.ok(!body.includes('Cloudflare Access')&&!body.includes('<title>Login</title>'),'Access login HTML returned');
  return body.length+' chars';
 });
}
await report('Official main site serves a recognized V30 or released controller',async()=>{
 const r=await fetchResource(ORIGIN+'/forme-archive/');
 assert.equal(r.status,200,'Official home HTTP '+r.status);
 const html=await r.text();
 const legacy=html.includes('gt-draw-intro-v30.js?v=20261025e');
 const released=html.includes('gt-opening-public-controller.js?v=20261028-release-candidate1');
 assert.ok(legacy||released,'unexpected public homepage script; inspect before deploying');
 return legacy?'Original legacy V30 active':'Published-only controller deployed';
});
await report('Local branch only replaces official intro script',async()=>{
 const text=await readFile('index.html','utf8');
 assert.ok(text.includes('gt-opening-public-controller.js?v=20261028-release-candidate1'),'release script absent');
 assert.ok(!text.includes('gt-home-intro-lab.js?v=20261028-studio1'),'preview-only files unexpectedly bundled');
});
console.log('\n'+(failures.length?'RELEASE BLOCKED':'REMOTE CHECKS PASSED')+' ('+failures.length+' failures)');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}
