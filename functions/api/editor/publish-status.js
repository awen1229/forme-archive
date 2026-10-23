import {requireEditor,AuthError,errorResponse} from './brand.js'

// Protected, read-only diagnostic. Never reveal variable values, tokens,
// JWT claims, editor emails, or any Sanity document content.
const PREVIEW_HOST='feature-secure-editor-cloud.forme-archive.pages.dev'
const HEADERS={'Cache-Control':'no-store'}
export async function onRequestGet({request,env}){
 try{
  if(new URL(request.url).hostname!==PREVIEW_HOST)throw new AuthError(403,'Only the secured Preview hostname may inspect publishing readiness')
  await requireEditor(request,env)
  const enabled=env.ENABLE_PRODUCTION_PUBLISH==='true'
  return Response.json({
   ok:true,
   mode:'read-only',
   previewHostVerified:true,
   publishEnabled:enabled,
   flagPresent:typeof env.ENABLE_PRODUCTION_PUBLISH==='string',
   targetDataset:'production',
   productionMutated:false,
   nextAction:enabled?'Check the COMOLI cloud draft before any publish':'Check Pages Preview Variables and Secrets. Save ENABLE_PRODUCTION_PUBLISH as text true and redeploy Preview.'
  },{headers:HEADERS})
 }catch(error){return errorResponse(error)}
}
