import { useState, useEffect, useCallback } from 'react';
import { getAllBanks, getQuestionsByBank, updateQuestionMastery, addWrongRecord } from '../store/db';
import type { Question, QuestionBank } from '../types';
import QuestionCard from './QuestionCard';

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

  const loadBanks = async () => {
    setLoading(true);
    setBanks(await getAllBanks());
    setLoading(false);
  };

  useEffect(() => { loadBanks(); }, []);

  // 选择题库 → 进入详情
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

  // 按类型开始刷题
  const startByType = (label: string) => {
    const type = typeKeyMap[label] || 'single';
    const filtered = allQuestions
      .filter(q => q.type === type)
      .sort((a, b) => a.mastery - b.mastery || a.lastPracticed - b.lastPracticed);
    setQuestions(filtered);
    setCurrentIndex(0);
    setView('practice');
  };

  // 全部刷题
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

  const answerQuestion = useCallback(async (userAnswer: string) => {
    if (!currentQuestion) return { isCorrect: false };
    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();
    await updateQuestionMastery(currentQuestion.id, isCorrect);
    if (!isCorrect) await addWrongRecord(currentQuestion.id, userAnswer);
    return { isCorrect };
  }, [currentQuestion]);

  const nextQuestion = useCallback(() => {
    if (!isLastQuestion) {
      setCurrentIndex(i => i + 1);
    } else {
      setView('complete');
    }
  }, [isLastQuestion]);

  // 统计各类别题目数
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
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl animate-float">🍏</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>我的题库</h2>
        </div>

        {loading ? (
          <div className="text-center py-8"><span className="animate-spin inline-block text-3xl">🍏</span></div>
        ) : banks.length === 0 ? (
          <div className="card-apple p-8 text-center">
            <div className="text-6xl mb-4 animate-float">📚</div>
            <p className="text-gray-500 mb-2">还没有题库</p>
            <p className="text-sm text-gray-400">去「📥 导入」页面添加题目吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {banks.map(bank => (
              <button
                key={bank.id}
                onClick={() => selectBank(bank)}
                className="card-apple p-5 w-full text-left hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">📚</span>
                      <h3 className="font-bold text-gray-800">{bank.name}</h3>
                    </div>
                    <p className="text-sm text-gray-400 ml-9">{bank.questionCount} 道题目</p>
                  </div>
                  <span className="text-2xl text-gray-300">→</span>
                </div>
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
        <div className="flex items-center gap-2 mb-4">
          <button onClick={backToBanks} className="text-gray-400 hover:text-gray-600 p-1 text-lg">←</button>
          <h2 className="text-lg font-bold truncate" style={{ color: '#387612' }}>{selectedBank.name}</h2>
        </div>

        {/* 计时器设置 */}
        <div className="card-apple p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">⏱ 倒计时</span>
            <button
              onClick={() => setTimerEnabled(!timerEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${timerEnabled ? 'bg-apple-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${timerEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {timerEnabled && (
            <div className="flex items-center gap-3 animate-fadeIn">
              <input
                type="range" min="1" max="120" value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                className="flex-1 accent-apple-500"
              />
              <span className="text-lg font-bold min-w-[4rem] text-right" style={{ color: '#387612' }}>
                {timerMinutes} 分钟
              </span>
            </div>
          )}
        </div>

        {/* 题型分类卡片 */}
        <p className="text-sm text-gray-500 mb-3">选择题型开始刷题：</p>
        <div className="space-y-3">
          {types.map(t => (
            <button
              key={t.label}
              onClick={() => startByType(t.label)}
              className="card-apple p-4 w-full text-left hover:shadow-md transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{t.emoji}</span>
                <div>
                  <p className="font-medium text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-400">共 {t.count} 题</p>
                </div>
              </div>
              <span className="text-xl text-gray-300">→</span>
            </button>
          ))}
        </div>

        {/* 全部刷题 */}
        {allQuestions.length > 0 && (
          <button onClick={startAll} className="w-full mt-4 py-3.5 btn-apple text-base">
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
        <div className="flex items-center gap-2 mb-5">
          <button onClick={backToDetail} className="text-gray-400 hover:text-gray-600 p-1 text-lg">←</button>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>{selectedBank?.name}</h2>
        </div>
        <div className="card-apple p-8 text-center animate-bounceIn">
          <div className="text-6xl mb-4 animate-float">🎉</div>
          <p className="text-gray-500 mb-2">本轮练习完成！</p>
          <p className="text-sm text-gray-400 mb-5">练习了 {questions.length} 题</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => startByType(questions[0]?.type || 'single')} className="btn-apple px-6 py-3">🍏 再来一轮</button>
            <button onClick={backToDetail} className="btn-apple-outline px-6 py-3">📋 换题型</button>
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={backToDetail} className="text-gray-400 hover:text-gray-600 p-1">←</button>
          <span className="text-sm font-medium text-gray-600 truncate max-w-[200px]">{selectedBank?.name}</span>
        </div>
        <span className="text-xs text-gray-400">{currentIndex + 1}/{questions.length}</span>
      </div>

      <div className="mb-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden" style={{ border: '1px solid #e8f5e0' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
              background: 'linear-gradient(90deg, #9ae869, #5cb818)',
            }} />
        </div>
      </div>

      <QuestionCard
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
        onAnswer={answerQuestion}
        onNext={nextQuestion}
        isLastQuestion={isLastQuestion}
        timerMinutes={timerMinutes}
        timerEnabled={timerEnabled}
      />
    </div>
  );
}
