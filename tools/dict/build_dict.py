"""產生網站字典資料 /dict/data/*.json（2026-11-18）。
來源：ECDICT（https://github.com/skywind3000/ECDICT，MIT 授權），中文用 OpenCC s2twp 轉成台灣繁體。
用法：pip install opencc-python-reimplemented
      git clone --depth 1 https://github.com/skywind3000/ECDICT
      python tools/dict/build_dict.py <ECDICT 資料夾>
只留常用字（國中、高中、全民英檢等常見考試字表，或詞頻前 3 萬名），每個字：中文解釋、程度、原形。"""
import csv, json, os, re, sys
import opencc

SRC = sys.argv[1] if len(sys.argv) > 1 else 'ECDICT'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'dict', 'data')
cc = opencc.OpenCC('s2twp')
csv.field_size_limit(10 ** 8)

TAGS = ['zk', 'gk', 'cet4', 'cet6', 'ky', 'toefl', 'ielts', 'gre']
LEVEL = {'zk': '國中', 'gk': '高中'}
TOP = 30000
WORD = re.compile(r"^[A-Za-z][A-Za-z'\-]*( [A-Za-z][A-Za-z'\-]*){0,3}$")

def rank(x):
    try:
        v = int(x or 0)
        return v if v > 0 else 10 ** 9
    except ValueError:
        return 10 ** 9

def clean(t):
    lines = []
    for ln in t.replace('\\r', '').split('\\n'):
        ln = ln.strip()
        if not ln or ln.startswith('['):
            continue
        parts = [p.strip() for p in re.split(r'[,，]\s*', ln)]
        ln = ', '.join(parts[:10])
        lines.append(ln)
        if len(lines) >= 6:
            break
    return cc.convert('\n'.join(lines))

keep = {}
forms = {}
with open(os.path.join(SRC, 'ecdict.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        w = r['word'].strip()
        if not WORD.match(w) or not r['translation'].strip():
            continue
        tags = r['tag'].split()
        best = min(rank(r['frq']), rank(r['bnc']))
        if not (any(t in TAGS for t in tags) or best <= TOP or (r['collins'] or '0') not in ('', '0') or r['oxford'] == '1'):
            continue
        if ' ' in w and not any(t in ('zk', 'gk') for t in tags) and best > 8000:
            continue
        tr = clean(r['translation'])
        if not tr:
            continue
        k = w.lower()
        lv = next((LEVEL[t] for t in ('zk', 'gk') if t in tags), '')
        ex = dict(p.split(':', 1) for p in r['exchange'].split('/') if ':' in p)
        lemma = ex.get('0', '')
        if lemma.lower() == k:
            lemma = ''
        old = keep.get(k)
        if old and old['best'] <= best:
            continue
        keep[k] = {'w': w, 't': tr, 'lv': lv, 'l': lemma, 'best': best}
        for code in ('p', 'd', 'i', '3', 's', 'r', 't'):
            for fm in ex.get(code, '').split(','):
                fm = fm.strip().lower()
                if fm and fm != k and WORD.match(fm):
                    forms.setdefault(fm, k)

os.makedirs(OUT, exist_ok=True)
shards = {}
for k, e in keep.items():
    row = [e['t']]
    if e['w'] != k or e['lv'] or e['l']:
        row += [e['w'] if e['w'] != k else 0, e['lv'] or 0]
        if e['l']:
            row.append(e['l'])
    shards.setdefault(k[0] if 'a' <= k[0] <= 'z' else '0', {})[k] = row
for fm, lem in forms.items():
    if fm not in keep and lem in keep:
        shards.setdefault(fm[0] if 'a' <= fm[0] <= 'z' else '0', {})['@' + fm] = lem
total = 0
for s, d in shards.items():
    with open(os.path.join(OUT, s + '.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    total += os.path.getsize(os.path.join(OUT, s + '.json'))
# 中文查英文用：國中、高中字＋詞頻前 1 萬名（只放第一行解釋）
zh = sorted(([k, e['t'].split('\n')[0][:60]] for k, e in keep.items()
             if ' ' not in k and (e['lv'] or e['best'] <= 10000)), key=lambda x: keep[x[0]]['best'])
with open(os.path.join(OUT, 'zh.json'), 'w', encoding='utf-8') as f:
    json.dump(zh, f, ensure_ascii=False, separators=(',', ':'))
print('entries', len(keep), 'forms', sum(1 for fm in forms if fm not in keep), 'bytes', total,
      'zh', len(zh), os.path.getsize(os.path.join(OUT, 'zh.json')))
