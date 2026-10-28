/* GOOD THINGS, V21 / Mobile scroll unlock fix.
   The physics opening is a temporary scroll lock, never a permanent
   page-level touch interceptor. It unmounts at full homepage handoff. */
(()=>{'use strict';
const query=new URLSearchParams(location.search);
if(query.get('intro')!=='pinnedstage21'&&document.documentElement.dataset.gtOpeningSelected!=='physics21')return;
const root=document.documentElement,opening=document.getElementById('gt-scroll-entry');
const shell=document.querySelector('.site-shell');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!root.classList.contains('gt-scroll-entry-ready')||!opening||!shell||!home())return;
const center=opening.querySelector('.gt-scroll-entry-center');
const skip=opening.querySelector('.gt-scroll-entry-skip');
const hint=opening.querySelector('.gt-scroll-entry-hint');
const bar=opening.querySelector('.gt-scroll-entry-progress i');
const pct=opening.querySelector('.gt-scroll-entry-percent');
const headerLogo=shell.querySelector('.site-header .gt-brand-logo');
if(!center||!skip)return;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const viewHeight=()=>Math.max(340,window.innerHeight||root.clientHeight);
const turnDistance=()=>Math.max(480,viewHeight()*.95);
const blendDistance=()=>Math.max(480,viewHeight()*.78);
let frame=null,replayButton=null,phase='turn',turn=0,blend=0;
let ready=false,completed=false,skipped=false,dead=false;
let touchY=null,activeHandoff=false,renderID=0,inputsBound=false;
let lastSeek=-1,lastBlend=-1,run=0;
function send(action,extra={}){
 if(ready&&frame?.contentWindow)
  frame.contentWindow.postMessage({type:'gt-scroll-control',action,...extra},location.origin);
}
function hintText(message){
 if(!hint)return;
 const svg=hint.querySelector('svg')?.outerHTML||'';
 hint.innerHTML=svg+' '+message;
}
function setProgress(value){
 const v=clamp(value);
 if(bar)bar.style.transform='scaleX('+v+')';
 if(pct)pct.textContent=Math.round(v*100)+'%';
}
function logoTarget(){
 if(!headerLogo||!frame)return null;
 const target=headerLogo.getBoundingClientRect();
 const bounds=frame.getBoundingClientRect();
 return {x:target.left-bounds.left,y:target.top-bounds.top,w:target.width};
}
function render(){
 renderID=0;
 if(dead||phase==='home')return;
 opening.style.setProperty('--gt-v20-intro-opacity',
  String(1-smooth((blend-.12)/.88)));
 shell.style.setProperty('--gt-v20-home-opacity',String(smooth(blend)));
 opening.style.pointerEvents=blend>.92?'none':'auto';
 if(ready&&Math.abs(lastSeek-turn)>.0001){
  lastSeek=turn;send('seek',{progress:turn});
 }
 if(ready&&(Math.abs(lastBlend-blend)>.0001||lastBlend<0)){
  lastBlend=blend;
  send('handoff',{progress:blend,target:logoTarget()});
 }
 if(phase==='turn'){
  setProgress(turn*.20);
  hintText('SCROLL TO TURN / 滑動控制逗號旋轉');
 }else if(phase==='rolling'){
  hintText('LET THE LETTERS ROLL / 字母正沿斜坡滾動');
 }else{
  setProgress(1);
  hintText('SCROLL TO EXPLORE / 繼續滑動進入首頁');
 }
}
function scheduleRender(){
 if(!renderID)renderID=requestAnimationFrame(render);
}
function bindInput(){
 if(inputsBound)return;
 inputsBound=true;
 window.addEventListener('wheel',onWheel,{passive:false});
 window.addEventListener('touchstart',onTouchStart,{passive:true});
 window.addEventListener('touchmove',onTouchMove,{passive:false});
 window.addEventListener('touchend',onTouchEnd,{passive:true});
 window.addEventListener('touchcancel',onTouchEnd,{passive:true});
 window.addEventListener('keydown',onKey);
}
function unbindBlockingInput(keepTouch=false){
 if(!inputsBound)return;
 window.removeEventListener('wheel',onWheel);
 window.removeEventListener('keydown',onKey);
 window.removeEventListener('touchstart',onTouchStart);
 if(!keepTouch){
  window.removeEventListener('touchmove',onTouchMove);
  window.removeEventListener('touchend',onTouchEnd);
  window.removeEventListener('touchcancel',onTouchEnd);
  inputsBound=false;
 }
}
function finishHomepage(extraScroll=0){
 if(dead||phase==='home')return;
 phase='home';turn=1;blend=1;
 window.GTOpening?.markSeen('physics21');
 window.GTOpening?.cleanUrl();
 // Order matters on iOS: release document CSS locks and take the fixed
 // touch-action:none scene out of hit-testing *before* the next gesture.
 root.classList.remove('gt-scroll-entry-ready','gt-scroll-entry-pinnedstage21');
 opening.style.pointerEvents='none';
 opening.style.removeProperty('--gt-v20-intro-opacity');
 shell.style.removeProperty('--gt-v20-home-opacity');
 shell.style.removeProperty('pointer-events');
 // The permanently fixed iframe must not survive invisible above home.
 if(frame){frame.remove();frame=null;}
 ready=false;
 if(renderID){cancelAnimationFrame(renderID);renderID=0;}
 // Remove preventDefault handlers now, not at the end of a timer.
 // If a mobile finger is still touching, hand its remaining movement to
 // native scroll through scrollBy until touchend, then fully detach.
 activeHandoff=touchY!==null;
 unbindBlockingInput(activeHandoff);
 // Any wheel movement beyond the handoff remains useful instead of lost.
 const overflow=Math.max(0,extraScroll);
 if(overflow>0)requestAnimationFrame(()=>{
  if(!dead&&phase==='home')window.scrollBy({top:overflow,behavior:'instant'});
 });
}
function advance(delta){
 if(dead||!home()||!Number.isFinite(delta)||Math.abs(delta)<.1||phase==='home')return;
 if(phase==='turn'){
  turn=clamp(turn+delta/turnDistance());
  if(turn>=1&&delta>0)phase='rolling';
 }else if(phase==='rolling'){
  if(delta<0){
   turn=clamp(1+delta/turnDistance());
   completed=false;phase='turn';
  }
 }else if(phase==='logo'){
  const next=blend+delta/blendDistance();
  if(next>=1&&delta>0){
   finishHomepage((next-1)*blendDistance());
   return;
  }
  if(next<0&&delta<0){
   blend=0;completed=false;phase='turn';
   turn=clamp(1+next*blendDistance()/turnDistance());
  }else blend=clamp(next);
 }
 scheduleRender();
}
function onWheel(e){
 if(dead||!home()||phase==='home'||Math.abs(e.deltaY)<.1)return;
 if(e.cancelable)e.preventDefault();
 const multiplier=e.deltaMode===1?16:e.deltaMode===2?viewHeight():1;
 advance(e.deltaY*multiplier);
}
function onTouchStart(e){
 if(dead||!home()||e.touches.length!==1)return;
 touchY=e.touches[0].clientY;
}
function onTouchMove(e){
 if(touchY===null||!home()||e.touches.length!==1)return;
 const y=e.touches[0].clientY,delta=touchY-y;
 touchY=y;
 if(phase==='home'&&activeHandoff){
  // iOS retains the cancelled touch sequence. Translate its final delta
  // to real document scroll so the user does not experience a dead swipe.
  if(e.cancelable)e.preventDefault();
  if(delta>0)window.scrollBy({top:delta,behavior:'instant'});
  return;
 }
 if(phase==='home')return;
 if(e.cancelable)e.preventDefault();
 advance(delta);
}
function onTouchEnd(){
 touchY=null;
 if(activeHandoff){
  activeHandoff=false;
  unbindBlockingInput(false);
 }
}
function onKey(e){
 if(dead||!home()||phase==='home')return;
 if(e.key==='Escape'){e.preventDefault();skip.click();return;}
 if(!['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(e.key))return;
 if(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target?.tagName||''))return;
 if(e.cancelable)e.preventDefault();
 const magnitude=e.key.startsWith('Page')||e.key===' '?viewHeight()*.45:viewHeight()*.09;
 advance((e.key==='ArrowUp'||e.key==='PageUp'?-1:1)*magnitude);
}
function onMessage(event){
 if(dead||!frame||event.origin!==location.origin||event.source!==frame.contentWindow)return;
 const msg=event.data;
 if(!msg||typeof msg.type!=='string')return;
 switch(msg.type){
  case 'gt-physics-ready':
   ready=true;lastSeek=-1;lastBlend=-1;scheduleRender();break;
  case 'gt-physics-progress':
   if(phase==='rolling'&&Number.isFinite(msg.progress))setProgress(Math.max(.2,clamp(msg.progress)));
   break;
  case 'gt-physics-complete':
   completed=true;
   if(phase==='rolling')phase='logo';
   scheduleRender();break;
  case 'gt-physics-fail':
   completed=true;skipped=true;phase='logo';scheduleRender();break;
  case 'gt-physics-gesture':
   if(msg.kind==='delta')advance(Number(msg.deltaY));
   else if(msg.kind==='tap'){
    if(phase==='turn')advance(turnDistance()*.18);
    else if(phase==='logo')advance(blendDistance()*.22);
   }
   break;
 }
}
function makeFrame(){
 run++;
 frame=document.createElement('iframe');
 frame.className='gt-physics-stage-frame';
 frame.title='GOOD THINGS, 固定畫面的滑動物理開場';
 frame.setAttribute('scrolling','no');
 frame.setAttribute('aria-label','以滑動控制逗號旋轉，結束後自然進入首頁');
 center.replaceChildren(frame);
 frame.addEventListener('error',()=>{
  if(phase!=='home'){skipped=true;phase='logo';scheduleRender();}
 });
 frame.src='./opening-lab-physics-v21.html?embed=1&scroll=1&scrub=1&build=pinned21-'+run;
}
function replayIntro(){
 if(dead||!home()||phase!=='home')return;
 // The intro opens ONLY by clicking the visible replay button.
 window.scrollTo({top:0,behavior:'instant'});
 touchY=null;activeHandoff=false;
 unbindBlockingInput(false);
 phase='turn';turn=0;blend=0;ready=false;completed=false;skipped=false;
 lastSeek=-1;lastBlend=-1;
 root.classList.add('gt-scroll-entry-ready','gt-scroll-entry-pinnedstage21');
 opening.style.pointerEvents='auto';
 shell.style.pointerEvents='none';
 makeFrame();bindInput();setProgress(0);scheduleRender();
}
function installReplay(){
 const slot=shell.querySelector('.utility-bar span:last-child');
 if(!slot)return;
 replayButton=document.createElement('button');
 replayButton.type='button';
 replayButton.className='gt-intro-replay-v21';
 replayButton.textContent='REPLAY INTRO';
 replayButton.setAttribute('aria-label','重新觀看 GOOD THINGS, 開場動畫');
 replayButton.addEventListener('click',replayIntro);
 slot.appendChild(replayButton);
}
function leaveRoute(){
 if(home())return;
 cleanup();
 root.classList.remove('gt-scroll-entry-ready','gt-scroll-entry-pinnedstage21');
 opening.remove();
 shell.style.removeProperty('--gt-v20-home-opacity');
 shell.style.removeProperty('pointer-events');
}
function cleanup(){
 if(dead)return;dead=true;
 if(renderID)cancelAnimationFrame(renderID);
 activeHandoff=false;touchY=null;
 unbindBlockingInput(false);
 window.removeEventListener('message',onMessage);
 window.removeEventListener('hashchange',leaveRoute);
 replayButton?.remove();
 if(frame){frame.remove();frame=null;}
}
skip.addEventListener('click',()=>{
 skipped=true;completed=true;blend=1;turn=1;finishHomepage();
});
window.addEventListener('message',onMessage);
window.addEventListener('hashchange',leaveRoute);
window.scrollTo(0,0);
installReplay();makeFrame();bindInput();scheduleRender();
})();
