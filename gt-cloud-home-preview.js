/* GOOD THINGS, homepage cloud editor. Runs only on the protected Pages Preview. */
(()=>{
if(typeof gtHomeWorkingCopy!=='function')return;
const isEditorPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
let loaded=false,loading=false,draft=null,published=null,error='',previewDraft=false;
const api=async(url,options={})=>{
 const resp=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 let body={};try{body=await resp.json()}catch{}
 if(!resp.ok||!body.ok)throw Error(body.error||'HTTP '+resp.status);
 return body;
};
const panel=()=>document.getElementById('gt-home-cloud-panel');
const sanitise=d=>Array.isArray(d?.slides)?d.slides.map(s=>({slug:s.slug,title:s.title||'',excerpt:s.excerpt||'',cover:s.cover||'',coverFit:s.coverFit||'cover',coverX:s.coverX??50,coverY:s.coverY??50})):[];
function inject(){
 if(!location.hash.includes('/admin')||editorKind!=='home')return;
 const tabs=document.querySelector('.editor-tabs');
 if(!tabs||panel())return;
 const el=document.createElement('section');
 el.id='gt-home-cloud-panel';el.className='editor-card';el.style.margin='24px 0';
 tabs.insertAdjacentElement('afterend',el);
 const save=document.getElementById('gt-home-save');
 if(save)save.textContent='儲存 Sanity 雲端草稿';
 const note=document.querySelector('.editor-notice');
 if(note)note.innerHTML='<b>GOOD THINGS, 雲端首頁管理</b>：儲存到 Sanity 草稿後不會公開。可以在目前裝置預覽；正式發布須另外確認。';
 draw();
}
function draw(){
 const el=panel();if(!el)return;
 el.innerHTML='<div class="kicker">CLOUD / SANITY</div><h3 style="margin:8px 0">首頁精選雲端管理</h3>'+
 '<p class="muted">雲端草稿與已發布版本獨立保存。從雲端載入時會替換下方未儲存的編輯內容。</p>'+
 '<div class="gt-record-buttons" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+
 '<button type="button" data-gt-home="refresh">重新讀取雲端</button>'+
 (draft?'<button type="button" data-gt-home="load">載入草稿編輯</button>':'')+
 (published?'<button type="button" data-gt-home="published">載入已發布版本</button>':'')+
 (draft?'<button type="button" data-gt-home="publish">確認發布</button>':'')+
 '</div>'+
 (loading?'<p class="muted">正在讀取雲端…</p>':'')+
 (error?'<p role="alert" style="color:#a43d35">'+esc(error)+'</p>':'')+
 '<p class="muted">'+(draft?'雲端草稿：'+esc(draft.slides.length)+' 篇':'尚無雲端草稿')+' ／ '+(published?'已發布：'+esc(published.slides.length)+' 篇':'尚無已發布首頁版本')+'</p>'+
 (previewDraft?'<p class="muted"><strong>目前是本機草稿預覽，尚未公開。</strong></p>':'');
}
async function refresh(){
 loading=true;error='';inject();draw();
 try{const result=await api('/api/editor/home');loaded=true;draft=result.draft;published=result.published}
 catch(e){error=e.message}
 finally{loading=false;draw()}
}
function loadDoc(doc,label){
 if(!doc||!Array.isArray(doc.slides))return;
 if(!confirm('將「'+label+'」載入首頁編輯器？下方尚未儲存的修改將被替換。'))return;
 gtHomeDraft=sanitise(doc);
 render();draw();
}
function preview(){
 // Browser draft preview remains inside the editor, never enters public pages.
 gtHomeConfig={slides:gtHomeDraft.map(v=>({...v}))};
 previewDraft=true;
 render();draw();
}
async function saveDraft(){
 if(!loaded)return alert('請先讀取雲端首頁資料再儲存');
 const chosen=gtHomeDraft.map(v=>({slug:v.slug,title:String(v.title||'').trim(),excerpt:String(v.excerpt||'').trim(),cover:v.cover||'',coverFit:v.coverFit||'cover',coverX:v.coverX??50,coverY:v.coverY??50}));
 if(!chosen.length||chosen.length>5||chosen.some(v=>!articles.some(a=>a.slug===v.slug)))return alert('精選中有無效或尚未選擇的文章');
 if(new Set(chosen.map(v=>v.slug)).size!==chosen.length)return alert('精選文章不可重複');
 const revision=draft?.revision||published?.revision||'';
 try{
  const result=await api('/api/editor/home',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slides:chosen,revision})});
  draft=result.draft;
  gtHomeDraft=sanitise(draft);
  preview();
  alert('首頁精選已儲存到 Sanity 雲端草稿，尚未公開。此裝置已切換為草稿預覽。');
 }catch(e){alert('首頁雲端儲存失敗：'+e.message)}
}
async function publish(){
 if(!draft?.revision)return alert('請先讀取最新的首頁雲端草稿');
 if(!confirm('即將正式發布這 '+draft.slides.length+' 篇首頁精選，確定嗎？'))return;
 if(prompt('請輸入 PUBLISH 確認公開首頁精選')!=='PUBLISH')return;
 try{
  await api('/api/editor/publish-home',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:draft.revision,confirmation:'PUBLISH'})});
  previewDraft=false;
  await refresh();
  await loadPublished();
  alert('首頁精選已在 Sanity 發布。');
 }catch(e){alert('首頁發布失敗：'+e.message)}
}
async function loadPublished(){
 const isPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
 const q='*[_id=="gt-homepage"][0]{slides}';
 const url=isPreview?'/api/public/home':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(q);
 try{
  const resp=await fetch(url,{cache:'no-store',credentials:isPreview?'same-origin':'omit'});
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const body=await resp.json();
  if(isPreview&&!body.ok)throw Error('首頁公開資料服務異常');
  const slides=isPreview?body.slides:body.result?.slides;
  if(!Array.isArray(slides))throw Error('首頁資料格式不正確');
  gtPublishedHomeConfig={slides:slides.map(s=>({slug:s.slug,title:s.title||'',excerpt:s.excerpt||'',cover:s.coverUrl||s.cover||'',coverFit:s.coverFit||'cover',coverX:s.coverX??50,coverY:s.coverY??50}))};
  if(typeof gtPublicHomeLoadState!=='undefined')gtPublicHomeLoadState='ready';
  if(!previewDraft){gtSlides=gtResolvedSlides();if(!location.hash.includes('/admin'))render()}
 }catch(e){
  if(typeof gtPublicHomeLoadState!=='undefined')gtPublicHomeLoadState='error';
  console.warn('首頁精選讀取失敗',e.message);
  if(!location.hash.includes('/admin'))render();
 }
}
if(isEditorPreview){
const renderOld=render;
render=function(...args){const result=renderOld(...args);inject();return result};
document.addEventListener('click',e=>{
 const action=e.target.closest('[data-gt-home]');
 if(action){
  e.preventDefault();e.stopImmediatePropagation();
  if(action.dataset.gtHome==='refresh')refresh();
  if(action.dataset.gtHome==='load')loadDoc(draft,'雲端草稿');
  if(action.dataset.gtHome==='published')loadDoc(published,'已發布版本');
  if(action.dataset.gtHome==='publish')publish();
  return;
 }
 if(e.target.closest('#gt-home-save')){
  e.preventDefault();e.stopImmediatePropagation();saveDraft();return;
 }
 const tab=e.target.closest('[data-kind]');
 if(tab?.dataset.kind==='home'){
  setTimeout(()=>{inject();refresh()},0);
 }
},true);
if(location.hash.includes('/admin')&&editorKind==='home'){render();refresh()}
}
loadPublished();
})();
