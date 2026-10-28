/* GOOD THINGS, / Draw the Comma V30 - protected branch homepage integration.
   Reuses the standalone original-logo drawing engine in a same-origin iframe.
   This replaces only the default PREVIEW intro, not public main or opt-in V21 labs.
   Handwriting stays in iframe memory; no strokes or Sanity data are saved. */
(()=>{
 'use strict';
 const secureHost='feature-secure-editor-cloud.forme-archive.pages.dev';
 if(location.hostname!==secureHost || location.protocol!=='https:')return;
 const root=document.documentElement, params=new URLSearchParams(location.search);
 const intro=params.get('intro');
 const requested=['draw','draw-replay','replay'].includes(intro);
 const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';
 const eligible=isHome()&&root.classList.contains('gt-scroll-entry-ready')&&root.classList.contains('gt-draw-opening');
 const addReplay=()=>{
  const utility=document.querySelector('.utility-bar');
  if(!utility||utility.querySelector('.gt-draw-replay'))return;
  const b=document.createElement('button');
  b.className='gt-draw-replay';b.type='button';b.textContent='REPLAY OPENING ↗';
  b.setAttribute('aria-label','重新觀看 GOOD THINGS, 手繪逗號開場');
  b.addEventListener('click',()=>{
    const url=new URL(location.href);
    url.searchParams.set('intro','draw-replay');url.hash='#/';
    location.assign(url.toString());
  });
  utility.append(b);
 };
 addReplay();
 if(!eligible)return;
 const overlay=document.getElementById('gt-scroll-entry');
 const center=overlay?.querySelector('.gt-scroll-entry-center');
 const skip=overlay?.querySelector('.gt-scroll-entry-skip');
 const hint=overlay?.querySelector('.gt-scroll-entry-hint');
 const progress=overlay?.querySelector('.gt-scroll-entry-progress i');
 const percent=overlay?.querySelector('.gt-scroll-entry-percent');
 if(!overlay||!center||!skip){
   root.classList.remove('gt-scroll-entry-ready','gt-draw-opening');
   return;
 }
 const frame=document.createElement('iframe');
 frame.className='gt-draw-stage-frame';
 frame.title='GOOD THINGS, 畫一個逗號，讓筆跡變成原始 LOGO';
 frame.setAttribute('aria-label','使用滑鼠或手指畫一筆，動畫將把筆跡變成原始逗號與 GOOD THINGS, LOGO');
 frame.setAttribute('scrolling','no');
 frame.setAttribute('loading','eager');
 frame.style.cssText='display:block;width:100%;height:100%;border:0;background:#f3f1eb;';
 overlay.classList.add('gt-draw-entry');
 center.replaceChildren(frame);
 if(hint)hint.textContent='DRAW A COMMA / 畫一個逗號';
 skip.textContent='SKIP / 直接進入 ↗';
 let completed=false,ready=false,cleanupTimer=0,finishTimer=0,watchdog=0;
 const setProgress=n=>{
  const value=Math.max(0,Math.min(1,Number(n)||0));
  if(progress)progress.style.transform='scaleX('+value+')';
  if(percent)percent.textContent=Math.round(value*100)+'%';
 };
 function end(){
  if(completed)return;completed=true;
  try{sessionStorage.setItem('gt-draw-entry-v30','done')}catch(_){}
  overlay.classList.add('is-completing');
  const cleanup=()=>{
   root.classList.remove('gt-scroll-entry-ready','gt-draw-opening');
   overlay.remove();
   window.removeEventListener('message',onMessage);
   window.removeEventListener('keydown',onKey);
   window.removeEventListener('hashchange',onRoute);
   clearTimeout(cleanupTimer);clearTimeout(finishTimer);clearTimeout(watchdog);
   if(requested){
    const url=new URL(location.href);
    if(['draw','draw-replay','replay'].includes(url.searchParams.get('intro'))) {
     url.searchParams.delete('intro');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    }
   }
   window.scrollTo(0,0);
  };
  overlay.addEventListener('transitionend',e=>{
   if(e.target===overlay)cleanup();
  },{once:true});
  cleanupTimer=setTimeout(cleanup,650);
 }
 function onMessage(event){
  if(event.origin!==location.origin || event.source!==frame.contentWindow || !event.data || typeof event.data.type!=='string')return;
  const data=event.data;
  if(data.type==='gt-draw-ready'){ready=true;clearTimeout(watchdog);setProgress(0);frame.title='GOOD THINGS, 手繪逗號互動開場';}
  else if(data.type==='gt-draw-progress')setProgress(data.progress);
  else if(data.type==='gt-draw-complete'){setProgress(1);finishTimer=setTimeout(end,1050);}
  else if(data.type==='gt-draw-enter'||data.type==='gt-draw-skip'||data.type==='gt-draw-fail')end();
 }
 function onKey(e){if(e.key==='Escape'){e.preventDefault();end();}}
 function onRoute(){if(!isHome())end();}
 window.addEventListener('message',onMessage);
 window.addEventListener('keydown',onKey);
 window.addEventListener('hashchange',onRoute);
 skip.addEventListener('click',end,{once:true});
 frame.addEventListener('error',end,{once:true});
 watchdog=setTimeout(()=>{if(!ready)end();},16000);
 frame.src='./opening-draw-comma-embed-v30.html?embed=1&edition=20261028';
})();