/* GOOD THINGS, THE INDEX selected brands. Read only published brands in public. */
(()=>{
'use strict';
const SECURE_HOST='feature-secure-editor-cloud.forme-archive.pages.dev';
const isSecure=location.hostname===SECURE_HOST&&location.protocol==='https:';
const DEFAULT_COUNT=3,MAX_COUNT=4;
let publishedSelection=null,localPreview=null;
const originalViewIndex=viewIndex;
const sortedPublic=()=>gtPublicBrands().slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'}));
const cleanSelection=value=>{
 if(!Array.isArray(value)||value.length<1||value.length>MAX_COUNT)return null;
 if(value.some(x=>typeof x!=='string'||!/^[a-z0-9-]{1,90}$/.test(x))||new Set(value).size!==value.length)return null;
 return [...value];
};
function featuredBrands(){
 const all=sortedPublic(),bySlug=new Map(all.map(b=>[b.slug,b]));
 const configured=isSecure&&localPreview?localPreview:publishedSelection;
 if(configured){const selected=configured.map(slug=>bySlug.get(slug)).filter(Boolean);if(selected.length)return selected.slice(0,MAX_COUNT)}
 return all.slice(0,DEFAULT_COUNT);
}
function editorialMarkup(){
 const items=featuredBrands();
 if(!items.length)return '<div class="gt-index-featured-grid">'+(gtPublishedOnlyPreview?gtPublicBrandEmptyCopy():'')+'</div>';
 return '<div class="gt-index-featured-grid" aria-label="THE INDEX 精選品牌">'+
 items.map((b,i)=>'<a class="gt-index-featured-item" href="#/brand/'+esc(b.slug)+'" aria-label="閱讀 '+esc(b.name)+' 品牌介紹">'+
 '<span class="gt-index-featured-no">'+String(i+1).padStart(2,'0')+' / JAPAN</span>'+
 '<div class="gt-index-featured-identity">'+gtBrandIdentity(b)+'</div>'+
 '<p class="gt-index-featured-founder">'+esc(b.founder||'')+'</p>'+
 '<span class="gt-index-featured-arrow" aria-hidden="true">'+gtArrow()+'</span>'+
 '</a>').join('')+'</div>'+
 (isSecure&&localPreview?'<p class="gt-index-featured-preview-notice">EDITOR PREVIEW / 尚未發布的精選排列</p>':'');
}
viewIndex=function(...args){
 const html=originalViewIndex.apply(this,args);
 // Replace only THE INDEX's full, repeated brand cards; the /brands A–Z directory is untouched.
 const match=/<div class="brand-grid">[\s\S]*<\/div><\/section>$/;
 if(!match.test(html))return html;
 return html.replace(match,editorialMarkup()+'</section>');
};
async function loadPublished(){
 const query='*[_id=="gt-index-featured-brands" && _type=="gtIndexFeaturedBrands"][0]{slugs}';
 const url=isSecure?'/api/public/index-featured-brands':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(query);
 try{
  const response=await fetch(url,{cache:'no-store',credentials:isSecure?'same-origin':'omit'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(isSecure&&!data.ok)throw Error(data.error||'公開設定服務異常');
  publishedSelection=cleanSelection(isSecure?data.slugs:data.result?.slugs);
 }catch(error){console.warn('INDEX 精選載入失敗，使用預設前 3 個已發布品牌',error.message)}
 if(location.hash==='#/index'||location.hash==='#/forme')render();
}
loadPublished();

if(!isSecure)return;

// Admin panel: separate editorial curation from the complete brand database.
// This module never publishes a brand record; it only updates a separate 1–4 slug selection.
const state={brands:[],items:[],draft:null,published:null,loaded:false,busy:false,message:'',error:false};
const escText=x=>esc(String(x??''));
const listEquals=(a,b)=>JSON.stringify(a||[])===JSON.stringify(b||[]);
const currentSnapshot=()=>state.draft?.slugs||state.published?.slugs||state.brands.slice(0,DEFAULT_COUNT).map(x=>x.slug);
const dirty=()=>!listEquals(state.items,currentSnapshot());
let previousBrandRender=gtRenderCloudBrands;
gtRenderCloudBrands=function(...args){
 const result=previousBrandRender.apply(this,args);
 const root=document.getElementById('gt-cloud-brands');
 if(!root)return result;
 const panel=document.createElement('section');panel.id='gt-index-featured-editor';panel.className='gt-index-featured-editor';
 root.insertAdjacentElement('afterbegin',panel);
 draw();
 if(!state.loaded&&!state.busy)refresh();
 return result;
};
function panel(){return document.getElementById('gt-index-featured-editor')}
function message(value,error=false){state.message=value;state.error=error;draw()}
function draw(){
 const root=panel();if(!root)return;
 const bySlug=new Map(state.brands.map(b=>[b.slug,b]));
 const used=new Set(state.items);
 const options=state.brands.filter(b=>!used.has(b.slug));
 root.innerHTML='<div class="gt-featured-editor-head"><div><span class="kicker">THE INDEX / CURATION</span><h3>精選品牌管理</h3><p>只決定 The Directory 展示的品牌和順序。全部品牌仍保留在 VIEW ALL BRANDS。</p></div>'+
 '<div class="gt-featured-editor-count">'+state.items.length+' / '+MAX_COUNT+' SELECTED</div></div>'+
 (state.items.length?'<ol class="gt-featured-editor-rows">'+state.items.map((slug,i)=>{
 const b=bySlug.get(slug);
 return '<li class="gt-featured-editor-item" data-slug="'+escText(slug)+'"><span class="gt-featured-editor-pos">'+String(i+1).padStart(2,'0')+'</span><span class="gt-featured-editor-name">'+escText(b?.name||slug)+'</span><div class="gt-featured-editor-controls">'+
 '<button type="button" data-index-move="up" data-at="'+i+'" '+(i===0||state.busy?'disabled':'')+' aria-label="上移 '+escText(b?.name||slug)+'">↑</button>'+
 '<button type="button" data-index-move="down" data-at="'+i+'" '+(i===state.items.length-1||state.busy?'disabled':'')+' aria-label="下移 '+escText(b?.name||slug)+'">↓</button>'+
 '<button type="button" data-index-remove="'+i+'" '+(state.busy||state.items.length===1?'disabled':'')+'>移除</button></div></li>';
 }).join('')+'</ol>':'<p class="muted">尚未選擇品牌。</p>')+
 '<div class="gt-featured-editor-add"><label for="gt-featured-add-select">新增精選品牌</label>'+
 '<select id="gt-featured-add-select" '+(state.busy||state.items.length>=MAX_COUNT||!options.length?'disabled':'')+'><option value="">選擇已發布品牌…</option>'+
 options.map(b=>'<option value="'+escText(b.slug)+'">'+escText(b.name)+'</option>').join('')+'</select>'+
 '<button type="button" data-index-add '+(state.busy||state.items.length>=MAX_COUNT||!options.length?'disabled':'')+'>加入</button></div>'+
 '<div class="gt-featured-editor-actions"><button type="button" data-index-refresh '+(state.busy?'disabled':'')+'>重新讀取</button>'+
 '<button type="button" data-index-preview '+(!state.items.length?'disabled':'')+'>預覽精選</button>'+
 '<button type="button" data-index-save class="primary" '+(state.busy||!state.loaded||state.items.length<1?'disabled':'')+'>儲存精選草稿</button>'+
 '<button type="button" data-index-publish '+(state.busy||!state.draft?.revision||dirty()?'disabled':'')+'>確認發布</button></div>'+
 '<p class="gt-featured-editor-status '+(state.error?'is-error':'')+'" role="status" aria-live="polite">'+escText(state.message||'預設選取 3 個已發布品牌，可自行調整至最多 4 個。')+'</p>';
}
async function api(path,init={}){
 const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...init});
 let data={};try{data=await r.json()}catch{}
 if(!r.ok||!data.ok)throw Error(data.error||'HTTP '+r.status);
 return data;
}
async function refresh(){
 if(state.busy)return;
 state.busy=true;draw();
 try{
  const data=await api('/api/editor/index-featured-brands');
  state.brands=Array.isArray(data.brands)?data.brands:[];
  state.draft=data.draft||null;state.published=data.published||null;
  const available=new Set(state.brands.map(x=>x.slug));
  const configured=cleanSelection(state.draft?.slugs||state.published?.slugs);
  state.items=(configured||state.brands.slice(0,DEFAULT_COUNT).map(x=>x.slug)).filter(x=>available.has(x)).slice(0,MAX_COUNT);
  if(!state.items.length&&state.brands.length)state.items=state.brands.slice(0,DEFAULT_COUNT).map(x=>x.slug);
  state.loaded=true;state.error=false;
  state.message=state.draft?'已載入雲端草稿。順序可直接調整，儲存草稿不會公開。':state.published?'已載入已發布精選。':'目前尚無精選設定，預設顯示前 3 個已發布品牌。';
 }catch(error){state.loaded=false;state.error=true;state.message='精選資料讀取失敗：'+error.message}
 finally{state.busy=false;draw()}
}
async function save(){
 if(state.busy||!state.loaded||!state.items.length)return;
 state.busy=true;draw();
 try{
  const data=await api('/api/editor/index-featured-brands',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({slugs:state.items,revision:state.draft?.revision||state.published?.revision||''})
  });
  state.draft=data.draft;
  state.error=false;state.message='已儲存雲端精選草稿，尚未公開。';
 }catch(error){state.error=true;state.message='儲存失敗：'+error.message}
 finally{state.busy=false;draw()}
}
async function publish(){
 if(state.busy||!state.draft?.revision||dirty())return;
 if(!confirm('確認更新 THE INDEX 公開精選品牌？不會改動任何品牌內容，也不會影響完整 A–Z 品牌目錄。'))return;
 state.busy=true;draw();
 try{
  await api('/api/editor/publish-index-featured-brands',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({revision:state.draft.revision,confirmation:'PUBLISH'})
  });
  localPreview=null;
  await loadPublished();
  state.busy=false;await refresh();
  state.message='已發布 THE INDEX 精選品牌。';
 }catch(error){state.error=true;state.message='發布失敗：'+error.message;state.busy=false;draw()}
}
document.addEventListener('click',e=>{
 const root=e.target.closest('#gt-index-featured-editor');
 if(!root)return;
 const button=e.target.closest('button');if(!button||button.disabled)return;
 if(button.hasAttribute('data-index-refresh')){refresh();return}
 if(button.hasAttribute('data-index-save')){save();return}
 if(button.hasAttribute('data-index-publish')){publish();return}
 if(button.hasAttribute('data-index-preview')){
  localPreview=[...state.items];
  location.hash='#/index';
  if(location.hash==='#/index')render();
  return;
 }
 if(button.hasAttribute('data-index-add')){
  const select=root.querySelector('#gt-featured-add-select');
  const slug=select?.value;
  if(slug&&!state.items.includes(slug)&&state.brands.some(x=>x.slug===slug)&&state.items.length<MAX_COUNT){
   state.items.push(slug);message('目前僅為本機選取，請儲存雲端草稿。');
  }return;
 }
 const move=button.dataset.indexMove,idx=Number(button.dataset.at);
 if(move&&Number.isInteger(idx)&&idx>=0&&idx<state.items.length){
  const to=idx+(move==='up'?-1:1);
  if(to>=0&&to<state.items.length){
   [state.items[to],state.items[idx]]=[state.items[idx],state.items[to]];
   message('排序已更新，尚未儲存。');
  }return;
 }
 if(button.hasAttribute('data-index-remove')){
  const idx=Number(button.dataset.indexRemove);
  if(Number.isInteger(idx)&&idx>=0&&idx<state.items.length&&state.items.length>1){
   state.items.splice(idx,1);
   message('精選已調整，尚未儲存。');
  }
 }
});
})();
