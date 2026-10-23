import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
export async function onRequestGet({env}){
 try{
  const data=await queryPublished(env,'*[_id=="gt-homepage" && _type=="homepage"][0]{slides}')
  const slides=Array.isArray(data?.slides)?data.slides.filter(s=>typeof s?.slug==='string').map(s=>({slug:s.slug,title:s.title||'',excerpt:s.excerpt||'',coverUrl:s.coverUrl||''})):[]
  return Response.json({ok:true,mode:'published-only',published:!!data,slides},{headers:PUBLIC_HEADERS})
 }catch(e){return publicQueryError('首頁精選',e)}
}
