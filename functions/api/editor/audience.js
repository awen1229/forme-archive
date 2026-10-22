// Temporary diagnostic endpoint for the GOOD THINGS, preview branch.
// Returns only the Access application audience from a cryptographically verified token.
// Remove after ACCESS_AUD is configured.
const TEAM_ORIGIN = 'https://forme-archive-pages.cloudflareaccess.com';
const HEADERS = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
function respond(status, body) {
  return new Response(JSON.stringify(body), {status, headers:HEADERS});
}
function decodePart(part) {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length/4)*4, '=')), x => x.charCodeAt(0));
}
export async function onRequestGet({request}) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const parts = jwt.split('.');
  if (parts.length !== 3 || parts.some(x => !x)) {
    return respond(401, {ok:false,error:'Sign in through the protected preview website first.'});
  }
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(decodePart(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(decodePart(parts[1])));
  } catch {
    return respond(401,{ok:false,error:'Invalid Access assertion'});
  }
  const now = Math.floor(Date.now()/1000);
  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' ||
      payload?.iss !== TEAM_ORIGIN || typeof payload.exp !== 'number' ||
      payload.exp <= now || (typeof payload.nbf === 'number' && payload.nbf > now) ||
      !Array.isArray(payload.aud) || !payload.aud.length) {
    return respond(403,{ok:false,error:'Access assertion did not match this application'});
  }
  try {
    const r = await fetch(TEAM_ORIGIN + '/cdn-cgi/access/certs');
    if (!r.ok) throw new Error('Could not load Access signing keys');
    const keys = await r.json();
    const jwk = (keys.keys || []).find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return respond(401,{ok:false,error:'Access signing key not found'});
    const key = await crypto.subtle.importKey(
      'jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',key,decodePart(parts[2]),
      new TextEncoder().encode(parts[0] + '.' + parts[1])
    );
    if (!valid) return respond(401,{ok:false,error:'Invalid Access signature'});
    return respond(200,{ok:true,access_aud:payload.aud});
  } catch {
    return respond(503,{ok:false,error:'Could not verify Cloudflare Access signature'});
  }
}
