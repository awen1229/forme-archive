import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const KEYS=new Set(["home.kicker","home.date","home.subjects","home.title","home.italic","home.desc","home.featured","home.issue","home.latestKicker","home.latestTitle","home.latestButton","home.discoverKicker","home.discoverTitle","home.indexKicker","home.indexTitle","home.aboutKicker","home.aboutTitle","stories.kicker","stories.title","stories.desc","features.kicker","features.title","features.desc","features.issue","features.body","index.kicker","index.title","index.desc","index.introTitle","index.introBody","index.directoryKicker","index.directoryTitle","index.directoryButton","brands.kicker","brands.title","brands.desc","brands.find","brands.findHelp","about.kicker","about.title","about.desc","about.introTitle","about.introBody","about.principlesTitle","about.principlesBody","about.indexTitle","about.indexBody","about.indexButton","global.menu","global.navStories","global.navFeatures","global.navIndex","global.navAbout","global.footerTag","global.footerTopics","global.footerCopyright"])
const HEADERS={'Cache-Control':'no-store'}
async function state(token){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective','raw')
 u.searchParams.set('query','*[_id in ["drafts.gt-site-content","gt-site-content"]]{_id,_rev,_updatedAt,fields}')
 const r=await fetch(u.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'Sanity 網站文字讀取失敗 HTTP '+r.status)
 const rows=(await r.json()).result||[]
 return {draft:rows.find(x=>x._id==='drafts.gt-site-content'),published:rows.find(x=>x._id==='gt-site-content')}
}
function serialize(doc){if(!doc)return null;return {revision:doc._rev||'',updatedAt:doc._updatedAt||'',fields:doc.fields||{}}}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity Token 尚未設定')
  const rows=await state(env.SANITY_EDITOR_TOKEN)
  return Response.json({ok:true,draft:serialize(rows.draft),published:serialize(rows.published)},{headers:HEADERS})
 }catch(e){return errorResponse(e)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  const t=env.SANITY_EDITOR_TOKEN
  if(!t)throw new AuthError(503,'Sanity Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'必須使用 JSON')
  const raw=await request.text()
  if(raw.length>100000)throw new AuthError(413,'網站文字太長')
  let data;try{data=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(!data||!data.fields||typeof data.fields!=='object'||Array.isArray(data.fields))throw new AuthError(400,'欄位資料格式錯誤')
  const fields={}
  for(const [key,value] of Object.entries(data.fields)){
   if(!KEYS.has(key)||typeof value!=='string')throw new AuthError(400,'未知或無效的網站文字欄位')
   const limit=['home.desc','features.body','index.introTitle','index.introBody','about.desc','about.introTitle','about.introBody','about.principlesBody','about.indexBody','stories.desc','features.desc','index.desc','brands.desc'].includes(key)?1200:240
   if(value.length>limit)throw new AuthError(400,'文字超出欄位長度限制：'+key)
   fields[key]=value
  }
  const rows=await state(t),old=rows.draft||rows.published
  const revision=typeof data.revision==='string'?data.revision:''
  if(old&&old._rev!==revision)throw new AuthError(409,'雲端內容已被其他裝置更新，請重新讀取')
  const mutation={mutations:[
   {createIfNotExists:{_id:'drafts.gt-site-content',_type:'gtSiteContent',fields:{}}},
   {patch:{id:'drafts.gt-site-content',set:{fields},...(rows.draft?{ifRevisionID:rows.draft._rev}:{})}}
  ],returnDocuments:true}
  const r=await fetch(API+'/data/mutate/production',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(mutation)})
  if(!r.ok)throw new AuthError(r.status===409?409:502,'Sanity 網站文字儲存失敗 HTTP '+r.status)
  const result=await r.json()
  const saved=result.results?.find(x=>x.document?._id==='drafts.gt-site-content')?.document
  return Response.json({ok:true,draft:serialize(saved)||{revision:'',fields}},{headers:HEADERS})
 }catch(e){return errorResponse(e)}
}
