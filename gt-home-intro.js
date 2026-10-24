/* GOOD THINGS, / COMMA COLLECTOR
 * The whole sequence is driven by intentional wheel, touch or keyboard input.
 * A stroke-led punctuation mark receives individual letters along gentle arcs.
 */
(()=>{
'use strict';
const root=document.documentElement;
const overlay=document.getElementById('gt-scroll-entry');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!overlay||!root.classList.contains('gt-scroll-entry-ready')||!home())return;
window.gtScrollEntryStarted=true;
const sculpture=overlay.querySelector('.gt-scroll-entry-sculpture');
const shape=overlay.querySelector('.gt-scroll-entry-shape');
const trace=overlay.querySelector('.gt-scroll-entry-trace');
const words=[...overlay.querySelectorAll('.gt-scroll-entry-letter')];
const caption=overlay.querySelector('.gt-scroll-entry-caption');
const bar=overlay.querySelector('.gt-scroll-entry-progress i');
const percent=overlay.querySelector('.gt-scroll-entry-percent');
if(!sculpture||!shape||!trace||words.length!==10||!caption||!bar||!percent){
 root.classList.remove('gt-scroll-entry-ready');overlay.remove();return;
}
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const ease=t=>1-Math.pow(1-clamp(t),2.5);
const cubic=(a,b,c,d,t)=>{
 const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
};
const span=(v,a,b)=>clamp((v-a)/(b-a));
let progress=0,ended=false,downTouch=null,frame=0;
let lastWheel=0,traceLength=0,stageWidth=450,stageHeight=520;
let touchDir=0;
try{
 traceLength=trace.getTotalLength();
 trace.style.strokeDasharray=String(traceLength);
 trace.style.strokeDashoffset=String(traceLength);
}catch{}
function measure(){
 const bounds=sculpture.getBoundingClientRect();
 // The parent sculpture can be scaled by transitions; use its layout box.
 stageWidth=sculpture.offsetWidth||bounds.width||450;
 stageHeight=sculpture.offsetHeight||bounds.height||520;
 if(!ended)request();
}
function draw(){
 frame=0;if(ended)return;
 const p=progress;
 // The whole outline is always visible. A second path progressively
 // traces its contour, while the interior receives a quiet green tint.
 const traceProgress=smooth(span(p,.015,.33));
 trace.style.strokeDashoffset=String(traceLength*(1-traceProgress));
 shape.style.fill='rgba(109,151,115,'+(.018+.12*smooth(span(p,.68,.86)))+')';
 const vw=stageWidth,vh=stageHeight;
 words.forEach((letter,i)=>{
  const start=.13+i*.036;
  const t=span(p,start,start+.31);
  const move=ease(t);
  const dir=i%2===0?-1:1;
  const distance=vw*(.50+(i%3)*.085);
  const startX=dir*distance;
  const startY=-vh*(.64+(i%4)*.09);
  // Sweep inward through a gentle arc before the glyph settles into place.
  const x=cubic(startX,startX*.92,-dir*vw*.20,0,move);
  const y=cubic(startY,-vh*.27,vh*.085,0,move);
  const rotate=(dir*(15+(i%3)*7))*(1-move);
  const scale=.82+.18*move;
  letter.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) rotate('+rotate.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
  letter.style.opacity=String(smooth(span(t,0,.20)));
 });
 caption.style.opacity=String(smooth(span(p,.74,.89)));
 caption.style.transform='translate3d(-50%,'+(12*(1-smooth(span(p,.74,.88))))+'px,0)';
 const exit=smooth(span(p,.87,1));
 sculpture.style.transform='translate3d(0,'+(-20*exit)+'px,0) scale('+(1-.045*exit)+')';
 sculpture.style.opacity=String(1-.18*exit);
 overlay.style.transform='translate3d(0,'+(-16*exit)+'%,0)';
 bar.style.transform='scaleX('+p+')';
 percent.textContent=String(Math.round(p*100)).padStart(2,'0')+'%';
}
function request(){if(!frame)frame=requestAnimationFrame(draw)}
function cleanup(){
 if(overlay.dataset.gtIntroCleaned)return;
 overlay.dataset.gtIntroCleaned='1';
 root.classList.remove('gt-scroll-entry-ready');
 overlay.remove();
 window.removeEventListener('wheel',wheel,true);
 window.removeEventListener('touchstart',touchStart,true);
 window.removeEventListener('touchmove',touchMove,true);
 window.removeEventListener('touchend',touchEnd,true);
 window.removeEventListener('keydown',key);
 window.removeEventListener('resize',measure);
 try{window.scrollTo(0,0)}catch{}
}
function complete(){
 if(ended)return;ended=true;
 cancelAnimationFrame(frame);frame=0;
 try{sessionStorage.setItem('gt-scroll-entry-v2','done')}catch{}
 overlay.classList.add('is-completing');
 overlay.style.removeProperty('transform');
 overlay.addEventListener('transitionend',e=>{if(e.target===overlay)cleanup()},{once:true});
 window.setTimeout(cleanup,600);
}
function advance(amount){
 if(ended||!Number.isFinite(amount))return;
 progress=clamp(progress+amount);
 if(progress>=.999){complete();return}
 request();
}
function wheel(e){
 if(ended)return;
 e.preventDefault();
 const now=performance.now();
 if(now-lastWheel<5)return;
 lastWheel=now;
 const unit=e.deltaMode===1?19:e.deltaMode===2?window.innerHeight:1;
 advance(clamp(e.deltaY*unit,-180,180)/1110);
}
function touchStart(e){
 if(ended)return;
 downTouch=e.changedTouches[0]?.clientY??null;
 touchDir=0;
}
function touchMove(e){
 if(ended||downTouch===null)return;
 e.preventDefault();
 const y=e.changedTouches[0]?.clientY??downTouch;
 const delta=downTouch-y;downTouch=y;touchDir+=delta;
 advance(delta/Math.max(700,window.innerHeight*1.72));
}
function touchEnd(){downTouch=null;touchDir=0}
function key(e){
 if(ended)return;
 // Don't hijack keyboard events from the actual SKIP button.
 if(e.target?.closest?.('.gt-scroll-entry-skip'))return;
 if(['ArrowDown','PageDown',' ','Enter'].includes(e.key)){
  e.preventDefault();advance(e.key==='ArrowDown'?.13:.27);
 }else if(['ArrowUp','PageUp'].includes(e.key)){
  e.preventDefault();advance(-.15);
 }else if(e.key==='Escape'){e.preventDefault();complete()}
}
window.addEventListener('wheel',wheel,{passive:false,capture:true});
window.addEventListener('touchstart',touchStart,{passive:true,capture:true});
window.addEventListener('touchmove',touchMove,{passive:false,capture:true});
window.addEventListener('touchend',touchEnd,{passive:true,capture:true});
window.addEventListener('keydown',key);
window.addEventListener('resize',measure,{passive:true});
overlay.querySelector('.gt-scroll-entry-skip')?.addEventListener('click',complete);
window.addEventListener('hashchange',()=>{if(!home())complete()},{once:true});
const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
mq.addEventListener?.('change',e=>{if(e.matches)complete()},{once:true});
measure();draw();
})();
