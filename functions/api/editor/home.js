import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DATASET='production'
const HOME_ID='gt-homepage'
const MAX_BYTES=7_000_000
const str=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):''
const slugPattern=/^[a-z0-9-]{1,90}$/
const headers={'Cache-Control':'no-store'}
function normalizeSlides(raw){
 if(!Array.isArray(raw)||raw.length<1||raw.length>5)throw new AuthError(400,'首頁精選需有 1 至 5 篇文章')
 const slugs=new Set()
 return raw.map((slide,i)=>{
  const slug=str(slide?.slug,90)
  if(!slugPattern.test(slug)||slugs.has(slug))throw new AuthError(400,'精選文章無效或重複')
  slugs.add(slug)
  const title=str(slide?.title,220),excerpt=str(slide?.excerpt,1200)
  const cover=str(slide?.cover||slide?.coverUrl,1_500_000)
  if(cover && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(cover) &&
     !/^https:\/\/cdn\.sanity\.io\/images\/8nqupq9u\/production\/[a-z0-9-]+(?:\.[a-z0-9]+)?(?:\?[^<>"'\s]*)?$/i.test(cover)){
   throw new AuthError(400,'首頁封面必須為上傳圖片或此 Sanity 專案圖片網址')
  }
  if(cover.length>1_400_000)throw new AuthError(413,'單張首頁封面壓縮後仍過大')
  return {_key:'featured-'+slug,_type:'featuredSlide',slug,title,excerpt,coverUrl:cover,coverFit:slide.coverFit==='contain'?'contain':'cover',coverMobileFit:slide.coverMobileFit==='contain'?'contain':'cover',
   coverZoom:Math.max(100,Math.min(250,Number(slide.coverZoom??100)||100)),
   coverMobileZoom:Math.max(100,Math.min(200,Number(slide.coverMobileZoom??100)||100)),
   coverX:Math.max(0,Math.min(100,Number(slide.coverX??50)||0)),coverY:Math.max(0,Math.min(100,Number(slide.coverY??50)||0)),
   coverMobileX:Math.max(0,Math.min(100,Number(slide.coverMobileX??slide.coverX??50)||0)),
   coverMobileY:Math.max(0,Math.min(100,Number(slide.coverMobileY??slide.coverY??50)||0))}
 })
}
async function fetchHomes(token){
 const url=new URL(API+'/data/query/'+DATASET)
 url.searchParams.set('perspective','raw')
 url.searchParams.set('query','*[_id in ["drafts.gt-homepage","gt-homepage"]]{_id,_rev,_updatedAt,slides}')
 const response=await fetch(url.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok)throw new AuthError(502,'無法讀取首頁資料（Sanity HTTP '+response.status+'）')
 const result=(await response.json()).result
 if(!Array.isArray(result))throw new AuthError(502,'Sanity 首頁回應格式不正確')
 return {draft:result.find(x=>x._id==='drafts.'+HOME_ID)||null,published:result.find(x=>x._id===HOME_ID)||null}
}
function serialize(doc){
 if(!doc)return null
 return {revision:doc._rev||'',updatedAt:doc._updatedAt||'',slides:(Array.isArray(doc.slides)?doc.slides:[]).map(s=>({
  slug:s.slug||'',title:s.title||'',excerpt:s.excerpt||'',cover:s.coverUrl||'',coverFit:s.coverFit||'cover',coverMobileFit:s.coverMobileFit||'cover',coverZoom:s.coverZoom??100,coverMobileZoom:s.coverMobileZoom??100,coverX:s.coverX??50,coverY:s.coverY??50,coverMobileX:s.coverMobileX??s.coverX??50,coverMobileY:s.coverMobileY??s.coverY??50
 }))}
}
async function imageAsset(data,token){
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data)
 if(!match||match[2].length>1_400_000)throw new AuthError(413,'首頁封面必須先完成圖片壓縮')
 let raw
 try{raw=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))}catch{throw new AuthError(400,'封面資料無法解析')}
 const resp=await fetch(API+'/assets/images/'+DATASET+'?filename=good-things-home-cover',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':match[1]},body:raw
 })
 if(!resp.ok)throw new AuthError(502,'首頁封面上傳失敗（Sanity HTTP '+resp.status+'）')
 const image=(await resp.json()).document
 if(!image?._id?.startsWith('image-')||!/^https:\/\/cdn\.sanity\.io\//.test(image.url||''))throw new AuthError(502,'Sanity 圖片上傳回應無效')
 return image.url
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity Token 尚未設定')
  const {draft,published}=await fetchHomes(env.SANITY_EDITOR_TOKEN)
  return Response.json({ok:true,draft:serialize(draft),published:serialize(published)},{headers})
 }catch(e){if(!(e instanceof AuthError))console.error('Home read failed',e?.message);return errorResponse(e)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'需使用 JSON')
  if(Number(request.headers.get('content-length')||0)>MAX_BYTES)throw new AuthError(413,'首頁資料超過大小限制')
  const raw=await request.text()
  if(raw.length>MAX_BYTES)throw new AuthError(413,'首頁資料超過大小限制')
  let payload
  try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'資料格式無效')}
  const slides=normalizeSlides(payload?.slides)
  const {draft,published}=await fetchHomes(env.SANITY_EDITOR_TOKEN)
  const revision=str(payload?.revision,180)
  if(draft && revision!==draft._rev)throw new AuthError(409,'雲端草稿已被更新，請重新載入再修改')
  if(!draft && published && revision!==published._rev)throw new AuthError(409,'已發布首頁有更新，請先重新讀取')
  for(const slide of slides){
   if(slide.coverUrl.startsWith('data:'))slide.coverUrl=await imageAsset(slide.coverUrl,env.SANITY_EDITOR_TOKEN)
  }
  const mutations=[
   {createIfNotExists:{_id:'drafts.'+HOME_ID,_type:'homepage',slides:[]}},
   {patch:{id:'drafts.'+HOME_ID,set:{slides},...(draft?{ifRevisionID:draft._rev}:{})}}
  ]
  const resp=await fetch(API+'/data/mutate/'+DATASET,{
   method:'POST',headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN,'Content-Type':'application/json'},
   body:JSON.stringify({mutations,returnDocuments:true})
  })
  if(!resp.ok)throw new AuthError(resp.status===409?409:502,resp.status===409?'草稿已在其他裝置更新':'Sanity 儲存失敗 HTTP '+resp.status)
  const result=await resp.json()
  const updated=result.results?.find(x=>x.document?._id==='drafts.'+HOME_ID)?.document
  return Response.json({ok:true,draft:serialize(updated)||{revision:'',slides:slides.map(s=>({slug:s.slug,title:s.title,excerpt:s.excerpt,cover:s.coverUrl,coverFit:s.coverFit,coverMobileFit:s.coverMobileFit,coverZoom:s.coverZoom,coverMobileZoom:s.coverMobileZoom,coverX:s.coverX,coverY:s.coverY,coverMobileX:s.coverMobileX,coverMobileY:s.coverMobileY}))}},{headers})
 }catch(e){if(!(e instanceof AuthError))console.error('Home save failed',e?.message);return errorResponse(e)}
}