import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllBanks, getQuestionsByBank, updateQuestionMastery, addWrongRecord } from '../store/db';
import type { Question, QuestionBank } from '../types';
import QuestionCard, { type AnswerRecord } from './QuestionCard';

type ViewState = 'banks' | 'detail' | 'practice' | 'complete';

export default function PracticePanel() {
  const [view, setView] = useState<ViewState>('banks');
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState(20);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [studyMode, setStudyMode] = useState<'practice' | 'memorize'>('practice');
  const [showJump, setShowJump] = useState(false);
  const [jumpTo, setJumpTo] = useState('');
  const answerHistoryRef = useRef<Record<string, AnswerRecord>>({});

  const loadBanks = async () => {
    setLoading(true);
    setBanks(await getAllBanks());
    setLoading(false);
  };

  useEffect(() => { loadBanks(); }, []);

  const selectBank = async (bank: QuestionBank) => {
    setLoading(true);
    setSelectedBank(bank);
    const qs = await getQuestionsByBank(bank.id);
    setAllQuestions(qs);
    setView('detail');
    setLoading(false);
  };

  const typeKeyMap: Record<string, string> = {
    '单选题': 'single', '多选题': 'multiple', '判断题': 'judge', '填空题': 'fill', '简答题': 'essay',
  };

  const startByType = (label: string) => {
    const type = typeKeyMap[label] || 'single';
    const filtered = allQuestions
      .filter(q => q.type === type)
      .sort((a, b) => a.mastery - b.mastery || a.lastPracticed - b.lastPracticed);
    setQuestions(filtered);
    setCurrentIndex(0);
    setView('practice');
  };

  const startAll = () => {
    const sorted = [...allQuestions]
      .sort((a, b) => a.mastery - b.mastery || a.lastPracticed - b.lastPracticed);
    setQuestions(sorted);
    setCurrentIndex(0);
    setView('practice');
  };

  const backToDetail = () => { setView('detail'); };
  const backToBanks = () => {
    setView('banks');
    setSelectedBank(null);
    setAllQuestions([]);
    loadBanks();
  };

  const currentQuestion = questions[currentIndex] || null;
  const isLastQuestion = currentIndex >= questions.length - 1;

  const clearRecord = useCallback(() => {
    if (currentQuestion) {
      delete answerHistoryRef.current[currentQuestion.id];
    }
  }, [currentQuestion]);

  const answerQuestion = useCallback(async (userAnswer: string) => {
    if (!currentQuestion) return { isCorrect: false };
    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();
    await updateQuestionMastery(currentQuestion.id, isCorrect);
    if (!isCorrect) await addWrongRecord(currentQuestion.id, userAnswer);
    // 保存到历史记录
    answerHistoryRef.current[currentQuestion.id] = { userAnswer, isCorrect };
    return { isCorrect };
  }, [currentQuestion]);

  const prevQuestion = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  const nextQuestion = useCallback((skip?: boolean) => {
    if (skip) {
      // 跳过未作答：记录为空答案
      if (currentQuestion && !answerHistoryRef.current[currentQuestion.id]) {
        answerHistoryRef.current[currentQuestion.id] = { userAnswer: '', isCorrect: false };
      }
    }
    if (!isLastQuestion) {
      setCurrentIndex(i => i + 1);
    } else {
      setView('complete');
    }
  }, [isLastQuestion, currentQuestion]);

  const doJump = () => {
    const n = parseInt(jumpTo);
    if (n >= 1 && n <= questions.length) {
      setCurrentIndex(n - 1);
    }
    setShowJump(false);
    setJumpTo('');
  };

  const typeStats = () => {
    const stats: Record<string, { label: string; emoji: string; count: number }> = {
      single: { label: '单选题', emoji: '1️⃣', count: 0 },
      multiple: { label: '多选题', emoji: '🔢', count: 0 },
      judge: { label: '判断题', emoji: '⚖️', count: 0 },
      fill: { label: '填空题', emoji: '✍️', count: 0 },
      essay: { label: '简答题', emoji: '📝', count: 0 },
    };
    for (const q of allQuestions) {
      if (stats[q.type]) stats[q.type].count++;
    }
    return Object.values(stats).filter(s => s.count > 0);
  };

  // ============ 题库列表 ============
  if (view === 'banks') {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🍏</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>我的题库</h2>
        </div>
        {loading ? (
          <div className="text-center py-8"><span className="animate-spin inline-block text-3xl">🍏</span></div>
        ) : banks.length === 0 ? (
          <div className="card-apple p-6 text-center">
            <div className="text-5xl mb-3 animate-float">📚</div>
            <p className="text-gray-500 mb-1">还没有题库</p>
            <p className="text-sm text-gray-400">去「📥 导入」页面添加题目吧</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {banks.map(bank => (
              <button key={bank.id} onClick={() => selectBank(bank)}
                className="card-apple p-3.5 w-full text-left hover:shadow-md transition-all duration-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📚</span>
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">{bank.name}</h3>
                    <p className="text-xs text-gray-400">{bank.questionCount} 题</p>
                  </div>
                </div>
                <span className="text-lg text-gray-300">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============ 题库详情（按题型分类） ============
  if (view === 'detail' && selectedBank) {
    const types = typeStats();

    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={backToBanks} className="text-gray-400 hover:text-gray-600 p-1 text-lg">←</button>
          <h2 className="text-base font-bold truncate" style={{ color: '#387612' }}>{selectedBank.name}</h2>
        </div>

        {/* 计时器设置 */}
        <div className="card-apple p-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">⏱ 倒计时</span>
            <button
              onClick={() => setTimerEnabled(!timerEnabled)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${timerEnabled ? 'bg-apple-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${timerEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
            {timerEnabled && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input type="range" min="1" max="120" value={timerMinutes}
                  onChange={e => setTimerMinutes(Number(e.target.value))}
                  className="flex-1 accent-apple-500 h-1.5" />
                <span className="text-xs font-bold flex-shrink-0 text-right" style={{ color: '#387612', minWidth: '2.8rem' }}>{timerMinutes}分</span>
              </div>
            )}
          </div>
        </div>

        {/* 学习模式 */}
        <div className="flex rounded-xl overflow-hidden mb-3 text-sm" style={{ border: '1px solid #e5e5e5' }}>
          <button onClick={() => setStudyMode('memorize')}
            className="flex-1 py-2 text-center transition-colors"
            style={{ background: studyMode==='memorize'?'#f2fde4':'white', color: studyMode==='memorize'?'#387612':'#999' }}>
            📖 背题模式
          </button>
          <button onClick={() => setStudyMode('practice')}
            className="flex-1 py-2 text-center transition-colors"
            style={{ background: studyMode==='practice'?'#f2fde4':'white', color: studyMode==='practice'?'#387612':'#999' }}>
            🍏 刷题模式
          </button>
        </div>

        {/* 题型卡片 */}
        <div className="space-y-2">
          {types.map(t => (
            <button key={t.label} onClick={() => startByType(t.label)}
              className="card-apple p-3 w-full text-left hover:shadow-md transition-all duration-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{t.emoji}</span>
                <div>
                  <p className="font-medium text-sm text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-400">{t.count} 题</p>
                </div>
              </div>
              <span className="text-gray-300">→</span>
            </button>
          ))}
        </div>

        {allQuestions.length > 0 && (
          <button onClick={startAll} className="w-full mt-3 py-2.5 btn-apple text-sm">
            📚 全部刷题（{allQuestions.length} 题）
          </button>
        )}
      </div>
    );
  }

  // ============ 完成 ============
  if (view === 'complete') {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={backToDetail} className="text-gray-400 hover:text-gray-600 p-1 text-lg">←</button>
          <h2 className="text-base font-bold" style={{ color: '#387612' }}>{selectedBank?.name}</h2>
        </div>
        <div className="card-apple p-6 text-center animate-bounceIn">
          <div className="text-5xl mb-3 animate-float">🎉</div>
          <p className="text-gray-500 mb-1">本轮练习完成！</p>
          <p className="text-sm text-gray-400 mb-4">练习了 {questions.length} 题</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => startByType(questions[0]?.type || 'single')} className="btn-apple px-5 py-2.5 text-sm">🍏 再来一轮</button>
            <button onClick={backToDetail} className="text-sm px-5 py-2.5 rounded-2xl border-2 border-gray-200 text-gray-500">📋 换题型</button>
          </div>
        </div>
      </div>
    );
  }

  // ============ 刷题中 ============
  if (!currentQuestion) {
    return (
      <div className="animate-fadeIn">
        <button onClick={backToDetail} className="text-gray-400 hover:text-gray-600 mb-4">← 返回</button>
        <div className="card-apple p-8 text-center"><p className="text-gray-400">该分类暂无题目</p></div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* 顶部栏：返回 + 题库名 + 跳题 + 进度 */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={backToDetail} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">←</button>
        <span className="text-xs font-medium text-gray-500 truncate flex-1">{selectedBank?.name}</span>
        {/* 可点击的题号 → 弹出跳题输入框 */}
        {showJump ? (
          <div className="flex items-center gap-1">
            <input type="number" min="1" max={questions.length} value={jumpTo}
              onChange={e => setJumpTo(e.target.value)}
              onKeyDown={e => e.key==='Enter' && doJump()}
              placeholder={`1-${questions.length}`}
              className="w-16 text-center text-xs py-1 rounded-lg border-2 border-apple-400 outline-none"
              autoFocus />
            <button onClick={doJump} className="text-xs px-2 py-1 rounded-lg bg-apple-500 text-white font-bold">GO</button>
            <button onClick={() => { setShowJump(false); setJumpTo(''); }} className="text-gray-400 text-xs">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowJump(true)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded-lg hover:bg-gray-100 transition-colors">
            {currentIndex + 1}/{questions.length} ▾
          </button>
        )}
      </div>

      {/* 进度条 */}
      <div className="mb-2 h-1.5 bg-gray-100 rounded-full overflow-hidden" style={{ border: '1px solid #e8f5e0' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, background: 'linear-gradient(90deg, #9ae869, #5cb818)' }} />
      </div>

      <QuestionCard
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={answerQuestion}
        onNext={nextQuestion}
        onPrev={prevQuestion}
        onClearRecord={clearRecord}
        isFirstQuestion={currentIndex === 0}
        isLastQuestion={isLastQuestion}
        timerMinutes={timerMinutes}
        timerEnabled={timerEnabled}
        studyMode={studyMode}
        savedRecord={answerHistoryRef.current[currentQuestion.id] || null}
      />
    </div>
  );
}
