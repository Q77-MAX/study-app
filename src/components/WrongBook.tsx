import { useState, useEffect } from 'react';
import { getWrongRecords, getWrongQuestionsByType, getWrongQuestionsByKnowledge, markWrongAsReviewed } from '../store/db';
import type { Question, WrongRecord } from '../types';

type ViewMode = 'list' | 'byType' | 'byKnowledge';

export default function WrongBook() {
  const [mode, setMode] = useState<ViewMode>('list');
  const [records, setRecords] = useState<(WrongRecord & { question?: Question })[]>([]);
  const [byType, setByType] = useState<Record<string, Question[]>>({});
  const [byKnowledge, setByKnowledge] = useState<Record<string, Question[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    const [recs, typeData, knowledgeData] = await Promise.all([
      getWrongRecords(), getWrongQuestionsByType(), getWrongQuestionsByKnowledge(),
    ]);
    setRecords(recs);
    setByType(typeData);
    setByKnowledge(knowledgeData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const unreviewedCount = records.filter((r) => !r.reviewed).length;

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📕</span>
          <h2 className="text-base font-bold" style={{ color: '#387612' }}>错题本</h2>
        </div>
        {unreviewedCount > 0 && (
          <span className="badge-pink text-xs font-bold px-2 py-0.5">{unreviewedCount} 待复习</span>
        )}
      </div>

      <div className="flex gap-1.5 mb-3">
        {(['list','byType','byKnowledge'] as ViewMode[]).map(id=>{
          const labels:Record<string,string>={list:'📋 列表',byType:'📑 按题型',byKnowledge:'🏷 按知识点'};
          return (
            <button key={id} onClick={()=>setMode(id)}
              className="flex-1 py-2 text-xs rounded-lg border-2 transition-all duration-200 font-medium"
              style={{ borderColor:mode===id?'#9ae869':'#e8f5e0', background:mode===id?'#f2fde4':'white', color:mode===id?'#387612':'#999' }}>
              {labels[id]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-6"><span className="animate-spin inline-block text-2xl">🍏</span></div>
      ) : (
        <>
          {mode==='list'&&(
            <div className="space-y-2">
              {records.length===0?(
                <div className="card-apple p-6 text-center"><div className="text-4xl mb-2">🎯</div><p className="text-sm text-gray-400">还没有错题，继续保持！</p></div>
              ):(
                records.map(record=>(
                  <div key={record.id} className="card-apple p-3" style={{borderLeft:record.reviewed?undefined:'3px solid #ff8787'}}>
                    <p className="text-xs text-gray-700 mb-2 leading-relaxed">{record.question?.content||'(题目已删除)'}</p>

                    {/* 显示选项列表 */}
                    {record.question?.options && record.question.options.length > 0 && (
                      <div className="mb-2 space-y-1 pl-2">
                        {record.question.options.map((opt, idx) => {
                          const letter = String.fromCharCode(65 + idx); // A, B, C, D...
                          const isCorrectAnswer = record.question?.answer.includes(letter);
                          const isUserChoice = record.userAnswer.includes(letter);

                          return (
                            <div
                              key={idx}
                              className="text-xs py-1 px-2 rounded flex items-start gap-2"
                              style={{
                                background: isCorrectAnswer ? '#f0fbe4' : isUserChoice ? '#fff3f3' : 'transparent',
                                borderLeft: isCorrectAnswer ? '3px solid #4a9b10' : isUserChoice ? '3px solid #ff8787' : '3px solid transparent',
                                color: isCorrectAnswer ? '#2d6a10' : isUserChoice ? '#d32f2f' : '#666'
                              }}
                            >
                              <span className="font-bold flex-shrink-0">{letter}.</span>
                              <span className="flex-1">{opt}</span>
                              {isCorrectAnswer && <span className="text-[10px] flex-shrink-0 font-medium" style={{color:'#4a9b10'}}>✓ 正确</span>}
                              {isUserChoice && !isCorrectAnswer && <span className="text-[10px] flex-shrink-0 font-medium" style={{color:'#ff8787'}}>✗ 你的选择</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 答案信息 */}
                    <div className="flex flex-col gap-1.5 text-xs mt-2 pt-2" style={{borderTop:'1px solid #f5f5f5'}}>
                      <div className="flex items-center gap-3">
                        <span className="text-red-400">你的答案：{record.userAnswer || '未作答'}</span>
                        <span style={{color:'#4a9b10'}} className="font-bold">正确答案：{record.question?.answer||'-'}</span>
                      </div>

                      {/* 显示答案解析 */}
                      {record.question?.explanation && (
                        <div className="mt-1 p-2 rounded" style={{background:'#f8fcf4', border:'1px solid #e8f5e0'}}>
                          <p className="text-[11px] text-gray-500 font-medium mb-0.5">💡 答案解析：</p>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{record.question.explanation}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className="text-gray-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                      <div className="flex gap-1.5 items-center">
                        {!record.reviewed&&(
                          <button onClick={()=>{markWrongAsReviewed(record.id);loadData();}} className="text-green-500 font-medium text-xs px-2 py-1 rounded hover:bg-green-50">标记已复习</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {mode==='byType'&&(
            <div className="space-y-2">
              {Object.entries(byType).length===0?(
                <div className="card-apple p-6 text-center text-sm text-gray-400">还没有错题</div>
              ):(
                Object.entries(byType).map(([type,questions])=>(
                  <div key={type} className="card-apple overflow-hidden">
                    <button onClick={()=>setExpanded({...expanded,[type]:!expanded[type]})}
                      className="w-full px-3 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium" style={{color:'#387612'}}>{type} <span className="text-gray-400">({questions.length}题)</span></span>
                      <span className="text-gray-400">{expanded[type]?'收起 ▲':'展开 ▼'}</span>
                    </button>
                    {expanded[type]&&(
                      <div className="px-3 pb-2 space-y-2" style={{borderTop:'2px solid #f2fde4'}}>
                        {questions.map(q=>(
                          <div key={q.id} className="py-2" style={{borderBottom:'1px solid #f5f5f5'}}>
                            <p className="text-xs text-gray-700 mb-1.5 leading-relaxed">{q.content}</p>

                            {/* 显示选项 */}
                            {q.options && q.options.length > 0 && (
                              <div className="mb-1.5 space-y-0.5 pl-2">
                                {q.options.map((opt, idx) => {
                                  const letter = String.fromCharCode(65 + idx);
                                  const isCorrectAnswer = q.answer.includes(letter);

                                  return (
                                    <div
                                      key={idx}
                                      className="text-[11px] py-0.5 px-1.5 rounded flex items-start gap-1.5"
                                      style={{
                                        background: isCorrectAnswer ? '#f0fbe4' : 'transparent',
                                        color: isCorrectAnswer ? '#2d6a10' : '#888'
                                      }}
                                    >
                                      <span className="font-bold flex-shrink-0">{letter}.</span>
                                      <span className="flex-1">{opt}</span>
                                      {isCorrectAnswer && <span className="text-[10px] flex-shrink-0" style={{color:'#4a9b10'}}>✓</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold" style={{color:'#4a9b10'}}>正确答案：{q.answer}</p>
                              {q.explanation && (
                                <p className="text-[11px] text-gray-500">💡 {q.explanation}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {mode==='byKnowledge'&&(
            <div className="space-y-2">
              {Object.entries(byKnowledge).length===0?(
                <div className="card-apple p-6 text-center text-sm text-gray-400">还没有错题</div>
              ):(
                Object.entries(byKnowledge).sort(([,a],[,b])=>b.length-a.length).map(([kp,questions])=>(
                  <div key={kp} className="card-apple overflow-hidden">
                    <button onClick={()=>setExpanded({...expanded,[kp]:!expanded[kp]})}
                      className="w-full px-3 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium truncate mr-2" style={{color:'#387612'}}>{kp} <span className="text-gray-400">({questions.length}题)</span></span>
                      <span className="text-gray-400 flex-shrink-0">{expanded[kp]?'收起 ▲':'展开 ▼'}</span>
                    </button>
                    {expanded[kp]&&(
                      <div className="px-3 pb-2 space-y-2" style={{borderTop:'2px solid #f2fde4'}}>
                        {questions.map(q=>(
                          <div key={q.id} className="py-2" style={{borderBottom:'1px solid #f5f5f5'}}>
                            <p className="text-xs text-gray-700 mb-1.5 leading-relaxed">{q.content}</p>

                            {/* 显示选项 */}
                            {q.options && q.options.length > 0 && (
                              <div className="mb-1.5 space-y-0.5 pl-2">
                                {q.options.map((opt, idx) => {
                                  const letter = String.fromCharCode(65 + idx);
                                  const isCorrectAnswer = q.answer.includes(letter);

                                  return (
                                    <div
                                      key={idx}
                                      className="text-[11px] py-0.5 px-1.5 rounded flex items-start gap-1.5"
                                      style={{
                                        background: isCorrectAnswer ? '#f0fbe4' : 'transparent',
                                        color: isCorrectAnswer ? '#2d6a10' : '#888'
                                      }}
                                    >
                                      <span className="font-bold flex-shrink-0">{letter}.</span>
                                      <span className="flex-1">{opt}</span>
                                      {isCorrectAnswer && <span className="text-[10px] flex-shrink-0" style={{color:'#4a9b10'}}>✓</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold" style={{color:'#4a9b10'}}>正确答案：{q.answer}</p>
                              {q.explanation && (
                                <p className="text-[11px] text-gray-500">💡 {q.explanation}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
