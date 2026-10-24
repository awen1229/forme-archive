import {requireEditor, AuthError, errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const HEADERS={'Cache-Control':'no-store'}
const CHOICES={
  headingFont:['original','sans','serif','mixed'],
  textScale:['compact','standard','large'],
  paper:['original','white']
}
const DEFAULT={headingFont:'original',textScale:'standard',paper:'original'}
export function safeDesign(value){
 const result={...DEFAULT}
 if(!value || typeof value!=='object' || Array.isArray(value))throw new AuthError(400,'無效的視覺設定')
 for(const [key,val] of Object.entries(value)){
  if(!Object.hasOwn(CHOICES,key) || typeof val!=='string' || !CHOICES[key].includes(val))
   throw new AuthError(400,'不支援的視覺設定：'+key)
  result[key]=val
 }
 return result
}
async function fetchState(token){
 const url=new URL(API+'/data/query/production')
 url.searchParams.set('perspective','raw')
 url.searchParams.set('query','*[_id in ["gt-design-settings","drafts.gt-design-settings"]]{_id,_rev,_updatedAt,settingsJson}')
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok)throw new AuthError(502,'讀取視覺設定失敗')
 const rows=(await response.json()).result
 if(!Array.isArray(rows))throw new AuthError(502,'視覺資料格式錯誤')
 return {draft:rows.find(x=>x._id==='drafts.gt-design-settings')||null,
   published:rows.find(x=>x._id==='gt-design-settings')||null}
}
function serialize(doc){
 if(!doc)return null
 let parsed={}
 try{parsed=JSON.parse(doc.settingsJson||'{}')}catch{}
 try{return {settings:safeDesign(parsed),revision:doc._rev||'',updatedAt:doc._updatedAt||''}}
 catch{return null}
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'雲端尚未設定')
  const state=await fetchState(env.SANITY_EDITOR_TOKEN)
  return Response.json({ok:true,draft:serialize(state.draft),published:serialize(state.published),defaults:DEFAULT},{headers:HEADERS})
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
  if(raw.length>2500)throw new AuthError(413,'設定資料太大')
  let payload
  try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式不正確')}
  const settings=safeDesign(payload?.settings)
  const revision=typeof payload.revision==='string'?payload.revision:''
  const state=await fetchState(token),active=state.draft||state.published
  if((active?active._rev:'')!==revision)throw new AuthError(409,'設定已從其他裝置更新，請重新讀取')
  const mutation={mutations:[
   {createIfNotExists:{_id:'drafts.gt-design-settings',_type:'gtDesignSettings',settingsJson:'{}'}},
   {patch:{id:'drafts.gt-design-settings',set:{settingsJson:JSON.stringify(settings)},
     ...(state.draft?{ifRevisionID:state.draft._rev}:{})}}
  ],returnDocuments:true}
  const response=await fetch(API+'/data/mutate/production',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(mutation)})
  if(!response.ok)throw new AuthError(response.status===409?409:502,'儲存視覺設定失敗 HTTP '+response.status)
  const result=await response.json()
  const saved=result.results?.find(x=>x.document?._id==='drafts.gt-design-settings')?.document
  return Response.json({ok:true,draft:serialize(saved)||{settings,revision:'',updatedAt:''}},{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}