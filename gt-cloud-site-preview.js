/* GOOD THINGS, cloud SITE CONTENT. Preview only. */
(()=>{
 const isEditorPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
 let loaded=false,draft=null,published=null,error='',saving=false,publishing=false,actionNote='';
 const api=async(path,opt={})=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opt});let j={};try{j=await r.json()}catch{}if(!r.ok||!j.ok)throw Error(j.error||'HTTP '+r.status);return j};
 const panel=()=>document.getElementById('gt-site-cloud');
 function draw(){
  const el=panel();if(!el)return;
  el.innerHTML='<div class="kicker">CLOUD / SANITY</div><h3>網站文字雲端管理</h3><p class="muted">儲存只建立未發布草稿，公開前必須再次確認。</p><div class="gt-record-buttons" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-gt-site="read" '+(saving||publishing?'disabled':'')+'>重新讀取雲端</button>'+(draft?'<button type="button" data-gt-site="draft">載入草稿</button>':'')+(published?'<button type="button" data-gt-site="published">載入已發布</button>':'')+(draft?'<button type="button" data-gt-site="publish" '+(saving||publishing?'disabled':'')+'>確認發布</button>':'')+'</div><p class="muted">'+(draft?'草稿已儲存':'尚無雲端草稿')+' / '+(published?'已有發布版本':'尚無發布版本')+'</p>'+(error?'<p role="alert" style="color:#a43d35">'+esc(error)+'</p>':'')+(actionNote?'<p role="status" class="cms-hint">'+esc(actionNote)+'</p>':'');
 }
 function inject(){
  if(editorKind!=='site'||!location.hash.includes('/admin'))return;
  const tabs=document.querySelector('.editor-tabs');if(!tabs||panel())return;
  const el=document.createElement('div');el.id='gt-site-cloud';el.className='editor-card';el.style.margin='24px 0';tabs.insertAdjacentElement('afterend',el);
  const save=document.getElementById('gt-site-save');if(save)save.textContent='儲存 Sanity 雲端草稿';
  const notice=document.querySelector('.editor-notice');if(notice)notice.innerHTML='<b>SITE CONTENT / CLOUD EDITOR</b>：可跨裝置儲存與載入文字草稿。只有手動發布才會公開。';
  draw();
 }
 async function read(){if(saving)return;error='';try{const d=await api('/api/editor/site-content');draft=d.draft;published=d.published;loaded=true}catch(e){error=e.message}draw()}
 function load(doc){
  if(!doc)return;
  if(!confirm('載入雲端內容會取代目前尚未儲存的編輯欄位，確定嗎？'))return;
  gtSiteDraft={...doc.fields};render();draw();
 }
 async function save(){
  if(saving||publishing)return;
  if(!loaded)return alert('請先按「重新讀取雲端」');
  saving=true;actionNote='正在儲存網站文字…';draw();
  try{
   const revision=draft?.revision||published?.revision||'';
   const j=await api('/api/editor/site-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:gtSiteDraft,revision})});
   draft=j.draft;gtSiteDraft={...draft.fields};
   actionNote='網站文字已儲存雲端草稿，尚未公開。';draw();
  }catch(e){actionNote='雲端儲存失敗：'+e.message+'。編輯內容仍保留在目前頁面。';draw()}
  finally{saving=false;draw()}
 }
 async function publish(){
  if(saving||publishing)return;
  if(!draft?.revision)return alert('請先重新讀取草稿');
  const normalized=o=>JSON.stringify(Object.entries(o||{}).sort(([a],[b])=>a.localeCompare(b)));
  if(normalized(gtSiteDraft)!==normalized(draft.fields))return alert('網站文字有尚未儲存的修改，請先儲存雲端草稿，或載入最新草稿。');
  if(!confirm('要公開發布網站文字嗎？'))return;
  publishing=true;actionNote='正在發布網站文字…';draw();
  try{
   await api('/api/editor/publish-site-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:draft.revision,confirmation:'PUBLISH'})});
   await read();await loadPublished();actionNote='網站文字已正式發布。';
  }catch(e){actionNote='發布失敗：'+e.message;error=e.message}
  finally{publishing=false;draw()}
 }
 async function loadPublished(){
  const isPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
  const q='*[_id=="gt-site-content"][0]{fieldsJson}';
  const url=isPreview?'/api/public/site-content':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(q);
  try{
   const r=await fetch(url,{cache:'no-store',credentials:isPreview?'same-origin':'omit'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const j=await r.json();
   if(isPreview&&!j.ok)throw Error('網站文字服務異常');
   const fieldsJson=isPreview?j.fieldsJson:j.result?.fieldsJson;
   if(fieldsJson==null)return;
   if(typeof fieldsJson!=='string')throw Error('已發布文字資料格式不正確');
   const fields=JSON.parse(fieldsJson);
   if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('已發布文字格式無效');
   gtPublishedSiteContent=Object.fromEntries(Object.entries(fields).filter(([key,val])=>Object.hasOwn(gtSiteDefaults,key)&&typeof val==='string'));
   gtSiteContent={...gtPublishedSiteContent};
   if(editorKind!=='site')gtSiteDraft={...gtSiteContent};
   if(!location.hash.includes('/admin'))render();
  }catch(e){console.warn('網站文字已發布資料讀取失敗',e.message)}
 }
if(isEditorPreview){
 const prev=render;
 render=function(...args){const result=prev(...args);inject();return result};
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-gt-site]');
  if(b){e.preventDefault();e.stopImmediatePropagation();if(b.dataset.gtSite==='read')read();else if(b.dataset.gtSite==='draft')load(draft);else if(b.dataset.gtSite==='published')load(published);else if(b.dataset.gtSite==='publish')publish();return}
  if(e.target.closest('#gt-site-save')){e.preventDefault();e.stopImmediatePropagation();save();return}
  const tab=e.target.closest('[data-kind]');if(tab?.dataset.kind==='site')setTimeout(read,0);
 },true);
 if(location.hash.includes('/admin')&&editorKind==='site'){render();read()}
}
 loadPublished();
})();