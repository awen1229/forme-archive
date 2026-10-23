import {requireEditor,AuthError,errorResponse} from './brand.js'
const BASE='https://8nqupq9u.api.sanity.io/v2025-02-19'
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true')throw new AuthError(403,'正式發布目前鎖定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'必須使用 JSON')
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'雲端尚未設定')
  const raw=await request.text()
  if(raw.length>1000)throw new AuthError(413,'資料太大')
  let data
  try{data=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(data?.confirmation!=='PUBLISH'||typeof data.revision!=='string'||!data.revision)
   throw new AuthError(400,'尚未確認發布')
  async function query(expression,perspective='raw'){
   const url=new URL(BASE+'/data/query/production')
   url.searchParams.set('perspective',perspective)
   url.searchParams.set('query',expression)
   const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(!response.ok)throw new AuthError(502,'無法取得最新精選資料')
   return (await response.json()).result
  }
  const [draft,published]=await Promise.all([
   query('*[_id=="drafts.gt-index-featured-brands"][0]{_id,_rev,slugs}'),
   query('*[_type=="brand" && defined(slug.current)]{"slug":slug.current}','published')
  ])
  if(!draft||draft._rev!==data.revision)throw new AuthError(409,'草稿已更新，請重新讀取')
  const slugs=draft.slugs
  if(!Array.isArray(slugs)||slugs.length<1||slugs.length>4||
    slugs.some(x=>typeof x!=='string'||!/^[a-z0-9-]{1,90}$/.test(x))||
    new Set(slugs).size!==slugs.length)
   throw new AuthError(400,'精選品牌資料格式不正確')
  if(!Array.isArray(published))throw new AuthError(502,'無法確認已發布品牌')
  const allowed=new Set(published.map(x=>x.slug))
  if(slugs.some(x=>!allowed.has(x)))throw new AuthError(409,'精選含有未發布或已移除品牌，請重新編輯')
  const result=await fetch(BASE+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[
    {createOrReplace:{_id:'gt-index-featured-brands',_type:'gtIndexFeaturedBrands',slugs}},
    {delete:{id:draft._id,ifRevisionID:draft._rev}}
   ]})})
  if(!result.ok)throw new AuthError(result.status===409?409:502,'發布精選失敗 HTTP '+result.status)
  return Response.json({ok:true,published:true},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return errorResponse(error)}
}
