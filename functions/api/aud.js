// GET /api/aud → { aud: [...] }：設定用。Cloudflare 新版後台找不到 AUD Tag 時，
// 先只設 ACCESS_TEAM，部署、登入後開這個網址，把看到的 AUD 填進 ACCESS_AUD。
// 只回傳簽章驗證通過的憑證裡的 aud（不是密碼，不含個人資料）。
import { readAud, json } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.ACCESS_TEAM) return json({ error: '請先在 Cloudflare 設定 ACCESS_TEAM' }, 400);
  const aud = await readAud(request, env);
  if (!aud) return json({ error: 'no-access' }, 401);
  return json({ aud, set: !!env.ACCESS_AUD });
}
