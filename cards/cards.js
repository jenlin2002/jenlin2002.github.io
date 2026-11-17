/* 我的字卡（2026-11-17 使用者要求）：全站共用，放在首頁 repo /cards/cards.js，各網站用絕對路徑 /cards/cards.js 載入。
 * 字卡存在點數存摺同一個 Google 試算表的「字卡」「字卡分類」分頁（Code.gs 的 card* / deck* 動作），用存摺的登入憑證，所以跨裝置同步。
 * 需要先載入 points.js（用它的 Points.call／Points.auth／Points.who）。
 *
 * 各網站怎麼用：
 *   1. 在單字旁放按鈕：Cards.btn({ en, zh, pos, ex, exzh, img, audio, src, url }) 回傳 HTML（☆ 存字卡），點了選分類存起來；已存過的顯示 ★。
 *      img、audio、url 用網站根目錄開頭的絕對路徑（例如 /vocab-king/img/words/home-4/sink.jpg），字卡頁才找得到。
 *   2. 測驗答錯的字：Cards.addWrong([card, ...]) → 自動加入「錯題」分類（已存過的字只把錯次加 1）。
 *   3. 「我的字卡」頁：/cards/（分類、翻卡複習、小測驗、印出）。 */
(function () {
  if (window.Cards) return;
  var WRONG = '錯題', DEFAULT = '未分類', HOME = '/cards/';
  var state = { list: null, decks: [], loading: null, name: '' };

  function P() { return window.Points; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function who() {
    try { if (P() && P().who) { var n = P().who(); if (n) return n; } } catch (e) {}
    var n2 = ''; try { n2 = String(localStorage.getItem('quizStudentName') || '').trim(); } catch (e) {}
    return (!n2 || /^訪客/.test(n2)) ? '' : n2.toUpperCase();
  }
  function ready() { return !!(P() && P().call && P().auth && P().enabled !== false); }

  // ---- 後端 ----
  function api(params) {
    if (!ready()) return Promise.reject(new Error('no-points'));
    var name = who();
    if (!name) return Promise.reject(new Error('login'));
    return P().auth(name).then(function (tok) {
      if (!tok) throw new Error('auth');
      return P().call(Object.assign({ name: name, token: tok }, params));
    }).then(function (d) {
      if (!d) throw new Error('network');
      if (d.error === 'unknown-action') throw new Error('old-backend');
      if (d.error === 'auth') throw new Error('auth');
      if (!d.ok) throw new Error(d.error || 'error');
      return d;
    });
  }
  function errText(e) {
    var m = e && e.message;
    if (m === 'login') return '請先登入（右上角或「你是誰？」），才能存字卡。';
    if (m === 'auth') return '登入過期了，請重新整理頁面再登入一次。';
    if (m === 'old-backend') return '字卡功能的後端還沒更新：請家長把新版 Code.gs 貼到 Apps Script 並部署新版本。';
    if (m === 'no-points') return '點數存摺沒有載入，暫時不能存字卡。';
    return '連不上字卡系統，請稍後再試。';
  }
  function load(force) {
    var name = who();
    if (!force && state.list && state.name === name) return Promise.resolve(state);
    if (!force && state.loading) return state.loading;
    state.loading = api({ action: 'cardlist' }).then(function (d) {
      state.list = d.cards || []; state.decks = d.decks || []; state.name = name; state.loading = null; mark(); return state;
    }, function (e) { state.loading = null; throw e; });
    return state.loading;
  }
  function savedMap() { var m = {}; (state.list || []).forEach(function (c) { m[c.en.toLowerCase()] = c; }); return m; }
  function merge(saved) {
    if (!state.list) return;
    var m = savedMap();
    (saved || []).forEach(function (c) { var o = m[c.en.toLowerCase()]; if (o) Object.assign(o, c); else state.list.push(c); if (state.decks.indexOf(c.deck) < 0) state.decks.push(c.deck); });
    mark();
  }

  // ---- 樣式 ----
  var css = '.ck-star{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:30px;height:30px;padding:0 8px;border:1.5px solid #e0c27a;border-radius:999px;background:#fffbea;color:#b5761a;font:800 15px/1 system-ui,"Noto Sans TC","Microsoft JhengHei",sans-serif;cursor:pointer;vertical-align:middle}' +
    '.ck-star:hover{background:#fff3d0}.ck-star.on{background:#f0b94a;border-color:#d99a1e;color:#fff}.ck-star .t{font-size:12px;font-weight:700}' +
    '.ck-pop{position:fixed;z-index:9600;width:min(320px,calc(100vw - 24px));background:#fffdf6;border:2px solid #e0c27a;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:12px;font:14px/1.5 system-ui,"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#3b2f1a}' +
    '.ck-pop h4{margin:0 0 6px;font-size:15px}.ck-pop .w{font-weight:800;color:#1b3a2f}.ck-pop .ds{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}' +
    '.ck-pop .ds button,.ck-pop .row button{border:1.5px solid #d8c9a0;background:#fff;border-radius:999px;padding:5px 11px;font:700 13px inherit;font-family:inherit;cursor:pointer;color:#3b2f1a}' +
    '.ck-pop .ds button.on{background:#1b3a2f;border-color:#1b3a2f;color:#fff}.ck-pop .row{display:flex;gap:6px;align-items:center;margin-top:6px}' +
    '.ck-pop input{flex:1;min-width:0;padding:6px 9px;border:1.5px solid #d8c9a0;border-radius:10px;font:14px inherit;font-family:inherit}' +
    '.ck-pop .go{background:#1b3a2f!important;border-color:#1b3a2f!important;color:#fff!important}.ck-pop .del{color:#c0392b!important;border-color:#e3a99f!important}' +
    '.ck-pop .msg{font-size:13px;color:#7a6a48;margin-top:6px}.ck-pop a{color:#2f6fb5;font-weight:700}' +
    '.ck-toast{position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9700;max-width:calc(100vw - 24px);background:#1b3a2f;color:#fff;border-radius:12px;padding:10px 14px;font:600 14px/1.5 system-ui,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)}' +
    '.ck-toast a{color:#f0d27a;font-weight:800;margin-left:6px}' +
    '@media print{.ck-star,.ck-pop,.ck-toast{display:none!important}}';
  function addCss() { if (document.getElementById('ck-css')) return; var s = document.createElement('style'); s.id = 'ck-css'; s.textContent = css; (document.head || document.documentElement).appendChild(s); }

  var toastEl = null, toastT = 0;
  function toast(html, ms) {
    addCss();
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ck-toast'; document.body.appendChild(toastEl); }
    toastEl.innerHTML = html; toastEl.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, ms || 4000);
  }

  // ---- ☆ 按鈕 ----
  function cardOf(btn) { try { return JSON.parse(btn.getAttribute('data-card')); } catch (e) { return null; } }
  function mark() {
    if (!state.list) return;
    var m = savedMap();
    Array.prototype.forEach.call(document.querySelectorAll('.ck-star[data-card]'), function (b) {
      var c = cardOf(b), s = c && m[String(c.en).toLowerCase()];
      b.classList.toggle('on', !!s);
      var t = b.querySelector('.t');
      b.firstChild.nodeValue = s ? '★' : '☆';
      b.title = s ? '已存在字卡「' + s.deck + '」' : '存成字卡';
      if (t) t.textContent = s ? '已存' : '存字卡';
    });
  }
  var markT = 0;
  function markSoon() { clearTimeout(markT); markT = setTimeout(mark, 200); }

  var popEl = null;
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  function openPop(btn) {
    addCss(); closePop();
    var card = cardOf(btn); if (!card || !card.en) return;
    popEl = document.createElement('div'); popEl.className = 'ck-pop';
    var r = btn.getBoundingClientRect();
    popEl.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 332)) + 'px';
    popEl.style.top = (r.bottom + 260 > window.innerHeight ? Math.max(12, r.top - 250) : r.bottom + 6) + 'px';
    popEl.innerHTML = '<h4>⭐ 存成字卡：<span class="w">' + esc(card.en) + '</span></h4><div class="msg">讀取你的字卡分類中…</div>';
    document.body.appendChild(popEl);
    load().then(function () { drawPop(card); }, function (e) { if (popEl) popEl.querySelector('.msg').textContent = errText(e); });
  }
  function drawPop(card) {
    if (!popEl) return;
    var old = savedMap()[card.en.toLowerCase()];
    var decks = state.decks.filter(function (d) { return d !== WRONG; });
    if (decks.indexOf(DEFAULT) < 0) decks.unshift(DEFAULT);
    var cur = old ? old.deck : (localStorage.getItem('ckLastDeck') || DEFAULT);
    popEl.innerHTML = '<h4>⭐ ' + (old ? '已存在字卡' : '存成字卡') + '：<span class="w">' + esc(card.en) + '</span> ' + esc(card.zh || '') + '</h4>' +
      '<div>選分類：</div><div class="ds">' + decks.map(function (d) { return '<button type="button" data-d="' + esc(d) + '"' + (d === cur ? ' class="on"' : '') + '>' + esc(d) + '</button>'; }).join('') +
      (old && old.deck === WRONG ? '<button type="button" class="on" data-d="' + WRONG + '">' + WRONG + '</button>' : '') + '</div>' +
      '<div class="row"><input placeholder="新分類名稱（例如：動物、旅行）" maxlength="20"><button type="button" class="go" data-new>＋</button></div>' +
      '<div class="row">' + (old ? '<button type="button" class="del" data-rm>移除這張字卡</button>' : '') + '<button type="button" data-x style="margin-left:auto">關閉</button></div>' +
      '<div class="msg">' + (old ? '目前在「' + esc(old.deck) + '」，點別的分類就移過去。' : '點一個分類就存好了。') + ' <a href="' + HOME + '">看我的字卡 →</a></div>';
    popEl.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-x')) return closePop();
      if (b.hasAttribute('data-rm')) return remove(card, old);
      var d = b.hasAttribute('data-new') ? popEl.querySelector('input').value.trim() : b.getAttribute('data-d');
      if (!d) { popEl.querySelector('input').focus(); return; }
      save(card, d, old);
    };
    popEl.querySelector('input').onkeydown = function (e) { if (e.key === 'Enter') popEl.querySelector('[data-new]').click(); };
  }
  function busy(t) { if (popEl) popEl.querySelector('.msg').textContent = t; }
  function save(card, deck, old) {
    busy('儲存中…');
    try { localStorage.setItem('ckLastDeck', deck); } catch (e) {}
    var p = old ? api({ action: 'cardmove', ids: old.id, deck: deck }).then(function () { old.deck = deck; if (state.decks.indexOf(deck) < 0) state.decks.push(deck); mark(); })
      : api({ action: 'cardsave', deck: deck, cards: JSON.stringify([card]) }).then(function (d) { merge(d.saved); });
    p.then(function () { closePop(); toast('⭐ 已存到字卡「' + esc(deck) + '」<a href="' + HOME + '">看我的字卡</a>'); }, function (e) { busy(errText(e)); });
  }
  function remove(card, old) {
    busy('移除中…');
    api({ action: 'carddel', ids: old.id }).then(function () {
      state.list = state.list.filter(function (c) { return c.id !== old.id; }); mark(); closePop(); toast('已移除字卡「' + esc(card.en) + '」');
    }, function (e) { busy(errText(e)); });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ck-star[data-card]');
    if (b) { e.preventDefault(); e.stopPropagation(); openPop(b); return; }
    if (popEl && !e.target.closest('.ck-pop')) closePop();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });

  function start() {
    addCss();
    if (window.MutationObserver) new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length) { markSoon(); break; }
    }).observe(document.body, { childList: true, subtree: true });
    // 頁面上有 ☆ 按鈕又已登入（有憑證）時，讀一次字卡清單把存過的標成 ★（不跳出 PIN 視窗）
    setTimeout(function () {
      if (!document.querySelector('.ck-star') || !ready() || !who()) return;
      var tok = ''; try { tok = (JSON.parse(localStorage.getItem('quizPointsTokens') || '{}') || {})[who()] || ''; } catch (e) {}
      if (tok || (P().cfName && P().cfName())) load().catch(function () {});
    }, 1500);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.Cards = {
    btn: function (card, label) {
      return '<button type="button" class="ck-star" title="存成字卡" data-card="' + esc(JSON.stringify(card)) + '">☆' + (label ? '<span class="t">存字卡</span>' : '') + '</button>';
    },
    // 測驗答錯的字自動加入「錯題」（不跳視窗；沒登入或後端沒更新就安靜略過）
    addWrong: function (cards) {
      cards = (cards || []).filter(function (c) { return c && c.en; });
      if (!cards.length || !ready() || !who()) return Promise.resolve(null);
      var batches = [];
      for (var i = 0; i < cards.length; i += 10) batches.push(cards.slice(i, i + 10));
      return batches.reduce(function (pr, b) {
        return pr.then(function () { return api({ action: 'cardsave', wrong: '1', cards: JSON.stringify(b) }).then(function (d) { merge(d.saved); }); });
      }, Promise.resolve()).then(function () {
        toast('📇 答錯的 ' + cards.length + ' 個字已加入「錯題」字卡<a href="' + HOME + '">去複習</a>', 5000);
      }, function () { return null; });
    },
    api: api, load: load, state: state, errText: errText, toast: toast, esc: esc, who: who, WRONG: WRONG, DEFAULT: DEFAULT
  };
})();
