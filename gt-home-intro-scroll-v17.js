/* GOOD THINGS, V17 / continuous real-scroll-controlled comma.
   All geometry is derived from the live viewport and real homepage header.
   The physical letters still roll independently AFTER rotation reaches 100%. */
(()=>{'use strict';
const query=new URLSearchParams(location.search);
if(query.get('intro')!=='scrollstage')return;
const root=document.documentElement;
const opening=document.getElementById('gt-scroll-entry');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!opening||!home()||!root.classList.contains('gt-scroll-entry-ready'))return;
const shell=document.querySelector('.site-shell');
const center=opening.querySelector('.gt-scroll-entry-center');
const bar=opening.querySelector('.gt-scroll-entry-progress i');
const label=opening.querySelector('.gt-scroll-entry-hint');
const pct=opening.querySelector('.gt-scroll-entry-percent');
const skip=opening.querySelector('.gt-scroll-entry-skip');
const headerLogo=document.querySelector('.site-header .gt-brand-logo');
if(!shell||!center||!skip)return;
const stage=document.createElement('div');
stage.className='gt-scroll-stage-inner';
// Move the original editorial top/center/footer inside a sticky scene.
// Page flow remains real and the homepage is still the next DOM region.
while(opening.firstChild)stage.appendChild(opening.firstChild);
opening.appendChild(stage);
const frame=document.createElement('iframe');
frame.className='gt-physics-stage-frame';
frame.title='GOOD THINGS, 滑動決定逗號的旋轉進度';
frame.setAttribute('scrolling','no');
frame.setAttribute('aria-label','上滑捲動使逗號逐步順時針旋轉，完成後繼續進入首頁，向上返回');
center.replaceChildren(frame);
let ready=false,completed=false,skipped=false,removed=false;
let newest=0,raf=0,scrollingProgrammatically=false,lastReset=false;
let lastSeek=-1,lastMorph=-1,unlocked=false,touchY=null;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const h=()=>Math.max(400,window.innerHeight||stage.getBoundingClientRect().height);
const rotateEnd=()=>opening.offsetTop+h()*.58;
const homeStart=()=>opening.offsetTop+h()*.9;
const send=(action,extra={})=>{
 if(ready&&frame.contentWindow)
  frame.contentWindow.postMessage({type:'gt-scroll-control',action,...extra},location.origin);
};
const progress=p=>{
 const v=clamp(p);
 if(bar)bar.style.transform='scaleX('+v+')';
 if(pct)pct.textContent=Math.round(v*100)+'%';
};
const hint=t=>{
 if(!label)return;
 const arrow=label.querySelector('svg')?.outerHTML||'';
 label.innerHTML=arrow+' '+t;
};
function update(){
 raf=0;
 if(!home()||removed)return;
 const y=window.scrollY,rotation=clamp((y-opening.offsetTop)/Math.max(1,rotateEnd()-opening.offsetTop));
 const p=clamp((y-rotateEnd())/Math.max(1,homeStart()-rotateEnd()));
 const morph=smooth(p);
 // The physical bottle only advances as the reader moves.
 if(ready&&Math.abs(rotation-lastSeek)>.0003){
  lastSeek=rotation;
  send('seek',{progress:rotation});
 }
 if(ready&&(Math.abs(p-lastMorph)>.0003||lastMorph<0)){
  lastMorph=p;
  let target=null;
  if(headerLogo){
   const to=headerLogo.getBoundingClientRect(),from=frame.getBoundingClientRect();
   target={x:to.left-from.left,y:to.top-from.top,w:to.width};
  }
  send('handoff',{progress:p,target});
 }
 stage.style.setProperty('--gt-stage-opacity',String(1-smooth((p-.12)/.88)));
 stage.style.pointerEvents=p>.83?'none':'auto';
 shell.style.setProperty('--gt-home-opacity',String(morph));
 shell.style.pointerEvents=(p>.52||skipped)?'auto':'none';
 if(!completed&&!skipped){
  progress(rotation*.20);
  hint(rotation>=.999?'THE LETTERS ARE ROLLING / 字母正沿斜坡滾動'
   :'SCROLL TO TURN / 滑動控制逗號旋轉');
 }else{
  progress(1);
  hint('SCROLL TO EXPLORE / 繼續往下滑進入首頁');
 }
 // Backward scrolling continuously reveals the earlier bottle orientation.
 // The individual glyphs are reinitialized when crossing the rotation
 // boundary backward, rather than attempting to reverse rigid body history.
 if((completed||skipped)&&y<rotateEnd()-h()*.05){
  completed=false;skipped=false;lastReset=true;
  send('reset');
  lastSeek=-1;
 }
}
function updateSoon(){
 if(!raf)raf=requestAnimationFrame(update);
}
function step(delta){
 if(!home()||removed||!Number.isFinite(delta))return;
 let dest=window.scrollY+delta;
 if(delta>0&&!completed&&!skipped)dest=Math.min(dest,rotateEnd());
 dest=Math.max(0,dest);
 window.scrollTo({top:dest,behavior:'instant'});
 updateSoon();
}
function onWheel(e){
 if(!home()||removed)return;
 const y=window.scrollY;
 // After reaching the actual homepage, its scrolling is fully native.
 if(y>homeStart()+h()*.05)return;
 if(Math.abs(e.deltaY)<.15)return;
 const unit=e.deltaMode===1?16:e.deltaMode===2?h():1;
 if(e.cancelable)e.preventDefault();
 step(e.deltaY*unit);
}
function onMessage(e){
 if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
 const m=e.data;if(!m||typeof m.type!=='string')return;
 switch(m.type){
  case 'gt-physics-ready':
   ready=true;lastSeek=-1;lastMorph=-1;updateSoon();break;
  case 'gt-physics-reset':
   if(!skipped){completed=false;progress(0);}
   break;
  case 'gt-physics-progress':
   if(!skipped&&Number.isFinite(m.progress))
    progress(Math.max(clamp((window.scrollY-opening.offsetTop)/Math.max(1,rotateEnd()-opening.offsetTop))*.2,m.progress));
   break;
  case 'gt-physics-complete':
   completed=true;progress(1);updateSoon();break;
  case 'gt-physics-fail':
   completed=true;skipped=true;updateSoon();break;
  case 'gt-physics-gesture':
   if(m.kind==='delta')step(Number(m.deltaY));
   else if(m.kind==='tap'){
    const difference=rotateEnd()-window.scrollY;
    if(difference>0){
     // Click remains a convenience; only SCROLL scrubs each step.
     window.scrollTo({top:rotateEnd(),behavior:'smooth'});
    }else if(completed)window.scrollTo({top:homeStart(),behavior:'smooth'});
   }
   break;
 }
}
function onTouchStart(e){
 if(e.touches.length!==1)return;touchY=e.touches[0].clientY;
}
function onTouchMove(e){
 if(touchY===null||!home())return;
 const y=e.touches[0].clientY,d=touchY-y;touchY=y;
 if(window.scrollY<=homeStart()+2){
  if(e.cancelable)e.preventDefault();
  step(d);
 }
}
function onTouchEnd(){touchY=null;}
function onScroll(){
 if(!home()||removed)return;
 if(!completed&&!skipped&&window.scrollY>rotateEnd()+2){
  window.scrollTo({top:rotateEnd(),behavior:'instant'});
 }
 updateSoon();
}
function onKey(e){
 if(!home())return;
 if(e.key==='Escape'&&window.scrollY<=rotateEnd()+5){
  e.preventDefault();skip.click();return;
 }
 if(!['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(e.key))return;
 if(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target?.tagName||''))return;
 if(window.scrollY>homeStart()+h()*.05)return;
 e.preventDefault();
 step((e.key==='ArrowUp'||e.key==='PageUp'?-1:1)*
  (e.key.startsWith('Page')||e.key===' '?h()*.52:h()*.08));
}
function routeChange(){
 if(home())return;
 cleanup();opening.remove();
 shell.style.removeProperty('margin-top');
 shell.style.removeProperty('--gt-home-opacity');
 shell.style.removeProperty('pointer-events');
 root.classList.remove('gt-scroll-entry-ready','gt-scroll-entry-scrollstage');
}
function cleanup(){
 if(removed)return;removed=true;
 cancelAnimationFrame(raf);
 window.removeEventListener('message',onMessage);
 window.removeEventListener('wheel',onWheel);
 window.removeEventListener('touchstart',onTouchStart);
 window.removeEventListener('touchmove',onTouchMove);
 window.removeEventListener('touchend',onTouchEnd);
 window.removeEventListener('scroll',onScroll);
 window.removeEventListener('keydown',onKey);
 window.removeEventListener('hashchange',routeChange);
}
skip.addEventListener('click',()=>{
 skipped=true;completed=true;
 window.scrollTo({top:homeStart(),behavior:'smooth'});
 updateSoon();
});
frame.addEventListener('error',()=>{skipped=true;completed=true;updateSoon();});
window.addEventListener('message',onMessage);
window.addEventListener('wheel',onWheel,{passive:false});
window.addEventListener('touchstart',onTouchStart,{passive:true});
window.addEventListener('touchmove',onTouchMove,{passive:false});
window.addEventListener('touchend',onTouchEnd,{passive:true});
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('keydown',onKey);
window.addEventListener('hashchange',routeChange);
frame.src='./opening-lab-physics-v17.html?embed=1&scroll=1&scrub=1&build=stage17';
updateSoon();
})();
