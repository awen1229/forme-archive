import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
const QUERY='*[_type=="article" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))][0...300]{title,slug,brand,subject,subjects,category,publishedAt,createdAt,updatedAt,excerpt,body,source,sourceTitle,publisher,sourceAuthor,sourceDate,reviewedAt,coverFit,coverMobileFit,coverX,coverY,"cover":cover.asset->url}'
export async function onRequestGet({env}){
 try{
  const result=await queryPublished(env,QUERY)
  if(!Array.isArray(result))throw new Error('Article records not array')
  const records=result.filter(d=>typeof d?.title==='string'&&typeof d?.slug?.current==='string')
  return Response.json({ok:true,mode:'published-only',records},{headers:PUBLIC_HEADERS})
 }catch(e){return publicQueryError('文章',e)}
}
