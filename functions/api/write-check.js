// POST /api/write-check（寫作園地，2026-11-21）
// 孩子寫完短文按「🔍 檢查我的作文」：
//   1. 文法、拼字：LanguageTool 免費公開 API（不用金鑰）
//   2. AI 老師建議：Cloudflare Workers AI（免費額度內不用錢）——要在 Cloudflare Pages 專案 bmlearn →
//      Settings → Bindings → Add → Workers AI，變數名稱填 AI（步驟寫在 CLOUDFLARE-SETUP.md 第九節）。沒設定時回 aiReady:false，頁面顯示「AI 建議還沒啟用」。
//      可選：Variables 設 AI_MODEL 換模型（預設 @cf/meta/llama-3.3-70b-instruct-fp8-fast，失敗改用 llama-3.1-8b）。
// 只有登入（Cloudflare Access＋USER_MAP 裡的人）才能用，免得額度被別人用掉。
import { whoAmI, json } from '../_auth.js';

const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];

async function grammar(text) {
  const r = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text, language: 'en-US' }),
  });
  if (!r.ok) throw new Error('languagetool ' + r.status);
  const j = await r.json();
  return (j.matches || []).slice(0, 25).map((m) => ({
    offset: m.offset, length: m.length, message: m.message, short: m.shortMessage,
    rep: (m.replacements || []).slice(0, 3).map((x) => x.value), type: (m.rule && m.rule.issueType) || '',
  }));
}

function prompt(b) {
  const lv = b.level === 2 ? 'about 50+ words (GEPT Elementary paragraph writing)' : 'about 30+ words (beginner)';
  return [
    { role: 'system', content:
      'You are a kind, encouraging English writing teacher in Taiwan. Your students are junior high school kids at GEPT Elementary (CEFR A2) level. ' +
      'Write ALL Chinese in Traditional Chinese as used in Taiwan (繁體中文), never Simplified Chinese. Keep the Chinese short and easy for a 13-year-old. ' +
      'Reply with ONLY a JSON object, no other text.' },
    { role: 'user', content:
      'Topic: "' + (b.topic || '') + '". Task: "' + (b.prompt || '') + '". Length goal: ' + lv + '. Note for this task: ' + (b.tense || '') + '\n\n' +
      'Student writing:\n"""\n' + b.text + '\n"""\n\n' +
      'Return JSON exactly in this shape:\n' +
      '{"praise":"one specific compliment in Traditional Chinese (1 sentence)",' +
      '"tips":[{"wrong":"the exact wrong or weak words from the student text","right":"the corrected or better English","why":"short reason in Traditional Chinese"}],' +
      '"idea":"one suggestion in Traditional Chinese for adding more detail, with one short English example sentence"}\n' +
      'Rules: at most 3 tips, choose the most important problems first (verb tense, subject-verb agreement, missing words, word order, word choice). ' +
      'If there are no real mistakes, give tips that make sentences richer (adjectives, because/so, time words). Do not rewrite the whole text. ' +
      'Copy "wrong" exactly from the student text.' },
  ];
}

function parse(s) {
  if (s && typeof s === 'object') return s;
  s = String(s || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    return {
      praise: String(o.praise || ''),
      tips: (Array.isArray(o.tips) ? o.tips : []).slice(0, 3).map((t) => ({ wrong: String(t.wrong || ''), right: String(t.right || ''), why: String(t.why || '') })),
      idea: String(o.idea || ''),
    };
  } catch (e) { return null; }
}

async function teacher(env, b) {
  const list = env.AI_MODEL ? [env.AI_MODEL].concat(MODELS) : MODELS;
  let last = null;
  for (const m of list) {
    try {
      const res = await env.AI.run(m, { messages: prompt(b), max_tokens: 700, temperature: 0.3 });
      const o = parse(res && res.response);
      if (o) return o;
      last = new Error('unparsable');
    } catch (e) { last = e; }
  }
  throw last || new Error('ai');
}

export async function onRequestPost({ request, env }) {
  const me = await whoAmI(request, env);
  if (!me || !me.name) return json({ ok: false, error: 'auth' }, 401);
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const text = String(b.text || '').slice(0, 2000);
  if (!text.trim()) return json({ ok: false, error: 'empty' }, 400);
  b.text = text;
  const out = { ok: true, aiReady: !!env.AI };
  const jobs = [
    grammar(text).then((g) => { out.grammar = g; }).catch(() => { out.grammar = null; out.grammarError = true; }),
  ];
  if (env.AI) jobs.push(teacher(env, b).then((a) => { out.ai = a; }).catch(() => { out.ai = null; out.aiError = true; }));
  await Promise.all(jobs);
  return json(out);
}
