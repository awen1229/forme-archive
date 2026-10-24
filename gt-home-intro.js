/* GOOD THINGS, / Matter.js tumble followed by a measured constant-speed glyph stream.
   Embeds the same standalone V8 study instead of
   replacing the authentic original letterforms or comma outline. */
(()=>{'use strict';
const root=document.documentElement;
const overlay=document.getElementById('gt-scroll-entry');
const home=()=>!location.hash||location.hash==='#'||location.hash==='#/';
if(!overlay||!home()||!root.classList.contains('gt-scroll-entry-ready'))return;
const center=overlay.querySelector('.gt-scroll-entry-center');
const skip=overlay.querySelector('.gt-scroll-entry-skip');
const bar=overlay.querySelector('.gt-scroll-entry-progress i');
const pct=overlay.querySelector('.gt-scroll-entry-percent');
if(!center||!skip){root.classList.remove('gt-scroll-entry-ready');overlay.remove();return}
const frame=document.createElement('iframe');
frame.className='gt-physics-stage-frame';
frame.title='GOOD THINGS, 原始 LOGO Matter.js 重力與碰撞開場';
frame.setAttribute('aria-label','原始字母在逗號內受重力碰撞，翻轉倒出後從右邊回來組成 LOGO');
frame.setAttribute('scrolling','no');
frame.style.cssText='display:block;border:0;width:100%;height:100%;background:#f3f1eb;';
center.style.cssText='display:block;min-height:0;width:100%;flex:1 1 auto;overflow:hidden;';
center.replaceChildren(frame);
overlay.classList.add('gt-physics-entry');
let completed=false,timeout=0;
function finish(){
 if(completed)return;
 completed=true;
 try{sessionStorage.setItem('gt-scroll-entry-physics8','done')}catch(e){}
 overlay.classList.add('is-completing');
 const cleanup=()=>{
  root.classList.remove('gt-scroll-entry-ready');
  if(overlay.isConnected)overlay.remove();
  window.removeEventListener('message',onMessage);
  window.removeEventListener('keydown',onKey);
  window.removeEventListener('hashchange',onRoute);
  clearTimeout(timeout);window.scrollTo(0,0);
 };
 overlay.addEventListener('transitionend',e=>{if(e.target===overlay)cleanup()},{once:true});
 timeout=setTimeout(cleanup,650);
}
function onMessage(event){
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 const m=event.data;
 if(!m||typeof m.type!=='string')return;
 if(m.type==='gt-physics-progress'){
  const p=Math.max(0,Math.min(1,Number(m.progress)||0));
  if(bar)bar.style.transform='scaleX('+p+')';
  if(pct)pct.textContent=Math.round(p*100)+'%';
 }else if(m.type==='gt-physics-complete'){
  if(bar)bar.style.transform='scaleX(1)';
  if(pct)pct.textContent='100%';
  timeout=setTimeout(finish,1050);
 }else if(m.type==='gt-physics-fail'){finish();}
}
function onKey(e){if(e.key==='Escape'){e.preventDefault();finish();}}
function onRoute(){if(!home())finish();}
window.addEventListener('message',onMessage);
window.addEventListener('keydown',onKey);
window.addEventListener('hashchange',onRoute);
skip.addEventListener('click',finish);
frame.addEventListener('error',finish);
frame.src='./opening-lab-physics-v8.html?embed=1&build=physics08';
})();