/* 成長學習館：全站字典（2026-11-18 使用者要求）
 * 在文章、講解、對話裡「點兩下」（電腦）或「長按」（手機、平板）一個英文字 → 跳出小框：中文意思、程度、原形、🔊 發音、☆ 存成字卡、外部字典連結。
 * 選取 1～3 個英文字時旁邊出現「🔍 查字典」小按鈕，點了一樣查。
 * 測驗還沒送出成績時不能查（各站的測驗狀態在 blocked() 判斷；新的測驗程式也可以 (window.DictGuard = window.DictGuard || []).push(fn)，fn(元素) 回傳 true 就擋）。
 * 查過的字記在「查詢紀錄」：這台裝置先記，有登入憑證時送到存摺試算表「查詢紀錄」分頁（Code.gs 的 dictlog），完整列表在 /dict/。
 * 字典資料 /dict/data/*.json 由 tools/dict/build_dict.py 從 ECDICT（MIT 授權）產生，中文轉成台灣繁體。
 * 載入方式：points.js 會自動載入這支；沒有 points.js 的頁面直接 <script src="/dict/dict.js?v=…" defer>。 */
(function () {
  if (window.Dict) return;
  var V = '20261118b', BASE = '/dict/';
  var shards = {}, popEl = null, chipEl = null, lastWord = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function who() {
    try { if (window.Points && Points.who) { var n = Points.who(); if (n) return n; } } catch (e) {}
    var n2 = String(get('quizStudentName') || '').trim();
    return (!n2 || /^訪客/.test(n2)) ? '' : n2.toUpperCase();
  }
  function loadScript(src, test) {
    return new Promise(function (ok) {
      if (test()) return ok();
      var s = document.createElement('script'); s.src = src;
      s.onload = s.onerror = function () { ok(); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  function needPoints() { return loadScript('/points.js?v=20261118a', function () { return !!window.Points || !!document.querySelector('script[src*="points.js"]'); }); }
  function needCards() { return needPoints().then(function () { return loadScript('/cards/cards.js?v=20261117a', function () { return !!window.Cards; }); }); }

  // ---------- 字典資料 ----------
  function shardOf(k) { var c = k.charAt(0); return c >= 'a' && c <= 'z' ? c : '0'; }
  function shard(s) {
    if (!shards[s]) shards[s] = fetch(BASE + 'data/' + s + '.json?v=' + V).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .catch(function (e) { delete shards[s]; throw e; });
    return shards[s];
  }
  function norm(w) { return String(w || '').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLowerCase(); }
  function entry(k, row) {
    if (!row || typeof row === 'string') return null;
    return { key: k, w: row[1] || k, t: row[0], lv: row[2] || '', lemma: row[3] || '' };
  }
  function raw(k) { return shard(shardOf(k)).then(function (d) { return d[k] || (d['@' + k] ? { form: d['@' + k] } : null); }); }
  // 找不到時試著去掉字尾（複數、過去式、-ing、比較級、所有格）
  function guesses(k) {
    var g = [];
    if (/'s$/.test(k)) g.push(k.slice(0, -2));
    if (/s'$/.test(k)) g.push(k.slice(0, -1));
    if (/ies$/.test(k)) g.push(k.slice(0, -3) + 'y');
    if (/(ches|shes|sses|xes|zes|oes)$/.test(k)) g.push(k.slice(0, -2));
    if (/s$/.test(k)) g.push(k.slice(0, -1));
    if (/ied$/.test(k)) g.push(k.slice(0, -3) + 'y');
    if (/ed$/.test(k)) { g.push(k.slice(0, -2)); g.push(k.slice(0, -1)); if (/(.)\1ed$/.test(k)) g.push(k.slice(0, -3)); }
    if (/ing$/.test(k)) { g.push(k.slice(0, -3)); g.push(k.slice(0, -3) + 'e'); if (/(.)\1ing$/.test(k)) g.push(k.slice(0, -4)); }
    if (/(er|est)$/.test(k)) { var b = k.replace(/(er|est)$/, ''); g.push(b); g.push(b + 'e'); if (/i$/.test(b)) g.push(b.slice(0, -1) + 'y'); }
    if (/ly$/.test(k)) g.push(k.slice(0, -2));
    if (/-/.test(k)) g.push(k.replace(/-/g, ' '), k.replace(/-/g, ''));
    return g.filter(function (x) { return x && x.length > 1 && x !== k; });
  }
  function lookup(word) {
    var k = norm(word);
    if (!k) return Promise.resolve(null);
    var tries = [k].concat(guesses(k));
    function step(i) {
      if (i >= tries.length) return Promise.resolve(null);
      return raw(tries[i]).then(function (r) {
        if (!r) return step(i + 1);
        if (r.form) return raw(r.form).then(function (r2) { var e = entry(r.form, r2); if (!e) return step(i + 1); e.from = k; return e; });
        var e = entry(tries[i], r); if (i > 0) e.from = k;
        if (e.lemma) return raw(e.lemma.toLowerCase()).then(function (r3) { e.base = entry(e.lemma.toLowerCase(), r3); return e; }, function () { return e; });
        return e;
      });
    }
    return step(0);
  }
  // 英文開頭相同的字（字典頁的建議）
  function prefix(q, n) {
    var k = norm(q); if (!k) return Promise.resolve([]);
    return shard(shardOf(k)).then(function (d) {
      return Object.keys(d).filter(function (x) { return x.charAt(0) !== '@' && x.indexOf(k) === 0; })
        .sort(function (a, b) { return a.length - b.length || (a < b ? -1 : 1); }).slice(0, n || 20)
        .map(function (x) { return entry(x, d[x]); });
    });
  }
  var zhList = null;
  function searchZh(q, n) {
    q = String(q || '').trim(); if (!q) return Promise.resolve([]);
    zhList = zhList || fetch(BASE + 'data/zh.json?v=' + V).then(function (r) { return r.json(); }).catch(function (e) { zhList = null; throw e; });
    return zhList.then(function (list) {
      var out = [];
      for (var i = 0; i < list.length && out.length < (n || 40); i++) if (list[i][1].indexOf(q) >= 0) out.push({ key: list[i][0], w: list[i][0], t: list[i][1] });
      return out;
    });
  }
  function shortZh(e) {
    return String(e.t || '').split('\n').filter(function (l) { return !/的(過去式|過去分詞|現在分詞|複數|比較級|最高級|第三人稱)/.test(l); })
      .slice(0, 2).join('；').slice(0, 80);
  }
  function posOf(e) { var m = /^([a-z]+\.)/.exec(e.t || ''); return m ? m[1] : ''; }
  function linesHtml(t) {
    return String(t || '').split('\n').map(function (l) {
      var m = /^([a-z]+\.)\s*(.*)$/.exec(l);
      return '<div class="dk-l">' + (m ? '<b>' + esc(m[1]) + '</b> ' + esc(m[2]) : esc(l)) + '</div>';
    }).join('');
  }

  // ---------- 發音 ----------
  function say(w) {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(w); u.lang = 'en-US'; u.rate = 0.9;
      var vs = speechSynthesis.getVoices() || [], v = vs.filter(function (x) { return /^en[-_]US/i.test(x.lang); })[0];
      if (v) u.voice = v;
      speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }

  // ---------- 測驗中不能查 ----------
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }
  function blocked(el) {
    if (!el) return false;
    try {
      var g = window.DictGuard || [];
      for (var i = 0; i < g.length; i++) if (g[i](el)) return true;
      // 段考題庫（sync.js）：還沒送出成績（訂正中可以查）
      if (document.getElementById('examSubmitBtn') && !document.body.classList.contains('exam-locked') && !document.querySelector('.q.fixing')) return true;
      // 國中文法／國中2000字測驗（gquiz.js）：作答中
      if (document.querySelector('[data-act="submit"]')) return true;
      // 英文測驗系統每週測驗（eqfix.js）：這一題還沒按「送出成績」
      var nb = document.getElementById('nextBtn');
      if (nb && nb.dataset.fkStage === 'pick' && el.closest('#quizCard')) return true;
      // 圖解單字（topic.html）：測驗分頁還沒送出
      var go = document.getElementById('go');
      if (go && visible(go) && /送出(成績|訂正)/.test(go.textContent) && el.closest('#panel, main, body')) return true;
      // 國家地理閱讀、我的字卡小測驗（fixkit.js）：還沒送出的那一份
      var kits = (window.FixKit && FixKit.kits) || [];
      for (var j = 0; j < kits.length; j++) if (kits[j].status === 'open' && kits[j].box && kits[j].box.contains(el)) return true;
      // 美式生活館（lifefix.js）：聽寫、聽力測驗、即時回應這一題還沒做完
      var tops = document.querySelectorAll('.qtop');
      for (var t = 0; t < tops.length; t++) {
        var box = tops[t].parentElement, nx = box && box.querySelector('button.next');
        if (box && box.contains(el) && visible(box) && (!nx || nx.disabled)) return true;
      }
    } catch (e) {}
    return false;
  }

  // ---------- 查詢紀錄 ----------
  function hkey() { return 'dictHist:' + (who() || '-'); }
  function qkey() { return 'dictQ:' + (who() || '-'); }
  function readJ(k, d) { try { return JSON.parse(get(k) || '') || d; } catch (e) { return d; } }
  function history() { return readJ(hkey(), []); }
  function record(e, word) {
    var en = e ? e.w : norm(word); if (!en) return;
    var zh = e ? shortZh(e) : '', now = new Date(), stamp = now.getFullYear() + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + ('0' + now.getDate()).slice(-2) + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    var src = String(document.title || '').replace(/\s+/g, ' ').trim().slice(0, 40), url = location.pathname + location.search;
    var h = history(), low = en.toLowerCase(), old = null;
    h = h.filter(function (x) { if (x.en.toLowerCase() === low) { old = x; return false; } return true; });
    h.unshift({ en: en, zh: zh || (old && old.zh) || '', n: ((old && old.n) || 0) + 1, last: stamp, first: (old && old.first) || stamp, src: src, url: url });
    set(hkey(), JSON.stringify(h.slice(0, 500)));
    if (!who()) return;
    var q = readJ(qkey(), []), hit = null;
    q.forEach(function (x) { if (x.en.toLowerCase() === low) hit = x; });
    if (hit) { hit.n++; hit.zh = zh || hit.zh; hit.src = src; hit.url = url; } else q.push({ en: en, zh: zh, n: 1, src: src, url: url });
    set(qkey(), JSON.stringify(q.slice(-200)));
    if (q.length >= 3) flush(); else { clearTimeout(record.t); record.t = setTimeout(flush, 15000); }
  }
  function tokenOf(n) {
    try { if (window.Points && Points.tokenOf) return Points.tokenOf(n) || ''; } catch (e) {}
    return (readJ('quizPointsTokens', {}) || {})[n] || '';
  }
  var flushing = false;
  function flush() {
    var name = who(); if (!name || flushing) return;
    var q = readJ(qkey(), []); if (!q.length || !tokenOf(name)) return;
    flushing = true;
    needPoints().then(function () {
      if (!window.Points || !Points.call) throw new Error('no-points');
      var batch = q.slice(0, 50);
      return Points.call({ action: 'dictlog', name: name, token: tokenOf(name), words: JSON.stringify(batch) }).then(function (d) {
        if (d && d.ok) { var rest = readJ(qkey(), []).slice(batch.length); set(qkey(), JSON.stringify(rest)); }
        else if (d && d.error === 'unknown-action') set('dictOldBackend', '1');
      });
    }).catch(function () {}).then(function () { flushing = false; });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  setTimeout(flush, 4000);

  // ---------- 畫面 ----------
  var css = '' +
    '.dk-pop{position:fixed;z-index:99990;width:min(360px,calc(100vw - 20px));max-height:min(70vh,520px);overflow:auto;background:#fffdf6;color:#2d2a22;border:1.5px solid #d9c79a;border-radius:16px;box-shadow:0 10px 32px rgba(0,0,0,.25);font:15px/1.6 system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;text-align:left}' +
    '.dk-pop *{box-sizing:border-box}' +
    '.dk-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px 6px;position:sticky;top:0;background:#fffdf6}' +
    '.dk-w{font:800 22px/1.2 Georgia,"Times New Roman",serif;color:#1f3b5c;word-break:break-word}' +
    '.dk-b{border:1.5px solid #c9d6e6;background:#eef4fb;color:#1f3b5c;border-radius:999px;min-width:32px;height:32px;padding:0 9px;font:700 15px/1 system-ui,sans-serif;cursor:pointer}' +
    '.dk-x{margin-left:auto;background:#fff;border-color:#ddd;color:#777}' +
    '.dk-lv{display:inline-block;padding:2px 9px;border-radius:999px;background:#e8f5ec;color:#1f6b3a;font:700 12px/1.6 system-ui,sans-serif}' +
    '.dk-bd{padding:2px 14px 10px}.dk-l{margin:3px 0}.dk-l b{color:#9a5b13;font-family:Georgia,serif;margin-right:2px}' +
    '.dk-wurow{margin:0 0 6px;padding:5px 9px;border-radius:10px;background:#eef4fb;font-size:13px;color:#1f3b5c}.dk-wu{display:inline-block;margin:2px 4px 0 0;padding:1px 8px;border-radius:999px;background:#fff;border:1px solid #c9d6e6;font-weight:700}' +
    '.dk-wu.ok{color:#1f6b3a;border-color:#9ccfab}.dk-wu.mid{color:#9a6a10;border-color:#e7c98a}.dk-wu.bad{color:#c0392b;border-color:#e3a99f}' +
    '.dk-sub{margin-top:8px;padding:8px 10px;border-radius:10px;background:#f5efe0;font-size:14px}.dk-sub .dk-hw{font:700 16px Georgia,serif;color:#1f3b5c}' +
    '.dk-note{color:#7a7259;font-size:13px;margin:4px 0}' +
    '.dk-ft{display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px 12px;border-top:1px dashed #e2d6b5}' +
    '.dk-ft a{display:inline-block;padding:4px 10px;border-radius:999px;background:#fff;border:1.5px solid #d6cdb4;color:#2f4538 !important;font:700 13px/1.5 system-ui,"Noto Sans TC",sans-serif;text-decoration:none}' +
    '.dk-lock{color:#b5761a;font-weight:700;padding:14px}' +
    '.dk-chip{position:fixed;z-index:99989;padding:7px 13px;border-radius:999px;border:0;background:#1f3b5c;color:#fff;font:700 14px/1 system-ui,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer}' +
    '.ck-pop{z-index:99995 !important}' +
    '.dk-pop .ck-star{display:inline-flex;align-items:center;gap:3px;height:30px;padding:0 9px;border:1.5px solid #e0c27a;border-radius:999px;background:#fffbea;color:#b5761a;font:800 15px/1 system-ui,"Noto Sans TC","Microsoft JhengHei",sans-serif;cursor:pointer}' +
    '.dk-pop .ck-star .t{font-size:12px;font-weight:700}.dk-pop .ck-star.on{background:#f0b94a;border-color:#d99a1e;color:#fff}' +
    '@media (max-width:600px){.dk-pop{left:8px !important;right:8px;top:auto !important;bottom:calc(8px + env(safe-area-inset-bottom,0px));width:auto;max-height:60vh}}' +
    '@media print{.dk-pop,.dk-chip{display:none!important}}';
  function addCss() { if (document.getElementById('dk-css')) return; var s = document.createElement('style'); s.id = 'dk-css'; s.textContent = css; (document.head || document.body).appendChild(s); }

  function close() { if (popEl) { popEl.remove(); popEl = null; } hideChip(); }
  function hideChip() { if (chipEl) { chipEl.remove(); chipEl = null; } }
  function place(el, rect) {
    var w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    if (!rect) rect = { left: vw / 2 - w / 2, right: vw / 2 + w / 2, top: vh / 3, bottom: vh / 3 };
    var x = Math.max(8, Math.min(vw - w - 8, rect.left)), y = rect.bottom + 8;
    if (y + h > vh - 8) y = Math.max(8, rect.top - h - 8);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  function extLinks(w) {
    var q = encodeURIComponent(w);
    return '<a href="https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/' + q + '" target="_blank" rel="noopener">劍橋字典 ↗</a>' +
      '<a href="https://tw.dictionary.search.yahoo.com/search?p=' + q + '" target="_blank" rel="noopener">Yahoo 字典 ↗</a>';
  }
  function cardOf(e, word) {
    return { en: e ? e.w : word, zh: e ? shortZh(e) : '', pos: e ? posOf(e) : '', src: ('字典｜' + String(document.title || '').trim()).slice(0, 40), url: location.pathname + location.search };
  }
  function entryHtml(e, word) {
    if (!e) return '<div class="dk-bd"><div class="dk-note">字典裡找不到「' + esc(word) + '」（可能是人名、地名或比較少見的字）。可以到下面的外部字典查，再用「✏️ 自己加字卡」存起來。</div></div>';
    var h = '<div class="dk-bd">' + (e.from && e.from !== e.key ? '<div class="dk-note">「' + esc(e.from) + '」是 <b>' + esc(e.w) + '</b> 的變化形</div>' : '') + linesHtml(e.t);
    if (e.base) h += '<div class="dk-sub">原形 <span class="dk-hw">' + esc(e.base.w) + '</span>' + linesHtml(e.base.t) + '</div>';
    return h + '</div>';
  }
  function head(e, word) {
    var w = e ? e.w : word;
    return '<div class="dk-hd"><span class="dk-w">' + esc(w) + '</span>' +
      '<button type="button" class="dk-b" data-dk-say="' + esc(w) + '" title="發音">🔊</button>' +
      (e && e.lv ? '<span class="dk-lv">' + esc(e.lv) + '</span>' : '') +
      '<span class="dk-star"></span><button type="button" class="dk-b dk-x" data-dk-close title="關閉">✕</button></div>';
  }
  // ---------- WORD UP（已購買的網頁版）：這個字在哪個單元、孩子熟不熟（資料是家長在電腦登入 WORD UP 後讀取的 status.json） ----------
  var wu = null;
  function wordup() {
    if (!wu) wu = fetch('/english-quiz/vocab/wordup/status.json?v=' + V).then(function (r) { return r.json(); }).then(function (d) {
      var idx = {};
      Object.keys(d.units || {}).forEach(function (u) { (d.units[u].words || []).forEach(function (w) { idx[w.toLowerCase()] = { u: u, name: d.units[u].name, w: w }; }); });
      d.idx = idx; return d;
    }).catch(function () { wu = null; return null; });
    return wu;
  }
  var WU_CLS = { '熟記': 'ok', '不太熟': 'mid', '很模糊': 'bad', '沒印象': 'bad' };
  function wordupHtml(e, word) {
    var keys = [norm(word)]; if (e) keys.push(e.key, e.from, e.base && e.base.key);
    return wordup().then(function (d) {
      if (!d) return '';
      var hit = null; keys.forEach(function (k) { if (!hit && k && d.idx[k]) hit = d.idx[k]; });
      if (!hit) return '';
      var me = who(), people = (me === 'PARENT' || me === 'TEST' || !me) ? Object.keys(d.users || {}) : [me];
      var mine = {}; try { mine = JSON.parse(get('vocabWords:' + me) || '{}') || {}; } catch (er) {}
      var low = hit.w.toLowerCase();
      var tags = people.map(function (n) {
        var u = d.users && d.users[n]; if (!u) return '';
        var st = u.words && u.words[hit.w];
        var t = st ? st[0] + (st[1] ? ' ★' : '') : '還沒背';
        if (n === me && mine[low] === 'm') t += '（本站測驗已答對）';
        return '<span class="dk-wu ' + (st ? WU_CLS[st[0]] || '' : '') + '">' + (people.length > 1 ? esc(n) + '：' : '') + esc(t) + '</span>';
      }).join('');
      return '<div class="dk-wurow">🃏 WORD UP <b>' + esc(hit.name) + '</b> ' + tags + '</div>';
    });
  }

  function open(word, rect) {
    addCss(); close();
    lastWord = word;
    popEl = document.createElement('div'); popEl.className = 'dk-pop'; popEl.setAttribute('role', 'dialog');
    popEl.innerHTML = '<div class="dk-hd"><span class="dk-w">' + esc(word) + '</span><button type="button" class="dk-b dk-x" data-dk-close>✕</button></div><div class="dk-bd dk-note">查字典中…</div>';
    document.body.appendChild(popEl); place(popEl, rect);
    var me = popEl;
    lookup(word).then(function (e) {
      if (me !== popEl) return;
      var w = e ? e.w : norm(word) || word;
      me.innerHTML = head(e, w) + entryHtml(e, w) +
        '<div class="dk-ft">' + extLinks(w) + '<a href="' + BASE + '?q=' + encodeURIComponent(w) + '" target="_blank" rel="noopener">📖 字典頁</a>' +
        '<a href="' + BASE + '?q=' + encodeURIComponent(w) + '&edit=1" target="_blank" rel="noopener">✏️ 自己加字卡</a></div>';
      place(me, rect);
      record(e, w);
      wordupHtml(e, word).then(function (h) { if (h && me === popEl) { var bd = me.querySelector('.dk-bd'); if (bd) bd.insertAdjacentHTML('afterbegin', h); place(me, rect); } });
      var st = me.querySelector('.dk-star');
      if (st) st.innerHTML = window.Cards ? Cards.btn(cardOf(e, w), true)
        : '<button type="button" class="ck-star" title="存成字卡" data-card="' + esc(JSON.stringify(cardOf(e, w))) + '">☆<span class="t">存字卡</span></button>';
    }, function () {
      if (me !== popEl) return;
      me.querySelector('.dk-bd').textContent = '字典載入失敗，請檢查網路後再試一次。';
    });
  }
  function lockMsg(rect) {
    addCss(); close();
    popEl = document.createElement('div'); popEl.className = 'dk-pop';
    popEl.innerHTML = '<div class="dk-lock">🔒 測驗還沒送出成績，先不能查字典喔！送出成績後就可以查。</div>';
    document.body.appendChild(popEl); place(popEl, rect);
    var me = popEl; setTimeout(function () { if (popEl === me) close(); }, 2500);
  }

  // ---------- 點兩下、長按、選取 ----------
  var WORDS = /^[A-Za-z][A-Za-z'’\-]*( [A-Za-z][A-Za-z'’\-]*){0,2}$/;
  function selInfo() {
    var s = window.getSelection && getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    var text = String(s.toString()).replace(/\s+/g, ' ').trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (!text || text.length > 40 || !WORDS.test(text)) return null;
    var node = s.anchorNode, el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .dk-pop, .ck-pop, .dk-chip, [data-dict-off]')) return null;
    var r = s.getRangeAt(0).getBoundingClientRect();
    return { text: text, el: el, rect: r };
  }
  function go(info) {
    hideChip();
    if (blocked(info.el)) { lockMsg(info.rect); return; }
    open(info.text, info.rect);
  }
  var lastDbl = 0;
  document.addEventListener('dblclick', function (e) {
    if (e.target.closest && e.target.closest('button, a, input, textarea, select, .dk-pop, .ck-pop')) return;
    setTimeout(function () { var info = selInfo(); if (info) { lastDbl = Date.now(); go(info); } }, 10);
  });
  var selTimer = 0;
  function chipSoon() {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      if (Date.now() - lastDbl < 600) return;
      var info = selInfo();
      if (!info) { hideChip(); return; }
      if (popEl && info.text === lastWord) return;
      addCss(); hideChip();
      chipEl = document.createElement('button'); chipEl.type = 'button'; chipEl.className = 'dk-chip';
      chipEl.textContent = '🔍 查字典';
      document.body.appendChild(chipEl);
      var r = info.rect, x = Math.max(8, Math.min(innerWidth - chipEl.offsetWidth - 8, r.left + r.width / 2 - chipEl.offsetWidth / 2));
      var y = r.bottom + 12; if (y + 40 > innerHeight) y = Math.max(8, r.top - 50);
      // 手機長按時系統選單在選取字的上方，按鈕放下方
      chipEl.style.left = x + 'px'; chipEl.style.top = y + 'px';
      chipEl.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      chipEl.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); var i2 = selInfo() || info; go(i2); });
    }, 350);
  }
  document.addEventListener('selectionchange', chipSoon);
  // ☆ 存字卡：按下去才載入字卡程式（沒登入的頁面不會因為查字典就跳出登入關卡）
  document.addEventListener('click', function (e) {
    var b = !window.Cards && e.target.closest && e.target.closest('.dk-pop .ck-star');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    b.disabled = true;
    needCards().then(function () { b.disabled = false; if (window.Cards) b.click(); });
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var sb = t.closest('[data-dk-say]');
    if (sb) { e.preventDefault(); if (!say(sb.getAttribute('data-dk-say'))) sb.title = '這台裝置沒有英文語音'; return; }
    if (t.closest('[data-dk-close]')) { e.preventDefault(); close(); return; }
    if (popEl && !t.closest('.dk-pop, .ck-pop, .dk-chip')) close();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  // 捲動時按鈕跟著選取的字移動（選取還在就重新放）
  addEventListener('scroll', function () { if (chipEl) { hideChip(); chipSoon(); } }, { passive: true });

  window.Dict = { open: open, lookup: lookup, prefix: prefix, searchZh: searchZh, shortZh: shortZh, posOf: posOf, linesHtml: linesHtml, extLinks: extLinks,
    say: say, wordupHtml: wordupHtml, history: history, record: record, flush: flush, blocked: blocked, who: who, esc: esc, needCards: needCards, needPoints: needPoints, tokenOf: tokenOf, cardOf: cardOf, V: V };
})();
