/* GOOD THINGS, pre-upload crop for every editorial image input.
   Delegated capture sees dynamically rendered image fields, including FEATURES.
   Keeping the original File option protects existing cropping/upload contracts. */
(()=>{
'use strict';
const selectors='input[type="file"]';
const allowed=/^image\/(?:png|jpeg|webp)$/;
const passed=new WeakSet();
let dialog=null,active=null,originalOverflow='',returnFocus=null;
const min=(n,lo,hi)=>Math.min(Math.max(n,lo),hi);
const finite=n=>Number.isFinite(n)?n:0;
const byId=id=>dialog?.querySelector('#'+id);
function isImageField(input){
 if(!input?.matches?.(selectors)||input.multiple||input.disabled)return false;
 const accept=input.getAttribute('accept')||'';
 return /image\//i.test(accept)||['f-cover','f-logo','gt-inline-upload'].includes(input.id)||input.hasAttribute('data-home-cover')||input.name==='coverUpload';
}
function ensure(){
 if(dialog)return;
 dialog=document.createElement('div');
 dialog.className='gt-shared-crop-overlay';dialog.hidden=true;
 dialog.innerHTML=`
  <section class="gt-shared-crop-dialog" role="dialog" aria-modal="true" aria-label="圖片裁切">
   <div class="gt-shared-crop-titlebar">
    <div><strong>IMAGE CROP / 圖片裁切</strong><small>GOOD THINGS, EDITORIAL STUDIO</small></div>
    <button class="gt-shared-crop-close" type="button" data-crop-action="cancel">關閉</button>
   </div>
   <p class="gt-shared-crop-note">拖曳白色邊框調整裁切大小，拖曳框內移動位置。可選固定比例或自由裁切；使用原圖則不會裁掉任何內容。</p>
   <div class="gt-shared-crop-preview" id="gt-shared-crop-preview">
    <img id="gt-shared-crop-image" alt="圖片裁切預覽">
    <div class="gt-shared-crop-selection" id="gt-shared-crop-selection">
     ${['nw','n','ne','e','se','s','sw','w'].map(k=>'<span class="gt-shared-crop-handle" data-corner="'+k+'"></span>').join('')}
    </div>
   </div>
   <div class="gt-shared-crop-toolbar">
    <label>裁切比例<select id="gt-shared-crop-ratio">
     <option value="free">自由調整</option><option value="original">原圖比例</option>
     <option value="1">1:1 正方形</option><option value="0.8">4:5 直式</option>
     <option value="0.75">3:4 直式</option><option value="1.5">3:2 橫式</option>
     <option value="1.7777777778">16:9 橫式</option>
     <option value="0.5625">9:16 直式</option>
    </select></label>
    <span class="gt-shared-crop-info" id="gt-shared-crop-info" aria-live="polite"></span>
   </div>
   <div class="gt-shared-crop-actions">
    <button type="button" data-crop-action="cancel">取消</button>
    <button type="button" data-crop-action="original">使用原圖</button>
    <button type="button" class="gt-shared-crop-apply" data-crop-action="apply">裁切並使用</button>
   </div>
  </section>`;
 document.body.append(dialog);
 dialog.addEventListener('click',e=>{
  const action=e.target.closest('[data-crop-action]')?.dataset.cropAction;
  if(action==='cancel')close(true);
  if(action==='original')commit(null);
  if(action==='apply')applyCrop();
 });
 byId('gt-shared-crop-ratio').addEventListener('change',e=>setRatio(e.target.value));
 byId('gt-shared-crop-preview').addEventListener('pointerdown',pointerDown);
 byId('gt-shared-crop-preview').addEventListener('pointermove',pointerMove);
 byId('gt-shared-crop-preview').addEventListener('pointerup',pointerUp);
 byId('gt-shared-crop-preview').addEventListener('pointercancel',pointerUp);
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close(true)}
  if(e.key==='Tab'){
   const buttons=[...dialog.querySelectorAll('button,select')].filter(el=>!el.disabled);
   if(!buttons.length)return;
   const first=buttons[0],last=buttons[buttons.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
}
function dimensions(){
 if(!active)return null;
 const frame=byId('gt-shared-crop-preview').getBoundingClientRect();
 const {w,h}=active;
 const scale=Math.min(frame.width/w,frame.height/h);
 const iw=w*scale,ih=h*scale;
 return {left:(frame.width-iw)/2,top:(frame.height-ih)/2,scale,iw,ih};
}
function redraw(){
 if(!active)return;
 const d=dimensions();if(!d)return;
 const r=active.rect,s=byId('gt-shared-crop-selection');
 s.style.left=(d.left+r.x*d.scale)+'px';
 s.style.top=(d.top+r.y*d.scale)+'px';
 s.style.width=(r.w*d.scale)+'px';
 s.style.height=(r.h*d.scale)+'px';
 s.style.setProperty('--gt-crop-sel-width',r.w*d.scale+'px');
 byId('gt-shared-crop-info').textContent=Math.round(r.w)+' × '+Math.round(r.h)+' px';
}
function setRatio(value){
 if(!active)return;
 const a=active;
 a.ratio=value==='free'?0:value==='original'?a.w/a.h:Number(value);
 if(!a.ratio){redraw();return}
 const r=a.rect,cx=r.x+r.w/2,cy=r.y+r.h/2;
 let w=Math.min(r.w,a.w),h=w/a.ratio;
 if(h>r.h){h=r.h;w=h*a.ratio}
 if(w>a.w){w=a.w;h=w/a.ratio}
 if(h>a.h){h=a.h;w=h*a.ratio}
 a.rect={x:min(cx-w/2,0,a.w-w),y:min(cy-h/2,0,a.h-h),w,h};
 redraw();
}
function pointerDown(e){
 if(!active||e.button!==0)return;
 const s=e.target.closest('#gt-shared-crop-selection');
 if(!s)return;
 const corner=e.target.closest('[data-corner]')?.dataset.corner||'move';
 active.drag={id:e.pointerId,corner,x:e.clientX,y:e.clientY,start:{...active.rect}};
 byId('gt-shared-crop-preview').setPointerCapture(e.pointerId);
 e.preventDefault();
}
function pointerMove(e){
 const a=active,d=a?.drag;if(!a||!d||e.pointerId!==d.id)return;
 const m=dimensions();if(!m)return;
 const dx=(e.clientX-d.x)/m.scale,dy=(e.clientY-d.y)/m.scale;
 const s=d.start,co=d.corner;
 if(co==='move'){
  a.rect={...s,x:min(s.x+dx,0,a.w-s.w),y:min(s.y+dy,0,a.h-s.h)};
 }else{
  let x1=s.x,y1=s.y,x2=s.x+s.w,y2=s.y+s.h;
  if(co.includes('w'))x1=min(s.x+dx,0,x2-24);
  if(co.includes('e'))x2=min(s.x+s.w+dx,x1+24,a.w);
  if(co.includes('n'))y1=min(s.y+dy,0,y2-24);
  if(co.includes('s'))y2=min(s.y+s.h+dy,y1+24,a.h);
  if(a.ratio){
   const west=co.includes('w'),north=co.includes('n');
   const east=co.includes('e'),south=co.includes('s');
   const anchorX=west?s.x+s.w:east?s.x:s.x+s.w/2;
   const anchorY=north?s.y+s.h:south?s.y:s.y+s.h/2;
   let width=(west?anchorX-x1:east?x2-anchorX:Math.max(24,x2-x1));
   let height=(north?anchorY-y1:south?y2-anchorY:Math.max(24,y2-y1));
   if((west||east)&&!(north||south))height=width/a.ratio;
   else if((north||south)&&!(west||east))width=height*a.ratio;
   else if(Math.abs(dx)>=Math.abs(dy))height=width/a.ratio;
   else width=height*a.ratio;
   const maxW=west?anchorX:east?a.w-anchorX:2*Math.min(anchorX,a.w-anchorX);
   const maxH=north?anchorY:south?a.h-anchorY:2*Math.min(anchorY,a.h-anchorY);
   width=min(width,24,Math.min(maxW,maxH*a.ratio));height=width/a.ratio;
   x1=west?anchorX-width:east?anchorX:anchorX-width/2;
   y1=north?anchorY-height:south?anchorY:anchorY-height/2;
   x2=x1+width;y2=y1+height;
  }
  if(x2-x1>=20&&y2-y1>=20)a.rect={x:x1,y:y1,w:x2-x1,h:y2-y1};
 }
 redraw();e.preventDefault();
}
function pointerUp(e){
 if(active?.drag?.id===e.pointerId)active.drag=null;
}
function close(clear){
 if(!active)return;
 const a=active;active=null;
 dialog.hidden=true;document.body.style.overflow=originalOverflow;
 URL.revokeObjectURL(a.objectURL);
 if(clear&&a.input.isConnected)a.input.value='';
 if(returnFocus?.isConnected)returnFocus.focus();
 returnFocus=null;
}
function commit(cropped){
 const a=active;if(!a)return;
 const input=a.input;
 try{
  if(cropped){
   const dt=new DataTransfer();
   dt.items.add(cropped);
   input.files=dt.files;
  }
  // If the DOM re-rendered while open, never write into a stale form.
  if(!input.isConnected)throw Error('表單已切換，請重新選取圖片。');
  passed.add(input);
  close(false);
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }catch(error){
  passed.delete(input);close(true);
  alert('無法套用裁切：'+(error?.message||String(error)));
 }
}
async function applyCrop(){
 if(!active)return;
 const a=active,{x,y,w,h}=a.rect;
 if(Math.abs(x)<.5&&Math.abs(y)<.5&&Math.abs(w-a.w)<.5&&Math.abs(h-a.h)<.5){commit(null);return}
 const button=dialog.querySelector('[data-crop-action="apply"]');
 button.disabled=true;
 try{
  const maxSide=a.input.id==='f-logo'?2200:2800;
  const scale=Math.min(1,maxSide/Math.max(w,h));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*scale));
  canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw Error('瀏覽器不支援圖片裁切');
  ctx.drawImage(a.img,x,y,w,h,0,0,canvas.width,canvas.height);
  const type=a.input.id==='f-logo'||a.file.type==='image/png'?'image/png':'image/jpeg';
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(Error('圖片編碼失敗')),type,.9));
  if(active!==a)return;
  const ext=type==='image/png'?'png':'jpg';
  const newFile=new File([blob],a.file.name.replace(/\.[^.]+$/,'')+'-crop.'+ext,{type,lastModified:Date.now()});
  commit(newFile);
 }catch(error){alert('裁切失敗：'+(error?.message||String(error)));}
 finally{button.disabled=false}
}
async function open(input,file){
 ensure();
 if(active)close(true);
 if(!allowed.test(file.type))return false;
 originalOverflow=document.body.style.overflow;
 returnFocus=input;
 const url=URL.createObjectURL(file);
 const img=new Image();img.src=url;
 try{
  if(img.decode)await img.decode();
  else await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('解碼失敗'))});
 }catch(error){URL.revokeObjectURL(url);alert('無法讀取圖片：'+(error?.message||String(error)));input.value='';return true}
 active={input,file,objectURL:url,img,w:img.naturalWidth,h:img.naturalHeight,rect:{x:0,y:0,w:img.naturalWidth,h:img.naturalHeight},ratio:0,drag:null};
 byId('gt-shared-crop-image').src=url;
 byId('gt-shared-crop-ratio').value='free';
 dialog.hidden=false;document.body.style.overflow='hidden';
 requestAnimationFrame(redraw);
 dialog.querySelector('.gt-shared-crop-close').focus();
 return true;
}
document.addEventListener('change',e=>{
 const input=e.target;
 if(!isImageField(input))return;
 if(passed.has(input)){passed.delete(input);return}
 const file=input.files?.[0];
 if(!file||!allowed.test(file.type))return;
 // Cancel the normal uploader until the editor accepts original/cropped image.
 e.stopImmediatePropagation();
 open(input,file).catch(err=>{input.value='';alert('圖片預覽失敗：'+(err?.message||String(err)))});
},true);
window.addEventListener('resize',()=>{if(active)redraw()},{passive:true});
})();
