import {requireEditor,AuthError,errorResponse} from './brand.js'

const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const headers={'Cache-Control':'no-store'}
async function query(text,parameters,token,perspective='raw'){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective',perspective)
 u.searchParams.set('query',text)
 for(const [key,value] of Object.entries(parameters||{}))u.searchParams.set('$'+key,JSON.stringify(value))
 const r=await fetch(u.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'無法查詢 Sanity 資料（HTTP '+r.status+'）')
 return (await r.json()).result
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  // Production publishing stays disabled until a deliberate launch configuration.
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true')throw new AuthError(403,'正式發布目前鎖定，請先使用獨立 Release Lab 測試')
  const t=env.SANITY_EDITOR_TOKEN
  if(!t)throw new AuthError(503,'Sanity Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'請使用 JSON')
  if(Number(request.headers.get('content-length')||0)>1800)throw new AuthError(413,'資料太大')
  const raw=await request.text()
  if(raw.length>1800)throw new AuthError(413,'資料太大')
  let body;try{body=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  const revision=typeof body?.revision==='string'?body.revision:''
  if(body?.confirmation!=='PUBLISH'||!revision||revision.length>180)throw new AuthError(400,'需要再次確認發布')
  const docs=await query('*[_id == "drafts.gt-homepage"][0]{...}',{},t)
  if(!docs||docs._rev!==revision)throw new AuthError(409,'首頁草稿已有更新，請重新讀取再發布')
  const slides=docs.slides
  if(!Array.isArray(slides)||slides.length<1||slides.length>5)throw new AuthError(400,'首頁精選篇數不正確')
  const slugs=slides.map(s=>s?.slug)
  if(slugs.some(s=>typeof s!=='string'||!/^[a-z0-9-]{1,90}$/.test(s))||new Set(slugs).size!==slugs.length)throw new AuthError(400,'精選文章格式不正確')
  // Only genuinely published Sanity articles may be featured on a released homepage.
  const publicRecords=await query('*[_type == "article" && slug.current in $slugs && !(_id in path("drafts.**"))]{ "slug":slug.current }',{slugs},t,'published')
  const publicSlugs=new Set((Array.isArray(publicRecords)?publicRecords:[]).map(x=>x?.slug).filter(Boolean))
  const unpublished=slugs.filter(s=>!publicSlugs.has(s))
  if(unpublished.length)throw new AuthError(409,'首頁包含尚未發布的文章：'+unpublished.join('、'))
  const fields=Object.fromEntries(Object.entries(docs).filter(([k])=>!['_id','_rev','_createdAt','_updatedAt'].includes(k)))
  const r=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[
    {createOrReplace:{...fields,_id:'gt-homepage',_type:'homepage'}},
    {delete:{id:docs._id,ifRevisionID:docs._rev}}
   ]})
  })
  if(!r.ok)throw new AuthError(r.status===409?409:502,r.status===409?'草稿已被更新，請重新載入':'首頁發布失敗（HTTP '+r.status+'）')
  return Response.json({ok:true,published:true},{headers})
 }catch(e){
  if(!(e instanceof AuthError))console.error('Publish homepage failed:',e?.message)
  return errorResponse(e)
 }
}
