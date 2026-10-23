import {requireEditor, AuthError, errorResponse} from './brand.js'

const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DATASET='production'
const exactSlug=/^[a-z0-9-]{1,90}$/
const trim=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):''
const safeDate=v=>!v || /^\d{4}-\d{2}-\d{2}$/.test(v)
const validHttps=v=>!v || /^https:\/\/[^\s<>"']{1,1800}$/i.test(v)
const noStore={'Cache-Control':'no-store'}
async function api(path,token,options={}){
 const response=await fetch(API+path,{...options,headers:{...options.headers,Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok)throw new AuthError(response.status===409?409:502,'Sanity 服務回傳 HTTP '+response.status)
 return response.json()
}
async function findBySlug(slug,token){
 const u=new URL(API+'/data/query/'+DATASET)
 u.searchParams.set('perspective','raw')
 u.searchParams.set('query','*[_type == "article" && slug.current == $slug && !(_id in path("versions.**"))][0...10]{...}')
 u.searchParams.set('$slug',JSON.stringify(slug))
 const result=(await api('/data/query/'+DATASET+u.search,token)).result
 const items=Array.isArray(result)?result:[]
 const draft=items.find(x=>x._id?.startsWith('drafts.'))
 const published=items.find(x=>x._id&&!x._id.startsWith('drafts.'))
 if(items.filter(x=>x._id?.startsWith('drafts.')).length>1)throw new AuthError(409,'偵測到同網址的重複文章草稿')
 return {draft,published}
}
async function uploadCover(data,token){
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data)
 if(!match)throw new AuthError(400,'封面只能上傳 PNG、JPG 或 WebP')
 if(match[2].length>5_600_000)throw new AuthError(413,'封面圖片超過大小限制，請壓縮')
 let bytes
 try{bytes=Uint8Array.from(atob(match[2]),x=>x.charCodeAt(0))}catch{throw new AuthError(400,'封面格式無法解析')}
 const reply=await fetch(API+'/assets/images/'+DATASET+'?filename=good-things-article-cover',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':match[1]},body:bytes})
 if(!reply.ok)throw new AuthError(502,'封面上傳失敗 HTTP '+reply.status)
 const doc=(await reply.json()).document
 if(!doc?._id?.startsWith('image-'))throw new AuthError(502,'封面上傳回應無效')
 return {id:doc._id,url:doc.url||''}
}

export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  const slug=new URL(request.url).searchParams.get('slug')||''
  if(!exactSlug.test(slug))throw new AuthError(400,'無效文章網址代稱')
  const {draft,published}=await findBySlug(slug,env.SANITY_EDITOR_TOKEN)
  const row=draft||published
  if(!row)throw new AuthError(404,'找不到這篇雲端文章')
  const body=Array.isArray(row.body)?row.body.filter(x=>typeof x==='string'):[]
  const record={
   slug,title:row.title||'',brand:row.brand||'GOOD THINGS',subject:row.subject||'clothing',
   category:row.category||'EDITORIAL / 原創觀察',publicationSection:['stories','features','both'].includes(row.publicationSection)?row.publicationSection:'both',subjects:Array.isArray(row.subjects)?row.subjects:[],publishedAt:row.publishedAt||'',
   createdAt:row.createdAt||'',updatedAt:row.updatedAt||'',excerpt:row.excerpt||'',
   body,writer:row.writer||'',editor:row.editor||'',source:row.source||'',sourceTitle:row.sourceTitle||'',
   publisher:row.publisher||'',sourceAuthor:row.sourceAuthor||'',sourceDate:row.sourceDate||'',
   reviewedAt:row.reviewedAt||'',cover:row.cover?.asset?.url||row.coverUrl||'',
   coverFit:row.coverFit||'cover',coverMobileFit:row.coverMobileFit==='contain'?'contain':'cover',coverMobileZoom:Number.isFinite(row.coverMobileZoom)?row.coverMobileZoom:100,coverZoom:Number.isFinite(row.coverZoom)?row.coverZoom:100,coverX:Number.isFinite(row.coverX)?row.coverX:50,coverY:Number.isFinite(row.coverY)?row.coverY:50,coverMobileX:Number.isFinite(row.coverMobileX)?row.coverMobileX:(Number.isFinite(row.coverX)?row.coverX:50),coverMobileY:Number.isFinite(row.coverMobileY)?row.coverMobileY:(Number.isFinite(row.coverY)?row.coverY:50),
   revision:row._rev||'',status:draft?'draft':'published',hasPublished:!!published
  }
  // A ref can be projected with a lookup even if the raw object only stores the asset reference.
  if(!record.cover && row.cover?.asset?._ref){
   const u=new URL(API+'/data/query/'+DATASET)
   u.searchParams.set('perspective','raw')
   u.searchParams.set('query','*[_id==$id][0].url')
   u.searchParams.set('$id',JSON.stringify(row.cover.asset._ref))
   const result=(await api('/data/query/'+DATASET+u.search,env.SANITY_EDITOR_TOKEN)).result
   record.cover=typeof result==='string'?result:''
  }
  return Response.json({ok:true,record},{headers:noStore})
 }catch(e){if(!(e instanceof AuthError))console.error('Article read failed',e?.message);return errorResponse(e)}
}

export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 編輯 Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'請傳入 JSON')
  if(Number(request.headers.get('content-length')||0)>6_000_000)throw new AuthError(413,'文章圖片或內容過大')
  const raw=await request.text()
  if(raw.length>6_000_000)throw new AuthError(413,'文章圖片或內容過大')
  let input
  try{input=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(!input || typeof input!=='object'||Array.isArray(input))throw new AuthError(400,'文章資料格式錯誤')
  const slug=trim(input.slug,90)
  if(!exactSlug.test(slug))throw new AuthError(400,'文章網址代稱無效')
  const title=trim(input.title,220),excerpt=trim(input.excerpt,5000)
  if(!title||!excerpt||!Array.isArray(input.body))throw new AuthError(400,'請填寫文章標題、摘要與正文')
  const body=input.body.slice(0,100).map(x=>trim(x,8000)).filter(Boolean)
  if(!body.length||JSON.stringify(body).length>110_000)throw new AuthError(400,'文章正文為空或超過限制')
  const publishedAt=trim(input.publishedAt,10),sourceDate=trim(input.sourceDate,10)
  if(!safeDate(publishedAt)||!safeDate(sourceDate))throw new AuthError(400,'日期格式無效')
  const source=trim(input.source,1800)
  if(!validHttps(source))throw new AuthError(400,'原文連結請使用 https://')
  const cover=trim(input.cover,5_600_000)
  if(cover && !cover.startsWith('data:') && !/^https:\/\/cdn\.sanity\.io\/images\/8nqupq9u\/production\/[^\s<>"']+$/i.test(cover)){
    throw new AuthError(400,'請重新上傳封面圖片，或使用原有的 Sanity 封面')
  }
  const {draft,published}=await findBySlug(slug,env.SANITY_EDITOR_TOKEN)
  const revision=trim(input.revision,150)
  // A stale local backup cannot silently replace a newer cloud draft.
  if(draft && (!revision || revision!==draft._rev))throw new AuthError(409,'雲端草稿已有更新，請從雲端列表重新載入再修改')
  if(!draft && published && revision && revision!==published._rev)throw new AuthError(409,'已發布文章有更新，請從雲端列表重新載入')
  const base=draft||published
  const publishedId=(base?._id||('gt-article-'+slug)).replace(/^drafts\./,'')
  const draftId='drafts.'+publishedId
  const patch={
   title,slug:{_type:'slug',current:slug},
   brand:trim(input.brand,160)||'GOOD THINGS',subject:trim(input.subject,80)||'clothing',
   category:trim(input.category,120),publicationSection:['stories','features','both'].includes(input.publicationSection)?input.publicationSection:(base?.publicationSection||(base?'both':'stories')),subjects:[...new Set([trim(input.subject,80)||'clothing',...(Array.isArray(input.subjects)?input.subjects:[]).slice(0,8).map(x=>trim(x,80))].filter(x=>['clothing','style','people','places','objects','notes'].includes(x)))],publishedAt,
   createdAt:trim(input.createdAt,35)||base?.createdAt||new Date().toISOString(),
   updatedAt:new Date().toISOString(),excerpt,body,
   writer:trim(input.writer,160),editor:trim(input.editor,160),
   coverFit:input.coverFit==='contain'?'contain':'cover',
   coverMobileFit:input.coverMobileFit==='contain'?'contain':'cover',
   coverMobileZoom:Math.max(100,Math.min(200,Number(input.coverMobileZoom??100)||100)),coverZoom:Math.max(100,Math.min(250,Number(input.coverZoom??100)||100)),
   coverX:Math.max(0,Math.min(100,Number(input.coverX??50)||0)),
   coverY:Math.max(0,Math.min(100,Number(input.coverY??50)||0)),
   coverMobileX:Math.max(0,Math.min(100,Number(input.coverMobileX??input.coverX??50)||0)),coverMobileY:Math.max(0,Math.min(100,Number(input.coverMobileY??input.coverY??50)||0)),
   source,sourceTitle:trim(input.sourceTitle,500),publisher:trim(input.publisher,200),
   sourceAuthor:trim(input.sourceAuthor,200),sourceDate,
   reviewedAt:trim(input.reviewedAt,10)
  }
  let coverUrl=''
  if(cover.startsWith('data:')){
   const upload=await uploadCover(cover,env.SANITY_EDITOR_TOKEN)
   patch.cover={_type:'image',asset:{_type:'reference',_ref:upload.id}}
   coverUrl=upload.url
  }else if(cover.startsWith('https://cdn.sanity.io/')){
   coverUrl=cover
   if(!base?.cover?.asset?._ref){
    // Retain existing Sanity media, but don't accept a manually pasted foreign asset reference.
    throw new AuthError(400,'請用上傳欄位新增封面')
   }
  }
  const publicFields=published?Object.fromEntries(Object.entries(published).filter(([k])=>!['_id','_createdAt','_updatedAt','_rev'].includes(k))):{}
  const mutations=[
   {createIfNotExists:{...publicFields,_id:draftId,_type:'article'}},
   {patch:{id:draftId,set:patch,...(draft?{ifRevisionID:draft._rev}:{})}}
  ]
  // Keep the previous asset if no new image was uploaded.
  const result=await api('/data/mutate/'+DATASET,env.SANITY_EDITOR_TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mutations,returnDocuments:true})})
  const updated=result.results?.find(x=>x.document?._id===draftId)?.document
  return Response.json({ok:true,draftId,revision:updated?._rev||'',coverUrl},{headers:noStore})
 }catch(e){if(!(e instanceof AuthError))console.error('Article cloud save failed',e?.message);return errorResponse(e)}
}
