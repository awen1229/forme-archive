// Public, published-only brand reader for the GOOD THINGS, Preview.
// Read through Pages Functions rather than depending on Sanity's browser CORS
// settings. Never return drafts or credentials to the browser.
const API='https://8nqupq9u.api.sanity.io/v2025-02-19'
const NO_STORE={'Cache-Control':'no-store'}
const QUERY='*[_type == "brand" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(name asc){name,slug,founder,foundedYear,summary,tags,website,logoScale,logoOffsetX,logoOffsetY,"logoUrl":logo.asset->url}'

export async function onRequestGet({env}){
 try{
  if(!env.SANITY_EDITOR_TOKEN){
   return Response.json({ok:false,error:'品牌資料服務尚未設定'},{status:503,headers:NO_STORE})
  }
  const u=new URL(API+'/data/query/production')
  u.searchParams.set('perspective','published')
  u.searchParams.set('query',QUERY)
  const response=await fetch(u.toString(),{
   headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN,Accept:'application/json'},
   cache:'no-store'
  })
  if(!response.ok)throw Error('Sanity published brand query HTTP '+response.status)
  const payload=await response.json()
  if(!Array.isArray(payload.result))throw Error('Invalid Sanity result format')
  const records=payload.result.filter(d=>typeof d?.name==='string'&&typeof d?.slug?.current==='string')
  return Response.json({ok:true,mode:'published-only',records},{headers:NO_STORE})
 }catch(e){
  console.error('Published brands read failed:',e?.message)
  return Response.json({ok:false,error:'目前無法取得已發布品牌資料'},{status:502,headers:NO_STORE})
 }
}
