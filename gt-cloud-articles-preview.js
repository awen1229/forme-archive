/* GOOD THINGS, cloud articles (preview only). No API secrets in the browser. */
(()=>{
const isEditorPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
let cloudRows=[],cloudRevision='',cloudError='',cloudLoading=false;
const gtArticleFilters={search:'',status:'all',subject:'all',brand:'all',category:'all',sort:'updated',page:1};
const gtArticlePageSize=12;
const gtText=v=>String(v??'');
const gtDistinct=(name)=>[...new Set(cloudRows.map(x=>gtText(x[name]).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
const gtArticleSubjectNames={clothing:'CLOTHING',style:'STYLE',people:'PEOPLE',places:'PLACES',objects:'OBJECTS',notes:'NOTES'};
const gtArticleSelect=(name,items,label)=>{
 const opts=items.map(([v,t])=>'<option value="'+esc(v)+'" '+(gtArticleFilters[name]===v?'selected':'')+'>'+esc(t)+'</option>').join('');
 return '<label>'+esc(label)+'<select data-gt-filter="'+name+'">'+opts+'</select></label>';
};
const gtArticleMatches=()=>{
 const q=gtArticleFilters.search.trim().toLocaleLowerCase();
 return cloudRows.filter(a=>{
  const subjects=new Set([gtText(a.subject),...(Array.isArray(a.subjects)?a.subjects:[])]);
  if(gtArticleFilters.status!=='all'&&a.status!==gtArticleFilters.status)return false;
  if(gtArticleFilters.subject!=='all'&&!subjects.has(gtArticleFilters.subject))return false;
  if(gtArticleFilters.brand!=='all'&&a.brand!==gtArticleFilters.brand)return false;
  if(gtArticleFilters.category!=='all'&&a.category!==gtArticleFilters.category)return false;
  return !q||[a.title,a.brand,a.slug,a.category,a.excerpt,...subjects].some(v=>gtText(v).toLocaleLowerCase().includes(q));
 }).sort((a,b)=>{
  if(gtArticleFilters.sort==='title')return gtText(a.title).localeCompare(gtText(b.title),'zh-Hant');
  if(gtArticleFilters.sort==='published')return gtText(b.publishedAt).localeCompare(gtText(a.publishedAt))||gtText(b.updatedAt).localeCompare(gtText(a.updatedAt));
  return gtText(b.updatedAt).localeCompare(gtText(a.updatedAt));
 });
};
const gtArticleDrawList=()=>{
 const zone=document.getElementById('gt-cloud-article-results');if(!zone)return;
 const found=gtArticleMatches();
 const totalPages=Math.max(1,Math.ceil(found.length/gtArticlePageSize));
 gtArticleFilters.page=Math.max(1,Math.min(totalPages,gtArticleFilters.page));
 const start=(gtArticleFilters.page-1)*gtArticlePageSize;
 const pages=found.slice(start,start+gtArticlePageSize);
 const count=cloudRows.length;
 zone.innerHTML='<div class="gt-article-count" role="status">符合 '+found.length+' 篇 ／ 雲端共 '+count+' 篇（已發布 '+cloudRows.filter(a=>a.hasPublished).length+'，待發布草稿 '+cloudRows.filter(a=>a.status==='draft').length+'）</div>'+
 (pages.map(a=>'<div class="editor-list-item gt-article-catalog-row"><div><div class="editor-badge">'+(a.status==='draft'?'雲端草稿':'已發布')+'</div><strong>'+esc(a.title)+'</strong><small>'+esc([a.brand,gtArticleSubjectNames[a.subject]||a.subject,a.category,a.publishedAt].filter(Boolean).join(' / '))+'</small></div><div class="gt-record-buttons"><button type="button" data-gt-a="edit" data-slug="'+esc(a.slug)+'">載入編輯</button>'+(a.status==='draft'?'<button type="button" data-gt-a="publish" data-slug="'+esc(a.slug)+'">確認發布</button>':'')+'</div></div>').join('')||'<p class="muted">沒有符合條件的文章，可以調整搜尋或篩選。</p>')+
 '<div class="gt-article-pagination"><button type="button" data-gt-page="previous" '+(gtArticleFilters.page<=1?'disabled':'')+'>上一頁</button><span>第 '+gtArticleFilters.page+' / '+totalPages+' 頁</span><button type="button" data-gt-page="next" '+(gtArticleFilters.page>=totalPages?'disabled':'')+'>下一頁</button></div>';
};

const api=async(path,opts={})=>{
 const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});
 let data={};try{data=await r.json()}catch{}
 if(!r.ok||!data.ok)throw Error(data.error||'HTTP '+r.status);
 return data;
};
const cloudPanel=()=>document.getElementById('gt-cloud-article-panel');
const draw=()=>{
 const el=cloudPanel();if(!el)return;
 const subjects=[['all','所有主題'],...Object.entries(gtArticleSubjectNames).map(([v,n])=>[v,n])];
 const brands=[['all','所有品牌'],...gtDistinct('brand').map(v=>[v,v])];
 const categories=[['all','所有內容形式'],...gtDistinct('category').map(v=>[v,v])];
 el.innerHTML='<div class="kicker">CLOUD / SANITY</div><h3 style="margin:8px 0">文章資料庫 / ARTICLE LIBRARY</h3>'+
 '<p class="muted">統一管理全部文章。主題、品牌與內容形式都沿用現有資料，不必重複建立資料夾；同一篇文章可以出現在多個主題。</p>'+
 '<div class="gt-article-toolbar"><label class="gt-article-query">搜尋標題、關鍵字、品牌或摘要<input type="search" data-gt-filter="search" placeholder="例如 COMOLI、小森、日常服" value="'+esc(gtArticleFilters.search)+'"></label>'+
 gtArticleSelect('status',[['all','全部狀態'],['draft','待發布草稿'],['published','已發布']],'發布狀態')+
 gtArticleSelect('subject',subjects,'STORIES 主題')+
 gtArticleSelect('brand',brands,'相關品牌')+
 gtArticleSelect('category',categories,'內容形式')+
 gtArticleSelect('sort',[['updated','最近修改'],['published','發布日期'],['title','標題 A–Z']],'排序方式')+'</div>'+
 '<div class="gt-article-toolbar-actions"><button type="button" data-gt-a="refresh">重新讀取雲端文章</button><button type="button" data-gt-a="clear-filters">清除篩選</button></div>'+
 '<p class="cms-hint"><strong>儲存修改只更新草稿，不會改變公開網站。</strong> 檢查無誤後，需再次「確認發布」。</p>'+
 (cloudError?'<p role="alert">'+esc(cloudError)+'</p>':'')+
 (cloudLoading?'<p class="muted" role="status">正在讀取…</p>':'')+
 '<div id="gt-cloud-article-results"></div>';
 gtArticleDrawList();
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
let publicArticleStatus='loading';
const publicArticleNotice=()=>publicArticleStatus==='error'?'<div class="gt-empty" role="alert">已發布文章載入失敗，請重新整理頁面。</div>':publicArticleStatus==='loading'?'<div class="gt-empty" role="status">正在載入已發布文章…</div>':gtEmptyPublishedCopy;
window.gtPublishedArticleNotice=publicArticleNotice;
const loadPublished=async()=>{
 const isPreview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
 const q='*[_type=="article"&&!(_id in path("drafts.**"))]{title,slug,brand,subject,category,publicationSection,publishedAt,createdAt,updatedAt,subjects,excerpt,body,source,sourceTitle,publisher,sourceAuthor,sourceDate,reviewedAt,coverFit,coverMobileFit,coverMobileZoom,coverZoom,coverX,coverY,coverMobileX,coverMobileY,"cover":cover.asset->url}';
 const url=isPreview?'/api/public/articles':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(q);
 try{
  publicArticleStatus='loading';
  const r=await fetch(url,{cache:'no-store',credentials:isPreview?'same-origin':'omit'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json(),records=isPreview?data.records:data.result;
  if(isPreview&&!data.ok)throw Error('公開文章服務異常');
  if(!Array.isArray(records))throw Error('文章回傳格式錯誤');
  gtSanityPublishedArticleSlugs.clear();
  gtPublishedArticleRecords.clear();
  for(const original of gtOriginalArticles)gtPublishedArticleRecords.set(original.slug,original);
  for(const d of records){
   if(!d?.title||!d.slug?.current)continue;
   const a={...d,slug:d.slug.current,body:Array.isArray(d.body)?d.body:[]};
   gtPublishedArticleRecords.set(a.slug,a);gtSanityPublishedArticleSlugs.add(a.slug);
   if(localArticles.some(x=>x.slug===a.slug))continue;
   const i=articles.findIndex(x=>x.slug===a.slug);
   if(i<0)articles.push(a);else articles[i]={...articles[i],...a};
  }
  publicArticleStatus='ready';
  if(typeof gtResolvedSlides==='function')gtSlides=gtResolvedSlides();
 }catch(e){publicArticleStatus='error';console.warn('Published articles unavailable',e.message)}
 finally{if(!location.hash.includes('/admin'))render()}
};
if(isEditorPreview){
const gtCatalogStyle=document.createElement('style');
gtCatalogStyle.textContent=`
.gt-article-toolbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0 14px}
.gt-article-toolbar label{font-size:12px;color:#565b53;display:grid;gap:7px;min-width:0}
.gt-article-toolbar input,.gt-article-toolbar select{width:100%;min-width:0;background:#fff;border:1px solid #c6c9bd;border-radius:0;padding:11px 12px;color:#282e27}
.gt-article-toolbar .gt-article-query{grid-column:span 3}
.gt-article-toolbar-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.gt-article-count{font-size:12px;color:#5f685d;border-bottom:1px solid #c7ccc2;padding:12px 0}
.gt-article-catalog-row>div:first-child{min-width:0;flex:1}.gt-article-catalog-row strong{display:block;margin-top:7px;overflow-wrap:anywhere}.gt-article-catalog-row small{display:block;color:#686f65;font-size:11px;line-height:1.7;margin-top:6px}
.gt-article-pagination{display:flex;align-items:center;justify-content:center;gap:15px;margin-top:20px;font-size:12px}
.gt-article-pagination button:disabled{opacity:.4;cursor:default}
@media(max-width:700px){.gt-article-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.gt-article-toolbar .gt-article-query{grid-column:span 2}.gt-article-catalog-row{align-items:flex-start}.gt-article-catalog-row .gt-record-buttons{flex-wrap:wrap}.gt-article-toolbar select{font-size:14px}}
`;
document.head.append(gtCatalogStyle);
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
  slug,title:fval('title'),brand:fval('brand'),subject:fval('subject'),category:fval('category'),publicationSection:fval('publicationSection')||'stories',
  publishedAt:fval('publishedAt'),subjects:[...new Set([fval('subject'),...Array.from(document.querySelectorAll('input[name="gt-extra-subject"]:checked'),el=>el.value)])],createdAt:local?.createdAt||new Date().toISOString(),
  excerpt:fval('excerpt'),body:fval('body').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),
  source:fval('source'),sourceTitle:fval('sourceTitle'),publisher:fval('publisher'),
  sourceAuthor:fval('sourceAuthor'),sourceDate:fval('sourceDate'),cover:editorCover,coverFit:fval('coverFit')||'cover',coverMobileFit:fval('coverMobileFit')||'cover',coverMobileZoom:Number(fval('coverMobileZoom')||100),coverZoom:Number(fval('coverZoom')||100),coverX:Number(fval('coverX')??50),coverY:Number(fval('coverY')??50),coverMobileX:Number(fval('coverMobileX')??50),coverMobileY:Number(fval('coverMobileY')??50),revision:cloudRevision
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
  if(b.dataset.gtA==='clear-filters'){Object.assign(gtArticleFilters,{search:'',status:'all',subject:'all',brand:'all',category:'all',sort:'updated',page:1});draw()}
  if(b.dataset.gtA==='edit')load(b.dataset.slug);
  if(b.dataset.gtA==='publish')publish(b.dataset.slug);
 }
 const page=e.target.closest('[data-gt-page]');
 if(page){
  e.preventDefault();e.stopImmediatePropagation();
  gtArticleFilters.page+=page.dataset.gtPage==='next'?1:-1;
  gtArticleDrawList();cloudPanel()?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 const t=e.target.closest('[data-kind]');
 if(t?.dataset.kind==='article'){cloudRevision='';setTimeout(refresh,0)}
 const edit=e.target.closest('[data-edit]');
 if(edit&&editorKind==='article')cloudRevision='';
},true);
document.addEventListener('input',e=>{
 const fld=e.target.closest('[data-gt-filter="search"]');if(!fld)return;
 gtArticleFilters.search=fld.value;gtArticleFilters.page=1;
 gtArticleDrawList();
});
document.addEventListener('change',e=>{
 const fld=e.target.closest('[data-gt-filter]');if(!fld||fld.dataset.gtFilter==='search')return;
 const key=fld.dataset.gtFilter;
 if(!Object.hasOwn(gtArticleFilters,key))return;
 gtArticleFilters[key]=fld.value;gtArticleFilters.page=1;
 gtArticleDrawList();
});
if(location.hash.includes('/admin')){render();if(editorKind==='article')refresh()}
}
loadPublished();
})();