import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const HEADERS={'Cache-Control':'no-store'}
const MAX_BYTES=9_000_000
const MAX_FONTS=150
const FONT_ID=/^gt-font-[a-f0-9-]{36}$/
const FORMATS={
 woff2:{signature:'wOF2',mime:'font/woff2'},
 woff:{signature:'wOFF',mime:'font/woff'},
 otf:{signature:'OTTO',mime:'font/otf'},
 ttf:{signature:'\x00\x01\x00\x00',mime:'font/ttf'}
}
function noCache(data){return Response.json(data,{headers:HEADERS})}
async function query(token){
 const url=new URL(API+'/data/query/production')
 url.searchParams.set('perspective','raw')
 url.searchParams.set('query','*[_type=="gtWebFont" && !(_id in path("drafts.**"))] | order(_createdAt desc)[0...151]{_id,name,format,url,originalName,_createdAt}')
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!response.ok)throw new AuthError(502,'讀取字型庫失敗')
 const records=(await response.json()).result
 if(!Array.isArray(records))throw new AuthError(502,'字型庫資料格式錯誤')
 return records.filter(x=>FONT_ID.test(x._id)&&typeof x.name==='string'&&typeof x.url==='string'&&
  /^https:\/\/cdn\.sanity\.io\/files\/8nqupq9u\/production\/[a-zA-Z0-9._-]+$/.test(x.url))
}
export async function onRequestGet({request,env}){
 try{
  await requireEditor(request,env)
  if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'字型庫服務尚未設定')
  const records=await query(env.SANITY_EDITOR_TOKEN)
  return noCache({ok:true,fonts:records.slice(0,MAX_FONTS),limit:MAX_FONTS})
 }catch(error){return errorResponse(error)}
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'字型庫服務尚未設定')
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!(request.headers.get('content-type')||'').startsWith('multipart/form-data'))throw new AuthError(415,'請上傳字型檔案')
  if(Number(request.headers.get('content-length')||0)>MAX_BYTES+20_000)throw new AuthError(413,'單一字型檔超過 9 MB')
  const form=await request.formData()
  if(form.get('licensed')!=='true')throw new AuthError(400,'請先確認此字型允許網頁嵌入使用')
  const file=form.get('font')
  if(!file||typeof file==='string'||typeof file.arrayBuffer!=='function')throw new AuthError(400,'找不到字型檔案')
  if(file.size<16||file.size>MAX_BYTES)throw new AuthError(413,'單一字型檔需小於 9 MB')
  const name=String(form.get('name')||'').trim()
  if(!name||name.length>80||/[\u0000-\u001F\u007F]/.test(name))throw new AuthError(400,'請輸入 1–80 字的字型名稱')
  const originalName=String(file.name||'')
  const ext=/\.([a-zA-Z0-9]+)$/.exec(originalName)?.[1]?.toLowerCase()
  if(!Object.hasOwn(FORMATS,ext))throw new AuthError(415,'僅接受 WOFF2、WOFF、OTF 或 TTF 字型')
  const records=await query(token)
  if(records.length>=MAX_FONTS)throw new AuthError(409,'字型庫已達 150 款上限，請先整理字型')
  const bytes=new Uint8Array(await file.arrayBuffer())
  const signature=String.fromCharCode(...bytes.slice(0,4))
  if(signature!==FORMATS[ext].signature)throw new AuthError(415,'檔案內容與字型格式不符')
  const uuid=crypto.randomUUID()
  const uploaded=await fetch(API+'/assets/files/production?filename='+encodeURIComponent('good-things-font-'+uuid+'.'+ext),{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':FORMATS[ext].mime},body:bytes
  })
  if(!uploaded.ok)throw new AuthError(502,'字型檔上傳到 Sanity 失敗（HTTP '+uploaded.status+'）')
  const asset=(await uploaded.json()).document
  if(!asset?._id?.startsWith('file-')||!/^https:\/\/cdn\.sanity\.io\/files\/8nqupq9u\/production\/[a-zA-Z0-9._-]+$/.test(asset.url||''))
   throw new AuthError(502,'Sanity 字型網址無效')
  const font={_id:'gt-font-'+uuid,_type:'gtWebFont',name,format:ext,url:asset.url,originalName:originalName.slice(0,140),fileAsset:{_type:'reference',_ref:asset._id}}
  const result=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[{create:font}]})
  })
  if(!result.ok)throw new AuthError(502,'字型已上傳，但字型庫登錄失敗（HTTP '+result.status+'）')
  return noCache({ok:true,font:{_id:font._id,name,format:ext,url:asset.url,originalName:font.originalName}})
 }catch(error){return errorResponse(error)}
}
