import {requireEditor, AuthError, errorResponse} from './brand.js'

const PROJECT = '8nqupq9u'
const DATASET = 'production'
const API = `https://${PROJECT}.api.sanity.io/v2025-02-19`
const noStore = {'Cache-Control':'no-store', 'Content-Type':'application/json; charset=utf-8'}

export async function onRequestGet({request,env}) {
  try {
    await requireEditor(request,env)
    if (!env.SANITY_EDITOR_TOKEN) throw new AuthError(503,'Sanity 尚未設定')
    const query = '*[_type == "brand" && !(_id in path("versions.**"))] | order(_updatedAt desc)[0...200]{_id,_rev,_updatedAt,_createdAt,name,slug,founder,foundedYear,summary,tags,website,logoScale,logoOffsetX,logoOffsetY,"logoUrl":logo.asset->url}'
    const u=new URL(API+'/data/query/'+DATASET)
    u.searchParams.set('perspective','raw')
    u.searchParams.set('query',query)
    const response=await fetch(u.toString(),{headers:{Authorization:`Bearer ${env.SANITY_EDITOR_TOKEN}`,Accept:'application/json'},cache:'no-store'})
    if(!response.ok) throw new AuthError(502,'無法查詢 Sanity 品牌資料（'+response.status+'）')
    const payload=await response.json()
    if(!Array.isArray(payload.result)) throw new AuthError(502,'Sanity 資料格式不正確')
    const pairs=new Map()
    for(const d of payload.result){
      if (!d || typeof d.name!=='string' || !d.slug?.current || !d._id)continue
      const slug=String(d.slug.current)
      if(!/^[a-z0-9-]{1,90}$/.test(slug))continue
      const draft=d._id.startsWith('drafts.')
      const record={
        slug,name:d.name,founder:d.founder||'',founded:d.foundedYear==null?'':String(d.foundedYear),
        desc:d.summary||'',tags:Array.isArray(d.tags)?d.tags:[],url:d.website||'',
        logo:d.logoUrl||'',logoDisplay:{
          scale:d.logoScale??100,x:d.logoOffsetX??0,y:d.logoOffsetY??0
        },updatedAt:d._updatedAt||'',createdAt:d._createdAt||'', revision:d._rev||''
      }
      const entry=pairs.get(slug)||{slug,hasDraft:false,hasPublished:false,draft:null,published:null}
      if(draft){entry.hasDraft=true;entry.draft=record}
      else{entry.hasPublished=true;entry.published=record}
      pairs.set(slug,entry)
    }
    const rows=[...pairs.values()].map(d=>({
      slug:d.slug,status:d.hasDraft?'draft':'published',hasPublished:d.hasPublished,
      ...d.draft||d.published
    })).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))
    return new Response(JSON.stringify({ok:true,records:rows}),{headers:noStore})
  }catch(e){
    if(!(e instanceof AuthError))console.error('Cloud brands list failed',e?.message)
    return errorResponse(e)
  }
}
