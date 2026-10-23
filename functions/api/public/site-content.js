import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
export async function onRequestGet({env}){
 try{
  const data=await queryPublished(env,'*[_id=="gt-site-content" && _type=="gtSiteContent"][0]{fieldsJson}')
  return Response.json({ok:true,mode:'published-only',published:!!data,fieldsJson:typeof data?.fieldsJson==='string'?data.fieldsJson:null},{headers:PUBLIC_HEADERS})
 }catch(e){return publicQueryError('網站文字',e)}
}
