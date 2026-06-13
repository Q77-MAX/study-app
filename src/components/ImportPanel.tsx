import { useState, useRef, useEffect } from 'react';
import { getSettings, addQuestions, createBank, getAllBanks, deleteBank, renameBank } from '../store/db';
import { parseQuestions, parseQuestionsFromImage } from '../services/ai';
import type { Question, QuestionBank } from '../types';
import mammoth from 'mammoth';

export default function ImportPanel() {
  const [textInput, setTextInput] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [showBanks, setShowBanks] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadBanks(); }, []);
  const loadBanks = async () => setBanks(await getAllBanks());

  // ============ 核心：智能解析一切内容 ============
  const smartParse = async (rawContent: string, isImage: boolean = false): Promise<Partial<Question>[]> => {
    if (!rawContent.trim() && !isImage) throw new Error('请粘贴内容或上传文件');

    // 先尝试：如果是 JSON 格式的题库，直接解析（不需要 API Key）
    if (!isImage) {
      try {
        const parsed = JSON.parse(rawContent.trim());
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].content) {
          return parsed; // 标准题库 JSON，直接返回
        }
      } catch {}
    }

    // 不是 JSON，需要 AI → 检查 API Key
    const { ai: aiSettings } = await getSettings();
    if (!aiSettings.apiKey) throw new Error('非JSON格式需要AI识别，请先配置 API Key（点右上角 ⚙️ 设置）');

    let questions: Partial<Question>[];
    if (isImage) {
      questions = await parseQuestionsFromImage(aiSettings, rawContent);
    } else {
      questions = await parseQuestions(aiSettings, rawContent);
    }

    if (!questions || questions.length === 0) {
      throw new Error('AI 未识别到题目，请确认内容包含题目信息');
    }
    return questions;
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

      // 图片类 → 转 base64 → AI 视觉识别
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
        const base64 = await readFileAsDataURL(file);
        questions = await smartParse(base64, true);
      }
      // Word 文档 → 提取文字 → AI 识别
      else if (ext === 'docx') {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        questions = await smartParse(result.value);
      }
      // 其他所有格式（txt, csv, xls, xlsx, json, md 等）→ 读文字 → 智能解析
      else {
        const text = await readFileAsText(file);
        setTextInput(text); // 同步显示到文本框
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


      {/* ============ 统一输入区：粘贴 or 上传 ============ */}
      <div className="card-apple p-5 space-y-4">
        <p className="text-sm text-gray-500">
          🤖 <span className="font-medium">粘贴内容或上传文件</span>，AI 会自动识别题目、答案和解析
        </p>

        {/* 文本框 */}
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={
            '支持任意格式：\n\n' +
            '📝 直接粘贴题目文字\n' +
            '📊 从 Excel/WPS 复制粘贴表格数据\n' +
            '📄 上传 Word / Excel / CSV / JSON 文件\n' +
            '📷 上传题目截图\n\n' +
            'AI 会自动判断哪些是题目、选项、答案和解析，无需关心原始格式。'
          }
          className="input-apple w-full h-44 resize-none text-sm"
        />

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={handleTextParse}
            disabled={loading || !textInput.trim()}
            className="flex-1 py-3 btn-apple disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading ? '🍏 识别中...' : '🤖 AI 识别题目'}
          </button>

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
            className="flex-1 py-3 btn-apple-outline disabled:opacity-40 text-sm"
          >
            📂 上传文件
          </button>
        </div>

        {fileName && (
          <p className="text-xs text-gray-400 text-center">
            已选择：{fileName}
          </p>
        )}

        <p className="text-xs text-gray-400 text-center">
          支持 .txt .md .docx .xls .xlsx .csv .json .png .jpg 等格式
        </p>
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

// ============ 工具 ============

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
      const url = import.meta.env.BASE_URL + fileName;
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
