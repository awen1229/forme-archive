import {requireEditor,AuthError,errorResponse} from './brand.js'
const BASE='https://8nqupq9u.api.sanity.io/v2025-02-19'
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'圖片上傳服務尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError(415,'請傳送 JSON')
  const raw=await request.text()
  if(raw.length>3_300_000)throw new AuthError(413,'圖片超過上傳限制')
  let data;try{data=JSON.parse(raw)}catch{throw new AuthError(400,'圖片資料格式有誤')}
  const image=typeof data?.image==='string'?data.image:''
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image)
  if(!match||match[2].length>3_000_000)throw new AuthError(400,'圖片需為 JPG、PNG 或 WebP，請先壓縮')
  let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))}catch{throw new AuthError(400,'圖片內容無效')}
  const response=await fetch(BASE+'/assets/images/production?filename=good-things-inline',{
   method:'POST',headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN,'Content-Type':match[1]},body:bytes
  })
  if(!response.ok)throw new AuthError(502,'圖片上傳失敗（'+response.status+'）')
  const result=(await response.json()).document
  if(!result?._id?.startsWith('image-')||!/^https:\/\/cdn\.sanity\.io\/images\/8nqupq9u\/production\//.test(result.url||''))throw new AuthError(502,'圖片網址無效')
  return Response.json({ok:true,url:result.url},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}
}
