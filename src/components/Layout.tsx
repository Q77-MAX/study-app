import { useState, useEffect } from 'react';
import { FiSettings } from 'react-icons/fi';
import WanderingApple from './WanderingApple';
import { getInviteCode, setInviteCode, getPendingAccounts, approveAccount, rejectAccount, deleteAccount, isAdmin } from '../store/accounts';

export type TabId = 'practice' | 'import' | 'wrong' | 'stats' | 'exam';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
  accountName: string;
  onLogout: () => void;
}

// 苹果主题图标 + 点击时互换的表情
const applePairs: Record<string, [string, string]> = {
  practice: ['🍏', '😋'],
  import: ['🍎', '🤩'],
  wrong: ['🍐', '😤'],
  stats: ['🌳', '🍃'],
  exam: ['🍎', '🏅'],
};

const tabs: { id: TabId; label: string }[] = [
  { id: 'practice', label: '刷题' },
  { id: 'import', label: '导入' },
  { id: 'wrong', label: '错题' },
  { id: 'stats', label: '统计' },
  { id: 'exam', label: '考试' },
];

// 背景装饰苹果（大小参差，各有动画）
const bgApples = [
  { top: '2%', left: '2%', size: 55, anim: 'animate-float-slow', emoji: '🍏', op: 0.06 },
  { top: '8%', right: '8%', size: 18, anim: 'animate-bob', emoji: '🍎', op: 0.10 },
  { top: '15%', left: '12%', size: 35, anim: 'animate-float-fast', emoji: '🍏', op: 0.08 },
  { top: '20%', right: '3%', size: 48, anim: 'animate-sway', emoji: '🍏', op: 0.05 },
  { top: '28%', left: '3%', size: 14, anim: 'animate-float', emoji: '🍎', op: 0.12 },
  { top: '35%', right: '15%', size: 28, anim: 'animate-bob', emoji: '🍏', op: 0.09 },
  { top: '40%', left: '55%', size: 12, anim: 'animate-float-fast', emoji: '🍎', op: 0.11 },
  { top: '48%', left: '2%', size: 60, anim: 'animate-float-slow', emoji: '🍏', op: 0.04 },
  { top: '52%', right: '5%', size: 22, anim: 'animate-sway', emoji: '🍏', op: 0.10 },
  { top: '58%', left: '8%', size: 42, anim: 'animate-bob', emoji: '🍎', op: 0.07 },
  { top: '65%', right: '12%', size: 16, anim: 'animate-float', emoji: '🍏', op: 0.12 },
  { top: '70%', left: '70%', size: 10, anim: 'animate-float-fast', emoji: '🍎', op: 0.13 },
  { top: '75%', left: '3%', size: 32, anim: 'animate-sway', emoji: '🍏', op: 0.08 },
  { top: '82%', right: '3%', size: 25, anim: 'animate-bob', emoji: '🍏', op: 0.09 },
  { top: '88%', left: '45%', size: 38, anim: 'animate-float-slow', emoji: '🍎', op: 0.06 },
  { top: '92%', right: '50%', size: 15, anim: 'animate-float', emoji: '🍏', op: 0.11 },
  { top: '10%', left: '35%', size: 20, anim: 'animate-float-fast', emoji: '🍏', op: 0.10 },
  { top: '33%', left: '80%', size: 11, anim: 'animate-bob', emoji: '🍎', op: 0.13 },
  { top: '62%', left: '30%', size: 45, anim: 'animate-float-slow', emoji: '🍏', op: 0.05 },
  { top: '95%', left: '15%', size: 18, anim: 'animate-sway', emoji: '🍎', op: 0.10 },
];

export default function Layout({ activeTab, onTabChange, children, accountName, onLogout }: LayoutProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pwaDebug, setPwaDebug] = useState<string[]>([]);
  const [tabTaps, setTabTaps] = useState<Record<string, boolean>>({});

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
        {/* 大苹果：可交互，到处漂泊 */}
        <WanderingApple />
        {bgApples.map((a, i) => (
          <span
            key={i}
            className={`absolute select-none ${a.anim}`}
            style={{
              top: a.top,
              left: a.left,
              right: a.right,
              fontSize: `${a.size}px`,
              opacity: a.op,
              animationDelay: `${(i * 0.7) % 4}s`,
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
            <span className="text-xs text-gray-400 mr-1">{accountName}</span>
            <button onClick={onLogout} className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="退出登录">
              退出
            </button>
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
        {children}
      </main>

      {/* PWA 安装浮层 */}
      {installPrompt && (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-bounceIn">
          <div className="card-apple p-4 flex items-center gap-3 shadow-lg" style={{ border: '2px solid #9ae869' }}>
            <span className="text-3xl">🍏</span>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: '#387612' }}>添加到桌面</p>
              <p className="text-xs text-gray-400">像 App 一样使用，无需每次打开浏览器</p>
            </div>
            <button onClick={handleInstall}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}>
              安装
            </button>
            <button onClick={() => setInstallPrompt(null)}
              className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-area-bottom" style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)', borderTop: '2px solid #e8f5e0' }}>
        <div className="max-w-lg mx-auto flex justify-around relative">
          {/* 🌱 小草装饰 */}
          <span className="absolute -top-5 left-[8%] text-xs opacity-40 animate-float" style={{ animationDelay: '0s' }}>🌱</span>
          <span className="absolute -top-5 right-[8%] text-xs opacity-40 animate-float" style={{ animationDelay: '1.5s' }}>🌱</span>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const pair = applePairs[tab.id];
            const tapped = tabTaps[tab.id];
            const icon = tapped ? pair[1] : pair[0];
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  setTabTaps(prev => ({ ...prev, [tab.id]: true }));
                  setTimeout(() => setTabTaps(prev => ({ ...prev, [tab.id]: false })), 800);
                }}
                className="flex flex-col items-center py-2 px-2 text-xs gap-0.5 min-w-0 flex-1 transition-all duration-200 relative"
              >
                {isActive && (
                  <>
                    <div className="absolute -top-3 w-8 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #8fd84e, #4ea80e)' }} />
                    <span className="absolute -top-5 text-xs animate-bounceIn">🍏</span>
                  </>
                )}
                <span className={`transition-all duration-200 text-2xl ${isActive ? 'scale-110' : 'opacity-50'} ${tapped ? 'animate-bounceIn' : ''}`}>
                  {icon}
                </span>
                <span style={{ color: isActive ? '#2e6b08' : '#9ca3af', fontWeight: isActive ? 600 : 400 }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 设置弹窗 */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          installPrompt={installPrompt}
          onInstall={handleInstall}
          pwaDebug={pwaDebug}
        />
      )}
    </div>
  );
}

// ============ 🍏 设置弹窗 ============

function SettingsModal({ onClose, installPrompt, onInstall, pwaDebug }: {
  onClose: () => void;
  installPrompt: any;
  onInstall: () => void;
  pwaDebug: string[];
}) {
  const [settings, setSettings] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [invite, setInvite] = useState('');
  const [inviteSaved, setInviteSaved] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [admin, setAdmin] = useState(false);

  const loadAdminData = async () => {
    const c = await getInviteCode().catch(() => null);
    if (c) setInvite(c);
    const p = await getPendingAccounts().catch(() => []);
    setPending(p);
    const { getAllAccounts } = await import('../store/accounts');
    const all = await getAllAccounts().catch(() => []);
    setAllUsers(all);
  };

  useEffect(() => {
    import('../store/db').then(({ getSettings }) => getSettings().then(setSettings));
    isAdmin().then(a => { setAdmin(a); if (a) loadAdminData(); });
  }, []);

  const handleApprove = async (id: string) => {
    await approveAccount(id);
    loadAdminData();
  };

  const handleReject = async (id: string) => {
    await rejectAccount(id);
    loadAdminData();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除用户「${name}」吗？\n\n该用户将无法再登录，其本地刷题数据不受影响。`)) return;
    await deleteAccount(id);
    loadAdminData();
  };

  const handleSaveInvite = async () => {
    await setInviteCode(invite.trim());
    setInviteSaved(true);
    setTimeout(() => setInviteSaved(false), 2000);
  };

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
          <h2 className="text-lg font-bold" style={{ color: '#387612' }}>设置 <span className="text-xs text-gray-300 font-normal">v2</span></h2>
        </div>

        {/* 📲 PWA 安装 */}
        <div className="mb-5 p-4 rounded-2xl" style={{ border: '2px solid #dff9c8', background: '#fafff5' }}>
          <p className="font-medium text-gray-700 mb-2">📲 添加到手机桌面</p>
          {installPrompt ? (
            <>
              <p className="text-sm text-gray-500 mb-3">点击下方按钮，像 App 一样使用青苹果刷题</p>
              <button onClick={onInstall}
                className="w-full py-3 rounded-xl text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}>
                📲 安装到桌面
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-2">
                在 Chrome 地址栏最右边点 <span className="font-bold text-apple-600">⋮</span> → <span className="font-bold text-apple-600">添加到主屏幕</span>
              </p>
              <p className="text-xs text-gray-400">
                (三个点在浏览器地址栏里，不是在网页上)
              </p>
            </>
          )}
          {/* 调试信息 */}
          <details className="mt-3">
            <summary className="text-xs text-gray-400 cursor-pointer">🔧 调试信息</summary>
            <div className="mt-2 text-xs font-mono text-gray-500 space-y-0.5 p-2 rounded bg-gray-50">
              <div>浏览器 SW: {('serviceWorker' in navigator) ? '✅' : '❌'}</div>
              <div>网络: {navigator.onLine ? '✅ 在线' : '❌ 离线'}</div>
              {pwaDebug.map((line, i) => <div key={i}>{line}</div>)}
              <div className="text-gray-400">刷新: {new Date().toLocaleTimeString()}</div>
            </div>
          </details>
        </div>

        {admin && (
          <details className="mb-5">
            <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-apple-600 transition-colors p-2">
              🔑 管理员面板
            </summary>
            <div className="p-4 rounded-2xl mt-3" style={{ border: '2px solid #ffe082', background: '#fff8e1' }}>
            <p className="font-medium text-gray-700 mb-2">🔑 邀请码管理</p>
              <p className="text-xs text-gray-400 mb-3">设置后新用户注册必须输入此邀请码</p>
              <div className="flex gap-2">
                <input value={invite} onChange={e => setInvite(e.target.value)}
                  placeholder="输入邀请码" className="input-apple flex-1" />
                <button onClick={handleSaveInvite}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: inviteSaved ? '#9ae869' : '#5cb818' }}>
                  {inviteSaved ? '✅' : '保存'}
                </button>
              </div>
            </div>

            {/* 审核队列 */}
            <div className="mb-5 p-4 rounded-2xl" style={{ border: '2px solid #ffc9c9', background: '#fff5f5' }}>
              <p className="font-medium text-gray-700 mb-2">📋 待审核 <span className="text-xs text-red-400">({pending.length}人)</span></p>
              {pending.length === 0 ? (
                <p className="text-sm text-gray-400">暂无待审核用户</p>
              ) : (
                <div className="space-y-2">
                  {pending.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{a.name}</p>
                        <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(a.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ background: '#5cb818' }}>✓ 通过</button>
                        <button onClick={() => handleReject(a.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ background: '#e03131' }}>✕ 拒绝</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 所有用户 */}
            <div className="p-4 rounded-2xl" style={{ background: '#fafdf6', border: '2px solid #e8f5e0' }}>
              <p className="font-medium text-gray-700 mb-2">👥 所有用户 <span className="text-xs text-gray-400">({allUsers.length}人)</span></p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg text-sm bg-white">
                    <span className="text-gray-700">{u.name}{u.is_admin ? ' 👑' : ''}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: u.status === 'approved' ? '#f2fde4' : u.status === 'pending' ? '#fff8e1' : '#fff0f0',
                        color: u.status === 'approved' ? '#387612' : u.status === 'pending' ? '#e67700' : '#cf1322',
                      }}>
                        {u.status === 'approved' ? '✅ 已通过' : u.status === 'pending' ? '⏳ 待审核' : '❌ 已拒绝'}
                      </span>
                      {!u.is_admin && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          className="text-xs px-2 py-0.5 rounded-full hover:bg-red-50 transition-colors"
                          style={{ color: '#e03131' }}
                          title="删除用户"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        <details className="mb-4">
          <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-apple-600 transition-colors p-2">🤖 AI 提供商</summary>
          <div className="mt-2">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">服务商</label>
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
          </div>
        </details>

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
