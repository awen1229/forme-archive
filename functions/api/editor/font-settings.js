import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DOC='drafts.gt-font-assignments'
const ROLES=['headlines','body','navigation']
const FONT_PATTERN=/^gt-font-[a-f0-9-]{36}$/
const HEADERS={'Cache-Control':'no-store'}
function normalized(value){
 if(!value||Array.isArray(value)||typeof value!=='object')throw new AuthError(400,'字型選擇格式錯誤')
 if(Object.keys(value).some(key=>!ROLES.includes(key)))throw new AuthError(400,'不支援的字型套用位置')
 return Object.fromEntries(ROLES.map(key=>{
  const v=value[key]||''
  if(typeof v!=='string'||(v&&!FONT_PATTERN.test(v)))throw new AuthError(400,'字型代碼無效：'+key)
  return [key,v]
 }))
}
async function read(token){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective','raw')
 u.searchParams.set('query','*[_id=="drafts.gt-font-assignments"][0]{_rev,roles}')
 const response=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok)throw new AuthError(502,'字型草稿讀取失敗')
 const result=(await response.json()).result
 return result||null
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'字型庫服務尚未設定')
  const doc=await read(env.SANITY_EDITOR_TOKEN)
  return Response.json({ok:true,roles:doc?normalized(doc.roles||{}):normalized({}),revision:doc?._rev||'',published:false},{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'字型庫服務尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw new AuthError(415,'需傳送 JSON')
  const raw=await request.text()
  if(raw.length>1500)throw new AuthError(413,'字型設定資料過大')
  let payload;try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  const roles=normalized(payload?.roles)
  const revision=typeof payload?.revision==='string'?payload.revision:''
  const token=env.SANITY_EDITOR_TOKEN
  const active=await read(token)
  if((active?._rev||'')!==revision)throw new AuthError(409,'字型選擇已在其他裝置更新，請重新讀取')
  const choices=Object.values(roles).filter(Boolean)
  if(choices.length){
   const u=new URL(API+'/data/query/production')
   u.searchParams.set('perspective','raw')
   u.searchParams.set('query','count(*[_type=="gtWebFont" && _id in $ids])')
   u.searchParams.set('$ids',JSON.stringify([...new Set(choices)]))
   const response=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(!response.ok||Number((await response.json()).result)!==new Set(choices).size)throw new AuthError(409,'字型庫中有不存在的字型，請重新整理')
  }
  const mutations=[
   {createIfNotExists:{_id:DOC,_type:'gtFontAssignments',roles:{headlines:'',body:'',navigation:''}}},
   {patch:{id:DOC,set:{roles},...(active?{ifRevisionID:active._rev}:{})}}
  ]
  const response=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations,returnDocuments:true})
  })
  if(!response.ok)throw new AuthError(response.status===409?409:502,'字型草稿儲存失敗 HTTP '+response.status)
  const data=await response.json()
  const saved=data.results?.find(x=>x.document?._id===DOC)?.document
  return Response.json({ok:true,roles,revision:saved?._rev||'',published:false},{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}
