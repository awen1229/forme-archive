/* GOOD THINGS, preview-only font loader. Font URLs and IDs are validated; main remains untouched. */
(()=>{
'use strict';
const HOST='feature-secure-editor-cloud.forme-archive.pages.dev';
if(location.hostname!==HOST)return;
const ID=/^gt-font-[a-f0-9-]{36}$/;
const CDN=/^https:\/\/cdn\.sanity\.io\/files\/8nqupq9u\/production\/[a-zA-Z0-9._-]+$/;
const files=new Map(),loaded=new Map();
const ROLES=['headlines','body','navigation'];
const FAMILY=id=>'GTFont-'+id.slice(8);
const normalise=roles=>Object.fromEntries(ROLES.map(role=>[role,typeof roles?.[role]==='string'&&ID.test(roles[role])?roles[role]:'']));
function validate(entry){
 return entry&&ID.test(entry._id)&&CDN.test(entry.url)&&['woff','woff2','otf','ttf'].includes(entry.format);
}
function fallback(role){
 return role==='headlines'?'Arial,"Noto Sans TC","PingFang TC",sans-serif':role==='body'?'"Noto Sans TC","PingFang TC",Arial,sans-serif':'Arial,"Noto Sans TC",sans-serif';
}
async function ensureFont(font){
 if(!validate(font))throw Error('字型資訊不正確');
 files.set(font._id,font);
 if(loaded.has(font._id))return loaded.get(font._id);
 const family=FAMILY(font._id);
 const pending=(async()=>{
  const path='/api/editor/font-file?id='+encodeURIComponent(font._id);
  let response;
  try{response=await fetch(path,{credentials:'same-origin',cache:'no-store'})}
  catch(error){throw Error('無法連線至本站字型服務：'+(error?.message||'網路錯誤'))}
  if(!response.ok){
   let detail='';
   try{const data=await response.json();detail=typeof data?.error==='string'?data.error:typeof data?.message==='string'?data.message:''}catch{}
   throw Error('字型讀取服務 HTTP '+response.status+(detail?'：'+detail:''))
  }
  const data=await response.arrayBuffer();
  if(data.byteLength<16)throw Error('字型檔案內容不完整')
  // Loading from an ArrayBuffer bypasses cross-origin CSS font fetches.
  let face;
  try{
   face=new FontFace(family,data,{style:'normal',weight:'400',display:'swap'});
   await face.load();
  }catch(error){throw Error('檔案已下載，但瀏覽器不支援或無法解析這個字型：'+(error?.message||'解析失敗'))}
  document.fonts.add(face);
  return family;
 })().catch(error=>{loaded.delete(font._id);throw error});
 loaded.set(font._id,pending);
 return pending;
}
function setRoleFamily(role,family){
 const selectors={
  headlines:'.gt-home-intro h1,.gt-mag-copy h2,.gt-issue-series-title .kicker,.gt-issue-card h3,.gt-feature-series-nav-content strong,.article-body h1,.article-body h2,.gt-section-top h2,.gt-design-demo h2,.gt-font-demo-headline',
  body:'.article-body p,.article-body li,.article-body .excerpt,.gt-issue-intro,.gt-issue-card p,.gt-feature-series-nav-content small,.gt-font-demo-body',
  navigation:'.site-header nav,.gt-drawer-nav,.gt-side-tab,.gt-feature-series-nav,.gt-issue-card .gt-feature-issue-read,.gt-font-demo-nav'
 };
 return selectors[role].split(',').map(x=>x.trim()+'{font-family:'+family+'!important}').join('\n');
}
async function apply(input,entries){
 const roles=normalise(input);
 if(Array.isArray(entries))entries.filter(validate).forEach(font=>files.set(font._id,font));
 const ids=[...new Set(Object.values(roles).filter(Boolean))];
 const settled=await Promise.allSettled(ids.map(id=>{
  const font=files.get(id);
  return font?ensureFont(font):Promise.reject(Error('找不到字型 '+id));
 }));
 let warnings=[];
 settled.forEach((r,i)=>{if(r.status==='rejected')warnings.push(ids[i]+': '+(r.reason?.message||String(r.reason)))});
 const style=document.getElementById('gt-custom-font-rules')||document.createElement('style');
 style.id='gt-custom-font-rules';
 style.textContent=ROLES.map(role=>{
  const id=roles[role];
  const active=id&&!warnings.some(item=>item.startsWith(id+':'));
  const family=active?'"'+FAMILY(id)+'",'+fallback(role):fallback(role);
  return active?setRoleFamily(role,family):'';
 }).join('\n');
 if(!style.isConnected)document.head.append(style);
 return {roles,warnings};
}
window.GTFontPreview={apply,ensureFont,normalise,validate,family:FAMILY,clear(){
 const style=document.getElementById('gt-custom-font-rules');if(style)style.remove();
 }};
const params=new URLSearchParams(location.search);
const raw=params.get('gt-font-preview');
if(raw&&raw.length<400){
 let roles;try{roles=normalise(JSON.parse(raw))}catch{roles=null}
 if(roles&&Object.values(roles).some(Boolean)){
  fetch('/api/editor/font-library',{credentials:'same-origin',cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('無法載入字型庫');return r.json()})
   .then(data=>apply(roles,data.fonts||[]))
   .catch(error=>console.warn('字型預覽載入失敗：',error.message));
 }
}
})();
