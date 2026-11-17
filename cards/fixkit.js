/* 測驗「送出成績 → 自動對答案 → 訂正錯誤 → 全對補送 1 點」共用程式（FixKit）。
 * 規則統一以段考題庫（exam-bank/sync.js）為準（使用者 2026-10-18 要求全站一致）：
 *   1. 送出成績：全部作答才能送；送出後馬上對答案，答對綠、答錯紅，標出正確答案；點數只算這一次（Points.earn）。
 *   2. 有錯題時上方出現「✏️ 訂正錯誤」＋「錯誤全部訂正完畢再另加補送 1 點」。按下後答對的題目鎖住，錯題清空、藏正解（黃框），
 *      按「送出訂正」再對答案，還有錯就繼續訂正，直到全對 → 補送 1 點（Points.earn kind:'fix-bonus'）。
 *   3. 還有錯題沒訂正完不能離開這一頁（擋連結、關分頁跳確認）；測試帳號 TEST、家長 PARENT 有「🚪 立即離開」。
 *   4. 試算表：第一次照常；第 N 次訂正只送訂正的題目，mode 後加「【第 N 次訂正】」；全部訂正完成另送「【全部訂正完成】補送 1 點」。
 *   5. 暫存：「💾 暫存」＋作答時自動暫存（localStorage fkDraft:頁面:測驗:登入者），下次打開自動接續；送出後清掉。
 * 目前用在國家地理閱讀（points-glue.js）；以後有「整頁作答、一次送出」的新測驗也可以用它。
 *
 * 用法：FixKit.make({
 *   id, name,               // 測驗代號（同一頁唯一）、顯示名稱
 *   host,                   // 訂正列放在這個元素前面
 *   box,                    // 作答區（在裡面作答時自動暫存；可省略）
 *   btn,                    // 送出成績按鈕（FixKit 接手它的 onclick）
 *   items: () => [ { el, q, correct, value(), right(), clear(), set(v), lock(on), mark(), unmark() } ],
 *   post(name, modeSuffix, rows, score, total),   // 寫試算表（rows: {q, picked, correct, isCorrect}）；PARENT 不會呼叫
 *   earn: { label, mode },  // 點數的 label、mode
 *   back,                   // 「回上一層」網址
 *   onGraded(score, total)  // 第一次送出後（可選，例如顯示分數、提醒其他測驗）
 * }) */
(function () {
  if (window.FixKit) return;
  var kits = [];
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function student() { var n = String(get('quizStudentName') || '').trim(); return (!n || /^訪客/.test(n)) ? '' : n; }
  function canSkip() { var n = student().toUpperCase(); return n === 'TEST' || n === 'PARENT'; }
  function anyPending() { return kits.some(function (k) { return k.pending; }); }

  var css = '.fk-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0;padding:10px 14px;border-radius:14px;background:#fff4dc;border:2px solid #e7c98a;font:600 14.5px/1.5 "Noto Sans TC","Microsoft JhengHei",sans-serif;color:#6b4a12}'
    + '.fk-bar[hidden]{display:none !important}.fk-bar b{color:#c0392b}.fk-bar.done{background:#e8f5ec;border-color:#9ccfab;color:#1f6b3a}.fk-bar.done b{color:#1f6b3a}'
    + '.fk-bar button{background:#c0392b;color:#fff;border:0;border-radius:999px;padding:9px 18px;font:800 15px "Noto Sans TC","Microsoft JhengHei",sans-serif;cursor:pointer}'
    + '.fk-bar button[disabled]{background:#d8cdb4;color:#7a6a48;cursor:default}.fk-bar button.exit{background:#fff;color:#5a4a2a;border:1.5px solid #c9b88f}'
    + '.fk-bar a{display:inline-block;padding:7px 14px;border-radius:999px;background:#2f6fb5;color:#fff !important;font-weight:800;text-decoration:none}'
    + '.fk-fixing{outline:3px solid #e0a020 !important;outline-offset:2px;background-color:#fffaf0 !important}'
    + '.fk-ans{display:inline-block;margin-left:6px;font:700 13px "Noto Sans TC","Microsoft JhengHei",sans-serif;color:#c0392b}.fk-ans.ok{color:#2e7d4f}'
    + '.fk-draft{margin-left:10px;background:#fff;color:#2f4538;border:1.5px solid #b9c4b4;border-radius:10px;padding:7px 12px;font:700 14px "Noto Sans TC","Microsoft JhengHei",sans-serif;cursor:pointer}'
    + '.fk-note{display:inline-block;margin-left:10px;font:13px "Noto Sans TC","Microsoft JhengHei",sans-serif;color:#7a7259}'
    + '@media print{.fk-bar,.fk-draft,.fk-note{display:none}}';
  function addCss() { if (document.getElementById('fk-css')) return; var s = document.createElement('style'); s.id = 'fk-css'; s.textContent = css; (document.head || document.body).appendChild(s); }

  // 還有錯題沒訂正完：擋住離開這一頁的連結；關分頁／重新整理跳出確認
  document.addEventListener('click', function (e) {
    if (!anyPending()) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.getAttribute('href').charAt(0) === '#' || a.closest('.fk-bar')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var names = kits.filter(function (k) { return k.pending; }).map(function (k) { return k.name; }).join('、');
    alert('「' + names + '」還有錯題，先按「✏️ 訂正錯誤」訂正完才能離開喔！');
  }, true);
  window.addEventListener('beforeunload', function (e) { if (anyPending()) { e.preventDefault(); e.returnValue = ''; } });

  function make(cfg) {
    addCss();
    var k = { name: cfg.name, status: 'open', round: 0, fixing: [], pending: false, skipped: false, score: 0, total: 0 };
    kits.push(k);
    var bar = document.createElement('div'); bar.className = 'fk-bar'; bar.hidden = true;
    cfg.host.parentNode.insertBefore(bar, cfg.host);
    var btn = cfg.btn, items = function () { return cfg.items(); };
    var note = document.createElement('span'); note.className = 'fk-note';
    var draftBtn = document.createElement('button'); draftBtn.type = 'button'; draftBtn.className = 'fk-draft'; draftBtn.textContent = '💾 暫存';
    btn.insertAdjacentElement('afterend', note); btn.insertAdjacentElement('afterend', draftBtn);
    function setBtn(text, on) { btn.textContent = text; btn.disabled = !on; btn.style.opacity = on ? '' : '.6'; btn.style.cursor = on ? '' : 'not-allowed'; }
    function wrong() { return items().map(function (it, i) { return i; }).filter(function (i) { return !items()[i].right(); }); }
    function rowOf(it) { var v = it.value(); return { q: it.q, picked: v || '（未作答）', correct: it.correct, isCorrect: it.right() }; }
    function draw() {
      var exit = canSkip() ? '<button type="button" class="exit" data-fk-exit>🚪 立即離開</button>' : '';
      if (k.skipped) bar.className = 'fk-bar done', bar.innerHTML = '🚪 已解除訂正限制（測試／家長帳號），可以離開：' + (cfg.back ? '<a href="' + cfg.back + '">↩ 回上一層</a>' : '') + '<a href="https://jenlin2002.github.io/">🏠 回主頁面</a>';
      else if (k.status === 'fixing') bar.className = 'fk-bar', bar.innerHTML = '<button type="button" disabled>✏️ 第 ' + k.round + ' 次訂正中</button><span>把 <b>' + k.fixing.length + ' 題</b>黃色框的題目重新作答，完成後按下方「送出訂正」。錯題全部訂正完畢再另加補送 <b>1 點</b>。</span>' + exit;
      else if (k.status === 'graded' && k.pending) bar.className = 'fk-bar', bar.innerHTML = '<button type="button" data-fk-fix>✏️ 訂正錯誤</button><span>「' + k.name + '」還有 <b>' + wrong().length + ' 題</b>錯誤（紅色）。按「訂正錯誤」重新作答，<b>錯誤全部訂正完畢再另加補送 1 點</b>；訂正完才能離開這一頁。</span>' + exit;
      else if (k.status === 'graded' && k.round > 0) bar.className = 'fk-bar done', bar.innerHTML = '🎉 「' + k.name + '」錯題全部訂正完成（訂正 ' + k.round + ' 次）！補送 <b>1 點</b>。';
      else { bar.hidden = true; return; }
      bar.hidden = false;
    }
    bar.addEventListener('click', function (e) {
      if (e.target.closest('[data-fk-exit]')) { kits.forEach(function (o) { if (o.pending || o.status === 'fixing') o.skip(); }); k.skip(); return; }
      if (e.target.closest('[data-fk-fix]')) startFix();
    });
    k.skip = function () {
      k.pending = false; k.skipped = true;
      if (k.status === 'fixing') { items().forEach(function (it) { it.el.classList.remove('fk-fixing'); it.lock(true); it.mark(); }); k.status = 'graded'; setBtn('已送出成績（' + k.score + ' / ' + k.total + '）', false); }
      draw();
    };
    function startFix() {
      var w = wrong(); if (!w.length) return;
      k.round++; k.fixing = w; k.status = 'fixing';
      items().forEach(function (it, i) {
        if (w.indexOf(i) >= 0) { it.unmark(); it.clear(); it.lock(false); it.el.classList.add('fk-fixing'); }
        else it.lock(true);
      });
      setBtn('送出訂正', true); draw();
      var f = items()[w[0]]; if (f && f.el.scrollIntoView) f.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function graded(name) {
      items().forEach(function (it) { it.el.classList.remove('fk-fixing'); it.lock(true); it.mark(); });
      k.status = 'graded'; k.fixing = [];
      k.pending = wrong().length > 0;
      setBtn('已送出成績（' + k.score + ' / ' + k.total + '）' + (k.round ? '・已訂正' : ''), false);
      if (!k.pending && k.round > 0) {
        if (name !== 'PARENT') cfg.post(name, '【全部訂正完成】補送 1 點', [{ q: '錯題全部訂正完成（共訂正 ' + k.round + ' 次）', picked: '', correct: '', isCorrect: true }], 1, 1);
        if (window.Points) { try { Points.earn({ name: name, label: cfg.earn.label + '・' + cfg.earn.mode, mode: '訂正完成', kind: 'fix-bonus', correct: 1, total: 1 }); } catch (e) {} }
      }
      draw();
      if (bar.scrollIntoView && (k.pending || k.round)) bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function submit() {
      if (k.status === 'graded') return;
      var name = student();
      if (!name) { alert('請先登入（在「你是誰？」選名字並輸入 PIN），成績才會記在你的名下'); return; }
      var all = items();
      if (k.status === 'fixing') {
        var fx = k.fixing.map(function (i) { return all[i]; });
        var left = fx.filter(function (it) { return !String(it.value()).trim(); }).length;
        if (left) { alert('還有 ' + left + ' 題訂正的題目沒作答'); return; }
        var rows = fx.map(rowOf), ok = rows.filter(function (r) { return r.isCorrect; }).length;
        if (name !== 'PARENT') cfg.post(name, '【第 ' + k.round + ' 次訂正】', rows, ok, rows.length);
        graded(name);
        return;
      }
      var miss = all.filter(function (it) { return !String(it.value()).trim(); }).length;
      if (miss) { alert('「' + k.name + '」還有 ' + miss + ' 題沒作答，請先完成再送出成績'); return; }
      var rows0 = all.map(rowOf);
      k.score = rows0.filter(function (r) { return r.isCorrect; }).length; k.total = rows0.length;
      clearDraft(); draftBtn.hidden = true; note.textContent = '';
      graded(name);
      if (window.Points) { try { Points.earn({ name: name, label: cfg.earn.label, mode: cfg.earn.mode, correct: k.score, total: k.total }); } catch (e) {} }
      if (name !== 'PARENT') cfg.post(name, '', rows0, k.score, k.total);
      if (cfg.onGraded) cfg.onGraded(k.score, k.total, k.pending);
    }
    btn.onclick = function (e) { if (e) e.preventDefault(); submit(); };
    k.submit = submit;

    // ---- 暫存 ----
    function dkey() { return 'fkDraft:' + location.pathname + ':' + cfg.id + ':' + (student() || '-'); }
    function saveDraft(manual) {
      if (k.status !== 'open') return;
      var vals = items().map(function (it) { return String(it.value() || ''); });
      var n = vals.filter(function (v) { return v.trim(); }).length;
      try { if (n) localStorage.setItem(dkey(), JSON.stringify({ t: Date.now(), v: vals })); else localStorage.removeItem(dkey()); } catch (e) { if (manual) alert('這台裝置無法暫存（瀏覽器不允許）'); return; }
      var d = new Date();
      note.textContent = n ? (manual ? '✅ 已暫存' : '已自動暫存') + '（' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '，' + n + ' 題），下次打開會自動接續' : '';
    }
    function clearDraft() { try { localStorage.removeItem(dkey()); } catch (e) {} }
    var timer = 0;
    k.autoSave = function () { clearTimeout(timer); timer = setTimeout(function () { saveDraft(false); }, 600); };
    draftBtn.onclick = function () { saveDraft(true); };
    k.restore = function () {
      var d = null; try { d = JSON.parse(get(dkey()) || 'null'); } catch (e) {}
      if (!d || !d.v) return;
      var its = items(), n = 0;
      d.v.forEach(function (v, i) { if (its[i] && v) { its[i].set(v); n++; } });
      if (n) note.textContent = '📌 已接續上次暫存的作答（' + n + ' 題），做完再送出成績';
    };
    window.addEventListener('pagehide', function () { if (k.status === 'open') saveDraft(false); });
    if (cfg.box) ['input', 'change', 'click'].forEach(function (ev) { cfg.box.addEventListener(ev, function () { if (k.status === 'open') k.autoSave(); }); });
    setTimeout(k.restore, 0);
    return k;
  }
  return (window.FixKit = { make: make, kits: kits, student: student });
})();
