import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  // Production publishing stays disabled until a deliberate launch configuration.
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true')throw new AuthError(403,'正式發布目前鎖定，請先使用獨立 Release Lab 測試')
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'請使用 JSON')
  if(Number(request.headers.get('content-length')||0)>2500)throw new AuthError(413,'資料過大')
  const raw=await request.text()
  if(raw.length>2500)throw new AuthError(413,'資料過大')
  let input;try{input=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 無效')}
  const slug=typeof input?.slug==='string'?input.slug.trim():''
  const revision=typeof input?.revision==='string'?input.revision.trim():''
  if(!/^[a-z0-9-]{1,90}$/.test(slug)||!revision||input.confirmation!=='PUBLISH')throw new AuthError(400,'缺少發布確認')
  const u=new URL(API+'/data/query/production')
  u.searchParams.set('perspective','raw')
  u.searchParams.set('query','*[_type == "article" && slug.current == $slug && _id in path("drafts.**")][0...2]{...}')
  u.searchParams.set('$slug',JSON.stringify(slug))
  const response=await fetch(u.toString(),{headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN},cache:'no-store'})
  if(!response.ok)throw new AuthError(502,'無法讀取待發布草稿')
  const found=(await response.json()).result
  if(!Array.isArray(found)||found.length!==1)throw new AuthError(409,'找不到唯一的文章草稿，請重新讀取')
  const d=found[0]
  if(!d?._rev||d._rev!==revision)throw new AuthError(409,'草稿已更新，請重新讀取')
  if(!d.title||!d.excerpt||!Array.isArray(d.body)||!d.body.length)throw new AuthError(400,'文章內容尚未完整')
  if(/\btest\b|測試/i.test(String(d.title)))throw new AuthError(400,'不能發布測試文章')
  const publishedId=d._id.slice('drafts.'.length)
  if(!publishedId||publishedId.startsWith('drafts.')||publishedId.startsWith('versions.'))throw new AuthError(400,'草稿識別碼無效')
  const doc=Object.fromEntries(Object.entries(d).filter(([k])=>!['_id','_createdAt','_updatedAt','_rev'].includes(k)))
  doc._id=publishedId;doc._type='article'
  const save=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[
    {createOrReplace:doc},
    {delete:{id:d._id,ifRevisionID:d._rev}}
   ]})
  })
  if(!save.ok)throw new AuthError(save.status===409?409:502,save.status===409?'草稿已被更新，請重新讀取':'發布失敗 HTTP '+save.status)
  return Response.json({ok:true,publishedId},{headers:{'Cache-Control':'no-store'}})
 }catch(e){if(!(e instanceof AuthError))console.error('Article publish failed',e?.message);return errorResponse(e)}
}
