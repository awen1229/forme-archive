/* GOOD THINGS, / Public homepage opening selector.
   Deliberate isolated main-branch release candidate. No admin access, no drafts,
   no mutation, no arbitrary JS/URL supplied by settings.
   When published settings cannot be reached, preserve existing V30 behavior. */
(()=>{
'use strict';
const HOST='awen1229.github.io',SUBDIR=/^\/forme-archive(?:\/|$)/;
const QA_HOST='release-opening-selector-saf.forme-archive.pages.dev';
const qa=new URLSearchParams(location.search).get('openingQA')==='1'&&[QA_HOST,'127.0.0.1','localhost'].includes(location.hostname);
const official=location.hostname===HOST&&SUBDIR.test(location.pathname);
if((!official&&!qa)||location.protocol!=='https:')return;
const TYPE='gt-draw-intro-v30',KEY='gt-draw-comma-intro-v30-seen',ORIGIN=location.origin;
const NO_ANIMATION={mode:'none',repeat:'once'};
const modes={
 draw:{file:'gt-draw-intro-v31.html',duration:0},
 physics21:{file:'opening-lab-physics-v21.html',duration:25000},
 physics10:{file:'opening-lab-physics-v10.html',duration:25000},
 ink:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'ink',duration:5400},
 letters:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'letters',duration:5400},
 paper:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'paper',duration:5400},
 print:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'print',duration:5400},
 offset:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'offset',duration:5400},
 proof:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'proof',duration:5400},
 anchor:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'anchor',duration:5400},
 registration:{file:'opening-lab-alternatives-v24.html',param:'mode',value:'registration',duration:5400},
 'v25-material':{file:'opening-lab-design-v25.html',param:'kind',value:'material',duration:4900},
 'v25-space':{file:'opening-lab-design-v25.html',param:'kind',value:'space',duration:4900},
 'v25-index':{file:'opening-lab-design-v25.html',param:'kind',value:'index',duration:4900},
 'v26-material':{file:'opening-lab-design-v26.html',param:'kind',value:'material',duration:4100},
 'v26-space':{file:'opening-lab-design-v26.html',param:'kind',value:'space',duration:4100},
 'v26-index':{file:'opening-lab-design-v26.html',param:'kind',value:'index',duration:4100},
 magnetic:{file:'opening-lab-design-v27.html',param:'kind',value:'magnetic',duration:4300},
 diecut:{file:'opening-lab-design-v27.html',param:'kind',value:'diecut',duration:4300},
 exposure:{file:'opening-lab-design-v27.html',param:'kind',value:'exposure',duration:4300},
 ripple:{file:'opening-lab-design-v27.html',param:'kind',value:'ripple',duration:4300},
 editorial28:{file:'opening-lab-editorial-v28.html',duration:3400},
 editorial29:{file:'opening-lab-editorial-v29.html',duration:2850},
 none:{file:null,duration:0}
};
const q=new URLSearchParams(location.search);
const force=['draw','replay'].includes(q.get('intro'));
const suppress=['off','skip','none'].includes(q.get('intro'));
const home=()=>['','#','#/','#/home'].includes(location.hash);
const motionReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let overlay=null,frame=null,active=null,leaving=false,ready=false;
let timeout=0,finishTimer=0,loaderTimer=0,raf=0,alreadyOpened=false;
let listenersAttached=false;
const seenMode=m=>{try{return sessionStorage.getItem('gt-opening-seen-v1-'+m)==='done'}catch{return false}};
const markSeen=m=>{try{sessionStorage.setItem('gt-opening-seen-v1-'+m,'done')}catch(_){}};
const legacySeen=()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}};
const rememberLegacy=()=>{try{localStorage.setItem(KEY,'1')}catch(_){}};
const cleanQuery=()=>{
 if(!force)return;
 const url=new URL(location.href);
 if(['draw','replay'].includes(url.searchParams.get('intro'))){
  url.searchParams.delete('intro');
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
 }
};
function removeListeners(){
 if(!listenersAttached)return;listenersAttached=false;
 window.removeEventListener('keydown',onKey);
 window.removeEventListener('hashchange',onRoute);
 window.removeEventListener('message',onMessage);
}
function complete(){
 if(!overlay||leaving)return;
 leaving=true;
 if(active)markSeen(active.mode);
 if(active?.mode==='draw')rememberLegacy();
 cleanQuery();
 clearTimeout(timeout);clearTimeout(finishTimer);clearInterval(loaderTimer);
 if(raf)cancelAnimationFrame(raf);
 overlay.classList.add('is-leaving');
 document.documentElement.classList.remove('gt-draw-entry-active');
 removeListeners();
 setTimeout(()=>{overlay?.remove();overlay=null;frame=null;active=null;leaving=false},340);
}
function onKey(e){if(e.key==='Escape'&&overlay){e.preventDefault();complete()}}
function onRoute(){if(!home()&&overlay)complete()}
function onMessage(e){
 if(!overlay||leaving||e.origin!==ORIGIN||e.source!==frame?.contentWindow)return;
 if(active?.mode==='draw'){
  if(e.data?.type!==TYPE)return;
  if(e.data.action==='ready'){ready=true;clearTimeout(timeout)}
  else if(['done','skip','enter','error'].includes(e.data.action))complete();
  return;
 }
 if(!['physics10','physics21'].includes(active?.mode))return;
 if(e.data?.type==='gt-physics-ready'){ready=true;clearTimeout(timeout)}
 else if(e.data?.type==='gt-physics-complete'){
  clearTimeout(finishTimer);finishTimer=setTimeout(complete,900);
 }else if(e.data?.type==='gt-physics-fail')complete();
}
function attach(){
 if(listenersAttached)return;listenersAttached=true;
 window.addEventListener('keydown',onKey);
 window.addEventListener('hashchange',onRoute);
 window.addEventListener('message',onMessage);
}
function addReplay(){
 if(document.querySelector('.gt-draw-entry-replay'))return;
 const footer=document.querySelector('footer');
 if(!footer)return;
 const a=document.createElement('a');
 a.className='gt-draw-entry-replay';
 a.href=qa?'./?openingQA=1&mode='+encodeURIComponent(q.get('mode')||'draw')+'#/':'./?intro=replay#/';
 a.textContent='REPLAY OPENING';
 a.setAttribute('aria-label','重新觀看 GOOD THINGS, 首頁動畫');
 footer.append(a);
}
function studyUrl(setting){
 const spec=modes[setting.mode];
 const url=new URL('./'+spec.file,location.href);
 if(spec.param)url.searchParams.set(spec.param,spec.value);
 if(['physics10','physics21'].includes(setting.mode))url.searchParams.set('embed','1');
 return url.toString();
}
function watchLab(){
 if(!frame?.contentDocument)return;
 try{
  const doc=frame.contentDocument;
  const sheet=doc.createElement('link');sheet.rel='stylesheet';
  sheet.href='./gt-opening-embed.css?v=20261028-safe1';
  doc.head.append(sheet);
  sheet.addEventListener('load',()=>{try{frame.contentWindow.dispatchEvent(new Event('resize'))}catch(_){}});
  const started=Date.now();
  loaderTimer=setInterval(()=>{
   if(!overlay||leaving)return clearInterval(loaderTimer);
   let inner;
   try{inner=frame.contentDocument}catch(_){return complete()}
   const errorNode=inner?.getElementById('error');
   if(errorNode&&getComputedStyle(errorNode).display!=='none')return complete();
   const loader=inner?.getElementById('loading')||inner?.getElementById('loader');
   if(loader&&!loader.hidden){
    if(Date.now()-started>12000)return complete();
    return;
   }
   if(!ready){
    ready=true;
    // Physical simulations are gesture-led. Never auto-close before the visitor can play.
    if(active.mode==='physics21'||active.mode==='physics10'){
     timeout=setTimeout(complete,45000);clearInterval(loaderTimer);return;
    }
   }
   const input=inner?.getElementById('range')||inner?.getElementById('scrub');
   const n=input?Number(input.value):NaN;
   if(Number.isFinite(n)&&n>=999){clearInterval(loaderTimer);finishTimer=setTimeout(complete,1050)}
   else if(Date.now()-started>Math.max(11000,(modes[active.mode].duration||4000)*2.4)){
    clearInterval(loaderTimer);complete();
   }
  },160);
 }catch(_){complete()}
}
function open(setting){
 if(overlay||alreadyOpened||!home()||!modes[setting.mode]||!modes[setting.mode].file)return;
 alreadyOpened=true;active=setting;ready=false;
 overlay=document.createElement('section');overlay.className='gt-draw-entry-overlay';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','GOOD THINGS, 開場動畫');
 frame=document.createElement('iframe');frame.className='gt-draw-entry-frame';
 frame.title='GOOD THINGS, 首頁動畫';frame.loading='eager';
 const skip=document.createElement('button');skip.className='gt-draw-entry-skip';
 skip.type='button';skip.textContent='SKIP INTRO';skip.addEventListener('click',complete);
 overlay.append(frame,skip);document.documentElement.classList.add('gt-draw-entry-active');
 document.body.append(overlay);attach();
 timeout=setTimeout(complete,17000);
 frame.addEventListener('error',complete,{once:true});
 if(setting.mode!=='draw'){
  frame.addEventListener('load',()=>{clearTimeout(timeout);watchLab()},{once:true});
 }
 frame.src=studyUrl(setting);
}
async function published(){
 const api='https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production';
 const query='*[_id=="gt-opening-settings" && !(_id in path("drafts.**"))][0]{settingsJson}';
 const u=api+'?perspective=published&query='+encodeURIComponent(query);
 const controller=new AbortController(),t=setTimeout(()=>controller.abort(),2500);
 try{
  const res=await fetch(u,{credentials:'omit',cache:'no-store',signal:controller.signal});
  if(!res.ok)throw Error('opening settings unavailable');
  const record=(await res.json()).result;
  if(!record?.settingsJson)return null;
  const data=JSON.parse(record.settingsJson);
  if(!data||!Object.hasOwn(modes,data.mode)||!['once','always'].includes(data.repeat))return null;
  return {mode:data.mode,repeat:data.repeat};
 }catch(_){return null}
 finally{clearTimeout(t)}
}
async function boot(){
 if(!home())return;
 addReplay();
 if(suppress||motionReduced)return;
 const configured=qa?
   {mode:Object.hasOwn(modes,q.get('mode'))?q.get('mode'):'draw',repeat:'always'}:
   await published();
 if(!home())return;
 let selected=configured||{mode:'draw',repeat:'once'}; // preserve legacy V30 only when no published setting exists
 if(force)selected={mode:'draw',repeat:'always'}; // existing direct link remains functional
 if(selected.mode==='none')return;
 // The legacy V30 stored a permanent localStorage flag. Respect it only for
 // the unconfigured fallback. Once the editor publishes a setting, "once"
 // means once per tab/session for that mode, not once forever.
 const alreadySeen=seenMode(selected.mode)||(!configured&&selected.mode==='draw'&&legacySeen());
 if(!force&&selected.repeat==='once'&&alreadySeen)return;
 open(selected);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();