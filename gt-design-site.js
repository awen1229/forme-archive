/* GOOD THINGS, visual style presets. Published settings only; draft preview only on protected editor host. */
(()=>{
'use strict';
const SECURE='feature-secure-editor-cloud.forme-archive.pages.dev';
const ALLOWED={headingFont:['original','sans','serif','mixed'],textScale:['compact','standard','large'],paper:['original','white']};
const DEFAULT={headingFont:'original',textScale:'standard',paper:'original'};
const safe=value=>{
 const result={...DEFAULT};
 if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const key of Object.keys(DEFAULT))if(ALLOWED[key].includes(value[key]))result[key]=value[key];
 return result;
};
function apply(value){
 const data=safe(value),root=document.documentElement;
 root.dataset.gtDesignFont=data.headingFont;
 root.dataset.gtDesignScale=data.textScale;
 root.dataset.gtDesignPaper=data.paper;
 return data;
}
window.gtApplyDesignSettings=apply;
window.gtDesignSafe=safe;
const params=new URLSearchParams(location.search);
const override=params.get('gt-design-preview');
let previewValid=false;
if(location.hostname===SECURE&&override&&override.length<500){
 try{
  const value=JSON.parse(override);
  if(value&&typeof value==='object'&&!Array.isArray(value)){apply(value);previewValid=true}
 }catch{}
}
async function loadPublished(){
 if(previewValid)return;
 const protectedOrigin=location.hostname===SECURE;
 const query='*[_id=="gt-design-settings" && _type=="gtDesignSettings"][0]{settingsJson}';
 const url=protectedOrigin?'/api/public/design-settings':'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production?perspective=published&query='+encodeURIComponent(query);
 try{
  const r=await fetch(url,{cache:'no-store',credentials:protectedOrigin?'same-origin':'omit'});
  if(!r.ok)return;
  const j=await r.json();
  if(protectedOrigin&&!j.ok)return;
  const raw=protectedOrigin?j.settingsJson:j.result?.settingsJson;
  if(typeof raw==='string')apply(JSON.parse(raw));
 }catch(error){console.warn('Design settings could not load:',error.message)}
}
function addEditorLink(){
 if(location.hostname!==SECURE||!location.hash.includes('/admin'))return;
 const tabs=document.querySelector('.editor-tabs');
 if(!tabs)return;
 if(!tabs.querySelector('.gt-design-editor-link')){
 const link=document.createElement('a');
 link.href='./design-settings.html';
 link.className='gt-design-editor-link';
 link.textContent='視覺設定 ↗';
 tabs.appendChild(link);
 }
 if(!tabs.querySelector('.gt-font-library-link')){
  const fontLink=document.createElement('a');
  fontLink.href='./font-library.html';
  fontLink.className='gt-design-editor-link gt-font-library-link';
  fontLink.textContent='字型庫 / FONTS';
  tabs.appendChild(fontLink);
 }
}
if(location.hostname===SECURE&&typeof render==='function'){
 const previousRender=render;
 render=function(...args){const result=previousRender(...args);addEditorLink();return result};
 addEditorLink();
}
loadPublished();

/* Opt-in directory module; loaded only on the actual editorial site, not the standalone design panel. */
if(typeof viewIndex==='function' && typeof gtPublicBrands==='function'){
 const style=document.createElement('link');style.rel='stylesheet';style.href='./gt-index-featured.css?v=20261024-logo2';document.head.appendChild(style);
 const script=document.createElement('script');script.src='./gt-index-featured.js?v=20261024-logo2';document.body.appendChild(script);
}
})();