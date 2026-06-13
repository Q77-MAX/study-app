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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-float">📕</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>错题本</h2>
        </div>
        {unreviewedCount > 0 && (
          <span className="badge-pink text-sm font-bold">{unreviewedCount} 待复习</span>
        )}
      </div>

      {/* 视图切换 */}
      <div className="flex gap-2 mb-5">
        {([
          { id: 'list' as ViewMode, label: '📋 列表' },
          { id: 'byType' as ViewMode, label: '📑 按题型' },
          { id: 'byKnowledge' as ViewMode, label: '🏷 按知识点' },
        ]).map((v) => (
          <button
            key={v.id}
            onClick={() => setMode(v.id)}
            className="flex-1 py-2.5 text-xs rounded-xl border-2 transition-all duration-200 font-medium"
            style={{
              borderColor: mode === v.id ? '#9ae869' : '#e8f5e0',
              background: mode === v.id ? '#f2fde4' : 'white',
              color: mode === v.id ? '#387612' : '#999',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8"><span className="animate-spin inline-block text-3xl">🍏</span></div>
      ) : (
        <>
          {mode === 'list' && (
            <div className="space-y-3">
              {records.length === 0 ? (
                <div className="card-apple p-8 text-center">
                  <div className="text-5xl mb-3 animate-float">🎯</div>
                  <p className="text-gray-400">还没有错题，继续保持！</p>
                </div>
              ) : (
                records.map((record) => (
                  <div key={record.id} className="card-apple p-4" style={{ borderLeft: record.reviewed ? undefined : '4px solid #ff8787' }}>
                    <p className="text-sm text-gray-700 mb-2">{record.question?.content || '(题目已删除)'}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-3">
                        <span className="text-red-400">你的：{record.userAnswer}</span>
                        <span style={{ color: '#4a9b10' }}>正确：{record.question?.answer || '-'}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-gray-400">{new Date(record.timestamp).toLocaleDateString()}</span>
                        {!record.reviewed && (
                          <button onClick={() => { markWrongAsReviewed(record.id); loadData(); }}
                            className="text-green-500 hover:text-green-700 font-medium">
                            标记已复习
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {mode === 'byType' && (
            <div className="space-y-3">
              {Object.entries(byType).length === 0 ? (
                <div className="card-apple p-8 text-center text-gray-400">还没有错题</div>
              ) : (
                Object.entries(byType).map(([type, questions]) => (
                  <div key={type} className="card-apple overflow-hidden">
                    <button
                      onClick={() => setExpanded({ ...expanded, [type]: !expanded[type] })}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    >
                      <span className="font-medium text-sm" style={{ color: '#387612' }}>
                        {type} <span className="text-gray-400">({questions.length}题)</span>
                      </span>
                      <span className="text-gray-400 text-xs">{expanded[type] ? '收起 ▲' : '展开 ▼'}</span>
                    </button>
                    {expanded[type] && (
                      <div className="px-4 pb-3 space-y-2" style={{ borderTop: '2px solid #f2fde4' }}>
                        {questions.map((q) => (
                          <div key={q.id} className="text-sm text-gray-700 py-2" style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <p className="line-clamp-2">{q.content}</p>
                            <p className="text-xs mt-1" style={{ color: '#4a9b10' }}>答案：{q.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {mode === 'byKnowledge' && (
            <div className="space-y-3">
              {Object.entries(byKnowledge).length === 0 ? (
                <div className="card-apple p-8 text-center text-gray-400">还没有错题</div>
              ) : (
                Object.entries(byKnowledge).sort(([, a], [, b]) => b.length - a.length).map(([kp, questions]) => (
                  <div key={kp} className="card-apple overflow-hidden">
                    <button
                      onClick={() => setExpanded({ ...expanded, [kp]: !expanded[kp] })}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    >
                      <span className="font-medium text-sm" style={{ color: '#387612' }}>
                        {kp} <span className="text-gray-400">({questions.length}题)</span>
                      </span>
                      <span className="text-gray-400 text-xs">{expanded[kp] ? '收起 ▲' : '展开 ▼'}</span>
                    </button>
                    {expanded[kp] && (
                      <div className="px-4 pb-3 space-y-2" style={{ borderTop: '2px solid #f2fde4' }}>
                        {questions.map((q) => (
                          <div key={q.id} className="text-sm text-gray-700 py-2" style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <p className="line-clamp-2">{q.content}</p>
                            <p className="text-xs mt-1" style={{ color: '#4a9b10' }}>答案：{q.answer}</p>
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
