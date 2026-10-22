import {requireEditor,AuthError,errorResponse} from './brand.js'

const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DATASET='production'
const NO_STORE={'Cache-Control':'no-store'}
const builtin=new Set(['comoli-everyday','auralee-materials','graphpaper-editorial','maatee-fabric','ancellm-aging'])
async function query(q,token,perspective='published'){
 const url=new URL(API+'/data/query/'+DATASET)
 url.searchParams.set('perspective',perspective)
 url.searchParams.set('query',q)
 const response=await fetch(url.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok)throw new AuthError(502,'Sanity 查詢失敗（HTTP '+response.status+'）')
 return (await response.json()).result
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity Token 尚未設定')
  const t=env.SANITY_EDITOR_TOKEN
  const [brands,articles,home,site,drafts]=await Promise.all([
   query('*[_type=="brand" && !(_id in path("drafts.**"))][0...500]{_id,name,slug}',t),
   query('*[_type=="article" && !(_id in path("drafts.**"))][0...500]{_id,title,slug,excerpt,body,"cover":cover.asset->url,source}',t),
   query('*[_id=="gt-homepage"][0]{slides}',t),
   query('*[_id=="gt-site-content"][0]{fieldsJson}',t),
   query('*[_id in path("drafts.**") && _type in ["brand","article","homepage","gtSiteContent"]][0...500]{_id,_type}',t,'raw')
  ])
  const issues=[],counts={brands:brands.length,articles:articles.length,unpublishedDrafts:drafts.length}
  const slugs=new Set([...builtin])
  for(const a of articles){
   if(!a.slug?.current||!a.title||!a.excerpt||!Array.isArray(a.body)||!a.body.length)
    issues.push({severity:'error',area:'ARTICLES',message:'已發布文章的必要欄位缺失',id:a._id})
   if(a.slug?.current)slugs.add(a.slug.current)
   if(/\btest\b|測試|release lab/i.test(String(a.title)))
    issues.push({severity:'warning',area:'ARTICLES',message:'已發布文章疑似測試資料',id:a._id})
  }
  for(const b of brands){
   if(!b.slug?.current||!b.name)issues.push({severity:'error',area:'BRANDS',message:'品牌名稱或 slug 缺失',id:b._id})
   if(/\btest\b|測試|release lab/i.test(String(b.name)))
    issues.push({severity:'warning',area:'BRANDS',message:'已發布品牌疑似測試資料',id:b._id})
  }
  if(home?.slides){
   for(const slide of home.slides){
    if(!slugs.has(slide.slug))issues.push({severity:'error',area:'HOMEPAGE',message:'首頁精選連到不存在或未發布文章',id:slide.slug})
   }
  }
  if(site?.fieldsJson){
   try{const fields=JSON.parse(site.fieldsJson);if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('invalid')}
   catch{issues.push({severity:'error',area:'SITE CONTENT',message:'公開網站文字 JSON 無效',id:'gt-site-content'})}
  }
  const duplicate=(items)=>{const values=new Set(),dupes=[];for(const item of items){const slug=item.slug?.current;if(!slug)continue;if(values.has(slug))dupes.push(slug);values.add(slug)}return dupes}
  for(const slug of duplicate(articles))issues.push({severity:'error',area:'ARTICLES',message:'已發布文章 slug 重複',id:slug})
  for(const slug of duplicate(brands))issues.push({severity:'error',area:'BRANDS',message:'已發布品牌 slug 重複',id:slug})
  return Response.json({ok:true,mode:'read-only',dataset:DATASET,productionMutated:false,counts,homepagePublished:!!home,siteContentPublished:!!site,issues,readyForLaunch:!issues.some(x=>x.severity==='error')},{headers:NO_STORE})
 }catch(e){if(!(e instanceof AuthError))console.error('Launch audit failed',e?.message);return errorResponse(e)}
}