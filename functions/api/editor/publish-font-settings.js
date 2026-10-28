import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DRAFT='drafts.gt-font-assignments'
const LIVE='gt-font-assignments'
const ROLES=['headlines','body','navigation']
const FONT_ID=/^gt-font-[a-f0-9-]{36}$/
const CDN=/^https:\/\/cdn\.sanity\.io\/files\/8nqupq9u\/production\/[a-zA-Z0-9._-]+$/
async function query(token,groq,params={}){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective','raw')
 u.searchParams.set('query',groq)
 for(const [key,value] of Object.entries(params))u.searchParams.set('$'+key,JSON.stringify(value))
 const r=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'無法驗證字型設定（HTTP '+r.status+'）')
 return (await r.json()).result
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true')throw new AuthError(403,'正式發布尚未在編輯器環境啟用')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw new AuthError(415,'必須使用 JSON')
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'雲端字型服務尚未設定')
  const raw=await request.text()
  if(raw.length>700)throw new AuthError(413,'發布請求太大')
  let payload;try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(payload?.confirmation!=='PUBLISH'||typeof payload.revision!=='string'||!payload.revision)
   throw new AuthError(400,'請先確認發布與草稿版本')
  const token=env.SANITY_EDITOR_TOKEN
  const draft=await query(token,'*[_id==$id && _type=="gtFontAssignments"][0]{_id,_rev,roles}',{id:DRAFT})
  if(!draft||draft._rev!==payload.revision)throw new AuthError(409,'字型草稿已更動，請重新讀取')
  if(!draft.roles||typeof draft.roles!=='object'||Array.isArray(draft.roles)||
    Object.keys(draft.roles).some(key=>!ROLES.includes(key)))throw new AuthError(400,'字型設定內容無效')
  const roles={}
  for(const key of ROLES){
   const v=draft.roles[key]||''
   if(typeof v!=='string'||(v&&!FONT_ID.test(v)))throw new AuthError(400,'字型代碼無效：'+key)
   roles[key]=v
  }
  const ids=[...new Set(Object.values(roles).filter(Boolean))]
  if(ids.length){
   const fonts=await query(token,'*[_type=="gtWebFont" && _id in $ids]{_id,url,format}',{ids})
   if(!Array.isArray(fonts)||fonts.length!==ids.length||fonts.some(f=>!FONT_ID.test(f._id)||
      !CDN.test(f.url)||!['woff2','woff','otf','ttf'].includes(f.format)))
    throw new AuthError(409,'選用字型不存在或網址無效，請重新檢查')
  }
  const published={_id:LIVE,_type:'gtFontAssignments',roles}
  const result=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[{createOrReplace:published},{delete:{id:DRAFT,ifRevisionID:draft._rev}}]})
  })
  if(!result.ok)throw new AuthError(result.status===409?409:502,'正式發布失敗（HTTP '+result.status+'）')
  return Response.json({ok:true,published:true,roles},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return errorResponse(error)}
}
