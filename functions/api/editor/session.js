import {requireEditor, errorResponse} from './brand.js'

export async function onRequestGet({request, env}) {
  try {
    await requireEditor(request, env)
    return Response.redirect(new URL('/magazine-site-cloud-1.6-preview.html#/admin', request.url), 302)
  } catch (error) {
    return errorResponse(error)
  }
}
