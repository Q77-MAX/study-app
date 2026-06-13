import { useState, useEffect } from 'react';
import { getAllAccounts, createAccount, loginAccount, getInviteCode } from '../store/accounts';
import { setDBAccount } from '../store/db';

interface LoginScreenProps {
  onLogin: (account: any) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAccounts, setHasAccounts] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    getAllAccounts().then(list => setHasAccounts(list.length > 0));
    // 自动登录
    const saved = localStorage.getItem('current_account');
    if (saved) {
      try {
        const acct = JSON.parse(saved);
        setDBAccount(acct.id);
        onLogin(acct);
      } catch {}
    }
    // PWA 安装监听
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    setTimeout(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          if (regs.length > 0 && !deferredPrompt) setShowInstall(true);
        });
      }
    }, 3000);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const doInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const r = await deferredPrompt.userChoice;
      if (r.outcome === 'accepted') {
        setShowInstall(false);
        setDeferredPrompt(null);
      }
    }
  };

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) { setError('请填写用户名和密码'); return; }
    setLoading(true); setError(null);
    try {
      const account = await loginAccount(name.trim(), password);
      setDBAccount(account.id);
      onLogin(account);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !password.trim()) { setError('请填写用户名和密码'); return; }
    if (password.length < 3) { setError('密码至少3位'); return; }
    // 需要邀请码
    const code = await getInviteCode();
    if (code && inviteCode.trim() !== code) { setError('邀请码错误'); return; }
    setLoading(true); setError(null);
    try {
      const account = await createAccount(name.trim(), password);
      if (account.status === 'pending') {
        setError(null);
        alert('✅ 注册成功！\n\n请等待管理员审核通过后即可登录。');
        setName(''); setPassword(''); setInviteCode('');
        setMode('login');
      } else {
        setDBAccount(account.id);
        onLogin(account);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #f2fde4 0%, #fafdf6 50%, #fff 100%)' }}>
      <div className="text-8xl animate-float mb-4">🍏</div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#387612' }}>青苹果刷题</h1>
      <p className="text-sm text-gray-400 mb-8">云端账号 · 管理员审核制</p>

      <div className="w-full max-w-sm card-apple p-5 space-y-4">
        <div className="flex rounded-xl overflow-hidden border-2 border-gray-100">
          <button onClick={() => setMode('login')}
            className="flex-1 py-2.5 text-sm font-medium transition-colors"
            style={{ background: mode === 'login' ? '#f2fde4' : 'white', color: mode === 'login' ? '#387612' : '#999' }}>登录</button>
          <button onClick={() => setMode('register')}
            className="flex-1 py-2.5 text-sm font-medium transition-colors"
            style={{ background: mode === 'register' ? '#f2fde4' : 'white', color: mode === 'register' ? '#387612' : '#999' }}>注册</button>
        </div>

        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="用户名" className="input-apple w-full" />
        <input value={password} onChange={e => setPassword(e.target.value)}
          type="password" placeholder="密码" className="input-apple w-full" />

        {mode === 'register' && hasAccounts && (
          <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
            type="text" placeholder="🔑 邀请码" className="input-apple w-full" />
        )}

        {error && <p className="text-sm text-red-500 text-center">🍎 {error}</p>}

        <button onClick={mode === 'login' ? handleLogin : handleRegister}
          disabled={loading}
          className="w-full py-3.5 btn-apple text-base font-bold disabled:opacity-50">
          {loading ? '🍏 处理中...' : (mode === 'login' ? '🍏 登录' : '🍏 注册')}
        </button>

        {mode === 'register' && <p className="text-xs text-gray-400 text-center">密码至少3位。首次注册需管理员审核</p>}
      </div>

      {showInstall && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-bounceIn">
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-lg border-2 border-green-300">
            <span className="text-3xl">🍏</span>
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-800">安装到手机桌面</p>
              {deferredPrompt
                ? <p className="text-xs text-gray-400">点击安装，像 App 一样打开</p>
                : <p className="text-xs text-gray-400">点 Chrome 地址栏 ⋮ → 添加到主屏幕</p>
              }
            </div>
            {deferredPrompt && (
              <button onClick={doInstall}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}>
                安装
              </button>
            )}
            <button onClick={() => setShowInstall(false)}
              className="text-gray-300 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-300 mt-8">账号云端存储 · 刷题数据完全本地</p>
    </div>
  );
}
