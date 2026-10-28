import {requireEditor,AuthError,errorResponse} from './brand.js'
import {validateOpening} from './opening-settings.js'

const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const HEADERS={'Cache-Control':'no-store'}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  // Three independent switches prevent publishing when the main site lacks
  // the required JavaScript and assets. Configure ONLY after a verified main release.
  if(env.ENABLE_PRODUCTION_PUBLISH!=='true'||
     env.ENABLE_OPENING_PUBLISH!=='true'||
     env.PRODUCTION_OPENING_ASSETS_READY!=='true')
   throw new AuthError(403,'正式網站尚未完成動畫功能部署；目前只能儲存雲端草稿')
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'雲端尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'格式必須是 JSON')
  if(Number(request.headers.get('content-length')||0)>1200)throw new AuthError(413,'確認內容過大')
  const raw=await request.text();if(raw.length>1200)throw new AuthError(413,'確認內容過大')
  let input;try{input=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  if(input?.confirmation!=='PUBLISH_OPENING'||typeof input.revision!=='string'||
     !input.revision||input.revision.length>180)
   throw new AuthError(400,'需要明確確認發布及最新草稿版本')
  const token=env.SANITY_EDITOR_TOKEN;
  const u=new URL(API+'/data/query/production')
  u.searchParams.set('perspective','raw')
  u.searchParams.set('query','*[_id=="drafts.gt-opening-settings"][0]{_id,_rev,settingsJson}')
  const r=await fetch(u.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
  if(!r.ok)throw new AuthError(502,'無法取得最新動畫草稿')
  const draft=(await r.json()).result
  if(!draft||draft._rev!==input.revision)throw new AuthError(409,'草稿版本已改變，請重新整理再發布')
  let settings;try{settings=validateOpening(JSON.parse(draft.settingsJson))}
  catch(e){if(e instanceof AuthError)throw e;throw new AuthError(400,'動畫草稿內容不正確')}
  if(input.mode!==settings.mode||input.repeat!==settings.repeat)
   throw new AuthError(409,'畫面與草稿設定不同，請重新讀取後確認')
  const save=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[
    {createOrReplace:{_id:'gt-opening-settings',_type:'gtOpeningSettings',settingsJson:JSON.stringify(settings)}},
    {delete:{id:draft._id,ifRevisionID:draft._rev}}
   ]})
  })
  if(!save.ok)throw new AuthError(save.status===409?409:502,
    save.status===409?'草稿已被更新，請重新載入':'發布動畫設定失敗（HTTP '+save.status+'）')
  return Response.json({ok:true,published:true,settings},{headers:HEADERS})
 }catch(e){
  if(!(e instanceof AuthError))console.error('Opening publish failed',e?.message)
  return errorResponse(e)
 }
}