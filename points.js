/* 學習點數存摺（前端）。英文測驗與美式生活館共用同一份。
 *
 * 作用：
 *   1. 測驗做完呼叫 Points.earn({name,label,mode,correct,total}) → 後端記一筆賺點，畫面跳出「+N 點」。
 *   2. 右下角的「🪙 點數」按鈕 → 打開存摺：餘額、兌換、每一筆賺到與用掉的明細。
 *
 * 其他人：家長在「家長管理 → 帳號管理」建立帳號並設定 PIN（學生＝有存摺；只能練習＝不計點數），
 *       之後在關卡按「其他帳號登入」輸入帳號名稱與 PIN。沒有帳號不能進來。
 * 安全：BRANDEN／MELISSA 各自設定 4 位數 PIN；PIN 驗證通過後後端發登入憑證（存在這台裝置），
 *       看存摺、賺點、兌換都要憑證。網站首頁沒有驗證過的人會先看到「你是誰？」關卡。
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

  var KIDS = ['BRANDEN', 'MELISSA'], ADMIN = 'PARENT', KNOWN = ['BRANDEN', 'MELISSA', 'PARENT'];
  // 訪客模式（不用 PIN、不計點數）：使用者 2026-10-04 決定先關閉，要開放時改成 true（三個 repo 的 points.js 都要改）。
  var GUEST_ENABLED = false;
  // ---------- 登入憑證：PIN 驗證通過後由後端發給，存在這台裝置（同一個網站的所有頁面共用） ----------
  function tokens() { try { return JSON.parse(get('quizPointsTokens') || '{}') || {}; } catch (e) { return {}; } }
  function tokenOf(n) { return tokens()[n] || ''; }
  function setToken(n, t) { var o = tokens(); o[n] = t; set('quizPointsTokens', JSON.stringify(o)); endGuest(); }
  function clearToken(n) { var o = tokens(); delete o[n]; set('quizPointsTokens', JSON.stringify(o)); }
  function anyToken() { var o = tokens(); return Object.keys(o).some(function (k) { return !!o[k]; }); }
  // 家長建立的帳號（這台裝置上已登入的）：不是 BRANDEN／MELISSA／PARENT，但有憑證
  function memberNames() { var o = tokens(); return Object.keys(o).filter(function (k) { return o[k] && KNOWN.indexOf(k) < 0; }); }
  function shownKids() { return KIDS.concat(memberNames()); }
  var kidPractice = {};   // 只能練習的帳號（不計點數）
  // ---------- 訪客：不用 PIN、不計點數（名字存在這台裝置；有人用 PIN 登入就自動結束訪客模式） ----------
  function clearGuest() { set('pointsGuest', ''); if (/^訪客/.test(get('quizStudentName') || '')) set('quizStudentName', ''); }
  function guestName() { return GUEST_ENABLED ? String(get('pointsGuest') || '').trim() : ''; }
  function endGuest() { if (get('pointsGuest')) clearGuest(); }
  if (!GUEST_ENABLED && get('pointsGuest')) clearGuest();   // 關閉訪客模式後，清掉裝置上殘留的訪客身分
  function needGate() { return !anyToken() && !guestName(); }

  var API = window.Points = {};
  if (!url()) { API.enabled = false; API.earn = function () { return Promise.resolve(null); }; API.open = function () {}; API.mount = function () {}; return; }
  API.enabled = true;

  var state = { name: '', balance: null, ledger: [], rules: null, busy: false, msg: '', confirm: '', rid: '' };
  var nameGetter = null;
  API.setNameGetter = function (fn) { nameGetter = fn; };
  function curName() {
    if (state.force) return state.force;   // 家長正在看自己的測試存摺
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
    if (params.name && !params.token && ['balance', 'earn', 'redeem'].indexOf(params.action) >= 0) {
      params = Object.assign({}, params, { token: tokenOf(String(params.name).toUpperCase()) });
    }
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
    '.pts-banner{width:100%;padding:14px 16px 12px;border:2px solid #f0b94a;border-radius:16px;background:linear-gradient(135deg,#fff6d8,#ffe7a8);color:#5b3a0c;text-align:left;font-family:system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 2px 8px rgba(122,75,18,.15)}' +
    '.pts-bn-head{font-size:17px;font-weight:800;margin-bottom:8px;display:flow-root}' +
    '.pts-bn-head small{font-size:12.5px;font-weight:600;color:#8a6a35;margin-left:8px}' +
    '.pts-kids{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.pts-kid{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:2px solid #e6c978;border-radius:12px;background:#fffbea;color:#5b3a0c;font-family:inherit;cursor:pointer;text-align:left;min-width:0}' +
    '.pts-kid:active{transform:scale(.98)}' +
    '.pts-kid.on{border-color:#7a4b12;background:#fff}' +
    '.pts-kid b{font-size:15px;overflow:hidden;text-overflow:ellipsis}' +
    '.pts-kid em{font-style:normal;font-size:26px;font-weight:800;line-height:1;color:#7a4b12;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.pts-kid em small{font-size:12px;font-weight:700;margin-left:2px}' +
    '@media (max-width:440px){.pts-kid{flex-direction:column;align-items:flex-start;gap:4px}.pts-kid b{font-size:14px}.pts-kid em{font-size:22px}}' +
    '.pts-bn-rule{font-size:12px;color:#6b5530;margin-top:8px}' +
    '.pts-toast{position:fixed;left:50%;bottom:calc(70px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9100;max-width:min(92vw,420px);padding:11px 16px;border-radius:14px;background:#2f2a22;color:#fff;font:600 15px/1.45 system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);text-align:center}' +
    '.pts-toast.good{background:#1f6b3a}' +
    '.pts-mask[hidden],.pts-toast[hidden],.pts-cele[hidden]{display:none!important}' +
    '.pts-pinmask{z-index:9400;align-items:center;padding:16px}' +
    '.pts-adminmask{z-index:9350;align-items:center;padding:16px}' +
    '.pts-link{border:0;background:none;color:#b9d8c4;text-decoration:underline;font-size:13px;padding:10px;font-family:inherit;cursor:pointer}' +
    '.pts-adm{display:flex;gap:8px;margin-top:10px}' +
    '.pts-adm button{flex:1;padding:9px;border:2px solid #7a4b12;border-radius:12px;background:#fff;color:#5b3a0c;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer}' +
    '.pts-kidbox{padding:10px 12px;margin-bottom:10px;border:1px solid #ead9b0;border-radius:14px;background:#fff}' +
    '.pts-kb-h{display:flex;justify-content:space-between;align-items:baseline;font-size:16px}' +
    '.pts-kb-h span{font-size:24px;font-weight:800;color:#7a4b12}' +
    '.pts-gobtn{width:100%;padding:12px;border:0;border-radius:12px;background:#2f8f4e;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}' +
    '.pts-pincard{max-width:360px;border-radius:20px}' +
    '.pts-gate{z-index:9500;align-items:center;padding:16px;background:rgba(14,26,20,.96)}' +
    '.pts-gatecard{max-width:380px;border-radius:20px}' +
    '.pts-lbl{display:block;margin:8px 0 4px;font-weight:700;font-size:14px;color:#5b4425}' +
    '.pts-pin{width:100%;padding:12px;border:2px solid #d9c593;border-radius:12px;font-size:26px;letter-spacing:10px;text-align:center;background:#fff;color:#3a2f20;font-family:inherit}' +
    '.pts-pin:focus{outline:none;border-color:#2f8f4e}' +
    '.pts-hbtn{display:flex;align-items:center;gap:8px}' +
    '.pts-out{border:0;background:#efe3c8;color:#5b4425;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer}' +
    '.pts-bn-head .pts-out{float:right;margin:-2px 0 0 8px}' +
    '.pts-cele{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9150;width:min(92vw,440px);padding:16px 18px;border-radius:18px;background:linear-gradient(135deg,#fff6d8,#ffe29a);border:2px solid #f0b94a;color:#4a2f08;box-shadow:0 10px 32px rgba(0,0,0,.4);font-family:system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif}' +
    '.pts-cele-t{font-size:20px;font-weight:800;line-height:1.35;margin-bottom:6px}' +
    '.pts-cele-b{font-size:16px;line-height:1.6}' +
    '.pts-cele-r{display:flex;gap:8px;margin-top:12px}' +
    '.pts-cele-r button{flex:1;padding:11px;border:0;border-radius:12px;background:#2f8f4e;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}' +
    '.pts-cele-r button.no{flex:none;background:#e8dcc0;color:#5b4425;padding:11px 16px}' +
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

  var banners = [], kidBal = {}, kidFail = {};
  function shownName(n) { return n === ADMIN ? '家長（測試）' : n; }
  function renderPill() {
    var cur = curName(), unlocked = !!(cur && tokenOf(cur)), adm = !!tokenOf(ADMIN);
    if (pill) pill.style.display = banners.length ? 'none' : '';   // 頁面上已有橫幅時，不再顯示右下角按鈕
    var gst = !anyToken() && guestName();
    if (pill) pill.innerHTML = (unlocked ? '🪙 <span>點數</span>' + (state.balance != null ? ' <b>' + state.balance + '</b>' : '') : adm ? '👤 <span>家長</span>' : gst ? '👤 <span>訪客</span>' : '🔒 <span>我的點數</span>');
    banners.forEach(function (el) {
      el.innerHTML = '<div class="pts-bn-head">🪙 點數存摺<small>' + (adm ? '家長模式：看得到孩子的點數' : gst ? '訪客：' + esc(gst) + '（不計點數）' : '點自己的名字，看明細、兌換') + '</small>' +
        (anyToken() ? '<button type="button" class="pts-out" data-logout="1">🔒 登出</button>' : gst ? '<button type="button" class="pts-out" data-logout="1">離開訪客模式</button>' : '') + '</div><div class="pts-kids">' +
        shownKids().map(function (k) {
          var v = kidBal[k], isOpen = !!(tokenOf(k) || adm);
          return '<button type="button" class="pts-kid' + (cur === k && tokenOf(k) ? ' on' : '') + '" data-kid="' + esc(k) + '"><b>' + esc(k) + '</b><em>' +
            (!isOpen ? '<small>🔒 輸入 PIN</small>' : kidPractice[k] ? '<small>練習帳號</small>' : v != null ? v + '<small>點</small>' : kidFail[k] ? '<small>讀不到</small>' : '<small>…</small>') + '</em></button>';
        }).join('') + '</div>' +
        (adm ? '<div class="pts-adm"><button type="button" data-adm="panel">👤 家長管理</button><button type="button" data-adm="mine">🧪 我的測試存摺</button></div>' : '') +
        '<div class="pts-bn-rule">' + rulesLine() + '</div>';
    });
  }
  function loadKids() {
    shownKids().forEach(function (k) {
      var own = tokenOf(k), tok = own || tokenOf(ADMIN);   // 孩子自己的憑證，或家長的憑證（只能看）
      if (!tok) { kidBal[k] = undefined; return; }
      call({ action: 'balance', name: k, token: tok }).then(function (d) {
        if (d && d.ok) { kidBal[k] = d.balance; kidPractice[k] = !!d.practice; kidFail[k] = false; state.rules = d.rules || state.rules; }
        else if (d && d.error === 'auth') { clearToken(own ? k : ADMIN); kidBal[k] = undefined; }
        else kidFail[k] = true;
      }).catch(function () { kidFail[k] = true; }).then(renderPill);
    });
    renderPill();
  }
  function logoutAll() {
    endGuest(); Object.keys(tokens()).forEach(clearToken); kidBal = {}; state.balance = null; state.ledger = []; state.force = '';   // 家長建立的帳號也要一起登出
    if (mask) mask.hidden = true;
    if (adminMask) adminMask.hidden = true;
    renderPill(); showGate();
  }
  /** 把「點數橫幅」放進頁面上的某個元素（例如網站首頁）。
   *  這台裝置還沒有人驗證過 PIN 時，會先蓋住整個頁面，請小朋友選名字、輸入（或第一次設定）PIN。 */
  API.mount = function (el) {
    if (!el) return;
    var b = document.createElement('div'); b.className = 'pts-banner';
    b.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-logout]')) return logoutAll();
      var ad = e.target.closest && e.target.closest('[data-adm]');
      if (ad) { if (ad.dataset.adm === 'panel') openAdmin(); else openMine(); return; }
      var k = e.target.closest && e.target.closest('[data-kid]'); if (!k) return;
      var n = k.dataset.kid;
      if (!tokenOf(n) && tokenOf(ADMIN)) { openAdmin(); return; }   // 家長點孩子的卡片：進家長管理
      ensureAuth(n).then(function (tok) {
        if (!tok) return;
        set('quizStudentName', n); state.name = n; state.force = ''; state.balance = kidBal[n] != null ? kidBal[n] : null; state.ledger = [];
        loadKids(); open();
      });
    });
    el.appendChild(b); banners.push(b); renderPill(); loadKids();
    if (needGate()) showGate();
  };

  // ---------- 進入頁面的「你是誰？」關卡 ----------
  var gateEl;
  function showGate() {
    if (gateEl || !document.body) return;
    gateEl = document.createElement('div'); gateEl.className = 'pts-mask pts-gate';
    gateEl.innerHTML = '<div class="pts-card pts-gatecard"><div class="pts-head"><h2>👋 你是誰？</h2></div>' +
      '<div class="pts-empty" style="padding-top:0">選自己的名字，再輸入 PIN 才能進來。第一次來的人，要先設定自己的 PIN。</div>' +
      '<div class="pts-who">' + KIDS.map(function (k) { return '<button type="button" data-g="' + k + '">我是 ' + k + '</button>'; }).join('') + '</div>' +
      '<div style="text-align:center"><button type="button" class="pts-link" data-other="open">其他帳號登入（家長建立的帳號）</button></div>' +
      '<div class="pts-other" hidden><input class="pts-pin" style="font-size:18px;letter-spacing:0" maxlength="20" placeholder="輸入你的帳號名稱" autocomplete="off" autocapitalize="characters">' +
      '<div class="row" style="margin-top:8px"><button type="button" class="pts-out" data-other="go">下一步：輸入 PIN</button></div></div>' +
      '<div style="text-align:center"><button type="button" class="pts-link" data-g="' + ADMIN + '">我是家長（管理者）</button></div>' +
      (GUEST_ENABLED ? '<div style="text-align:center"><button type="button" class="pts-link" data-guest="open">我是訪客（不用 PIN，不計點數）</button></div>' +
      '<div class="pts-guest" hidden><input class="pts-pin" style="font-size:18px;letter-spacing:0" maxlength="20" placeholder="輸入你的名字" autocomplete="off">' +
      '<div class="row" style="margin-top:8px"><button type="button" class="pts-out" data-guest="go">以訪客身分進入</button></div></div>' : '') + '</div>';
    gateEl.addEventListener('click', function (e) {
      var gb = GUEST_ENABLED && e.target.closest && e.target.closest('[data-guest]');
      if (gb) {
        var box = gateEl.querySelector('.pts-guest'), inp = box.querySelector('input');
        if (gb.dataset.guest === 'open') { box.hidden = false; inp.focus(); return; }
        var gname = inp.value.trim().replace(/[<>]/g, '');
        if (!gname) { inp.focus(); return; }
        set('pointsGuest', gname); set('quizStudentName', '訪客 ' + gname);
        if (gateEl && gateEl.parentNode) gateEl.parentNode.removeChild(gateEl);
        gateEl = null; renderPill();
        try { window.dispatchEvent(new Event('points-login')); } catch (err) {}
        return;
      }
      var ob = e.target.closest && e.target.closest('[data-other]');
      if (ob) {
        var obox = gateEl.querySelector('.pts-other'), oinp = obox.querySelector('input');
        if (ob.dataset.other === 'open') { obox.hidden = false; oinp.focus(); return; }
        var on = oinp.value.trim().toUpperCase();
        if (!on) { oinp.focus(); return; }
        if (on === ADMIN || KIDS.indexOf(on) >= 0) { oinp.value = ''; oinp.placeholder = '請用上面的按鈕登入'; return; }
        ensureAuth(on).then(function (tok) {
          if (!tok) return;
          set('quizStudentName', on); state.name = on; state.balance = null; state.ledger = []; state.force = '';
          if (gateEl && gateEl.parentNode) gateEl.parentNode.removeChild(gateEl);
          gateEl = null;
          loadKids(); refresh();
          try { window.dispatchEvent(new Event('points-login')); } catch (err) {}
        });
        return;
      }
      var b = e.target.closest && e.target.closest('[data-g]'); if (!b) return;
      var n = b.dataset.g;
      ensureAuth(n).then(function (tok) {
        if (!tok) return;
        if (n !== ADMIN) { set('quizStudentName', n); state.name = n; }
        state.balance = null; state.ledger = []; state.force = '';
        if (gateEl && gateEl.parentNode) gateEl.parentNode.removeChild(gateEl);
        gateEl = null;
        loadKids(); refresh();
        try { window.dispatchEvent(new Event('points-login')); } catch (err) {}
      });
    });
    gateEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.closest && e.target.closest('.pts-guest')) { var go = gateEl.querySelector('[data-guest="go"]'); if (go) go.click(); }
      if (e.key === 'Enter' && e.target.closest && e.target.closest('.pts-other')) { var og = gateEl.querySelector('[data-other="go"]'); if (og) og.click(); }
    });
    document.body.appendChild(gateEl);
  }

  // ---------- 家長管理：看孩子的點數、替孩子重設 PIN、進自己的測試存摺 ----------
  var adminMask, adm = { data: {}, msg: '', bad: false, confirm: '', busy: false, members: null, mErr: '', pinFor: '', delFor: '' };
  function openMine() { state.force = ADMIN; open(); }
  function openAdmin() {
    if (!tokenOf(ADMIN)) return;
    if (!adminMask) {
      adminMask = document.createElement('div'); adminMask.className = 'pts-mask pts-adminmask'; adminMask.innerHTML = '<div class="pts-card" role="dialog" aria-modal="true"></div>';
      adminMask.addEventListener('click', function (e) {
        if (e.target === adminMask) { adminMask.hidden = true; return; }
        var b = e.target.closest && e.target.closest('[data-ad]'); if (!b) return;
        var a = b.dataset.ad;
        if (a === 'close') adminMask.hidden = true;
        else if (a === 'mine') { adminMask.hidden = true; openMine(); }
        else if (a === 'ask') { adm.confirm = b.dataset.k; adm.msg = ''; renderAdmin(); }
        else if (a === 'no') { adm.confirm = ''; renderAdmin(); }
        else if (a === 'reset') resetKid(b.dataset.k);
        else if (a === 'madd') addMember();
        else if (a === 'mpin') { adm.pinFor = b.dataset.k; adm.delFor = ''; renderAdmin(); }
        else if (a === 'mpinsave') setMemberPin(b.dataset.k);
        else if (a === 'mkind') memberCall({ action: 'setmemberkind', target: b.dataset.k, kind: b.dataset.v }, b.dataset.k + ' 已改成「' + (b.dataset.v === 'student' ? '學生' : '只能練習') + '」。');
        else if (a === 'mdel') { adm.delFor = b.dataset.k; adm.pinFor = ''; renderAdmin(); }
        else if (a === 'mdelyes') memberCall({ action: 'removemember', target: b.dataset.k }, '已刪除帳號 ' + b.dataset.k + '（存摺紀錄仍保留在試算表）。');
        else if (a === 'mcancel') { adm.pinFor = ''; adm.delFor = ''; renderAdmin(); }
      });
      document.body.appendChild(adminMask);
    }
    adm.msg = ''; adm.confirm = ''; adm.pinFor = ''; adm.delFor = ''; adminMask.hidden = false; renderAdmin(); loadAdmin();
  }
  function loadMembers() {
    return call({ action: 'members', token: tokenOf(ADMIN) }).then(function (d) {
      if (d && d.ok) { adm.members = d.members || []; adm.mErr = '';
        adm.members.forEach(function (m) {
          if (m.kind !== 'student') return;
          call({ action: 'balance', name: m.name, token: tokenOf(ADMIN) }).then(function (b) { if (b && b.ok) { adm.data[m.name] = b; renderAdmin(); } }).catch(function () {});
        });
      }
      else adm.mErr = d && d.error === 'unknown-action' ? '點數系統後端還沒更新到有「帳號管理」的版本，請先照說明更新 Apps Script。' : '讀不到帳號名單，請晚點再試。';
    }).catch(function () { adm.mErr = '連不上點數系統，請檢查網路。'; }).then(renderAdmin);
  }
  function memberErr(d) {
    var e = d && d.error;
    return e === 'exists' ? '這個名字已經有人用了。' : e === 'bad-name' ? '帳號名稱只能用 1–20 個英文、數字或中文。' : e === 'bad-format' ? 'PIN 要剛好 4 個數字。' :
      e === 'not-found' ? '找不到這個帳號。' : e === 'unknown-action' ? '點數系統後端還沒更新到有「帳號管理」的版本。' : '沒有成功，請再試一次。';
  }
  function memberCall(params, okMsg) {
    if (adm.busy) return; adm.busy = true; renderAdmin();
    return call(Object.assign({ token: tokenOf(ADMIN) }, params)).then(function (d) {
      adm.busy = false;
      if (d && d.ok) { adm.bad = false; adm.msg = okMsg; adm.pinFor = ''; adm.delFor = ''; return loadMembers().then(function () { return true; }); }
      adm.bad = true; adm.msg = memberErr(d); renderAdmin(); return false;
    }).catch(function () { adm.busy = false; adm.bad = true; adm.msg = '連不上點數系統，請檢查網路。'; renderAdmin(); return false; });
  }
  function addMember() {
    var card = adminMask.querySelector('.pts-card');
    var name = (card.querySelector('#ptsMName') || {}).value || '', kind = (card.querySelector('#ptsMKind') || {}).value || 'student', pin = (card.querySelector('#ptsMPin') || {}).value || '';
    name = name.trim().toUpperCase();
    if (!name) { adm.bad = true; adm.msg = '請輸入帳號名稱。'; renderAdmin(); return; }
    if (!/^\d{4}$/.test(pin)) { adm.bad = true; adm.msg = 'PIN 要剛好 4 個數字。'; renderAdmin(); return; }
    memberCall({ action: 'addmember', newname: name, kind: kind, pin: pin }, '已建立帳號 ' + name + '。請把帳號名稱和 PIN 告訴他：在「你是誰？」按「其他帳號登入」。').then(function (ok) {
      if (ok) ['ptsMName', 'ptsMPin'].forEach(function (id) { var el = adminMask.querySelector('#' + id); if (el) el.value = ''; });
    });
  }
  function setMemberPin(k) {
    var pin = (adminMask.querySelector('#ptsMPin2') || {}).value || '';
    if (!/^\d{4}$/.test(pin)) { adm.bad = true; adm.msg = 'PIN 要剛好 4 個數字。'; renderAdmin(); return; }
    memberCall({ action: 'setmemberpin', target: k, pin: pin }, '已更新 ' + k + ' 的 PIN。他之前登入的裝置要用新 PIN 重新登入。');
  }
  function loadAdmin() {
    loadMembers();
    KIDS.forEach(function (k) {
      call({ action: 'balance', name: k, token: tokenOf(ADMIN) }).then(function (d) {
        if (d && d.ok) { adm.data[k] = d; kidBal[k] = d.balance; state.rules = d.rules || state.rules; }
        else if (d && d.error === 'auth') { clearToken(ADMIN); adminMask.hidden = true; renderPill(); if (needGate()) showGate(); }
      }).catch(function () { adm.msg = '連不上點數系統，請檢查網路。'; adm.bad = true; }).then(function () { renderAdmin(); renderPill(); });
    });
  }
  function renderAdmin() {
    if (!adminMask) return;
    var h = '<div class="pts-head"><h2>👤 家長管理</h2><span class="pts-hbtn"><button class="pts-x" data-ad="close" aria-label="關閉">✕</button></span></div>';
    if (adm.msg) h += '<div class="pts-msg' + (adm.bad ? ' bad' : '') + '">' + esc(adm.msg) + '</div>';
    h += '<div class="pts-rule" style="margin-bottom:10px">這裡看得到孩子的點數，也能替忘記 PIN 的孩子重設（點數不會消失）。你自己做測驗、兌換的測試，會記在「家長的測試存摺」，不會動到孩子的存摺。</div>';
    KIDS.forEach(function (k) {
      var d = adm.data[k];
      h += '<div class="pts-kidbox"><div class="pts-kb-h"><b>' + k + '</b><span>' + (d ? d.balance + ' 點' : '讀取中…') + '</span></div>';
      if (d && d.ledger && d.ledger.length) h += '<table class="pts-tb"><tbody>' + d.ledger.slice(0, 5).map(function (r) {
        return '<tr><td class="d">' + fmtTime(r.time) + '</td><td>' + esc(r.item) + '</td><td class="p ' + (r.delta >= 0 ? 'up' : 'dn') + '">' + (r.delta >= 0 ? '+' : '') + r.delta + '</td></tr>';
      }).join('') + '</tbody></table>';
      else if (d) h += '<div class="pts-rule">還沒有紀錄</div>';
      if (adm.confirm === k) h += '<div class="pts-ask"><b>確定重設 ' + k + ' 的 PIN 嗎？</b><div>他下次進來要重新設定 PIN，點數不會消失。</div><div class="row"><button class="no" data-ad="no">先不要</button><button class="ok" data-ad="reset" data-k="' + k + '"' + (adm.busy ? ' disabled' : '') + '>' + (adm.busy ? '處理中…' : '確定重設') + '</button></div></div>';
      else h += '<button class="pts-out" data-ad="ask" data-k="' + k + '" style="margin-top:8px">重設 ' + k + ' 的 PIN</button>';
      h += '</div>';
    });
    // ---- 帳號管理：家長建立的其他帳號 ----
    h += '<div class="pts-h3">帳號管理（其他人）</div>';
    h += '<div class="pts-rule" style="margin-bottom:8px">其他人要使用學習網站，要先在這裡建立帳號、設定 PIN，再把帳號名稱和 PIN 告訴他。他在「你是誰？」按「其他帳號登入」。<br>學生：有存摺，可以賺點數與兌換。只能練習：可以使用網站，但不計點數。</div>';
    if (adm.mErr) h += '<div class="pts-msg bad">' + esc(adm.mErr) + '</div>';
    else if (!adm.members) h += '<div class="pts-rule">讀取中…</div>';
    else if (!adm.members.length) h += '<div class="pts-rule" style="margin-bottom:8px">還沒有其他帳號。</div>';
    else adm.members.forEach(function (m) {
      var k = m.name, kk = esc(k), d = adm.data[k], stu = m.kind === 'student';
      h += '<div class="pts-kidbox"><div class="pts-kb-h"><b>' + kk + ' <small style="font-weight:600;color:#8a6a35">' + (stu ? '學生' : '只能練習') + (m.hasPin ? '' : '・PIN 未設定') + '</small></b><span>' + (stu ? (d ? d.balance + ' 點' : '…') : '') + '</span></div>';
      if (adm.pinFor === k) h += '<div class="pts-ask"><b>替 ' + kk + ' 設定新的 PIN</b>' + '<input class="pts-pin" id="ptsMPin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••" style="margin-top:6px">' +
        '<div class="row"><button class="no" data-ad="mcancel">取消</button><button class="ok" data-ad="mpinsave" data-k="' + kk + '"' + (adm.busy ? ' disabled' : '') + '>' + (adm.busy ? '處理中…' : '儲存 PIN') + '</button></div></div>';
      else if (adm.delFor === k) h += '<div class="pts-ask"><b>確定刪除帳號 ' + kk + ' 嗎？</b><div>刪除後他就不能登入；以前的存摺紀錄會留在試算表。</div>' +
        '<div class="row"><button class="no" data-ad="mcancel">先不要</button><button class="ok" data-ad="mdelyes" data-k="' + kk + '"' + (adm.busy ? ' disabled' : '') + '>' + (adm.busy ? '處理中…' : '確定刪除') + '</button></div></div>';
      else h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button class="pts-out" data-ad="mpin" data-k="' + kk + '">設定 PIN</button>' +
        '<button class="pts-out" data-ad="mkind" data-k="' + kk + '" data-v="' + (stu ? 'practice' : 'student') + '">改成' + (stu ? '只能練習' : '學生') + '</button>' +
        '<button class="pts-out" data-ad="mdel" data-k="' + kk + '">刪除帳號</button></div>';
      h += '</div>';
    });
    if (!adm.mErr && adm.members) h += '<div class="pts-kidbox"><b>＋ 建立新帳號</b>' +
      '<label class="pts-lbl" for="ptsMName">帳號名稱（英文、數字或中文，最多 20 個字）</label><input class="pts-pin" id="ptsMName" maxlength="20" autocomplete="off" autocapitalize="characters" style="font-size:18px;letter-spacing:0" placeholder="例如 AMY">' +
      '<label class="pts-lbl" for="ptsMKind">帳號類型</label><select class="pts-pin" id="ptsMKind" style="font-size:16px;letter-spacing:0"><option value="student">學生：可以賺點數、兌換</option><option value="practice">只能練習：不計點數</option></select>' +
      '<label class="pts-lbl" for="ptsMPin">PIN（4 位數字，由你設定後告訴他）</label><input class="pts-pin" id="ptsMPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">' +
      '<button type="button" class="pts-gobtn" data-ad="madd" style="margin-top:10px"' + (adm.busy ? ' disabled' : '') + '>' + (adm.busy ? '處理中…' : '建立帳號') + '</button></div>';
    h += '<button type="button" class="pts-gobtn" data-ad="mine">🧪 進入我的測試存摺</button>';
    // 重畫時保留正在輸入的內容
    var card = adminMask.querySelector('.pts-card'), keep = {};
    ['ptsMName', 'ptsMKind', 'ptsMPin', 'ptsMPin2'].forEach(function (id) { var el = card.querySelector('#' + id); if (el) keep[id] = el.value; });
    card.innerHTML = h;
    Object.keys(keep).forEach(function (id) { var el = card.querySelector('#' + id); if (el) el.value = keep[id]; });
  }
  function resetKid(k) {
    if (adm.busy) return; adm.busy = true; renderAdmin();
    call({ action: 'resetpin', name: k, token: tokenOf(ADMIN) }).then(function (d) {
      adm.busy = false; adm.confirm = '';
      if (d && d.ok) { adm.bad = false; adm.msg = '已重設 ' + k + ' 的 PIN，他下次進來會重新設定。'; }
      else { adm.bad = true; adm.msg = '重設沒有成功，請再試一次。'; }
    }).catch(function () { adm.busy = false; adm.confirm = ''; adm.bad = true; adm.msg = '連不上點數系統，請檢查網路。'; }).then(renderAdmin);
  }

  // ---------- PIN 視窗：第一次使用設定 PIN，之後輸入 PIN ----------
  var pending = {};
  function ensureAuth(name, why) {
    if (tokenOf(name)) return Promise.resolve(tokenOf(name));
    if (pending[name]) return pending[name];
    pending[name] = pinDialog(name, why).then(function (t) { delete pending[name]; return t; });
    return pending[name];
  }
  function pinDialog(name, why) {
    return new Promise(function (resolve) {
      var el = document.createElement('div'); el.className = 'pts-mask pts-pinmask';
      el.innerHTML = '<div class="pts-card pts-pincard" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(el);
      var card = el.querySelector('.pts-card');
      var st = { step: 'load', len: 4, msg: '', locked: false, busy: false };
      function done(tok) { if (el.parentNode) el.parentNode.removeChild(el); resolve(tok || ''); }
      function field(id, label) {
        return '<label class="pts-lbl" for="' + id + '">' + label + '</label><input class="pts-pin" id="' + id + '" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="' + st.len + '" autocomplete="off" placeholder="' + new Array(st.len + 1).join('•') + '"' + (st.locked ? ' disabled' : '') + '>';
      }
      function draw() {
        var h = '<div class="pts-head"><h2>🔐 ' + esc(name === ADMIN ? '家長（管理者）' : name) + '</h2></div>';
        if (why) h += '<div class="pts-msg">' + esc(why) + '</div>';
        if (st.step === 'load') h += '<div class="pts-empty">讀取中…</div>';
        else if (st.step === 'err') h += '<div class="pts-msg bad">' + esc(st.msg) + '</div><div class="pts-ask"><div class="row"><button class="no" data-p="x">關閉</button><button class="ok" data-p="retry">再試一次</button></div></div>';
        else if (st.step === 'askparent') h += '<div class="pts-empty" style="padding:0 0 8px;text-align:left">這個帳號的 PIN 還沒設定好，請家長在「👤 家長管理 → 帳號管理」幫你設定 PIN。</div><div class="pts-ask"><div class="row"><button class="ok" data-p="x">知道了</button></div></div>';
        else if (st.step === 'adminset') h += '<div class="pts-empty" style="padding:0 0 8px;text-align:left">家長（管理者）的 PIN 還沒設定。<br>管理者的 PIN 要在 Apps Script 裡設定（不能在網頁上設，才不會被別人搶先）：打開「學習點數存摺」試算表 → 擴充功能 → Apps Script → 把 <b>setParentPin</b> 函式裡 <b>var PIN</b> 那一行改成 4 位數字 → 執行。</div><div class="pts-ask"><div class="row"><button class="ok" data-p="x">知道了</button></div></div>';
        else {
          if (st.step === 'set') h += '<div class="pts-empty" style="padding:0 0 8px;text-align:left">第一次使用，請設定 <b>' + st.len + ' 位數 PIN</b>（只能用數字）。<br>要記住喔，也不要告訴別人。沒有 PIN 就不能看存摺、賺點和兌換。</div>' + field('pin1', '設定 PIN') + field('pin2', '再輸入一次');
          else h += field('pin1', '請輸入你的 ' + st.len + ' 位數 PIN');
          if (st.msg) h += '<div class="pts-msg bad" style="margin-top:10px">' + esc(st.msg) + '</div>';
          h += '<div class="pts-ask" style="margin-top:12px"><div class="row"><button class="no" data-p="x">取消</button><button class="ok" data-p="go"' + (st.busy || st.locked ? ' disabled' : '') + '>' + (st.busy ? '確認中…' : st.step === 'set' ? '設定' : '確定') + '</button></div></div>';
        }
        card.innerHTML = h;
        var f = card.querySelector('#pin1'); if (f && !st.locked) f.focus();
      }
      function load() {
        st.step = 'load'; st.msg = ''; draw();
        call({ action: 'status', name: name }).then(function (d) {
          if (d && d.ok) { st.len = d.pinLength || 4; st.step = d.hasPin ? 'in' : d.admin ? 'adminset' : d.member ? 'askparent' : 'set'; state.rules = d.rules || state.rules; }
          else { st.step = 'err'; st.msg = d && d.error === 'not-allowed' ? (KIDS.indexOf(name) >= 0 ? '這個名字沒有點數存摺。' : '找不到「' + name + '」這個帳號。請家長先在「👤 家長管理 → 帳號管理」建立帳號。') : '點數系統暫時連不上，請晚點再試。'; }
          draw();
        }).catch(function () { st.step = 'err'; st.msg = '連不上點數系統，請檢查網路。'; draw(); });
      }
      function submit() {
        if (st.busy || st.locked) return;
        var p1 = (card.querySelector('#pin1') || {}).value || '', p2 = (card.querySelector('#pin2') || {}).value || '';
        var re = new RegExp('^\\d{' + st.len + '}$');
        if (!re.test(p1)) { st.msg = 'PIN 要剛好 ' + st.len + ' 個數字。'; draw(); return; }
        if (st.step === 'set' && p1 !== p2) { st.msg = '兩次輸入的 PIN 不一樣，請再輸入一次。'; draw(); return; }
        st.busy = true; st.msg = ''; draw();
        call({ action: st.step === 'set' ? 'setpin' : 'login', name: name, pin: p1 }).then(function (d) {
          st.busy = false;
          if (d && d.ok && d.token) { setToken(name, d.token); done(d.token); return; }
          var e = d && d.error;
          if (e === 'bad-pin') st.msg = 'PIN 不對，還有 ' + d.left + ' 次機會。';
          else if (e === 'locked') { st.locked = true; st.msg = '輸錯太多次了，請等 ' + d.minutes + ' 分鐘再試。'; }
          else if (e === 'pin-exists') { st.step = 'in'; st.msg = '這個名字已經設過 PIN 了，請輸入 PIN。'; }
          else if (e === 'no-pin' || e === 'admin-editor') { st.step = name === ADMIN ? 'adminset' : 'set'; st.msg = ''; }
          else if (e === 'ask-parent') { st.step = 'askparent'; st.msg = ''; }
          else if (e === 'not-allowed') st.msg = '找不到這個帳號，請家長先建立。';
          else if (e === 'bad-format') st.msg = 'PIN 要剛好 ' + st.len + ' 個數字。';
          else st.msg = '沒有成功，請再試一次。';
          draw();
        }).catch(function () { st.busy = false; st.msg = '連不上點數系統，請檢查網路。'; draw(); });
      }
      card.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-p]'); if (!b) return;
        if (b.dataset.p === 'x') done('');
        else if (b.dataset.p === 'go') submit();
        else if (b.dataset.p === 'retry') load();
      });
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      el.addEventListener('click', function (e) { if (e.target === el) done(''); });
      load();
    });
  }

  function toast(text, good) {
    if (!document.body) return;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pts-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.className = 'pts-toast' + (good ? ' good' : '');
    toastEl.textContent = text; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 6000);
  }

  // ---------- 送出測驗後的鼓勵話語：恭喜得到幾點、還差多少、加油 ----------
  var celeEl, celeTimer;
  function goalText(bal) {
    var n = ruleNums(), t = n.time, m = n.money;
    if (bal >= m.points) return '你已經有 ' + bal + ' 點，可以兌換「' + t.label + '」或「' + m.label + '」囉！按「看我的存摺」就能兌換。';
    if (bal >= t.points) return '你已經有 ' + bal + ' 點，現在就可以兌換「' + t.label + '」囉！再賺 ' + (m.points - bal) + ' 點，還能換「' + m.label + '」，請加油！';
    return '你現在有 ' + bal + ' 點，還差 ' + (t.points - bal) + ' 點，就能兌換「' + t.label + '」，請加油！';
  }
  function celebrate(name, d, o) {
    if (!document.body) return;
    var n = ruleNums(), title, line = '', bal = d.balance, pre = o && o.test ? '🧪 家長測試・' : '', who = esc(shownName(name));
    if (d.earned > 0) {
      title = o && o.test ? '🧪 家長測試：得到 ' + d.earned + ' 點' : '🎉 恭喜 ' + who + '，得到 ' + d.earned + ' 點！';
      if (o && o.test) line = '這次記在「家長的測試存摺」，孩子的點數不受影響。<br>';
      if (d.reason === 'capped') line += '今天的點數已經賺滿 ' + n.cap + ' 點了，明天再來！<br>';
    } else if (d.reason === 'duplicate') {
      title = '👍 這份今天已經算過點數囉';
      line = '同一份測驗每天只有第一次會加點，換一份來挑戰吧！<br>';
    } else if (d.reason === 'daily-cap') {
      title = '🌟 太棒了，今天的點數賺滿 ' + n.cap + ' 點！';
      line = '明天再來繼續賺點數。<br>';
    } else {
      title = '💪 這次沒有得到點數';
      line = '沒關係，再練習一次，下次一定可以！<br>';
    }
    if (!celeEl) {
      celeEl = document.createElement('div'); celeEl.className = 'pts-cele'; celeEl.setAttribute('role', 'status');
      celeEl.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-c]'); if (!a) return;
        celeEl.hidden = true; clearTimeout(celeTimer);
        if (a.dataset.c === 'open') open();
      });
      document.body.appendChild(celeEl);
    }
    celeEl.innerHTML = '<div class="pts-cele-t">' + title + '</div><div class="pts-cele-b">' + line + esc(goalText(bal)) + '</div>' +
      '<div class="pts-cele-r"><button type="button" data-c="open">🪙 看我的存摺</button><button type="button" data-c="x" class="no">關閉</button></div>';
    celeEl.hidden = false;
    clearTimeout(celeTimer); celeTimer = setTimeout(function () { celeEl.hidden = true; }, 20000);
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
    h += '<div class="pts-head"><h2>🪙 ' + (name ? esc(shownName(name)) + ' 的點數存摺' : '點數存摺') + '</h2><span class="pts-hbtn">' + (name && tokenOf(name) ? '<button class="pts-out" data-a="logout">🔒 鎖起來</button>' : '') + '<button class="pts-x" data-a="close" aria-label="關閉">✕</button></span></div>';
    if (!name) {
      h += '<div class="pts-who"><button data-a="who" data-n="BRANDEN">我是 BRANDEN</button><button data-a="who" data-n="MELISSA">我是 MELISSA</button></div>';
      h += '<div class="pts-empty">先選你是誰，才看得到自己的點數。</div>' + rulesHtml();
    } else {
      if (state.msg) h += '<div class="pts-msg' + (state.msgBad ? ' bad' : '') + '">' + esc(state.msg) + '</div>';
      if (state.practice && tokenOf(name)) {
        h += '<div class="pts-empty" style="text-align:left">🎯 這是<b>練習帳號</b>：可以使用所有學習網站，但不計點數、不能兌換。<br>想要賺點數，請家長在「帳號管理」把你改成學生帳號。</div>';
        mask.querySelector('.pts-card').innerHTML = h; return;
      }
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
        var label = bal == null ? '…' : full ? '今天額度用完' : can ? '兌換' : '兌換（還差 ' + (need - bal) + ' 點）';
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
    if (!name || !tokenOf(name)) { state.balance = null; state.ledger = []; renderPill(); renderModal(); return Promise.resolve(); }
    state.name = name;
    state.failed = false;
    return call({ action: 'balance', name: name }).then(function (d) {
      if (d && d.error === 'auth') {   // 憑證失效（例如 PIN 被重設）：清掉，請他重新輸入
        clearToken(name); state.balance = null; state.ledger = []; if (name !== ADMIN) kidBal[name] = undefined;
        renderPill(); renderModal();
        return ensureAuth(name, '請重新輸入 PIN').then(function (t) { if (t) return refresh(); close(); });
      }
      if (!d || !d.ok) state.failed = true;
      if (d && d.ok && curName() === name) { state.practice = !!d.practice; kidPractice[name] = !!d.practice; state.balance = d.balance; state.ledger = d.ledger || []; state.rules = d.rules || state.rules; state.timeUsed = d.timeUsedToday || 0; if (name !== ADMIN) kidBal[name] = d.balance; }
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
    state.msg = ''; state.msgBad = false; state.confirm = '';
    var name = curName();
    if (KNOWN.indexOf(name) < 0) { mask.hidden = false; renderModal(); return; }   // 還沒選人：先顯示「我是誰」
    ensureAuth(name).then(function (tok) {
      if (!tok) return;
      mask.hidden = false; renderModal(); refresh();
    });
  }
  function close() {
    if (mask) mask.hidden = true;
    if (state.force) { state.force = ''; state.balance = null; state.ledger = []; renderPill(); }   // 離開家長的測試存摺
  }

  function onClick(e) {
    if (e.target === mask) return close();
    var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
    var a = b.dataset.a;
    if (a === 'close') close();
    else if (a === 'who') {
      var n = b.dataset.n; set('quizStudentName', n); state.name = n; state.balance = null; state.ledger = [];
      ensureAuth(n).then(function (tok) { if (!tok) return; renderModal(); refresh(); });
    }
    else if (a === 'logout') { var me = curName(); clearToken(me); if (me !== ADMIN) kidBal[me] = undefined; state.balance = null; state.ledger = []; close(); renderPill(); if (needGate()) showGate(); }
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
      } else if (d && d.error === 'auth') { clearToken(name); state.msgBad = true; state.msg = '登入過期了，請重新輸入 PIN 後再兌換（沒有扣點）。'; }
      else if (d && d.error === 'time-limit') { state.msgBad = true; state.msg = '今天電腦時間已經換滿 ' + d.limit + ' 分鐘了，明天再來換。'; }
      else if (d && d.error === 'insufficient') { state.msgBad = true; state.msg = '點數不夠，還差 ' + (d.need - d.balance) + ' 點。'; }
      else { state.msgBad = true; state.msg = '兌換沒有成功，請再試一次（沒有扣點）。'; }
    }).catch(function () {
      state.busy = false; state.confirm = ''; state.msgBad = true;
      state.msg = '網路不穩，不確定有沒有兌換成功。請先看下面的明細，再決定要不要再按一次。';
    }).then(refresh);
  }

  // ---------- 賺點 ----------
  function doEarn(name, o, retried) {
    var params = { action: 'earn', name: name, label: o.label || '', mode: o.mode || '', correct: Math.max(0, Math.round(o.correct || 0)), total: Math.round(o.total) };
    var attempt = function (n) {
      return call(params).catch(function (err) {
        if (n < 1) return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { return attempt(n + 1); });
        throw err;
      });
    };
    return attempt(0).then(function (d) {
      if (d && d.error === 'auth' && !retried) {   // 憑證失效：請他重新輸入 PIN 再記一次
        clearToken(name); renderPill();
        return ensureAuth(name, '請重新輸入 PIN，才能記下這次的點數').then(function (t) {
          if (!t) { toast('🪙 沒有輸入 PIN，這次沒有記到點數。'); return null; }
          return doEarn(name, o, true);
        });
      }
      if (!d || !d.ok) { toast('🪙 點數這次沒記到，稍後重做一次就會補上。'); return d; }
      if (d.reason === 'practice') { kidPractice[name] = true; renderPill(); toast('🎯 做得好！（練習帳號不計點數）', true); return d; }
      state.balance = d.balance; if (name !== ADMIN) kidBal[name] = d.balance; renderPill();
      celebrate(name, d, o);
      if (mask && !mask.hidden) refresh();
      return d;
    }).catch(function () { toast('🪙 連不上點數系統，這次沒記到點數。'); return null; });
  }
  API.earn = function (o) {
    o = o || {};
    var name = String(o.name || curName() || '').trim().toUpperCase();
    if (!name || !(o.total > 0) || (KNOWN.indexOf(name) < 0 && !tokenOf(name))) return Promise.resolve(null);   // BRANDEN、MELISSA、家長，以及已登入的家長建立帳號
    if (KIDS.indexOf(name) >= 0 && !tokenOf(name) && tokenOf(ADMIN)) { name = ADMIN; o = Object.assign({}, o, { test: true }); }   // 家長在測試：點數記在家長的測試存摺，不動孩子的
    if (name !== ADMIN) state.name = name;
    return ensureAuth(name, '輸入 PIN，才能記下這次的點數').then(function (tok) {
      if (!tok) { toast('🪙 沒有輸入 PIN，這次沒有記到點數。'); return null; }
      return doEarn(name, o, false);
    });
  };
  API.open = open;

  // ---------- 啟動 ----------
  function boot() {
    document.head.appendChild(styleEl);
    pill = document.createElement('button'); pill.type = 'button'; pill.className = 'pts-pill'; pill.setAttribute('aria-label', '開啟點數存摺');
    pill.addEventListener('click', open); document.body.appendChild(pill); renderPill();
    var n = curName(); if (n && tokenOf(n)) refresh();
    if (needGate()) showGate();   // 這台裝置沒有人驗證過：每一頁都先擋住，請選名字、輸入 PIN
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
