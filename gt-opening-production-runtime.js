/* GOOD THINGS, / Published opening reader for the future production site.
   This file is prepared on the protected development branch. It does NOT
   activate until this runtime and its original studies are deployed to main.
   Sanity is read with published perspective only; never reads drafts. */
(()=>{
'use strict';
const githubHost=location.hostname==='awen1229.github.io' &&
 /^\/forme-archive(?:\/|$)/.test(location.pathname);
if(!githubHost||location.protocol!=='https:')return;
const hash=location.hash;
const home=!hash||hash==='#'||hash==='#/';
if(!home||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const root=document.documentElement,overlay=document.getElementById('gt-scroll-entry');
if(!overlay)return;
const modes=new Set([
 'draw','physics21','physics10','ink','letters','paper','print','offset','proof','anchor','registration',
 'v25-material','v25-space','v25-index','v26-material','v26-space','v26-index',
 'magnetic','diecut','exposure','ripple','editorial28','editorial29','none'
]);
const params=new URLSearchParams(location.search);
if(params.get('intro')==='off')return;
const api='https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production';
const query='*[_id=="gt-opening-settings"&&!(_id in path("drafts.**"))][0]{settingsJson}';
const uri=api+'?perspective=published&query='+encodeURIComponent(query);
let dead=false;
const cancel=()=>{dead=true;root.classList.remove('gt-opening-production-pending')};
window.addEventListener('hashchange',()=>{if(!['','#','#/'].includes(location.hash))cancel()},{once:true});
async function boot(){
 const timeout=new AbortController();
 const guard=setTimeout(()=>timeout.abort(),3500);
 let selected=null;
 try{
  const response=await fetch(uri,{cache:'no-store',credentials:'omit',signal:timeout.signal});
  if(!response.ok)throw Error('published settings unavailable');
  const data=(await response.json()).result;
  if(!data?.settingsJson)return;
  const value=JSON.parse(data.settingsJson);
  if(!modes.has(value?.mode)||!['once','always'].includes(value?.repeat))return;
  selected=value;
 }catch(error){console.warn('Opening configuration unavailable:',error?.message);return}
 finally{clearTimeout(guard);cancel()}
 if(!selected||dead&&location.hash&&!['#','#/'].includes(location.hash))return;
 if(selected.mode==='none')return;
 const seenKey='gt-opening-seen-v1-'+selected.mode;
 try{if(selected.repeat==='once'&&sessionStorage.getItem(seenKey)==='done')return}catch(_){}
 root.dataset.gtOpeningSelected=selected.mode;
 root.classList.add('gt-scroll-entry-ready');
 const jsByMode={
  draw:'gt-home-intro-draw-v30.js',
  physics21:'gt-home-intro-scroll-v21.js',
  physics10:'gt-home-intro.js'
 };
 let script;
 if(selected.mode==='draw')root.classList.add('gt-draw-opening');
 else if(selected.mode==='physics21')root.classList.add('gt-scroll-entry-pinnedstage21');
 else if(selected.mode!=='physics10')root.classList.add('gt-opening-lab');
 script=document.createElement('script');
 script.src='./'+(jsByMode[selected.mode]||'gt-home-intro-lab.js')+'?public-opening=1';
 script.defer=true;
 script.onerror=()=>{
  root.classList.remove('gt-scroll-entry-ready','gt-draw-opening','gt-opening-lab','gt-scroll-entry-pinnedstage21');
  overlay.remove();
 };
 document.body.appendChild(script);
}
boot();
})();