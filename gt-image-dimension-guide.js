/* GOOD THINGS, image production guide. Works for dynamically-rendered CMS fields.
   Recommendations describe export canvases, not fixed viewport pixels. */
(()=>{
'use strict';
const guides=[
 {selector:'input[data-home-cover]',label:'首頁輪播封面',size:'電腦建議 1800 × 1000 px；手機建議 1200 × 1200 px',note:'畫面比例會隨裝置改變；有字的圖片請在兩種預覽中確認安全範圍。',minW:1200,minH:800},
 {selector:'#f-cover',label:'文章封面',size:'建議 1920 × 1080 px（電腦約 16:9）',note:'手機版為不同裁切區域；包含文字時，請使用原始高解析圖。',minW:1600,minH:900},
 {selector:'input[name="coverUpload"]',label:'FEATURES 專題封面',size:'電腦 1800 × 1200 px（3:2），手機 1200 × 1500 px（4:5）',note:'同一封面兼顧兩種比例時，可使用 2000 × 2000 px 的正方形母版，再分別定位。',minW:1200,minH:1200},
 {selector:'#gt-inline-upload',label:'文章正文圖片',size:'建議寬 1800–2000 px，依內容決定長寬比',note:'可在正文圖片工具裡微調顯示寬度、比例與焦點。',minW:1400,minH:0},
 {selector:'#f-logo',label:'THE INDEX 品牌 LOGO',size:'建議 1600 × 600 px，透明背景 PNG',note:'保留原始字標比例與留白；不必硬裁成 16:9。',minW:900,minH:0}
];
let scanPending=false;
function addGuides(){
 scanPending=false;
 for(const item of guides){
  document.querySelectorAll(item.selector).forEach(input=>{
   if(input.dataset.gtImageDimensions==='ready')return;
   const block=document.createElement('div');
   block.className='gt-image-dim-guide';
   block.innerHTML='<div class="gt-image-dim-title">IMAGE SPECIFICATIONS / '+item.label+'</div>'+
    '<div class="gt-image-dim-recommend">'+item.size+'</div>'+
    '<div class="gt-image-dim-note">'+item.note+'</div>'+
    '<div class="gt-image-dim-file" role="status" aria-live="polite">選擇圖片後顯示原始像素尺寸。</div>';
   input.insertAdjacentElement('afterend',block);
   input.dataset.gtImageDimensions='ready';
  });
 }
}
function scheduleScan(){
 if(scanPending)return;scanPending=true;requestAnimationFrame(addGuides);
}
function match(input){return guides.find(g=>input.matches(g.selector))}
document.addEventListener('change',e=>{
 const input=e.target;
 if(!(input instanceof HTMLInputElement)||input.type!=='file')return;
 const rule=match(input);if(!rule)return;
 const file=input.files?.[0];if(!file)return;
 const out=input.parentElement?.querySelector('.gt-image-dim-guide .gt-image-dim-file')||
 input.nextElementSibling?.querySelector('.gt-image-dim-file');
 if(!out)return;
 out.textContent='正在讀取圖片尺寸…';
 const url=URL.createObjectURL(file),im=new Image();
 im.onload=()=>{
  URL.revokeObjectURL(url);
  if(!out.isConnected||input.files?.[0]!==file)return;
  const w=im.naturalWidth,h=im.naturalHeight;
  const small=(w<rule.minW)||(rule.minH&&h<rule.minH);
  out.textContent='所選圖片：'+w+' × '+h+' px｜'+(file.size/1048576).toFixed(2)+' MB'+
   (small?'。裁切或放大後可能較模糊，建議使用更高解析度來源。':'。尺寸已讀取，請再確認裁切範圍。');
  out.classList.toggle('gt-image-dim-warn',!!small);
 };
 im.onerror=()=>{URL.revokeObjectURL(url);out.textContent='無法取得圖片像素尺寸，請確認檔案格式。'};
 im.src=url;
},true);
const observer=new MutationObserver(scheduleScan);
function start(){
 observer.observe(document.body,{subtree:true,childList:true});
 addGuides();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();