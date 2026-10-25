/* GOOD THINGS, V19 / Explicit replay after entering homepage.
   Wheel, swipe and keyboard modify virtual rotation and blend values.
   The document NEVER moves until the logo has become the homepage. */
(()=>{'use strict';
const search=new URLSearchParams(location.search);
if(search.get('intro')!=='pinnedstage19')return;
const root=document.documentElement;
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
const opening=document.getElementById('gt-scroll-entry');
const shell=document.querySelector('.site-shell');
if(!opening||!shell||!home()||!root.classList.contains('gt-scroll-entry-ready'))return;
const center=opening.querySelector('.gt-scroll-entry-center');
const skip=opening.querySelector('.gt-scroll-entry-skip');
const hint=opening.querySelector('.gt-scroll-entry-hint');
const bar=opening.querySelector('.gt-scroll-entry-progress i');
const pct=opening.querySelector('.gt-scroll-entry-percent');
const headerLogo=document.querySelector('.site-header .gt-brand-logo');
if(!center||!skip)return;
const iframe=document.createElement('iframe');
iframe.className='gt-physics-stage-frame';
iframe.title='GOOD THINGS, 固定畫面、滑動旋轉的物理開場';
iframe.setAttribute('scrolling','no');
iframe.setAttribute('aria-label','以滑動距離控制逗號旋轉，全部字母滾動完成後繼續滑動銜接首頁');
center.replaceChildren(iframe);
opening.classList.add('gt-physics-entry');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const viewHeight=()=>Math.max(340,window.innerHeight||document.documentElement.clientHeight);
const rotationDistance=()=>Math.max(480,viewHeight()*.95);
const blendDistance=()=>Math.max(480,viewHeight()*.78);
let phase='turn',turn=0,blend=0,ready=false,completed=false,skipped=false;
let lastSeek=-1,lastHandoff=-1,dead=false,touchY=null,renderID=0;
let replayButton=null;
const send=(action,details={})=>{
 if(ready&&iframe.contentWindow)
  iframe.contentWindow.postMessage({type:'gt-scroll-control',action,...details},location.origin);
};
function setHint(message){
 if(!hint)return;
 const arrow=hint.querySelector('svg')?.outerHTML||'';
 hint.innerHTML=arrow+' '+message;
}
function setProgress(x){
 x=clamp(x);
 if(bar)bar.style.transform='scaleX('+x+')';
 if(pct)pct.textContent=Math.round(x*100)+'%';
}
function getTarget(){
 if(!headerLogo)return null;
 const to=headerLogo.getBoundingClientRect();
 const from=iframe.getBoundingClientRect();
 return {x:to.left-from.left,y:to.top-from.top,w:to.width};
}
function redraw(){
 renderID=0;
 if(dead)return;
 // The scene remains FIXED while the progress runs from 0 to 100%.
 const opacity=1-smooth((blend-.12)/.88);
 const homepage=smooth(blend);
 opening.style.setProperty('--gt-pinned-opacity',String(opacity));
 shell.style.setProperty('--gt-pinned-home-opacity',String(homepage));
 opening.style.pointerEvents=blend>.92?'none':'auto';
 shell.style.pointerEvents=phase==='home'?'auto':'none';
 if(ready&&Math.abs(turn-lastSeek)>.0001){
  lastSeek=turn;send('seek',{progress:turn});
 }
 if(ready&&(Math.abs(blend-lastHandoff)>.0001||lastHandoff<0)){
  lastHandoff=blend;
  send('handoff',{progress:blend,target:getTarget()});
 }
 if(phase==='turn'){
  setProgress(turn*.20);
  setHint('SCROLL TO TURN / 滑動控制逗號旋轉');
 }else if(phase==='rolling'){
  setHint('LET THE LETTERS ROLL / 字母正沿斜坡滾動');
 }else if(phase==='logo'){
  setProgress(1);
  setHint('SCROLL TO EXPLORE / 繼續滑動進入首頁');
 }
}
const requestRedraw=()=>{if(!renderID)renderID=requestAnimationFrame(redraw);};
function setHome(active){
 root.classList.toggle('gt-stage-home',active);
 if(!active){
  // Lock scroll again, with the real homepage still at the top.
  if(window.scrollY!==0)window.scrollTo(0,0);
  phase='logo';
 }else{
  phase='home';
  turn=1;blend=1;
  opening.style.pointerEvents='none';
  shell.style.pointerEvents='auto';
 }
 requestRedraw();
}
function advance(delta){
 if(dead||!home()||!Number.isFinite(delta)||Math.abs(delta)<.1)return;
 if(phase==='home'){
  // Preserve fully native homepage scrolling, including top-edge bounce.
  // An explicit REPLAY INTRO click is the only way to reopen the scene.
  return;
 }
 if(phase==='turn'){
  turn=clamp(turn+delta/rotationDistance());
  if(turn>=1&&delta>0)phase='rolling';
 }else if(phase==='rolling'){
  if(delta<0){
   turn=clamp(1+delta/rotationDistance());
   completed=false;
   phase='turn';
  }
  // No down-scrolling into homepage until the physical logo is complete.
 }else if(phase==='logo'){
  const next=blend+delta/blendDistance();
  if(next>=1&&delta>0){
   blend=1;setHome(true);
  }else if(next<0&&delta<0){
   blend=0;
   completed=false;
   phase='turn';
   turn=clamp(1+next*blendDistance()/rotationDistance());
  }else blend=clamp(next);
 }
 requestRedraw();
}
function onWheel(e){
 if(dead||!home()||Math.abs(e.deltaY)<.1)return;
 if(phase==='home')return; // wheel scrolling always stays native on homepage
 if(e.cancelable)e.preventDefault();
 const factor=e.deltaMode===1?16:e.deltaMode===2?viewHeight():1;
 advance(e.deltaY*factor);
}
function onTouchStart(e){
 if(e.touches.length!==1)return;
 touchY=e.touches[0].clientY;
}
function onTouchMove(e){
 if(touchY===null||!home()||e.touches.length!==1)return;
 const now=e.touches[0].clientY,delta=touchY-now;
 touchY=now;
 if(phase==='home')return; // native touch scrolling
 if(e.cancelable)e.preventDefault();
 advance(delta);
}
function onTouchEnd(){touchY=null;}
function onKey(e){
 if(!home()||dead)return;
 if(e.key==='Escape'&&phase!=='home'){
  e.preventDefault();skip.click();return;
 }
 if(!['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(e.key))return;
 if(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target?.tagName||''))return;
 const delta=(e.key==='ArrowUp'||e.key==='PageUp'?-1:1)*
  (e.key.startsWith('Page')||e.key===' '?viewHeight()*.45:viewHeight()*.09);
 if(phase==='home')return; // native keyboard scrolling
 if(e.cancelable)e.preventDefault();
 advance(delta);
}
function onMessage(e){
 if(dead||e.origin!==location.origin||e.source!==iframe.contentWindow)return;
 const m=e.data;
 if(!m||typeof m.type!=='string')return;
 switch(m.type){
  case 'gt-physics-ready':
   ready=true;lastSeek=-1;lastHandoff=-1;
   requestRedraw();break;
  case 'gt-physics-started':
   break;
  case 'gt-physics-reset':
   if(phase==='turn')setProgress(turn*.20);
   break;
  case 'gt-physics-progress':
   if(phase==='rolling'&&Number.isFinite(m.progress))
    setProgress(Math.max(.20,clamp(m.progress)));
   break;
  case 'gt-physics-complete':
   completed=true;
   if(phase==='rolling'){phase='logo';setProgress(1);}
   requestRedraw();break;
  case 'gt-physics-fail':
   completed=true;skipped=true;phase='logo';
   requestRedraw();break;
  case 'gt-physics-gesture':
   if(m.kind==='delta')advance(Number(m.deltaY));
   else if(m.kind==='tap'){
    if(phase==='turn')advance(rotationDistance()*.18);
    else if(phase==='logo')advance(blendDistance()*.22);
   }
   break;
 }
}
function replayIntro(){
 if(dead||!home())return;
 // A conscious click reopens the cinema; normal scrolling never does.
 window.scrollTo({top:0,behavior:'instant'});
 root.classList.remove('gt-stage-home');
 phase='turn';turn=0;blend=0;
 completed=false;skipped=false;touchY=null;
 lastSeek=-1;lastHandoff=-1;
 opening.style.pointerEvents='auto';
 shell.style.pointerEvents='none';
 send('reset');
 setProgress(0);
 requestRedraw();
}
function installReplay(){
 const utility=shell.querySelector('.utility-bar');
 const slot=utility?.querySelector('span:last-child');
 if(!slot)return;
 replayButton=document.createElement('button');
 replayButton.type='button';
 replayButton.className='gt-intro-replay-v19';
 replayButton.textContent='REPLAY INTRO';
 replayButton.setAttribute('aria-label','重新觀看 GOOD THINGS, 開場動畫');
 replayButton.addEventListener('click',replayIntro);
 slot.appendChild(replayButton);
}
function onRoute(){
 if(home())return;
 cleanup();opening.remove();
 root.classList.remove('gt-scroll-entry-ready','gt-scroll-entry-pinnedstage','gt-stage-home');
 shell.style.removeProperty('--gt-pinned-home-opacity');
 shell.style.removeProperty('pointer-events');
}
function cleanup(){
 if(dead)return;dead=true;
 if(renderID)cancelAnimationFrame(renderID);
 replayButton?.remove();
 window.removeEventListener('wheel',onWheel);
 window.removeEventListener('touchstart',onTouchStart);
 window.removeEventListener('touchmove',onTouchMove);
 window.removeEventListener('touchend',onTouchEnd);
 window.removeEventListener('keydown',onKey);
 window.removeEventListener('message',onMessage);
 window.removeEventListener('hashchange',onRoute);
}
skip.addEventListener('click',()=>{
 skipped=true;completed=true;blend=1;turn=1;setHome(true);
});
iframe.addEventListener('error',()=>{skipped=true;completed=true;phase='logo';requestRedraw();});
window.addEventListener('wheel',onWheel,{passive:false});
window.addEventListener('touchstart',onTouchStart,{passive:true});
window.addEventListener('touchmove',onTouchMove,{passive:false});
window.addEventListener('touchend',onTouchEnd,{passive:true});
window.addEventListener('keydown',onKey);
window.addEventListener('message',onMessage);
window.addEventListener('hashchange',onRoute);
window.scrollTo(0,0);
installReplay();
iframe.src='./opening-lab-physics-v17.html?embed=1&scroll=1&scrub=1&build=pinned19';
requestRedraw();
})();
