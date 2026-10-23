import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
export async function onRequestGet({env}){
 try{
  const result=await queryPublished(env,'*[_id=="gt-index-featured-brands" && _type=="gtIndexFeaturedBrands"][0]{slugs}')
  return Response.json({ok:true,mode:'published-only',slugs:Array.isArray(result?.slugs)?result.slugs:null},{headers:PUBLIC_HEADERS})
 }catch(error){return publicQueryError('THE INDEX 精選品牌',error)}
}
