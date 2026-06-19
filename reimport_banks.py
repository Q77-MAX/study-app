# -*- coding: utf-8 -*-
import json, re, os, openpyxl

desktop = r'C:\Users\74476\OneDrive\桌面'
OUT = r'C:\Users\74476\study-app\public'

def split_options(text):
    if not text or len(text) < 2: return [text] if text else []
    parts = [text]
    if len(parts) <= 1: parts = re.split(r'(?=[A-Ha-h][\.\、）\)])', text)
    if len(parts) <= 1: parts = re.split(r'(?=\s{1,4}[A-Ha-h][\s\.\、）\)])', text)
    if len(parts) <= 1: parts = re.split(r'(?<=[\)）.\.\、\s])(?=[A-Ha-h][一-鿿])', text)
    if len(parts) <= 1: parts = re.split(r'(?=[A-Ha-h][一-鿿])', text)
    if len(parts) <= 1 and re.search(r'\s{2,}', text): parts = re.split(r'\s{2,}', text)
    if len(parts) <= 1: parts = re.split(r'[；;]', text)
    result = []
    for p in parts:
        if p is None: continue
        c = re.sub(r'^[A-Ha-h][\.\、）\)\s]+', '', p.strip()).strip()
        if c: result.append(c)
    return result if len(result) > 1 else [text.strip()]

def clean_answer(answer, qtype):
    a = answer.strip().upper().replace(',','').replace('，','').replace('、','').replace(' ','').replace(';','').replace('；','')
    if qtype == 'judge':
        if re.match(r'^(对|正确|是|√|✓|A|T|TRUE)$', a, re.IGNORECASE): return 'A'
        if re.match(r'^(错|错误|否|×|✗|B|F|FALSE)$', a, re.IGNORECASE): return 'B'
    a = re.sub(r'[^A-H]', '', a)
    if qtype == 'multiple' and len(a) > 1: a = ''.join(sorted(a))
    return a

def parse_xlsx(path):
    wb = openpyxl.load_workbook(path)
    sh = wb.active
    questions = []
    type_map = {'单选题':'single','多选题':'multiple','判断题':'judge','填空题':'fill','简答题':'essay','论述题':'essay'}
    col_type = col_q = col_opts = col_ans = None
    for r in range(1, min(6, sh.max_row + 1)):
        for c in range(1, min(10, sh.max_column + 1)):
            v = str(sh.cell(r, c).value or '').strip()
            if '题型' in v: col_type = c
            elif '题目' in v or '题干' in v: col_q = c
            elif '选项' in v: col_opts = c
            elif '答案' in v: col_ans = c
    if not col_q: col_q = 2
    if not col_opts: col_opts = 3
    if not col_ans: col_ans = 4
    start = 2
    for r in range(1, min(8, sh.max_row + 1)):
        v = str(sh.cell(r, col_q).value or '').strip()
        if v and ('题目' in v or '题干' in v): start = r + 1
    for r in range(start, sh.max_row + 1):
        typ_raw = str(sh.cell(r, col_type).value or '').strip() if col_type else ''
        qtype = type_map.get(typ_raw, 'single')
        content = str(sh.cell(r, col_q).value or '').strip()
        if not content or len(content) < 2: continue
        opts_raw = str(sh.cell(r, col_opts).value or '').strip()
        options = []
        if opts_raw and opts_raw != 'None':
            if '\n' in opts_raw:
                for line in opts_raw.split('\n'):
                    line = line.strip()
                    if line:
                        sp = split_options(line)
                        options.extend(sp)
            else:
                options = split_options(opts_raw)
        options = [o for o in options if o.strip()]
        ans_raw = str(sh.cell(r, col_ans).value or '').strip().upper()
        answer = clean_answer(ans_raw, qtype)
        if qtype == 'single' and len(answer) > 1: qtype = 'multiple'
        if len(options) == 2 and all(re.match(r'^(对|错|正确|错误|是|否|√|×|✓|✗)$', o) for o in options):
            qtype = 'judge'
        questions.append({
            'type': qtype, 'content': content, 'options': options, 'answer': answer,
            'explanation': '', 'knowledgePoints': [], 'difficulty': 1,
        })
    return questions

tasks = [
    ('questions_gaodianya.json', os.path.join(desktop, '《高电压技术》题库（带答案）.xlsx')),
    ('questions_gaodianya_final.json', os.path.join(desktop, '《高电压技术》题库（期末考试版）带答案.xlsx')),
]

for fname, path in tasks:
    print(f'Parsing: {os.path.basename(path)}')
    qs = parse_xlsx(path)
    types = {}
    for q in qs: t = q['type']; types[t] = types.get(t, 0) + 1
    merged = sum(1 for q in qs for o in q.get('options',[]) if re.search(r'[B-H][\.\、）\)]', o))
    out_path = os.path.join(OUT, fname)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False)
    print(f'  -> {len(qs)} questions, {types}, {merged} merged options')

print('Done!')
