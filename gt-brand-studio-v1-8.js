/* GOOD THINGS, v1.8 / Editor-only brand directory management */
(()=>{
'use strict';
if(location.hostname!=='feature-secure-editor-cloud.forme-archive.pages.dev')return;
const state={q:'',status:'all',letter:'ALL',sort:'name',page:1},perPage=20;
const alpha=['ALL',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ','#'];
const letter=x=>{const m=String(x?.name||'').trim().match(/^[A-Za-z]/);return m?m[0].toUpperCase():'#'};
const escBrand=x=>gtCloudEscape(x==null?'':x);
function filtered(){
 const query=state.q.trim().toLocaleLowerCase();
 return gtCloudBrandRows.filter(r=>
 (state.status==='all'||(state.status==='draft'&&r.status==='draft')||(state.status==='published'&&(r.status==='published'||r.hasPublished)))&&
 (state.letter==='ALL'||letter(r)===state.letter)&&
 (!query||[r.name,r.slug,r.founder,...(r.tags||[])].join(' ').toLocaleLowerCase().includes(query))
 ).sort((a,b)=>{
 const ab=String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'});
 return state.sort==='updated'?String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||ab:
 state.sort==='created'?String(b.createdAt||'').localeCompare(String(a.createdAt||''))||ab:ab;
 });
}
function paint(){
 const target=document.getElementById('gt-cloud-brand-results');if(!target)return;
 const records=filtered(),pages=Math.max(1,Math.ceil(records.length/perPage));
 state.page=Math.max(1,Math.min(state.page,pages));
 const list=records.slice((state.page-1)*perPage,state.page*perPage);
 const count=document.getElementById('gt-cloud-brand-count');
 if(count)count.textContent='顯示 '+records.length+' / '+gtCloudBrandRows.length+' 個品牌';
 target.innerHTML=gtCloudBrandError?'<p role="alert">'+escBrand(gtCloudBrandError)+'</p>':
 gtCloudBrandLoading?'<p class="muted">正在讀取雲端品牌…</p>':
 list.length?list.map(r=>{
 const draft=r.status==='draft',edited=r.updatedAt?new Date(r.updatedAt).toLocaleString('zh-TW'):'';
 return '<div class="editor-list-item gt-brand-v18-row"><div class="gt-brand-v18-copy"><span class="editor-badge">'+(draft?'未發布草稿'+(r.hasPublished?' / 有已發布版本':''):'已發布')+'</span><strong>'+escBrand(r.name)+'</strong><div class="muted">'+escBrand(r.founder||r.slug)+' · '+escBrand(edited)+'</div></div><div class="gt-record-buttons"><button type="button" data-cloud-edit="'+escBrand(r.slug)+'">編輯</button>'+(draft?'<button type="button" class="gt-brand-v18-publish" data-cloud-publish="'+escBrand(r.slug)+'">確認發布</button>':'')+'</div></div>';
 }).join(''):'<p class="muted" role="status">沒有符合條件的品牌。</p>';
 if(pages>1&&!gtCloudBrandLoading&&!gtCloudBrandError){
 target.insertAdjacentHTML('beforeend','<div class="gt-brand-v18-pager"><button type="button" data-brand-v18-page="-1" '+(state.page===1?'disabled':'')+'>← 上一頁</button><span>'+state.page+' / '+pages+'</span><button type="button" data-brand-v18-page="1" '+(state.page>=pages?'disabled':'')+'>下一頁 →</button></div>');
 }
 document.querySelectorAll('[data-brand-v18-letter]').forEach(b=>{const active=b.dataset.brandV18Letter===state.letter;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active))});
}
gtRenderCloudBrands=function(){
 const root=document.getElementById('gt-cloud-brands');if(!root)return;
 const counts={};gtCloudBrandRows.forEach(r=>{const a=letter(r);counts[a]=(counts[a]||0)+1});
 root.innerHTML='<div class="kicker">CLOUD / SANITY</div><div class="gt-brand-v18-head"><div><h3>BRAND MANAGEMENT</h3><p class="muted">雲端品牌與草稿管理。儲存草稿不會自動公開。</p></div><button id="gt-cloud-reload" type="button" '+(gtCloudBrandLoading?'disabled':'')+'>'+(gtCloudBrandLoading?'讀取中…':'重新讀取雲端')+'</button></div>'+
 '<div class="gt-brand-v18-toolbar"><label class="gt-brand-v18-search">搜尋品牌、主理人、標籤<input id="gt-brand-v18-search" type="search" autocomplete="off" placeholder="Search brands…" value="'+escBrand(state.q)+'"></label>'+
 '<label>發布狀態<select id="gt-brand-v18-status"><option value="all" '+(state.status==='all'?'selected':'')+'>全部品牌</option><option value="published" '+(state.status==='published'?'selected':'')+'>已發布（含待更新）</option><option value="draft" '+(state.status==='draft'?'selected':'')+'>未發布草稿</option></select></label>'+
 '<label>排序<select id="gt-brand-v18-sort"><option value="name" '+(state.sort==='name'?'selected':'')+'>名稱 A–Z</option><option value="updated" '+(state.sort==='updated'?'selected':'')+'>最近編輯</option><option value="created" '+(state.sort==='created'?'selected':'')+'>最近建立</option></select></label></div>'+
 '<div class="gt-brand-v18-alpha" role="group" aria-label="品牌字母篩選">'+alpha.map(a=>'<button type="button" data-brand-v18-letter="'+a+'" aria-pressed="'+String(state.letter===a)+'" '+(a!=='ALL'&&!counts[a]?'disabled':'')+'>'+a+'</button>').join('')+'</div>'+
 '<div class="gt-brand-v18-count"><span id="gt-cloud-brand-count"></span><button type="button" data-brand-v18-reset>清除篩選</button></div><div id="gt-cloud-brand-results" aria-live="polite"></div>';
 paint();
};
document.addEventListener('input',e=>{if(e.target.id==='gt-brand-v18-search'){state.q=e.target.value;state.page=1;paint()}});
document.addEventListener('change',e=>{
 if(e.target.id==='gt-brand-v18-status'){state.status=e.target.value;state.page=1;paint()}
 if(e.target.id==='gt-brand-v18-sort'){state.sort=e.target.value;state.page=1;paint()}
});
document.addEventListener('click',e=>{
 const a=e.target.closest('[data-brand-v18-letter]');
 if(a&&!a.disabled){state.letter=a.dataset.brandV18Letter;state.page=1;paint()}
 const p=e.target.closest('[data-brand-v18-page]');
 if(p&&!p.disabled){state.page+=Number(p.dataset.brandV18Page)||0;paint()}
 if(e.target.closest('[data-brand-v18-reset]')){Object.assign(state,{q:'',status:'all',letter:'ALL',sort:'name',page:1});gtRenderCloudBrands()}
});
function foldLegacy(){
 if(!location.hash.includes('/admin')||editorKind!=='brand')return;
 const grid=document.querySelector('.editor-grid.brand-edit');if(!grid)return;
 if(grid.nextElementSibling?.classList.contains('gt-brand-v18-legacy'))return;
 if(!grid.nextElementSibling?.classList.contains('editor-actions'))return;
 const details=document.createElement('details');details.className='gt-brand-v18-legacy editor-card';
 const heading=document.createElement('summary');heading.textContent='內建品牌與本機備份（非雲端）';
 const note=document.createElement('p');note.className='cms-hint';note.textContent='舊版示範品牌與本機工作副本保留在此，並不代表正式發布。';
 grid.insertAdjacentElement('afterend',details);details.append(heading,note);
 let child=details.nextElementSibling;
 while(child){const next=child.nextElementSibling;details.append(child);child=next}
}
const previousRender=render;
render=function(...args){const result=previousRender(...args);foldLegacy();return result};
foldLegacy();
const link=document.createElement('link');link.rel='stylesheet';link.href='./gt-brand-studio-v1-8.css';document.head.append(link);
})();