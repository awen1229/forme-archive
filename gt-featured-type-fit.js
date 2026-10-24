/* FIT / FEATURED: adapt headline size without stealing excerpt and button space.
   Preserves full article titles; very extreme titles receive a visual clamp only. */
(()=>{
'use strict';
const stageId='gt-mag-stage';
let pending=false;
function fitSheet(sheet){
 const copy=sheet.querySelector('.gt-mag-copy');
 const group=copy?.firstElementChild;
 const title=group?.querySelector('h2');
 const excerpt=group?.querySelector('p');
 const category=group?.querySelector('.gt-mag-type');
 const link=copy?.querySelector('.gt-mag-read');
 if(!copy||!group||!title||!excerpt||!category||!link)return;
 const mobile=window.matchMedia('(max-width:700px)').matches;
 const tablet=window.matchMedia('(max-width:800px)').matches;
 const max=mobile?29:tablet?32:45;
 const min=mobile?16:19;
 const reserve=mobile?7:12;
 title.classList.remove('gt-mag-ellipsis');
 title.style.removeProperty('-webkit-line-clamp');
 title.style.setProperty('display','block');
 title.style.setProperty('flex','0 0 auto');
 // Measure the real content. Non-animated underlying sheets are fitted as well.
 let chosen=min, fits=false;
 for(let size=max;size>=min;size-=1){
  title.style.setProperty('--gt-feature-title-size',size+'px');
  const required=category.getBoundingClientRect().height+
    parseFloat(getComputedStyle(category).marginBottom||0)+
    title.scrollHeight+parseFloat(getComputedStyle(title).marginBottom||0)+
    excerpt.getBoundingClientRect().height+parseFloat(getComputedStyle(excerpt).marginBottom||0);
  const available=copy.clientHeight-
    parseFloat(getComputedStyle(copy).paddingTop||0)-
    parseFloat(getComputedStyle(copy).paddingBottom||0)-
    link.getBoundingClientRect().height-reserve;
  if(required<=Math.max(0,available)){chosen=size;fits=true;break}
 }
 title.style.setProperty('--gt-feature-title-size',chosen+'px');
 title.style.removeProperty('display');
 title.style.removeProperty('flex');
 if(!fits){
  const lineHeight=parseFloat(getComputedStyle(title).lineHeight)||chosen*1.2;
  const space=group.clientHeight-category.getBoundingClientRect().height-
    parseFloat(getComputedStyle(category).marginBottom||0)-
    excerpt.getBoundingClientRect().height-
    parseFloat(getComputedStyle(excerpt).marginBottom||0)-12;
  const lines=Math.max(2,Math.floor(space/lineHeight));
  title.style.setProperty('--gt-feature-max-lines',String(lines));
  title.classList.add('gt-mag-ellipsis');
 }
 // The unabridged title is always available to mouse and keyboard users.
 title.title=title.textContent.trim();
}
function update(){
 pending=false;
 document.querySelectorAll('#'+stageId+' .gt-mag-sheet').forEach(fitSheet);
}
function schedule(){
 if(pending)return;
 pending=true;requestAnimationFrame(update);
}
function connect(){
 // The site uses client-side routes: new carousel nodes replace the old ones.
 // Observe DOM replacements as well as slide changes and font loading.
 new MutationObserver(records=>{
  if(records.some(record=>record.addedNodes.length||record.removedNodes.length))schedule();
 }).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('resize',schedule,{passive:true});
 if(document.fonts?.ready)document.fonts.ready.then(schedule);
 if(document.fonts?.addEventListener)document.fonts.addEventListener('loadingdone',schedule);
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
else connect();
})();