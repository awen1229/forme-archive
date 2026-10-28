(function gtIndexProfileV2(){
  'use strict';
  // Isolated visual upgrade. Keep public main and unrelated routes unchanged.
  if(location.hostname!=='feature-secure-editor-cloud.forme-archive.pages.dev')return;
  if(typeof viewBrand!=='function'||typeof gtPublicBrands!=='function')return;
  viewBrand=function(slug){
    const all=gtPublicBrands().slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'en',{sensitivity:'base'}));
    const index=all.findIndex(b=>b.slug===slug);
    if(index<0)return notFound();
    const b=all[index];
    const number=String(index+1).padStart(2,'0');
    const related=gtSortedArticles(gtPublicArticles().filter(a=>a.brand===b.name)).slice(0,4);
    const note=String(b.editorNote||'').trim();
    const noteTitle=String(b.editorNoteTitle||'').trim();
    const story=String(b.desc||'').trim();
    const next=all.length>1?all[(index+1)%all.length]:null;
    return `<section class="section brand-profile gt-index-profile-v2">
      <div class="gt-profile-breadcrumb">
        <a href="#/brands"><svg class="ui-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H3m0 0 6-6m-6 6 6 6"/></svg> ALL BRANDS</a>
        <span>THE INDEX / PROFILE ${number}</span>
      </div>
      <header class="gt-profile-hero">
        <div class="gt-profile-identity">
          <span class="gt-profile-eyebrow">THE INDEX / BRAND PROFILE</span>
          ${b.logo?`<div class="gt-detail-logo-frame" ${gtLogoVars(b)}><img class="brand-logo-detail" src="${esc(b.logo)}" alt="${esc(b.name)} 品牌標誌"></div>`:''}
          <h1 class="detail-title gt-profile-title">${esc(b.name)}</h1>
          <p class="gt-profile-deck">CLOTHING, DESIGN &amp; THE STORIES BEHIND THEM.</p>
        </div>
        <aside class="gt-profile-facts" aria-label="品牌基本資料">
          ${b.founder?`<div class="gt-profile-meta-row"><small>FOUNDER / CREATIVE DIRECTION</small><strong>${esc(b.founder)}</strong></div>`:''}
          ${b.founded&&b.founded!=='—'?`<div class="gt-profile-meta-row"><small>ESTABLISHED</small><strong>${esc(b.founded)}</strong></div>`:''}
          ${b.tags?.length?`<div class="gt-profile-tags" aria-label="品牌標籤">${b.tags.slice(0,6).map(t=>`<span class="gt-profile-tag">${esc(t)}</span>`).join('')}</div>`:''}
          ${b.url?`<a class="gt-profile-website" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">OFFICIAL WEBSITE <span aria-hidden="true">↗</span></a>`:''}
        </aside>
      </header>
      ${story?`<section class="gt-profile-section" aria-labelledby="gt-profile-story-title">
        <div class="gt-profile-section-label"><span class="gt-profile-section-no">01 / THE STORY</span><small>品牌背景與理念</small></div>
        <div class="gt-profile-story"><h2 id="gt-profile-story-title">The Idea</h2><p>${esc(story)}</p></div>
      </section>`:''}
      ${note?`<section class="gt-profile-editor-note" aria-labelledby="gt-profile-note-label">
        <div class="gt-profile-note-meta"><strong id="gt-profile-note-label">EDITOR'S NOTE<br>GOOD THINGS, / ${number}</strong><small>OUR PERSPECTIVE</small></div>
        <div class="gt-profile-note-copy">${noteTitle?`<h2>${esc(noteTitle)}</h2>`:''}<p>${esc(note)}</p><div class="gt-profile-note-sign">GOOD THINGS, EDITORIAL VIEW</div></div>
      </section>`:''}
      <section class="gt-profile-related" aria-labelledby="gt-profile-related-title">
        <header class="gt-profile-related-head"><div><span class="gt-profile-section-no">0${story?note?3:2:note?2:1} / CONTINUE READING</span><h2 id="gt-profile-related-title">Related Stories</h2></div><small>FROM THE JOURNAL</small></header>
        ${related.length?related.map((a,i)=>articleRow(a,i)).join(''):next?`<a class="gt-profile-next" href="#/brand/${esc(next.slug)}"><span><small>EXPLORE ANOTHER BRAND</small><br><strong>${esc(next.name)}</strong></span><span aria-hidden="true">↗</span></a>`:'<p class="muted" style="margin-top:22px">相關文章正在整理中。</p>'}
      </section>
      <div class="gt-profile-end"><a href="#/brands">← ALL BRANDS</a><span>GOOD THINGS, / THE INDEX</span></div>
    </section>`;
  };
  // Any already opened brand is repainted with the selected new design.
  if(location.hash.startsWith('#/brand/'))render();
})();