/* GOOD THINGS, / scroll-controlled first entry, no autoplay. */
(()=>{
'use strict';
const root=document.documentElement,overlay=document.getElementById('gt-scroll-entry');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!overlay||!root.classList.contains('gt-scroll-entry-ready')||!home())return;
const mark=overlay.querySelector('.gt-scroll-entry-mark');
const comma=overlay.querySelector('.gt-scroll-entry-comma');
const bar=overlay.querySelector('.gt-scroll-entry-progress i');
const percent=overlay.querySelector('.gt-scroll-entry-percent');
const original=document.querySelector('.site-header .gt-brand-logo');
const target=overlay.querySelector('.gt-scroll-entry-logo');
if(original&&target)target.src=original.src;
let progress=0,ended=false,downTouch=null,animation=0,lastWheel=0;
const clamp=x=>Math.max(0,Math.min(1,x));
function paint(){
 animation=0;
 if(ended)return;
 mark.style.transform='translate3d(0,'+(-26*progress)+'px,0) scale('+(1-.055*progress)+')';
 mark.style.opacity=String(1-.22*progress);
 comma.style.transform='translate3d('+(45*progress)+'px,'+(-65*progress)+'px,0) scale('+(.65+1.8*progress)+')';
 comma.style.opacity=String(1-.55*progress);
 bar.style.transform='scaleX('+progress+')';
 percent.textContent=Math.round(progress*100)+'%';
 overlay.style.transform='translate3d(0,'+(-82*progress)+'%,0)';
}
function request(){if(!animation)animation=requestAnimationFrame(paint)}
function complete(){
 if(ended)return;ended=true;
 root.classList.remove('gt-scroll-entry-ready');
 overlay.classList.add('is-completing');
 overlay.style.transform='';
 try{sessionStorage.setItem('gt-scroll-entry-v1','done')}catch{}
 const cleanup=()=>{overlay.remove();window.scrollTo({top:0,behavior:'instant'})};
 overlay.addEventListener('transitionend',cleanup,{once:true});
 setTimeout(cleanup,500);
}
function advance(amount){
 if(ended)return;
 progress=clamp(progress+amount);
 if(progress>=.995){complete();return}
 request();
}
function wheel(e){
 if(ended)return;
 e.preventDefault();
 const now=performance.now();
 if(now-lastWheel<7)return;
 lastWheel=now;
 const multiplier=e.deltaMode===1?19:e.deltaMode===2?window.innerHeight:1;
 advance(Math.max(-150,Math.min(150,e.deltaY*multiplier))/720);
}
function touchStart(e){downTouch=e.changedTouches[0]?.clientY??null}
function touchMove(e){
 if(ended||downTouch===null)return;
 e.preventDefault();
 const y=e.changedTouches[0]?.clientY??downTouch;
 const dy=downTouch-y;downTouch=y;
 advance(dy/Math.max(400,window.innerHeight*.9));
}
function key(e){
 if(ended)return;
 if(['ArrowDown','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();advance(e.key==='ArrowDown'?.22:.48)}
 else if(['ArrowUp','PageUp'].includes(e.key)){e.preventDefault();advance(-.25)}
 else if(e.key==='Escape'){e.preventDefault();complete()}
}
overlay.addEventListener('wheel',wheel,{passive:false});
overlay.addEventListener('touchstart',touchStart,{passive:true});
overlay.addEventListener('touchmove',touchMove,{passive:false});
overlay.addEventListener('touchend',()=>downTouch=null,{passive:true});
window.addEventListener('keydown',key);
overlay.querySelector('.gt-scroll-entry-skip')?.addEventListener('click',complete);
window.addEventListener('hashchange',()=>{if(!home())complete()});
const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
mq.addEventListener?.('change',e=>{if(e.matches)complete()});
request();
})();