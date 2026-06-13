import { useState, useEffect } from 'react';
import { FiEdit3, FiPlusCircle, FiBookOpen, FiBarChart2, FiAward, FiSettings, FiDownload } from 'react-icons/fi';

export type TabId = 'practice' | 'import' | 'wrong' | 'stats' | 'exam';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'practice', label: '刷题', icon: <FiEdit3 size={22} /> },
  { id: 'import', label: '导入', icon: <FiPlusCircle size={22} /> },
  { id: 'wrong', label: '错题', icon: <FiBookOpen size={22} /> },
  { id: 'stats', label: '统计', icon: <FiBarChart2 size={22} /> },
  { id: 'exam', label: '考试', icon: <FiAward size={22} /> },
];

// 背景装饰苹果
const bgApples = [
  { top: '5%', left: '3%', size: 28, delay: 0, emoji: '🍏', rot: -15 },
  { top: '12%', right: '5%', size: 22, delay: 2, emoji: '🍎', rot: 20 },
  { top: '25%', left: '8%', size: 18, delay: 4, emoji: '🍏', rot: 10 },
  { top: '40%', right: '3%', size: 30, delay: 1, emoji: '🍏', rot: -25 },
  { top: '55%', left: '2%', size: 24, delay: 3, emoji: '🍎', rot: 15 },
  { top: '70%', right: '7%', size: 20, delay: 5, emoji: '🍏', rot: -10 },
  { top: '85%', left: '6%', size: 26, delay: 2, emoji: '🍏', rot: 30 },
  { top: '15%', left: '45%', size: 16, delay: 6, emoji: '🍎', rot: -5 },
  { top: '60%', left: '50%', size: 15, delay: 3, emoji: '🍏', rot: 20 },
  { top: '90%', right: '40%', size: 18, delay: 1, emoji: '🍏', rot: -20 },
];

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pwaDebug, setPwaDebug] = useState<string[]>([]);

  // PWA 安装事件监听
  useEffect(() => {
    const logs: string[] = [];

    // 检查 SW 支持
    if (!('serviceWorker' in navigator)) {
      logs.push('❌ 浏览器不支持 Service Worker');
      setPwaDebug(logs);
      return;
    }

    // 检查当前 SW 状态
    navigator.serviceWorker.getRegistrations().then(regs => {
      logs.push(`SW 注册数: ${regs.length}`);
      regs.forEach(r => {
        logs.push(`  SW scope: ${r.scope}, active: ${!!r.active?.state}`);
      });
      if (regs.length === 0) {
        logs.push('⚠️ 无 SW 注册 - 等待页面加载后注册');
      }
      setPwaDebug([...logs]);
    });

    const onInstall = (e: Event) => {
      logs.push('🍏 beforeinstallprompt 已触发！');
      setPwaDebug([...logs]);
      e.preventDefault();
      setInstallPrompt(e);
    };

    const onInstalled = () => {
      logs.push('✅ App 已安装');
      setPwaDebug([...logs]);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);

    // 过几秒再检查一次 SW（等注册完成）
    setTimeout(() => {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length > 0 && !logs.some(l => l.includes('已触发'))) {
          const log = `⏳ SW 已注册但 beforeinstallprompt 尚未触发 (${new Date().toLocaleTimeString()})`;
          logs.push(log);
          setPwaDebug([...logs]);
        }
      });
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'linear-gradient(180deg, #f2fde4 0%, #fafdf6 15%, #fff 35%, #fff 100%)' }}>
      {/* 🍏🍎🍏 背景装饰苹果 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {bgApples.map((a, i) => (
          <span
            key={i}
            className="absolute opacity-[0.12] animate-float select-none"
            style={{
              top: a.top, left: a.left, right: a.right,
              fontSize: `${a.size}px`,
              animationDelay: `${a.delay}s`,
              transform: `rotate(${a.rot}deg)`,
            }}
          >
            {a.emoji}
          </span>
        ))}
      </div>

      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 backdrop-blur-lg relative" style={{ background: 'rgba(255,255,255,0.88)', borderBottom: '2px solid #dff9c8' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: '#387612' }}>
            <img src="/apple-icon.svg" alt="" className="w-7 h-7 animate-float" />
            <span>青苹果刷题</span>
          </h1>
          <div className="flex items-center gap-1">
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 animate-bounceIn"
                style={{ background: 'linear-gradient(135deg, #5cb818, #387612)', color: 'white', boxShadow: '0 2px 8px rgba(92,184,24,0.35)' }}
              >
                <FiDownload size={14} />
                安装
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-apple-600 active:bg-apple-50 rounded-full transition-all duration-200 hover:rotate-90"
              title="设置"
            >
              <FiSettings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-24 pt-4 overflow-y-auto relative z-10">
        {/* PWA 安装卡片（放在内容区最顶部，确保可见） */}
        <PwaInstallCard
          installPrompt={installPrompt}
          onInstall={handleInstall}
          debugLines={pwaDebug}
        />
        {children}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-area-bottom" style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)', borderTop: '2px solid #e8f5e0' }}>
        <div className="max-w-lg mx-auto flex justify-around relative">
          {/* 🌱 小草装饰 */}
          <span className="absolute -top-5 left-[8%] text-xs opacity-40 animate-float" style={{ animationDelay: '0s' }}>🌱</span>
          <span className="absolute -top-5 right-[8%] text-xs opacity-40 animate-float" style={{ animationDelay: '1.5s' }}>🌱</span>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center py-2 px-2 text-xs gap-0.5 min-w-0 flex-1 transition-all duration-200 relative"
              >
                {isActive && (
                  <>
                    <div className="absolute -top-3 w-8 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #9ae869, #5cb818)' }} />
                    <span className="absolute -top-5 text-xs animate-bounceIn">🍏</span>
                  </>
                )}
                <span className={`transition-all duration-200 ${isActive ? 'scale-110' : 'opacity-50'}`}>
                  {tab.icon}
                </span>
                <span style={{ color: isActive ? '#387612' : '#9ca3af', fontWeight: isActive ? 600 : 400 }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 设置弹窗 */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

// ============ 🍏 设置弹窗 ============

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    import('../store/db').then(({ getSettings }) => {
      getSettings().then(setSettings);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    const { saveSettings } = await import('../store/db');
    await saveSettings(settings);
    onClose();
  };

  const handleTest = async () => {
    if (!settings?.ai?.apiKey) {
      setTestResult('🍎 请先填写 API Key');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const { testAIConnection } = await import('../services/ai');
    const ok = await testAIConnection(settings.ai);
    setTestResult(ok ? '🍏 连接成功！青苹果就绪~' : '🍎 连接失败，请检查 API Key 和设置');
    setTesting(false);
  };

  if (!settings) return null;

  const providers = [
    { value: 'deepseek', label: '🍏 DeepSeek（推荐）' },
    { value: 'anthropic', label: 'Anthropic Claude' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'custom', label: '🔧 自定义接口' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 shadow-2xl relative" style={{ border: '2px solid #dff9c8' }}>
        {/* 装饰 */}
        <span className="absolute -top-4 -right-2 text-3xl animate-float select-none">🍏</span>
        <span className="absolute top-20 -left-3 text-xl opacity-30 animate-float select-none" style={{ animationDelay: '1s' }}>🍎</span>
        <span className="absolute bottom-20 right-2 text-lg opacity-20 animate-float select-none" style={{ animationDelay: '2s' }}>🍏</span>

        <div className="flex items-center gap-3 mb-5">
          <img src="/apple-icon.svg" alt="" className="w-8 h-8 animate-float" />
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>设置</h2>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">🤖 AI 提供商</label>
          <select
            value={settings.ai.provider}
            onChange={(e) => {
              const provider = e.target.value;
              const defaults: Record<string, { model: string; baseURL: string }> = {
                anthropic: { model: 'claude-sonnet-4-6', baseURL: 'https://api.anthropic.com/v1' },
                openai: { model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
                deepseek: { model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
                custom: { model: '', baseURL: '' },
              };
              setSettings({ ...settings, ai: { ...settings.ai, provider, model: defaults[provider].model, baseURL: defaults[provider].baseURL } });
            }}
            className="input-apple w-full"
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">🔑 API Key</label>
          <input
            type="password"
            value={settings.ai.apiKey}
            onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, apiKey: e.target.value } })}
            placeholder="sk-..."
            className="input-apple w-full"
          />
          <p className="text-xs text-gray-400 mt-1">🔒 仅保存在你的浏览器中</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">🧠 模型</label>
          <input
            type="text"
            value={settings.ai.model}
            onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, model: e.target.value } })}
            className="input-apple w-full"
          />
        </div>

        {settings.ai.provider === 'custom' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">🌐 API 地址</label>
            <input
              type="text"
              value={settings.ai.baseURL}
              onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, baseURL: e.target.value } })}
              placeholder="https://api.example.com/v1"
              className="input-apple w-full"
            />
          </div>
        )}

        <div className="mb-5 card-apple p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            📝 每次刷题数量：<span className="text-apple-600 font-bold">{settings.questionsPerSession} 题</span>
          </label>
          <input type="range" min="5" max="50" step="5" value={settings.questionsPerSession}
            onChange={(e) => setSettings({ ...settings, questionsPerSession: Number(e.target.value) })} className="w-full accent-apple-500" />
        </div>

        <div className="mb-5 card-apple p-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            🏆 考试题目数量：<span className="text-apple-600 font-bold">{settings.examQuestionCount} 题</span>
          </label>
          <input type="range" min="10" max="100" step="5" value={settings.examQuestionCount}
            onChange={(e) => setSettings({ ...settings, examQuestionCount: Number(e.target.value) })} className="w-full accent-apple-500" />
        </div>

        <button onClick={handleTest} disabled={testing}
          className="w-full py-2.5 mb-3 text-sm btn-apple-outline disabled:opacity-50">
          {testing ? '🔄 测试中...' : '🔗 测试 AI 连接'}
        </button>
        {testResult && (
          <p className={`text-sm mb-4 text-center font-medium ${testResult.includes('成功') ? 'text-apple-600' : 'text-red-500'}`}>
            {testResult}
          </p>
        )}

        <div className="mb-5 p-4 rounded-2xl" style={{ border: '2px solid #ffe0e0', background: '#fff5f5' }}>
          <p className="text-sm font-medium text-red-500 mb-1">🗑 数据管理</p>
          <p className="text-xs text-gray-400 mb-3">清空所有题库、错题、笔记和练习记录</p>
          <button
            onClick={async () => {
              if (!confirm('确定要删除所有数据吗？此操作不可恢复！\n\n包括：所有题库、错题记录、手写笔记、练习记录')) return;
              const { clearAllData } = await import('../store/db');
              await clearAllData();
              alert('所有数据已清空');
              onClose();
              window.location.reload();
            }}
            className="w-full py-2.5 text-sm rounded-xl font-medium transition-colors"
            style={{ color: '#e03131', border: '2px solid #ffc9c9', background: 'white' }}
          >
            清空所有数据
          </button>
        </div>

        <button onClick={handleSave} className="w-full py-3 btn-apple mb-2">
          🍏 保存设置
        </button>
        <button onClick={onClose}
          className="w-full py-2.5 text-gray-400 text-sm hover:text-gray-600 transition-colors rounded-xl hover:bg-gray-50">
          取消
        </button>
      </div>
    </div>
  );
}

// ============ 📲 PWA 安装提示卡片 ============

function PwaInstallCard({ installPrompt, onInstall, debugLines }: {
  installPrompt: any;
  onInstall: () => void;
  debugLines: string[];
}) {
  return (
    <div className="mb-4 space-y-3">
      {/* 有 beforeinstallprompt → 显示安装按钮 */}
      {installPrompt && (
        <div className="card-apple p-4 text-center animate-bounceIn">
          <p className="text-3xl mb-2">🍏</p>
          <p className="font-bold text-apple-600 mb-1">青苹果刷题可安装！</p>
          <p className="text-sm text-gray-500 mb-3">添加到桌面，像 App 一样使用</p>
          <button onClick={onInstall}
            className="px-6 py-2.5 rounded-full text-white font-bold text-sm animate-pulse"
            style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}>
            📲 安装到桌面
          </button>
        </div>
      )}

      {/* 没有 beforeinstallprompt → 显示手动指引 */}
      {!installPrompt && (
        <div className="card-apple p-4 text-center">
          <p className="text-2xl mb-1">📱</p>
          <p className="font-bold text-gray-700 mb-1">添加到主屏幕</p>
          <p className="text-sm text-gray-500 mb-2">
            点击 Chrome 地址栏右边的 <span className="font-bold text-apple-600">⋮</span> → 选择 <span className="font-bold text-apple-600">添加到主屏幕</span>
          </p>
          <p className="text-xs text-gray-400">
            (Chrome 图标位置：和网址同一行，最右侧)
          </p>
        </div>
      )}

      {/* 调试信息（始终显示） */}
      <div className="text-xs p-2 rounded-lg bg-gray-50 border border-gray-200 font-mono text-gray-500">
        <div>SW支持: {('serviceWorker' in navigator) ? '✅' : '❌'}</div>
        <div>在线状态: {navigator.onLine ? '✅ 在线' : '❌ 离线'}</div>
        {debugLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {debugLines.length === 0 && <div>⏳ 检测中...</div>}
        <div className="mt-1 text-gray-400">刷新时间: {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
