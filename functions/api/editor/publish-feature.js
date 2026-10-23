import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19',HEADERS={'Cache-Control':'no-store'}
async function query(q,token,params={},perspective='raw'){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective',perspective);u.searchParams.set('query',q)
 for(const [k,v] of Object.entries(params))u.searchParams.set('$'+k,JSON.stringify(v))
 const r=await fetch(u.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'Sanity 資料查詢失敗')
 return (await r.json()).result
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true')throw new AuthError(403,'正式發布目前鎖定')
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'僅接受 JSON')
  const raw=await request.text()
  if(raw.length>2000)throw new AuthError(413,'資料過大')
  let input;try{input=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式無效')}
  const slug=typeof input?.slug==='string'?input.slug:'',revision=input?.revision
  if(!/^[a-z0-9-]{1,90}$/.test(slug)||typeof revision!=='string'||!revision||input.confirmation!=='PUBLISH')throw new AuthError(400,'發布確認無效')
  const drafts=await query('*[_type=="featureIssue" && _id in path("drafts.**") && slug.current==$slug][0...2]{...}',token,{slug})
  if(!Array.isArray(drafts)||drafts.length!==1)throw new AuthError(409,'找不到唯一的專題草稿')
  const d=drafts[0]
  if(d._rev!==revision)throw new AuthError(409,'專題草稿已被更新，請重新載入')
  if(!d.title||!d.summary||!['behind-the-brand','good-pickups','seasonal-notes'].includes(d.series))throw new AuthError(400,'專題內容尚未完整')
  if(/\btest\b|測試/i.test(d.title))throw new AuthError(400,'不能發布測試專題')
  const slugs=Array.isArray(d.articleSlugs)?d.articleSlugs:[]
  if(!slugs.length||slugs.length>40||slugs.some(s=>!(/^[a-z0-9-]{1,90}$/.test(s)))||new Set(slugs).size!==slugs.length)throw new AuthError(400,'至少選擇一篇有效文章')
  const brands=Array.isArray(d.brandSlugs)?d.brandSlugs:[]
  if(brands.some(s=>!(/^[a-z0-9-]{1,90}$/.test(s))))throw new AuthError(400,'品牌關聯格式錯誤')
  const publishedArticles=await query('*[_type=="article" && slug.current in $slugs && !(_id in path("drafts.**"))]{"slug":slug.current}',token,{slugs},'published')
  const found=new Set((publishedArticles||[]).map(x=>x.slug))
  if(slugs.some(s=>!found.has(s)))throw new AuthError(409,'專題包含尚未公開的文章，請先發布文章')
  if(brands.length){
   const publishedBrands=await query('*[_type=="brand" && slug.current in $slugs && !(_id in path("drafts.**"))]{"slug":slug.current}',token,{slugs:brands},'published')
   const foundBrands=new Set((publishedBrands||[]).map(x=>x.slug))
   if(brands.some(s=>!foundBrands.has(s)))throw new AuthError(409,'專題包含尚未公開的品牌，請先發布品牌')
  }
  const doc=Object.fromEntries(Object.entries(d).filter(([key])=>!['_id','_rev','_createdAt','_updatedAt'].includes(key)))
  doc._id=d._id.replace(/^drafts\./,'');doc._type='featureIssue'
  const r=await fetch(API+'/data/mutate/production',{method:'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[{createOrReplace:doc},{delete:{id:d._id,ifRevisionID:d._rev}}]})
  })
  if(!r.ok)throw new AuthError(r.status===409?409:502,'專題發布失敗（HTTP '+r.status+'）')
  return Response.json({ok:true,publishedId:doc._id},{headers:HEADERS})
 }catch(e){if(!(e instanceof AuthError))console.error('Feature publish failed',e?.message);return errorResponse(e)}
}
