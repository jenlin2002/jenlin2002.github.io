// GET /api/big?p=<repo>/<路徑>：超過 25 MB、不能放進 Cloudflare Pages 的大檔（段考題庫的聽力 zip、社會 PDF）由這裡轉給登入的人（2026-11-05）。
// 部署時 workflow 會在 _redirects 把這些檔的原路徑 302 轉到這裡。
// 有 REPOS_TOKEN（Cloudflare 變數，Secret；和 GitHub Actions 的 REPOS_TOKEN 同一把、只能讀 5 個子站 repo）：從 GitHub API 讀，repo 是 Private 也讀得到。
// 沒有 REPOS_TOKEN：直接轉到 GitHub 原始檔（只有 Public repo 能用）。
import { whoAmI } from '../_auth.js';

const REPOS = ['english-quiz', 'vocab-king', 'daily_life_listening', 'nat-geo-reading', 'exam-bank'];

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams.get('p') || '';
  const i = p.indexOf('/');
  const repo = p.slice(0, i), path = p.slice(i + 1);
  if (i < 1 || REPOS.indexOf(repo) < 0 || !path || path.split('/').some((s) => !s || s === '.' || s === '..'))
    return text('路徑不對', 400);
  const enc = path.split('/').map(encodeURIComponent).join('/');
  if (!env.REPOS_TOKEN) return Response.redirect(`https://raw.githubusercontent.com/jenlin2002/${repo}/main/${enc}`, 302);

  const me = await whoAmI(request, env);
  if (!me || !me.name) return text('請先登入', 401);

  const r = await fetch(`https://api.github.com/repos/jenlin2002/${repo}/contents/${enc}?ref=main`, {
    headers: { 'User-Agent': 'bmlearn', Accept: 'application/vnd.github.raw', Authorization: 'Bearer ' + env.REPOS_TOKEN },
  });
  if (!r.ok) return text('檔案讀不到（GitHub ' + r.status + '）', r.status === 404 ? 404 : 502);
  const name = path.split('/').pop();
  const type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.zip$/i.test(name) ? 'application/zip'
    : /\.mp3$/i.test(name) ? 'audio/mpeg' : 'application/octet-stream';
  const h = { 'content-type': type, 'cache-control': 'private, max-age=3600',
    'content-disposition': (type === 'application/zip' ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(name) };
  const len = r.headers.get('content-length'); if (len) h['content-length'] = len;
  return new Response(r.body, { headers: h });
}

function text(s, status) {
  return new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
