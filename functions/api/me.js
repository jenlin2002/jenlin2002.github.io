// GET /api/me → { name, email, proxy }：points.js 用來自動設定登入者（不再選名字＋PIN）
import { whoAmI, json } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const me = await whoAmI(request, env);
  if (!me) return json({ error: 'no-access' }, 401);
  if (!me.name) return json({ error: 'unknown-user', email: me.email }, 403);
  return json({ name: me.name, email: me.email, proxy: !!(env.POINTS_SECRET && env.POINTS_URL) });
}
