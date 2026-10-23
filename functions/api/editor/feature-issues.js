import {requireEditor,AuthError,errorResponse} from './brand.js'

const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DATASET='production'
const HEADERS={'Cache-Control':'no-store'}
const SLUG=/^[a-z0-9-]{1,90}$/
const SERIES=new Set(['behind-the-brand','good-pickups','seasonal-notes'])
const str=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):''
const uniqueSlugs=(v,max)=>{
 if(!Array.isArray(v)||v.length>max)throw new AuthError(400,'關聯資料數量超過限制')
 const out=[...new Set(v.map(x=>str(x,90)))]
 if(out.some(x=>!SLUG.test(x)))throw new AuthError(400,'關聯資料網址無效')
 return out
}
async function query(q,token,params={}){
 const u=new URL(API+'/data/query/'+DATASET)
 u.searchParams.set('perspective','raw')
 u.searchParams.set('query',q)
 for(const [key,value] of Object.entries(params))u.searchParams.set('$'+key,JSON.stringify(value))
 const r=await fetch(u.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'Sanity 專題查詢失敗（HTTP '+r.status+'）')
 return (await r.json()).result
}
async function mutate(mutations,token){
 const r=await fetch(API+'/data/mutate/'+DATASET,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({mutations,returnDocuments:true}),cache:'no-store'
 })
 if(!r.ok)throw new AuthError(r.status===409?409:502,r.status===409?'雲端專題已被更新，請重新載入':'Sanity 專題儲存失敗（HTTP '+r.status+'）')
 return r.json()
}
async function find(slug,token){
 const docs=await query('*[_type=="featureIssue" && slug.current==$slug && !(_id in path("versions.**"))][0...20]{...,"coverUrl":cover.asset->url}',token,{slug})
 if(!Array.isArray(docs))throw new AuthError(502,'專題資料格式有誤')
 const drafts=docs.filter(x=>x._id?.startsWith('drafts.'))
 const published=docs.filter(x=>!x._id?.startsWith('drafts.'))
 if(drafts.length>1||published.length>1)throw new AuthError(409,'重複的專題網址代稱，請先檢查資料')
 return {draft:drafts[0]||null,published:published[0]||null}
}
function serialize(doc,published=false){
 return {
  slug:doc.slug?.current||'',title:doc.title||'',series:doc.series||'behind-the-brand',
  summary:doc.summary||'',articleSlugs:Array.isArray(doc.articleSlugs)?doc.articleSlugs:[],
  brandSlugs:Array.isArray(doc.brandSlugs)?doc.brandSlugs:[],
  cover:doc.coverUrl||'',coverFit:doc.coverFit==='contain'?'contain':'cover',
  coverX:Number.isFinite(doc.coverX)?doc.coverX:50,coverY:Number.isFinite(doc.coverY)?doc.coverY:50,
  status:doc._id.startsWith('drafts.')?'draft':'published',hasPublished:published,
  revision:doc._rev||'',updatedAt:doc._updatedAt||''
 }
}
async function upload(data,token){
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data)
 if(!match||match[2].length>5_600_000)throw new AuthError(413,'專題封面格式錯誤或過大，請壓縮 PNG、JPG 或 WebP')
 let bytes
 try{bytes=Uint8Array.from(atob(match[2]),x=>x.charCodeAt(0))}
 catch{throw new AuthError(400,'無法解析專題封面')}
 const r=await fetch(API+'/assets/images/'+DATASET+'?filename=good-things-feature-cover',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':match[1]},body:bytes
 })
 if(!r.ok)throw new AuthError(502,'上傳專題封面失敗（HTTP '+r.status+'）')
 const item=(await r.json()).document
 if(!item?._id?.startsWith('image-'))throw new AuthError(502,'封面回應格式錯誤')
 return {_type:'image',asset:{_type:'reference',_ref:item._id}}
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  const slug=new URL(request.url).searchParams.get('slug')
  if(slug){
   if(!SLUG.test(slug))throw new AuthError(400,'專題網址代稱無效')
   const {draft,published}=await find(slug,env.SANITY_EDITOR_TOKEN)
   if(!draft&&!published)throw new AuthError(404,'找不到專題')
   return Response.json({ok:true,record:serialize(draft||published,!!published)},{headers:HEADERS})
  }
  const docs=await query('*[_type=="featureIssue" && !(_id in path("versions.**"))] | order(_updatedAt desc)[0...160]{...,"coverUrl":cover.asset->url}',env.SANITY_EDITOR_TOKEN)
  if(!Array.isArray(docs))throw new AuthError(502,'專題清單格式錯誤')
  const grouped=new Map()
  for(const d of docs){
   if(!d.slug?.current||!SLUG.test(d.slug.current)||!d.title)continue
   const current=grouped.get(d.slug.current)
   const draft=d._id.startsWith('drafts.')
   if(!current||draft){grouped.set(d.slug.current,serialize(d,!!current?.hasPublished||!draft))}
   else current.hasPublished=true
  }
  return Response.json({ok:true,records:[...grouped.values()]},{headers:HEADERS})
 }catch(e){if(!(e instanceof AuthError))console.error('Feature read failed:',e?.message);return errorResponse(e)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'僅接受 JSON')
  if(Number(request.headers.get('content-length')||0)>6_000_000)throw new AuthError(413,'專題資料超過大小限制')
  const raw=await request.text()
  if(raw.length>6_000_000)throw new AuthError(413,'專題資料超過大小限制')
  let input
  try{input=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AuthError(400,'專題資料格式錯誤')
  const slug=str(input.slug,90),title=str(input.title,220),summary=str(input.summary,3000),series=str(input.series,60)
  if(!SLUG.test(slug)||!title||!summary||!SERIES.has(series))throw new AuthError(400,'請填寫有效的專題網址、名稱、系列及介紹')
  const articleSlugs=uniqueSlugs(input.articleSlugs,40)
  const brandSlugs=uniqueSlugs(input.brandSlugs,8)
  const cover=str(input.cover,5_600_000)
  const {draft,published}=await find(slug,env.SANITY_EDITOR_TOKEN)
  const revision=str(input.revision,180)
  if(draft&&revision!==draft._rev)throw new AuthError(409,'專題草稿已有更新，請重新載入')
  if(!draft&&published&&revision!==published._rev)throw new AuthError(409,'已發布專題有更新，請重新載入')
  const base=draft||published
  const id=base?._id?.replace(/^drafts\./,'')||'gt-feature-'+slug
  const draftId='drafts.'+id
  const patch={title,slug:{_type:'slug',current:slug},series,summary,articleSlugs,brandSlugs,
   coverFit:input.coverFit==='contain'?'contain':'cover',
   coverX:Math.max(0,Math.min(100,Number(input.coverX??50)||0)),
   coverY:Math.max(0,Math.min(100,Number(input.coverY??50)||0))}
  const unset=[]
  if(cover.startsWith('data:'))patch.cover=await upload(cover,env.SANITY_EDITOR_TOKEN)
  else if(cover==='')unset.push('cover')
  else if(cover!==base?.coverUrl)throw new AuthError(400,'請用上傳欄位選擇封面圖片')
  const fields=published?Object.fromEntries(Object.entries(published).filter(([k])=>!['_id','_createdAt','_updatedAt','_rev','coverUrl'].includes(k))):{}
  const result=await mutate([
   {createIfNotExists:{...fields,_id:draftId,_type:'featureIssue'}},
   {patch:{id:draftId,set:patch,...(unset.length?{unset}:{}),...(draft?{ifRevisionID:draft._rev}:{})}}
  ],env.SANITY_EDITOR_TOKEN)
  const updated=result.results?.find(x=>x.document?._id===draftId)?.document
  return Response.json({ok:true,revision:updated?._rev||'',draftId},{headers:HEADERS})
 }catch(e){if(!(e instanceof AuthError))console.error('Feature save failed:',e?.message);return errorResponse(e)}
}
