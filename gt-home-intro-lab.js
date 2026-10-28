/* GOOD THINGS, / Generic animated opening host for V24–V29 studies.
   Allowlisted previews only; no arbitrary URL loading. */
(()=>{
 'use strict';
 const reg=window.GTOpening,root=document.documentElement;
 if(!reg||!root.classList.contains('gt-opening-lab')||!root.classList.contains('gt-scroll-entry-ready'))return;
 const selected=root.dataset.gtOpeningSelected;
 const study=reg.get(selected);
 if(!study||study.type!=='lab')return;
 const overlay=document.getElementById('gt-scroll-entry'),center=overlay?.querySelector('.gt-scroll-entry-center');
 const skip=overlay?.querySelector('.gt-scroll-entry-skip'),hint=overlay?.querySelector('.gt-scroll-entry-hint');
 const progress=overlay?.querySelector('.gt-scroll-entry-progress i'),percent=overlay?.querySelector('.gt-scroll-entry-percent');
 if(!overlay||!center||!skip){root.classList.remove('gt-scroll-entry-ready','gt-opening-lab');return}
 overlay.classList.add('gt-opening-lab-entry');
 const frame=document.createElement('iframe');
 frame.title='GOOD THINGS, '+study.cn+' 動畫開場';
 frame.className='gt-opening-lab-iframe';
 frame.setAttribute('loading','eager');
 frame.style.cssText='width:100%;height:100%;border:0;background:#f4f2eb;display:block';
 center.replaceChildren(frame);
 skip.textContent='SKIP / 直接進入 ↗';
 if(hint)hint.textContent=study.name.toUpperCase()+' / '+study.cn;
 let done=false,loadTimer=0,poll=0,finishTimer=0,cleanupTimer=0;
 const setProgress=n=>{
  const p=Math.max(0,Math.min(1,Number(n)||0));
  if(progress)progress.style.transform='scaleX('+p+')';
  if(percent)percent.textContent=Math.round(p*100)+'%';
 };
 function end(){
  if(done)return;done=true;reg.markSeen(selected);overlay.classList.add('is-completing');
  const cleanup=()=>{
   root.classList.remove('gt-scroll-entry-ready','gt-opening-lab');
   root.removeAttribute('data-gt-opening-selected');
   overlay.remove();clearTimeout(loadTimer);clearInterval(poll);clearTimeout(finishTimer);clearTimeout(cleanupTimer);
   window.removeEventListener('keydown',onKey);window.removeEventListener('hashchange',onRoute);
   reg.cleanUrl();window.scrollTo(0,0);
  };
  overlay.addEventListener('transitionend',e=>{if(e.target===overlay)cleanup()},{once:true});
  cleanupTimer=setTimeout(cleanup,660);
 }
 function onKey(e){if(e.key==='Escape'){e.preventDefault();end()}}
 function onRoute(){if(!['','#','#/'].includes(location.hash))end()}
 skip.addEventListener('click',end,{once:true});
 window.addEventListener('keydown',onKey);
 window.addEventListener('hashchange',onRoute);
 frame.addEventListener('error',end,{once:true});
 frame.addEventListener('load',()=>{
  try{
   const doc=frame.contentDocument;
   if(!doc?.head)throw Error('iframe DOM unavailable');
   const link=doc.createElement('link');
   link.rel='stylesheet';link.href='./gt-opening-embed.css?v=20261028-a1';
   link.addEventListener('load',()=>{try{frame.contentWindow.dispatchEvent(new Event('resize'))}catch(_){}});
   doc.head.append(link);
   let sawReady=false,finishedTicks=0;
   poll=setInterval(()=>{
    try{
     const c=frame.contentDocument;
     if(!c||!frame.contentWindow)return;
     const loader=c.getElementById('loading')||c.getElementById('loader');
     // When the archived study could not decode the original LOGO, do not trap the reader.
     if(loader&&!loader.hidden)return;
     sawReady=true;
     const slider=c.getElementById('range')||c.getElementById('scrub');
     if(!slider)return;
     const p=Math.max(0,Math.min(1,Number(slider.value)/1000));
     setProgress(p);
     if(p>=.999){finishedTicks++;if(finishedTicks>=5){clearInterval(poll);finishTimer=setTimeout(end,650)}}
     else finishedTicks=0;
    }catch(_){if(!sawReady)end()}
   },140);
  }catch(_){end()}
 });
 // Missing media, interrupted playback or browser policy never leave scroll locked.
 loadTimer=setTimeout(end,22000);
 const url=new URL('./'+study.study,location.href);
 if(study.param&&study.value)url.searchParams.set(study.param,study.value);
 frame.src=url.toString();
})();
