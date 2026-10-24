import {requireEditor,AuthError,errorResponse} from './brand.js'
const BASE='https://8nqupq9u.api.sanity.io/v2025-02-19'
const FONT_ID=/^gt-font-[a-f0-9-]{36}$/
const CATEGORIES=['uncategorized','serif','sans','display','handwriting','other']
const HEADERS={'Cache-Control':'no-store'}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'字型庫服務尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'網站來源驗證失敗')
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw new AuthError(415,'請傳送 JSON')
  const raw=await request.text()
  if(raw.length>1300)throw new AuthError(413,'字型資料過大')
  let data;try{data=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 格式錯誤')}
  const id=String(data?.id||'')
  const name=String(data?.name||'').trim()
  const category=String(data?.category||'uncategorized')
  const revision=String(data?.revision||'')
  if(!FONT_ID.test(id))throw new AuthError(400,'字型代碼無效')
  if(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name))throw new AuthError(400,'字型名稱需為 1–80 字')
  if(!CATEGORIES.includes(category))throw new AuthError(400,'不支援的字型分類')
  if(!/^[-_A-Za-z0-9]{6,200}$/.test(revision))throw new AuthError(400,'字型修訂版本無效，請重新讀取')
  const token=env.SANITY_EDITOR_TOKEN
  // A revision precondition prevents overwriting a concurrent editor's changes.
  const mutation={mutations:[{patch:{id,ifRevisionID:revision,set:{name,category}}}],returnDocuments:true}
  const res=await fetch(BASE+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(mutation)
  })
  if(!res.ok){
   const detail=await res.text()
   console.error('Font metadata update failed, HTTP',res.status,detail.slice(0,250))
   throw new AuthError(res.status===409?409:502,res.status===409?'字型資料已被其他裝置更新，請重新讀取':'無法更新字型資料 HTTP '+res.status)
  }
  const result=await res.json()
  const doc=result.results?.find(item=>item.document?._id===id)?.document
  if(!doc||doc._type!=='gtWebFont'||typeof doc._rev!=='string')throw new AuthError(502,'字型更新結果不完整')
  return Response.json({ok:true,font:{_id:id,_rev:doc._rev,name:doc.name,category:doc.category}},{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}
