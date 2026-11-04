// GET /api/points?...（第二階段，Cloudflare 設了 POINTS_SECRET、POINTS_URL 才會用）
// 把 points.js 的請求代轉到 Apps Script，加上 cfuser（Cloudflare 驗證過的登入者）和 cfsecret；
// Apps Script 看到正確的 cfsecret 就把這個請求當成 cfuser 已登入（不用 PIN 憑證）。
// 孩子只能動自己的存摺；PARENT 可以看兩個孩子、用家長管理。
import { whoAmI, json } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.POINTS_SECRET || !env.POINTS_URL) return json({ error: 'not-configured' }, 404);
  const me = await whoAmI(request, env);
  if (!me || !me.name) return json({ ok: false, error: 'auth' }, 401);
  const src = new URL(request.url).searchParams;
  const q = new URLSearchParams();
  src.forEach((v, k) => { if (!/^(cfuser|cfsecret|token|callback)$/.test(k)) q.append(k, v); });
  const target = String(src.get('name') || '').toUpperCase();
  if (me.name !== 'PARENT' && target && target !== me.name) return json({ ok: false, error: 'auth' });
  q.set('token', 'cf');
  q.set('cfuser', me.name);
  q.set('cfsecret', env.POINTS_SECRET);
  const u = env.POINTS_URL + (env.POINTS_URL.indexOf('?') < 0 ? '?' : '&') + q.toString();
  const r = await fetch(u, { redirect: 'follow' });
  return new Response(await r.text(), {
    status: r.status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
