import { useState, useRef, useEffect } from 'react';
import { getSettings, addQuestions, createBank, getAllBanks, deleteBank, renameBank, repairAllQuestions } from '../store/db';
import { parseQuestions, parseQuestionsFromImage } from '../services/ai';
import type { Question, QuestionBank, QuestionType } from '../types';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export default function ImportPanel() {
  const [textInput, setTextInput] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [showBanks, setShowBanks] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadBanks(); }, []);
  const loadBanks = async () => setBanks(await getAllBanks());

  // ============ 本地解析（智能增强版）============
  const localParse = (text: string): Partial<Question>[] => {
    // 先试试 JSON
    try {
      const trimmed = text.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].content) return parsed;
        if (parsed.content && Array.isArray(parsed.options)) return [parsed];
      }
    } catch {}

    // 检测 CSV/TSV 格式（逗号或 Tab 分隔的表格数据）
    const firstLine = text.trim().split('\n')[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    if ((commas >= 2 || tabs >= 2) && firstLine.length < 500) {
      const delimiter = tabs > commas ? '\t' : ',';
      const csvQuestions = parseCSV(text, delimiter);
      if (csvQuestions.length > 0) return csvQuestions;
    }

    // 预处理：清理 HTML 标签、PDF 乱码
    let cleaned = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')  // 合并连续空格
      .replace(/\n{3,}/g, '\n\n'); // 合并过多空行

    const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const questions: Partial<Question>[] = [];
    let current: Partial<Question> | null = null;
    let currentChapter = '';

    // 题型关键词映射
    const typeKeywords: Record<string, QuestionType> = {
      '单选题': 'single', '单选': 'single', '多项选择题': 'multiple', '多选题': 'multiple', '多选': 'multiple',
      '判断题': 'judge', '判断': 'judge', '对错题': 'judge',
      '填空题': 'fill', '填空': 'fill',
      '简答题': 'essay', '简答': 'essay', '论述题': 'essay', '论述': 'essay', '计算题': 'essay', '计算': 'essay',
      '问答题': 'essay', '问答': 'essay', '名词解释': 'essay',
    };

    const flushQuestion = () => {
      if (current && current.content) {
        // 🔧 先用答案修正题型
        const ans = (current.answer || '').toUpperCase().replace(/[^A-H对错是是否√×✓✗TF正确错误]/g, '');
        if (ans.length > 1 && /^[A-H]+$/.test(ans)) {
          // 答案有多个字母 → 一定是多选题
          current.type = 'multiple';
        } else if (/^[对错是是否√×✓✗TF正确错误]$/.test(ans) || (ans === 'A' && current.options && current.options.length === 2 && /对|错/.test(current.options.join('')))) {
          current.type = 'judge';
        }
        // 再用 detectType 兜底
        if (!current.type || current.type === 'single') {
          current.type = detectType(current);
        }
        // 自动补全判断题型选项
        if (current.type === 'judge' && (!current.options || current.options.length === 0)) {
          current.options = ['对', '错'];
        }
        // 🔧 如果答案多字母但类型还是 single，修正为 multiple
        if (current.type === 'single' && current.answer && /^[A-H]{2,}$/i.test(current.answer.replace(/[,，\s]/g, ''))) {
          current.type = 'multiple';
        }
        // 清理答案
        if (current.answer) {
          current.answer = cleanAnswer(current.answer, current.type || 'single');
        }
        questions.push(current);
      }
      current = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ---- 检测章节标题 ----
      const chMatch = line.match(/^第[一二三四五六七八九十\d]+[章编节][\s\.、:：]*(.+)/);
      if (chMatch) {
        currentChapter = `第${chMatch[1]}章`;
        // 章节标题也作为知识点
        if (current) {
          if (!current.knowledgePoints) current.knowledgePoints = [];
          if (!current.knowledgePoints.includes(currentChapter)) {
            current.knowledgePoints.push(currentChapter);
          }
        }
        continue;
      }

      // ---- 检测题型标记行：【单选题】等 ----
      const typeTag = line.match(/[【\[（\(]\s*(单选题|多选题|判断题|填空题|简答题|论述题|计算题|问答题|名词解释|多项选择题|单选|多选|判断|填空|简答|论述|计算|问答)\s*[】\]）\)]/);
      if (typeTag) {
        flushQuestion();
        const typeStr = typeTag[1];
        current = { type: typeKeywords[typeStr] || 'single' as QuestionType, content: '', options: [], answer: '', explanation: '', knowledgePoints: [], difficulty: 1 };
        // 题型标记后面可能跟着题目内容
        const afterTag = line.slice(typeTag[0].length).trim();
        if (afterTag.length > 3 && current) {
          current.content = afterTag;
        }
        continue;
      }

      // ---- 检测题号开头 ----
      // 数字编号: "1." "1、" "1）" "(1)" "1 " "1)" "1." 等
      let qMatch = line.match(/^[\s]*(\d+)[\.、）\)\s]\s*(.+)/);
      // 中文数字: "一、" "二、" "三、"
      if (!qMatch) {
        const cnNumMap: Record<string, number> = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
        qMatch = line.match(/^[\s]*(一|二|三|四|五|六|七|八|九|十)[\.、）\)\s]\s*(.+)/);
        if (qMatch) qMatch[1] = String(cnNumMap[qMatch[1]] || 0);
      }
      // "第X题" 格式
      if (!qMatch) {
        qMatch = line.match(/^第\s*(\d+)\s*题[\.、:：\s]*(.+)/);
      }
      // "Question X" / "Q1" 格式
      if (!qMatch) {
        qMatch = line.match(/^(?:Question|Q)\s*(\d+)[\.、:：\s]+(.+)/i);
      }

      if (qMatch && parseInt(qMatch[1]) > 0) {
        flushQuestion();
        current = { type: 'single', content: qMatch[2], options: [], answer: '', explanation: '', knowledgePoints: [], difficulty: 1 };
        if (currentChapter) current.knowledgePoints = [currentChapter];
        // 题目内容中的题型标记
        for (const [kw, t] of Object.entries(typeKeywords)) {
          if (qMatch[2].includes(kw)) {
            current.type = t;
            current.content = qMatch[2].replace(new RegExp(`[【\\[（\\(]?\\s*${kw}\\s*[】\\]）\\)]?`, 'g'), '').trim();
            break;
          }
        }
        continue;
      }

      // ---- 无编号题目（空行分隔/长文本行开头）----
      if (!current && line.length > 8 && !line.match(/^[A-Ha-h][\.、）\)\s]/) && !line.match(/^(答案|正确答案|参考答案|解析|说明|知识点|章节|考点|来源|所属)/)) {
        // 可能是无编号的题目
        current = { type: 'single', content: line, options: [], answer: '', explanation: '', knowledgePoints: [], difficulty: 1 };
        if (currentChapter) current.knowledgePoints = [currentChapter];
        // 检查是否包含题型关键词
        for (const [kw, t] of Object.entries(typeKeywords)) {
          if (line.includes(kw)) {
            current.type = t;
            break;
          }
        }
        continue;
      }

      if (!current) continue;

      // ---- 检测选项 ----
      // 字母选项: "A." "A、" "A）" "A) " "(A)" 等
      const optMatch = line.match(/^[\s]*[\(（]?([A-Ha-h])[\)）\.、\s]\s*(.+)/);
      // 数字选项: "①" "②" 等
      const numOptMatch = line.match(/^[\s]*(①|②|③|④|⑤|⑥|⑦|⑧)[\.、\s]*(.+)/);
      if (optMatch || numOptMatch) {
        let rawText = optMatch ? optMatch[2] : numOptMatch![2];
        // 🔧 同一行多选项：多策略拆分
        let parts = rawText.split(/(?=[A-Ha-h][\.\、）\)])/).filter(s => s.trim());
        if (parts.length <= 1) parts = rawText.split(/(?=\s[A-Ha-h][\s\.\、）\)])/);
        if (parts.length <= 1) parts = rawText.split(/(?=[A-Ha-h][一-龥])/);
        if (parts.length <= 1) parts = rawText.split(/[；;]/);
        for (const p of parts) {
          const cleaned = p.trim().replace(/^[A-Ha-h][\.\、）\)\s]+/, '').trim();
          if (cleaned) current.options = [...(current.options || []), cleaned];
        }
        // 检测判断题型（选项含对/错/正确/错误）
        if (current.type === 'single' && current.options) {
          const allOpts = current.options.map(o => o.replace(/^[对错是]+\s*[.、]?\s*/, '').trim());
          if (allOpts.length <= 4 && allOpts.some(o => /^(对|错|正确|错误|是|否|√|×|✓|✗)$/.test(o))) {
            current.type = 'judge';
          }
        }
        continue;
      }

      // 选项在同一行用分号分隔（无字母前缀）
      const inlineOpts = line.match(/^[\s]*(.+[；;].+[；;].+)/);
      if (inlineOpts && current && (!current.options || current.options.length === 0) && line.length > 10 && line.length < 200) {
        const parts = line.split(/[；;]/).map(o => o.trim()).filter(o => o.length > 0);
        if (parts.length >= 3 && parts.length <= 8) {
          current.options = parts;
          continue;
        }
      }

      // 🔧 如果当前行有多个内联选项标记，拆分
      if (current && (!current.options || current.options.length === 0) && line.length > 8 && line.length < 500) {
        const markers = [...line.matchAll(/([A-Ha-h])[\.\、）\)]/g)];
        if (markers.length >= 2 && markers.length <= 10) {
          let parts = line.split(/(?=[A-Ha-h][\.\、）\)])/).filter(s => s.trim());
          if (parts.length <= 1) parts = line.split(/(?=\s[A-Ha-h][\s\.\、）\)])/);
          if (parts.length <= 1) parts = line.split(/[；;]/);
          if (parts.length >= 2) {
            current.options = parts.map(o => o.trim().replace(/^[A-Ha-h][\.\、）\)\s]+/, '').trim()).filter(Boolean);
            continue;
          }
        }
      }

      // ---- 检测答案 ----
      const ansPatterns = [
        /(?:答案|正确答案|参考答案)[：:\s=]*([A-H]+[对错是是否√×✓✗]*)/i,
        /【答案】[：:\s]*([A-H]+[对错是是否√×✓✗]*)/,
        /\[答案\][：:\s]*([A-H]+[对错是是否√×✓✗]*)/,
        /\*\*答案\*\*[：:\s]*([A-H]+[对错是是否√×✓✗]*)/,
        /答案[：:\s]*选?\s*([A-H]+)/i,
      ];
      for (const pat of ansPatterns) {
        const ansMatch = line.match(pat);
        if (ansMatch) {
          current.answer = ansMatch[1].toUpperCase();
          break;
        }
      }
      // 行内答案标记: "...（C）" 或 "...选C"
      if (!current.answer) {
        const inlineAns = line.match(/[（\(]\s*([A-H]+)\s*[）\)]/);
        if (inlineAns && line.length < 80) {
          current.answer = inlineAns[1].toUpperCase();
        }
      }

      // ---- 检测解析 ----
      const expPatterns = [
        /(?:解析|说明|【解析】|【说明】|\[解析\])\s*[：:\s]*(.+)/,
        /^>\s*解析[：:\s]*(.+)/,
        /\*\*解析\*\*[：:\s]*(.+)/,
      ];
      for (const pat of expPatterns) {
        const expMatch = line.match(pat);
        if (expMatch) {
          current.explanation = (current.explanation ? current.explanation + '\n' : '') + expMatch[1];
          break;
        }
      }

      // ---- 检测知识点 ----
      const kpPatterns = [
        /(?:知识点|章节|考点|【知识点】|【考点】|\[知识点\])\s*[：:\s]*(.+)/,
        /(?:所属章节|来源)[：:\s]*(.+)/,
      ];
      for (const pat of kpPatterns) {
        const kpMatch = line.match(pat);
        if (kpMatch) {
          const kps = kpMatch[1].split(/[,，、;；]/).map(k => k.trim()).filter(Boolean);
          current.knowledgePoints = [...(current.knowledgePoints || []), ...kps];
          break;
        }
      }

      // ---- 检测难度 ----
      const diffMatch = line.match(/(?:难度|困难度)[：:\s]*(\d+)/);
      if (diffMatch) {
        current.difficulty = Math.max(1, Math.min(5, parseInt(diffMatch[1])));
      }
    }

    flushQuestion();

    // 后处理：去重、验证
    return questions.filter(q => q.content && q.content.length > 2);
  };

  /** 自动判断题型 */
  function detectType(q: Partial<Question>): QuestionType {
    const content = q.content || '';
    const opts = q.options || [];
    const ans = (q.answer || '').toUpperCase().replace(/[,，、;；\s]+/g, '').replace(/[^A-H]/g, '');

    // 🔧 根据答案判断（最可靠）
    if (ans.length > 1) return 'multiple';
    // 判断题型：答案是对/错 或 只有两个对错选项
    if (/^[对错是是否√×✓✗TF正确错误]$/.test(ans)) return 'judge';
    if (ans === 'A' && opts.length === 2 && /对|错/.test(opts.join(''))) return 'judge';
    // 根据选项判断
    if (opts.length === 2 && opts.every(o => /^(对|错|正确|错误|是|否|√|×|✓|✗)$/.test(o.replace(/^[A-H][.、]?\s*/, '').trim()))) return 'judge';
    // 根据内容关键词判断
    if (/多选|多项/.test(content)) return 'multiple';
    if (/判断|对错/.test(content)) return 'judge';
    if (/填空|___|__|（\s*）|\(\s*\)/.test(content)) return 'fill';
    if (/简答|论述|问答|计算|名词解释/.test(content)) return 'essay';
    if (opts.length === 0 && !/[A-H][.、]/.test(content)) return 'essay';
    return 'single';
  }

  /** 清理答案格式 */
  function cleanAnswer(answer: string, type: string): string {
    // 🔧 先去除逗号、空格、分号等分隔符
    let a = answer.trim().toUpperCase().replace(/[,，、;；\s]+/g, '');
    // 判断题型：对/错/√/× → A/B
    if (type === 'judge') {
      if (/^(对|正确|是|√|✓|A|T|TRUE)$/i.test(a)) return 'A';
      if (/^(错|错误|否|×|✗|B|F|FALSE)$/i.test(a)) return 'B';
    }
    // 只保留字母
    a = a.replace(/[^A-H]/g, '');
    // 多选题：确保答案字母排序
    if (type === 'multiple' && a.length > 1) {
      return a.split('').sort().join('');
    }
    return a;
  }

  // ============ 核心：智能解析一切内容 ============
  const smartParse = async (rawContent: string, isImage: boolean = false): Promise<Partial<Question>[]> => {
    if (!rawContent.trim() && !isImage) throw new Error('请粘贴内容或上传文件');

    // 图片必须用 AI
    if (isImage) {
      const { ai: aiSettings } = await getSettings();
      if (!aiSettings.apiKey) throw new Error('图片识别需要 AI，请先配置 API Key');
      return await parseQuestionsFromImage(aiSettings, rawContent);
    }

    // 先尝试本地解析
    const local = localParse(rawContent);
    if (local.length > 0) return local;

    // 本地解析失败 → 尝试 AI
    const { ai: aiSettings } = await getSettings();
    if (!aiSettings.apiKey) throw new Error('未识别到题目格式，请使用 JSON 格式或配置 AI Key 进行智能识别');

    return await parseQuestions(aiSettings, rawContent);
  };

  // ============ 处理粘贴的文字 ============
  const handleTextParse = async () => {
    setError(null);
    setLoading(true);
    setParsedQuestions([]);
    setImported(false);
    try {
      const questions = await smartParse(textInput);
      setParsedQuestions(questions);
    } catch (e: any) {
      setError(e.message || '解析失败');
    } finally {
      setLoading(false);
    }
  };

  // ============ 处理文件上传（统一入口） ============
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setParsedQuestions([]);
    setImported(false);
    setFileName(file.name);

    try {
      let questions: Partial<Question>[] = [];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // 图片类 → 不支持本地解析，提示用AI
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
        throw new Error('图片识别需要 AI，请在下方「AI 智能识别」区域操作');
      }
      // Excel → 直接解析
      else if (['xlsx', 'xls'].includes(ext)) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const qs = parseExcel(wb);
        questions = qs;
        setTextInput(qs.length > 0 ? JSON.stringify(qs.slice(0, 3), null, 2) : '');
      }
      // Word → 提取文字 → 本地解析或AI
      else if (ext === 'docx') {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        setTextInput(result.value);
        questions = await smartParse(result.value);
      }
      // 其他格式 → 读文字 → 智能解析
      else {
        const text = await readFileAsText(file);
        setTextInput(text);
        questions = await smartParse(text);
      }

      if (questions.length === 0) throw new Error('未识别到题目');
      setParsedQuestions(questions);
    } catch (e: any) {
      setError(e.message || '解析失败');
    } finally {
      setLoading(false);
      // 重置 file input，允许重复上传同一个文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============ 导入到数据库 ============
  const handleImport = async () => {
    const now = new Date();
    const name = bankName.trim() || `题库 ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const bankId = await createBank(name);

    setImportProgress({ current: 0, total: parsedQuestions.length });
    try {
      await addQuestions(parsedQuestions, bankId, name, (current, total) => {
        setImportProgress({ current, total });
      });
      setImported(true);
      setParsedQuestions([]);
      setTextInput('');
      setFileName(null);
      setBankName('');
      setError(null);
      loadBanks();
    } catch (e: any) {
      setError('导入失败: ' + e.message);
    } finally {
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handleDeleteBank = async (bankId: string, bankName: string) => {
    if (!confirm(`确定删除「${bankName}」及其所有题目吗？`)) return;
    await deleteBank(bankId);
    loadBanks();
  };

  const handleRenameBank = async (bankId: string, oldName: string) => {
    const newName = prompt('输入新名称：', oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
      await renameBank(bankId, newName.trim());
      loadBanks();
    }
  };

  const getTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      single: '单选', multiple: '多选', judge: '判断', fill: '填空', essay: '简答',
    };
    return labels[type || ''] || type || '未知';
  };

  return (
    <div className="animate-fadeIn">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-float">📥</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>导入题库</h2>
        </div>
        <button
          onClick={() => { setShowBanks(!showBanks); loadBanks(); }}
          className="btn-apple-outline px-3 py-1.5 text-xs"
        >
          📚 我的题库 ({banks.length})
        </button>
      </div>

      {/* 修复已有题库 */}
      {repairMsg && (
        <div className={`text-xs p-2 rounded-xl mb-2 ${repairMsg.includes('✅') ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
          {repairMsg}
        </div>
      )}
      <button
        onClick={async () => {
          setRepairing(true);
          setRepairMsg(null);
          try {
            const n = await repairAllQuestions();
            setRepairMsg(`✅ 已修复 ${n} 道题目（选项拆分 + 题型修正）`);
          } catch (e: any) {
            setRepairMsg(`❌ 修复失败：${e.message}`);
          }
          setRepairing(false);
        }}
        disabled={repairing}
        className="w-full py-2 px-3 rounded-xl text-xs font-medium transition-colors mb-3"
        style={{ background: '#fefce8', border: '1px solid #fde047', color: '#a16207' }}
      >
        🔧 {repairing ? '修复中...' : '修复已有题库（拆分合并选项 + 修正题型）'}
      </button>

      {/* 一键导入预置题库 */}
      <PresetBankImport
        label="发电厂热力设备题库"
        desc="549 道选择题 · 含详细解析"
        bankName="发电厂热力设备"
        fileName="questions_parsed.json"
        onDone={() => { setImported(false); }}
      />
      <PresetBankImport
        label="高电压技术题库"
        desc="500 道题 · 单选176 多选80 判断228 简答16"
        bankName="高电压技术"
        fileName="questions_gaodianya.json"
        onDone={() => { setImported(false); }}
      />
      <PresetBankImport
        label="高电压技术（期末考试版）"
        desc="326 道题 · 单选106 多选54 判断156 简答10"
        bankName="高电压技术（期末）"
        fileName="questions_gaodianya_final.json"
        onDone={() => { setImported(false); }}
      />
      <PresetBankImport
        label="继电保护题库"
        desc="430 道题 · 单选169 多选65 判断156 简答40"
        bankName="继电保护题库"
        fileName="questions_jidianbaohu.json"
        onDone={() => { setImported(false); }}
      />
      <PresetBankImport
        label="发电厂变电站题库"
        desc="500 道题 · 单选252 多选68 判断127 填空53"
        bankName="发电厂变电站题库"
        fileName="questions_fadianchang.json"
        onDone={() => { setImported(false); }}
      />

      {/* 题库管理面板 */}
      {showBanks && (
        <div className="card-apple p-4 mb-5 animate-fadeIn">
          <h3 className="font-medium text-sm mb-3" style={{ color: '#387612' }}>📚 已导入的题库</h3>
          {banks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">还没有导入任何题库</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {banks.map((bank) => (
                <div key={bank.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#fafdf6', border: '1px solid #e8f5e0' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{bank.name}</p>
                    <p className="text-xs text-gray-400">
                      {bank.questionCount} 题 · {new Date(bank.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleRenameBank(bank.id, bank.name)}
                      className="text-xs px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteBank(bank.id, bank.name)}
                      className="text-xs px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      style={{ color: '#e03131' }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* ============ 📂 方式一：上传文件自动识别（无需AI）============ */}
      <div className="card-apple p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📂</span>
          <div>
            <p className="font-medium text-sm text-gray-700">上传文件自动识别</p>
            <p className="text-xs text-gray-400">无需 AI Key · 支持 JSON / Excel / Word / TXT</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.docx,.xls,.xlsx,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.bmp"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="w-full py-3 btn-apple disabled:opacity-40 text-sm"
        >
          {loading ? '🍏 识别中...' : '📁 选择文件'}
        </button>
        {fileName && <p className="text-xs text-gray-400 text-center mt-2">已选：{fileName}</p>}
      </div>

      {/* ============ 🤖 方式二：AI 识别 ============ */}
      <div className="card-apple p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🤖</span>
          <div>
            <p className="font-medium text-sm text-gray-700">AI 智能识别</p>
            <p className="text-xs text-gray-400">粘贴任意格式文字或上传图片 · 需配置 API Key</p>
          </div>
        </div>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="直接粘贴题目文字、表格数据、或复制的内容...&#10;&#10;AI 会自动识别题目、选项、答案和解析"
          className="input-apple w-full h-36 resize-none text-sm mb-3"
        />
        <button
          onClick={handleTextParse}
          disabled={loading || !textInput.trim()}
          className="w-full py-3 btn-apple-outline disabled:opacity-40 text-sm"
        >
          {loading ? '🍏 识别中...' : '🤖 AI 识别'}
        </button>
      </div>

      {/* 错误 */}
      {error && (
        <div className="mt-4 p-4 rounded-2xl animate-fadeIn" style={{ background: '#fff0f0', border: '2px solid #ffccc7', color: '#cf1322' }}>
          🍎 {error}
        </div>
      )}

      {/* 成功 */}
      {imported && (
        <div className="mt-4 p-4 rounded-2xl animate-bounceIn" style={{ background: '#f2fde4', border: '2px solid #c2f39e', color: '#387612' }}>
          🍏 导入成功！去刷题吧~
        </div>
      )}

      {/* 导入进度 */}
      {importProgress.total > 0 && (
        <div className="mt-4 animate-fadeIn">
          <div className="flex items-center justify-between text-sm mb-2">
            <span style={{ color: '#387612' }}>🍏 正在导入...</span>
            <span className="font-bold" style={{ color: '#387612' }}>{importProgress.current}/{importProgress.total}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden" style={{ border: '1px solid #e8f5e0' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #9ae869, #5cb818)',
              }} />
          </div>
        </div>
      )}

      {/* 题目预览 */}
      {parsedQuestions.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium" style={{ color: '#387612' }}>
              🍏 识别到 <span className="text-lg font-bold">{parsedQuestions.length}</span> 道题目
            </h3>
            <button onClick={handleImport} className="btn-apple px-5 py-2 text-sm">✅ 确认导入</button>
          </div>

          {/* 题库名称 */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">📛 题库名称（可选）</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="不填则自动生成名称"
              className="input-apple w-full text-sm"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {parsedQuestions.slice(0, 30).map((q, i) => (
              <div key={i} className="card-apple p-3 animate-fadeIn" style={{ animationDelay: `${i * 20}ms` }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="badge-apple text-xs">{getTypeLabel(q.type)}</span>
                  <span className="text-xs text-gray-400">难度 {'⭐'.repeat(q.difficulty || 1)}</span>
                  {[...new Set((q.knowledgePoints || []).map((kp: string) => {
                    const idx = kp.indexOf(' - ');
                    return idx > 0 ? kp.slice(0, idx) : kp;
                  }))].map((chapter: string) => (
                    <span key={chapter} className="badge-pink text-xs">{chapter}</span>
                  ))}
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">{q.content}</p>
                <p className="text-xs mt-1" style={{ color: '#4a9b10' }}>答案：{q.answer}</p>
              </div>
            ))}
            {parsedQuestions.length > 30 && (
              <p className="text-center text-sm text-gray-400 py-2">...还有 {parsedQuestions.length - 30} 题</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ CSV/TSV 解析 ============

function parseCSV(text: string, delimiter: string): Partial<Question>[] {
  const rows = text.trim().split('\n').map(r => {
    // 处理带引号的字段
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === delimiter && !inQuote) { result.push(current.trim()); current = ''; continue; }
      if (ch === '\t' && delimiter === '\t' && !inQuote) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  });

  if (rows.length < 2) return [];

  const questions: Partial<Question>[] = [];
  const typeMap: Record<string, string> = {
    '单选': 'single', '单选题': 'single', '多选': 'multiple', '多选题': 'multiple',
    '判断': 'judge', '判断题': 'judge', '填空': 'fill', '填空题': 'fill',
    '简答': 'essay', '简答题': 'essay', '论述': 'essay', '计算': 'essay',
  };

  // 自动检测列索引
  const header = rows[0];
  const colIdx: Record<string, number> = {};
  header.forEach((h, i) => {
    const lower = h.toLowerCase().replace(/[【】\[\]（）\(\)\s]/g, '');
    if (/题目|题干|试题|问题|内容|question/.test(lower)) colIdx.content = i;
    if (/题型|类型|type/.test(lower)) colIdx.type = i;
    if (/选项|choices|options/.test(lower)) colIdx.options = i;
    if (/答案|answer|solution/.test(lower)) colIdx.answer = i;
    if (/解析|说明|explanation/.test(lower)) colIdx.explanation = i;
    if (/知识点|章节|考点|knowledge/.test(lower)) colIdx.knowledge = i;
  });

  // 如果没匹配到表头，用默认顺序
  if (Object.keys(colIdx).length === 0) {
    colIdx.content = 0; colIdx.options = 1; colIdx.answer = 2;
    colIdx.explanation = 3; colIdx.knowledge = 4;
  }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const content = cells[colIdx.content ?? 0] || '';
    if (!content || content.length < 2) continue;
    if (/^(合计|总计|备注|说明)/.test(content)) continue;

    let qtype = 'single';
    const typeStr = cells[colIdx.type ?? -1] || '';
    for (const [kw, t] of Object.entries(typeMap)) {
      if (typeStr.includes(kw) || content.includes(kw)) { qtype = t; break; }
    }

    const optsRaw = cells[colIdx.options ?? 1] || '';
    let options: string[] = [];
    if (qtype === 'judge') {
      options = ['对', '错'];
    } else if (optsRaw) {
      options = optsRaw.split(/[；;]/).map(o => o.replace(/^[A-H][\.、）\)\s]*/, '').trim()).filter(Boolean);
    }

    let answer = cells[colIdx.answer ?? 2] || '';
    if (qtype === 'judge') {
      answer = /^[1是A对√✓T]/i.test(answer) ? 'A' : 'B';
    }

    questions.push({
      type: qtype as any, content, options, answer: answer.toUpperCase().replace(/[^A-H]/g, ''),
      explanation: cells[colIdx.explanation ?? 3] || '',
      knowledgePoints: (cells[colIdx.knowledge ?? 4] || '').split(/[,，、;；]/).filter(Boolean),
      difficulty: 1,
    });
  }

  return questions;
}

// ============ Excel 直接解析 ============

function parseExcel(wb: XLSX.WorkBook): Partial<Question>[] {
  const questions: Partial<Question>[] = [];
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  if (!rows || rows.length === 0) return questions;

  // === 列名关键词映射（支持更多变体）===
  const colPatterns: Record<string, string[]> = {
    content: ['题目', '题干', '试题', '问题', '内容', '考题', 'question', 'topic', 'content', 'title'],
    type: ['题型', '类型', '题目类型', '试题类型', 'type', 'category'],
    options: ['选项', '备选答案', '可选答案', 'choices', 'options', 'selections'],
    answer: ['答案', '正确答案', '参考答案', '标准答案', 'answer', 'solution', 'key'],
    explanation: ['解析', '说明', '解释', '解题思路', '讲解', 'analysis', 'explanation', '解析说明'],
    knowledgePoints: ['知识点', '章节', '考点', '所属章节', '来源', '分类', 'knowledge', 'chapter', 'topic'],
    difficulty: ['难度', '困难度', 'difficulty', 'level', '等级'],
  };

  // === 智能表头检测 ===
  let dataStart = 0;
  let colMap: Record<string, number> = {}; // 列名 → 列索引

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const cells = rows[r].map((c: any) => String(c).trim());

    // 检查是否匹配多个列关键词
    let matchCount = 0;
    const candidateMap: Record<string, number> = {};

    cells.forEach((cell, ci) => {
      if (!cell) return;
      const cellLower = cell.toLowerCase().replace(/[【】\[\]（）\(\)\s]/g, '');
      for (const [field, keywords] of Object.entries(colPatterns)) {
        for (const kw of keywords) {
          if (cellLower.includes(kw.toLowerCase())) {
            candidateMap[field] = ci;
            matchCount++;
            break;
          }
        }
      }
    });

    if (matchCount >= 2) {
      colMap = candidateMap;
      dataStart = r + 1;
      break;
    }
  }

  // 如果没检测到表头，尝试按默认列顺序
  if (Object.keys(colMap).length === 0) {
    colMap = { content: 0, options: 1, answer: 2, explanation: 3, knowledgePoints: 4 };
    // 从第1行开始（跳过可能的标题行）
    for (let r = 1; r < Math.min(5, rows.length); r++) {
      const firstCell = String(rows[r]?.[0] || '').trim();
      if (firstCell.length > 5) { dataStart = r; break; }
    }
  }

  const typeMap: Record<string, string> = {
    '单选': 'single', '单选题': 'single',
    '多选': 'multiple', '多选题': 'multiple', '多项选择题': 'multiple',
    '判断': 'judge', '判断题': 'judge', '对错题': 'judge',
    '填空': 'fill', '填空题': 'fill',
    '简答': 'essay', '简答题': 'essay', '论述': 'essay', '论述题': 'essay',
    '问答': 'essay', '问答题': 'essay', '计算': 'essay', '计算题': 'essay',
    '名词解释': 'essay',
  };

  // === 解析数据行 ===
  let lastValidRow: any[] | null = null;

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c: any) => !String(c).trim())) continue;

    const cells = row.map((c: any) => String(c).trim());

    // 处理合并单元格空值：向下填充
    for (let ci = 0; ci < Math.min(cells.length, (lastValidRow || []).length); ci++) {
      if (!cells[ci] && lastValidRow && lastValidRow[ci]) {
        cells[ci] = lastValidRow[ci];
      }
    }
    lastValidRow = [...cells];

    // 获取各字段
    const getCell = (field: string): string => {
      const idx = colMap[field];
      return idx !== undefined && idx < cells.length ? cells[idx] : '';
    };

    let content = getCell('content');
    // 如果内容列在第一列但没有匹配到表头，用第一列作为内容
    if (!content && colMap.content === undefined) {
      content = cells[0] || '';
    }
    if (!content || content.length < 2) continue;

    // 跳过表尾注释行
    if (/^(合计|总计|备注|说明|注：|共\d+题|total)/i.test(content)) continue;

    // 判断题型
    const typeCell = getCell('type');
    let qtype = 'single';
    if (typeCell) {
      for (const [kw, t] of Object.entries(typeMap)) {
        if (typeCell.includes(kw)) { qtype = t; break; }
      }
    }
    // 从题目内容判断题型
    if (qtype === 'single') {
      for (const [kw, t] of Object.entries(typeMap)) {
        if (content.includes(kw)) { qtype = t; break; }
      }
    }

    // 解析选项
    const optionsRaw = getCell('options');
    let options: string[] = [];
    if (qtype === 'judge') {
      options = ['对', '错'];
    } else if (qtype === 'single' || qtype === 'multiple') {
      if (optionsRaw) {
        // 🔧 多策略逐层拆分
        let rawParts: string[] = [];
        if (/[A-Ha-h][\.\、）\)]/.test(optionsRaw)) {
          rawParts = optionsRaw.split(/(?=[A-Ha-h][\.\、）\)])/).map(o => o.trim()).filter(Boolean);
        } else {
          rawParts = [optionsRaw];
        }
        for (const raw of rawParts) {
          let inner = raw.split(/(?=[A-Ha-h][\.\、）\)])/).filter(s => s.trim());
          if (inner.length <= 1) inner = raw.split(/(?=\s[A-Ha-h][\s\.\、）\)])/);
          if (inner.length <= 1) inner = raw.split(/(?=[A-Ha-h][一-龥])/);
          if (inner.length <= 1) inner = raw.split(/[；;]/);
          for (const p of inner) {
            const cleaned = p.trim().replace(/^[A-Ha-h][\.\、）\)\s]+/, '').trim();
            if (cleaned) options.push(cleaned);
          }
        }
      }
      // 如果没选项，尝试从后续列收集
      if (options.length === 0 && !optionsRaw) {
        const extraOpts: string[] = [];
        for (let ci = 2; ci < cells.length && ci < 10; ci++) {
          const val = cells[ci];
          if (val && val.length > 0 && val.length < 300 && !/^(答案|解析|知识点|题型)/.test(val)) {
            extraOpts.push(val.replace(/^[A-H][\.、）\)\s]+/, ''));
          }
        }
        if (extraOpts.length >= 2 && extraOpts.length <= 8) {
          options = extraOpts;
        }
      }
    }

    // 🔧 如果选项看起来是判断题（对/错），自动修正类型
    if (options.length === 2 && options.every(o => /^(对|错|正确|错误|是|否|√|×|✓|✗)$/.test(o.replace(/^[A-H][.、]?\s*/, '').trim()))) {
      qtype = 'judge';
    }

    // 答案
    let answer = getCell('answer');
    const answerClean = answer.toUpperCase().replace(/[,，、\s]+/g, '');
    if (qtype === 'judge') {
      if (/^[1是A对√✓Ttrue]/i.test(answerClean) || answer === '对') answer = 'A';
      else if (/^[0否B错×✗Ffalse]/i.test(answerClean) || answer === '错') answer = 'B';
      else answer = 'A';
    } else {
      answer = answerClean.replace(/[^A-H]/g, '');
    }

    // 🔧 根据答案修正题型：多字母答案 → 多选题
    if (answer.length > 1 && qtype === 'single') {
      qtype = 'multiple';
    }

    // 解析和知识点
    const explanation = getCell('explanation');
    const kpRaw = getCell('knowledgePoints');
    const knowledgePoints = kpRaw ? kpRaw.split(/[,，、;；]/).map(k => k.trim()).filter(Boolean) : [];
    const diffRaw = getCell('difficulty');
    const difficulty = diffRaw ? Math.max(1, Math.min(5, parseInt(diffRaw) || 1)) : 1;

    questions.push({
      type: qtype as any, content, options, answer,
      explanation, knowledgePoints, difficulty,
    });
  }

  return questions;
}

// ============ 工具 ============

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// ============ 📋 一键导入预置题库 ============

function PresetBankImport({ label, desc, bankName, fileName, onDone }: {
  label: string;
  desc: string;
  bankName: string;
  fileName: string;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = import.meta.env.BASE_URL + fileName + '?t=' + Date.now();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const questions = await res.json();
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('题库数据为空');
      }
      const { createBank, addQuestions } = await import('../store/db');
      const bankId = await createBank(bankName);
      await addQuestions(questions as any, bankId, bankName);
      setDone(true);
      onDone();
    } catch (e: any) {
      setError(e.message || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="card-apple p-4 mb-5 text-center animate-bounceIn">
        <p className="text-2xl mb-1">🍏</p>
        <p className="font-bold text-apple-600">{bankName} · 已导入！</p>
        <p className="text-sm text-gray-400 mt-1">去「刷题」标签开始练习吧</p>
      </div>
    );
  }

  return (
    <div className="card-apple p-4 mb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-gray-700 text-sm">📋 {label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
        </div>
        <button
          onClick={handleQuickImport}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}
        >
          {loading ? '⌛ 导入中...' : '一键导入'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">🍎 {error}</p>}
    </div>
  );
}
