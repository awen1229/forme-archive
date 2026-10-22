import {requireEditor} from './brand.js'

// Read-only verification of unpublished brand drafts in Sanity.
// Restricted to Cloudflare Access editor auth and the preview environment.
const DATA_URL = 'https://8nqupq9u.api.sanity.io/v2025-02-19/data/query/production'
const HEADERS = {'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8'}
function result(status, body) {
  return new Response(JSON.stringify(body), {status, headers: HEADERS})
}

export async function onRequestGet({request, env}) {
  try {
    await requireEditor(request, env)
  } catch (error) {
    return result(Number.isInteger(error?.status) ? error.status : 403, {
      ok:false, code:'EDITOR_AUTH_REQUIRED'
    })
  }
  if (!env.SANITY_EDITOR_TOKEN) {
    return result(503, {ok:false,code:'SANITY_TOKEN_MISSING'})
  }
  const query = '*[_type == "brand" && _id in path("drafts.**")] | order(_updatedAt desc)[0...20]{name,_updatedAt}'
  const url = new URL(DATA_URL)
  url.searchParams.set('perspective', 'raw')
  url.searchParams.set('query', query)
  try {
    const response = await fetch(url.toString(), {
      method:'GET',
      headers:{Authorization:`Bearer ${env.SANITY_EDITOR_TOKEN}`,Accept:'application/json'},
      cache:'no-store'
    })
    if (!response.ok) {
      return result(502,{ok:false,code:'SANITY_QUERY_FAILED',sanityStatus:response.status})
    }
    const payload = await response.json()
    if (!Array.isArray(payload.result)) return result(502,{ok:false,code:'SANITY_RESPONSE_INVALID'})
    return result(200,{
      ok:true,
      checkedDataset:'production',
      perspective:'raw',
      draftBrandsFound:payload.result.length,
      recentDraftBrands:payload.result.map(d=>({
        name:typeof d.name==='string'?d.name:'(untitled)',
        updatedAt:typeof d._updatedAt==='string'?d._updatedAt:null
      }))
    })
  } catch {
    return result(502,{ok:false,code:'SANITY_REQUEST_ERROR'})
  }
}
