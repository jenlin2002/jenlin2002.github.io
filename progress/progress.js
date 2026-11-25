/* 首頁「📊 學習進度對照表」（2026-11-25）
 * 單元總表：progress/catalog.json（tools/progress/build_catalog.py 掃描各子網站產生）
 * 做過哪些測驗：點數後端 action=progress（存摺＋「測驗紀錄」分頁），回傳 { "測驗名稱・模式": [第一次日期, 最後日期, 次數, 最高%, 第一次%] }
 * 學生看自己的；家長（PARENT）看 BRANDEN、MELISSA 兩個人的。
 */
(function () {
  var box = document.getElementById('progressBoard');
  if (!box) return;
  var KIDS = ['BRANDEN', 'MELISSA'];
  var SEP = '・（( ';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var css = document.createElement('style');
  css.textContent =
    '#progressBoard{margin-top:44px}' +
    '.pg-card{background:#FFF8E6;color:#3B2F1E;border-radius:16px;padding:20px 22px;margin-top:14px}' +
    '.pg-note{font-size:13px;color:#9AA89C;margin:4px 0 0}' +
    '.pg-kids{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 2px}' +
    '.pg-kids button{border:1px solid #2A4A3C;background:#163026;color:#F7F3E8;border-radius:999px;padding:6px 14px;font:inherit;font-size:13.5px;cursor:pointer}' +
    '.pg-kids button.on{background:#E8B94A;color:#1B3A2F;border-color:#E8B94A;font-weight:700}' +
    '.pg-hub{border-bottom:1px solid #EADFC4;padding:12px 0}' +
    '.pg-hub:last-child{border-bottom:0}' +
    '.pg-row{display:grid;grid-template-columns:130px 1fr 150px;gap:12px;align-items:center;cursor:pointer}' +
    '.pg-name{font-weight:800;font-size:16px;white-space:nowrap}' +
    '.pg-name small{display:block;font-weight:500;font-size:11.5px;color:#8A7A5C}' +
    '.pg-bar{position:relative;height:26px;border-radius:999px;background:#EADFC4;overflow:hidden}' +
    '.pg-bar i{position:absolute;left:0;top:0;bottom:0;background:#4E9A6E;border-radius:999px}' +
    '.pg-bar span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#3B2F1E}' +
    '.pg-num{font-size:13px;color:#5B4B30;text-align:right;line-height:1.35}' +
    '.pg-num b{font-size:15px;color:#2F6B4A}' +
    '.pg-more{display:none;margin:10px 0 2px}' +
    '.pg-hub.open .pg-more{display:block}' +
    '.pg-grp{margin:8px 0 4px;font-weight:700;font-size:14px;color:#6B5A3A}' +
    '.pg-grp small{font-weight:500;color:#8A7A5C;margin-left:6px}' +
    '.pg-items{display:flex;flex-wrap:wrap;gap:6px}' +
    '.pg-it{display:inline-block;font-size:12.5px;padding:4px 9px;border-radius:8px;border:1px solid #E3D6B8;background:#fff;color:#7A6A4C;text-decoration:none}' +
    '.pg-it.done{background:#E3F2E8;border-color:#9CCBAE;color:#2F6B4A;font-weight:600}' +
    '.pg-it.low{background:#FFF1DC;border-color:#E8B94A;color:#8A5A10}' +
    '.pg-legend{font-size:12.5px;color:#7A6A4C;margin-top:10px}' +
    '.pg-legend .pg-it{pointer-events:none;margin-right:4px}' +
    '@media (max-width:640px){.pg-row{grid-template-columns:1fr;gap:6px}.pg-num{text-align:left}.pg-card{padding:16px 14px}}';
  document.head.appendChild(css);

  var cat = null, data = {}, who = '', kid = '', msg = '';
  function matches(key, p) { return key.indexOf(p) === 0 && (key.length === p.length || SEP.indexOf(key.charAt(p.length)) >= 0); }
  function stat(it, keys, items) {   // 這個單元做過沒有：回傳 [第一次%, 最高%, 次數, 最後日期] 或 null
    var best = null;
    keys.forEach(function (k) {
      if (!it.p.some(function (p) { return matches(k, p); })) return;
      var v = items[k];
      if (!best) best = [v[4], v[3], v[2], v[1], v[0]];
      else {
        if (v[0] < best[4]) { best[4] = v[0]; best[0] = v[4]; }
        best[1] = Math.max(best[1], v[3]); best[2] += v[2]; if (v[1] > best[3]) best[3] = v[1];
      }
    });
    return best;
  }
  function forKid(arr, k) { return arr.filter(function (x) { return !x.k || x.k === k; }); }

  function render() {
    var h = '<div class="section-title">📊 學習進度對照表</div>';
    if (msg) { box.innerHTML = h + '<div class="pg-card">' + msg + '</div>'; return; }
    if (!cat) { box.innerHTML = h + '<div class="pg-card">讀取中…</div>'; return; }
    var kids = Object.keys(data);
    if (kids.length > 1) h += '<div class="pg-kids">' + kids.map(function (k) { return '<button type="button" data-kid="' + k + '" class="' + (k === kid ? 'on' : '') + '">' + k + '</button>'; }).join('') + '</div>';
    var d = data[kid];
    if (!d) { box.innerHTML = h + '<div class="pg-card">讀取中…</div>'; return; }
    var items = d.items || {}, keys = Object.keys(items);
    h += '<div class="pg-card">';
    cat.hubs.forEach(function (hub) {
      var groups = hub.groups.filter(function (g) { return !g.kid || g.kid === kid; });
      var all = 0, done = 0, sum = 0, inner = '';
      groups.forEach(function (g) {
        var its = forKid(g.items, kid), gd = 0, chips = '';
        its.forEach(function (it) {
          var s = stat(it, keys, items);
          all++;
          if (s) { done++; gd++; sum += s[0]; }
          var tip = s ? '第一次 ' + s[0] + '%、最高 ' + s[1] + '%、做過 ' + s[2] + ' 次、最後 ' + s[3] : '還沒做';
          chips += '<a class="pg-it' + (s ? (s[1] < 60 ? ' low' : ' done') : '') + '" href="' + esc(it.u) + '" title="' + esc(tip) + '">' + (s ? '✓ ' : '') + esc(it.t) + (s ? '　' + s[1] + '%' : '') + '</a>';
        });
        if (its.length) inner += '<div class="pg-grp">' + esc(g.name) + '<small>' + gd + ' / ' + its.length + '</small></div><div class="pg-items">' + chips + '</div>';
      });
      if (!all) return;
      var pct = Math.round(done / all * 100);
      h += '<div class="pg-hub" data-hub="' + hub.id + '"><div class="pg-row"><div class="pg-name">' + hub.icon + ' ' + esc(hub.name) + '<small>點開看每個單元 ▾</small></div>' +
        '<div class="pg-bar"><i style="width:' + pct + '%"></i><span>' + done + ' / ' + all + '（' + pct + '%）</span></div>' +
        '<div class="pg-num">' + (done ? '第一次平均 <b>' + Math.round(sum / done) + '%</b>' : '還沒開始') + '</div></div>' +
        '<div class="pg-more">' + inner + '</div></div>';
    });
    h += '<div class="pg-legend"><span class="pg-it done">✓ 做過</span><span class="pg-it low">✓ 最高不到 60%</span><span class="pg-it">還沒做</span>　百分比是最高答對率；滑鼠停在單元上看第一次、最高、次數、日期。</div></div>';
    h += '<p class="pg-note">「做過」＝有送出過那一份測驗（點數存摺和測驗紀錄，' + (d.since ? '每次送出都記錄，從 ' + esc(d.since.slice(0, 10)) + ' 起' : '目前只看得到有賺到點數的那幾次') + '）。單元總表更新：' + esc(cat.built) + '。</p>';
    var open = {};
    box.querySelectorAll('.pg-hub.open').forEach(function (x) { open[x.dataset.hub] = 1; });
    box.innerHTML = h;
    box.querySelectorAll('.pg-hub').forEach(function (x) { if (open[x.dataset.hub]) x.classList.add('open'); });
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-kid]');
    if (b) { kid = b.dataset.kid; render(); return; }
    var r = e.target.closest('.pg-row');
    if (r) r.parentNode.classList.toggle('open');
  });

  function load(name, token) {
    return Points.call({ action: 'progress', name: name, token: token }).then(function (d) {
      if (d && d.ok) { data[name] = d; return true; }
      if (d && d.error === 'unknown-action') msg = '進度功能還沒啟用：家長要先到 Apps Script 貼上新版 Code.gs、部署新版本。';
      return false;
    });
  }
  function start() {
    if (!window.Points || !Points.enabled || !Points.call) { msg = '點數系統沒有啟用，看不到進度。'; render(); return; }
    who = (Points.who && Points.who()) || '';
    var adminTok = Points.tokenOf('PARENT');
    var list = [];
    if (who === 'PARENT' || (!who && adminTok)) list = KIDS.map(function (k) { return [k, adminTok]; });
    else if (who && Points.tokenOf(who)) list = [[who, Points.tokenOf(who)]];
    if (!list.length) { msg = '登入後就會顯示你做過哪些單元。'; render(); return; }
    kid = list[0][0];
    render();
    Promise.all(list.map(function (x) { return load(x[0], x[1]).catch(function () { return false; }); })).then(function (ok) {
      if (!ok.some(Boolean) && !msg) msg = '讀不到進度，請晚點再試。';
      if (!data[kid]) kid = Object.keys(data)[0] || kid;
      render();
    });
  }
  fetch('/progress/catalog.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (c) { cat = c; render(); }, function () { msg = '讀不到單元總表。'; render(); });
  render();
  // points.js 會先問 /api/me（Cloudflare 登入）才知道是誰，稍等一下再讀
  var tries = 0;
  (function wait() {
    if (window.Points && Points.who && (Points.who() || ++tries > 20)) return start();
    if (tries > 20) return start();
    tries++; setTimeout(wait, 250);
  })();
})();
