import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const CHOICES={headingFont:['original','sans','serif','mixed'],textScale:['compact','standard','large'],paper:['original','white']}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true')throw new AuthError(403,'正式發布目前鎖定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'必須使用 JSON')
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'雲端尚未設定')
  const raw=await request.text()
  if(raw.length>1000)throw new AuthError(413,'發布資料太大')
  let payload
  try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(payload?.confirmation!=='PUBLISH'||typeof payload.revision!=='string'||!payload.revision)
    throw new AuthError(400,'尚未確認發布')
  const url=new URL(API+'/data/query/production')
  url.searchParams.set('perspective','raw')
  url.searchParams.set('query','*[_id=="drafts.gt-design-settings"][0]{_id,_rev,settingsJson}')
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
  if(!response.ok)throw new AuthError(502,'無法讀取視覺草稿')
  const draft=(await response.json()).result
  if(!draft||draft._rev!==payload.revision)throw new AuthError(409,'草稿已更動，請重新讀取')
  let settings
  try{settings=JSON.parse(draft.settingsJson)}catch{throw new AuthError(400,'視覺草稿格式錯誤')}
  if(!settings||Array.isArray(settings)||typeof settings!=='object')throw new AuthError(400,'視覺草稿資料無效')
  const keys=Object.keys(settings)
  if(keys.length!==3||keys.some(key=>!Object.hasOwn(CHOICES,key)||!CHOICES[key].includes(settings[key])))
   throw new AuthError(400,'視覺草稿含有無效設定')
  const published={_id:'gt-design-settings',_type:'gtDesignSettings',settingsJson:JSON.stringify(settings)}
  const saved=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[{createOrReplace:published},{delete:{id:draft._id,ifRevisionID:draft._rev}}]})})
  if(!saved.ok)throw new AuthError(saved.status===409?409:502,'發布視覺設定失敗 HTTP '+saved.status)
  return Response.json({ok:true,published:true},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return errorResponse(error)}
}