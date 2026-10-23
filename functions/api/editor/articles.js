import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  const q='*[_type == "article" && !(_id in path("versions.**"))] | order(_updatedAt desc)[0...1000]{_id,_rev,_updatedAt,title,slug,category,brand,subject,subjects,publicationSection,excerpt,publishedAt}'
  const u=new URL(API+'/data/query/production')
  u.searchParams.set('perspective','raw');u.searchParams.set('query',q)
  const response=await fetch(u.toString(),{headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN},cache:'no-store'})
  if(!response.ok)throw new AuthError(502,'無法讀取 Sanity 文章清單（HTTP '+response.status+'）')
  const payload=await response.json()
  if(!Array.isArray(payload.result))throw new AuthError(502,'Sanity 文章清單格式不正確')
  const rows=new Map()
  for(const doc of payload.result){
   if(!doc?._id||!doc.slug?.current||!doc.title)continue
   const slug=doc.slug.current
   if(!/^[a-z0-9-]{1,90}$/.test(slug))continue
   const draft=doc._id.startsWith('drafts.')
   const row=rows.get(slug)||{slug,status:'published',hasPublished:false}
   if(!draft)row.hasPublished=true
   if(draft||row.status!=='draft'){
    Object.assign(row,{slug,title:doc.title,brand:doc.brand||'',category:doc.category||'',
      excerpt:doc.excerpt||'',subject:doc.subject||'clothing',subjects:Array.isArray(doc.subjects)?doc.subjects:[],publicationSection:doc.publicationSection||'stories',publishedAt:doc.publishedAt||'',updatedAt:doc._updatedAt||'',
      revision:doc._rev||'',status:draft?'draft':'published'})
   }
   rows.set(slug,row)
  }
  return Response.json({ok:true,records:[...rows.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))},{headers:{'Cache-Control':'no-store'}})
 }catch(e){if(!(e instanceof AuthError))console.error('Article list failed',e?.message);return errorResponse(e)}
}
