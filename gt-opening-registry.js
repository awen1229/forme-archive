/* GOOD THINGS, / Opening Studio registry. Preview hostname only, no server publishing.
   This catalog is intentionally allowlisted. Never load external or user-provided iframe URLs.
   Preference is browser-local to this preview origin; no site-content/Sanity mutations. */
(()=>{
'use strict';
const HOST='feature-secure-editor-cloud.forme-archive.pages.dev';
const KEY='gt-opening-preference-v1';
const modes=[
 {id:'draw',type:'draw',group:'互動識別',name:'Draw the Comma',cn:'手繪逗號',desc:'用滑鼠或手指畫一筆，變成原始逗號與完整 LOGO。',study:'opening-lab-draw-comma-v30.html',version:'V30'},
 {id:'physics21',type:'physics21',group:'互動識別',name:'Comma Physics',cn:'滑動翻轉',desc:'字母在逗號裡碰撞、離場，再由右側組回 LOGO。',study:'opening-lab-physics-v21.html',version:'V21'},
 {id:'physics10',type:'physics10',group:'互動識別',name:'Letter Tumble',cn:'重力字母',desc:'輕觸或滑動讓真正的 LOGO 字母依物理運動。',study:'opening-lab-physics-v10.html',version:'V10'},
 {id:'ink',type:'lab',group:'印刷與編輯',name:'Ink Trace',cn:'墨跡描繪',desc:'沿原始逗號輪廓慢慢留下筆畫。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'ink',duration:5400,version:'V24 / 01'},
 {id:'letters',type:'lab',group:'印刷與編輯',name:'Letter Study',cn:'字母回位',desc:'原始字母從四周進場，精確回到自己的位置。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'letters',duration:5400,version:'V24 / 02'},
 {id:'paper',type:'lab',group:'印刷與編輯',name:'Page Reveal',cn:'雜誌揭頁',desc:'讓紙張的翻動顯出文字與 LOGO。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'paper',duration:5400,version:'V24 / 03'},
 {id:'print',type:'lab',group:'印刷與編輯',name:'Editorial Press',cn:'左右印刷',desc:'模擬印刷機一行行顯影的節奏。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'print',duration:5400,version:'V24 / 04'},
 {id:'offset',type:'lab',group:'印刷與編輯',name:'Offset Proof',cn:'套色校樣',desc:'印刷色層略微偏移後精準對齊。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'offset',duration:5400,version:'V24 / 05'},
 {id:'proof',type:'lab',group:'印刷與編輯',name:'Editorial Proof',cn:'編輯校樣',desc:'字母與逗號在有版面感的印刷紙張裡逐步定稿。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'proof',duration:5400,version:'V24 / 06'},
 {id:'anchor',type:'lab',group:'印刷與編輯',name:'Comma as Anchor',cn:'倒置逗號',desc:'以逗號本身作為版面旋轉與重新定位的核心。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'anchor',duration:5400,version:'V24 / 07'},
 {id:'registration',type:'lab',group:'印刷與編輯',name:'Registration',cn:'套印對位',desc:'原始標誌經過校準與疊印成形。',study:'opening-lab-alternatives-v24.html',param:'mode',value:'registration',duration:5400,version:'V24 / 08'},
 {id:'v25-material',type:'lab',group:'材質與空間',name:'Material Fold',cn:'布料折疊',desc:'借用材質、折線與空間的節奏呈現原始標誌。',study:'opening-lab-design-v25.html',param:'kind',value:'material',duration:4900,version:'V25 / 01'},
 {id:'v25-space',type:'lab',group:'材質與空間',name:'Spatial Type',cn:'空間字母',desc:'從空間排列重新找回字母位置。',study:'opening-lab-design-v25.html',param:'kind',value:'space',duration:4900,version:'V25 / 02'},
 {id:'v25-index',type:'lab',group:'材質與空間',name:'Index Motion',cn:'索引翻動',desc:'編輯式的字母分頁與位置轉換。',study:'opening-lab-design-v25.html',param:'kind',value:'index',duration:4900,version:'V25 / 03'},
 {id:'v26-material',type:'lab',group:'材質與空間',name:'Material Imprint',cn:'材質壓印',desc:'讓逗號像印記留在紙張或材質上。',study:'opening-lab-design-v26.html',param:'kind',value:'material',duration:4100,version:'V26 / 01'},
 {id:'v26-space',type:'lab',group:'材質與空間',name:'Spatial Fold',cn:'立體折線',desc:'字母在幾何平面之間切換位置。',study:'opening-lab-design-v26.html',param:'kind',value:'space',duration:4100,version:'V26 / 02'},
 {id:'v26-index',type:'lab',group:'材質與空間',name:'Index Layout',cn:'版面重組',desc:'由排版格線找回原始 LOGO 的位置。',study:'opening-lab-design-v26.html',param:'kind',value:'index',duration:4100,version:'V26 / 03'},
 {id:'magnetic',type:'lab',group:'材質與空間',name:'Magnetic Type',cn:'磁力字母',desc:'十個真實字母沿磁力軌道吸附成字。',study:'opening-lab-design-v27.html',param:'kind',value:'magnetic',duration:4300,version:'V27 / 01'},
 {id:'diecut',type:'lab',group:'材質與空間',name:'Paper Die-Cut',cn:'紙張鏤空',desc:'在紙面裁切與留白之間顯出 LOGO。',study:'opening-lab-design-v27.html',param:'kind',value:'diecut',duration:4300,version:'V27 / 02'},
 {id:'exposure',type:'lab',group:'材質與空間',name:'Light Exposure',cn:'光影顯影',desc:'LOGO 在細微光影與曝光變化中成形。',study:'opening-lab-design-v27.html',param:'kind',value:'exposure',duration:4300,version:'V27 / 03'},
 {id:'ripple',type:'lab',group:'材質與空間',name:'Elastic Type',cn:'彈性字形',desc:'字母在彈性波動後安靜歸位。',study:'opening-lab-design-v27.html',param:'kind',value:'ripple',duration:4300,version:'V27 / 04'},
 {id:'editorial28',type:'lab',group:'極簡編輯',name:'Editorial Anchor',cn:'編輯錨點',desc:'只留一個逗號作為版面視覺重心。',study:'opening-lab-editorial-v28.html',duration:3400,version:'V28'},
 {id:'editorial29',type:'lab',group:'極簡編輯',name:'Editorial Refined',cn:'簡約逗號',desc:'精簡轉場、留白與精準的原始字母排列。',study:'opening-lab-editorial-v29.html',duration:2850,version:'V29'},
 {id:'none',type:'none',group:'設定',name:'No Opening',cn:'直接進首頁',desc:'不播放動畫，直接閱讀 GOOD THINGS,。',study:'',version:'OFF'}
];
function get(id){return modes.find(m=>m.id===id)||null}
function selected(){
 try{const saved=localStorage.getItem(KEY);return get(saved)?saved:'draw'}catch(_){return 'draw'}
}
function save(id){
 if(!get(id))return false;
 try{localStorage.setItem(KEY,id);return true}catch(_){return false}
}
function sessionKey(id){return 'gt-opening-seen-v1-'+id}
function seen(id){try{return sessionStorage.getItem(sessionKey(id))==='done'}catch(_){return false}}
function markSeen(id){try{sessionStorage.setItem(sessionKey(id),'done')}catch(_){}}
function cleanUrl(){
 const url=new URL(location.href);
 let changed=false;
 for(const key of ['opening','replay']){
  if(url.searchParams.has(key)){url.searchParams.delete(key);changed=true}
 }
 if(changed)history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
function urlFor(id,site=false){
 const base=new URL('./'+(site?'':'opening-studio.html'),location.href);
 if(site){base.searchParams.set('opening',get(id)?id:'draw');base.searchParams.set('replay','1');base.hash='#/'}
 return base.toString();
}
if(location.hostname===HOST&&location.protocol==='https:'){
 window.GTOpening={modes,get,selected,save,seen,markSeen,cleanUrl,urlFor,KEY};
}
})();