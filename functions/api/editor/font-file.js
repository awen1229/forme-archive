import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const PATTERN=/^gt-font-[a-f0-9-]{36}$/
const CDN=/^https:\/\/cdn\.sanity\.io\/files\/8nqupq9u\/production\/[a-zA-Z0-9._-]+$/
const MIME={woff2:'font/woff2',woff:'font/woff',otf:'font/otf',ttf:'font/ttf'}
const MAGIC={woff2:'wOF2',woff:'wOFF',otf:'OTTO',ttf:'\x00\x01\x00\x00'}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'字型檔案服務尚未設定')
  const id=new URL(request.url).searchParams.get('id')||''
  if(!PATTERN.test(id))throw new AuthError(400,'無效的字型代碼')
  const u=new URL(API+'/data/query/production')
  u.searchParams.set('perspective','raw')
  u.searchParams.set('query','*[_id==$id && _type=="gtWebFont"][0]{url,format}')
  u.searchParams.set('$id',JSON.stringify(id))
  const result=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
  if(!result.ok)throw new AuthError(502,'無法驗證字型資源')
  const font=(await result.json()).result
  if(!font||!Object.hasOwn(MIME,font.format)||!CDN.test(font.url||''))
   throw new AuthError(404,'這款字型已不存在')
  // Sanity's asset CDN can redirect downloads. Refusing redirects turns
  // an otherwise valid file into an unhandled TypeError / generic HTTP 500.
  let response
  try{
   response=await fetch(font.url,{redirect:'follow',headers:{Accept:'application/octet-stream,*/*'}})
  }catch(error){
   console.error('GT font service: trusted Sanity CDN fetch failed',error?.name||'unknown')
   throw new AuthError(502,'Sanity 字型檔連線失敗。這是雲端下載問題，不代表字型損壞。')
  }
  if(!response.ok)throw new AuthError(502,'Sanity 字型檔下載失敗 HTTP '+response.status)
  const size=Number(response.headers.get('content-length')||0)
  if(size>9_000_000)throw new AuthError(413,'字型檔案超過 9 MB')
  let data
  try{data=await response.arrayBuffer()}
  catch(error){
   console.error('GT font service: Sanity response body failed',error?.name||'unknown')
   throw new AuthError(502,'Sanity 已回應，但字型資料傳輸不完整。')
  }
  const bytes=new Uint8Array(data)
  if(bytes.length<16||bytes.length>9_000_000)throw new AuthError(422,'字型檔內容太小或超過 9 MB')
  const magic=String.fromCharCode(...bytes.slice(0,4))
  if(magic!==MAGIC[font.format])throw new AuthError(422,'下載內容不符合已登錄字型格式，請檢查雲端檔案。')
  // A raw ArrayBuffer is accepted consistently by Cloudflare's Response API.
  return new Response(data,{
   status:200,headers:{
    'Content-Type':MIME[font.format],
    'Content-Length':String(bytes.length),
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',
    'Cross-Origin-Resource-Policy':'same-origin'
   }
  })
 }catch(error){return errorResponse(error)}
}
