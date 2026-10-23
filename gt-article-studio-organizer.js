/* GOOD THINGS, article studio layout: desktop sections, single-fold mobile editing. */
(()=>{
const desktop=window.matchMedia('(min-width:761px)');
function normaliseNested(f){
  // Older studio scripts wrapped existing accordions in an extra accordion.
  // Unwrap only when its sole content is the actual inner details element.
  for(const inner of [...f.querySelectorAll('details.gt-editor-fold details.gt-editor-fold')]){
    const outer=inner.parentElement;
    if(!outer?.matches?.('details.gt-editor-fold'))continue;
    const content=[...outer.children].filter(el=>el.tagName!=='SUMMARY');
    if(content.length===1&&content[0]===inner)outer.replaceWith(inner);
  }
}
function organise(){
  if(!location.hash.includes('/admin')||editorKind!=='article')return;
  const f=document.getElementById('editor-form');if(!f)return;
  normaliseNested(f);
  for(const panel of f.querySelectorAll('details.gt-editor-fold')){
    if(desktop.matches){
      if(!panel.hasAttribute('data-gt-desktop-controlled')){
        panel.dataset.gtPreviousOpen=panel.open?'yes':'no';
        panel.dataset.gtDesktopControlled='true';
      }
      panel.open=true;
    }else if(panel.hasAttribute('data-gt-desktop-controlled')){
      panel.open=panel.dataset.gtPreviousOpen==='yes';
      delete panel.dataset.gtPreviousOpen;
      delete panel.dataset.gtDesktopControlled;
    }
  }
}
const originalRender=render;
render=function(...args){const result=originalRender(...args);organise();return result;};
if(typeof desktop.addEventListener==='function')desktop.addEventListener('change',organise);
else window.addEventListener('resize',organise);
organise();
const style=document.createElement('style');style.textContent='.gt-article-library-stats{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.gt-article-library-stats span{border:1px solid #c7c7bc;padding:7px 12px;font-size:12px}.gt-article-library-tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0}.gt-article-library-tools label{display:grid;gap:6px;font-size:12px;min-width:0}.gt-article-library-tools input,.gt-article-library-tools select{max-width:100%;width:100%;padding:10px;border:1px solid #bcbeb2;background:#faf9f5;color:#252822;font-size:14px}.gt-article-library-footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:15px 0}.gt-article-library-footer span{font-size:12px;margin-right:auto}.gt-article-list{max-height:580px;overflow:auto;border-top:1px solid #d0d0c8}.gt-article-list-row strong{overflow-wrap:anywhere}.gt-article-row-meta{font-size:11px;color:#777;margin-top:7px}.gt-editor-fold{border:1px solid #c5c7bc;padding:0 14px 15px;margin:8px 0;min-width:0}.gt-editor-fold summary{padding:16px 3px;cursor:pointer;font-weight:600;font-size:13px}.gt-editor-fold[open] summary{border-bottom:1px solid #d6d8cf;margin-bottom:13px}.gt-editor-fold label{margin:12px 0}@media(max-width:760px){.gt-article-library-tools{grid-template-columns:repeat(2,minmax(0,1fr))}.gt-article-library-tools label:first-child{grid-column:1/-1}.gt-article-list{max-height:500px}}\n/* v1.7 / compact mobile editorial studio */\n@media(max-width:760px){\n .gt-article-library-tools{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px}\n .gt-article-library-tools label:first-child{grid-column:1/-1}\n .gt-article-library-tools input,.gt-article-library-tools select{min-height:44px;box-sizing:border-box}\n .gt-article-library-footer{align-items:stretch;gap:8px}\n .gt-article-library-footer span{width:100%;margin-right:0}\n .gt-article-library-footer button{flex:1;min-width:0;white-space:normal;padding:10px 8px}\n .gt-article-list{max-height:none;overflow:visible}\n .gt-article-list-row{display:flex;flex-direction:column;align-items:stretch;gap:13px;padding:17px 0}\n .gt-article-list-row>div:first-child{width:100%;min-width:0}\n .gt-article-list-row strong{display:block;margin:8px 0;overflow-wrap:anywhere;line-height:1.5}\n .gt-article-list-row .gt-record-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:8px}\n .gt-article-list-row .gt-record-buttons button{min-width:0;min-height:42px;width:100%;padding:9px 5px;white-space:normal}\n .gt-article-list-row .gt-record-buttons button:only-child{grid-column:1/-1}\n .gt-editor-fold{padding:0 12px 12px}\n .gt-editor-fold summary{padding:16px 0;line-height:1.6}\n .editor-fields .gt-extra-subjects{max-width:100%}\n .editor-fields .gt-extra-options{grid-template-columns:repeat(2,minmax(0,1fr))}\n .editor-grid{grid-template-columns:minmax(0,1fr)}\n .gt-cover-control,.gt-desktop-crop,.gt-crop-local{min-width:0;max-width:100%}\n}\n@media(max-width:380px){\n .gt-article-library-tools{grid-template-columns:1fr}\n .gt-article-library-tools label:first-child{grid-column:auto}\n}';style.textContent += `
/* Desktop does not need to click accordion controls for article editing. */
@media(min-width:761px){
 #editor-form details.gt-editor-fold{border:0;border-top:1px solid #d0d3c9;padding:16px 0 10px;margin:22px 0}
 #editor-form details.gt-editor-fold>summary{display:block;list-style:none;cursor:default;pointer-events:none;padding:2px 0 15px;margin:0;border:0;font-weight:600;font-size:14px;color:#363c34}
 #editor-form details.gt-editor-fold>summary::-webkit-details-marker{display:none}
 #editor-form details.gt-editor-fold>summary::marker{content:''}
 #editor-form details.gt-editor-fold>summary::before,#editor-form details.gt-editor-fold>summary::after{display:none}
 #editor-form details.gt-editor-fold>summary span{display:none}
 #editor-form details.gt-editor-fold label{margin:10px 0}
}
`;document.head.append(style);})();