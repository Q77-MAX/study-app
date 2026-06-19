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
                    <p className="text-xs text-gray-700 mb-1.5 leading-relaxed">{record.question?.content||'(题目已删除)'}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-2">
                        <span className="text-red-400">你的：{record.userAnswer}</span>
                        <span style={{color:'#4a9b10'}}>正确：{record.question?.answer||'-'}</span>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-gray-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                        {!record.reviewed&&(
                          <button onClick={()=>{markWrongAsReviewed(record.id);loadData();}} className="text-green-500 font-medium text-xs">标记已复习</button>
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
                      <div className="px-3 pb-2 space-y-1.5" style={{borderTop:'2px solid #f2fde4'}}>
                        {questions.map(q=>(
                          <div key={q.id} className="text-xs text-gray-700 py-1.5" style={{borderBottom:'1px solid #f5f5f5'}}>
                            <p className="line-clamp-2">{q.content}</p>
                            <p className="mt-0.5" style={{color:'#4a9b10'}}>答案：{q.answer}</p>
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
                      <div className="px-3 pb-2 space-y-1.5" style={{borderTop:'2px solid #f2fde4'}}>
                        {questions.map(q=>(
                          <div key={q.id} className="text-xs text-gray-700 py-1.5" style={{borderBottom:'1px solid #f5f5f5'}}>
                            <p className="line-clamp-2">{q.content}</p>
                            <p className="mt-0.5" style={{color:'#4a9b10'}}>答案：{q.answer}</p>
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
