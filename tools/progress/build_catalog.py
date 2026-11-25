"""學習進度對照表的「單元總表」：掃描各子網站，列出每個 Hub 有哪些測驗、送成績時用的名稱（label）。

輸出 progress/catalog.json，首頁的「📊 學習進度對照表」（progress/progress.js）拿它對照後端 action=progress
回傳的「做過的測驗」：存摺／測驗紀錄的項目是「label・模式」，只要以 label 開頭（下一個字是 ・（( 或結束）就算做過。

用法：python tools/progress/build_catalog.py          （六個 repo 要放在同一個資料夾，預設 E:\\GitHub）
新做了單元（文法、單字、聽力、寫作、場景、段考卷…）之後重跑一次再 Push 首頁 repo。
"""
import glob, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.dirname(os.path.dirname(HERE))
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HOME)
EQ = os.path.join(ROOT, 'english-quiz')


def rd(p):
    return open(p, encoding='utf-8', errors='replace').read()


def title_of(p):
    m = re.search(r'<title>(.*?)</title>', rd(p), re.S)
    return html.unescape(m.group(1)).strip() if m else ''


def gq_label(p):
    m = re.search(r'''["']?label["']?\s*:\s*["']([^"']+)["']''', rd(p))
    return m.group(1) if m else ''


def week_label(p):
    m = re.search(r'WEEK_LABEL\s*=\s*"([^"]+)"', rd(p))
    return m.group(1) if m else ''


def item(p, t, u, kid=None):
    p = [x for x in (p if isinstance(p, list) else [p]) if x]
    assert p, '找不到測驗名稱：%s %s' % (t, u)   # 空字串會對到所有紀錄，一定要擋
    d = {'p': p, 't': t, 'u': u}
    if kid:
        d['k'] = kid
    return d


def cards(index_path):
    """總目錄頁的卡片：(週次文字, 標題, 測驗連結)"""
    t = rd(index_path)
    out = []
    for blk in re.split(r'<(?:div|a) class="card(?:\s[^"]*)?"', t)[1:]:
        wk = re.search(r'class="card-week">([^<]+)<', blk)
        ti = re.search(r'class="card-title">(.*?)</div>', blk, re.S)
        qz = re.search(r'class="link-quiz" href="([^"]+)"', blk) or re.search(r'^[^>]*href="([^"]+)"', blk)
        if wk and ti and qz:
            out.append((html.unescape(wk.group(1)).strip(), re.sub('<[^>]+>', '', html.unescape(ti.group(1))).strip(), qz.group(1)))
    return out


hubs = []

# ---------- 文法 ----------
g = []
items = []
for wk, ti, href in cards(os.path.join(EQ, 'course1.html')):
    f = os.path.join(EQ, href)
    if os.path.exists(f) and week_label(f):
        items.append(item(week_label(f), '%s %s' % (wk.title(), ti), '/english-quiz/' + href))
g.append({'name': '第一期（18 週）', 'items': items})
items = []
for wk, ti, href in cards(os.path.join(EQ, 'course2', 'index.html')):
    f = os.path.join(EQ, 'course2', href)
    if os.path.exists(f) and week_label(f):
        items.append(item(week_label(f), '%s %s' % (wk, ti), '/english-quiz/course2/' + href))
g.append({'name': '第二期（先修＋20 週）', 'items': items})
items = []
for f in sorted(glob.glob(os.path.join(EQ, 'grammar2', 'u[0-9][0-9]-quiz.html'))):
    n = int(os.path.basename(f)[1:3]); ti = title_of(os.path.join(EQ, 'grammar2', 'u%02d.html' % n)).split('｜')[-1]
    items.append(item(gq_label(f), ti, '/english-quiz/grammar2/' + os.path.basename(f)))
g.append({'name': '國中文法．分科詳解', 'items': items})
hubs.append({'id': 'grammar', 'name': '文法', 'icon': '✏️', 'url': '/english-quiz/', 'groups': g})

# ---------- 閱讀 ----------
NG = os.path.join(ROOT, 'nat-geo-reading')
std, other = [], []
for f in sorted(glob.glob(os.path.join(NG, 'week*.html')) + glob.glob(os.path.join(NG, 'extra-*.html')),
                key=lambda x: (int((re.search(r'week(\d+)', x) or re.search('()', x)).group(1) or 99), x)):
    if 'points-glue.js' not in rd(f):
        continue
    ti = title_of(f)
    lab = 'NatGeo｜' + re.sub(r'\s*[·｜|]\s*', ' ', ti, count=1).strip()
    b = os.path.basename(f)
    (other if re.search(r'-(easy|advanced)\.html$', b) else std).append(item(lab, ti, '/nat-geo-reading/' + b))
hubs.append({'id': 'reading', 'name': '閱讀', 'icon': '🗺️', 'url': '/nat-geo-reading/',
             'groups': [{'name': '國家地理（標準版）', 'items': std}, {'name': '簡化版／進階版', 'items': other}]})

# ---------- 單字 ----------
g = []
VK = os.path.join(ROOT, 'vocab-king', 'topics')
items = []
for f in sorted(glob.glob(os.path.join(VK, '*.js'))):
    t = rd(f)
    i_ = re.search(r'"id":\s*"([^"]+)"', t); a = re.search(r'"title":\s*"([^"]+)"', t); b = re.search(r'"titleEn":\s*"([^"]+)"', t)
    if i_ and a and b:
        items.append(item('Vocab｜%s %s' % (a.group(1), b.group(1)), '%s %s' % (a.group(1), b.group(1)), '/vocab-king/topic.html?t=' + i_.group(1)))
g.append({'name': '圖解單字', 'items': items})
for book, name in (('w2000', '主題 2000 字 PART 1'), ('w2000p2', '主題 2000 字 PART 2'), ('lala', 'LaLa Word 一字多義'), ('wordup', 'WORD UP 單字複習')):
    items = []
    fs = glob.glob(os.path.join(EQ, 'vocab', book, 'u*-quiz.html'))
    for f in sorted(fs, key=lambda x: (int(re.search(r'u(\d+)', os.path.basename(x)).group(1)), x)):
        lab = gq_label(f)
        if not lab:
            continue
        tag = os.path.basename(f)[:-10]
        ti = title_of(os.path.join(EQ, 'vocab', book, tag + '.html')) or tag
        ti = ti.split('｜')[-1]
        items.append(item(lab, ti, '/english-quiz/vocab/%s/%s' % (book, os.path.basename(f))))
    g.append({'name': name, 'items': items})
hubs.append({'id': 'vocab', 'name': '單字', 'icon': '🔤', 'url': '/vocab/', 'groups': g})

# ---------- 聽力 ----------
LV = {'b': '初級', 'm': '中級', 'h': '中高級'}
g = []
for lv, nm in LV.items():
    items = []
    for f in sorted(glob.glob(os.path.join(EQ, 'listening', lv + '[0-9][0-9].html'))):
        b = os.path.basename(f)
        items.append(item(gq_label(f), '%s 第 %d 回' % (nm, int(b[1:3])), '/english-quiz/listening/' + b))
    if items:
        g.append({'name': nm, 'items': items})
hubs.append({'id': 'listening', 'name': '聽力', 'icon': '🎧', 'url': '/english-quiz/listening/', 'groups': g})

# ---------- 寫作 ----------
items = []
for f in sorted(glob.glob(os.path.join(EQ, 'writing', 'u[0-9][0-9]-quiz.html'))):
    n = os.path.basename(f)[:3]
    ti = title_of(os.path.join(EQ, 'writing', n + '.html')).split('｜')[-1]
    items.append(item(gq_label(f), ti + ' 造句練習', '/english-quiz/writing/' + os.path.basename(f)))
hubs.append({'id': 'writing', 'name': '寫作', 'icon': '🖋️', 'url': '/english-quiz/writing/', 'groups': [{'name': '寫作園地', 'items': items}]})

# ---------- 美式生活館 ----------
LF = os.path.join(ROOT, 'daily_life_listening')
cat = rd(os.path.join(LF, 'catalog.js'))
ZONE = dict(re.findall(r"\{\s*id:\s*'(\w+)'[^}\n]*?name:\s*'([^']+)'", cat))
zones = {}
for m in re.finditer(r"\{\s*slug:\s*'([^']+)',\s*zone:\s*'(\w+)',.*?title:\s*'([^']+)',.*?ready:\s*(true|false)", cat):
    slug, zone, ti, ready = m.groups()
    if ready != 'true':
        continue
    p = ['Life｜' + ti]
    sf = os.path.join(LF, 'scenes', slug, 'scene.js')
    if os.path.exists(sf):
        st = re.search(r"""\btitle\s*:\s*['"]([^'"]+)['"]""", rd(sf))
        if st and 'Life｜' + st.group(1) not in p:
            p.append('Life｜' + st.group(1))
    zones.setdefault(zone, []).append(item(p, ti, '/daily_life_listening/scenes/%s/index.html' % slug))
hubs.append({'id': 'life', 'name': '美式生活館', 'icon': '🏛️', 'url': '/daily_life_listening/',
             'groups': [{'name': ZONE.get(z, z), 'items': v} for z, v in zones.items()]})

# ---------- 國中段考 ----------
g = []
TB = os.path.join(ROOT, 'textbook-review', 'data')
for key, kid, cls in (('g7', 'MELISSA', '七年級'), ('g8', 'BRANDEN', '八年級')):
    items = []
    for sub in ('chinese', 'english', 'social'):
        f = os.path.join(TB, '%s_%s.js' % (key, sub))
        if not os.path.exists(f):
            continue
        t = rd(f)
        subject = re.search(r'subject:\s*"([^"]+)"', t).group(1)
        books = list(re.finditer(r'\{\s*id:\s*"[^"]+",\s*name:\s*"([^"]+)"[^\n]*lessons:\s*\[', t))
        for bi, b in enumerate(books):
            seg = t[b.end(): books[bi + 1].start() if bi + 1 < len(books) else len(t)]
            for L in re.finditer(r'id:\s*"[^"]+",\s*(?:no:\s*"([^"]*)",\s*)?exam:\s*\d+,\s*title:\s*"([^"]+)"', seg):
                no, ti = L.group(1) or '', L.group(2)
                ex = ('%s%s %s' % (subject, '・' + b.group(1) if len(books) > 1 else '', no)).strip()
                items.append(item('課本複習｜%s %s' % (ex, ti), '%s %s' % (ex, ti), '/textbook-review/', kid))
    g.append({'name': '課本習作重點複習（%s）' % cls, 'items': items, 'kid': kid})
EB = os.path.join(ROOT, 'exam-bank')
FOLDER = {'.': ('康軒英語 七下（平時考）', None)}
for d in sorted(os.listdir(EB)):
    m = re.match(r'(kangxuan|hanlin)(?:-(chinese|math|nature|social))?-g(\d)-(\d)$', d)
    if m:
        pub = '康軒' if m.group(1) == 'kangxuan' else '翰林'
        subj = {'chinese': '國文', 'math': '數學', 'nature': '自然', 'social': '社會', None: '英語'}[m.group(2)]
        FOLDER[d] = ('%s%s %s年級%s' % (pub, subj, '七' if m.group(3) == '7' else '八', '上' if m.group(4) == '1' else '下'),
                     'MELISSA' if m.group(3) == '7' else 'BRANDEN')
for d, (nm, kid) in FOLDER.items():
    units = {}   # 同一回的 A／B／C 卷（testN、testNb、testNc）算一個單元，做任一卷就算做過
    for f in sorted(glob.glob(os.path.join(EB, d, 'test*.html')), key=lambda x: (int(re.search(r'test(\d+)', x).group(1)), x)):
        ti = title_of(f)
        n = re.match(r'test(\d+)([a-z]?)\.html$', os.path.basename(f))
        if not ti or not n:
            continue
        u = units.setdefault(int(n.group(1)), {'p': [], 't': '', 'u': '/exam-bank/' + ('' if d == '.' else d + '/') + os.path.basename(f)})
        if not n.group(2) or not u['t']:
            u['t'] = re.sub(r'（[A-Z]卷）$', '', ti).replace('段考題庫｜', '')
        if ti not in u['p']:
            u['p'].append(ti)
    if units:
        g.append({'name': '段考題庫：' + nm, 'kid': kid,
                  'items': [item(v['p'], v['t'], v['u'], kid) for k, v in sorted(units.items())]})
hubs.append({'id': 'school', 'name': '國中段考', 'icon': '🏫', 'url': '/school/', 'groups': g})

out = {'built': __import__('datetime').date.today().isoformat(), 'hubs': hubs}
os.makedirs(os.path.join(HOME, 'progress'), exist_ok=True)
json.dump(out, open(os.path.join(HOME, 'progress', 'catalog.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for h in hubs:
    print(h['name'], ' / '.join('%s %d' % (gg['name'], len(gg['items'])) for gg in h['groups']))
