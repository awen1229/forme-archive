/* Choose a V25–V27 study from the URL for the Opening Studio.
   Original artwork and animation timing remain unchanged. */
(()=>{
 'use strict';
 const selected=new URLSearchParams(location.search).get('kind');
 if(!selected||!['material','space','index','magnetic','diecut','exposure','ripple'].includes(selected))return;
 const candidate=document.querySelector('[data-kind="'+selected+'"]');
 const loading=document.getElementById('loading');
 if(!candidate)return;
 let done=false,observer;
 function apply(){
  if(done||!loading?.hidden)return;
  done=true;
  observer?.disconnect();
  if(candidate.getAttribute('aria-selected')!=='true')candidate.click();
 }
 observer=new MutationObserver(apply);
 if(loading)observer.observe(loading,{attributes:true,attributeFilter:['hidden']});
 apply();
 window.addEventListener('pageshow',apply,{once:true});
})();