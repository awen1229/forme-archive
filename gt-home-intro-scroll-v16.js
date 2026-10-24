/* GOOD THINGS, / Scroll opening V16. Preview only via ?intro=scrolllab.
   Keep the original Matter.js bowl and glyphs inside the same-origin iframe.
   Native scroll connects the opening and real homepage. */
(()=>{'use strict';
const params=new URLSearchParams(location.search);
if(params.get('intro')!=='scrolllab')return;
const root=document.documentElement;
const opening=document.getElementById('gt-scroll-entry');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!opening||!home()||!root.classList.contains('gt-scroll-entry-ready'))return;
const center=opening.querySelector('.gt-scroll-entry-center');
const skip=opening.querySelector('.gt-scroll-entry-skip');
const hint=opening.querySelector('.gt-scroll-entry-hint');
const bar=opening.querySelector('.gt-scroll-entry-progress i');
const pct=opening.querySelector('.gt-scroll-entry-percent');
if(!center||!skip)return;
const frame=document.createElement('iframe');
frame.className='gt-physics-stage-frame';
frame.title='GOOD THINGS, 原始 LOGO 物理開場：滑動或點擊';
frame.setAttribute('aria-label','可向上滑動啟動字母滾動；完成後繼續向下進入首頁，向上返回可再看動畫');
frame.setAttribute('scrolling','no');
frame.style.cssText='display:block;width:100%;height:100%;border:0;background:#f3f1eb;';
center.replaceChildren(frame);
opening.classList.add('gt-physics-entry');
let ready=false,completed=false,skipped=false,pendingStart=false;
let previouslyAway=false,rewinding=false,scrollMoving=false,lastNavAt=0;
let touchStart=null,resetTimer=0,releaseTimer=0,removed=false;
const introHeight=()=>Math.max(400,opening.getBoundingClientRect().height);
const atOpening=()=>window.scrollY<Math.max(120,introHeight()*.35);
const send=action=>{
 if(ready&&frame.contentWindow)
  frame.contentWindow.postMessage({type:'gt-scroll-control',action},location.origin);
};
const progress=value=>{
 const p=Math.max(0,Math.min(1,Number(value)||0));
 if(bar)bar.style.transform='scaleX('+p+')';
 if(pct)pct.textContent=Math.round(p*100)+'%';
};
const updateHint=text=>{if(hint){
 const svg=hint.querySelector('svg')?.outerHTML||'';
 hint.innerHTML=svg+' '+text;
}};
updateHint('SCROLL OR TAP / 上滑或輕觸開始');
const sendStart=()=>{
 if(completed||skipped||rewinding)return;
 if(!ready){pendingStart=true;return;}
 send('start');
};
function scrollHome(){
 if(!home())return;
 const now=performance.now();
 if(scrollMoving&&now-lastNavAt<750)return;
 lastNavAt=now;scrollMoving=true;
 window.scrollTo({top:opening.offsetTop+opening.offsetHeight,behavior:'smooth'});
 clearTimeout(releaseTimer);
 releaseTimer=setTimeout(()=>{scrollMoving=false;},850);
}
function rewind(){
 if(rewinding||removed)return;
 rewinding=true;completed=false;skipped=false;pendingStart=false;
 const reduce=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
 frame.style.opacity=reduce?'1':'0';
 updateHint('SCROLL OR TAP / 上滑或輕觸開始');
 clearTimeout(resetTimer);
 resetTimer=setTimeout(()=>{
  if(removed)return;
  send('reset');
  progress(0);
  frame.style.opacity='1';
  resetTimer=setTimeout(()=>{rewinding=false;},reduce?0:350);
 },reduce?0:200);
}
function receiveGesture(direction){
 if(!home()||removed||!atOpening())return;
 if(direction==='down'){
  if(completed||skipped)scrollHome();
  else sendStart();
 }else if(direction==='up'&&completed&&window.scrollY<32){
  rewind();
 }
}
function onMessage(event){
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 const m=event.data;if(!m||typeof m.type!=='string')return;
 switch(m.type){
  case 'gt-physics-ready':
   ready=true;
   if(pendingStart&&!completed&&!skipped){pendingStart=false;send('start');}
   break;
  case 'gt-physics-started':
   updateHint('LET THE LETTERS ROLL / 字母正在滾動');
   break;
  case 'gt-physics-reset':
   if(!skipped)progress(0);
   break;
  case 'gt-physics-progress':
   if(!skipped)progress(m.progress);
   break;
  case 'gt-physics-complete':
   completed=true;progress(1);
   updateHint('SCROLL TO EXPLORE / 繼續往下滑進入首頁');
   break;
  case 'gt-physics-fail':
   skipped=true;completed=true;
   updateHint('SCROLL TO EXPLORE / 繼續往下滑進入首頁');
   break;
  case 'gt-physics-gesture':
   if(m.direction==='down'||m.direction==='up')receiveGesture(m.direction);
   break;
 }
}
function onWheel(e){
 if(!home()||!atOpening()||Math.abs(e.deltaY)<4)return;
 if(e.deltaY>0){
  if(!completed&&!skipped){if(e.cancelable)e.preventDefault();sendStart();}
  else{
   if(e.cancelable)e.preventDefault();
   scrollHome();
  }
 }else if(e.deltaY<0&&completed&&window.scrollY<20){
  if(e.cancelable)e.preventDefault();rewind();
 }else if(!completed&&!skipped&&e.cancelable){
  e.preventDefault();
 }
}
function onTouchStart(e){
 if(!home()||e.touches.length!==1)return;
 const t=e.touches[0];touchStart={x:t.clientX,y:t.clientY};
}
function onTouchMove(e){
 if(!touchStart||!home()||!atOpening())return;
 if(!completed&&!skipped&&e.cancelable)e.preventDefault();
}
function onTouchEnd(e){
 if(!touchStart||!home())return;
 const t=e.changedTouches[0],dy=t.clientY-touchStart.y;
 const dx=t.clientX-touchStart.x;
 touchStart=null;
 if(Math.abs(dy)>42&&Math.abs(dy)>Math.abs(dx)*1.15&&atOpening()){
  if(dy<0&&!completed&&!skipped)sendStart();
  else if(dy>0&&completed&&window.scrollY<24)rewind();
 }
}
function onScroll(){
 if(!home())return;
 const y=window.scrollY,h=introHeight();
 if(y>h*.70)previouslyAway=true;
 if(previouslyAway&&y<h*.23){
  previouslyAway=false;
  rewind(); // Natural return from the actual homepage restores the comma.
 }
}
function onKey(e){
 if(!home())return;
 if(e.key==='Escape'&&atOpening()){
  e.preventDefault();skipped=true;completed=true;scrollHome();return;
 }
 if(!atOpening())return;
 if(['ArrowDown','PageDown',' '].includes(e.key)){
  const target=e.target?.tagName?.toLowerCase();
  if(target==='input'||target==='textarea'||target==='select')return;
  if(e.cancelable)e.preventDefault();
  receiveGesture('down');
 }else if((e.key==='ArrowUp'||e.key==='PageUp')&&completed&&window.scrollY<24){
  if(e.cancelable)e.preventDefault();
  rewind();
 }
}
function cleanup(){
 if(removed)return;
 removed=true;
 window.removeEventListener('message',onMessage);
 window.removeEventListener('wheel',onWheel);
 window.removeEventListener('touchstart',onTouchStart);
 window.removeEventListener('touchmove',onTouchMove);
 window.removeEventListener('touchend',onTouchEnd);
 window.removeEventListener('scroll',onScroll);
 window.removeEventListener('keydown',onKey);
 window.removeEventListener('hashchange',onRoute);
 clearTimeout(resetTimer);clearTimeout(releaseTimer);
}
function onRoute(){
 if(home())return;
 cleanup();
 root.classList.remove('gt-scroll-entry-ready','gt-scroll-entry-scrolllab');
 opening.remove();
}
frame.addEventListener('error',()=>{skipped=true;completed=true;});
skip.addEventListener('click',()=>{
 skipped=true;completed=true;progress(1);scrollHome();
});
window.addEventListener('message',onMessage);
window.addEventListener('wheel',onWheel,{passive:false});
window.addEventListener('touchstart',onTouchStart,{passive:true});
window.addEventListener('touchmove',onTouchMove,{passive:false});
window.addEventListener('touchend',onTouchEnd,{passive:true});
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('keydown',onKey);
window.addEventListener('hashchange',onRoute);
if(window.scrollY>introHeight()*.7)previouslyAway=true;
frame.src='./opening-lab-physics-v16.html?embed=1&scroll=1&build=opening-v16';
})();
