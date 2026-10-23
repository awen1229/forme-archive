// Centralized read-only published Sanity query helper.
// Token remains inside Cloudflare Pages Functions, never in responses.
const SANITY_API='https://8nqupq9u.api.sanity.io/v2025-02-19'
export const PUBLIC_HEADERS={'Cache-Control':'no-store'}
export async function queryPublished(env,query){
 if(!env.SANITY_EDITOR_TOKEN){const e=new Error('Public content integration is not configured');e.status=503;throw e}
 const url=new URL(SANITY_API+'/data/query/production')
 url.searchParams.set('perspective','published')
 url.searchParams.set('query',query)
 const res=await fetch(url.toString(),{
  headers:{Authorization:'Bearer '+env.SANITY_EDITOR_TOKEN,Accept:'application/json'},
  cache:'no-store'
 })
 if(!res.ok){const e=new Error('Published Sanity query failed: '+res.status);e.status=502;throw e}
 const data=await res.json()
 if(!Object.hasOwn(data,'result'))throw new Error('Missing result from Sanity')
 return data.result
}
export function publicQueryError(kind,error){
 console.error('Published '+kind+' fetch failed:',error?.message)
 return Response.json({ok:false,error:'已發布'+kind+'暫時無法讀取'},{status:error?.status===503?503:502,headers:PUBLIC_HEADERS})
}
