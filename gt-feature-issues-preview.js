/* GOOD THINGS, FEATURES / editorial issue manager. Preview-only editor; published-only front end. */
(()=>{
const preview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
const series=[['behind-the-brand','BEHIND THE BRAND','品牌故事與設計理念'],['good-pickups','GOOD PICKUPS','個人選品、穿著與使用觀察'],['seasonal-notes','SEASONAL NOTES','季度服裝與趨勢觀察']];
let published=[],rows=[],active=null,error='',loading=false,coverData='',articleOrder=[];
let coverPending=null,coverUploadError='',coverChoiceId=0,issueSaving=false,issueDirty=false;
const issuing=new Set();
const escText=v=>esc(String(v??''));
const publicFeatures=async()=>{
 try{
  const q='*[_type=="featureIssue"&&!(_id in path("drafts.**"))]{title,slug,series,summary,articleSlugs,brandSlugs,coverFit,coverMobileFit,coverZoom,coverMobileZoom,coverX,coverY,coverMobileX,coverMobileY,"cover":cover.asset->url}';
  const url=preview?'/api/public/features':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(q);
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();
  if(preview&&!data.ok)throw Error('專題資料服務無法使用');
  published=Array.isArray(preview?data.records:data.result)?(preview?data.records:data.result):[];
 }catch(e){console.warn('Published feature issues unavailable',e.message);published=[]}
 if(!location.hash.includes('/admin'))render();
};
const gtCropStyle=(x,mobile=false)=>{const fit=mobile?(x.coverMobileFit||x.coverFit||'cover'):(x.coverFit||'cover');const xPos=mobile?(x.coverMobileX??x.coverX??50):(x.coverX??50),yPos=mobile?(x.coverMobileY??x.coverY??50):(x.coverY??50),zoom=mobile?(x.coverMobileZoom??100):(x.coverZoom??100);return '--gt-issue-fit:'+(fit==='contain'?'contain':'cover')+';--gt-issue-x:'+Number(xPos)+'%;--gt-issue-y:'+Number(yPos)+'%;--gt-issue-zoom:'+(fit==='contain'?1:(Math.max(100,Number(zoom)||100)/100))};
const gtCoverMarkup=(x,detail=false)=>'<div class="gt-issue-cover-frame'+(detail?' gt-issue-hero':'')+'" style="'+gtCropStyle(x)+'" data-mobile-style="'+gtCropStyle(x,true)+'"><img '+(detail?'':'loading="lazy" ')+'src="'+escText(x.cover)+'" alt=""></div>';
const issueRows=()=>published.map(x=>({...x,slug:x.slug?.current||x.slug})).filter(x=>x.title&&x.slug);
viewFeatures=function(){
 const a=issueRows();
 const navigation='<nav class="gt-feature-series-nav" aria-label="FEATURES 三大系列">'+
  series.map(([key,title,desc],i)=>'<a class="gt-feature-series-nav-item" href="#/features" data-feature-series-jump="features-'+key+'">'+
   '<span class="gt-feature-series-nav-num">0'+(i+1)+'</span><span class="gt-feature-series-nav-content"><strong>'+title+'</strong><small>'+escText(desc)+'</small></span><span class="gt-feature-series-nav-arrow" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16L16 4M7 4h9v9"/></svg></span></a>').join('')+
 '</nav>';
 const group=series.map(([key,title,desc])=>{
  const items=a.filter(x=>x.series===key);
  return '<section class="gt-issue-series" id="features-'+key+'"><div class="gt-issue-series-title"><span class="kicker">'+title+'</span><p>'+escText(desc)+'</p></div><div class="gt-issue-grid">'+
   (items.length?items.map(x=>'<a class="gt-issue-card" href="#/feature/'+encodeURIComponent(x.slug)+'">'+
    (x.cover?gtCoverMarkup(x):'<div class="gt-issue-placeholder">'+title+'</div>')+
    '<small>FEATURE / '+title+'</small><h3>'+escText(x.title)+'</h3><p>'+escText(x.summary)+'</p><span class="gt-feature-issue-read">READ ISSUE '+gtArrow()+'</span></a>').join(''):'<p class="muted">此系列尚無已發布專題。</p>')+
   '</div></section>';
 }).join('');
 return '<section class="section">'+header(gtSiteHTML('features.kicker'),gtSiteHTML('features.title'),gtSiteHTML('features.desc'))+navigation+group+'</section>';
};
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-feature-series-jump]');
 if(!link)return;
 const section=document.getElementById(link.dataset.featureSeriesJump);
 if(!section)return;
 event.preventDefault();
 section.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
});
const viewIssue=slug=>{
 const x=issueRows().find(i=>i.slug===slug);if(!x)return notFound();
 const related=(Array.isArray(x.articleSlugs)?x.articleSlugs:[]).map(s=>gtPublicArticles().find(a=>a.slug===s)).filter(Boolean);
 const brands=(Array.isArray(x.brandSlugs)?x.brandSlugs:[]).map(s=>gtPublicBrands().find(b=>b.slug===s)).filter(Boolean);
 return '<section class="section gt-issue-detail"><a class="back" href="#/features">← ALL FEATURES</a><p class="kicker">'+escText(series.find(s=>s[0]===x.series)?.[1]||'FEATURES')+'</p><h1>'+escText(x.title)+'</h1><p class="gt-issue-intro">'+escText(x.summary)+'</p>'+
 (x.cover?gtCoverMarkup(x,true):'')+
 '<h2 class="gt-issue-heading">IN THIS ISSUE</h2><div class="product-list">'+(related.map((a,i)=>articleRow(a,i)).join('')||'<p>尚無可閱讀的文章。</p>')+'</div>'+
 (brands.length?'<h2 class="gt-issue-heading">RELATED BRANDS</h2><div class="gt-issue-brand-links">'+brands.map(b=>'<a href="#/brand/'+encodeURIComponent(b.slug)+'">'+escText(b.name)+' →</a>').join('')+'</div>':'')+'</section>';
};
const oldRender=render;
render=function(){
 const path=(location.hash||'').slice(1).split('?')[0];
 if(path.startsWith('/feature/')&&!path.startsWith('/features/')){
  const slug=decodeURIComponent(path.split('/')[2]||'');
  document.getElementById('app').innerHTML=viewIssue(slug);
  gtApplySiteLabels();window.scrollTo(0,0);return;
 }
 return oldRender();
};
const api=async(url,options={})=>{
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok||!d.ok)throw Error(d.error||'HTTP '+r.status);
 return d;
};
const initial=()=>({slug:'',title:'',series:series[0][0],summary:'',articleSlugs:[],brandSlugs:[],cover:'',coverFit:'cover',coverMobileFit:'cover',coverZoom:100,coverMobileZoom:100,coverX:50,coverY:50,coverMobileX:50,coverMobileY:50,revision:'',status:'new'});
// Editor template is assembled separately to make the checkbox expression unambiguous.
const renderOrder=()=>{const zone=document.getElementById('gt-issue-order');if(!zone)return;const chosen=[...document.querySelectorAll('#gt-issue-form input[name="articleSlugs"]:checked')].map(el=>el.value);articleOrder=[...articleOrder.filter(s=>chosen.includes(s)),...chosen.filter(s=>!articleOrder.includes(s))];zone.innerHTML=articleOrder.map((slug,i)=>{const a=gtPublicArticles().find(v=>v.slug===slug);return '<div class="editor-list-item"><span>'+(i+1)+'. '+escText(a?.title||slug)+'</span><div class="gt-record-buttons"><button type="button" data-order-shift="'+i+',-1" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-order-shift="'+i+',1" '+(i===articleOrder.length-1?'disabled':'')+'>↓</button></div></div>'}).join('')};
const renderEditor=()=>{
 const a=active||initial();
 const choices=(items,name,selected)=>items.map(x=>'<label><input type="checkbox" name="'+name+'" value="'+escText(x.slug)+'" '+(selected.includes(x.slug)?'checked':'')+'> '+escText(x.title||x.name)+'</label>').join('');
 const publishedArticles=gtPublicArticles();
 return '<section class="section">'+header('GOOD THINGS / CLOUD STUDIO','Feature Issues','建立系列、選擇關聯文章與品牌。僅按下「確認發布」才會公開。')+editorTabs()+
 '<div class="editor-card"><button type="button" data-issue-act="reload">重新讀取雲端專題</button> <button type="button" data-issue-act="new">＋ 新增專題</button>'+ (error?'<p role="alert">'+escText(error)+'</p>':'')+(loading?'<p>正在讀取…</p>':'')+
 rows.map(x=>'<div class="editor-list-item"><div><span class="editor-badge">'+(x.status==='draft'?'草稿':'已發布')+'</span><strong>'+escText(x.title)+'</strong></div><div class="gt-record-buttons"><button type="button" data-issue-act="open" data-slug="'+escText(x.slug)+'">編輯</button>'+(x.status==='draft'?'<button type="button" data-issue-act="publish" data-slug="'+escText(x.slug)+'">確認發布</button>':'')+'</div></div>').join('')+'</div>'+
 '<form id="gt-issue-form" class="editor-card editor-fields" style="margin-top:25px"><h2>'+(a.revision?'編輯專題':'新專題')+'</h2>'+
 '<label>專題標題 *<input name="title" maxlength="220" required value="'+escText(a.title)+'"></label>'+
 '<label>網址代稱 *<input name="slug" required pattern="[a-z0-9-]{1,90}" '+(a.revision?'readonly':'')+' value="'+escText(a.slug)+'" placeholder="the-world-of-comoli"></label>'+
 '<label>專題系列<select name="series">'+series.map(s=>'<option value="'+s[0]+'" '+(a.series===s[0]?'selected':'')+'>'+s[1]+'</option>').join('')+'</select></label>'+
 '<label>專題介紹 *<textarea name="summary" rows="4" maxlength="3000" required>'+escText(a.summary)+'</textarea></label>'+
 '<label>封面圖片（JPG / PNG / WEBP，會自動壓縮）<input name="coverUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>'+ '<p id="gt-issue-cover-status" class="cms-hint" role="status">選擇圖片後會自動壓縮，再儲存雲端草稿。</p>'+
 '<div class="gt-issue-free-crop-tools"><button type="button" data-issue-free-crop>自由裁切目前封面</button><small>可拖曳裁切框，獨立調整寬度與高度。裁切完成後仍需儲存草稿。</small></div>'+ 
 '<label><input type="checkbox" name="clearCover"> 移除封面</label>'+
 '<fieldset class="gt-issue-cover-controls"><legend>DESKTOP / 電腦版</legend>'+
 '<div class="gt-issue-crop-stage" style="'+gtCropStyle(a)+'"><img class="gt-issue-preview-image" '+(a.cover?'src="'+escText(a.cover)+'"':'hidden')+' alt="電腦封面預覽"></div>'+
 '<label>顯示方式<select name="coverFit"><option value="cover" '+((a.coverFit||'cover')!=='contain'?'selected':'')+'>裁切填滿</option><option value="contain" '+(a.coverFit==='contain'?'selected':'')+'>完整顯示</option></select></label>'+
 '<label>縮放 <output data-crop-value="coverZoom">'+Number(a.coverZoom??100)+'%</output><input name="coverZoom" type="range" min="100" max="250" step="5" value="'+Number(a.coverZoom??100)+'"></label>'+
 '<label>左右定位 <output data-crop-value="coverX">'+Number(a.coverX??50)+'%</output><input name="coverX" type="range" min="0" max="100" value="'+Number(a.coverX??a.coverX??50)+'"></label>'+
 '<label>上下定位 <output data-crop-value="coverY">'+Number(a.coverY??50)+'%</output><input name="coverY" type="range" min="0" max="100" value="'+Number(a.coverY??a.coverY??50)+'"></label></fieldset>'+
 '<fieldset class="gt-issue-cover-controls"><legend>MOBILE / 手機版</legend>'+
 '<div class="gt-issue-crop-stage mobile" style="'+gtCropStyle(a,true)+'"><img class="gt-issue-preview-image" '+(a.cover?'src="'+escText(a.cover)+'"':'hidden')+' alt="手機封面預覽"></div>'+
 '<label>顯示方式<select name="coverMobileFit"><option value="cover" '+((a.coverMobileFit||'cover')!=='contain'?'selected':'')+'>裁切填滿</option><option value="contain" '+(a.coverMobileFit==='contain'?'selected':'')+'>完整顯示</option></select></label>'+
 '<label>縮放 <output data-crop-value="coverMobileZoom">'+Number(a.coverMobileZoom??100)+'%</output><input name="coverMobileZoom" type="range" min="100" max="200" step="5" value="'+Number(a.coverMobileZoom??100)+'"></label>'+
 '<label>左右定位 <output data-crop-value="coverMobileX">'+Number(a.coverMobileX??a.coverX??50)+'%</output><input name="coverMobileX" type="range" min="0" max="100" value="'+Number(a.coverMobileX??a.coverX??50)+'"></label>'+
 '<label>上下定位 <output data-crop-value="coverMobileY">'+Number(a.coverMobileY??a.coverY??50)+'%</output><input name="coverMobileY" type="range" min="0" max="100" value="'+Number(a.coverMobileY??a.coverY??50)+'"></label></fieldset>'+
 '<fieldset><legend>相關品牌</legend><div class="gt-issue-choice">'+choices(gtPublicBrands(),'brandSlugs',a.brandSlugs||[])+'</div></fieldset>'+
 '<fieldset><legend>專題文章（上下按鈕可排序）</legend><div class="gt-issue-choice">'+choices(publishedArticles,'articleSlugs',a.articleSlugs||[])+'</div><div id="gt-issue-order"></div></fieldset>'+
 '<div class="editor-actions"><button type="submit">儲存雲端草稿</button></div></form></section>';
};
// The tab and editor route are owned by index.html to avoid runtime-only navigation.
window.gtFeatureEditorView=renderEditor;
const refresh=async()=>{loading=true;error='';render();try{rows=(await api('/api/editor/feature-issues')).records||[]}catch(e){error=e.message}finally{loading=false;render()}};
const open=async slug=>{try{active=(await api('/api/editor/feature-issues?slug='+encodeURIComponent(slug))).record;issueDirty=false;articleOrder=[...(active.articleSlugs||[])];coverData='';coverUploadError='';coverChoiceId++;render();renderOrder()}catch(e){alert('無法讀取專題：'+e.message)}};
const publish=async slug=>{
 if(issuing.has(slug)||issueSaving||coverPending)return;
 const row=rows.find(r=>r.slug===slug);
 if(!row||row.status!=='draft'||!row.revision)return alert('請重新讀取專題草稿');
 if(active?.slug===slug&&issueDirty)return alert('專題有尚未儲存的修改，請先儲存草稿再發布。');
 if(!confirm('要正式發布「'+row.title+'」嗎？'))return;
 issuing.add(slug);
 try{await api('/api/editor/publish-feature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,revision:row.revision,confirmation:'PUBLISH'})});await refresh();await publicFeatures();alert('專題已正式發布')}catch(e){alert('發布失敗：'+e.message)}finally{issuing.delete(slug)}
};
document.addEventListener('click',e=>{
 const k=e.target.closest('[data-kind="features"]');
 if(k){e.preventDefault();e.stopImmediatePropagation();editorKind='features';active=initial();issueDirty=false;articleOrder=[];coverData='';coverUploadError='';coverChoiceId++;render();refresh();return}
 const freeCrop=e.target.closest('[data-issue-free-crop]');
  if(freeCrop){
   e.preventDefault();e.stopImmediatePropagation();
   if(coverPending||issueSaving)return;
   const form=freeCrop.closest('#gt-issue-form');
   const source=coverData||active?.cover;
   if(!source){alert('請先選擇一張專題封面圖片。');return}
   if(!window.GTImageCrop?.openExisting){alert('自由裁切工具尚未載入，請重新整理測試頁面。');return}
   freeCrop.disabled=true;
   window.GTImageCrop.openExisting(source,async file=>{
    const formNow=document.getElementById('gt-issue-form');
    if(formNow!==form)return;
    const status=form.querySelector('#gt-issue-cover-status');
    const save=form.querySelector('button[type="submit"]');
    if(save)save.disabled=true;
    try{
     coverPending=(async()=>{
      const processed=await gtCompressImage(file,'cover');
      if(formNow!==document.getElementById('gt-issue-form'))return;
      coverData=processed.data;
      coverUploadError='';
      const remove=form.querySelector('input[name="clearCover"]');
      if(remove)remove.checked=false;
      form.querySelectorAll('.gt-issue-preview-image').forEach(img=>{img.src=coverData;img.hidden=false});
      issueDirty=true;
      if(status)status.textContent='已完成自由裁切。請儲存雲端草稿，變更不會自動發布。';
     })();
     await coverPending;
    }catch(err){coverUploadError=err.message||'裁切處理失敗';if(status)status.textContent=coverUploadError;}
    finally{coverPending=null;if(save)save.disabled=false;}
   }).catch(err=>alert('無法開啟既有封面自由裁切：'+err.message)).finally(()=>{if(freeCrop.isConnected)freeCrop.disabled=false});
   return;
  }
  const btn=e.target.closest('[data-issue-act]');if(!btn){const shift=e.target.closest('[data-order-shift]');if(shift){e.preventDefault();const [i,d]=shift.dataset.orderShift.split(',').map(Number),j=i+d;if(j>=0&&j<articleOrder.length){[articleOrder[i],articleOrder[j]]=[articleOrder[j],articleOrder[i]];issueDirty=true;renderOrder()}}return;}
 e.preventDefault();e.stopImmediatePropagation();
 if(btn.dataset.issueAct==='reload')refresh();
 if(btn.dataset.issueAct==='new'){active=initial();issueDirty=false;articleOrder=[];coverData='';coverUploadError='';coverChoiceId++;render()}
 if(btn.dataset.issueAct==='open')open(btn.dataset.slug);
 if(btn.dataset.issueAct==='publish')publish(btn.dataset.slug);
 const shift=e.target.closest('[data-order-shift]');if(shift){const [i,d]=shift.dataset.orderShift.split(',').map(Number),j=i+d;if(j>=0&&j<articleOrder.length){[articleOrder[i],articleOrder[j]]=[articleOrder[j],articleOrder[i]];issueDirty=true;renderOrder()}}
},true);
document.addEventListener('change',async e=>{
 if(e.target.closest('#gt-issue-form'))issueDirty=true;
  if(e.target.name==='clearCover'&&e.target.closest('#gt-issue-form')){
  const form=e.target.closest('#gt-issue-form');
  form.querySelectorAll('.gt-issue-preview-image').forEach(img=>{img.hidden=e.target.checked||!(coverData||active?.cover)});
  return;
 }
 if(e.target.name==='articleSlugs'&&e.target.closest('#gt-issue-form')){renderOrder();return}
 if(e.target.name!=='coverUpload'||!e.target.closest('#gt-issue-form'))return;
 const file=e.target.files?.[0];if(!file)return;
 const choiceId=++coverChoiceId;
 const form=e.target.closest('#gt-issue-form');
 const status=form?.querySelector('#gt-issue-cover-status');
 const save=form?.querySelector('button[type="submit"]');
 coverUploadError='';
 if(status)status.textContent='正在壓縮專題封面，圖片處理完成後才能儲存。';
 if(save)save.disabled=true;
 coverPending=(async()=>{
  try{
   if(typeof gtCompressImage!=='function')throw Error('圖片處理模組未載入，請重新開啟編輯頁');
   // Same client-side compression already used for ARTICLE covers.
   const processed=await gtCompressImage(file,'cover');
   if(choiceId!==coverChoiceId)return;
   if(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(processed.data)||processed.data.length>1_100_000)
    throw Error('壓縮圖片無效，請改用 JPG 或 WebP');
   coverData=processed.data;
   const removeCover=form?.querySelector('input[name="clearCover"]');if(removeCover)removeCover.checked=false;
   form?.querySelectorAll('.gt-issue-preview-image').forEach(img=>{img.src=coverData;img.hidden=false})
   if(status)status.textContent='已完成 '+(processed.note||'圖片壓縮')+'，約 '+Math.round(coverData.length*.75/1024)+' KB。';
  }catch(err){
   if(choiceId!==coverChoiceId)return;
   coverData='';
   coverUploadError=err.message||'圖片處理失敗';
   if(status)status.textContent='封面處理失敗：'+coverUploadError+'。請重新選取圖片，表單其他內容會保留。';
  }finally{
   if(choiceId===coverChoiceId){coverPending=null;if(save)save.disabled=false}
  }
 })();
 await coverPending;
});
document.addEventListener('input',e=>{
 const f=e.target.closest('#gt-issue-form');if(!f)return;
 issueDirty=true;
 const data=Object.fromEntries(['coverFit','coverMobileFit','coverZoom','coverMobileZoom','coverX','coverY','coverMobileX','coverMobileY'].map(k=>[k,f.elements[k].value]));
 f.querySelectorAll('.gt-issue-crop-stage').forEach((stage,i)=>stage.setAttribute('style',gtCropStyle(data,i===1)));
 f.querySelectorAll('[data-crop-value]').forEach(out=>{out.textContent=f.elements[out.dataset.cropValue].value+'%'})
});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='gt-issue-form')return;
 e.preventDefault();e.stopImmediatePropagation();
 if(issueSaving)return;
 const f=e.target,a=active||initial();
 if(coverPending)await coverPending;
 if(coverUploadError){alert('封面尚未處理完成：'+coverUploadError+'。請重新選取圖片。');return}
 const selected=name=>Array.from(f.querySelectorAll('input[name="'+name+'"]:checked'),x=>x.value);
 const input={slug:f.elements.slug.value,title:f.elements.title.value,series:f.elements.series.value,
 summary:f.elements.summary.value,articleSlugs:[...articleOrder.filter(v=>selected('articleSlugs').includes(v)),...selected('articleSlugs').filter(v=>!articleOrder.includes(v))],brandSlugs:selected('brandSlugs'),
 cover:f.elements.clearCover.checked?'':(coverData||a.cover||''),coverFit:f.elements.coverFit.value,coverMobileFit:f.elements.coverMobileFit.value,
 coverZoom:Number(f.elements.coverZoom.value),coverMobileZoom:Number(f.elements.coverMobileZoom.value),
 coverX:Number(f.elements.coverX.value),coverY:Number(f.elements.coverY.value),
 coverMobileX:Number(f.elements.coverMobileX.value),coverMobileY:Number(f.elements.coverMobileY.value),revision:a.revision||''};
 try{
  issueSaving=true;
  const save=f.querySelector('button[type="submit"]');if(save)save.disabled=true;
  await api('/api/editor/feature-issues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  coverData='';coverUploadError='';await refresh();await open(input.slug);issueDirty=false;alert('專題已儲存為雲端草稿，尚未公開');
 }catch(err){alert('儲存未完成：'+err.message+'。表單內容仍保留在目前頁面。')}
 finally{issueSaving=false;const save=f.querySelector('button[type="submit"]');if(save)save.disabled=false}
},true);
const style=document.createElement('style');
style.textContent=`
.gt-feature-series-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:30px 0 43px}
.gt-feature-series-nav-item{border:1px solid #cbd0c3;display:flex;gap:13px;align-items:flex-start;padding:22px 17px;min-width:0;min-height:112px;color:#29332b;text-decoration:none;background:#f4f3ed;transition:background .2s}
.gt-feature-series-nav-item:hover,.gt-feature-series-nav-item:focus-visible{background:#e8ebe2;border-color:#849582}
.gt-feature-series-nav-num{color:#788173;font:500 11px/1.8 Arial,sans-serif}
.gt-feature-series-nav-content{display:grid;gap:10px;min-width:0;flex:1}
.gt-feature-series-nav-content strong{font:600 clamp(12px,1.45vw,17px)/1.2 Arial,"Noto Sans TC",sans-serif;letter-spacing:.01em}
.gt-feature-series-nav-content small{font-size:11px;color:#6a7369;line-height:1.6}
.gt-feature-series-nav-arrow{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;color:#526355;flex:0 0 19px}
.gt-feature-series-nav-arrow svg{display:block;width:17px;height:17px}
.gt-feature-issue-read{display:inline-flex;align-items:center;gap:7px}
.gt-feature-issue-read svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
@media(max-width:750px){.gt-feature-series-nav{grid-template-columns:1fr;gap:0;margin:24px 0 32px}.gt-feature-series-nav-item{min-height:0;padding:15px 10px;border-left:0;border-right:0;border-bottom:0}.gt-feature-series-nav-item:last-child{border-bottom:1px solid #cbd0c3}.gt-feature-series-nav-content{gap:4px}.gt-feature-series-nav-content strong{font-size:13px}}
@media(prefers-reduced-motion:reduce){.gt-feature-series-nav-item{transition:none}}
.gt-issue-series{scroll-margin-top:24px;margin:45px 0 65px}.gt-issue-series-title{border-bottom:1px solid #d6d6ce;padding-bottom:16px;margin-bottom:25px}.gt-issue-series-title p{font-size:13px;color:#74786f;margin:10px 0 0}
.gt-issue-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.gt-issue-card{display:block;text-decoration:none;color:inherit;min-width:0}.gt-issue-cover-frame{width:100%;aspect-ratio:3/2;overflow:hidden;background:#e4e4dc}.gt-issue-cover-frame img,.gt-issue-crop-stage img{display:block;width:100%;height:100%;object-fit:var(--gt-issue-fit,cover);object-position:var(--gt-issue-x,50%) var(--gt-issue-y,50%);transform:scale(var(--gt-issue-zoom,1));transform-origin:var(--gt-issue-x,50%) var(--gt-issue-y,50%)}.gt-issue-placeholder{width:100%;aspect-ratio:3/2;display:block;background:#e4e4dc}.gt-issue-placeholder{display:grid;place-items:center;letter-spacing:.18em;font-size:12px;color:#657064}
.gt-issue-card small{display:block;margin-top:18px;font-size:10px;letter-spacing:.13em}.gt-issue-card h3{font-size:clamp(20px,3vw,30px);line-height:1.3;font-weight:500;margin:8px 0}.gt-issue-card p{font-size:13px;line-height:1.8;color:#6a7169}.gt-issue-card span{font-size:11px;letter-spacing:.08em}
.gt-issue-detail h1{font-size:clamp(36px,6vw,72px);font-weight:500;line-height:1.1;max-width:900px}.gt-issue-intro{max-width:680px;line-height:1.9;color:#626d63}.gt-issue-hero{width:100%;height:auto;aspect-ratio:3/2;margin:28px 0 38px}.gt-issue-heading{font-weight:500;margin:50px 0 20px;font-size:19px}.gt-issue-brand-links{display:flex;gap:18px;flex-wrap:wrap}.gt-issue-brand-links a{text-decoration:none;border-bottom:1px solid #80867d;color:inherit;padding-bottom:5px}
.gt-issue-crop-stage{width:100%;aspect-ratio:3/2;background:#e4e4dc;overflow:hidden}.gt-issue-crop-stage.mobile{aspect-ratio:4/5;max-width:360px}.gt-issue-crop-stage img[hidden]{display:none}.gt-issue-cover-controls{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;min-width:0;border:1px solid #c8ccc1;padding:16px;margin:8px 0}.gt-issue-cover-controls legend{padding:0 8px;font-size:12px;letter-spacing:.05em}.gt-issue-cover-controls label{min-width:0}.gt-issue-free-crop-tools{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:12px 0}.gt-issue-free-crop-tools button{border:1px solid #8b9d88;background:#e8ede4;color:#263e2c;padding:10px 15px;cursor:pointer}.gt-issue-free-crop-tools small{font-size:11px;color:#607263;line-height:1.6}.gt-issue-cover-controls input[type=range]{width:100%;accent-color:#526b50}.gt-issue-choice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gt-issue-choice label{display:flex;gap:8px;align-items:center;font-size:13px}.gt-issue-choice input{width:18px;height:18px;flex:0 0 18px}
@media(max-width:700px){.gt-issue-grid,.gt-issue-choice{grid-template-columns:1fr}.gt-issue-series{margin:35px 0 50px}.gt-issue-cover-frame,.gt-issue-cover-frame.gt-issue-hero{aspect-ratio:4/5;height:auto}.gt-issue-cover-controls{padding:14px 10px}.gt-issue-cover-controls input,.gt-issue-cover-controls select{min-width:0}.gt-issue-crop-stage.mobile{max-width:340px}}
`;
document.head.append(style);
const applyMobileCrop=()=>{document.querySelectorAll('.gt-issue-cover-frame[data-mobile-style]').forEach(node=>{if(!node.dataset.desktopStyle)node.dataset.desktopStyle=node.getAttribute('style')||'';node.setAttribute('style',matchMedia('(max-width:700px)').matches?node.dataset.mobileStyle:node.dataset.desktopStyle)})};
const previousRender=render;render=function(...args){const result=previousRender(...args);applyMobileCrop();return result};window.addEventListener('resize',applyMobileCrop);
publicFeatures();
})();
