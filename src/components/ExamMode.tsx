import { useState, useCallback, useEffect } from 'react';
import type { Question } from '../types';
import { getAllQuestions, updateQuestionMastery, addWrongRecord, saveSession, getSettings } from '../store/db';
import Timer from './Timer';
import DrawingPad from './DrawingPad';

type ExamState = 'config' | 'exam' | 'result';

export default function ExamMode() {
  const [state, setState] = useState<ExamState>('config');
  const [questionCount, setQuestionCount] = useState(20);
  const [timeMinutes, setTimeMinutes] = useState(60);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fillAnswers, setFillAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    score: number; total: number;
    details: { question: Question; userAnswer: string; isCorrect: boolean }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSettings().then((s) => { setQuestionCount(s.examQuestionCount); setTimeMinutes(s.examTimeMinutes); });
  }, []);

  const startExam = async () => {
    setLoading(true);
    const all = await getAllQuestions();
    if (all.length === 0) { alert('题库为空，请先导入题目'); setLoading(false); return; }
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    setQuestions(shuffled.slice(0, Math.min(questionCount, all.length)));
    setCurrentIndex(0); setAnswers({}); setFillAnswers({}); setResult(null);
    setState('exam'); setLoading(false);
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
    setState('result');
  };

  const currentQuestion = questions[currentIndex];

  if (state === 'config') {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl animate-float">🏆</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>模拟考试</h2>
        </div>
        <div className="card-apple p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              📝 题目数量：<span className="text-apple-600 font-bold text-lg">{questionCount} 题</span>
            </label>
            <input type="range" min="10" max="100" step="5" value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full accent-apple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              ⏱ 考试时间：<span className="text-apple-600 font-bold text-lg">{timeMinutes} 分钟</span>
            </label>
            <input type="range" min="10" max="180" step="5" value={timeMinutes}
              onChange={(e) => setTimeMinutes(Number(e.target.value))} className="w-full accent-apple-500" />
          </div>
          <div className="p-4 rounded-2xl text-sm" style={{ background: '#fff8e1', border: '2px solid #ffe082', color: '#e67700' }}>
            ⚠️ 考试开始后自动计时，到时自动交卷。请确保在安静的环境中进行。
          </div>
          <button onClick={startExam} disabled={loading}
            className="w-full py-4 btn-apple text-lg font-bold disabled:opacity-50">
            {loading ? '🍏 准备中...' : '🚀 开始考试'}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'exam' && currentQuestion) {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>考试中</h2>
        </div>
        <div className="space-y-4">
          <div className="card-apple p-3">
            <Timer totalSeconds={timeMinutes * 60} onTimeUp={handleTimeUp} isRunning={true} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">第 {currentIndex + 1}/{questions.length} 题</span>
            <span className="text-gray-400">已答：{Object.keys(answers).length + Object.keys(fillAnswers).length} 题</span>
          </div>
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

          {/* 答题卡 */}
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

  if (state === 'result' && result) {
    return (
      <div className="animate-fadeIn">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>考试结果</h2>
        </div>
        <div className="card-apple p-8 text-center mb-6">
          <div className="text-6xl mb-4 animate-bounceIn">
            {result.score >= 90 ? '🏅' : result.score >= 70 ? '🍏' : result.score >= 60 ? '😅' : '💪'}
          </div>
          <p className="text-4xl font-bold mb-2" style={{ color: result.score >= 60 ? '#387612' : '#e03131' }}>{result.score} 分</p>
          <p className="text-gray-400">正确 {result.details.filter((d) => d.isCorrect).length}/{result.total} 题</p>
        </div>
        <div className="space-y-3">
          <h3 className="font-medium text-sm" style={{ color: '#387612' }}>📋 答题详情</h3>
          {result.details.map((detail, i) => (
            <div key={detail.question.id}
              className="card-apple p-4"
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
        <button onClick={() => setState('config')}
          className="w-full mt-5 py-3.5 btn-apple text-base">
          🍏 再来一次
        </button>
      </div>
    );
  }

  return null;
}
