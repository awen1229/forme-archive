import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
// One read-only dashboard for production's published content. Never inspect or
// return unpublished drafts; do not read the publish gate or perform mutations.
export async function onRequestGet({env}){
 try{
  const [brands,articles,home,site]=await Promise.all([
   queryPublished(env,'count(*[_type=="brand" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))])'),
   queryPublished(env,'count(*[_type=="article" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))])'),
   queryPublished(env,'*[_id=="gt-homepage" && _type=="homepage"][0]{slides}'),
   queryPublished(env,'*[_id=="gt-site-content" && _type=="gtSiteContent"][0]{fieldsJson}')
  ])
  if(!Number.isInteger(brands)||!Number.isInteger(articles))throw new Error('Invalid public content counts')
  return Response.json({ok:true,mode:'read-only',dataset:'production',productionMutated:false,
   publishedBrands:brands,publishedArticles:articles,
   homepagePublished:!!home&&Array.isArray(home.slides)&&home.slides.length>0,
   siteContentPublished:typeof site?.fieldsJson==='string'
  },{headers:PUBLIC_HEADERS})
 }catch(e){return publicQueryError('內容狀態',e)}
}
