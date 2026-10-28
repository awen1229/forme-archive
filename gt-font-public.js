/* GOOD THINGS, | Published, owner-approved font assignments.
   Public website reads only the explicitly published Sanity document.
   It does not fetch protected editor drafts or expose an editor interface. */
(()=>{
'use strict';
const API='https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production';
const ROLES=['headlines','body','navigation'];
const ID=/^gt-font-[a-f0-9-]{36}$/;
const CDN=/^https:\/\/cdn\.sanity\.io\/files\/8nqupq9u\/production\/[a-zA-Z0-9._-]+$/;
const FORMATS=['woff2','woff','otf','ttf'];
const FALLBACK={headlines:'Arial,"Noto Sans TC","PingFang TC",sans-serif',body:'"Noto Sans TC","PingFang TC",Arial,sans-serif',navigation:'Arial,"Noto Sans TC",sans-serif'};
const ROLE_SELECTORS={
 headlines:[
  '.gt-home-intro h1','.gt-lead h1','.gt-mag-copy h2','.gt-carousel-copy h2',
  '.gt-section-top h2','.gt-discover-head h2','.gt-discover-links a strong',
  '.gt-subject h3','.article-row h3','.gt-content-intro h2',
  '.gt-feature-copy h2','.gt-forme h2','.gt-edit-note .gt-note',
  '.section-heading h1','.section-heading h2','.brand-grid .brand-card h3',
  '.brand-profile .detail-title','.detail-title',
  '.gt-issue-series-title .kicker','.gt-issue-card h3',
  '.gt-feature-series-nav-content strong',
  '.article-body h1','.article-body h2','.article-body h3',
  '.article-body h4','.article-body h5','.article-body h6',
  '.gt-design-demo h2','.gt-font-demo-headline'
 ],
 body:[
  '.gt-home-intro .gt-deck','.gt-lead p','.gt-mag-copy p',
  '.gt-carousel-copy p','.gt-hero-note p','.gt-section-top p',
  '.gt-subject p','.article-row p','.gt-content-intro p',
  '.gt-feature-copy p','.gt-forme p','.gt-intro-footer .gt-note',
  '.gt-intro-footer .gt-credit','.gt-edit-note p',
  '.brand-grid .brand-card p','.brand-profile p','.detail-copy',
  '.gt-issue-intro','.gt-issue-card p',
  '.article-body p','.article-body li','.article-body .excerpt',
  '.article-body blockquote','.article-body blockquote p',
  '.source-section dd','.gt-font-demo-body'
 ],
 navigation:[
  '.utility-bar','.site-header nav','.desktop-nav a','.mobile-nav a',
  '.site-header .brandmark .eyebrow','.gt-side-tab',
  '.gt-drawer-nav','.gt-drawer-nav a>span','.gt-drawer-nav a>b',
  '.gt-drawer-nav small','.gt-drawer-label','.gt-drawer-secondary a',
  '.gt-drawer-chips a','.gt-drawer-mini a','.gt-drawer-footer',
  '.gt-meta','.gt-home-intro .gt-label','.gt-feature-intro',
  '.gt-mag-type','.gt-mag-read','.gt-mag-photo-note',
  '.gt-mag-progress','.gt-mag-tips','.gt-carousel-index',
  '.gt-carousel-copy .gt-carousel-category','.gt-hero-note .gt-subnote',
  '.gt-cover .cover-label','.gt-cover .cover-counter','.gt-caption',
  '.gt-section-top .kicker','.gt-sectional .kicker',
  '.kicker','.eyebrow','.meta-tag','.link-arrow','.back',
  '.gt-subject small','.gt-topic-filter a',
  '.gt-alpha-head','.gt-alpha-key','.gt-alpha-feedback',
  '.gt-issue-card .gt-feature-issue-read','.gt-feature-series-nav',
  '.gt-feature-series-nav-content small',
  '.brand-profile .brand-profile-breadcrumb .kicker',
  '.brand-profile .brand-profile-breadcrumb .back',
  '.brand-grid .brand-card .brand-no',
  '.article-row small','.article-row .meta',
  '.article-row .article-meta','.article-row .meta-date',
  '.gt-discover-links a small','.gt-discover-links .kicker',
  '.gt-forme-subbrand','.gt-forme-subbrand span',
  '.gt-font-demo-nav'
 ]
};
function validRoles(value){
 const r={headlines:'',body:'',navigation:''};
 if(!value||typeof value!=='object'||Array.isArray(value))return r;
 for(const key of ROLES)if(typeof value[key]==='string'&&ID.test(value[key]))r[key]=value[key];
 return r;
}
async function query(groq,params={}){
 const u=new URL(API);
 u.searchParams.set('perspective','published');
 u.searchParams.set('query',groq);
 for(const [key,value] of Object.entries(params))u.searchParams.set('$'+key,JSON.stringify(value));
 const res=await fetch(u.toString(),{cache:'no-store',credentials:'omit'});
 if(!res.ok)throw Error('Public font query '+res.status);
 return (await res.json()).result;
}
async function activate(){
 const doc=await query('*[_id=="gt-font-assignments" && _type=="gtFontAssignments"][0]{roles}');
 const roles=validRoles(doc?.roles);
 const ids=[...new Set(ROLES.map(key=>roles[key]).filter(Boolean))];
 if(!ids.length)return;
 const fonts=await query('*[_type=="gtWebFont" && _id in $ids]{_id,url,format}',{ids});
 if(!Array.isArray(fonts))return;
 const byId=new Map(fonts.filter(f=>f&&ID.test(f._id)&&CDN.test(f.url)&&FORMATS.includes(f.format)).map(f=>[f._id,f]));
 const families=new Map();
 await Promise.all(ids.map(async id=>{
   const record=byId.get(id);
   if(!record)return;
   const family='GTWeb-'+id.slice(8);
   try{
     const face=new FontFace(family,'url("'+record.url+'")',{style:'normal',weight:'400',display:'swap'});
     document.fonts.add(face);
     await face.load();
     families.set(id,family);
   }catch(e){console.warn('Published font could not load:',e.message)}
 }));
 const css=ROLES.map(role=>{
   const id=roles[role],family=families.get(id);
   if(!family)return '';
   return ROLE_SELECTORS[role].map(selector=>selector+'{font-family:"'+family+'",'+FALLBACK[role]+'!important}').join('\n');
 }).filter(Boolean).join('\n');
 if(!css)return;
 const style=document.createElement('style');
 style.id='gt-published-fonts';
 style.textContent=css;
 document.head.appendChild(style);
}
activate().catch(error=>console.warn('Published font settings unavailable:',error.message));
})();
