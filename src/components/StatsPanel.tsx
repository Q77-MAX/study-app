import { useState, useEffect } from 'react';
import { getStats } from '../store/db';

interface StatsData {
  totalQuestions: number; practicedQuestions: number; overallAccuracy: number;
  totalWrong: number;
  weakPoints: { knowledgePoint: string; accuracy: number; total: number }[];
  last7Days: number[]; last7DaysLabels: string[];
  knowledgeStats: { knowledgePoint: string; accuracy: number; total: number }[];
}

export default function StatsPanel() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getStats().then((s) => { setStats(s); setLoading(false); }); }, []);

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📊</span>
          <h2 className="text-base font-bold" style={{ color: '#387612' }}>学习统计</h2>
        </div>
        <div className="text-center py-6"><span className="animate-spin inline-block text-2xl">🍏</span></div>
      </div>
    );
  }

  if (!stats || stats.totalQuestions === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl animate-float">📊</span>
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>学习统计</h2>
        </div>
        <div className="card-apple p-6 text-center">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-sm text-gray-400">还没有题目，先去导入题库吧！</p>
        </div>
      </div>
    );
  }

  const maxDayCount = Math.max(...stats.last7Days, 1);

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📊</span>
        <h2 className="text-base font-bold" style={{ color: '#387612' }}>学习统计</h2>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: '题库总数', value: stats.totalQuestions, emoji: '📚' },
          { label: '已练习', value: stats.practicedQuestions, emoji: '✏️' },
          { label: '正确率', value: `${stats.overallAccuracy}%`, emoji: '🎯', color: stats.overallAccuracy >= 80 ? '#4a9b10' : stats.overallAccuracy >= 60 ? '#e67700' : '#e03131' },
          { label: '待复习', value: stats.totalWrong, emoji: '📕', color: stats.totalWrong > 0 ? '#e03131' : '#4a9b10' },
        ].map((item, i) => (
          <div key={i} className="card-apple p-3">
            <p className="text-xs text-gray-400 mb-0.5">{item.emoji} {item.label}</p>
            <p className="text-xl font-bold" style={{ color: (item as any).color || '#333' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* 近7天 */}
      <div className="card-apple p-3 mb-4">
        <h3 className="font-medium text-xs mb-2" style={{ color: '#387612' }}>📅 近7天练习记录</h3>
        <div className="flex items-end gap-0.5 h-16">
          {stats.last7Days.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t-sm transition-all" style={{
                height: maxDayCount > 0 ? `${(count / maxDayCount) * 56}px` : '0',
                background: count > 0 ? 'linear-gradient(180deg, #9ae869, #5cb818)' : '#e8f5e0',
                opacity: count > 0 ? 1 : 0.4,
              }} />
              <span className="text-xs text-gray-400">{count}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {stats.last7DaysLabels.map((label, i) => (
            <span key={i} className="text-xs text-gray-400">{label}</span>
          ))}
        </div>
      </div>

      {/* 薄弱知识点 */}
      {stats.weakPoints.length > 0 && (
        <div className="card-apple p-3 mb-4">
          <h3 className="font-medium text-xs mb-2" style={{ color: '#387612' }}>⚠️ 薄弱知识点</h3>
          <div className="space-y-1.5">
            {stats.weakPoints.map((wp) => (
              <div key={wp.knowledgePoint} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{wp.knowledgePoint}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${wp.accuracy}%`,
                    background: wp.accuracy >= 80 ? '#7ad93f' : wp.accuracy >= 60 ? '#ffd43b' : '#ff8787',
                  }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{wp.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 知识点概览 */}
      {stats.knowledgeStats.length > 0 && (
        <div className="card-apple p-3 mb-4">
          <h3 className="font-medium text-xs mb-2" style={{ color: '#387612' }}>📋 知识点掌握情况</h3>
          <div className="space-y-1.5">
            {stats.knowledgeStats.map((ks) => (
              <div key={ks.knowledgePoint} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{ks.knowledgePoint}</span>
                <span className="text-xs text-gray-400">{ks.total}题</span>
                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ks.accuracy}%`, background: ks.accuracy >= 80 ? '#7ad93f' : ks.accuracy >= 60 ? '#ffd43b' : '#ff8787' }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{ks.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
