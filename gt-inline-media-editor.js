/* GOOD THINGS, editor-only inline image uploader. Images never publish articles automatically. */
(()=>{
 const preview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
 if(!preview)return;

 let photoUrl='',dragCrop=null;
 let selected=null,busy=false,caret=0;
 function enhanceInline(){
  if(editorKind!=='article'||!location.hash.includes('/admin'))return;
  const zone=document.getElementById('gt-inline-media-fold')?.querySelector('.gt-editor-inline-image');
  if(!zone||zone.querySelector('#gt-inline-shape'))return;
  const group=document.createElement('div');group.id='gt-inline-shape';group.className='gt-inline-shape';
  group.innerHTML='<strong>顯示範圍 / FREE CROP</strong>'+
   '<small>圖片可自行調整寬度與長寬比例。拖曳右下角改變長寬，不會把照片拉變形。</small>'+
   '<div class="gt-inline-shape-canvas"><div id="gt-inline-shape-stage" class="gt-inline-shape-stage" style="width:100%;aspect-ratio:1.5">'+
   '<div id="gt-inline-shape-empty">選擇圖片後會在這裡預覽裁切。</div>'+
   '<img id="gt-inline-shape-img" alt="正文圖片裁切預覽" hidden>'+
   '<button type="button" id="gt-inline-shape-handle" aria-label="拖曳改變正文圖片的寬度與高度">↘</button>'+
   '</div></div>'+
   '<div class="gt-inline-shape-sliders"><label>桌面圖片寬度 <output id="gt-inline-width-out">100%</output><input id="gt-inline-width" type="range" min="40" max="100" value="100" step="1"></label>'+
   '<label>裁切框長寬比 <output id="gt-inline-ratio-out">1.50:1</output><input id="gt-inline-ratio" type="range" min="50" max="250" value="150" step="1"></label></div>';
  const picker=zone.querySelector('#gt-inline-upload');
  if(picker)picker.insertAdjacentElement('afterend',group);
  else zone.append(group);
  if(selected)displaySelected();
  applyShape();
 }
 function applyShape(){
  const box=document.getElementById('gt-inline-shape-stage');
  if(!box)return;
  const width=Number(document.getElementById('gt-inline-width')?.value)||100;
  const ratio=Number(document.getElementById('gt-inline-ratio')?.value)||150;
  box.style.width=width+'%';box.style.aspectRatio=(ratio/100).toFixed(3);
  const w=document.getElementById('gt-inline-width-out'),ra=document.getElementById('gt-inline-ratio-out');
  if(w)w.textContent=width+'%';if(ra)ra.textContent=(ratio/100).toFixed(2)+':1';
 }
 function displaySelected(){
  const img=document.getElementById('gt-inline-shape-img'),empty=document.getElementById('gt-inline-shape-empty');
  if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=''}
  if(!img)return;
  if(selected){
   photoUrl=URL.createObjectURL(selected);img.src=photoUrl;img.hidden=false;if(empty)empty.hidden=true;
  }else{img.hidden=true;img.removeAttribute('src');if(empty)empty.hidden=false}
 }
 const originalRender=render;
 render=function(...args){const result=originalRender(...args);enhanceInline();return result};
 document.addEventListener('input',e=>{
  if(e.target.id==='gt-inline-width'||e.target.id==='gt-inline-ratio')applyShape();
 });
 document.addEventListener('pointerdown',e=>{
  const handle=e.target.closest?.('#gt-inline-shape-handle');
  if(!handle)return;
  const stage=document.getElementById('gt-inline-shape-stage'),parent=stage?.parentElement;
  if(!stage||!parent)return;
  dragCrop={id:e.pointerId,startX:e.clientX,startY:e.clientY,startWidth:stage.offsetWidth,startHeight:stage.offsetHeight,parentWidth:parent.clientWidth};
  handle.setPointerCapture(e.pointerId);e.preventDefault();
 });
 document.addEventListener('pointermove',e=>{
  if(!dragCrop||e.pointerId!==dragCrop.id)return;
  const d=dragCrop,px= Math.max(d.parentWidth*.4,Math.min(d.parentWidth,d.startWidth+(e.clientX-d.startX)));
  const h=Math.max(55,d.startHeight+(e.clientY-d.startY));
  const width=Math.round(px/d.parentWidth*100);
  const ratio=Math.round(Math.max(.5,Math.min(2.5,px/h))*100);
  const w=document.getElementById('gt-inline-width'),ra=document.getElementById('gt-inline-ratio');
  if(w)w.value=String(width);if(ra)ra.value=String(ratio);
  applyShape();e.preventDefault();
 });
 const release=e=>{if(!dragCrop||e.pointerId!==dragCrop.id)return;dragCrop=null};
 document.addEventListener('pointerup',release);
 document.addEventListener('pointercancel',release);
 const style=document.createElement('style');
 style.textContent=String.raw`
 .gt-inline-shape{display:grid;gap:12px;min-width:0;padding:15px;background:#f7f7f2;border:1px solid #c9d0c5}
 .gt-inline-shape strong{font-size:12px;letter-spacing:.06em}
 .gt-inline-shape small{font-size:11px;line-height:1.7;color:#5c6f5e}
 .gt-inline-shape-canvas{width:100%;min-width:0;background:#e5e5dc;padding:12px;overflow:hidden}
 .gt-inline-shape-stage{position:relative;max-width:100%;min-height:65px;background:#cdd3c8;overflow:visible;outline:1px solid #768473}
 .gt-inline-shape-stage>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;max-width:100%;display:block}
 .gt-inline-shape-stage>img[hidden]{display:none}
 .gt-inline-shape-stage>div{display:grid;place-items:center;height:100%;padding:12px;font-size:12px;color:#667364}
 .gt-inline-shape-stage>div[hidden]{display:none}
 .gt-inline-shape-stage>button{position:absolute;right:-5px;bottom:-5px;width:32px;height:32px;border:1px solid #415847;background:#f5f8f1e9;color:#2c4933;cursor:nwse-resize;touch-action:none}
 .gt-inline-shape-sliders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
 .gt-inline-shape-sliders label{min-width:0;display:grid;gap:4px;font-size:11px}
 .gt-inline-shape-sliders input{width:100%;min-width:0;accent-color:#446e4d}
 .gt-inline-shape-sliders output{font-variant-numeric:tabular-nums;color:#466b50}
 @media(max-width:500px){.gt-inline-shape-sliders{grid-template-columns:1fr}}
`;
 document.head.appendChild(style);
 enhanceInline();

const clampInline=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback};
 document.addEventListener('click',e=>{
  const area=e.target.closest('#f-body');if(area)caret=area.selectionStart||0;
 },true);
 document.addEventListener('keyup',e=>{if(e.target.id==='f-body')caret=e.target.selectionStart||0},true);
 document.addEventListener('change',e=>{
  if(e.target.id==='gt-inline-upload'){selected=e.target.files?.[0]||null;displaySelected();}
 });
 document.addEventListener('click',async e=>{
  if(e.target.id!=='gt-inline-insert')return;
  e.preventDefault();e.stopPropagation();
  const output=document.getElementById('gt-inline-status'),area=document.getElementById('f-body');
  if(busy||!area)return;
  if(!selected)return alert('請先選擇要插入的圖片');
  busy=true;e.target.disabled=true;
  try{
   output.textContent='圖片壓縮與上傳中…';
   const image=(await gtCompressImage(selected,'cover')).data;
   const resp=await fetch('/api/editor/inline-image',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({image})
   });
   const result=await resp.json();
   if(!resp.ok||!result.ok)throw Error(result.error||'上傳失敗 HTTP '+resp.status);
   const caption=(document.getElementById('gt-inline-caption')?.value||'').replace(/[\]\r\n|]/g,' ').slice(0,200).trim();
   const fit=document.getElementById('gt-inline-mobile-fit')?.value==='full'?'full':'crop';
   const width=clampInline(document.getElementById('gt-inline-width')?.value,40,100,100),ratio=clampInline(document.getElementById('gt-inline-ratio')?.value,50,250,150);
   const token='[[image:'+result.url+'|'+caption+'|fit:'+fit+'|width:'+width+'|ratio:'+ratio+']]';
   const pos=Math.min(caret,area.value.length),before=area.value.slice(0,pos),after=area.value.slice(pos);
   const prefix=before.length&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'';
   const suffix=after.length&&!after.startsWith('\n\n')?(after.startsWith('\n')?'\n':'\n\n'):'';
   area.value=before+prefix+token+suffix+after;
   caret=(before+prefix+token).length;
   area.focus();area.setSelectionRange(caret,caret);
   area.dispatchEvent(new Event('input',{bubbles:true}));
   output.textContent='圖片已插入正文。請按儲存修改，再確認發布。';
   selected=null;const picker=document.getElementById('gt-inline-upload');if(picker)picker.value='';
  }catch(err){output.textContent='插入失敗：'+err.message;alert(output.textContent)}
  finally{busy=false;if(e.target.isConnected)e.target.disabled=false}
 },true);
})();
