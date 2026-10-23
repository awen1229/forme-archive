/* GOOD THINGS, cloud articles (preview only). No API secrets in the browser. */
(()=>{
const isEditorPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
let cloudRows=[],cloudRevision='',cloudError='',cloudLoading=false;
const api=async(path,opts={})=>{
 const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});
 let data={};try{data=await r.json()}catch{}
 if(!r.ok||!data.ok)throw Error(data.error||'HTTP '+r.status);
 return data;
};
const cloudPanel=()=>document.getElementById('gt-cloud-article-panel');
const draw=()=>{
 const el=cloudPanel();if(!el)return;
 el.innerHTML='<div class="kicker">CLOUD / SANITY</div><h3 style="margin:8px 0">雲端文章與專訪</h3><p class="muted">儲存會建立未發布草稿，公開前須再次確認。</p><button type="button" data-gt-a="refresh">重新讀取雲端文章</button>'+
 (cloudError?'<p role="alert">'+esc(cloudError)+'</p>':'')+
 (cloudLoading?'<p class="muted">正在讀取…</p>':'')+
 cloudRows.map(a=>'<div class="editor-list-item"><div><div class="editor-badge">'+(a.status==='draft'?'雲端草稿':'已發布')+'</div><strong>'+esc(a.title)+'</strong></div><div class="gt-record-buttons"><button type="button" data-gt-a="edit" data-slug="'+esc(a.slug)+'">載入編輯</button>'+(a.status==='draft'?'<button type="button" data-gt-a="publish" data-slug="'+esc(a.slug)+'">確認發布</button>':'')+'</div></div>').join('');
};
const refresh=async()=>{
 cloudLoading=true;cloudError='';draw();
 try{cloudRows=(await api('/api/editor/articles')).records||[]}
 catch(e){cloudError=e.message}
 finally{cloudLoading=false;draw()}
};
const load=async(slug)=>{
 try{
  const j=await api('/api/editor/article?slug='+encodeURIComponent(slug));
  editorKind='article';editingId=slug;cloudRevision=j.record.revision||'';
  fillEditor(j.record);
  document.getElementById('editor-form')?.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){alert('無法載入雲端文章：'+e.message)}
};
const publish=async(slug)=>{
 const a=cloudRows.find(x=>x.slug===slug);
 if(!a||a.status!=='draft'||!a.revision)return alert('請重新讀取雲端草稿');
 if(/\btest\b|測試/i.test(a.title))return alert('測試文章不可發布');
 if(!confirm('確定公開發布「'+a.title+'」？'))return;
 if(prompt('請輸入 PUBLISH 以確認公開')!=='PUBLISH')return;
 try{
  await api('/api/editor/publish-article',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,revision:a.revision,confirmation:'PUBLISH'})});
  alert('已在 Sanity 公開發布');await refresh();loadPublished();
 }catch(e){alert('文章發布失敗：'+e.message)}
};
const loadPublished=async()=>{
 const q='*[_type=="article"&&!(_id in path("drafts.**"))]{title,slug,brand,subject,category,publishedAt,createdAt,updatedAt,excerpt,body,source,sourceTitle,publisher,sourceAuthor,sourceDate,reviewedAt,"cover":cover.asset->url}';
 try{
  const r=await fetch('https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(q));
  if(!r.ok)return;
  const data=await r.json();
  gtSanityPublishedArticleSlugs.clear();
  gtPublishedArticleRecords.clear();
  for(const original of gtOriginalArticles)gtPublishedArticleRecords.set(original.slug,original);
  for(const d of data.result||[]){
   if(!d?.title||!d.slug?.current)continue;
   const a={...d,slug:d.slug.current,body:Array.isArray(d.body)?d.body:[]};
   gtPublishedArticleRecords.set(a.slug,a);
   gtSanityPublishedArticleSlugs.add(a.slug);
   if(localArticles.some(x=>x.slug===a.slug))continue;
   const i=articles.findIndex(x=>x.slug===a.slug);
   if(i<0)articles.push(a);else articles[i]={...articles[i],...a};
  }
  // Rebuild featured slide cards after published articles have arrived.
  if(typeof gtResolvedSlides==='function')gtSlides=gtResolvedSlides();
  if(!location.hash.includes('/admin'))render();
 }catch(e){console.info('Published articles unavailable',e.message)}
};
if(isEditorPreview){
const originalRender=render;
render=function(...args){
 const result=originalRender(...args);
 if(location.hash.includes('/admin')&&editorKind==='article'){
  const tabs=document.querySelector('.editor-tabs');
  if(tabs){const panel=document.createElement('div');panel.id='gt-cloud-article-panel';panel.className='editor-card';panel.style.margin='24px 0';tabs.insertAdjacentElement('afterend',panel);draw()}
 }
 return result;
};
const originalSave=saveEditor;
saveEditor=async function(...args){
 if(editorKind!=='article')return originalSave(...args);
 if(!fval('title')||!fval('excerpt')||!fval('body'))return alert('請填寫標題、摘要與正文');
 const local=localArticles.find(x=>x.slug===editingId);
 const slug=editingId||'entry-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
 const a={
  slug,title:fval('title'),brand:fval('brand'),subject:fval('subject'),category:fval('category'),
  publishedAt:fval('publishedAt'),createdAt:local?.createdAt||new Date().toISOString(),
  excerpt:fval('excerpt'),body:fval('body').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),
  source:fval('source'),sourceTitle:fval('sourceTitle'),publisher:fval('publisher'),
  sourceAuthor:fval('sourceAuthor'),sourceDate:fval('sourceDate'),cover:editorCover,revision:cloudRevision
 };
 try{
  const saved=await api('/api/editor/article',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});
  cloudRevision=saved.revision||'';
  if(saved.coverUrl)editorCover=saved.coverUrl;
 }catch(e){return alert('文章雲端儲存失敗：'+e.message+'\n沒有修改公開網站，也沒有宣告儲存成功。')}
 editingId=slug;
 await originalSave(...args);
 // The legacy interface can display a local-only message. Correct it after cloud success.
 const banner=document.querySelector('[role="status"]');
 if(banner&&banner.textContent.includes('資料仍只在這台裝置'))banner.textContent='已儲存 Sanity 文章雲端草稿，並保留本機副本，尚未公開。';
 cloudRevision='';
 await refresh();
};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-gt-a]');
 if(b){e.preventDefault();e.stopImmediatePropagation();
  if(b.dataset.gtA==='refresh')refresh();
  if(b.dataset.gtA==='edit')load(b.dataset.slug);
  if(b.dataset.gtA==='publish')publish(b.dataset.slug);
 }
 const t=e.target.closest('[data-kind]');
 if(t?.dataset.kind==='article'){cloudRevision='';setTimeout(refresh,0)}
 const edit=e.target.closest('[data-edit]');
 if(edit&&editorKind==='article')cloudRevision='';
},true);
if(location.hash.includes('/admin')){render();if(editorKind==='article')refresh()}
}
loadPublished();
})();