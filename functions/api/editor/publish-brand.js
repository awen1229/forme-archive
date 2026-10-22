import {requireEditor, AuthError, errorResponse} from './brand.js'

const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const DATASET='production'
const strictSlug=/^[a-z0-9-]{1,90}$/
const str=v=>typeof v==='string'?v.trim():''
export async function onRequestPost({request,env}) {
  try {
    await requireEditor(request,env)
    if(!env.SANITY_EDITOR_TOKEN)throw new AuthError(503,'Sanity 尚未設定')
    if(request.headers.get('Origin')!==new URL(request.url).origin)throw new AuthError(403,'來源驗證失敗')
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new AuthError(415,'格式不正確')
    if(Number(request.headers.get('content-length')||0)>2500)throw new AuthError(413,'資料太大')
    const text=await request.text()
    if(text.length>2500)throw new AuthError(413,'資料太大')
    let input
    try{input=JSON.parse(text)}catch{throw new AuthError(400,'JSON 格式不正確')}
    const slug=str(input?.slug),name=str(input?.name)
    if(!strictSlug.test(slug)||!name||name.length>120||input?.confirmation!=='PUBLISH')throw new AuthError(400,'缺少發布確認')
    if(/\btest\b|測試/i.test(name))throw new AuthError(400,'請勿發布測試品牌')
    const u=new URL(API+'/data/query/'+DATASET)
    u.searchParams.set('perspective','raw')
    u.searchParams.set('query','*[_type == "brand" && slug.current == $slug && _id in path("drafts.**")] | order(_updatedAt desc)[0...2]{...}')
    u.searchParams.set('$slug',JSON.stringify(slug))
    const response=await fetch(u.toString(),{headers:{Authorization:`Bearer ${env.SANITY_EDITOR_TOKEN}`,Accept:'application/json'},cache:'no-store'})
    if(!response.ok)throw new AuthError(502,'無法讀取草稿')
    const result=(await response.json()).result
    if(!Array.isArray(result)||result.length===0)throw new AuthError(404,'找不到此草稿')
    if(result.length>1)throw new AuthError(409,'存在重複草稿，請先整理')
    const draft=result[0]
    if(str(draft.name)!==name)throw new AuthError(409,'品牌名稱已變更，請重新整理')
    const revision=str(input.revision)
    if(!revision||revision!==draft._rev)throw new AuthError(409,'草稿已更新，請重新載入後再發布')
    const publishedId=draft._id.slice('drafts.'.length)
    if(!publishedId||publishedId.startsWith('drafts.')||publishedId.startsWith('versions.'))throw new AuthError(400,'草稿識別碼錯誤')
    const document=Object.fromEntries(Object.entries(draft).filter(([key])=>!['_id','_rev','_createdAt','_updatedAt'].includes(key)))
    document._id=publishedId
    document._type='brand'
    const save=await fetch(API+'/data/mutate/'+DATASET,{
      method:'POST',
      headers:{Authorization:`Bearer ${env.SANITY_EDITOR_TOKEN}`,'Content-Type':'application/json'},
      body:JSON.stringify({mutations:[
        {createOrReplace:document},
        {delete:{id:draft._id}}
      ]})
    })
    if(!save.ok)throw new AuthError(502,'Sanity 發布失敗（'+save.status+'）')
    return Response.json({ok:true,publishedId},{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    if(!(e instanceof AuthError))console.error('Brand publish failed',e?.message)
    return errorResponse(e)
  }
}
