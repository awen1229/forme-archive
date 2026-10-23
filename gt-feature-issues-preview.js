/* GOOD THINGS, FEATURES / editorial issue manager. Preview-only editor; published-only front end. */
(()=>{
const preview=location.hostname==='feature-secure-editor-cloud.forme-archive.pages.dev';
const series=[['behind-the-brand','BEHIND THE BRAND','品牌故事與設計理念'],['good-pickups','GOOD PICKUPS','個人選品、穿著與使用觀察'],['seasonal-notes','SEASONAL NOTES','季度服裝與趨勢觀察']];
let published=[],rows=[],active=null,error='',loading=false,coverData='',articleOrder=[];
const escText=v=>esc(String(v??''));
const publicFeatures=async()=>{
 try{
  const q='*[_type=="featureIssue"&&!(_id in path("drafts.**"))]{title,slug,series,summary,articleSlugs,brandSlugs,coverFit,coverX,coverY,"cover":cover.asset->url}';
  const url=preview?'/api/public/features':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(q);
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();
  if(preview&&!data.ok)throw Error('專題資料服務無法使用');
  published=Array.isArray(preview?data.records:data.result)?(preview?data.records:data.result):[];
 }catch(e){console.warn('Published feature issues unavailable',e.message);published=[]}
 if(!location.hash.includes('/admin'))render();
};
const issueRows=()=>published.map(x=>({...x,slug:x.slug?.current||x.slug})).filter(x=>x.title&&x.slug);
viewFeatures=function(){
 const a=issueRows();
 const group=series.map(([key,title,desc])=>{
  const items=a.filter(x=>x.series===key);
  return '<section class="gt-issue-series"><div class="gt-issue-series-title"><span class="kicker">'+title+'</span><p>'+escText(desc)+'</p></div><div class="gt-issue-grid">'+
   (items.length?items.map(x=>'<a class="gt-issue-card" href="#/feature/'+encodeURIComponent(x.slug)+'">'+
    (x.cover?'<img loading="lazy" src="'+escText(x.cover)+'" alt="" style="object-fit:'+ (x.coverFit==='contain'?'contain':'cover')+';object-position:'+Number(x.coverX??50)+'% '+Number(x.coverY??50)+'%">':'<div class="gt-issue-placeholder">'+title+'</div>')+
    '<small>FEATURE / '+title+'</small><h3>'+escText(x.title)+'</h3><p>'+escText(x.summary)+'</p><span>READ ISSUE →</span></a>').join(''):'<p class="muted">此系列尚無已發布專題。</p>')+
   '</div></section>';
 }).join('');
 return '<section class="section">'+header(gtSiteHTML('features.kicker'),gtSiteHTML('features.title'),gtSiteHTML('features.desc'))+group+'</section>';
};
const viewIssue=slug=>{
 const x=issueRows().find(i=>i.slug===slug);if(!x)return notFound();
 const related=(Array.isArray(x.articleSlugs)?x.articleSlugs:[]).map(s=>gtPublicArticles().find(a=>a.slug===s)).filter(Boolean);
 const brands=(Array.isArray(x.brandSlugs)?x.brandSlugs:[]).map(s=>gtPublicBrands().find(b=>b.slug===s)).filter(Boolean);
 return '<section class="section gt-issue-detail"><a class="back" href="#/features">← ALL FEATURES</a><p class="kicker">'+escText(series.find(s=>s[0]===x.series)?.[1]||'FEATURES')+'</p><h1>'+escText(x.title)+'</h1><p class="gt-issue-intro">'+escText(x.summary)+'</p>'+
 (x.cover?'<img class="gt-issue-hero" src="'+escText(x.cover)+'" alt="" style="object-fit:'+(x.coverFit==='contain'?'contain':'cover')+';object-position:'+Number(x.coverX??50)+'% '+Number(x.coverY??50)+'%">':'')+
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
const initial=()=>({slug:'',title:'',series:series[0][0],summary:'',articleSlugs:[],brandSlugs:[],cover:'',coverFit:'cover',coverX:50,coverY:50,revision:'',status:'new'});
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
 '<label>封面圖片（JPG / PNG / WEBP）<input name="coverUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>'+
 '<img id="gt-issue-cover-preview" '+(a.cover?'src="'+escText(a.cover)+'"':'hidden')+' alt="封面預覽" style="width:min(100%,460px);aspect-ratio:3/2;object-fit:cover">'+
 '<label><input type="checkbox" name="clearCover"> 移除封面</label>'+
 '<label>封面顯示<select name="coverFit"><option value="cover" '+(a.coverFit!=='contain'?'selected':'')+'>裁切填滿</option><option value="contain" '+(a.coverFit==='contain'?'selected':'')+'>完整顯示</option></select></label>'+
 '<label>左右定位<input name="coverX" type="range" min="0" max="100" value="'+Number(a.coverX??50)+'"></label>'+
 '<label>上下定位<input name="coverY" type="range" min="0" max="100" value="'+Number(a.coverY??50)+'"></label>'+
 '<fieldset><legend>相關品牌</legend><div class="gt-issue-choice">'+choices(gtPublicBrands(),'brandSlugs',a.brandSlugs||[])+'</div></fieldset>'+
 '<fieldset><legend>專題文章（上下按鈕可排序）</legend><div class="gt-issue-choice">'+choices(publishedArticles,'articleSlugs',a.articleSlugs||[])+'</div><div id="gt-issue-order"></div></fieldset>'+
 '<div class="editor-actions"><button type="submit">儲存雲端草稿</button></div></form></section>';
};
const baseAdmin=viewAdmin;
viewAdmin=function(){return editorKind==='features'?renderEditor():baseAdmin()};
const baseTabs=editorTabs;
editorTabs=function(){return baseTabs().replace('</div>','<button class="'+(editorKind==='features'?'on':'')+'" data-kind="features">FEATURES 專題</button></div>')};
const refresh=async()=>{loading=true;error='';render();try{rows=(await api('/api/editor/feature-issues')).records||[]}catch(e){error=e.message}finally{loading=false;render()}};
const open=async slug=>{try{active=(await api('/api/editor/feature-issues?slug='+encodeURIComponent(slug))).record;articleOrder=[...(active.articleSlugs||[])];coverData='';render();renderOrder()}catch(e){alert('無法讀取專題：'+e.message)}};
const publish=async slug=>{
 const row=rows.find(r=>r.slug===slug);
 if(!row||row.status!=='draft'||!row.revision)return alert('請重新讀取專題草稿');
 if(!confirm('要正式發布「'+row.title+'」嗎？'))return;
 if(prompt('輸入 PUBLISH 才會正式公開')!=='PUBLISH')return;
 try{await api('/api/editor/publish-feature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,revision:row.revision,confirmation:'PUBLISH'})});await refresh();await publicFeatures();alert('專題已正式發布')}catch(e){alert('發布失敗：'+e.message)}
};
document.addEventListener('click',e=>{
 const k=e.target.closest('[data-kind="features"]');
 if(k){e.preventDefault();e.stopImmediatePropagation();editorKind='features';active=initial();articleOrder=[];render();refresh();return}
 const btn=e.target.closest('[data-issue-act]');if(!btn){const shift=e.target.closest('[data-order-shift]');if(shift){e.preventDefault();const [i,d]=shift.dataset.orderShift.split(',').map(Number),j=i+d;if(j>=0&&j<articleOrder.length){[articleOrder[i],articleOrder[j]]=[articleOrder[j],articleOrder[i]];renderOrder()}}return;}
 e.preventDefault();e.stopImmediatePropagation();
 if(btn.dataset.issueAct==='reload')refresh();
 if(btn.dataset.issueAct==='new'){active=initial();articleOrder=[];coverData='';render()}
 if(btn.dataset.issueAct==='open')open(btn.dataset.slug);
 if(btn.dataset.issueAct==='publish')publish(btn.dataset.slug);
 const shift=e.target.closest('[data-order-shift]');if(shift){const [i,d]=shift.dataset.orderShift.split(',').map(Number),j=i+d;if(j>=0&&j<articleOrder.length){[articleOrder[i],articleOrder[j]]=[articleOrder[j],articleOrder[i]];renderOrder()}}
},true);
document.addEventListener('change',async e=>{
 if(e.target.name==='articleSlugs'&&e.target.closest('#gt-issue-form')){renderOrder();return}
 if(e.target.name!=='coverUpload'||!e.target.closest('#gt-issue-form'))return;
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('請上傳 JPG、PNG 或 WebP');
  if(file.size>5_000_000)throw Error('圖片過大，請先壓縮到 5MB 以下');
  coverData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('無法讀取圖片'));reader.readAsDataURL(file)});
  const img=document.getElementById('gt-issue-cover-preview');img.src=coverData;img.hidden=false;
 }catch(err){alert(err.message)}
});
document.addEventListener('input',e=>{
 const f=e.target.closest('#gt-issue-form');if(!f)return;
 const img=document.getElementById('gt-issue-cover-preview');
 if(img){img.style.objectFit=f.elements.coverFit.value;img.style.objectPosition=f.elements.coverX.value+'% '+f.elements.coverY.value+'%'}
});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='gt-issue-form')return;
 e.preventDefault();e.stopImmediatePropagation();
 const f=e.target,a=active||initial();
 const selected=name=>Array.from(f.querySelectorAll('input[name="'+name+'"]:checked'),x=>x.value);
 const input={slug:f.elements.slug.value,title:f.elements.title.value,series:f.elements.series.value,
 summary:f.elements.summary.value,articleSlugs:[...articleOrder.filter(v=>selected('articleSlugs').includes(v)),...selected('articleSlugs').filter(v=>!articleOrder.includes(v))],brandSlugs:selected('brandSlugs'),
 cover:f.elements.clearCover.checked?'':(coverData||a.cover||''),coverFit:f.elements.coverFit.value,
 coverX:Number(f.elements.coverX.value),coverY:Number(f.elements.coverY.value),revision:a.revision||''};
 try{
  const d=await api('/api/editor/feature-issues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  coverData='';await refresh();await open(input.slug);alert('專題已儲存為雲端草稿，尚未公開');
 }catch(err){alert('儲存未完成：'+err.message)}
},true);
publicFeatures();
})();
