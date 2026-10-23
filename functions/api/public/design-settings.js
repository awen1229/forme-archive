import {queryPublished,publicQueryError,PUBLIC_HEADERS} from '../../_sanity-public.js'
export async function onRequestGet({env}){
 try{
  const doc=await queryPublished(env,'*[_id=="gt-design-settings" && _type=="gtDesignSettings"][0]{settingsJson}')
  return Response.json({ok:true,mode:'published-only',settingsJson:typeof doc?.settingsJson==='string'?doc.settingsJson:null},{headers:PUBLIC_HEADERS})
 }catch(error){return publicQueryError('視覺設定',error)}
}