import { useState, useCallback, useRef, useEffect } from 'react';
import type { Question } from '../types';
import Timer from './Timer';
import DrawingPad from './DrawingPad';
import AIAssistant from './AIAssistant';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (userAnswer: string) => Promise<{ isCorrect: boolean }>;
  onNext: () => void;
  isLastQuestion: boolean;
  timerMinutes: number;
  timerEnabled: boolean;
  studyMode?: 'practice' | 'memorize';
}

type CardState = 'answering' | 'feedback' | 'complete';

export default function QuestionCard({
  question, questionNumber, totalQuestions, onAnswer, onNext, isLastQuestion, timerMinutes, timerEnabled, studyMode = 'practice',
}: QuestionCardProps) {
  const [state, setState] = useState<CardState>('answering');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [fillAnswer, setFillAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [timerRunning, setTimerRunning] = useState(true);
  const multiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSubmittedRef = useRef(false);

  // Reset state when question changes
  useEffect(() => {
    setState('answering');
    setSelectedAnswer('');
    setFillAnswer('');
    setIsCorrect(false);
    setTimerRunning(true);
    hasSubmittedRef.current = false;
  }, [question.id]);

  const doSubmit = async (answer: string) => {
    if (hasSubmittedRef.current || !answer.trim()) return;
    hasSubmittedRef.current = true;
    setTimerRunning(false);
    const result = await onAnswer(answer);
    setIsCorrect(result.isCorrect);
    setState('feedback');
  };

  const handleSubmit = () => {
    const answer = question.type === 'fill' || question.type === 'essay' ? fillAnswer : selectedAnswer;
    doSubmit(answer);
  };

  // 自动提交：单选/判断 选中即提交
  const handleSingleSelect = (letter: string) => {
    if (state !== 'answering') return;
    setSelectedAnswer(letter);
    // 立即自动提交
    doSubmit(letter);
  };

  // 自动提交：多选题 选中后延迟提交（等用户选完所有选项）
  const handleMultiSelect = (letter: string) => {
    if (state !== 'answering') return;
    const newAnswer = selectedAnswer.includes(letter)
      ? selectedAnswer.replace(letter, '')
      : selectedAnswer + letter;
    setSelectedAnswer(newAnswer);
    // 清除旧计时器，启动新的
    if (multiDebounceRef.current) clearTimeout(multiDebounceRef.current);
    if (newAnswer.length > 0) {
      multiDebounceRef.current = setTimeout(() => {
        doSubmit(newAnswer);
      }, 1500);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (multiDebounceRef.current) clearTimeout(multiDebounceRef.current); };
  }, []);

  // 背题模式：答对自动0.5秒跳转，答错手动跳转
  // 刷题模式：不论对错0.5秒自动跳转
  useEffect(() => {
    if (state === 'feedback') {
      const shouldAutoAdvance = studyMode === 'practice' || (studyMode === 'memorize' && isCorrect);
      if (shouldAutoAdvance) {
        const timer = setTimeout(() => {
          handleNext();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [state, studyMode, isCorrect]);

  const handleNext = () => {
    if (isLastQuestion) {
      setState('complete');
    } else {
      setState('answering');
      setSelectedAnswer('');
      setFillAnswer('');
      setTimerRunning(true);
      hasSubmittedRef.current = false;
      onNext();
    }
  };

  const handleTimeUp = useCallback(async () => {
    const answer = selectedAnswer || fillAnswer || '(未作答)';
    doSubmit(answer);
  }, [selectedAnswer, fillAnswer, onAnswer]);

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      single: '单选题', multiple: '多选题', judge: '判断题', fill: '填空题', essay: '简答题',
    };
    return labels[type] || type;
  };

  if (state === 'complete') {
    return (
      <div className="card-apple p-8 text-center animate-bounceIn">
        <AppleExplosion />
        <h2 className="text-xl font-bold mb-2" style={{ color: '#387612' }}>本轮练习完成！</h2>
        <p className="text-gray-400">好棒！坚持就是胜利~ 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 🍏 计时器（可选） */}
      {timerEnabled && (
        <div className="card-apple p-3 flex items-center gap-3">
          <span className={`text-2xl ${timerRunning && state === 'answering' ? 'animate-spin' : 'animate-float'}`}>
            🍏
          </span>
          <div className="flex-1">
            <Timer
              totalSeconds={timerMinutes * 60}
              onTimeUp={handleTimeUp}
              isRunning={timerRunning && state === 'answering'}
            />
          </div>
        </div>
      )}

      {/* 题目卡片 */}
      <div className="card-apple overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '2px solid #f2fde4' }}>
          <div className="flex items-center gap-2">
            <span className="badge-apple text-xs font-bold">{getTypeLabel(question.type)}</span>
            <span className="text-sm font-medium" style={{ color: '#387612' }}>
              {questionNumber}/{totalQuestions}
            </span>
            {state === 'feedback' && (
              studyMode === 'memorize' && !isCorrect ? (
                <button onClick={handleNext} className="text-xs px-3 py-1.5 rounded-full font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}>
                  📖 下一题 →
                </button>
              ) : (
                <button onClick={handleNext} className="text-xs px-2 py-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  跳过 →
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAI(!showAI)}
              className="text-xs px-3 py-1.5 rounded-full transition-all duration-200 font-medium"
              style={{
                background: showAI ? '#f2fde4' : '#f5f5f5',
                color: showAI ? '#387612' : '#9ca3af',
                border: showAI ? '1px solid #9ae869' : '1px solid transparent',
              }}
            >
              🤖 AI问答
            </button>
            <span className="text-xs">{'🍏'.repeat(question.difficulty)}</span>
          </div>
        </div>

        {question.knowledgePoints.length > 0 && (
          <div className="px-4 py-2.5 flex flex-wrap gap-1.5" style={{ background: '#fafdf6' }}>
            {[...new Set(question.knowledgePoints.map(kp => {
              const idx = kp.indexOf(' - ');
              return idx > 0 ? kp.slice(0, idx) : kp;
            }))].map(chapter => (
              <span key={chapter} className="badge-apple text-xs">{chapter}</span>
            ))}
          </div>
        )}

        <div className="px-5 py-5">
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-[15px]">{question.content}</p>
        </div>

        {(question.type === 'single' || question.type === 'multiple' || question.type === 'judge') && (
          <div className="px-5 pb-5 space-y-2.5">
            {question.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = selectedAnswer.includes(letter);
              let style: React.CSSProperties = { border: '2px solid #e8f5e0', background: 'white' };

              if (state === 'feedback') {
                const isCorrectAnswer = question.answer.includes(letter);
                if (isCorrectAnswer) {
                  style = { border: '2px solid #9ae869', background: '#f2fde4' };
                } else if (isSelected && !isCorrectAnswer) {
                  style = { border: '2px solid #ffc9c9', background: '#fff0f0' };
                }
              } else if (isSelected) {
                style = { border: '2px solid #7ad93f', background: '#f2fde4' };
              }

              return (
                <button
                  key={i}
                  disabled={state === 'feedback'}
                  onClick={() => {
                    if (question.type === 'multiple') {
                      handleMultiSelect(letter);
                    } else {
                      handleSingleSelect(letter);
                      // 单选题点击后自动提交
                    }
                  }}
                  className="w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200 disabled:cursor-default hover:shadow-sm"
                  style={style}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mr-3" style={{
                    background: isSelected ? '#7ad93f' : '#f5f5f5', color: isSelected ? 'white' : '#999',
                  }}>{letter}</span>
                  {opt.replace(/^[A-D][.、\s]+/, '')}
                </button>
              );
            })}
          </div>
        )}

        {(question.type === 'fill' || question.type === 'essay') && (
          <div className="px-5 pb-5">
            <textarea
              value={fillAnswer}
              onChange={e => setFillAnswer(e.target.value)}
              disabled={state === 'feedback'}
              placeholder={question.type === 'fill' ? '🍏 请输入答案...' : '🍏 请简要作答...'}
              className="input-apple w-full resize-none" rows={3}
            />
          </div>
        )}

        <div className="px-5 pb-5">
          {state === 'answering' && (
            <>
              {/* 单选/判断：自动提交，无需按钮 */}
              {(question.type === 'single' || question.type === 'judge') && (
                <p className="text-xs text-gray-400 text-center py-2">👆 点击选项自动提交</p>
              )}
              {/* 多选题：显示提交按钮（也可等1.5秒自动提交） */}
              {question.type === 'multiple' && selectedAnswer.length > 0 && (
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 btn-apple text-base"
                >
                  🍏 提交答案（{selectedAnswer.length}项已选）
                </button>
              )}
              {question.type === 'multiple' && selectedAnswer.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">👆 点击选项选择，1.5秒后自动提交</p>
              )}
              {/* 填空/简答：手动提交 */}
              {(question.type === 'fill' || question.type === 'essay') && (
                <button
                  onClick={handleSubmit}
                  disabled={!fillAnswer.trim()}
                  className="w-full py-3.5 btn-apple disabled:opacity-40 disabled:cursor-not-allowed text-base"
                >
                  🍏 提交答案
                </button>
              )}
            </>
          )}

          {state === 'feedback' && (
            <>
              {/* 反馈内容区 */}
              <div className="p-5 rounded-2xl animate-fadeIn" style={{
                background: isCorrect ? '#f2fde4' : '#fff0f0',
                border: `2px solid ${isCorrect ? '#c2f39e' : '#ffc9c9'}`,
              }}>
                {isCorrect ? <AppleExplosion /> : null}
                <p className="text-2xl mb-2">
                  {isCorrect ? '🍏 回答正确！' : '🍎 回答错误'}
                </p>
                {!isCorrect && (
                  <p className="text-sm mt-1" style={{ color: '#387612' }}>
                    正确答案：<span className="font-bold text-base">{question.answer}</span>
                  </p>
                )}
                {/* 刷题模式 或 背题模式答对 → 自动跳转提示 */}
                {(studyMode === 'practice' || (studyMode === 'memorize' && isCorrect)) && (
                  <p className="text-xs text-gray-400 mt-1">⏳ 0.5秒后自动跳下一题...</p>
                )}
                {/* 背题模式 + 答错 → 显示解析 */}
                {studyMode === 'memorize' && !isCorrect && question.explanation && (
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.6)' }}>
                    💡 {question.explanation}
                  </p>
                )}
                {/* 背题模式 + 答对 + 有解析也显示 */}
                {studyMode === 'memorize' && isCorrect && question.explanation && (
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.6)' }}>
                    💡 {question.explanation}
                  </p>
                )}
              </div>

              {/* 底部按钮 */}
              {(studyMode === 'practice' || (studyMode === 'memorize' && isCorrect)) ? (
                <button
                  onClick={handleNext}
                  className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  跳过等待 →
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full py-3.5 btn-apple text-base mt-3"
                >
                  📖 下一题
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <DrawingPad questionId={question.id} />

      {showAI && (
        <AIAssistant question={question} isCorrect={state === 'feedback' ? isCorrect : undefined} onClose={() => setShowAI(false)} />
      )}
    </div>
  );
}

// ============ 🍏 苹果爆炸特效 ============
function AppleExplosion() {
  const apples = useRef<{ id: number; x: number; y: number; rot: number; scale: number; delay: number }[]>([]);

  if (apples.current.length === 0) {
    apples.current = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 200 - 50,
      rot: Math.random() * 720 - 360,
      scale: 0.5 + Math.random() * 1.5,
      delay: Math.random() * 0.3,
    }));
  }

  return (
    <div className="relative pointer-events-none" style={{ height: 0 }}>
      {apples.current.map(a => (
        <span
          key={a.id}
          className="inline-block absolute left-1/2 top-0"
          style={{
            fontSize: `${16 + a.scale * 16}px`,
            animation: `appleBurst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${a.delay}s both`,
            '--x': `${a.x}px`,
            '--y': `${a.y}px`,
            '--rot': `${a.rot}deg`,
          } as React.CSSProperties}
        >
          🍏
        </span>
      ))}
    </div>
  );
}
