
/* GOOD THINGS, / V30 / First-entry wiring.
   Content publishing, admin routing, and homepage rendering remain untouched. */
(function(){
  'use strict';
  const KEY='gt-draw-comma-intro-v30-seen';
  const MESSAGE_TYPE='gt-draw-intro-v30';
  const ORIGIN=window.location.origin;
  let overlay=null,entryFrame=null,leaving=false,closeTimer=0,watchdog=0,entryReady=false;
  const params=new URLSearchParams(window.location.search);
  const force=params.get('intro')==='draw';
  const suppress=['off','skip','none'].includes(params.get('intro'));

  function isHomepage(){
    const path=(window.location.hash||'#/').slice(1).split('?')[0];
    return path===''||path==='/'||path==='/home';
  }
  function wasSeen(){
    try{return window.localStorage.getItem(KEY)==='1'}catch{return false}
  }
  function rememberSeen(){
    try{window.localStorage.setItem(KEY,'1')}catch{}
  }
  function clearReplayQuery(){
    const url=new URL(window.location.href);
    if(url.searchParams.get('intro')!=='draw')return;
    url.searchParams.delete('intro');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function addReplayLink(){
    if(document.querySelector('.gt-draw-entry-replay'))return;
    const footer=document.querySelector('footer');
    if(!footer)return;
    const link=document.createElement('a');
    link.className='gt-draw-entry-replay';
    link.href='./?intro=draw#/';
    link.textContent='DRAW THE COMMA';
    link.setAttribute('aria-label','重新體驗畫逗號的首頁動畫');
    footer.appendChild(link);
  }
  function complete(){
    if(!overlay||leaving)return;
    leaving=true;
    rememberSeen();
    clearReplayQuery();
    if(watchdog){window.clearTimeout(watchdog);watchdog=0;}
    overlay.classList.add('is-leaving');
    document.documentElement.classList.remove('gt-draw-entry-active');
    if(closeTimer)window.clearTimeout(closeTimer);
    closeTimer=window.setTimeout(()=>{
      overlay?.remove();
      overlay=null;entryFrame=null;
      leaving=false;closeTimer=0;
    },320);
  }
  function open(){
    if(overlay||!isHomepage())return;
    overlay=document.createElement('section');
    overlay.className='gt-draw-entry-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','畫一個逗號，開啟 GOOD THINGS,');
    const frame=document.createElement('iframe');
    frame.className='gt-draw-entry-frame';
    frame.title='GOOD THINGS, / Draw a comma';
    frame.src='./gt-draw-intro-v30.html?v=20261025c';
    frame.addEventListener('error',complete);
    frame.setAttribute('loading','eager');
    const skip=document.createElement('button');
    skip.className='gt-draw-entry-skip';
    skip.type='button';
    skip.textContent='SKIP INTRO';
    skip.addEventListener('click',complete);
    overlay.append(frame,skip);
    entryFrame=frame;
    entryReady=false;
    // Fail open if an iframe resource hangs; readers should never be trapped.
    if(watchdog)window.clearTimeout(watchdog);
    watchdog=window.setTimeout(()=>{if(overlay&&!entryReady)complete()},16000);
    document.documentElement.classList.add('gt-draw-entry-active');
    document.body.appendChild(overlay);
    window.addEventListener('keydown',onEscape);
    window.addEventListener('hashchange',onRouteChange);
  }
  function onEscape(event){
    if(event.key==='Escape'&&overlay)complete();
  }
  function onRouteChange(){
    if(overlay&&!isHomepage())complete();
  }
  window.addEventListener('message',event=>{
    if(!overlay||leaving||event.origin!==ORIGIN)return;
    if(event.source!==entryFrame?.contentWindow)return;
    if(event.data?.type!==MESSAGE_TYPE)return;
    if(event.data.action==='ready'){
      entryReady=true;
      if(watchdog){window.clearTimeout(watchdog);watchdog=0;}
      return;
    }
    if(['done','skip','enter','error'].includes(event.data.action))complete();
  });
  function initialize(){
    addReplayLink();
    // First initial arrival on the public homepage only. Admin/editor
    // URLs, direct article/brand links, and subsequent SPA routes are safe.
    if(isHomepage()&&!suppress&&(force||!wasSeen()))open();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initialize,{once:true});
  }else{
    initialize();
  }
})();
