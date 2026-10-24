/* GOOD THINGS, admin-only licensed font catalog. No frontend publishing. */
(()=>{
'use strict';
const HOST='feature-secure-editor-cloud.forme-archive.pages.dev';
const ids={list:'gt-font-list',count:'gt-font-count',upload:'gt-font-upload',files:'gt-font-files',license:'gt-font-license',progress:'gt-font-progress',save:'gt-font-save',status:'gt-font-status'};
const $=id=>document.getElementById(id);
const ROLES=['headlines','body','navigation'];
const initial={headlines:'',body:'',navigation:''};
let fonts=[],roles={...initial},saved={...initial},revision='',loading=false,saving=false,uploading=false,deleting=false,loaded=false,limit=150,visibleCount=35,search='',previewCounter=0;
let activeObserver=null;
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
  revision=String(settings.revision||'');saved={...roles};loaded=true;
  render();
  await applyPreview();
  stateMessage('字型庫已載入。所有套用設定都停留在預覽／草稿，尚未公開。');
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
  '<div class="gt-font-row-meta">'+esc(font.originalName||font.name)+'</div>'+
  '<div class="gt-font-row-error" role="status" aria-live="polite" hidden></div>'+
  '<div class="gt-font-controls"><button type="button" data-test-font="'+esc(font._id)+'">測試預覽</button>'+
  '<button type="button" class="gt-font-delete" data-delete-font="'+esc(font._id)+'" '+(deleting?'disabled':'')+'>刪除字型</button></div></div>';
}
function renderList(){
 const filter=search.toLocaleLowerCase();
 const matches=fonts.filter(x=>(x.name+' '+(x.originalName||'')).toLocaleLowerCase().includes(filter));
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
if(location.hostname!==HOST||!window.GTFontPreview){
 stateMessage('請使用受保護的編輯器網址開啟字型庫。',true);
 $('gt-font-upload').disabled=true;$('gt-font-save').disabled=true;return;
}
$('gt-font-test-line').addEventListener('input',updateTestSamples);
$('gt-font-search').addEventListener('input',e=>{search=e.target.value;visibleCount=35;renderList()});
// Event delegation for controls added dynamically
$(ids.list).addEventListener('click',e=>{if(e.target.closest('#gt-font-show-more')){visibleCount+=35;renderList();return}const test=e.target.closest('[data-test-font]');if(test){const font=fontById(test.dataset.testFont);if(font)loadRowSample(font,test.closest('[data-font-id]'));return}const btn=e.target.closest('[data-delete-font]');if(btn)removeFont(btn.dataset.deleteFont)});
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
updateTestSamples();
refresh();
})();