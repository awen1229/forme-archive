import {requireEditor,AuthError,errorResponse} from './brand.js'
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const PATTERN=/^gt-font-[a-f0-9-]{36}$/
async function query(token,query,params={}){
 const u=new URL(API+'/data/query/production')
 u.searchParams.set('perspective','raw');u.searchParams.set('query',query)
 for(const [key,value] of Object.entries(params))u.searchParams.set('$'+key,JSON.stringify(value))
 const r=await fetch(u,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
 if(!r.ok)throw new AuthError(502,'無法確認字型使用狀態')
 return (await r.json()).result
}
export async function onRequestPost({request,env}){
 try{
  await requireEditor(request,env)
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw new AuthError(415,'請傳送 JSON')
  const token=env.SANITY_EDITOR_TOKEN
  if(!token)throw new AuthError(503,'字型庫服務尚未設定')
  const raw=await request.text();if(raw.length>700)throw new AuthError(413,'請求資料太大')
  let payload;try{payload=JSON.parse(raw)}catch{throw new AuthError(400,'JSON 無效')}
  const id=String(payload?.id||'')
  if(!PATTERN.test(id)||payload?.confirmation!=='DELETE')throw new AuthError(400,'字型代碼或刪除確認無效')
  const [font,assignments]=await Promise.all([
   query(token,'*[_id==$id && _type=="gtWebFont"][0]{_id,_rev,name,fileAsset}',{id}),
   query(token,'*[_type=="gtFontAssignments" || _id=="gt-font-assignments" || _id=="drafts.gt-font-assignments"]{roles}')
  ])
  if(!font)throw new AuthError(404,'字型庫中找不到這款字型')
  const occupied=Array.isArray(assignments)&&assignments.some(row=>
   row.roles&&Object.values(row.roles).includes(id))
  if(occupied)throw new AuthError(409,'此字型目前已被字型設定草稿選用。請先從標題、內文及導覽取消套用，儲存草稿後再刪除。')
  const mut=await fetch(API+'/data/mutate/production',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({mutations:[{delete:{id,ifRevisionID:font._rev}}]})
  })
  if(!mut.ok)throw new AuthError(mut.status===409?409:502,'刪除字型資料失敗 HTTP '+mut.status)
  // Catalog document removal is reversible only by re-upload. Leave referenced assets
  // on CDN rather than risk deleting a file that another Sanity document may reuse.
  return Response.json({ok:true,deleted:id,assetRetained:true},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return errorResponse(error)}
}
