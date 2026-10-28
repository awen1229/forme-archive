import {requireEditor,AuthError,errorResponse} from './brand.js'

// Protected draft editor for a SINGLE opening choice. No media or JavaScript
// is accepted from the client; modes refer only to bundled, allowlisted studies.
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const ID='gt-opening-settings'
const HEADERS={'Cache-Control':'no-store'}
const MODES=new Set([
 'draw','physics21','physics10','ink','letters','paper','print','offset','proof','anchor','registration',
 'v25-material','v25-space','v25-index','v26-material','v26-space','v26-index',
 'magnetic','diecut','exposure','ripple','editorial28','editorial29','none'
])
const REPEATS=new Set(['once','always'])
const DEFAULT={mode:'draw',repeat:'once'}
export function validateOpening(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AuthError(400,'首頁動畫設定格式錯誤')
 if(Object.keys(value).some(k=>!['mode','repeat'].includes(k)))throw new AuthError(400,'包含不支援的動畫設定')
 const mode=value.mode,repeat=value.repeat
 if(typeof mode!=='string'||!MODES.has(mode))throw new AuthError(400,'不支援這個首頁動畫')
 if(typeof repeat!=='string'||!REPEATS.has(repeat))throw new AuthError(400,'播放頻率設定不正確')
 return {mode,repeat}
}
async function state(token){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective','raw')
 u.searchParams.set('query','*[_id in ["gt-opening-settings","drafts.gt-opening-settings"]]{_id,_rev,_updatedAt,settingsJson}')
 const r=await fetch(u.toString(),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'無法讀取首頁動畫設定（HTTP '+r.status+'）')
 const rows=(await r.json()).result
 if(!Array.isArray(rows))throw new AuthError(502,'雲端動畫設定格式錯誤')
 return {draft:rows.find(x=>x._id==='drafts.'+ID)||null,published:rows.find(x=>x._id===ID)||null}
}
function serialized(doc){
 if(!doc)return null
 try{
  const settings=validateOpening(JSON.parse(doc.settingsJson||'{}'))
  return {settings,revision:doc._rev||'',updatedAt:doc._updatedAt||''}
 }catch{return {invalid:true,revision:doc._rev||'',updatedAt:doc._updatedAt||''}}
}
function readiness(env){
 return {
  publishEnabled:env.ENABLE_PRODUCTION_PUBLISH==='true' &&
   env.ENABLE_OPENING_PUBLISH==='true' &&
   env.PRODUCTION_OPENING_ASSETS_READY==='true',
  codeReleaseRequired:env.PRODUCTION_OPENING_ASSETS_READY!=='true',
  // No production changes are made by GET or draft POST.
  target:'Sanity production / published opening document'
 }
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'雲端尚未設定')
  const docs=await state(env.SANITY_EDITOR_TOKEN)
  return Response.json({ok:true,draft:serialized(docs.draft),published:serialized(docs.published),
   defaults:DEFAULT,readiness:readiness(env)},{headers:HEADERS})
 }catch(e){return errorResponse(e)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'雲端尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'必須使用 JSON')
  if(Number(request.headers.get('content-length')||0)>1800)throw new AuthError(413,'設定資料太大')
  const raw=await request.text();if(raw.length>1800)throw new AuthError(413,'設定資料太大')
  let payload;try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  const settings=validateOpening(payload?.settings)
  const revision=typeof payload.revision==='string'?payload.revision:''
  if(revision.length>180)throw new AuthError(400,'版本識別不正確')
  const token=env.SANITY_EDITOR_TOKEN,docs=await state(token),active=docs.draft||docs.published
  if((active?active._rev:'')!==revision)throw new AuthError(409,'這組設定已被其他裝置更新，請重新讀取')
  const mutations=[
   {createIfNotExists:{_id:'drafts.'+ID,_type:'gtOpeningSettings',settingsJson:'{}'}},
   {patch:{id:'drafts.'+ID,set:{settingsJson:JSON.stringify(settings)},
     ...(docs.draft?{ifRevisionID:docs.draft._rev}:{})}}
  ]
  const saved=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations,returnDocuments:true})})
  if(!saved.ok)throw new AuthError(saved.status===409?409:502,'儲存動畫草稿失敗（HTTP '+saved.status+'）')
  // Read back the actual patched document. A createIfNotExists result may
  // contain pre-patch settingsJson and must not be mistaken for the final draft.
  const fresh=await state(token)
  const draft=serialized(fresh.draft)
  if(!draft||draft.invalid||!draft.revision)throw new AuthError(502,'草稿已保存，但無法確認最新版本；請重新讀取')
  return Response.json({ok:true,draft,readiness:readiness(env)},{headers:HEADERS})
 }catch(e){return errorResponse(e)}
}
