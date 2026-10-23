import {requireEditor,AuthError,errorResponse} from './brand.js'

// RELEASE LAB: This API is intentionally hardcoded to the separate 'staging'
// dataset and the single Access-protected branch preview hostname.
// It NEVER reads, writes, or mutates the production dataset.
const HOST='feature-secure-editor-cloud.forme-archive.pages.dev'
const DATASET='staging'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const NO_STORE={'Cache-Control':'no-store'}
const fixtures={
 brand:{
  id:'gt-release-lab-brand',
  document:{
   _type:'brand',name:'GT RELEASE LAB TEST / Brand',
   slug:{_type:'slug',current:'gt-release-lab-brand'},
   founder:'Release Lab',foundedYear:2026,
   summary:'Temporary staging-only release verification. Not for publication.',
   tags:['STAGING','TEST'],website:''
  }
 },
 article:{
  id:'gt-release-lab-article',
  document:{
   _type:'article',title:'GT RELEASE LAB TEST / Article',
   slug:{_type:'slug',current:'gt-release-lab-article'},
   brand:'GT RELEASE LAB TEST / Brand',subject:'clothing',
   category:'EDITORIAL / TEST',excerpt:'Staging-only publication verification.',
   body:['This is an isolated sample article stored only in the staging dataset.'],
   source:'',sourceTitle:'',publisher:'',sourceAuthor:'',
   publishedAt:'2026-10-22'
  }
 },
 home:{
  id:'gt-release-lab-home',
  document:{
   _type:'homepage',slides:[
    {_key:'release-lab-article',_type:'featuredSlide',
     slug:'gt-release-lab-article',title:'GT RELEASE LAB TEST / Homepage',
     excerpt:'A staging-only featured article.',coverUrl:''}
   ]
  }
 },
 site:{
  id:'gt-release-lab-site',
  document:{
   _type:'gtSiteContent',
   fieldsJson:JSON.stringify({'home.title':'GT RELEASE LAB TEST','home.desc':'Staging-only site copy.'})
  }
 }
}
const kinds=Object.keys(fixtures)
const ids=kinds.flatMap(k=>[fixtures[k].id,'drafts.'+fixtures[k].id])
function ensurePreview(request){
 if(new URL(request.url).hostname!==HOST)throw new AuthError(403,'發布測試只允許在指定 Preview 網址執行')
}
function authHeaders(token,write=false){
 return {Authorization:'Bearer '+token,Accept:'application/json',...(write?{'Content-Type':'application/json'}:{})}
}
async function query(token,perspective='raw'){
 const url=new URL(API+'/data/query/'+DATASET)
 url.searchParams.set('perspective',perspective)
 url.searchParams.set('query','*[_id in $ids]{_id,_rev,_type}')
 url.searchParams.set('$ids',JSON.stringify(ids))
 const response=await fetch(url.toString(),{headers:authHeaders(token),cache:'no-store'})
 if(response.status===404){
  throw new AuthError(424,'STAGING_DATASET_MISSING: 請先在 Sanity → Datasets 建立名稱為 staging 的獨立資料集')
 }
 if(!response.ok)throw new AuthError(502,'無法讀取 staging 資料集（HTTP '+response.status+'）')
 const result=(await response.json()).result
 if(!Array.isArray(result))throw new AuthError(502,'staging 查詢格式無效')
 return result
}
async function mutate(token,mutations){
 const response=await fetch(API+'/data/mutate/'+DATASET,{
  method:'POST',headers:authHeaders(token,true),
  body:JSON.stringify({mutations})
 })
 if(!response.ok){
  const info=(await response.text()).slice(0,600)
  console.error('Release Lab staging mutation failed',response.status,info)
  throw new AuthError(response.status===409?409:502,'staging 寫入失敗（HTTP '+response.status+'）')
 }
 return response.json()
}
async function getStates(token){
 const [raw,published]=await Promise.all([query(token,'raw'),query(token,'published')])
 const live=new Set(published.map(x=>x._id))
 return kinds.map(kind=>{
  const id=fixtures[kind].id
  const draft=raw.find(x=>x._id==='drafts.'+id)
  const pub=raw.find(x=>x._id===id)
  return {kind,draft:!!draft,published:!!pub&&live.has(id),revision:draft?draft._rev:null}
 })
}
export async function onRequestGet({request,env}){
 try{
  ensurePreview(request)
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'SANITY_EDITOR_TOKEN 尚未設定')
  return Response.json({ok:true,dataset:DATASET,productionUntouched:true,items:await getStates(env.SANITY_EDITOR_TOKEN)},{headers:NO_STORE})
 }catch(e){
  if(!(e instanceof AuthError))console.error('Release Lab read failed',e?.message)
  return errorResponse(e)
 }
}
export async function onRequestPost({request,env}){
 try{
  ensurePreview(request)
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'SANITY_EDITOR_TOKEN 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'格式必須是 JSON')
  if(Number(request.headers.get('content-length')||0)>1600)throw new AuthError(413,'資料太大')
  const raw=await request.text()
  if(raw.length>1600)throw new AuthError(413,'資料太大')
  let input
  try{input=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  const action=input?.action,kind=input?.kind
  if(!['seed','publish','reset'].includes(action))throw new AuthError(400,'未知測試動作')
  const token=env.SANITY_EDITOR_TOKEN
  // Probe first: never silently fall back to production or create datasets.
  await query(token,'raw')
  if(action==='seed'){
   if(!kinds.includes(kind))throw new AuthError(400,'請選擇測試類型')
   const f=fixtures[kind]
   await mutate(token,[{createIfNotExists:{...f.document,_id:'drafts.'+f.id}}])
  }else if(action==='publish'){
   if(!kinds.includes(kind)||input.confirmation!=='PUBLISH STAGING')throw new AuthError(400,'缺少 staging 發布確認')
   const f=fixtures[kind]
   const snapshot=await query(token,'raw')
   const draft=snapshot.find(x=>x._id==='drafts.'+f.id)
   if(!draft||!draft._rev)throw new AuthError(404,'找不到 staging 測試草稿')
   if(draft._rev!==input.revision)throw new AuthError(409,'staging 草稿版本已更新，請重新整理')
   if(kind==='home' && !snapshot.some(x=>x._id===fixtures.article.id)){
    throw new AuthError(409,'請先在 staging 發布測試文章，再測試首頁發布')
   }
   // Equivalent publish transaction to the normal endpoints; only fixed test IDs.
   const document={...f.document,_id:f.id}
   await mutate(token,[
    {createOrReplace:document},
    {delete:{id:'drafts.'+f.id,ifRevisionID:draft._rev}}
   ])
  }else if(action==='reset'){
   if(input.confirmation!=='DELETE STAGING')throw new AuthError(400,'刪除測試資料需要再次確認')
   await mutate(token,ids.map(id=>({delete:{id}})))
  }
  return Response.json({ok:true,dataset:DATASET,action,kind:kind||null,productionUntouched:true,items:await getStates(token)},{headers:NO_STORE})
 }catch(e){
  if(!(e instanceof AuthError))console.error('Release Lab operation failed',e?.message)
  return errorResponse(e)
 }
}