/* GOOD THINGS, protected visual editor */
(()=>{
'use strict';
const HOST='feature-secure-editor-cloud.forme-archive.pages.dev';
const status=document.getElementById('gt-design-status');
const controls=Array.from(document.querySelectorAll('.gt-design-settings input[type="radio"]'));
const draftButton=document.getElementById('gt-design-draft-load');
const publishedButton=document.getElementById('gt-design-published-load');
const publishButton=document.getElementById('gt-design-publish');
let cloud={draft:null,published:null},loaded=false,busy=false;
const PUBLISH_READY=false; // Unlock only after the public GitHub Pages site deploys these presets.
let lastLoadedSettings=null;
const defaults={headingFont:'original',textScale:'standard',paper:'original'};
const current=()=>Object.fromEntries(Object.keys(defaults).map(k=>[k,document.querySelector('input[name="'+k+'"]:checked')?.value||defaults[k]]));
function message(s,error=false){status.textContent=s;status.classList.toggle('error',!!error)}
function preview(){
 const value=window.gtApplyDesignSettings(current());
 document.getElementById('gt-design-open-preview').href='./?gt-design-preview='+encodeURIComponent(JSON.stringify(value))+'#/';
}
function setForm(value){
 const selected=window.gtDesignSafe(value);
 controls.forEach(r=>{r.checked=selected[r.name]===r.value});
 preview();
}
function unsaved(){
 const reference=lastLoadedSettings||defaults;
 return JSON.stringify(current())!==JSON.stringify(reference);
}
function refreshButtons(){
 draftButton.hidden=!cloud.draft;publishedButton.hidden=!cloud.published;
 publishButton.disabled=!PUBLISH_READY||!cloud.draft||busy||unsaved();
 publishButton.title=!PUBLISH_READY?'正式主站尚未整合視覺樣式；目前可先儲存雲端草稿':unsaved()?'請先儲存最新設定，才可發布':'';
}
async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 let result={};try{result=await response.json()}catch{}
 if(!response.ok||!result.ok)throw Error(result.error||'HTTP '+response.status);
 return result;
}
async function read(){
 busy=true;refreshButtons();message('正在讀取視覺設定…');
 try{
  const result=await api('/api/editor/design-settings');
  cloud={draft:result.draft||null,published:result.published||null};
  loaded=true;
  lastLoadedSettings=window.gtDesignSafe(cloud.draft?.settings||cloud.published?.settings||defaults);
  setForm(lastLoadedSettings);
  message(cloud.draft?'已載入雲端草稿。修改後可再次儲存。':cloud.published?'已載入目前公開的視覺設定。':'目前使用網站原始設計，尚未建立視覺設定。');
 }catch(error){loaded=false;message('讀取失敗：'+error.message,true)}
 finally{busy=false;refreshButtons()}
}
async function save(){
 if(busy)return;
 if(!loaded)return message('請先讀取雲端資料，再儲存草稿。',true);
 busy=true;refreshButtons();message('正在儲存雲端草稿…');
 try{
  const result=await api('/api/editor/design-settings',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({settings:current(),revision:cloud.draft?.revision||cloud.published?.revision||''})
  });
  cloud.draft=result.draft;
  lastLoadedSettings=window.gtDesignSafe(cloud.draft?.settings||current());
  message('已儲存雲端草稿。主站尚未啟用視覺設定發布，公開網站沒有改變。');
 }catch(error){message('儲存失敗：'+error.message,true)}
 finally{busy=false;refreshButtons()}
}
async function publish(){
 if(busy||!cloud.draft?.revision)return;
 if(unsaved())return message('目前有尚未儲存的修改，請先儲存雲端草稿。',true);
 if(!confirm('確定把這組視覺設定發布到公開網站？已發布的文章和品牌資料不會被修改。'))return;
 busy=true;refreshButtons();message('正在發布視覺設定…');
 try{
  await api('/api/editor/publish-design-settings',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({revision:cloud.draft.revision,confirmation:'PUBLISH'})
  });
  await read();
  message('視覺設定已發布。公開網站讀取新設定後會呈現效果。');
 }catch(error){message('發布失敗：'+error.message,true)}
 finally{busy=false;refreshButtons()}
}
if(location.hostname!==HOST){message('此設定頁僅限原本受保護的編輯器網址使用。',true);document.querySelectorAll('button').forEach(b=>b.disabled=true);return}
controls.forEach(input=>input.addEventListener('change',()=>{preview();refreshButtons();if(unsaved())message('目前是本機預覽，尚未儲存或公開。')}));
document.getElementById('gt-design-load').addEventListener('click',read);
document.getElementById('gt-design-save').addEventListener('click',save);
publishButton.addEventListener('click',publish);
draftButton.addEventListener('click',()=>{setForm(cloud.draft?.settings||defaults);message('已載入雲端草稿。');refreshButtons()});
publishedButton.addEventListener('click',()=>{setForm(cloud.published?.settings||defaults);message('已載入已發布設定，修改並儲存後才能公開新版。');refreshButtons()});
setForm(defaults);
read();
})();