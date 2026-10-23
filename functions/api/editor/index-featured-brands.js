import {requireEditor,AuthError,errorResponse} from './brand.js'
const BASE='https://8nqupq9u.api.sanity.io/v2025-02-19'
const HEADERS={'Cache-Control':'no-store'}
const CONTENT_ID='gt-index-featured-brands'
function validateSlugs(value){
 if(!Array.isArray(value)||value.length<1||value.length>4)throw new AuthError(400,'請選擇 1–4 個精選品牌')
 const slugs=value.map(x=>typeof x==='string'?x:'')
 if(slugs.some(x=>!/^[a-z0-9-]{1,90}$/.test(x))||new Set(slugs).size!==slugs.length)throw new AuthError(400,'精選品牌不得重複，且必須有有效代稱')
 return slugs
}
async function query(token,expression,perspective='raw'){
 const url=new URL(BASE+'/data/query/production')
 url.searchParams.set('perspective',perspective)
 url.searchParams.set('query',expression)
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'})
 if(!response.ok)throw new AuthError(502,'無法讀取 Sanity 資料 HTTP '+response.status)
 return (await response.json()).result
}
async function state(token){
 const records=await query(token,'*[_id in ["gt-index-featured-brands","drafts.gt-index-featured-brands"]]{_id,_rev,_updatedAt,slugs}')
 if(!Array.isArray(records))throw new AuthError(502,'精選資料格式錯誤')
 return {draft:records.find(x=>x._id==='drafts.'+CONTENT_ID)||null,
  published:records.find(x=>x._id===CONTENT_ID)||null}
}
async function publishedBrands(token){
 const records=await query(token,'*[_type=="brand" && defined(slug.current)] | order(name asc){name,"slug":slug.current}', 'published')
 if(!Array.isArray(records))throw new AuthError(502,'品牌資料格式錯誤')
 const unique=new Map()
 for(const b of records)if(typeof b.name==='string'&&/^[a-z0-9-]{1,90}$/.test(b.slug))unique.set(b.slug,{name:b.name,slug:b.slug})
 return [...unique.values()]
}
function serial(d){return d?{revision:d._rev||'',updatedAt:d._updatedAt||'',slugs:Array.isArray(d.slugs)?d.slugs:[]}:null}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'雲端尚未設定')
  const [saved,brands]=await Promise.all([state(env.SANITY_EDITOR_TOKEN),publishedBrands(env.SANITY_EDITOR_TOKEN)])
  return Response.json({ok:true,draft:serial(saved.draft),published:serial(saved.published),brands},{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'雲端尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'必須使用 JSON')
  const raw=await request.text()
  if(raw.length>1500)throw new AuthError(413,'資料太大')
  let payload
  try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  const slugs=validateSlugs(payload?.slugs)
  const [saved,brands]=await Promise.all([state(token),publishedBrands(token)])
  const allowed=new Set(brands.map(b=>b.slug))
  if(slugs.some(x=>!allowed.has(x)))throw new AuthError(400,'只能挑選目前已發布的品牌')
  const active=saved.draft||saved.published
  if((active?active._rev:'')!==(typeof payload?.revision==='string'?payload.revision:''))
   throw new AuthError(409,'精選清單已從其他裝置更新，請重新讀取')
  const mutation={mutations:[
   {createIfNotExists:{_id:'drafts.'+CONTENT_ID,_type:'gtIndexFeaturedBrands',slugs:[]}},
   {patch:{id:'drafts.'+CONTENT_ID,set:{slugs},...(saved.draft?{ifRevisionID:saved.draft._rev}:{})}}
  ],returnDocuments:true}
  const response=await fetch(BASE+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(mutation)})
  if(!response.ok)throw new AuthError(response.status===409?409:502,'儲存精選失敗 HTTP '+response.status)
  const result=await response.json()
  const draft=result.results?.find(x=>x.document?._id==='drafts.'+CONTENT_ID)?.document
  return Response.json({ok:true,draft:serial(draft)||{revision:'',slugs}},{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}
