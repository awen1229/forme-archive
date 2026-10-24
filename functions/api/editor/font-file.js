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
  const response=await fetch(font.url,{redirect:'error'})
  if(!response.ok)throw new AuthError(502,'讀取字型檔案失敗 HTTP '+response.status)
  const size=Number(response.headers.get('content-length')||0)
  if(size>9_000_000)throw new AuthError(413,'字型檔案超過限制')
  const bytes=new Uint8Array(await response.arrayBuffer())
  if(bytes.length<16||bytes.length>9_000_000)throw new AuthError(413,'字型檔案大小不正確')
  const magic=String.fromCharCode(...bytes.slice(0,4))
  if(magic!==MAGIC[font.format])throw new AuthError(415,'字型檔內容與登錄格式不符')
  return new Response(bytes,{
   status:200,headers:{
    'Content-Type':MIME[font.format],
    'Cache-Control':'private, max-age=300',
    'X-Content-Type-Options':'nosniff',
    'Cross-Origin-Resource-Policy':'same-origin'
   }
  })
 }catch(error){return errorResponse(error)}
}
