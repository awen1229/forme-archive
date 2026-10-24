export class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const bytes = (str) => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=')), c => c.charCodeAt(0))
const jsonPart = str => JSON.parse(new TextDecoder().decode(bytes(str)))

export async function requireEditor(request, env) {
  for (const name of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'EDITOR_EMAIL']) {
    if (!env[name]) throw new AuthError(503, '管理員登入尚未設定完成')
  }
  let domain
  try { domain = new URL(env.ACCESS_TEAM_DOMAIN.startsWith('https://') ? env.ACCESS_TEAM_DOMAIN : 'https://' + env.ACCESS_TEAM_DOMAIN) }
  catch { throw new AuthError(503, '登入網域設定有誤') }
  if (domain.protocol !== 'https:' || !domain.hostname.endsWith('.cloudflareaccess.com') || domain.pathname !== '/') {
    throw new AuthError(503, '登入網域設定有誤')
  }
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || ''
  const parts = jwt.split('.')
  if (parts.length !== 3 || parts.some(part => !part)) throw new AuthError(401, '請先登入管理員帳號')
  let header, payload
  try { header = jsonPart(parts[0]); payload = jsonPart(parts[1]) }
  catch { throw new AuthError(401, '登入資訊無效') }
  if (header.alg !== 'RS256' || !header.kid) throw new AuthError(401, '登入簽章格式無效')
  const now = Math.floor(Date.now() / 1000)
  if (payload.iss !== domain.origin || !Array.isArray(payload.aud) || !payload.aud.includes(env.ACCESS_AUD) ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      (typeof payload.nbf === 'number' && payload.nbf > now) ||
      String(payload.email || '').toLowerCase() !== String(env.EDITOR_EMAIL).trim().toLowerCase()) {
    throw new AuthError(403, '這個帳號沒有編輯權限')
  }
  let keyset
  try {
    const reply = await fetch(domain.origin + '/cdn-cgi/access/certs')
    if (!reply.ok) throw Error('jwks unavailable')
    keyset = await reply.json()
  } catch { throw new AuthError(503, '目前無法驗證管理員登入') }
  const jwk = (keyset.keys || []).find(k => k.kid === header.kid && k.kty === 'RSA')
  if (!jwk) throw new AuthError(401, '找不到有效登入簽章')
  let valid = false
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify'])
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))
  } catch { /* invalid signature or key */ }
  if (!valid) throw new AuthError(401, '登入簽章驗證失敗')
  return payload.email
}

export function errorResponse(error) {
  const status = error instanceof AuthError ? error.status : 500
  const message = error instanceof AuthError ? error.message : '服務暫時無法使用'
  return Response.json({ok: false, error: message}, {status, headers: {'Cache-Control':'no-store'}})
}

const PROJECT = '8nqupq9u'
const DATASET = 'production'
const SANITY_BASE = `https://${PROJECT}.api.sanity.io/v2025-02-19`
const str = (v, max=200) => typeof v === 'string' ? v.trim().slice(0, max) : ''
const slugify = v => str(v, 90).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
const safeInteger = (v, min, max) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : min

async function api(path, token, options={}) {
  const response = await fetch(SANITY_BASE + path, {
    ...options,
    headers: {...options.headers, Authorization: `Bearer ${token}`},
  })
  if (!response.ok) throw new Error(`Sanity API HTTP ${response.status}`)
  return response.json()
}

async function findBrand(slug, token) {
  const query = '*[_type == "brand" && slug.current == $slug]{_id,_type,name,slug,founder,foundedYear,country,japaneseName,summary,story,logo,cover,logoScale,logoOffsetX,logoOffsetY,tags,website}[0...20]'
  const params = new URLSearchParams({query, '$slug': JSON.stringify(slug), perspective:'raw'})
  const {result} = await api('/data/query/' + DATASET + '?' + params, token)
  const docs = Array.isArray(result) ? result : []
  return docs.find(d => d._id.startsWith('drafts.')) || docs[0] || null
}

async function uploadLogo(dataUrl, token) {
  if (!dataUrl) return null
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new AuthError(400, 'LOGO 僅接受 PNG、JPG 或 WebP 圖片')
  if (match[2].length > 5_600_000) throw new AuthError(413, 'LOGO 太大，請壓縮後重試')
  let raw
  try {raw = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0))}
  catch {throw new AuthError(400, 'LOGO 圖片資料有誤')}
  const response = await fetch(SANITY_BASE + '/assets/images/' + DATASET + '?filename=brand-logo', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': match[1]},
    body: raw,
  })
  if (!response.ok) throw new Error(`LOGO 上傳失敗（HTTP ${response.status}）`)
  const payload = await response.json()
  const id = payload.document?._id
  if (!id || !id.startsWith('image-')) throw new Error('LOGO 上傳回應不完整')
  return {id, url:typeof payload.document?.url==='string'?payload.document.url:''}
}

export async function onRequestPost({request, env}) {
  try {
    await requireEditor(request, env)
    if (!env.SANITY_EDITOR_TOKEN) throw new AuthError(503, 'Sanity 儲存尚未設定完成')
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      throw new AuthError(415, '資料格式必須是 JSON')
    }
    const origin = request.headers.get('Origin')
    if (!origin || origin !== new URL(request.url).origin) throw new AuthError(403, '網站來源驗證失敗')
    if (Number(request.headers.get('content-length') || 0) > 6_000_000) throw new AuthError(413, '資料太大')
    const raw = await request.text()
    if (raw.length > 6_000_000) throw new AuthError(413, '資料太大')
    let input
    try {input = JSON.parse(raw)} catch {throw new AuthError(400, 'JSON 格式有誤')}
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new AuthError(400, '資料格式有誤')

    const name = str(input.name, 120)
    if (!name) throw new AuthError(400, '請填寫品牌名稱')
    const slug = slugify(input.slug || name)
    if (!slug) throw new AuthError(400, '品牌網址代稱格式有誤')
    const founded = Number(input.founded)
    if (str(input.founded) && (!Number.isInteger(founded) || founded < 1800 || founded > 2100)) {
      throw new AuthError(400, '品牌創立年份格式有誤')
    }
    const website = str(input.url, 300)
    if (website && !/^https:\/\/[\w.-]+(?:\:\d+)?(?:\/[^\s]*)?$/i.test(website)) {
      throw new AuthError(400, '品牌官網請使用 https:// 網址')
    }
    const existing = await findBrand(slug, env.SANITY_EDITOR_TOKEN)
    const id = existing ? existing._id.replace(/^drafts\./, '') : 'gt-brand-' + slug
    const draftId = 'drafts.' + id
    const draft = existing?._id === draftId ? existing : null
    const publishedFields = existing && !draft ? Object.fromEntries(Object.entries(existing).filter(([key]) => !['_id','_createdAt','_updatedAt','_rev'].includes(key))) : {}
    const tags = (Array.isArray(input.tags) ? input.tags : []).slice(0, 20).map(x => str(x, 45)).filter(Boolean)
    const values = {
      name, slug: {_type:'slug',current:slug}, founder:str(input.founder, 180),
      summary:str(input.desc, 10_000), tags, website,
      logoScale:safeInteger(input.logoDisplay?.scale ?? 100,50,190),
      logoOffsetX:safeInteger(input.logoDisplay?.x ?? 0,-60,60),
      logoOffsetY:safeInteger(input.logoDisplay?.y ?? 0,-45,45),
    }
    if (str(input.founded)) values.foundedYear = founded
    const uploadedLogo = input.logo && String(input.logo).startsWith('data:')
      ? await uploadLogo(String(input.logo), env.SANITY_EDITOR_TOKEN) : null
    if (uploadedLogo) values.logo = {_type:'image',asset:{_type:'reference',_ref:uploadedLogo.id}}
    const unset = str(input.founded) ? [] : ['foundedYear']
    const mutations = [
      {createIfNotExists:{...publishedFields,_id:draftId,_type:'brand'}},
      {patch:{id:draftId,set:values,...(unset.length?{unset}:{})}},
    ]
    await api('/data/mutate/' + DATASET, env.SANITY_EDITOR_TOKEN, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mutations}),
    })
    return Response.json({ok:true,draftId,logoUrl:uploadedLogo?.url||''}, {headers:{'Cache-Control':'no-store'}})
  } catch(error) {
    if (!(error instanceof AuthError)) console.error('Brand cloud save failed:', error.message)
    return errorResponse(error)
  }
}
