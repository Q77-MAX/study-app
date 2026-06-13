import { useState, useCallback, useEffect } from 'react';
import type { Question } from '../types';
import { getAllQuestions, updateQuestionMastery, addWrongRecord, saveSession, getSettings } from '../store/db';
import Timer from './Timer';
import DrawingPad from './DrawingPad';

type ExamState = 'config' | 'exam' | 'result';
type ExamModeType = 'type-practice' | 'simulation';

const TYPE_LABELS: Record<string, string> = {
  single: '单选题', multiple: '多选题', judge: '判断题', fill: '填空题', essay: '简答题',
};
const TYPE_ORDER = ['single', 'multiple', 'judge', 'fill', 'essay'];
const TYPE_ICONS: Record<string, string> = { single: '1️⃣', multiple: '☑️', judge: '⚖️', fill: '✍️', essay: '📝' };
// 模拟考试基准比例（单选40 多选20 判断28 简答1 = 89题）
const BASE_COUNTS: Record<string, number> = { single: 40, multiple: 20, judge: 28, fill: 0, essay: 1 };
const BASE_TOTAL = 89;

export default function ExamMode() {
  const [screen, setScreen] = useState<ExamState>('config');
  const [examMode, setExamMode] = useState<ExamModeType>('type-practice');
  const [singleType, setSingleType] = useState('single');
  const [questionCount, setQuestionCount] = useState(89);
  const [timeMinutes, setTimeMinutes] = useState(60);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(['single', 'multiple', 'judge', 'essay']));
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fillAnswers, setFillAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    score: number; total: number;
    details: { question: Question; userAnswer: string; isCorrect: boolean }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualCounts, setManualCounts] = useState(false);

  useEffect(() => {
    getSettings().then((s) => { setQuestionCount(s.examQuestionCount); setTimeMinutes(s.examTimeMinutes); });
    loadAvailableCounts();
  }, []);

  const loadAvailableCounts = async () => {
    const all = await getAllQuestions();
    const counts: Record<string, number> = { single: 0, multiple: 0, judge: 0, fill: 0, essay: 0 };
    all.forEach(q => { if (counts[q.type] !== undefined) counts[q.type]++; });
    setAvailableCounts(counts);
    // 初始化：按可用题目自动计算总题数
    const maxTotal = Math.min(BASE_TOTAL,
      (counts.single || 0) + (counts.multiple || 0) + (counts.judge || 0) + (counts.essay || 0));
    const total = maxTotal > 0 ? maxTotal : BASE_TOTAL;
    setQuestionCount(total);
    distributeTypes(new Set(['single', 'multiple', 'judge', 'essay']), total, counts);
  };

  // 按 40:20:28:1 比例分配各题型数量
  const distributeTypes = (types: Set<string>, total: number, available?: Record<string, number>) => {
    const avail = available || availableCounts;
    const counts: Record<string, number> = { single: 0, multiple: 0, judge: 0, fill: 0, essay: 0 };
    const activeTypes = TYPE_ORDER.filter(t => types.has(t) && (avail[t] || 0) > 0);
    if (activeTypes.length === 0) { setTypeCounts(counts); return; }

    // 计算本次基准总量（基于选中的题型）
    const baseOfSelected = activeTypes.reduce((s, t) => s + (BASE_COUNTS[t] || 0), 0);
    if (baseOfSelected === 0) { setTypeCounts(counts); return; }

    // 按基准比例缩放
    const scale = total / baseOfSelected;
    let allocated = 0;
    const ordered = [...activeTypes].sort((a, b) => activeTypes.indexOf(b) - activeTypes.indexOf(a));

    activeTypes.forEach((type) => {
      const want = Math.round((BASE_COUNTS[type] || 0) * scale);
      counts[type] = Math.min(want, avail[type] || 0);
      allocated += counts[type];
    });

    // 微调：如果分配总数 != total，调整最大的题型
    let diff = total - allocated;
    for (const type of ordered) {
      if (diff === 0) break;
      if (diff > 0) {
        const add = Math.min(diff, (avail[type] || 0) - (counts[type] || 0));
        counts[type] = (counts[type] || 0) + add;
        diff -= add;
      } else {
        const sub = Math.min(-diff, counts[type] || 0);
        counts[type] = (counts[type] || 0) - sub;
        diff += sub;
      }
    }

    setTypeCounts(counts);
    setManualCounts(false);

    // 同步总题数 = 实际分配之和
    const actualTotal = Object.values(counts).reduce((a, b) => a + b, 0);
    if (actualTotal !== questionCount && actualTotal > 0) {
      setQuestionCount(actualTotal);
    }
  };

  const toggleSimType = (type: string) => {
    const next = new Set(enabledTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setEnabledTypes(next);
    if (!manualCounts) distributeTypes(next, questionCount);
  };

  const startExam = async () => {
    setLoading(true);
    const all = await getAllQuestions();
    if (all.length === 0) { alert('题库为空，请先导入题目'); setLoading(false); return; }

    const byType: Record<string, Question[]> = {};
    all.forEach(q => {
      if (!byType[q.type]) byType[q.type] = [];
      byType[q.type].push(q);
    });

    let selected: Question[] = [];

    if (examMode === 'type-practice') {
      // 专项练习：只取单一题型
      const pool = (byType[singleType] || []).sort(() => Math.random() - 0.5);
      const count = Math.min(questionCount, pool.length);
      selected = pool.slice(0, count);
    } else {
      // 模拟考试：按分配取各题型，分组排列
      for (const type of TYPE_ORDER) {
        const pool = (byType[type] || []).sort(() => Math.random() - 0.5);
        const count = Math.min(typeCounts[type] || 0, pool.length);
        selected.push(...pool.slice(0, count));
      }
    }

    if (selected.length === 0) { alert('没有符合条件的题目'); setLoading(false); return; }

    setQuestions(selected);
    setCurrentIndex(0); setAnswers({}); setFillAnswers({}); setResult(null);
    setScreen('exam'); setLoading(false);
  };

  const handleTimeUp = useCallback(async () => { await submitExam(); }, [answers, fillAnswers]);

  const submitExam = async () => {
    const details: { question: Question; userAnswer: string; isCorrect: boolean }[] = [];
    let correctCount = 0;
    for (const q of questions) {
      const userAnswer = answers[q.id] || fillAnswers[q.id] || '(未作答)';
      const isCorrect = userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      await updateQuestionMastery(q.id, isCorrect);
      if (!isCorrect) await addWrongRecord(q.id, userAnswer);
      if (isCorrect) correctCount++;
      details.push({ question: q, userAnswer, isCorrect });
    }
    const score = Math.round((correctCount / questions.length) * 100);
    await saveSession({
      mode: 'exam', questionIds: questions.map((q) => q.id),
      answers: Object.fromEntries(questions.map((q) => [q.id, answers[q.id] || fillAnswers[q.id] || ''])),
      score, totalQuestions: questions.length,
      startTime: Date.now() - timeMinutes * 60 * 1000, endTime: Date.now(),
    });
    setResult({ score, total: questions.length, details });
    setScreen('result');
  };

  const currentQuestion = questions[currentIndex];
  const totalEnabled = examMode === 'type-practice'
    ? Math.min(questionCount, availableCounts[singleType] || 0)
    : Object.values(typeCounts).reduce((a, b) => a + b, 0);

  // ============ 配置界面 ============
  if (screen === 'config') {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl animate-float">🏆</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>考试</h2>
        </div>

        {/* 模式选择：专项练习 vs 模拟考试 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setExamMode('type-practice')}
            className="p-4 rounded-2xl text-center transition-all duration-200"
            style={{
              background: examMode === 'type-practice' ? '#f2fde4' : 'white',
              border: examMode === 'type-practice' ? '2px solid #9ae869' : '2px solid #e5e5e5',
            }}
          >
            <p className="text-2xl mb-1">🎯</p>
            <p className="font-bold text-sm" style={{ color: examMode === 'type-practice' ? '#387612' : '#999' }}>专项练习</p>
            <p className="text-xs text-gray-400 mt-0.5">单题型刷题</p>
          </button>
          <button
            onClick={() => setExamMode('simulation')}
            className="p-4 rounded-2xl text-center transition-all duration-200"
            style={{
              background: examMode === 'simulation' ? '#f2fde4' : 'white',
              border: examMode === 'simulation' ? '2px solid #9ae869' : '2px solid #e5e5e5',
            }}
          >
            <p className="text-2xl mb-1">🏅</p>
            <p className="font-bold text-sm" style={{ color: examMode === 'simulation' ? '#387612' : '#999' }}>模拟考试</p>
            <p className="text-xs text-gray-400 mt-0.5">多题型综合</p>
          </button>
        </div>

        {/* ===== 专项练习配置 ===== */}
        {examMode === 'type-practice' && (
          <div className="card-apple p-5 space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">📋 选择题型</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_ORDER.map(type => (
                  <button
                    key={type}
                    onClick={() => setSingleType(type)}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                      background: singleType === type ? '#f2fde4' : '#f5f5f5',
                      border: singleType === type ? '2px solid #9ae869' : '2px solid #e5e5e5',
                      color: singleType === type ? '#387612' : '#999',
                    }}
                  >
                    {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                    <span className="ml-1 text-xs opacity-60">({availableCounts[type] || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                📝 题目数量：<span className="text-apple-600 font-bold text-lg">{Math.min(questionCount, availableCounts[singleType] || 0)} 题</span>
              </label>
              <input type="range" min="5" max={Math.min(100, availableCounts[singleType] || 100)} step="5"
                value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-apple-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                ⏱ 时间：<span className="text-apple-600 font-bold text-lg">{timeMinutes} 分钟</span>
              </label>
              <input type="range" min="10" max="180" step="5" value={timeMinutes}
                onChange={(e) => setTimeMinutes(Number(e.target.value))}
                className="w-full accent-apple-500" />
            </div>

            <button onClick={startExam} disabled={loading}
              className="w-full py-4 btn-apple text-lg font-bold disabled:opacity-50">
              {loading ? '🍏 准备中...' : `🎯 开始${TYPE_LABELS[singleType]}练习 (${totalEnabled}题)`}
            </button>
          </div>
        )}

        {/* ===== 模拟考试配置 ===== */}
        {examMode === 'simulation' && (
          <div className="card-apple p-5 space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-3">📋 选择考试题型</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_ORDER.map(type => (
                  <button key={type} onClick={() => toggleSimType(type)}
                    className="px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                      background: enabledTypes.has(type) ? '#f2fde4' : '#f5f5f5',
                      border: enabledTypes.has(type) ? '2px solid #9ae869' : '2px solid #e5e5e5',
                      color: enabledTypes.has(type) ? '#387612' : '#999',
                    }}
                  >
                    {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                    <span className="ml-1 text-xs opacity-60">({availableCounts[type] || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                📝 题目总量：<span className="text-apple-600 font-bold text-lg">{totalEnabled} 题</span>
              </label>
              <input type="range" min="5"
                max={TYPE_ORDER.reduce((s, t) => s + (enabledTypes.has(t) ? (availableCounts[t] || 0) : 0), 0)}
                step="1" value={totalEnabled}
                onChange={(e) => { const v = Number(e.target.value); setQuestionCount(v); distributeTypes(enabledTypes, v); }}
                className="w-full accent-apple-500" />
            </div>

            <div className="p-4 rounded-2xl" style={{ background: '#fafdf6', border: '2px solid #e8f5e0' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">📊 题型分配（单选{Math.round(BASE_COUNTS.single/BASE_TOTAL*totalEnabled)} 多选{Math.round(BASE_COUNTS.multiple/BASE_TOTAL*totalEnabled)} 判断{Math.round(BASE_COUNTS.judge/BASE_TOTAL*totalEnabled)}）</p>
                <button onClick={() => { distributeTypes(enabledTypes, totalEnabled || questionCount); setManualCounts(false); }}
                  className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-apple-600">
                  🔄 重置比例
                </button>
              </div>
              <div className="space-y-1.5">
                {TYPE_ORDER.filter(t => enabledTypes.has(t)).map(type => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 w-14">{TYPE_LABELS[type]}</span>
                    <input type="range" min="0" max={availableCounts[type] || 0}
                      value={typeCounts[type] || 0}
                      onChange={(e) => {
                        setManualCounts(true);
                        const newCounts = { ...typeCounts, [type]: Number(e.target.value) };
                        setTypeCounts(newCounts);
                        setQuestionCount(Object.values(newCounts).reduce((a, b) => a + b, 0));
                      }}
                      className="flex-1 mx-2 accent-apple-500" />
                    <span className="text-apple-600 font-bold w-14 text-right">{typeCounts[type] || 0}<span className="text-xs text-gray-400">/{availableCounts[type] || 0}</span></span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                合计 <span className="font-bold text-apple-600">{totalEnabled} 题</span>
                <span className="ml-2">（{Math.round(BASE_COUNTS.single/BASE_TOTAL*100)}% : {Math.round(BASE_COUNTS.multiple/BASE_TOTAL*100)}% : {Math.round(BASE_COUNTS.judge/BASE_TOTAL*100)}% : {Math.round(BASE_COUNTS.essay/BASE_TOTAL*100)}%）</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                ⏱ 考试时间：<span className="text-apple-600 font-bold text-lg">{timeMinutes} 分钟</span>
              </label>
              <input type="range" min="10" max="180" step="5" value={timeMinutes}
                onChange={(e) => setTimeMinutes(Number(e.target.value))}
                className="w-full accent-apple-500" />
            </div>

            <div className="p-4 rounded-2xl text-sm" style={{ background: '#fff8e1', border: '2px solid #ffe082', color: '#e67700' }}>
              ⚠️ 题目按题型分组排列（单选→多选→判断→填空→简答）。计时到自动交卷。
            </div>

            <button onClick={startExam} disabled={loading || totalEnabled === 0}
              className="w-full py-4 btn-apple text-lg font-bold disabled:opacity-50">
              {loading ? '🍏 准备中...' : `🏅 开始模拟考试 (${totalEnabled}题)`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============ 考试中（与之前相同） ============
  if (screen === 'exam' && currentQuestion) {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{examMode === 'type-practice' ? '🎯' : '🏆'}</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>
            {examMode === 'type-practice' ? TYPE_LABELS[singleType] + '练习' : '模拟考试'}
          </h2>
          <span className="badge-apple text-xs ml-auto">{TYPE_LABELS[currentQuestion.type]}</span>
        </div>
        <div className="space-y-4">
          <div className="card-apple p-3">
            <Timer totalSeconds={timeMinutes * 60} onTimeUp={handleTimeUp} isRunning={true} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">第 {currentIndex + 1}/{questions.length} 题</span>
            <span className="text-gray-400">已答：{Object.keys(answers).length + Object.keys(fillAnswers).length} 题</span>
          </div>

          {examMode === 'simulation' && (currentIndex === 0 || questions[currentIndex].type !== questions[currentIndex - 1]?.type) && (
            <div className="text-center py-1"><span className="badge-apple text-xs animate-fadeIn">— {TYPE_LABELS[currentQuestion.type]} —</span></div>
          )}

          <div className="card-apple overflow-hidden">
            <div className="px-5 py-5">
              <p className="text-gray-800 leading-relaxed text-[15px]">{currentQuestion.content}</p>
            </div>
            {(currentQuestion.type === 'single' || currentQuestion.type === 'multiple' || currentQuestion.type === 'judge') && (
              <div className="px-5 pb-5 space-y-2.5">
                {currentQuestion.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const selected = answers[currentQuestion.id]?.includes(letter);
                  return (
                    <button key={i} onClick={() => {
                      if (currentQuestion.type === 'multiple') {
                        const prev = answers[currentQuestion.id] || '';
                        setAnswers({ ...answers, [currentQuestion.id]: prev.includes(letter) ? prev.replace(letter, '') : prev + letter });
                      } else { setAnswers({ ...answers, [currentQuestion.id]: letter }); }
                    }}
                    className="w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200"
                    style={{ border: `2px solid ${selected ? '#7ad93f' : '#e8f5e0'}`, background: selected ? '#f2fde4' : 'white' }}>
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mr-3"
                        style={{ background: selected ? '#7ad93f' : '#f5f5f5', color: selected ? 'white' : '#999' }}>{letter}</span>
                      {opt.replace(/^[A-D][.、\s]+/, '')}
                    </button>
                  );
                })}
              </div>
            )}
            {(currentQuestion.type === 'fill' || currentQuestion.type === 'essay') && (
              <div className="px-5 pb-5">
                <textarea value={fillAnswers[currentQuestion.id] || ''}
                  onChange={(e) => setFillAnswers({ ...fillAnswers, [currentQuestion.id]: e.target.value })}
                  placeholder="请输入答案..." className="input-apple w-full resize-none" rows={3} />
              </div>
            )}
          </div>

          <div className="card-apple p-4">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {questions.map((q, i) => {
                const answered = answers[q.id] || fillAnswers[q.id];
                return (
                  <button key={q.id} onClick={() => setCurrentIndex(i)}
                    className="w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{
                      background: i === currentIndex ? '#7ad93f' : answered ? '#f2fde4' : '#f5f5f5',
                      color: i === currentIndex ? 'white' : answered ? '#387612' : '#999',
                      border: i === currentIndex ? '2px solid #5cb818' : answered ? '2px solid #9ae869' : '2px solid #e5e5e5',
                    }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <button onClick={submitExam}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-base transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #ff8787, #e03131)', boxShadow: '0 4px 14px rgba(224,49,49,0.3)' }}>
              📝 交卷
            </button>
          </div>
          <DrawingPad questionId={currentQuestion.id} />
        </div>
      </div>
    );
  }

  // ============ 结果（与之前相同） ============
  if (screen === 'result' && result) {
    const grouped = TYPE_ORDER
      .map(type => ({ type, label: TYPE_LABELS[type], details: result.details.filter(d => d.question.type === type) }))
      .filter(g => g.details.length > 0);

    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">{examMode === 'type-practice' ? '🎯' : '🏆'}</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>
            {examMode === 'type-practice' ? TYPE_LABELS[singleType] + '练习结果' : '考试结果'}
          </h2>
        </div>

        <div className="card-apple p-8 text-center mb-4">
          <div className="text-6xl mb-4 animate-bounceIn">
            {result.score >= 90 ? '🏅' : result.score >= 70 ? '🍏' : result.score >= 60 ? '😅' : '💪'}
          </div>
          <p className="text-4xl font-bold mb-2" style={{ color: result.score >= 60 ? '#387612' : '#e03131' }}>{result.score} 分</p>
          <p className="text-gray-400">正确 {result.details.filter((d) => d.isCorrect).length}/{result.total} 题</p>
        </div>

        {grouped.length > 1 && (
          <div className="card-apple p-4 mb-5">
            <p className="text-sm font-medium text-gray-600 mb-3">📊 各题型正确率</p>
            <div className="space-y-2">
              {grouped.map(g => {
                const correct = g.details.filter(d => d.isCorrect).length;
                const pct = Math.round((correct / g.details.length) * 100);
                return (
                  <div key={g.type} className="flex items-center gap-2 text-sm">
                    <span className="w-16 text-gray-500">{g.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct >= 80 ? '#9ae869' : pct >= 60 ? '#ffe082' : '#ff8787' }} />
                    </div>
                    <span className="w-16 text-right text-xs text-gray-400">{correct}/{g.details.length} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {grouped.map(g => (
          <div key={g.type} className="mb-4">
            <h3 className="font-medium text-sm mb-2" style={{ color: '#387612' }}>{g.label} ({g.details.length}题)</h3>
            <div className="space-y-3">
              {g.details.map((detail, i) => (
                <div key={detail.question.id} className="card-apple p-4"
                  style={{ borderLeft: `4px solid ${detail.isCorrect ? '#9ae869' : '#ff8787'}` }}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{detail.isCorrect ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{i + 1}. {detail.question.content}</p>
                      <div className="flex gap-4 mt-2 text-xs">
                        {!detail.isCorrect && <span className="text-red-400">你的：{detail.userAnswer}</span>}
                        <span style={{ color: '#4a9b10' }}>正确：{detail.question.answer}</span>
                      </div>
                      {detail.question.explanation && (
                        <p className="text-xs text-gray-500 mt-1">💡 {detail.question.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button onClick={() => setScreen('config')}
          className="w-full mt-5 py-3.5 btn-apple text-base">
          🍏 再来一次
        </button>
      </div>
    );
  }

  return null;
}
