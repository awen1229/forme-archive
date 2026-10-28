// Published-only, token-free browser-facing opening configuration for Pages.
// Draft documents are never returned. This endpoint changes no data.
const API='https://8nqupq9u.api.sanity.io/v2025-02-19';
const HEADERS={'Cache-Control':'no-store','Access-Control-Allow-Origin':'https://awen1229.github.io','Vary':'Origin'}
const ALLOWED=new Set(['draw','physics21','physics10','ink','letters','paper','print','offset','proof','anchor','registration',
'v25-material','v25-space','v25-index','v26-material','v26-space','v26-index',
'magnetic','diecut','exposure','ripple','editorial28','editorial29','none'])
export async function onRequestGet(){
 try{
  const url=new URL(API+'/data/query/production')
  url.searchParams.set('perspective','published')
  url.searchParams.set('query','*[_id=="gt-opening-settings"&&!(_id in path("drafts.**"))][0]{settingsJson,_updatedAt}')
  const response=await fetch(url.toString(),{cache:'no-store'})
  if(!response.ok)throw Error('Sanity published opening query HTTP '+response.status)
  const result=(await response.json()).result
  if(!result)return Response.json({ok:true,published:false,settings:null},{headers:HEADERS})
  let value;try{value=JSON.parse(result.settingsJson)}catch{throw Error('Malformed opening settings')}
  if(!value||!ALLOWED.has(value.mode)||!['once','always'].includes(value.repeat))throw Error('Unsupported opening settings')
  return Response.json({ok:true,published:true,settings:{mode:value.mode,repeat:value.repeat},
   updatedAt:result._updatedAt||''},{headers:HEADERS})
 }catch(e){
  console.error('Published opening settings query failed',e?.message)
  return Response.json({ok:false,error:'無法取得已發布首頁動畫設定'},{status:502,headers:HEADERS})
 }
}