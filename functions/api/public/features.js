import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
const QUERY='*[_type=="featureIssue" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_createdAt asc)[0...200]{title,slug,series,summary,articleSlugs,brandSlugs,coverFit,coverMobileFit,coverZoom,coverMobileZoom,coverX,coverY,coverMobileX,coverMobileY,"cover":cover.asset->url}'
export async function onRequestGet({env}){
 try{
  const result=await queryPublished(env,QUERY)
  if(!Array.isArray(result))throw new Error('Feature records not array')
  const records=result.filter(x=>typeof x?.title==='string'&&typeof x?.slug?.current==='string')
  return Response.json({ok:true,mode:'published-only',records},{headers:PUBLIC_HEADERS})
 }catch(e){return publicQueryError('專題',e)}
}
