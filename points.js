/* 學習點數存摺（前端）。英文測驗與美式生活館共用同一份。
 *
 * 作用：
 *   1. 測驗做完呼叫 Points.earn({name,label,mode,correct,total}) → 後端記一筆賺點，畫面跳出「+N 點」。
 *   2. 右下角的「🪙 點數」按鈕 → 打開存摺：餘額、兌換、每一筆賺到與用掉的明細。
 *
 * 後端是 points/Code.gs（Google Apps Script）。部署後把網址貼到下面 POINTS_URL；
 * 空白時這支程式什麼都不做，頁面完全不受影響。
 * 測試時可在瀏覽器主控台執行 localStorage.quizPointsUrl = '網址' 覆蓋（不改檔案）。
 */
(function () {
  'use strict';
  var POINTS_URL = 'https://script.google.com/macros/s/AKfycbzo8HEUud9tA6tFYHIk6q2gaV3M8AhiApuylOip2ADfFeLKs8yXBmEq6-f-5KWBxG1wUA/exec';   // ← 部署 Code.gs 之後，把「網頁應用程式網址」貼在這裡（結尾是 /exec）

  var mem = {};
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return (k in mem) ? mem[k] : null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  function url() { return (get('quizPointsUrl') || POINTS_URL || '').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var API = window.Points = {};
  if (!url()) { API.enabled = false; API.earn = function () { return Promise.resolve(null); }; API.open = function () {}; API.mount = function () {}; return; }
  API.enabled = true;

  var state = { name: '', balance: null, ledger: [], rules: null, busy: false, msg: '', confirm: '', rid: '' };
  var nameGetter = null;
  API.setNameGetter = function (fn) { nameGetter = fn; };
  function curName() {
    var n = '';
    try { n = (nameGetter && nameGetter()) || ''; } catch (e) {}
    n = String(n || get('quizStudentName') || state.name || '').trim();
    return n ? n.toUpperCase() : '';
  }

  // ---------- 和後端講話（GET，讀得到回應；失敗時改用 JSONP） ----------
  function jsonp(u) {
    return new Promise(function (resolve, reject) {
      var cb = '__pts' + Date.now() + Math.floor(Math.random() * 1e6), s = document.createElement('script'), done = false;
      var end = function (fn, v) { if (done) return; done = true; delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); fn(v); };
      window[cb] = function (d) { end(resolve, d); };
      s.onerror = function () { end(reject, new Error('jsonp')); };
      setTimeout(function () { end(reject, new Error('timeout')); }, 20000);
      s.src = u + (u.indexOf('?') < 0 ? '?' : '&') + 'callback=' + cb;
      document.head.appendChild(s);
    });
  }
  function call(params) {
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var u = url() + (url().indexOf('?') < 0 ? '?' : '&') + q;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : 0;
    return fetch(u, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json(); })
      .catch(function () { return jsonp(u); })
      .then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  // ---------- 畫面 ----------
  var css = '' +
    '.pts-pill{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9000;display:flex;align-items:center;gap:6px;padding:9px 14px;border:0;border-radius:999px;background:#7a4b12;color:#fff8e6;font:700 15px/1 system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer}' +
    '.pts-pill:active{transform:scale(.97)}' +
    '.pts-pill b{font-variant-numeric:tabular-nums}' +
    '.pts-banner{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border:2px solid #f0b94a;border-radius:16px;background:linear-gradient(135deg,#fff6d8,#ffe7a8);color:#5b3a0c;text-align:left;cursor:pointer;font-family:system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 2px 8px rgba(122,75,18,.15)}' +
    '.pts-banner:active{transform:scale(.99)}' +
    '.pts-bn-ico{font-size:30px;line-height:1}' +
    '.pts-bn-txt{flex:1;min-width:0;font-size:17px;line-height:1.35}' +
    '.pts-bn-txt small{display:block;font-size:13px;color:#8a6a35;margin-top:2px}' +
    '.pts-bn-txt .pts-bn-rule{font-size:12px;color:#6b5530;margin-top:4px}' +
    '.pts-bn-n{font-size:34px;font-weight:800;line-height:1;color:#7a4b12;font-variant-numeric:tabular-nums}' +
    '.pts-bn-n small{font-size:14px;font-weight:700;margin-left:2px}' +
    '.pts-bn-go{font-size:28px;color:#7a4b12}' +
    '.pts-toast{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9100;max-width:min(92vw,420px);padding:11px 16px;border-radius:14px;background:#2f2a22;color:#fff;font:600 15px/1.45 system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);text-align:center}' +
    '.pts-toast.good{background:#1f6b3a}' +
    '.pts-mask{position:fixed;inset:0;z-index:9200;background:rgba(30,24,15,.55);display:flex;align-items:flex-end;justify-content:center;padding:0}' +
    '@media(min-width:600px){.pts-mask{align-items:center;padding:20px}}' +
    '.pts-card{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#fffaf0;color:#3a2f20;border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));font:15px/1.5 system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35)}' +
    '@media(min-width:600px){.pts-card{border-radius:20px}}' +
    '.pts-card *{box-sizing:border-box}' +
    '.pts-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}' +
    '.pts-head h2{margin:0;font-size:19px}' +
    '.pts-x{border:0;background:#efe3c8;color:#5b4425;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer}' +
    '.pts-bal{background:linear-gradient(135deg,#fff1c7,#ffe29a);border-radius:16px;padding:14px 16px;margin-bottom:12px;text-align:center}' +
    '.pts-bal .n{font-size:44px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;color:#7a4b12}' +
    '.pts-bal .n small{font-size:17px;font-weight:700;margin-left:4px}' +
    '.pts-bal .s{font-size:13.5px;color:#7a5a2a;margin-top:2px}' +
    '.pts-who{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}' +
    '.pts-who button{flex:1;min-width:120px;padding:12px;border:2px solid #d9c593;border-radius:12px;background:#fff;font-weight:700;font-size:15px;font-family:inherit;color:#5b4425;cursor:pointer}' +
    '.pts-rd{display:grid;gap:8px;margin-bottom:12px}' +
    '.pts-pack{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;background:#fff;border:1px solid #ead9b0;border-radius:14px}' +
    '.pts-pack .t{font-weight:700}.pts-pack .c{font-size:13px;color:#8a7350}' +
    '.pts-pack button{flex:none;min-width:84px;padding:9px 12px;border:0;border-radius:10px;background:#2f8f4e;color:#fff;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer}' +
    '.pts-pack button:disabled{background:#d8cdb4;color:#8a7a58;cursor:default}' +
    '.pts-ask{padding:12px;border-radius:14px;background:#fff3d6;border:2px solid #f0b94a;margin-bottom:12px}' +
    '.pts-ask .row{display:flex;gap:8px;margin-top:8px}' +
    '.pts-ask button{flex:1;padding:10px;border:0;border-radius:10px;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}' +
    '.pts-ask .ok{background:#2f8f4e;color:#fff}.pts-ask .no{background:#e8dcc0;color:#5b4425}' +
    '.pts-msg{padding:10px 12px;border-radius:12px;background:#e6f4ea;color:#1f5a33;margin-bottom:12px;font-weight:600}' +
    '.pts-msg.bad{background:#fde8e6;color:#8a2a22}' +
    '.pts-h3{margin:14px 0 6px;font-size:15px;color:#6b5530}' +
    '.pts-tb{width:100%;border-collapse:collapse;font-size:13.5px}' +
    '.pts-tb td{padding:7px 4px;border-top:1px solid #ecdfc0;vertical-align:top}' +
    '.pts-tb .d{color:#8a7350;white-space:nowrap;width:1%}' +
    '.pts-tb .p{text-align:right;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;width:1%}' +
    '.pts-tb .p.up{color:#1f7a3f}.pts-tb .p.dn{color:#b3382c}' +
    '.pts-tb .b{text-align:right;color:#8a7350;font-variant-numeric:tabular-nums;white-space:nowrap;width:1%}' +
    '.pts-rules{margin:12px 0;padding:12px 14px;border-radius:14px;background:#eef6ea;border:1px solid #c9e0c0;color:#2f4a2a}' +
    '.pts-rt{font-weight:800;font-size:16px;margin-bottom:4px}' +
    '.pts-rs{font-weight:700;font-size:14px;margin:8px 0 2px;color:#1f6b3a}' +
    '.pts-rules ul{margin:0;padding-left:20px;font-size:14px;line-height:1.7}' +
    '.pts-rule{font-size:12.5px;color:#8a7350;line-height:1.6}' +
    '.pts-empty{padding:14px;text-align:center;color:#8a7350}';
  var styleEl = document.createElement('style'); styleEl.textContent = css;

  var pill, mask, toastEl, toastTimer;

  function fmtTime(t) { var m = /^\d{4}-(\d\d)-(\d\d) (\d\d:\d\d)/.exec(t || ''); return m ? (m[1] + '/' + m[2] + ' ' + m[3]) : esc(t); }

  var banners = [];
  function renderPill() {
    if (pill) pill.style.display = banners.length ? 'none' : '';   // 頁面上已有橫幅時，不再顯示右下角按鈕
    if (pill) pill.innerHTML = '🪙 <span>' + (state.balance != null ? '點數' : '我的點數') + '</span>' + (state.balance != null ? ' <b>' + state.balance + '</b>' : '');
    var n = curName();
    banners.forEach(function (el) {
      el.innerHTML = '<span class="pts-bn-ico">🪙</span><span class="pts-bn-txt">' +
        (n ? '<b>' + esc(n) + '</b> 的點數存摺' : '<b>我的點數存摺</b>') +
        '<small>' + (n ? (state.balance != null ? '目前 ' + state.balance + ' 點・點一下看明細、兌換' : state.failed ? '暫時讀不到點數，點一下再試' : '讀取中…') : '點一下，選你是誰，看自己的點數') + '</small>' +
        '<small class="pts-bn-rule">' + rulesLine() + '</small></span>' +
        (n && state.balance != null ? '<span class="pts-bn-n">' + state.balance + '<small>點</small></span>' : '<span class="pts-bn-go">›</span>');
    });
  }
  /** 把一個「點數橫幅」放進頁面上的某個元素（例如網站首頁），小朋友一進來就看得到自己的點數。 */
  API.mount = function (el) {
    if (!el) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pts-banner'; b.addEventListener('click', open);
    el.appendChild(b); banners.push(b); renderPill();
  };

  function toast(text, good) {
    if (!document.body) return;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pts-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.className = 'pts-toast' + (good ? ' good' : '');
    toastEl.textContent = text; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 6000);
  }

  function packInfo() {
    var p = (state.rules && state.rules.packs) || { time: { points: 10, minutes: 15, label: '15 分鐘電腦時間' }, money: { points: 100, label: 'NT$50 零用錢' } };
    return [['time', '⏱', p.time], ['money', '💵', p.money]];
  }

  // 集點與兌換規則（數字都從後端來，後端改了這裡自動跟著變；還沒讀到時用預設值）
  function ruleNums() {
    var r = state.rules || {}, p = packInfo();
    return { per: r.perCorrect || 1, cap: r.dailyCap || 50, lim: r.dailyTimeLimit || 75, time: p[0][2], money: p[1][2] };
  }
  function rulesHtml() {
    var n = ruleNums(), lim = n.lim;
    return '<div class="pts-rules"><div class="pts-rt">📖 點數規則</div>' +
      '<div class="pts-rs">怎麼賺點數</div><ul>' +
      '<li>答對 <b>1 題</b> 得 <b>' + n.per + ' 點</b>（測驗做完會自動加）</li>' +
      '<li>同一份測驗，<b>每天只有第一次</b>會加點，重做不再加</li>' +
      '<li>每天最多賺 <b>' + n.cap + ' 點</b></li></ul>' +
      '<div class="pts-rs">怎麼兌換</div><ul>' +
      '<li><b>' + n.time.points + ' 點</b> = ' + esc(n.time.label) + (lim ? '（每天最多換 <b>' + lim + ' 分鐘</b>）' : '') + '</li>' +
      '<li><b>' + n.money.points + ' 點</b> = ' + esc(n.money.label) + '</li>' +
      '<li>按「兌換」後<b>馬上扣點</b>，系統會寄信通知爸媽，由爸媽幫你處理</li>' +
      '<li>每一筆賺到和用掉的點數，都會記在下面的明細裡</li></ul></div>';
  }
  function rulesLine() {
    var n = ruleNums();
    return '答對 1 題 = ' + n.per + ' 點・' + n.time.points + ' 點 = ' + n.time.minutes + ' 分鐘電腦・' + n.money.points + ' 點 = NT$50';
  }

  function renderModal() {
    if (!mask) return;
    var name = curName(), bal = state.balance, h = '';
    h += '<div class="pts-head"><h2>🪙 ' + (name ? esc(name) + ' 的點數存摺' : '點數存摺') + '</h2><button class="pts-x" data-a="close" aria-label="關閉">✕</button></div>';
    if (!name) {
      h += '<div class="pts-who"><button data-a="who" data-n="BRANDEN">我是 BRANDEN</button><button data-a="who" data-n="MELISSA">我是 MELISSA</button></div>';
      h += '<div class="pts-empty">先選你是誰，才看得到自己的點數。</div>' + rulesHtml();
    } else {
      if (state.msg) h += '<div class="pts-msg' + (state.msgBad ? ' bad' : '') + '">' + esc(state.msg) + '</div>';
      var packs = packInfo(), tp = packs[0][2].points, tm = packs[0][2].minutes || 15;
      var limit = (state.rules && state.rules.dailyTimeLimit) || 0, usedNow = state.timeUsed || 0;
      var times = bal == null ? 0 : Math.floor(bal / tp);
      if (limit) times = Math.min(times, Math.max(0, Math.floor((limit - usedNow) / tm)));
      h += '<div class="pts-bal"><div class="n">' + (bal == null ? '…' : bal) + '<small>點</small></div>' +
        '<div class="s">' + (bal == null ? '讀取中…' : '今天還可以換 ' + times + ' 次電腦時間（' + times * tm + ' 分鐘）') + '</div></div>';
      if (state.confirm) {
        var pk = packs.filter(function (x) { return x[0] === state.confirm; })[0];
        h += '<div class="pts-ask"><b>確定用 ' + pk[2].points + ' 點兌換「' + esc(pk[2].label) + '」嗎？</b><div>按下去會馬上扣點，並通知爸媽。</div>' +
          '<div class="row"><button class="no" data-a="no">先不要</button><button class="ok" data-a="yes"' + (state.busy ? ' disabled' : '') + '>' + (state.busy ? '處理中…' : '確定兌換') + '</button></div></div>';
      }
      var lim = (state.rules && state.rules.dailyTimeLimit) || 0, used = state.timeUsed || 0;
      h += '<div class="pts-rd">' + packs.map(function (x) {
        var need = x[2].points, mins = x[2].minutes || 0;
        var full = !!(mins && lim && used + mins > lim), can = bal != null && bal >= need && !full;
        var note = mins && lim ? '・今天已換 ' + used + ' / ' + lim + ' 分鐘' : '';
        var label = bal == null ? '…' : full ? '今天額度用完' : can ? '兌換' : '還差 ' + (need - bal) + ' 點';
        return '<div class="pts-pack"><div><div class="t">' + x[1] + ' ' + esc(x[2].label) + '</div><div class="c">需要 ' + need + ' 點' + note + '</div></div>' +
          '<button data-a="redeem" data-k="' + x[0] + '"' + (can && !state.busy ? '' : ' disabled') + '>' + label + '</button></div>';
      }).join('') + '</div>';
      h += rulesHtml();
      h += '<div class="pts-h3">每一筆明細</div>';
      if (!state.ledger.length) h += '<div class="pts-empty">' + (bal == null ? '讀取中…' : '還沒有紀錄。做完測驗就會賺到點數！') + '</div>';
      else h += '<table class="pts-tb"><tbody>' + state.ledger.map(function (r) {
        return '<tr><td class="d">' + fmtTime(r.time) + '</td><td>' + esc(r.item) + (r.note ? '<div class="pts-rule">' + esc(r.note) + '</div>' : '') + '</td>' +
          '<td class="p ' + (r.delta >= 0 ? 'up' : 'dn') + '">' + (r.delta >= 0 ? '+' : '') + r.delta + '</td><td class="b">' + r.balance + '</td></tr>';
      }).join('') + '</tbody></table><div class="pts-rule">欄位：時間／項目／點數／餘額（只顯示最近 30 筆，完整紀錄在爸媽的試算表）</div>';
    }
    mask.querySelector('.pts-card').innerHTML = h;
  }

  function refresh() {
    var name = curName();
    if (!name) { state.balance = null; state.ledger = []; renderPill(); renderModal(); return Promise.resolve(); }
    state.name = name;
    state.failed = false;
    return call({ action: 'balance', name: name }).then(function (d) {
      if (!d || !d.ok) state.failed = true;
      if (d && d.ok && curName() === name) { state.balance = d.balance; state.ledger = d.ledger || []; state.rules = d.rules || state.rules; state.timeUsed = d.timeUsedToday || 0; }
      else if (d && !d.ok) { state.msg = '讀不到存摺，請晚點再試。'; state.msgBad = true; }
    }).catch(function () { state.failed = true; state.msg = '連不上點數系統，請檢查網路。'; state.msgBad = true; })
      .then(function () { renderPill(); renderModal(); });
  }

  function open() {
    if (!mask) {
      mask = document.createElement('div'); mask.className = 'pts-mask'; mask.innerHTML = '<div class="pts-card" role="dialog" aria-modal="true"></div>';
      mask.addEventListener('click', onClick);
      document.body.appendChild(mask);
    }
    mask.hidden = false; state.msg = ''; state.msgBad = false; state.confirm = '';
    renderModal(); refresh();
  }
  function close() { if (mask) mask.hidden = true; }

  function onClick(e) {
    if (e.target === mask) return close();
    var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
    var a = b.dataset.a;
    if (a === 'close') close();
    else if (a === 'who') { set('quizStudentName', b.dataset.n); state.name = b.dataset.n; state.balance = null; state.ledger = []; renderModal(); refresh(); }
    else if (a === 'redeem') { state.confirm = b.dataset.k; state.msg = ''; state.rid = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); renderModal(); }
    else if (a === 'no') { state.confirm = ''; renderModal(); }
    else if (a === 'yes') redeem();
  }

  function redeem() {
    if (state.busy || !state.confirm) return;
    var name = curName(), kind = state.confirm; state.busy = true; renderModal();
    call({ action: 'redeem', name: name, kind: kind, rid: state.rid }).then(function (d) {
      state.busy = false; state.confirm = '';
      if (d && d.ok) {
        state.msgBad = false;
        state.msg = '兌換成功：' + d.item + '！已扣點，' + (d.mailed === false ? '但通知信沒有寄成功，請你自己告訴爸媽。' : '已通知爸媽，等爸媽幫你處理。');
      } else if (d && d.error === 'time-limit') { state.msgBad = true; state.msg = '今天電腦時間已經換滿 ' + d.limit + ' 分鐘了，明天再來換。'; }
      else if (d && d.error === 'insufficient') { state.msgBad = true; state.msg = '點數不夠，還差 ' + (d.need - d.balance) + ' 點。'; }
      else { state.msgBad = true; state.msg = '兌換沒有成功，請再試一次（沒有扣點）。'; }
    }).catch(function () {
      state.busy = false; state.confirm = ''; state.msgBad = true;
      state.msg = '網路不穩，不確定有沒有兌換成功。請先看下面的明細，再決定要不要再按一次。';
    }).then(refresh);
  }

  // ---------- 賺點 ----------
  API.earn = function (o) {
    o = o || {};
    var name = String(o.name || curName() || '').trim().toUpperCase();
    if (!name || !(o.total > 0)) return Promise.resolve(null);
    state.name = name;
    var params = { action: 'earn', name: name, label: o.label || '', mode: o.mode || '', correct: Math.max(0, Math.round(o.correct || 0)), total: Math.round(o.total) };
    var attempt = function (n) {
      return call(params).catch(function (err) {
        if (n < 1) return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { return attempt(n + 1); });
        throw err;
      });
    };
    return attempt(0).then(function (d) {
      if (!d || !d.ok) { toast('🪙 點數這次沒記到，稍後重做一次就會補上。'); return d; }
      state.balance = d.balance; renderPill();
      if (d.earned > 0) toast('🪙 +' + d.earned + ' 點！存摺餘額 ' + d.balance + ' 點' + (d.reason === 'capped' ? '（今天已達上限）' : ''), true);
      else if (d.reason === 'duplicate') toast('🪙 這份今天已經算過點數了（每份每天只有第一次加點）。餘額 ' + d.balance + ' 點');
      else if (d.reason === 'daily-cap') toast('🪙 今天賺點已達上限，明天再來！餘額 ' + d.balance + ' 點');
      if (mask && !mask.hidden) refresh();
      return d;
    }).catch(function () { toast('🪙 連不上點數系統，這次沒記到點數。'); return null; });
  };
  API.open = open;

  // ---------- 啟動 ----------
  function boot() {
    document.head.appendChild(styleEl);
    pill = document.createElement('button'); pill.type = 'button'; pill.className = 'pts-pill'; pill.setAttribute('aria-label', '開啟點數存摺');
    pill.addEventListener('click', open); document.body.appendChild(pill); renderPill();
    if (curName()) refresh();
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
