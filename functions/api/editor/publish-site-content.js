import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  const t=env.SANITY_EDITOR_TOKEN
  if(!t)throw new AuthError(503,'Sanity Token 尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'必須使用 JSON')
  const raw=await request.text()
  if(raw.length>2000)throw new AuthError(413,'資料太大')
  let data;try{data=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(data?.confirmation!=='PUBLISH'||!data.revision)throw new AuthError(400,'尚未確認發布')
  const url=new URL(API+'/data/query/production')
  url.searchParams.set('perspective','raw')
  url.searchParams.set('query','*[_id=="drafts.gt-site-content"][0]{...}')
  const r=await fetch(url.toString(),{headers:{Authorization:'Bearer '+t},cache:'no-store'})
  if(!r.ok)throw new AuthError(502,'無法讀取網站文字草稿')
  const draft=(await r.json()).result
  if(!draft||draft._rev!==data.revision)throw new AuthError(409,'草稿已更新，請重新讀取')
  const legacy= draft.fields&&typeof draft.fields==='object'&&!Array.isArray(draft.fields)?draft.fields:{}
  const fieldsJson=typeof draft.fieldsJson==='string'?draft.fieldsJson:JSON.stringify(legacy)
  let parsed
  try{parsed=JSON.parse(fieldsJson)}catch{throw new AuthError(400,'網站文字草稿格式不正確，請重新儲存')}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new AuthError(400,'網站文字草稿格式不正確，請重新儲存')
  const publicDoc={_id:'gt-site-content',_type:'gtSiteContent',fieldsJson}
  const save=await fetch(API+'/data/mutate/production',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({mutations:[{createOrReplace:publicDoc},{delete:{id:draft._id,ifRevisionID:draft._rev}}]})})
  if(!save.ok)throw new AuthError(save.status===409?409:502,'網站文字發布失敗 HTTP '+save.status)
  return Response.json({ok:true,published:true},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}
}
