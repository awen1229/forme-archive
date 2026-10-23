/* GOOD THINGS, editor-only inline image uploader. Images never publish articles automatically. */
(()=>{
 const preview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
 if(!preview)return;
 let selected=null,busy=false,caret=0;
 document.addEventListener('click',e=>{
  const area=e.target.closest('#f-body');if(area)caret=area.selectionStart||0;
 },true);
 document.addEventListener('keyup',e=>{if(e.target.id==='f-body')caret=e.target.selectionStart||0},true);
 document.addEventListener('change',e=>{
  if(e.target.id==='gt-inline-upload')selected=e.target.files?.[0]||null;
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
   const token='[[image:'+result.url+'|'+caption+'|fit:'+fit+']]';
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
