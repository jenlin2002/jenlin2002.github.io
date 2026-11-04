// Cloudflare Access 身分驗證（學習網站，2026-11-04）
// Access 用 Google 帳號登入後，每個請求都帶 Cf-Access-Jwt-Assertion；這裡驗證簽章，再用 USER_MAP 把 email 對照成網站名字。
// Cloudflare Pages 後台 → Settings → Variables and Secrets 要設定（使用者自己輸入，不寫進 repo）：
//   ACCESS_TEAM   Zero Trust 團隊網域，例如 myteam.cloudflareaccess.com
//   ACCESS_AUD    Access 應用程式的 Application Audience (AUD) Tag
//   USER_MAP      email=名字，用逗號分開，例如 branden@gmail.com=BRANDEN,melissa@gmail.com=MELISSA,我@gmail.com=PARENT
//   POINTS_URL    （第二階段）點數後端 Apps Script 的 /exec 網址
//   POINTS_SECRET （第二階段）和 Apps Script 指令碼屬性 CF_SECRET 相同的一串密語
let certCache = null;

function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function keys(team) {
  if (certCache && certCache.team === team && certCache.at > Date.now() - 3600e3) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  const j = await r.json();
  certCache = { team, at: Date.now(), keys: j.keys || [] };
  return certCache.keys;
}

async function verify(jwt, env) {
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) return null;
  const head = JSON.parse(new TextDecoder().decode(b64url(h)));
  const body = JSON.parse(new TextDecoder().decode(b64url(p)));
  const jwk = (await keys(env.ACCESS_TEAM)).find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) return null;
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (aud.indexOf(env.ACCESS_AUD) < 0) return null;
  if (body.exp && body.exp * 1000 < Date.now()) return null;
  return body;
}

// 回傳 { email, name }；name 空白＝這個 Google 帳號沒有在 USER_MAP 裡
export async function whoAmI(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt || !env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  let body = null;
  try { body = await verify(jwt, env); } catch (e) { return null; }
  if (!body || !body.email) return null;
  const email = String(body.email).toLowerCase();
  let name = '';
  String(env.USER_MAP || '').split(',').forEach((pair) => {
    const i = pair.lastIndexOf('=');
    if (i > 0 && pair.slice(0, i).trim().toLowerCase() === email) name = pair.slice(i + 1).trim().toUpperCase();
  });
  return { email, name };
}

export function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
