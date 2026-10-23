/* GOOD THINGS, homepage: actual carousel image-ratio guides + non-destructive drag crop. */
(()=>{
'use strict';
const previewHost='feature-secure-editor-cloud.forme-archive.pages.dev';
if(location.hostname!==previewHost||typeof gtHomeWorkingCopy!=='function')return;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const fallback=(v,d)=>v==null?d:v;
const readHome=()=>location.hash.includes('/admin')&&editorKind==='home'&&Array.isArray(gtHomeDraft);
const ratioFor=device=>{
 // Public CSS: carousel 485px desktop, image 1.12/2.0 of 90vw.
 // At ≤700px: image stretches over the full 90vw content width, height 315px.
 const width=device==='desktop'?Math.min(1560,Math.max(761,window.innerWidth)):Math.min(700,Math.max(320,window.innerWidth>700?390:window.innerWidth));
 return device==='desktop'?clamp(width*.9*.56/485,.65,2.9):clamp(width*.9/(width<=370?292:315),.8,2.1);
};
const currentValue=(slide,key,d)=>fallback(slide[key],d);
function build(device,index,slide,cover){
 const mobile=device==='mobile',fitKey=mobile?'coverMobileFit':'coverFit';
 const zoomKey=mobile?'coverMobileZoom':'coverZoom';
 const xKey=mobile?'coverMobileX':'coverX',yKey=mobile?'coverMobileY':'coverY';
 const fit=currentValue(slide,fitKey,'cover'),zoom=currentValue(slide,zoomKey,100),x=currentValue(slide,xKey,50),y=currentValue(slide,yKey,50);
 const cssRatio=ratioFor(device);
 const label=mobile?'MOBILE / 手機輪播圖片':'DESKTOP / 電腦輪播圖片';
 return '<section class="gt-crop-device" data-device="'+device+'">'+
  '<div class="gt-crop-device-label"><b>'+label+'</b><span>模擬公開輪播的圖片區域</span></div>'+
  '<div class="gt-home-crop-stage" data-home-crop-device="'+device+'" data-home-crop-i="'+index+'" style="aspect-ratio:'+cssRatio.toFixed(4)+'">'+
   (cover?'<img src="'+esc(cover)+'" alt="'+esc(slide.title||'精選圖片')+'" loading="lazy">':'<div class="gt-home-crop-placeholder">尚無圖片，請先選擇文章封面或上傳輪播封面。</div>')+
   '<span class="gt-home-crop-guide" aria-hidden="true"></span>'+
   (cover?'<button type="button" class="gt-home-crop-corner" data-home-crop-handle="zoom" aria-label="拖曳這個控制點，以等比例縮放圖片"></button>':'')+
  '</div>'+
  '<div class="gt-home-crop-actions">'+
   '<label>顯示方式<select data-home-field="'+fitKey+'" data-home-i="'+index+'"><option value="cover" '+(fit!=='contain'?'selected':'')+'>填滿裁切</option><option value="contain" '+(fit==='contain'?'selected':'')+'>完整顯示</option></select></label>'+
   '<label>圖片大小 <output data-home-output="'+zoomKey+'">'+zoom+'%</output><input aria-label="'+label+'縮放" type="range" min="100" max="'+(mobile?200:250)+'" step="1" data-home-field="'+zoomKey+'" data-home-i="'+index+'" value="'+zoom+'"></label>'+
   '<label>左右焦點 <output data-home-output="'+xKey+'">'+x+'%</output><input aria-label="'+label+'左右焦點" type="range" min="0" max="100" step="1" data-home-field="'+xKey+'" data-home-i="'+index+'" value="'+x+'"></label>'+
   '<label>上下焦點 <output data-home-output="'+yKey+'">'+y+'%</output><input aria-label="'+label+'上下焦點" type="range" min="0" max="100" step="1" data-home-field="'+yKey+'" data-home-i="'+index+'" value="'+y+'"></label>'+
  '</div></section>';
}
function refreshFrame(stage){
 const i=Number(stage.dataset.homeCropI),device=stage.dataset.homeCropDevice,slide=gtHomeDraft[i];
 if(!slide)return;
 const mobile=device==='mobile',img=stage.querySelector('img');
 if(!img)return;
 const fit=currentValue(slide,mobile?'coverMobileFit':'coverFit','cover');
 const x=clamp(currentValue(slide,mobile?'coverMobileX':'coverX',50),0,100);
 const y=clamp(currentValue(slide,mobile?'coverMobileY':'coverY',50),0,100);
 const z=clamp(currentValue(slide,mobile?'coverMobileZoom':'coverZoom',100),100,mobile?200:250);
 img.style.objectFit=fit==='contain'?'contain':'cover';
 img.style.objectPosition=x+'% '+y+'%';
 img.style.transform=fit==='contain'?'none':'scale('+(z/100)+')';
 img.style.transformOrigin=x+'% '+y+'%';
 stage.style.aspectRatio=ratioFor(device).toFixed(4);
 stage.dataset.cropFit=fit;
 stage.querySelectorAll('[data-home-crop-handle]').forEach(b=>{b.hidden=fit==='contain'});
 for(const key of (mobile?['coverMobileZoom','coverMobileX','coverMobileY']:['coverZoom','coverX','coverY'])){
  const out=stage.closest('.gt-crop-device')?.querySelector('[data-home-output="'+key+'"]');
  if(out)out.textContent=clamp(slide[key]??(key.includes('Zoom')?100:50),0,250)+'%';
 }
}
function enhance(){
 if(!readHome())return;
 for(const card of document.querySelectorAll('.gt-home-edit-card[data-home-index]')){
  if(card.querySelector('.gt-home-matched-crop'))continue;
  const i=Number(card.dataset.homeIndex),slide=gtHomeDraft[i];
  if(!slide)continue;
  const cover=slide.cover||articles.find(a=>a.slug===slide.slug)?.cover||'';
  const node=document.createElement('div');node.className='gt-home-matched-crop';
  node.innerHTML='<div class="gt-home-crop-intro"><b>COVER CROP / 真實版型預覽</b><span>拖曳圖片可移動焦點，拖曳右下角可等比例縮放。原圖不會被裁掉。</span></div>'+
   build('desktop',i,slide,cover)+build('mobile',i,slide,cover);
  const sample=card.querySelector('.gt-home-cover-sample');
  if(sample){sample.hidden=true;sample.insertAdjacentElement('afterend',node)}
  else card.append(node);
  const legacy=card.querySelector('.gt-cover-control');
  if(legacy)legacy.hidden=true;
  node.querySelectorAll('.gt-home-crop-stage').forEach(refreshFrame);
 }
}
let drag=null;
document.addEventListener('pointerdown',event=>{
 const stage=event.target.closest?.('.gt-home-crop-stage');
 if(!stage||!readHome()||!stage.querySelector('img'))return;
 if(stage.dataset.cropFit==='contain')return;
 const i=Number(stage.dataset.homeCropI),device=stage.dataset.homeCropDevice,slide=gtHomeDraft[i];
 if(!slide)return;
 const mobile=device==='mobile';
 const xKey=mobile?'coverMobileX':'coverX',yKey=mobile?'coverMobileY':'coverY',zKey=mobile?'coverMobileZoom':'coverZoom';
 drag={stage,id:event.pointerId,device,i,xKey,yKey,zKey,x:event.clientX,y:event.clientY,
  startX:clamp(slide[xKey]??50,0,100),startY:clamp(slide[yKey]??50,0,100),
  startZoom:clamp(slide[zKey]??100,100,mobile?200:250),mode:event.target.closest?.('[data-home-crop-handle]')?'zoom':'pan'};
 stage.setPointerCapture(event.pointerId);
 event.preventDefault();
});
document.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 const {stage,i,x,y,xKey,yKey,zKey,startX,startY,startZoom,mode,device}=drag;
 const slide=gtHomeDraft[i];if(!slide)return;
 if(mode==='zoom')slide[zKey]=Math.round(clamp(startZoom+(event.clientX-x-event.clientY+y)*.45,100,device==='mobile'?200:250));
 else{
  const rect=stage.getBoundingClientRect();
  // Object-position moves artwork opposite to finger while keeping source ratio.
  slide[xKey]=Math.round(clamp(startX-(event.clientX-x)*100/Math.max(1,rect.width),0,100));
  slide[yKey]=Math.round(clamp(startY-(event.clientY-y)*100/Math.max(1,rect.height),0,100));
 }
 const card=stage.closest('.gt-home-edit-card');
 for(const key of [xKey,yKey,zKey]){
  const el=card?.querySelector('.gt-home-matched-crop [data-home-field="'+key+'"]');
  if(el){el.value=slide[key];el.dispatchEvent(new Event('input',{bubbles:true}))}
 }
 stage.querySelectorAll('img').forEach(x=>x.draggable=false);
 card?.querySelectorAll('.gt-home-crop-stage').forEach(refreshFrame);
 event.preventDefault();
});
const endDrag=e=>{
 if(!drag||e.pointerId!==drag.id)return;
 try{drag.stage.releasePointerCapture(e.pointerId)}catch{}
 drag=null;
};
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('input',event=>{
 const field=event.target.closest?.('.gt-home-matched-crop [data-home-field]');
 if(!field)return;
 const card=field.closest('.gt-home-edit-card');
 // Main homepage editor owns the values. Run after its input handler.
 card?.querySelectorAll('.gt-home-crop-stage').forEach(refreshFrame);
});
document.addEventListener('change',event=>{
 const field=event.target.closest?.('.gt-home-matched-crop [data-home-field]');
 if(!field)return;
 field.closest('.gt-home-edit-card')?.querySelectorAll('.gt-home-crop-stage').forEach(refreshFrame);
});
const earlierRender=render;
render=function(...args){const result=earlierRender(...args);enhance();return result};
window.addEventListener('resize',()=>{
 if(!readHome())return;
 document.querySelectorAll('.gt-home-crop-stage').forEach(refreshFrame);
});
enhance();
})();