import {requireEditor} from './brand.js'

// ASCII-only diagnostic responses avoid text encoding issues in mobile previews.
// Only public configuration *names* can be returned. Never return credentials,
// email addresses, JWT claims, or other sensitive runtime values.
const requiredVariables = ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'EDITOR_EMAIL']
const errorCodes = {
  '管理員登入尚未設定完成': 'CONFIG_MISSING',
  '登入網域設定有誤': 'TEAM_DOMAIN_INVALID',
  '請先登入管理員帳號': 'ACCESS_LOGIN_REQUIRED',
  '登入資訊無效': 'ACCESS_TOKEN_INVALID',
  '登入簽章格式無效': 'ACCESS_TOKEN_FORMAT',
  '這個帳號沒有編輯權限': 'ACCESS_IDENTITY_MISMATCH',
  '目前無法驗證管理員登入': 'ACCESS_KEYS_UNAVAILABLE',
  '找不到有效登入簽章': 'ACCESS_KEY_NOT_FOUND',
  '登入簽章驗證失敗': 'ACCESS_SIGNATURE_INVALID',
}
export async function onRequestGet({request, env}) {
  try {
    await requireEditor(request, env)
    return Response.redirect(new URL('/magazine-site-cloud-1.6-preview.html#/admin', request.url), 302)
  } catch (error) {
    const missing = requiredVariables.filter(name => !env?.[name])
    const code = missing.length ? 'CONFIG_MISSING' : (errorCodes[error?.message] || 'SERVER_ERROR')
    const status = Number.isInteger(error?.status) ? error.status : 500
    return Response.json(
      {ok: false, code, ...(missing.length ? {missing} : {})},
      {status, headers: {'Cache-Control': 'no-store'}}
    )
  }
}
