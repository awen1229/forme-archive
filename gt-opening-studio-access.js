/* Preview-only link to the animation chooser in existing site chrome. */
(()=>{
'use strict';
if(location.hostname!=='feature-secure-editor-cloud.forme-archive.pages.dev')return;
const url='./opening-studio.html';
const mini=document.querySelector('.gt-drawer-mini');
if(mini&&!mini.querySelector('[data-opening-studio]')){
 const a=document.createElement('a');a.href=url;a.dataset.openingStudio='1';
 a.textContent='OPENING STUDIO / 開場動畫';mini.append(a);
}
const utility=document.querySelector('.utility-bar');
if(utility&&!utility.querySelector('[data-opening-studio]')){
 const a=document.createElement('a');a.href=url;a.dataset.openingStudio='1';
 a.textContent='CHANGE OPENING ↗';a.className='gt-opening-switch';
 a.style.cssText='font:500 10px/1.5 Arial,sans-serif;letter-spacing:.075em;color:#4d6753;border-bottom:1px solid #91a793;text-decoration:none;padding-bottom:2px;margin-left:auto;white-space:nowrap';
 utility.append(a);
}
})();