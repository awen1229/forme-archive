/* GOOD THINGS, cloud controls for the existing Opening Studio.
   Editing and publishing are separate, authenticated, version-checked operations. */
(()=>{
'use strict';
if(location.hostname!=='feature-secure-editor-cloud.forme-archive.pages.dev')return;
const reg=window.GTOpening,viewer=document.querySelector('.workspace .viewer'),repeat=document.getElementById('repeat');
if(!reg||!viewer||!repeat||typeof window.gtOpeningStudioGet!=='function')return;
const panel=document.createElement('section');
panel.id='gt-opening-cloud-panel';
panel.style.cssText='border-top:1px solid #b9cbb9;margin-top:26px;padding:23px 0 8px';
panel.innerHTML='<div class="label">SANITY / EDITORIAL CLOUD</div>'+
 '<h2 style="font:500 23px/1.4 Arial,sans-serif;margin:8px 0">正式站動畫管理</h2>'+
 '<p style="font-size:12px;line-height:1.9;color:#6d776e">先儲存雲端草稿，再確認發布。正式站尚未安裝動畫程式時，發布按鈕會維持鎖定；本機選擇不會影響其他人。</p>'+
 '<div id="gt-opening-cloud-state" role="status" aria-live="polite" style="font-size:12px;line-height:1.8;min-height:28px;color:#596b5d"></div>'+
 '<div class="actions" style="margin:10px 0 14px">'+
 '<button class="btn" data-oc="refresh" type="button">重新讀取雲端</button>'+
 '<button class="btn" data-oc="draft" type="button" disabled>載入草稿</button>'+
 '<button class="btn" data-oc="published" type="button" disabled>載入已發布</button>'+
 '<button class="btn primary" data-oc="save" type="button" disabled>儲存雲端草稿</button>'+
 '<button class="btn" data-oc="publish" type="button" disabled>發布到正式站</button></div>'+
 '<p style="font-size:11px;line-height:1.85;color:#768277">發布只會更新這組首頁動畫設定，不會修改文章、品牌或 LOGO。正式站程式需先完成一次性部署。</p>';
viewer.append(panel);
const state=panel.querySelector('#gt-opening-cloud-state');
const buttons=Object.fromEntries([...panel.querySelectorAll('[data-oc]')].map(b=>[b.dataset.oc,b]));
let draft=null,published=null,ready=false,loaded=false,busy=false;
const current=()=>window.gtOpeningStudioGet();
const isGood=d=>!!(d&&!d.invalid&&d.settings&&reg.get(d.settings.mode)&&['once','always'].includes(d.settings.repeat));
const eq=(a,b)=>!!a&&!!b&&a.mode===b.mode&&a.repeat===b.repeat;
function note(s,error=false){state.textContent=s;state.style.color=error?'#a34135':'#596b5d'}
function draw(){
 const value=current(),base=isGood(draft)?draft:isGood(published)?published:null;
 const changed=!eq(value,base?.settings);
 buttons.refresh.disabled=busy;
 buttons.draft.disabled=busy||!isGood(draft);
 buttons.published.disabled=busy||!isGood(published);
 buttons.save.disabled=busy||!loaded||!changed;
 buttons.publish.disabled=busy||!loaded||!isGood(draft)||changed||!ready;
 buttons.publish.title=!ready?'正式站動畫程式尚未完成部署，不能發布。':changed?'請先儲存雲端草稿。':'';
}
async function api(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 let data={};try{data=await response.json()}catch(_){}
 if(!response.ok||!data.ok)throw Error(data.error||'HTTP '+response.status);
 return data;
}
async function reload(){
 if(busy)return;busy=true;draw();note('正在讀取雲端設定…');
 try{
  const data=await api('/api/editor/opening-settings');
  draft=data.draft||null;published=data.published||null;ready=!!data.readiness?.publishEnabled;loaded=true;
  const label=isGood(draft)?'雲端草稿：'+reg.get(draft.settings.mode).cn:
   isGood(published)?'已發布：'+reg.get(published.settings.mode).cn:'尚未建立雲端動畫設定';
  note(label+(ready?' ／ 發布權限已開啟':' ／ 正式站動畫程式尚待部署，發布功能鎖定'));
 }catch(e){loaded=false;note('讀取失敗：'+e.message,true)}
 finally{busy=false;draw()}
}
function load(d){
 if(!isGood(d))return;
 if(!reg.save(d.settings.mode))return note('無法儲存瀏覽器設定。',true);
 try{localStorage.setItem('gt-opening-repeat-v1',d.settings.repeat)}catch(_){}
 repeat.checked=d.settings.repeat==='always';
 const query=document.getElementById('query');if(query){query.value='';query.dispatchEvent(new Event('input'))}
 window.gtOpeningStudioSelect(d.settings.mode);
 // Existing studio tracks the preview selection and saved browser preference independently.
 note('已載入「'+reg.get(d.settings.mode).cn+'」到本機預覽；雲端資料沒有被修改。');
 draw();
}
async function save(){
 if(!loaded||busy)return;
 const settings=current();
 if(!reg.get(settings.mode))return note('請選擇有效的開場動畫。',true);
 busy=true;draw();note('正在儲存雲端草稿…');
 try{
  const data=await api('/api/editor/opening-settings',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({settings,revision:draft?.revision||published?.revision||''})
  });
  draft=data.draft;ready=!!data.readiness?.publishEnabled;
  note('已儲存「'+reg.get(settings.mode).cn+'」的雲端草稿，正式站未改變。');
 }catch(e){note('儲存失敗：'+e.message,true)}
 finally{busy=false;draw()}
}
async function publish(){
 if(!isGood(draft)||!ready||busy)return;
 const settings=current();
 if(!eq(settings,draft.settings))return note('目前選擇與雲端草稿不同，請先儲存。',true);
 const label=reg.get(settings.mode).cn;
 if(!confirm('發布「'+label+'」到正式網站？\n播放頻率：'+(settings.repeat==='always'?'每次開啟首頁':'每個分頁首次')+'。\n\n此操作將更新公開的動畫設定，請先確認桌面與手機版均已測試。'))return;
 busy=true;draw();note('正在發布正式站設定…');
 try{
  await api('/api/editor/publish-opening-settings',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({revision:draft.revision,mode:settings.mode,repeat:settings.repeat,confirmation:'PUBLISH_OPENING'})
  });
  busy=false;await reload();note('動畫設定已發布；正式站將讀取已發布版本。');
 }catch(e){note('發布失敗：'+e.message,true)}
 finally{busy=false;draw()}
}
buttons.refresh.addEventListener('click',reload);
buttons.draft.addEventListener('click',()=>load(draft));
buttons.published.addEventListener('click',()=>load(published));
buttons.save.addEventListener('click',save);
buttons.publish.addEventListener('click',publish);
repeat.addEventListener('change',draw);
const name=document.getElementById('active-name');
if(name)new MutationObserver(draw).observe(name,{childList:true,subtree:true});
reload();
})();