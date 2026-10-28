/* GOOD THINGS, admin-only licensed font catalog. No frontend publishing. */
(()=>{
'use strict';
const HOST='feature-secure-editor-cloud.forme-archive.pages.dev';
const ids={list:'gt-font-list',count:'gt-font-count',upload:'gt-font-upload',files:'gt-font-files',license:'gt-font-license',progress:'gt-font-progress',save:'gt-font-save',publish:'gt-font-publish',status:'gt-font-status'};
const $=id=>document.getElementById(id);
const ROLES=['headlines','body','navigation'];
const initial={headlines:'',body:'',navigation:''};
let fonts=[],roles={...initial},saved={...initial},revision='',hasPublished=false,loading=false,saving=false,uploading=false,deleting=false,loaded=false,limit=150,visibleCount=35,search='',previewCounter=0;
let activeObserver=null,categoryFilter='all',editingFont=null,editingBusy=false;
const CATEGORIES={uncategorized:'未分類',serif:'Serif 襯線',sans:'Sans 無襯線',display:'Display 展示',handwriting:'Handwriting 手寫',other:'其他'};
const fontById=id=>fonts.find(f=>f._id===id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stateMessage=(message,error=false)=>{const el=$(ids.status);if(!el)return;el.textContent=message;el.classList.toggle('error',!!error)};
const validFont=font=>window.GTFontPreview?.validate(font);
const isDirty=()=>ROLES.some(key=>roles[key]!==saved[key]);
function available(){
 const ids=new Set(fonts.map(f=>f._id));
 return ROLES.every(key=>!roles[key]||ids.has(roles[key]));
}
function buttons(){
 const f=$(ids.files),lic=$(ids.license);
 $(ids.upload).disabled=loading||uploading||deleting||!lic.checked||!f.files?.length;
 $(ids.save).disabled=loading||saving||uploading||deleting||!loaded||!available()||!isDirty();
 $(ids.publish).disabled=loading||saving||uploading||deleting||!loaded||!available()||isDirty()||!revision;
 $('gt-font-reload').disabled=loading||uploading||saving||deleting;
}
async function api(url,init={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...init});
 let data={};try{data=await response.json()}catch{}
 if(!response.ok||!data.ok)throw Error(data.error||'HTTP '+response.status);
 return data;
}
async function fetchLibrary(){
 const a=await api('/api/editor/font-library');
 if(!Array.isArray(a.fonts))throw Error('字型庫回應格式有誤');
 fonts=a.fonts.filter(validFont);fonts.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
 limit=Number(a.limit)||150;
}
async function refresh(){
 if(uploading||saving)return;
 loading=true;buttons();stateMessage('正在讀取字型庫與草稿設定…');
 try{
  const [library,settings]=await Promise.all([api('/api/editor/font-library'),api('/api/editor/font-settings')]);
  fonts=(Array.isArray(library.fonts)?library.fonts:[]).filter(validFont).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
  limit=Number(library.limit)||150;
  roles=window.GTFontPreview.normalise(settings.roles);
  revision=String(settings.revision||'');hasPublished=!!settings.published;saved={...roles};loaded=true;
  render();
  await applyPreview();
  stateMessage(revision?'字型草稿已載入，可檢查後正式發布。':hasPublished?'目前顯示已發布字型設定，修改後請先儲存草稿。':'尚未發布字型設定，請先預覽並儲存草稿。');
 }catch(error){loaded=false;stateMessage('無法讀取字型庫：'+error.message,true)}
 finally{loading=false;buttons()}
}
function renderRoleSelections(){
 for(const role of ROLES){
  const el=$('gt-font-'+role),chosen=roles[role];
  const options=[new Option('保留原始字體','')];
  for(const f of fonts)options.push(new Option(f.name+' · '+f.format.toUpperCase(),f._id));
  el.replaceChildren(...options);
  if(chosen&&fontById(chosen))el.value=chosen;
  else el.value='';
 }
}
function updateTestSamples(){
 const text=$('gt-font-test-line').value.trim()||'服裝與日常的美好事物。 GOOD THINGS,';
 $('gt-font-body-sample').textContent=text;
 $('gt-font-headline-sample').textContent=text;
}
function refreshPreviewLink(){
 const param=encodeURIComponent(JSON.stringify(roles));
 $('gt-font-preview-site').href='./?gt-font-preview='+param+'#/';
}
async function applyPreview(){
 const call=++previewCounter;
 const result=await window.GTFontPreview.apply(roles,fonts);
 if(call!==previewCounter)return;
 refreshPreviewLink();
 if(result.warnings.length)stateMessage('部分字型無法載入，請確認檔案／瀏覽器支援：'+result.warnings.join('；'),true);
}
function rowMarkup(font){
 return '<div class="gt-font-list-row" data-font-id="'+esc(font._id)+'">'+
  '<div class="gt-font-row-top"><b>'+esc(font.name)+'</b><span>'+esc(font.format.toUpperCase())+'</span></div>'+
  '<div class="gt-font-row-sample">Aa Bb 服裝 日本 &amp; GOOD THINGS,</div>'+
  '<div class="gt-font-row-meta">'+esc(font.originalName||font.name)+'</div><span class="gt-font-row-category">'+esc(CATEGORIES[font.category]||CATEGORIES.uncategorized)+'</span>'+
  '<div class="gt-font-row-error" role="status" aria-live="polite" hidden></div>'+
  '<div class="gt-font-controls"><button type="button" data-edit-font="'+esc(font._id)+'">名稱／分類</button><button type="button" data-test-font="'+esc(font._id)+'">測試預覽</button>'+
  '<button type="button" class="gt-font-delete" data-delete-font="'+esc(font._id)+'" '+(deleting?'disabled':'')+'>刪除字型</button></div></div>';
}
function renderList(){
 const filter=search.toLocaleLowerCase();
 const matches=fonts.filter(x=>(categoryFilter==='all'||(x.category||'uncategorized')===categoryFilter)&&(x.name+' '+(x.originalName||'')).toLocaleLowerCase().includes(filter));
 const subset=matches.slice(0,visibleCount);
 $(ids.count).textContent=matches.length+' 款符合 / 字型庫 '+fonts.length+' / '+limit+' 款';
 $(ids.list).innerHTML=subset.map(rowMarkup).join('')+(matches.length>visibleCount?
  '<button type="button" id="gt-font-show-more" style="width:100%;margin-top:12px">顯示更多（剩餘 '+(matches.length-visibleCount)+' 款）</button>':
  (!matches.length?'<p class="muted">目前沒有符合的字型。可以上傳自己的字型檔案。</p>':''));
 // Only visible cards fetch font bytes, so even large type libraries stay responsive.
 if(activeObserver)activeObserver.disconnect();
 activeObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   activeObserver?.unobserve(entry.target);
   const f=fontById(entry.target.dataset.fontId);
   if(f)loadRowSample(f,entry.target);
  }
 },{root:$(ids.list),rootMargin:'160px 0px'});
 $(ids.list).querySelectorAll('[data-font-id]').forEach(el=>activeObserver.observe(el));
}
async function loadRowSample(font,element){
 const target=element||$(ids.list).querySelector('[data-font-id="'+font._id+'"]');
 if(!target)return;
 const sample=target.querySelector('.gt-font-row-sample'),note=target.querySelector('.gt-font-row-error');
 if(!sample||!note)return;
 note.hidden=true;note.textContent='';
 try{
  const family=await window.GTFontPreview.ensureFont(font);
  if(sample.isConnected){sample.style.fontFamily='"'+family+'",Arial,"Noto Sans TC",sans-serif'}
 }catch(error){
  if(!note.isConnected)return;
  note.hidden=false;
  note.textContent='字型預覽失敗：'+(error?.message||'無法讀取字型')+'。可以點「測試預覽」重試。';
 }
}
function render(){
 renderRoleSelections();renderList();refreshPreviewLink();buttons();
}
async function upload(){
 if(uploading||loading)return;
 const files=Array.from($(ids.files).files||[]);
 if(!files.length)return;
 if(!$(ids.license).checked){stateMessage('請先確認字型具備網頁嵌入授權。',true);return}
 if(files.length>30){stateMessage('為避免大量上傳中途失敗，每次最多選 30 個檔案。可分批上傳。',true);return}
 uploading=true;buttons();
 let done=0;const errors=[];
 for(let i=0;i<files.length;i++){
  const file=files[i];
  $(ids.progress).textContent='上傳中 '+(i+1)+' / '+files.length+'：'+file.name+'\n已完成 '+done+' 款，失敗 '+errors.length+' 款';
  if(!/\.(woff2?|otf|ttf)$/i.test(file.name)||file.size>9_000_000||file.size<16){
   errors.push(file.name+'：格式不支援或超過單檔 9 MB');continue;
  }
  try{
   const form=new FormData();form.append('font',file,file.name);
   form.append('licensed','true');
   form.append('name',file.name.replace(/\.(woff2?|otf|ttf)$/i,'').replace(/[_-]+/g,' ').slice(0,80));
   const response=await api('/api/editor/font-library',{method:'POST',body:form});
   if(response.font&&validFont(response.font))fonts.push(response.font);
   done++;
  }catch(error){errors.push(file.name+'：'+error.message)}
 }
 $(ids.files).value='';
 uploading=false;buttons();
 const label=done+' 款字型上傳成功'+(errors.length?'，'+errors.length+' 款失敗':'')+'。';
 $(ids.progress).textContent=label+(errors.length?'\n'+errors.slice(0,8).join('\n'):'');
 try{await fetchLibrary();render()}catch(error){stateMessage('上傳後重新讀取失敗：'+error.message,true);return}
 stateMessage(errors.length?label+'\n'+errors.slice(0,6).join('\n'):label,!done);
}
function beginFontEdit(id){
 const font=fontById(id);if(!font||editingBusy)return;
 editingFont=id;
 const panel=document.getElementById('gt-font-edit-panel');
 if(!panel)return;
 document.getElementById('gt-font-edit-name').value=font.name;
 document.getElementById('gt-font-edit-category').value=CATEGORIES[font.category]?font.category:'uncategorized';
 document.getElementById('gt-font-edit-title').textContent='編輯字型：'+font.name;
 panel.hidden=false;panel.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function saveFontMetadata(){
 const font=fontById(editingFont);if(!font||editingBusy)return;
 const name=document.getElementById('gt-font-edit-name').value.trim();
 const category=document.getElementById('gt-font-edit-category').value;
 if(!name||name.length>80){stateMessage('字型名稱請輸入 1–80 個字。',true);return}
 editingBusy=true;document.getElementById('gt-font-edit-save').disabled=true;
 try{
  const data=await api('/api/editor/font-metadata',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:font._id,revision:font._rev,name,category})});
  font.name=data.font.name;font.category=data.font.category;font._rev=data.font._rev;
  document.getElementById('gt-font-edit-panel').hidden=true;editingFont=null;
  render();stateMessage('字型名稱與分類已更新，不會影響正在使用的字型檔。');
 }catch(error){stateMessage('字型資料更新失敗：'+error.message,true)}
 finally{editingBusy=false;document.getElementById('gt-font-edit-save').disabled=false}
}
async function removeFont(id){
 if(deleting||uploading||saving||loading)return;
 const font=fontById(id);if(!font)return;
 if(Object.values(roles).includes(id)){
  stateMessage('「'+font.name+'」目前被標題／內文／導覽選用。請先取消套用並儲存草稿，再刪除。',true);return;
 }
 if(!confirm('確定從字型庫移除「'+font.name+'」？這不會更動正式網站，但從字型庫移除後需要重新上傳才能使用。'))return;
 deleting=true;buttons();stateMessage('正在移除字型：'+font.name);
 try{
  const data=await api('/api/editor/delete-font',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,confirmation:'DELETE'})});
  await fetchLibrary();render();
  stateMessage('已從字型庫移除「'+font.name+'」。字型檔案仍保留在雲端儲存空間，可避免誤刪其他資料。');
 }catch(error){stateMessage('刪除失敗：'+error.message,true)}
 finally{deleting=false;buttons()}
}
async function save(){
 if(saving||uploading||!loaded||!available())return;
 saving=true;buttons();stateMessage('正在儲存字型配置草稿…');
 try{
  const data=await api('/api/editor/font-settings',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({roles,revision})
  });
  roles=window.GTFontPreview.normalise(data.roles);saved={...roles};revision=data.revision||'';
  stateMessage('字型配置已儲存為雲端草稿，沒有更改公開網站。');
 }catch(error){stateMessage('草稿儲存失敗：'+error.message,true)}
 finally{saving=false;buttons()}
}
async function publish(){
 if(saving||uploading||deleting||loading||!loaded||!revision||isDirty())return;
 if(!confirm('確定把目前儲存的字型配置發布到 GOOD THINGS, 正式網站？請先確認每款字型允許公開網頁嵌入。'))return;
 saving=true;buttons();stateMessage('正在正式發布字型配置…');
 try{
  await api('/api/editor/publish-font-settings',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({revision,confirmation:'PUBLISH'})
  });
  saving=false;
  await refresh();
  stateMessage('字型配置已正式發布。公開網站重新載入後會使用這組字型；字型檔載入失敗時保留原本字體。');
 }catch(error){stateMessage('字型發布失敗：'+error.message,true)}
 finally{saving=false;buttons()}
}
if(location.hostname!==HOST||!window.GTFontPreview){
 stateMessage('請使用受保護的編輯器網址開啟字型庫。',true);
 $('gt-font-upload').disabled=true;$('gt-font-save').disabled=true;return;
}
$('gt-font-test-line').addEventListener('input',updateTestSamples);
document.getElementById('gt-font-category-filter')?.addEventListener('change',e=>{categoryFilter=e.target.value;visibleCount=35;renderList()});
document.getElementById('gt-font-edit-save')?.addEventListener('click',saveFontMetadata);
document.getElementById('gt-font-edit-cancel')?.addEventListener('click',()=>{editingFont=null;document.getElementById('gt-font-edit-panel').hidden=true});
$('gt-font-search').addEventListener('input',e=>{search=e.target.value;visibleCount=35;renderList()});
// Event delegation for controls added dynamically
$(ids.list).addEventListener('click',e=>{if(e.target.closest('#gt-font-show-more')){visibleCount+=35;renderList();return}const edit=e.target.closest('[data-edit-font]');if(edit){beginFontEdit(edit.dataset.editFont);return}const test=e.target.closest('[data-test-font]');if(test){const font=fontById(test.dataset.testFont);if(font)loadRowSample(font,test.closest('[data-font-id]'));return}const btn=e.target.closest('[data-delete-font]');if(btn)removeFont(btn.dataset.deleteFont)});
for(const role of ROLES){
 $('gt-font-'+role).addEventListener('change',e=>{
  roles[role]=e.target.value;buttons();applyPreview().catch(error=>stateMessage(error.message,true));
  stateMessage('字型已套用在預覽，請儲存草稿以保留選擇。');
 });
}
$(ids.files).addEventListener('change',buttons);
$(ids.license).addEventListener('change',buttons);
$(ids.upload).addEventListener('click',upload);
$('gt-font-reload').addEventListener('click',refresh);
$(ids.save).addEventListener('click',save);
$(ids.publish).addEventListener('click',publish);
// Independent local font test: never uploads, stores or transmits selected file.
let localFontFace=null;
let localTestSequence=0;
const localFile=document.getElementById('gt-font-local-file');
localFile?.addEventListener('change',async event=>{
 const seq=++localTestSequence;
 const file=event.target.files?.[0];
 const status=document.getElementById('gt-font-local-status');
 const preview=document.getElementById('gt-font-local-sample');
 if(!status||!preview)return;
 preview.hidden=true;
 if(localFontFace){document.fonts.delete(localFontFace);localFontFace=null}
 if(!file){status.textContent='請選擇一個要檢查的字型檔案。';return}
 status.textContent='正在直接讀取本機檔案：'+file.name+'。檔案不會上傳。';
 const ext=/\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
 const expected={woff2:'wOF2',woff:'wOFF',otf:'OTTO',ttf:'\x00\x01\x00\x00'};
 if(!Object.hasOwn(expected,ext)){
  status.textContent='本機測試不支援此格式。請選用 TTF、OTF、WOFF 或 WOFF2。';return;
 }
 try{
  const buffer=await file.arrayBuffer();
  if(buffer.byteLength<16)throw Error('檔案資料不足，可能不完整。');
  const magic=String.fromCharCode(...new Uint8Array(buffer).slice(0,4));
  if(magic!==expected[ext])throw Error('字型檔開頭與副檔名不符，請確認檔案格式。');
  const face=new FontFace('GTLocalFontDiagnostic',buffer,{style:'normal',weight:'400'});
  await face.load();
  if(seq!==localTestSequence)return;
  document.fonts.add(face);localFontFace=face;
  preview.style.fontFamily='"GTLocalFontDiagnostic",Arial,"Noto Sans TC",sans-serif';
  preview.hidden=false;
  status.textContent='本機載入成功：'+file.name+'。字型本身可被這個瀏覽器解析；若字型庫仍失敗，應優先檢查雲端讀取服務。注意：如果字型不含中文，中文仍會自動顯示備援字型。';
 }catch(error){
  if(seq!==localTestSequence)return;
  status.textContent='本機載入失敗：'+(error?.message||String(error))+'。這時才比較可能是字型格式、檔案損壞或瀏覽器不支援。';
 }
});
updateTestSamples();
refresh();
})();