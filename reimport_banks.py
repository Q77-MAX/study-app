# -*- coding: utf-8 -*-
"""Parse 4 source files and regenerate clean JSON question banks."""
import json, re, sys

# ── helpers ──────────────────────────────────────────────────
def split_options(text):
    """5-strategy option splitter (mirrors db.ts repairAllQuestions)."""
    if not text or len(text) < 2:
        return [text] if text else []
    parts = [text]
    # 1: [letter][.、）)] → A. B、C)
    if len(parts) <= 1:
        parts = re.split(r'(?=[A-Ha-h][\.\、）\)])', text)
    # 2: space+letter → "断路器  A. 隔离开关"
    if len(parts) <= 1:
        parts = re.split(r'(?=\s{1,4}[A-Ha-h][\s\.\、）\)])', text)
    # 3: letter+chinese → "A断路器B隔离开关"
    if len(parts) <= 1:
        parts = re.split(r'(?<=[\)）.\.\、\s])(?=[A-Ha-h][一-鿿])', text)
    if len(parts) <= 1:
        parts = re.split(r'(?=[A-Ha-h][一-鿿])', text)
    # 4: 2+ spaces
    if len(parts) <= 1 and re.search(r'\s{2,}', text):
        parts = re.split(r'\s{2,}', text)
    # 5: semicolons
    if len(parts) <= 1:
        parts = re.split(r'[；;]', text)
    result = []
    for p in parts:
        if p is None: continue
        cleaned = re.sub(r'^[A-Ha-h][\.\、）\)\s]+', '', p.strip()).strip()
        if cleaned:
            result.append(cleaned)
    return result if len(result) > 1 else [text.strip()]

def detect_type(answer, opts, content=''):
    """Determine question type from answer + options + content."""
    ans = answer.upper().replace(',', '').replace('，', '').replace(' ', '').replace('、', '').strip()
    # Multi-letter answer → multiple choice
    if len(ans) > 1 and re.match(r'^[A-H]+$', ans):
        return 'multiple'
    # Judge patterns
    if ans in ('对','错','正确','错误','是','否','√','×','✓','✗','T','F','TRUE','FALSE'):
        return 'judge'
    if len(opts) == 2 and all(re.match(r'^(对|错|正确|错误|是|否|√|×|✓|✗)$', o) for o in opts):
        return 'judge'
    # Content keywords
    if re.search(r'多选|多项', content):
        return 'multiple'
    if re.search(r'判断|对错', content):
        return 'judge'
    if re.search(r'填空|___|__|（\s*）|\(\s*\)', content):
        return 'fill'
    if re.search(r'简答|论述|问答|计算|名词解释', content):
        return 'essay'
    if len(opts) == 0:
        return 'essay'
    return 'single'

def clean_answer(answer, qtype):
    """Normalize answer string."""
    a = answer.strip().upper().replace(',', '').replace('，', '').replace('、', '').replace(' ', '').replace(';', '').replace('；', '')
    if qtype == 'judge':
        if re.match(r'^(对|正确|是|√|✓|A|T|TRUE)$', a, re.IGNORECASE):
            return 'A'
        if re.match(r'^(错|错误|否|×|✗|B|F|FALSE)$', a, re.IGNORECASE):
            return 'B'
    # Only keep A-H
    a = re.sub(r'[^A-H]', '', a)
    if qtype == 'multiple' and len(a) > 1:
        a = ''.join(sorted(a))
    return a

# ── XLS parsers ──────────────────────────────────────────────
import xlrd

def parse_gaodianya_xls(path):
    """Parse 高电压技术 xls: col0=type, col1=question, col2=options(newline-sep), col3=answer"""
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    questions = []
    type_map = {'单选题': 'single', '多选题': 'multiple', '判断题': 'judge',
                '填空题': 'fill', '简答题': 'essay', '论述题': 'essay'}
    for r in range(2, sh.nrows):  # skip header rows
        typ_raw = str(sh.cell_value(r, 0)).strip()
        qtype = type_map.get(typ_raw, 'single')
        content = str(sh.cell_value(r, 1)).strip()
        if not content or len(content) < 2:
            continue
        opts_raw = str(sh.cell_value(r, 2)).strip()
        answer_raw = str(sh.cell_value(r, 3)).strip().upper()
        # Options often separated by newlines in cell
        if '\n' in opts_raw:
            opts = [o.strip() for o in opts_raw.split('\n') if o.strip()]
            # Also try splitting each for inline letter markers
            all_opts = []
            for o in opts:
                all_opts.extend(split_options(o))
            opts = all_opts
        else:
            opts = split_options(opts_raw)
        # Remove empty/whitespace options
        opts = [o for o in opts if o.strip()]
        answer = clean_answer(answer_raw, qtype)
        # Fix type from answer
        if qtype == 'single' and len(answer) > 1:
            qtype = 'multiple'
        questions.append({
            'type': qtype, 'content': content, 'options': opts, 'answer': answer,
            'explanation': '', 'knowledgePoints': [], 'difficulty': 1,
        })
    return questions

def parse_fadianchang_xls(path):
    """Parse 发电厂热力设备 xls: col0=type, col2=question, col3=answer, col4-7=ABCD options"""
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(0)
    questions = []
    type_map = {'单选题': 'single', '多选题': 'multiple', '判断题': 'judge',
                '填空题': 'fill', '简答题': 'essay'}
    for r in range(4, sh.nrows):  # skip header rows (0-3)
        typ_raw = str(sh.cell_value(r, 0)).strip()
        qtype = type_map.get(typ_raw, 'single')
        content = str(sh.cell_value(r, 2)).strip()
        if not content or len(content) < 2:
            continue
        # Options in separate columns
        opts = []
        for c in range(4, 8):
            val = str(sh.cell_value(r, c)).strip()
            if val and val != 'nan':
                opts.append(val)
        answer_raw = str(sh.cell_value(r, 3)).strip().upper()
        answer = clean_answer(answer_raw, qtype)
        if qtype == 'single' and len(answer) > 1:
            qtype = 'multiple'
        questions.append({
            'type': qtype, 'content': content, 'options': opts, 'answer': answer,
            'explanation': '', 'knowledgePoints': [], 'difficulty': 1,
        })
    return questions

# ── DOCX parser ──────────────────────────────────────────────
from docx import Document

def parse_docx(path):
    """Parse 继电保护 docx: text format with blank-line question separators."""
    doc = Document(path)
    full_text = '\n'.join([p.text for p in doc.paragraphs])
    # Remove header
    lines = full_text.split('\n')
    # Find start of first question
    start = 0
    for i, line in enumerate(lines):
        if re.match(r'^\d+\.\s*[\(（]', line.strip()):
            start = i
            break
    lines = lines[start:]

    questions = []
    current = None
    current_opts = []

    for line in lines:
        s = line.strip()
        if not s:
            if current:
                questions.append(current)
                current = None
                current_opts = []
            continue

        # Question start: "1.(单选题 )..."
        qm = re.match(r'^(\d+)\.\s*[\(（]([^)）]*)[）\)]\s*(.+)', s)
        if qm:
            if current:
                questions.append(current)
            typ_raw = qm.group(2).strip()
            type_map2 = {'单选题': 'single', '多选题': 'multiple', '判断题': 'judge',
                         '填空题': 'fill', '简答题': 'essay', '论述题': 'essay'}
            qtype = 'single'
            for k, v in type_map2.items():
                if k in typ_raw:
                    qtype = v
                    break
            current = {
                'type': qtype, 'content': qm.group(3).strip(), 'options': [],
                'answer': '', 'explanation': '', 'knowledgePoints': [], 'difficulty': 1,
            }
            current_opts = []
            continue

        if not current:
            continue

        # Answer line
        am = re.match(r'^答案[：:\s]*(.+)$', s)
        if am:
            current['answer'] = clean_answer(am.group(1), current['type'])
            continue

        # Difficulty
        dm = re.match(r'^难度[：:\s]*(.+)$', s)
        if dm:
            d = dm.group(1).strip()
            diff_map = {'易': 1, '中': 2, '较难': 3, '难': 4, '困难': 5}
            current['difficulty'] = diff_map.get(d, 1)
            try:
                current['difficulty'] = int(float(d))
            except:
                pass
            continue

        # Option line: "A. xxx" "B、xxx"
        om = re.match(r'^[A-Ha-h][\.\、）\)]\s*(.+)', s)
        if om:
            current_opts.append(om.group(1).strip())
            continue

        # Multi-option inline in one line
        if re.search(r'[A-H][\.\、）\)]', s):
            parts = split_options(s)
            if len(parts) > 1:
                current_opts.extend(parts)
                continue

        # Continuation text
        if current_opts:
            current_opts[-1] = current_opts[-1] + s
        else:
            current['content'] = current['content'] + s

    if current:
        questions.append(current)

    # Post-process: assign options, fix types
    for q in questions:
        q['options'] = current_opts if not q['options'] and current_opts else q['options']
        q['type'] = detect_type(q['answer'], q['options'], q['content'])
        q['answer'] = clean_answer(q['answer'], q['type'])

    return questions

# ── Main ─────────────────────────────────────────────────────
tasks = [
    ('questions_gaodianya_final.json', r"C:\Users\74476\OneDrive\桌面\《高电压技术》题库(期末考试版）.xls", parse_gaodianya_xls),
    ('questions_gaodianya.json', r"C:\Users\74476\OneDrive\桌面\《高电压技术》题库(1).xls", parse_gaodianya_xls),
    ('questions_jidianbaohu.json', r"C:\Users\74476\OneDrive\桌面\继电保护及其运行与调试-题库(1)-40dc7ef1.docx", parse_docx),
    ('questions_parsed.json', r"C:\Users\74476\OneDrive\桌面\发电厂热力设备及系统期末题库550题(2).xls", parse_fadianchang_xls),
]

OUT = r"C:\Users\74476\study-app\public"
import os

for fname, path, parser in tasks:
    print(f'Parsing: {path}')
    qs = parser(path)
    # Validate
    for q in qs:
        if not q['content']:
            print(f'  WARN: empty content')
        if not q['answer']:
            print(f'  WARN: empty answer for "{q["content"][:40]}"')
    # Stats
    types = {}
    for q in qs:
        t = q['type']
        types[t] = types.get(t, 0) + 1
    out_path = os.path.join(OUT, fname)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False)
    print(f'  -> {fname}: {len(qs)} questions, types={types}')
    print(f'  Saved to {out_path}')

print('\nDone!')
